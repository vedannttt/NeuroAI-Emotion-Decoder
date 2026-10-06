"""Request correlation, latency, and safe error logging middleware."""
from uuid import uuid4
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.logging import Timer, log_event

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get('x-request-id', str(uuid4()))
        timer = Timer()
        try:
            response = await call_next(request)
        except Exception as exc:
            log_event('request_error', request_id=request_id, method=request.method, path=request.url.path, error=type(exc).__name__, duration_ms=timer.milliseconds)
            raise
        response.headers['X-Request-ID'] = request_id
        log_event('request_complete', request_id=request_id, method=request.method, path=request.url.path, status=response.status_code, duration_ms=timer.milliseconds)
        return response
