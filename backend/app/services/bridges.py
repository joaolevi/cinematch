"""Pontes entre mídias (RFF26) e álbuns no feed (RFF27, RFF02).

As sugestões de filmes e séries continuam com o recomendador de `recommender.py`, sem mudança. A música entra por
cima, ligada ao que a pessoa curtiu por pontes:

- Fortes, guardadas na tabela `media_bridges` por `build_bridges`, a partir da lista curada de álbuns
  (`data/albuns_demo.csv`): trilha sonora, compositor e mesma pessoa. E, pela lista `data/cinebiografias.csv`, a
  cinebiografia e o documentário sobre quem fez o disco ("Elis" e "Elis & Tom"). Uma sozinha basta.
- Fracas, calculadas na hora: gênero (pela tabela `data/generos_correspondencia.csv`), década, país e idioma. Só valem
  juntas, pelo menos duas, como manda a regra de corte do ARQUITETURA.md.

O grafo de conteúdo (RNFF12) fica para depois da entrega: trocar o motor em um dia arriscaria quebrar o que funciona.
"""

import csv
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import DATA_DIR
from ..models import Media, MediaBridge, User, UserInterest, UserPreference
from .catalog import search_text
from .recommender import DISCOVERY, Recommendation, decade_label, excluded_ids, recommend, user_signals

ALBUM_LIST_PATH = DATA_DIR / "albuns_demo.csv"
BIOPIC_LIST_PATH = DATA_DIR / "cinebiografias.csv"
BIOPIC_SOURCE = "cinebio"  # pontes que vêm da lista de cinebiografias e documentários
GENRE_PAIRS_PATH = DATA_DIR / "generos_correspondencia.csv"
LIST_SOURCE = "lista"  # pontes que vêm da lista curada de álbuns

STRONG = {"soundtrack": 1.0, "biopic": 1.0, "documentary": 0.95, "composer": 0.9, "same_person": 0.9}
WEAK = {"genre": 0.3, "decade": 0.2, "country": 0.2, "language": 0.2}
LANGUAGE_PHRASE = {"pt": "em português", "es": "em espanhol", "fr": "em francês", "it": "em italiano", "de": "em alemão",
                   "ja": "em japonês", "ko": "em coreano"}  # o inglês fica de fora: é comum demais para ligar dois títulos
COMMON_COUNTRIES = {"US", "GB"}  # pelo mesmo motivo, ser dos Estados Unidos ou do Reino Unido não liga dois títulos
SAME_ARTIST = 0.8
PREF_ARTIST = 0.7  # artista escolhido no onboarding
PREF_GENRE = 0.25  # gênero musical escolhido no onboarding
MAX_PER_ARTIST = 2  # no começo da lista, no máximo 2 discos do mesmo artista...
MAX_PER_REASON = 2  # ...e 2 com o mesmo motivo; os outros vão para o fim
MIN_WEAK_SIGNALS = 2
ALBUM_POPULARITY_BONUS = 0.05  # desempate entre álbuns com a mesma ponte
ALBUM_EVERY = 4  # no feed misto, um álbum a cada 4 lugares
FIRST_ALBUM_SLOT = 2  # o primeiro álbum aparece no 3º lugar
VIDEO_TYPES = ("movie", "series")


@dataclass
class Link:
    """Uma ligação entre dois títulos, com o peso e as palavras que viram motivo."""

    kind: str  # soundtrack | biopic | documentary | composer | same_person | weak | artist
    weight: float
    label: str = ""  # pessoa da ponte forte ou os sinais da ponte fraca


# ---------------------------------------------------------------- dados curados
@lru_cache(maxsize=2)
def genre_pairs(path: Path = GENRE_PAIRS_PATH) -> dict[str, set[str]]:
    """Gênero de filme ou série -> gêneros musicais que combinam."""
    pairs: dict[str, set[str]] = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pairs.setdefault(row["genero_filme"], set()).add(row["genero_musica"])
    return pairs


def _phrase(genre: str) -> str:
    """Gênero em minúsculas para o meio da frase, sem estragar siglas como MPB e R&B."""
    return " ".join(w if (w.isupper() and len(w) > 1) or "&" in w else w.lower() for w in genre.split())


