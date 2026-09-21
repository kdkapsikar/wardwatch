import { LANGS } from '../i18n/index.js';
import { useT } from '../i18n/LanguageContext.jsx';

/** English | मराठी switch shown at the top of every page. */
export default function LanguageToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div role="group" aria-label={t('lang.label')} className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm font-medium">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`px-3 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/40 ${
            lang === l.code ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
