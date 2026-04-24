import s from './ToggleGroup.module.css';

export default function ToggleGroup({ options, value, onChange }) {
  return (
    <div className={s.container} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${s.option} ${value === opt.value ? s.active : ''}`}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
