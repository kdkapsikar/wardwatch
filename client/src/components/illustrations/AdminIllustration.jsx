/**
 * Decorative header scene for the mayor/admin dashboard: a small skyline with a magnifying-glass
 * "insight" overlay and an upward resolution trend. Original artwork, colored from the app's own
 * theme tokens.
 */
export default function AdminIllustration({ className }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true">
      <line x1="8" y1="172" x2="232" y2="172" className="stroke-slate-200" strokeWidth="2" />
      {/* skyline */}
      <rect x="18" y="112" width="26" height="60" rx="3" className="fill-slate-900" />
      <rect x="24" y="120" width="5" height="5" className="fill-white/55" />
      <rect x="34" y="120" width="5" height="5" className="fill-white/55" />
      <rect x="24" y="132" width="5" height="5" className="fill-white/55" />
      <rect x="34" y="132" width="5" height="5" className="fill-white/55" />
      <rect x="50" y="88" width="30" height="84" rx="3" className="fill-brand-600" />
      <rect x="88" y="58" width="34" height="114" rx="3" className="fill-slate-900" />
      <rect x="97" y="68" width="6" height="6" className="fill-white/50" />
      <rect x="109" y="68" width="6" height="6" className="fill-white/50" />
      <rect x="97" y="82" width="6" height="6" className="fill-white/50" />
      <rect x="109" y="82" width="6" height="6" className="fill-white/50" />
      <path d="M105 58 L105 46 L112 52 Z" className="fill-amber-500" />
      <rect x="128" y="96" width="28" height="76" rx="3" className="fill-brand-600" />
      <rect x="162" y="116" width="26" height="56" rx="3" className="fill-slate-900" />
      {/* resolution trend, ticking up */}
      <polyline points="196,150 206,138 216,142 226,120" className="fill-none stroke-amber-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="226" cy="120" r="4.5" className="fill-amber-500" />
      {/* magnifying-glass overlay: a glimpse of the category chart */}
      <circle cx="178" cy="46" r="24" className="fill-white/95 stroke-brand-600" strokeWidth="4.5" />
      <line x1="194" y1="63" x2="208" y2="77" className="stroke-brand-600" strokeWidth="7" strokeLinecap="round" />
      <rect x="166" y="52" width="7" height="12" className="fill-amber-500" />
      <rect x="176" y="46" width="7" height="18" className="fill-brand-600" />
      <rect x="186" y="38" width="7" height="26" className="fill-amber-500" />
    </svg>
  );
}