def _target_title(reason: str) -> tuple[str, str]:
    """Da coluna `motivo` da lista curada: o tipo da ponte e o título do filme ou série.

    "trilha: Interestelar" -> ("trilha", "Interestelar");
    "trilha: Bacurau usa "Réquiem para Matraga"" -> ("trilha", "Bacurau");
    "mesma pessoa: Seu Jorge, de Cidade de Deus" -> ("mesma pessoa", "Cidade de Deus");
    "compositor: Django Livre usa Morricone" -> ("compositor", "Django Livre").
    """
    kind, _, rest = reason.partition(":")
    rest = rest.strip()
    if kind.strip() == "mesma pessoa" and ", de " in rest:
        rest = rest.split(", de ", 1)[1]
    return kind.strip(), rest.split(" usa ", 1)[0].strip()


def find_title(videos: list[Media], title: str) -> Media | None:
    """O filme ou a série do catálogo com esse título; se não houver igual, o único que começa com ele."""
    wanted = search_text(title)
    exact = [m for m in videos if search_text(m.title) == wanted]
    if exact:
        return max(exact, key=lambda m: m.popularity)
    def starts(text: str) -> bool:  # "Ex Machina" acha "Ex Machina: Instinto Artificial", mas não "Ex Machinarium"
        return text.startswith(wanted) and len(text) > len(wanted) and not text[len(wanted)].isalnum()

    prefix = [m for m in videos if starts(search_text(m.title))]
    return prefix[0] if len(prefix) == 1 else None


# ---------------------------------------------------------------- pontes fortes
def build_bridges(db: Session, list_path: Path = ALBUM_LIST_PATH) -> dict:
    """Recalcula as pontes fortes a partir da lista curada. Pode rodar de novo: apaga e refaz as da lista."""
    albums = {m.external_id: m for m in db.scalars(select(Media).where(Media.type == "album"))}
    videos = list(db.scalars(select(Media).where(Media.type.in_(VIDEO_TYPES))))
    if not albums or not list_path.exists():
        return {"bridges": 0, "unmatched": []}
    with open(list_path, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r.get("mbid", "").strip()]

    links: dict[tuple[int, int], tuple[str, str]] = {}  # (vídeo, álbum) -> (tipo, pessoa)
    unmatched: list[str] = []

    def add(video: Media, album: Media, kind: str, person: str = "") -> None:
        key = (video.id, album.id)
        if key not in links or STRONG[kind] > STRONG[links[key][0]]:
            links[key] = (kind, person)

    soundtracks: list[tuple[Media, Media]] = []
    for row in rows:
        album = albums.get(f"album-{row['mbid'].strip()}")
        kind, title = _target_title(row.get("motivo", ""))
        if album is None or kind not in ("trilha", "mesma pessoa", "compositor"):
            continue
        video = find_title(videos, title)
        if video is None:
            unmatched.append(title)
            continue
        person = (album.creators or [""])[0]
        if kind == "trilha":
            add(video, album, "soundtrack")
            soundtracks.append((video, album))
        else:
            add(video, album, "same_person" if kind == "mesma pessoa" else "composer", person)

    # Compositor: os outros álbuns de quem fez a trilha de um filme ("Hans Zimmer" liga Interestelar e Duna)
    for video, soundtrack in soundtracks:
        composers = set(soundtrack.creators or [])
        for album in albums.values():
            shared = composers & set(album.creators or [])
            if album.id != soundtrack.id and shared:
                add(video, album, "composer", sorted(shared)[0])

    db.execute(delete(MediaBridge).where(MediaBridge.source == LIST_SOURCE))
    for (video_id, album_id), (kind, person) in links.items():
        for a, b in ((video_id, album_id), (album_id, video_id)):
            db.add(MediaBridge(media_id=a, other_id=b, kind=kind, label=person, weight=STRONG[kind], source=LIST_SOURCE))
    db.commit()
    return {"bridges": len(links), "unmatched": sorted(set(unmatched)), "biopics": build_biopic_bridges(db)}


def biopic_rows(path: Path = BIOPIC_LIST_PATH) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if r.get("filme", "").strip() and r.get("mbid", "").strip()]


