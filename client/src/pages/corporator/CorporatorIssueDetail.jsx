import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import FormField from '../../components/ui/FormField.jsx';
import IssueDetails from '../../components/IssueDetails.jsx';
import IssueTimeline from '../../components/IssueTimeline.jsx';
import PhotoUploader from '../../components/PhotoUploader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusButtons from '../../components/StatusButtons.jsx';
import { REJECTION_SUGGESTIONS, STATUS } from '../../lib/constants.js';

const OPEN = ['submitted', 'acknowledged', 'in_progress'];

const SUBMIT_LABEL = {
  '': 'Post update',
  acknowledged: 'Mark as acknowledged',
  in_progress: 'Mark as in progress',
  resolved: 'Mark as resolved',
  rejected: 'Reject issue',
};

function UpdateForm({ issue, onUpdated }) {
  const [status, setStatus] = useState(''); // '' = keep the current status
  const [remark, setRemark] = useState('');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rejecting = status === 'rejected';

  function pickStatus(next) {
    setStatus(next);
    setErrors({});
    setFormError('');
    setSaved(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    setFormError('');

    const problems = {};
    if (rejecting) {
      const r = reason.trim();
      if (!r) problems.rejection_reason = 'Enter the reason for rejecting this issue';
      else if (r.length < 5) problems.rejection_reason = 'The reason must be at least 5 characters';
    }
    if (!status && !remark.trim() && photos.length === 0) problems.remark = 'Choose a status, or add a remark or photo';
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    setErrors({});
    setSubmitting(true);
    const form = new FormData();
    if (status) form.append('status', status);
    form.append('remark', remark);
    if (rejecting) form.append('rejection_reason', reason);
    photos.forEach((f) => form.append('photos', f));
    try {
      const { issue: updated } = await api.postUpdate(issue.public_id, form);
      setStatus('');
      setRemark('');
      setReason('');
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
    <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
      <h2 className="text-lg font-semibold">Post an update</h2>
      <Alert>{formError}</Alert>
      <Alert tone="success">{saved && 'Update posted. The citizen can now see it.'}</Alert>

      <div>
        <span className="label">Change status <span className="font-normal text-slate-400">(currently {STATUS[issue.status].label})</span></span>
        <StatusButtons value={status} onChange={pickStatus} current={issue.status} disabled={submitting} />
      </div>

      {rejecting && (
        <div className="space-y-4 rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <FormField label="Reason for rejection" required error={errors.rejection_reason} hint="The citizen will see this on their tracking page.">
            {(p) => (
              <textarea {...p} rows={3} value={reason} maxLength={500} placeholder="Why can't this issue be taken forward?"
                onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, rejection_reason: undefined })); }} />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2" aria-label="Common reasons">
            {REJECTION_SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => { setReason(text); setErrors((x) => ({ ...x, rejection_reason: undefined })); }}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
              >
                {text}
              </button>
            ))}
          </div>
          <div>
            <span className="label">Proof <span className="font-normal text-slate-400">(optional - photos that support the rejection)</span></span>
            <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
          </div>
        </div>
      )}

      <FormField label={rejecting ? 'Additional remark' : 'Remark'} optional error={errors.remark} hint="Visible to the citizen.">
        {(p) => <textarea {...p} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={1000} />}
      </FormField>

      {!rejecting && (
        <div>
          <span className="label">Photos <span className="font-normal text-slate-400">(optional)</span></span>
          <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`btn ${rejecting ? 'bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary'}`}
      >
        {submitting ? 'Saving...' : SUBMIT_LABEL[status]}
      </button>
    </form>
  );
}

function TransferPanel({ issue }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState(null);
  const [wardId, setWardId] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && !targets) {
      api.getTransferTargets().then((d) => setTargets(d.wards)).catch((e) => setFormError(e.message));
    }
  }, [open, targets]);

  if (!OPEN.includes(issue.status)) return null; // only open issues can be transferred

  const target = targets?.find((w) => String(w.id) === wardId);

  function review(event) {
    event.preventDefault();
    if (!wardId) {
      setErrors({ ward_id: 'Choose a constituency' });
      return;
    }
    setErrors({});
    setConfirming(true);
  }

  async function confirm() {
    setSubmitting(true);
    setFormError('');
    try {
      const { transferred_to: to } = await api.transferIssue(issue.public_id, { ward_id: Number(wardId), note });
      navigate('/corporator/issues', { state: { flash: `Issue ${issue.public_id} was transferred to Constituency ${to.number}.` } });
    } catch (err) {
      setErrors(err.fields);
      setFormError(err.message);
      setConfirming(false);
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
        <div>
          <h2 className="font-semibold">Wrong constituency?</h2>
          <p className="text-sm text-slate-600">Transfer this issue to the corporator who should handle it.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">Transfer to another constituency</button>
      </section>
    );
  }

  return (
    <form onSubmit={review} className="card space-y-4 p-5 sm:p-6" noValidate>
      <h2 className="text-lg font-semibold">Transfer to another constituency</h2>
      <Alert>{formError}</Alert>
      {!targets && !formError && <Spinner label="Loading constituencies..." />}
      {targets && targets.length === 0 && (
        <Alert tone="info">No other constituency has an active corporator to receive a transfer.</Alert>
      )}
      {targets && targets.length > 0 && (
        <>
          <FormField label="Transfer to" required error={errors.ward_id}>
            {(p) => (
              <select {...p} value={wardId} disabled={confirming || submitting} onChange={(e) => { setWardId(e.target.value); setErrors({}); }}>
                <option value="">Select a constituency</option>
                {targets.map((w) => <option key={w.id} value={w.id}>Constituency {w.number} - {w.name}</option>)}
              </select>
            )}
          </FormField>
          <FormField label="Note" optional hint="Shown in the issue history, and helps the other corporator.">
            {(p) => <textarea {...p} rows={2} value={note} maxLength={500} disabled={confirming || submitting} onChange={(e) => setNote(e.target.value)} />}
          </FormField>

          {confirming ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              <p>
                Transfer this issue to <strong>Constituency {target.number}</strong>? It will leave your list, restart as
                &ldquo;Submitted&rdquo; for that corporator, and the citizen will see the transfer in the history.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={confirm} disabled={submitting} className="btn bg-violet-600 text-white hover:bg-violet-700">
                  {submitting ? 'Transferring...' : 'Yes, transfer'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="btn btn-secondary">Go back</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">Review transfer</button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
            </div>
          )}
        </>
      )}
      {targets && targets.length === 0 && (
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Close</button>
      )}
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
      <Link to="/corporator/issues" className="text-sm text-brand-700 hover:underline">&larr; Back to issues</Link>
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
          <TransferPanel issue={issue} />
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">Update history</h2>
            <IssueTimeline updates={issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
