"""Pacote Acesso do DCU: Cadastrar Conta, Fazer Login, Definir Preferências Iniciais."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import create_token, get_current_user, hash_password, verify_password
from ..db import get_db
from ..models import User, UserInterest, UserPreference
from ..services import login_guard
from ..schemas import LoginIn, PreferencesIn, PreferencesOut, RegisterIn, TokenOut, UserOut

router = APIRouter(tags=["acesso"])


@router.post("/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    # Teste A/B: alterna os grupos conforme a ordem de cadastro
    n_users = db.scalar(select(func.count()).select_from(User)) or 0
    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        ab_group="A" if n_users % 2 == 0 else "B",
        in_experiments=data.in_experiments,  # consentimento dado no cadastro (RNFF08)
    )
    db.add(user)
    db.flush()
    crud.get_or_create_watchlist(db, user)
    db.commit()
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=TokenOut, responses={429: {"description": "Tentativas demais; veja Retry-After"}})
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Entrar. Depois de 5 senhas erradas para o mesmo e-mail em 15 minutos, responde 429 até liberar (RNFF05)."""
    email = data.email.lower()
    address = request.client.host if request.client else "desconhecido"
    wait = login_guard.wait_seconds(email, address)
    if wait:
        minutes = max(1, round(wait / 60))
        raise HTTPException(
            status_code=429,
            detail=f"Muitas tentativas. Tente de novo em {minutes} {'minuto' if minutes == 1 else 'minutos'}.",
            headers={"Retry-After": str(wait)},
        )
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(data.password, user.password_hash):
        login_guard.failed(email, address)
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    login_guard.succeeded(email)
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/me/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    genres = list(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user.id)))
    interests = db.execute(
        select(UserInterest.kind, UserInterest.value).where(UserInterest.user_id == user.id)
    ).all()
    return PreferencesOut(
        genres=genres,
        decades=sorted(int(value) for kind, value in interests if kind == "decade"),
        creators=[value for kind, value in interests if kind == "creator"],
        artists=[value for kind, value in interests if kind == "artist"],
        onboarded=user.onboarded,
    )


@router.put("/me/preferences", response_model=PreferencesOut)
def set_preferences(
    data: PreferencesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Onboarding: gêneros (de filme e de música), décadas, criadores, artistas e títulos que a pessoa já curte (viram
    registros no diário)."""
    for pref in list(user.preferences):
        db.delete(pref)
    for interest in db.scalars(select(UserInterest).where(UserInterest.user_id == user.id)):
        db.delete(interest)
    db.flush()
    for genre in dict.fromkeys(g.strip() for g in data.genres if g.strip()):
        db.add(UserPreference(user_id=user.id, genre=genre))
    for decade in dict.fromkeys(data.decades):
        db.add(UserInterest(user_id=user.id, kind="decade", value=str(decade)))
    for creator in dict.fromkeys(c.strip() for c in data.creators if c.strip()):
        db.add(UserInterest(user_id=user.id, kind="creator", value=creator))
    for artist in dict.fromkeys(a.strip() for a in data.artists if a.strip()):
        db.add(UserInterest(user_id=user.id, kind="artist", value=artist))
    for media_id in data.liked_media_ids:
        crud.get_media_or_404(db, media_id)
        crud.add_onboarding_like(db, user, media_id)
    user.onboarded = True
    db.commit()
    return get_preferences(user, db)
