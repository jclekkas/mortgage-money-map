// "Play a role" page: pick a job in the secondary mortgage market and play it for 5 to 8 quarters. All numbers are mock.
import { useEffect, useMemo, useState } from "react";
import { P } from "./data";
import { MoneyMap } from "./map";
import { ROLES, ROLE, Game, Role, newGame, playTurn, scorecard, refreshFacts, shockOf, usd } from "./roles";
import { Metric, Panel, Props, Seg, Tag, Term } from "./ui";

export const ROLE_TERMS: Record<string, string[]> = { servicer: ["servicer", "msr", "msrmultiple", "recapture", "advance", "prepay", "escrow"], pmi: ["pmi", "pmiers", "quotashare", "iln", "hpa", "ltv"], crt: ["crt", "cas", "stacr", "attachment", "writedown", "hpa"], wholeloan: ["tape", "rplnpl", "jumbo", "nonqm", "dv01", "winnerscurse"], whlender: ["warehouse", "advancerate", "dwell", "covenant", "tnw", "margincall", "scratchdent"], analyst: ["warehouse", "dwell", "earlyfunding", "gestation", "pipelinehedge", "fallout", "covenant"], aggregator: ["msr", "msrmultiple", "msrfinancing", "margincall", "prepay", "refresh"] };

const m$ = (v: number) => (v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + "M";
const tone = (v: number) => (v > 0.05 ? "up" : v < -0.05 ? "down" : undefined);
const DISC = "A learning game. Every figure is a mock, illustrative example (approx.), not any firm's real terms, prices or results. Named firms appear only as examples of a role.";

function Chart({ g, role }: { g: Game; role: Role }) {
  const W = 560, H = 190, pl = 44, pr = 10, pt = 12, pb = 28, n = role.quarters;
  const cums = g.hist.map((h) => h.cum), pnls = g.hist.map((h) => h.pnl);
  const lo = Math.min(0, ...cums, ...pnls), hi = Math.max(1, ...cums, ...pnls);
  const x = (i: number) => pl + ((i + 0.5) * (W - pl - pr)) / n, y = (v: number) => pt + ((hi - v) * (H - pt - pb)) / (hi - lo || 1);
  const bw = Math.min(26, (W - pl - pr) / n - 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="role-chart" role="img" aria-label="Profit and loss by quarter">
      {[hi, (hi + lo) / 2, lo].map((v, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="rc-grid" /><text x={pl - 6} y={y(v) + 4} textAnchor="end" className="rc-ax">{m$(v)}</text></g>)}
      <line x1={pl} x2={W - pr} y1={y(0)} y2={y(0)} className="rc-zero" />
      {Array.from({ length: n }, (_, i) => <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className={"rc-ax" + (g.hist[i] && g.hist[i].shock !== "calm" ? " rc-shock" : "")}>Q{i + 1}{g.hist[i] && g.hist[i].shock !== "calm" ? "!" : ""}</text>)}
      {pnls.map((v, i) => <rect key={i} x={x(i) - bw / 2} width={bw} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} className={v >= 0 ? "rc-up" : "rc-down"} />)}
      {cums.length > 1 && <polyline points={cums.map((v, i) => `${x(i)},${y(v)}`).join(" ")} className="rc-line" />}
      {cums.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} className="rc-dot" />)}
    </svg>
  );
}

