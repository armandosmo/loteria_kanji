import { useNavigate } from 'react-router-dom';
import {
  mdiChevronLeft,
  mdiClose,
  mdiWeatherNight,
  mdiWeatherSunny,
  mdiSchool,
} from '@mdi/js';
import Icon from '../Icon/Icon';
import { useDarkMode } from '../../hooks/useDarkMode';
import s from './TopBar.module.css';

export default function TopBar({
  title,
  showBack,
  onBack,
  right,
  exitButton,
  darkToggle,
  learningMode,
}) {
  const navigate = useNavigate();
  const { dark, toggle } = useDarkMode();

  const handleExit = async () => {
    if (!window.confirm('パーティーをでますか？\n¿Salir de la partida?')) return;

    const role = localStorage.getItem('role');
    const isCaller = role === 'griton';
    const partidaId = isCaller
      ? localStorage.getItem('griton_partida_id')
      : localStorage.getItem('partida_id');
    const jugadorId = isCaller
      ? localStorage.getItem('griton_jugador_id')
      : localStorage.getItem('jugador_id');

    // Si soy Gritón, cerrar la partida (notifica a todos los jugadores).
    if (isCaller && partidaId && jugadorId) {
      try {
        await fetch(`/api/partidas/${partidaId}/finalizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ griton_id: Number(jugadorId) }),
        });
      } catch {
        /* aún así limpiamos local y salimos */
      }
    }

    if (isCaller) {
      localStorage.removeItem('griton_partida_id');
      localStorage.removeItem('griton_jugador_id');
      localStorage.removeItem('griton_token');
    } else {
      localStorage.removeItem('partida_id');
      localStorage.removeItem('jugador_id');
    }
    localStorage.removeItem('role');
    navigate('/');
  };

  return (
    <header className={s.bar}>
      <div className={s.left}>
        {exitButton && (
          <button className={s.exit} onClick={handleExit} aria-label="Salir">
            <Icon path={mdiClose} size={1.1} color="var(--ink)" />
          </button>
        )}
        {showBack && !exitButton && (
          <button className={s.back} onClick={onBack} aria-label="戻る">
            <Icon path={mdiChevronLeft} size={1.1} color="var(--ink)" />
          </button>
        )}
        <span className={s.title}>{title}</span>
        {learningMode && (
          <span className={s.learningBadge} aria-label="Modo aprendizaje activo">
            <Icon path={mdiSchool} size={0.7} color="var(--accent)" />
            &nbsp;Aprendizaje
          </span>
        )}
      </div>
      <div className={s.right}>
        {right}
        {darkToggle && (
          <button
            className={s.themeBtn}
            onClick={toggle}
            aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
            title={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            <Icon path={dark ? mdiWeatherSunny : mdiWeatherNight} size={0.85} />
          </button>
        )}
      </div>
    </header>
  );
}
