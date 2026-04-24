"""Nihongo Lotería — FastAPI backend."""

from __future__ import annotations

import asyncio
import json
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Optional

# Una partida en lobby se considera huérfana tras este tiempo sin actividad
LOBBY_TTL = timedelta(minutes=10)

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from game import calcular_seed_apodo, generar_tabla, seleccionar_mazo, validar_loteria
from models import (
    CartaCantada,
    Ganador,
    Jugador,
    Kanji,
    Partida,
    create_all,
    engine,
    get_db,
)
from ws_manager import ConnectionManager

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Nihongo Lotería")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringir en prod a IP del servidor
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

# Timestamps de desconexión: {partida_id: {jugador_id: datetime}}
_desconexiones: dict[int, dict[int, datetime]] = {}


@app.on_event("startup")
def on_startup() -> None:
    create_all()


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class UnirseBody(BaseModel):
    apodo: str


class IniciarBody(BaseModel):
    griton_id: int
    tamano_tabla: int = 4
    patron_victoria: str = "full"
    modo_aprendizaje: bool = False


class CantarBody(BaseModel):
    griton_id: int
    kanji_id: Optional[int] = None


class JugadorBody(BaseModel):
    jugador_id: int


class LoteriaBody(BaseModel):
    jugador_id: int
    marcadas: list[bool]


class FinalizarBody(BaseModel):
    griton_id: int


class ContinuarBody(BaseModel):
    griton_id: int
    nuevo_patron: Optional[str] = None  # None = mantener actual; "full"/"line"/etc. = cambiar


class ConfigBody(BaseModel):
    griton_token: str
    tamano_tabla: int = 4
    patron_victoria: str = "full"
    modo_aprendizaje: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_partida(partida_id: int, db: Session) -> Partida:
    partida = db.get(Partida, partida_id)
    if not partida:
        raise HTTPException(404, "Partida no encontrada")
    return partida


def _assert_griton(jugador: Jugador | None) -> None:
    if not jugador or not jugador.es_griton:
        raise HTTPException(403, "Solo el Gritón puede realizar esta acción")


# ---------------------------------------------------------------------------
# REST — Health
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# DEV — reset de la base (no funcional en producción)
# ---------------------------------------------------------------------------


@app.delete("/api/dev/reset")
def dev_reset(db: Session = Depends(get_db)):
    if os.getenv("ENV", "development") == "production":
        raise HTTPException(403, "Endpoint deshabilitado en producción")

    partidas = db.exec(select(Partida)).all()
    n = len(partidas)

    # Eliminar respetando FKs: Ganador → CartaCantada → Jugador → Partida
    for ganador in db.exec(select(Ganador)).all():
        db.delete(ganador)
    for carta in db.exec(select(CartaCantada)).all():
        db.delete(carta)
    for jugador in db.exec(select(Jugador)).all():
        db.delete(jugador)
    for partida in partidas:
        db.delete(partida)
    db.commit()

    # Limpiar también el estado en memoria
    _desconexiones.clear()
    manager.rooms.clear()

    return {"ok": True, "partidas_eliminadas": n}


# ---------------------------------------------------------------------------
# REST — /api/partidas
# ---------------------------------------------------------------------------


@app.get("/api/partidas/disponibles")
def partidas_disponibles(db: Session = Depends(get_db)):
    """Lista partidas en estado 'lobby' (máximo 5 más recientes)."""
    cutoff = datetime.now() - LOBBY_TTL
    partidas = db.exec(
        select(Partida)
        .where(Partida.estado == "lobby", Partida.fecha >= cutoff)
        .order_by(Partida.fecha.desc())  # type: ignore[union-attr]
        .limit(5)
    ).all()

    resultado = []
    for p in partidas:
        # Solo contar jugadores no-Gritón (el Gritón es un Jugador interno
        # con apodo "親" que no juega).
        jugadores_count = len(
            db.exec(
                select(Jugador).where(
                    Jugador.partida_id == p.id,
                    Jugador.es_griton == False,  # noqa: E712
                )
            ).all()
        )
        resultado.append({
            "partida_id": p.id,
            "jugadores_count": jugadores_count,
            "tamano_tabla": p.tamano_tabla,
        })
    return resultado


