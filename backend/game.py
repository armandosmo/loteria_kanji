"""Funciones puras de lógica de juego (sin DB)."""

import random

from models import Kanji

MAZO_SIZE = 54


def seleccionar_mazo(kanjis: list[Kanji]) -> list[Kanji]:
    if len(kanjis) < MAZO_SIZE:
        raise ValueError(
            f"Se necesitan al menos {MAZO_SIZE} kanjis para armar el mazo, "
            f"pero solo hay {len(kanjis)}."
        )
    return random.sample(kanjis, MAZO_SIZE)


def generar_tabla(mazo: list[Kanji], tamano: int = 4) -> list[int]:
    total = tamano * tamano  # 4×4=16, 3×3=9
    if len(mazo) < total:
        raise ValueError(
            f"Mazo insuficiente para tabla {tamano}×{tamano}: "
            f"se necesitan {total} cartas, hay {len(mazo)}."
        )
    return [k.id for k in random.sample(mazo, total)]


def validar_loteria(
    carton: list[int],
    marcadas: list[bool],
    cantados: set[int],
    patron: str,
    tamano: int,
) -> bool:
    marcados_ids = {carton[i] for i, m in enumerate(marcadas) if m}

    # Cada casilla marcada debe haber sido cantada
    if not marcados_ids.issubset(cantados):
        return False

    # `validos[i]` es True solo si la casilla i está marcada Y la carta
    # correspondiente fue cantada por el Gritón. Sirve como base común
    # para comprobar cualquier patrón sin volver a validar la pertenencia
    # al conjunto `cantados` dentro de cada rama.
    validos = [
        marcadas[i] and (carton[i] in cantados)
        for i in range(len(carton))
    ]

    # Reorganizamos la lista plana en una matriz `tamano x tamano`
    # para razonar geométricamente sobre filas, columnas y diagonales.
    matriz = [
        validos[fila * tamano:(fila + 1) * tamano]
        for fila in range(tamano)
    ]

    if patron == "full":
        # "full" exige que TODAS las casillas estén válidamente marcadas.
        return all(validos)

    if patron == "line":
        # "line" acepta cualquier fila completa (horizontal) O cualquier
        # columna completa (vertical). Anteriormente solo verificaba
        # filas; ahora se acepta también la dirección vertical.
        for fila in matriz:
            if all(fila):
                return True
        for col in range(tamano):
            if all(matriz[fila][col] for fila in range(tamano)):
                return True
        return False

    if patron == "diagonal":
        # "diagonal" acepta la diagonal principal (↘: arriba-izq → abajo-der)
        # o la diagonal secundaria (↙: arriba-der → abajo-izq).
        if all(matriz[i][i] for i in range(tamano)):
            return True
        if all(matriz[i][tamano - 1 - i] for i in range(tamano)):
            return True
        return False

    if patron == "corners":
        # "corners" requiere las 4 esquinas de la grilla marcadas.
        return (
            matriz[0][0]
            and matriz[0][tamano - 1]
            and matriz[tamano - 1][0]
            and matriz[tamano - 1][tamano - 1]
        )

    return False


def calcular_seed_apodo(apodo: str) -> int:
    return sum(ord(c) for c in apodo)
