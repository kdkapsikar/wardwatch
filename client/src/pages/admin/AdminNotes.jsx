import NotesPanel from '../../components/NotesPanel.jsx';

export default function AdminNotes() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My notes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Budget notes and reminders, general or attached to a specific issue. They belong to your account:
          no other user - corporator, admin or citizen - can see them.
        </p>
      </div>
      <NotesPanel showIssue heading="All my notes" />
    </div>
  );
}
