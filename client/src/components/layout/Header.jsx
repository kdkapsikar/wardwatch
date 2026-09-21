import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';
import { publicUrl } from '../../lib/config.js';
import LanguageToggle from '../LanguageToggle.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Header() {
  const { auth, logout } = useAuth();
  const { t, personName } = useT();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <img src={publicUrl('favicon.svg')} alt="" className="h-7 w-7" />
          WardWatch
        </Link>
        {/* Language switch: top-right on every screen size (on phones it shares the logo's row). */}
        <div className="ml-auto sm:order-last sm:ml-0">
          <LanguageToggle />
        </div>
        <nav className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto" aria-label={t('nav.main')}>
          <NavLink to="/report" className={navClass}>{t('nav.report')}</NavLink>
          <NavLink to="/track" className={navClass}>{t('nav.track')}</NavLink>
          {auth ? (
            <>
              <NavLink to={auth.role === 'admin' ? '/admin' : '/corporator'} end className={navClass}>{t('nav.dashboard')}</NavLink>
              {auth.role === 'corporator' && <NavLink to="/corporator/issues" className={navClass}>{t('nav.issues')}</NavLink>}
              {auth.role === 'admin' && <NavLink to="/admin/issues" className={navClass}>{t('nav.issues')}</NavLink>}
              {auth.role === 'admin' && <NavLink to="/admin/notes" className={navClass}>{t('nav.notes')}</NavLink>}
              <button type="button" onClick={handleLogout} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                {t('nav.signOut', { name: personName(auth.user.name) })}
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>{t('nav.staffSignIn')}</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
