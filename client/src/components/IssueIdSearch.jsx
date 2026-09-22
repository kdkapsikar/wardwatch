import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext.jsx';

// More forgiving than the server: any case, stray spaces, a missing dash, or no WW prefix at all.
const clean = (value) => value.trim().toUpperCase().replace(/\s+/g, '');
const canonical = (id) => {
  if (/^WW[A-Z2-9]{8}$/.test(id)) return `WW-${id.slice(2)}`;
  if (/^[A-Z2-9]{8}$/.test(id)) return `WW-${id}`;
  return id;
};

/** Jump straight to an issue record by its Issue ID (signed-in staff). The record page reports "not found". */
export default function IssueIdSearch({ role }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const id = canonical(clean(value));
    if (!id) return;
    navigate(`${role === 'admin' ? '/admin' : '/corporator'}/issues/${encodeURIComponent(id)}`);
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex items-center gap-1 sm:ml-2">
      <label htmlFor="staff-issue-search" className="sr-only">{t('search.label')}</label>
      <input
        id="staff-issue-search"
        className="input w-36 py-1.5 font-mono text-sm uppercase tracking-wide sm:w-40"
        placeholder={t('search.placeholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
      />
      <button type="submit" className="btn btn-secondary px-3 py-1.5 text-sm">{t('search.button')}</button>
    </form>
  );
}
