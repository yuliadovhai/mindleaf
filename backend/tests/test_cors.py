from fastapi.routing import APIRoute

from app.main import CORS_METHODS, app


def test_cors_allows_every_method_the_api_uses():
    # A missing method only shows in a browser: the preflight fails and fetch()
    # reports "Failed to fetch". Handing in homework (PUT) broke exactly so.
    routes = [r for r in app.routes if isinstance(r, APIRoute)]
    used = {m for r in routes for m in r.methods} - {"HEAD"}

    assert used <= set(CORS_METHODS), sorted(used - set(CORS_METHODS))
