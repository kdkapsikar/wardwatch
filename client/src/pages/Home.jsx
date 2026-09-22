import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext.jsx';
import CitizenIllustration from '../components/illustrations/CitizenIllustration.jsx';

export default function Home() {
  const { t } = useT();
  const steps = ['1', '2', '3'];
  return (
    <div className="space-y-12">
      <section className="py-6 text-center sm:py-12">
        <div className="mx-auto max-w-xs rounded-2xl bg-brand-50 p-4 sm:max-w-sm">
          <CitizenIllustration className="h-auto w-full" />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {t('home.title1')} <span className="text-brand-600">{t('home.title2')}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">{t('home.intro')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/report" className="btn btn-primary px-6 py-3 text-base">{t('nav.report')}</Link>
          <Link to="/track" className="btn btn-secondary px-6 py-3 text-base">{t('nav.track')}</Link>
        </div>
      </section>

      <section aria-labelledby="how" className="grid gap-4 sm:grid-cols-3">
        <h2 id="how" className="sr-only">{t('home.how')}</h2>
        {steps.map((n) => (
          <div key={n} className="card p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{n}</span>
            <h3 className="mt-3 font-semibold">{t(`home.step${n}.title`)}</h3>
            <p className="mt-1 text-sm text-slate-600">{t(`home.step${n}.text`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
