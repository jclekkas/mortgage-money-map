import { useState } from "react";
import { DISCLAIMER, P } from "./data";
import { CASE, CASES, HUBS, todayLbl, plausLbl, LIFE, ORIG, PULL, REFRESH, REPORT_URL, SEGS, SOURCES, BASE_ASSUMP, cnt, isSourced, nodeRank, nodeWs, segTotals, totals, unitPrice, usd } from "./credit";
import type { Assump, PullType, Row, Seg as SegT, UseCase } from "./credit";
import { Panel, Seg, Slider, Term } from "./ui";

export const SrcTag = ({ c }: { c: UseCase }) => (isSourced(c) ? <span className="cc-tag src" title={c.basis}>sourced inputs</span> : <span className="cc-tag est" title={c.basis}>estimate</span>);
export const PullTag = ({ pt }: { pt: PullType }) => <span className="cc-pull" style={{ borderColor: PULL[pt].color, color: PULL[pt].color }}><i style={{ background: PULL[pt].color }}>{PULL[pt].glyph}</i>{PULL[pt].short}</span>;

export function CreditLegend() {
  return (
    <div className="legend cc-legend">
      {(Object.keys(PULL) as PullType[]).map((k) => <span key={k}><i className="own-dot" style={{ background: PULL[k].color }}>{PULL[k].glyph}</i>{PULL[k].label}</span>)}
      <span><i className="own-dot" style={{ background: "#ffb547" }}>$</i>Paid for pulls (bureaus, score makers)</span>
      <span><svg width="58" height="10" aria-hidden="true"><line x1="3" x2="47" y1="5" y2="5" className="mm-gauge-track" /><line x1="14" x2="47" y1="5" y2="5" className="mm-gauge-gap" /><circle cx="47" cy="5" r="4" className="mm-gauge-plaus" /><circle cx="14" cy="5" r="3.3" className="mm-gauge-today" /></svg>Refresh gauge: dot = today, ring = plausible (never, once, annual, quarterly, monthly)</span>
      <span><i className="cc-heat-sw" />Glow = refresh whitespace $ (estimate)</span>
    </div>
  );
}

function CaseBlock({ r }: { r: Row }) {
  const c = r.c;
  return (
    <div className="cc-case">
      <div className="cc-case-h"><b>{c.id}</b> {c.name}</div>
      <div className="cc-tags"><PullTag pt={c.pt} /><SrcTag c={c} /></div>
      <dl className="cc-dl">
        <dt>Who pulls</dt><dd>{c.who}</dd>
        <dt>Why</dt><dd>{c.why}</dd>
        <dt>Pull type</dt><dd>{c.pull}</dd>
        <dt><Term k="permissible">FCRA permissible purpose (the legal hall pass)</Term></dt><dd>{c.legal}</dd>
        <dt>Refresh today</dt><dd>{c.refreshToday}</dd>
        <dt>Plausible</dt><dd>{c.refreshPlausible}</dd>
        <dt>TAM / SAM / realistic</dt><dd className="num">{usd(r.tam)} / {usd(r.sam)} / {usd(r.real)} a year{c.overlap < 1 ? " (counted at 50% in totals)" : ""}</dd>
        <dt>Where the inputs come from</dt><dd>{c.basis}</dd>
      </dl>
    </div>
  );
}

