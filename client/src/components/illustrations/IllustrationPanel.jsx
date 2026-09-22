/**
 * Small tinted frame for a persona illustration next to a page's title. Hidden below `sm` so it
 * never competes with the page's content on a phone - purely a desktop/tablet flourish.
 */
export default function IllustrationPanel({ children, className = '' }) {
  return (
    <div className={`hidden shrink-0 rounded-xl bg-brand-50 p-2 sm:block ${className}`}>
      {children}
    </div>
  );
}