@app.post("/api/partidas")
def crear_partida(db: Session = Depends(get_db)):
    # Solo una partida activa en estado 'lobby' a la vez.
    # Una lobby se considera huérfana si:
    #   (a) lleva más de LOBBY_TTL sin actividad, o
    #   (b) su Gritón no está conectado por WebSocket en este momento.
    # En esos casos se cierra automáticamente y se libera el slot.
    existente = db.exec(
        select(Partida).where(Partida.estado == "lobby")
    ).first()
    if existente:
        griton_conectado = (
            existente.griton_id is not None
            and existente.griton_id
            in manager.rooms.get(existente.id or -1, {})
        )
        ttl_vencido = datetime.now() - existente.fecha > LOBBY_TTL
        if not griton_conectado or ttl_vencido:
            existente.estado = "terminada"
            db.add(existente)
            db.commit()
            manager.rooms.pop(existente.id or -1, None)
        else:
            raise HTTPException(
                409,
                "Ya hay una partida en lobby. Únete a ella o espera a que termine.",
            )

    partida = Partida()
    partida.griton_token = uuid.uuid4().hex[:8]
    db.add(partida)
    db.commit()
    db.refresh(partida)

    # Crear el Jugador-Gritón automáticamente, con apodo genérico "親".
    # No se le pide nombre al Gritón; se identifica por griton_token.
    griton = Jugador(
        apodo="親",
        partida_id=partida.id,
        es_griton=True,
    )
    db.add(griton)
    db.commit()
    db.refresh(griton)

    partida.griton_id = griton.id
    db.add(partida)
    db.commit()

    return {
        "partida_id": partida.id,
        "jugador_id": griton.id,
        "griton_token": partida.griton_token,
    }


@app.post("/api/partidas/{partida_id}/unirse")
def unirse(partida_id: int, body: UnirseBody, db: Session = Depends(get_db)):
    partida = _get_partida(partida_id, db)

    if partida.estado != "lobby":
        raise HTTPException(409, "La partida no está en lobby")

    jugadores = db.exec(
        select(Jugador).where(Jugador.partida_id == partida_id)
    ).all()

    # Contar solo jugadores no-gritón contra el límite de 15.
    no_griton = [j for j in jugadores if not j.es_griton]
    if len(no_griton) >= 15:
        raise HTTPException(409, "Sala llena")

    # El Gritón se crea automáticamente al crear la partida; nadie más lo es.
    jugador = Jugador(
        apodo=body.apodo,
        partida_id=partida_id,
        es_griton=False,
    )
    db.add(jugador)
    db.commit()
    db.refresh(jugador)

    return {
        "jugador_id": jugador.id,
        "seed_apodo": calcular_seed_apodo(jugador.apodo),
    }


@app.post("/api/partidas/{partida_id}/config")
async def actualizar_config(
    partida_id: int, body: ConfigBody, db: Session = Depends(get_db)
):
    """El Gritón actualiza la configuración en lobby y la difunde a jugadores."""
    partida = _get_partida(partida_id, db)

    if partida.estado != "lobby":
        raise HTTPException(400, "Solo se puede cambiar la configuración en lobby")

    if partida.griton_token != body.griton_token:
        raise HTTPException(403, "Token inválido")

    partida.tamano_tabla = body.tamano_tabla
    partida.patron_victoria = body.patron_victoria
    partida.modo_aprendizaje = body.modo_aprendizaje
    db.add(partida)
    db.commit()

    await manager.broadcast(partida_id, {
        "tipo": "config_actualizada",
        "tamano_tabla": body.tamano_tabla,
        "patron_victoria": body.patron_victoria,
        "modo_aprendizaje": body.modo_aprendizaje,
    })

    return {"ok": True}


