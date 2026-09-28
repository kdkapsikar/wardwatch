import IssueListView from '../../components/IssueListView.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function AdminIssues() {
  const { t } = useT();
  const { auth } = useAuth();
  const isMandal = auth.user.role === 'mandal_adhyaksh';
  return (
    <IssueListView
      scope="admin"
      title={t(isMandal ? 'list.admin.titleMandal' : 'list.admin.title')}
      subtitle={t(isMandal ? 'list.admin.subtitleMandal' : 'list.admin.subtitle')}
    />
  );
}
