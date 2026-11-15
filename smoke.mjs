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
    const a = items[i], b = items[j]; if (a.el === b.el) continue; if (!!a.el.closest(".sticky-own") !== !!b.el.closest(".sticky-own")) continue;
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
for (const [tag, vp, strip] of [["desktop", { width: 1440, height: 900 }, ".stage-strip button"], ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, ".stage-strip button"]]) {
  const D = await open(tag, vp);
  notes.push(`${tag} first-visit tour: ${await D.page.evaluate(() => document.querySelector(".tour-card h4")?.textContent)}`);
  await D.shot(`${tag}-tour-welcome`);
  for (let i = 0; i < 3; i++) await D.click("Next", ".tour-card button");
  await sleep(400); await D.shot(`${tag}-tour-map`);
  await D.click("Skip tour", ".tour-card button");
  await D.check("map default");
  await D.shot(`${tag}-map-default`);
  // views x overlays, select every node in each view to exercise hot labels
  for (const v of ["Everything", "Agency", "Non-agency", "CRT", "Servicing"]) {
    await D.click(v, ".seg button");
    for (const ov of ["Money flows", "Who owns what", "Who takes which risk"]) {
      await D.click(ov, ".seg button");
      const ids = await D.page.evaluate(() => [...document.querySelectorAll("[data-node]")].map((g) => g.getAttribute("data-node")));
      for (const id of ids) { await D.node(id); const o = await D.page.evaluate(OVERLAP); if (o.length) overlaps.push(`${tag} [${v}/${ov}/${id}] ${o.slice(0, 5).join(" | ")}`); }
      const steps = await D.page.evaluate(() => document.querySelectorAll(".ob-dots button").length);
      for (let s = 0; s < steps; s++) { await D.page.evaluate((s) => document.querySelectorAll(".ob-dots button")[s].dispatchEvent(new MouseEvent("click", { bubbles: true })), s); await sleep(60); await D.check(`${v}/${ov}/step${s + 1}`); }
    }
  }
  await D.click("Everything", ".seg button"); await D.click("Money flows", ".seg button"); await D.node("fannie");
  await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(200);
  notes.push(`${tag} topbar owner: ${await D.page.evaluate(() => [...document.querySelectorAll(".own-cell")].map((c) => c.innerText.replace(/\s+/g, " ")).join(" | "))}`);
  notes.push(`${tag} labels drawn for Fannie Mae: ${await D.page.evaluate(() => document.querySelectorAll(".mm-lbl").length)}, dots ${await D.page.evaluate(() => document.querySelectorAll(".mm-svg circle animateMotion").length)}`);
  if (tag === "desktop") { await D.page.evaluate(() => document.querySelector("[data-tour=map]").scrollIntoView()); await sleep(1200); await D.shot(`${tag}-map-fannie-flows`); }
  else { await D.page.evaluate(() => { const m = document.querySelector(".main"); m.scrollTo(0, document.querySelector("[data-tour=map]").offsetTop - 120); }); await sleep(1200); await D.shot(`${tag}-map-fannie-flows`); }
  await D.click("Who owns what", ".seg button"); await D.click("Non-agency", ".seg button"); await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(400); await D.shot(`${tag}-map-owner-nonagency`);
  await D.click("Who takes which risk", ".seg button"); await D.click("Everything", ".seg button"); await D.click("Prepayment risk", ".chip"); await D.click("2008 then vs now", ".switch"); await sleep(300); await D.shot(`${tag}-map-risk-2008`); await D.check("risk+2008");
  await D.click("2008 then vs now", ".switch"); await D.click("Money flows", ".seg button");
  // other pages
  const pages = ["Who owns it?", "Follow one payment", "Who takes which risk", "2008: then vs now", "Glossary", "Check yourself"];
  for (const [i, p] of pages.entries()) {
    await D.click(p, strip); await sleep(250);
    if (p === "Who owns it?") { for (const r of ["Fannie Mae swap", "Cash window", "Ginnie Mae", "Private-label", "Credit risk transfer", "Servicing rights"]) { await D.click(r, ".chip"); const n = await D.page.evaluate(() => document.querySelectorAll(".ob-dots button").length); for (let s = 0; s < n; s++) { await D.page.evaluate((s) => document.querySelectorAll(".ob-dots button")[s].dispatchEvent(new MouseEvent("click", { bubbles: true })), s); await sleep(50); await D.check(`own ${r} step ${s + 1}`); } } await D.click("Fannie Mae swap", ".chip"); await D.page.evaluate(() => document.querySelectorAll(".ob-dots button")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(200); }
    if (p === "Follow one payment") { await D.click("Play the split"); await sleep(3500); await D.check("dollar mid-play"); await sleep(4000); await D.page.evaluate(() => { const i = document.querySelector('input[type=range]'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(i, "120"); i.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(200); notes.push(`${tag} dollar table: ${await D.page.evaluate(() => [...document.querySelectorAll(".main .tbl tbody tr")].slice(0, 6).map((r) => r.lastChild.innerText).join(", "))}`); await D.click("FHA (Ginnie Mae MBS)", ".seg button"); await sleep(200); await D.check("dollar fha"); await D.click("Conventional", ".seg button"); }
    if (p === "Check yourself") { for (let q = 0; q < 10; q++) await D.page.evaluate((q) => document.querySelectorAll(".quiz-opts")[q].querySelectorAll(".chip")[1].dispatchEvent(new MouseEvent("click", { bubbles: true })), q); await sleep(200); notes.push(`${tag} quiz: ${await D.page.evaluate(() => [...document.querySelectorAll(".main .metric .v")].map((v) => v.innerText).join(" / "))}`); }
    if (p === "Glossary") notes.push(`${tag} glossary terms: ${await D.page.evaluate(() => document.querySelectorAll(".main .dict-item").length)}`);
    await D.check(p);
    await D.page.evaluate(() => document.querySelector(".main").scrollTo(0, 0)); await sleep(150);
    await D.shot(`${tag}-${i + 2}-${p.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/-$/, "")}`);
  }
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