def build_biopic_bridges(db: Session, path: Path = BIOPIC_LIST_PATH) -> dict:
    """Recalcula as pontes de cinebiografia e documentário (RFF26) a partir da lista curada, ligando pelo ID do TMDB e
    do MusicBrainz. Os pares que ainda não estão no catálogo ficam em `missing`; `make cinebiografias` os traz. Pode
    rodar de novo: apaga e refaz as da lista. Roda também ao subir a API."""
    rows = biopic_rows(path)
    wanted = {r["filme"].strip() for r in rows} | {f"album-{r['mbid'].strip()}" for r in rows}
    found = {m.external_id: m for m in db.scalars(select(Media).where(Media.external_id.in_(wanted)))}
    db.execute(delete(MediaBridge).where(MediaBridge.source == BIOPIC_SOURCE))
    db.flush()
    made, missing = set(), []
    for r in rows:
        film, album = found.get(r["filme"].strip()), found.get(f"album-{r['mbid'].strip()}")
        if film is None or album is None:
            missing.append(f"{r['titulo_filme']} e {r['titulo_album']}")
            continue
        kind = "documentary" if r["tipo"].strip() == "documentario" else "biopic"
        if (film.id, album.id) in made:
            continue
        made.add((film.id, album.id))
        for a, b in ((film.id, album.id), (album.id, film.id)):
            db.add(MediaBridge(media_id=a, other_id=b, kind=kind, label=r["pessoa"].strip(), weight=STRONG[kind],
                               source=BIOPIC_SOURCE))
    db.commit()
    return {"bridges": len(made), "missing": missing}


def strong_links(db: Session, media_ids: Iterable[int]) -> dict[tuple[int, int], Link]:
    ids = list(media_ids)
    if not ids:
        return {}
    rows = db.scalars(select(MediaBridge).where(MediaBridge.media_id.in_(ids)))
    return {(b.media_id, b.other_id): Link(b.kind, b.weight, b.label) for b in rows}


