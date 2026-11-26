"""Vitrine: dados de exemplo para ver o Tastory cheio, como numa apresentação.

Preenche a conta de demonstração (diário com filmes, séries e discos, Quero ver, uma lista, os cinco favoritos,
episódios com nota, um lembrete de nota pendente e o desafio do mês pela metade) e cria cinco pessoas de exemplo,
com diário, resenhas, curtidas e comentários. A Visitante segue quatro delas; a quinta aparece em "Quem seguir".

- As pessoas de exemplo usam o domínio `@vitrine.tastory.dev` e ficam fora das métricas de pessoas reais.
- As datas são relativas a hoje: a Comunidade sempre mostra registros recentes.
- Pode rodar de novo sem duplicar nada. Títulos que não estão no catálogo são pulados.
"""

import secrets
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import crud
from .auth import hash_password
from .config import DATA_DIR, settings
from .models import (
    DiaryEntry, EpisodeEntry, Follow, ListItem, Media, ReviewComment, ReviewLike, User, UserAvatar, UserList,
    UserPreference,
)
from .seed import DEMO_EMAIL, VITRINE_DOMAIN
from .services.theme import _theme_media, current_theme


@dataclass
class Log:
    """Um registro do diário: título, tipo, há quantos dias, nota e resenha."""

    title: str
    type: str
    days: int
    rating: float | None = None
    review: str | None = None
    spoiler: bool = False
    watching_season: int | None = None


@dataclass
class Person:
    slug: str
    name: str
    genres: list[str]
    diary: list[Log]
    watchlist: list[tuple[str, str]] = field(default_factory=list)
    list_name: str | None = None
    list_items: list[tuple[str, str]] = field(default_factory=list)
    favorites: list[tuple[str, str]] = field(default_factory=list)

    @property
    def email(self) -> str:
        return f"{self.slug}@{VITRINE_DOMAIN}"


M, S, A = "movie", "series", "album"

