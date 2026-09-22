import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';
import { homeFor } from '../../lib/routes.js';
import Alert from '../../components/ui/Alert.jsx';
import FormField from '../../components/ui/FormField.jsx';
import CitizenIllustration from '../../components/illustrations/CitizenIllustration.jsx';

/**
 * Citizen sign-in: phone number, then a 4-digit code, no password. A citizen's identity IS their
 * phone number - the first successful code both creates the account and signs them in, and they
 * immediately see any issue already filed with that number (see server/src/routes/citizen.js).
 */
export default function CitizenLogin() {
  const { auth, loginWithOtp } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (auth) return <Navigate to={location.state?.from ?? homeFor(auth.role)} replace />;

  async function handleRequest(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.requestOtp(phone);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginWithOtp(phone, code);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="mx-auto mb-5 max-w-[220px] rounded-xl bg-brand-50 p-3">
        <CitizenIllustration className="h-auto w-full" />
      </div>
      <div className="card p-6">
        <h1 className="text-xl font-semibold">{t('citizen.login.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('citizen.login.subtitle')}</p>

        {step === 'phone' ? (
          <form onSubmit={handleRequest} className="mt-6 space-y-4">
            <Alert>{error}</Alert>
            <FormField label={t('report.phone')} required hint={t('report.phoneHint')}>
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('report.phonePlaceholder')}
                  autoComplete="tel"
                  autoFocus
                />
              )}
            </FormField>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? t('citizen.login.sending') : t('citizen.login.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <Alert>{error}</Alert>
            <p className="text-sm text-slate-600">{t('citizen.login.codeSentTo', { phone })}</p>
            <FormField label={t('citizen.login.code')} required hint={t('citizen.login.codeHint')}>
              {(p) => (
                <input
                  {...p}
                  className={`${p.className} font-mono text-lg tracking-[0.3em]`}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                />
              )}
            </FormField>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? t('citizen.login.verifying') : t('citizen.login.verify')}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setError(''); }}
              className="w-full text-center text-sm text-slate-500 underline hover:text-slate-800"
            >
              {t('citizen.login.changeNumber')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
