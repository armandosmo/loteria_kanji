import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mdiWeatherNight, mdiWeatherSunny, mdiPlus, mdiAccountArrowRight } from '@mdi/js';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton/SecondaryButton';
import Icon from '../../components/Icon/Icon';
import BilingualLabel from '../../components/BilingualLabel/BilingualLabel';
import { useDarkMode } from '../../hooks/useDarkMode';
import s from './Landing.module.css';

const KANJI_LOGO = [
  { ch: '漢', cls: 'kanjiA' },
  { ch: '字', cls: 'kanjiB' },
];

const LOTERIA_LOGO = [
  { ch: 'ロ', cls: 'kana1' },
  { ch: 'テ', cls: 'kana2' },
  { ch: 'リ', cls: 'kana3' },
  { ch: 'ア', cls: 'kana4' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { dark, toggle } = useDarkMode();

  const handleCrear = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/partidas', { method: 'POST' });
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.detail ||
            'Ya hay una partida en curso. Únete en lugar de crear.'
        );
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const { partida_id, jugador_id, griton_token } = await res.json();
      // El Gritón usa keys propias para no chocar con el flujo de jugador
      // si se prueba en el mismo navegador.
      localStorage.setItem('griton_partida_id', String(partida_id));
      localStorage.setItem('griton_jugador_id', String(jugador_id));
      if (griton_token) localStorage.setItem('griton_token', griton_token);
      localStorage.setItem('role', 'griton');
      navigate('/host');
    } catch {
      setError('Error de conexión con el servidor');
      setLoading(false);
    }
  };

  const handleUnirse = () => {
    navigate('/join');
  };

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

      <div className={s.kanjiLogo}>
        {KANJI_LOGO.map((c, i) => (
          <div
            key={c.ch}
            className={`${s.kanjiCell} ${s[c.cls]} ${s[`celda${i}`]}`}
          >
            {c.ch}
          </div>
        ))}
      </div>

      <div className={s.kanaLogo}>
        {LOTERIA_LOGO.map((c, i) => (
          <div
            key={c.ch}
            className={`${s.kanaCell} ${s[c.cls]} ${s[`celda${i + 2}`]}`}
          >
            {c.ch}
          </div>
        ))}
      </div>

      <div className={s.actions}>
        <div className={s.action}>
          <PrimaryButton
            variant="dark"
            disabled={loading}
            onClick={handleCrear}
          >
            <BilingualLabel
              jp="ルームさくせい"
              es="Crear sala"
              icon={<Icon path={mdiPlus} size={0.9} color="var(--paper)" />}
            />
          </PrimaryButton>
        </div>
        <div className={s.action}>
          <SecondaryButton onClick={handleUnirse}>
            <BilingualLabel
              jp="ルームにさんか"
              es="Unirse a sala"
              icon={<Icon path={mdiAccountArrowRight} size={0.9} color="var(--ink)" />}
            />
          </SecondaryButton>
        </div>
      </div>

      {error && <p className={s.hint}>{error}</p>}

      <footer className={s.credits}>
        Idea original: マルガリタさん y ガビさん
      </footer>
    </div>
  );
}
