import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import ReportIssue from './pages/ReportIssue.jsx';
import IssueSubmitted from './pages/IssueSubmitted.jsx';
import TrackIssue from './pages/TrackIssue.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/Login.jsx';
import CorporatorDashboard from './pages/corporator/CorporatorDashboard.jsx';
import CorporatorIssues from './pages/corporator/CorporatorIssues.jsx';
import CorporatorIssueDetail from './pages/corporator/CorporatorIssueDetail.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminIssueDetail from './pages/admin/AdminIssueDetail.jsx';
import AdminIssues from './pages/admin/AdminIssues.jsx';
import AdminNotes from './pages/admin/AdminNotes.jsx';
import CitizenLogin from './pages/citizen/CitizenLogin.jsx';
import CitizenIssues from './pages/citizen/CitizenIssues.jsx';
import CitizenIssueDetail from './pages/citizen/CitizenIssueDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Citizen (no login) */}
        <Route index element={<Home />} />
        <Route path="report" element={<ReportIssue />} />
        <Route path="submitted/:id" element={<IssueSubmitted />} />
        <Route path="track" element={<TrackIssue />} />
        <Route path="track/:id" element={<TrackIssue />} />

        {/* Staff sign-in (corporators and admins share one page). The old per-role URLs still work. */}
        <Route path="login" element={<Login />} />
        <Route path="corporator/login" element={<Navigate to="/login" replace />} />
        <Route path="admin/login" element={<Navigate to="/login" replace />} />

        {/* Citizen portal: phone + OTP sign-in, to see every issue reported with that number. */}
        <Route path="my/login" element={<CitizenLogin />} />
        <Route path="my" element={<ProtectedRoute role="citizen" />}>
          <Route index element={<CitizenIssues />} />
          <Route path="issues/:id" element={<CitizenIssueDetail />} />
        </Route>

        {/* Corporator */}
        <Route path="corporator" element={<ProtectedRoute role="corporator" />}>
          <Route index element={<CorporatorDashboard />} />
          <Route path="issues" element={<CorporatorIssues />} />
          <Route path="issues/:id" element={<CorporatorIssueDetail />} />
        </Route>

        {/* Mayor / Admin */}
        <Route path="admin" element={<ProtectedRoute role="admin" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="issues" element={<AdminIssues />} />
          <Route path="issues/:id" element={<AdminIssueDetail />} />
          <Route path="notes" element={<AdminNotes />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
