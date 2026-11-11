"""Álbuns como terceira mídia (RFF01), a partir de dados abertos.

- MusicBrainz: o álbum ("release group"), os artistas, os gêneros oficiais, o idioma das letras, a duração e os
  links para ouvir. Dados CC0. Limite de uma requisição por segundo, com User-Agent que identifique a aplicação.
- Cover Art Archive: a capa, por um endereço fixo de cada álbum.
- ListenBrainz: quantas pessoas ouviram, que vira a popularidade de 0 a 100.

As funções de conversão são puras, para testar sem rede. O cliente HTTP fica no fim do arquivo.
"""

import csv
import math
import re
import time
from collections import Counter
from collections.abc import Callable, Iterable
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from ..config import settings
from .catalog import ExternalTitle

MB_URL = "https://musicbrainz.org/ws/2"
CAA_URL = "https://coverartarchive.org"
LB_URL = "https://api.listenbrainz.org/1"

SOUNDTRACK = "Trilha sonora"
MAX_BROAD_GENRES = 2
MAX_FINE_GENRES = 8
ARTIST_GENRE_WEIGHT = 0.5  # o gênero do disco vale mais que o do artista
VARIOUS_ARTISTS = "89ad4ac3-39f7-470e-963a-56509c546377"
BRAZILIAN_GROUPS = {
    "Bossa nova", "MPB", "Samba e choro", "Forró e ritmos do Nordeste", "Sertanejo", "Funk brasileiro", "Axé e brega",
}

# Idioma das letras: o MusicBrainz usa ISO 639-3; o catálogo usa ISO 639-1, como o TMDB
LANGUAGES = {
    "por": "pt", "eng": "en", "spa": "es", "fra": "fr", "ita": "it", "deu": "de", "jpn": "ja", "kor": "ko",
    "zho": "zh", "rus": "ru", "swe": "sv", "isl": "is", "nld": "nl", "yor": "yo", "hin": "hi", "ara": "ar",
}
NO_LYRICS = "zxx"  # "sem conteúdo linguístico": álbum instrumental

# Domínio do link -> serviço. A ordem define a ordem na tela
SERVICES = {
    "open.spotify.com": "spotify", "deezer.com": "deezer", "music.apple.com": "apple_music",
    "itunes.apple.com": "apple_music", "music.youtube.com": "youtube_music", "youtube.com": "youtube",
    "tidal.com": "tidal", "bandcamp.com": "bandcamp", "soundcloud.com": "soundcloud",
}
LISTEN_RELATIONS = {"free streaming", "streaming", "youtube", "bandcamp", "soundcloud"}


class MusicBrainzError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


# ---------------------------------------------------------------- conversão (sem rede)
@lru_cache(maxsize=4)
def load_genre_map(path: Path | None = None) -> dict[str, str]:
    """Gênero oficial do MusicBrainz -> gênero amplo do Tastory (backend/data/generos_musicais.csv)."""
    with open(path or settings.music_genres_path, encoding="utf-8") as f:
        return {r["genero_musicbrainz"]: r["genero_tastory"] for r in csv.DictReader(f)}


def genre_counts(album_genres: Iterable[dict], artist_genres: Iterable[dict]) -> Counter[str]:
    """Votos de cada gênero fino: os do disco valem 1, os do artista valem ARTIST_GENRE_WEIGHT."""
    counts: Counter[str] = Counter()
    for g in album_genres:
        counts[g["name"]] += g.get("count") or 1
    for g in artist_genres:
        counts[g["name"]] += (g.get("count") or 1) * ARTIST_GENRE_WEIGHT
    return counts


def broad_genres(
    counts: Counter[str], genre_map: dict[str, str], soundtrack: bool = False, brazilian: bool = False
) -> list[str]:
    """Os gêneros amplos mais votados. A trilha sonora sempre vem antes.

    Num disco brasileiro, os grupos brasileiros valem em dobro: o disco da Tropicália tem "rock" e "psychedelic rock"
    com um voto cada e "mpb" com um, e deve sair como MPB. No empate, os brasileiros também vêm primeiro.
    """
    broad: Counter[str] = Counter()
    for name, votes in counts.items():
        if name in genre_map:
            group = genre_map[name]
            broad[group] += votes * (2 if brazilian and group in BRAZILIAN_GROUPS else 1)
    if brazilian:
        # Fora do Brasil, a música brasileira é marcada como "latin"; aqui, "Latina" quer dizer música hispânica
        broad.pop("Latina", None)
    ranked = sorted(broad, key=lambda g: (-broad[g], g not in BRAZILIAN_GROUPS, g))
    if soundtrack:
        return [SOUNDTRACK] + ranked[: MAX_BROAD_GENRES - 1]
    return ranked[:MAX_BROAD_GENRES]


