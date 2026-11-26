"""Lê ratings.csv grande para arrays numpy (sem pandas) e guarda um cache .npz."""
import sys
import time
from pathlib import Path

import numpy as np

CHUNK = 64 * 1024 * 1024


def load_ratings_np(root: Path, cache_dir: Path):
    cache = cache_dir / f"{root.name}_ratings.npz"
    if cache.exists():
        z = np.load(cache)
        return z["u"], z["m"], z["r"], z["t"]
    t0 = time.time()
    parts = []
    with open(root / "ratings.csv", "rb") as f:
        f.readline()  # cabeçalho
        rest = b""
        while True:
            block = f.read(CHUNK)
            if not block:
                break
            block = rest + block
            cut = block.rfind(b"\n") + 1
            rest = block[cut:]
            arr = np.array(block[:cut].replace(b"\n", b",").split(b",")[:-1], dtype=np.float64)  # fallback seguro
            parts.append(arr.reshape(-1, 4))
        if rest.strip():
            parts.append(np.array(rest.strip().split(b","), dtype=np.float64).reshape(-1, 4))
    a = np.concatenate(parts)
    u = a[:, 0].astype(np.int32); m = a[:, 1].astype(np.int32)
    r = a[:, 2].astype(np.float32); t = a[:, 3].astype(np.int64)
    cache_dir.mkdir(parents=True, exist_ok=True)
    np.savez(cache, u=u, m=m, r=r, t=t)
    print(f"ratings lidos: {len(u)} em {time.time() - t0:.0f}s", file=sys.stderr)
    return u, m, r, t


if __name__ == "__main__":
    u, m, r, t = load_ratings_np(Path(sys.argv[1]), Path(sys.argv[2]))
    print(len(u), u.max(), m.max(), r.min(), r.max(), t.min(), t.max())
