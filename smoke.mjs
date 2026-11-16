// Headless smoke test: desktop 1440x900 + mobile 390x844. Checks console errors, external requests,
// horizontal overflow, and overlapping text (every visible text line box vs every other).
import puppeteer from "puppeteer-core";
import http from "http"; import fs from "fs";
const srv = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end(fs.readFileSync("dist/index.html")); }).listen(4181);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"], headless: "new" });
const SHOTS = "/workspace/mortgage-map-shots"; fs.mkdirSync(SHOTS, { recursive: true });
const errors = [], notes = [], overlaps = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OVERLAP = () => {
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false; } return true; };
  const clipOf = (el) => { let r = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }; for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|hidden|scroll|clip)/.test(cs.overflowX + cs.overflowY)) { const b = e.getBoundingClientRect(); r = { l: Math.max(r.l, b.left), t: Math.max(r.t, b.top), r: Math.min(r.r, b.right), b: Math.min(r.b, b.bottom) }; } } return r; };
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest(".tip,.tour-card,.scrim,.toasts,style,script")) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const c = clipOf(el);
    for (const r of rg.getClientRects()) { const x = { l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) }; if (x.r - x.l > 1 && x.b - x.t > 1) items.push({ el, txt: n.textContent.trim().slice(0, 40), ...x }); }
  }
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el === b.el) continue; if (!!a.el.closest(".sticky-own") !== !!b.el.closest(".sticky-own")) continue; if (!!a.el.closest(".lf-sheet,.lf-menu") !== !!b.el.closest(".lf-sheet,.lf-menu")) continue;
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox > 2 && oy > 3) out.push(`"${a.txt}" x "${b.txt}"`);
  }
  return [...new Set(out)];
};
async function open(tag, vp) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(vp);
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${tag} ${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on("request", (r) => { if (!/^(http:\/\/localhost:4181|data:)/.test(r.url())) errors.push(`${tag} external request ${r.url()}`); });
  await page.goto("http://localhost:4181/", { waitUntil: "load" }); await sleep(300);
  const click = async (txt, sel = "button") => { const ok = await page.evaluate((txt, sel) => { const b = [...document.querySelectorAll(sel)].find((x) => (x.textContent.trim().includes(txt) || (x.getAttribute("aria-label") || "").includes(txt)) && !x.disabled && x.getClientRects().length); if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; } return false; }, txt, sel); if (!ok) errors.push(`${tag} could not click "${txt}"`); await sleep(120); return ok; };
  const node = async (id) => { await page.evaluate((id) => document.querySelector(`[data-node="${id}"]`).dispatchEvent(new MouseEvent("click", { bubbles: true })), id); await sleep(120); };
  const check = async (label) => { const o = await page.evaluate(OVERLAP); if (o.length) overlaps.push(`${tag} [${label}] ${o.slice(0, 8).join(" | ")}${o.length > 8 ? ` (+${o.length - 8})` : ""}`); const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 ? `page ${document.documentElement.scrollWidth}` : ""); if (ov) overlaps.push(`${tag} [${label}] horizontal overflow ${ov}`); };
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
  return { page, click, node, check, shot };
}
const ROLE_IDS = ["servicer", "pmi", "crt", "wholeloan", "whlender", "analyst", "aggregator"];
const ROLE_NODES = { servicer: "servicer", mi: "pmi", cas: "crt", dealers: "wholeloan", warehouse: "whlender", rocket: "analyst", pennymac: "aggregator", msrowner: "aggregator", uwm: "analyst", creditinv: "crt" };
async function roleTests(D, tag, strip) {
  const P = D.page, T = (id) => `[data-testid="${id}"]`;
  const tclick = async (sel, i = 0) => { const ok = await P.evaluate((sel, i) => { const b = [...document.querySelectorAll(sel)].filter((x) => x.getClientRects().length)[i]; if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; } return false; }, sel, i); if (!ok) errors.push(`${tag} could not click ${sel}#${i}`); await sleep(90); return ok; };
  const setVal = (sel, v) => P.evaluate((sel, v) => { const el = document.querySelector(sel); const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(v)); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, sel, v);
  const into = async (sel) => { await P.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), sel); await sleep(150); };
  const total = () => P.evaluate(() => document.querySelector('[data-testid="role-total"]')?.textContent ?? "NONE");
  const playDefaults = async () => { for (let q = 0; q < 9 && await P.$(T("role-run")); q++) await tclick(T("role-run")); };
  await D.click("Play a role", strip); await sleep(250);
  if (await P.$(".role-top")) await D.click("All roles");
  await D.check("roles picker"); await P.evaluate(() => document.querySelector(".main").scrollTo(0, 0)); await D.shot(`${tag}-role-picker`);
  for (const id of ROLE_IDS) {
    await tclick(T("role-pick-" + id)); await sleep(150);
    await D.check(`role ${id} intro`);
    if (!(await P.$(T("role-tip")))) errors.push(`${tag} ${id} missing beginner tip`);
    await P.evaluate(() => document.querySelector(".role-terms .term")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(100); await D.check(`role ${id} term tip`); await P.evaluate(() => document.body.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    if (id === "servicer" || id === "analyst") { await P.evaluate(() => document.querySelector(".main").scrollTo(0, 0)); await D.shot(`${tag}-role-${id}-intro`); }
    await setVal(T("role-scn"), "random"); await setVal(T("role-seed"), 7); await sleep(80);
    await tclick(T("role-start")); await sleep(150);
    const nq = await P.evaluate(() => document.querySelectorAll(".role-prog i").length);
    let warned = 0;
    for (let q = 0; q < nq; q++) {
      if (!(await P.$(T("role-run")))) { errors.push(`${tag} ${id} no run button at Q${q + 1}`); break; }
      if (await P.$(T("role-warn"))) warned++;
      const keys = await P.evaluate(() => [...document.querySelectorAll('[data-testid^="role-d-"]')].map((d) => [d.getAttribute("data-testid"), d.querySelectorAll(".seg button").length]));
      for (const [k, n] of keys) if (n) await tclick(`[data-testid="${k}"] .seg button`, (q + k.length) % n);
      if (q === 0) { await tclick(`[data-testid="${keys[0][0]}"] .rd-q`); await D.check(`role ${id} tip`); }
      await D.check(`role ${id} Q${q + 1} decisions`);
      if (q === 2) { await into(".role-prog"); await D.shot(`${tag}-role-${id}-play`); if (tag === "desktop") { await into(".role-dash"); await D.shot(`${tag}-role-${id}-dashboard`); } }
      await tclick(T("role-run")); await sleep(120);
      await D.check(`role ${id} after Q${q + 1}`);
    }
    const sc = await P.$(T("role-score"));
    if (!sc) errors.push(`${tag} ${id} no scorecard`);
    const g = await P.evaluate(() => `${document.querySelector(".rs-grade")?.textContent} ${document.querySelector(".rs-n")?.textContent}`);
    const t1 = await total();
    await D.check(`role ${id} scorecard`); await into(".role-score"); await D.shot(`${tag}-role-${id}-score`);
    // determinism: same seed + default decisions twice -> same total
    await tclick(T("role-replay")); await playDefaults(); const a = await total();
    await tclick(T("role-replay")); await playDefaults(); const b = await total();
    if (a !== b || a === "NONE") errors.push(`${tag} ${id} not deterministic: ${a} vs ${b}`);
    notes.push(`${tag} role ${id}: ${nq} quarters, varied play total ${t1} grade ${g}, early warnings ${warned}; defaults seed 7 total ${a} == ${b}`);
    await tclick(T("role-newseed")); await playDefaults(); await D.check(`role ${id} new seed`);
    notes.push(`${tag} role ${id} new seed total ${await total()}`);
    await D.click("All roles");
  }
  // entry points: player card "Play this role"
  await D.click("Money map", strip); await sleep(250); await D.click("Everything", ".seg button"); await D.click("Money flows", ".seg button");
  if (await P.$(".lf-count-bar, [data-testid=lf-count-bar]")) { /* filter state left from earlier tests */ }
  for (const [node, rid] of Object.entries(ROLE_NODES)) {
    if (!(await P.$(`[data-node="${node}"]`))) { errors.push(`${tag} entry node ${node} missing`); continue; }
    await D.node(node); await sleep(120);
    if (tag === "mobile") await P.evaluate(() => document.querySelector('.m-only [data-testid="play-role"]')?.scrollIntoView({ block: "center" }));
    const ok = await tclick(T("play-role")); await sleep(250);
    const r = await P.evaluate(() => [document.querySelector(".stage-strip .chip.on")?.textContent, document.querySelector(".main h1")?.textContent, location.hash.match(/r=([a-z]+)/)?.[1]]);
    if (!ok || !r[0]?.includes("Play a role") || r[2] !== rid) errors.push(`${tag} entry ${node} -> ${JSON.stringify(r)} expected ${rid}`);
    if (node === "warehouse") { await D.check("entry warehouse"); await P.evaluate(() => document.querySelector(".main").scrollTo(0, 0)); await D.shot(`${tag}-role-entry-warehouse`); }
    await D.click("Money map", strip); await sleep(200);
  }
  notes.push(`${tag} entry points tested: ${Object.keys(ROLE_NODES).length}`);
  if (tag === "desktop") { await D.node("pennymac"); await sleep(150); await D.shot("desktop-playercard-play-button"); }
}
for (const [tag, vp, strip] of [["desktop", { width: 1440, height: 900 }, ".stage-strip button"], ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, ".stage-strip button"]]) {
  const D = await open(tag, vp);
  notes.push(`${tag} first-visit tour: ${await D.page.evaluate(() => document.querySelector(".tour-card h4")?.textContent)}`);
  await D.shot(`${tag}-tour-welcome`);
  for (let i = 0; i < 3; i++) await D.click("Next", ".tour-card button");
  await sleep(400); await D.shot(`${tag}-tour-map`);
  await D.click("Skip tour", ".tour-card button");
  await D.check("map default");
  await D.shot(`${tag}-map-default`);
  if (process.env.ONLY === "roles") { await roleTests(D, tag, strip); continue; }
  // views x overlays, select every node in each view to exercise hot labels
  for (const v of ["Everything", "Agency", "Non-agency", "CRT", "Servicing"]) {
    await D.click(v, ".seg button");
    for (const ov of ["Money flows", "Who owns what", "Who takes which risk", "Credit refreshes"]) {
      await D.click(ov, ".seg button");
      const ids = await D.page.evaluate(() => [...document.querySelectorAll("[data-node]")].map((g) => g.getAttribute("data-node")));
      for (const id of ids) { await D.node(id); const o = await D.page.evaluate(OVERLAP); if (o.length) overlaps.push(`${tag} [${v}/${ov}/${id}] ${o.slice(0, 5).join(" | ")}`); }
      const steps = await D.page.evaluate(() => document.querySelectorAll(".ob-dots button").length);
      for (let s = 0; s < steps; s++) { await D.page.evaluate((s) => document.querySelectorAll(".ob-dots button")[s].dispatchEvent(new MouseEvent("click", { bubbles: true })), s); await sleep(60); await D.check(`${v}/${ov}/step${s + 1}`); }
    }
  }
  await D.click("Everything", ".seg button"); await D.click("Money flows", ".seg button"); await D.node("fannie");
  await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(200);
  notes.push(`${tag} topbar owner: ${await D.page.evaluate(() => [...document.querySelectorAll(".own-chip")].map((c) => c.innerText.replace(/\s+/g, " ")).join(" | "))}`);
  notes.push(`${tag} labels drawn for Fannie Mae: ${await D.page.evaluate(() => document.querySelectorAll(".mm-lbl").length)}, dots ${await D.page.evaluate(() => document.querySelectorAll(".mm-svg circle animateMotion").length)}`);
  if (tag === "desktop") { await D.page.evaluate(() => document.querySelector("[data-tour=map]").scrollIntoView()); await sleep(1200); await D.shot(`${tag}-map-fannie-flows`); }
  else { await D.page.evaluate(() => { const m = document.querySelector(".main"); m.scrollTo(0, document.querySelector("[data-tour=map]").offsetTop - 120); }); await sleep(1200); await D.shot(`${tag}-map-fannie-flows`); }
  await D.click("Who owns what", ".seg button"); await D.click("Non-agency", ".seg button"); await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(400); await D.shot(`${tag}-map-owner-nonagency`);
  await D.click("Who takes which risk", ".seg button"); await D.click("Everything", ".seg button"); await D.click("Prepayment risk", ".chip"); await D.click("2008 then vs now", ".switch"); await sleep(300); await D.shot(`${tag}-map-risk-2008`); await D.check("risk+2008");
  await D.click("2008 then vs now", ".switch"); await D.click("Money flows", ".seg button");
  // quirk: repay arrow only on the settlement step
  { const repay = async (s) => { await D.page.evaluate((s) => document.querySelectorAll(".ob-dots button")[s].dispatchEvent(new MouseEvent("click", { bubbles: true })), s); await sleep(120); return D.page.evaluate(() => [...document.querySelectorAll(".mm-svg title")].filter((t) => t.textContent.includes("sale proceeds repay line")).length); };
    await D.page.evaluate(() => document.querySelector(".mm-node.on")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))); await D.click("Clear"); notes.push(`${tag} repay arrow by step (no selection): ${[await repay(0), await repay(1), await repay(2), await repay(3)].join(",")}`); await repay(0); }
  // credit refreshes overlay
  await D.click("Credit refreshes", ".seg button"); await sleep(300);
  notes.push(`${tag} credit overlay: gauges ${await D.page.evaluate(() => document.querySelectorAll(".mm-gauge").length)}, markers ${await D.page.evaluate(() => document.querySelectorAll(".mm-ccmark").length)}, heat ${await D.page.evaluate(() => document.querySelectorAll(".mm-heat").length)}, edges ${await D.page.evaluate(() => document.querySelectorAll(".mm-edge").length)}, top list ${await D.page.evaluate(() => [...document.querySelectorAll("[data-top]")].map((b) => b.getAttribute("data-top") + " " + b.querySelector(".cc-top-v").innerText.replace(/\s+/g, " ")).slice(0, 4).join("; "))}`);
  await D.check("credit overlay default");
  if (tag === "desktop") { await D.page.evaluate(() => document.querySelector("[data-tour=map]").scrollIntoView()); } else { await D.page.evaluate(() => { const m = document.querySelector(".main"); m.scrollTo(0, document.querySelector("[data-tour=map]").offsetTop - 120); document.querySelector('[data-node="servicer"]').scrollIntoView({ block: "center", inline: "center" }); }); }
  await sleep(600); await D.shot(`${tag}-credit-overlay`);
  await D.page.evaluate(() => document.querySelector('[data-ccmark="servicer"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(300);
  notes.push(`${tag} marker click -> card: ${await D.page.evaluate(() => { const c = document.querySelector(innerWidth > 860 ? ".side [data-testid=credit-card]" : ".main [data-testid=credit-card]"); return c ? c.querySelector(".pc-h").textContent + " | " + c.querySelectorAll(".cc-case").length + " use cases | " + c.querySelector(".cc-gauge-row").innerText.replace(/\s+/g, " ").slice(0, 120) : "NO CARD"; })}`);
  await D.check("credit servicer selected"); await sleep(300); await D.shot(`${tag}-credit-servicer`);
  if (tag === "desktop") { await D.page.evaluate(() => document.querySelector(".side-body").scrollTo(0, 0)); }
  await D.page.evaluate(() => document.querySelector('[data-top="msrowner"]').dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(500);
  notes.push(`${tag} top list click msrowner -> sel=${await D.page.evaluate(() => document.querySelector(".mm-node.on")?.getAttribute("data-node"))} flash=${await D.page.evaluate(() => !!document.querySelector(".mm-node.flash"))}`);
  await D.check("credit msr selected");
  for (const id of ["bureaus", "scores", "rocket", "fannie", "cas", "warehouse"]) { await D.node(id); await D.check(`credit ${id}`); }
  await D.page.evaluate(() => { const b = [...document.querySelectorAll(".life-dot.could")][3]; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await sleep(300); await D.check("life strip click");
  await D.click("Clear"); await D.click("Money flows", ".seg button");
  // ---------- line filter ----------
  {
    const P = D.page; const edges = () => P.evaluate(() => document.querySelectorAll(".mm-svg .mm-edge").length);
    const bar = () => P.evaluate(() => document.querySelector("[data-testid=lf-count-bar]").innerText);
    const scrollMap = async () => { if (tag === "desktop") await P.evaluate(() => document.querySelector("[data-tour=map]").scrollIntoView()); else await P.evaluate(() => { const m = document.querySelector(".main"); m.scrollTo(0, document.querySelector("[data-tour=map]").offsetTop - 140); }); await sleep(500); };
    await D.click("Everything", ".seg button"); await D.click("Money flows", ".seg button");
    await P.evaluate(() => document.querySelector("[data-testid=lf-toggle]").click()); await sleep(250);
    notes.push(`${tag} filter open (auto): ${await bar()} | kinds ${await P.evaluate(() => [...document.querySelectorAll("[data-kind]")].map((b) => b.dataset.kind + "=" + b.querySelector(".lf-n").innerText).join(" "))} | rows ${await P.evaluate(() => document.querySelectorAll("[data-flow]").length)}`);
    await D.check("filter open auto");
    await D.click("Show all", ".lf button"); await sleep(200); notes.push(`${tag} show all: edges=${await edges()} | ${await bar()}`); await D.check("filter all lines");
    if (tag === "desktop") await P.evaluate(() => document.querySelector("[data-testid=lf-toggle]").scrollIntoView()); await sleep(300); await D.shot(`${tag}-filter-panel`);
    await P.evaluate(() => document.querySelector('[data-kind="fees"]').click()); await sleep(150); notes.push(`${tag} fees off: edges=${await edges()}`);
    await P.evaluate(() => document.querySelector('[data-kind="fees"]').click()); await sleep(100);
    await P.evaluate(() => document.querySelector('[data-player="fannie"]').click()); await sleep(150); const fe = await edges();
    await P.evaluate(() => document.querySelector('[data-player="agencytrust"]').click()); await D.click("Only lines between selected players", ".lf .switch"); await sleep(150);
    notes.push(`${tag} player fannie: edges=${fe}; fannie+trust between-only: edges=${await edges()}`); await D.check("filter players");
    await P.evaluate(() => { const i = document.querySelector(".lf-search[aria-label='Search lines']"); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(i, "g-fee"); i.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(150);
    const soloTxt = await P.evaluate(() => { const b = document.querySelector("[data-solo]"); const t = b.getAttribute("aria-label"); b.click(); return t; }); await sleep(250);
    const n1 = await edges(); if (n1 !== 1) errors.push(`${tag} SOLO rendered ${n1} paths, expected exactly 1`);
    notes.push(`${tag} SOLO "${soloTxt}": paths=${n1} | ${await bar()} | label pills=${await P.evaluate(() => document.querySelectorAll(".mm-svg .mm-lbl:not(.mm-badge)").length)} badges=${await P.evaluate(() => document.querySelectorAll(".mm-badge").length)} | shown list=${await P.evaluate(() => document.querySelectorAll("[data-testid=lines-shown] li").length)}`);
    await D.check("filter solo panel open");
    if (tag === "mobile") { await P.evaluate(() => document.querySelector(".lf-sheet").scrollTo(0, 0)); await sleep(150); await D.shot("mobile-filter-sheet"); }
    await D.click("Done", ".lf button"); await scrollMap(); await D.check("filter solo"); await D.shot(`${tag}-filter-solo`);
    const hash = await P.evaluate(() => location.hash); notes.push(`${tag} hash: ${hash}`);
    await P.reload({ waitUntil: "load" }); await sleep(500);
    const n2 = await edges(); if (n2 !== 1) errors.push(`${tag} after reload with hash rendered ${n2} paths, expected 1`); notes.push(`${tag} reload from hash: paths=${n2} | ${await bar()}`);
    await P.evaluate(() => document.querySelector("[data-testid=lf-toggle]").click()); await sleep(200);
    await D.click("Clear all", ".lf button"); await sleep(150); notes.push(`${tag} clear all: paths=${await edges()}`);
    await D.click("Select all", ".lf button"); await sleep(150); notes.push(`${tag} select all: paths=${await edges()}`);
    await D.click("Done", ".lf button"); await D.click("Reset lines"); await sleep(150);
    // click one arrow -> "Show only this line"
    await scrollMap();
    await P.evaluate(() => { const p = document.querySelector(".mm-svg [data-line]"); const b = p.getBoundingClientRect(); p.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); }); await sleep(200);
    notes.push(`${tag} line menu: ${await P.evaluate(() => document.querySelector("[data-testid=line-menu] .lf-menu-t")?.textContent ?? "NO MENU")}`);
    await D.check("line menu"); if (tag === "desktop") await D.shot("desktop-line-menu");
    await D.click("Show only this line", ".lf-menu button"); await sleep(200);
    const n3 = await edges(); if (n3 !== 1) errors.push(`${tag} line menu solo rendered ${n3} paths`); notes.push(`${tag} line menu solo: paths=${n3}`);
    await D.node("fannie"); notes.push(`${tag} solo + click fannie: paths=${await edges()}`); await D.click("Clear"); await D.click("Reset lines"); await sleep(150);
    notes.push(`${tag} after reset: ${await bar()}`);
  }
  // other pages
  const pages = ["Who owns it?", "Follow one payment", "Who takes which risk", "2008: then vs now", "Credit checks", "Play a role", "Glossary", "Check yourself"];
  for (const [i, p] of pages.entries()) {
    await D.click(p, strip); await sleep(250);
    if (p === "Who owns it?") { for (const r of ["Fannie Mae swap", "Cash window", "Ginnie Mae", "Private-label", "Credit risk transfer", "Servicing rights"]) { await D.click(r, ".chip"); const n = await D.page.evaluate(() => document.querySelectorAll(".ob-dots button").length); for (let s = 0; s < n; s++) { await D.page.evaluate((s) => document.querySelectorAll(".ob-dots button")[s].dispatchEvent(new MouseEvent("click", { bubbles: true })), s); await sleep(50); await D.check(`own ${r} step ${s + 1}`); } } await D.click("Fannie Mae swap", ".chip"); await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(200); }
    if (p === "Follow one payment") { await D.click("Play the split"); await sleep(3500); await D.check("dollar mid-play"); await sleep(4000); await D.page.evaluate(() => { const i = document.querySelector('input[type=range]'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(i, "120"); i.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(200); notes.push(`${tag} dollar table: ${await D.page.evaluate(() => [...document.querySelectorAll(".main .tbl tbody tr")].slice(0, 6).map((r) => r.lastChild.innerText).join(", "))}`); await D.click("FHA (Ginnie Mae MBS)", ".seg button"); await sleep(200); await D.check("dollar fha"); await D.click("Conventional", ".seg button"); }
    if (p === "Check yourself") { for (let q = 0; q < await D.page.evaluate(() => document.querySelectorAll(".quiz-opts").length); q++) await D.page.evaluate((q) => document.querySelectorAll(".quiz-opts")[q].querySelectorAll(".chip")[1].dispatchEvent(new MouseEvent("click", { bubbles: true })), q); await sleep(200); notes.push(`${tag} quiz: ${await D.page.evaluate(() => [...document.querySelectorAll(".main .metric .v")].map((v) => v.innerText).join(" / "))}`); }
    if (p === "Credit checks") {
      const metrics = async () => D.page.evaluate(() => [...document.querySelectorAll(".main .metric .v")].map((v) => v.innerText).join(" / "));
      notes.push(`${tag} credit page base: ${await metrics()}`);
      for (const g of ["Origination", "Loan sale", "Servicing", "Trading", "Other"]) { await D.click(g, ".seg button"); await D.check(`credit table ${g}`); }
      const setR = (id, v) => D.page.evaluate((id, v) => { const i = document.getElementById(id); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(i, String(v)); i.dispatchEvent(new Event("input", { bubbles: true })); }, id, v);
      await setR("cc-fm", 2); await sleep(150); notes.push(`${tag} credit page refresh x2: ${await metrics()}`);
      await setR("cc-pulls", 12); await sleep(150); notes.push(`${tag} credit page + P1 monthly: ${await metrics()}`);
      await D.check("credit sliders"); await D.click("Reset"); notes.push(`${tag} credit page reset: ${await metrics()}`);
      notes.push(`${tag} report link: ${await D.page.evaluate(() => [...document.querySelectorAll(".main a")].find((a) => a.href.includes("721375f6"))?.href ?? "MISSING")}`);
      await D.click("Servicing", ".seg button");
    }
    if (p === "Glossary") notes.push(`${tag} glossary terms: ${await D.page.evaluate(() => document.querySelectorAll(".main .dict-item").length)}`);
    await D.check(p);
    await D.page.evaluate(() => document.querySelector(".main").scrollTo(0, 0)); await sleep(150);
    await D.shot(`${tag}-${i + 2}-${p.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/-$/, "")}`);
  }
  // ownership chips: from another page, click -> map page, owner selected, in view, card opened
  for (const [k, pg, step] of [["loan", "Follow one payment", 3], ["sec", "Who takes which risk", 3]]) {
    await D.click(pg, strip); await sleep(200);
    await D.page.evaluate((s) => { const b = [...document.querySelectorAll(".topbar .icon-btn")]; }, step);
    await D.click(k === "loan" ? "Loan owner" : "Bond (MBS) owner", ".own-chip"); await sleep(1300);
    const r = await D.page.evaluate(() => { const on = document.querySelector(".mm-node.on"); const id = on?.getAttribute("data-node"); const b = on?.getBoundingClientRect(); const vis = b && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; const flash = !!document.querySelector(".mm-node.flash"); const page = document.querySelector(".stage-strip .chip.on")?.textContent; const card = (document.querySelector(innerWidth > 860 ? ".side .pc-h" : ".main .pc-h"))?.textContent; return `${page} | sel=${id} inViewport=${vis} flash=${flash} card="${card}"`; });
    notes.push(`${tag} ${k} chip -> ${r}`);
    await D.check(`after ${k} chip`);
    await D.shot(`${tag}-owner-chip-${k}`);
  }
  notes.push(`${tag} chip hover cursor: ${await D.page.evaluate(() => getComputedStyle(document.querySelector(".own-chip")).cursor)}; disabled bond chip at step 1: pending`);
  await roleTests(D, tag, strip);
  // mobile tabs / side panel
  if (tag === "mobile") { await D.click("Player", ".mtabs button"); await sleep(200); await D.check("mobile player tab"); await D.shot("mobile-player-tab"); await D.click("Glossary", ".mtabs button"); await D.check("mobile glossary tab"); await D.click("Explore", ".mtabs button"); }
  else { await D.click("Glossary", ".side-tabs .tab"); await D.check("side glossary"); await D.click("Player", ".side-tabs .tab"); }
  // replay tour
  await D.click("Replay the guided tour", tag === "mobile" ? ".mtabs button" : ".topbar button"); await sleep(300);
  notes.push(`${tag} replay tour: ${await D.page.evaluate(() => document.querySelector(".tour-card h4")?.textContent)}`);
  await D.click("Next", ".tour-card button"); await sleep(400); await D.shot(`${tag}-tour-replay-owner`);
  // light theme quick
  await D.click("Skip tour", ".tour-card button");
  if (tag === "desktop") { await D.click("Switch light or dark mode", ".topbar button"); await sleep(300); await D.shot("desktop-light-map"); await D.check("light"); }
}
console.log("NOTES\n" + notes.join("\n"));
console.log("ERRORS " + errors.length + "\n" + errors.slice(0, 30).join("\n"));
{ const pairs = new Map(); for (const o of overlaps) { const m = o.match(/^(\S+) \[([^\]]*)\] (.*)$/); for (const p of (m ? m[3] : o).split(" | ")) { const k = m[1] + " " + p; if (!pairs.has(k)) pairs.set(k, m[2]); } } console.log("OVERLAPS " + overlaps.length + " distinct " + pairs.size); for (const [k, v] of pairs) console.log(k + "   <- " + v); }
await browser.close(); srv.close();
