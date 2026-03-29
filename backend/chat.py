from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections grouped by conversation_id."""

    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: str) -> None:
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        self.active_connections[conversation_id].append(websocket)

    def disconnect(self, websocket: WebSocket, conversation_id: str) -> None:
        room = self.active_connections.get(conversation_id, [])
        if websocket in room:
            room.remove(websocket)
        if not room and conversation_id in self.active_connections:
            del self.active_connections[conversation_id]

    async def broadcast(self, message_dict: dict, conversation_id: str) -> None:
        room = self.active_connections.get(conversation_id, [])
        disconnected = []
        for connection in room:
            try:
                await connection.send_json(message_dict)
            except Exception:
                disconnected.append(connection)
        for ws in disconnected:
            self.disconnect(ws, conversation_id)


manager = ConnectionManager()
