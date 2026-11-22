// Hand-rolled SVG charts (no chart library): time-series lines, stacked weekly columns,
// a calendar heatmap and sparklines. Marks follow the dataviz spec: 2px lines, 4px rounded
// bar ends, surface ring on markers, recessive grid, hover tooltip on everything.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { fmtDate, fmtNum, parseDay } from './api';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(lo: number, hi: number, count = 4) {
  if (hi <= lo) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  // Floor/ceil to the step so the ticks always enclose the data.
  const out: number[] = [];
  const end = Math.ceil(hi / step - 1e-9) * step;
  for (let v = Math.floor(lo / step + 1e-9) * step; v <= end + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function timeTicks(t0: number, t1: number, width: number) {
  const days = (t1 - t0) / 86_400_000;
  const maxTicks = Math.max(2, Math.floor(width / 70));
  const stepMonths = [1, 2, 3, 6, 12, 24, 36, 60].find((m) => days / 30.4 / m <= maxTicks) ?? 60;
  const d = new Date(t0);
  d.setDate(1);
  d.setHours(12, 0, 0, 0);
  d.setMonth(Math.ceil(d.getMonth() / stepMonths) * stepMonths);
  const out: { t: number; label: string }[] = [];
  while (d.getTime() <= t1) {
    if (d.getTime() >= t0) {
      const label = stepMonths >= 12 || d.getMonth() === 0 ? String(d.getFullYear()) : MON[d.getMonth()];
      out.push({ t: d.getTime(), label });
    }
    d.setMonth(d.getMonth() + stepMonths);
  }
  return out;
}

function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flip to the left of the cursor in the right half so it never overflows.
  const left = x > width / 2;
  return (
    <div className="tip" style={{ top: Math.max(0, y - 10), ...(left ? { right: width - x + 14 } : { left: x + 14 }) }}>
      {children}
    </div>
  );
}

// ---------- time-series lines ----------

export type LinePoint = { date: string; v: number; hollow?: boolean; label?: string; id?: string };
export type LineSeries = { key: string; label: string; color: string; points: LinePoint[] };

/** Gaps longer than this aren't connected (layoffs between programs). */
const GAP_DAYS = 100;