PEOPLE: list[Person] = [
    Person(
        "marina", "Marina Costa", ["Terror", "Suspense", "Mistério"],
        [
            Log("Hereditário", M, 1, 5, "Saí da sessão olhando para os cantos da casa. A cena do jantar é das mais "
                "tensas que já vi."),
            Log("Midsommar: O Mal Não Espera a Noite", M, 4, 4, "Um terror de dia claro, e funciona. A fotografia "
                "é linda e o desconforto não passa."),
            Log("Corra!", M, 9, 4.5, "Começa como comédia de constrangimento e vira outra coisa. Precisa ver duas "
                "vezes para pegar tudo."),
            Log("A Maldição da Residência Hill", S, 15, 5, "O episódio 6 é quase todo em plano-sequência. Chorei "
                "mais do que me assustei."),
            Log("O Iluminado", M, 22, 4.5),
            Log("A Bruxa", M, 30, 4, "Lento de propósito. O final ainda está na minha cabeça."),
            Log("Missa da Meia-Noite", S, 41, 4.5),
            Log("Psycho", A, 50, 4, "Ouvir a trilha do Herrmann sem as imagens é outra experiência."),
            Log("Se7en: Os Sete Crimes Capitais", M, 63, 4.5),
            Log("Um Lugar Silencioso", M, 75, 3.5),
            Log("It: A Coisa", M, 88, 3),
        ],
        watchlist=[("O Exorcista", M), ("Invocação do Mal", M), ("Twin Peaks", S)],
        list_name="Pra ver com a luz acesa",
        list_items=[("Hereditário", M), ("A Bruxa", M), ("O Iluminado", M), ("Corra!", M), ("Midsommar: O Mal Não "
                    "Espera a Noite", M)],
        favorites=[("Hereditário", M), ("A Maldição da Residência Hill", S), ("O Iluminado", M), ("Corra!", M),
                   ("Psycho", A)],
    ),
    Person(
        "davi", "Davi Rocha", ["Ficção Científica", "Ação", "Drama"],
        [
            Log("Duna: Parte Dois", M, 0, 5, "Villeneuve fez o épico que a gente não via desde O Senhor dos Anéis. "
                "Vi no cinema e quero ver de novo."),
            Log("Dune: Part Two: Original Motion Picture Soundtrack", A, 2, 4.5),
            Log("Interestelar", M, 6, 5, "A cena das mensagens em Miller me derruba toda vez."),
            Log("Ruptura", S, 10, 5, "Melhor série dos últimos anos. Cada episódio termina com uma pergunta nova."),
            Log("A Chegada", M, 17, 4.5, "Ficção científica sobre linguagem e luto. A trilha é parte da história."),
            Log("Blade Runner 2049", M, 26, 4.5),
            Log("Ex Machina: Instinto Artificial", M, 34, 4, "O final muda tudo o que você achou do filme: a Ava "
                "estava testando o Caleb o tempo inteiro.", spoiler=True),
            Log("Dark", S, 45, 5),
            Log("Random Access Memories", A, 52, 4),
            Log("Matrix", M, 70, 5),
            Log("Tudo em Todo o Lugar ao Mesmo Tempo", M, 84, 4),
        ],
        watchlist=[("2001: Uma Odisseia no Espaço", M), ("The Last of Us", S), ("Alien, o Oitavo Passageiro", M)],
        list_name="Ficção científica para começar",
        list_items=[("Matrix", M), ("A Chegada", M), ("Interestelar", M), ("Ruptura", S), ("Dark", S)],
        favorites=[("Interestelar", M), ("Ruptura", S), ("Duna: Parte Dois", M), ("A Chegada", M), ("Dark", S)],
    ),
    Person(
        "bia", "Bia Nunes", ["Animação", "Fantasia", "Família", "Romance"],
        [
            Log("Clube da Esquina", A, 1, 5, "Disco para ouvir do começo ao fim, sem pular nenhuma faixa."),
            Log("A Viagem de Chihiro", M, 3, 5, "Revi depois de adulta e é outro filme. O trem sobre a água é das "
                "cenas mais bonitas do cinema."),
            Log("Elis & Tom", A, 7, 5),
            Log("Divertida Mente", M, 12, 4.5, "Animação que conversa com adulto sem esquecer as crianças."),
            Log("Arcane", S, 20, 5, "Parece uma pintura em movimento. A segunda temporada fecha bem."),
            Log("O Castelo Animado", M, 27, 4),
            Log("Getz / Gilberto", A, 36, 4.5),
            Log("Viva: A Vida é uma Festa", M, 47, 5, "Chorei na parte da música. Toda vez."),
            Log("Meu Amigo Totoro", M, 58, 4.5),
            Log("Antes do Amanhecer", M, 72, 4),
        ],
        watchlist=[("Princesa Mononoke", M), ("Your Name", M), ("Avatar: A Lenda de Aang", S)],
        list_name="Pra um domingo de chuva",
        list_items=[("Meu Amigo Totoro", M), ("Clube da Esquina", A), ("Antes do Amanhecer", M),
                    ("O Castelo Animado", M)],
        favorites=[("A Viagem de Chihiro", M), ("Clube da Esquina", A), ("Viva: A Vida é uma Festa", M),
                   ("Arcane", S), ("Elis & Tom", A)],
    ),
    Person(
        "tomas", "Tomás Lima", ["Crime", "Drama", "Suspense"],
        [
            Log("O Urso", S, 2, 4.5, "Ansiedade em forma de série. O episódio do jantar de Natal é exaustivo, no "
                "bom sentido."),
            Log("Succession", S, 8, 5, "Ninguém presta, e é impossível parar de assistir."),
            Log("Os Bons Companheiros", M, 14, 4.5),
            Log("Cidade de Deus", M, 19, 5, "Ritmo, montagem, elenco. Continua atual mais de vinte anos depois."),
            Log("Breaking Bad", S, 29, 5),
            Log("The Dark Side of the Moon", A, 38, 4.5),
            Log("Parasita", M, 46, 5, "Muda de gênero três vezes e não perde a mão em nenhuma."),
            Log("Zodíaco", M, 60, 4),
            Log("Tropa de Elite", M, 77, 3.5),
        ],
        watchlist=[("Família Soprano", S), ("Os Infiltrados", M), ("Mindhunter", S)],
        favorites=[("Cidade de Deus", M), ("Succession", S), ("Parasita", M), ("Breaking Bad", S),
                   ("Os Bons Companheiros", M)],
    ),
    Person(
        "julia", "Júlia Prado", ["Comédia", "Romance", "Drama"],
        [
            Log("O Grande Hotel Budapeste", M, 1, 4.5, "Cada quadro parece uma caixa de doces. Muito engraçado."),
            Log("Fleabag", S, 5, 5, "Duas temporadas perfeitas. A conversa com o padre no confessionário é genial."),
            Log("Ted Lasso", S, 13, 4),
            Log("La La Land: Cantando Estações", M, 21, 4.5),
            Log("Questão de Tempo", M, 33, 4.5, "Comédia romântica que vira um filme sobre pai e filho."),
            Log("folklore", A, 44, 4),
            Log("Ela", M, 61, 5, "Uma história de amor com um sistema operacional que fala mais sobre solidão do que sobre tecnologia."),
            Log("Barbie", M, 80, 3.5),
        ],
        watchlist=[("Normal People", S), ("Me Chame pelo Seu Nome", M)],
        favorites=[("Ela", M), ("Fleabag", S),
                   ("O Grande Hotel Budapeste", M), ("Questão de Tempo", M), ("folklore", A)],
    ),
]

