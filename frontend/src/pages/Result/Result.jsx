import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  mdiPartyPopper,
  mdiHandClap,
  mdiCards,
  mdiWeatherNight,
  mdiWeatherSunny,
  mdiRefresh,
  mdiExitToApp,
} from '@mdi/js';
import KanjiCell from '../../components/KanjiCell/KanjiCell';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton/SecondaryButton';
import Icon from '../../components/Icon/Icon';
import BilingualLabel from '../../components/BilingualLabel/BilingualLabel';
import { useDarkMode } from '../../hooks/useDarkMode';
import s from './Result.module.css';

function seedApodo(apodo) {
  let sum = 0;
  for (let i = 0; i < apodo.length; i++) sum += apodo.charCodeAt(i);
  return sum;
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem('role');
  const nombre = localStorage.getItem('nombre');
  const partidaId = localStorage.getItem('partida_id');
  const jugadorId = localStorage.getItem('jugador_id');
  const seed = seedApodo(nombre || '');

  const ganadorId = location.state?.ganador_id;
  const ganadorApodo = location.state?.ganador_apodo;
  const sinGanador = location.state?.sin_ganador === true;
  const miId = location.state?.mi_id || Number(jugadorId);

  const isWinner = !sinGanador && ganadorId === miId;
  const hasWinner = !sinGanador && !!ganadorId;

  const [stats, setStats] = useState(null);
  const [kanjis, setKanjis] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!partidaId) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/partidas/${partidaId}/estado?jugador_id=${jugadorId}`
        );
        if (!res.ok) return;
        const data = await res.json();

        setStats({
          cartas_cantadas: data.cartas_cantadas_count,
          tamano: data.tamano_tabla,
          patron: data.patron_victoria,
        });

        if (data.mi_carton && Array.isArray(data.mi_carton)) {
          setKanjis(
            data.mi_carton.map((item, idx) => ({
              kanji_id: typeof item === 'object' ? item.kanji_id : item,
              caracter: typeof item === 'object' ? item.caracter : '?',
              lectura_kun: typeof item === 'object' ? item.lectura_kun : '',
              lectura_on: typeof item === 'object' ? item.lectura_on : '',
              significado_es: typeof item === 'object' ? item.significado_es : '',
              colorIndex: ((idx + seed) % 5) + 1,
            }))
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [partidaId, jugadorId, seed]);

  const handleOtra = async () => {
    // Solo el Gritón puede iniciar otra partida.
    // En dev, limpia toda la BD; en prod, solo limpia el storage local.
    try {
      await fetch('/api/dev/reset', { method: 'DELETE' });
    } catch {
      /* en prod responderá 403, lo ignoramos */
    }
    localStorage.removeItem('partida_id');
    localStorage.removeItem('jugador_id');
    localStorage.removeItem('role');
    navigate('/');
  };

  const handleSalir = () => {
    localStorage.removeItem('partida_id');
    localStorage.removeItem('jugador_id');
    localStorage.removeItem('role');
    navigate('/');
  };

  const { dark, toggle } = useDarkMode();

  return (
    <div className={s.page}>
      <button
        className={s.themeBtn}
        onClick={toggle}
        aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
        title={dark ? 'Modo claro' : 'Modo oscuro'}
      >
        <Icon path={dark ? mdiWeatherSunny : mdiWeatherNight} size={0.85} />
      </button>
      {/* Hero */}
      <div
        className={s.hero}
        style={{
          background: isWinner
            ? 'var(--cell-1)'
            : hasWinner
              ? 'var(--cell-3)'
              : 'var(--paper-2)',
        }}
      >
        <span className={s.heroEmoji}>
          <Icon
            path={isWinner ? mdiPartyPopper : hasWinner ? mdiHandClap : mdiCards}
            size={2.5}
            color={isWinner ? 'var(--accent)' : 'var(--ink-soft)'}
          />
        </span>
        <h1 className={s.heroTitle}>
          {isWinner
            ? '¡Ganaste!'
            : hasWinner
              ? `${ganadorApodo} ganó`
              : 'Sin ganador'}
        </h1>
      </div>

      <div className={s.content}>
        {/* Stats */}
        {stats && (
          <section className={s.stats}>
            <div className={s.statItem}>
              <span className={s.statValue}>{stats.cartas_cantadas}</span>
              <span className={s.statLabel}>cartas cantadas</span>
            </div>
            <div className={s.statItem}>
              <span className={s.statValue}>
                {stats.tamano}×{stats.tamano}
              </span>
              <span className={s.statLabel}>tabla</span>
            </div>
            <div className={s.statItem}>
              <span className={s.statValue}>{stats.patron}</span>
              <span className={s.statLabel}>patrón</span>
            </div>
          </section>
        )}

        {/* Educational review */}
        {kanjis.length > 0 && (
          <section className={s.review}>
            <h3 className={s.sectionTitle}>Repaso</h3>
            <div className={s.reviewGrid}>
              {kanjis.map((k, idx) => (
                <div key={k.kanji_id} className={s.reviewItem}>
                  <div
                    className={s.reviewCell}
                    onClick={() =>
                      setExpanded(expanded === idx ? null : idx)
                    }
                  >
                    <KanjiCell
                      kanji={k.caracter}
                      colorIndex={k.colorIndex}
                      readOnly
                    />
                  </div>
                  {expanded === idx && (
                    <div className={s.infoCard}>
                      <span className={s.infoKun}>{k.lectura_kun}</span>
                      <span className={s.infoOn}>{k.lectura_on}</span>
                      <span className={s.infoMeaning}>
                        {k.significado_es}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className={s.actions}>
          {role === 'griton' ? (
            <PrimaryButton variant="accent" onClick={handleOtra}>
              <BilingualLabel
                jp="もういちど"
                es="Otra partida"
                icon={<Icon path={mdiRefresh} size={0.9} color="white" />}
              />
            </PrimaryButton>
          ) : (
            <PrimaryButton variant="dark" disabled>
              Esperando al Gritón...
            </PrimaryButton>
          )}
          <SecondaryButton onClick={handleSalir}>
            <BilingualLabel
              jp="でる"
              es="Salir"
              icon={<Icon path={mdiExitToApp} size={0.9} color="var(--ink)" />}
            />
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
