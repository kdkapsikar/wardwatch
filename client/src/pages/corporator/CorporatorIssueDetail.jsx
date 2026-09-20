import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import FormField from '../../components/ui/FormField.jsx';
import IssueDetails from '../../components/IssueDetails.jsx';
import IssueTimeline from '../../components/IssueTimeline.jsx';
import PhotoUploader from '../../components/PhotoUploader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { CORPORATOR_STATUSES, STATUS } from '../../lib/constants.js';

function UpdateForm({ issue, onUpdated }) {
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError('');
    setSaved(false);
    setSubmitting(true);
    const form = new FormData();
    if (status) form.append('status', status);
    form.append('remark', remark);
    photos.forEach((f) => form.append('photos', f));
    try {
      const { issue: updated } = await api.postUpdate(issue.public_id, form);
      setStatus('');
      setRemark('');
      setPhotos([]);
      setSaved(true);
      onUpdated(updated);
    } catch (err) {
      setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5 sm:p-6" noValidate>
      <h2 className="text-lg font-semibold">Post an update</h2>
      <Alert>{formError}</Alert>
      <Alert tone="success">{saved && 'Update posted. The citizen can now see it.'}</Alert>

      <FormField label="Status" error={errors.status}>
        {(p) => (
          <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Keep current ({STATUS[issue.status].label})</option>
            {CORPORATOR_STATUSES.filter((s) => s !== issue.status).map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Remark" error={errors.remark} hint="Visible to the citizen. Required when resolving or rejecting.">
        {(p) => <textarea {...p} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={1000} />}
      </FormField>

      <div>
        <span className="label">Photos <span className="font-normal text-slate-400">(optional)</span></span>
        <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Posting...' : 'Post update'}</button>
    </form>
  );
}

export default function CorporatorIssueDetail() {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIssue(null);
    setError('');
    api.getAssigned(id)
      .then((d) => !cancelled && setIssue(d.issue))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/corporator" className="text-sm text-brand-700 hover:underline">&larr; Back to assigned issues</Link>
      <Alert>{error}</Alert>
      {!issue && !error && <Spinner />}
      {issue && (
        <>
          <IssueDetails issue={issue}>
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
            </div>
          </IssueDetails>
          <UpdateForm issue={issue} onUpdated={setIssue} />
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">Update history</h2>
            <IssueTimeline updates={issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
