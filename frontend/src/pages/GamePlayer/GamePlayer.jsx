import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar/TopBar';
import KanjiCell from '../../components/KanjiCell/KanjiCell';
import KanjiInfoModal from '../../components/KanjiInfoModal/KanjiInfoModal';
import DeckCounter from '../../components/DeckCounter/DeckCounter';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import RoleBadge from '../../components/RoleBadge/RoleBadge';
import VictoryOverlay from '../../components/VictoryOverlay/VictoryOverlay';
import useGameSocket from '../../hooks/useGameSocket';
import s from './GamePlayer.module.css';

const MAZO_SIZE = 54;

function seedApodo(apodo) {
  let sum = 0;
  for (let i = 0; i < apodo.length; i++) sum += apodo.charCodeAt(i);
  return sum;
}

function checkPattern(marcadas, patron, tamano) {
  const grid = [];
  for (let r = 0; r < tamano; r++) {
    const row = [];
    for (let c = 0; c < tamano; c++) row.push(marcadas[r * tamano + c]);
    grid.push(row);
  }

  if (patron === 'full') return marcadas.every(Boolean);

  if (patron === 'line') {
    // Acepta cualquier fila horizontal o columna vertical completa
    for (const row of grid) {
      if (row.every(Boolean)) return true;
    }
    for (let c = 0; c < tamano; c++) {
      let full = true;
      for (let r = 0; r < tamano; r++) {
        if (!grid[r][c]) { full = false; break; }
      }
      if (full) return true;
    }
    return false;
  }

  if (patron === 'diagonal') {
    if (grid.every((row, i) => row[i])) return true;
    if (grid.every((row, i) => row[tamano - 1 - i])) return true;
    return false;
  }

  if (patron === 'corners') {
    return (
      grid[0][0] &&
      grid[0][tamano - 1] &&
      grid[tamano - 1][0] &&
      grid[tamano - 1][tamano - 1]
    );
  }

  return false;
}

