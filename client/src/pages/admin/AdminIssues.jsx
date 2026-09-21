import IssueListView from '../../components/IssueListView.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function AdminIssues() {
  const { t } = useT();
  return <IssueListView scope="admin" title={t('list.admin.title')} subtitle={t('list.admin.subtitle')} />;
}
