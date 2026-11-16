// "Play a role": short turn-based games. Every number is a mock, illustrative figure, not any firm's actual terms or results.
import { REFRESH, CASE, BASE_ASSUMP, calc, nodeWs, usd } from "./credit";

export type Opt = { v: string; label: string };
export type Decision = { key: string; label: string; tip: string; opts: Opt[]; def: string; lock?: boolean; once?: boolean };
export type Shock = { id: string; label: string; desc: string; credit?: boolean };
export type Status = "ok" | "warn" | "bad";
export type RiskDef = { key: string; label: string; tip: string; fmt: (v: number) => string; status: (v: number) => Status };
export type St = Record<string, number>;
export type Dec = Record<string, string>;
export type StepOut = { s: St; parts: Record<string, number>; risks: Record<string, number>; note: string };
export type Role = {
  id: string; title: string; short: string; node: string; example: string; blurb: string;
  intro: { job: string; work: string; paid: string; goal: string; tip?: string };
  quarters: number; decisions: Decision[]; shocks: Shock[]; risks: RiskDef[];
  init: () => St;
  offer?: (t: number, seed: number) => string;
  step: (s: St, d: Dec, shock: string, rng: () => number, t: number, seed: number) => StepOut;
  refreshOn: (d: Dec) => boolean; refreshText: string; refreshNode?: string; refreshCase?: string;
  benchmark: number; pro: Record<string, { v: string; why: string }>; playbook: string[]; lessons: string[];
};

