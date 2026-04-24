import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mdiArrowRight, mdiAccountGroup } from '@mdi/js';
import TopBar from '../../components/TopBar/TopBar';
import ToggleGroup from '../../components/ToggleGroup/ToggleGroup';
import PatternPreview from '../../components/PatternPreview/PatternPreview';
import PlayerItem from '../../components/PlayerItem/PlayerItem';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import RoleBadge from '../../components/RoleBadge/RoleBadge';
import Icon from '../../components/Icon/Icon';
import BilingualLabel from '../../components/BilingualLabel/BilingualLabel';
import useGameSocket from '../../hooks/useGameSocket';
import s from './Host.module.css';

const SIZE_OPTIONS = [
  { value: 3, label: '3×3' },
  { value: 4, label: '4×4' },
];

const PATTERN_OPTIONS = [
  { value: 'line', jp: 'ライン', es: 'Línea' },
  { value: 'diagonal', jp: 'たいかくせん', es: 'Diagonal' },
  { value: 'corners', jp: 'かど', es: 'Esquinas' },
  { value: 'full', jp: 'ぜんぶ', es: 'Tabla llena' },
];

const APRENDIZAJE_OPTIONS = [
  { value: false, label: <span className={s.bilingualTitle} style={{ alignItems: 'center' }}><span className={s.jp}>オフ</span><span className={s.es}>Desactivado</span></span> },
  { value: true,  label: <span className={s.bilingualTitle} style={{ alignItems: 'center' }}><span className={s.jp}>オン</span><span className={s.es}>Activado</span></span> },
];

