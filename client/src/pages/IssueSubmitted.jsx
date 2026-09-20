import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export default function IssueSubmitted() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (e.g. plain HTTP): the ID is still selectable on screen */
    }
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="card p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden="true">✓</div>
        <h1 className="mt-4 text-2xl font-bold">Issue submitted</h1>
        <p className="mt-2 text-sm text-slate-600">It has been assigned to your ward corporator. Save your Issue ID to track progress.</p>

        <p className="mt-6 select-all rounded-lg bg-brand-50 px-4 py-4 font-mono text-3xl font-bold tracking-widest text-brand-800" aria-label={`Issue ID ${id}`}>
          {id}
        </p>
        <button type="button" onClick={copy} className="btn btn-secondary mt-3">{copied ? 'Copied!' : 'Copy ID'}</button>

        <p className="mt-6 text-xs text-slate-500">We do not send SMS or email, so please note this ID down. Anyone with the ID can view the status.</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/track/${id}`} className="btn btn-primary">Track this issue</Link>
          <Link to="/report" className="btn btn-secondary">Report another</Link>
        </div>
      </div>
    </div>
  );
}
