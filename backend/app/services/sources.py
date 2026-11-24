"""De onde vem cada título e com que licença (RNFF02). O detalhe mostra isso, com o link para a fonte."""

from ..models import Media
from ..schemas import CreditOut

TMDB_TERMS = (
    "Dados e imagens do TMDB, usados conforme os termos da API do TMDB. Este produto usa a API do TMDB, mas não é "
    "endossado nem certificado pelo TMDB."
)
MUSICBRAINZ_TERMS = (
    "Dados do MusicBrainz, em domínio público (CC0). A capa vem do Cover Art Archive, e os direitos dela são de quem a "
    "criou."
)


def credit_for(media: Media) -> CreditOut:
    external = media.external_id or ""
    if media.source == "tmdb":
        kind, _, number = external.rpartition("-")
        url = f"https://www.themoviedb.org/{kind}/{number}" if kind in ("movie", "tv") and number.isdigit() else None
        return CreditOut(name="TMDB", url=url, license=TMDB_TERMS)
    if media.source == "musicbrainz":
        mbid = external.removeprefix("album-")
        return CreditOut(name="MusicBrainz", url=f"https://musicbrainz.org/release-group/{mbid}", license=MUSICBRAINZ_TERMS)
    if media.source == "mock":
        return CreditOut(
            name="Catálogo de exemplo do Tastory",
            url=None,
            license="Catálogo de demonstração mantido pela equipe, para usar o sistema sem internet.",
        )
    return CreditOut(name="Administração do Tastory", url=None, license="Cadastrado à mão pela administração.")
