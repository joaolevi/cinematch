"""A própria conta: exportar os dados, excluir a conta (RFF06), sair dos experimentos (RFF17), escolher quem vê os
registros (RFF10), marcar os serviços que assina (RFF21), ver o próprio histórico de atividades (RFF31) e editar o
nome, o e-mail, a senha e a foto de perfil."""

import base64
import binascii
import re
import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, hash_password, verify_password
from ..db import get_db
from ..models import (
    DiaryEntry,
    Dismissed,
    EpisodeEntry,
    Follow,
    Media,
    RecEvent,
    ReviewComment,
    ReviewLike,
    TasteAdjustment,
    User,
    ListItem,
    UserInterest,
    UserList,
    UserAvatar,
    UserPreference,
)
from ..config import settings
from ..schemas import (
    WatchingOut,
    AccountEditIn, ActivityOut, ArrivalOut, AvatarIn, DeleteAccountIn, PasswordChangeIn, PinnedIn, ExperimentsIn, LetterboxdIn, LetterboxdOut, MediaOut, PersonOut, ServicesIn, UserOut,
    VisibilityIn,
)
from ..services.letterboxd import import_letterboxd
from ..services.streaming import BY_KEY as SERVICES, watchlist_arrivals
from ..services.tmdb import TmdbCatalogProvider

from ..services.episodes import watching_now
router = APIRouter(prefix="/me", tags=["conta"])


def _title(media: Media) -> dict:
    return {"id": media.id, "title": media.title, "type": media.type, "year": media.year}


def _utc(moment: datetime) -> datetime:
    """O SQLite devolve as datas sem fuso; elas foram gravadas em UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


ActivityKind = Literal["registros", "notas", "resenhas", "listas", "curtidas", "comentarios", "seguindo"]


@router.get("/watching", response_model=list[WatchingOut])
def watching(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Continuar assistindo: as séries em andamento, da mexida por último para a mais antiga, com a temporada, quantos
    episódios dela foram vistos e o próximo episódio."""
    return watching_now(db, user)


