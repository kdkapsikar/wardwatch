import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import CitizenContact from '../../components/CitizenContact.jsx';
import FormField from '../../components/ui/FormField.jsx';
import IssueDetails from '../../components/IssueDetails.jsx';
import IssueTimeline from '../../components/IssueTimeline.jsx';
import PhotoUploader from '../../components/PhotoUploader.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusButtons from '../../components/StatusButtons.jsx';
import { REJECTION_SUGGESTIONS } from '../../lib/constants.js';

const OPEN = ['submitted', 'acknowledged', 'in_progress'];

function UpdateForm({ issue, onUpdated }) {
  const { t, statusLabel } = useT();
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
      if (!r) problems.rejection_reason = t('upd.err.reasonRequired');
      else if (r.length < 5) problems.rejection_reason = t('upd.err.reasonMin');
    }
    if (!status && !remark.trim() && photos.length === 0) problems.remark = t('upd.err.nothing');
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
      <h2 className="text-lg font-semibold">{t('upd.title')}</h2>
      <Alert>{formError}</Alert>
      <Alert tone="success">{saved && t('upd.saved')}</Alert>

      <div>
        <span className="label">{t('upd.changeStatus')} <span className="font-normal text-slate-400">{t('upd.currently', { status: statusLabel(issue.status) })}</span></span>
        <StatusButtons value={status} onChange={pickStatus} current={issue.status} disabled={submitting} />
      </div>

      {rejecting && (
        <div className="space-y-4 rounded-lg border border-rose-200 bg-rose-50/60 p-4">
          <FormField label={t('upd.reason')} required error={errors.rejection_reason} hint={t('upd.reasonHint')}>
            {(p) => (
              <textarea {...p} rows={3} value={reason} maxLength={500} placeholder={t('upd.reasonPlaceholder')}
                onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, rejection_reason: undefined })); }} />
            )}
          </FormField>
          <div className="flex flex-wrap gap-2" aria-label={t('upd.commonReasons')}>
            {REJECTION_SUGGESTIONS.map((key) => {
              const text = t(`reject.suggestion.${key}`);
              return (
              <button
                key={key}
                type="button"
                onClick={() => { setReason(text); setErrors((x) => ({ ...x, rejection_reason: undefined })); }}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
              >
                {text}
              </button>
              );
            })}
          </div>
          <div>
            <span className="label">{t('upd.proof')} <span className="font-normal text-slate-400">{t('upd.proofOptional')}</span></span>
            <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
          </div>
        </div>
      )}

      <FormField label={rejecting ? t('upd.remarkAdditional') : t('upd.remark')} optional error={errors.remark} hint={t('upd.remarkHint')}>
        {(p) => <textarea {...p} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={1000} />}
      </FormField>

      {!rejecting && (
        <div>
          <span className="label">{t('report.photos')} <span className="font-normal text-slate-400">{t('common.optional')}</span></span>
          <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`btn ${rejecting ? 'bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary'}`}
      >
        {submitting ? t('upd.saving') : t(`upd.submit.${status || 'none'}`)}
      </button>
    </form>
  );
}

function TransferPanel({ issue }) {
  const navigate = useNavigate();
  const { t, wardName } = useT();
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
      setErrors({ ward_id: t('xfer.err.choose') });
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
      navigate('/corporator/issues', { state: { flash: t('xfer.flash', { id: issue.public_id, n: to.number }) } });
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
          <h2 className="font-semibold">{t('xfer.card.title')}</h2>
          <p className="text-sm text-slate-600">{t('xfer.card.text')}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">{t('xfer.open')}</button>
      </section>
    );
  }

  return (
    <form onSubmit={review} className="card space-y-4 p-5 sm:p-6" noValidate>
      <h2 className="text-lg font-semibold">{t('xfer.open')}</h2>
      <Alert>{formError}</Alert>
      {!targets && !formError && <Spinner label={t('xfer.loading')} />}
      {targets && targets.length === 0 && (
        <Alert tone="info">{t('xfer.noTargets')}</Alert>
      )}
      {targets && targets.length > 0 && (
        <>
          <FormField label={t('xfer.to')} required error={errors.ward_id}>
            {(p) => (
              <select {...p} value={wardId} disabled={confirming || submitting} onChange={(e) => { setWardId(e.target.value); setErrors({}); }}>
                <option value="">{t('xfer.select')}</option>
                {targets.map((w) => <option key={w.id} value={w.id}>{t('detail.constituencyValue', { n: w.number, name: wardName(w) })}</option>)}
              </select>
            )}
          </FormField>
          <FormField label={t('xfer.note')} optional hint={t('xfer.noteHint')}>
            {(p) => <textarea {...p} rows={2} value={note} maxLength={500} disabled={confirming || submitting} onChange={(e) => setNote(e.target.value)} />}
          </FormField>

          {confirming ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
              <p>{t('xfer.confirm', { target: t('timeline.constituency', { n: target.number }) })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={confirm} disabled={submitting} className="btn bg-violet-600 text-white hover:bg-violet-700">
                  {submitting ? t('xfer.doing') : t('xfer.yes')}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="btn btn-secondary">{t('xfer.back')}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">{t('xfer.review')}</button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">{t('xfer.cancel')}</button>
            </div>
          )}
        </>
      )}
      {targets && targets.length === 0 && (
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">{t('xfer.close')}</button>
      )}
    </form>
  );
}

export default function CorporatorIssueDetail() {
  const { id } = useParams();
  const { t } = useT();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIssue(null);
    setError('');
    api.getAssigned(id)
      .then((d) => !cancelled && setIssue(d.issue))
      .catch((e) => !cancelled && setError(e.status === 404 ? 'not_found' : e.message));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/corporator/issues" className="text-sm text-brand-700 hover:underline">{t('detail.back')}</Link>
      <Alert>{error === 'not_found' ? t('detail.notAssigned', { id }) : error}</Alert>
      {!issue && !error && <Spinner />}
      {issue && (
        <>
          <IssueDetails issue={issue}>
            <CitizenContact issue={issue} />
          </IssueDetails>
          <UpdateForm issue={issue} onUpdated={setIssue} />
          <TransferPanel issue={issue} />
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">{t('track.history')}</h2>
            <IssueTimeline updates={issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