export function CreditCard({ id, rows }: { id: string; rows: Row[] }) {
  const p = P[id], r = REFRESH[id], o = ORIG[id], h = HUBS[id];
  const ids = r ? r.cases.map(([c]) => c) : o ? o.cases : [];
  return (
    <div className="pcard cc-card" data-testid="credit-card">
      <div className="pc-sub" style={{ marginTop: 0 }}>Credit checks here</div>
      <div className="pc-h">{p.name}</div>
      {r && <>
        <div className="p">{r.why}</div>
        <div className="cc-gauge-row">
          <div><div className="k">Refresh today</div><div className="v">{todayLbl(r)}</div><div className="d">{r.todayText}</div></div>
          <div><div className="k">Could be</div><div className="v">{plausLbl(r)}</div><div className="d">{r.plausText}</div></div>
          <div><div className="k"><Term k="whitespace">Refresh whitespace (checks nobody is doing yet)</Term></div><div className="v num">{usd(nodeWs(rows, id))}/yr</div><div className="d">estimate: files × price × extra refreshes per year{r.cases.some(([, s]) => s < 1) ? "; shared use cases split by an estimated share" : ""}</div></div>
        </div>
        {r.sourced && <div className="p"><span className="cc-tag src">sourced</span> {r.sourced}</div>}
      </>}
      {o && <div className="p"><span className="cc-tag n">origination pull</span> {o.note}</div>}
      {h && <div className="p">{h}</div>}
      {ids.map((cid) => { const row = rows.find((x) => x.c.id === cid); return row ? <CaseBlock key={cid} r={row} /> : null; })}
      {h && <div className="p dim">They are paid by nearly every use case on the Credit checks page: about {usd(totals(rows).tam)} a year in total (TAM, estimate).</div>}
      <div className="legal" style={{ marginTop: 10 }}>Legal basis is a plain reading of FCRA §604, not legal advice. Frequencies and dollars are estimates unless marked sourced.</div>
    </div>
  );
}

export function RefreshTop({ rows, onShow, sel, n = 8 }: { rows: Row[]; onShow: (id: string) => void; sel?: string; n?: number }) {
  const rk = nodeRank(rows).filter((x) => x.ws > 0).slice(0, n);
  const max = Math.max(1, rk[0]?.ws ?? 1);
  return (
    <ol className="cc-top" data-testid="refresh-top">
      {rk.map((x, i) => { const r = REFRESH[x.id]; return (
        <li key={x.id}><button className={"cc-top-b" + (sel === x.id ? " on" : "")} onClick={() => onShow(x.id)} data-top={x.id}>
          <span className="cc-rank">{i + 1}</span>
          <span className="cc-top-m"><span className="cc-top-n">{P[x.id].label} <span className="dim">({P[x.id].role})</span></span><span className="cc-top-f">{todayLbl(r)} {"\u2192"} {plausLbl(r)}</span><span className="cc-bar"><i style={{ width: `${Math.max(3, (x.ws / max) * 100)}%` }} /></span></span>
          <span className="cc-top-v num">{usd(x.ws)}<span className="dim">/yr est.</span></span>
        </button></li>); })}
    </ol>
  );
}

export function LifeStrip({ onShow }: { onShow: (id: string) => void }) {
  return (
    <div className="life-wrap"><div className="life" data-testid="life-strip">
      {LIFE.map((col, i) => <div key={i} className={"life-col" + (i >= 3 ? " svc" : "")}>
        <div className="life-h"><b>{col.t}</b><span className="dim">{col.sub}</span></div>
        <div className="life-row"><span className="life-l">Today</span>{col.today.map((d) => <button key={d.label} className="life-dot today" onClick={() => onShow(d.node)} title={`${CASE[d.cid].name}. ${CASE[d.cid].refreshToday}`}><i style={{ background: PULL[CASE[d.cid].pt].color }} />{d.label}</button>)}</div>
        <div className="life-row"><span className="life-l">Could be</span>{col.could.map((d) => <button key={d.label} className="life-dot could" onClick={() => onShow(d.node)} title={`${CASE[d.cid].name}. Plausible: ${CASE[d.cid].refreshPlausible} (estimate)`}><i style={{ borderColor: PULL[CASE[d.cid].pt].color }} />{d.label}</button>)}</div>
      </div>)}
    </div></div>
  );
}

