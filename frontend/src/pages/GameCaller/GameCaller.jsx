import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  mdiArrowRight,
  mdiCards,
  mdiEye,
  mdiEyeOff,
} from '@mdi/js';
import TopBar from '../../components/TopBar/TopBar';
import DeckCounter from '../../components/DeckCounter/DeckCounter';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import RoleBadge from '../../components/RoleBadge/RoleBadge';
import VictoryOverlay from '../../components/VictoryOverlay/VictoryOverlay';
import Icon from '../../components/Icon/Icon';
import BilingualLabel from '../../components/BilingualLabel/BilingualLabel';
import useGameSocket from '../../hooks/useGameSocket';
import s from './GameCaller.module.css';

const MAZO_SIZE = 54;

// Normaliza una lectura que puede venir con varios delimitadores
// (`|` del CSV, `・`, `/`, `、`, espacios) y la une con ", ".
function formatLectura(raw) {
  if (!raw) return null;
  const parts = raw
    .split(/[|・/、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export default function GameCaller() {
  const navigate = useNavigate();
  const partidaId = localStorage.getItem('griton_partida_id');
  const jugadorId = localStorage.getItem('griton_jugador_id');

  const [currentCard, setCurrentCard] = useState(null);
  const [cardInfo, setCardInfo] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [cooldown, setCooldown] = useState(false);
  const [toast, setToast] = useState(null);
  const [banner, setBanner] = useState(null); // {text, variant: 'accent'|'soft'}
  const [finalizing, setFinalizing] = useState(false);
  const [overlayVictoria, setOverlayVictoria] = useState(null);
  const [continuarBusy, setContinuarBusy] = useState(false);
  const [patronActual, setPatronActual] = useState('full');
  const [modoAprendizaje, setModoAprendizaje] = useState(false);
  const cooldownTimer = useRef(null);
  const toastTimer = useRef(null);
  const bannerTimer = useRef(null);
  const historyRef = useRef(null);

  const showToast = (text) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const showBanner = (text, variant = 'accent', ms = 4000) => {
    clearTimeout(bannerTimer.current);
    setBanner({ text, variant });
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  };

  // Hidratar estado al montar/recargar: lista completa de cartas cantadas
  // y carta actual con su carta_info privada.
  const hydrate = useCallback(async () => {
    if (!partidaId || !jugadorId) return;
    try {
      const res = await fetch(`/api/partidas/${partidaId}/estado`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.patron_victoria) setPatronActual(data.patron_victoria);
      if (typeof data.modo_aprendizaje === 'boolean') {
        setModoAprendizaje(data.modo_aprendizaje);
      }

      if (Array.isArray(data.cartas_cantadas) && data.cartas_cantadas.length > 0) {
        const ordenadas = [...data.cartas_cantadas].sort(
          (a, b) => a.orden - b.orden
        );
        setHistory(ordenadas);
        const last = ordenadas[ordenadas.length - 1];
        setCurrentCard({
          kanji_id: last.kanji_id,
          caracter: last.caracter,
          orden: last.orden,
        });
        setDeckCount(last.orden);
        setRevealed(false);

        // Pedir lecturas de la última carta (solo Gritón)
        try {
          const r2 = await fetch(
            `/api/partidas/${partidaId}/ultima-carta-info?griton_id=${jugadorId}`
          );
          if (r2.ok) {
            const info = await r2.json();
            if (!info.vacio) {
              setCardInfo({
                lectura_kun: info.lectura_kun,
                lectura_on: info.lectura_on,
                significado_es: info.significado_es,
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, [partidaId, jugadorId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const onMessage = useCallback(
    (msg) => {
      if (msg.type === 'reconnected') {
        hydrate();
        return;
      }

      if (msg.type === 'game_started') {
        if (typeof msg.modo_aprendizaje === 'boolean') {
          setModoAprendizaje(msg.modo_aprendizaje);
        }
        if (msg.primera_carta) {
          const pc = msg.primera_carta;
          setCurrentCard({
            kanji_id: pc.kanji_id,
            caracter: pc.caracter,
            orden: pc.orden,
          });
          setDeckCount(pc.orden);
          setHistory((prev) => {
            const exists = prev.some((h) => h.orden === pc.orden);
            return exists
              ? prev
              : [...prev, { kanji_id: pc.kanji_id, caracter: pc.caracter, orden: pc.orden }];
          });
          setCardInfo(null);
          setRevealed(false);
        }
        return;
      }

      if (msg.type === 'carta_siguiente') {
        setCurrentCard({
          kanji_id: msg.kanji_id,
          caracter: msg.caracter,
          orden: msg.orden,
        });
        setCardInfo(null);
        setRevealed(false);
        setDeckCount(msg.orden);
        setHistory((prev) => [
          ...prev,
          { kanji_id: msg.kanji_id, caracter: msg.caracter, orden: msg.orden },
        ]);
        setTimeout(() => {
          historyRef.current?.scrollTo({
            left: historyRef.current.scrollWidth,
            behavior: 'smooth',
          });
        }, 50);
      }

      if (msg.type === 'carta_info') {
        setCardInfo({
          lectura_kun: msg.lectura_kun,
          lectura_on: msg.lectura_on,
          significado_es: msg.significado_es,
        });
      }

      if (msg.type === 'loteria_solicitada') {
        showBanner(`¡${msg.jugador_apodo} solicitó Lotería!`, 'accent', 4000);
      }

      if (msg.type === 'loteria_rechazada') {
        showBanner(
          `Lotería de ${msg.jugador_apodo || '?'} rechazada`,
          'soft',
          3000,
        );
      }

      if (msg.type === 'partida_terminada') {
        if (msg.fin_definitivo) {
          // Cierre definitivo (mazo agotado o el Gritón pulsó "Terminar")
          localStorage.removeItem('griton_partida_id');
          localStorage.removeItem('griton_jugador_id');
          localStorage.removeItem('griton_token');
          localStorage.removeItem('role');
          navigate('/');
          return;
        }
        // Victoria normal: mostrar overlay sin redirigir
        setOverlayVictoria({
          ganador_apodo: msg.ganador_apodo,
          patron: msg.patron || patronActual,
          sin_ganador: !!msg.sin_ganador,
        });
      }

      if (msg.type === 'partida_continuada') {
        if (msg.nuevo_patron) setPatronActual(msg.nuevo_patron);
        setOverlayVictoria(null);
        setContinuarBusy(false);
      }
    },
    [jugadorId, navigate, hydrate, patronActual]
  );

  const { conectado } = useGameSocket({
    partidaId: Number(partidaId),
    jugadorId: Number(jugadorId),
    onMessage,
  });

  const handleCantar = async () => {
    if (cooldown || deckCount >= MAZO_SIZE) return;
    setCooldown(true);
    clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setCooldown(false), 2000);

    try {
      const res = await fetch(`/api/partidas/${partidaId}/cantar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ griton_id: Number(jugadorId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || 'No se pudo cantar la carta');
      }
    } catch {
      showToast('Error de conexión');
    }
  };

  const mazoAgotado = deckCount >= MAZO_SIZE;

  const handleFinalizar = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ griton_id: Number(jugadorId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || 'No se pudo finalizar la partida');
        setFinalizing(false);
        return;
      }
      // El broadcast partida_terminada con fin_definitivo:true
      // hará el navigate a "/" en el handler.
    } catch {
      showToast('Error de conexión');
      setFinalizing(false);
    }
  };

  // Handlers del overlay de victoria (solo Gritón)
  const handleContinuar = async (nuevoPatron) => {
    if (continuarBusy) return;
    setContinuarBusy(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/continuar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          griton_id: Number(jugadorId),
          nuevo_patron: nuevoPatron,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || 'No se pudo continuar la partida');
        setContinuarBusy(false);
      }
      // Si OK, el broadcast partida_continuada cierra el overlay.
    } catch {
      showToast('Error de conexión');
      setContinuarBusy(false);
    }
  };

  const handleTerminarDesdeOverlay = async () => {
    if (continuarBusy) return;
    setContinuarBusy(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ griton_id: Number(jugadorId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || 'No se pudo terminar la partida');
        setContinuarBusy(false);
      }
      // El broadcast con fin_definitivo:true hará el navigate a "/".
    } catch {
      showToast('Error de conexión');
      setContinuarBusy(false);
    }
  };

  return (
    <div className={s.page}>
      <TopBar
        title="親"
        exitButton
        darkToggle
        learningMode={modoAprendizaje}
        right={
          <div className={s.topRight}>
            <RoleBadge role="caller" />
            {!conectado && <span className={s.offlineDot} />}
          </div>
        }
      />

      <div className={s.content}>
        <DeckCounter current={deckCount} total={MAZO_SIZE} />

        {/* Main card */}
        <div className={s.mainCard}>
          {currentCard ? (
            <>
              <span className={s.kanji}>{currentCard.caracter}</span>
              <button
                className={s.revealBtn}
                onClick={() => setRevealed((r) => !r)}
              >
                <BilingualLabel
                  jp={revealed ? 'かくす' : 'みせる'}
                  es={revealed ? 'Ocultar' : 'Revelar'}
                  icon={<Icon path={revealed ? mdiEyeOff : mdiEye} size={0.85} color="var(--ink)" />}
                />
              </button>
              {revealed && cardInfo && (
                <div className={s.readings}>
                  {formatLectura(cardInfo.lectura_kun) && (
                    <div className={s.readingBlock}>
                      <span className={s.readingLabel}>訓読み · Kun</span>
                      <span className={s.readingValue}>
                        {formatLectura(cardInfo.lectura_kun)}
                      </span>
                    </div>
                  )}
                  {formatLectura(cardInfo.lectura_on) && (
                    <div className={s.readingBlock}>
                      <span className={s.readingLabel}>音読み · On</span>
                      <span className={s.readingValue}>
                        {formatLectura(cardInfo.lectura_on)}
                      </span>
                    </div>
                  )}
                  {cardInfo.significado_es && (
                    <div className={s.readingBlock}>
                      <span className={s.readingLabel}>Significado</span>
                      <span className={s.meaningValue}>{cardInfo.significado_es}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <span className={s.placeholder}>Cargando…</span>
          )}
        </div>

        {/* Next card button OR mazo agotado */}
        {mazoAgotado ? (
          <div className={s.deckEmpty}>
            <span className={s.deckEmptyEmoji}>
              <Icon path={mdiCards} size={2.5} color="var(--ink-soft)" />
            </span>
            <span className={s.deckEmptyTitle}>
              <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
                <span className={s.jp}>カードきれ</span>
                <span className={s.es}>Mazo agotado</span>
              </span>
            </span>
            <span className={s.deckEmptySub}>
              <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
                <span className={s.jp}>54まいぜんぶうたいました</span>
                <span className={s.es}>Se cantaron las 54 cartas sin ganador</span>
              </span>
            </span>
            <PrimaryButton
              variant="dark"
              disabled={finalizing}
              onClick={handleFinalizar}
            >
              Finalizar partida
            </PrimaryButton>
          </div>
        ) : (
          <div className={s.cantarWrap}>
            <PrimaryButton
              variant="dark"
              disabled={cooldown}
              onClick={handleCantar}
            >
              つぎのカード &nbsp;<Icon path={mdiArrowRight} size={0.9} color="var(--paper)" />
            </PrimaryButton>
            {cooldown && <div className={s.cooldownBar} />}
          </div>
        )}
      </div>

      {/* History — barra fija inferior */}
      {history.length > 0 && (
        <div className={s.historialWrapper}>
          <span className={s.historialLabel}>
              <span className={s.bilingualTitle}>
                <span className={s.jp}>りれき</span>
                <span className={s.es}>Historial</span>
              </span>
            </span>
          <div className={s.historialScroll} ref={historyRef}>
            {history.map((h, i) => (
              <div
                key={h.orden}
                className={`${s.historialCelda} ${
                  i === history.length - 1 ? s.historialCeldaActiva : ''
                }`}
              >
                {h.caracter}
              </div>
            ))}
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`${s.banner} ${
            banner.variant === 'soft' ? s.bannerSoft : s.bannerAccent
          }`}
        >
          {banner.text}
        </div>
      )}

      {toast && <div className={s.toast}>{toast}</div>}

      {overlayVictoria && (
        <VictoryOverlay
          ganadorApodo={overlayVictoria.ganador_apodo}
          patron={overlayVictoria.patron}
          sinGanador={overlayVictoria.sin_ganador}
          role="griton"
          busy={continuarBusy}
          onContinuarFull={() => handleContinuar('full')}
          onContinuarMismo={() => handleContinuar(null)}
          onTerminar={handleTerminarDesdeOverlay}
        />
      )}
    </div>
  );
}
