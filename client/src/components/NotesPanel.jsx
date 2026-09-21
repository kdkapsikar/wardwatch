import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Alert from './ui/Alert.jsx';
import FormField from './ui/FormField.jsx';
import Spinner from './ui/Spinner.jsx';
import { formatDateTime, formatRupees, parseBudget } from '../lib/format.js';

const LockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

/** Add / edit form. `initial` = an existing note when editing. Calls onSaved(note) on success. */
function NoteForm({ initial, issue, onSaved, onCancel, submitLabel }) {
  const [body, setBody] = useState(initial?.body ?? '');
  const [budget, setBudget] = useState(initial?.budget_amount == null ? '' : String(initial.budget_amount));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const problems = {};
    if (!body.trim()) problems.body = 'Write something to save';
    const parsed = parseBudget(budget);
    if (!parsed.ok) problems.budget_amount = parsed.message;
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = { body: body.trim(), budget_amount: parsed.value };
      const { note } = initial
        ? await api.updateNote(initial.id, payload)
        : await api.createNote({ ...payload, ...(issue && { issue }) });
      if (!initial) {
        setBody('');
        setBudget('');
      }
      onSaved(note);
    } catch (err) {
      setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <Alert>{formError}</Alert>
      <FormField label="Note" required error={errors.body}>
        {(p) => (
          <textarea {...p} rows={3} value={body} maxLength={2000} placeholder="e.g. Proposed a new culvert here - to be funded from the ward development budget"
            onChange={(e) => { setBody(e.target.value); setErrors((x) => ({ ...x, body: undefined })); }} />
        )}
      </FormField>
      <FormField label="Budget (₹)" optional error={errors.budget_amount} hint="Amount you have set aside or estimated. Digits only, e.g. 125000 or 1,25,000.">
        {(p) => (
          <input {...p} inputMode="decimal" value={budget} placeholder="0"
            onChange={(e) => { setBudget(e.target.value); setErrors((x) => ({ ...x, budget_amount: undefined })); }} />
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={saving} className="btn btn-secondary">Cancel</button>}
      </div>
    </form>
  );
}

function NoteItem({ note, showIssue, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api.deleteNote(note.id);
      onDeleted(note.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (editing) {
    return (
      <li className="p-4">
        <NoteForm initial={note} submitLabel="Save changes" onCancel={() => setEditing(false)} onSaved={(n) => { setEditing(false); onChanged(n); }} />
      </li>
    );
  }
  const edited = new Date(note.updated_at) - new Date(note.created_at) > 1500;
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line text-sm text-slate-800">{note.body}</p>
          <p className="mt-1.5 text-xs text-slate-500">
            {formatDateTime(note.created_at)}{edited && ' (edited)'}
            {showIssue && note.issue && (
              <>
                {' - on '}
                <Link to={`/admin/issues/${note.issue.public_id}`} className="font-mono font-medium text-brand-700 hover:underline">{note.issue.public_id}</Link>
                <span className="text-slate-400"> {note.issue.title}</span>
              </>
            )}
            {showIssue && !note.issue && ' - general note'}
          </p>
        </div>
        {note.budget_amount !== null && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200">
            {formatRupees(note.budget_amount)}
          </span>
        )}
      </div>
      <Alert>{error}</Alert>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium">
        {confirmingDelete ? (
          <>
            <span className="text-slate-600">Delete this note?</span>
            <button type="button" onClick={remove} disabled={busy} className="text-rose-700 hover:underline">{busy ? 'Deleting...' : 'Yes, delete'}</button>
            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className="text-slate-600 hover:underline">Keep it</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)} className="text-brand-700 hover:underline">Edit</button>
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-slate-500 hover:text-rose-700 hover:underline">Delete</button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * The signed-in admin's PRIVATE notes: on one issue (`issue` = its public id) or all of them
 * (`showIssue`, general notes allowed). The server only ever returns the caller's own notes.
 */
export default function NotesPanel({ issue, showIssue = false, heading = 'My private notes' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.listNotes(issue).then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [issue]);

  const recompute = (notes) => ({
    notes,
    totals: { count: notes.length, budget_total: notes.reduce((n, x) => n + (x.budget_amount ?? 0), 0) },
  });

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="notes-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="notes-heading" className="text-lg font-semibold">{heading}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          <LockIcon /> Only you can see these
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <NoteForm issue={issue} submitLabel="Add note" onSaved={(n) => setData((d) => recompute([n, ...(d?.notes ?? [])]))} />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <Spinner label="Loading notes..." />}

      {data && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-600">
            {data.totals.count} note{data.totals.count === 1 ? '' : 's'}
            {data.totals.budget_total > 0 && <> - budget noted: <strong className="tabular-nums text-slate-900">{formatRupees(data.totals.budget_total)}</strong></>}
          </p>
          {data.notes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No notes yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {data.notes.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  showIssue={showIssue}
                  onChanged={(updated) => setData((d) => recompute(d.notes.map((x) => (x.id === updated.id ? updated : x))))}
                  onDeleted={(id) => setData((d) => recompute(d.notes.filter((x) => x.id !== id)))}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
