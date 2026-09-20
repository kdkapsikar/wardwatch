import { useId } from 'react';

/**
 * Label + control + error. `children` receives the props the control needs
 * (id, aria wiring, error styling) so any <input>/<select>/<textarea> works.
 */
export default function FormField({ label, error, hint, optional, required, children }) {
  const id = useId();
  const controlProps = {
    id,
    required: required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: `input${error ? ' input-error' : ''}`,
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children(controlProps)}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