function Parts({ parts }: { parts: Record<string, number> }) {
  const e = Object.entries(parts).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(0.01, ...e.map(([, v]) => Math.abs(v)));
  return <div className="role-parts">{e.map(([k, v]) => <div key={k} className="rp-row"><span className="rp-k">{k}</span><span className="rp-bar"><i className={v >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(v) / mx) * 100}%` }} /></span><span className={"rp-v num " + (tone(v) ?? "")}>{m$(v)}</span></div>)}</div>;
}

export function RolePage({ roleId, setRoleId, onCredit, onMap }: { roleId: string; setRoleId: (id: string) => void; onCredit: () => void; onMap: (node: string) => void }) {
  const role = ROLE[roleId];
  const [scn, setScn] = useState("random");
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const [g, setG] = useState<Game | null>(null);
  const [tip, setTip] = useState("");
  useEffect(() => { setG(null); setTip(""); setScn("random"); }, [roleId]);

  if (!role) return (
    <>
      <Panel><div className="p">Step into a real job in the secondary mortgage market. Each game runs 5 to 8 quarters (3-month turns): you make a few decisions, the market throws shocks at you, and a live dashboard shows your profit and loss and your risks. At the end you get a grade, what a pro would have done, and how a credit refresh (a fresh look at an old loan's borrower) would have helped.</div><div className="legal">{DISC}</div></Panel>
      <div className="role-grid" data-testid="role-grid">{ROLES.map((r) => (
        <button key={r.id} className="role-card" data-testid={"role-pick-" + r.id} onClick={() => setRoleId(r.id)}>
          <span className="rc-t">{r.short}</span><span className="rc-h">{r.title}</span><span className="rc-b">{r.blurb}</span>
          <span className="rc-f"><span className="dim">On the map: {P[r.node]?.label}</span><span>{r.quarters} quarters ›</span></span>
        </button>))}</div>
    </>
  );

  const start = (s = seed) => { setSeed(s); setG(newGame(role, s, scn)); setTip(""); };
  const back = <button className="btn sm" onClick={() => setRoleId("")}>‹ All roles</button>;
  const mini = (
    <Panel title="Where you sit on the map" right={<button className="btn sm" onClick={() => onMap(role.node)}>Open full map</button>}>
      <div className="role-mini" data-testid="role-mini"><MoneyMap view="all" overlay="money" risk="credit" crisis={false} sel={role.node} onPick={() => {}} own={{}} animate={false} focus={[]} /></div>
      <div className="p dim" style={{ marginTop: 6 }}>Highlighted: {P[role.node]?.name}, and the money and paper flowing in and out of it.</div>
    </Panel>
  );

  if (!g) return (
    <>
      <div className="role-top">{back}<Tag tone="acc">{role.short}</Tag></div>
      <div className="role-cols">
        <div className="role-col">
          <Panel title={role.title}>
            <Props items={[{ label: "Your job", value: role.intro.job }, { label: "Who you work with", value: role.intro.work }, { label: "How you get paid", value: role.intro.paid }, { label: "How you win", value: role.intro.goal }]} />
            {role.intro.tip && <div className="role-tipbox" data-testid="role-tip"><b>Beginner tip:</b> {role.intro.tip}</div>}
            <div className="role-terms"><span className="dim">Key terms (tap): </span>{(ROLE_TERMS[role.id] ?? []).map((k) => <Term key={k} k={k} />)}</div>
            <div className="legal" style={{ marginTop: 8 }}>You play {role.example}. {DISC}</div>
          </Panel>
          <Panel title="Set up the game" style={{ marginTop: 12 }}>
            <div className="role-setup">
              <label><span>Scenario (what the market does)</span>
                <select data-testid="role-scn" value={scn} onChange={(e) => setScn(e.currentTarget.value)}>
                  <option value="random">Random shocks (from the seed)</option><option value="calm">Calm market</option>
                  {role.shocks.map((s) => <option key={s.id} value={s.id}>{s.label} at Q3</option>)}
                </select></label>
              <label><span>Seed (same seed = same game)</span><input data-testid="role-seed" type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))} /></label>
              <button className="btn primary lg" data-testid="role-start" onClick={() => start()}>Start {role.quarters}-quarter game</button>
            </div>
          </Panel>
        </div>
        <div className="role-col">{mini}</div>
      </div>
    </>
  );

  return <Play role={role} g={g} setG={setG} tip={tip} setTip={setTip} back={back} mini={mini} start={start} seed={seed} onCredit={onCredit} />;
}

function Play({ role, g, setG, tip, setTip, back, mini, start, seed, onCredit }: { role: Role; g: Game; setG: (g: Game) => void; tip: string; setTip: (s: string) => void; back: React.ReactNode; mini: React.ReactNode; start: (s?: number) => void; seed: number; onCredit: () => void }) {
  const t = g.hist.length, done = t >= role.quarters, last = g.hist[t - 1];
  const nextShock = !done ? shockOf(role, g.sched[t]) : null;
  const warn = !done && role.refreshOn(g.d) && nextShock?.credit;
  const sc = useMemo(() => (done ? scorecard(role, g) : null), [done, g, role]);
  const rf = useMemo(() => refreshFacts(role), [role]);
  const refreshUsed = g.hist.filter((h) => role.refreshOn(h.d)).length;
  const setD = (k: string, v: string) => setG({ ...g, d: { ...g.d, [k]: v } });
  return (
    <>
      <div className="role-top">{back}<Tag tone="acc">{role.short}</Tag><span className="dim role-meta">Seed {g.seed} · {g.scenario === "random" ? "random shocks" : g.scenario === "calm" ? "calm market" : shockOf(role, g.scenario).label + " at Q3"}</span></div>
      <div className="role-prog" data-testid="role-prog">{Array.from({ length: role.quarters }, (_, i) => <i key={i} className={i < t ? (g.hist[i].shock !== "calm" ? "done shock" : "done") : i === t ? "now" : ""} />)}<span>{done ? "Game over" : `Quarter ${t + 1} of ${role.quarters}`}</span></div>
      <div className="role-cols">
        <div className="role-col">
          {last && <Panel title={`What happened in Q${t}`} className="role-what"><div className="p"><b>{shockOf(role, last.shock).label}.</b> {shockOf(role, last.shock).desc}</div><div className="p">{last.note}</div><div className="p">Quarter result: <b className={"num " + (tone(last.pnl) ?? "")}>{m$(last.pnl)}</b> (mock)</div></Panel>}
          {!done && <>
            {role.offer && <Panel title="On your desk this quarter" className="role-offer" style={{ marginTop: last ? 12 : 0 }}><div className="p">{role.offer(t, g.seed)}</div></Panel>}
            {warn && <div className="role-warn" data-testid="role-warn"><b>Early warning from your credit refresh:</b> refreshed borrower data shows stress building. Expect "{nextShock!.label}" this quarter. Adjust before you run it.</div>}
            <Panel title={`Your decisions for Q${t + 1}`} style={{ marginTop: 12 }} className="role-dec">
              {role.decisions.map((d) => {
                const locked = d.lock && t > 0;
                return (
                  <div key={d.key} className="role-d" data-testid={"role-d-" + d.key}>
                    <div className="rd-h"><span>{d.label}{d.once && <span className="dim"> (this quarter only)</span>}</span><button className="rd-q" aria-label={"Explain " + d.label} aria-expanded={tip === d.key} onClick={() => setTip(tip === d.key ? "" : d.key)}>?</button></div>
                    {tip === d.key && <div className="rd-tip">{d.tip}</div>}
                    {locked ? <div><Tag tone="n">{d.opts.find((o) => o.v === g.d[d.key])?.label}</Tag> <span className="dim">locked after Q1</span></div>
                      : <Seg label={d.label} options={d.opts.map((o) => ({ value: o.v, label: o.label }))} value={g.d[d.key]} onChange={(v) => setD(d.key, v)} />}
                  </div>
                );
              })}
              <button className="btn primary lg block" data-testid="role-run" onClick={() => setG(playTurn(role, g))}>Run quarter {t + 1} ›</button>
            </Panel>
          </>}
          {done && sc && (
            <Panel title="Scorecard" className="role-score" style={{ marginTop: 12 }}>
              <div className="rs-top" data-testid="role-score"><div className={"rs-grade g" + sc.grade}>{sc.grade}</div><div><div className="rs-n">{sc.score}/100</div><div className="p">Total P&L <b className={"num " + (tone(sc.total) ?? "")} data-testid="role-total">{m$(sc.total)}</b> (mock) · {sc.bad} red and {sc.warn} amber risk readings</div></div></div>
              <div className="pc-sub">You vs. what a pro would have done</div>
              <div className="rs-cmp">{sc.compare.map((c) => <div key={c.label} className="rs-c"><div className="rs-l">{c.label}</div><div><span className="dim">You (most used): </span>{c.you} {c.same ? <Tag tone="ok">same as pro</Tag> : <><span className="dim">· Pro: </span><b>{c.pro}</b></>}</div><div className="dim">{c.why}</div></div>)}</div>
              <div className="pc-sub">The pro playbook</div><ul className="rs-ul">{role.playbook.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="pc-sub">Lessons</div><ul className="rs-ul">{role.lessons.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="role-cc"><div className="pc-sub">The credit refresh tie-in</div><div className="p">{role.refreshText}</div><div className="p">You used a credit refresh in {refreshUsed} of {role.quarters} quarters.</div>
                {rf?.kind === "node" && <div className="p">On the Credit checks page, refresh whitespace (extra spend if refreshes moved from today's pace to a plausible pace) at {P[role.refreshNode!]?.label} is approx. <b>{usd(rf.ws)}</b> a year (estimate). Today: {rf.n.todayText}. Plausible: {rf.n.plausText}.</div>}
                {rf?.kind === "case" && rf.c && <div className="p">Related use case: {rf.c.name}. Total addressable market (all possible spend) approx. <b>{usd(rf.tam)}</b> a year (estimate). Today: {rf.c.refreshToday}. Plausible: {rf.c.refreshPlausible}.</div>}
                <button className="btn sm" onClick={onCredit}>See refresh sizing</button></div>
              <div className="rs-act"><button className="btn primary" data-testid="role-replay" onClick={() => start(g.seed)}>Replay same seed</button><button className="btn" data-testid="role-newseed" onClick={() => start(seed === g.seed ? 1 + Math.floor(Math.random() * 9999) : seed)}>New seed</button></div>
              <div className="legal" style={{ marginTop: 8 }}>{DISC}</div>
            </Panel>
          )}
        </div>
        <div className="role-col">
          <Panel title="Live dashboard (mock, $ millions)" className="role-dash">
            <div className="metrics" data-testid="role-kpis">
              <Metric k="Total P&L so far" v={m$(last?.cum ?? 0)} tone={tone(last?.cum ?? 0)} />
              <Metric k="Last quarter" v={last ? m$(last.pnl) : "–"} tone={last ? tone(last.pnl) : undefined} />
              {role.risks.map((r) => { const v = last?.risks[r.key]; const s = v === undefined ? null : r.status(v); return <Metric key={r.key} k={r.label} v={v === undefined ? "–" : r.fmt(v)} tone={s === "ok" ? "up" : s === "bad" ? "down" : s === "warn" ? "amber" : undefined} d={s ? (s === "ok" ? "healthy" : s === "warn" ? "watch" : "danger") : "after Q1"} />; })}
            </div>
            {t > 0 ? <>
              <div className="pc-sub">Profit by quarter (bars) and running total (line)</div><Chart g={g} role={role} />
              <div className="pc-sub">Where last quarter's P&L came from</div><Parts parts={last!.parts} />
              <div className="pc-sub">Risk readings by quarter</div>
              <div className="role-rt-wrap"><table className="role-rt"><thead><tr><th>Risk</th>{g.hist.map((h) => <th key={h.t}>Q{h.t + 1}</th>)}</tr></thead><tbody>{role.risks.map((r) => <tr key={r.key}><td title={r.tip}>{r.label}</td>{g.hist.map((h) => <td key={h.t} className={"rt-" + r.status(h.risks[r.key])}>{r.fmt(h.risks[r.key])}</td>)}</tr>)}</tbody></table></div>
            </> : <div className="p dim" style={{ marginTop: 8 }}>Make your choices and run the first quarter to see the charts.</div>}
          </Panel>
          <div style={{ marginTop: 12 }}>{mini}</div>
        </div>
      </div>
    </>
  );
}
