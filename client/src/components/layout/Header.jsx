import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { publicUrl } from '../../lib/config.js';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Header() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <img src={publicUrl('favicon.svg')} alt="" className="h-7 w-7" />
          WardWatch
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
          <NavLink to="/report" className={navClass}>Report an issue</NavLink>
          <NavLink to="/track" className={navClass}>Track an issue</NavLink>
          {auth ? (
            <>
              <NavLink to={auth.role === 'admin' ? '/admin' : '/corporator'} end className={navClass}>Dashboard</NavLink>
              {auth.role === 'corporator' && <NavLink to="/corporator/issues" className={navClass}>Issues</NavLink>}
              <button type="button" onClick={handleLogout} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Sign out ({auth.user.name})
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>Staff sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
