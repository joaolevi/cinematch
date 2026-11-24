"""Limite de títulos que cada pessoa pode trazer de fora por dia (RFF13).

Cada importação consulta o TMDB ou o MusicBrainz e aumenta o catálogo de todo mundo: 10 por pessoa em 24 horas basta
para completar o diário sem virar uma carga em massa. Como o limite de login (RNFF05), fica na memória do processo,
o que basta para o protótipo; reiniciar o servidor zera a contagem.
"""

import time
from collections import defaultdict, deque

WINDOW_SECONDS = 24 * 60 * 60
MAX_PER_DAY = 10

_imports: dict[int, deque[float]] = defaultdict(deque)


def _recent(user_id: int, now: float) -> deque[float]:
    moments = _imports[user_id]
    while moments and moments[0] <= now - WINDOW_SECONDS:
        moments.popleft()
    return moments


def remaining(user_id: int, now: float | None = None) -> int:
    now = time.monotonic() if now is None else now
    return max(0, MAX_PER_DAY - len(_recent(user_id, now)))


def wait_seconds(user_id: int, now: float | None = None) -> int:
    """Quantos segundos faltam para poder importar de novo; 0 se pode já."""
    now = time.monotonic() if now is None else now
    moments = _recent(user_id, now)
    return int(moments[0] + WINDOW_SECONDS - now) + 1 if len(moments) >= MAX_PER_DAY else 0


def used(user_id: int, now: float | None = None) -> None:
    _imports[user_id].append(time.monotonic() if now is None else now)


def reset() -> None:
    _imports.clear()
