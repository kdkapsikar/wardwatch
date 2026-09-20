import { useId } from 'react';

/** Checkbox with a wrapped label (the whole label is the tap target) and an inline error. */
export default function CheckboxField({ checked, onChange, error, disabled, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-brand-600"
        />
        <span>{children}</span>
      </label>
      {error && <p id={`${id}-error`} className="mt-1 pl-8 text-xs text-red-600">{error}</p>}
    </div>
  );
}
