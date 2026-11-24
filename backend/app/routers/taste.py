"""Ver e corrigir o próprio perfil de gosto (RFF07) e dar retorno sobre uma sugestão (RFF08)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import TasteAdjustment, User
from ..schemas import AdjustmentIn, TasteProfileOut
from ..services import adjustments
from ..services.taste_profile import taste_profile

router = APIRouter(prefix="/me/taste", tags=["gosto"])


@router.get("", response_model=TasteProfileOut)
def my_taste(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """O que o Tastory acha do gosto da pessoa: quanto pesam os gêneros, as décadas, as pessoas e os climas, os
    títulos que mais pesam e os registros fora do cálculo, com os ajustes que ela já fez."""
    return taste_profile(db, user.id)


@router.put("/adjustments", status_code=204)
def adjust(data: AdjustmentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Pede mais (1,5) ou menos (0,5) de um gênero, década, pessoa, clima ou título, ou tira do cálculo (0). Peso 1
    volta ao normal. O "Não por esse motivo" do feed (RFF08) manda o `because` da sugestão com peso 0,5."""
    adjustments.save(db, user.id, data.kind, data.value, data.weight)
    return Response(status_code=204)


@router.delete("/adjustments", status_code=204)
def reset(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Desfaz todos os ajustes."""
    db.execute(delete(TasteAdjustment).where(TasteAdjustment.user_id == user.id))
    db.commit()
    return Response(status_code=204)
