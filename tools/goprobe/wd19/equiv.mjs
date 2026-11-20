import fs from "node:fs"; import { pathToFileURL } from "node:url"; import path from "node:path";
const lib = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const { geomOf, rollout, rolloutFast, mulberry } = lib._intern;
const rows = JSON.parse(fs.readFileSync(new URL("./board0.json", import.meta.url), "utf8"));
const n = rows.length, N = n * n; const g = new Uint8Array(N);
for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { const c = rows[x][y]; g[x * n + y] = c === "X" ? 1 : c === "O" ? 2 : c === "#" ? 3 : 0; }
const geo = geomOf(n);
const R = Number(process.argv[3] || 1500);
function stat(fn, g0, seed, oppModel) {
  const rnd = mulberry(seed); const b = new Uint8Array(N); const moves = new Int16Array(N);
  let sb = 0, sw = 0, win = 0, bad = 0, sb2 = 0;
  const t0 = performance.now();
  for (let r = 0; r < R; r++) {
    b.set(g0);
    const sc = fn === "fast" ? rolloutFast(geo, b, 1, -1, rnd, null, oppModel, true, 0) : rollout(geo, b, 1, -1, rnd, moves, null, oppModel, true, 0);
    sb += sc[0]; sw += sc[1]; sb2 += sc[0] * sc[0]; if (sc[0] > sc[1] + 9.5) win++;
    if (fn === "fast") { let e = 0; for (let i = 0; i < N; i++) { if (b[i] === 0) { e++; if (geo.pos[i] < 0 || geo.emp[geo.pos[i]] !== i || geo.pos[i] >= geo.ne) bad++; } else if (geo.pos[i] !== -1) bad++; } if (e !== geo.ne) bad++; }
  }
  const m = sb / R; const sd = Math.sqrt(sb2 / R - m * m);
  return { fn, schwarz: +m.toFixed(2), se: +(sd / Math.sqrt(R)).toFixed(2), weiss: +(sw / R).toFixed(2), sieg: +(win / R).toFixed(3), msJe: +((performance.now() - t0) / R).toFixed(3), bad };
}
// zweite Stellung: 40 Halbzuege schneller Zufallspartie vom Start (deterministisch) ist nicht direkt abgreifbar -> Startbrett plus feste Steine
const mid = Uint8Array.from(g); let s = 99; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; let c = 1;
for (let k = 0; k < 80; k++) for (let t = 0; t < 80; t++) { const i = Math.floor(r() * N); if (mid[i] === 0 && [i - n, i + n, i - 1, i + 1].filter((q) => q >= 0 && q < N && mid[q] === 0).length >= 2) { mid[i] = c; c = 3 - c; break; } }
for (const [name, b0] of [["start", g], ["mitte", mid]]) for (const om of [false, true]) {
  console.log(name, "oppModel", om, JSON.stringify(stat("slow", b0, 5, om)), JSON.stringify(stat("fast", b0, 5, om)));
}
