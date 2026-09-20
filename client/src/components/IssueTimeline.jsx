import { STATUS } from '../lib/constants.js';
import { formatDateTime } from '../lib/format.js';
import PhotoGallery from './PhotoGallery.jsx';

/** Chronological update history (oldest first) for the tracking and corporator pages. */
export default function IssueTimeline({ updates }) {
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {updates.map((u, i) => (
        <li key={i} className="relative pb-6 pl-6 last:pb-0">
          <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${STATUS[u.status].dot}`} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-slate-900">{STATUS[u.status].label}</span>
            <time dateTime={u.created_at} className="text-xs text-slate-500">{formatDateTime(u.created_at)}</time>
          </div>
          <p className="text-xs text-slate-500">{u.by ? `Corporator ${u.by}` : 'Citizen'}</p>
          {u.remark && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{u.remark}</p>}
          {u.photos.length > 0 && (
            <div className="mt-2">
              <PhotoGallery photos={u.photos} size="h-16 w-16" />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
