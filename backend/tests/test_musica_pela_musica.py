"""Música pela música: discos parecidos com os que a pessoa ouviu entram nas sugestões de música, intercalados com as
pontes dos filmes, e ganham mais espaço quanto mais discos a pessoa ouve."""

from sqlalchemy import select

from app import crud
from app.models import Media, User
from app.services.bridges import album_suggestions, interleave
from app.services.recommender import Recommendation

from .test_bridges import album, albums  # noqa: F401  (o fixture com as pontes dos filmes)


def mpb(db):
    """Quatro discos de MPB dos anos 70, um de bossa nova dos 60 e um de rock dos 90."""
    def disco(title, creators, year, genres, tags, mbid):
        m = album(db, title, creators, year, genres, mbid, ["BR"])
        m.tags, m.language = tags, "pt"
        return m

    d = {
        "construcao": disco("Construção", ["Chico Buarque"], 1971, ["MPB"], ["mpb", "samba-canção"], "m1"),
        "clube": disco("Clube da Esquina", ["Milton Nascimento"], 1972, ["MPB"], ["mpb", "folk"], "m2"),
        "transa": disco("Transa", ["Caetano Veloso"], 1972, ["MPB"], ["mpb", "tropicália"], "m3"),
        "refazenda": disco("Refazenda", ["Gilberto Gil"], 1975, ["MPB"], ["mpb", "tropicália"], "m4"),
        "wave": disco("Wave", ["Tom Jobim"], 1967, ["Bossa nova"], ["bossa nova", "jazz"], "m5"),
        "grunge": disco("Nevermind", ["Nirvana"], 1991, ["Rock"], ["grunge"], "m6"),
    }
    db.commit()
    return d


def test_quem_ouve_mpb_recebe_mpb_e_nao_so_trilha(db, albums):  # noqa: F811
    discos = mpb(db)
    user = db.scalar(select(User).where(User.email == "demo@tastory.dev"))
    # Viu e adorou dois filmes com trilha e ouviu dois discos de MPB
    for name in ("Interestelar", "Cidade de Deus"):
        crud.upsert_diary(db, user, db.scalar(select(Media.id).where(Media.title == name, Media.type == "movie")), rating=5)
    for key in ("construcao", "clube"):
        crud.upsert_diary(db, user, discos[key].id, rating=5)
    db.commit()

    recs = album_suggestions(db, user.id, limit=8)
    titles = [r.media.title for r in recs]
    # Com dois discos ouvidos, a música parecida fica com cerca de um terço dos lugares, começando pelo primeiro
    assert recs[0].reason.startswith("Parecido com ")
    assert {"Transa", "Refazenda"} <= set(titles)
    transa = next(r for r in recs if r.media.title == "Transa")
    assert transa.reason.startswith("Parecido com ") and "mpb" in transa.reason
    assert any(r.reason.startswith("Trilha de") for r in recs)  # as pontes com os filmes continuam
    assert titles.index("Transa") < titles.index("Nevermind") if "Nevermind" in titles else True


def test_quem_nao_ouve_discos_recebe_musica_pelas_pontes(db, albums):  # noqa: F811
    mpb(db)
    user = db.scalar(select(User).where(User.email == "demo@tastory.dev"))
    crud.upsert_diary(db, user, db.scalar(select(Media.id).where(Media.title == "Interestelar", Media.type == "movie")), rating=5)
    db.commit()
    recs = album_suggestions(db, user.id, limit=5)
    assert recs[0].reason.startswith("Trilha de Interestelar")
    assert not any(r.reason.startswith("Parecido com") for r in recs)


def test_intercalar_na_proporcao_sem_repetir(db):
    def rec(i):
        return Recommendation(Media(id=i, type="album", title=str(i)), 1.0, "", "content")

    out = interleave([rec(1), rec(2), rec(3)], [rec(10), rec(2), rec(11)], 0.5)
    assert [r.media.id for r in out] == [1, 10, 2, 11, 3]  # o 2 repetido entra uma vez só
