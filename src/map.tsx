import type { ReactNode } from "react";
import { PLAYERS, FLOWS, FLOW_KIND, OWN, LANES, RISK, RISK_BEARERS, P } from "./data";
import type { ViewSel, OwnKind, RiskKey, Flow } from "./data";

export type Overlay = "money" | "owner" | "risk";
export const NW = 168, NH = 48, GAP = 30, LX = (lane: number) => 20 + NW / 2 + lane * (NW + GAP), RY = (row: number) => 66 + row * 80;
export const MAP_W = 20 * 2 + 6 * NW + 5 * GAP, MAP_H = RY(8) + NH / 2 + 18;
const LANE_COLOR = ["#4d9fff", "#8b96a5", "#f5a524", "#22c3a6", "#8b7cf6", "#2bd47d"];

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const inView = (views: string[], v: ViewSel) => v === "all" || views.includes(v);
export const flowsFor = (v: ViewSel) => FLOWS.filter((f) => inView(f.views, v));

function geom(f: Flow) {
  const a = P[f.from], b = P[f.to];
  const ax = LX(a.lane), ay = RY(a.row), bx = LX(b.lane), by = RY(b.row);
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  let bend = 26;
  if (a.lane === b.lane && Math.abs(a.row - b.row) > 1) bend = 2 * (NW / 2 + 13);
  else if (a.lane === b.lane) bend = 60;
  const cx = (ax + bx) / 2 - (dy / len) * bend, cy = (ay + by) / 2 + (dx / len) * bend;
  const port = (px: number, py: number, tx: number, ty: number) => { const ddx = tx - px, ddy = ty - py; const s = Math.max(Math.abs(ddx) / (NW / 2 + 3), Math.abs(ddy) / (NH / 2 + 3)) || 1; return { x: px + ddx / s, y: py + ddy / s }; };
  const p0 = port(ax, ay, cx, cy), p2 = port(bx, by, cx, cy);
  const at = (t: number) => ({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * cx + t * t * p2.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * cy + t * t * p2.y });
  return { d: `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`, at };
}

export function MoneyMap({ view, overlay, risk, crisis, sel, onPick, own, animate, flash }: { view: ViewSel; overlay: Overlay; risk: RiskKey; crisis: boolean; sel: string; onPick: (id: string) => void; own: Record<string, OwnKind[]>; animate: boolean; flash?: string }) {
  const flows = flowsFor(view).filter((f) => overlay === "money" || (overlay === "owner" && (f.kind === "asset")));
  const nodeBoxes: Box[] = PLAYERS.map((p) => ({ x: LX(p.lane) - NW / 2 - 4, y: RY(p.row) - NH / 2 - 10, w: NW + 8, h: NH + 14 }));
  const placed: Box[] = [{ x: 0, y: 0, w: MAP_W, h: 28 }, { x: LX(4) - 50, y: RY(4) - 8, w: 100, h: 20 }];
  const bearers = RISK_BEARERS[risk];
  const lit = (id: string) => {
    const p = P[id];
    if (!inView(p.views, view)) return false;
    if (overlay === "owner") return !!own[id];
    if (overlay === "risk") return !!bearers[id];
    return true;
  };
  const edges: ReactNode[] = [], labels: ReactNode[] = [], dots: ReactNode[] = [];
  flows.forEach((f, i) => {
    const g = geom(f);
    const hot = sel === f.from || sel === f.to;
    const col = FLOW_KIND[f.kind].color;
    const faded = (!hot && sel !== "") || !lit(f.from) || !lit(f.to);
    edges.push(<path key={"e" + i} d={g.d} fill="none" className={f.kind === "info" ? "mm-edge info" : "mm-edge flow-line"} style={{ stroke: col, strokeWidth: hot ? 2.4 : 1.3, opacity: faded ? 0.16 : 0.85 }} markerEnd={`url(#mm-a-${f.kind})`}><title>{`${P[f.from].label} \u2192 ${P[f.to].label}: ${f.label}`}</title></path>);
    if (hot && animate && f.kind !== "info") dots.push(<circle key={"d" + i} r={3.6} style={{ fill: col }}><animateMotion dur={`${2.2 + (i % 4) * 0.35}s`} repeatCount="indefinite" path={g.d} /></circle>);
    if (hot) {
      const w = f.label.length * 6.1 + 12, h = 17;
      const cands: { x: number; y: number }[] = [];
      for (const off of [0, 12, -12, 22, -22, 32, -32]) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.15, 0.85]) { const p = g.at(t); cands.push({ x: p.x, y: p.y + off }); }
      for (const pt of cands) {
        const b = { x: pt.x - w / 2, y: pt.y - h / 2, w, h };
        if (b.x < 2 || b.x + w > MAP_W - 2) continue;
        if (nodeBoxes.some((n) => hit(n, b)) || placed.some((n) => hit(n, b))) continue;
        placed.push({ x: b.x - 2, y: b.y - 2, w: w + 4, h: h + 4 });
        labels.push(<g key={"l" + i} className="mm-lbl"><rect x={b.x} y={b.y} width={w} height={h} rx={4} style={{ fill: "var(--panel)", stroke: col }} strokeWidth={1} /><text x={pt.x} y={pt.y + 4} textAnchor="middle" style={{ fill: "var(--text)" }}>{f.label}</text></g>);
        break;
      }
    }
  });
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={MAP_W} height={MAP_H} className="mm-svg" role="img" aria-label="Map of the US secondary mortgage market: who pays whom and who owns what">
      <defs>{(Object.keys(FLOW_KIND) as Flow["kind"][]).map((k) => <marker key={k} id={"mm-a-" + k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: FLOW_KIND[k].color }} /></marker>)}</defs>
      {LANES.map((l, i) => <text key={l} x={LX(i)} y={18} textAnchor="middle" className="mm-lane">{l}</text>)}
      <text x={LX(4)} y={RY(4) + 6} textAnchor="middle" className="mm-lane">SERVICING</text>
      {edges}
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
    </svg>
  );
}
