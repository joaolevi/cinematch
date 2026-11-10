"""EXP01, checagem: o grafo só com conteúdo ganha do TF-IDF por mérito ou por favorecer títulos populares?

Duas checagens, na mesma base e no mesmo protocolo do compare_models.py:
1. Mesmo empurrão de popularidade para os dois: o bônus de popularidade varia numa grade, e cada variante fica
   com o melhor bônus no corte temporal.
2. Cauda longa: os 10% de títulos mais avaliados no treino saem da lista de candidatos e dos acertos.
Também mostra a popularidade média do que cada variante sugere (0 = menos avaliado, 1 = mais avaliado).

Uso (a partir de backend/):
    python -m scripts.check_popularity <pasta-do-ml-latest-small>
"""

import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from scripts import compare_models as cm

BONUSES = (0.0, 0.1, 0.3, 0.6, 1.0, 2.0)
DAMPINGS = (0.3, 0.5, 0.7, 0.85)
HEAD_SHARE = 0.10


def run(train, test, index, feats, attr, tail, configs=None):
    hist = defaultdict(list); counts = np.zeros(len(index))
    for u, m, v, _ in train:
        if m in index:
            hist[u].append((index[m], cm.rating_weight(v))); counts[index[m]] += 1
    pop = np.log1p(counts) / max(np.log1p(counts).max(), 1e-9)
    rank = counts.argsort().argsort() / (len(counts) - 1)  # 0 = menos avaliado, 1 = mais avaliado
    head = set(np.argsort(-counts)[: int(HEAD_SHARE * len(counts))].tolist()) if tail else set()
    users = [u for u, liked in test.items()
             if len(hist[u]) >= cm.MIN_HISTORY and ({index[m] for m in liked if m in index} - {i for i, _ in hist[u]} - head)]
    damp = configs["d"] if configs else DAMPINGS
    graph = {d: cm.graph_scores(train, index, attr, users, hist, d, 0.0) for d in damp}
    res = defaultdict(list); popsug = defaultdict(list)
    for j, u in enumerate(users):
        seen = {i for i, _ in hist[u]}
        relevant = {index[m] for m in test[u] if m in index} - seen - head
        rows = np.array([i for i, _ in hist[u]]); w = np.array([x for _, x in hist[u]], dtype=np.float32)
        prof = sparse.csr_matrix(w.reshape(1, -1)) @ feats[rows]
        content = np.asarray((feats @ prof.T).todense()).ravel() / (np.sqrt(prof.multiply(prof).sum()) or 1)
        cand = np.array([i for i in range(len(index)) if i not in seen and i not in head])
        c = cm.minmax(content[cand]); p = pop[cand]
        scores = {"popularidade": p}
        for b in BONUSES:
            scores[f"TF-IDF bônus={b}"] = c + b * p
            for d, G in graph.items():
                scores[f"grafo d={d} bônus={b}"] = cm.minmax(G[cand, j]) + b * p
        for name, sc in scores.items():
            top = cand[np.argsort(-sc)[: cm.TOP_K]]
            hits = [k for k, it in enumerate(top) if int(it) in relevant]
            gain = sum(1 / np.log2(k + 2) for k in hits); best = sum(1 / np.log2(k + 2) for k in range(min(len(relevant), cm.TOP_K)))
            res[name].append(gain / best); popsug[name].append(rank[top].mean())
    return {k: np.array(v) for k, v in res.items()}, {k: float(np.mean(v)) for k, v in popsug.items()}, len(users)


def main():
    root = Path(sys.argv[1])
    ratings, movies, titles, genres, tags = cm.load(root)
    index = {m: i for i, m in enumerate(movies)}
    feats = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(
        [cm.tokens(titles[m], genres[m], tags[m]) for m in movies]).tocsr()
    attr = feats.copy()
    for tail in (False, True):
        label = "cauda longa (sem os 10% mais avaliados)" if tail else "todos os títulos"
        tr, te = cm.split_by_time(ratings)
        val, _, nval = run(tr, te, index, feats, attr, tail)
        nd = {k: v.mean() for k, v in val.items()}
        best_tf = max((k for k in nd if k.startswith("TF-IDF")), key=nd.get)
        best_gr = max((k for k in nd if k.startswith("grafo")), key=nd.get)
        tr, te = cm.split_by_user(ratings)
        d_best = float(best_gr.split()[1].split("=")[1])
        res, ps, n = run(tr, te, index, feats, attr, tail, {"d": (d_best,)})
        print(f"\n## {label} | escolha no corte temporal ({nval} pessoas), medida no corte por pessoa ({n} pessoas)")
        print(f"{'variante':34} {'ndcg@20':>8}  {'popularidade média sugerida':>27}")
        for name in ("popularidade", "TF-IDF bônus=0.1", best_tf, "grafo d=%s bônus=0.1" % d_best, best_gr):
            print(f"{name:34} {res[name].mean():8.4f}  {ps[name]:27.2f}")
        diff = res[best_gr] - res[best_tf]; lo, hi = cm.ci(diff)
        print(f"grafo ({best_gr}) menos TF-IDF ({best_tf}), cada um com o melhor bônus: {diff.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")
        diff = res["grafo d=%s bônus=0.1" % d_best] - res["TF-IDF bônus=0.1"]; lo, hi = cm.ci(diff)
        print(f"com o bônus atual (0,1) nos dois: {diff.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")


if __name__ == "__main__":
    main()
