// Every line on the map, its filter categories, the filter itself, and URL-hash sharing.
import { FLOWS, P } from "./data";
import type { Flow, ViewSel, AgencyPath } from "./data";
import { CREDIT_FLOWS, inView } from "./map";
import type { Overlay } from "./map";

export type LineCat = "money" | "paper" | "fees" | "risk" | "rules" | "credit" | "warehouse";
export const CAT_ORDER: LineCat[] = ["money", "paper", "fees", "risk", "rules", "credit", "warehouse"];
export const CATS: Record<LineCat, { label: string; color: string; dashed?: boolean }> = {
  money: { label: "Money (cash, payments)", color: "#2bd47d" },
  paper: { label: "Paper (loans, notes, bonds)", color: "#4d9fff" },
  fees: { label: "Fees", color: "#ffb547" },
  risk: { label: "Risk (guarantees, insurance)", color: "#a78bfa" },
  rules: { label: "Rules and records", color: "#8b96a5", dashed: true },
  credit: { label: "Credit pull fees (bureaus, scores)", color: "#2dd4bf" },
  warehouse: { label: "Warehouse line", color: "#22d3ee" },
};
// Credit-overlay flows that duplicate a money-map flow (same two players) are dropped.
export const ALL: Flow[] = [...FLOWS, ...CREDIT_FLOWS.filter((c) => !FLOWS.some((f) => f.from === c.from && f.to === c.to))];
const IDX = new Map<Flow, number>(ALL.map((f, i) => [f, i]));
export const idOf = (f: Flow) => IDX.get(f) ?? -1;
export function catsOf(f: Flow): LineCat[] {
  const k: LineCat = f.kind === "pay" || f.kind === "cash" ? "money" : f.kind === "asset" ? "paper" : f.kind === "fee" ? "fees" : f.kind === "risk" ? "risk" : "rules";
  const out: LineCat[] = [k];
  if (["bureaus", "scores"].includes(f.from) || ["bureaus", "scores"].includes(f.to)) out.push("credit");
  if (f.from === "warehouse" || f.to === "warehouse") out.push("warehouse");
  return out;
}
export const lineText = (f: Flow) => `${P[f.from].label} \u2192 ${P[f.to].label}: ${f.label}`;
export const universe = (view: ViewSel) => ALL.filter((f) => inView(f.views, view) && inView(P[f.from].views, view) && inView(P[f.to].views, view));

export type LineFilter = { custom: boolean; kinds: LineCat[]; off: number[]; players: string[]; between: boolean };
export const DEFAULT_LF: LineFilter = { custom: false, kinds: [...CAT_ORDER], off: [], players: [], between: false };
export function playerOk(f: Flow, lf: LineFilter) {
  if (!lf.players.length) return true;
  const a = lf.players.includes(f.from), b = lf.players.includes(f.to);
  return lf.between ? a && b : a || b;
}
export const kindOk = (f: Flow, lf: LineFilter) => catsOf(f).every((c) => lf.kinds.includes(c));
export function applyFilter(u: Flow[], lf: LineFilter): Flow[] {
  const off = new Set(lf.off);
  return u.filter((f) => !off.has(idOf(f)) && kindOk(f, lf) && playerOk(f, lf));
}

// ---------- URL hash ----------
export type HashState = { page?: number; view?: ViewSel; overlay?: Overlay; sel?: string; apath?: AgencyPath; step?: number; lf?: LineFilter; role?: string };
export function encodeHash(s: Required<Omit<HashState, "lf" | "role">> & { lf: LineFilter; role?: string }): string {
  const q = new URLSearchParams();
  q.set("p", String(s.page)); q.set("v", s.view); q.set("o", s.overlay); if (s.sel) q.set("s", s.sel); q.set("ap", s.apath); q.set("st", String(s.step)); if (s.role) q.set("r", s.role);
  const lf = s.lf;
  if (lf.custom) {
    q.set("L", "1");
    if (lf.kinds.length !== CAT_ORDER.length) q.set("k", lf.kinds.join("."));
    if (lf.off.length) { const offS = new Set(lf.off); if (lf.off.length > ALL.length / 2) q.set("on", ALL.map((_, i) => i).filter((i) => !offS.has(i)).join(".")); else q.set("off", lf.off.join(".")); }
    if (lf.players.length) q.set("pl", lf.players.join("."));
    if (lf.between) q.set("b", "1");
  }
  return q.toString();
}
export function decodeHash(h: string): HashState {
  const q = new URLSearchParams(h.replace(/^#/, ""));
  if (!q.has("v") && !q.has("L")) return {};
  const out: HashState = {};
  const views = ["all", "agency", "nonagency", "crt", "servicing"], ovs = ["money", "owner", "risk", "credit"];
  if (q.has("p")) out.page = Math.max(0, Math.min(8, Number(q.get("p")) || 0));
  if (views.includes(q.get("v") ?? "")) out.view = q.get("v") as ViewSel;
  if (ovs.includes(q.get("o") ?? "")) out.overlay = q.get("o") as Overlay;
  if (q.get("s") && P[q.get("s") as string]) out.sel = q.get("s") as string;
  if (["swap", "cash", "ginnie"].includes(q.get("ap") ?? "")) out.apath = q.get("ap") as AgencyPath;
  if (/^[a-z]{2,20}$/.test(q.get("r") ?? "")) out.role = q.get("r") as string;
  if (q.has("st")) out.step = Math.max(0, Number(q.get("st")) || 0);
  if (q.get("L") === "1") {
    const nums = (k: string) => (q.get(k) ?? "").split(".").filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < ALL.length);
    const kinds = q.has("k") ? (q.get("k") as string).split(".").filter((k): k is LineCat => (CAT_ORDER as string[]).includes(k)) : [...CAT_ORDER];
    let off = nums("off");
    if (q.has("on")) { const on = new Set(nums("on")); off = ALL.map((_, i) => i).filter((i) => !on.has(i)); }
    out.lf = { custom: true, kinds, off, players: (q.get("pl") ?? "").split(".").filter((id) => !!P[id]), between: q.get("b") === "1" };
  }
  return out;
}
