"""Pacote Acesso do DCU: Cadastrar Conta, Fazer Login, Definir Preferências Iniciais."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import create_token, get_current_user, hash_password, verify_password
from ..db import get_db
from ..models import User, UserPreference
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
    )
    db.add(user)
    db.flush()
    crud.get_or_create_watchlist(db, user)
    db.commit()
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/me/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    genres = list(db.scalars(select(UserPreference.genre).where(UserPreference.user_id == user.id)))
    return PreferencesOut(genres=genres, onboarded=user.onboarded)


@router.put("/me/preferences", response_model=PreferencesOut)
def set_preferences(
    data: PreferencesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Onboarding: gêneros favoritos + títulos que o usuário já gosta (viram registros no diário)."""
    for pref in list(user.preferences):
        db.delete(pref)
    db.flush()
    for genre in dict.fromkeys(g.strip() for g in data.genres if g.strip()):
        db.add(UserPreference(user_id=user.id, genre=genre))
    for media_id in data.liked_media_ids:
        crud.get_media_or_404(db, media_id)
        crud.add_onboarding_like(db, user, media_id)
    user.onboarded = True
    db.commit()
    return get_preferences(user, db)