export function TimeLines({
  series,
  height = 260,
  unit = 'lb',
  onPick,
  yFloorZero = false,
}: {
  series: LineSeries[];
  height?: number;
  unit?: string;
  onPick?: (p: LinePoint, s: LineSeries) => void;
  yFloorZero?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const all = series.flatMap((s) => s.points);
  const M = { l: 40, r: 12, t: 10, b: 24 };
  if (!all.length) return <div className="muted small" style={{ padding: 24 }}>No data in this range.</div>;

  const ts = all.map((p) => parseDay(p.date).getTime());
  const vs = all.map((p) => p.v);
  let t0 = Math.min(...ts);
  let t1 = Math.max(...ts);
  if (t1 - t0 < 30 * 86_400_000) [t0, t1] = [t0 - 15 * 86_400_000, t1 + 15 * 86_400_000];
  const pad = (Math.max(...vs) - Math.min(...vs)) * 0.08 || 10;
  const yTicks = niceTicks(yFloorZero ? 0 : Math.min(...vs) - pad, Math.max(...vs) + pad);
  const [v0, v1] = [yTicks[0], yTicks.at(-1)!];
  const iw = Math.max(10, width - M.l - M.r);
  const ih = height - M.t - M.b;
  const x = (t: number) => M.l + ((t - t0) / (t1 - t0)) * iw;
  const y = (v: number) => M.t + ih - ((v - v0) / (v1 - v0 || 1)) * ih;

  const paths = series.map((s) => {
    let d = '';
    let prev = 0;
    for (const p of s.points) {
      const t = parseDay(p.date).getTime();
      d += `${d && t - prev <= GAP_DAYS * 86_400_000 ? 'L' : 'M'}${x(t).toFixed(1)},${y(p.v).toFixed(1)}`;
      prev = t;
    }
    return d;
  });

  // Hover: snap to the nearest point in time; list each series' point nearest that date.
  let tipRows: { s: LineSeries; p: LinePoint }[] = [];
  let snapT = 0;
  if (hover) {
    let best = Infinity;
    for (const t of ts) if (Math.abs(t - hover.t) < best) [best, snapT] = [Math.abs(t - hover.t), t];
    tipRows = series.flatMap((s) => {
      let bp: LinePoint | undefined;
      let bd = Infinity;
      for (const p of s.points) {
        const d = Math.abs(parseDay(p.date).getTime() - snapT);
        if (d < bd) [bd, bp] = [d, p];
      }
      return bp && bd <= 10 * 86_400_000 ? [{ s, p: bp }] : [];
    });
  }

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - r.left;
            setHover({ x: px, t: t0 + ((px - M.l) / iw) * (t1 - t0) });
          }}
          onMouseLeave={() => setHover(null)}
          onClick={() => tipRows[0] && onPick?.(tipRows[0].p, tipRows[0].s)}
          style={{ cursor: onPick ? 'pointer' : undefined }}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={M.l - 6} y={y(v) + 4} textAnchor="end">{fmtNum(v)}</text>
            </g>
          ))}
          {timeTicks(t0, t1, iw).map((tk) => (
            <text key={tk.t} x={x(tk.t)} y={height - 6} textAnchor="middle">{tk.label}</text>
          ))}
          {hover && tipRows.length > 0 && <line x1={x(snapT)} x2={x(snapT)} y1={M.t} y2={M.t + ih} stroke="var(--axis)" />}
          {series.map((s, i) => (
            <g key={s.key}>
              <path d={paths[i]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, j) => (
                <circle
                  key={j}
                  cx={x(parseDay(p.date).getTime())}
                  cy={y(p.v)}
                  r={3.5}
                  fill={p.hollow ? 'var(--surface-1)' : s.color}
                  stroke={p.hollow ? s.color : 'var(--surface-1)'}
                  strokeWidth={p.hollow ? 1.5 : 2}
                />
              ))}
            </g>
          ))}
          {tipRows.map(({ s, p }) => (
            <circle key={s.key} cx={x(parseDay(p.date).getTime())} cy={y(p.v)} r={5} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
          ))}
        </svg>
      )}
      {hover && tipRows.length > 0 && (
        <Tip x={x(snapT)} y={Math.min(...tipRows.map((r) => y(r.p.v)))} width={width}>
          <div className="t">{fmtDate(tipRows[0].p.date)}</div>
          {tipRows.map(({ s, p }) => (
            <div className="r" key={s.key}>
              {series.length > 1 && <span className="swatch" style={{ background: s.color }} />}
              <span className="num">{fmtNum(p.v)} {unit}</span>
              {p.label && <span className="muted">{p.label}</span>}
            </div>
          ))}
        </Tip>
      )}
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.key}>
              <span className="swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- stacked weekly columns ----------

export type StackKey = { key: string; label: string; color: string };

