// VERSION-ZITAT-HUNKS (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Ergaenzung zu version-zitate.mjs: die als GEAENDERT markierten Fundstellen des Bots (src/) werden nicht nur
// gezaehlt, sondern mit dem tatsaechlichen Diff-Hunk gezeigt, der die zitierte Zeile trifft - einmal je
// (Spieldatei, Bereich). Zweck: von Hand entscheiden, ob die Aussage hinter der Fundstelle fuer das LAUFENDE
// Spiel (v301) noch gilt, oder ob nur eine Umformatierung/Umbenennung dazwischenliegt.
//
// Eingabe: JSON von version-zitate.mjs --json <datei>. Aufruf:
//   node tools/audit/version-zitat-hunks.mjs <json> [--max N]
//
// Eichung: die Zahl der ausgegebenen Gruppen wird gegen die Zahl der verschiedenen (ziel,n,m) im JSON gezaehlt;
// jede Gruppe muss mindestens einen Hunk zeigen (sonst hat zitate "GEAENDERT" ohne Diff gemeldet).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const LIVE = path.join(ROOT, "reference", "v301", "src");
const DEV = path.join(ROOT, "reference", "bitburner-src", "src");
const argv = process.argv.slice(2);
const json = JSON.parse(fs.readFileSync(argv[0], "utf8"));
const MAX = argv.includes("--max") ? Number(argv[argv.indexOf("--max") + 1]) : 14;

const gruppen = new Map();
for (const f of json) {
  if (f.status !== "GEAENDERT" || !f.quelle.startsWith("src/")) continue;
  const k = f.ziel + ":" + f.n + "-" + f.m;
  if (!gruppen.has(k)) gruppen.set(k, { ziel: f.ziel, n: f.n, m: f.m, quellen: [] });
  gruppen.get(k).quellen.push(f.quelle + ":" + f.zeile);
}

const diffCache = new Map();
function hunksText(rel) {
  if (diffCache.has(rel)) return diffCache.get(rel);
  const r = spawnSync("git", ["diff", "--no-index", "--no-color", "--unified=0", "--ignore-space-change", path.join(LIVE, rel), path.join(DEV, rel)], { encoding: "utf8", maxBuffer: 1 << 28 });
  const lines = (r.stdout || "").split("\n");
  const hunks = [];
  let cur = null;
  for (const l of lines) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (m) { cur = { ls: +m[1], ll: m[2] === undefined ? 1 : +m[2], ds: +m[3], dl: m[4] === undefined ? 1 : +m[4], body: [] }; hunks.push(cur); continue; }
    if (cur && (l.startsWith("-") || l.startsWith("+"))) cur.body.push(l);
  }
  diffCache.set(rel, hunks);
  return hunks;
}

let nGruppen = 0, ohneHunk = 0;
for (const g of [...gruppen.values()].sort((a, b) => a.ziel.localeCompare(b.ziel) || a.n - b.n)) {
  nGruppen++;
  const hs = hunksText(g.ziel).filter((h) => {
    const s = h.ds, e = h.dl === 0 ? h.ds : h.ds + h.dl - 1;
    const ls = h.ls, le = h.ll === 0 ? h.ls : h.ls + h.ll - 1;
    return !(g.m < s || g.n > e + (h.dl === 0 ? 1 : 0)) || !(g.m < ls || g.n > le + (h.ll === 0 ? 1 : 0));
  });
  if (!hs.length) ohneHunk++;
  console.log("\n### " + g.ziel + ":" + g.n + (g.m !== g.n ? "-" + g.m : "") + "   zitiert von " + g.quellen.slice(0, 6).join(", ") + (g.quellen.length > 6 ? " (+" + (g.quellen.length - 6) + ")" : ""));
  for (const h of hs.slice(0, 3)) {
    console.log("  @@ live " + h.ls + "," + h.ll + " / dev " + h.ds + "," + h.dl);
    for (const l of h.body.slice(0, MAX)) console.log("   " + l.slice(0, 170));
    if (h.body.length > MAX) console.log("   ... (+" + (h.body.length - MAX) + " Zeilen)");
  }
}
console.log("\nGruppen " + nGruppen + ", davon ohne treffenden Hunk " + ohneHunk + (ohneHunk ? "  <-- EICHUNG ROT" : "  (Eichung OK)"));
