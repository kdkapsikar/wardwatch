import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';
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
  const { t, lang, categoryLabel, wardName } = useT();
  const formRef = useRef(null);
  const [wards, setWards] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Messages already on screen are in the old language; clear them rather than show a mix.
  useEffect(() => {
    setErrors({});
    setFormError('');
  }, [lang]);

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

    const problems = validateReport(values, t);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setFormError(t('report.fixFields'));
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
      <h1 className="text-2xl font-bold">{t('report.title')}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {t('report.intro')}{' '}
        {t('report.required').split('*').flatMap((part, i) => (i === 0 ? [part] : [<span key={i} className="text-red-600">*</span>, part]))}
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="card mt-6 space-y-5 p-5 sm:p-6" noValidate>
        <Alert>{formError}</Alert>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('report.constituency')} required error={errors.ward_id}>
            {(p) => (
              <select {...p} value={values.ward_id} onChange={set('ward_id')}>
                <option value="">{t('report.selectConstituency')}</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{t('detail.constituencyValue', { n: w.number, name: wardName(w) })}</option>)}
              </select>
            )}
          </FormField>
          <FormField label={t('report.category')} required error={errors.category}>
            {(p) => (
              <select {...p} value={values.category} onChange={set('category')}>
                <option value="">{t('report.selectCategory')}</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{categoryLabel(c.value)}</option>)}
              </select>
            )}
          </FormField>
        </div>

        <FormField label={t('report.description')} required error={errors.description} hint={t('report.descriptionHint')}>
          {(p) => <textarea {...p} rows={4} value={values.description} onChange={set('description')} maxLength={2000} />}
        </FormField>

        <FormField label={t('report.address')} optional error={errors.address} hint={t('report.addressHint')}>
          {(p) => <input {...p} value={values.address} onChange={set('address')} maxLength={200} />}
        </FormField>

        <div data-invalid={locationError ? 'true' : undefined} className="scroll-mt-24">
          <span className="label">{t('report.location')} <span className="ml-0.5 text-red-600" aria-hidden="true">*</span></span>
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
          <span className="label">{t('report.photos')} <span className="font-normal text-slate-400">{t('common.optional')}</span></span>
          <PhotoUploader files={photos} onChange={setPhotos} error={errors.photos} disabled={submitting} />
        </div>

        <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <FormField label={t('report.name')} required error={errors.name}>
            {(p) => <input {...p} value={values.name} onChange={set('name')} autoComplete="name" maxLength={100} />}
          </FormField>
          <FormField label={t('report.phone')} required error={errors.phone} hint={t('report.phoneHint')}>
            {(p) => (
              <input
                {...p}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={values.phone}
                onChange={set('phone')}
                placeholder={t('report.phonePlaceholder')}
                maxLength={17}
              />
            )}
          </FormField>
        </div>

        <CheckboxField checked={values.consent} onChange={setConsent} error={errors.consent} disabled={submitting}>
          {t('report.consent')}
        </CheckboxField>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
          {submitting ? t('report.submitting') : t('report.submit')}
        </button>
      </form>
    </div>
  );
}