# ---------------------------------------------------------------- pontes fracas
def weak_link(a: Media, b: Media) -> Link | None:
    """Gênero, década e país entre um filme ou série e um álbum. Só vale com pelo menos dois sinais juntos."""
    video, album = (a, b) if b.type == "album" else (b, a)
    signals: list[tuple[str, str]] = []
    pairs = genre_pairs()
    match = next(((vg, mg) for vg in video.genres or [] for mg in album.genres or [] if mg in pairs.get(vg, ())), None)
    if match:
        signals.append(("genre", f"{_phrase(match[0])} pede {_phrase(match[1])}"))
    if video.year and album.year and video.year // 10 == album.year // 10:
        signals.append(("decade", decade_label(video.year // 10 * 10)))
    shared = (set(video.countries or []) & set(album.countries or [])) - COMMON_COUNTRIES
    if shared:
        signals.append(("country", "feito no Brasil" if "BR" in shared else "do mesmo país"))
    if video.language and video.language == album.language and video.language in LANGUAGE_PHRASE:
        # Feito no Brasil já diz que é em português: o idioma só soma quando o país não disse
        if not (video.language == "pt" and "BR" in shared):
            signals.append(("language", LANGUAGE_PHRASE[video.language]))
    if len(signals) < MIN_WEAK_SIGNALS:
        return None
    return Link("weak", sum(WEAK[k] for k, _ in signals), ", ".join(text for _, text in signals))


def album_link(a: Media, b: Media) -> Link | None:
    """Entre dois álbuns: o mesmo artista, ou gênero e década juntos."""
    shared = set(a.creators or []) & set(b.creators or [])
    if shared:
        return Link("artist", SAME_ARTIST, sorted(shared)[0])
    signals = []
    genre = next((g for g in a.genres or [] if g in (b.genres or [])), None)
    if genre:
        signals.append(_phrase(genre))
    if a.year and b.year and a.year // 10 == b.year // 10:
        signals.append(decade_label(a.year // 10 * 10))
    if len(signals) < MIN_WEAK_SIGNALS:
        return None
    return Link("weak", WEAK["genre"] + WEAK["decade"], ", ".join(signals))


def link_between(a: Media, b: Media, strong: dict[tuple[int, int], Link]) -> Link | None:
    if (a.id, b.id) in strong:
        return strong[(a.id, b.id)]
    if a.type == "album" and b.type == "album":
        return album_link(a, b)
    if (a.type == "album") != (b.type == "album"):
        return weak_link(a, b)
    return None


# ---------------------------------------------------------------- motivos
def feed_reason(liked: Media, link: Link) -> str:
    """O motivo de um álbum no feed, a partir do que a pessoa curtiu."""
    if link.kind == "soundtrack":
        return f"Trilha de {liked.title}, que você curtiu"
    if link.kind == "composer":
        return f"Do compositor de {liked.title}: {link.label}"
    if link.kind == "same_person":
        return f"{link.label}, de {liked.title}, também canta"
    if link.kind == "artist":
        return f"Mais de {link.label}, que você curtiu"
    if link.kind == "biopic":
        return f"{liked.title}, que você curtiu, conta a história de {link.label}"
    if link.kind == "documentary":
        return f"Do documentário {liked.title}, sobre {link.label}"
    return f"Combina com {liked.title}: {link.label}"


def detail_reason(media: Media, other: Media, link: Link) -> str:
    """O motivo no detalhe de `media`, explicando por que `other` aparece em "Para ouvir/ver depois"."""
    if link.kind == "soundtrack":
        if media.type == "album":
            return "O filme desta trilha" if other.type == "movie" else "A série desta trilha"
        return "Trilha sonora deste filme" if media.type == "movie" else "Trilha sonora desta série"
    if link.kind == "composer":
        return f"{link.label} compôs a trilha" if media.type == "album" else f"Outro álbum de {link.label}, que compôs a trilha"
    if link.kind == "same_person":
        return f"{link.label} está no elenco" if media.type == "album" else f"{link.label}, do elenco, também canta"
    if link.kind == "artist":
        return f"Também de {link.label}"
    if link.kind in ("biopic", "documentary"):
        if media.type == "album":
            return f"{'Filme' if link.kind == 'biopic' else 'Documentário'} sobre {link.label}"
        return f"A música de {link.label}" if link.kind == "biopic" else "A música que o documentário conta"
    return link.label[:1].upper() + link.label[1:]


# ---------------------------------------------------------------- detalhe
def connections(db: Session, media: Media, limit: int = 12) -> list[tuple[Media, Link, str]]:
    """Os títulos da outra mídia ligados a este: primeiro as pontes fortes, depois as fracas, mais populares antes."""
    want_album = media.type != "album"
    others = list(db.scalars(select(Media).where(Media.type == "album" if want_album else Media.type.in_(VIDEO_TYPES))))
    strong = strong_links(db, [media.id])
    found = []
    for other in others:
        link = link_between(media, other, strong)
        if link:
            found.append((other, link))
    found.sort(key=lambda x: (-x[1].weight, -x[0].popularity))
    return [(other, link, detail_reason(media, other, link)) for other, link in found[:limit]]


# ---------------------------------------------------------------- feed
def diversify(recs: list[Recommendation]) -> list[Recommendation]:
    """Evita que um artista ou um motivo tome a lista: passado o limite, o disco vai para o fim da fila."""
    artists: Counter[str] = Counter()
    reasons: Counter[str] = Counter()
    first, later = [], []
    for r in recs:
        artist = (r.media.creators or [""])[0]
        repeated = r.strategy != "trending" and reasons[r.reason] >= MAX_PER_REASON  # "Em alta" não conta
        if artists[artist] < MAX_PER_ARTIST and not repeated:
            artists[artist] += 1
            reasons[r.reason] += 1
            first.append(r)
        else:
            later.append(r)
    return first + later


def familiar_music_genres(db: Session, user_id: int, liked: Iterable[Media]) -> set[str]:
    """Os gêneros musicais que a pessoa já ouve: os dos discos que curtiu e os que escolheu no onboarding."""
    music = {g for album in liked if album.type == "album" for g in album.genres or []}
    chosen = set(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user_id)))
    return music | chosen


def outside_the_bubble(albums: list[Media], familiar: set[str], have: set[int], prefix: str, count: int) -> list[Recommendation]:
    """Discos de gêneros que a pessoa ainda não ouve, um gênero de cada vez, do mais ouvido de cada gênero."""
    by_genre: dict[str, list[Media]] = {}
    for album in sorted(albums, key=lambda a: -a.popularity):
        genre = (album.genres or [""])[0]
        if album.id not in have and genre and not familiar & set(album.genres or []):
            by_genre.setdefault(genre, []).append(album)
    picked: list[Recommendation] = []
    while len(picked) < count and any(by_genre.values()):
        for genre, items in by_genre.items():
            if items and len(picked) < count:
                album = items.pop(0)
                reason = f"{prefix}{genre}, um gênero que você ainda não ouve"
                picked.append(Recommendation(album, album.popularity / 100, reason, "discovery", ("genre", genre)))
    return picked


def album_suggestions(
    db: Session,
    user_id: int,
    skip: Iterable[int] = (),
    limit: int = 20,
    discovery: str = "taste",
    allow: set[int] | None = None,
) -> list[Recommendation]:
    """Álbuns para a pessoa: pelas pontes com o que ela curtiu, depois pelos artistas e gêneros musicais que ela disse
    curtir no onboarding e, por fim, os álbuns em alta. No modo descoberta, parte dos lugares vai para discos de gêneros
    que ela ainda não ouve: 3 de cada 10 em "Um pouco além" e 7 de cada 10 em "Fora da sua bolha". Com `allow`, só
    esses discos (os filtros do momento, RFF20); os ajustes de gosto (RFF07, RFF08) multiplicam as notas."""
    from . import adjustments as adj

    exclude = excluded_ids(db, user_id) | set(skip)
    adjust = adj.load(db, user_id)
    signals = user_signals(db, user_id)
    liked_ids = [mid for mid, w in signals.items() if w > 0]
    by_id = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_(liked_ids)))} if liked_ids else {}
    albums = [
        m
        for m in db.scalars(select(Media).where(Media.type == "album"))
        if m.id not in exclude and (allow is None or m.id in allow) and adj.factor(m, adjust) > 0
    ]
    strong = strong_links(db, by_id)

    scored: list[tuple[float, Media, str, tuple[str, str]]] = []
    for album in albums:
        best, reason, because = 0.0, "", None
        for mid, liked in by_id.items():
            link = link_between(liked, album, strong)
            if link and link.weight * signals[mid] > best:
                best, reason, because = link.weight * signals[mid], feed_reason(liked, link), ("title", str(mid))
        if best > 0:
            score = (best + ALBUM_POPULARITY_BONUS * album.popularity / 100) * adj.factor(album, adjust)
            scored.append((score, album, reason, because))
    # O que a pessoa disse que curte no onboarding: artistas e gêneros musicais
    bridged = {album.id for _, album, _, _ in scored}
    artists = set(db.scalars(select(UserInterest.value).where(UserInterest.user_id == user_id, UserInterest.kind == "artist")))
    genres = set(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user_id)))
    preferred: list[tuple[float, Media, str, tuple[str, str]]] = []
    for album in albums:
        if album.id in bridged:
            continue
        artist = next((a for a in album.creators or [] if a in artists), None)
        genre = next((g for g in album.genres or [] if g in genres), None)
        if artist:
            score = PREF_ARTIST * adj.factor(album, adjust)
            preferred.append((score, album, f"Porque você curte {artist}", ("person", artist)))
        elif genre:
            score = PREF_GENRE * adj.factor(album, adjust)
            preferred.append((score, album, f"Porque você curte {genre}", ("genre", genre)))
    scored.sort(key=lambda x: -x[0])
    preferred.sort(key=lambda x: (-x[0], -x[1].popularity))
    recs = [Recommendation(album, score, reason, "bridge", because) for score, album, reason, because in scored]
    recs += [Recommendation(album, score, reason, "content", because) for score, album, reason, because in preferred]
    recs = sorted(recs, key=lambda r: -r.score)
    # Completa com os álbuns mais ouvidos; o limite por artista e por motivo vale para a lista toda
    have = {r.media.id for r in recs}
    popular = sorted((a for a in albums if a.id not in have), key=lambda a: -a.popularity)
    recs += [Recommendation(a, a.popularity / 100, "Em alta na música", "trending") for a in popular]
    recs = diversify(recs)[:limit]

    _, share, prefix = DISCOVERY.get(discovery, DISCOVERY["taste"])
    if share:
        familiar = familiar_music_genres(db, user_id, by_id.values())
        new = outside_the_bubble(albums, familiar, set(), prefix, round(limit * share))
        new_ids = {r.media.id for r in new}
        kept = [r for r in recs if r.media.id not in new_ids][: limit - len(new)]
        # Intercala na proporção do modo: em cada trecho da lista, a mesma parte de discos novos
        recs, placed = [], 0
        while kept or new:
            if new and (placed < round((len(recs) + 1) * share) or not kept):
                recs.append(new.pop(0))
                placed += 1
            else:
                recs.append(kept.pop(0))
    return recs


