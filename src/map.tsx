import { useState } from "react";
import type { ReactNode } from "react";
import { PLAYERS, FLOWS, FLOW_KIND, OWN, LANES, RISK, RISK_BEARERS, P } from "./data";
import type { ViewSel, OwnKind, RiskKey, Flow } from "./data";

export type Overlay = "money" | "owner" | "risk";
export const NW = 168, NH = 48, GAP = 30, PITCH = 80;
export const LX = (lane: number) => 20 + NW / 2 + lane * (NW + GAP), RY = (row: number) => 66 + row * PITCH;
export const MAP_W = 20 * 2 + 6 * NW + 5 * GAP, MAP_H = RY(8) + NH / 2 + 22;
const LANE_COLOR = ["#4d9fff", "#8b96a5", "#f5a524", "#22c3a6", "#8b7cf6", "#2bd47d"];
const HALF = NW / 2, CH = HALF + GAP / 2; // channel = centre of the gap between lanes

type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export const inView = (views: string[], v: ViewSel) => v === "all" || views.includes(v);
export const flowsFor = (v: ViewSel) => FLOWS.filter((f) => inView(f.views, v));

// Which side of each box a flow leaves from / arrives at.
function sides(f: Flow): [string, string] {
  const a = P[f.from], b = P[f.to];
  if (a.lane === b.lane) return Math.abs(a.row - b.row) === 1 ? (b.row > a.row ? ["B", "T"] : ["T", "B"]) : ["R", "R"];
  return b.lane > a.lane ? ["R", "L"] : ["L", "R"];
}

// Orthogonal route through the empty channels (between lanes) and streets (between rows), with rounded corners.
function route(f: Flow, pa: number, pb: number, bundle: number): Pt[] {
  const a = P[f.from], b = P[f.to];
  const ax = LX(a.lane), ay = RY(a.row), bx = LX(b.lane), by = RY(b.row);
  if (a.lane === b.lane) {
    if (Math.abs(a.row - b.row) === 1) { const down = b.row > a.row; const x1 = ax + pa, x2 = bx + pb; const ys = ay + (down ? NH / 2 : -NH / 2), ye = by + (down ? -NH / 2 : NH / 2); return x1 === x2 ? [{ x: x1, y: ys }, { x: x2, y: ye }] : [{ x: x1, y: ys }, { x: x1, y: (ys + ye) / 2 }, { x: x2, y: (ys + ye) / 2 }, { x: x2, y: ye }]; }
    const cx = ax + CH + bundle;
    return [{ x: ax + HALF, y: ay + pa }, { x: cx, y: ay + pa }, { x: cx, y: by + pb }, { x: bx + HALF, y: by + pb }];
  }
  const right = b.lane > a.lane;
  const s = right ? 1 : -1;
  const S = { x: ax + s * HALF, y: ay + pa }, E = { x: bx - s * HALF, y: by + pb };
  const chA = ax + s * CH + bundle, chB = bx - s * CH + bundle;
  if (Math.abs(b.lane - a.lane) === 1) {
    if (Math.abs(S.y - E.y) < 1) return [S, E];
    return [S, { x: chA, y: S.y }, { x: chA, y: E.y }, E];
  }
  let st = b.row > a.row ? by - PITCH / 2 : b.row < a.row ? by + PITCH / 2 : (b.row === 0 ? by + PITCH / 2 : by - PITCH / 2);
  st += bundle;
  return [S, { x: chA, y: S.y }, { x: chA, y: st }, { x: chB, y: st }, { x: chB, y: E.y }, E];
}
function pathD(pts: Pt[], r = 7): string {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const l1 = Math.hypot(c.x - p.x, c.y - p.y), l2 = Math.hypot(n.x - c.x, n.y - c.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) { d += ` L${c.x},${c.y}`; continue; }
    const a = { x: c.x - ((c.x - p.x) / l1) * rr, y: c.y - ((c.y - p.y) / l1) * rr }, b = { x: c.x + ((n.x - c.x) / l2) * rr, y: c.y + ((n.y - c.y) / l2) * rr };
    d += ` L${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x},${c.y} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l.x},${l.y}`;
}

