import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../lib/routes.js';
import Spinner from './ui/Spinner.jsx';

/**
 * Route guard: nested routes render only for a signed-in user with the given role.
 * `adminRole` further splits the "admin" session role into its two portals - pass "admin" for the
 * mayor's office routes and "mandal_adhyaksh" for the constituency-scoped ones (see App.jsx); a
 * mismatch (the other sub-role trying either URL) is sent to their own portal, not a login page.
 */
export default function ProtectedRoute({ role, adminRole }) {
  const { loading, auth } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!auth) return <Navigate to={role === 'citizen' ? '/my/login' : '/login'} replace state={{ from: location.pathname }} />;
  // Signed in, but as the other role: send them to their own area rather than to a login page.
  if (auth.role !== role) return <Navigate to={homeFor(auth)} replace />;
  if (adminRole && auth.user.role !== adminRole) return <Navigate to={homeFor(auth)} replace />;
  return <Outlet />;
}
