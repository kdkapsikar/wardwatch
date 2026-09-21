import { useT } from '../../i18n/LanguageContext.jsx';

export default function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">{t('app.tagline')}</div>
    </footer>
  );
}
