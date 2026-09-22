import NotesPanel from '../../components/NotesPanel.jsx';
import AdminIllustration from '../../components/illustrations/AdminIllustration.jsx';
import IllustrationPanel from '../../components/illustrations/IllustrationPanel.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function AdminNotes() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.notes')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('admin.notes.lead')}</p>
        </div>
        <IllustrationPanel>
          <AdminIllustration className="aspect-[240/190] h-24" />
        </IllustrationPanel>
      </div>
      <NotesPanel showIssue heading={t('admin.notes.all')} />
    </div>
  );
}
