// Aufruf: node bench.mjs <pfad zu gomcts.js> [json-opt] [playouts]
import fs from "node:fs"; import { pathToFileURL } from "node:url"; import path from "node:path";
const lib = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const opt = JSON.parse(process.argv[3] || "{}"); const P = Number(process.argv[4] || 2000);
const rows = JSON.parse(fs.readFileSync(new URL("./board0.json", import.meta.url), "utf8"));
const n = rows.length; const g = new Uint8Array(n * n);
for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { const c = rows[x][y]; g[x * n + y] = c === "X" ? 1 : c === "O" ? 2 : c === "#" ? 3 : 0; }
// Mittelspielstellung: 60 Zuege je Seite zufaellig-legal ueber die Suche selbst waere teuer; einfach Startbrett und ein halbvolles Brett messen.
const mid = Uint8Array.from(g); let s = 12345; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let c = 1; for (let k = 0; k < 110; k++) { for (let t = 0; t < 50; t++) { const i = Math.floor(r() * n * n); if (mid[i] === 0) { const nb=[i-n,i+n,i-1,i+1].filter(q=>q>=0&&q<n*n); if (nb.some(q=>mid[q]===0)) { mid[i] = c; c = 3 - c; break; } } } }
for (const [name, b] of [["start", g], ["mitte", mid]]) {
  const t0 = performance.now();
  const res = lib.mctsMove(b, n, { komi: 9.5, seed: 7, scoreW: 0.3, c: 0.4, ...opt, playouts: P });
  const ms = performance.now() - t0;
  console.log(name, "playouts", res.playouts, "ms", ms.toFixed(0), "je Playout", (ms / res.playouts).toFixed(3), "ms", JSON.stringify(res));
}