# A Visitante: um pouco de tudo, com MPB, ficção científica e o Nordeste do tema do mês
VISITANTE = Person(
    "visitante", "Visitante", ["Ficção Científica", "Drama", "Animação"],
    [
        Log("Matrix", M, 4, 5, "Ainda parece filme de amanhã."),
        Log("Clube da Luta", M, 5, 4.5),
        Log("Construção", A, 8, 5, "Chico no auge. A faixa-título é uma aula de rima."),
        Log("Interestelar", M, 14, 5, "Vi no cinema com o som no talo. A trilha do Hans Zimmer faz metade do filme."),
        Log("Interstellar: Original Motion Picture Soundtrack", A, 15, 4.5),
        Log("Duna", M, 18, 4.5),
        Log("Elis & Tom", A, 21, 5),
        Log("Cidade de Deus", M, 27, 5),
        Log("O Exterminador do Futuro 2: O Julgamento Final", M, 34, 4.5),
        Log("Clube da Esquina", A, 40, 5),
        Log("A Viagem de Chihiro", M, 46, 4.5),
        Log("Ruptura", S, 52, 5, "Estranha, bonita e engraçada ao mesmo tempo. Fiquei pensando dias depois."),
        Log("Pulp Fiction: Tempo de Violência", M, 66, 4),
        Log("Breaking Bad", S, 80, 5),
        Log("Falso Brilhante", A, 95, 5),
        Log("A Origem", M, 110, 4.5),
        Log("Parasita", M, 3, None),  # sem nota: o Início pede a nota no "Antes que eu esqueça"
        Log("Dark", S, 2, None, watching_season=2),  # assistindo, com nota em cada episódio
    ],
    watchlist=[("Duna: Parte Dois", M), ("O Poderoso Chefão", M), ("Toy Story", M), ("Arcane", S),
               ("Blade Runner 2049", M), ("Acabou chorare", A)],
    list_name="Maratona de fim de ano",
    list_items=[("O Senhor dos Anéis: A Sociedade do Anel", M), ("O Senhor dos Anéis: O Retorno do Rei", M),
                ("Harry Potter e a Pedra Filosofal", M), ("De Volta para o Futuro", M)],
    favorites=[("Interestelar", M), ("Construção", A), ("Cidade de Deus", M), ("Ruptura", S), ("Elis & Tom", A)],
)

