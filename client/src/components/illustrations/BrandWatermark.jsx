/**
 * A large, barely-visible version of the app's own shield mark, fixed to the bottom-right corner
 * of the viewport behind everything else. Pure decoration for the blank background - together
 * with the dot-grid (see index.css's .bg-dot-grid, applied in Layout.jsx) it fills the empty space
 * on quieter pages (forms, sign-in, empty lists) without competing with real content:
 *  - `fixed` + a negative z-index keeps it out of the document flow and behind every normal
 *    (position: static) element, so it never affects page height or scroll, and any card's own
 *    background simply paints over it wherever content exists.
 *  - `pointer-events-none` so it can never intercept a click or tap.
 *  - Hidden below `sm` and stepped up at `md`/`lg`: on a phone there is little spare corner space
 *    for it anyway, and the app's own content should own that room.
 */
export default function BrandWatermark() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="pointer-events-none fixed -bottom-10 -right-10 -z-10 hidden h-56 w-56 text-brand-600 opacity-[0.05] sm:block md:h-72 md:w-72 lg:h-80 lg:w-80"
    >
      <path d="M16 2l13 5v10c0 8-6 14-13 17-7-3-13-9-13-17V7z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10.5 16l4 4 7-8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
