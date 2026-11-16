import { useEffect, useMemo, useState } from "react";
import { ROLE, ROLE_FOR_NODE } from "./roles";
import type { ReactNode } from "react";
import { P, OWN, PLAYERS, RISK, RISK_BEARERS, CRISIS, G, QUIZ, DISCLAIMER, FLOW_KIND } from "./data";
import type { OwnKind, RiskKey, OwnStep } from "./data";
import { Panel, Props, Seg, Switch, Tbl, Term, QuizBlock, Tag } from "./ui";
import { flowsFor } from "./map";
import type { ViewSel } from "./data";

export const money = (v: number, d = 2) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function OwnBadges({ kinds }: { kinds: OwnKind[] }) {
  if (!kinds.length) return <span className="dim">Owns nothing in this step</span>;
  return <span className="own-badges">{kinds.map((k) => <span key={k} className="own-b" style={{ borderColor: OWN[k].color, color: OWN[k].color }}><i style={{ background: OWN[k].color }}>{OWN[k].glyph}</i>{OWN[k].short}</span>)}</span>;
}

export function OwnLegend({ compact }: { compact?: boolean }) {
  return <div className={"legend own-legend" + (compact ? " compact" : "")}>{(Object.keys(OWN) as OwnKind[]).map((k) => <span key={k}><i className="own-dot" style={{ background: OWN[k].color }}>{OWN[k].glyph}</i>{OWN[k].label}</span>)}<span><i className="own-ring-sw" />Glowing box: owns the loan right now</span></div>;
}

export function PlayerCard({ id, own, view, crisis, onPlay }: { id: string; own: Record<string, OwnKind[]>; view: ViewSel; crisis: boolean; onPlay?: (roleId: string) => void }) {
  const roleId = ROLE_FOR_NODE[id];
  const p = P[id];
  const fl = flowsFor(view);
  const ins = fl.filter((f) => f.to === id), outs = fl.filter((f) => f.from === id);
  return (
    <div className="pcard">
      <div className="pc-h">{p.name}</div>
      <div className="pc-own"><span className="dim">Right now this player: </span><OwnBadges kinds={own[id] ?? []} /></div>
      {roleId && onPlay && <div className="pc-play"><button className="btn sm primary" data-testid="play-role" onClick={() => onPlay(roleId)}>{"\u25B6"} Play this role</button><span className="dim">{ROLE[roleId].short}: a {ROLE[roleId].quarters}-quarter game</span></div>}
      <Props items={[
        { label: "What they do", value: p.does },
        { label: "Think of it like", value: p.like },
        { label: "How they get paid", value: p.paid },
        { label: "Incentives (what they want)", value: p.incent },
        { label: "Risks they take", value: p.risks },
        { label: "Real examples", value: p.examples },
        ...(p.crisis ? [{ label: <span className={crisis ? "down" : ""}>In 2008 (then)</span>, value: p.crisis.then }, { label: <span className={crisis ? "up" : ""}>What changed (now)</span>, value: p.crisis.now }] : []),
      ]} />
      {(ins.length > 0 || outs.length > 0) && <>
        <div className="pc-sub">Money and paper in and out (this view)</div>
        <Tbl cols={["Direction", "Counterparty", "What"]} rows={[...ins.map((f) => [<span key="i" className="up">{"\u2190 gets"}</span>, P[f.from].name, <span key="w"><span className="sw" style={{ background: FLOW_KIND[f.kind].color }} />{f.label}</span>]), ...outs.map((f) => [<span key="o" className="down">{"\u2192 sends"}</span>, P[f.to].name, <span key="w"><span className="sw" style={{ background: FLOW_KIND[f.kind].color }} />{f.label}</span>])]} />
      </>}
      <div className="legal" style={{ marginTop: 10 }}>Roles, incentives and risks describe this type of firm in general, not any named firm's actual conduct. {DISCLAIMER}</div>
    </div>
  );
}

// ---------- ownership ledger ----------
export function namesOf(st: OwnStep, k: OwnKind) {
  const ids = Object.entries(st.own).filter(([, ks]) => ks.includes(k)).map(([id]) => id);
  if (!ids.length) return <span className="dim">nobody</span>;
  return <span>{ids.map((id, i) => <span key={id}>{i > 0 && ", "}{P[id].label}</span>)}</span>;
}

