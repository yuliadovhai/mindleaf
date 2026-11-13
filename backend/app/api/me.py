from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_tutor
from app.models import Tutor
from app.schemas.tutor import TutorOut

router = APIRouter(tags=["me"])


@router.get("/me", response_model=TutorOut)
def read_me(tutor: Tutor = Depends(get_current_tutor)) -> Tutor:
    """The signed-in tutor; the row is created on the first authenticated call."""
    return tutor
