from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check. Never touches the database, so it does not wake Aurora."""
    return {"status": "ok"}
