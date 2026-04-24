import s from './PlayerItem.module.css';

export default function PlayerItem({ apodo, role, isYou, connected }) {
  const avatarClass = isYou
    ? s.avatarYou
    : role === 'caller'
      ? s.avatarCaller
      : s.avatarPlayer;

  return (
    <div className={s.item}>
      <div className={`${s.avatar} ${avatarClass}`}>
        {apodo?.charAt(0).toUpperCase()}
      </div>
      <div className={s.info}>
        <span className={s.name}>{apodo}</span>
        <span className={`${s.dot} ${connected ? s.connected : s.disconnected}`} />
      </div>
    </div>
  );
}
