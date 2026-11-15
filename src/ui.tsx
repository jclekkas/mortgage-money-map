import { useState, useRef, useEffect } from "react";
import type { ReactNode, CSSProperties } from "react";
import { G } from "./data";

// Dotted industry term with a plain-English tooltip: "Industry term (everyday analogy)".
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const g = G[k];
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!g) return <>{children}</>;
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(280, window.innerWidth - 20);
    const x = Math.max(10, Math.min(r.left, window.innerWidth - w - 10));
    const below = r.bottom + 170 < window.innerHeight;
    setPos({ x, y: below ? r.bottom + 6 : Math.max(10, r.top - 6 - 150) });
  };
  return (
    <span ref={ref} className="term" tabIndex={0} role="button" aria-label={`${g[0]} (${g[1]}): ${g[2]}`} onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)} onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : show(); }}>
      {children ?? `${g[0]} (${g[1]})`}
      {pos && (
        <span className="tip" style={{ left: pos.x, top: pos.y }} role="tooltip">
          <span className="t1" style={{ display: "block" }}>{g[0]}</span>
          <span className="t2" style={{ display: "block" }}>Think of it as: {g[1]}</span>
          {g[2]}
        </span>
      )}
    </span>
  );
}

export function Panel({ title, right, children, tight, style, className, tour }: { title?: ReactNode; right?: ReactNode; children?: ReactNode; tight?: boolean; style?: CSSProperties; className?: string; tour?: string }) {
  return (
    <section className={"panel " + (className ?? "")} style={style} data-tour={tour}>
      {(title || right) && <div className="panel-h"><h2>{title}</h2>{right}</div>}
      <div className={"panel-b" + (tight ? " tight" : "")}>{children}</div>
    </section>
  );
}

export function Metric({ k, v, d, tone }: { k: ReactNode; v: ReactNode; d?: ReactNode; tone?: "up" | "down" | "amber" }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className={"v num " + (tone ?? "")}>{v}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}

export function Slider({ label, value, min, max, step, fmt, onChange, id }: { label: ReactNode; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; id?: string }) {
  return (
    <div className="slider">
      <div className="row"><span>{label}</span><span className="val num">{fmt(value)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-label={typeof label === "string" ? label : undefined} onChange={(e) => onChange(Number(e.currentTarget.value))} />
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange, className, label }: { options: { value: T; label: ReactNode; cls?: string }[]; value: T; onChange: (v: T) => void; className?: string; label?: string }) {
  return (
    <div className={"seg " + (className ?? "")} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={(o.value === value ? "on " : "") + (o.cls ?? "")} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ label, value, onChange }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={"switch " + (value ? "on" : "")} role="switch" aria-checked={value} onClick={() => onChange(!value)} style={{ border: 0, background: "transparent", padding: 0 }}>
      <span className="track" /> <span>{label}</span>
    </button>
  );
}

export function Rating({ g }: { g: string }) {
  return <span className={"rating r-" + g}>{g === "NR" ? "NR" : g}</span>;
}

export function Tag({ tone, children }: { tone: "ok" | "bad" | "warn" | "n" | "acc"; children: ReactNode }) {
  return <span className={"chip-tag tag-" + tone}>{children}</span>;
}

export function Props({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="props">
      {items.map((it, i) => [<div key={"k" + i} className="pk">{it.label}</div>, <div key={"v" + i} className="pv">{it.value}</div>])}
    </div>
  );
}

export function Tbl({ cols, rows, right }: { cols: ReactNode[]; rows: ReactNode[][]; right?: number[] }) {
  const r = new Set(right ?? []);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{cols.map((c, i) => <th key={i} className={r.has(i) ? "r" : ""}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, j) => <tr key={j}>{row.map((c, i) => <td key={i} className={(r.has(i) ? "r num" : "")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function QuizBlock({ q, ans, onAns }: { q: { q: string; opts: string[]; ok: number; why: string }; ans: number | undefined; onAns: (i: number) => void }) {
  return (
    <div>
      <div className="quiz-q">{q.q}</div>
      <div className="quiz-opts">
        {q.opts.map((o, i) => (
          <button key={o} className={"chip " + (ans === i ? (i === q.ok ? "ok" : "no") : "")} onClick={() => onAns(i)} aria-pressed={ans === i}>{o}</button>
        ))}
      </div>
      {ans !== undefined && (
        <div className="quiz-why"><b className={ans === q.ok ? "up" : "amber"}>{ans === q.ok ? "Correct! " : "Not quite. "}</b>{q.why}</div>
      )}
    </div>
  );
}

// smoothly animate a number toward a target (for counters)
export function useTween(target: number, ms = 500): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = target;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      const x = a + (b - a) * e;
      setV(x); from.current = x;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export type Toast = { id: number; title: string; detail?: string; kind?: "badge-t" | "good" | "bad" | "" };
export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={"toast " + (t.kind ?? "")}>
          <div className="tt">{t.title}</div>
          {t.detail && <div className="td">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}