def lyrics_language(releases: Iterable[dict]) -> str | None:
    """O idioma do lançamento oficial mais antigo que o informa; sem data, o mais comum. Instrumental vira None.

    O mais antigo vem primeiro porque as reedições estrangeiras podem ser maioria: a trilha de Princesa Mononoke tem
    mais edições em inglês que a japonesa, de 1997.
    """
    def lang(r: dict) -> str | None:
        return (r.get("text-representation") or {}).get("language")

    official = [r for r in releases if r.get("status") in (None, "Official") and lang(r)]
    dated = sorted((r for r in official if r.get("date")), key=lambda r: r["date"])
    if dated:
        code = lang(dated[0])
    elif official:
        code = Counter(lang(r) for r in official).most_common(1)[0][0]
    else:
        return None
    return None if code == NO_LYRICS else LANGUAGES.get(code, code)


def is_instrumental(releases: Iterable[dict]) -> bool:
    langs = {(r.get("text-representation") or {}).get("language") for r in releases} - {None}
    return langs == {NO_LYRICS}


def representative_release(releases: list[dict]) -> str | None:
    """O lançamento oficial mais antigo com data: é dele que saem a duração e os links do disco."""
    official = [r for r in releases if r.get("status") == "Official" and r.get("date")] or [
        r for r in releases if r.get("date")
    ] or releases
    return min(official, key=lambda r: r.get("date") or "9999")["id"] if official else None


def listen_links(relations: Iterable[dict], level: str) -> list[dict]:
    """Links para ouvir, um por serviço, na ordem de SERVICES."""
    found: dict[str, str] = {}
    for rel in relations:
        url = (rel.get("url") or {}).get("resource", "")
        if rel.get("type") not in LISTEN_RELATIONS and "youtube" not in url:
            continue
        host = re.sub(r"^www\.", "", httpx.URL(url).host) if url else ""
        for domain, service in SERVICES.items():
            if host == domain or host.endswith("." + domain):
                found.setdefault(service, url)
                break
    order = list(dict.fromkeys(SERVICES.values()))
    return [{"service": s, "url": found[s], "level": level} for s in order if s in found]


def popularity_from_listeners(users: int | None) -> float:
    """Pessoas que ouviram no ListenBrainz -> 0 a 100, em escala logarítmica (10 mil pessoas ≈ 80)."""
    if not users:
        return 0.0
    return round(min(100.0, 20 * math.log10(1 + users)), 1)


def cover_url(mbid: str, size: int = 500) -> str:
    return f"{CAA_URL}/release-group/{mbid}/front-{size}"


