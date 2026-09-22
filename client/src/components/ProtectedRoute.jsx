import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../lib/routes.js';
import Spinner from './ui/Spinner.jsx';

/** Route guard: nested routes render only for a signed-in user with the given role. */
export default function ProtectedRoute({ role }) {
  const { loading, auth } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!auth) return <Navigate to={role === 'citizen' ? '/my/login' : '/login'} replace state={{ from: location.pathname }} />;
  // Signed in, but as the other role: send them to their own area rather than to a login page.
  if (auth.role !== role) return <Navigate to={homeFor(auth.role)} replace />;
  return <Outlet />;
}
