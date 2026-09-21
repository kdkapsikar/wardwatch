import { useState } from 'react';
import { Link, useHref, useNavigate } from 'react-router-dom';

// Donut/pie with click-through slices and a legend table.
//  - Colours come from the caller and are FIXED per category (see CATEGORY_CHART).
//  - Slices are separated by a 2px surface-coloured gap, not a border.
//  - The legend is a real table (count + share for every slice, each row a link): that is the
//    non-colour, non-hover way to read every value and the relief for low-contrast hues.
//  - Hover or keyboard focus on a slice (or its row) shows that slice's numbers in the centre.

const SIZE = 220;
const C = SIZE / 2;
const OUTER = 104;
const INNER = 62;
const SURFACE = '#ffffff'; // the card behind the chart

const point = (r, angle) => [C + r * Math.cos(angle), C + r * Math.sin(angle)];

function slicePath(a0, a1) {
  const [x0, y0] = point(OUTER, a0);
  const [x1, y1] = point(OUTER, a1);
  const [x2, y2] = point(INNER, a1);
  const [x3, y3] = point(INNER, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${OUTER} ${OUTER} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${INNER} ${INNER} 0 ${large} 0 ${x3} ${y3}Z`;
}

// One slice covering 100% cannot be drawn as a single arc (start == end), so draw a full ring.
const fullRing = () =>
  `M${C - OUTER} ${C}a${OUTER} ${OUTER} 0 1 0 ${OUTER * 2} 0a${OUTER} ${OUTER} 0 1 0 ${-OUTER * 2} 0Z` +
  `M${C - INNER} ${C}a${INNER} ${INNER} 0 1 0 ${INNER * 2} 0a${INNER} ${INNER} 0 1 0 ${-INNER * 2} 0Z`;

const pct = (value, total) => {
  const p = (value / total) * 100;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
};

function Slice({ slice, path, fullRing: ring, total, unit, dimmed, active, onActive }) {
  const navigate = useNavigate();
  const href = useHref(slice.to);
  const label = `${slice.label}: ${slice.value} ${unit} (${pct(slice.value, total)}). View these ${unit}`;
  return (
    <a
      className="pie-slice"
      href={href}
      aria-label={label}
      onClick={(e) => {
        // keep it a client-side navigation, but let ctrl/cmd/middle-click open a new tab as usual
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(slice.to);
      }}
      onPointerEnter={() => onActive(slice.key)}
      onPointerLeave={() => onActive(null)}
      onFocus={() => onActive(slice.key)}
      onBlur={() => onActive(null)}
    >
      <title>{`${slice.label}: ${slice.value} (${pct(slice.value, total)})`}</title>
      <path
        d={path}
        fill={slice.color}
        fillRule={ring ? 'evenodd' : undefined}
        stroke={SURFACE}
        strokeWidth="2"
        style={{
          opacity: dimmed ? 0.45 : 1,
          transformOrigin: `${C}px ${C}px`,
          transform: active ? 'scale(1.035)' : 'scale(1)',
          transition: 'opacity 120ms, transform 120ms',
        }}
      />
    </a>
  );
}

/**
 * slices: [{ key, label, value, color, to }]  (value > 0; order is the drawing order, clockwise from 12 o'clock)
 */
export default function PieChart({ slices, unit = 'issues', ariaLabel }) {
  const [activeKey, setActiveKey] = useState(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  if (total === 0) return null;
  const active = slices.find((s) => s.key === activeKey);

  let angle = -Math.PI / 2;
  const drawn = slices.map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const path = slices.length === 1 ? fullRing() : slicePath(angle, angle + sweep);
    angle += sweep;
    return { slice: s, path };
  });

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-56 w-56 shrink-0 overflow-visible" role="group" aria-label={ariaLabel}>
        {drawn.map(({ slice, path }) => (
          <Slice
            key={slice.key}
            slice={slice}
            path={path}
            fullRing={slices.length === 1}
            total={total}
            unit={unit}
            active={activeKey === slice.key}
            dimmed={activeKey !== null && activeKey !== slice.key}
            onActive={setActiveKey}
          />
        ))}
        {/* centre readout: total by default, the hovered/focused slice otherwise */}
        <g pointerEvents="none" textAnchor="middle">
          <text x={C} y={active ? C - 8 : C + 4} className="fill-slate-900" style={{ font: '600 30px system-ui, sans-serif' }}>
            {active ? active.value : total}
          </text>
          <text x={C} y={active ? C + 10 : C + 22} className="fill-slate-500" style={{ font: '12px system-ui, sans-serif' }}>
            {active ? active.label : unit}
          </text>
          {active && (
            <text x={C} y={C + 27} className="fill-slate-500" style={{ font: '12px system-ui, sans-serif' }}>
              {pct(active.value, total)} of all
            </text>
          )}
        </g>
      </svg>

      <table className="w-full max-w-md text-sm">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="pb-2 text-left font-semibold">Category</th>
            <th scope="col" className="pb-2 text-right font-semibold">{unit}</th>
            <th scope="col" className="pb-2 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr
              key={s.key}
              onPointerEnter={() => setActiveKey(s.key)}
              onPointerLeave={() => setActiveKey(null)}
              className={`border-t border-slate-100 transition ${activeKey === s.key ? 'bg-slate-50' : ''}`}
            >
              <td className="py-2 pr-3">
                <Link
                  to={s.to}
                  onFocus={() => setActiveKey(s.key)}
                  onBlur={() => setActiveKey(null)}
                  className="flex items-center gap-2.5 font-medium text-slate-800 hover:text-brand-700 hover:underline"
                >
                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  {s.label}
                </Link>
              </td>
              <td className="py-2 text-right font-semibold tabular-nums text-slate-900">{s.value}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-slate-600">{pct(s.value, total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 text-slate-600">
            <td className="pt-2 font-medium">Total</td>
            <td className="pt-2 text-right font-semibold tabular-nums text-slate-900">{total}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
