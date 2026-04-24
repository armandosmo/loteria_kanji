import s from './DeckCounter.module.css';

export default function DeckCounter({ current, total }) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={s.container} aria-live="polite">
      <span className={s.label}>カード {current} / {total}</span>
      <div className={s.track} role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
        <div className={s.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
