const TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export default function Alert({ tone = 'error', children }) {
  if (!children) return null;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}
