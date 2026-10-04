// Gegenpruefung G11: Eichung des eigenen Chancen-Nachbaus (verify-g11-lib.mjs) gegen die Spielstaende:
//  Soll = boChancen[naechste Black Op] aus data/blade.json im Spielstand (Bot-Messung, lief im Spiel),
//  Ist  = blackOpChance() aus Spieler-/Skillwerten des Staendes, Ausdauer wie im Stand, Trupp = teamCount der Op.
// Zusaetzlich: SP-Buchhaltung (ausgegebene Kosten + offene Punkte = totalSkillPoints).
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
import { root, BLACKOPS, blackOpChance, costSum } from "./verify-g11-lib.mjs";
const filter = process.argv[2] || "BN2L";
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));
let maxAbw = 0, n = 0, maxSP = 0;
for (const z of idx) {
  if (!z[1].includes(filter)) continue;
  const { p, servers } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner);
  if (!bb) continue;
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  // SP-Buchhaltung
  let ausg = 0; for (const [s, L] of Object.entries(bb.skills)) ausg += costSum(s, L);
  const dSP = ausg + bb.skillPoints - bb.totalSkillPoints; maxSP = Math.max(maxSP, Math.abs(dSP));
  const P = { skills: p.skills, mults: p.mults };
  const next = BLACKOPS[bb.numBlackOpsComplete];
  let zeile = z[1].replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(36) + " SPdiff " + dSP;
  if (next && bj && bj.boChancen && bj.boChancen[next.name.replace(/([A-Z])/g, (m, c, i) => (i ? " " : "") + c).replace("Operation ", "Operation ")] != null || (next && bj && bj.boChancen)) {
    // Schluessel im Bot: "Operation Typhoon"
    const key = Object.keys(bj.boChancen || {}).find((k) => k.replace(/\s/g, "") === next.name);
    if (key) {
      const team = (bb.blackOps && bb.blackOps[key] && bb.blackOps[key].teamCount) || 0;
      const aktion = bb.action;
      const stamFrac = bb.stamina / bb.maxStamina;
      const ist = blackOpChance(next, P, bb.skills, { team, stamFrac });
      const soll = bj.boChancen[key];
      // blade.json ist bis zu einer Minute aelter als der Stand -> kleine Abweichung moeglich
      zeile += ` | ${key} team ${team} Ausd ${(100 * stamFrac).toFixed(0)}% soll ${soll} ist ${ist.toFixed(4)} abw ${(ist - soll).toExponential(1)}`;
      maxAbw = Math.max(maxAbw, Math.abs(ist - soll)); n++;
    }
  }
  console.log(zeile);
}
console.log("MAX |Ist-Soll| ueber", n, "Staende:", maxAbw.toExponential(2), "| max SP-Buchhaltungsfehler:", maxSP);
