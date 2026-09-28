import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const ALL = '__all__';
const CREATABLE_ROLES = ['corporator', 'mandal_adhyaksh'];

function roleLabel(t, role) {
  if (role === 'corporator') return t('roles.corporator.heading');
  if (role === 'mandal_adhyaksh') return t('roles.mandal.heading');
  return t('roles.role.admin');
}

function constituencyText(t, wardName, account) {
  if (account.role === 'corporator') {
    return account.ward ? t('list.constituencyChip', { n: account.ward.number }) : t('accounts.unassigned');
  }
  if (account.role === 'mandal_adhyaksh') {
    return t('roles.mandal.wardCount', { n: account.ward_count, count: account.ward_count });
  }
  return '—';
}

/** One account's first name / last name / username, always editable; a Save link appears once
 *  something differs from the loaded values and updates the same account in place. */
function AccountRow({ account, onChanged }) {
  const { t, wardName } = useT();
  const [firstName, setFirstName] = useState(account.first_name);
  const [lastName, setLastName] = useState(account.last_name);
  const [username, setUsername] = useState(account.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setFirstName(account.first_name);
    setLastName(account.last_name);
    setUsername(account.username);
    setError('');
    setConfirming(false);
  }, [account.id, account.role, account.first_name, account.last_name, account.username]);

  const dirty = firstName.trim() !== account.first_name || lastName.trim() !== account.last_name || username.trim() !== account.username;

  async function save() {
    const fn = firstName.trim();
    const un = username.trim();
    if (!fn || !un) {
      setError(t('roles.grid.bothRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateAccount(account.role, account.id, { first_name: fn, last_name: lastName.trim(), username: un });
      onChanged(t('accounts.updated', { name: fn }));
    } catch (err) {
      setError(err.fields?.first_name ?? err.fields?.last_name ?? err.fields?.username ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    setSaving(true);
    setError('');
    try {
      await api.deactivateAccount(account.role, account.id);
      onChanged(t('accounts.deactivated', { name: account.first_name }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const canDeactivate = CREATABLE_ROLES.includes(account.role) && account.is_active;

  return (
    <tr className={account.is_active ? undefined : 'opacity-50'}>
      <td className="px-3 py-2.5"><input className="input w-36 px-2 py-1 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></td>
      <td className="px-3 py-2.5"><input className="input w-36 px-2 py-1 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} /></td>
      <td className="px-3 py-2.5"><input className="input w-32 px-2 py-1 text-sm" value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} /></td>
      <td className="px-3 py-2.5 text-sm text-slate-600">{roleLabel(t, account.role)}</td>
      <td className="px-3 py-2.5 text-sm text-slate-600">
        {constituencyText(t, wardName, account)}
        {!account.is_active && <span className="ml-1 text-xs text-slate-400">– {t('admin.dash.inactive')}</span>}
      </td>
      <td className="px-3 py-2.5 text-right text-xs">
        {error && <p className="mb-1 text-left text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {dirty && (
            <button type="button" onClick={save} disabled={saving} className="font-medium text-brand-700 hover:underline disabled:opacity-60">
              {saving ? t('roles.saving') : t('roles.grid.save')}
            </button>
          )}
          {!dirty && canDeactivate && (
            confirming ? (
              <span className="flex items-center gap-2">
                <span className="text-slate-500">{t('accounts.deactivateConfirm')}</span>
                <button type="button" onClick={deactivate} disabled={saving} className="font-medium text-rose-700 hover:underline">{t('roles.corporator.deactivateYes')}</button>
                <button type="button" onClick={() => setConfirming(false)} className="text-slate-500 hover:underline">{t('common.cancel')}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-slate-400 hover:text-rose-700 hover:underline">{t('roles.corporator.deactivate')}</button>
            )
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Every account in the system - corporators, Mandal Adhyaksh, and the Mayor/Admin - as one list, with
 * a role on each. Corporator and Mandal Adhyaksh accounts can be created and edited here; which
 * constituency (if any) they cover is set separately, on Manage roles.
 */
export default function AdminAccounts() {
  const { t } = useT();
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState('');
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [form, setForm] = useState({ role: '', first_name: '', last_name: '', username: '' });
  const [formErrors, setFormErrors] = useState({});
  const [creating, setCreating] = useState(false);

  function load() {
    return api.getAccounts()
      .then((d) => setAccounts(d.accounts))
      .catch((e) => setLoadError(e.message));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!accounts) return [];
    const q = filter.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== ALL && a.role !== roleFilter) return false;
      if (!q) return true;
      return `${a.first_name} ${a.last_name} ${a.username}`.toLowerCase().includes(q);
    });
  }, [accounts, filter, roleFilter]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!accounts) return <Spinner />;

  function handleChanged(message) {
    setFlash(message);
    load();
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setFormErrors({});
    try {
      const { account } = await api.createAccount(form);
      setFlash(account.role === 'corporator'
        ? t('roles.corporator.created', { name: form.first_name })
        : t('roles.mandal.created', { name: form.first_name }));
      setForm({ role: '', first_name: '', last_name: '', username: '' });
      await load();
    } catch (err) {
      setFormErrors(err.fields ?? {});
    } finally {
      setCreating(false);
    }
  }

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('accounts.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('accounts.lead')}</p>
      </div>

      <Alert tone="success">{flash}</Alert>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">{t('accounts.addHeading')}</h2>
        <form onSubmit={handleCreate} className="mt-2 flex flex-wrap items-start gap-2">
          <select
            className={`input w-40 px-2 py-1.5 text-sm${formErrors.role ? ' input-error' : ''}`}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="" disabled>{t('accounts.rolePlaceholder')}</option>
            {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(t, r)}</option>)}
          </select>
          <input
            className={`input w-36 px-2 py-1.5 text-sm${formErrors.first_name ? ' input-error' : ''}`}
            placeholder={t('accounts.firstName')}
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          />
          <input
            className="input w-36 px-2 py-1.5 text-sm"
            placeholder={t('accounts.lastName')}
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          />
          <input
            className={`input w-36 px-2 py-1.5 text-sm${formErrors.username ? ' input-error' : ''}`}
            placeholder={t('login.username')}
            value={form.username}
            autoCapitalize="none"
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <button type="submit" disabled={creating || !form.role || !form.first_name.trim() || !form.username.trim()} className="btn btn-primary px-3 py-1.5 text-sm">
            {creating ? t('roles.creating') : t('accounts.create')}
          </button>
        </form>
        {(formErrors.role || formErrors.first_name || formErrors.username) && (
          <p className="mt-1 text-xs text-red-600">{formErrors.role ?? formErrors.first_name ?? formErrors.username}</p>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">{t('accounts.title')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-40 px-2 py-1.5 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value={ALL}>{t('accounts.roleFilterAll')}</option>
              <option value="corporator">{t('roles.corporator.heading')}</option>
              <option value="mandal_adhyaksh">{t('roles.mandal.heading')}</option>
              <option value="admin">{t('roles.role.admin')}</option>
            </select>
            <input
              className="input w-56 px-2 py-1.5 text-sm"
              placeholder={t('accounts.filterPlaceholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('accounts.firstName')}</th>
                <th className={th}>{t('accounts.lastName')}</th>
                <th className={th}>{t('login.username')}</th>
                <th className={th}>{t('accounts.role')}</th>
                <th className={th}>{t('admin.dash.col.ward')}</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => <AccountRow key={`${a.role}-${a.id}`} account={a} onChanged={handleChanged} />)}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">{t('accounts.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
