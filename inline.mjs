// Inline the bundled JS into index.html so the site also works when opened straight from disk (file://).
import fs from "fs";
import path from "path";
const dist = "dist";
const htmlPath = path.join(dist, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const re = /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>\s*/;
const m = html.match(re);
if (!m) throw new Error("bundle script tag not found");
const js = fs.readFileSync(path.join(dist, m[1]), "utf8").replace(/<\/script/gi, "<\\/script");
html = html.replace(re, "");
html = html.replace("</body>", () => `<script type="module">\n${js}\n</script>\n</body>`);
fs.writeFileSync(htmlPath, html);
fs.rmSync(path.join(dist, "assets"), { recursive: true, force: true });
console.log("inlined", m[1], "->", htmlPath, html.length, "bytes");