export function StackedColumns({
  rows,
  keys,
  height = 200,
  unit = 'sets',
}: {
  rows: { label: string; date: string; values: Record<string, number>; note?: string }[];
  keys: StackKey[];
  height?: number;
  unit?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const M = { l: 32, r: 4, t: 8, b: 22 };
  const totals = rows.map((r) => keys.reduce((t, k) => t + (r.values[k.key] ?? 0), 0));
  const yTicks = niceTicks(0, Math.max(10, ...totals), 3);
  const vMax = yTicks.at(-1)!;
  const iw = Math.max(10, width - M.l - M.r);
  const ih = height - M.t - M.b;
  const band = iw / Math.max(1, rows.length);
  const bw = Math.min(24, Math.max(3, band - 3));
  const y = (v: number) => M.t + ih - (v / vMax) * ih;
  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(iw / 56)));

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHi(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={M.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = M.l + band * i + band / 2;
            let acc = 0;
            const segs = keys.map((k) => {
              const v = r.values[k.key] ?? 0;
              const seg = { k, y0: acc, y1: acc + v };
              acc += v;
              return seg;
            }).filter((s) => s.y1 > s.y0);
            return (
              <g key={r.date} onMouseEnter={() => setHi(i)} opacity={hi == null || hi === i ? 1 : 0.55}>
                <rect x={M.l + band * i} y={M.t} width={band} height={ih} fill="transparent" />
                {segs.map((s, j) => {
                  const top = j === segs.length - 1;
                  const yTop = y(s.y1);
                  // 2px surface gap between stacked segments; only the top segment gets the rounded end.
                  const h = Math.max(0, y(s.y0) - yTop - (j > 0 ? 2 : 0));
                  const r4 = top ? Math.min(4, h, bw / 2) : 0;
                  const x0 = cx - bw / 2;
                  const d = `M${x0},${yTop + h}V${yTop + r4}Q${x0},${yTop} ${x0 + r4},${yTop}H${x0 + bw - r4}Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r4}V${yTop + h}Z`;
                  return <path key={s.k.key} d={d} fill={s.k.color} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle">{r.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hi != null && rows[hi] && (
        <Tip x={M.l + band * hi + band / 2} y={y(totals[hi])} width={width}>
          <div className="t">{rows[hi].note ?? rows[hi].label}</div>
          <div className="r"><span className="num">{totals[hi]} {unit}</span></div>
          {keys.filter((k) => rows[hi].values[k.key]).reverse().map((k) => (
            <div className="r" key={k.key}>
              <span className="swatch" style={{ background: k.color }} />
              <span className="num">{rows[hi].values[k.key]}</span>
              <span className="muted">{k.label}</span>
            </div>
          ))}
        </Tip>
      )}
      <div className="legend">
        {keys.map((k) => (
          <span key={k.key}>
            <span className="swatch" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- calendar heatmap ----------

export function CalendarHeat({ days, weeks: maxWeeks = 53 }: { days: { date: string; sets: number; names: string[] }[]; weeks?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // On narrow screens show the most recent weeks that fit at the minimum cell size.
  const weeks = Math.max(8, Math.min(maxWeeks, Math.floor((width - 24) / 8)));
  const [hi, setHi] = useState<{ x: number; y: number; date: string } | null>(null);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7); // a Monday
  const gap = 2;
  const cell = Math.max(6, Math.min(14, Math.floor((width - 24) / weeks) - gap));
  const step = cell + gap;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const level = (s: number) => (s === 0 ? 0 : s < 15 ? 1 : s < 22 ? 2 : s < 28 ? 3 : 4);
  const cells: ReactNode[] = [];
  const months: ReactNode[] = [];
  let count = 0;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) continue;
      const key = iso(day);
      const v = byDate.get(key);
      if (v) count++;
      const cx = 24 + w * step;
      const cy = 14 + d * step;
      cells.push(
        <rect
          key={key}
          x={cx}
          y={cy}
          width={cell}
          height={cell}
          rx={2}
          fill={`var(--seq-${level(v?.sets ?? 0)})`}
          onMouseEnter={() => setHi({ x: cx + cell / 2, y: cy, date: key })}
        />,
      );
      if (d === 0 && day.getDate() <= 7) months.push(<text key={`m${w}`} x={cx} y={9}>{MON[day.getMonth()]}</text>);
    }
  }
  const hov = hi && byDate.get(hi.date);
  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={14 + 7 * step} onMouseLeave={() => setHi(null)}>
          {months}
          {['M', '', 'W', '', 'F', '', ''].map((l, i) => (
            <text key={i} x={0} y={14 + i * step + cell - 1}>{l}</text>
          ))}
          {cells}
        </svg>
      )}
      {hi && (
        <Tip x={hi.x} y={hi.y} width={width}>
          <div className="t">{fmtDate(hi.date)}</div>
          {hov ? (
            <>
              <div className="r">{hov.names.join(', ')}</div>
              <div className="r num">{hov.sets} working sets</div>
            </>
          ) : (
            <div className="r muted">Rest day</div>
          )}
        </Tip>
      )}
      <div className="legend">
        <span>{count} sessions in the last {weeks >= 52 ? 'year' : `${weeks} weeks`}</span>
        <span>
          Fewer {[0, 1, 2, 3, 4].map((l) => <span key={l} className="swatch" style={{ background: `var(--seq-${l})` }} />)} more sets
        </span>
      </div>
    </div>
  );
}

// ---------- sparkline ----------

export function Sparkline({ values, color = 'var(--series-1)', height = 36 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  if (values.length < 2) return <div ref={ref} style={{ height }} />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => 3 + (i / (values.length - 1)) * (width - 6);
  const y = (v: number) => 3 + (height - 6) * (1 - (v - lo) / (hi - lo || 1));
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <div ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height}>
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={3.5} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
