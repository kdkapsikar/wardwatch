import IssueListView from '../../components/IssueListView.jsx';
import CorporatorIllustration from '../../components/illustrations/CorporatorIllustration.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';

export default function CorporatorIssues() {
  const { auth } = useAuth();
  const { t, wardName } = useT();
  return (
    <IssueListView
      scope="corporator"
      title={t('nav.issues')}
      subtitle={t('detail.constituencyValue', { n: auth.user.ward.number, name: wardName(auth.user.ward) })}
      illustration={<CorporatorIllustration className="aspect-[240/190] h-24" />}
    />
  );
}
