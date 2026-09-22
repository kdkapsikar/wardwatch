/**
 * Decorative hero scene for the citizen-facing pages: reporting a pothole under a faulty
 * streetlamp, pinning the location, with a confirmation bubble. Original artwork (flat shapes,
 * no stock imagery), colored entirely from the app's own theme tokens so it re-themes for free.
 */
export default function CitizenIllustration({ className }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true">
      {/* ground */}
      <line x1="12" y1="172" x2="228" y2="172" className="stroke-slate-200" strokeWidth="2" />
      {/* the pothole being reported */}
      <ellipse cx="42" cy="174" rx="24" ry="7" className="fill-slate-900/10" />
      <path d="M26 174 L34 171 M48 176 L58 172 M36 177 L44 174" className="stroke-slate-900/30" strokeWidth="1.4" strokeLinecap="round" />
      {/* streetlamp with a fault indicator */}
      <line x1="197" y1="172" x2="197" y2="46" className="stroke-slate-900" strokeWidth="4" strokeLinecap="round" />
      <rect x="184" y="30" width="26" height="17" rx="6" className="fill-slate-900" />
      <circle cx="197" cy="38.5" r="5" className="fill-amber-500" />
      <path d="M191 38 L196 33 L194 39 L200 34" className="fill-none stroke-white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* citizen figure */}
      <circle cx="92" cy="64" r="15" className="fill-slate-900" />
      <path d="M77 152 C75 122 77 96 84 81 L100 81 C107 96 109 122 107 152 Z" className="fill-brand-600" />
      <rect x="78" y="150" width="11" height="23" rx="4" className="fill-slate-900" />
      <rect x="97" y="150" width="11" height="23" rx="4" className="fill-slate-900" />
      {/* raised arm holding phone */}
      <rect x="99" y="79" width="33" height="10" rx="5" className="fill-brand-600" transform="rotate(-38 99 84)" />
      <rect x="122" y="53" width="17" height="28" rx="3" className="fill-white stroke-slate-900" strokeWidth="1.6" />
      <circle cx="130.5" cy="63" r="2.6" className="fill-amber-500" />
      <line x1="126" y1="72" x2="135" y2="72" className="stroke-slate-200" strokeWidth="1.6" strokeLinecap="round" />
      {/* floating location pin, just dropped */}
      <path d="M158 10 C166 10 172 17 172 25 C172 35 158 52 158 52 C158 52 144 35 144 25 C144 17 150 10 158 10 Z" className="fill-amber-500" />
      <circle cx="158" cy="25" r="6.5" className="fill-white" />
      <path d="M130 32 Q123 23 130 14" className="fill-none stroke-amber-500" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M186 32 Q193 23 186 14" className="fill-none stroke-amber-500" strokeWidth="2.4" strokeLinecap="round" />
      {/* confirmation bubble */}
      <rect x="40" y="46" width="36" height="25" rx="8" className="fill-brand-600" />
      <path d="M62 71 L69 78 L57 78 Z" className="fill-brand-600" />
      <path d="M48 59 L54 65 L64 52" className="fill-none stroke-white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