@app.post("/api/partidas/{partida_id}/iniciar")
async def iniciar(partida_id: int, body: IniciarBody, db: Session = Depends(get_db)):
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, body.griton_id)
    _assert_griton(griton)

    if partida.estado != "lobby":
        raise HTTPException(400, "La partida ya fue iniciada")

    jugadores = db.exec(
        select(Jugador).where(
            Jugador.partida_id == partida_id, Jugador.es_griton == False  # noqa: E712
        )
    ).all()

    if len(jugadores) < 1:
        raise HTTPException(400, "Se necesita al menos 1 jugador no-gritón")

    # Seleccionar mazo
    todos_kanjis = db.exec(select(Kanji)).all()
    if len(todos_kanjis) < 54:
        raise HTTPException(
            400,
            "No hay suficientes kanjis cargados. Ejecuta seed.py primero.",
        )
    mazo = seleccionar_mazo(todos_kanjis)

    # Configurar partida
    tamano = body.tamano_tabla
    partida.tamano_tabla = tamano
    partida.patron_victoria = body.patron_victoria
    partida.modo_aprendizaje = body.modo_aprendizaje
    partida.estado = "activa"
    partida.mazo_json = json.dumps([k.id for k in mazo])
    db.add(partida)

    # Generar tabla para cada jugador no-gritón
    for j in jugadores:
        tabla = generar_tabla(mazo, tamano=tamano)
        j.carton_json = json.dumps(tabla)
        j.marcadas_json = json.dumps([False] * len(tabla))
        db.add(j)

    db.commit()

    # Cantar primera carta automáticamente para que el Gritón
    # vea contenido en la main card al entrar a /game/caller.
    primera_kanji = random.choice(mazo)
    primera_carta_db = CartaCantada(
        partida_id=partida_id,
        kanji_id=primera_kanji.id,
        orden=1,
    )
    db.add(primera_carta_db)
    db.commit()

    primera_carta_payload = {
        "kanji_id": primera_kanji.id,
        "caracter": primera_kanji.caracter,
        "orden": 1,
    }

    # Broadcast game_started + cartón privado a cada jugador
    await manager.broadcast(partida_id, {
        "tipo": "game_started",
        "tamano_tabla": tamano,
        "patron_victoria": body.patron_victoria,
        "modo_aprendizaje": body.modo_aprendizaje,
        "primera_carta": primera_carta_payload,
    })

    for j in jugadores:
        ids: list[int] = json.loads(j.carton_json)
        seed = calcular_seed_apodo(j.apodo)
        carton_full = []
        for idx, kid in enumerate(ids):
            kanji = db.get(Kanji, kid)
            celda = {
                "kanji_id": kid,
                "caracter": kanji.caracter if kanji else "?",
                "colorIndex": ((idx + seed) % 5) + 1,
            }
            if body.modo_aprendizaje and kanji:
                celda["lectura_kun"] = kanji.lectura_kun
                celda["lectura_on"] = kanji.lectura_on
                celda["significado"] = kanji.significado_es
            carton_full.append(celda)
        await manager.send_private(partida_id, j.id, {
            "tipo": "tu_carton",
            "carton": carton_full,
            "tamano_tabla": tamano,
            "modo_aprendizaje": body.modo_aprendizaje,
        })

    # carta_info privada al Gritón con la primera carta
    await manager.send_private(partida_id, body.griton_id, {
        "tipo": "carta_info",
        "lectura_kun": primera_kanji.lectura_kun,
        "lectura_on": primera_kanji.lectura_on,
        "significado_es": primera_kanji.significado_es,
    })

    return {"ok": True}


@app.post("/api/partidas/{partida_id}/cantar")
async def cantar(partida_id: int, body: CantarBody, db: Session = Depends(get_db)):
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, body.griton_id)
    _assert_griton(griton)

    if partida.estado != "activa":
        raise HTTPException(400, "La partida no está activa")

    # Cooldown 2 s
    ultima = db.exec(
        select(CartaCantada)
        .where(CartaCantada.partida_id == partida_id)
        .order_by(CartaCantada.orden.desc())  # type: ignore[union-attr]
    ).first()

    if ultima and (datetime.now() - ultima.timestamp) < timedelta(seconds=2):
        raise HTTPException(429, "Espera 2 segundos entre cartas")

    orden = (ultima.orden + 1) if ultima else 1

    # Si no se especifica kanji_id, elegir aleatoriamente del mazo restante
    kanji_id = body.kanji_id
    if kanji_id is None:
        mazo_ids: list[int] = json.loads(partida.mazo_json or "[]")
        if not mazo_ids:
            raise HTTPException(400, "El mazo no fue inicializado en esta partida")
        cantadas_prev = db.exec(
            select(CartaCantada).where(CartaCantada.partida_id == partida_id)
        ).all()
        cantados_ids = {c.kanji_id for c in cantadas_prev}
        restantes = [kid for kid in mazo_ids if kid not in cantados_ids]
        if not restantes:
            raise HTTPException(400, "El mazo está agotado")
        kanji_id = random.choice(restantes)

    carta = CartaCantada(
        partida_id=partida_id,
        kanji_id=kanji_id,
        orden=orden,
    )
    db.add(carta)
    db.commit()

    kanji = db.get(Kanji, kanji_id)
    if not kanji:
        raise HTTPException(404, "Kanji no encontrado")

    # Broadcast carta_siguiente a todos
    await manager.broadcast(partida_id, {
        "tipo": "carta_siguiente",
        "orden": orden,
        "kanji_id": kanji.id,
        "caracter": kanji.caracter,
    })

    # Envío privado carta_info SOLO al gritón
    await manager.send_private(partida_id, body.griton_id, {
        "tipo": "carta_info",
        "lectura_kun": kanji.lectura_kun,
        "lectura_on": kanji.lectura_on,
        "significado_es": kanji.significado_es,
    })

    return {"ok": True, "orden": orden}


