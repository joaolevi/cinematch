"""Pedido em português (RFF25): "algo leve para a Sessão da Tarde" vira os filtros do momento (RFF20).

Sem IA: um dicionário de expressões, cada uma ligada a um clima, uma ocasião, uma duração, um tipo de mídia, um modo
descoberta ou aos serviços da pessoa. Quem recomenda continua sendo o recomendador; o pedido só preenche os filtros.

Regras, para ser fácil de explicar:
- a expressão mais longa vence ("sessão da tarde" antes de "tarde"), e cada trecho do texto conta uma vez só;
- cada filtro aceita um valor: vale o primeiro que aparece no texto, e os outros voltam em `ignored`;
- "sem", "nada de" e "não quero" antes de um clima tiram esse clima do pedido, porque o filtro só escolhe climas.
"""

import re
import unicodedata
from dataclasses import dataclass, field

from .moods import BY_KEY as MOODS, OCCASIONS_BY_KEY

TONIGHT_MINUTES = 150  # o mesmo "Hoje à noite" da tela: cabe numa noite, até 2h30
NEGATIONS = {"sem", "nada", "nao", "nenhum", "nenhuma", "menos"}
BREAKS = {"e", "mas", "ou", "com", "so"}  # "sem terror e divertido": o "sem" não chega ao "divertido"
TYPE_LABELS = {"movie": "Filmes", "series": "Séries", "album": "Música"}
DISCOVERY_LABELS = {"beyond": "Um pouco além", "outside": "Fora da sua bolha"}


@dataclass(frozen=True)
class Wish:
    """O que uma expressão pede. Os campos vazios não mudam nada."""

    mood: str | None = None
    occasion: str | None = None
    max_minutes: int | None = None
    type: str | None = None
    discovery: str | None = None
    only_mine: bool = False
    fields: tuple[str, ...] = field(default=(), compare=False)


def _w(**kw) -> Wish:
    return Wish(**kw, fields=tuple(k for k, v in kw.items() if v))