# Dark, temporada 1 inteira e o começo da 2: nota em cada episódio e uma anotação, que só a Visitante vê
EPISODES = [(1, n, r) for n, r in enumerate([4, 4.5, 4.5, 5, 4, 4.5, 5, 5, 4.5, 5], start=1)] + [
    (2, 1, 4.5), (2, 2, 4), (2, 3, 5)]
EPISODE_NOTES = {(1, 10): "Agora entendi a caverna. Preciso de um caderno para os nomes.",
                 (2, 3): "O episódio que amarra as três épocas."}

# Um disco pela metade, para o "Continuar ouvindo": as quatro primeiras faixas, algumas com nota
LISTENING = ("Acabou chorare", [(1, 1, 5.0), (1, 2, 4.5), (1, 3, None), (1, 4, 5.0)])

# Indicações para a Visitante: (quem indica, título, tipo, recado)
SUGGESTIONS = [
    ("davi", "Ex Machina: Instinto Artificial", M, "Você curtiu Ruptura, vai pirar com esse."),
    ("bia", "Princesa Mononoke", M, "O mais bonito do Miyazaki, sério."),
    ("marina", "Corra!", M, None),
]

# Quem a Visitante segue (a Júlia fica de fora, para aparecer em "Quem seguir") e quem segue de volta
FOLLOWS = [("visitante", "marina"), ("visitante", "davi"), ("visitante", "bia"), ("visitante", "tomas"),
           ("marina", "visitante"), ("davi", "visitante"), ("bia", "visitante"),
           ("davi", "marina"), ("bia", "julia"), ("tomas", "davi"), ("julia", "bia"), ("marina", "tomas")]

# Curtidas: (dono da resenha, título, quem curte)
LIKES = [
    ("davi", "Duna: Parte Dois", ["visitante", "marina", "tomas", "bia"]),
    ("davi", "Ruptura", ["visitante", "julia"]),
    ("davi", "Interestelar", ["visitante", "bia"]),
    ("marina", "Hereditário", ["visitante", "davi", "tomas"]),
    ("marina", "A Maldição da Residência Hill", ["bia", "julia"]),
    ("bia", "A Viagem de Chihiro", ["visitante", "julia", "davi"]),
    ("bia", "Clube da Esquina", ["visitante", "tomas"]),
    ("tomas", "Succession", ["davi", "visitante"]),
    ("tomas", "Cidade de Deus", ["visitante", "marina"]),
    ("julia", "Fleabag", ["bia", "marina"]),
    ("visitante", "Interestelar", ["davi", "bia", "marina"]),
    ("visitante", "Construção", ["bia", "tomas"]),
    ("visitante", "Ruptura", ["davi"]),
]

# Comentários: (dono da resenha, título, quem comenta, texto, quantas horas depois da resenha)
COMMENTS = [
    ("davi", "Duna: Parte Dois", "visitante", "Vou ver neste fim de semana! Cinema ou espero o streaming?", 0.5),
    ("davi", "Duna: Parte Dois", "davi", "Cinema, sem dúvida. O som faz muita diferença.", 0.8),
    ("davi", "Duna: Parte Dois", "marina", "Concordo, a cena do verme é feita para tela grande.", 1.2),
    ("marina", "Hereditário", "tomas", "Esse eu não tive coragem de ver sozinho.", 2),
    ("marina", "Hereditário", "visitante", "Vi por indicação sua e não dormi direito. Obrigada?", 14),
    ("bia", "A Viagem de Chihiro", "julia", "A cena do trem é a minha favorita também.", 5),
    ("tomas", "Succession", "davi", "A última temporada é perfeita do começo ao fim.", 20),
    ("visitante", "Interestelar", "davi", "A trilha sozinha já vale. Ouviu o disco?", 3),
    ("visitante", "Interestelar", "visitante", "Ouvi! Está no meu diário também.", 26),
    ("visitante", "Construção", "bia", "Deus lhe pague é a minha favorita do disco.", 12),
]


