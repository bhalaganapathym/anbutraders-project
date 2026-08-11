# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from api.endpoints import auth, billing, crud, ws, dashboard, storage, drivers, bills, settings

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(crud.router, tags=["crud"])
api_router.include_router(ws.router, tags=["websocket"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
api_router.include_router(bills.router, prefix="/bills", tags=["bills"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
