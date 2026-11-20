import fs from "node:fs"; import { pathToFileURL } from "node:url"; import path from "node:path";
const lib = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const { geomOf, rolloutFast, mulberry, whiteMayEnter } = lib._intern;
const rows = JSON.parse(fs.readFileSync(new URL("./board0.json", import.meta.url), "utf8"));
const n = rows.length, N = n * n; const g = new Uint8Array(N);
for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { const c = rows[x][y]; g[x * n + y] = c === "X" ? 1 : c === "O" ? 2 : c === "#" ? 3 : 0; }
const geo = geomOf(n); const R = 1500;
for (const [om, wd] of [[false, false], [false, true], [true, false], [true, true]]) {
  const rnd = mulberry(5); const b = new Uint8Array(N); let sb = 0, win = 0; const t0 = performance.now();
  for (let r = 0; r < R; r++) { b.set(g); const sc = rolloutFast(geo, b, 1, -1, rnd, null, om, true, 0, wd); sb += sc[0]; if (sc[0] > sc[1] + 9.5) win++; }
  console.log("oppModel", om, "wdModel", wd, "schwarz", (sb / R).toFixed(1), "sieg", (win / R).toFixed(3), "ms", ((performance.now() - t0) / R).toFixed(3));
}
// Taschen-Test von Hand auf 7x7: Tasche (0,0),(0,1),(1,0),(1,1) hinter einer schwarzen Mauer.
const t = geomOf(7); const bb = new Uint8Array(49);
for (const [x, y] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) bb[x * 7 + y] = 1;
console.log("Tasche 4 Punkte, Weiss fern:", whiteMayEnter(t, bb, 0), "(erwartet false)");
bb[3 * 7 + 0] = 2;
console.log("Weiss beruehrt, Kette hat Aussenfreiheiten:", whiteMayEnter(t, bb, 1 * 7 + 1), "(erwartet false)");
console.log("ausserhalb der Tasche:", whiteMayEnter(t, bb, 4 * 7 + 4), "(erwartet true)");
// Schwache Randkette: Mauer ganz von Weiss umstellt, alle Freiheiten in der Tasche.
const w = new Uint8Array(49);
for (const [x, y] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) w[x * 7 + y] = 1;
for (const [x, y] of [[3, 0], [3, 1], [3, 2], [0, 3], [1, 3], [2, 3]]) w[x * 7 + y] = 2;
console.log("Mauer aussen umstellt, 4 Freiheiten innen:", whiteMayEnter(t, w, 1 * 7 + 1), "(erwartet true: schwache Kette)");
console.log("Eckpunkt (0,0), keine Freiheit der Kette:", whiteMayEnter(t, w, 0), "(erwartet false)");
