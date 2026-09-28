import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const NEW = '__new__';
const NONE = '__none__';

/** Who covers a constituency's corporator seat. Read-only once filled - there is no "replace" flow
 *  here yet; deactivate the current one first, then a create form reappears. */
function CorporatorPanel({ ward, onChanged }) {
  const { t, personName } = useT();
  const [form, setForm] = useState({ name: '', username: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const corp = ward.corporator;

  useEffect(() => {
    setForm({ name: '', username: '' });
    setErrors({});
    setError('');
    setConfirmingDeactivate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ward.id]);

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setError('');
    try {
      const { corporator } = await api.createCorporator({ ward_id: ward.id, ...form });
      onChanged(t('roles.corporator.created', { name: corporator.name }));
    } catch (err) {
      setErrors(err.fields ?? {});
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setSubmitting(true);
    setError('');
    try {
      await api.deactivateCorporator(corp.id);
      onChanged(t('roles.corporator.deactivated', { name: corp.name }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setConfirmingDeactivate(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">{t('roles.corporator.heading')}</h2>
      <Alert>{error}</Alert>
      {corp ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
          <div>
            <p className="font-medium">{personName(corp.name)}</p>
            <p className="text-xs text-slate-500">@{corp.username}</p>
          </div>
          {confirmingDeactivate ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{t('roles.corporator.confirmDeactivate')}</span>
              <button type="button" onClick={handleDeactivate} disabled={submitting} className="font-medium text-rose-700 hover:underline">
                {submitting ? t('roles.saving') : t('roles.corporator.deactivateYes')}
              </button>
              <button type="button" onClick={() => setConfirmingDeactivate(false)} disabled={submitting} className="text-slate-600 hover:underline">{t('common.cancel')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDeactivate(true)} className="text-sm text-slate-500 hover:text-rose-700 hover:underline">{t('roles.corporator.deactivate')}</button>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">{t('roles.corporator.none')}</p>
          <FormField label={t('report.name')} required error={errors.name}>
            {(p) => <input {...p} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}
          </FormField>
          <FormField label={t('login.username')} required error={errors.username} hint={t('roles.usernameHint')}>
            {(p) => <input {...p} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} autoCapitalize="none" />}
          </FormField>
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">{submitting ? t('roles.creating') : t('roles.corporator.create')}</button>
        </form>
      )}
    </section>
  );
}

/** One constituency has at most one Mandal Adhyaksh; the dropdown is prepopulated with whoever
 *  already covers it, and with every other existing Mandal Adhyaksh so the same person can be
 *  picked again for a second (or third) constituency. */
function MandalPanel({ ward, mandalList, onChanged }) {
  const { t, personName } = useT();
  const current = ward.mandal_adhyaksh;
  const [selection, setSelection] = useState(current ? String(current.id) : NONE);
  const [form, setForm] = useState({ name: '', username: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelection(current ? String(current.id) : NONE);
    setForm({ name: '', username: '' });
    setErrors({});
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ward.id]);

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setErrors({});
    try {
      if (selection === NEW) {
        const { mandal_adhyaksh: created } = await api.createMandalAdhyaksh(form);
        await api.assignMandalAdhyaksh(ward.id, created.id);
        onChanged(t('roles.mandal.created', { name: created.name }));
      } else {
        await api.assignMandalAdhyaksh(ward.id, selection === NONE ? null : Number(selection));
        onChanged(t('roles.mandal.assigned'));
      }
    } catch (err) {
      setErrors(err.fields ?? {});
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">{t('roles.mandal.heading')}</h2>
      <p className="mt-1 text-xs text-slate-500">{t('roles.mandal.lead')}</p>
      <Alert>{error}</Alert>
      <form onSubmit={handleSave} className="mt-3 space-y-3">
        <FormField label={t('roles.mandal.pick')}>
          {(p) => (
            <select {...p} value={selection} onChange={(e) => setSelection(e.target.value)}>
              <option value={NONE}>{t('roles.mandal.none')}</option>
              {mandalList.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.is_active}>
                  {personName(m.name)} ({t('roles.mandal.wardCount', { n: m.ward_count, count: m.ward_count })}){!m.is_active ? ` – ${t('admin.dash.inactive')}` : ''}
                </option>
              ))}
              <option value={NEW}>{t('roles.mandal.createNew')}</option>
            </select>
          )}
        </FormField>

        {selection === NEW && (
          <>
            <FormField label={t('report.name')} required error={errors.name}>
              {(p) => <input {...p} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}
            </FormField>
            <FormField label={t('login.username')} required error={errors.username} hint={t('roles.usernameHint')}>
              {(p) => <input {...p} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} autoCapitalize="none" />}
            </FormField>
          </>
        )}

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">{submitting ? t('roles.saving') : t('roles.mandal.save')}</button>
      </form>
    </section>
  );
}

/** The whole city at a glance - every constituency's current corporator and Mandal Adhyaksh, click a
 *  row to jump the picker above to it. */
function RosterTable({ wards, onPick }) {
  const { t, wardName, personName } = useT();
  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">{t('roles.overview')}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>{t('admin.dash.col.ward')}</th>
              <th className={th}>{t('roles.corporator.heading')}</th>
              <th className={th}>{t('roles.mandal.heading')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {wards.map((w) => (
              <tr key={w.id}>
                <td className="px-3 py-2.5 text-sm">
                  <button type="button" onClick={() => onPick(String(w.id))} className="font-medium text-brand-700 hover:underline">{t('list.constituencyChip', { n: w.number })}</button>
                  <span className="mt-0.5 block max-w-xs text-xs text-slate-500">{wardName(w)}</span>
                </td>
                <td className="px-3 py-2.5 text-sm">{w.corporator ? personName(w.corporator.name) : <span className="text-slate-400">{t('roles.none')}</span>}</td>
                <td className="px-3 py-2.5 text-sm">{w.mandal_adhyaksh ? personName(w.mandal_adhyaksh.name) : <span className="text-slate-400">{t('roles.none')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Mayor/admin only: define who is the corporator and who is the Mandal Adhyaksh for each
 * constituency. Constituency-first, as requested - pick one, then the corporator and Mandal
 * Adhyaksh fields for it are prepopulated with whatever is already assigned.
 */
export default function AdminRoles() {
  const { t, wardName } = useT();
  const [roster, setRoster] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [wardId, setWardId] = useState('');
  const [flash, setFlash] = useState('');

  function load() {
    return api.getRoster()
      .then((d) => {
        setRoster(d);
        setWardId((current) => current || String(d.wards[0]?.id ?? ''));
      })
      .catch((e) => setLoadError(e.message));
  }

  useEffect(() => { load(); }, []);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!roster) return <Spinner />;

  const ward = roster.wards.find((w) => String(w.id) === wardId);

  function handleChanged(message) {
    setFlash(message);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('roles.lead')}</p>
      </div>

      <Alert tone="success">{flash}</Alert>

      <div className="card p-5">
        <FormField label={t('roles.pickConstituency')}>
          {(p) => (
            <select {...p} value={wardId} onChange={(e) => { setWardId(e.target.value); setFlash(''); }}>
              {roster.wards.map((w) => (
                <option key={w.id} value={w.id}>{t('detail.constituencyValue', { n: w.number, name: wardName(w) })}</option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      {ward && (
        <div className="grid gap-6 sm:grid-cols-2">
          <CorporatorPanel ward={ward} onChanged={handleChanged} />
          <MandalPanel ward={ward} mandalList={roster.mandal_adhyaksh_list} onChanged={handleChanged} />
        </div>
      )}

      <RosterTable wards={roster.wards} onPick={(id) => { setWardId(id); setFlash(''); }} />
    </div>
  );
}
