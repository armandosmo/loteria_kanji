"""Carga kanjis.csv → tabla kanjis (upsert)."""

import csv
import sys
from pathlib import Path

from sqlmodel import Session, select

from models import Kanji, create_all, engine

MIN_KANJIS = 54
CSV_PATH = Path(__file__).parent / "kanjis.csv"


def seed():
    if not CSV_PATH.exists():
        print(f"Error: no se encontró {CSV_PATH}")
        sys.exit(1)

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # --- validaciones ---
    if len(rows) < MIN_KANJIS:
        print(f"Error: se necesitan al menos {MIN_KANJIS} kanjis, "
              f"pero el CSV tiene {len(rows)}.")
        sys.exit(1)

    caracteres = [r["caracter"] for r in rows]
    duplicados = {c for c in caracteres if caracteres.count(c) > 1}
    if duplicados:
        print(f"Error: caracteres duplicados en CSV: {duplicados}")
        sys.exit(1)

    campos = ("caracter", "lectura_on", "lectura_kun", "significado_es")
    for i, row in enumerate(rows, start=2):  # línea 2 en adelante (header = 1)
        for campo in campos:
            if not row.get(campo, "").strip():
                print(f"Error: celda vacía en línea {i}, columna '{campo}'.")
                sys.exit(1)

    # --- upsert ---
    create_all()
    count = 0

    with Session(engine) as session:
        for row in rows:
            existing = session.exec(
                select(Kanji).where(Kanji.caracter == row["caracter"])
            ).first()

            if existing:
                existing.lectura_on = row["lectura_on"].strip()
                existing.lectura_kun = row["lectura_kun"].strip()
                existing.significado_es = row["significado_es"].strip()
                session.add(existing)
            else:
                session.add(Kanji(
                    caracter=row["caracter"].strip(),
                    lectura_on=row["lectura_on"].strip(),
                    lectura_kun=row["lectura_kun"].strip(),
                    significado_es=row["significado_es"].strip(),
                ))
            count += 1

        session.commit()

    print(f"Cargados {count} kanjis. Listos para jugar.")


if __name__ == "__main__":
    seed()
