from typing import Callable
from fastapi import FastAPI, Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from backend.config.auth import user_exists, SECRET_KEY, ALGORITHM
import jwt
from datetime import datetime

class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: FastAPI,
        public_paths: list = None,
    ):
        super().__init__(app)
        self.public_paths = public_paths or [
            "/api/auth/token",
            "/api/auth/refresh",
            "/api/auth/signup",
            "/api/auth/check-user-exists",
            "/health",
            "/static",
            # Add SSE stream endpoints to public paths as EventSource doesn't support Authorization headers
            "/api/docker-manager/containers/status-stream",
            "/api/dashboard/monitoring/metrics-stream",
            "/api/takserver/server-status-stream",
            "/api/takserver/install-status-stream",
            "/api/takserver/uninstall-status-stream",
            "/api/takserver-api/connected-clients-stream",
            "/api/ota/status-stream",
            "/api/advanced/takserver/logs/"
        ]

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Check if path is in public paths
        path = request.url.path
        
        # Allow static files and public paths
        if any(path.startswith(public_path) for public_path in self.public_paths):
            return await call_next(request)
            
        # Allow all paths if no user exists yet
        if not user_exists():
            return await call_next(request)
            
        # Validate JWT token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Verify token type (must be access token)
            token_type = payload.get("type")
            if token_type != "access":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            # Check token expiration time
            exp = payload.get("exp")
            if not exp or datetime.utcnow().timestamp() > exp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication credentials: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return await call_next(request) 