def _media(db: Session, title: str, kind: str) -> Media | None:
    # Com o mesmo título duas vezes (do mock e do TMDB), fica a cópia com pôster e, entre elas, a mais popular
    return db.scalar(
        select(Media)
        .where(Media.title == title, Media.type == kind)
        .order_by(Media.poster_url.is_(None), Media.popularity.desc())  # a cópia com pôster vem antes
        .limit(1)
    )


def _user(db: Session, person: Person, password_hash: str) -> User:
    if person.slug == "visitante":
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is None:
            raise RuntimeError("A conta de demonstração não existe: rode o seed antes da vitrine")
    else:
        user = db.scalar(select(User).where(User.email == person.email))
        if user is None:
            # Só as contas que a vitrine cria começam abertas para todos; a escolha de quem já existe fica como está
            user = User(name=person.name, email=person.email, password_hash=password_hash, visibility="all")
            db.add(user)
            db.flush()
    user.onboarded = True
    _avatar(db, user, person.slug)
    crud.get_or_create_watchlist(db, user)
    have = {p.genre for p in user.preferences}
    for genre in person.genres:
        if genre not in have:
            db.add(UserPreference(user_id=user.id, genre=genre))
    return user


AVATAR_DIR = DATA_DIR / "avatares"


def _avatar(db: Session, user: User, slug: str) -> None:
    """A foto de exemplo: um avatar ilustrado (Notionists, de Zoish, CC0, pelo DiceBear), guardado em data/avatares.
    Quem já tem foto fica com a sua."""
    path = AVATAR_DIR / f"{slug}.png"
    if not path.exists() or db.get(UserAvatar, user.id) is not None:
        return
    db.add(UserAvatar(user_id=user.id, image=path.read_bytes(), content_type="image/png", token=secrets.token_hex(16)))


def _when(days: int, hour: int = 21) -> datetime:
    """Há `days` dias, à noite (UTC). Hoje fica algumas horas atrás, para nunca cair no futuro."""
    now = datetime.now(timezone.utc)
    if days == 0:
        return now - timedelta(hours=2)
    return (now - timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


def _log(db: Session, user: User, log: Log, today: date) -> DiaryEntry | None:
    media = _media(db, log.title, log.type)
    if media is None:
        return None
    existing = db.scalar(select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media.id))
    entry = crud.upsert_diary(
        db, user, media.id, rating=log.rating, review=log.review, consumed_at=today - timedelta(days=log.days),
        status="watching" if log.watching_season else "seen", season=log.watching_season,
    )
    entry.spoiler = log.spoiler
    if existing is None:
        entry.created_at = _when(log.days)
    db.flush()  # a Comunidade ordena pelo id: cada registro entra na hora, do mais antigo para o mais novo
    return entry


def _lists(db: Session, user: User, person: Person, entries: dict[str, DiaryEntry]) -> None:
    watchlist = crud.get_or_create_watchlist(db, user)
    for position, (title, kind) in enumerate(person.watchlist):
        media = _media(db, title, kind)
        if media is None or title in entries:
            continue
        crud.add_to_list(db, watchlist, media.id)
        db.flush()
        item = db.scalar(select(ListItem).where(ListItem.list_id == watchlist.id, ListItem.media_id == media.id))
        # O primeiro está no Quero ver há duas semanas: o Início pergunta "Já viu?". Os outros, de poucos dias
        item.added_at = _when(14 if position == 0 else position + 1)

    if person.list_name:
        lst = db.scalar(select(UserList).where(UserList.user_id == user.id, UserList.name == person.list_name))
        if lst is None:
            lst = UserList(user_id=user.id, name=person.list_name)
            db.add(lst)
            db.flush()
        for title, kind in person.list_items:
            if media := _media(db, title, kind):
                crud.add_to_list(db, lst, media.id)

    # Os cinco favoritos; se algum não está no catálogo, entram os de nota mais alta do diário
    pinned = [entries[title].media_id for title, _ in person.favorites if title in entries]
    for entry in sorted(entries.values(), key=lambda e: -(e.rating or 0)):
        if len(pinned) >= 5:
            break
        if entry.media_id not in pinned and entry.rating:
            pinned.append(entry.media_id)
    user.pinned = pinned[:5]