export function CreditPage({ rows, a, setA, onShow }: { rows: Row[]; a: Assump; setA: (a: Assump) => void; onShow: (id: string) => void }) {
  const [seg, setSeg] = useState<SegT>("Servicing");
  const [sel, setSel] = useState("P1");
  const t = totals(rows), st = segTotals(rows);
  const maxT = Math.max(...st.map((s) => s.tam));
  const sc = CASE[sel], so = a.ov[sel] ?? { price: sc.price, pulls: sc.pulls };
  const setOv = (v: { price: number; pulls: number }) => setA({ ...a, ov: { ...a.ov, [sel]: v } });
  const selRow = rows.find((r) => r.c.id === sel) as Row;
  return (
    <>
      <div className="p">A <Term k="refresh">credit refresh (a fresh look at an old loan's borrower)</Term> is where the room to grow is. Almost every application already pays for a <Term k="trimerge">tri-merge report (all three bureaus' files stapled together)</Term>, but the 50+ million existing loans are rechecked quarterly at best and often never. All figures are estimates built on sourced inputs; the full report has every source.</div>
      <div className="metrics" style={{ margin: "10px 0 12px" }}>
        <div className="metric"><div className="k"><Term k="tamsam">TAM (the whole pie)</Term></div><div className="v num">{usd(t.tam)}</div><div className="d">a year, all 26 use cases (estimate)</div></div>
        <div className="metric"><div className="k">SAM (the slice you can reach)</div><div className="v num">{usd(t.sam)}</div><div className="d">reachable under today's rules (estimate)</div></div>
        <div className="metric"><div className="k">Realistic (one new provider)</div><div className="v num">{usd(t.real)}</div><div className="d">3 to 5 years, share of SAM (estimate)</div></div>
        <div className="metric"><div className="k">Share at origination</div><div className="v num">{Math.round((st[0].tam / t.tam) * 100)}%</div><div className="d">mostly the tri-merge hard pull</div></div>
        <div className="metric"><div className="k">Refresh whitespace</div><div className="v num">{usd(t.ws)}</div><div className="d">a year, gap to plausible refresh (estimate)</div></div>
      </div>
      <div className="callout"><div className="cl">Full report</div>Every use case, the method, sensitivities and 19 sources: <a href={REPORT_URL} target="_blank" rel="noreferrer">Credit checks in the secondary mortgage market: use cases and opportunity sizing</a>.</div>
      <Panel title="Where a loan gets checked: today vs could be" style={{ marginTop: 12 }} tour="life"><LifeStrip onShow={onShow} /><div className="p dim" style={{ marginTop: 6 }}>Filled dots: checks that happen today. Hollow dots: refreshes that could happen. Click one to see that player on the map. Frequencies are estimates unless marked sourced.</div></Panel>
      <Panel title="Top refresh opportunities" right={<span className="dim">click to show on map</span>} style={{ marginTop: 12 }}><RefreshTop rows={rows} onShow={onShow} n={10} /></Panel>
      <Panel title="TAM, SAM and realistic by segment" right={<span className="dim">annual, estimate</span>} style={{ marginTop: 12 }}>
        <div className="sbar-legend legend"><span><span className="sw" style={{ background: "var(--accent)" }} />Realistic</span><span><span className="sw" style={{ background: "color-mix(in srgb, var(--accent) 45%, var(--panel2))" }} />Rest of SAM</span><span><span className="sw" style={{ background: "var(--panel3)" }} />Rest of TAM</span></div>
        <div className="sbars" data-testid="seg-bars">{st.map((s) => <div key={s.g} className="sbar-row">
          <span className="sbar-l">{s.g}</span>
          <span className="sbar-track"><span className="sbar" style={{ width: `${(s.tam / maxT) * 100}%` }}><i className="r" style={{ width: `${(s.real / s.tam) * 100}%` }} /><i className="s" style={{ width: `${((s.sam - s.real) / s.tam) * 100}%` }} /><i className="t" /></span></span>
          <span className="sbar-v num">{usd(s.tam)} <span className="dim">TAM · {usd(s.real)} realistic</span></span>
        </div>)}</div>
      </Panel>
      <Panel title="Try your own assumptions" right={<button className="btn sm" onClick={() => setA(BASE_ASSUMP)}>Reset</button>} style={{ marginTop: 12 }} tour="assump">
        <div className="cc-assump">
          <Slider label="Price multiplier, every use case" value={a.pm} min={0.5} max={2} step={0.05} fmt={(v) => v.toFixed(2) + "×"} onChange={(v) => setA({ ...a, pm: v })} id="cc-pm" />
          <Slider label="Refresh frequency multiplier, every use case" value={a.fm} min={0.5} max={2} step={0.05} fmt={(v) => v.toFixed(2) + "×"} onChange={(v) => setA({ ...a, fm: v })} id="cc-fm" />
        </div>
        <div className="cc-assump" style={{ marginTop: 10 }}>
          <label className="cc-sel"><span className="ctl-l">One use case</span><select value={sel} onChange={(e) => setSel(e.target.value)}>{CASES.map((c) => <option key={c.id} value={c.id}>{c.id} {c.name.split(" (")[0]}</option>)}</select></label>
          <Slider label="Price per pull" value={so.price} min={+(sc.price * 0.25).toFixed(2)} max={sc.price * 3} step={sc.price < 1 ? 0.01 : sc.price < 10 ? 0.25 : sc.price > 1000 ? 5000 : 1} fmt={unitPrice} onChange={(v) => setOv({ price: v, pulls: so.pulls })} id="cc-price" />
          <Slider label="Pulls per file per year" value={so.pulls} min={1} max={sc.pulls > 4 ? 52 : 12} step={1} fmt={(v) => String(v)} onChange={(v) => setOv({ price: so.price, pulls: v })} id="cc-pulls" />
        </div>
        <div className="p" style={{ marginTop: 8 }}><b>{sel} now:</b> {cnt(sc.units)} {sc.unitLabel} × {selRow.pu % 1 === 0 ? selRow.pu : selRow.pu.toFixed(1)} pulls × {unitPrice(selRow.pr)} = <b className="num">{usd(selRow.tam)}</b> TAM, {usd(selRow.sam)} SAM, {usd(selRow.real)} realistic. TAM, SAM and realistic update everywhere. Refresh whitespace (and the map's glow) moves with the price sliders and the refresh frequency multiplier. Nothing is saved.</div>
      </Panel>
      <Panel title="Every use case" right={<Seg label="Segment" value={seg} onChange={setSeg} options={SEGS.map((g) => ({ value: g, label: g }))} />} tight style={{ marginTop: 12 }} tour="cctable">
        <div className="tbl-wrap"><table className="tbl cc-tbl" data-testid="cc-table">
          <thead><tr><th>Use case</th><th>Who pulls</th><th>Pull</th><th>FCRA permissible purpose</th><th>Refresh today {"\u2192"} plausible</th><th className="r">TAM</th><th className="r">SAM</th><th className="r">Realistic</th><th>Basis</th></tr></thead>
          <tbody>{rows.filter((r) => r.c.seg === seg).map((r) => <tr key={r.c.id}>
            <td><b>{r.c.id}</b> {r.c.name}</td><td>{r.c.who}</td><td><PullTag pt={r.c.pt} /></td><td>{r.c.legal}</td><td>{r.c.refreshToday} {"\u2192"} {r.c.refreshPlausible}</td>
            <td className="r num">{usd(r.tam)}</td><td className="r num">{usd(r.sam)}</td><td className="r num">{usd(r.real)}</td><td><SrcTag c={r.c} /></td></tr>)}
            <tr className="tot"><td colSpan={5}><b>{seg} total</b> (P2, P3 and T6 counted at 50%)</td>{(() => { const s = st.find((x) => x.g === seg)!; return <><td className="r num">{usd(s.tam)}</td><td className="r num">{usd(s.sam)}</td><td className="r num">{usd(s.real)}</td></>; })()}<td /></tr>
          </tbody>
        </table></div>
      </Panel>
      <div className="callout" style={{ marginTop: 12 }}><div className="cl">How to read this</div>TAM = files × pulls per year × price per pull. SAM = TAM × the share a provider can reach. Realistic = SAM × the share one new provider could win. Refresh whitespace = files × price × (plausible minus today's refreshes per year). "Sourced inputs" means at least one input cites a numbered source in the report; the rest are estimates. Legal basis is a plain reading of FCRA §604 (15 U.S.C. §1681b), not legal advice.</div>
      <Panel title="Sources" style={{ marginTop: 12 }}><ol className="cc-src">{SOURCES.map(([t, u], i) => <li key={u}><a href={u} target="_blank" rel="noreferrer">[{i + 1}] {t}</a></li>)}</ol></Panel>
      <div className="legal" style={{ marginTop: 10 }}>{DISCLAIMER}</div>
    </>
  );
}
