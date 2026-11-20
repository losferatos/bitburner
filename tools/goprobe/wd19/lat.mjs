// Gitter-Konzept in der Modellwelt: mittlere schwarze Punktzahl der Zufallspartie
// vom Startbrett, Schwarz baut das Gitter, Weiss meidet Taschen (wd) und schlaegt/rettet (oppModel).
import fs from "node:fs"; import { pathToFileURL } from "node:url"; import path from "node:path";
const lib = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const { geomOf, rolloutFast, mulberry } = lib._intern;
const rows = JSON.parse(fs.readFileSync(new URL("./board0.json", import.meta.url), "utf8"));
const n = rows.length, N = n * n; const g = new Uint8Array(N);
for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { const c = rows[x][y]; g[x * n + y] = c === "X" ? 1 : c === "O" ? 2 : c === "#" ? 3 : 0; }
const geo = geomOf(n); const R = Number(process.argv[3] || 300);
const run = (lat, pLat, om, wd) => {
  const rnd = mulberry(5); const b = new Uint8Array(N); let sb = 0, win = 0;
  for (let r = 0; r < R; r++) { b.set(g); const sc = rolloutFast(geo, b, 1, -1, rnd, null, om, true, 0, wd, lat, pLat); sb += sc[0]; if (sc[0] > sc[1] + 9.5) win++; }
  return { schwarz: +(sb / R).toFixed(1), sieg: +(win / R).toFixed(3) };
};
console.log("ohne Gitter, oppModel+wd:", JSON.stringify(run(null, 0, true, true)));
const res = [];
for (const [p, q] of [[4, 4], [6, 4], [8, 4], [4, 8], [4, 6], [6, 6]]) {
  for (let a = 0; a < p; a++) for (let b = 0; b < q; b++) {
    if ((a + b) % 2 !== 0 && p % 2 === 0 && q % 2 === 0) continue;   // Diagonalen muessen sich in Punkten kreuzen
    const lat = lib.latticePoints(g, n, p, q, a, b);
    const r = run(lat, 0.9, true, true);
    res.push({ p, q, a, b, steine: lat.length, ...r });
  }
}
res.sort((x, y) => y.schwarz - x.schwarz);
for (const r of res.slice(0, 12)) console.log(JSON.stringify(r));
console.log("...schlechtestes:", JSON.stringify(res[res.length - 1]));