// ---------- seeded randomness ----------
export function rngOf(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r: () => number) => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pick = <T,>(m: Record<string, T>, k: string): T => m[k];
const pct = (v: number) => v.toFixed(1) + "%";
const mm = (v: number) => (v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + "M";
const st3 = (v: number, okIf: (v: number) => boolean, warnIf: (v: number) => boolean): Status => (okIf(v) ? "ok" : warnIf(v) ? "warn" : "bad");

export type Scenario = "random" | "calm" | string; // or a shock id forced at quarter 3
export function schedule(role: Role, seed: number, scenario: Scenario): string[] {
  const r = rngOf(seed * 7 + 13), n = role.quarters, out: string[] = [];
  if (scenario === "calm") return Array(n).fill("calm");
  if (scenario !== "random") return Array.from({ length: n }, (_, t) => (t === 2 ? scenario : "calm"));
  for (let t = 0; t < n; t++) out.push(t > 0 && r() < 0.4 ? role.shocks[Math.floor(r() * role.shocks.length)].id : "calm");
  if (!out.some((x) => x !== "calm")) out[Math.floor(n / 2)] = role.shocks[Math.floor(r() * role.shocks.length)].id;
  return out;
}
export const shockOf = (role: Role, id: string): Shock => role.shocks.find((s) => s.id === id) ?? { id: "calm", label: "Calm quarter", desc: "No big surprises: rates and credit drift a little." };

export type Turn = { t: number; shock: string; d: Dec; parts: Record<string, number>; pnl: number; cum: number; risks: Record<string, number>; note: string };
export type Game = { role: string; seed: number; scenario: Scenario; sched: string[]; s: St; d: Dec; hist: Turn[] };
export function newGame(role: Role, seed: number, scenario: Scenario): Game {
  return { role: role.id, seed, scenario, sched: schedule(role, seed, scenario), s: role.init(), d: Object.fromEntries(role.decisions.map((x) => [x.key, x.def])), hist: [] };
}
export function playTurn(role: Role, g: Game): Game {
  const t = g.hist.length; if (t >= role.quarters) return g;
  const rng = rngOf(g.seed * 1000 + t * 97 + 1);
  const out = role.step({ ...g.s }, g.d, g.sched[t], rng, t, g.seed);
  const pnl = Object.values(out.parts).reduce((a, b) => a + b, 0);
  const cum = (g.hist[t - 1]?.cum ?? 0) + pnl;
  const turn: Turn = { t, shock: g.sched[t], d: { ...g.d }, parts: out.parts, pnl, cum, risks: out.risks, note: out.note };
  const d = { ...g.d }; role.decisions.forEach((x) => { if (x.once) d[x.key] = x.def; });
  return { ...g, s: out.s, d, hist: [...g.hist, turn] };
}
export function scorecard(role: Role, g: Game) {
  const total = g.hist[g.hist.length - 1]?.cum ?? 0;
  let bad = 0, warn = 0;
  g.hist.forEach((h) => role.risks.forEach((r) => { const s = r.status(h.risks[r.key]); if (s === "bad") bad++; else if (s === "warn") warn++; }));
  const perf = clamp(Math.round(70 * (total / role.benchmark)), -20, 85);
  const risk = Math.max(0, 15 - 5 * bad - 2 * warn);
  const score = clamp(perf + risk, 0, 100);
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
  const mostUsed = (k: string) => { const c: Record<string, number> = {}; g.hist.forEach((h) => { c[h.d[k]] = (c[h.d[k]] ?? 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
  const compare = role.decisions.filter((x) => role.pro[x.key]).map((x) => { const you = mostUsed(x.key) ?? x.def, pro = role.pro[x.key]; const lab = (v: string) => x.opts.find((o) => o.v === v)?.label ?? v; return { label: x.label, you: lab(you), pro: lab(pro.v), same: you === pro.v, why: pro.why }; });
  return { total, bad, warn, score, grade, compare };
}
export function refreshFacts(role: Role) {
  const rows = calc(BASE_ASSUMP);
  if (role.refreshNode && REFRESH[role.refreshNode]) return { kind: "node" as const, ws: nodeWs(rows, role.refreshNode), n: REFRESH[role.refreshNode] };
  if (role.refreshCase) { const r = rows.find((x) => x.c.id === role.refreshCase); return { kind: "case" as const, tam: r?.tam ?? 0, c: CASE[role.refreshCase] }; }
  return null;
}
export { usd };

const REFRESH_TIP = "Credit refresh (a fresh look at an old loan's borrower): a soft pull or depersonalized data on loans you already have, so you see trouble early.";

// ---------- 1. Servicer ----------
const servicer: Role = {
  id: "servicer", title: "You are the servicer", short: "Servicer", node: "servicer", example: "Mr. Cooper or Rocket Mortgage (the servicers)",
  blurb: "Collect payments on $50B of loans, keep borrowers when they refinance, and protect the value of your servicing rights.",
  intro: {
    job: "You collect monthly payments on a mock $50B book of mortgages for the owners (mostly Fannie Mae and Freddie Mac MBS trusts, the walled-off boxes). You send principal and interest on, pay taxes and insurance from escrow (the borrower's held money), and work with borrowers who fall behind.",
    work: "Fannie Mae and Freddie Mac (the agency guarantors) set the rules; Equifax, Experian and TransUnion (the credit bureaus) sell you refreshes; a bank lends against your advances; dealers sell you hedges.",
    paid: "A servicing fee strip (the collector's cut) of 0.25% a year on the loans' balance, plus float on escrow. Your mortgage servicing right, MSR (the right to collect the fee), is an asset that rises when rates rise and falls when rates fall, because borrowers refinance away.",
    goal: "Make money over 8 quarters without running out of cash (liquidity) and without letting a rate drop wipe out your MSR value.",
    tip: "Hedging protects you if rates fall: falling rates set off refinances that shrink your servicing value. The game starts you with a half hedge; switch it off to feel the full risk.",
  },
  quarters: 8,
  decisions: [
    { key: "refresh", label: "Credit refresh frequency (how often you re-check borrowers' credit)", tip: REFRESH_TIP + " Costs cents per loan; cuts delinquency costs and helps target refinance offers.", opts: [{ v: "none", label: "None" }, { v: "annual", label: "Annual" }, { v: "quarterly", label: "Quarterly" }, { v: "monthly", label: "Monthly" }], def: "annual" },
    { key: "outreach", label: "Recapture outreach (calling your own borrowers before a rival refinances them)", tip: "When borrowers refinance, the loan and your fee leave. Recapture means you make the new loan yourself and keep the customer.", opts: [{ v: "off", label: "Off" }, { v: "standard", label: "Standard" }, { v: "aggressive", label: "Aggressive" }], def: "standard" },
    { key: "advance", label: "Funding advances (paying investors when borrowers don't)", tip: "Servicing advances: you must pay bondholders and tax bills even when a borrower misses a payment. Fund from your own cash, or borrow on an advance financing line (a bank loan against advances) at approx. SOFR + 2.5% (mock).", opts: [{ v: "cash", label: "Own cash" }, { v: "line", label: "Advance line" }], def: "cash" },
    { key: "msr", label: "MSR sale (sell part of your servicing rights)", tip: "Sell 25% of your MSR this quarter to an MSR investor such as Rithm Capital (the MSR investor) at a small discount. Raises cash, shrinks future fees.", opts: [{ v: "keep", label: "Keep" }, { v: "sell25", label: "Sell 25% now" }], def: "keep", once: true },
    { key: "hedge", label: "MSR hedge (insurance against falling rates)", tip: "Buy interest-rate hedges (TBA or swaps) that gain when rates fall, offsetting the MSR's loss. Costs carry each quarter.", opts: [{ v: "none", label: "None" }, { v: "half", label: "Half" }, { v: "full", label: "Full" }], def: "half" },
  ],
  shocks: [
    { id: "ratedrop", label: "Rates drop 1% (prepayment wave)", desc: "Mortgage rates fall about 1 percentage point. Borrowers rush to refinance: your loans pay off and your MSR loses value." },
    { id: "ratespike", label: "Rates spike 1%", desc: "Rates jump about 1 point. Refinancing stops, so your MSR is worth more, but hedges lose." },
    { id: "dq", label: "Delinquency rise", desc: "More borrowers fall 30+ days behind. Costs and advances rise.", credit: true },
    { id: "forbear", label: "Forbearance event (payment pauses)", desc: "A disaster or crisis lets many borrowers pause payments. You must advance their payments to investors.", credit: true },
  ],
  risks: [
    { key: "liq", label: "Liquidity cushion (spare cash)", tip: "Cash you can use for advances. Below $100M (mock) you're in trouble.", fmt: mm, status: (v) => st3(v, (x) => x >= 200, (x) => x >= 100) },
    { key: "dq", label: "Delinquency rate (loans 30+ days late)", tip: "Share of your loans behind on payments.", fmt: pct, status: (v) => st3(v, (x) => x < 4, (x) => x < 6) },
    { key: "rate", label: "Loss if rates fall 1% (unhedged MSR)", tip: "Approx. MSR value you'd lose in a 1-point rate drop, after hedges.", fmt: mm, status: (v) => st3(v, (x) => x < 60, (x) => x < 110) },
  ],
  init: () => ({ upb: 50000, r: 6.5, dq: 3, liq: 300, adv: 22.5, sold: 0, forb: 0 }),
  step: (s, d, shock, rng) => {
    const dr = shock === "ratedrop" ? -1 : shock === "ratespike" ? 1 : (rng() - 0.5) * 0.3;
    const multOld = clamp(4.5 + (s.r - 6.5) * 0.9, 2.5, 6); s.r += dr; const mult = clamp(4.5 + (s.r - 6.5) * 0.9, 2.5, 6);
    const own = 1 - s.sold;
    const cpr = clamp(0.08 + Math.max(0, 6.5 - s.r) * 0.12, 0.04, 0.45), runoff = s.upb * cpr / 4;
    const recapRate = pick({ off: 0.08, standard: 0.22, aggressive: 0.32 }, d.outreach) + pick({ none: 0, annual: 0.01, quarterly: 0.03, monthly: 0.05 }, d.refresh);
    const recap = runoff * recapRate; const upbPrev = s.upb; s.upb = s.upb - runoff + recap;
    if (shock === "dq") s.dq += 2; else if (shock === "forbear") { s.dq += 3; s.forb = 2; } else s.dq = Math.max(2.5, s.dq - 0.5);
    const rf = pick({ none: 1, annual: 0.92, quarterly: 0.82, monthly: 0.75 }, d.refresh);
    const advNew = s.upb * s.dq / 100 * 0.015 * (s.forb > 0 ? 2 : 1); const dAdv = advNew - s.adv; s.adv = advNew; if (s.forb > 0) s.forb--;
    let advCost = 0;
    if (d.advance === "cash") { s.liq -= dAdv; advCost = -s.adv * 0.04 / 4; } else { s.liq -= dAdv * 0.15; advCost = -s.adv * 0.075 / 4; }
    const h = pick({ none: 0, half: 0.5, full: 0.9 }, d.hedge);
    const mtm = upbPrev * 0.0025 * own * (mult - multOld);
    const parts: Record<string, number> = {
      "Servicing fees": s.upb * 0.0025 / 4 * own, "Recapture gains": recap * 0.008, "Escrow float": s.upb * 0.004 * (s.r / 100) / 4 * own,
      "Servicing costs": -s.upb * 0.0007 / 4 * own, "Delinquency costs": -s.upb * s.dq / 100 * 0.0012 * rf * own,
      "Outreach + data": -(pick({ off: 0, standard: 0.6, aggressive: 1.8 }, d.outreach) + pick({ none: 0, annual: 0.03, quarterly: 0.1, monthly: 0.3 }, d.refresh)),
      "Advance funding": advCost, "MSR mark (rates)": mtm, "MSR runoff": -(runoff - recap) * 0.0025 * mult * own,
      "Hedge": -mtm * h * 0.9 - pick({ none: 0, half: 0.4, full: 0.8 }, d.hedge),
    };
    let note = `Prepayments ran at approx. ${Math.round(cpr * 100)}% a year; you recaptured ${Math.round(recapRate * 100)}% of payoffs.`;
    if (d.msr === "sell25") { const val = s.upb * 0.0025 * mult * (1 - s.sold) * 0.25; parts["MSR sale discount"] = -val * 0.03; s.liq += val * 0.97; s.sold += (1 - s.sold) * 0.25; note += ` You sold 25% of your MSR for approx. ${mm(val * 0.97)}.`; }
    const cashPnl = parts["Servicing fees"] + parts["Recapture gains"] + parts["Escrow float"] + parts["Servicing costs"] + parts["Delinquency costs"] + parts["Outreach + data"] + advCost;
    s.liq += cashPnl * 0.3;
    const msrVal = s.upb * 0.0025 * mult * (1 - s.sold);
    return { s, parts, note, risks: { liq: s.liq, dq: s.dq, rate: msrVal * 0.2 * (1 - h) } };
  },
  refreshOn: (d) => d.refresh === "quarterly" || d.refresh === "monthly", refreshNode: "servicer",
  refreshText: "Refreshing borrowers' credit shows who is sliding before they miss a mortgage payment (early-warning) and who is likely to refinance (recapture). Here, quarterly or monthly refreshes cut delinquency costs and lift recapture.",
  benchmark: 107,
  pro: { refresh: { v: "quarterly", why: "Refreshes cost cents per loan and pay back through lower delinquency costs and better recapture." }, outreach: { v: "standard", why: "Recapture keeps the customer when rates fall; aggressive outreach costs more than it adds in calm markets." }, advance: { v: "line", why: "Financing advances keeps your cash cushion intact in a forbearance wave." }, hedge: { v: "half", why: "A partial hedge softens a rate-drop hit without giving up all the upside if rates rise." } },
  playbook: ["Hedge part of the MSR before rates can fall; recapture is a natural hedge too.", "Use an advance line rather than your own cash when delinquencies or forbearance spike.", "Refresh credit at least quarterly so loss-mitigation teams reach borrowers early."],
  lessons: ["An MSR is a bet that borrowers won't refinance: falling rates hurt, rising rates help.", "Advances are a liquidity risk, not a credit loss: you get the money back, but later.", "Cash, not profit, is what sinks servicers in a crisis."],
};

// ---------- 2. Private mortgage insurer ----------
const pmi: Role = {
  id: "pmi", title: "You are a mortgage insurer", short: "Mortgage insurer", node: "mi", example: "MGIC, Radian, Essent or Arch MI (the private mortgage insurers)",
  blurb: "Price and underwrite insurance on low-down-payment loans, buy reinsurance, and keep enough capital when home prices fall.",
  intro: {
    job: "When a borrower puts down less than 20%, Fannie Mae and Freddie Mac require private mortgage insurance, PMI (deductible cover). You pay a share of the loss (about 25% of the loan here, mock) if the borrower defaults and the house sells for less.",
    work: "Lenders such as Rocket Mortgage (the retail lender) choose you on price; Fannie Mae and Freddie Mac (the agency guarantors) set your capital rule, PMIERs (the insurers' capital test); reinsurers and bond investors take part of your risk.",
    paid: "Monthly premiums from borrowers, set by a grid of credit score (FICO) and loan-to-value, LTV (loan size vs home value).",
    goal: "Earn premiums over 8 quarters while keeping PMIERs sufficiency (capital vs required) above 100%, even if home prices fall.",
    tip: "Reinsurance protects you if home prices fall. The game starts you with insurance-linked notes (bond investors take big losses above a level); drop it to keep more premium and more risk.",
  },
  quarters: 8,
  decisions: [
    { key: "price", label: "Premium grid (price per FICO/LTV cell)", tip: "Cheap wins more lenders' business but attracts riskier loans; rich wins less but each policy pays more.", opts: [{ v: "cheap", label: "Cheap" }, { v: "market", label: "Market" }, { v: "rich", label: "Rich" }], def: "market" },
    { key: "fico", label: "Minimum credit score, FICO (underwriting cutoff)", tip: "Loans below this score are declined. Higher cutoffs mean fewer, safer loans.", opts: [{ v: "620", label: "620" }, { v: "680", label: "680" }, { v: "720", label: "720" }], def: "680" },
    { key: "ltv", label: "Maximum loan-to-value, LTV (smallest down payment you'll insure)", tip: "97% LTV = 3% down. Lower maximums mean bigger cushions when prices fall.", opts: [{ v: "97", label: "97%" }, { v: "95", label: "95%" }, { v: "90", label: "90%" }], def: "95" },
    { key: "reins", label: "Reinsurance (insurance for the insurer)", tip: "Quota share: give a reinsurer 25% of premiums and losses. Insurance-linked notes, ILN (bonds that absorb losses above a level): pay a premium, bond investors cover big losses. Both lower the capital PMIERs requires.", opts: [{ v: "none", label: "None" }, { v: "qs", label: "Quota share 25%" }, { v: "iln", label: "ILN (excess loss)" }], def: "iln" },
    { key: "refresh", label: "Credit refresh monitoring on the insured book", tip: REFRESH_TIP + " Better reserving and earlier loss mitigation on loans going bad.", opts: [{ v: "none", label: "None" }, { v: "annual", label: "Annual" }, { v: "quarterly", label: "Quarterly" }], def: "annual" },
  ],
  shocks: [
    { id: "hpa", label: "Home prices drop 8%", desc: "Home prices fall about 8% this quarter. Borrowers with small down payments owe more than the home is worth; claims rise.", credit: true },
    { id: "unemp", label: "Unemployment spike", desc: "Job losses jump. Defaults and claims rise for two quarters.", credit: true },
  ],
  risks: [
    { key: "pmiers", label: "PMIERs sufficiency (capital vs required)", tip: "Available assets divided by what the agencies require. Under 100% you can't write new business.", fmt: (v) => Math.round(v) + "%", status: (v) => st3(v, (x) => x >= 130, (x) => x >= 105) },
    { key: "lr", label: "Loss ratio (claims vs premiums)", tip: "Claims paid as a share of premiums earned this quarter.", fmt: (v) => Math.round(v) + "%", status: (v) => st3(v, (x) => x < 40, (x) => x < 75) },
    { key: "hpa", label: "Home prices since start", tip: "Cumulative home price change (mock).", fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%", status: (v) => st3(v, (x) => x > -3, (x) => x > -8) },
  ],
  init: () => ({ ins: 40000, prem: 0.005, hpa: 0, unemp: 0, cap: 1100, quality: 1 }),
  step: (s, d, shock, rng, t) => {
    if (shock === "hpa") s.hpa -= 8; else s.hpa += 0.8 + (rng() - 0.5);
    if (shock === "unemp") s.unemp = 2;
    const niw = pick({ cheap: 6000, market: 4000, rich: 2000 }, d.price) * pick({ "620": 1, "680": 0.8, "720": 0.55 }, d.fico) * pick({ "97": 1, "95": 0.85, "90": 0.6 }, d.ltv);
    const newPrem = pick({ cheap: 0.0038, market: 0.005, rich: 0.0064 }, d.price);
    const newQ = pick({ "620": 1.3, "680": 1, "720": 0.7 }, d.fico) * pick({ "97": 1.2, "95": 1, "90": 0.75 }, d.ltv) * pick({ cheap: 1.15, market: 1, rich: 0.9 }, d.price);
    const kept = s.ins * 0.97; s.prem = (kept * s.prem + niw * newPrem) / (kept + niw); s.quality = (kept * s.quality + niw * newQ) / (kept + niw); s.ins = kept + niw;
    const econ = (1 + Math.max(0, -s.hpa) * 0.12) * (s.unemp > 0 ? 2.5 : 1); if (s.unemp > 0) s.unemp--;
    const rf = pick({ none: 1, annual: 0.95, quarterly: 0.88 }, d.refresh);
    const prem = s.ins * s.prem / 4, loss = s.ins * 0.0004 * s.quality * econ * rf;
    let reins = 0;
    if (d.reins === "qs") reins = -0.25 * prem * 0.8 + 0.25 * loss; else if (d.reins === "iln") reins = -0.07 * prem + 0.8 * Math.max(0, loss - s.ins * 0.0008);
    const parts = { "Premiums": prem, "Claims": -loss, "Expenses": -(12 + niw * 0.0004), "Reinsurance (net)": reins, "Monitoring data": -pick({ none: 0, annual: 0.2, quarterly: 0.6 }, d.refresh) };
    const pnl = Object.values(parts).reduce((a, b) => a + b, 0);
    s.cap += pnl * 0.6;
    const req = s.ins * 0.25 * 0.065 * (1 + Math.max(0, -s.hpa) * 0.04) * (d.reins === "qs" ? 0.78 : d.reins === "iln" ? 0.82 : 1);
    return { s, parts, risks: { pmiers: (s.cap / req) * 100, lr: (loss / prem) * 100, hpa: s.hpa }, note: `You wrote approx. ${mm(niw)} of new insured loans in quarter ${t + 1}; the book is now ${mm(s.ins)}.` };
  },
  refreshOn: (d) => d.refresh === "quarterly", refreshNode: "mi",
  refreshText: "Refreshed credit on insured loans shows which borrowers are weakening, so you reserve earlier, price reinsurance better and start loss mitigation sooner. Here, quarterly refreshes trim claims and give an early warning before credit shocks.",
  benchmark: 173,
  pro: { price: { v: "market", why: "Cheap pricing buys volume with worse loans; rich pricing loses lenders' business." }, fico: { v: "680", why: "A middle cutoff keeps volume while avoiding the riskiest borrowers." }, ltv: { v: "95", why: "Very thin down payments are hit hardest when home prices fall." }, reins: { v: "iln", why: "Insurance-linked notes cap tail losses and cut required capital; most large MIs use them alongside quota share." }, refresh: { v: "quarterly", why: "Fresh credit data on the insured book is cheap and improves reserving." } },
  playbook: ["Buy reinsurance before a downturn, not during it.", "Hold underwriting at market standards; don't buy share with cheap prices.", "Refresh the insured book quarterly to reserve early."],
  lessons: ["Mortgage insurers lose when home prices fall, because thin down payments vanish.", "Capital rules (PMIERs) decide whether you can keep writing business.", "Reinsurance rents someone else's capital so you can survive the bad years."],
};

// ---------- 3. CRT investor ----------
const TR: Record<string, { a: number; d: number; spread: number; stress: number }> = { M1: { a: 2.5, d: 4, spread: 1.5, stress: 1.5 }, M2: { a: 1, d: 2.5, spread: 2.75, stress: 4 }, B1: { a: 0.5, d: 1, spread: 6, stress: 9 }, B2: { a: 0, d: 0.5, spread: 10, stress: 15 } };
const crt: Role = {
  id: "crt", title: "You are a credit risk transfer investor", short: "CRT investor", node: "cas", example: "a fund buying CAS or STACR notes issued by Fannie Mae or Freddie Mac (the agency guarantors)",
  blurb: "Pick a tranche of a CAS or STACR deal, choose your price, and decide whether to pay for refreshed credit data on the reference pool.",
  intro: {
    job: "Fannie Mae and Freddie Mac sell Connecticut Avenue Securities, CAS, and Structured Agency Credit Risk notes, STACR (credit risk bonds). You invest a mock $100M. Your bond pays a coupon, but its principal is written down if losses on a reference pool (a list of loans, not the loans themselves) reach your tranche (your floor in the building).",
    work: "Fannie Mae or Freddie Mac (the issuers) and dealers such as JPMorgan (the market maker) sell the notes; Equifax (the credit bureau) supplies refreshed credit scores on CAS reference pools.",
    paid: "A coupon of SOFR plus a spread. Junior tranches (B-2, B-1) pay much more but take the first losses; mezzanine (M-2) and senior-ish (M-1) pay less and are safer.",
    goal: "Collect coupons over 6 quarters without big writedowns. Use the data to trim before stress if you can see it coming.",
    tip: "Start in M-1, the safest tranche. Lower tranches pay more spread but lose principal first when home prices fall. Refreshed scores are on, so you can trim before losses arrive.",
  },
  quarters: 6,
  decisions: [
    { key: "tranche", label: "Tranche (which floor of losses you take)", tip: "Attachment and detachment points (where your losses start and end) as % of the pool, mock: B-2 0–0.5%, B-1 0.5–1%, M-2 1–2.5%, M-1 2.5–4%.", opts: [{ v: "M1", label: "M-1 (safest)" }, { v: "M2", label: "M-2" }, { v: "B1", label: "B-1" }, { v: "B2", label: "B-2 (first loss)" }], def: "M1", lock: true },
    { key: "bid", label: "Your bid (price vs the deal's spread)", tip: "Tight: accept a lower spread to get your full order. Wide: demand more spread but get only part of the bonds.", opts: [{ v: "tight", label: "Tight (full order)" }, { v: "market", label: "At market" }, { v: "wide", label: "Wide (partial fill)" }], def: "market", lock: true },
    { key: "data", label: "Refreshed FICO data on the reference pool", tip: REFRESH_TIP + " Fannie Mae has published monthly refreshed scores on CAS deals since 2016 (sourced). Here it costs a little and warns you a quarter before stress shows up.", opts: [{ v: "off", label: "Don't use" }, { v: "on", label: "Use it" }], def: "on" },
    { key: "act", label: "Position this quarter", tip: "Trim or sell at today's price (costs 0.25 points bid-ask, mock), or add 50% more.", opts: [{ v: "hold", label: "Hold" }, { v: "trim", label: "Trim 50%" }, { v: "sell", label: "Sell all" }, { v: "add", label: "Add 50%" }], def: "hold", once: true },
  ],
  shocks: [
    { id: "hpa10", label: "Home prices fall 10%", desc: "A housing slump: pool losses rise for three quarters.", credit: true },
    { id: "hpa20", label: "Severe stress: home prices fall 20%", desc: "A 2008-style drop: heavy pool losses for three quarters.", credit: true },
    { id: "riskoff", label: "Risk-off spread widening", desc: "Investors flee risky bonds. Prices drop without any new losses, then partly recover." },
  ],
  risks: [
    { key: "pos", label: "Position size (face value)", tip: "How much of the tranche you hold.", fmt: mm, status: () => "ok" },
    { key: "pf", label: "Projected tranche loss", tip: "Share of your tranche expected to be written down, given losses so far and known stress.", fmt: pct, status: (v) => st3(v, (x) => x < 10, (x) => x < 40) },
    { key: "px", label: "Bond price (per 100 face)", tip: "Market price. Below par means investors expect losses or demand more spread.", fmt: (v) => v.toFixed(1), status: (v) => st3(v, (x) => x >= 97, (x) => x >= 90) },
  ],
  init: () => ({ pos: 0, px: 100, cum: 0, stressN: 0, stressL: 0, temp: 0, started: 0, spr: 0 }),
  step: (s, d, shock) => {
    const tr = TR[d.tranche]; const parts: Record<string, number> = {};
    if (!s.started) { s.pos = 100 * pick({ tight: 1, market: 0.8, wide: 0.4 }, d.bid); s.spr = tr.spread + pick({ tight: -0.25, market: 0, wide: 0.5 }, d.bid); s.started = 1; }
    if (shock === "hpa10") { s.stressN = 3; s.stressL = 0.25; } else if (shock === "hpa20") { s.stressN = 3; s.stressL = 0.6; }
    if (shock === "riskoff") s.temp += tr.stress; else s.temp *= 0.5;
    const ql = s.stressN > 0 ? s.stressL : 0.03; if (s.stressN > 0) s.stressN--;
    const frac = (c: number) => clamp((c - tr.a) / (tr.d - tr.a), 0, 1);
    const f0 = frac(s.cum); s.cum += ql; const f1 = frac(s.cum);
    const wd = f1 > f0 ? s.pos * (f1 - f0) / (1 - f0) : 0;
    parts["Coupon"] = s.pos * (4.5 + s.spr) / 100 / 4;
    const pxOld = s.px; s.pos -= wd; parts["Writedowns"] = -wd * pxOld / 100;
    const pf = frac(s.cum + s.stressN * s.stressL);
    s.px = clamp(100 * (1 - (pf - f1) / Math.max(1e-6, 1 - f1) * 0.9) - s.temp - (shock === "hpa10" || shock === "hpa20" ? tr.stress * 0.5 : 0), 5, 101);
    parts["Mark-to-market"] = s.pos * (s.px - pxOld) / 100;
    let note = `The pool lost ${ql.toFixed(2)}% this quarter (${s.cum.toFixed(2)}% so far); your tranche starts losing at ${tr.a}%.`;
    const cost = (q: number) => q * 0.25 / 100;
    if (d.act === "trim") { parts["Trading costs"] = -cost(s.pos / 2); s.pos /= 2; note += " You sold half."; }
    else if (d.act === "sell") { parts["Trading costs"] = -cost(s.pos); s.pos = 0; note += " You sold everything."; }
    else if (d.act === "add") { parts["Trading costs"] = -cost(s.pos / 2); s.pos *= 1.5; note += " You added 50%."; }
    parts["Data cost"] = d.data === "on" ? -0.05 : 0;
    return { s, parts, note, risks: { pos: s.pos, pf: pf * 100, px: s.px } };
  },
  refreshOn: (d) => d.data === "on", refreshNode: "cas",
  refreshText: "Monthly refreshed scores on the reference pool show stress building in weak loans before payments are missed. Fannie Mae has published them for all CAS deals since 2016 (sourced); refreshed credit is still rare in private-label deals.",
  benchmark: 8,
  pro: { tranche: { v: "M2", why: "Mezzanine pays a solid spread with a real cushion of junior bonds below it." }, bid: { v: "market", why: "Bidding at market gets most of your order at a fair spread." }, data: { v: "on", why: "Refreshed scores cost little and let you trim before losses reach your tranche." } },
  playbook: ["Pick a tranche whose attachment sits above plausible stress losses.", "Use refreshed pool credit to trim before stress, not after prices drop.", "Ride out pure spread widening if losses don't reach your tranche."],
  lessons: ["CRT investors own risk, not loans: the coupon is pay for absorbing defaults.", "Junior tranches can be wiped out by a modest loss; senior ones barely notice it.", "Price drops from fear (spread widening) can reverse; writedowns don't."],
};

// ---------- 4. Whole loan trader ----------
const TAPES: Record<string, { name: string; px: number; sig: number; dur: number; carry: number }> = {
  jumbo: { name: "jumbo loans (too big for Fannie)", px: 99, sig: 0.8, dur: 5, carry: 1.2 },
  nonqm: { name: "non-QM loans (outside the standard rulebook)", px: 97, sig: 2, dur: 4, carry: 2.5 },
  rpl: { name: "re-performing loans, RPL (once late, now paying)", px: 88, sig: 3, dur: 3, carry: 4 },
  npl: { name: "non-performing loans, NPL (not paying)", px: 62, sig: 5, dur: 2, carry: 6 },
};
const tapeOf = (t: number, seed: number) => { const r = rngOf(seed * 31 + t * 7 + 5); const k = ["jumbo", "nonqm", "rpl", "npl"][Math.floor(r() * 4)]; return { k, q: normal(r) * TAPES[k].sig, ...TAPES[k] }; };
const wholeloan: Role = {
  id: "wholeloan", title: "You are a whole loan trader", short: "Whole loan trader", node: "dealers", example: "a trader at a dealer such as Goldman Sachs (the market maker) or at a fund",
  blurb: "Bid on loan tapes (spreadsheets of loans for sale), decide how much diligence to buy, then hold, flip or securitize.",
  intro: {
    job: "Banks and lenders sell pools of whole loans (the actual mortgages, not bonds). Each quarter a mock $150M loan tape (a spreadsheet of every loan) is offered. You bid a price in points (per 100 of balance), check the loans, and decide what to do with what you own.",
    work: "Sellers such as Wells Fargo (the bank lender); third-party review, TPR firms such as Clayton (the deal's independent inspector); Equifax or TransUnion (the credit bureaus) for a credit refresh on the tape; sponsors such as Redwood Trust (the private-label sponsor) if you securitize.",
    paid: "Buy below what the loans are worth, earn carry (interest income minus funding cost) while you hold, and sell or securitize at a profit.",
    goal: "Make money over 5 quarters without getting stuck with a big, aging inventory when rates move.",
    tip: "Check before you buy: the credit refresh is on by default, so diligence can catch weak tapes and you can walk away instead of overpaying (the winner's curse).",
  },
  quarters: 5,
  decisions: [
    { key: "bid", label: "Your bid (points vs the model price)", tip: "Low bids rarely win; aggressive bids win often but risk the winner's curse (you won because you overpaid).", opts: [{ v: "pass", label: "Pass" }, { v: "low", label: "Low (−2)" }, { v: "market", label: "Market (−0.5)" }, { v: "aggr", label: "Aggressive (+0.5)" }], def: "market" },
    { key: "dil", label: "Due diligence sample (share of loan files re-checked)", tip: "Third-party review (the deal's independent inspector) checks files for errors and fraud. Bigger samples cost more but catch more problems.", opts: [{ v: "10", label: "10%" }, { v: "25", label: "25%" }, { v: "100", label: "100%" }], def: "25" },
    { key: "refresh", label: "Credit refresh on the tape", tip: REFRESH_TIP + " Updates every borrower's score before you bid, so you see who has weakened since the loan was made.", opts: [{ v: "no", label: "No" }, { v: "yes", label: "Yes" }], def: "yes" },
    { key: "exit", label: "Inventory plan this quarter", tip: "Hold for carry, flip (sell everything, 0.5 points cost, mock), or securitize (package into bonds; needs approx. $300M of loans, nets approx. +1 point, mock).", opts: [{ v: "hold", label: "Hold" }, { v: "flip", label: "Flip" }, { v: "sec", label: "Securitize" }], def: "hold", once: true },
  ],
  shocks: [
    { id: "rateup", label: "Rates rise 0.75% while you hold", desc: "Rates jump; fixed-rate loans you own lose value (more for longer loans)." },
    { id: "ratedn", label: "Rates fall 0.75%", desc: "Rates fall; your inventory gains value." },
    { id: "findings", label: "Diligence findings on your latest purchase", desc: "Loan files turn out to have missing documents and misstated income. Unless you checked every file, you eat a 3-point hit.", credit: true },
    { id: "widen", label: "Spreads widen", desc: "Buyers demand more yield on all loans; every loan you own drops about 2 points." },
  ],
  risks: [
    { key: "inv", label: "Inventory (loans you own)", tip: "Face value of loans on your books (mock limit about $500M).", fmt: mm, status: (v) => st3(v, (x) => x < 350, (x) => x < 500) },
    { key: "dv01", label: "Rate risk, DV01 (loss per 0.01% rate rise)", tip: "Thousands of dollars lost for each one-basis-point rise in rates.", fmt: (v) => "$" + Math.round(v) + "K", status: (v) => st3(v, (x) => x < 150, (x) => x < 250) },
    { key: "age", label: "Inventory age (quarters)", tip: "How long your oldest loans have been sitting.", fmt: (v) => v.toFixed(0), status: (v) => st3(v, (x) => x <= 2, (x) => x <= 3) },
  ],
  init: () => ({ inv: 0, dur: 0, carry: 0, age: 0, last: 0, lastDil: 0 }),
  offer: (t, seed) => { const tp = tapeOf(t, seed); return `This quarter's tape: approx. $150M of ${tp.name}. Model price approx. ${tp.px} (mock).`; },
  step: (s, d, shock, rng, t, seed) => {
    const tp = tapeOf(t, seed); const parts: Record<string, number> = {}; let note = "";
    const dr = shock === "rateup" ? 0.75 : shock === "ratedn" ? -0.75 : (rng() - 0.5) * 0.3;
    // carry and marks on what you already own
    parts["Carry"] = s.inv * s.carry / 100 / 4;
    parts["Rate moves"] = -s.inv * s.dur * dr / 100;
    if (shock === "widen") parts["Spread widening"] = -s.inv * 0.02;
    if (shock === "findings" && s.last > 0) { if (s.lastDil === 100) note += "Findings: your 100% review had already caught the bad files and you'd cut the price. "; else { parts["Diligence findings"] = -s.last * 0.03; note += "Findings: missing documents on your latest purchase cost 3 points. "; } }
    if (s.inv > 0) s.age++;
    // this quarter's tape
    const adj = pick({ pass: 0, low: -2, market: -0.5, aggr: 0.5 }, d.bid), win = pick({ pass: 0, low: 0.2, market: 0.55, aggr: 0.85 }, d.bid);
    const dil = Number(d.dil); s.last = 0;
    if (d.bid !== "pass") {
      parts["Diligence + data"] = -(pick({ "10": 0.05, "25": 0.12, "100": 0.4 }, d.dil) + (d.refresh === "yes" ? 0.03 : 0));
      if (rng() < win) {
        const se = tp.sig * Math.max(0.15, 1 - pick({ "10": 0.1, "25": 0.35, "100": 0.6 }, d.dil) - (d.refresh === "yes" ? 0.25 : 0));
        const est = tp.q + normal(rng) * se;
        if (est < -tp.sig * 0.8) note += `You won, but diligence${d.refresh === "yes" ? " and the credit refresh" : ""} flagged weak loans (estimated ${est.toFixed(1)} points), so you walked away. `;
        else {
          parts["Day-one gain or loss"] = 150 * (tp.q - adj) / 100;
          const tot = s.inv + 150; s.dur = (s.inv * s.dur + 150 * tp.dur) / tot; s.carry = (s.inv * s.carry + 150 * tp.carry) / tot; s.inv = tot; s.last = 150; s.lastDil = dil; if (s.age === 0) s.age = 0;
          note += `You won the tape at approx. ${(tp.px + adj).toFixed(1)}; the loans proved worth approx. ${(tp.px + tp.q).toFixed(1)}. `;
        }
      } else note += "Another buyer outbid you. ";
    } else note += "You passed on the tape. ";
    if (d.exit === "flip" && s.inv > 0) { parts["Sale costs"] = -s.inv * 0.005; note += `You sold ${mm(s.inv)} of loans.`; s.inv = 0; s.age = 0; }
    else if (d.exit === "sec") { if (s.inv >= 300) { parts["Securitization gain"] = s.inv * 0.01; note += `You securitized ${mm(s.inv)} of loans into bonds.`; s.inv = 0; s.age = 0; } else note += "You need approx. $300M to securitize, so you held."; }
    if (s.inv === 0) { s.dur = 0; s.carry = 0; }
    return { s, parts, note: note.trim(), risks: { inv: s.inv, dv01: s.inv * s.dur * 0.0001 * 1000, age: s.age } };
  },
  refreshOn: (d) => d.refresh === "yes", refreshNode: "creditinv",
  refreshText: "A batch credit refresh on the tape shows which borrowers have weakened since the loan was made, so you avoid the winner's curse. Today most bids are priced off the original tape (estimate).",
  benchmark: 2.5,
  pro: { bid: { v: "market", why: "Bid near fair value; aggressive bids win the tapes you should have lost." }, dil: { v: "25", why: "A 25% sample catches most problems at a reasonable cost; go to 100% on RPL and NPL tapes." }, refresh: { v: "yes", why: "A refresh costs little and reveals weakened borrowers before you pay." } },
  playbook: ["Bid near fair value and let the bad tapes go.", "Pay for credit refresh and deeper diligence on riskier tapes.", "Don't let inventory age; securitize once you reach size, or flip into strength."],
  lessons: ["The winner's curse: if you always win, you're probably overpaying.", "Inventory carries rate risk every day you hold it.", "Diligence is cheap insurance against documentation surprises."],
};

// ---------- 5. Warehouse lender ----------
const CL: Record<string, { name: string; use: number; p: number; q: number }> = {
  A: { name: "Client A (fictional): large retail nonbank, strong capital", use: 1200, p: 0.005, q: 0.99 },
  B: { name: "Client B (fictional): mid-size wholesale nonbank, thin capital", use: 600, p: 0.03, q: 0.97 },
  C: { name: "Client C (fictional): non-QM specialist", use: 400, p: 0.04, q: 0.95 },
};
const yn: Opt[] = [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }];
const whlender: Role = {
  id: "whlender", title: "You are a warehouse lender", short: "Warehouse lender", node: "warehouse", example: "a bank such as Texas Capital or Customers Bank (the warehouse lenders)",
  blurb: "Set the terms of credit lines to nonbank lenders, pick which ones to back, and survive a run like 2007.",
  intro: {
    job: "You run a bank's warehouse lending desk. Nonbank lenders draw on your warehouse line (the lender's credit line) to fund each closing, pledge the loan to you as collateral, and repay when they sell it, usually within weeks.",
    work: "Nonbank lenders (three fictional clients here); the document custodian (the note vault) that holds notes for you; Fannie Mae and Freddie Mac (the agency guarantors) whose purchases repay you.",
    paid: "Interest at SOFR plus a spread on what each client has drawn, minus your bank's funding cost.",
    goal: "Earn spread over 6 quarters without big losses when a client fails or loans get stuck on your line.",
    tip: "Weak clients pay more but can fail. Tight covenants, margin calls and a collateral refresh (on twice a year by default) warn you before a client collapses.",
  },
  quarters: 6,
  decisions: [
    { key: "A", label: "Extend a line to Client A (strong, low margin)", tip: CL.A.name + ". Big, steady usage.", opts: yn, def: "yes" },
    { key: "B", label: "Extend a line to Client B (thin capital)", tip: CL.B.name + ". Pays the same spread, fails more often.", opts: yn, def: "yes" },
    { key: "C", label: "Extend a line to Client C (non-QM)", tip: CL.C.name + ". Riskier, harder-to-sell collateral.", opts: yn, def: "no" },
    { key: "adv", label: "Advance rate (share of each loan you fund)", tip: "Advance rate and haircut (how much the bank lends against each loan): 97% means the client funds 3% itself.", opts: [{ v: "95", label: "95%" }, { v: "97", label: "97%" }, { v: "98", label: "98%" }], def: "97" },
    { key: "spread", label: "Spread over SOFR (your price)", tip: "Higher spread earns more per dollar but clients move volume to cheaper banks.", opts: [{ v: "150", label: "+1.50%" }, { v: "200", label: "+2.00%" }, { v: "275", label: "+2.75%" }], def: "200" },
    { key: "cov", label: "Covenants (tangible net worth and liquidity minimums)", tip: "Rules the client must meet, such as tangible net worth, TNW (equity minus intangibles) and cash on hand. Tight covenants catch trouble early but cost volume.", opts: [{ v: "loose", label: "Loose" }, { v: "standard", label: "Standard" }, { v: "tight", label: "Tight" }], def: "standard" },
    { key: "aging", label: "Aging limit (max days a loan can sit on the line)", tip: "Loans older than this must be repaid or marked down. Short limits stop stale, hard-to-sell loans piling up.", opts: [{ v: "60", label: "60 days" }, { v: "45", label: "45 days" }, { v: "30", label: "30 days" }], def: "45" },
    { key: "margin", label: "Margin calls (demanding cash when collateral loses value)", tip: "Strict: call for cash as soon as collateral falls. Lenient: give clients time.", opts: [{ v: "strict", label: "Strict" }, { v: "lenient", label: "Lenient" }], def: "strict" },
    { key: "refresh", label: "Collateral credit refresh (re-checking pledged loans)", tip: REFRESH_TIP + " Shows weakening pledged loans so you margin-call early.", opts: [{ v: "none", label: "None" }, { v: "semi", label: "Twice a year" }, { v: "quarterly", label: "Quarterly" }], def: "semi" },
  ],
  shocks: [
    { id: "collapse", label: "Client volume collapse", desc: "Rates jump and mortgage volume halves. Thin-capital clients burn cash and may fail.", credit: true },
    { id: "stuck", label: "Loans stuck on the line (scratch-and-dent)", desc: "Some loans have defects and can't be sold at par (scratch-and-dent loans). They age on your line and lose value.", credit: true },
    { id: "run", label: "2007-style run", desc: "Investors stop buying non-agency loans, banks pull lines and collateral values drop. Failures spike.", credit: true },
  ],
  risks: [
    { key: "exp", label: "Exposure (drawn on your lines)", tip: "Total your clients owe you.", fmt: mm, status: (v) => st3(v, (x) => x < 2500, (x) => x < 3500) },
    { key: "el", label: "Expected loss this quarter", tip: "Exposure × chance of client failure × loss if they fail (mock).", fmt: mm, status: (v) => st3(v, (x) => x < 3, (x) => x < 8) },
    { key: "conc", label: "Largest client share", tip: "Concentration: how much rides on one client.", fmt: (v) => Math.round(v) + "%", status: (v) => st3(v, (x) => x < 60, (x) => x < 80) },
  ],
  init: () => ({ fA: 0, fB: 0, fC: 0 }),
  step: (s, d, shock, rng) => {
    const share = pick({ "95": 0.75, "97": 1, "98": 1.15 }, d.adv) * pick({ "150": 1.2, "200": 1, "275": 0.7 }, d.spread) * pick({ loose: 1.1, standard: 1, tight: 0.85 }, d.cov) * pick({ "60": 1.05, "45": 1, "30": 0.9 }, d.aging);
    const lf = (d.margin === "strict" ? 0.8 : 1) * pick({ none: 1, semi: 0.85, quarterly: 0.7 }, d.refresh);
    const aging = pick({ "60": 0.03, "45": 0.015, "30": 0.005 }, d.aging), adv = Number(d.adv) / 100;
    const parts: Record<string, number> = { "Spread income": 0, "Client losses": 0, "Stuck-loan markdowns": 0, "Operating costs": -(0.6 + pick({ none: 0, semi: 0.05, quarterly: 0.15 }, d.refresh)) };
    let exp = 0, el = 0, mx = 0; const notes: string[] = [];
    for (const k of ["A", "B", "C"]) {
      if (d[k] !== "yes" || s["f" + k]) continue;
      const c = CL[k]; let use = c.use * share * (shock === "collapse" ? 0.5 : 1);
      const p = c.p * (shock === "collapse" ? (k === "A" ? 1.5 : 4) : shock === "run" ? 6 : 1) * pick({ loose: 1.2, standard: 1, tight: 0.7 }, d.cov);
      const coll = c.q * (shock === "stuck" ? 0.9 : 1) * (shock === "run" ? 0.9 : 1) - aging;
      const lgd = (Math.max(0, adv - coll) + 0.01) * lf;
      parts["Spread income"] += use * (Number(d.spread) - 30) / 10000 / 4;
      if (shock === "stuck") parts["Stuck-loan markdowns"] -= use * 0.004 * (aging / 0.015) * lf;
      el += use * p * lgd; exp += use; mx = Math.max(mx, use);
      if (rng() < p) { parts["Client losses"] -= use * lgd; s["f" + k] = 1; notes.push(`${c.name.split(":")[0]} failed; you lost approx. ${mm(use * lgd)} after selling the collateral.`); use = 0; }
    }
    return { s, parts, risks: { exp, el, conc: exp ? (mx / exp) * 100 : 0 }, note: notes.join(" ") || "All clients repaid on time as their loans were sold." };
  },
  refreshOn: (d) => d.refresh !== "none", refreshNode: "warehouse",
  refreshText: "Refreshing credit on pledged loans tells you which collateral is weakening, so you margin-call or tighten haircuts before a client fails. Today most warehouse banks rely on origination data plus haircuts (estimate).",
  benchmark: 35,
  pro: { C: { v: "no", why: "A risky non-QM client adds little spread for a lot of tail risk unless covenants are tight." }, adv: { v: "97", why: "97% keeps clients' skin in the game while staying competitive." }, cov: { v: "tight", why: "Tight covenants spot a weak client quarters before it fails." }, aging: { v: "45", why: "Moderate aging limits stop stale loans without strangling clients." }, margin: { v: "strict", why: "In 2007, lenders that called margin early lost far less." }, refresh: { v: "semi", why: "A twice-yearly collateral refresh is cheap early warning." } },
  playbook: ["Lend to well-capitalized clients and watch the thin ones closely.", "Keep tight covenants and short aging limits; call margin early.", "Refresh pledged collateral so you see trouble before it's on your books."],
  lessons: ["A warehouse line is short, secured lending, safe until collateral can't be sold.", "In 2007 lines were pulled overnight and many nonbanks such as New Century failed within months.", "Concentration in one client is the biggest single risk on the desk."],
};

// ---------- 6. Warehouse line analyst (borrower side) ----------
const LINES = [{ name: "Bank 1 (big bank)", lim: 1500, spr: 1.75, adv: 0.97 }, { name: "Bank 2 (regional bank)", lim: 1000, spr: 2.0, adv: 0.98 }, { name: "Bank 3 (specialty lender)", lim: 1000, spr: 2.5, adv: 0.98 }];
const analyst: Role = {
  id: "analyst", title: "You run warehouse lines at a big lender", short: "Warehouse line analyst", node: "rocket", example: "the capital markets team at a nonbank such as UWM or Rocket Mortgage (the lenders)",
  blurb: "Spread a $3B-a-quarter pipeline across three bank lines, keep loans moving, protect covenant headroom and hedge rate locks.",
  intro: {
    job: "Your company funds approx. $3B of mortgages a quarter (mock) on three warehouse lines (the lender's credit lines) before selling them to Fannie Mae, Freddie Mac or Ginnie Mae pools. You decide which line funds what, how fast loans move off the lines, how much cash to keep, and how much of the rate-locked pipeline to hedge.",
    work: "Banks such as JPMorgan, Wells Fargo or Texas Capital (the warehouse lenders); Fannie Mae and Freddie Mac (the agency guarantors), whose early funding programs pay you sooner; dealers for TBA hedges and gestation repo (financing while the bond is born).",
    paid: "Your company earns a gain on sale (mock approx. 0.9% of volume). Your job is to keep interest cost, haircut cash and hedge losses from eating it.",
    goal: "Keep liquidity headroom above zero, never blow through a line limit, and keep the most gain on sale over 7 quarters.",
    tip: "Spread your loans across banks so one bank cutting its line can't strand you. Daily pre-close credit monitoring (on by default) keeps loans from getting stuck on your lines.",
  },
  quarters: 7,
  decisions: [
    { key: "alloc", label: "Line allocation (share of pipeline per bank)", tip: LINES.map((l) => `${l.name}: SOFR + ${l.spr}%, limit ${mm(l.lim)}, advance ${Math.round(l.adv * 100)}%`).join("; ") + " (mock).", opts: [{ v: "cheap", label: "Cheapest first 70/20/10" }, { v: "balanced", label: "Balanced 40/35/25" }, { v: "b2", label: "Lean on Bank 2 25/55/20" }, { v: "no2", label: "Banks 1 & 3 only 60/0/40" }], def: "balanced" },
    { key: "speed", label: "Getting loans off the lines (dwell time)", tip: "Dwell time (days on the line). Early funding (getting paid sooner) from Fannie Mae or Freddie Mac cuts dwell for a small fee; gestation repo moves pooled loans to cheaper dealer financing.", opts: [{ v: "standard", label: "Standard (approx. 25 days)" }, { v: "early", label: "Early funding (approx. 12 days)" }, { v: "gestation", label: "Gestation repo" }], def: "standard" },
    { key: "cushion", label: "Liquidity cushion (cash kept on hand)", tip: "Cash for haircuts and margin calls. Banks' covenants require a minimum (mock $150M); extra cash costs carry.", opts: [{ v: "200", label: "$200M" }, { v: "400", label: "$400M" }, { v: "600", label: "$600M" }], def: "400" },
    { key: "hedge", label: "Pipeline hedge ratio (TBA shorts against rate locks)", tip: "Rate locks lose value if rates rise. Hedging 100% overhedges, because some borrowers walk away (fallout) when rates fall.", opts: [{ v: "0", label: "0%" }, { v: "50", label: "50%" }, { v: "90", label: "90%" }], def: "50" },
    { key: "precl", label: "Pre-close credit refresh", tip: REFRESH_TIP + " Here: one refresh before closing, or daily monitoring that catches new debts early, so fewer loans get stuck unsellable on your lines.", opts: [{ v: "one", label: "One refresh" }, { v: "daily", label: "Daily monitoring" }], def: "daily" },
  ],
  shocks: [
    { id: "cut", label: "A bank cuts your line", desc: "Bank 2 (regional bank) pulls its line. Anything allocated there must move to the other banks.", credit: true },
    { id: "rateup", label: "Rates jump 0.75% (lock losses)", desc: "Rates rise after borrowers locked; unhedged locks lose value." },
    { id: "fallout", label: "Rates drop 0.75% (lock fallout)", desc: "Rates fall; many borrowers walk away to relock elsewhere, leaving your hedges overhedged." },
  ],
  risks: [
    { key: "head", label: "Liquidity headroom (cash above covenant)", tip: "Cushion minus haircut cash needed minus the covenant minimum.", fmt: mm, status: (v) => st3(v, (x) => x >= 100, (x) => x >= 0) },
    { key: "util", label: "Highest line utilization", tip: "Drawn balance vs limit on your busiest line.", fmt: (v) => Math.round(v) + "%", status: (v) => st3(v, (x) => x < 85, (x) => x <= 100) },
    { key: "dwell", label: "Average dwell (days on line)", tip: "Days loans sit on warehouse lines.", fmt: (v) => v.toFixed(0) + " days", status: (v) => st3(v, (x) => x <= 20, (x) => x <= 30) },
  ],
  init: () => ({ cut: 0 }),
  step: (s, d, shock, rng) => {
    if (shock === "cut") s.cut = 1;
    const vol = 3000, al = pick({ cheap: [0.7, 0.2, 0.1], balanced: [0.4, 0.35, 0.25], b2: [0.25, 0.55, 0.2], no2: [0.6, 0, 0.4] }, d.alloc);
    const dwell = pick({ standard: 25, early: 12, gestation: 20 }, d.speed);
    const stuck = d.precl === "daily" ? 0.008 : 0.02;
    const bal = vol * dwell / 90 + vol * stuck * (75 - dwell) / 90;
    const parts: Record<string, number> = { "Gain on sale": vol * 0.009, "Line interest": 0, "Haircut + cushion carry": 0, "Stuck loans": -vol * stuck * 0.05, "Funding fees + data": -((d.speed === "early" ? vol * 0.0002 : 0) + (d.precl === "daily" ? 0.25 : 0)) };
    let hair = 0, util = 0, over = 0;
    LINES.forEach((l, i) => { const lim = i === 1 && s.cut ? 0 : l.lim; const b = bal * al[i]; const used = Math.min(b, lim); over += b - used; util = Math.max(util, lim ? (b / lim) * 100 : b > 0 ? 999 : 0); const rate = (4.5 + l.spr - (d.speed === "gestation" ? 0.5 : 0)) / 100; parts["Line interest"] -= used * rate / 4; hair += used * (1 - l.adv); });
    let note = `Average balance on lines approx. ${mm(bal)}.`;
    if (over > 0) { parts["Missed fundings"] = -over * 0.03; hair += over * 0.03; note += ` ${mm(over)} had no line to go on, so you delayed closings and lost business.`; }
    const cush = Number(d.cushion); parts["Haircut + cushion carry"] = -cush * 0.02 / 4;
    const dr = shock === "rateup" ? 0.75 : shock === "fallout" ? -0.75 : (rng() - 0.5) * 0.2, h = Number(d.hedge) / 100, locked = vol * 0.5;
    parts["Pipeline hedge result"] = locked * (-dr * 3 / 100) * (1 - h) - (dr < 0 ? locked * h * Math.abs(dr) * 3 / 100 * 0.35 : 0);
    return { s, parts, note, risks: { head: cush - hair - 150, util: Math.min(util, 200), dwell: dwell + stuck * 50 } };
  },
  refreshOn: (d) => d.precl === "daily", refreshCase: "O3",
  refreshText: "Daily pre-close credit monitoring catches new debts (a car loan, a new card) before closing, so fewer loans fail agency checks and get stuck on your warehouse lines as scratch-and-dent.",
  benchmark: 58,
  pro: { alloc: { v: "balanced", why: "Spreading across banks keeps you funded if one bank cuts its line." }, speed: { v: "early", why: "Early funding cuts dwell and interest for a small fee." }, cushion: { v: "400", why: "Enough cash for haircuts and a margin call, without too much carry." }, hedge: { v: "50", why: "Hedge the locks you expect to close, not all of them." }, precl: { v: "daily", why: "Fewer stuck loans more than pays for the monitoring." } },
  playbook: ["Never depend on one bank: diversify lines and keep spare capacity.", "Shorten dwell time with early funding when the fee is less than the interest saved.", "Hedge the pull-through-adjusted pipeline, not 100% of locks."],
  lessons: ["A warehouse line can be cut fast; liquidity, not profit, decides survival.", "Each day a loan sits on a line costs interest and ties up haircut cash.", "Rate locks are an option you sold to borrowers; hedge accordingly."],
};

// ---------- 7. Aggregator buying or selling MSRs ----------
const pkgOf = (t: number, seed: number) => { const r = rngOf(seed * 53 + t * 11 + 3); return { q: -0.5 + r() * 0.7 }; };
const aggregator: Role = {
  id: "aggregator", title: "You buy and sell servicing rights", short: "MSR aggregator", node: "pennymac", example: "an aggregator such as PennyMac (the correspondent aggregator)",
  blurb: "Price bulk MSR packages as a multiple of the servicing fee, check them with a credit refresh, finance on an MSR line and decide when to buy or sell.",
  intro: {
    job: "You own a mock $100B book of mortgage servicing rights, MSRs (the right to collect the fee). Each quarter a $20B bulk MSR package is for sale, and you can also sell part of yours. MSRs are priced as a multiple of the 0.25% servicing fee (approx. 4.2× here, mock).",
    work: "Sellers such as banks and other lenders; Fannie Mae and Freddie Mac (the agency guarantors), which must approve transfers; banks that lend on MSR financing lines (a loan against servicing rights); Equifax (the credit bureau) for a portfolio credit refresh.",
    paid: "Servicing fees minus the cost of servicing, plus gains if you buy cheap or sell rich. MSR values rise when rates rise (fewer refinances) and fall when rates fall. When your borrowers refinance, you win some of them back (recapture, approx. 30% here, mock).",
    goal: "Grow fee income over 7 quarters without overpaying for weak packages or getting margin-called on your MSR line.",
    tip: "Hedging protects you if rates fall: falling rates mean refinances and lower MSR values. The game starts you with a 75% hedge and low leverage; no hedge plus high leverage is the high-risk path.",
  },
  quarters: 7,
  decisions: [
    { key: "act", label: "This quarter's move", tip: "Buy the $20B package (if your bid wins), sell 20% of your own MSRs, or hold.", opts: [{ v: "hold", label: "Hold" }, { v: "buy", label: "Bid on package" }, { v: "sell", label: "Sell 20%" }], def: "hold", once: true },
    { key: "bid", label: "Your bid vs the market multiple", tip: "MSR multiple (price as years of fee): 4.2× means paying 4.2 times one year's 0.25% fee. The market multiple starts near 4.2× (mock) and moves with rates. Bidding above market wins more often but risks overpaying.", opts: [{ v: "lo", label: "Low (market − 0.3×)" }, { v: "mkt", label: "At market" }, { v: "hi", label: "High (market + 0.3×)" }], def: "mkt" },
    { key: "dil", label: "Portfolio diligence incl. credit refresh", tip: REFRESH_TIP + " A batch refresh of the package shows hidden delinquency risk before you pay.", opts: [{ v: "none", label: "Tape only" }, { v: "refresh", label: "Refresh the package" }], def: "refresh" },
    { key: "lev", label: "MSR financing line (borrowing against your MSRs)", tip: "Loan-to-value, LTV, on your MSR line at approx. SOFR + 3% (mock). More leverage boosts returns but risks margin calls if MSR values fall.", opts: [{ v: "0", label: "None" }, { v: "20", label: "20% LTV" }, { v: "40", label: "40% LTV" }, { v: "60", label: "60% LTV" }], def: "20" },
    { key: "hedge", label: "Rate hedge on the MSR book", tip: "Hedges that gain when rates fall, offsetting MSR losses.", opts: [{ v: "0", label: "None" }, { v: "50", label: "50%" }, { v: "75", label: "75%" }, { v: "90", label: "90%" }], def: "75" },
  ],
  shocks: [
    { id: "fall", label: "Rates fall 1% (MSR values drop)", desc: "Refinancing jumps; MSRs lose value and payoffs shrink your book." },
    { id: "rise", label: "Rates rise 1% (MSR values climb)", desc: "Refinancing stops; MSRs gain value but hedges lose." },
    { id: "dq", label: "Delinquency spike in servicing books", desc: "More borrowers fall behind. Servicing costs rise and weaker packages lose more value.", credit: true },
  ],
  risks: [
    { key: "liq", label: "Liquidity (cash)", tip: "Cash after purchases, interest and margin calls.", fmt: mm, status: (v) => st3(v, (x) => x >= 300, (x) => x >= 100) },
    { key: "ltv", label: "MSR line loan-to-value", tip: "Debt vs MSR value. Above approx. 65% the bank makes a margin call (mock).", fmt: (v) => Math.round(v) + "%", status: (v) => st3(v, (x) => x < 50, (x) => x < 65) },
    { key: "sens", label: "Loss if rates fall 1%", tip: "Approx. MSR value lost in a 1-point drop, after hedges.", fmt: mm, status: (v) => st3(v, (x) => x < 120, (x) => x < 200) },
  ],
  init: () => ({ upb: 100000, r: 6.5, liq: 600, debt: 210, adj: 0 }),
  offer: () => "This quarter's package: approx. $20B of agency loans' servicing rights (mock). Hidden quality varies; a credit refresh reveals it.",
  step: (s, d, shock, rng, t, seed) => {
    const parts: Record<string, number> = {}; let note = "";
    const m0 = clamp(4.2 + (s.r - 6.5) * 0.8, 2.5, 5.5); const dr = shock === "fall" ? -1 : shock === "rise" ? 1 : (rng() - 0.5) * 0.3; s.r += dr; const m = clamp(4.2 + (s.r - 6.5) * 0.8, 2.5, 5.5);
    const h = Number(d.hedge) / 100;
    const cpr = clamp(0.08 + Math.max(0, 6.5 - s.r) * 0.12, 0.04, 0.45), run = s.upb * cpr / 4;
    parts["Servicing fees"] = s.upb * 0.0025 / 4; parts["Servicing costs"] = -s.upb * 0.0007 / 4 * (shock === "dq" ? 1.5 : 1);
    const mtm = s.upb * 0.0025 * (m - m0); parts["MSR mark (rates)"] = mtm; parts["Hedge"] = -mtm * h * 0.85 - 0.3 * h * 2;
    parts["Payoff runoff"] = -run * 0.0025 * m; parts["Refi recapture"] = run * 0.3 * 0.0025 * m; s.upb -= run * 0.7;
    if (shock === "dq") { parts["Weak-loan markdown"] = s.upb * 0.0025 * Math.min(0, s.adj) * 0.5; }
    if (d.dil === "refresh") parts["Diligence + refresh"] = -0.15;
    if (d.act === "buy") {
      const pk = pkgOf(t, seed), bid = m + pick({ lo: -0.3, mkt: 0, hi: 0.3 }, d.bid); const win = pick({ lo: 0.2, mkt: 0.55, hi: 0.9 }, d.bid);
      if (rng() < win) {
        let pay = bid; if (d.dil === "refresh" && pk.q < -0.2) { pay = Math.min(bid, m + pk.q); note += `The credit refresh found weak loans in the package, so you cut your price to ${pay.toFixed(2)}×. `; }
        const cost = 20000 * 0.0025 * pay, fair = 20000 * 0.0025 * (m + pk.q); parts["Purchase vs fair value"] = fair - cost; s.liq -= cost; s.adj = (s.upb * s.adj + 20000 * pk.q) / (s.upb + 20000); s.upb += 20000;
        note += `You bought the package at ${pay.toFixed(2)}× (approx. ${mm(cost)}); it proved worth approx. ${mm(fair)}. `;
      } else note += "Another buyer won the package. ";
    } else if (d.act === "sell") { const q = s.upb * 0.2, px = q * 0.0025 * (m - 0.1); parts["Sale discount"] = -q * 0.0025 * 0.1; s.liq += px; s.upb -= q; note += `You sold approx. ${mm(px)} of MSRs. `; }
    const val = s.upb * 0.0025 * m, target = val * Number(d.lev) / 100;
    parts["Financing interest"] = -s.debt * 0.075 / 4;
    if (s.debt / val > Number(d.lev) / 100 + 0.1 && Number(d.lev) > 0) { const pay = s.debt - target; s.liq -= pay; note += `Margin call: MSR values fell, so you repaid ${mm(pay)} on your MSR line. `; s.debt = target; }
    else { s.liq += target - s.debt; s.debt = target; }
    const cashIn = parts["Servicing fees"] + parts["Servicing costs"] + parts["Financing interest"]; s.liq += cashIn * 0.5;
    if (s.liq < 0) { const q = s.upb * 0.1, px = q * 0.0025 * (m - 0.3); parts["Forced sale"] = -q * 0.0025 * 0.3; s.liq += px; s.upb -= q; note += "You ran out of cash and had to sell MSRs at a discount. "; }
    return { s, parts, note: note.trim() || "A steady quarter of collecting fees.", risks: { liq: s.liq, ltv: val ? (s.debt / val) * 100 : 0, sens: val * 0.18 * (1 - h) } };
  },
  refreshOn: (d) => d.dil === "refresh", refreshNode: "msrowner",
  refreshText: "MSR bids are usually priced off loan tapes with origination scores. A batch credit refresh of the package shows which borrowers have weakened, so you don't overpay for servicing that will be costly and short-lived.",
  benchmark: 93,
  pro: { bid: { v: "mkt", why: "Bid near the market multiple; overpaying is permanent, missing a package isn't." }, dil: { v: "refresh", why: "A refresh costs little next to a $200M purchase and catches weak packages." }, lev: { v: "20", why: "Low leverage leaves plenty of room before a margin call when rates fall." }, hedge: { v: "75", why: "A solid partial hedge protects against a refinance wave while keeping some upside if rates rise." } },
  playbook: ["Buy MSRs when rates are high and refinancing is slow, at or below market multiples.", "Refresh credit on packages before bidding.", "Keep leverage moderate and hedge part of the rate risk."],
  lessons: ["MSR value is a bet on rates: falling rates mean payoffs and lower value.", "Leverage on MSRs turns a value drop into a cash call.", "Package quality (delinquencies) is hidden in the tape unless you refresh."],
};

export const ROLES: Role[] = [servicer, pmi, crt, wholeloan, whlender, analyst, aggregator];
export const ROLE: Record<string, Role> = Object.fromEntries(ROLES.map((r) => [r.id, r]));
export const ROLE_FOR_NODE: Record<string, string> = { servicer: "servicer", msrowner: "aggregator", pennymac: "aggregator", mi: "pmi", cas: "crt", creditinv: "crt", dealers: "wholeloan", warehouse: "whlender", rocket: "analyst", uwm: "analyst" };