@app.post("/api/partidas/{partida_id}/loteria")
async def loteria(partida_id: int, body: LoteriaBody, db: Session = Depends(get_db)):
    partida = _get_partida(partida_id, db)

    if partida.estado != "activa":
        raise HTTPException(400, "La partida no está activa")

    jugador = db.get(Jugador, body.jugador_id)
    if not jugador or jugador.partida_id != partida_id:
        raise HTTPException(404, "Jugador no encontrado en esta partida")

    # Notificar de inmediato a todos que alguien solicitó ¡Lotería!
    await manager.broadcast(partida_id, {
        "tipo": "loteria_solicitada",
        "jugador_apodo": jugador.apodo,
    })

    carton: list[int] = json.loads(jugador.carton_json)

    if len(body.marcadas) != len(carton):
        raise HTTPException(
            400,
            f"marcadas debe tener {len(carton)} elementos, se recibieron {len(body.marcadas)}",
        )

    # Persistir el estado de marcadas recibido del cliente
    jugador.marcadas_json = json.dumps(body.marcadas)
    db.add(jugador)
    db.commit()

    marcadas: list[bool] = body.marcadas

    cantadas = db.exec(
        select(CartaCantada).where(CartaCantada.partida_id == partida_id)
    ).all()
    cantados_ids = {c.kanji_id for c in cantadas}

    valido = validar_loteria(
        carton, marcadas, cantados_ids, partida.patron_victoria, partida.tamano_tabla
    )

    ganador = Ganador(
        partida_id=partida_id,
        jugador_id=body.jugador_id,
        valido=valido,
    )
    db.add(ganador)

    if valido:
        partida.estado = "terminada"
        db.add(partida)
        db.commit()
        await manager.broadcast(partida_id, {
            "tipo": "partida_terminada",
            "ganador_id": jugador.id,
            "ganador_apodo": jugador.apodo,
            "patron": partida.patron_victoria,
            "sin_ganador": False,
            "fin_definitivo": False,
        })
    else:
        db.commit()
        await manager.broadcast(partida_id, {
            "tipo": "loteria_rechazada",
            "jugador_apodo": jugador.apodo,
        })

    return {"valido": valido}


@app.post("/api/partidas/{partida_id}/tomar-mazo")
async def tomar_mazo(
    partida_id: int, body: JugadorBody, db: Session = Depends(get_db)
):
    partida = _get_partida(partida_id, db)

    if partida.estado != "activa":
        raise HTTPException(400, "La partida no está activa")

    if not partida.griton_id:
        raise HTTPException(400, "No hay gritón asignado")

    # Verificar que el gritón lleva >60 s desconectado
    ts_desc = _desconexiones.get(partida_id, {}).get(partida.griton_id)
    if not ts_desc or (datetime.now() - ts_desc) < timedelta(seconds=60):
        raise HTTPException(400, "El gritón aún está conectado o no lleva 60 s fuera")

    nuevo = db.get(Jugador, body.jugador_id)
    if not nuevo or nuevo.partida_id != partida_id:
        raise HTTPException(404, "Jugador no encontrado en esta partida")

    # Quitar rol al gritón anterior
    viejo = db.get(Jugador, partida.griton_id)
    if viejo:
        viejo.es_griton = False
        db.add(viejo)

    nuevo.es_griton = True
    # Bug #8: el nuevo Gritón no debe conservar su tabla ni sus marcadas anteriores.
    nuevo.carton_json = "[]"
    nuevo.marcadas_json = "[]"
    partida.griton_id = nuevo.id
    db.add(nuevo)
    db.add(partida)
    db.commit()

    await manager.broadcast(partida_id, {
        "tipo": "nuevo_griton",
        "jugador_id": nuevo.id,
        "jugador_apodo": nuevo.apodo,
    })

    return {"ok": True, "nuevo_griton_id": nuevo.id}


