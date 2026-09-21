import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext.jsx';

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="mt-4 text-xl font-semibold">{t('notfound.title')}</h1>
      <Link to="/" className="btn btn-primary mt-6">{t('notfound.home')}</Link>
    </div>
  );
}