def mix_albums(feed: list[Recommendation], albums: list[Recommendation], limit: int) -> list[Recommendation]:
    """Põe os álbuns com motivo (ponte, gosto declarado ou descoberta) em lugares fixos do feed: o 3º, o 7º, o 11º... Os álbuns só
    "em alta" ficam de fora do feed misto, para o lugar de um filme não ir para um álbum sem motivo."""
    bridged = [a for a in albums if a.strategy in ("bridge", "content", "discovery")]
    out = list(feed)
    for n, album in enumerate(bridged):
        slot = FIRST_ALBUM_SLOT + n * ALBUM_EVERY
        if slot >= limit:
            break
        out.insert(min(slot, len(out)), album)
    return out[:limit]


# ---------------------------------------------------------------- sessão dupla (RFF27)
PAIR_KINDS = ("soundtrack", "biopic", "documentary", "same_person", "composer")  # só pontes fortes formam par
PAIR_POOL = 40  # quantas sugestões de filmes e séries entram na busca por pares


@dataclass
class Pair:
    """Um filme ou série sugerido e um disco para ouvir depois, ligados por uma ponte forte."""

    video: Recommendation
    album: Media
    kind: str
    reason: str


def pair_reason(video: Media, link: Link) -> str:
    """Por que o disco acompanha o filme, do jeito que aparece no card da sessão dupla."""
    if link.kind == "soundtrack":
        return f"A trilha sonora de {video.title}"
    if link.kind == "composer":
        return f"{link.label} compôs a trilha de {video.title}"
    if link.kind == "same_person":
        return f"{link.label}, do elenco de {video.title}, também canta"
    if link.kind == "biopic":
        return f"{video.title} conta a história de {link.label}"
    return f"{video.title} é um documentário sobre {link.label}"


