// Gegenpruefung G11 (BLADE-2): Zeitreihe Skills / SP / Rang / Black Ops ueber alle BN2-Staende.
// Nur lesen. Aufruf: node tools/audit/verify-g11-zeitreihe.mjs [filter]
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { skillCost } from "./blade-formeln.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const filter = process.argv[2] || "BN2L";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
const kost = (s, l) => { let c = 0; for (let i = 0; i < l; i++) c += skillCost(s, i); return c; };
console.log("stand | h im Knoten | Rang maxRang | SP gesamt | Skills | DM-SP TR-SP Anteil | BO | teamSize | sleeves");
for (const z of idx) {
  const f = z[1];
  if (!f.includes(filter)) continue;
  let r;
  try { r = ladeSpielstand(path.join(root, "backups", f)); } catch (e) { console.log(f, "FEHLER", e.message); continue; }
  const bb = flach(r.p.bladeburner);
  if (!bb) { console.log(f, "keine Division"); continue; }
  const sk = bb.skills || {};
  const dm = kost("Datamancer", sk.Datamancer || 0), tr = kost("Tracer", sk.Tracer || 0);
  const tot = bb.totalSkillPoints;
  const short = Object.entries(sk).map(([n, l]) => n.replace(/[^A-Z]/g, "") + l).join(" ");
  console.log(f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", ""), "|",
    (r.p.playtimeSinceLastBitnode / 3.6e6).toFixed(1) + "h", "|", Math.round(bb.rank), Math.round(bb.maxRank), "|",
    tot, "offen", bb.skillPoints, "|", short, "|", dm, tr, ((100 * (dm + tr)) / tot).toFixed(1) + "%", "|",
    "BO", bb.numBlackOpsComplete, "| team", bb._teamSize ?? bb.teamSize, "| sleeves", (r.p.sleeves || []).length);
}
