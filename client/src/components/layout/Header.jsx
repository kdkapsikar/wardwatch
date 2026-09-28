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

  // The mayor/admin and a Mandal Adhyaksh share the same session role ("admin") and the same page
  // components, just mounted under two different URL prefixes - see App.jsx and PortalContext.
  const isStaff = auth?.role === 'corporator' || auth?.role === 'admin';
  const isMandal = auth?.role === 'admin' && auth.user.role === 'mandal_adhyaksh';
  const adminBase = isMandal ? '/mandal' : '/admin';
  const staffBase = auth?.role === 'corporator' ? '/corporator' : adminBase;

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
              {isStaff && <NavLink to={staffBase} end className={navClass}>{t('nav.dashboard')}</NavLink>}
              {isStaff && <NavLink to={`${staffBase}/issues`} className={navClass}>{t('nav.issues')}</NavLink>}
              {auth.role === 'admin' && <NavLink to={`${adminBase}/notes`} className={navClass}>{t('nav.notes')}</NavLink>}
              {/* Managing accounts and who covers which constituency is the mayor/admin's job, not a Mandal Adhyaksh's own. */}
              {auth.role === 'admin' && !isMandal && <NavLink to="/admin/accounts" className={navClass}>{t('nav.accounts')}</NavLink>}
              {auth.role === 'admin' && !isMandal && <NavLink to="/admin/roles" className={navClass}>{t('nav.manageRoles')}</NavLink>}
              {isStaff && <IssueIdSearch basePath={staffBase} />}
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
