"""EXP04, checagem complementar (como backend/scripts/check_popularity.py, no MovieLens 32M).

No corte por pessoa (mesma amostra do exp04.py), compara o TF-IDF, o grafo só com conteúdo, o grafo completo com os
parâmetros do EXP01 (d=0,3, b=0,8) e o híbrido 0,2 com K vizinhos, com o bônus atual (0,1):
- em todos os títulos e na cauda longa (sem os 10% mais avaliados no treino, nos candidatos e nos acertos);
- e a popularidade média do que cada variante sugere (0 = menos avaliado, 1 = mais avaliado).

Uso (de backend/): ../.venv/bin/python -I <este arquivo> <pasta-do-ml-32m> [--min-ratings 100 --k 50 --users 5000]
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, str(Path(__file__).resolve().parent))
import exp04 as e  # noqa: E402  (exp04 coloca backend/ no sys.path e importa compare_models como cm)
from exp04 import cm, log

HEAD_SHARE = 0.10  # igual a check_popularity.py


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset", type=Path)
    ap.add_argument("--min-ratings", type=int, default=100)
    ap.add_argument("--k", type=int, default=50)
    ap.add_argument("--users", type=int, default=5000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    u, m, r, t = e.load_ratings_np(args.dataset, args.dataset)
    movies, titles, genres, tags = e.load_meta(args.dataset, np.bincount(m), args.min_ratings)
    idx_of = np.full(int(m.max()) + 1, -1, np.int64); idx_of[movies] = np.arange(len(movies))
    n = len(movies)
    feats = TfidfVectorizer(token_pattern=r"[^ ]+", lowercase=False).fit_transform(
        [cm.tokens(titles[x], genres[x], tags[x]) for x in movies]).tocsr().astype(np.float32)
    all_users = np.unique(u)
    sample = np.sort(np.random.default_rng(args.seed).choice(all_users, args.users, replace=False))
    um = e.split_by_user(u, t)
    s = e.prepare(u, m, r, um, ~um, idx_of, n, sample, 0, args.seed)
    log(f"catálogo={n}, pessoas avaliadas={len(s.users)}")
    S = e.cosine_similarity(s.tu, s.ti, s.tw, s.n_users, n)
    SK = e.top_k(S, args.k); del S
    A_u, A_a, has_u = e.two_step_matrices(s.tu, s.ti, s.tr, s.n_users, n, feats)
    graphs = e.graph_fns(s, A_u, A_a, has_u, [(0.5, 0.0), (0.3, 0.8)])
    del A_u, A_a
    G_c, G_f = graphs["grafo d=0.5 b=0.0"](slice(None)), graphs["grafo d=0.3 b=0.8"](slice(None))
    log("grafos prontos")

    counts = s.pop_counts
    rank = counts.argsort().argsort() / (len(counts) - 1)
    head = np.zeros(n, bool); head[np.argsort(-counts)[: int(HEAD_SHARE * n)]] = True
    out = {}
    for tail in (False, True):
        res, popsug = defaultdict(list), defaultdict(list)
        for b0 in range(0, len(s.users), 500):
            sl = slice(b0, b0 + 500)
            content, W = e.content_scores(feats, s.hist_items[sl], s.hist_w[sl])
            cf = e.collab_scores(W, SK)
            for j in range(content.shape[0]):
                jj = b0 + j
                excl = np.zeros(n, bool); excl[s.hist_items[jj]] = True
                if tail:
                    excl |= head
                cand = np.flatnonzero(~excl)
                rel = {i for i in s.relevant[jj] if not (tail and head[i])}
                if not rel:
                    continue
                c = cm.minmax(content[j, cand]); p = s.pop[cand]; bonus = cm.POPULARITY_BONUS * p
                scores = {
                    "popularidade": p,
                    "TF-IDF (grupo B)": c + bonus,
                    "grafo só conteúdo d=0.5": cm.minmax(G_c[cand, jj]) + bonus,
                    "grafo completo d=0.3 b=0.8 (parâmetros do EXP01)": cm.minmax(G_f[cand, jj]) + bonus,
                    f"híbrido a=0.2, {args.k} vizinhos": 0.2 * c + 0.8 * cm.minmax(cf[j, cand]) + bonus,
                }
                for name, sc in scores.items():
                    top = cand[np.argsort(-sc)[: cm.TOP_K]]
                    res[name].append(e.metrics(sc, cand, rel))
                    popsug[name].append(rank[top].mean())
        label = "cauda longa (sem os 10% mais avaliados)" if tail else "todos os títulos"
        users = len(next(iter(res.values())))
        print(f"\n## {label} | pessoas={users}")
        print(f"{'variante':52} {'acerto@20':>9} {'ndcg@20':>8} {'pop. média sugerida':>20}")
        block = {"users": users, "rows": {}, "diffs": {}}
        for name, x in res.items():
            x = np.array(x)
            print(f"{name:52} {x[:, 0].mean():9.3f} {x[:, 2].mean():8.4f} {np.mean(popsug[name]):20.2f}")
            block["rows"][name] = [float(x[:, 0].mean()), float(x[:, 2].mean()), float(np.mean(popsug[name]))]
        for a, b in (("grafo só conteúdo d=0.5", "TF-IDF (grupo B)"),
                     ("grafo completo d=0.3 b=0.8 (parâmetros do EXP01)", f"híbrido a=0.2, {args.k} vizinhos"),
                     ("grafo só conteúdo d=0.5", f"híbrido a=0.2, {args.k} vizinhos")):
            d = np.array(res[a])[:, 2] - np.array(res[b])[:, 2]; lo, hi = cm.ci(d)
            print(f"{a} menos {b}: {d.mean():+.4f} ({lo:+.4f} a {hi:+.4f})")
            block["diffs"][f"{a} - {b}"] = [float(d.mean()), lo, hi]
        out[label] = block
    log("fim")
    if args.out:
        args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
