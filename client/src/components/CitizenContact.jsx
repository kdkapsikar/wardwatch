import { useT } from '../i18n/LanguageContext.jsx';
import IssueLocationMap from './IssueLocationMap.jsx';

/** Citizen contact + location block for staff views (corporator and admin). `showAssignee` is for the admin view. */
export default function CitizenContact({ issue, showAssignee = false }) {
  const { t, personName } = useT();
  return (
    <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">
      <p className="font-medium text-slate-700">{t('contact.title')}</p>
      <p className="mt-1">
        {issue.citizen.name} -{' '}
        <a href={`tel:${issue.citizen.phone}`} className="font-medium text-brand-700 hover:underline">{issue.citizen.phone}</a>
      </p>
      {issue.location && (
        <div className="mt-2">
          <p>
            <span className="text-slate-500">{t('contact.location')} </span>
            <span className="font-mono">{issue.location.latitude.toFixed(6)}, {issue.location.longitude.toFixed(6)}</span>{' '}
            <a
              href={`https://www.openstreetmap.org/?mlat=${issue.location.latitude}&mlon=${issue.location.longitude}#map=18/${issue.location.latitude}/${issue.location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 hover:underline"
            >
              {t('contact.osm')}
            </a>
          </p>
          <IssueLocationMap latitude={issue.location.latitude} longitude={issue.location.longitude} />
        </div>
      )}
      {showAssignee && (
        <p className="mt-2">
          <span className="text-slate-500">{t('contact.assignedTo')} </span>
          <span className="font-medium">{issue.assigned_to ? personName(issue.assigned_to) : t('contact.unassigned')}</span>
        </p>
      )}
    </div>
  );
}
