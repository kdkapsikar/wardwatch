import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext.jsx';

/** A number with a label. Pass `to` to make the whole card a drill-down link. */
export default function StatCard({ label, value, hint, tone = 'text-slate-900', to }) {
  const { t } = useT();
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  if (!to) return <div className="card p-4">{body}</div>;
  return (
    <Link
      to={to}
      aria-label={t('dash.viewThese', { label, n: value })}
      className="card block p-4 transition hover:border-brand-600 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
    >
      {body}
      <p className="mt-1 text-xs font-medium text-brand-700">{t('dash.viewIssues')}</p>
    </Link>
  );
}
