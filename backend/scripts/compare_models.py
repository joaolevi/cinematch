"""EXP01: compara offline o recomendador atual, a versão com embeddings e um grafo de gosto.

Base: MovieLens (ml-latest-small). Nada do TMDB é usado. A fórmula do conteúdo e do híbrido reproduz
`backend/scripts/evaluate_recommender.py` (e, por ele, `app/services/recommender.py`).

Protocolo:
- Parâmetros de cada variante escolhidos no corte temporal global (80% passado, 20% futuro).
- Resultado final medido no corte por usuário (últimos 20% de cada pessoa), com IC 95% por bootstrap.
- Acerto = filme avaliado com nota >= 4 no período de teste. Métrica principal: NDCG@20.

A base não fica no repositório: baixe `ml-latest-small` em https://grouplens.org/datasets/movielens/latest/
As variantes com embeddings precisam de `pip install sentence-transformers`; sem a biblioteca, elas são puladas.

Uso (a partir de backend/):
    python -m scripts.compare_models <pasta-do-ml-latest-small>
"""

import argparse
import csv
import re
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

TOP_K = 20
MIN_RATINGS_IN_CATALOG = 5
MIN_HISTORY = 5
LIKED_RATING = 4.0
TRAIN_SHARE = 0.8
POPULARITY_BONUS = 0.1  # igual ao recomendador
BOOTSTRAP = 2000
ALPHAS = (0.2, 0.5, 0.8)  # peso do conteúdo nos híbridos
DAMPINGS = (0.3, 0.5, 0.7, 0.85)  # chance de continuar o passeio no grafo
BETAS = (0.0, 0.2, 0.4, 0.6, 0.8)  # chance de, num título, ir para pessoas em vez de atributos
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def rating_weight(r: float) -> float:
    return (r - 2.5) / 2.5


def minmax(x: np.ndarray) -> np.ndarray:
    lo, hi = float(x.min()), float(x.max())
    return np.zeros_like(x) if hi - lo < 1e-9 else (x - lo) / (hi - lo)