export default function GamePlayer() {
  const navigate = useNavigate();
  const partidaId = localStorage.getItem('partida_id');
  const jugadorId = localStorage.getItem('jugador_id');
  const nombre = localStorage.getItem('nombre');
  const seed = seedApodo(nombre || '');

  const [carton, setCarton] = useState([]);
  const [marcadas, setMarcadas] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [tamano, setTamano] = useState(4);
  const [patron, setPatron] = useState('full');
  const [modoAprendizaje, setModoAprendizaje] = useState(false);
  const [loteriaWait, setLoteriaWait] = useState(false);
  const [toast, setToast] = useState(null);
  const [overlayVictoria, setOverlayVictoria] = useState(null);
  const [kanjiModal, setKanjiModal] = useState(null);
  const toastTimer = useRef(null);

  const restoreFromServer = useCallback(async () => {
    if (!partidaId || !jugadorId) {
      navigate('/');
      return;
    }
    try {
      const res = await fetch(
        `/api/partidas/${partidaId}/estado?jugador_id=${jugadorId}`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.estado === 'terminada') {
        navigate('/result', {
          state: {
            ganador_id: data.ganador_id,
            ganador_apodo: data.ganador_apodo,
            sin_ganador: !data.ganador_id,
            mi_id: Number(jugadorId),
          },
        });
        return;
      }

      if (data.tamano_tabla) setTamano(data.tamano_tabla);
      if (data.patron_victoria) setPatron(data.patron_victoria);
      if (typeof data.modo_aprendizaje === 'boolean') {
        setModoAprendizaje(data.modo_aprendizaje);
      }

      // Restaurar contador de cartas cantadas
      if (typeof data.cartas_cantadas_count === 'number') {
        setDeckCount(data.cartas_cantadas_count);
      }

      // Restaurar cartón (preservando lectura/significado si vienen en modo aprendizaje)
      if (data.mi_carton && data.mi_carton.length > 0) {
        const cartonCompleto = data.mi_carton.map((item, idx) => ({
          kanji_id: item.kanji_id,
          caracter: item.caracter,
          colorIndex: ((idx + seed) % 5) + 1,
          lectura_kun: item.lectura_kun,
          lectura_on: item.lectura_on,
          significado: item.significado_es || item.significado,
        }));
        setCarton(cartonCompleto);
      }

      // Restaurar marcadas
      if (data.mis_marcadas && data.mis_marcadas.length > 0) {
        setMarcadas(data.mis_marcadas);
      }
    } catch {
      /* reconnect failed silently */
    }
  }, [partidaId, jugadorId, seed, navigate]);

  // Restore on mount
  useEffect(() => {
    restoreFromServer();
  }, [restoreFromServer]);

  const onMessage = useCallback(
    (msg) => {
      if (msg.type === 'reconnected') {
        restoreFromServer();
        return;
      }

      if (msg.type === 'tu_carton') {
        if (msg.tamano_tabla) setTamano(msg.tamano_tabla);
        if (typeof msg.modo_aprendizaje === 'boolean') {
          setModoAprendizaje(msg.modo_aprendizaje);
        }
        const items = msg.carton.map((item, idx) => ({
          kanji_id: typeof item === 'object' ? item.kanji_id : item,
          caracter: typeof item === 'object' ? item.caracter : '?',
          colorIndex:
            typeof item === 'object' && item.colorIndex
              ? item.colorIndex
              : ((idx + seed) % 5) + 1,
          lectura_kun: typeof item === 'object' ? item.lectura_kun : undefined,
          lectura_on: typeof item === 'object' ? item.lectura_on : undefined,
          significado:
            typeof item === 'object'
              ? item.significado || item.significado_es
              : undefined,
        }));
        setCarton(items);
        setMarcadas(new Array(items.length).fill(false));
      }

      if (msg.type === 'game_started') {
        if (msg.tamano_tabla) setTamano(msg.tamano_tabla);
        if (msg.patron_victoria) setPatron(msg.patron_victoria);
        if (typeof msg.modo_aprendizaje === 'boolean') {
          setModoAprendizaje(msg.modo_aprendizaje);
        }
      }

      if (msg.type === 'carta_siguiente') {
        setDeckCount(msg.orden || ((prev) => prev + 1));
      }

      if (msg.type === 'loteria_rechazada') {
        setLoteriaWait(false);
        showToast(`ロテリア rechazada${msg.jugador_apodo ? ` — ${msg.jugador_apodo}` : ''}`);
      }

      if (msg.type === 'partida_terminada') {
        if (msg.fin_definitivo) {
          // Cierre definitivo: limpiar y volver al inicio.
          localStorage.removeItem('partida_id');
          localStorage.removeItem('jugador_id');
          localStorage.removeItem('role');
          navigate('/');
          return;
        }
        // Victoria: mostrar overlay sin redirigir.
        setOverlayVictoria({
          ganador_apodo: msg.ganador_apodo,
          patron: msg.patron || patron,
          sin_ganador: !!msg.sin_ganador,
        });
        setLoteriaWait(false);
      }

      if (msg.type === 'partida_continuada') {
        if (msg.nuevo_patron) setPatron(msg.nuevo_patron);
        setOverlayVictoria(null);
      }

      // Bug #8: si este jugador fue promovido a Gritón, navegar a la vista de Gritón.
      if (msg.type === 'nuevo_griton' && msg.jugador_id === Number(jugadorId)) {
        // Copiar identidad activa a las keys del Gritón (sin nombre).
        localStorage.setItem('griton_partida_id', String(partidaId));
        localStorage.setItem('griton_jugador_id', String(jugadorId));
        if (msg.griton_token) {
          localStorage.setItem('griton_token', msg.griton_token);
        }
        localStorage.setItem('role', 'griton');
        navigate('/game/caller');
      }
    },
    [seed, jugadorId, navigate, restoreFromServer, patron]
  );

  const { conectado } = useGameSocket({
    partidaId: Number(partidaId),
    jugadorId: Number(jugadorId),
    onMessage,
  });

  function showToast(text) {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const toggleMark = (idx) => {
    if (loteriaWait) return;
    setMarcadas((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const patternMet = carton.length > 0 && checkPattern(marcadas, patron, tamano);

  const handleLoteria = async () => {
    if (!patternMet || loteriaWait) return;
    setLoteriaWait(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/loteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jugador_id: Number(jugadorId),
          marcadas,
        }),
      });
      if (!res.ok) {
        setLoteriaWait(false);
        showToast('Error al enviar ロテリア');
      }
    } catch {
      setLoteriaWait(false);
      showToast('Error de conexión');
    }
  };

  const gridCols = tamano;

  return (
    <div className={s.page}>
      <TopBar
        title={nombre || 'Tu tabla'}
        exitButton
        darkToggle
        learningMode={modoAprendizaje}
        right={
          <div className={s.topRight}>
            <RoleBadge role="player" />
            {!conectado && <span className={s.offlineDot} />}
          </div>
        }
      />

      {carton.length === 0 ? (
        <div className={s.waiting}>
          <p className={s.waitingTitle}>
            <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
              <span className={s.jp}>まっています...</span>
              <span className={s.es}>Esperando al Gritón</span>
            </span>
          </p>
          <p className={s.waitingSub}>
            <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
              <span className={s.jp}>まもなくはじまります</span>
              <span className={s.es}>La partida comenzará pronto</span>
            </span>
          </p>
        </div>
      ) : (
        <>
          <div className={s.deckRow}>
            <DeckCounter current={deckCount} total={MAZO_SIZE} />
          </div>

          <div
            className={s.boardArea}
            data-tamano={tamano}
          >
            <div
              className={s.board}
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
            >
              {carton.map((cell, idx) => (
                <KanjiCell
                  key={cell.kanji_id}
                  kanji={cell.caracter}
                  kanji_id={cell.kanji_id}
                  colorIndex={cell.colorIndex}
                  marked={marcadas[idx]}
                  onToggle={() => toggleMark(idx)}
                  modoAprendizaje={modoAprendizaje}
                  lectura_kun={cell.lectura_kun}
                  lectura_on={cell.lectura_on}
                  significado={cell.significado}
                  onDoubleTap={
                    modoAprendizaje ? (info) => setKanjiModal(info) : undefined
                  }
                />
              ))}
            </div>
          </div>

          <div className={s.lotteryWrap}>
            <PrimaryButton
              variant="accent"
              disabled={!patternMet || loteriaWait}
              onClick={handleLoteria}
            >
              {loteriaWait ? '検証中...' : 'ロテリア！'}
            </PrimaryButton>
          </div>
        </>
      )}

      {loteriaWait && (
        <div className={s.overlay}>
          <div className={s.overlayCard}>
            <p className={s.overlayText}>Verificando ロテリア...</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast}>
          {toast}
        </div>
      )}

      {overlayVictoria && (
        <VictoryOverlay
          ganadorApodo={overlayVictoria.ganador_apodo}
          patron={overlayVictoria.patron}
          sinGanador={overlayVictoria.sin_ganador}
          role="player"
        />
      )}

      {kanjiModal && (
        <KanjiInfoModal
          kanji={kanjiModal}
          onClose={() => setKanjiModal(null)}
        />
      )}
    </div>
  );
}
