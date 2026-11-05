"""Integração real com o TMDB (The Movie Database) — ator "API de Catálogo Externo" do DCU.

Implementa a mesma interface do `MockCatalogProvider` (`fetch_titles()`), então o resto do sistema
não sabe de onde os títulos vêm. Requer uma chave gratuita de themoviedb.org em
`CINEMATCH_TMDB_API_KEY` (no `.env`, que NÃO vai para o git).

Os gêneros do TMDB são convertidos para o vocabulário do CineMatch (o mesmo do catálogo mockado),
para que preferências do onboarding e o recomendador funcionem com títulos das duas origens.
"""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from .catalog import ExternalTitle

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_URL = "https://image.tmdb.org/t/p/w342"

# IDs de gênero do TMDB -> gêneros do CineMatch (IDs são estáveis e independem do idioma)
MOVIE_GENRES: dict[int, list[str]] = {
    28: ["Ação"], 12: ["Aventura"], 16: ["Animação"], 35: ["Comédia"], 80: ["Crime"],
    99: ["Documentário"], 18: ["Drama"], 10751: ["Família"], 14: ["Fantasia"], 36: ["Histórico"],
    27: ["Terror"], 10402: ["Musical"], 9648: ["Mistério"], 10749: ["Romance"],
    878: ["Ficção Científica"], 53: ["Suspense"], 10752: ["Guerra"], 37: ["Faroeste"],
    10770: [],  # "Cinema TV" não é um gênero de conteúdo
}
TV_GENRES: dict[int, list[str]] = {
    10759: ["Ação", "Aventura"], 16: ["Animação"], 35: ["Comédia"], 80: ["Crime"],
    99: ["Documentário"], 18: ["Drama"], 10751: ["Família"], 10762: ["Família"], 9648: ["Mistério"],
    10765: ["Ficção Científica", "Fantasia"], 10766: ["Romance"], 10768: ["Guerra"], 37: ["Faroeste"],
    10763: [], 10764: [], 10767: [],  # News, Reality, Talk
}

TYPE_TO_TMDB = {"movie": "movie", "series": "tv"}
TMDB_TO_TYPE = {"movie": "movie", "tv": "series"}


class TmdbError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def map_genres(media_type: str, genre_ids: list[int]) -> list[str]:
    table = MOVIE_GENRES if media_type == "movie" else TV_GENRES
    out: list[str] = []
    for gid in genre_ids:
        for g in table.get(gid, []):
            if g not in out:
                out.append(g)
    return out


def normalize_popularity(tmdb_popularity: float | None, vote_average: float | None) -> float:
    """Converte a popularidade do TMDB (sem teto) + nota média em uma escala 0–100."""
    pop = min(100.0, 25 * math.log10(1 + max(0.0, tmdb_popularity or 0.0)))
    return round(0.6 * pop + 0.4 * (vote_average or 0.0) * 10, 1)


def _year(date: str | None) -> int | None:
    try:
        return int(date[:4]) if date else None
    except ValueError:
        return None


