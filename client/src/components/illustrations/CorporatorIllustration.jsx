/**
 * Decorative header scene for the corporator dashboard: reviewing a status list on a tablet, a
 * ward badge, a resolved checkmark and a wrench for on-ground work. Original artwork, colored
 * from the app's own theme tokens.
 */
export default function CorporatorIllustration({ className }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden="true">
      <line x1="12" y1="172" x2="228" y2="172" className="stroke-slate-200" strokeWidth="2" />
      {/* corporator figure */}
      <circle cx="95" cy="60" r="15" className="fill-slate-900" />
      <path d="M80 150 C78 120 80 94 87 79 L103 79 C110 94 112 120 110 150 Z" className="fill-brand-600" />
      <rect x="81" y="148" width="11" height="24" rx="4" className="fill-slate-900" />
      <rect x="100" y="148" width="11" height="24" rx="4" className="fill-slate-900" />
      {/* arms holding tablet */}
      <rect x="72" y="98" width="30" height="9" rx="4.5" className="fill-brand-600" transform="rotate(18 72 102)" />
      <rect x="100" y="98" width="30" height="9" rx="4.5" className="fill-brand-600" transform="rotate(-18 130 102)" />
      {/* tablet: a mini status list */}
      <rect x="70" y="94" width="52" height="38" rx="5" className="fill-white stroke-slate-900" strokeWidth="1.6" />
      <rect x="77" y="102" width="30" height="4.5" rx="2.25" className="fill-amber-500" />
      <rect x="77" y="112" width="22" height="4.5" rx="2.25" className="fill-amber-400" />
      <rect x="77" y="122" width="26" height="4.5" rx="2.25" className="fill-emerald-500" />
      {/* ward badge */}
      <polygon points="168,58 182,66 182,82 168,90 154,82 154,66" className="fill-amber-500" />
      <circle cx="168" cy="74" r="4.5" className="fill-white" />
      {/* resolved badge */}
      <circle cx="182" cy="128" r="16" className="fill-brand-600" />
      <path d="M174 128 L180 134 L191 121" className="fill-none stroke-white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* wrench: on-the-ground work */}
      <g transform="translate(40 128) rotate(-25)">
        <rect x="0" y="0" width="26" height="7" rx="3.5" className="fill-slate-900" />
        <circle cx="2" cy="3.5" r="6" className="fill-none stroke-slate-900" strokeWidth="3.4" />
      </g>
    </svg>
  );
}