@app.post("/api/partidas/{partida_id}/finalizar")
async def finalizar(partida_id: int, body: FinalizarBody, db: Session = Depends(get_db)):
    """El Gritón finaliza la partida sin ganador (mazo agotado)."""
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, body.griton_id)
    _assert_griton(griton)

    if partida.estado not in ("activa", "terminada"):
        raise HTTPException(400, "La partida no se puede finalizar en su estado actual")

    partida.estado = "terminada"
    db.add(partida)
    db.commit()

    await manager.broadcast(partida_id, {
        "tipo": "partida_terminada",
        "ganador_id": None,
        "ganador_apodo": None,
        "sin_ganador": True,
        "fin_definitivo": True,
    })

    return {"ok": True}


_PATRON_LABEL = {
    "full": "tabla completa",
    "line": "línea",
    "diagonal": "diagonal",
    "corners": "esquinas",
}


@app.post("/api/partidas/{partida_id}/continuar")
async def continuar(
    partida_id: int, body: ContinuarBody, db: Session = Depends(get_db)
):
    """El Gritón decide continuar la partida tras una victoria.
    Mantiene cartones y marcadas; opcionalmente cambia el patrón."""
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, body.griton_id)
    _assert_griton(griton)
    if griton.partida_id != partida_id:
        raise HTTPException(403, "Gritón no pertenece a esta partida")

    if partida.estado != "terminada":
        raise HTTPException(400, "Solo se puede continuar una partida terminada")

    if body.nuevo_patron is not None:
        if body.nuevo_patron not in _PATRON_LABEL:
            raise HTTPException(400, "Patrón inválido")
        partida.patron_victoria = body.nuevo_patron

    partida.estado = "activa"
    db.add(partida)
    db.commit()

    patron_efectivo = partida.patron_victoria
    await manager.broadcast(partida_id, {
        "tipo": "partida_continuada",
        "nuevo_patron": patron_efectivo,
        "patron_label": _PATRON_LABEL.get(patron_efectivo, patron_efectivo),
    })

    return {"ok": True, "patron": patron_efectivo}


@app.get("/api/partidas/{partida_id}/estado")
def estado(
    partida_id: int,
    jugador_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, partida.griton_id) if partida.griton_id else None

    cantadas_rows = db.exec(
        select(CartaCantada)
        .where(CartaCantada.partida_id == partida_id)
        .order_by(CartaCantada.orden.asc())  # type: ignore[union-attr]
    ).all()
    cantadas_count = len(cantadas_rows)
    cantadas_lista = []
    for c in cantadas_rows:
        k = db.get(Kanji, c.kanji_id)
        cantadas_lista.append({
            "kanji_id": c.kanji_id,
            "caracter": k.caracter if k else "?",
            "orden": c.orden,
        })

    todos_jugadores = db.exec(
        select(Jugador).where(Jugador.partida_id == partida_id)
    ).all()
    conectados_room = manager.rooms.get(partida_id, {})
    jugadores_resp = [
        {
            "jugador_id": jx.id,
            "apodo": jx.apodo,
            "es_griton": jx.es_griton,
            "connected": jx.id in conectados_room,
        }
        for jx in todos_jugadores
    ]

    resp: dict = {
        "estado": partida.estado,
        "griton_apodo": griton.apodo if griton else None,
        "cartas_cantadas_count": cantadas_count,
        "cartas_cantadas": cantadas_lista,
        "tamano_tabla": partida.tamano_tabla,
        "patron_victoria": partida.patron_victoria,
        "modo_aprendizaje": partida.modo_aprendizaje,
        "jugadores": jugadores_resp,
    }

    if jugador_id:
        jugador = db.get(Jugador, jugador_id)
        if jugador and jugador.partida_id == partida_id:
            ids: list[int] = json.loads(jugador.carton_json)
            seed = calcular_seed_apodo(jugador.apodo)
            carton_full = []
            for idx, kid in enumerate(ids):
                kanji = db.get(Kanji, kid)
                carton_full.append({
                    "kanji_id": kid,
                    "caracter": kanji.caracter if kanji else "?",
                    "lectura_kun": kanji.lectura_kun if kanji else "",
                    "lectura_on": kanji.lectura_on if kanji else "",
                    "significado_es": kanji.significado_es if kanji else "",
                    "colorIndex": ((idx + seed) % 5) + 1,
                })
            resp["mi_carton"] = carton_full
            resp["mis_marcadas"] = json.loads(jugador.marcadas_json)

    return resp


