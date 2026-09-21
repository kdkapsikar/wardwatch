import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext.jsx';

export default function IssueSubmitted() {
  const { id } = useParams();
  const { t } = useT();
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
        <h1 className="mt-4 text-2xl font-bold">{t('submitted.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('submitted.lead')}</p>

        <p className="mt-6 select-all rounded-lg bg-brand-50 px-4 py-4 font-mono text-3xl font-bold tracking-widest text-brand-800" aria-label={t('submitted.idLabel', { id })}>
          {id}
        </p>
        <button type="button" onClick={copy} className="btn btn-secondary mt-3">{copied ? t('submitted.copied') : t('submitted.copy')}</button>

        <p className="mt-6 text-xs text-slate-500">{t('submitted.note')}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/track/${id}`} className="btn btn-primary">{t('submitted.track')}</Link>
          <Link to="/report" className="btn btn-secondary">{t('submitted.another')}</Link>
        </div>
      </div>
    </div>
  );
}