def _challenge(db: Session, user: User, done: int = 2) -> int:
    """Registra títulos do tema do mês, para o desafio aparecer pela metade (dois de três)."""
    theme = current_theme()
    if theme is None:
        return 0
    found, _ = _theme_media(db, theme)
    count = 0
    for i, media in enumerate(found[:done]):
        existing = db.scalar(select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id == media.id))
        entry = crud.upsert_diary(db, user, media.id, rating=5 if media.type == "album" else 4.5,
                                  consumed_at=date.today())
        if existing is None:
            entry.created_at = datetime.now(timezone.utc) - timedelta(hours=3 + i)
        count += 1
    return count


def build_vitrine(db: Session) -> dict:
    """Cria ou completa a vitrine. Devolve quantas coisas há em cada parte."""
    password_hash = hash_password(settings.demo_password)  # as pessoas de exemplo entram com a senha da demo
    today = date.today()
    users: dict[str, User] = {}
    entries: dict[str, dict[str, DiaryEntry]] = {}
    everyone = [VISITANTE, *PEOPLE]
    for person in everyone:
        users[person.slug] = _user(db, person, password_hash)
        entries[person.slug] = {}
    db.flush()
    # Os registros de todo mundo, do mais antigo para o mais novo
    logs = sorted(((p, log) for p in everyone for log in p.diary), key=lambda pl: -pl[1].days)
    for person, log in logs:
        if entry := _log(db, users[person.slug], log, today):
            entries[person.slug][log.title] = entry
    for person in everyone:
        _lists(db, users[person.slug], person, entries[person.slug])

    challenge = _challenge(db, users["visitante"])

    dark = _media(db, "Dark", S)
    episodes = 0
    if dark:
        for season, number, rating in EPISODES:
            row = db.scalar(select(EpisodeEntry).where(
                EpisodeEntry.user_id == users["visitante"].id, EpisodeEntry.media_id == dark.id,
                EpisodeEntry.season == season, EpisodeEntry.episode == number))
            if row is None:
                row = EpisodeEntry(user_id=users["visitante"].id, media_id=dark.id, season=season, episode=number)
                db.add(row)
            row.rating, row.note = rating, EPISODE_NOTES.get((season, number))
            episodes += 1

    disco = _media(db, LISTENING[0], A)
    if disco:
        for disc, number, rating in LISTENING[1]:
            row = db.scalar(select(EpisodeEntry).where(
                EpisodeEntry.user_id == users["visitante"].id, EpisodeEntry.media_id == disco.id,
                EpisodeEntry.season == disc, EpisodeEntry.episode == number))
            if row is None:
                db.add(EpisodeEntry(user_id=users["visitante"].id, media_id=disco.id, season=disc, episode=number,
                                    rating=rating, updated_at=datetime.now(timezone.utc) - timedelta(hours=1)))

    follows = 0
    for a, b in FOLLOWS:
        fa, fb = users[a].id, users[b].id
        if not db.scalar(select(Follow).where(Follow.follower_id == fa, Follow.followed_id == fb)):
            db.add(Follow(follower_id=fa, followed_id=fb))
        follows += 1

    likes = 0
    for owner, title, likers in LIKES:
        entry = entries[owner].get(title)
        if entry is None:
            continue
        for liker in likers:
            uid = users[liker].id
            if not db.scalar(select(ReviewLike).where(ReviewLike.entry_id == entry.id, ReviewLike.user_id == uid)):
                db.add(ReviewLike(entry_id=entry.id, user_id=uid))
            likes += 1

    comments = 0
    now = datetime.now(timezone.utc)
    for owner, title, author, text, hours in COMMENTS:
        entry = entries[owner].get(title)
        if entry is None:
            continue
        uid = users[author].id
        if not db.scalar(select(ReviewComment).where(
                ReviewComment.entry_id == entry.id, ReviewComment.user_id == uid, ReviewComment.text == text)):
            posted = entry.created_at if entry.created_at.tzinfo else entry.created_at.replace(tzinfo=timezone.utc)
            at = min(posted + timedelta(hours=hours), now - timedelta(minutes=5))
            db.add(ReviewComment(entry_id=entry.id, user_id=uid, text=text, created_at=at))
        comments += 1

    # Indicações e avisos para a Visitante, para o sino e o Início já mostrarem algo na demonstração
    from .models import Notification, Suggestion

    visitante = users["visitante"].id
    for slug, title, kind, note in SUGGESTIONS:
        media = _media(db, title, kind)
        if media is None:
            continue
        if not db.scalar(select(Suggestion).where(Suggestion.from_id == users[slug].id, Suggestion.to_id == visitante,
                                                  Suggestion.media_id == media.id)):
            db.add(Suggestion(from_id=users[slug].id, to_id=visitante, media_id=media.id, note=note,
                              created_at=now - timedelta(hours=2)))
            db.add(Notification(user_id=visitante, kind="indicou", actor_id=users[slug].id, media_id=media.id, text=note,
                                created_at=now - timedelta(hours=2)))
    # Criar lembrança juntos: a Bia chama a Visitante para sábado; a Visitante e o Davi já viram juntos ontem
    from .models import Invite

    for sender, receiver, title, kind, days, note, status in [
        ("bia", "visitante", "Your Name", M, 2, "Sessão de anime no sábado? Eu levo a pipoca.", "pending"),
        ("visitante", "davi", "2001: Uma Odisseia no Espaço", M, -1, "Clássico no telão, topa?", "accepted"),
    ]:
        media = _media(db, title, kind)
        if media is None:
            continue
        frm, to = users[sender].id, users[receiver].id
        if not db.scalar(select(Invite).where(Invite.from_id == frm, Invite.to_id == to, Invite.media_id == media.id)):
            db.add(Invite(from_id=frm, to_id=to, media_id=media.id, day=date.today() + timedelta(days=days), note=note,
                          status=status, created_at=now - timedelta(days=2)))
            db.add(Notification(user_id=to, kind="convidou", actor_id=frm, media_id=media.id, text=note,
                                created_at=now - timedelta(days=2)))
            if status == "accepted":
                db.add(Notification(user_id=frm, kind="aceitou", actor_id=to, media_id=media.id,
                                    created_at=now - timedelta(days=1, hours=20)))

    if not db.scalar(select(Notification).where(Notification.user_id == visitante, Notification.kind.in_(("seguiu", "curtiu")))):
        for a, b in FOLLOWS:
            if b == "visitante":
                db.add(Notification(user_id=visitante, kind="seguiu", actor_id=users[a].id, created_at=now - timedelta(days=1)))
        for owner, title, likers in LIKES:
            entry = entries[owner].get(title)
            if owner == "visitante" and entry:
                for liker in likers[:2]:
                    db.add(Notification(user_id=visitante, kind="curtiu", actor_id=users[liker].id, media_id=entry.media_id,
                                        entry_id=entry.id, created_at=now - timedelta(hours=5)))
        for owner, title, author, text, _ in COMMENTS:
            entry = entries[owner].get(title)
            if owner == "visitante" and entry and author != "visitante":
                db.add(Notification(user_id=visitante, kind="comentou", actor_id=users[author].id, media_id=entry.media_id,
                                    entry_id=entry.id, text=text, created_at=now - timedelta(hours=4)))

    db.commit()
    return {
        "pessoas": len(PEOPLE),
        "registros": sum(len(e) for e in entries.values()) + challenge,
        "episodios": episodes,
        "seguindo": follows,
        "curtidas": likes,
        "comentarios": comments,
    }
