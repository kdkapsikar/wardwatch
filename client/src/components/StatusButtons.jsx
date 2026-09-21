import { useT } from '../i18n/LanguageContext.jsx';
import { CORPORATOR_STATUSES, STATUS } from '../lib/constants.js';

/**
 * One-tap status picker (replaces a dropdown). Tap a status to select it, tap again to clear it.
 * The issue's current status is shown but not selectable. `value` is '' when no change is chosen.
 */
export default function StatusButtons({ value, onChange, current, disabled }) {
  const { t, statusLabel } = useT();
  return (
    <div role="radiogroup" aria-label={t('status.newStatus')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CORPORATOR_STATUSES.map((s) => {
        const isCurrent = s === current;
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || isCurrent}
            onClick={() => onChange(selected ? '' : s)}
            className={`flex flex-col items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
              selected
                ? STATUS[s].solid
                : isCurrent
                  ? 'cursor-default border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {statusLabel(s)}
            {isCurrent && <span className="text-[10px] font-medium uppercase tracking-wide">{t('common.current')}</span>}
          </button>
        );
      })}
    </div>
  );
}
