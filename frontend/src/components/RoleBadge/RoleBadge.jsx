import { mdiCrown, mdiAccount } from '@mdi/js';
import Icon from '../Icon/Icon';
import s from './RoleBadge.module.css';

export default function RoleBadge({ role }) {
  const isCaller = role === 'caller';
  return (
    <span className={`${s.badge} ${isCaller ? s.caller : s.player}`}>
      <Icon path={isCaller ? mdiCrown : mdiAccount} size={0.7} color="white" />
      &nbsp;{isCaller ? 'グリトン' : 'プレイヤー'}
    </span>
  );
}