class TmdbCatalogProvider:
    """Busca filmes e séries populares (e detalhes: diretor/criadores e palavras-chave) no TMDB."""

    name = "TMDB"

    def __init__(
        self,
        api_key: str,
        language: str = "pt-BR",
        region: str = "BR",
        pages: int = 2,
        with_details: bool = True,
        client: httpx.Client | None = None,
        base_url: str = BASE_URL,
        max_workers: int = 8,
    ):
        if not api_key:
            raise TmdbError("CINEMATCH_TMDB_API_KEY não configurada", status_code=400)
        self.language = language
        self.region = region
        self.pages = max(1, pages)
        self.with_details = with_details
        self.max_workers = max_workers
        self._params: dict[str, str] = {"language": language}
        headers = {"Accept": "application/json"}
        if api_key.startswith("eyJ"):  # token de leitura (v4)
            headers["Authorization"] = f"Bearer {api_key}"
        else:  # chave da API v3
            self._params["api_key"] = api_key
        self._client = client or httpx.Client(base_url=base_url, headers=headers, timeout=15)
        if client is not None:
            self._client.headers.update(headers)

    # ------------------------------------------------------------------ HTTP
    def _get(self, path: str, **params: Any) -> dict:
        try:
            r = self._client.get(path, params={**self._params, **params})
        except httpx.HTTPError as e:
            raise TmdbError(f"Falha de conexão com o TMDB: {e.__class__.__name__}") from e
        if r.status_code == 401:
            raise TmdbError("Chave do TMDB inválida ou sem permissão", status_code=502)
        if r.status_code == 404:
            raise TmdbError("Título não encontrado no TMDB", status_code=404)
        if r.status_code >= 400:
            raise TmdbError(f"TMDB respondeu com erro {r.status_code}")
        return r.json()

    # ------------------------------------------------------------- conversão
    def _from_item(self, item: dict, tmdb_type: str) -> ExternalTitle | None:
        title = item.get("title") or item.get("name")
        if not title or item.get("adult"):
            return None
        media_type = TMDB_TO_TYPE[tmdb_type]
        genre_ids = item.get("genre_ids") or [g["id"] for g in item.get("genres", [])]
        poster = item.get("poster_path")
        return {
            "external_id": f"{tmdb_type}-{item['id']}",
            "type": media_type,
            "title": title,
            "year": _year(item.get("release_date") or item.get("first_air_date")),
            "overview": (item.get("overview") or "").strip(),
            "poster_url": f"{IMAGE_URL}{poster}" if poster else None,
            "genres": map_genres(media_type, genre_ids),
            "tags": [],
            "creators": [],
            "popularity": normalize_popularity(item.get("popularity"), item.get("vote_average")),
        }

    def _enrich(self, t: ExternalTitle) -> ExternalTitle:
        """Completa diretor/criadores e palavras-chave com a rota de detalhes."""
        tmdb_type, tmdb_id = t["external_id"].split("-", 1)
        if tmdb_type == "movie":
            d = self._get(f"/movie/{tmdb_id}", append_to_response="credits,keywords")
            creators = [c["name"] for c in d.get("credits", {}).get("crew", []) if c.get("job") == "Director"]
            keywords = d.get("keywords", {}).get("keywords", [])
        else:
            d = self._get(f"/tv/{tmdb_id}", append_to_response="keywords")
            creators = [c["name"] for c in d.get("created_by", [])]
            keywords = d.get("keywords", {}).get("results", [])
        full = self._from_item(d, tmdb_type) or t
        full["creators"] = list(dict.fromkeys(creators))[:3]
        full["tags"] = [k["name"].lower() for k in keywords][:8]
        return full

    def _enrich_all(self, titles: list[ExternalTitle]) -> list[ExternalTitle]:
        if not self.with_details or not titles:
            return titles
        with ThreadPoolExecutor(max_workers=self.max_workers) as pool:
            return list(pool.map(self._enrich, titles))

    # ------------------------------------------------------------ interface
    def popular(self, media_type: str) -> list[ExternalTitle]:
        tmdb_type = TYPE_TO_TMDB[media_type]
        found: dict[str, ExternalTitle] = {}
        for page in range(1, self.pages + 1):
            data = self._get(f"/{tmdb_type}/popular", page=page, region=self.region)
            for item in data.get("results", []):
                t = self._from_item(item, tmdb_type)
                if t:
                    found.setdefault(t["external_id"], t)
        return list(found.values())

    def fetch_titles(self) -> list[ExternalTitle]:
        """Filmes e séries populares no Brasil (usado por `sync_catalog`)."""
        return self._enrich_all(self.popular("movie") + self.popular("series"))

    def search(self, query: str, media_type: str | None = None, limit: int = 20) -> list[ExternalTitle]:
        """Busca rápida (sem detalhes) para o admin escolher o que importar."""
        if media_type:
            tmdb_type = TYPE_TO_TMDB[media_type]
            results = [(r, tmdb_type) for r in self._get(f"/search/{tmdb_type}", query=query).get("results", [])]
        else:
            results = [
                (r, r["media_type"])
                for r in self._get("/search/multi", query=query).get("results", [])
                if r.get("media_type") in ("movie", "tv")
            ]
        out = [t for r, tt in results if (t := self._from_item(r, tt))]
        return out[:limit]

    def get_title(self, media_type: str, tmdb_id: int) -> ExternalTitle:
        """Um título completo (com detalhes) pelo ID do TMDB."""
        tmdb_type = TYPE_TO_TMDB[media_type]
        stub: ExternalTitle = {"external_id": f"{tmdb_type}-{tmdb_id}"}
        return self._enrich(stub)

    def close(self) -> None:
        self._client.close()


class StaticProvider:
    """Embrulha uma lista pronta de títulos (ex.: um único título importado) como provider."""

    def __init__(self, titles: list[ExternalTitle], name: str = "TMDB"):
        self.titles = titles
        self.name = name

    def fetch_titles(self) -> list[ExternalTitle]:
        return self.titles
