import s from './PatternPreview.module.css';

const PATTERNS = {
  line: (r, _c, size) => r === Math.floor(size / 2),
  diagonal: (r, c) => r === c,
  corners: (r, c, size) => (r === 0 || r === size - 1) && (c === 0 || c === size - 1),
  full: () => true,
};

export default function PatternPreview({ pattern = 'line', size = 4 }) {
  const check = PATTERNS[pattern] || PATTERNS.line;
  const cells = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          className={`${s.cell} ${check(r, c, size) ? s.on : s.off}`}
        />
      );
    }
  }

  return (
    <div
      className={s.grid}
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        width: size * 10 + (size - 1) * 2,
        height: size * 10 + (size - 1) * 2,
      }}
      aria-label={`Patrón ${pattern}`}
    >
      {cells}
    </div>
  );
}
