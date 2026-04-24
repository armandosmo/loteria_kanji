from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel, create_engine, Session


class Kanji(SQLModel, table=True):
    __tablename__ = "kanjis"

    id: Optional[int] = Field(default=None, primary_key=True)
    caracter: str = Field(unique=True, index=True)
    lectura_on: str
    lectura_kun: str
    significado_es: str


class Partida(SQLModel, table=True):
    __tablename__ = "partidas"

    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: datetime = Field(default_factory=datetime.now)
    estado: str = Field(default="lobby")
    griton_id: Optional[int] = Field(default=None, foreign_key="jugadores.id")
    griton_token: Optional[str] = Field(default=None, index=True)
    tamano_tabla: int = Field(default=4)
    patron_victoria: str = Field(default="full")
    mazo_json: str = Field(default="[]")
    modo_aprendizaje: bool = Field(default=False)


class Jugador(SQLModel, table=True):
    __tablename__ = "jugadores"

    id: Optional[int] = Field(default=None, primary_key=True)
    apodo: str
    partida_id: int = Field(foreign_key="partidas.id")
    es_griton: bool = Field(default=False)
    carton_json: str = Field(default="[]")
    marcadas_json: str = Field(default="[]")


class CartaCantada(SQLModel, table=True):
    __tablename__ = "cartas_cantadas"

    id: Optional[int] = Field(default=None, primary_key=True)
    partida_id: int = Field(foreign_key="partidas.id")
    kanji_id: int = Field(foreign_key="kanjis.id")
    orden: int
    timestamp: datetime = Field(default_factory=datetime.now)


class Ganador(SQLModel, table=True):
    __tablename__ = "ganadores"

    id: Optional[int] = Field(default=None, primary_key=True)
    partida_id: int = Field(foreign_key="partidas.id")
    jugador_id: int = Field(foreign_key="jugadores.id")
    timestamp: datetime = Field(default_factory=datetime.now)
    valido: bool


DATABASE_URL = "sqlite:///./loteria.db"
engine = create_engine(DATABASE_URL, echo=False)


def create_all():
    SQLModel.metadata.create_all(engine)
    # Migración ligera: añadir columnas nuevas en DBs preexistentes (SQLite)
    with engine.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql(
            "PRAGMA table_info(partidas)"
        ).fetchall()}
        if "mazo_json" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE partidas ADD COLUMN mazo_json TEXT DEFAULT '[]'"
            )
            conn.commit()
        if "modo_aprendizaje" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE partidas ADD COLUMN modo_aprendizaje INTEGER DEFAULT 0"
            )
            conn.commit()
        if "griton_token" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE partidas ADD COLUMN griton_token TEXT"
            )
            conn.commit()


def get_db():
    with Session(engine) as session:
        yield session
