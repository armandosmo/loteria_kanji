import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mdiArrowRight, mdiRefresh } from '@mdi/js';
import TopBar from '../../components/TopBar/TopBar';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import Icon from '../../components/Icon/Icon';
import BilingualLabel from '../../components/BilingualLabel/BilingualLabel';
import s from './Join.module.css';

export default function Join() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(
    () => localStorage.getItem('nombre') || ''
  );
  const [estado, setEstado] = useState('idle'); // 'idle' | 'buscando' | 'vacio' | 'uniendo' | 'error'
  const [errMsg, setErrMsg] = useState('');
  const intentoRef = useRef(0);

  const trimmed = nombre.trim();
  const nombreValido = trimmed.length >= 1 && trimmed.length <= 20;

  const intentar = useCallback(async () => {
    if (!nombreValido) return;
    intentoRef.current += 1;
    const intento = intentoRef.current;
    setEstado('buscando');
    setErrMsg('');
    localStorage.setItem('nombre', trimmed);

    try {
      const res = await fetch('/api/partidas/disponibles');
      if (!res.ok) throw new Error('fetch');
      const partidas = await res.json();

      if (intento !== intentoRef.current) return; // stale

      if (!partidas || partidas.length === 0) {
        setEstado('vacio');
        return;
      }

      // 1 o más → usar la más reciente (la primera de la lista, ya viene ordenada)
      const partida = partidas[0];
      setEstado('uniendo');

      const r2 = await fetch(`/api/partidas/${partida.partida_id}/unirse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apodo: trimmed }),
      });
      if (!r2.ok) {
        const data = await r2.json().catch(() => ({}));
        setErrMsg(data.detail || 'No se pudo unir a la partida');
        setEstado('error');
        return;
      }
      const { jugador_id } = await r2.json();
      localStorage.setItem('partida_id', String(partida.partida_id));
      localStorage.setItem('jugador_id', String(jugador_id));
      localStorage.setItem('role', 'player');
      navigate('/lobby');
    } catch {
      setErrMsg('Error de conexión');
      setEstado('error');
    }
  }, [navigate, nombreValido, trimmed]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && nombreValido && estado !== 'buscando' && estado !== 'uniendo') {
      intentar();
    }
  };

  const buscando = estado === 'buscando' || estado === 'uniendo';

  return (
    <div className={s.page}>
      <TopBar
        title={
          <span className={s.bilingualTitle}>
            <span className={s.jp}>ルームにさんか</span>
            <span className={s.es}>Unirse a sala</span>
          </span>
        }
        showBack
        darkToggle
        onBack={() => navigate('/')}
      />

      <div className={s.content}>
        <section className={s.nameSection}>
          <label className={s.nameLabel}>
            <span className={s.bilingualTitle}>
              <span className={s.jp}>なまえ</span>
              <span className={s.es}>Tu nombre</span>
            </span>
          </label>
          <input
            className={s.nameInput}
            type="text"
            placeholder="Ej: Marga"
            maxLength={20}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <div className={s.searchBtn}>
            <PrimaryButton
              variant="dark"
              disabled={!nombreValido || buscando}
              onClick={intentar}
            >
              {estado === 'buscando' || estado === 'uniendo' ? (
                estado === 'buscando' ? (
                  <BilingualLabel
                    jp="さがしています..."
                    es="Buscando partida..."
                  />
                ) : 'Uniéndote…'
              ) : (
                <BilingualLabel
                  jp="さんか！"
                  es="¡Unirse!"
                  icon={<Icon path={mdiArrowRight} size={0.9} color="var(--paper)" />}
                />
              )}
            </PrimaryButton>
          </div>
        </section>

        {estado === 'vacio' && (
          <div className={s.empty}>
            <div className={s.bilingualTitle} style={{ alignItems: 'center' }}>
              <span className={s.jp}>パーティーがありません</span>
              <span className={s.es}>No hay partidas. Pide al Gritón que cree una.</span>
            </div>
            <div className={s.retryWrap}>
              <PrimaryButton variant="dark" onClick={intentar}>
                <BilingualLabel
                  jp="もういちど"
                  es="Reintentar"
                  icon={<Icon path={mdiRefresh} size={0.9} color="var(--paper)" />}
                />
              </PrimaryButton>
            </div>
          </div>
        )}

        {estado === 'error' && (
          <div className={s.empty}>
            <p className={s.emptyTitle}>{errMsg || 'Error'}</p>
            <div className={s.retryWrap}>
              <PrimaryButton variant="dark" onClick={intentar}>
                <BilingualLabel
                  jp="もういちど"
                  es="Reintentar"
                  icon={<Icon path={mdiRefresh} size={0.9} color="var(--paper)" />}
                />
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
