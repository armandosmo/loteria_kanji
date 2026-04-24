import { mdiBell } from '@mdi/js';
import Icon from '../Icon/Icon';
import s from './AlertBell.module.css';

export default function AlertBell({ active, count, onClick }) {
  return (
    <button
      className={`${s.bell} ${active ? s.active : s.inactive}`}
      onClick={onClick}
      aria-label={`通知${count ? ` ${count}件` : ''}`}
    >
      <Icon path={mdiBell} size={0.9} color={active ? 'white' : 'var(--ink-soft)'} />
      {count > 0 && <span className={s.count}>{count}</span>}
    </button>
  );
}
