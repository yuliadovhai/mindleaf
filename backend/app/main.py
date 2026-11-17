from fastapi import APIRouter, Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    access,
    billing,
    dashboard,
    files,
    health,
    homework,
    internal,
    lessons,
    materials,
    me,
    notifications,
    payments,
    portal,
    quizzes,
    students,
)
from app.auth.dependencies import require_writable
from app.schemas.common import ErrorResponse
from app.services.errors import (
    Conflict,
    Forbidden,
    Invalid,
    NotFound,
    PaymentRequired,
    StudentArchived,
    StudentNotFound,
)
from app.settings import settings

app = FastAPI(
    title="tutor-cabinet API",
    version="0.1.0",
    description="Кабінет репетитора. Усі суми — у копійках, час — Europe/Kyiv.",
)

# Every method a route uses must be here, or the browser blocks it at the preflight.
CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=CORS_METHODS,
        allow_headers=["Authorization", "Content-Type"],
    )


@app.exception_handler(NotFound)
def _not_found(request: Request, exc: NotFound) -> JSONResponse:
    return JSONResponse({"detail": exc.code}, status.HTTP_404_NOT_FOUND)


@app.exception_handler(StudentNotFound)
def _student_not_found(request: Request, exc: StudentNotFound) -> JSONResponse:
    return JSONResponse(
        {"detail": "student_not_found"}, status.HTTP_422_UNPROCESSABLE_ENTITY
    )


@app.exception_handler(StudentArchived)
def _student_archived(request: Request, exc: StudentArchived) -> JSONResponse:
    return JSONResponse({"detail": "student_archived"}, status.HTTP_409_CONFLICT)


@app.exception_handler(Forbidden)
def _forbidden(request: Request, exc: Forbidden) -> JSONResponse:
    return JSONResponse({"detail": "forbidden"}, status.HTTP_403_FORBIDDEN)


@app.exception_handler(Conflict)
def _conflict(request: Request, exc: Conflict) -> JSONResponse:
    return JSONResponse({"detail": exc.code}, status.HTTP_409_CONFLICT)


@app.exception_handler(PaymentRequired)
def _payment_required(request: Request, exc: PaymentRequired) -> JSONResponse:
    return JSONResponse({"detail": exc.code}, status.HTTP_402_PAYMENT_REQUIRED)


@app.exception_handler(Invalid)
def _invalid(request: Request, exc: Invalid) -> JSONResponse:
    return JSONResponse({"detail": exc.code}, status.HTTP_422_UNPROCESSABLE_ENTITY)


UNAUTHORIZED = {401: {"model": ErrorResponse, "description": "Немає валідного токена"}}
FORBIDDEN = {403: {"model": ErrorResponse, "description": "Роль не має доступу"}}
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Немає запису або він чужий"}}

PAYMENT_REQUIRED = {
    402: {
        "model": ErrorResponse,
        "description": "plan_read_only | plan_limit | pro_required (тариф)",
    }
}
COMMON = {**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND}
# Routers where a tutor can change data: blocked while the plan is read-only.
WRITABLE = {
    "responses": {**COMMON, **PAYMENT_REQUIRED},
    "dependencies": [Depends(require_writable)],
}

api = APIRouter(prefix="/api")
api.include_router(health.router)
api.include_router(me.router, responses=UNAUTHORIZED)
api.include_router(students.router, **WRITABLE)
api.include_router(lessons.router, **WRITABLE)
api.include_router(payments.router, **WRITABLE)
api.include_router(access.router, **WRITABLE)
api.include_router(portal.router, responses=COMMON)
api.include_router(homework.router, **WRITABLE)
api.include_router(quizzes.router, **WRITABLE)
api.include_router(materials.router, **WRITABLE)
api.include_router(billing.router, responses=COMMON)
api.include_router(files.router)
api.include_router(internal.router)
api.include_router(internal.generation_router)
api.include_router(internal.billing_router)
api.include_router(notifications.webhook_router)
api.include_router(notifications.internal_router)
api.include_router(dashboard.router, responses={**UNAUTHORIZED, **FORBIDDEN})
app.include_router(api)
