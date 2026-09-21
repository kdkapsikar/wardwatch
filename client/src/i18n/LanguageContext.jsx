import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { detectInitialLang, persistLang, setLang as setModuleLang, translate } from './index.js';

const LanguageContext = createContext(null);

// Placeholder corporator names created by the seed/loader scripts ("Constituency 7 Corporator")
// are translated; real names are shown exactly as entered.
const PLACEHOLDER_CORPORATOR = /^Constituency (\d+) Corporator$/;

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const initial = detectInitialLang();
    setModuleLang(initial); // module state must be right before the first render
    return initial;
  });

  const setLang = useCallback((next) => {
    setModuleLang(next);
    persistLang(next);
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate('app.title');
  }, [lang]);

  // A new object per language: every component that called useT() re-renders when it changes.
  const value = useMemo(() => {
    const t = (key, params) => translate(key, params);
    return {
      lang,
      setLang,
      t,
      statusLabel: (status) => t(`status.${status}`),
      categoryLabel: (category) => t(`category.${category}`),
      // Constituencies carry their areas in `name` (English) and `name_mr` (Marathi).
      wardName: (ward) => (lang === 'mr' && ward?.name_mr ? ward.name_mr : ward?.name ?? ''),
      personName: (name) => {
        const m = lang === 'mr' && typeof name === 'string' ? name.match(PLACEHOLDER_CORPORATOR) : null;
        return m ? t('person.corporatorPlaceholder', { n: m[1] }) : name;
      },
    };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);
