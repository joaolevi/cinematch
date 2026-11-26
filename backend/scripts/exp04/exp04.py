"""EXP04: repete o EXP01 (backend/scripts/compare_models.py) no MovieLens 32M.

Mesmo protocolo do compare_models: parâmetros escolhidos no corte temporal global (80% passado / 20% futuro),
resultado medido nos últimos 20% de cada pessoa, acerto = nota >= 4, métricas acerto@20, recall@20, NDCG@20,
IC 95% por bootstrap (cm.ci). As fórmulas (TF-IDF, cosseno, híbrido, bônus de popularidade, grafo com reinício)
vêm do compare_models, importado. O que muda para caber no notebook:

- Catálogo: só filmes com >= --min-ratings avaliações (contadas em toda a base, como no EXP01).
- Avaliação numa amostra de pessoas (semente fixa); o colaborativo e o grafo usam o treino de TODAS as pessoas.
- Colaborativo: só os K vizinhos mais parecidos de cada título (--k), em vez da matriz inteira
  (a matriz inteira também é medida, para comparar).
- Grafo: mesma conta do cm.graph_scores (25 passos, reinício nos títulos curtidos), feita em forma fechada sobre
  a matriz título -> título de dois passos (título -> atributo/pessoa -> título), o que é exatamente igual porque
  o grafo é bipartido e o reinício cai só em títulos. `--check` confere a igualdade contra cm.graph_scores.

Uso (de backend/):
    ../.venv/bin/python -I scripts/exp04/exp04.py <pasta-do-movielens> [--min-ratings 100 --k 50 --users 5000 --val-users 2000]
"""

import argparse
import csv
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]  # backend/scripts/exp04 -> backend
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(HERE))
from scripts import compare_models as cm  # noqa: E402
from load32m import load_ratings_np  # noqa: E402

ITERS = 25  # igual ao default de cm.graph_scores
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:6.0f}s] {msg}", flush=True)


