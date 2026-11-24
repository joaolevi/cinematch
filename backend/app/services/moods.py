"""Vocabulário de clima comum a filmes, séries e música (RNFF09).

São 20 climas em português. Cada um junta sinais das três mídias: gêneros de filme e série, palavras-chave do TMDB
(em português e em inglês), gêneros musicais e tags do MusicBrainz. Um título ganha um clima quando soma pelo menos
2 pontos: um gênero que define o clima ou uma palavra-chave valem 2, um gênero que só combina vale 1. Cada título fica
com até 3 climas, os de mais pontos. Nada aqui usa IA: são regras que dá para ler e corrigir.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Media
from .catalog import search_text


@dataclass(frozen=True)
class Mood:
    key: str
    label: str
    defining: frozenset[str] = field(default_factory=frozenset)  # gêneros (filme ou música) que definem: 2 pontos
    matching: frozenset[str] = field(default_factory=frozenset)  # gêneros que combinam: 1 ponto
    tags: frozenset[str] = field(default_factory=frozenset)  # palavras-chave e tags, sem acento e em minúsculas: 2
    blocked: frozenset[str] = field(default_factory=frozenset)  # gêneros que impedem o clima (terror não é "leve")


def _m(key: str, label: str, defining=(), matching=(), tags=(), blocked=()) -> Mood:
    plain = frozenset(search_text(t).strip() for t in tags)
    return Mood(key, label, frozenset(defining), frozenset(matching), plain, frozenset(blocked))


DARK = ("Terror", "Crime", "Suspense", "Guerra")


MOODS: tuple[Mood, ...] = (
    _m("leve", "Leve", ["Comédia", "Família", "Bossa nova"], ["Animação", "Romance", "Musical", "Pop", "MPB"],
       ["feel-good", "amizade", "friendship", "sitcom", "bossa nova", "easy listening", "folk pop", "soft rock"], DARK),
    _m("divertido", "Divertido", ["Comédia"], ["Animação", "Aventura", "Axé e brega"],
       ["parody", "satire", "satira", "comedy", "workplace comedy", "adult humor", "amused", "pixar", "dreamworks"],
       ["Terror", "Guerra"]),
    _m("romantico", "Romântico", ["Romance"], ["Soul, R&B e funk", "Bossa nova", "MPB", "Sertanejo"],
       ["love", "amor", "romance", "romantic comedy", "neo soul", "pop soul", "quiet storm", "love song"]),
    _m("emocionante", "Emocionante", [], ["Drama", "Família", "Animação", "Gospel"],
       ["luto", "grief", "perda", "infancia", "childhood", "coming of age", "amadurecimento", "superacao", "singer-songwriter"],
       ["Terror"]),
    _m("melancolico", "Melancólico", [], ["Drama", "Blues", "Bossa nova"],
       ["luto", "grief", "solidao", "loneliness", "isolamento", "memoria", "melancholy", "sadcore", "slowcore",
        "dream pop", "shoegaze", "blues", "trip hop", "downtempo"], ["Terror"]),
    _m("sombrio", "Sombrio", ["Terror"], ["Crime", "Suspense", "Metal"],
       ["distopia", "dystopia", "serial killer", "psicologico", "noir", "neo-noir", "gothic", "goth", "doom metal",
        "dark ambient", "industrial", "black metal", "pos-apocaliptico", "post-apocalyptic"]),
    _m("tenso", "Tenso", ["Suspense"], ["Crime", "Ação", "Mistério", "Guerra"],
       ["reviravolta", "plot twist", "thriller", "survival", "sobrevivencia", "assalto", "heist", "hacker", "spy",
        "secret agent", "fbi", "policia", "police"]),
    _m("assustador", "Assustador", ["Terror"], [],
       ["sobrenatural", "supernatural", "slasher", "folk horror", "criatura", "creature", "stephen king", "vampire",
        "witch", "possessao", "haunted house"]),
    _m("epico", "Épico", ["Guerra", "Faroeste"], ["Aventura", "Fantasia", "Histórico", "Trilha sonora", "Clássica"],
       ["epico", "epic", "tolkien", "dragoes", "dragons", "segunda guerra", "orchestral", "cinematic classical",
        "symphonic", "jornada", "medieval", "post-rock"]),
    _m("aventureiro", "Aventureiro", ["Aventura"], ["Ação", "Fantasia", "Ficção Científica", "Animação"],
       ["jornada", "road movie", "viagem", "espaco", "space", "tesouro", "exploration", "deserto", "studio ghibli"]),
    _m("reflexivo", "Reflexivo", ["Documentário"], ["Drama", "Ficção Científica", "Clássica", "Jazz"],
       ["inteligencia artificial", "artificial intelligence", "filosofia", "philosophy", "memoria", "narrativa nao-linear",
        "existencialismo", "ambient", "modern classical", "contemporary classical", "minimalism", "avant-garde"]),
    _m("inspirador", "Inspirador", [], ["Drama", "Histórico", "Documentário", "Gospel"],
       ["baseado em fatos", "based on true story", "biography", "biografia", "esporte", "sports", "superacao",
        "underdog", "super-heroi", "superhero"], ["Terror", "Crime"]),
    _m("nostalgico", "Nostálgico", [], ["Família", "Animação", "MPB", "Samba e choro"],
       ["anos 80", "1980s", "anos 90", "1990s", "infancia", "childhood", "nostalgia",
        "classic rock", "rock and roll", "jovem guarda", "tropicalia", "doo-wop", "motown"], ["Terror"]),
    _m("misterioso", "Misterioso", ["Mistério"], ["Suspense", "Crime", "Ficção Científica"],
       ["detetive", "detective", "investigacao", "investigation", "conspiracao", "conspiracy", "enigma", "sonhos"]),
    _m("onirico", "Onírico", [], ["Fantasia", "Ficção Científica", "Animação", "Eletrônica"],
       ["sonhos", "dreams", "surreal", "surrealismo", "multiverso", "multiverse", "viagem no tempo", "time travel",
        "contos de fada", "fairy tale", "psychedelic rock", "psychedelic pop", "psychedelic", "dream pop", "ambient",
        "space rock", "art pop"]),
    _m("energetico", "Para cima", ["Ação"], ["Rock", "Eletrônica", "Rap e hip-hop", "Metal", "Aventura"],
       ["artes marciais", "martial arts", "super-heroi", "superhero", "marvel", "dc", "hard rock", "punk",
        "heavy metal", "drum and bass", "electro", "hardcore hip hop", "trap"]),
    _m("relaxante", "Relaxante", ["Bossa nova"], ["Jazz", "Clássica", "Country e folk", "Reggae"],
       ["ambient", "chillout", "downtempo", "lo-fi", "acoustic", "acustico", "smooth jazz", "new age", "cool jazz"]),
    _m("dancante", "Dançante", ["Axé e brega", "Forró e ritmos do Nordeste"], ["Pop", "Eletrônica", "Samba e choro",
       "Latina", "Soul, R&B e funk", "Musical"],
       ["disco", "dance-pop", "dance", "house", "funk", "samba", "reggaeton", "salsa", "synth-pop", "baile"]),
    _m("familia", "Para ver em família", ["Família", "Animação"], ["Aventura", "Comédia", "Fantasia"],
       ["pixar", "disney", "dreamworks", "studio ghibli", "contos de fada", "fairy tale"], DARK),
    _m("intenso", "Intenso", [], ["Drama", "Guerra", "Crime", "Metal", "Rap e hip-hop"],
       ["vinganca", "revenge", "anti-heroi", "anti-hero", "drogas", "drugs", "violencia", "violence", "mafia",
        "segunda guerra", "politica", "hardcore", "thrash metal", "conscious hip hop"]),
)

BY_KEY = {m.key: m for m in MOODS}
MAX_MOODS = 3
MIN_POINTS = 2


def moods_for(media: Media) -> list[str]:
    """Os climas do título, do mais forte para o mais fraco, com até 3."""
    genres = set(media.genres or [])
    tags = {search_text(t).strip() for t in media.tags or []}
    scored: list[tuple[int, int, str]] = []
    for order, mood in enumerate(MOODS):
        points = 2 * len(genres & mood.defining) + len(genres & mood.matching) + 2 * len(tags & mood.tags)
        if points >= MIN_POINTS and not genres & mood.blocked:
            scored.append((-points, order, mood.key))
    return [key for _, _, key in sorted(scored)[:MAX_MOODS]]


def fill_moods(db: Session, only_missing: bool = True) -> int:
    """Calcula os climas do catálogo. Sem `only_missing`, refaz todos (por exemplo, depois de mudar as regras)."""
    changed = 0
    for media in db.scalars(select(Media)):
        if only_missing and media.moods:
            continue
        moods = moods_for(media)
        if moods != (media.moods or []):
            media.moods = moods
            changed += 1
    db.commit()
    return changed
