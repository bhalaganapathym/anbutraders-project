import json
from typing import List, Dict, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Store active connections
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """
        Broadcast a JSON message to all connected clients.
        Example: {"event": "postgres_changes", "table": "customers"}
        """
        text_data = json.dumps(message)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception:
                disconnected.append(connection)
        
        # Cleanup disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()
