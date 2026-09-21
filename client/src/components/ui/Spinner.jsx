import { useT } from '../../i18n/LanguageContext.jsx';

export default function Spinner({ label }) {
  const { t } = useT();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label ?? t('common.loading')}
    </div>
  );
}
