# Nihongo Lotería — Contexto para GitHub Copilot

Este archivo se llama `copilot-instructions.md` y está en `.github/`.
GitHub Copilot lo lee automáticamente en cada sesión dentro de este repositorio.
**No eliminar ni mover este archivo.**

---

## ¿Qué es este proyecto?

App web multijugador local de lotería educativa de Kanjis japoneses.
Hasta 15 jugadores en la misma red WiFi. Sin registro, sin internet requerido.
Corre en un servidor remoto; los jugadores acceden por IP local desde sus celulares.

---

## Stack

- Backend: **Python 3.12 + FastAPI + SQLModel + SQLite**
- Frontend: **React + Vite + React Router v6**
- Estilos: **CSS puro con CSS Modules** — NUNCA Tailwind, styled-components, ni emotion
- Tiempo real: **WebSockets nativos de FastAPI** — NUNCA Socket.io
- Contenedor: **Docker + Docker Compose**
- Base de datos: **SQLite** — NUNCA PostgreSQL, MySQL ni Redis para este proyecto

---

## Principio rector — CRÍTICO

El servidor envía `carta_siguiente` con solo `{orden, kanji_id, caracter}` a todos.
La `carta_info` con `{lectura_kun, lectura_on, significado_es}` se envía SOLO al Gritón (mensaje privado WebSocket).
El jugador NUNCA ve qué carta cantó el Gritón.

Está PROHIBIDO en la vista del jugador (`GamePlayer.jsx`):
- Panel de carta cantada
- Historial de cartas
- Cualquier texto de lectura o significado
- Auto-marcado o highlight de casillas

---

## Roles

| Rol | Código | Badge |
|---|---|---|
| Gritón (canta las cartas) | `es_griton = True` | "グリトン" naranja `#F57C00` |
| Jugador (marca su tabla) | `es_griton = False` | "プレイヤー" azul `#1976D2` |

---

## Mecánica del mazo

```python
MAZO_SIZE  = 54   # cartas únicas por partida (igual a lotería Don Clemente)
TABLA_SIZE = 16   # casillas por tabla (grilla 4×4 default, 3×3 opcional)
MIN_CSV    = 54   # mínimo de Kanjis en el CSV
```

Al iniciar partida: `random.sample(todos_los_kanjis, 54)` → mazo.
Por cada jugador: `random.sample(mazo, 16)` → tabla individual.

---

## Sistema de diseño — Paleta Fiesta Mexicana

Variables CSS definidas en `frontend/src/index.css`. NUNCA hardcodear colores.

```css
--cell-1: #FFE066;  --cell-2: #FF8FA3;  --cell-3: #7DD3D8;
--cell-4: #A0E060;  --cell-5: #B794F4;
--cell-marked-bg: #B0B0A0;  --cell-marked-ink: #5A5A5A;
--ink: #1A1A1A;  --ink-soft: #4A4A4A;  --ink-faint: #8A8680;
--paper: #FFFEF7;  --paper-2: #F5F1E0;
--accent: #E91E63;  --accent-soft: #FFE0EC;
--role-player: #1976D2;  --role-caller: #F57C00;
--border: #E0DAC0;  --success: #5B8A4E;
--shadow: 0 2px 8px rgba(26,26,26,0.06);
--shadow-lift: 0 4px 14px rgba(26,26,26,0.12);
```

Color de celda: `colorIndex = ((índiceEnTabla + sum(ord(c) for c in apodo)) % 5) + 1`

`--accent` SOLO en: botón ロテリア activo, punto marcado, AlertBell activa,
botones Iniciar/Otra partida/Rechazar, toast de error.

---

## Tipografía

```
Font: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif
Kanji en main card del Gritón: 130px weight 500
Kanji en celda 4×4: 38px weight 500
Kanji en celda 3×3: 54px weight 500
Labels uppercase: 10–11px weight 600 letter-spacing 1.5px
Lectura hiragana: 18px letter-spacing 2px
```

