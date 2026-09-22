import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { formatDate } from '../../lib/format.js';

/** A citizen's own issues - basic details only, no filters or dashboard: just "what did I report, and where does it stand". */
export default function CitizenIssues() {
  const { t, categoryLabel, wardName } = useT();
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listMyIssues().then((d) => setIssues(d.issues)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('citizen.list.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('citizen.list.subtitle')}</p>
      </div>

      <Alert>{error}</Alert>
      {!issues && !error && <Spinner />}

      {issues && issues.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">
          <p>{t('citizen.list.empty')}</p>
          <Link to="/report" className="mt-3 inline-block font-medium text-brand-700 hover:underline">{t('nav.report')} &rarr;</Link>
        </div>
      )}

      {issues && issues.length > 0 && (
        <ul className="card divide-y divide-slate-100">
          {issues.map((issue) => (
            <li key={issue.public_id}>
              <Link to={`/my/issues/${issue.public_id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{issue.title}</p>
                  <p className="text-xs text-slate-500">
                    {t('list.reported', { id: issue.public_id, category: categoryLabel(issue.category), date: formatDate(issue.created_at) })}
                  </p>
                  <p className="text-xs text-slate-500">{t('list.constituencyChip', { n: issue.ward.number })} - {wardName(issue.ward)}</p>
                </div>
                <StatusBadge status={issue.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