# ------------------------------------------------------------------ dados
def load_meta(root, movie_counts, min_ratings):
    titles, genres = {}, {}
    with open(root / "movies.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            m = int(row["movieId"])
            titles[m] = row["title"]
            genres[m] = [] if row["genres"].startswith("(no") else row["genres"].split("|")
    movies = sorted(m for m in genres if m < len(movie_counts) and movie_counts[m] >= min_ratings)
    keep = set(movies)
    tags = defaultdict(list)
    with open(root / "tags.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            m = int(row["movieId"])
            if m in keep:
                tags[m].append(row["tag"].strip().lower())  # igual a cm.load
    return movies, titles, genres, tags


def split_by_user(u, t):
    """Igual a cm.split_by_user: ordena cada pessoa por data (estável) e guarda os primeiros 80% como treino."""
    order = np.lexsort((t, u))
    us = u[order]
    starts = np.r_[0, np.flatnonzero(np.diff(us)) + 1]
    sizes = np.diff(np.r_[starts, len(us)])
    rank = np.arange(len(us)) - np.repeat(starts, sizes)
    cut = np.repeat((sizes * cm.TRAIN_SHARE).astype(np.int64), sizes)  # int(len * 0,8)
    train = np.zeros(len(u), bool)
    train[order[rank < cut]] = True
    return train


def split_by_time(t):
    cutoff = np.sort(t)[int(cm.TRAIN_SHARE * len(t))]
    return t < cutoff


# ------------------------------------------------------------------ matrizes
def blocked_dense_product(L, R, block=1024):
    """L (n x k) @ R (k x n), ambos esparsos, num denso float32, por blocos de linhas."""
    L = L.tocsr(); R = R.tocsr()
    out = np.zeros((L.shape[0], R.shape[1]), dtype=np.float32)
    for b0 in range(0, L.shape[0], block):
        out[b0:b0 + block] = (L[b0:b0 + block] @ R).toarray()
    return out


def cosine_similarity(tu, ti, tw, n_users, n_items):
    """cm.item_similarity: cosseno entre colunas da matriz pessoa x título com rating_weight, diagonal zerada."""
    X = sparse.csr_matrix((tw, (tu, ti)), shape=(n_users, n_items), dtype=np.float32)
    n = np.sqrt(np.asarray(X.multiply(X).sum(0)).ravel()); n[n == 0] = 1
    Xn = (X @ sparse.diags((1 / n).astype(np.float32))).tocsr()
    S = blocked_dense_product(Xn.T, Xn)
    np.fill_diagonal(S, 0)
    return S


def top_k(S, k, renormalize=False):
    """Guarda só os k maiores valores positivos de cada linha (os vizinhos do título)."""
    n = S.shape[0]
    dense = S.toarray() if sparse.issparse(S) else S
    idx = np.empty((n, k), np.int64)
    for b0 in range(0, n, 1024):  # por blocos, para não criar um índice n x n
        idx[b0:b0 + 1024] = np.argpartition(-dense[b0:b0 + 1024], k, axis=1)[:, :k]
    vals = np.take_along_axis(dense, idx, axis=1)
    vals = np.where(vals > 0, vals, 0).astype(np.float32)
    K = sparse.csr_matrix((vals.ravel(), (np.repeat(np.arange(n), k), idx.ravel())), shape=S.shape)
    K.eliminate_zeros()
    if renormalize:
        K = cm.row_normalize(K).tocsr()
    return K


def two_step_matrices(tu, ti, tr, n_users, n_items, IA):
    """Transições título -> título passando por pessoas (A_u) e por atributos (A_a), como em cm.graph_scores."""
    pos = tr >= 3.5
    IU = sparse.csr_matrix((cm_rating_weight(tr[pos]), (ti[pos], tu[pos])), shape=(n_items, n_users))
    has_u = np.asarray(IU.sum(1)).ravel() > 0
    A_u = blocked_dense_product(cm.row_normalize(IU), cm.row_normalize(IU.T.tocsr()))
    A_a = blocked_dense_product(cm.row_normalize(IA), cm.row_normalize(IA.T.tocsr()))
    return A_u, A_a, has_u


def cm_rating_weight(r):
    return ((np.asarray(r, dtype=np.float64) - 2.5) / 2.5).astype(np.float32)  # = cm.rating_weight, vetorizado


def restart_vectors(hist_items, hist_w, n_items):
    """Matriz E (títulos x pessoas) do reinício, igual a cm.graph_scores."""
    E = np.zeros((n_items, len(hist_items)), dtype=np.float32)
    for j, (items, w) in enumerate(zip(hist_items, hist_w)):
        liked = w > 0
        if liked.any():
            ii, ww = items[liked], w[liked]
        else:
            ii, ww = items, np.ones(len(items), np.float32)
        np.add.at(E[:, j], ii, ww / ww.sum())
    return E


def ppr_many(M, E, dampings):
    """Itens do passeio de cm.graph_scores após ITERS passos: x = (1-d) * sum_{j<=(ITERS-1)/2} (d^2 M^T)^j E.

    Com R0 = E e o grafo bipartido (títulos <-> atributos/pessoas), os passos ímpares deixam os títulos em
    (1-d)E + d^2 M^T x_{t-2}, começando em x_1 = (1-d)E; ITERS = 25 é ímpar."""
    assert ITERS % 2 == 1
    MT = np.ascontiguousarray(M.T) if isinstance(M, np.ndarray) else M.T.tocsr()
    acc = {d: E.copy() for d in dampings}
    term = E
    for j in range(1, (ITERS - 1) // 2 + 1):
        term = MT @ term
        term = np.asarray(term, dtype=np.float32)
        for d in dampings:
            acc[d] += (d ** (2 * j)) * term
    return {d: (1 - d) * acc[d] for d in dampings}


# ------------------------------------------------------------------ avaliação
class Split:
    pass


def prepare(u, m, r, train_mask, test_extra_mask, idx_of, n_items, eval_users_pool, n_eval, seed):
    """Monta histórico/relevantes das pessoas avaliadas e as matrizes do treino."""
    s = Split()
    tm = train_mask & (idx_of[m] >= 0)
    s.tu, s.ti, s.tr = u[tm], idx_of[m[tm]], r[tm]
    s.tw = cm_rating_weight(s.tr)
    s.n_users = int(u.max()) + 1
    s.pop_counts = np.bincount(s.ti, minlength=n_items).astype(np.float64)
    pop = np.log1p(s.pop_counts)
    s.pop = pop / max(pop.max(), 1e-9)
    # histórico e relevantes de cada pessoa elegível
    hist_count = np.bincount(s.tu, minlength=s.n_users)
    tst = test_extra_mask & (r >= cm.LIKED_RATING) & (idx_of[m] >= 0)
    order = np.argsort(s.tu, kind="stable")
    hu, hi, hw = s.tu[order], s.ti[order], s.tw[order]
    hstart = np.searchsorted(hu, np.arange(s.n_users + 1))
    tu_, ti_ = u[tst], idx_of[m[tst]]
    o2 = np.argsort(tu_, kind="stable"); tu_, ti_ = tu_[o2], ti_[o2]
    tstart = np.searchsorted(tu_, np.arange(s.n_users + 1))

    def user_data(x):
        items = hi[hstart[x]:hstart[x + 1]]; w = hw[hstart[x]:hstart[x + 1]]
        rel = set(ti_[tstart[x]:tstart[x + 1]].tolist()) - set(items.tolist())
        return items, w, rel

    pool = np.asarray(eval_users_pool)
    rng = np.random.default_rng(seed)
    elig = [x for x in pool if hist_count[x] >= cm.MIN_HISTORY and user_data(x)[2]]
    s.pool_size = len(pool)
    s.eligible = len(elig)
    if n_eval and len(elig) > n_eval:
        elig = sorted(rng.choice(elig, n_eval, replace=False).tolist())
    s.users = elig
    s.hist_items, s.hist_w, s.relevant = [], [], []
    for x in elig:
        items, w, rel = user_data(x)
        s.hist_items.append(items); s.hist_w.append(w); s.relevant.append(rel)
    return s


def content_scores(feats, hist_items, hist_w):
    n = len(hist_items)
    rows = np.repeat(np.arange(n), [len(x) for x in hist_items])
    W = sparse.csr_matrix((np.concatenate(hist_w), (rows, np.concatenate(hist_items))), shape=(n, feats.shape[0]))
    prof = W @ feats
    norm = np.sqrt(np.asarray(prof.multiply(prof).sum(1)).ravel()); norm[norm == 0] = 1
    return (np.asarray((prof @ feats.T).todense()) / norm[:, None]).astype(np.float32), W


def collab_scores(W, S):
    out = W @ S
    out = out.toarray() if sparse.issparse(out) else np.asarray(out)
    return out / (np.asarray(abs(W).sum(1)).ravel()[:, None] + 1e-9)


def metrics(score, cand, relevant):
    top = cand[np.argsort(-score)[: cm.TOP_K]]
    hits = [k for k, it in enumerate(top) if int(it) in relevant]
    gain = sum(1 / np.log2(k + 2) for k in hits)
    best = sum(1 / np.log2(k + 2) for k in range(min(len(relevant), cm.TOP_K)))
    return float(bool(hits)), len(hits) / min(len(relevant), cm.TOP_K), gain / best


def evaluate(s, feats, collabs, graphs, batch=500):
    """collabs: {rótulo: matriz de similaridade}; graphs: {rótulo: função(batch_slice) -> títulos x pessoas}."""
    res = defaultdict(list)
    n_items = feats.shape[0]
    for b0 in range(0, len(s.users), batch):
        sl = slice(b0, b0 + batch)
        content, W = content_scores(feats, s.hist_items[sl], s.hist_w[sl])
        cf = {lab: collab_scores(W, S) for lab, S in collabs.items()}
        gr = {lab: f(sl) for lab, f in graphs.items()}
        for j in range(content.shape[0]):
            jj = b0 + j
            seen = np.zeros(n_items, bool); seen[s.hist_items[jj]] = True
            cand = np.flatnonzero(~seen)
            rel = s.relevant[jj]
            c = cm.minmax(content[j, cand]); p = s.pop[cand]; bonus = cm.POPULARITY_BONUS * p
            scores = {"popularidade": p, "conteúdo TF-IDF (grupo B)": c + bonus}
            for lab, mat in cf.items():
                f = cm.minmax(mat[j, cand])
                scores[f"colaborativo puro [{lab}]"] = f + bonus
                for a in cm.ALPHAS:
                    scores[f"híbrido TF-IDF a={a} [{lab}]"] = a * c + (1 - a) * f + bonus
            for lab, G in gr.items():
                scores[lab] = cm.minmax(G[cand, j]) + bonus
            for name, sc in scores.items():
                res[name].append(metrics(sc, cand, rel))
        log(f"  avaliadas {min(b0 + batch, len(s.users))}/{len(s.users)} pessoas")
    return {k: np.array(v) for k, v in res.items()}


def graph_fns(s, A_u, A_a, has_u, configs, extra_content_topk=None):
    """Prepara funções que devolvem o grafo para um lote de pessoas. configs: lista de (d, b)."""
    n_items = A_a.shape[0]
    E_all = restart_vectors(s.hist_items, s.hist_w, n_items)
    by_b = defaultdict(list)
    for d, b in configs:
        by_b[b].append(d)
    cache = {}
    for b, ds in by_b.items():
        bv = np.where(has_u, b, 0.0).astype(np.float32)[:, None]
        M = A_a if b == 0 else (bv * A_u + (1 - bv) * A_a)
        t = time.time()
        out = ppr_many(M, E_all, ds)
        for d in ds:
            cache[f"grafo d={d} b={b}"] = out[d]
        del M
        log(f"  grafo b={b} d={ds}: {time.time() - t:.0f}s")
    if extra_content_topk is not None:
        k, d = extra_content_topk
        Mk = top_k(A_a, k, renormalize=True)
        cache[f"grafo só conteúdo d={d} b=0.0 [{k} vizinhos]"] = ppr_many(Mk, E_all, [d])[d]
    return {lab: (lambda sl, G=G: G[:, sl]) for lab, G in cache.items()}


# ------------------------------------------------------------------ conferência
def check_against_cm(root):
    """Confere, no ml-latest-small, que a forma fechada do grafo e o cosseno batem com o compare_models."""
    ratings, movies, titles, genres, tags = cm.load(root)
    index = {mm: i for i, mm in enumerate(movies)}
    feats = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(
        [cm.tokens(titles[mm], genres[mm], tags[mm]) for mm in movies]).tocsr()
    train, test = cm.split_by_user(ratings)
    hist = defaultdict(list)
    for uu, mm, v, _ in train:
        if mm in index:
            hist[uu].append((index[mm], cm.rating_weight(v)))
    users = sorted(hist)[:40]
    users_all = sorted({x[0] for x in train})
    upos = {x: i for i, x in enumerate(users_all)}
    rows = [x for x in train if x[1] in index]
    tu = np.array([upos[x[0]] for x in rows]); ti = np.array([index[x[1]] for x in rows]); tr = np.array([x[2] for x in rows], np.float32)
    S_ref = cm.item_similarity(train, index)
    S_new = cosine_similarity(tu, ti, cm_rating_weight(tr), len(users_all), len(index))
    print("cosseno: maior diferença", float(np.abs(S_ref - S_new).max()))
    A_u, A_a, has_u = two_step_matrices(tu, ti, tr, len(users_all), len(index), feats)
    hi = [np.array([i for i, _ in hist[x]]) for x in users]; hw = [np.array([w for _, w in hist[x]], np.float32) for x in users]
    E = restart_vectors(hi, hw, len(index))
    for d, b in ((0.5, 0.0), (0.3, 0.8)):
        ref = cm.graph_scores(train, index, feats, users, hist, d, b)
        bv = np.where(has_u, b, 0.0).astype(np.float32)[:, None]
        new = ppr_many(bv * A_u + (1 - bv) * A_a, E, [d])[d]
        rel = np.abs(ref - new).max() / np.abs(ref).max()
        print(f"grafo d={d} b={b}: maior diferença relativa {rel:.2e}")


# ------------------------------------------------------------------ principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset", type=Path)
    ap.add_argument("--min-ratings", type=int, default=100)
    ap.add_argument("--k", type=int, default=50)
    ap.add_argument("--users", type=int, default=5000, help="pessoas sorteadas para o teste (0 = todas)")
    ap.add_argument("--val-users", type=int, default=2000, help="pessoas sorteadas para a validação (0 = todas)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-full", action="store_true", help="não mede o colaborativo com a matriz inteira")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    if args.check:
        check_against_cm(args.dataset)
        return

    u, m, r, t = load_ratings_np(args.dataset, args.dataset)  # o cache .npz fica junto da base, fora do repositório
    log(f"avaliações={len(u)} pessoas={len(np.unique(u))}")
    counts = np.bincount(m)
    movies, titles, genres, tags = load_meta(args.dataset, counts, args.min_ratings)
    idx_of = np.full(int(m.max()) + 1, -1, np.int64)
    idx_of[movies] = np.arange(len(movies))
    n_items = len(movies)
    feats = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(
        [cm.tokens(titles[mm], genres[mm], tags[mm]) for mm in movies]).tocsr().astype(np.float32)
    log(f"catálogo={n_items} títulos (>= {args.min_ratings} avaliações), atributos={feats.shape[1]}, "
        f"avaliações no catálogo={(idx_of[m] >= 0).mean():.1%}")
    all_users = np.unique(u)
    summary = {"params": vars(args) | {"dataset": str(args.dataset), "out": str(args.out)}, "n_items": n_items,
               "n_attrs": feats.shape[1]}

    def build(s, label):
        tt = time.time()
        S = cosine_similarity(s.tu, s.ti, s.tw, s.n_users, n_items)
        log(f"{label}: cosseno {n_items}x{n_items} em {time.time() - tt:.0f}s")
        collabs = {f"{args.k} vizinhos": top_k(S, args.k)}
        if not args.no_full:
            collabs["matriz inteira"] = S
        tt = time.time()
        A_u, A_a, has_u = two_step_matrices(s.tu, s.ti, s.tr, s.n_users, n_items, feats)
        log(f"{label}: matrizes do grafo em {time.time() - tt:.0f}s")
        return S, collabs, A_u, A_a, has_u

    # 1) validação: corte temporal
    tm = split_by_time(t)
    rng = np.random.default_rng(args.seed)
    sv = prepare(u, m, r, tm, ~tm, idx_of, n_items, all_users, args.val_users, args.seed)
    log(f"validação: elegíveis={sv.eligible}, avaliadas={len(sv.users)}")
    S, collabs, A_u, A_a, has_u = build(sv, "validação")
    configs = [(d, b) for d in cm.DAMPINGS for b in cm.BETAS]
    val = evaluate(sv, feats, collabs, graph_fns(sv, A_u, A_a, has_u, configs))
    del S, collabs, A_u, A_a
    nd = {k: v[:, 2].mean() for k, v in val.items()}
    kl = f"[{args.k} vizinhos]"
    best_alpha = max(cm.ALPHAS, key=lambda a: nd[f"híbrido TF-IDF a={a} {kl}"])
    best_gc = max((k for k in nd if k.startswith("grafo") and k.endswith("b=0.0")), key=nd.get)
    best_g = max((k for k in nd if k.startswith("grafo")), key=nd.get)
    print("\n## Validação (corte temporal)", f"| pessoas={len(sv.users)}")
    for k in sorted(nd, key=nd.get, reverse=True):
        print(f"{k:48} ndcg@20={nd[k]:.4f}")
    print(f"escolhidos: híbrido a={best_alpha}; {best_gc}; {best_g}")
    summary["validation"] = {"users": len(sv.users), "eligible": sv.eligible, "ndcg": nd,
                             "chosen": [best_alpha, best_gc, best_g]}
    del sv

    # 2) teste: últimos 20% de cada pessoa
    sample = np.sort(np.random.default_rng(args.seed).choice(all_users, args.users, replace=False)) \
        if args.users and args.users < len(all_users) else all_users
    um = split_by_user(u, t)
    st = prepare(u, m, r, um, ~um, idx_of, n_items, sample, 0, args.seed)
    log(f"teste: sorteadas={len(sample)}, avaliadas={len(st.users)}")
    S, collabs, A_u, A_a, has_u = build(st, "teste")
    parse = lambda k: tuple(float(x.split("=")[1]) for x in k.split()[1:3])
    d_gc = parse(best_gc)[0]
    keep = sorted({parse(best_gc), parse(best_g)})
    res = evaluate(st, feats, collabs, graph_fns(st, A_u, A_a, has_u, keep, extra_content_topk=(args.k, d_gc)))

    chosen = {
        "Só os mais populares": "popularidade",
        "Só conteúdo, TF-IDF (grupo B)": "conteúdo TF-IDF (grupo B)",
        f"Grafo só com conteúdo ({best_gc})": best_gc,
        f"Grafo só com conteúdo, {args.k} vizinhos": f"grafo só conteúdo d={d_gc} b=0.0 {kl}",
        f"Híbrido a=0,5 (grupo A), {args.k} vizinhos": f"híbrido TF-IDF a=0.5 {kl}",
        f"Híbrido a={best_alpha} (melhor na validação), {args.k} vizinhos": f"híbrido TF-IDF a={best_alpha} {kl}",
        f"Híbrido a=0,2, {args.k} vizinhos": f"híbrido TF-IDF a=0.2 {kl}",
        f"Colaborativo puro, {args.k} vizinhos": f"colaborativo puro {kl}",
        f"Grafo completo ({best_g})": best_g,
    }
    if not args.no_full:
        chosen |= {"Híbrido a=0,5, matriz inteira": "híbrido TF-IDF a=0.5 [matriz inteira]",
                   "Híbrido a=0,2, matriz inteira": "híbrido TF-IDF a=0.2 [matriz inteira]",
                   "Colaborativo puro, matriz inteira": "colaborativo puro [matriz inteira]"}
    print(f"\n## Teste (últimos 20% de cada pessoa) | pessoas={len(st.users)}")
    print(f"{'variante':52} {'acerto@20':>9} {'recall@20':>9} {'ndcg@20':>8}")
    summary["test"] = {"sampled": int(len(sample)), "users": len(st.users), "rows": {}}
    for label, k in chosen.items():
        x = res[k]
        print(f"{label:52} {x[:, 0].mean():9.3f} {x[:, 1].mean():9.3f} {x[:, 2].mean():8.4f}")
        summary["test"]["rows"][label] = [k] + [float(v) for v in x.mean(0)]
    print("\n## Diferenças no ndcg@20 (IC 95%, bootstrap)")
    pairs = [
        (f"Híbrido a=0,5 (grupo A), {args.k} vizinhos", "Só conteúdo, TF-IDF (grupo B)"),
        (f"Grafo só com conteúdo ({best_gc})", "Só conteúdo, TF-IDF (grupo B)"),
        (f"Grafo só com conteúdo, {args.k} vizinhos", "Só conteúdo, TF-IDF (grupo B)"),
        (f"Grafo completo ({best_g})", f"Híbrido a={best_alpha} (melhor na validação), {args.k} vizinhos"),
        (f"Grafo completo ({best_g})", f"Híbrido a=0,2, {args.k} vizinhos"),
        (f"Híbrido a=0,2, {args.k} vizinhos", f"Colaborativo puro, {args.k} vizinhos"),
    ]
    if not args.no_full:
        pairs += [("Híbrido a=0,5, matriz inteira", "Só conteúdo, TF-IDF (grupo B)"),
                  (f"Grafo completo ({best_g})", "Híbrido a=0,2, matriz inteira"),
                  (f"Híbrido a=0,2, {args.k} vizinhos", "Híbrido a=0,2, matriz inteira"),
                  (f"Híbrido a=0,5 (grupo A), {args.k} vizinhos", "Híbrido a=0,5, matriz inteira")]
    summary["diffs"] = {}
    for a, b in pairs:
        d = res[chosen[a]][:, 2] - res[chosen[b]][:, 2]; lo, hi = cm.ci(d)
        print(f"{a} menos {b}: {d.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")
        summary["diffs"][f"{a} - {b}"] = [float(d.mean()), lo, hi]
    summary["runtime_s"] = time.time() - T0
    log("fim")
    if args.out:
        args.out.write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=float))


if __name__ == "__main__":
    main()
