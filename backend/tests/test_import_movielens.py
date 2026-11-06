from sqlalchemy import func, select

from app.models import ItemNeighbor, Media
from scripts.import_movielens import import_movielens


def write_dataset(root):
    (root / "links.csv").write_text("movieId,imdbId,tmdbId\n1,1,101\n2,2,102\n3,3,103\n9,9,999\n", encoding="utf-8")
    (root / "ratings.csv").write_text(
        "userId,movieId,rating,timestamp\n"
        "1,1,5.0,0\n1,2,5.0,0\n"
        "2,1,4.5,0\n2,2,4.0,0\n"
        "3,3,5.0,0\n3,9,5.0,0\n",
        encoding="utf-8",
    )


def add_movies(db):
    movies = [
        Media(type="movie", source="tmdb", external_id=f"movie-{tmdb_id}", title=f"Filme {tmdb_id}")
        for tmdb_id in (101, 102, 103)
    ]
    db.add_all(movies)
    db.commit()
    return movies


def test_import_links_titles_rated_by_the_same_people(db, tmp_path):
    write_dataset(tmp_path)
    first, second, third = add_movies(db)

    result = import_movielens(db, tmp_path)

    assert result == {"titles": 3, "neighbors": 2}
    pairs = set(db.execute(select(ItemNeighbor.media_id, ItemNeighbor.neighbor_id)).tuples())
    assert pairs == {(first.id, second.id), (second.id, first.id)}


def test_import_can_run_again_without_duplicating(db, tmp_path):
    write_dataset(tmp_path)
    add_movies(db)

    import_movielens(db, tmp_path)
    import_movielens(db, tmp_path)

    assert db.scalar(select(func.count()).select_from(ItemNeighbor)) == 2
