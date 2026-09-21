/** Citizen contact + location block for staff views (corporator and admin). `showAssignee` is for the admin view. */
export default function CitizenContact({ issue, showAssignee = false }) {
  return (
    <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">
      <p className="font-medium text-slate-700">Citizen contact</p>
      <p className="mt-1">
        {issue.citizen.name} -{' '}
        <a href={`tel:${issue.citizen.phone}`} className="font-medium text-brand-700 hover:underline">{issue.citizen.phone}</a>
      </p>
      {issue.location && (
        <p className="mt-2">
          <span className="text-slate-500">Location: </span>
          <span className="font-mono">{issue.location.latitude.toFixed(6)}, {issue.location.longitude.toFixed(6)}</span>{' '}
          <a
            href={`https://www.openstreetmap.org/?mlat=${issue.location.latitude}&mlon=${issue.location.longitude}#map=18/${issue.location.latitude}/${issue.location.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            Open in OpenStreetMap
          </a>
        </p>
      )}
      {showAssignee && (
        <p className="mt-2">
          <span className="text-slate-500">Assigned to: </span>
          <span className="font-medium">{issue.assigned_to ?? 'Nobody (no corporator in this constituency)'}</span>
        </p>
      )}
    </div>
  );
}