# Expressão (como se escreve, com acento) -> o que ela pede
PHRASES: dict[str, Wish] = {
    # Expressões brasileiras
    "sessão da tarde": _w(mood="leve", occasion="familia", type="movie"),
    "tela quente": _w(mood="aventureiro", type="movie"),
    "domingo à tarde": _w(mood="relaxante"),
    "hoje à noite": _w(max_minutes=TONIGHT_MINUTES, only_mine=True),
    "hoje de noite": _w(max_minutes=TONIGHT_MINUTES, only_mine=True),
    "desligar o cérebro": _w(mood="leve"),
    "sem pensar muito": _w(mood="leve"),
    "sem pensar": _w(mood="leve"),
    "nada pesado": _w(mood="leve"),
    "nada muito pesado": _w(mood="leve"),
    "dor de cotovelo": _w(mood="melancolico"),
    "na fossa": _w(mood="melancolico"),
    "roer as unhas": _w(mood="tenso"),
    "soco no estômago": _w(mood="intenso"),
    "de arrepiar": _w(mood="assustador"),
    "levantar o astral": _w(mood="energetico"),
    "pra cima": _w(mood="energetico"),
    "para cima": _w(mood="energetico"),
    "filme cabeça": _w(mood="reflexivo", type="movie"),
    "quem matou": _w(mood="misterioso"),
    "da infância": _w(mood="nostalgico"),
    "pra maratonar": _w(type="series"),
    "para maratonar": _w(type="series"),
    # Climas
    "leve": _w(mood="leve"), "levinho": _w(mood="leve"), "tranquilo": _w(mood="leve"),
    "despretensioso": _w(mood="leve"),
    "rir": _w(mood="divertido"), "dar risada": _w(mood="divertido"), "engraçado": _w(mood="divertido"),
    "comédia": _w(mood="divertido"), "divertido": _w(mood="divertido"),
    "romântico": _w(mood="romantico"), "romance": _w(mood="romantico"), "romantiquinho": _w(mood="romantico"),
    "chorar": _w(mood="emocionante"), "emocionante": _w(mood="emocionante"), "de emocionar": _w(mood="emocionante"),
    "triste": _w(mood="melancolico"), "melancólico": _w(mood="melancolico"), "deprê": _w(mood="melancolico"),
    "sombrio": _w(mood="sombrio"),
    "tenso": _w(mood="tenso"), "suspense": _w(mood="tenso"), "tensão": _w(mood="tenso"),
    "medo": _w(mood="assustador"), "terror": _w(mood="assustador"), "susto": _w(mood="assustador"),
    "assustador": _w(mood="assustador"),
    "épico": _w(mood="epico"), "grandioso": _w(mood="epico"),
    "aventura": _w(mood="aventureiro"),
    "reflexão": _w(mood="reflexivo"), "pensar": _w(mood="reflexivo"), "reflexivo": _w(mood="reflexivo"),
    "inspirador": _w(mood="inspirador"), "motivação": _w(mood="inspirador"),
    "nostalgia": _w(mood="nostalgico"), "nostálgico": _w(mood="nostalgico"),
    "mistério": _w(mood="misterioso"), "investigação": _w(mood="misterioso"),
    "surreal": _w(mood="onirico"), "viajante": _w(mood="onirico"), "onírico": _w(mood="onirico"),
    "animado": _w(mood="energetico"), "animar": _w(mood="energetico"),
    "relaxar": _w(mood="relaxante"), "relaxante": _w(mood="relaxante"),
    "dançar": _w(mood="dancante"), "dançante": _w(mood="dancante"),
    "pesado": _w(mood="intenso"), "intenso": _w(mood="intenso"),
    # Ocasiões
    "a dois": _w(occasion="a-dois"), "casal": _w(occasion="a-dois"), "mozão": _w(occasion="a-dois"),
    "namorado": _w(occasion="a-dois"), "namorada": _w(occasion="a-dois"), "date": _w(occasion="a-dois"),
    "com amigos": _w(occasion="amigos"), "com os amigos": _w(occasion="amigos"), "com as amigas": _w(occasion="amigos"),
    "galera": _w(occasion="amigos"), "turma": _w(occasion="amigos"),
    "em família": _w(occasion="familia"), "com a família": _w(occasion="familia"),
    "crianças": _w(occasion="familia"), "criançada": _w(occasion="familia"), "filhos": _w(occasion="familia"),
    "meus pais": _w(occasion="familia"),
    # Duração
    "curto": _w(max_minutes=90), "curtinho": _w(max_minutes=90), "rapidinho": _w(max_minutes=90),
    "curta": _w(max_minutes=90), "curtinha": _w(max_minutes=90), "rapidinha": _w(max_minutes=90),
    "pouco tempo": _w(max_minutes=90), "hora e meia": _w(max_minutes=90),
    "uma hora": _w(max_minutes=60), "duas horas": _w(max_minutes=120), "duas horas e meia": _w(max_minutes=150),
    # Tipo de mídia
    "filme": _w(type="movie"), "filmes": _w(type="movie"),
    "série": _w(type="series"), "séries": _w(type="series"), "seriado": _w(type="series"),
    "maratonar": _w(type="series"),
    "disco": _w(type="album"), "discos": _w(type="album"), "álbum": _w(type="album"), "álbuns": _w(type="album"),
    "música": _w(type="album"), "pra ouvir": _w(type="album"), "para ouvir": _w(type="album"),
    # Sair do óbvio (RFF16)
    "pouco conhecido": _w(discovery="beyond"), "menos famoso": _w(discovery="beyond"), "lado b": _w(discovery="beyond"),
    "pérola": _w(discovery="beyond"), "escondido": _w(discovery="beyond"),
    "diferente": _w(discovery="outside"), "fora da bolha": _w(discovery="outside"),
    "sair da bolha": _w(discovery="outside"), "fora da caixa": _w(discovery="outside"),
    # Serviços (RFF21)
    "nos meus serviços": _w(only_mine=True), "no meu streaming": _w(only_mine=True), "que eu assino": _w(only_mine=True),
}


def _plain_char(char: str) -> str:
    """Um caractere sem acento e em minúscula, ou espaço se não for letra nem número. Mantém o tamanho do texto, para
    o trecho encontrado ser recortado do pedido original."""
    base = unicodedata.normalize("NFD", char.lower())[:1] or " "
    return base if base.isalnum() else " "