def album_from_musicbrainz(
    rg: dict,
    release: dict | None,
    artists: list[dict],
    listeners: int | None,
    has_cover: bool,
    genre_map: dict[str, str] | None = None,
) -> ExternalTitle:
    """Monta o título do catálogo a partir das respostas do MusicBrainz, do Cover Art Archive e do ListenBrainz."""
    genre_map = load_genre_map() if genre_map is None else genre_map
    soundtrack = "Soundtrack" in (rg.get("secondary-types") or [])
    by_id = {a["id"]: a for a in artists if "id" in a}
    names = [
        readable_name(c["name"], by_id.get(c["artist"]["id"], {}).get("aliases", []), by_id.get(c["artist"]["id"], {}).get("sort-name"))
        for c in rg.get("artist-credit", [])
        if c["artist"]["id"] != VARIOUS_ARTISTS
    ]
    year = int(rg["first-release-date"][:4]) if (rg.get("first-release-date") or "")[:4].isdigit() else None

    releases = rg.get("releases", [])
    countries = list(dict.fromkeys(a["country"] for a in artists if a.get("country")))
    if not countries and release and release.get("country") and not release["country"].startswith("X"):
        countries = [release["country"]]

    counts = genre_counts(rg.get("genres", []), (g for a in artists for g in a.get("genres", [])))
    if not any(name in genre_map for name in counts):
        # Sem gênero oficial no disco nem no artista: as etiquetas livres, filtradas pela mesma tabela
        tag_counts = genre_counts(rg.get("tags", []), (g for a in artists for g in a.get("tags", [])))
        counts += Counter({name: votes for name, votes in tag_counts.items() if name in genre_map})
    tags = [g for g, _ in counts.most_common(MAX_FINE_GENRES)]
    if is_instrumental(releases) and "instrumental" not in tags:
        tags.append("instrumental")

    duration_ms = sum(
        (t.get("length") or 0) for medium in (release or {}).get("media", []) for t in medium.get("tracks", [])
    )
    links = listen_links((release or {}).get("relations", []), "album")
    have = {link["service"] for link in links}
    for a in artists:
        links += [link for link in listen_links(a.get("relations", []), "artist") if link["service"] not in have]
        have |= {link["service"] for link in links}

    kind = "Trilha sonora" if soundtrack else "Álbum"
    by = f" de {', '.join(names)}" if names else ""
    when = f", lançad{'a' if soundtrack else 'o'} em {year}" if year else ""
    return {
        "external_id": f"album-{rg['id']}",
        "type": "album",
        "title": readable_name(rg["title"], rg.get("aliases", [])),
        "year": year,
        "overview": f"{kind}{by}{when}.",
        "poster_url": cover_url(rg["id"]) if has_cover else None,
        "genres": broad_genres(counts, genre_map, soundtrack, brazilian="BR" in countries),
        "tags": tags,
        "creators": names,
        "actors": [],
        "popularity": popularity_from_listeners(listeners),
        "duration_min": round(duration_ms / 60000) if duration_ms else None,
        "countries": countries,
        "language": lyrics_language(releases),
        "links": links,
    }


def _latin(text: str) -> bool:
    from .recommender import has_readable_name  # mesmo critério do feed

    return has_readable_name(text)


def readable_name(name: str, aliases: Iterable[dict], sort_name: str | None = None) -> str:
    """Nome em alfabeto latino, para a tela: o próprio nome, um nome alternativo em português ou inglês, ou o nome de
    ordenação desinvertido ("Hisaishi, Joe" -> "Joe Hisaishi"). Assim "久石譲" aparece como "Joe Hisaishi"."""
    if _latin(name):
        return name
    aliases = list(aliases)
    for locale in ("pt", "en"):
        for primary_first in (True, False):
            for a in aliases:
                if (a.get("locale") or "").startswith(locale) and bool(a.get("primary")) == primary_first and _latin(a["name"]):
                    return a["name"]
    latin = [a["name"] for a in aliases if _latin(a["name"]) and a.get("type") != "Search hint"]
    if latin:
        return latin[0]
    if sort_name and _latin(sort_name):
        return " ".join(reversed([part.strip() for part in sort_name.split(",", 1)]))
    return name


def mbid_from_external_id(external_id: str) -> str:
    return external_id.removeprefix("album-")


