import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <Link to="/" className="btn btn-primary mt-6">Go home</Link>
    </div>
  );
}
