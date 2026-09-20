import { categoryLabel } from '../lib/constants.js';
import { formatDateTime } from '../lib/format.js';
import PhotoGallery from './PhotoGallery.jsx';
import StatusBadge from './ui/StatusBadge.jsx';

/** Read-only issue card shared by the public tracking page and the corporator detail page. */
export default function IssueDetails({ issue, children }) {
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
        <div><dt className="text-slate-500">Ward</dt><dd className="font-medium">Ward {issue.ward.number} - {issue.ward.name}</dd></div>
        <div><dt className="text-slate-500">Category</dt><dd className="font-medium">{categoryLabel(issue.category)}</dd></div>
        <div><dt className="text-slate-500">Reported</dt><dd className="font-medium">{formatDateTime(issue.created_at)}</dd></div>
        <div><dt className="text-slate-500">Last updated</dt><dd className="font-medium">{formatDateTime(issue.updated_at)}</dd></div>
        {issue.address && (
          <div className="sm:col-span-2"><dt className="text-slate-500">Address / landmark</dt><dd className="font-medium">{issue.address}</dd></div>
        )}
      </dl>

      <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{issue.description}</p>
      {issue.photos.length > 0 && <div className="mt-4"><PhotoGallery photos={issue.photos} /></div>}
      {children}
    </section>
  );
}
