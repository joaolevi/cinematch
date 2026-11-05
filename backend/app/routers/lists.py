"""Gerenciar Listas (inclui a watchlist "Quero ver")."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..auth import get_current_user
from ..db import get_db
from ..models import ListItem, User, UserList
from ..schemas import ListIn, ListItemIn, ListOut

router = APIRouter(prefix="/lists", tags=["listas"])


def _own_list(db: Session, user: User, list_id: int) -> UserList:
    lst = db.get(UserList, list_id)
    if lst is None or lst.user_id != user.id:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    return lst


@router.get("", response_model=list[ListOut])
def my_lists(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    crud.get_or_create_watchlist(db, user)
    db.commit()
    return db.scalars(
        select(UserList)
        .where(UserList.user_id == user.id)
        .order_by(UserList.is_watchlist.desc(), UserList.created_at)
    ).all()


@router.post("", response_model=ListOut, status_code=201)
def create_list(data: ListIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lst = UserList(user_id=user.id, name=data.name.strip())
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return lst


@router.get("/{list_id}", response_model=ListOut)
def get_list(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _own_list(db, user, list_id)


@router.patch("/{list_id}", response_model=ListOut)
def rename_list(
    list_id: int, data: ListIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    lst = _own_list(db, user, list_id)
    if lst.is_watchlist:
        raise HTTPException(status_code=400, detail="A watchlist não pode ser renomeada")
    lst.name = data.name.strip()
    db.commit()
    db.refresh(lst)
    return lst


@router.delete("/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lst = _own_list(db, user, list_id)
    if lst.is_watchlist:
        raise HTTPException(status_code=400, detail="A watchlist não pode ser excluída")
    db.delete(lst)
    db.commit()
    return Response(status_code=204)


@router.post("/{list_id}/items", response_model=ListOut, status_code=201)
def add_item(
    list_id: int,
    data: ListItemIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lst = _own_list(db, user, list_id)
    crud.get_media_or_404(db, data.media_id)
    crud.add_to_list(db, lst, data.media_id)
    db.commit()
    db.refresh(lst)
    return lst


@router.delete("/{list_id}/items/{media_id}", status_code=204)
def remove_item(
    list_id: int, media_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    lst = _own_list(db, user, list_id)
    item = db.scalar(select(ListItem).where(ListItem.list_id == lst.id, ListItem.media_id == media_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item não está na lista")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