---

## Rutas React Router

```
/                → Landing.jsx
/join            → Join.jsx
/host            → Host.jsx (solo Gritón)
/lobby           → LobbyPlayer.jsx (solo jugadores)
/game/caller     → GameCaller.jsx (solo Gritón)
/game/player     → GamePlayer.jsx (solo jugadores)
/result          → Result.jsx
```

Estado persistido en `localStorage`: `nombre`, `jugador_id`, `partida_id`, `role`.
Si no hay `nombre` → redirigir a `/`.

---

## Endpoints REST (prefijo /api)

```
GET  /health
POST /api/partidas
POST /api/partidas/{id}/unirse          body: {apodo}
POST /api/partidas/{id}/iniciar         body: {griton_id, tamano_tabla, patron_victoria}
POST /api/partidas/{id}/cantar          body: {griton_id, kanji_id}  cooldown 2s
POST /api/partidas/{id}/loteria         body: {jugador_id}
POST /api/partidas/{id}/tomar-mazo      body: {jugador_id}  (si gritón desconectado)
GET  /api/partidas/{id}/estado          (para reconexión)
GET  /api/historial
```

---

## Eventos WebSocket

```
/ws/{partida_id}/{jugador_id}

→ todos:          game_started, carta_siguiente, loteria_rechazada,
                  partida_terminada, jugador_conectado, jugador_desconectado
→ solo Gritón:   carta_info {lectura_kun, lectura_on, significado_es}
```

---

## Manejo de errores importantes

| Caso | Solución |
|---|---|
| Jugador recarga | GET /api/partidas/{id}/estado restaura carton y marcadas |
| Gritón desconectado >60s | Cualquier jugador puede llamar POST tomar-mazo |
| Doble toque Gritón | HTTP 429 en servidor + botón disabled 2s en cliente |
| CSV con <54 Kanjis | ValueError con mensaje claro al intentar iniciar |
| Lobby lleno (15 jugadores) | HTTP 409 con mensaje "Sala llena" |

---

## Restricciones de UX

- Orientación fija portrait durante el juego. Overlay bloqueante en landscape.
- Touch targets mínimos 44×44px efectivos.
- `user-scalable=no, maximum-scale=1` en meta viewport.
- Sin scroll en el BoardGrid: reducir font-size (mín 28px) antes de hacer scroll.
- Fondo de la app siempre `--paper` (#FFFEF7), nunca blanco puro.

---

## Estructura de archivos clave

```
backend/
  main.py       # FastAPI app + rutas + WebSocket endpoint
  models.py     # SQLModel: Kanji, Partida, Jugador, CartaCantada, Ganador
  game.py       # seleccionar_mazo, generar_tabla, validar_loteria (funciones puras)
  ws_manager.py # ConnectionManager: rooms, broadcast, send_private
  seed.py       # carga kanjis.csv → DB
  kanjis.csv    # CSV del usuario: caracter,lectura_on,lectura_kun,significado_es

frontend/src/
  index.css     # variables CSS globales (ÚNICA fuente de verdad de colores)
  App.jsx       # React Router
  hooks/useGameSocket.js
  pages/        # Landing, Join, Host, LobbyPlayer, GamePlayer, GameCaller, Result
  components/   # KanjiCell, BoardGrid, TopBar, DeckCounter, AlertBell,
                # PatternPreview, PlayerItem, RoleBadge, PrimaryButton,
                # SecondaryButton, ToggleGroup, VerifyModal
```

---

## Lo que NO existe en este proyecto (no sugerir)

- Sistema de login o autenticación
- Base de datos remota (solo SQLite local)
- Sonidos o efectos de audio
- Modo de revelar carta para los jugadores
- Historial de cartas cantadas para jugadores
- Progreso individual de aprendizaje persistido en servidor
- CI/CD (se implementará después con GitHub Actions)
- PWA o Service Worker (fase posterior)