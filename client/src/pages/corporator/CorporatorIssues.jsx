import IssueListView from '../../components/IssueListView.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function CorporatorIssues() {
  const { auth } = useAuth();
  return (
    <IssueListView
      scope="corporator"
      title="Issues"
      subtitle={`Constituency ${auth.user.ward.number} - ${auth.user.ward.name}`}
    />
  );
}