# ------------------------------------------------------------------ dados
def load(root: Path):
    with open(root / "ratings.csv", newline="", encoding="utf-8") as f:
        ratings = [(int(r["userId"]), int(r["movieId"]), float(r["rating"]), int(r["timestamp"])) for r in csv.DictReader(f)]
    titles, genres = {}, {}
    with open(root / "movies.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            m = int(row["movieId"])
            titles[m] = row["title"]
            genres[m] = [] if row["genres"].startswith("(no") else row["genres"].split("|")
    tags = defaultdict(list)
    with open(root / "tags.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tags[int(row["movieId"])].append(row["tag"].strip().lower())
    counts = Counter(m for _, m, _, _ in ratings)
    movies = sorted(m for m, c in counts.items() if c >= MIN_RATINGS_IN_CATALOG and m in genres)
    return ratings, movies, titles, genres, tags


def tokens(title, gs, ts):
    out = []
    for g in gs:
        out += ["g:" + g.lower().replace(" ", "_")] * 2
    out += ["t:" + t.replace(" ", "_") for t in sorted(set(ts))]
    y = re.search(r"\((\d{4})\)", title)
    if y:
        out.append(f"d:{int(y.group(1)) // 10 * 10}")
    return " ".join(out)


def text(title, gs, ts):
    clean = re.sub(r"\s*\(\d{4}\)\s*$", "", title)
    parts = [clean + "."]
    if gs:
        parts.append("Genres: " + ", ".join(gs) + ".")
    if ts:
        parts.append("Tags: " + ", ".join(sorted(set(ts))[:30]) + ".")
    y = re.search(r"\((\d{4})\)", title)
    if y:
        parts.append(f"Released in the {int(y.group(1)) // 10 * 10}s.")
    return " ".join(parts)


def split_by_time(ratings):
    ts = sorted(r[3] for r in ratings)
    cut = ts[int(TRAIN_SHARE * len(ts))]
    train = [r for r in ratings if r[3] < cut]
    test = defaultdict(set)
    for u, m, v, t in ratings:
        if t >= cut and v >= LIKED_RATING:
            test[u].add(m)
    return train, test


def split_by_user(ratings):
    by = defaultdict(list)
    for r in ratings:
        by[r[0]].append(r)
    train, test = [], {}
    for u, rows in by.items():
        rows.sort(key=lambda r: r[3])
        k = int(len(rows) * TRAIN_SHARE)
        train += rows[:k]
        test[u] = {m for _, m, v, _ in rows[k:] if v >= LIKED_RATING}
    return train, test


# ------------------------------------------------------------------ modelos
def item_similarity(train, index):
    users = sorted({r[0] for r in train})
    pos = {u: i for i, u in enumerate(users)}
    rows = [r for r in train if r[1] in index]
    X = sparse.csr_matrix(
        ([rating_weight(r[2]) for r in rows], ([pos[r[0]] for r in rows], [index[r[1]] for r in rows])),
        shape=(len(users), len(index)), dtype=np.float32)
    n = np.sqrt(np.asarray(X.multiply(X).sum(0)).ravel()); n[n == 0] = 1
    Xn = X @ sparse.diags(1 / n)
    S = np.asarray((Xn.T @ Xn).todense(), dtype=np.float32)
    np.fill_diagonal(S, 0)
    return S


def row_normalize(M):
    s = np.asarray(M.sum(1)).ravel(); s[s == 0] = 1
    return sparse.diags(1 / s) @ M


def graph_scores(train, index, attr_matrix, users_eval, histories, damping, beta, iters=25):
    """Passeio com reinício (Personalized PageRank) num grafo título–atributo–pessoa.

    Nós: títulos (N), atributos (A: gêneros, tags, décadas) e pessoas (U). De um título, o passeio vai a uma
    pessoa com chance beta (ligações = notas positivas do treino) e a um atributo com chance 1 - beta.
    De um atributo ou de uma pessoa, volta a um título. O reinício parte dos títulos que a pessoa curtiu.
    """
    N, A = attr_matrix.shape
    users = sorted({r[0] for r in train})
    upos = {u: i for i, u in enumerate(users)}
    rows = [(index[m], upos[u], rating_weight(v)) for u, m, v, _ in train if m in index and v >= 3.5]
    IU = sparse.csr_matrix(([w for _, _, w in rows], ([i for i, _, _ in rows], [u for _, u, _ in rows])), shape=(N, len(users)))
    IA = attr_matrix.tocsr()
    has_u = np.asarray(IU.sum(1)).ravel() > 0
    b_vec = np.where(has_u, beta, 0.0)  # título sem pessoas só vai para atributos
    P_iu = sparse.diags(b_vec) @ row_normalize(IU)
    P_ia = sparse.diags(1 - b_vec) @ row_normalize(IA)
    P_ai = row_normalize(IA.T.tocsr())
    P_ui = row_normalize(IU.T.tocsr())
    # bloco [títulos, atributos, pessoas]
    Z = lambda r, c: sparse.csr_matrix((r, c))
    P = sparse.bmat([[Z(N, N), P_ia, P_iu], [P_ai, Z(A, A), Z(A, len(users))], [P_ui, Z(len(users), A), Z(len(users), len(users))]]).tocsr()
    PT = P.T.tocsr()
    total = N + A + len(users)
    E = np.zeros((total, len(users_eval)), dtype=np.float32)
    for j, u in enumerate(users_eval):
        liked = [(i, w) for i, w in histories[u] if w > 0]
        if not liked:
            liked = [(i, 1.0) for i, _ in histories[u]]
        s = sum(w for _, w in liked)
        for i, w in liked:
            E[i, j] += w / s
    R = E.copy()
    for _ in range(iters):
        R = (1 - damping) * E + damping * (PT @ R)
    return R[:N]  # N x usuários


def evaluate(train, test, index, feats, emb, attr_matrix, configs):
    """Retorna {variante: array (usuários x [acerto, recall, ndcg])} e a lista de usuários."""
    hist = defaultdict(list); pop = np.zeros(len(index))
    for u, m, v, _ in train:
        if m in index:
            hist[u].append((index[m], rating_weight(v))); pop[index[m]] += 1
    pop = np.log1p(pop) / max(np.log1p(pop).max(), 1e-9)
    S = item_similarity(train, index)
    users = [u for u, liked in test.items()
             if len(hist[u]) >= MIN_HISTORY and ({index[m] for m in liked if m in index} - {i for i, _ in hist[u]})]
    graph = {(d, b): graph_scores(train, index, attr_matrix, users, hist, d, b) for d, b in configs["grafo"]}
    res = defaultdict(list)
    for j, u in enumerate(users):
        seen = {i for i, _ in hist[u]}
        relevant = {index[m] for m in test[u] if m in index} - seen
        rows = np.array([i for i, _ in hist[u]]); w = np.array([x for _, x in hist[u]], dtype=np.float32)
        prof = sparse.csr_matrix(w.reshape(1, -1)) @ feats[rows]
        content = np.asarray((feats @ prof.T).todense()).ravel() / (np.sqrt(prof.multiply(prof).sum()) or 1)
        if emb is not None:
            pe = w @ emb[rows]
            content_e = emb @ (pe / (np.linalg.norm(pe) or 1))
        collab = (w @ S[rows]) / (np.abs(w).sum() + 1e-9)
        cand = np.array([i for i in range(len(index)) if i not in seen])
        c, cf, bonus = minmax(content[cand]), minmax(collab[cand]), POPULARITY_BONUS * pop[cand]
        scores = {"popularidade": pop[cand], "conteúdo TF-IDF (grupo B)": c + bonus}
        for a in ALPHAS:
            scores[f"híbrido TF-IDF a={a}"] = a * c + (1 - a) * cf + bonus
        if emb is not None:
            ce = minmax(content_e[cand])
            scores["conteúdo embeddings"] = ce + bonus
            for a in ALPHAS:
                scores[f"híbrido embeddings a={a}"] = a * ce + (1 - a) * cf + bonus
        for (d, b), G in graph.items():
            scores[f"grafo d={d} b={b}"] = minmax(G[cand, j]) + bonus
        for name, sc in scores.items():
            top = cand[np.argsort(-sc)[:TOP_K]]
            hits = [k for k, it in enumerate(top) if int(it) in relevant]
            gain = sum(1 / np.log2(k + 2) for k in hits); best = sum(1 / np.log2(k + 2) for k in range(min(len(relevant), TOP_K)))
            res[name].append((float(bool(hits)), len(hits) / min(len(relevant), TOP_K), gain / best))
    return {k: np.array(v) for k, v in res.items()}


def ci(diff, seed=0):
    rng = np.random.default_rng(seed)
    s = [diff[rng.integers(0, len(diff), len(diff))].mean() for _ in range(BOOTSTRAP)]
    return float(np.percentile(s, 2.5)), float(np.percentile(s, 97.5))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dataset", type=Path); args = ap.parse_args()
    t0 = time.time()
    ratings, movies, titles, genres, tags = load(args.dataset)
    index = {m: i for i, m in enumerate(movies)}
    docs = [tokens(titles[m], genres[m], tags[m]) for m in movies]
    vec = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False)
    feats = vec.fit_transform(docs).tocsr()
    attr = (feats > 0).astype(np.float32).multiply(feats)  # mesmas ligações e pesos do TF-IDF
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        emb = None
        print("sentence-transformers não instalado: as variantes com embeddings ficam de fora")
    else:
        model = SentenceTransformer(EMBED_MODEL)
        texts = [text(titles[m], genres[m], tags[m]) for m in movies]
        emb = model.encode(texts, batch_size=128, normalize_embeddings=True, show_progress_bar=False)
    print(f"avaliações={len(ratings)} títulos={len(movies)} atributos={feats.shape[1]} ({time.time()-t0:.0f}s)")

    configs = {"grafo": [(d, b) for d in DAMPINGS for b in BETAS]}
    # 1) escolher parâmetros no corte temporal
    train, test = split_by_time(ratings)
    val = evaluate(train, test, index, feats, emb, attr, configs)
    nd = {k: v[:, 2].mean() for k, v in val.items()}
    pick = lambda prefix: max((k for k in nd if k.startswith(prefix)), key=nd.get)
    chosen = {
        "Popularidade": "popularidade",
        "Só conteúdo, TF-IDF (grupo B atual)": "conteúdo TF-IDF (grupo B)",
        "Híbrido atual (grupo A, a=0,5)": "híbrido TF-IDF a=0.5",
        "Híbrido TF-IDF, melhor peso": pick("híbrido TF-IDF"),
        "Grafo só conteúdo (b=0), melhor d": max((k for k in nd if k.startswith("grafo") and k.endswith("b=0.0")), key=nd.get),
        "Grafo completo, melhores d e b": pick("grafo"),
    }
    if emb is not None:
        chosen["Só conteúdo, embeddings"] = "conteúdo embeddings"
        chosen["Híbrido com embeddings, melhor peso"] = pick("híbrido embeddings")
    print(f"\n## Validação (corte temporal) | usuários={len(next(iter(val.values())))}")
    for label, k in chosen.items():
        print(f"{label:42} {k:28} ndcg@20={nd[k]:.4f}")

    # 2) medir no corte por usuário
    train, test = split_by_user(ratings)
    keep = {"grafo": sorted({tuple(float(x.split('=')[1]) for x in k.split()[1:]) for k in chosen.values() if k.startswith("grafo")})}
    res = evaluate(train, test, index, feats, emb, attr, keep)
    base = res["híbrido TF-IDF a=0.5"][:, 2]
    print(f"\n## Teste (últimos 20% de cada pessoa) | usuários={len(base)}")
    print(f"{'variante':42} {'acerto@20':>9} {'recall@20':>9} {'ndcg@20':>8}  diferença no ndcg contra o híbrido atual (IC 95%)")
    for label, k in chosen.items():
        r = res[k]; d = r[:, 2] - base; lo, hi = ci(d)
        print(f"{label:42} {r[:,0].mean():9.3f} {r[:,1].mean():9.3f} {r[:,2].mean():8.4f}  {d.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")
    print("\n## Comparações diretas (diferença no ndcg@20, IC 95%)")
    pairs = [
        ("Híbrido com embeddings, melhor peso", "Híbrido TF-IDF, melhor peso"),
        ("Grafo completo, melhores d e b", "Híbrido TF-IDF, melhor peso"),
        ("Grafo completo, melhores d e b", "Híbrido com embeddings, melhor peso"),
        ("Só conteúdo, embeddings", "Só conteúdo, TF-IDF (grupo B atual)"),
        ("Grafo só conteúdo (b=0), melhor d", "Só conteúdo, TF-IDF (grupo B atual)"),
        ("Grafo só conteúdo (b=0), melhor d", "Só conteúdo, embeddings"),
    ]
    for a, b in pairs:
        if a not in chosen or b not in chosen:
            continue
        d = res[chosen[a]][:, 2] - res[chosen[b]][:, 2]; lo, hi = ci(d)
        print(f"{a} menos {b}: {d.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")
    print(f"\ntempo total: {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
