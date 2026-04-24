import { mdiCards, mdiPartyPopper, mdiArrowRight } from '@mdi/js';
import Icon from '../Icon/Icon';
import PrimaryButton from '../PrimaryButton/PrimaryButton';
import SecondaryButton from '../SecondaryButton/SecondaryButton';
import BilingualLabel from '../BilingualLabel/BilingualLabel';
import s from './VictoryOverlay.module.css';

const PATRON_LABEL = {
  full: 'tabla completa',
  line: 'una línea',
  diagonal: 'una diagonal',
  corners: 'las esquinas',
};

export default function VictoryOverlay({
  ganadorApodo,
  patron,
  sinGanador,
  role,
  onContinuarFull,
  onContinuarMismo,
  onTerminar,
  busy,
}) {
  return (
    <div className={s.overlay}>
      <div className={s.card}>
        {sinGanador ? (
          <>
            <span className={s.emojiSmall}>
              <Icon path={mdiCards} size={2.5} color="var(--ink-soft)" />
            </span>
            <h2 className={s.titleMid}>Sin ganador esta vez</h2>
            <p className={s.subtitle}>Se cantaron las 54 cartas</p>
          </>
        ) : (
          <>
            <span className={s.emoji}>
              <Icon path={mdiPartyPopper} size={2.5} color="var(--accent)" />
            </span>
            <h2 className={s.title}>¡{ganadorApodo} ganó!</h2>
            <p className={s.subtitle}>
              Completó {PATRON_LABEL[patron] || patron}
            </p>
          </>
        )}

        <div className={s.actions}>
          {role === 'griton' ? (
            <>
              <PrimaryButton
                variant="accent"
                disabled={busy}
                onClick={onContinuarFull}
              >
                <BilingualLabel
                  jp="つづける"
                  es="Continuar · Tabla llena"
                  icon={<Icon path={mdiArrowRight} size={0.9} color="white" />}
                />
              </PrimaryButton>
              <PrimaryButton
                variant="dark"
                disabled={busy}
                onClick={onContinuarMismo}
              >
                <BilingualLabel
                  jp="そのまま"
                  es="Continuar · Mismo modo"
                  icon={<Icon path={mdiArrowRight} size={0.9} color="var(--paper)" />}
                />
              </PrimaryButton>
              <SecondaryButton disabled={busy} onClick={onTerminar}>
                <BilingualLabel
                  jp="おわる"
                  es="Terminar partida"
                />
              </SecondaryButton>
            </>
          ) : (
            <p className={s.waiting}>Esperando decisión del Gritón...</p>
          )}
        </div>
      </div>
    </div>
  );
}