# ---------------------------------------------------------------- HTTP
class MusicBrainzClient:
    """Busca e importa álbuns, respeitando o limite de uma requisição por segundo do MusicBrainz."""

    name = "MusicBrainz"

    def __init__(
        self,
        user_agent: str | None = None,
        client: httpx.Client | None = None,
        min_interval: float = 1.1,
        retries: int = 4,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        headers = {"User-Agent": user_agent or settings.musicbrainz_user_agent, "Accept": "application/json"}
        self._client = client or httpx.Client(headers=headers, timeout=20, follow_redirects=False)
        if client is not None:
            self._client.headers.update(headers)
        self.min_interval, self.retries = min_interval, retries
        self._sleep, self._clock = sleep, clock
        self._last = -min_interval
        self._artists: dict[str, dict] = {}

    def _get(self, url: str, **params: Any) -> dict:
        for attempt in range(self.retries + 1):
            wait = self.min_interval - (self._clock() - self._last)
            if wait > 0:
                self._sleep(wait)
            self._last = self._clock()
            try:
                r = self._client.get(url, params={"fmt": "json", **params})
            except httpx.HTTPError as e:
                if attempt == self.retries:
                    raise MusicBrainzError(f"Falha de conexão com o MusicBrainz: {e.__class__.__name__}") from e
                self._sleep(2 * (attempt + 1))
                continue
            if r.status_code in (429, 503):
                if attempt == self.retries:
                    break
                # limite de requisições: espera o que o servidor pedir, ou um pouco mais a cada tentativa
                self._sleep(float(r.headers.get("Retry-After") or 2 * (attempt + 1)))
                continue
            if r.status_code == 404:
                raise MusicBrainzError("Álbum não encontrado no MusicBrainz", status_code=404)
            if r.status_code == 400:
                raise MusicBrainzError("ID do MusicBrainz inválido", status_code=400)
            if r.status_code >= 400:
                raise MusicBrainzError(f"MusicBrainz respondeu com erro {r.status_code}")
            return r.json()
        raise MusicBrainzError("MusicBrainz ocupado; tente de novo em alguns segundos", status_code=503)

    def _artist(self, mbid: str) -> dict:
        if mbid not in self._artists:
            self._artists[mbid] = self._get(f"{MB_URL}/artist/{mbid}", inc="genres+tags+url-rels+aliases")
        return self._artists[mbid]

    def has_cover(self, mbid: str) -> bool:
        try:
            r = self._client.head(cover_url(mbid))
        except httpx.HTTPError:
            return False
        return r.status_code in (200, 301, 302, 307, 308)

    def listeners(self, mbids: list[str]) -> dict[str, int]:
        """Pessoas que ouviram cada álbum no ListenBrainz. Se o serviço falhar, a popularidade fica 0."""
        out: dict[str, int] = {}
        for i in range(0, len(mbids), 50):
            try:
                r = self._client.post(f"{LB_URL}/popularity/release-group", json={"release_group_mbids": mbids[i : i + 50]})
                if r.status_code == 200:
                    out.update({x["release_group_mbid"]: x.get("total_user_count") or 0 for x in r.json()})
            except httpx.HTTPError:
                continue
        return out

    def search(self, query: str, limit: int = 20) -> list[ExternalTitle]:
        """Busca álbuns pelo nome. Traz o básico; os detalhes vêm na importação."""
        data = self._get(f"{MB_URL}/release-group", query=query, limit=limit)
        results: list[ExternalTitle] = []
        for rg in data.get("release-groups", []):
            names = [c["name"] for c in rg.get("artist-credit", []) if c["artist"]["id"] != VARIOUS_ARTISTS]
            date = rg.get("first-release-date") or ""
            soundtrack = "Soundtrack" in (rg.get("secondary-types") or [])
            results.append({
                "external_id": f"album-{rg['id']}",
                "type": "album",
                "title": rg["title"],
                "year": int(date[:4]) if date[:4].isdigit() else None,
                "overview": f"{'Trilha sonora' if soundtrack else rg.get('primary-type') or 'Álbum'}"
                            f"{' de ' + ', '.join(names) if names else ''}.",
                "poster_url": cover_url(rg["id"], 250),
                "genres": [SOUNDTRACK] if soundtrack else [],
                "popularity": 0.0,
                "creators": names,
            })
        return results

    def get_album(self, mbid: str, listeners: int | None = None) -> ExternalTitle:
        rg = self._get(f"{MB_URL}/release-group/{mbid}", inc="genres+tags+artist-credits+releases+aliases")
        release_id = representative_release(rg.get("releases", []))
        release = self._get(f"{MB_URL}/release/{release_id}", inc="recordings+url-rels") if release_id else None
        artists = [
            self._artist(c["artist"]["id"]) for c in rg.get("artist-credit", []) if c["artist"]["id"] != VARIOUS_ARTISTS
        ]
        if listeners is None:
            listeners = self.listeners([mbid]).get(mbid)
        return album_from_musicbrainz(rg, release, artists, listeners, self.has_cover(mbid))

    def close(self) -> None:
        self._client.close()
