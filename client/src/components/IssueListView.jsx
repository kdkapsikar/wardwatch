import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';
import Alert from './ui/Alert.jsx';
import Spinner from './ui/Spinner.jsx';
import StatusBadge from './ui/StatusBadge.jsx';
import IllustrationPanel from './illustrations/IllustrationPanel.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { formatDate } from '../lib/format.js';

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts?.[k] ?? 0), 0);
const OPEN = ['submitted', 'acknowledged', 'in_progress'];

// Status filter chips. The URL parameters (status / category / overdue / ward) drive everything, so
// dashboard drill-downs, links and the browser's back button all just work.
const CHIPS = [
  { key: 'open', count: (c) => sum(c, OPEN) },
  { key: 'submitted', count: (c) => sum(c, ['submitted']) },
  { key: 'acknowledged', count: (c) => sum(c, ['acknowledged']) },
  { key: 'in_progress', count: (c) => sum(c, ['in_progress']) },
  { key: 'resolved', count: (c) => sum(c, ['resolved']) },
  { key: 'rejected', count: (c) => sum(c, ['rejected']) },
  { key: 'all', count: (c) => sum(c, [...OPEN, 'resolved', 'rejected']) },
]; // labels: chip.<key> in the dictionaries

/**
 * Filterable, paged issue list shared by the corporator inbox (scope "corporator") and the
 * mayor/admin city-wide list (scope "admin", which also shows constituency + corporator per row).
 */
export default function IssueListView({ scope, title, subtitle, illustration }) {
  const admin = scope === 'admin';
  const { t, categoryLabel, personName } = useT();
  const base = admin ? '/admin/issues' : '/corporator/issues';
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const status = CHIPS.some((c) => c.key === params.get('status')) ? params.get('status') : 'open';
  const category = CATEGORIES.some((c) => c.value === params.get('category')) ? params.get('category') : '';
  const overdue = params.get('overdue') === '1';
  const ward = admin ? Number(params.get('ward')) || 0 : 0;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    const fetcher = admin ? api.getAdminIssues : api.listAssigned;
    fetcher({ status, category, overdue, ward, page })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [admin, status, category, overdue, ward, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const go = (next = {}) => {
    const merged = { status, ...(category && { category }), ...(overdue && { overdue: '1' }), ...(ward && { ward: String(ward) }), ...next };
    if (merged.status === 'open') delete merged.status; // 'open' is the default
    Object.keys(merged).forEach((k) => (merged[k] === undefined || merged[k] === '') && delete merged[k]);
    setParams(merged);
  };
  const removable = 'rounded-full px-3 py-1 font-medium';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {illustration && <IllustrationPanel>{illustration}</IllustrationPanel>}
      </div>

      <Alert tone="success">{location.state?.flash}</Alert>

      <div role="group" aria-label={t('list.filterByStatus')} className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={status === c.key}
            onClick={() => go({ status: c.key, page: undefined })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              status === c.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {t(`chip.${c.key}`)}
            {data && <span className="ml-1.5 tabular-nums opacity-80">{c.count(data.counts)}</span>}
          </button>
        ))}
      </div>

      {(category || overdue || ward > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{t('list.filteredBy')}</span>
          {category && (
            <button type="button" onClick={() => go({ category: undefined, page: undefined })} className={`${removable} bg-brand-50 text-brand-800 hover:bg-brand-100`} aria-label={t('list.removeCategory', { name: categoryLabel(category) })}>
              {categoryLabel(category)} &times;
            </button>
          )}
          {ward > 0 && (
            <button type="button" onClick={() => go({ ward: undefined, page: undefined })} className={`${removable} bg-brand-50 text-brand-800 hover:bg-brand-100`} aria-label={t('list.removeWard', { n: ward })}>
              {t('list.constituencyChip', { n: ward })} &times;
            </button>
          )}
          {overdue && (
            <button type="button" onClick={() => go({ overdue: undefined, page: undefined })} className={`${removable} bg-amber-50 text-amber-800 hover:bg-amber-100`} aria-label={t('list.removeOverdue')}>
              {t('list.overdue')} &times;
            </button>
          )}
        </div>
      )}

      <Alert>{error}</Alert>
      {!data && !error && <Spinner />}

      {data && data.issues.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">{t('list.empty')}</div>
      )}

      {data && data.issues.length > 0 && (
        <ul className="card divide-y divide-slate-100">
          {data.issues.map((issue) => (
            <li key={issue.public_id}>
              <Link to={`${base}/${issue.public_id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{issue.title}</p>
                  <p className="text-xs text-slate-500">
                    {t('list.reported', { id: issue.public_id, category: categoryLabel(issue.category), date: formatDate(issue.created_at) })}
                  </p>
                  {admin && (
                    <p className="text-xs text-slate-500">
                      {t('list.wardLine', { n: issue.ward.number, who: issue.corporator_name ? personName(issue.corporator_name) : t('list.unassigned') })}
                    </p>
                  )}
                </div>
                <StatusBadge status={issue.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label={t('list.pagination')}>
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>{t('list.prev')}</button>
          <span className="text-slate-600">{t('list.pageOf', { page, pages })}</span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}>{t('list.next')}</button>
        </nav>
      )}
    </div>
  );
}
