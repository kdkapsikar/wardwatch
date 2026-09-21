import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import CitizenContact from '../../components/CitizenContact.jsx';
import IssueDetails from '../../components/IssueDetails.jsx';
import IssueTimeline from '../../components/IssueTimeline.jsx';
import NotesPanel from '../../components/NotesPanel.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

/** The exact record, read-only, for the mayor's office: full detail + history + private notes on this issue. */
export default function AdminIssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIssue(null);
    setError('');
    api.getAdminIssue(id)
      .then((d) => !cancelled && setIssue(d.issue))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  // Coming from a drill-down (pie slice / filtered list)? "Back" returns to exactly that view.
  const cameFromApp = location.key !== 'default';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {cameFromApp ? (
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-brand-700 hover:underline">&larr; Back</button>
      ) : (
        <Link to="/admin/issues" className="text-sm text-brand-700 hover:underline">&larr; All issues</Link>
      )}
      <Alert>{error}</Alert>
      {!issue && !error && <Spinner />}
      {issue && (
        <>
          <IssueDetails issue={issue}>
            <CitizenContact issue={issue} showAssignee />
          </IssueDetails>
          <NotesPanel issue={issue.public_id} heading="My private notes on this issue" />
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">Update history</h2>
            <IssueTimeline updates={issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
