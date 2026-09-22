import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';
import { publicUrl } from '../../lib/config.js';
import IssueIdSearch from '../IssueIdSearch.jsx';
import LanguageToggle from '../LanguageToggle.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Header() {
  const { auth, logout } = useAuth();
  const { t } = useT();
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
          {/* Brand name: fixed in both languages (not translated), like a wordmark. `lang` is set
              explicitly so a screen reader pronounces it correctly even on the English page. */}
          <span lang="mr">e-नगरसेवक</span>
        </Link>
        {/* Language switch: top-right on every screen size (on phones it shares the logo's row). */}
        <div className="ml-auto sm:order-last sm:ml-0">
          <LanguageToggle />
        </div>
        <nav className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto" aria-label={t('nav.main')}>
          {auth ? (
            <>
              {auth.role === 'citizen' && <NavLink to="/my" end className={navClass}>{t('nav.myIssues')}</NavLink>}
              {auth.role !== 'citizen' && (
                <NavLink to={auth.role === 'admin' ? '/admin' : '/corporator'} end className={navClass}>{t('nav.dashboard')}</NavLink>
              )}
              {auth.role === 'corporator' && <NavLink to="/corporator/issues" className={navClass}>{t('nav.issues')}</NavLink>}
              {auth.role === 'admin' && <NavLink to="/admin/issues" className={navClass}>{t('nav.issues')}</NavLink>}
              {auth.role === 'admin' && <NavLink to="/admin/notes" className={navClass}>{t('nav.notes')}</NavLink>}
              {(auth.role === 'corporator' || auth.role === 'admin') && <IssueIdSearch role={auth.role} />}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/report" className={navClass}>{t('nav.report')}</NavLink>
              <NavLink to="/track" className={navClass}>{t('nav.track')}</NavLink>
              <NavLink to="/my/login" className={navClass}>{t('nav.myIssues')}</NavLink>
              <NavLink to="/login" className={navClass}>{t('nav.signIn')}</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