export default function Host() {
  const navigate = useNavigate();
  const partidaId = localStorage.getItem('griton_partida_id');
  const jugadorId = localStorage.getItem('griton_jugador_id');
  const gritonToken = localStorage.getItem('griton_token');

  const [tamano, setTamano] = useState(4);
  const [patron, setPatron] = useState('full');
  const [modoAprendizaje, setModoAprendizaje] = useState(false);
  const [jugadores, setJugadores] = useState([]);
  const [splash, setSplash] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  // Sincronizar configuración con el servidor cada vez que cambie (debounce 300ms)
  useEffect(() => {
    if (!partidaId || !gritonToken) return;
    const timer = setTimeout(() => {
      fetch(`/api/partidas/${partidaId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          griton_token: gritonToken,
          tamano_tabla: tamano,
          patron_victoria: patron,
          modo_aprendizaje: modoAprendizaje,
        }),
      }).catch(() => { /* ignorar error silenciosamente */ });
    }, 300);
    return () => clearTimeout(timer);
  }, [tamano, patron, modoAprendizaje, partidaId, gritonToken]);

  // Hidratar lista inicial desde el backend (solo jugadores no-Gritón)
  const hydrate = useCallback(async () => {
    if (!partidaId) return;
    try {
      const res = await fetch(`/api/partidas/${partidaId}/estado`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.jugadores)) {
        setJugadores(
          data.jugadores
            .filter((j) => !j.es_griton)
            .map((j) => ({
              jugador_id: j.jugador_id,
              apodo: j.apodo,
              role: 'player',
              connected: j.connected,
            }))
        );
      }
    } catch {
      /* ignore */
    }
  }, [partidaId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const onMessage = useCallback((msg) => {
    if (msg.type === 'reconnected') {
      hydrate();
      return;
    }
    if (msg.type === 'jugador_conectado') {
      // Ignorar cualquier evento del propio Gritón (no se muestra en la lista)
      if (msg.es_griton) return;
      setJugadores((prev) => {
        const exists = prev.find((j) => j.jugador_id === msg.jugador_id);
        if (exists) {
          return prev.map((j) =>
            j.jugador_id === msg.jugador_id ? { ...j, connected: true } : j
          );
        }
        return [
          ...prev,
          {
            jugador_id: msg.jugador_id,
            apodo: msg.apodo || `Jugador ${msg.jugador_id}`,
            role: 'player',
            connected: true,
          },
        ];
      });
    }
    if (msg.type === 'jugador_desconectado') {
      setJugadores((prev) =>
        prev.map((j) =>
          j.jugador_id === msg.jugador_id ? { ...j, connected: false } : j
        )
      );
    }
  }, [hydrate]);

  const { conectado } = useGameSocket({
    partidaId: Number(partidaId),
    jugadorId: Number(jugadorId),
    onMessage,
  });

  const nonCallerCount = jugadores.length;

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setStartError('');
    try {
      const res = await fetch(`/api/partidas/${partidaId}/iniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          griton_id: Number(jugadorId),
          tamano_tabla: tamano,
          patron_victoria: patron,
          modo_aprendizaje: modoAprendizaje,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStartError(data.detail || 'No se pudo iniciar la partida');
        setStarting(false);
        return;
      }
      setSplash(true);
      setTimeout(() => navigate('/game/caller'), 1500);
    } catch {
      setStartError('Error de conexión con el servidor');
      setStarting(false);
    }
  };

  if (splash) {
    return (
      <div className={s.splash}>
        <span className={s.splashText}>がんばって！</span>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <TopBar
        title={
          <span className={s.bilingualTitle}>
            <span className={s.jp}>せってい</span>
            <span className={s.es}>Configuración</span>
          </span>
        }
        darkToggle
        right={<RoleBadge role="caller" />}
      />

      <div className={s.content}>
        <section className={s.config}>
          <label className={s.label}>
            <span className={s.bilingualTitle}>
              <span className={s.jp}>ボードのサイズ</span>
              <span className={s.es}>Tamaño del tablero</span>
            </span>
          </label>
          <ToggleGroup options={SIZE_OPTIONS} value={tamano} onChange={setTamano} />

          <label className={s.label}>
            <span className={s.bilingualTitle}>
              <span className={s.jp}>しょうりパターン</span>
              <span className={s.es}>Patrón de victoria</span>
            </span>
          </label>
          <div className={s.patternRow}>
            {PATTERN_OPTIONS.map((p) => (
              <button
                key={p.value}
                className={`${s.patternBtn} ${patron === p.value ? s.patternActive : ''}`}
                onClick={() => setPatron(p.value)}
              >
                <PatternPreview pattern={p.value} size={tamano} />
                <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
                  <span className={s.jp}>{p.jp}</span>
                  <span className={s.es}>{p.es}</span>
                </span>
              </button>
            ))}
          </div>

          <label className={s.label}>
            <span className={s.bilingualTitle}>
              <span className={s.jp}>がくしゅうモード</span>
              <span className={s.es}>Modo aprendizaje</span>
            </span>
          </label>
          <p className={s.labelDesc}>
            Los jugadores verán lecturas y significado en su tabla
          </p>
          <ToggleGroup
            options={APRENDIZAJE_OPTIONS}
            value={modoAprendizaje}
            onChange={setModoAprendizaje}
          />
        </section>

        <section className={s.players}>
          <h3 className={s.sectionTitle}>
            <span className={s.bilingualTitle}>
              <span className={s.jp}>さんかしゃ ({jugadores.length}){!conectado && <span className={s.offline}> · sin conexión</span>}</span>
              <span className={s.es}>Participantes</span>
            </span>
          </h3>
          {jugadores.length === 0 ? (
            <div className={s.emptyPlayers}>
              <Icon path={mdiAccountGroup} size={2} color="var(--ink-faint)" />
              <span>まっています... / esperando jugadores</span>
            </div>
          ) : (
            jugadores.map((j) => (
              <PlayerItem
                key={j.jugador_id}
                apodo={j.apodo}
                role={j.role}
                isYou={j.jugador_id === Number(jugadorId)}
                connected={j.connected}
              />
            ))
          )}
        </section>

        <div className={s.footer}>
          {startError && <p className={s.error}>{startError}</p>}
          <PrimaryButton
            variant="accent"
            disabled={nonCallerCount < 1 || starting}
            onClick={handleStart}
          >
            {nonCallerCount < 1 || starting ? (
              <BilingualLabel
                jp="プレイヤーをまつ..."
                es="Esperando jugadores..."
              />
            ) : (
              <BilingualLabel
                jp="スタート！"
                es="Iniciar partida"
                icon={<Icon path={mdiArrowRight} size={0.9} color="white" />}
              />
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