// ---------- follow one dollar ----------
const SEG_COLORS = ["#2bd47d", "#4d9fff", "#a78bfa", "#ffb547", "#ff6b8b", "#8b96a5"];
export function OneDollar() {
  const [kind, setKind] = useState<"conv" | "fha">("conv");
  const [month, setMonth] = useState(1);
  const [pmi, setPmi] = useState(true);
  const [stage, setStage] = useState(6);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStage((s) => { if (s >= 6) { setPlaying(false); return 6; } return s + 1; }), 1100);
    return () => clearInterval(t);
  }, [playing]);
  const conv = kind === "conv";
  const L = 400000, rate = conv ? 6.75 : 6.5, serv = conv ? 0.25 : 0.44, gf = conv ? 0.5 : 0.06, coupon = rate - serv - gf;
  const r = rate / 1200, pmt = (L * r) / (1 - Math.pow(1 + r, -360));
  const balAt = (m: number) => L * Math.pow(1 + r, m - 1) - (pmt * (Math.pow(1 + r, m - 1) - 1)) / r;
  const calc = (m: number) => { const bal = balAt(m); const interest = bal * r; return { bal, principal: pmt - interest, inv: (bal * coupon) / 1200, serv: (bal * serv) / 1200, g: (bal * gf) / 1200, mi: conv ? (pmi && m <= 120 ? (L * 0.005) / 12 : 0) : (bal * 0.55) / 1200 }; };
  const c = calc(month), escrow = 550;
  const life = useMemo(() => { let s = { inv: 0, serv: 0, g: 0, principal: 0 }; for (let m = 1; m <= 360; m++) { const x = calc(m); s = { inv: s.inv + x.inv, serv: s.serv + x.serv, g: s.g + x.g, principal: s.principal + x.principal }; } return s; }, [kind]); // eslint-disable-line
  const segs = [
    { k: "Principal (paying down the IOU)", short: "Investors: principal", to: "Bond investors, via the MBS trust", amt: c.principal },
    { k: "Investor interest, coupon (what the bond pays)", short: `Investors: ${coupon.toFixed(2)}% coupon`, to: "Bond investors, via the MBS trust", amt: c.inv },
    { k: "Servicing fee strip (the collector's cut)", short: `Servicer: ${serv.toFixed(2)}% fee`, to: "Servicer or MSR owner, e.g. Mr. Cooper (the servicer)", amt: c.serv },
    { k: conv ? "Guarantee fee, g-fee (insurance premium)" : "Ginnie Mae guaranty fee (insurance premium)", short: conv ? `Fannie Mae: ${gf.toFixed(2)}% g-fee` : `Ginnie Mae: ${gf.toFixed(2)}% fee`, to: conv ? "Fannie Mae (the agency guarantor); 0.10% of it goes on to Treasury" : "Ginnie Mae (the government guarantor)", amt: c.g },
    { k: conv ? "Private mortgage insurance, PMI (deductible cover)" : "FHA mortgage insurance premium, MIP (FHA's insurance charge)", short: conv ? "Mortgage insurer: PMI" : "FHA: annual MIP", to: conv ? "MGIC, Radian, Essent or Arch MI (the mortgage insurer)" : "FHA (the government insurer)", amt: c.mi },
    { k: "Escrow (a savings jar for tax and insurance)", short: "Tax office + insurer", to: "County tax office and home insurer, paid by the servicer", amt: escrow },
  ];
  const total = segs.reduce((a, s) => a + s.amt, 0);
  const shown = segs.map((s, i) => ({ ...s, on: i < stage }));
  const W = 780, H = 330, bx = 16, sx = 250, dx = 532, dw = 232;
  const dy = (i: number) => 16 + i * 52;
  const path = (i: number) => `M${sx + 150},${H / 2} C${sx + 200},${H / 2} ${dx - 50},${dy(i) + 20} ${dx},${dy(i) + 20}`;
  return (
    <>
      <Panel title="Follow one monthly payment" right={<span className="dim">illustrative example</span>} tour="dollar">
        <div className="ctrl-row">
          <Seg label="Loan type" value={kind} onChange={(v) => { setKind(v); setStage(6); }} options={[{ value: "conv", label: "Conventional (Fannie Mae UMBS)" }, { value: "fha", label: "FHA (Ginnie Mae MBS)" }]} />
          {conv && <Switch label="Under 20% down (adds PMI)" value={pmi} onChange={setPmi} />}
          <button className="btn primary sm" onClick={() => { setStage(0); setPlaying(true); }}>{"\u25b6"} Play the split</button>
        </div>
        <div className="p" style={{ marginTop: 10 }}>Example: a <b>$400,000</b>, 30-year fixed loan at <b>{rate.toFixed(2)}%</b>. Principal and interest are <b>{money(pmt)}</b> a month; with insurance and escrow the borrower sends <b>{money(total)}</b> in month {month}. Numbers are examples, not quotes.</div>
        <div className="dollar-wrap" style={{ marginTop: 6 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="dollar-svg" role="img" aria-label="Where one monthly payment goes">
            <path d={`M${bx + 170},${H / 2} L${sx},${H / 2}`} className="flow-line" style={{ stroke: "#22c3a6", strokeWidth: 2.4, fill: "none" }} />
            {shown.map((s, i) => <path key={i} d={path(i)} className={s.on ? "flow-line" : ""} style={{ stroke: SEG_COLORS[i], strokeWidth: s.on ? 2.2 : 1, fill: "none", opacity: s.on ? 0.95 : 0.18 }} />)}
            {shown.map((s, i) => s.on && <circle key={"c" + i} r={4.5} style={{ fill: SEG_COLORS[i] }}><animateMotion dur="1.8s" repeatCount="indefinite" path={path(i)} /></circle>)}
            <circle r={5} style={{ fill: "#22c3a6" }}><animateMotion dur="1.4s" repeatCount="indefinite" path={`M${bx + 170},${H / 2} L${sx},${H / 2}`} /></circle>
            <g transform={`translate(${bx},${H / 2 - 30})`}><rect width={170} height={60} rx={30} className="d-box" /><text x={85} y={25} textAnchor="middle" className="d-t1">Borrower</text><text x={85} y={43} textAnchor="middle" className="d-t2">{money(total)} this month</text></g>
            <g transform={`translate(${sx},${H / 2 - 30})`}><rect width={150} height={60} rx={10} className="d-box key" /><text x={75} y={25} textAnchor="middle" className="d-t1">Servicer</text><text x={75} y={43} textAnchor="middle" className="d-t2">splits the payment</text></g>
            {shown.map((s, i) => <g key={"b" + i} transform={`translate(${dx},${dy(i)})`} opacity={s.on ? 1 : 0.3}><rect width={dw} height={40} rx={8} className="d-box" style={{ stroke: SEG_COLORS[i] }} /><rect width={4} height={40} rx={2} style={{ fill: SEG_COLORS[i] }} /><text x={12} y={16} className="d-t2s">{s.short}</text><text x={12} y={32} className="d-amt">{money(s.amt)}</text></g>)}
          </svg>
        </div>
        <div className="dollar-list" aria-label="Where the payment goes">
          <div className="dl-src"><b>Borrower</b> pays <b>{money(total)}</b> {"\u2192"} <b>Servicer</b> splits it:</div>
          {shown.map((s, i) => <div key={i} className={"dl-row" + (s.on ? " on" : "")} style={{ borderLeftColor: SEG_COLORS[i] }}><span className="dl-k">{s.short}</span><span className="dl-v num">{money(s.amt)}</span><span className="dl-to">{s.to}</span></div>)}
        </div>
        <div className="stackbar" aria-label="Payment split bar">{shown.map((s, i) => <i key={i} title={`${s.k}: ${money(s.amt)}`} style={{ width: `${(s.amt / total) * 100}%`, background: SEG_COLORS[i], opacity: s.on ? 1 : 0.15 }} />)}</div>
        <div className="slider" style={{ marginTop: 12 }}>
          <div className="row"><span>Move through the loan's life</span><span className="val num">Month {month} (year {Math.ceil(month / 12)})</span></div>
          <input type="range" min={1} max={360} value={month} aria-label="Month of the loan" onChange={(e) => setMonth(Number(e.currentTarget.value))} />
        </div>
        <div className="callout"><div className="cl">Notice</div>In month {month}, {money(c.principal)} of the {money(pmt)} principal-and-interest payment pays down the loan and {money(pmt - c.principal)} is interest. {month < 180 ? "Early on, most of it is interest. Slide right to watch principal take over." : "Late in the loan, most of it is principal."} The servicing fee and {conv ? "g-fee" : "Ginnie fee"} shrink with the balance because they're a percentage of what's still owed.</div>
      </Panel>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <Panel title="Who gets what this month" tight>
          <Tbl right={[2]} cols={["Slice", "Who gets it", "Amount"]} rows={segs.map((s, i) => [<span key={i}><span className="sw" style={{ background: SEG_COLORS[i] }} />{s.k}</span>, s.to, money(s.amt)])} />
        </Panel>
        <Panel title="Over 30 years (if never paid off early)">
          <Props items={[
            { label: "Investors get in interest", value: money(life.inv, 0) },
            { label: "Servicer's fee strip, total", value: money(life.serv, 0) },
            { label: conv ? "Fannie Mae's g-fee, total" : "Ginnie Mae's fee, total", value: money(life.g, 0) },
            { label: "Principal repaid", value: money(life.principal, 0) },
          ]} />
          <div className="p dim" style={{ marginTop: 8 }}>Most loans are paid off early when people move or refinance, often within 5 to 10 years, which is why <Term k="prepay">prepayment (paying back early)</Term> matters so much to investors and <Term k="msr">MSR (the right to collect the fee)</Term> owners. Timing note: UMBS pay investors on the 25th of the month after the borrower pays (a built-in delay).</div>
        </Panel>
      </div>
    </>
  );
}

// ---------- risk matrix ----------
export function RiskPage({ onShow }: { onShow: (k: RiskKey) => void }) {
  const ids = PLAYERS.filter((p) => (Object.keys(RISK) as RiskKey[]).some((k) => RISK_BEARERS[k][p.id])).map((p) => p.id);
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        {(Object.keys(RISK) as RiskKey[]).map((k) => <div key={k} className="risk-card" style={{ borderTopColor: RISK[k].color }}><div className="rk-t">{RISK[k].label}</div><div className="rk-d">{RISK[k].plain}</div><button className="btn sm" onClick={() => onShow(k)}>Show on the map</button></div>)}
      </div>
      <Panel title="Who takes which risk" right={<span className="dim">hover a dot for why</span>} tight tour="riskmatrix">
        <div className="tbl-wrap">
          <table className="tbl risk-tbl">
            <thead><tr><th>Player (role)</th>{(Object.keys(RISK) as RiskKey[]).map((k) => <th key={k} className="c">{RISK[k].label.split(" (")[0]}</th>)}</tr></thead>
            <tbody>{ids.map((id) => <tr key={id}><td>{P[id].name}</td>{(Object.keys(RISK) as RiskKey[]).map((k) => <td key={k} className="c">{RISK_BEARERS[k][id] ? <span className="rdot" title={RISK_BEARERS[k][id]} style={{ background: RISK[k].color }} aria-label={RISK_BEARERS[k][id]} /> : <span className="dim">{"\u00b7"}</span>}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <div className="grid g2" style={{ marginTop: 12 }}>
        {(Object.keys(RISK) as RiskKey[]).map((k) => <Panel key={k} title={RISK[k].label}><div className="rows">{Object.entries(RISK_BEARERS[k]).map(([id, why]) => <div key={id} className="rw"><div className="tt">{P[id].name}</div><div className="dd">{why}</div></div>)}</div></Panel>)}
      </div>
      <div className="callout" style={{ marginTop: 12 }}><div className="cl">The big idea</div>Agency MBS investors take almost no <b>credit risk</b> (the guarantee covers it) but a lot of <b>prepayment</b> and <b>interest rate risk</b>. Credit risk sits with Fannie Mae, Freddie Mac and Ginnie Mae (the guarantors), mortgage insurers, and the CRT and private-label investors they pass it to.</div>
    </>
  );
}

// ---------- 2008 ----------
export function CrisisPage({ onMap }: { onMap: () => void }) {
  return (
    <>
      <div className="callout warn" style={{ marginBottom: 12 }}><div className="cl">What broke, in one paragraph</div>From about 2004 to 2007, lenders made loans that borrowers couldn't afford, private-label sponsors packaged them into bonds while keeping little risk, rating agencies graded too many of them AAA, and bond insurers and investors borrowed heavily against them. When home prices fell nationally, defaults hit at once. Private-label trading froze, Fannie Mae and Freddie Mac (the agency guarantors) were taken into conservatorship (a court-style caretaker) in September 2008, and the Federal Reserve started buying agency MBS. The agency TBA market kept working because of the government backstop.</div>
      <div className="ctrl-row" style={{ marginBottom: 12 }}><button className="btn primary sm" onClick={onMap}>Show 2008 on the map</button><span className="dim">Red dashed boxes mark the players at the center of it.</span></div>
      <div className="crisis-grid">
        {CRISIS.map((c) => <div key={c.area} className="crisis-card"><div className="cc-h">{c.area}</div><div className="cc-row"><Tag tone="warn">Then</Tag><span>{c.then}</span></div><div className="cc-row"><Tag tone="bad">What broke</Tag><span>{c.broke}</span></div><div className="cc-row"><Tag tone="ok">Now</Tag><span>{c.now}</span></div></div>)}
      </div>
      <Panel title="The rulebook that changed" style={{ marginTop: 12 }} tight>
        <Tbl cols={["Year", "Change", "What it does (plain English)"]} rows={[
          ["2008", "HERA creates FHFA (the regulator); conservatorship of Fannie Mae and Freddie Mac", "A stronger regulator takes over running the two guarantors; Treasury signs the PSPA backstop."],
          ["2008", "Fed QE1 begins", "The Federal Reserve buys agency MBS to bring mortgage rates down."],
          ["2010", "Dodd-Frank Act", "The umbrella law behind most of the changes below."],
          ["2011", "CFPB (the consumer finance regulator) opens", "One agency to police mortgage lending and servicing."],
          ["2013", <span key="c"><Term k="crt">CRT (sharing the insurance risk)</Term> starts</span>, "Fannie Mae's CAS and Freddie Mac's STACR move credit risk to private investors."],
          ["2014", <span key="q"><Term k="qm">QM/ATR (the safe-loan rulebook)</Term> takes effect</span>, "Lenders must verify income and debts; no more no-doc loans."],
          ["2016", <span key="r"><Term k="riskretention">Risk retention (skin in the game)</Term> for RMBS</span>, "Private-label sponsors keep 5% of the risk."],
          ["2019", <span key="u"><Term k="umbs">UMBS (one shared bond)</Term></span>, "Fannie Mae and Freddie Mac bonds become interchangeable."],
        ]} />
      </Panel>
    </>
  );
}

// ---------- glossary ----------
export function Glossary({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  const items = Object.values(G).filter(([t, a, e]) => (t + a + e).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <div>
      <input className="input" placeholder="Search terms, e.g. g-fee, TBA, MSR" value={q} onChange={(e) => setQ(e.currentTarget.value)} aria-label="Search the glossary" />
      <div style={{ marginTop: 6 }}>{items.map(([t, a, e]) => <div key={t} className="dict-item"><div className="di-t">{t} <span className="di-a">({a})</span></div><div className="di-e">{e}</div></div>)}{!items.length && <div className="empty">No match.</div>}</div>
    </div>
  );
}

export function Quiz({ ans, setAns }: { ans: Record<number, number>; setAns: (a: Record<number, number>) => void }) {
  const right = QUIZ.filter((q, i) => ans[i] === q.ok).length;
  return (
    <>
      <div className="metrics" style={{ marginBottom: 12 }}>
        <div className="metric"><div className="k">Answered</div><div className="v num">{Object.keys(ans).length}/{QUIZ.length}</div></div>
        <div className="metric"><div className="k">Right on first try</div><div className={"v num " + (right >= 8 ? "up" : "")}>{right}</div></div>
        <div className="metric"><div className="k">Your title</div><div className="v">{right >= 9 ? "Mortgage pro" : right >= 6 ? "Pool watcher" : right >= 3 ? "Apprentice" : "Homebuyer"}</div></div>
      </div>
      <div className="grid g2">{QUIZ.map((q, i) => <Panel key={i} title={`Question ${i + 1}`}><QuizBlock q={q} ans={ans[i]} onAns={(x) => { if (ans[i] === undefined) setAns({ ...ans, [i]: x }); }} /></Panel>)}</div>
      {Object.keys(ans).length > 0 && <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => setAns({})}>Reset quiz</button></div>}
    </>
  );
}

export function Section({ children }: { children: ReactNode }) { return <>{children}</>; }
