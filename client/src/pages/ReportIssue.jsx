import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Alert from '../components/ui/Alert.jsx';
import CheckboxField from '../components/ui/CheckboxField.jsx';
import FormField from '../components/ui/FormField.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { CATEGORIES } from '../lib/constants.js';
import { validateReport } from '../lib/validation.js';

// Leaflet is ~40 KB gzipped; load it only when the report form is opened.
const LocationPicker = lazy(() => import('../components/LocationPicker.jsx'));

const EMPTY = {
  ward_id: '', category: '', description: '', address: '', name: '', phone: '',
  latitude: null, longitude: null,
  consent: false, // must be actively ticked - never pre-ticked
};

export default function ReportIssue() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [wards, setWards] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getWards().then((d) => setWards(d.wards)).catch((e) => { setWards([]); setFormError(e.message); });
  }, []);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  function setLocation({ latitude, longitude }) {
    setValues((v) => ({ ...v, latitude, longitude }));
    setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));
  }

  function setConsent(e) {
    setValues((v) => ({ ...v, consent: e.target.checked }));
    setErrors((prev) => ({ ...prev, consent: undefined }));
  }

  /** After the errors render, scroll to (and focus, if it is an input) the first invalid field. */
  function revealFirstError() {
    setTimeout(() => {
      const el = formRef.current?.querySelector('[aria-invalid="true"], [data-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el.matches('input, select, textarea')) el.focus({ preventScroll: true });
    }, 0);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const problems = validateReport(values);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setFormError('Please fix the highlighted fields.');
      revealFirstError();
      return;
    }

    setErrors({});
    setSubmitting(true);
    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.append(k, v));
    photos.forEach((file) => form.append('photos', file));
    try {
      const { issue_id } = await api.submitIssue(form);
      navigate(`/submitted/${issue_id}`);
    } catch (err) {
      setErrors(err.fields);
      setFormError(err.message);
      setSubmitting(false);
      revealFirstError();
    }
  }

  if (!wards) return <Spinner />;

  const locationError = errors.latitude || errors.longitude;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Report an issue</h1>
      <p className="mt-1 text-sm text-slate-600">
        The corporator for your constituency will see this. Your name and mobile number are shared only with them, never shown publicly.
        Fields marked <span className="text-red-600">*</span> are required.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="card mt-6 space-y-5 p-5 sm:p-6" noValidate>
        <Alert>{formError}</Alert>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Constituency" required error={errors.ward_id}>
            {(p) => (
              <select {...p} value={values.ward_id} onChange={set('ward_id')}>
                <option value="">Select your constituency</option>
                {wards.map((w) => <option key={w.id} value={w.id}>Constituency {w.number} - {w.name}</option>)}
              </select>
            )}
          </FormField>
          <FormField label="Issue Category" required error={errors.category}>
            {(p) => (
              <select {...p} value={values.category} onChange={set('category')}>
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            )}
          </FormField>
        </div>

        <FormField label="Description" required error={errors.description} hint="What is wrong, and how long has it been like this?">
          {(p) => <textarea {...p} rows={4} value={values.description} onChange={set('description')} maxLength={2000} />}
        </FormField>

        <FormField label="Street / landmark" optional error={errors.address} hint="Helps the corporator find the exact spot.">
          {(p) => <input {...p} value={values.address} onChange={set('address')} maxLength={200} />}
        </FormField>

        <div data-invalid={locationError ? 'true' : undefined} className="scroll-mt-24">
          <span className="label">Location <span className="ml-0.5 text-red-600" aria-hidden="true">*</span></span>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-slate-100 sm:h-80" aria-hidden="true" />}>
            <LocationPicker
              latitude={values.latitude}
              longitude={values.longitude}
              onChange={setLocation}
              error={locationError}
              disabled={submitting}
            />
          </Suspense>
        </div>

        <div>
          <span className="label">Photos <span className="font-normal text-slate-400">(optional)</span></span>
          <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
        </div>

        <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <FormField label="Full Name" required error={errors.name}>
            {(p) => <input {...p} value={values.name} onChange={set('name')} autoComplete="name" maxLength={100} />}
          </FormField>
          <FormField label="Mobile Number" required error={errors.phone} hint="10-digit Indian mobile number. +91 is optional.">
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={values.phone}
                onChange={set('phone')}
                placeholder="98765 43210"
                maxLength={17}
              />
            )}
          </FormField>
        </div>

        <CheckboxField checked={values.consent} onChange={setConsent} error={errors.consent} disabled={submitting}>
          I confirm that the information provided is accurate and may be used by the local administration for issue resolution.
        </CheckboxField>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
          {submitting ? 'Submitting...' : 'Submit issue'}
        </button>
      </form>
    </div>
  );
}
