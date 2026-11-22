// Hash routes: #/ overview · #/exercises · #/exercises/:id · #/workouts · #/workouts/:id
import { useEffect, useMemo, useState } from 'react';

import {
  ago,
  fmtDate,
  fmtNum,
  fmtSet,
  fmtW,
  ORIGIN_LABEL,
  useApi,
  type ExerciseDetail,
  type ExerciseRow,
  type Summary,
  type WorkoutDetail,
  type WorkoutRow,
} from './api';
import { CalendarHeat, Sparkline, StackedColumns, TimeLines, type LineSeries } from './charts';

function useRoute() {
  const [hash, setHash] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const on = () => {
      setHash(location.hash.slice(1) || '/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.split('/').filter(Boolean);
}
const go = (path: string) => (location.hash = path);

export default function App() {
  const [section, id] = useRoute();
  let page;
  if (section === 'exercises' && id) page = <ExercisePage id={decodeURIComponent(id)} />;
  else if (section === 'exercises') page = <ExercisesPage />;
  else if (section === 'workouts' && id) page = <WorkoutPage id={decodeURIComponent(id)} />;
  else if (section === 'workouts') page = <WorkoutsPage />;
  else page = <Overview />;
  const tab = section ?? 'overview';
  return (
    <div className="shell">
      <header className="topbar">
        <a href="#/" className="brand">Lifter <span>analytics</span></a>
        <nav className="nav">
          <a href="#/" className={tab === 'overview' ? 'on' : ''}>Overview</a>
          <a href="#/exercises" className={tab === 'exercises' ? 'on' : ''}>Lifts</a>
          <a href="#/workouts" className={tab === 'workouts' ? 'on' : ''}>Workouts</a>
        </nav>
      </header>
      {page}
    </div>
  );
}

function Loading({ error }: { error?: string }) {
  return <p className="muted" style={{ padding: '40px 0' }}>{error ? `Couldn't load: ${error}` : 'Loading…'}</p>;
}

// ---------- overview ----------

const LIFT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
const RANGES = { '6M': 182, '1Y': 365, '3Y': 365 * 3, All: 0 } as const;
type Range = keyof typeof RANGES;
const since = (r: Range) => (RANGES[r] ? new Date(Date.now() - RANGES[r] * 86_400_000).toISOString().slice(0, 10) : '');

const REGIONS = [
  { key: 'push', label: 'Push', color: 'var(--series-1)', patterns: ['Horizontal Push', 'Vertical Push'] },
  { key: 'pull', label: 'Pull', color: 'var(--series-2)', patterns: ['Horizontal Pull', 'Vertical Pull'] },
  { key: 'legs', label: 'Legs', color: 'var(--series-3)', patterns: ['Squat', 'Hinge', 'Calves'] },
  { key: 'other', label: 'Core & arms', color: 'var(--series-4)', patterns: ['Core', 'Arms', 'Other'] },
];
const regionOf = (pattern: string) => REGIONS.find((r) => r.patterns.includes(pattern))?.key ?? 'other';

function Overview() {
  const { data, error } = useApi<Summary>('/summary');
  const [range, setRange] = useState<Range>('3Y');
  const [picked, setPicked] = useState<string[]>(['squat-barbell', 'bench-press-barbell', 'deadlift-barbell']);
  const [weeksShown, setWeeksShown] = useState(26);

  const series: LineSeries[] = useMemo(() => {
    if (!data) return [];
    const from = since(range);
    return data.mainLifts
      .map((l, i) => ({ l, color: LIFT_COLORS[i] }))
      .filter(({ l }) => picked.includes(l.id))
      .map(({ l, color }) => ({
        key: l.id,
        label: l.name.replace(' (Barbell)', ''),
        color,
        points: l.points
          .filter((p) => p.date >= from)
          .map((p) => ({ date: p.date, v: p.e1rm, hollow: p.origin === 'snapshot' || p.origin === 'notes', label: `${fmtW(p.weight)} × ${p.reps}`, id: p.workoutId })),
      }));
  }, [data, range, picked]);

  if (!data) return <Loading error={error} />;
  const { totals } = data;
  const weeks = data.weeks.slice(-weeksShown).map((w) => {
    const values: Record<string, number> = {};
    for (const [p, n] of Object.entries(w.byPattern)) values[regionOf(p)] = (values[regionOf(p)] ?? 0) + n;
    return { date: w.week, label: fmtDate(w.week, 'day', false), note: `Week of ${fmtDate(w.week)} · ${w.workouts} workouts`, values };
  });
  const lastSession = data.recent[0];

  return (
    <div className="stack">
      <div>
        <h1>Overview</h1>
        <p className="sub">
          {fmtNum(totals.workouts)} logged sessions since {fmtDate(totals.first)}
          {totals.firstEver < totals.first && <>, plus old program sheets back to {fmtDate(totals.firstEver, 'month')}</>}.
          {lastSession && <> Last workout {ago(lastSession.date)}.</>}
        </p>
      </div>

      <div className="grid tiles">
        <Tile label="This week" value={`${data.thisWeek.workouts}`} foot={`${data.thisWeek.sets} working sets`} />
        <Tile label="Last 4 weeks" value={`${data.last4wPerWeek}`} foot="workouts / week" />
        <Tile label="Working sets" value={fmtNum(totals.workingSets)} foot={`${totals.exercises} exercises`} />
        <Tile label="Tonnage" value={`${fmtNum(totals.tonnage / 1000)}k`} foot="lb, working sets" />
        <Tile label="Time under the bar" value={`${totals.hours}h`} foot="timed sessions" />
      </div>

      <div className="grid lifts">
        {data.mainLifts.map((l, i) => {
          const recent = l.points.filter((p) => p.origin !== 'snapshot').slice(-12).map((p) => p.e1rm);
          return (
            <a key={l.id} href={`#/exercises/${l.id}`} className="card lift">
              <div className="row">
                <h2>{l.name.replace(' (Barbell)', '')}</h2>
                <span className="meta">{l.last && ago(l.last.date)}</span>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className="big num">{l.last ? fmtNum(l.last.e1rm) : '—'}</span>
                <span className="meta num">{l.last && `${fmtW(l.last.weight)} × ${l.last.reps}`}</span>
              </div>
              <div className="meta">est. 1RM, last session</div>
              <Sparkline values={recent} color={LIFT_COLORS[i]} />
              <div className="row meta" style={{ marginTop: 4 }}>
                <span>90d best <span className="num">{l.best90 ? fmtNum(l.best90.e1rm) : '—'}</span></span>
                <span>
                  all-time <span className="num">{l.best ? fmtNum(l.best.e1rm) : '—'}</span>
                  {l.best && ` · ${l.best.date.slice(0, 4)}`}
                </span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Estimated 1RM</h2>
            <div className="muted small">Best set per session (Epley, ≤12 reps). Hollow points are from notes or old sheets. Click a point to open it.</div>
          </div>
          <Seg options={Object.keys(RANGES) as Range[]} value={range} onChange={setRange} />
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {data.mainLifts.map((l, i) => (
            <button
              key={l.id}
              className={`chip ${picked.includes(l.id) ? 'on' : ''}`}
              onClick={() => setPicked((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p, l.id]))}
            >
              <span className="swatch" style={{ background: picked.includes(l.id) ? LIFT_COLORS[i] : 'var(--axis)' }} />
              {l.name.replace(' (Barbell)', '')}
            </button>
          ))}
        </div>
        <TimeLines series={series} onPick={(p) => p.id && go(`/workouts/${p.id}`)} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Weekly working sets</h2>
          <Seg options={[13, 26, 52]} value={weeksShown} onChange={setWeeksShown} label={(n) => `${n}w`} />
        </div>
        <StackedColumns rows={weeks} keys={REGIONS} />
      </div>
      <div className="card">
        <div className="card-head"><h2>Consistency</h2><span className="muted small">shaded by working sets</span></div>
        <CalendarHeat days={data.days} />
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <h2>Recent PRs</h2>
            <span className="muted small">new all-time e1RM, last 90 days</span>
          </div>
          {data.recentPRs.length === 0 && <div className="muted">None in the last 90 days.</div>}
          {data.recentPRs.slice(0, 8).map((p) => (
            <a key={p.exerciseId} href={`#/exercises/${p.exerciseId}`} className="list-row">
              <span>
                {p.name}
                {p.count > 1 && <span className="muted small"> · {p.count} PRs</span>}
              </span>
              <span className="num">
                {fmtNum(p.e1rm)} <span className="muted">{fmtDate(p.date, 'day', false)}</span>
              </span>
            </a>
          ))}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Recent workouts</h2>
            <a href="#/workouts" className="muted small">All →</a>
          </div>
          {data.recent.slice(0, 6).map((w) => <WorkoutLine key={w.id} w={w} />)}
        </div>
      </div>

      <p className="muted small">
        Sources: {Object.entries(data.origins).map(([o, n]) => `${ORIGIN_LABEL[o as keyof typeof ORIGIN_LABEL]} ${n}`).join(' · ')}. Bodyweight lifts use {data.bodyweight} lb.
      </p>
    </div>
  );
}

function Tile({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

function Seg<T extends string | number>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (v: T) => void; label?: (v: T) => string }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
          {label ? label(o) : o}
        </button>
      ))}
    </div>
  );
}

function WorkoutLine({ w }: { w: WorkoutRow }) {
  return (
    <a href={`#/workouts/${w.id}`} className="list-row">
      <span>
        <div>{w.name}</div>
        <div className="muted small">
          {w.exercises.slice(0, 4).map((e) => e.name.replace(/ \(.*\)$/, '')).join(', ')}
          {w.exercises.length > 4 && ` +${w.exercises.length - 4}`}
        </div>
      </span>
      <span className="right">
        <div className="small">{fmtDate(w.date, w.precision, false)}</div>
        <div className="muted small num">{w.workingSets} sets{w.durationMin ? ` · ${w.durationMin}m` : ''}</div>
      </span>
    </a>
  );
}

// ---------- exercises ----------

function ExercisesPage() {
  const { data, error } = useApi<ExerciseRow[]>('/exercises');
  const [q, setQ] = useState('');
  const [pattern, setPattern] = useState('All');
  if (!data) return <Loading error={error} />;
  const patterns = ['All', ...new Set(data.map((e) => e.pattern))];
  const rows = data.filter((e) => (pattern === 'All' || e.pattern === pattern) && e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <div>
        <h1>Lifts</h1>
        <p className="sub">{data.length} exercises, most recent first.</p>
      </div>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div className="chips">
          {patterns.map((p) => (
            <button key={p} className={`chip ${p === pattern ? 'on' : ''}`} onClick={() => setPattern(p)}>{p}</button>
          ))}
        </div>
        <input className="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Exercise</th>
              <th className="right">Sessions</th>
              <th className="right hide-sm">Sets</th>
              <th className="right">Best e1RM</th>
              <th className="right">Last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="link" onClick={() => go(`/exercises/${e.id}`)}>
                <td>
                  {e.name}
                  <div className="muted small">{e.pattern}</div>
                </td>
                <td className="right num">{e.sessions}</td>
                <td className="right num hide-sm">{e.workingSets}</td>
                <td className="right num">{e.best ? fmtNum(e.best.e1rm) : <span className="muted">—</span>}</td>
                <td className="right small">{ago(e.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExercisePage({ id }: { id: string }) {
  const { data, error } = useApi<ExerciseDetail>(`/exercises/${encodeURIComponent(id)}`);
  const [range, setRange] = useState<Range>('3Y');
  if (!data) return <Loading error={error} />;
  const from = since(range);
  const pts = [...data.sessions].reverse().filter((p) => p.date >= from);
  const estimable = pts.some((p) => p.e1rm > 0);
  const bw = data.tracking === 'addedWeightReps' || data.tracking === 'assistedReps';
  const series: LineSeries[] = estimable
    ? [
        {
          key: 'e1rm',
          label: 'Est. 1RM',
          color: 'var(--series-1)',
          points: pts.filter((p) => p.e1rm > 0).map((p) => ({ date: p.date, v: p.e1rm, hollow: p.origin === 'snapshot' || p.origin === 'notes', label: fmtSet(p, data.tracking), id: p.workoutId })),
        },
        ...(bw
          ? []
          : [{
              key: 'top',
              label: 'Heaviest set',
              color: 'var(--series-2)',
              points: pts.filter((p) => p.topWeight > 0).map((p) => ({ date: p.date, v: p.topWeight, hollow: p.origin === 'snapshot' || p.origin === 'notes', id: p.workoutId })),
            }]),
      ]
    : [{ key: 'vol', label: 'Working sets', color: 'var(--series-1)', points: pts.map((p) => ({ date: p.date, v: p.workingSets, id: p.workoutId })) }];
  const repMaxes = data.repMaxes.filter((r) => r.load);

  return (
    <div className="stack">
      <div>
        <a href="#/exercises" className="muted small">← Lifts</a>
        <h1>{data.name}</h1>
        <p className="sub">
          {data.pattern} · {data.sessions.length} sessions
          {data.best && <> · best <span className="num">{fmtNum(data.best.e1rm)}</span> e1RM ({fmtSet(data.best, data.tracking)}, {fmtDate(data.best.date)})</>}
          {bw && <> · load counts {data.bodyweight} lb bodyweight</>}
        </p>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>{estimable ? 'Progress' : 'Working sets per session'}</h2>
          <Seg options={Object.keys(RANGES) as Range[]} value={range} onChange={setRange} />
        </div>
        <TimeLines series={series} unit={estimable ? 'lb' : 'sets'} onPick={(p) => p.id && go(`/workouts/${p.id}`)} yFloorZero={!estimable} />
      </div>
      <div className="grid two">
        {repMaxes.length > 0 && (
          <div className="card">
            <div className="card-head"><h2>Rep maxes</h2><span className="muted small">heaviest set of at least N reps</span></div>
            <table>
              <tbody>
                {repMaxes.map((r) => (
                  <tr key={r.reps} className="link" onClick={() => r.workoutId && go(`/workouts/${r.workoutId}`)}>
                    <td className="muted num">{r.reps} RM</td>
                    <td className="num">{fmtSet({ weight: r.weight, reps: r.actualReps }, data.tracking)}</td>
                    <td className="right small muted">{r.date && fmtDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <div className="card-head"><h2>History</h2></div>
          {data.sessions.slice(0, 40).map((s) => (
            <a key={s.workoutId} href={`#/workouts/${s.workoutId}`} className="list-row">
              <span>
                <div className="small">
                  {fmtDate(s.date, s.precision)} {s.pr && <span className="pr">PR</span>}
                  {s.origin !== 'app' && s.origin !== 'strong' && <span className="badge" style={{ marginLeft: 6 }}>{ORIGIN_LABEL[s.origin]}</span>}
                </div>
                <div className="sets" style={{ marginTop: 4 }}>
                  {s.sets.map((x, i) => (
                    <span key={i} className={`set ${x.type === 'warmup' ? 'warm' : ''}`}>{fmtSet(x, data.tracking)}</span>
                  ))}
                </div>
              </span>
              {s.e1rm > 0 && <span className="num small">{fmtNum(s.e1rm)}</span>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- workouts ----------

function WorkoutsPage() {
  const { data, error } = useApi<{ total: number; workouts: WorkoutRow[] }>('/workouts?limit=1000');
  if (!data) return <Loading error={error} />;
  const byMonth = new Map<string, WorkoutRow[]>();
  for (const w of data.workouts) {
    const k = w.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), w]);
  }
  return (
    <div className="stack">
      <div>
        <h1>Workouts</h1>
        <p className="sub">{data.total} workouts and snapshots.</p>
      </div>
      {[...byMonth].map(([month, ws]) => (
        <div key={month} className="card">
          <div className="card-head">
            <h2>{fmtDate(`${month}-01`, 'month')}</h2>
            <span className="muted small">{ws.length} workouts</span>
          </div>
          {ws.map((w) => <WorkoutLine key={w.id} w={w} />)}
        </div>
      ))}
    </div>
  );
}

function WorkoutPage({ id }: { id: string }) {
  const { data, error } = useApi<WorkoutDetail>(`/workouts/${encodeURIComponent(id)}`);
  if (!data) return <Loading error={error} />;
  return (
    <div className="stack">
      <div>
        <a href="#/workouts" className="muted small">← Workouts</a>
        <h1>{data.name}</h1>
        <p className="sub">
          {fmtDate(data.date, data.precision)}
          {data.precision === 'minute' && ` · ${new Date(data.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          {data.durationMin > 0 && ` · ${data.durationMin} min`} · {data.workingSets} working sets
          {data.tonnage > 0 && ` · ${fmtNum(data.tonnage)} lb`} · <span className="badge">{ORIGIN_LABEL[data.origin]}</span>
        </p>
        {data.notes && <p>{data.notes}</p>}
      </div>
      <div className="card">
        {data.exercises.map((e) => {
          const best = Math.max(0, ...e.sets.map((s) => s.e1rm ?? 0));
          const pr = best > 0 && best > e.priorBest && e.priorBest > 0;
          return (
            <div key={e.id} className="list-row">
              <span>
                <a href={`#/exercises/${e.exerciseId}`}>{e.name}</a> {pr && <span className="pr">PR</span>}
                {e.notes && <div className="muted small">{e.notes}</div>}
                <div className="sets" style={{ marginTop: 6 }}>
                  {e.sets.map((s, i) => (
                    <span key={i} className={`set ${s.type === 'warmup' ? 'warm' : ''} ${s.e1rm && s.e1rm === best && pr ? 'best' : ''}`}>
                      {fmtSet(s, e.tracking)}
                      {s.type === 'amrap' && '+'}
                    </span>
                  ))}
                </div>
              </span>
              {best > 0 && (
                <span className="right small">
                  <div className="num">{fmtNum(best)}</div>
                  <div className="muted">e1RM</div>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
