import { useMemo, useState } from "react";
import { LANES, P, PLAYERS } from "./data";
import type { Flow } from "./data";
import { ALL, CATS, CAT_ORDER, DEFAULT_LF, catsOf, idOf, kindOk, lineText, playerOk } from "./lines";
import type { LineCat, LineFilter } from "./lines";
import { Switch } from "./ui";

const Swatch = ({ c }: { c: LineCat }) => <svg width="18" height="8" aria-hidden="true" className="lf-sw"><line x1="1" y1="4" x2="17" y2="4" stroke={CATS[c].color} strokeWidth="2.4" strokeDasharray={CATS[c].dashed ? "3 2" : undefined} /></svg>;
export const soloLf = (f: Flow): LineFilter => ({ custom: true, kinds: [...CAT_ORDER], players: [], between: false, off: ALL.map((_, i) => i).filter((i) => i !== idOf(f)) });
export const hideLf = (lf: LineFilter, f: Flow): LineFilter => ({ ...lf, custom: true, off: [...new Set([...lf.off, idOf(f)])] });

export function LineFilterPanel({ lf, setLf, uni, shown, onClose }: { lf: LineFilter; setLf: (l: LineFilter) => void; uni: Flow[]; shown: number; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [pq, setPq] = useState("");
  const set = (patch: Partial<LineFilter>) => setLf({ ...lf, custom: true, ...patch });
  const off = new Set(lf.off);
  const counts = useMemo(() => Object.fromEntries(CAT_ORDER.map((c) => [c, uni.filter((f) => catsOf(f).includes(c)).length])) as Record<LineCat, number>, [uni]);
  const players = useMemo(() => PLAYERS.filter((p) => uni.some((f) => f.from === p.id || f.to === p.id)), [uni]);
  const match = uni.filter((f) => !q || lineText(f).toLowerCase().includes(q.toLowerCase()));
  const groups: { lane: number; id: string; flows: Flow[] }[] = [];
  [...match].sort((a, b) => P[a.from].lane - P[b.from].lane || P[a.from].row - P[b.from].row).forEach((f) => { const g = groups.find((x) => x.id === f.from); if (g) g.flows.push(f); else groups.push({ lane: P[f.from].lane, id: f.from, flows: [f] }); });
  const ids = match.map(idOf);
  return (
    <div className="lf" role="dialog" aria-label="Filter lines" data-testid="line-filter">
      <div className="lf-head">
        <b>Filter lines</b>
        <span className="lf-count" data-testid="lf-count">Showing {shown} of {uni.length} lines</span>
        <span className="lf-head-r">
          <button className="btn sm" onClick={() => setLf(DEFAULT_LF)}>Reset</button>
          <button className="btn sm lf-close" onClick={onClose} aria-label="Close line filter">Done</button>
        </span>
      </div>
      {!lf.custom ? <div className="lf-auto">Auto mode: the map shows this ownership step's lines, or a clicked box's lines. Any change below switches to your own filter. <button className="btn sm primary" onClick={() => set({ off: [] })}>Show all {uni.length} lines</button></div>
        : <div className="lf-auto">Your filter is on. Clicking a box still narrows to that player's lines. <button className="btn sm" onClick={() => setLf(DEFAULT_LF)}>Back to auto</button></div>}
      <div className="lf-grid">
        <section>
          <div className="lf-h">1. Line types</div>
          <div className="lf-kinds">{CAT_ORDER.map((c) => { const on = lf.kinds.includes(c); return (
            <button key={c} className={"lf-kind" + (on ? " on" : "")} aria-pressed={on} onClick={() => set({ kinds: on ? lf.kinds.filter((k) => k !== c) : [...lf.kinds, c] })} data-kind={c}>
              <Swatch c={c} /><span className="lf-kl">{CATS[c].label}</span><span className="lf-n num">{counts[c]}</span>
            </button>); })}</div>
          <div className="lf-row-btns"><button className="btn sm" onClick={() => set({ kinds: [...CAT_ORDER] })}>All types</button><button className="btn sm" onClick={() => set({ kinds: [] })}>No types</button></div>
          <div className="lf-h" style={{ marginTop: 12 }}>2. Players</div>
          <input className="lf-search" placeholder="Find a player" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Find a player" />
          <div className="lf-players">{players.filter((p) => !pq || (p.label + " " + p.role).toLowerCase().includes(pq.toLowerCase())).map((p) => { const on = lf.players.includes(p.id); return <button key={p.id} className={"chip" + (on ? " on" : "")} aria-pressed={on} onClick={() => set({ players: on ? lf.players.filter((x) => x !== p.id) : [...lf.players, p.id] })} data-player={p.id}>{p.label}</button>; })}</div>
          <div className="lf-row-btns"><Switch label="Only lines between selected players" value={lf.between} onChange={(v) => set({ between: v })} />{lf.players.length > 0 && <button className="btn sm" onClick={() => set({ players: [] })}>Clear players</button>}</div>
        </section>
        <section>
          <div className="lf-h">3. Every line <span className="dim">({match.length})</span></div>
          <input className="lf-search" placeholder="Search lines, e.g. g-fee or warehouse" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lines" />
          <div className="lf-row-btns"><button className="btn sm" onClick={() => set({ off: lf.off.filter((i) => !ids.includes(i)) })}>Select all{q ? " matching" : ""}</button><button className="btn sm" onClick={() => set({ off: [...new Set([...lf.off, ...ids])] })}>Clear all{q ? " matching" : ""}</button></div>
          <div className="lf-list">
            {groups.map((g, gi) => <div key={g.id} className="lf-group">
              {(gi === 0 || groups[gi - 1].lane !== g.lane) && <div className="lf-lane">{LANES[g.lane]}</div>}
              <div className="lf-player">{P[g.id].label} <span className="dim">({P[g.id].role})</span></div>
              {g.flows.map((f) => { const id = idOf(f), on = lf.custom ? !off.has(id) : true, muted = !kindOk(f, lf) || !playerOk(f, lf); const c = catsOf(f)[0]; return (
                <div key={id} className={"lf-item" + (muted ? " muted" : "")} title={muted ? "Checked, but hidden by the type or player filter" : undefined}>
                  <label><input type="checkbox" checked={on} onChange={() => set({ off: on ? [...lf.off, id] : lf.off.filter((x) => x !== id) })} data-flow={id} /><Swatch c={c} /><span>{P[f.from].label} {"\u2192"} {P[f.to].label}: <b>{f.label}</b></span></label>
                  <button className="btn sm lf-only" onClick={() => setLf(soloLf(f))} data-solo={id} aria-label={`Show only ${lineText(f)}`}>Only this</button>
                </div>); })}
            </div>)}
            {!groups.length && <div className="p dim">No lines match.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ShownList({ flows, onSolo, onHide }: { flows: Flow[]; onSolo: (f: Flow) => void; onHide: (f: Flow) => void }) {
  if (!flows.length || flows.length > 10) return null;
  return (
    <div className="lf-shown" data-testid="lines-shown">
      <div className="lf-h">Lines shown ({flows.length})</div>
      <ol>{flows.map((f, i) => <li key={i}><span className="lf-num">{i + 1}</span><Swatch c={catsOf(f)[0]} /><span className="lf-st">{P[f.from].label} {"\u2192"} {P[f.to].label}: <b>{f.label}</b></span>{flows.length > 1 && <button className="btn sm" onClick={() => onSolo(f)}>Only this</button>}<button className="btn sm" onClick={() => onHide(f)}>Hide</button></li>)}</ol>
    </div>
  );
}
