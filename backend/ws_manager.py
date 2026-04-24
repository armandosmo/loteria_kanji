"""ConnectionManager — salas WebSocket por partida."""

from __future__ import annotations

import json
from typing import Dict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # {partida_id: {jugador_id: WebSocket}}
        self.rooms: Dict[int, Dict[int, WebSocket]] = {}

    async def connect(self, partida_id: int, jugador_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms.setdefault(partida_id, {})[jugador_id] = ws

    def disconnect(self, partida_id: int, jugador_id: int) -> None:
        room = self.rooms.get(partida_id)
        if room:
            room.pop(jugador_id, None)
            if not room:
                self.rooms.pop(partida_id, None)

    async def broadcast(self, partida_id: int, msg: dict) -> None:
        room = self.rooms.get(partida_id, {})
        data = json.dumps(msg, ensure_ascii=False)
        for ws in list(room.values()):
            try:
                await ws.send_text(data)
            except Exception:
                pass

    async def send_private(
        self, partida_id: int, jugador_id: int, msg: dict
    ) -> None:
        room = self.rooms.get(partida_id, {})
        ws = room.get(jugador_id)
        if ws is None:
            return
        try:
            await ws.send_text(json.dumps(msg, ensure_ascii=False))
        except Exception:
            pass
