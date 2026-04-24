import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mdiTimerSand } from '@mdi/js';
import TopBar from '../../components/TopBar/TopBar';
import PlayerItem from '../../components/PlayerItem/PlayerItem';
import RoleBadge from '../../components/RoleBadge/RoleBadge';
import Icon from '../../components/Icon/Icon';
import useGameSocket from '../../hooks/useGameSocket';
import s from './LobbyPlayer.module.css';

const PATRON_LABELS = {
  full:     { jp: 'ぜんぶ',       es: 'Tabla llena' },
  line:     { jp: 'ライン',         es: 'Línea' },
  diagonal: { jp: 'たいかくせん', es: 'Diagonal' },
  corners:  { jp: 'かど',           es: 'Esquinas' },
};

export default function LobbyPlayer() {
  const navigate = useNavigate();
  const partidaId = localStorage.getItem('partida_id');
  const jugadorId = localStorage.getItem('jugador_id');

  const [jugadores, setJugadores] = useState([]);
  const [splash, setSplash] = useState(false);
  const [reglas, setReglas] = useState(null); // { tamano, patron, modo_aprendizaje }
  const [gritonApodo, setGritonApodo] = useState(null);

  // Hidratar lista inicial desde el backend
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
              es_griton: false,
              connected: j.connected,
            }))
        );
      }
      setReglas({
        tamano: data.tamano_tabla,
        patron: data.patron_victoria,
        modo_aprendizaje: !!data.modo_aprendizaje,
      });
      if (data.griton_apodo) setGritonApodo(data.griton_apodo);
      if (data.estado === 'activa') {
        navigate('/game/player');
      }
    } catch {
      /* ignore */
    }
  }, [partidaId, navigate]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const onMessage = useCallback(
    (msg) => {
      if (msg.type === 'reconnected') {
        hydrate();
        return;
      }
      if (msg.type === 'jugador_conectado') {
        if (msg.es_griton) return;
        setJugadores((prev) => {
          const exists = prev.find((j) => j.jugador_id === msg.jugador_id);
          if (exists) {
            return prev.map((j) =>
              j.jugador_id === msg.jugador_id
                ? { ...j, connected: true }
                : j
            );
          }
          return [
            ...prev,
            {
              jugador_id: msg.jugador_id,
              apodo: msg.apodo || `Jugador ${msg.jugador_id}`,
              es_griton: !!msg.es_griton,
              connected: true,
            },
          ];
        });
      }
      if (msg.type === 'jugador_desconectado') {
        setJugadores((prev) =>
          prev.map((j) =>
            j.jugador_id === msg.jugador_id
              ? { ...j, connected: false }
              : j
          )
        );
      }
      if (msg.type === 'config_actualizada') {
        setReglas({
          tamano: msg.tamano_tabla,
          patron: msg.patron_victoria,
          modo_aprendizaje: !!msg.modo_aprendizaje,
        });
      }
      if (msg.type === 'game_started') {
        setSplash(true);
        setTimeout(() => navigate('/game/player'), 1500);
      }
    },
    [navigate, hydrate]
  );

  useGameSocket({
    partidaId: Number(partidaId),
    jugadorId: Number(jugadorId),
    onMessage,
  });

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
            <span className={s.jp}>ルームにさんか</span>
            <span className={s.es}>Unirse a sala</span>
          </span>
        }
        darkToggle
        right={<RoleBadge role="player" />}
      />

      <div className={s.content}>
        <div className={s.hero}>
          <span className={s.heroEmoji}>
            <Icon path={mdiTimerSand} size={2} color="var(--ink-soft)" />
          </span>
          <p className={s.heroText}>
            <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
              <span className={s.jp}>まっています...</span>
              <span className={s.es}>Esperando al Gritón</span>
            </span>
          </p>
          <p className={s.heroSub}>
            <span className={s.bilingualTitle} style={{ alignItems: 'center' }}>
              <span className={s.jp}>まもなくはじまります</span>
              <span className={s.es}>La partida comenzará pronto</span>
            </span>
          </p>
          {gritonApodo && (
            <span className={s.gritonChip}>親 · {gritonApodo === '親' ? 'グリトン' : gritonApodo}</span>
          )}
        </div>

        {reglas && (
          <section className={s.configCard}>
            <div className={s.reglaItem}>
              <span className={s.reglaLabel}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>ボード</span>
                  <span className={s.es}>Tablero</span>
                </span>
              </span>
              <span className={s.reglaValue}>
                {reglas.tamano}×{reglas.tamano}
              </span>
            </div>
            <div className={s.reglaItem}>
              <span className={s.reglaLabel}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>しょうりパターン</span>
                  <span className={s.es}>Patrón para ganar</span>
                </span>
              </span>
              <span className={s.reglaValue}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>{PATRON_LABELS[reglas.patron]?.jp || reglas.patron}</span>
                  <span className={s.es}>{PATRON_LABELS[reglas.patron]?.es || reglas.patron}</span>
                </span>
              </span>
            </div>
            <div className={s.reglaItem}>
              <span className={s.reglaLabel}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>カードのかず</span>
                  <span className={s.es}>Cartas en el mazo</span>
                </span>
              </span>
              <span className={s.reglaValue}>54</span>
            </div>
            <div className={s.reglaItem}>
              <span className={s.reglaLabel}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>がくしゅうモード</span>
                  <span className={s.es}>Modo aprendizaje</span>
                </span>
              </span>
              <span className={s.reglaValue}>
                <span className={s.bilingualTitle}>
                  <span className={s.jp}>{reglas.modo_aprendizaje ? 'オン' : 'オフ'}</span>
                  <span className={s.es}>{reglas.modo_aprendizaje ? 'Activado' : 'Desactivado'}</span>
                </span>
              </span>
            </div>
          </section>
        )}

        {jugadores.length > 0 && (
          <section className={s.players}>
            <h3 className={s.sectionTitle}>
              <span className={s.bilingualTitle}>
                <span className={s.jp}>さんかしゃ</span>
                <span className={s.es}>Participantes</span>
              </span>
            </h3>
            {jugadores.map((j) => (
              <PlayerItem
                key={j.jugador_id}
                apodo={j.apodo}
                isYou={j.jugador_id === Number(jugadorId)}
                connected={j.connected}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
