import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const NONE = '__none__';

/** One constituency's corporator: a dropdown of every active corporator account (from Accounts), with
 *  a Save that appears once the pick differs from what is currently assigned. A corporator covers
 *  exactly one constituency, so picking one here moves them away from wherever they were. */
function CorporatorCell({ ward, corporators, onChanged }) {
  const { t } = useT();
  const current = ward.corporator ? String(ward.corporator.id) : NONE;
  const [selection, setSelection] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setSelection(current); setError(''); }, [current]);

  const dirty = selection !== current;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.assignCorporator(ward.id, selection === NONE ? null : Number(selection));
      onChanged(t('roles.grid.assigned'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[190px] space-y-1">
      <select className="input px-2 py-1 text-sm" value={selection} onChange={(e) => setSelection(e.target.value)}>
        <option value={NONE}>{t('accounts.unassigned')}</option>
        {corporators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.first_name} {c.last_name}{c.ward && c.ward.id !== ward.id ? ` (${t('list.constituencyChip', { n: c.ward.number })})` : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {dirty && (
        <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60">
          {saving ? t('roles.saving') : t('roles.grid.save')}
        </button>
      )}
    </div>
  );
}

/** One constituency's Mandal Adhyaksh: same picker as the corporator above, but a Mandal Adhyaksh can
 *  cover more than one constituency, so picking them here does not move or free them from anywhere. */
function MandalCell({ ward, mandalList, onChanged }) {
  const { t } = useT();
  const current = ward.mandal_adhyaksh ? String(ward.mandal_adhyaksh.id) : NONE;
  const [selection, setSelection] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setSelection(current); setError(''); }, [current]);

  const dirty = selection !== current;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.assignMandalAdhyaksh(ward.id, selection === NONE ? null : Number(selection));
      onChanged(t('roles.grid.assigned'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[190px] space-y-1">
      <select className="input px-2 py-1 text-sm" value={selection} onChange={(e) => setSelection(e.target.value)}>
        <option value={NONE}>{t('accounts.unassigned')}</option>
        {mandalList.map((m) => (
          <option key={m.id} value={m.id}>
            {m.first_name} {m.last_name} ({t('roles.mandal.wardCount', { n: m.ward_count, count: m.ward_count })})
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {dirty && (
        <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60">
          {saving ? t('roles.saving') : t('roles.grid.save')}
        </button>
      )}
    </div>
  );
}

/**
 * Mayor/admin only: assigns which corporator and which Mandal Adhyaksh covers each constituency, the
 * same way for both - a dropdown per row of existing accounts (from the Accounts page), with a Save
 * that appears once the pick changes. Constituency stays the base row.
 */
export default function AdminRoles() {
  const { t, wardName } = useT();
  const [roster, setRoster] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState('');
  const [filter, setFilter] = useState('');

  function load() {
    return Promise.all([api.getRoster(), api.getAccounts()])
      .then(([r, a]) => { setRoster(r); setAccounts(a.accounts); })
      .catch((e) => setLoadError(e.message));
  }

  useEffect(() => { load(); }, []);

  const wards = roster?.wards ?? [];
  const corporators = useMemo(() => (accounts ?? []).filter((a) => a.role === 'corporator' && a.is_active), [accounts]);
  const mandalList = useMemo(() => (accounts ?? []).filter((a) => a.role === 'mandal_adhyaksh' && a.is_active), [accounts]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => String(w.number).includes(q) || wardName(w).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wards, filter]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!roster || !accounts) return <Spinner />;

  function handleChanged(message) {
    setFlash(message);
    load();
  }

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t('roles.lead')} {t('roles.grid.accountsHint')} <Link to="/admin/accounts" className="font-medium text-brand-700 hover:underline">{t('accounts.title')}</Link>.
        </p>
      </div>

      <Alert tone="success">{flash}</Alert>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">{t('roles.overview')}</h2>
          <input
            className="input w-56 px-2 py-1.5 text-sm"
            placeholder={t('roles.grid.filterPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('admin.dash.col.ward')}</th>
                <th className={th}>{t('roles.corporator.heading')}</th>
                <th className={th}>{t('roles.mandal.heading')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <tr key={w.id}>
                  <td className="px-3 py-3 align-top text-sm">
                    <p className="font-medium">{t('list.constituencyChip', { n: w.number })}</p>
                    <p className="mt-0.5 max-w-[16rem] text-xs text-slate-500">{wardName(w)}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <CorporatorCell ward={w} corporators={corporators} onChanged={handleChanged} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <MandalCell ward={w} mandalList={mandalList} onChanged={handleChanged} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">{t('roles.grid.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