@router.get("/activity", response_model=list[ActivityOut])
def my_activity(
    kind: ActivityKind | None = Query(default=None, description="Só um tipo de atividade"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """O próprio histórico de atividades (RFF31), do mais recente ao mais antigo: registros no diário (com nota e
    resenha), títulos guardados em listas, curtidas e comentários em resenhas e pessoas que passou a seguir. `kind`
    filtra: `notas` e `resenhas` são os registros com nota ou com resenha. O começo (onboarding) não entra."""
    items: list[ActivityOut] = []
    media_out = MediaOut.model_validate
    if kind in (None, "registros", "notas", "resenhas"):
        q = select(DiaryEntry).where(DiaryEntry.user_id == user.id, DiaryEntry.from_onboarding.is_(False))
        if kind == "notas":
            q = q.where(DiaryEntry.rating.is_not(None))
        if kind == "resenhas":
            q = q.where(DiaryEntry.review.is_not(None), DiaryEntry.review != "")
        for e in db.scalars(q.options(selectinload(DiaryEntry.media))):
            items.append(ActivityOut(kind="registro", at=_utc(e.created_at), media=media_out(e.media), rating=e.rating,
                                     text=e.review or None))
    if kind in (None, "listas"):
        rows = db.execute(
            select(ListItem, UserList.name, UserList.is_watchlist)
            .join(UserList, UserList.id == ListItem.list_id)
            .where(UserList.user_id == user.id, UserList.featured.is_(False))
            .options(selectinload(ListItem.media))
        )
        for item, name, watchlist in rows:
            items.append(ActivityOut(kind="lista", at=_utc(item.added_at), media=media_out(item.media),
                                     list_name="Quero ver" if watchlist else name))
    if kind in (None, "curtidas"):
        rows = db.execute(
            select(ReviewLike.created_at, DiaryEntry)
            .join(DiaryEntry, DiaryEntry.id == ReviewLike.entry_id)
            .where(ReviewLike.user_id == user.id)
            .options(selectinload(DiaryEntry.media), selectinload(DiaryEntry.user))
        )
        for at, entry in rows:
            items.append(ActivityOut(kind="curtida", at=_utc(at), media=media_out(entry.media),
                                     person=PersonOut(id=entry.user.id, name=entry.user.name)))
    if kind in (None, "comentarios"):
        rows = db.scalars(
            select(ReviewComment)
            .where(ReviewComment.user_id == user.id)
            .options(selectinload(ReviewComment.entry).selectinload(DiaryEntry.media),
                     selectinload(ReviewComment.entry).selectinload(DiaryEntry.user))
        )
        for c in rows:
            items.append(ActivityOut(kind="comentario", at=_utc(c.created_at), media=media_out(c.entry.media),
                                     text=c.text, person=PersonOut(id=c.entry.user.id, name=c.entry.user.name)))
    if kind in (None, "seguindo"):
        rows = db.execute(
            select(Follow.created_at, User.id, User.name)
            .join(User, User.id == Follow.followed_id)
            .where(Follow.follower_id == user.id)
        )
        for at, person_id, name in rows:
            items.append(ActivityOut(kind="seguiu", at=_utc(at), person=PersonOut(id=person_id, name=name)))
    items.sort(key=lambda a: a.at, reverse=True)
    return items[offset : offset + limit]


@router.get("/watchlist/arrivals", response_model=list[ArrivalOut])
def arrivals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Aviso do Quero ver (RFF29): títulos guardados que chegaram a um dos serviços da pessoa nos últimos 30 dias,
    depois de ela guardar. A data vem da atualização de onde assistir (`make prod-servicos` ou a abertura do título):
    a primeira busca de cada título não gera aviso, porque não dá para saber quando ele chegou."""
    return watchlist_arrivals(db, user)


def tmdb_provider() -> TmdbCatalogProvider | None:
    """Sem a chave do TMDB, a importação só acha o que já está no catálogo pelo nome."""
    if not settings.tmdb_api_key:
        return None
    return TmdbCatalogProvider(settings.tmdb_api_key, settings.tmdb_language, settings.tmdb_region, pages=1)


@router.post("/import/letterboxd", response_model=LetterboxdOut)
def import_from_letterboxd(data: LetterboxdIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Importa o histórico do Letterboxd (RFF18) a partir dos CSVs do arquivo exportado pela pessoa: `watched.csv`,
    `ratings.csv`, `diary.csv`, `reviews.csv` e `watchlist.csv`. Cada filme é procurado no catálogo por nome e ano e,
    se não estiver lá, no TMDB, que acha pelo nome original. Cada envio traz até 50 filmes novos para o catálogo;
    enviar de novo traz os próximos. O que já está no diário fica como está, e a data do registro é a do Letterboxd."""
    provider = tmdb_provider()
    try:
        return import_letterboxd(db, user, {f.name: f.content for f in data.files}, provider)
    finally:
        if provider is not None:
            provider.close()


@router.get("/export")
def export_my_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tudo o que o Tastory guarda sobre a pessoa, em JSON, para baixar (RFF06). A senha não sai, nem cifrada."""
    titles = {m.id: m for m in db.scalars(select(Media))}
    entries = db.scalars(
        select(DiaryEntry).where(DiaryEntry.user_id == user.id).order_by(DiaryEntry.created_at)
    )
    lists = db.scalars(
        select(UserList).where(UserList.user_id == user.id).options(selectinload(UserList.items)).order_by(UserList.id)
    )
    names = {u.id: u.name for u in db.scalars(select(User))}
    interests = db.execute(select(UserInterest.kind, UserInterest.value).where(UserInterest.user_id == user.id)).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at,
            "visibility": user.visibility,
            "ab_group": user.ab_group,
            "in_experiments": user.in_experiments,
            "services": user.services,
        },
        "preferences": {
            "genres": list(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user.id))),
            "interests": [{"kind": kind, "value": value} for kind, value in interests],
        },
        "diary": [
            {
                "media": _title(e.media),
                "rating": e.rating,
                "review": e.review,
                "consumed_at": e.consumed_at,
                "created_at": e.created_at,
                "from_onboarding": e.from_onboarding,
            }
            for e in entries
        ],
        "episodes": [
            {"title": titles[e.media_id].title if e.media_id in titles else None, "season": e.season,
             "episode": e.episode, "rating": e.rating, "note": e.note}
            for e in db.scalars(
                select(EpisodeEntry).where(EpisodeEntry.user_id == user.id)
                .order_by(EpisodeEntry.media_id, EpisodeEntry.season, EpisodeEntry.episode)
            )
        ],
        "lists": [
            {
                "name": lst.name,
                "is_watchlist": lst.is_watchlist,
                "items": [{"media": _title(titles[i.media_id]), "added_at": i.added_at} for i in lst.items],
            }
            for lst in lists
        ],
        "dismissed": [
            _title(titles[mid]) for mid in db.scalars(select(Dismissed.media_id).where(Dismissed.user_id == user.id))
        ],
        "following": [
            names.get(fid) for fid in db.scalars(select(Follow.followed_id).where(Follow.follower_id == user.id))
        ],
        "review_likes": len(list(db.scalars(select(ReviewLike.id).where(ReviewLike.user_id == user.id)))),
        "review_comments": [
            {"text": text, "created_at": at}
            for text, at in db.execute(
                select(ReviewComment.text, ReviewComment.created_at).where(ReviewComment.user_id == user.id)
            )
        ],
        "taste_adjustments": [
            {"kind": kind, "value": value}
            for kind, value in db.execute(
                select(TasteAdjustment.kind, TasteAdjustment.value).where(TasteAdjustment.user_id == user.id)
            )
        ],
        # O que a pessoa viu e fez nas sugestões: a base da taxa de aceitação
        "recommendation_events": [
            {"media": _title(titles[mid]), "action": action, "created_at": at}
            for mid, action, at in db.execute(
                select(RecEvent.media_id, RecEvent.action, RecEvent.created_at)
                .where(RecEvent.user_id == user.id)
                .order_by(RecEvent.created_at)
            )
        ],
    }


@router.patch("", response_model=UserOut)
def edit_account(data: AccountEditIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Muda o nome e o e-mail da conta. Um e-mail que outra conta já usa dá 409."""
    fields = data.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in fields:
        email = str(fields["email"]).lower()
        other = db.scalar(select(User.id).where(func.lower(User.email) == email, User.id != user.id))
        if other is not None:
            raise HTTPException(status_code=409, detail="Este e-mail já é de outra conta")
        user.email = email
    if "name" in fields:
        user.name = fields["name"]
    db.commit()
    db.refresh(user)
    return user


@router.put("/favorites", response_model=list[MediaOut])
def set_favorites(data: PinnedIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Escolhe os cinco favoritos do perfil, na ordem. Só valem títulos do próprio diário; repetidos contam uma vez."""
    ids = list(dict.fromkeys(data.media_ids))
    in_diary = set(db.scalars(select(DiaryEntry.media_id).where(DiaryEntry.user_id == user.id, DiaryEntry.media_id.in_(ids))))
    missing = [i for i in ids if i not in in_diary]
    if missing:
        raise HTTPException(status_code=422, detail="Os favoritos precisam estar no seu diário")
    user.pinned = ids
    db.commit()
    by_id = {m.id: m for m in db.scalars(select(Media).where(Media.id.in_(ids)))}
    return [by_id[i] for i in ids]


@router.put("/password", status_code=204)
def change_password(data: PasswordChangeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Troca a senha, pedindo a atual. A sessão aberta continua valendo."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="A senha atual não confere")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return Response(status_code=204)


AVATAR_TYPES = {"jpeg": b"\xff\xd8\xff", "png": b"\x89PNG", "webp": b"RIFF"}
MAX_AVATAR_BYTES = 300_000


@router.put("/avatar", status_code=204)
def set_avatar(data: AvatarIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Troca a foto de perfil. A tela reduz a imagem antes de mandar; aqui só conferimos o tipo e o tamanho."""
    match = re.fullmatch(r"data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)", data.image)
    if not match:
        raise HTTPException(status_code=422, detail="Mande a foto em JPEG, PNG ou WebP")
    try:
        image = base64.b64decode(match.group(2), validate=True)
    except binascii.Error:
        raise HTTPException(status_code=422, detail="A foto não pôde ser lida")
    kind = match.group(1)
    if len(image) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=422, detail="A foto passou de 300 KB")
    if not image.startswith(AVATAR_TYPES[kind]) or (kind == "webp" and image[8:12] != b"WEBP"):
        raise HTTPException(status_code=422, detail="O arquivo não é a imagem que diz ser")
    avatar = db.get(UserAvatar, user.id) or UserAvatar(user_id=user.id)
    avatar.image, avatar.content_type, avatar.token = image, f"image/{kind}", secrets.token_hex(16)
    avatar.updated_at = datetime.now(timezone.utc)
    db.add(avatar)
    db.commit()
    return Response(status_code=204)


@router.delete("/avatar", status_code=204)
def remove_avatar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Tira a foto de perfil: volta a inicial do nome."""
    avatar = db.get(UserAvatar, user.id)
    if avatar is not None:
        db.delete(avatar)
        db.commit()
    return Response(status_code=204)


@router.delete("", status_code=204)
def delete_my_account(data: DeleteAccountIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Exclui a conta e tudo o que é dela: diário, listas, preferências, eventos e quem a pessoa segue (RFF06).
    Pede a senha atual. Contas de administração não saem por aqui."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Senha incorreta")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Contas de administração não podem ser excluídas por aqui")
    db.delete(user)
    db.commit()
    return Response(status_code=204)


@router.put("/experiments", response_model=UserOut)
def set_experiments(data: ExperimentsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Sair ou voltar para os experimentos (RFF17). Fora deles, a pessoa recebe o recomendador completo e as reações
    dela ficam fora da comparação entre os grupos A e B."""
    user.in_experiments = data.in_experiments
    db.commit()
    db.refresh(user)
    return user


@router.put("/visibility", response_model=UserOut)
def set_visibility(data: VisibilityIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Quem vê os registros (RFF10): "all" (todos), "followers" (quem me segue) ou "private" (só eu). Vale na
    Comunidade, nas resenhas de cada título, no perfil e no "Para ver ou ouvir junto". Seguir não pede aceite, então
    "followers" não é um cadeado: para esconder de todo mundo, use "private"."""
    user.visibility = data.visibility
    db.commit()
    db.refresh(user)
    return user


@router.put("/services", response_model=UserOut)
def set_services(data: ServicesIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Os serviços de streaming que a pessoa assina (RFF21), pelas chaves de `GET /media/services`. Lista vazia
    desmarca todos. Chave desconhecida dá 422."""
    unknown = [key for key in data.services if key not in SERVICES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Serviço desconhecido: {', '.join(unknown)}")
    user.services = [key for key in SERVICES if key in set(data.services)]  # sem repetir, na ordem da lista
    db.commit()
    db.refresh(user)
    return user
