import s from './PrimaryButton.module.css';

export default function PrimaryButton({ variant = 'dark', disabled, onClick, children }) {
  return (
    <button
      className={`${s.btn} ${s[variant]}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
