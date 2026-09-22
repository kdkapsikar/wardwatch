import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useT } from '../i18n/LanguageContext.jsx';
import Alert from '../components/ui/Alert.jsx';
import IssueDetails from '../components/IssueDetails.jsx';
import IssueTimeline from '../components/IssueTimeline.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import CitizenIllustration from '../components/illustrations/CitizenIllustration.jsx';
import IllustrationPanel from '../components/illustrations/IllustrationPanel.jsx';

export default function TrackIssue() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const [input, setInput] = useState(id ?? '');
  const [state, setState] = useState({ status: 'idle', issue: null, error: '' });

  useEffect(() => {
    setInput(id ?? '');
    if (!id) {
      setState({ status: 'idle', issue: null, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading', issue: null, error: '' });
    api.trackIssue(id)
      .then(({ issue }) => !cancelled && setState({ status: 'done', issue, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', issue: null, error: err.message }));
    return () => { cancelled = true; };
  }, [id]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (trimmed) navigate(`/track/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('track.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('track.lead')}</p>
        </div>
        {state.status === 'idle' && (
          <IllustrationPanel>
            <CitizenIllustration className="aspect-[240/190] h-24" />
          </IllustrationPanel>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2" role="search">
        <label htmlFor="issue-id" className="sr-only">{t('track.idLabel')}</label>
        <input
          id="issue-id"
          className="input font-mono uppercase tracking-wider"
          placeholder="WW-XXXXXXXX"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
        />
        <button type="submit" className="btn btn-primary">{t('track.search')}</button>
      </form>

      {state.status === 'loading' && <Spinner />}
      {state.status === 'error' && <Alert>{state.error}</Alert>}

      {state.issue && (
        <>
          <IssueDetails issue={state.issue} />
          <section className="card p-5 sm:p-6" aria-labelledby="history">
            <h2 id="history" className="mb-4 text-lg font-semibold">{t('track.history')}</h2>
            <IssueTimeline updates={state.issue.updates} />
          </section>
        </>
      )}
    </div>
  );
}
