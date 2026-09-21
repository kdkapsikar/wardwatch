import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useT } from '../i18n/LanguageContext.jsx';
import Alert from '../components/ui/Alert.jsx';
import FormField from '../components/ui/FormField.jsx';
import { homeFor } from '../lib/routes.js';

/** One sign-in for constituency corporators and the mayor's office; the server works out which you are. */
export default function Login() {
  const { auth, login } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const [values, setValues] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (or just became signed in): go back where we came from, else to the role's home.
  if (auth) return <Navigate to={location.state?.from ?? homeFor(auth.role)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(values);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Alert>{error}</Alert>
          <FormField label={t('login.username')} required>
            {(p) => <input {...p} value={values.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" autoFocus />}
          </FormField>
          <FormField label={t('login.password')} required>
            {(p) => (
              <div className="relative">
                <input
                  {...p}
                  className={`${p.className} pr-16`}
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? t('login.hide') : t('login.show')}
                </button>
              </div>
            )}
          </FormField>
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
