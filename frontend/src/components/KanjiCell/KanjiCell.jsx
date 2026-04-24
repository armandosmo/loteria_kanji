import { useRef, useEffect } from 'react';
import { mdiInformationOutline } from '@mdi/js';
import Icon from '../Icon/Icon';
import s from './KanjiCell.module.css';

const COLOR_CLASSES = {
  1: s.color1,
  2: s.color2,
  3: s.color3,
  4: s.color4,
  5: s.color5,
};

const TAP_DELAY = 250; // ms para distinguir tap simple vs doble tap

// En mobile el onClick sintético se dispara después de touchend → bloquearlo
// para no doblar el handler. En desktop usamos onClick.
const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function KanjiCell({
  kanji,
  kanji_id,
  colorIndex,
  marked,
  onToggle,
  onDoubleTap,
  readOnly,
  lectura_kun,
  lectura_on,
  significado,
  modoAprendizaje,
}) {
  const tapTimer = useRef(null);

  const colorClass = marked ? s.marked : COLOR_CLASSES[colorIndex] || s.color1;
  const hasReadings = !!(lectura_kun || lectura_on || significado);
  const showHint = modoAprendizaje && hasReadings && !readOnly;

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const handleTap = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (readOnly) return;

    if (tapTimer.current) {
      // Segundo tap dentro de TAP_DELAY → doble tap
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (modoAprendizaje && onDoubleTap) {
        onDoubleTap({
          kanji_id,
          caracter: kanji,
          lectura_kun,
          lectura_on,
          significado,
        });
      }
      return;
    }

    // Primer tap → esperar para ver si viene un segundo
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onToggle();
    }, TAP_DELAY);
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={`${s.cell} ${colorClass} ${readOnly ? s.readOnly : ''}`}
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-label={`${kanji}${marked ? ' マーク済み' : ''}`}
      onTouchEnd={isTouchDevice ? handleTap : undefined}
      onClick={!isTouchDevice ? handleTap : undefined}
      onKeyDown={handleKeyDown}
    >
      <span className={s.kanji}>{kanji}</span>
      {showHint && (
        <Icon
          path={mdiInformationOutline}
          size={0.75}
          color="var(--ink)"
          className={s.infoHint}
        />
      )}
      {marked && <span className={s.dot} />}
    </div>
  );
}
