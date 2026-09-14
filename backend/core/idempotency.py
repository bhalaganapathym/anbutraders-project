import time
from typing import Dict, Any, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

class IdempotencyRecord:
    def __init__(self, status_code: int, body: bytes, media_type: Optional[str], headers: Dict[str, str], timestamp: float):
        self.status_code = status_code
        self.body = body
        self.media_type = media_type
        self.headers = headers
        self.timestamp = timestamp

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Lightweight In-Memory Idempotency Middleware for Render Free Tier.
    Prevents duplicate creation of orders, bills, and payments during network retries.
    Uses < 1MB RAM (strictly capped at 500 entries with a 10-minute TTL).
    """
    def __init__(self, app, max_entries: int = 500, ttl_seconds: int = 600):
        super().__init__(app)
        self.cache: Dict[str, IdempotencyRecord] = {}
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds

    def _cleanup_expired(self):
        now = time.time()
        # Remove expired records
        expired_keys = [k for k, v in self.cache.items() if now - v.timestamp > self.ttl_seconds]
        for k in expired_keys:
            self.cache.pop(k, None)

        # If still over max capacity, drop oldest
        if len(self.cache) > self.max_entries:
            sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k].timestamp)
            for k in sorted_keys[: len(self.cache) - self.max_entries]:
                self.cache.pop(k, None)

    async def dispatch(self, request: Request, call_next):
        # Only check mutating methods
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("idempotency-key") or request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        # Clean up cache occasionally
        self._cleanup_expired()

        now = time.time()
        record = self.cache.get(idempotency_key)
        if record and (now - record.timestamp <= self.ttl_seconds):
            # Return cached response directly without re-executing business logic
            headers = dict(record.headers)
            headers["x-idempotent-replay"] = "true"
            return StarletteResponse(
                content=record.body,
                status_code=record.status_code,
                media_type=record.media_type,
                headers=headers
            )

        # Execute downstream request
        response = await call_next(request)

        # Only cache successful or client-accepted responses (2xx / 3xx)
        if 200 <= response.status_code < 400:
            # Read full response body
            body_chunks = []
            async for chunk in response.body_iterator:
                if isinstance(chunk, bytes):
                    body_chunks.append(chunk)
                else:
                    body_chunks.append(chunk.encode("utf-8"))
            full_body = b"".join(body_chunks)

            # Store in cache
            headers = dict(response.headers)
            # Remove content-length as StarletteResponse computes it
            headers.pop("content-length", None)
            
            self.cache[idempotency_key] = IdempotencyRecord(
                status_code=response.status_code,
                body=full_body,
                media_type=response.media_type,
                headers=headers,
                timestamp=time.time()
            )

            return StarletteResponse(
                content=full_body,
                status_code=response.status_code,
                media_type=response.media_type,
                headers=headers
            )

        return response