@app.get("/api/partidas/{partida_id}/ultima-carta-info")
def ultima_carta_info(
    partida_id: int,
    griton_id: int,
    db: Session = Depends(get_db),
):
    """Devuelve lecturas y significado de la última carta cantada.
    Solo accesible por el Gritón (no expone info al jugador)."""
    partida = _get_partida(partida_id, db)

    griton = db.get(Jugador, griton_id)
    _assert_griton(griton)
    if griton.partida_id != partida_id:
        raise HTTPException(403, "Gritón no pertenece a esta partida")

    ultima = db.exec(
        select(CartaCantada)
        .where(CartaCantada.partida_id == partida_id)
        .order_by(CartaCantada.orden.desc())  # type: ignore[union-attr]
    ).first()
    if not ultima:
        return {"vacio": True}

    kanji = db.get(Kanji, ultima.kanji_id)
    if not kanji:
        raise HTTPException(404, "Kanji no encontrado")

    return {
        "kanji_id": kanji.id,
        "caracter": kanji.caracter,
        "orden": ultima.orden,
        "lectura_kun": kanji.lectura_kun,
        "lectura_on": kanji.lectura_on,
        "significado_es": kanji.significado_es,
    }


@app.get("/api/historial")
def historial(db: Session = Depends(get_db)):
    partidas = db.exec(
        select(Partida)
        .where(Partida.estado == "terminada")
        .order_by(Partida.fecha.desc())  # type: ignore[union-attr]
        .limit(20)
    ).all()

    resultado = []
    for p in partidas:
        ganador = db.exec(
            select(Ganador).where(
                Ganador.partida_id == p.id, Ganador.valido == True  # noqa: E712
            )
        ).first()
        jugador_ganador = db.get(Jugador, ganador.jugador_id) if ganador else None

        ultima_carta = db.exec(
            select(CartaCantada)
            .where(CartaCantada.partida_id == p.id)
            .order_by(CartaCantada.orden.desc())  # type: ignore[union-attr]
        ).first()

        duracion = None
        if ultima_carta:
            duracion = (ultima_carta.timestamp - p.fecha).total_seconds()

        resultado.append({
            "partida_id": p.id,
            "fecha": p.fecha.isoformat(),
            "ganador_apodo": jugador_ganador.apodo if jugador_ganador else None,
            "cartas_cantadas": ultima_carta.orden if ultima_carta else 0,
            "duracion_segundos": duracion,
        })

    return resultado


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


@app.websocket("/ws/{partida_id}/{jugador_id}")
async def websocket_endpoint(
    partida_id: int, jugador_id: int, ws: WebSocket
):
    await manager.connect(partida_id, jugador_id, ws)

    # Limpiar timestamp de desconexión si existía
    _desconexiones.get(partida_id, {}).pop(jugador_id, None)

    # Lookup apodo (sesión corta solo para el broadcast)
    apodo = None
    es_griton = False
    with Session(engine) as _db:
        j = _db.get(Jugador, jugador_id)
        if j:
            apodo = j.apodo
            es_griton = j.es_griton

    await manager.broadcast(partida_id, {
        "tipo": "jugador_conectado",
        "jugador_id": jugador_id,
        "apodo": apodo,
        "es_griton": es_griton,
    })

    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                # No recibimos nada en 30 s → enviar ping keep-alive
                try:
                    await ws.send_text(json.dumps({"tipo": "ping"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(partida_id, jugador_id)
        _desconexiones.setdefault(partida_id, {})[jugador_id] = datetime.now()
        await manager.broadcast(partida_id, {
            "tipo": "jugador_desconectado",
            "jugador_id": jugador_id,
        })
