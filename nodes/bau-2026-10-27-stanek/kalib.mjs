// Eichung der Kette gegen alle V2-Laeufe mit Sicherungen: Zeit bis Rang 400k, Modell gegen gemessen.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { lade, kette } from "./chain.mjs";
const HIER = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HIER, "../..");
const idx = fs.readFileSync(path.join(ROOT, "backups/INDEX.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const tags = [...new Set(idx.filter((r) => r[3]).map((r) => r[4] + "L" + r[5]))];
const RANKMULT = { 6: 1, 10: 0.8, 4: 1, 9: 0.9, 2: 1, 3: 1, 11: 1, 7: 0.6, 14: 0.6, 13: 0.45, 15: 0.2 };
for (const tag of tags) {
  const bn = Number(tag.split("L")[0]);
  if (![7, 14, 10, 4, 9, 2, 3, 11, 6].includes(bn)) continue;
  const st = await lade(tag);
  if (st.length < 4) continue;
  const last = st[st.length - 1];
  if (last.b.rank < 3e5) { continue; }
  // gemessen: erste Probe >= 400k, lineare Interpolation in log(Rang)
  let obs = null;
  for (let i = 1; i < st.length; i++) if (st[i].b.rank >= 4e5 && st[i - 1].b.rank < 4e5) {
    const a = st[i - 1], b = st[i]; const f = (Math.log(4e5) - Math.log(a.b.rank)) / (Math.log(b.b.rank) - Math.log(a.b.rank)); obs = a.h + f * (b.h - a.h);
  }
  if (obs === null) obs = last.h;
  const mod = kette(st, { ab: 0, dt: 0.25, bnRank: RANKMULT[bn] ?? 1 }).t;
  console.log(tag.padEnd(7), "Proben", String(st.length).padStart(3), "Start h" + st[0].h.toFixed(1).padStart(5), "Rang0", String(Math.round(st[0].b.rank)).padStart(6),
    "| gemessen bis 400k: h" + obs.toFixed(1).padStart(6), "| Modell: h" + mod.toFixed(1).padStart(6), "| Verhaeltnis " + ((mod - st[0].h) / (obs - st[0].h)).toFixed(2));
}
