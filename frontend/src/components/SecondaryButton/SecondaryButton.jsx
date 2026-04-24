import s from './SecondaryButton.module.css';

export default function SecondaryButton({ disabled, onClick, children }) {
  return (
    <button className={s.btn} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
