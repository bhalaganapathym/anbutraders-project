# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from api.endpoints import auth, billing, crud, ws, dashboard, storage

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(crud.router, tags=["crud"])
api_router.include_router(ws.router, tags=["websocket"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
