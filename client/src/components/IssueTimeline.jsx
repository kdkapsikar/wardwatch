import { STATUS } from '../lib/constants.js';
import { formatDateTime } from '../lib/format.js';
import PhotoGallery from './PhotoGallery.jsx';

const constituency = (c) => `Constituency ${c.number}`;

/** Chronological update history (oldest first) for the tracking and corporator pages. */
export default function IssueTimeline({ updates }) {
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {updates.map((u, i) => {
        const transfer = u.event === 'transfer';
        const rejected = u.status === 'rejected' && !transfer;
        return (
          <li key={i} className="relative pb-6 pl-6 last:pb-0">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${transfer ? 'bg-violet-500' : STATUS[u.status].dot}`} />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-slate-900">{transfer ? 'Transferred' : STATUS[u.status].label}</span>
              <time dateTime={u.created_at} className="text-xs text-slate-500">{formatDateTime(u.created_at)}</time>
            </div>
            <p className="text-xs text-slate-500">{u.by ? `Corporator ${u.by}` : 'Citizen'}</p>

            {transfer && (
              <p className="mt-1 text-sm text-slate-700">
                Moved from <strong>{constituency(u.transfer.from)}</strong> to <strong>{constituency(u.transfer.to)}</strong>
                . The corporator there will pick it up.
              </p>
            )}
            {u.rejection_reason && (
              <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                <span className="font-semibold">Reason for rejection: </span>
                <span className="whitespace-pre-line">{u.rejection_reason}</span>
              </div>
            )}
            {u.remark && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{u.remark}</p>}
            {u.photos.length > 0 && (
              <div className="mt-2">
                {rejected && <p className="mb-1 text-xs font-medium text-slate-500">Proof</p>}
                <PhotoGallery photos={u.photos} size="h-16 w-16" />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
