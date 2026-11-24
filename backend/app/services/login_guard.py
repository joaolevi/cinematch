"""Limite de tentativas de login (RNFF05).

Depois de 5 senhas erradas para o mesmo e-mail em 15 minutos, ou 20 do mesmo endereço de rede, o login fica bloqueado
até a tentativa mais antiga sair da janela. Acertar a senha limpa as falhas daquele e-mail. Fica na memória do
processo: basta para o protótipo, que roda com um processo só; com vários, a contagem iria para o banco ou um cache.
"""

import time
from collections import defaultdict, deque

WINDOW_SECONDS = 15 * 60
MAX_PER_EMAIL = 5
MAX_PER_ADDRESS = 20

_failures: dict[str, deque[float]] = defaultdict(deque)


def _recent(key: str, now: float) -> deque[float]:
    moments = _failures[key]
    while moments and moments[0] <= now - WINDOW_SECONDS:
        moments.popleft()
    return moments


def wait_seconds(email: str, address: str, now: float | None = None) -> int:
    """Quantos segundos faltam para poder tentar de novo; 0 se pode tentar já."""
    now = time.monotonic() if now is None else now
    waits = []
    for key, limit in ((f"email:{email}", MAX_PER_EMAIL), (f"ip:{address}", MAX_PER_ADDRESS)):
        moments = _recent(key, now)
        if len(moments) >= limit:
            waits.append(int(moments[0] + WINDOW_SECONDS - now) + 1)
    return max(waits, default=0)


def failed(email: str, address: str, now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    _failures[f"email:{email}"].append(now)
    _failures[f"ip:{address}"].append(now)


def succeeded(email: str) -> None:
    _failures.pop(f"email:{email}", None)


def reset() -> None:
    """Zera tudo (usado nos testes)."""
    _failures.clear()
