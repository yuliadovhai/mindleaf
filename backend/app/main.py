from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health, me, students
from app.schemas.common import ErrorResponse
from app.services.errors import NotFound, StudentArchived, StudentNotFound
from app.settings import settings

app = FastAPI(
    title="tutor-cabinet API",
    version="0.1.0",
    description="Кабінет репетитора. Усі суми — у копійках, час — Europe/Kyiv.",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.exception_handler(NotFound)
def _not_found(request: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse({"detail": "not found"}, status.HTTP_404_NOT_FOUND)


@app.exception_handler(StudentNotFound)
def _student_not_found(request: Request, exc: StudentNotFound) -> JSONResponse:
    return JSONResponse(
        {"detail": "student_not_found"}, status.HTTP_422_UNPROCESSABLE_ENTITY
    )


@app.exception_handler(StudentArchived)
def _student_archived(request: Request, exc: StudentArchived) -> JSONResponse:
    return JSONResponse({"detail": "student_archived"}, status.HTTP_409_CONFLICT)


UNAUTHORIZED = {401: {"model": ErrorResponse, "description": "Немає валідного токена"}}
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Немає запису або він чужий"}}

api = APIRouter(prefix="/api")
api.include_router(health.router)
api.include_router(me.router, responses=UNAUTHORIZED)
api.include_router(students.router, responses={**UNAUTHORIZED, **NOT_FOUND})
app.include_router(api)
