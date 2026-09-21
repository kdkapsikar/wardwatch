import { useT } from '../i18n/LanguageContext.jsx';
import { formatDateTime } from '../lib/format.js';
import PhotoGallery from './PhotoGallery.jsx';
import StatusBadge from './ui/StatusBadge.jsx';

/** Read-only issue card shared by the public tracking page and the corporator detail page. */
export default function IssueDetails({ issue, children }) {
  const { t, categoryLabel, wardName } = useT();
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold tracking-wider text-brand-700">{issue.public_id}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{issue.title}</h2>
        </div>
        <StatusBadge status={issue.status} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">{t('detail.constituency')}</dt><dd className="font-medium">{t('detail.constituencyValue', { n: issue.ward.number, name: wardName(issue.ward) })}</dd></div>
        <div><dt className="text-slate-500">{t('detail.category')}</dt><dd className="font-medium">{categoryLabel(issue.category)}</dd></div>
        <div><dt className="text-slate-500">{t('detail.reported')}</dt><dd className="font-medium">{formatDateTime(issue.created_at)}</dd></div>
        <div><dt className="text-slate-500">{t('detail.updated')}</dt><dd className="font-medium">{formatDateTime(issue.updated_at)}</dd></div>
        {issue.address && (
          <div className="sm:col-span-2"><dt className="text-slate-500">{t('detail.address')}</dt><dd className="font-medium">{issue.address}</dd></div>
        )}
      </dl>

      <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{issue.description}</p>
      {issue.photos.length > 0 && <div className="mt-4"><PhotoGallery photos={issue.photos} /></div>}
      {children}
    </section>
  );
}
