import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { mdiClose } from '@mdi/js';
import Icon from '../Icon/Icon';
import s from './KanjiInfoModal.module.css';

function fmt(raw) {
  if (!raw) return '';
  return raw
    .split(/[|・/、\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

export default function KanjiInfoModal({ kanji, onClose }) {
  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!kanji) return null;

  const kun = fmt(kanji.lectura_kun);
  const on = fmt(kanji.lectura_on);

  return createPortal(
    <div className={s.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={s.card} onClick={(e) => e.stopPropagation()}>
        <button
          className={s.closeBtn}
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          <Icon path={mdiClose} size={1} />
        </button>

        <div className={s.kanjiGrande}>{kanji.caracter}</div>

        {kun && (
          <div className={s.lectura}>
            <span className={s.tag}>訓読み · Kun</span>
            <span className={s.valor}>{kun}</span>
          </div>
        )}

        {on && (
          <div className={s.lectura}>
            <span className={s.tag}>音読み · On</span>
            <span className={s.valor}>{on}</span>
          </div>
        )}

        {kanji.significado && (
          <div className={s.significado}>{kanji.significado}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
