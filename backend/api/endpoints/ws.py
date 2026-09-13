from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.websocket import manager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client heartbeat ping to keep Render / proxy connection alive
            if data and ("ping" in data):
                await websocket.send_text('{"type":"pong"}')
    except (WebSocketDisconnect, Exception):
        manager.disconnect(websocket)
