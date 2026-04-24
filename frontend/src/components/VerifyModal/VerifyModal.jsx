import { useState } from 'react';
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiCheck,
  mdiClose,
} from '@mdi/js';
import Icon from '../Icon/Icon';
import s from './VerifyModal.module.css';
import PrimaryButton from '../PrimaryButton/PrimaryButton';
import SecondaryButton from '../SecondaryButton/SecondaryButton';

export default function VerifyModal({ jugador, carton, marcadas, cantados, onValidar, onRechazar }) {
  const [page, setPage] = useState(0);
  const solicitudes = Array.isArray(jugador) ? jugador : [jugador];
  const current = solicitudes[page];
  const currentCarton = Array.isArray(carton[0]) ? carton[page] : carton;
  const currentMarcadas = Array.isArray(marcadas[0]) ? marcadas[page] : marcadas;

  const cantadosSet = new Set(cantados);
  const gridSize = Math.round(Math.sqrt(currentCarton.length));

  const allMarkedWereCalled = currentMarcadas.every((id) => cantadosSet.has(id));

  return (
    <div className={s.overlay}>
      <div className={s.card}>
        <div className={s.header}>ロテリア検証</div>
        <div className={s.subheader}>{current} のカルトン</div>

        {solicitudes.length > 1 && (
          <div className={s.pager}>
            <button
              className={s.pagerBtn}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <Icon path={mdiChevronLeft} size={1} />
            </button>
            <span className={s.pagerLabel}>{page + 1} / {solicitudes.length}</span>
            <button
              className={s.pagerBtn}
              onClick={() => setPage((p) => Math.min(solicitudes.length - 1, p + 1))}
              disabled={page === solicitudes.length - 1}
            >
              <Icon path={mdiChevronRight} size={1} />
            </button>
          </div>
        )}

        <div
          className={s.miniBoard}
          style={{ gridTemplateColumns: `repeat(${gridSize}, 40px)` }}
        >
          {currentCarton.map((celda) => {
            const isMarked = currentMarcadas.includes(celda.kanji_id);
            const wasCalled = cantadosSet.has(celda.kanji_id);
            let borderClass = s.unmarked;
            if (isMarked) {
              borderClass = wasCalled ? s.valid : s.invalid;
            }

            return (
              <div key={celda.kanji_id} className={`${s.miniCell} ${borderClass}`}>
                {celda.caracter}
              </div>
            );
          })}
        </div>

        <div className={`${s.indicator} ${allMarkedWereCalled ? s.indicatorValid : s.indicatorInvalid}`}>
          <Icon path={allMarkedWereCalled ? mdiCheck : mdiClose} size={0.85} />
          &nbsp;{allMarkedWereCalled ? 'パターン有効' : '無効なマークあり'}
        </div>

        <div className={s.actions}>
          <SecondaryButton onClick={() => onRechazar(current)}>
            却下
          </SecondaryButton>
          <PrimaryButton variant="accent" onClick={() => onValidar(current)}>
            承認
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