def plain(text: str) -> str:
    return "".join(_plain_char(c) for c in text)


def _pattern(phrase: str) -> re.Pattern:
    words = plain(phrase).split()
    return re.compile(r"(?<![a-z0-9])" + r"\s+".join(map(re.escape, words)) + r"(?![a-z0-9])")


_PATTERNS = sorted(((_pattern(p), w, plain(p).split()[0] in NEGATIONS) for p, w in PHRASES.items()),
                   key=lambda pw: -len(pw[0].pattern))
# "até 2h", "até 2 horas", "até 1h30", "até 90 min", "em 40 minutos"
_HOURS = re.compile(
    r"(?<![a-z0-9])(?:ate|em|de)\s+(\d{1,2})\s*h(?:oras?)?(?:\s*e\s*(meia)|\s*e?\s*(\d{1,2})(?:\s*min(?:utos)?)?)?(?![a-z0-9])"
)
_MINUTES = re.compile(r"(?<![a-z0-9])(?:ate|em|de)\s+(\d{2,3})\s*min(?:utos)?(?![a-z0-9])")


def _label(name: str, value) -> str:
    if name == "mood":
        return MOODS[value].label
    if name == "occasion":
        return OCCASIONS_BY_KEY[value].label
    if name == "max_minutes":
        hours, minutes = divmod(value, 60)
        return "Até " + (f"{hours}h{minutes:02d}" if minutes else f"{hours}h") if hours else f"Até {minutes} min"
    if name == "type":
        return TYPE_LABELS[value]
    if name == "discovery":
        return DISCOVERY_LABELS[value]
    return "Só nos meus serviços"


def _negated(text: str, start: int) -> bool:
    """Se uma das três palavras antes do trecho é "sem", "nada", "não"..., sem um "e" ou "mas" no meio."""
    before = text[:start].split()[-3:]
    for i in range(len(before) - 1, -1, -1):
        if before[i] in BREAKS:
            before = before[i + 1:]
            break
    return any(word in NEGATIONS for word in before)


def understand(request: str) -> dict:
    """Os filtros que o pedido escolhe, o que foi entendido (trecho do pedido e o que ele virou) e o que ficou de fora."""
    text = plain(request)
    found: list[tuple[int, int, Wish, bool]] = []  # início, fim, o que pede e se já traz a negação ("nada pesado")
    taken = [False] * len(text)

    def claim(start: int, end: int) -> bool:
        if any(taken[start:end]):
            return False
        taken[start:end] = [True] * (end - start)
        return True

    for match in list(_HOURS.finditer(text)) + list(_MINUTES.finditer(text)):
        if match.re is _HOURS:
            minutes = int(match.group(1)) * 60 + (30 if match.group(2) else int(match.group(3) or 0))
        else:
            minutes = int(match.group(1))
        if 10 <= minutes <= 600 and claim(*match.span()):
            found.append((*match.span(), Wish(max_minutes=minutes, fields=("max_minutes",)), False))
    for pattern, wish, negative in _PATTERNS:
        for match in pattern.finditer(text):
            if claim(*match.span()):
                found.append((*match.span(), wish, negative))

    result: dict = {"type": None, "mood": None, "max_minutes": None, "occasion": None, "discovery": None,
                    "only_mine": False, "understood": [], "ignored": []}
    for start, end, wish, negative in sorted(found, key=lambda f: f[0]):
        piece = request[start:end].strip()
        if wish.fields == ("mood",) and not negative and _negated(text, start):
            result["ignored"].append(f"{piece}: o pedido só escolhe climas, não tira")
            continue
        labels = []
        for name in wish.fields:
            value = getattr(wish, name)
            if result[name] in (None, False):
                result[name] = value
                labels.append(_label(name, value))
            elif result[name] != value:
                result["ignored"].append(f"{piece}: já escolhi {_label(name, result[name])}, e o filtro aceita um só")
        if labels:
            result["understood"].append({"text": piece, "labels": labels})
    return result
