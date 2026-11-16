import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DISCLAIMER, FACTS, FLOW_LEGEND, OWN, P, QUIZ, PATH_LABEL, RISK, TIMELINES, VIEW_LABEL, VIEW_SHORT, pathFor } from "./data";
import type { AgencyPath, OwnKind, PathKey, RiskKey, ViewSel } from "./data";
import { MoneyMap, inView, selectFlows } from "./map";
import { DEFAULT_LF, applyFilter, decodeHash, encodeHash, idOf as ALLidx, lineText, universe } from "./lines";
import type { LineFilter } from "./lines";
import { LineFilterPanel, ShownList, hideLf, soloLf } from "./lineFilter";
import type { Flow } from "./data";
import type { Overlay } from "./map";
import { Panel, Seg, Switch, Term } from "./ui";
import { BASE_ASSUMP, HUBS, ORIG, REFRESH, calc } from "./credit";
import type { Assump } from "./credit";
import { CreditCard, CreditLegend, CreditPage, LifeStrip, RefreshTop } from "./creditPages";
import { RolePage } from "./rolePage";
import { ROLE } from "./roles";
import { CrisisPage, Glossary, OneDollar, OwnBadges, OwnLegend, PlayerCard, Quiz, RiskPage, namesOf } from "./pages";

const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const PAGES: [string, string][] = [["Money map", "follow the money"], ["Who owns it?", "loan vs bond, step by step"], ["Follow one payment", "where your dollar goes"], ["Who takes which risk", "credit, prepay, rates, cash"], ["2008: then vs now", "what broke, what changed"], ["Credit checks", "refresh opportunities, sized"], ["Play a role", "7 jobs, quarter by quarter"], ["Glossary", "every term, in plain English"], ["Check yourself", `${QUIZ.length}-question quiz`]];
const VIEW_EXPLAIN: Record<ViewSel, ReactNode> = {
  all: <>Every player at once. Pick a view above to focus on one part of the market. Most US mortgages travel the <b>agency</b> route: lenders sell them to Fannie Mae or Freddie Mac (the agency guarantors), or pool them under Ginnie Mae (the government guarantor), and the loans become <Term k="mbs">mortgage-backed securities, MBS (bonds made of mortgages)</Term>.</>,
  agency: <>The government-backed highway. Lenders swap or sell loans to Fannie Mae and Freddie Mac (the agency guarantors) or pool FHA and VA loans under Ginnie Mae (the government guarantor). The bonds trade in the <Term k="tba">TBA market (forward orders for generic bonds)</Term>, the guarantors earn a <Term k="gfee">guarantee fee, g-fee (insurance premium)</Term>, and investors take rate and prepayment risk but not credit risk.</>,
  nonagency: <>Loans the agencies can't take, such as <Term k="jumbo">jumbo loans (too big for Fannie)</Term> and <Term k="nonqm">non-QM loans (outside the standard box)</Term>, go through a private <Term k="spv">special purpose vehicle, SPV (walled-off box)</Term>. Nobody guarantees the bonds, so <Term k="rating">credit ratings (grades)</Term>, <Term k="tranche">tranches (floors of the building)</Term> and <Term k="riskretention">risk retention (skin in the game)</Term> do the protecting.</>,
  crt: <>Fannie Mae and Freddie Mac keep the loans in their trusts but pay outside investors to take part of the credit risk: <Term k="cas">CAS (Fannie's credit risk bonds)</Term>, <Term k="stacr">STACR (Freddie's)</Term>, insurance deals, and <Term k="pmi">private mortgage insurance, PMI (deductible cover)</Term>. Investors own risk, not loans.</>,
  servicing: <>Someone has to collect every payment. The <Term k="servicer">servicer (payment collector)</Term> keeps a <Term k="feestrip">servicing fee strip (the collector's cut)</Term>; the right to that fee is an asset, the <Term k="msr">mortgage servicing right, MSR (the right to collect the fee)</Term>, which can be sold apart from the loan.</>,
};

export default function App() {
  const [H] = useState(() => decodeHash(typeof location !== "undefined" ? location.hash : ""));
  const [page, setPageRaw] = useState(() => H.page ?? (Number(ls.get("mmm.page") ?? 0) || 0));
  const setPage = (n: number) => { setPageRaw(n); ls.set("mmm.page", String(n)); document.querySelector(".main")?.scrollTo(0, 0); };
  const [view, setViewRaw] = useState<ViewSel>(H.view ?? "all");
  const [apath, setApath] = useState<AgencyPath>(H.apath ?? "swap");
  const [step, setStep] = useState(H.step ?? 0);
  const [overlay, setOverlay] = useState<Overlay>(H.overlay ?? "money");
  const [lf, setLf] = useState<LineFilter>(H.lf ?? DEFAULT_LF);
  const [lfOpen, setLfOpen] = useState(false);
  const [lineMenu, setLineMenu] = useState<{ f: Flow; x: number; y: number } | null>(null);
  const [risk, setRisk] = useState<RiskKey>("credit");
  const [crisis, setCrisis] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [sel, setSel] = useState(H.sel ?? "");
  const [roleId, setRoleId] = useState(H.role && ROLE[H.role] ? H.role : "");
  const playRole = (id: string) => { setRoleId(id); setPage(6); setMtab("main"); };
  const [assump, setAssump] = useState<Assump>(BASE_ASSUMP);
  const rows = useMemo(() => calc(assump), [assump]);
  const hasCredit = (id: string) => !!(REFRESH[id] || ORIG[id] || HUBS[id]);
  const [sideTab, setSideTab] = useState<"player" | "glossary">("player");
  const [mtab, setMtab] = useState<"main" | "player" | "glossary">("main");
  const [gq, setGq] = useState("");
  const [quiz, setQuiz] = useState<Record<number, number>>({});
  const [theme, setTheme] = useState(() => ls.get("mmm.theme") ?? "dark");
  const [tour, setTour] = useState(() => (ls.get("mmm.tour.v1") ? -1 : 0));
  const [hole, setHole] = useState<DOMRect | null>(null);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); ls.set("mmm.theme", theme); }, [theme]);

  const setView = (v: ViewSel) => { setViewRaw(v); setStep(0); };
  const path: PathKey = pathFor(view, apath);
  const steps = TIMELINES[path];
  const si = Math.min(step, steps.length - 1);
  const st = steps[si];
  const pickPath = (k: PathKey) => { if (k === "swap" || k === "cash" || k === "ginnie") { setApath(k); setViewRaw(view === "all" ? "all" : "agency"); } else setViewRaw(k); setStep(0); };
  const pick = (id: string) => { setSel(id); setSideTab("player"); };
  // Ownership chips: find the map box for the current loan or bond owner and jump to it.
  const ownerNode = (k: OwnKind): string | null => { const ids = Object.entries(st.own).filter(([, ks]) => ks.includes(k)).map(([id]) => id); if (!ids.length) return null; return ids.find((id) => inView(P[id].views, view)) ?? ids[0]; };
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const showOnMap = (id: string) => { if (page !== 0) setPage(0); setMtab("main"); setSel(id); setSideTab("player"); setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 })); };
  const showCredit = (id: string) => { setOverlay("credit"); showOnMap(id); };
  useEffect(() => {
    if (!flash) return;
    const r = requestAnimationFrame(() => { const el = document.querySelector<SVGGElement>(`[data-node="${flash.id}"]`); if (el) { el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); } });
    const t = setTimeout(() => setFlash(null), 2600);
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  }, [flash?.n]); // eslint-disable-line
  useEffect(() => { const h = encodeHash({ page, view, overlay, sel, apath, step: si, lf, role: page === 6 ? roleId : "" }); try { history.replaceState(null, "", "#" + h); } catch { /* ignore */ } }, [page, view, overlay, sel, apath, si, lf, roleId]);
  const uni = useMemo(() => universe(view), [view]);
  const shownFlows = selectFlows({ view, overlay, sel, focus: [...Object.keys(st.own), "borrower"], show: st.show, lines: lf.custom ? applyFilter(uni, lf) : null });
  // When only a few lines show, scroll the sideways-scrolling map (mobile) so they're in view.
  useEffect(() => {
    if (!lf.custom || shownFlows.length === 0 || shownFlows.length > 3) return;
    const r = requestAnimationFrame(() => {
      const sc = document.querySelector<HTMLElement>(".mm-scroll"); const ps = [...document.querySelectorAll<SVGPathElement>(".mm-svg .mm-edge")];
      if (!sc || !ps.length || sc.scrollWidth <= sc.clientWidth + 2) return;
      const bs = ps.map((p) => p.getBoundingClientRect()); const l = Math.min(...bs.map((b) => b.left)), rr = Math.max(...bs.map((b) => b.right)); const c = sc.getBoundingClientRect();
      sc.scrollLeft += (l + rr) / 2 - (c.left + c.width / 2);
    });
    return () => cancelAnimationFrame(r);
  }, [lf, sel, view]); // eslint-disable-line
  const solo = (f: Flow) => { setLf(soloLf(f)); setSel(""); setLineMenu(null); };
  const hide = (f: Flow) => { setLf(hideLf(lf.custom ? lf : { ...DEFAULT_LF, off: uni.filter((x) => !shownFlows.includes(x)).map((x) => ALLidx(x)) }, f)); setLineMenu(null); };
  const prev = () => setStep(Math.max(0, si - 1)), next = () => setStep(Math.min(steps.length - 1, si + 1));

  // ---------- tour ----------
  const TOUR: { sel: string; title: string; body: string }[] = [
    { sel: "", title: "Welcome to the Mortgage Money Map", body: "When you get a mortgage, your lender usually sells it. This map shows everyone who touches that loan afterwards: who pays whom, who owns what, and who takes which risk. Real firms appear in their real roles for realism; figures are approximate or examples, and no affiliation is implied." },
    { sel: "owner", title: "Who owns it right now", body: "This bar is always on screen. It names the current owner of the loan (the IOU) and of the bond (the MBS) for the step you're on. Click either one to jump to that owner on the map. Use the arrows to walk the loan from closing day to payoff." },
    { sel: "controls", title: "Pick a view and an overlay", body: "Focus on Agency, Non-agency, CRT or Servicing. Overlays switch between money flows, who owns what, and who takes which risk. The 2008 switch marks what broke in the crisis." },
    { sel: "map", title: "Click any box", body: "With nothing selected, the arrows show just this ownership step's flows. Click a box to see only that player's flows (green = money, blue = paper, amber = fees, purple = risk) and open its details. Glowing green = owns the loan right now; round badges show what each player owns." },
    { sel: "map", title: "Follow the warehouse line too", body: "Most loans are made by nonbank lenders that don't have the cash themselves. They draw on a warehouse line (the lender's credit line) from banks like JPMorgan, Wells Fargo or Texas Capital, pledge the new loan as collateral, and repay the line when the loan is sold. Click Warehouse lenders to see the loop; the cyan C badge means 'holds as collateral, not owner'." },
    { sel: "controls", title: "Where could credit be refreshed?", body: "Pick the Credit refreshes overlay. Every player that holds or carries risk on an existing loan gets a gauge: the dot is how often borrowers' credit is checked today, the ring is how often it plausibly could be, and the glow shows the dollar gap (estimates). Hard pulls at application are still marked, but they're the crowded part of the market." },
    { sel: "side", title: "The player card", body: "What they do, how they get paid, their incentives and risks, real examples, and every dollar in and out. The Glossary tab explains every term." },
    { sel: "rail", title: "Play a role", body: "Open Play a role (or press Play this role on a player card) to run a servicer, mortgage insurer, CRT investor, whole loan trader, warehouse lender, a lender's warehouse line analyst or an MSR aggregator for 5 to 8 quarters. Make the calls, survive the shocks, and see what a pro and a credit refresh would have done. All numbers are mock." },
    { sel: "rail", title: "More ways to learn", body: "Step through ownership, follow one monthly payment, see the risk matrix, compare 2008 with today, and test yourself. Replay this tour anytime with the Tour button." },
  ];
  const startTour = () => { setPage(0); setMtab("main"); setTour(0); };
  const endTour = () => { setTour(-1); ls.set("mmm.tour.v1", "1"); };
  useLayoutEffect(() => {
    if (tour < 0) { setHole(null); return; }
    const s = TOUR[tour]?.sel;
    if (!s) { setHole(null); return; }
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${s}"]`)].find((e) => e.getClientRects().length > 0 && getComputedStyle(e).display !== "none");
    if (!el) { setHole(null); return; }
    el.scrollIntoView({ block: "nearest" });
    const t = setTimeout(() => { const r = el.getBoundingClientRect(); const vh = window.innerHeight, vw = window.innerWidth; setHole(new DOMRect(Math.max(4, r.left), Math.max(4, r.top), Math.min(r.width, vw - 8), Math.min(r.height, vh * 0.55))); }, 60);
    return () => clearTimeout(t);
  }, [tour, page]); // eslint-disable-line
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (tour >= 0) { if (e.key === "Escape") endTour(); else if (e.key === "ArrowRight") { if (tour === TOUR.length - 1) endTour(); else setTour(tour + 1); } else if (e.key === "ArrowLeft" && tour > 0) setTour(tour - 1); return; }
      if (e.key === "ArrowRight" && page <= 1) next(); else if (e.key === "ArrowLeft" && page <= 1) prev(); else if (e.key.toLowerCase() === "g") startTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const tc = tour >= 0 ? TOUR[tour] : null;
  let cardPos: CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
  if (hole) {
    const vw = window.innerWidth, vh = window.innerHeight, cw = Math.min(330, vw - 24);
    const left = Math.max(12, Math.min(hole.left, vw - cw - 12));
    if (hole.bottom + 230 < vh) cardPos = { left, top: hole.bottom + 12 };
    else if (hole.top - 230 > 0) cardPos = { left, top: hole.top - 12, transform: "translateY(-100%)" };
    else cardPos = { left, top: Math.max(12, vh - 250) };
  }

  const pathOptions: PathKey[] = ["swap", "cash", "ginnie", "nonagency", "crt", "servicing"];
  const ownBar = (
    <div className="ownbar" data-tour="ownbar">
      <div className="ob-top">
        <span className="ob-step">Step {si + 1}/{steps.length} {"\u00b7"} {PATH_LABEL[path]}</span>
        <span className="ob-title">{st.t}</span>
        <span className="ob-nav"><button className="btn sm" onClick={prev} disabled={si === 0} aria-label="Previous ownership step">{"\u25c0"} Back</button><button className="btn sm primary" onClick={next} disabled={si === steps.length - 1} aria-label="Next ownership step">Next {"\u25b6"}</button></span>
      </div>
      <div className="ob-dots">{steps.map((s, i) => <button key={i} className={i === si ? "on" : i < si ? "done" : ""} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.t}`} title={s.t} />)}</div>
    </div>
  );

  const MapPage = (
    <>
      <div className="ws-head"><div><div className="crumb">Follow the money</div><h1>The US secondary mortgage market</h1></div></div>
      <div className="p">Your lender usually doesn't keep your mortgage. It sells it in the <Term k="secondary">secondary mortgage market (the resale market for loans)</Term>, gets its cash back, and lends again. Click any box to see what that player does, how it gets paid and what it owns.</div>
      <div className="metrics" style={{ margin: "10px 0 12px" }}>{FACTS.map((f) => <div key={f.k} className="metric"><div className="k">{f.k}</div><div className="v num">{f.v}</div><div className="d">{f.d}</div></div>)}</div>
      <Panel title="Controls" tour="controls">
        <div className="ctrl-grid">
          <div><div className="ctl-l">View (which part of the market)</div><Seg label="View" value={view} onChange={setView} options={(["all", "agency", "nonagency", "crt", "servicing"] as ViewSel[]).map((v) => ({ value: v, label: VIEW_SHORT[v] }))} /></div>
          <div><div className="ctl-l">Overlay (what to show)</div><Seg label="Overlay" value={overlay} onChange={setOverlay} options={[{ value: "money", label: "Money flows" }, { value: "owner", label: "Who owns what" }, { value: "risk", label: "Who takes which risk" }, { value: "credit", label: "Credit refreshes" }]} /></div>
          {view === "all" || view === "agency" ? <div><div className="ctl-l">Agency route</div><Seg label="Agency route" value={apath} onChange={(v) => { setApath(v); setStep(0); }} options={[{ value: "swap", label: "Swap" }, { value: "cash", label: "Cash window" }, { value: "ginnie", label: "Ginnie Mae" }]} /></div> : null}
          <div className="ctl-sw"><Switch label="2008 then vs now" value={crisis} onChange={setCrisis} /><Switch label="Animate money" value={animate} onChange={setAnimate} /></div>
        </div>
        {overlay === "risk" && <div className="chips" style={{ marginTop: 10 }}>{(Object.keys(RISK) as RiskKey[]).map((k) => <button key={k} className={"chip" + (risk === k ? " on" : "")} onClick={() => setRisk(k)}><span className="sw" style={{ background: RISK[k].color }} />{RISK[k].label}</button>)}</div>}
      </Panel>
      <div className="sticky-own">{ownBar}</div>
      <Panel title={`${VIEW_LABEL[view]}: follow the money`} right={overlay === "credit" ? (sel ? <span className="showing">Credit checks at <b>{P[sel].label}</b> <button className="btn sm" onClick={() => setSel("")}>Clear {"\u2715"}</button></span> : <span className="dim showing">Showing who pays for credit checks {"\u00b7"} click a box or a marker</span>) : sel ? <span className="showing">Showing <b>{P[sel].label}</b>'s flows <button className="btn sm" onClick={() => setSel("")}>Clear {"\u2715"}</button></span> : <span className="dim showing">Showing this step's flows {"\u00b7"} click a box for its flows</span>} tour="map" style={{ marginTop: 12 }}>
        <div className="lf-bar">
          <button className={"btn sm" + (lfOpen ? " primary" : "")} onClick={() => setLfOpen(!lfOpen)} aria-expanded={lfOpen} data-testid="lf-toggle"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M1.5 2.5h13l-5 6v5l-3-1.5v-3.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg> Filter lines</button>
          <span className="lf-count" data-testid="lf-count-bar">Showing {shownFlows.length} of {uni.length} lines{lf.custom ? " (your filter)" : sel ? ` (${P[sel].label})` : " (this step)"}</span>
          {lf.custom && <button className="btn sm" onClick={() => setLf(DEFAULT_LF)}>Reset lines</button>}
        </div>
        {lfOpen && <><div className="lf-back" onClick={() => setLfOpen(false)} /><div className="lf-sheet"><LineFilterPanel lf={lf} setLf={setLf} uni={uni} shown={shownFlows.length} onClose={() => setLfOpen(false)} /></div></>}
        <div className="mm-scroll"><MoneyMap view={view} overlay={overlay} risk={risk} crisis={crisis} sel={sel} onPick={pick} own={st.own} animate={animate} flash={flash?.id} focus={[...Object.keys(st.own), "borrower"]} show={st.show} rows={rows} lines={lf.custom ? applyFilter(uni, lf) : null} onLine={(f, x, y) => setLineMenu({ f, x, y })} /></div>
        <ShownList flows={shownFlows} onSolo={solo} onHide={hide} />
        {overlay === "credit" ? <CreditLegend /> : <OwnLegend />}
        <div className="legend flow-legend" style={{ marginTop: 6 }}>{FLOW_LEGEND.map((l) => <span key={l.label}><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="19" y2="5" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? "4 3" : undefined} /><path d="M18,1.5 L25,5 L18,8.5 z" fill={l.color} /></svg>{l.label}</span>)}</div>
        <div className="p dim" style={{ margin: "6px 0 0" }}>Arrows point the way money or paper moves. A label that doesn't fit appears when you hover its arrow; every flow is listed in the player card.</div>
        {overlay === "risk" && <div className="p" style={{ marginTop: 6 }}><b style={{ color: RISK[risk].color }}>{RISK[risk].label}:</b> {RISK[risk].plain} Lit boxes carry this risk; click one to see why.</div>}
        {overlay === "credit" && <div className="p" style={{ marginTop: 6 }}><b>Credit refreshes:</b> players that hold or carry risk on existing loans show how often borrowers' credit is checked today (dot) versus plausibly (ring), and the yearly dollar gap. Application pulls are marked H but aren't the opportunity: they already happen on nearly every loan. All frequencies and dollars are estimates unless marked sourced.</div>}
        {crisis && <div className="p" style={{ marginTop: 6 }}><b className="down">2008 mode:</b> red dashed boxes with a ! were at the center of the crisis. Click one to see what broke and what changed.</div>}
      </Panel>
      {overlay === "credit" && <>
        <Panel title="Top refresh opportunities" right={<button className="btn sm" onClick={() => setPage(5)}>Full sizing</button>} style={{ marginTop: 12 }}><RefreshTop rows={rows} onShow={showCredit} sel={sel} /></Panel>
        <Panel title="A loan's life: checks today vs refreshes that could happen" style={{ marginTop: 12 }} tour="life"><LifeStrip onShow={showCredit} /><div className="p dim" style={{ marginTop: 6 }}>Filled = happens today; hollow = could happen. Click any dot to highlight that player. Estimates unless marked sourced.</div></Panel>
      </>}
      <div className="grid g-wide-left" style={{ marginTop: 12 }}>
        <Panel title={`Ownership step ${si + 1}: ${st.t}`}>
          <div className="p">{st.d}</div>
          <div className="own-rows">
            {(Object.keys(OWN) as OwnKind[]).map((k) => <div key={k} className="own-row"><span className="own-k"><i className="own-dot" style={{ background: OWN[k].color }}>{OWN[k].glyph}</i>{OWN[k].label}</span><span className="own-v">{namesOf(st, k)}</span></div>)}
          </div>
        </Panel>
        <Panel title={`What the ${VIEW_SHORT[view].toLowerCase()} view shows`}><div className="p">{VIEW_EXPLAIN[view]}</div></Panel>
      </div>
      <div className="m-only" style={{ marginTop: 12 }}><Panel title="Selected player">{sel && overlay === "credit" && hasCredit(sel) && <CreditCard id={sel} rows={rows} />}{sel ? <PlayerCard id={sel} own={st.own} view={view} crisis={crisis} onPlay={playRole} /> : <div className="p dim">Tap any box on the map to see what that player does, how it gets paid and what it owns.</div>}</Panel></div>
    </>
  );

  const OwnPage = (
    <>
      <div className="ws-head"><div><div className="crumb">Who owns it?</div><h1>Legal ownership, step by step</h1></div></div>
      <div className="p">Four different things get owned, and they often sit with different players: <b style={{ color: OWN.loan.color }}>the loan</b> (the <Term k="note">promissory note (the IOU)</Term>), <b style={{ color: OWN.sec.color }}>the security</b> (the <Term k="mbs">MBS (bond)</Term> backed by many loans), <b style={{ color: OWN.risk.color }}>the risk only</b> (a promise to pay if loans go bad) and <b style={{ color: OWN.msr.color }}>the servicing rights</b> (the right to collect payments for a fee). Everyone else just <b style={{ color: OWN.cash.color }}>handles cash or records for a fee</b>.</div>
      <Panel title="Pick a route" style={{ marginTop: 10 }}>
        <div className="chips">{pathOptions.map((k) => <button key={k} className={"chip" + (path === k ? " on" : "")} onClick={() => pickPath(k)}>{PATH_LABEL[k]}</button>)}</div>
      </Panel>
      <div className="sticky-own" style={{ marginTop: 12 }}>{ownBar}</div>
      <div className="grid g-wide-left" style={{ marginTop: 12 }}>
        <Panel title="Timeline (click a step)">
          <div className="xpath">{steps.map((s, i) => <button key={i} className={"xstep tl" + (i === si ? " on" : i < si ? " done" : "")} onClick={() => setStep(i)}><span className="xn">{i + 1}</span><span><span className="xt">{s.t}</span>{i === si && <span className="xd" style={{ display: "block", marginTop: 4 }}>{s.d}</span>}<span className="tl-own"><span><i className="own-dot" style={{ background: OWN.loan.color }}>L</i>{s.loan}</span><span><i className="own-dot" style={{ background: OWN.sec.color }}>S</i>{s.sec}</span></span></span></button>)}</div>
        </Panel>
        <Panel title="Right now">
          <div className="own-rows">{(Object.keys(OWN) as OwnKind[]).map((k) => <div key={k} className="own-row"><span className="own-k"><i className="own-dot" style={{ background: OWN[k].color }}>{OWN[k].glyph}</i>{OWN[k].label}</span><span className="own-v">{namesOf(st, k)}</span></div>)}</div>
          <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => { setOverlay("owner"); setPage(0); }}>See this step on the map</button></div>
        </Panel>
      </div>
      <Panel title="Ownership ledger: the loan vs the bond" tight style={{ marginTop: 12 }} tour="ledger">
        <div className="tbl-wrap">
          <table className="tbl ledger">
            <thead><tr><th>Step</th><th style={{ color: OWN.loan.color }}>Owns the loan</th><th style={{ color: OWN.sec.color }}>Owns the bond</th><th style={{ color: OWN.risk.color }}>Owns only risk</th><th style={{ color: OWN.msr.color }}>Owns servicing rights</th><th style={{ color: OWN.collateral.color }}>Holds as collateral</th></tr></thead>
            <tbody>{steps.map((s, i) => <tr key={i} className={i === si ? "cur" : ""} onClick={() => setStep(i)}><td><b>{i + 1}.</b> {s.t}</td><td>{namesOf(s, "loan")}</td><td>{namesOf(s, "sec")}</td><td>{namesOf(s, "risk")}</td><td>{namesOf(s, "msr")}</td><td>{namesOf(s, "collateral")}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="The warehouse loop: how a nonbank lender funds your loan" style={{ marginTop: 12 }} tour="warehouse">
        <div className="wh-loop">
          {[["1", "Draw", "At closing, Rocket Mortgage (the retail lender) draws on its warehouse line (the lender's credit line) from a bank such as JPMorgan Chase, Wells Fargo, Citi, Texas Capital or Customers Bank (the warehouse lenders)."], ["2", "Pledge", "The new loan is pledged to the bank as collateral. The document custodian (the note vault) holds the note for the bank under a bailee letter (a note-holding instruction)."], ["3", "Sell", "The loan is swapped into a Fannie Mae or Freddie Mac MBS, pooled into a Ginnie Mae MBS, or sold to an aggregator such as PennyMac. Fannie Mae and Freddie Mac early funding can pay sooner."], ["4", "Repay", "Sale proceeds repay the line, the bank releases its security interest (a pawn ticket), and the money is free to fund the next closing."]].map(([n, t, d]) => <div key={n} className="wh-step"><span className="xn">{n}</span><div><b>{t}</b><div className="dd">{d}</div></div></div>)}
        </div>
        <div className="metrics" style={{ marginTop: 10 }}>
          <div className="metric"><div className="k">Advance rate (bank lends)</div><div className="v num">approx. 95–98%</div><div className="d">haircut of 2–5% funded by the lender</div></div>
          <div className="metric"><div className="k">Dwell time on the line</div><div className="v num">approx. 2–4 weeks</div><div className="d">closing to sale</div></div>
          <div className="metric"><div className="k">Interest rate</div><div className="v num">SOFR + approx. 1.5–2.5%</div><div className="d">charged per day outstanding</div></div>
          <div className="metric"><div className="k">Example: $400,000 loan</div><div className="v num">approx. $1,350</div><div className="d">interest for 20 days at 97% advance, approx. 6.3% (example)</div></div>
        </div>
        <div className="p dim" style={{ marginTop: 8 }}>Related: <Term k="msrfinancing">MSR financing lines (a loan against servicing rights)</Term>, <Term k="gestation">gestation repo (financing while the bond is born)</Term> and <Term k="earlyfunding">early funding (getting paid sooner)</Term>. In 2007 banks pulled warehouse lines and many nonbank lenders, such as New Century and American Home Mortgage, failed within months.</div>
      </Panel>
      <div className="callout" style={{ marginTop: 12 }}><div className="cl">Common mix-ups</div>
        <b>The servicer doesn't own your loan.</b> It owns the right to collect (the MSR). <b>MERS doesn't own it either</b>; it keeps the records. <b>The warehouse bank doesn't own it</b>; it only holds it as collateral until the loan is sold. <b>MBS investors don't own your loan</b>; they own a share of a trust's cash. <b>CAS and STACR investors own no loans or bonds of the pool</b>, only a slice of the credit risk.
      </div>
    </>
  );

  const pages: ReactNode[] = [
    MapPage,
    OwnPage,
    <><div className="ws-head"><div><div className="crumb">Follow one payment</div><h1>Where one monthly payment goes</h1></div></div><OneDollar /></>,
    <><div className="ws-head"><div><div className="crumb">Who takes which risk</div><h1>Four risks, and who carries each</h1></div></div><RiskPage onShow={(k) => { setRisk(k); setOverlay("risk"); setPage(0); }} /></>,
    <><div className="ws-head"><div><div className="crumb">2008: then vs now</div><h1>What broke, and what changed</h1></div></div><CrisisPage onMap={() => { setCrisis(true); setPage(0); }} /></>,
    <><div className="ws-head"><div><div className="crumb">Credit checks</div><h1>Credit checks and refresh opportunities</h1></div></div><CreditPage rows={rows} a={assump} setA={setAssump} onShow={showCredit} /></>,
    <><div className="ws-head"><div><div className="crumb">Play a role</div><h1>{roleId ? ROLE[roleId].title : "Play a role in the market"}</h1></div></div><RolePage roleId={roleId} setRoleId={setRoleId} onCredit={() => setPage(5)} onMap={(id) => { setOverlay("money"); showOnMap(id); }} /></>,
    <><div className="ws-head"><div><div className="crumb">Glossary</div><h1>Every term, in plain English</h1></div></div><Panel><Glossary q={gq} setQ={setGq} /></Panel></>,
    <><div className="ws-head"><div><div className="crumb">Check yourself</div><h1>Quick quiz</h1></div></div><Quiz ans={quiz} setAns={setQuiz} /></>,
  ];

  return (
    <div className={"app" + (mtab === "player" ? " m-coach" : mtab === "glossary" ? " m-coach" : "")}>
      <header className="topbar" data-tour="topbar">
        <div className="brand"><span className="logo">$</span><span className="brand-t">MORTGAGE MONEY MAP</span></div>
        <div className="own-block" data-tour="owner" role="group" aria-label="Ownership right now">
          <span className="own-block-l">Ownership right now</span>
          {([["loan", "Loan owner", st.loan], ["sec", "Bond (MBS) owner", st.sec]] as const).map(([k, lbl, who]) => { const id = ownerNode(k); return (
            <button key={k} className={"own-chip own-chip-" + k} onClick={() => id && showOnMap(id)} disabled={!id} title={id ? `Show on map: ${who}` : `${who}: nothing to show on the map yet`} aria-label={id ? `${lbl}: ${who}. Show on map` : `${lbl}: ${who}`} data-testid={"own-chip-" + k}>
              <i className="own-dot" style={{ background: OWN[k].color }}>{OWN[k].glyph}</i>
              <span className="oc-txt"><span className="k">{lbl}</span><span className="ot">{who}</span></span>
              {id && <svg className="oc-go" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="8" cy="8" r="1.8" fill="currentColor" /><path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
            </button>); })}
        </div>
        <div className="tb-grow" />
        <span className="tb-nav"><button className="icon-btn" onClick={prev} disabled={si === 0} aria-label="Previous ownership step" title="Previous step">{"\u25c0"}</button><span className="num dim tb-stepn">{si + 1}/{steps.length}</span><button className="icon-btn" onClick={next} disabled={si === steps.length - 1} aria-label="Next ownership step" title="Next step">{"\u25b6"}</button></span>
        <button className="icon-btn tour-btn" data-tour="tourbtn" onClick={startTour} aria-label="Replay the guided tour" title="Replay the guided tour (G)">{"\u25b6"} <span className="tour-lbl">Replay tour</span></button>
        <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Switch light or dark mode" title="Light / dark">{theme === "dark" ? "\u263c" : "\u263e"}</button>
      </header>
      <div className="stage-strip" data-tour="rail" aria-label="Sections">{PAGES.map(([t], i) => <button key={t} className={"chip" + (page === i ? " on" : "")} onClick={() => { setPage(i); setMtab("main"); }}>{i + 1}. {t}</button>)}</div>
      <main className="main" id="workspace">
        {pages[page]}
        <div className="legal app-legal">{DISCLAIMER}</div>
      </main>
      <aside className="side" data-tour="side" aria-label="Player details and glossary">
        <div className="side-tabs"><button className={"tab" + ((mtab === "glossary" || (mtab !== "player" && sideTab === "glossary")) ? " on" : "")} onClick={() => { setSideTab("glossary"); setMtab((m) => (m === "main" ? m : "glossary")); }}>Glossary</button><button className={"tab" + ((mtab === "player" || (mtab !== "glossary" && sideTab === "player")) ? " on" : "")} onClick={() => { setSideTab("player"); setMtab((m) => (m === "main" ? m : "player")); }}>Player</button></div>
        <div className="side-body">
          {(mtab === "glossary" || (mtab === "main" && sideTab === "glossary")) ? <Glossary q={gq} setQ={setGq} /> : <>
            <div className="chips side-pick">{["borrower", "rocket", "warehouse", "fannie", "ginnie", "agencytrust", "servicer", "managers", "cas"].map((id) => <button key={id} className={"chip" + (sel === id ? " on" : "")} onClick={() => pick(id)}>{P[id].label}</button>)}</div>
            {sel && overlay === "credit" && hasCredit(sel) && <CreditCard id={sel} rows={rows} />}
            {sel ? <PlayerCard id={sel} own={st.own} view={view} crisis={crisis} onPlay={playRole} /> : <div className="pcard"><div className="pc-h">Pick a player</div><div className="p">Click any box on the map, or a name above, to see what that player does, how it gets paid, its incentives and risks, real examples, and every dollar in and out.</div><div className="p dim">Tip: Warehouse lenders (the lender's credit line) fund most closings before a loan is ever sold.</div></div>}
          </>}
        </div>
      </aside>
      <nav className="mtabs" aria-label="Mobile tabs">
        <button className={mtab === "main" ? "on" : ""} onClick={() => setMtab("main")}>Explore</button>
        <button className={mtab === "player" ? "on" : ""} onClick={() => setMtab("player")}>Player</button>
        <button className={mtab === "glossary" ? "on" : ""} onClick={() => setMtab("glossary")}>Glossary</button>
        <button onClick={startTour} aria-label="Replay the guided tour">{"\u25b6"} Tour</button>
      </nav>
      {lineMenu && <>
        <div className="lf-menu-back" onClick={() => setLineMenu(null)} />
        <div className="lf-menu" role="menu" data-testid="line-menu" style={{ left: Math.max(8, Math.min(lineMenu.x, window.innerWidth - 268)), top: Math.max(8, Math.min(lineMenu.y + 8, window.innerHeight - 150)) }}>
          <div className="lf-menu-t">{lineText(lineMenu.f)}</div>
          <button className="btn sm primary" onClick={() => solo(lineMenu.f)}>Show only this line</button>
          <button className="btn sm" onClick={() => hide(lineMenu.f)}>Hide this line</button>
          <button className="btn sm" onClick={() => setLineMenu(null)}>Close</button>
        </div>
      </>}
      {tc && (
        <>
          {hole ? <div className="tour-hole" style={{ left: hole.left - 4, top: hole.top - 4, width: hole.width + 8, height: hole.height + 8 }} /> : <div className="scrim" style={{ zIndex: 599 }} />}
          <div className="tour-card" role="dialog" aria-label="Tour" style={cardPos}>
            <h4>{tc.title}</h4>
            <p>{tc.body}</p>
            <div className="tf">
              <div className="dots">{TOUR.map((_, i) => <i key={i} className={i === tour ? "on" : ""} />)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn sm" onClick={endTour}>Skip tour</button>
                {tour > 0 && <button className="btn sm" onClick={() => setTour(tour - 1)}>Back</button>}
                <button className="btn sm primary" onClick={() => (tour === TOUR.length - 1 ? endTour() : setTour(tour + 1))}>{tour === TOUR.length - 1 ? "Done" : "Next"}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
