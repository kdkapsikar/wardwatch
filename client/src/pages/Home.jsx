import { Link } from 'react-router-dom';

const STEPS = [
  ['1', 'Report', 'Pick your constituency, describe the problem and attach photos. No account needed.'],
  ['2', 'Get your Issue ID', 'Keep the ID we give you - it is all you need to follow progress.'],
  ['3', 'Track', 'The corporator for your constituency updates the status, and you can see every step.'],
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="py-6 text-center sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Report a civic issue. <span className="text-brand-600">Watch it get fixed.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Potholes, broken street lights, garbage, water problems - tell your constituency's corporator directly and follow the
          issue until it is resolved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/report" className="btn btn-primary px-6 py-3 text-base">Report an issue</Link>
          <Link to="/track" className="btn btn-secondary px-6 py-3 text-base">Track an issue</Link>
        </div>
      </section>

      <section aria-labelledby="how" className="grid gap-4 sm:grid-cols-3">
        <h2 id="how" className="sr-only">How it works</h2>
        {STEPS.map(([n, title, text]) => (
          <div key={n} className="card p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{n}</span>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