def double_features(
    db: Session,
    user: User,
    limit: int = 3,
    skip: Iterable[int] = (),
    video_allow: set[int] | None = None,
    album_allow: set[int] | None = None,
) -> list[Pair]:
    """Sessão dupla (RFF27): pares de um filme ou série que o recomendador sugere e um disco ligado a ele por uma ponte
    forte, para ver e depois ouvir. Nada que a pessoa já viu, guardou ou descartou entra, de nenhum dos dois lados, e
    cada disco aparece uma vez. `skip` tira filmes que já estão na tela; os `allow` são os filtros do momento (RFF20)."""
    _, videos = recommend(db, user, None, PAIR_POOL, skip=skip, allow=video_allow)
    seen = excluded_ids(db, user.id)
    strong = strong_links(db, [r.media.id for r in videos])
    by_video: dict[int, list[tuple[int, Link]]] = {}
    for (video_id, other_id), link in strong.items():
        if link.kind in PAIR_KINDS and other_id not in seen and (album_allow is None or other_id in album_allow):
            by_video.setdefault(video_id, []).append((other_id, link))
    albums = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_({o for v in by_video.values() for o, _ in v})))}
    pairs: list[Pair] = []
    used: set[int] = set()
    for rec in videos:
        options = [(albums[o], link) for o, link in by_video.get(rec.media.id, []) if o in albums and o not in used]
        if not options:
            continue
        album, link = max(options, key=lambda x: (x[1].weight, x[0].popularity))
        used.add(album.id)
        pairs.append(Pair(rec, album, link.kind, pair_reason(rec.media, link)))
        if len(pairs) == limit:
            break
    return pairs