export function MoneyMap({ view, overlay, risk, crisis, sel, onPick, own, animate, flash, focus }: { view: ViewSel; overlay: Overlay; risk: RiskKey; crisis: boolean; sel: string; onPick: (id: string) => void; own: Record<string, OwnKind[]>; animate: boolean; flash?: string; focus: string[] }) {
  const [hov, setHov] = useState(-1);
  const bearers = RISK_BEARERS[risk];
  const fset = new Set(focus);
  // Only the selected player's flows, or (nothing selected) the current ownership step's flows.
  const flows = flowsFor(view).filter((f) => (sel ? f.from === sel || f.to === sel : f.kind !== "info" && fset.has(f.from) && fset.has(f.to)));
  const linked = new Set<string>(sel ? [sel, ...flows.flatMap((f) => [f.from, f.to])] : []);
  const lit = (id: string) => {
    const p = P[id];
    if (!inView(p.views, view)) return false;
    if (sel && !linked.has(id)) return false;
    if (overlay === "owner") return !!own[id] || linked.has(id);
    if (overlay === "risk") return !!bearers[id] || id === sel;
    return true;
  };
  // consistent ports: spread flows that share a box side
  const sideUse: Record<string, number[]> = {};
  const sd = flows.map((f, i) => { const [s1, s2] = sides(f); (sideUse[f.from + s1] ??= []).push(i); (sideUse[f.to + s2] ??= []).push(i); return [s1, s2]; });
  const portOff = (node: string, side: string, i: number) => { const L = sideUse[node + side]; const j = L.indexOf(i), n = L.length; const step = side === "T" || side === "B" ? 22 : 8; return clamp((j - (n - 1) / 2) * step, side === "T" || side === "B" ? 66 : 19); };
  const nodeBoxes: Box[] = PLAYERS.map((p) => ({ x: LX(p.lane) - HALF - 3, y: RY(p.row) - NH / 2 - 9, w: NW + 6, h: NH + 12 }));
  const placed: Box[] = [{ x: 0, y: 0, w: MAP_W, h: 26 }, { x: LX(4) - 50, y: RY(4) - 9, w: 100, h: 20 }];
  const items = flows.map((f, i) => {
    const pts = route(f, portOff(f.from, sd[i][0], i), portOff(f.to, sd[i][1], i), ((i % 5) - 2) * 3);
    const d = pathD(pts);
    const w = f.label.length * 5.7 + 14, h = 15;
    let lab: Box | null = null, fallback: Box | null = null;
    const segs = pts.slice(1).map((p, k) => ({ a: pts[k], b: p })).filter((s) => Math.abs(s.a.y - s.b.y) < 0.5).sort((s, t) => Math.abs(t.b.x - t.a.x) - Math.abs(s.b.x - s.a.x));
    for (const s of segs) {
      const len = Math.abs(s.b.x - s.a.x);
      for (const t of [0.5, 0.3, 0.7, 0.18, 0.82]) {
        const x = s.a.x + (s.b.x - s.a.x) * t, y = s.a.y;
        const bx: Box = { x: x - w / 2, y: y - h / 2, w, h };
        fallback ??= bx;
        if (len < w + 6 || bx.x < 2 || bx.x + w > MAP_W - 2) continue;
        if (nodeBoxes.some((n) => hit(n, bx)) || placed.some((n) => hit(n, bx))) continue;
        lab = bx; break;
      }
      if (lab) break;
    }
    if (!lab) {
      // vertical runs: try where the channel crosses an empty gap between rows
      for (const s of pts.slice(1).map((p, k) => ({ a: pts[k], b: p })).filter((s) => Math.abs(s.a.x - s.b.x) < 0.5)) {
        const y0 = Math.min(s.a.y, s.b.y), y1 = Math.max(s.a.y, s.b.y);
        for (let r = 0; r < 9 && !lab; r++) {
          const y = RY(r) + PITCH / 2 - 1; if (y - 8 < y0 || y + 8 > y1) continue;
          const bx: Box = { x: s.a.x - w / 2, y: y - h / 2, w, h };
          if (bx.x < 2 || bx.x + w > MAP_W - 2) continue;
          if (nodeBoxes.some((n) => hit(n, bx)) || placed.some((n) => hit(n, bx))) continue;
          lab = bx;
        }
        if (lab) break;
      }
    }
    if (!fallback) { const m = pts[Math.floor(pts.length / 2)]; fallback = { x: m.x - w / 2, y: m.y - h / 2, w, h }; }
    if (lab) placed.push({ x: lab.x - 3, y: lab.y - 3, w: lab.w + 6, h: lab.h + 6 });
    return { f, i, d, lab, fallback };
  });
  const pill = (f: Flow, b: Box, key: string, hover = false) => { const col = FLOW_KIND[f.kind].color; return <g key={key} className={"mm-lbl" + (hover ? " hover" : "")} pointerEvents="none"><rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} style={{ fill: "var(--panel)", stroke: col }} strokeWidth={1} /><text x={b.x + b.w / 2} y={b.y + b.h / 2 + 3.5} textAnchor="middle">{f.label}</text></g>; };
  const lines: ReactNode[] = [], dots: ReactNode[] = [], labels: ReactNode[] = [];
  items.forEach(({ f, i, d, lab }) => {
    const col = FLOW_KIND[f.kind].color, on = hov === i;
    lines.push(<g key={"e" + i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "help" }}><title>{`${P[f.from].label} \u2192 ${P[f.to].label}: ${f.label}`}</title></path>
      <path d={d} fill="none" className={"mm-edge" + (f.kind === "info" ? " info" : "")} style={{ stroke: col, strokeWidth: on ? 2.6 : 1.7, opacity: hov >= 0 && !on ? 0.35 : 0.95 }} markerEnd={`url(#mm-a-${f.kind})`} pointerEvents="none" />
    </g>);
    if (animate && f.kind !== "info") dots.push(<circle key={"d" + i} r={2.6} style={{ fill: col }} pointerEvents="none"><animateMotion dur={`${2.4 + (i % 4) * 0.3}s`} repeatCount="indefinite" path={d} /></circle>);
    if (lab) labels.push(pill(f, lab, "l" + i));
  });
  const hv = items.find((x) => x.i === hov);
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={MAP_W} height={MAP_H} className="mm-svg" role="img" aria-label="Map of the US secondary mortgage market: who pays whom and who owns what">
      <defs>{(Object.keys(FLOW_KIND) as Flow["kind"][]).map((k) => <marker key={k} id={"mm-a-" + k} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" markerUnits="strokeWidth" orient="auto"><path d="M0,0.5 L7.5,4 L0,7.5 z" style={{ fill: FLOW_KIND[k].color }} /></marker>)}</defs>
      {LANES.map((l, i) => <g key={l}><rect x={LX(i) - HALF - 6} y={30} width={NW + 12} height={MAP_H - 36} rx={10} className="mm-laneband" /><text x={LX(i)} y={20} textAnchor="middle" className="mm-lane">{l}</text></g>)}
      <text x={LX(4)} y={RY(4) + 5} textAnchor="middle" className="mm-lane">SERVICING</text>
      {lines}
      {PLAYERS.map((p) => {
        const x = LX(p.lane) - NW / 2, y = RY(p.row) - NH / 2;
        const on = sel === p.id, ok = lit(p.id), kinds = own[p.id] ?? [], ownsLoan = kinds.includes("loan");
        const rc = overlay === "risk" && bearers[p.id] ? RISK[risk].color : null;
        const cr = crisis && !!p.crisis;
        return (
          <g key={p.id} className={"mm-node" + (on ? " on" : "") + (ok ? "" : " dim") + (flash === p.id ? " flash" : "")} transform={`translate(${x},${y})`} onClick={() => onPick(p.id)} tabIndex={0} role="button" aria-label={`${p.name}${kinds.length ? ", " + kinds.map((k) => OWN[k].short).join(", ") : ""}`} data-node={p.id} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }}>
            {flash === p.id && <rect className="mm-flash-ring" x={-9} y={-9} width={NW + 18} height={NH + 18} rx={15} />}
            {ownsLoan && <rect className="mm-owner-ring" x={-6} y={-6} width={NW + 12} height={NH + 12} rx={13} />}
            <rect className="mm-box" width={NW} height={NH} rx={9} style={{ stroke: on ? "var(--amber)" : rc ?? (cr ? "var(--down)" : ownsLoan ? OWN.loan.color : "var(--border2)"), fill: rc ? `color-mix(in srgb, ${rc} 16%, var(--panel2))` : ownsLoan ? "color-mix(in srgb, #2bd47d 14%, var(--panel2))" : undefined }} strokeWidth={on ? 2.6 : rc || ownsLoan ? 2 : 1.2} strokeDasharray={cr && !on ? "5 3" : undefined} />
            <rect width={4} height={NH} rx={2} style={{ fill: LANE_COLOR[p.lane] }} />
            <text x={13} y={20} className="mm-n1">{p.label}</text>
            <text x={13} y={36} className="mm-n2">{p.role}</text>
            {kinds.map((k, j) => <g key={k} transform={`translate(${NW - 12 - j * 21},0)`}><circle r={9} style={{ fill: OWN[k].color, stroke: "var(--panel)" }} strokeWidth={2} /><text y={3.6} textAnchor="middle" className="mm-glyph">{OWN[k].glyph}</text></g>)}
            {cr && <g transform="translate(12,0)"><circle r={8} style={{ fill: "var(--down)", stroke: "var(--panel)" }} strokeWidth={2} /><text y={3.6} textAnchor="middle" className="mm-glyph">!</text></g>}
          </g>
        );
      })}
      {dots}
      {labels}
      {hv && !hv.lab && pill(hv.f, hv.fallback as Box, "hov", true)}
    </svg>
  );
}
