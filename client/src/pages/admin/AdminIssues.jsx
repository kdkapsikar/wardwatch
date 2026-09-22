import IssueListView from '../../components/IssueListView.jsx';
import AdminIllustration from '../../components/illustrations/AdminIllustration.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function AdminIssues() {
  const { t } = useT();
  return (
    <IssueListView
      scope="admin"
      title={t('list.admin.title')}
      subtitle={t('list.admin.subtitle')}
      illustration={<AdminIllustration className="aspect-[240/190] h-24" />}
    />
  );
}
