import NotesPanel from '../../components/NotesPanel.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function AdminNotes() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.notes')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('admin.notes.lead')}</p>
      </div>
      <NotesPanel showIssue heading={t('admin.notes.all')} />
    </div>
  );
}
