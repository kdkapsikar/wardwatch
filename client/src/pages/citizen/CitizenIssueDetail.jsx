import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import IssueDetails from '../../components/IssueDetails.jsx';
import IssueTimeline from '../../components/IssueTimeline.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

export default function CitizenIssueDetail() {
  const { id } = useParams();
  const { t, personName } = useT();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIssue(null);
    setError('');
    api.getMyIssue(id)
      .then((d) => !cancelled && setIssue(d.issue))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/my" className="text-sm text-brand-700 hover:underline">{t('detail.back')}</Link>
      <Alert>{error}</Alert>
      {!issue && !error && <Spinner />}
      {issue && (
        <>
          <IssueDetails issue={issue}>
            <p className="mt-4 text-sm">
              <span className="text-slate-500">{t('contact.assignedTo')} </span>
              <span className="font-medium">{issue.assigned_to ? personName(issue.assigned_to) : t('contact.unassigned')}</span>
            </p>
          </IssueDetails>
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">{t('track.history')}</h2>
            <IssueTimeline updates={issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
