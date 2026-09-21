import { useT } from '../../i18n/LanguageContext.jsx';
import { STATUS } from '../../lib/constants.js';

export default function StatusBadge({ status }) {
  const { statusLabel } = useT();
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
