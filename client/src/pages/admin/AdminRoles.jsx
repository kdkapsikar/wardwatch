import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const UNASSIGN = '__unassign__';

/** One constituency's corporator: two always-editable inputs (create when empty, update in place
 *  when one already exists - the same account/history, not a replacement) plus a 2-step deactivate. */
function CorporatorCell({ ward, onChanged }) {
  const { t } = useT();
  const corp = ward.corporator;
  const [name, setName] = useState(corp?.name ?? '');
  const [username, setUsername] = useState(corp?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  useEffect(() => {
    setName(corp?.name ?? '');
    setUsername(corp?.username ?? '');
    setError('');
    setConfirmingDeactivate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corp?.id, corp?.name, corp?.username]);

  const dirty = name.trim() !== (corp?.name ?? '') || username.trim() !== (corp?.username ?? '');

  async function save() {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    if (!trimmedName || !trimmedUsername) {
      setError(t('roles.grid.bothRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (corp) {
        await api.updateCorporator(corp.id, { name: trimmedName, username: trimmedUsername });
        onChanged(t('roles.corporator.updated', { name: trimmedName }));
      } else {
        await api.createCorporator({ ward_id: ward.id, name: trimmedName, username: trimmedUsername });
        onChanged(t('roles.corporator.created', { name: trimmedName }));
      }
    } catch (err) {
      setError(err.fields?.name ?? err.fields?.username ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    setSaving(true);
    setError('');
    try {
      await api.deactivateCorporator(corp.id);
      onChanged(t('roles.corporator.deactivated', { name: corp.name }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirmingDeactivate(false);
    }
  }

  return (
    <div className="min-w-[190px] space-y-1.5">
      <input
        className="input px-2 py-1 text-sm"
        placeholder={t('report.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="input px-2 py-1 text-sm"
        placeholder={t('login.username')}
        value={username}
        autoCapitalize="none"
        onChange={(e) => setUsername(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3 text-xs">
        {dirty && (
          <button type="button" onClick={save} disabled={saving} className="font-medium text-brand-700 hover:underline disabled:opacity-60">
            {saving ? t('roles.saving') : t('roles.grid.save')}
          </button>
        )}
        {corp && !dirty && (
          confirmingDeactivate ? (
            <span className="flex items-center gap-2">
              <span className="text-slate-500">{t('roles.corporator.confirmDeactivate')}</span>
              <button type="button" onClick={deactivate} disabled={saving} className="font-medium text-rose-700 hover:underline">
                {t('roles.corporator.deactivateYes')}
              </button>
              <button type="button" onClick={() => setConfirmingDeactivate(false)} className="text-slate-500 hover:underline">{t('common.cancel')}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDeactivate(true)} className="text-slate-400 hover:text-rose-700 hover:underline">
              {t('roles.corporator.deactivate')}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** A Mandal Adhyaksh account, with its constituency count and a 2-step deactivate. */
function MandalAccountRow({ account, onChanged }) {
  const { t, personName } = useT();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function deactivate() {
    setSaving(true);
    try {
      await api.deactivateMandalAdhyaksh(account.id);
      onChanged(t('roles.mandal.deactivated', { name: account.name }));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className={account.is_active ? '' : 'opacity-50'}>
        <p className="text-sm font-medium">{personName(account.name)} <span className="font-normal text-slate-400">@{account.username}</span></p>
        <p className="text-xs text-slate-500">{t('roles.mandal.wardCount', { n: account.ward_count, count: account.ward_count })}{!account.is_active ? ` – ${t('admin.dash.inactive')}` : ''}</p>
      </div>
      {account.is_active && (
        confirming ? (
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-slate-500">{t('roles.corporator.confirmDeactivate')}</span>
            <button type="button" onClick={deactivate} disabled={saving} className="font-medium text-rose-700 hover:underline">{t('roles.corporator.deactivateYes')}</button>
            <button type="button" onClick={() => setConfirming(false)} className="text-slate-500 hover:underline">{t('common.cancel')}</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="shrink-0 text-xs text-slate-400 hover:text-rose-700 hover:underline">
            {t('roles.corporator.deactivate')}
          </button>
        )
      )}
    </li>
  );
}

/**
 * Mayor/admin only: a grid of every constituency with its corporator (editable in place) and its
 * Mandal Adhyaksh (assigned in bulk - tick the constituencies, pick a Mandal Adhyaksh, apply to all
 * of them at once). Constituency stays the base row; corporator and Mandal Adhyaksh are its columns.
 */
export default function AdminRoles() {
  const { t, wardName } = useT();
  const [roster, setRoster] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [newMandal, setNewMandal] = useState({ name: '', username: '' });
  const [newMandalError, setNewMandalError] = useState('');
  const [creatingMandal, setCreatingMandal] = useState(false);

  function load() {
    return api.getRoster()
      .then((d) => setRoster(d))
      .catch((e) => setLoadError(e.message));
  }

  useEffect(() => { load(); }, []);

  const wards = roster?.wards ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => String(w.number).includes(q) || wardName(w).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wards, filter]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!roster) return <Spinner />;

  function handleChanged(message) {
    setFlash(message);
    load();
  }

  function toggleOne(wardId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wardId)) next.delete(wardId); else next.add(wardId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((w) => w.id))));
  }

  async function applyBulk() {
    if (selected.size === 0 || bulkTarget === '') return;
    setBulkBusy(true);
    const adminId = bulkTarget === UNASSIGN ? null : Number(bulkTarget);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((wardId) => api.assignMandalAdhyaksh(wardId, adminId)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setFlash(failed === 0
      ? t('roles.grid.bulkApplied', { n: ids.length, count: ids.length })
      : t('roles.grid.bulkPartial', { ok: ids.length - failed, fail: failed }));
    setSelected(new Set());
    setBulkBusy(false);
    await load();
  }

  async function createMandal(event) {
    event.preventDefault();
    setCreatingMandal(true);
    setNewMandalError('');
    try {
      const { mandal_adhyaksh: created } = await api.createMandalAdhyaksh(newMandal);
      setNewMandal({ name: '', username: '' });
      setFlash(t('roles.mandal.created', { name: created.name }));
      await load();
    } catch (err) {
      setNewMandalError(err.fields?.name ?? err.fields?.username ?? err.message);
    } finally {
      setCreatingMandal(false);
    }
  }

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('roles.lead')}</p>
      </div>

      <Alert tone="success">{flash}</Alert>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <form onSubmit={createMandal} className="space-y-2">
          <h2 className="text-sm font-semibold">{t('roles.grid.createMandalHeading')}</h2>
          <div className="flex flex-wrap items-start gap-2">
            <input
              className="input w-40 px-2 py-1.5 text-sm"
              placeholder={t('report.name')}
              value={newMandal.name}
              onChange={(e) => setNewMandal((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="input w-36 px-2 py-1.5 text-sm"
              placeholder={t('login.username')}
              value={newMandal.username}
              autoCapitalize="none"
              onChange={(e) => setNewMandal((f) => ({ ...f, username: e.target.value }))}
            />
            <button type="submit" disabled={creatingMandal || !newMandal.name.trim() || !newMandal.username.trim()} className="btn btn-primary px-3 py-1.5 text-sm">
              {creatingMandal ? t('roles.creating') : t('roles.mandal.create')}
            </button>
          </div>
          {newMandalError && <p className="text-xs text-red-600">{newMandalError}</p>}
        </form>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('roles.grid.bulkAssignLabel')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-56 px-2 py-1.5 text-sm" value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)}>
              <option value="" disabled>{t('roles.grid.bulkAssignPlaceholder')}</option>
              <option value={UNASSIGN}>{t('roles.grid.bulkUnassign')}</option>
              {roster.mandal_adhyaksh_list.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.is_active}>
                  {m.name} ({t('roles.mandal.wardCount', { n: m.ward_count, count: m.ward_count })}){!m.is_active ? ` – ${t('admin.dash.inactive')}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulk}
              disabled={selected.size === 0 || bulkTarget === '' || bulkBusy}
              className="btn btn-primary px-3 py-1.5 text-sm"
            >
              {bulkBusy ? t('roles.saving') : t('roles.grid.bulkApply', { n: selected.size, count: selected.size })}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t('roles.grid.selected', { n: selected.size, count: selected.size })}</p>
        </div>
      </section>

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
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>
                  <input
                    type="checkbox"
                    aria-label={t('roles.grid.selectAll')}
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className={th}>{t('admin.dash.col.ward')}</th>
                <th className={th}>{t('roles.corporator.heading')}</th>
                <th className={th}>{t('roles.mandal.heading')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <tr key={w.id} className={selected.has(w.id) ? 'bg-brand-50/40' : undefined}>
                  <td className="px-3 py-3 align-top">
                    <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleOne(w.id)} aria-label={t('detail.constituencyValue', { n: w.number, name: wardName(w) })} />
                  </td>
                  <td className="px-3 py-3 align-top text-sm">
                    <p className="font-medium">{t('list.constituencyChip', { n: w.number })}</p>
                    <p className="mt-0.5 max-w-[16rem] text-xs text-slate-500">{wardName(w)}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <CorporatorCell ward={w} onChanged={handleChanged} />
                  </td>
                  <td className="px-3 py-3 align-top text-sm">
                    {w.mandal_adhyaksh ? w.mandal_adhyaksh.name : <span className="text-slate-400">{t('roles.none')}</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">{t('roles.grid.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {roster.mandal_adhyaksh_list.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">{t('roles.grid.accountsHeading')}</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {roster.mandal_adhyaksh_list.map((m) => (
              <MandalAccountRow key={m.id} account={m} onChanged={handleChanged} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
