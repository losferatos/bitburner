// Gegenpruefung G11 (BLADE-2): Wieviel Black-Op-Chance bringt es, die SP aus Datamancer (und Tracer)
// umzuverteilen? Je Spielstand: Ist-Verteilung gegen drei Gegenentwuerfe, gierig nach d ln(Chance)/Preis.
//   A  = DM-SP freigeben und gierig neu vergeben      (Fix "schaetzNot = 0")
//   B  = DM- und Tracer-SP freigeben                  (Fix BLADE-2 komplett)
//   C  = alles ausser Hyperdrive neu verteilen        (Obergrenze, wie blade-skillmix.mjs)
// Kandidaten fuer die Neuvergabe: nur Chance-Faehigkeiten {BI, DO, SC, Reaper, Evasive, Cloak}
// (cand=chance) oder zusaetzlich Cyber's Edge/Overclock (cand=alle; deren Wert wirkt aber nicht auf die Chance,
// hier nur im Ziel Chance -> sie bekommen nie Punkte; sie sind nur fuer C relevant, wo sie freigegeben werden).
// Ziel: ln(unbeschnittene Chance) der naechsten Black Op bei voller Ausdauer, Trupp 0.
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { root, BLACKOPS, blackOpChance, cost, costSum, SK } from "./verify-g11-lib.mjs";
const filter = process.argv[2] || "BN2L1";
const zielModus = process.argv[3] || "next";   // next | typhoon | next5
const CHANCE = ["Blade's Intuition", "Digital Observer", "Short-Circuit", "Reaper", "Evasive System", "Cloak"];
const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((z) => z.split("\t"));

function ziel(P, lv, ops) {
  let s = 0;
  for (const op of ops) s += Math.log(blackOpChance(op, P, lv, { unclamped: true }));
  return s / ops.length;
}
function gierig(P, basis, frei, cand, ops) {
  const lv = { ...basis };
  let rest = frei;
  for (;;) {
    const z0 = ziel(P, lv, ops);
    let best = null;
    for (const n of cand) {
      const c = cost(n, lv[n] || 0);
      if (c > rest) continue;
      const w = (ziel(P, { ...lv, [n]: (lv[n] || 0) + 1 }, ops) - z0) / c;
      if (!best || w > best.w) best = { n, c, w };
    }
    if (!best) break;
    lv[best.n] = (lv[best.n] || 0) + 1; rest -= best.c;
  }
  return { lv, rest };
}
const kurz = (lv) => Object.entries(lv).filter(([, v]) => v).map(([n, v]) => n.replace(/[^A-Z]/g, "") + v).join(" ");

console.log("stand | SP gesamt | naechste BO | Chance Ist | A: Faktor (DM frei) | B: Faktor (DM+Tracer frei) | C: Faktor (Obergrenze) | Anteil DM+Tracer");
for (const z of idx) {
  if (!z[1].includes(filter)) continue;
  const { p } = ladeSpielstand(path.join(root, "backups", z[1]));
  const bb = flach(p.bladeburner);
  if (!bb || bb.numBlackOpsComplete >= 21) continue;
  const P = { skills: p.skills, mults: p.mults };
  const i0 = bb.numBlackOpsComplete;
  const ops = zielModus === "typhoon" ? [BLACKOPS[0]] : zielModus === "next5" ? BLACKOPS.slice(i0, i0 + 5) : [BLACKOPS[i0]];
  const c0 = blackOpChance(BLACKOPS[i0], P, bb.skills, { unclamped: true });
  const dm = costSum("Datamancer", bb.skills.Datamancer || 0), tr = costSum("Tracer", bb.skills.Tracer || 0);
  const ohne = (...namen) => { const lv = { ...bb.skills }; for (const n of namen) lv[n] = 0; return lv; };
  const A = gierig(P, ohne("Datamancer"), dm, CHANCE, ops);
  const B = gierig(P, ohne("Datamancer", "Tracer"), dm + tr, CHANCE, ops);
  // C: alles ausser Hyperdrive frei
  const nurHy = { Hyperdrive: bb.skills.Hyperdrive || 0 };
  let gesamt = 0; for (const [s, L] of Object.entries(bb.skills)) if (s !== "Hyperdrive") gesamt += costSum(s, L);
  const C = gierig(P, nurHy, gesamt, CHANCE, ops);
  const f = (lv) => blackOpChance(BLACKOPS[i0], P, lv, { unclamped: true }) / c0;
  console.log(z[1].replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(36), "|", bb.totalSkillPoints, "|", BLACKOPS[i0].name.replace("Operation", ""), "|", c0.toFixed(4), "|",
    "A x" + f(A.lv).toFixed(3), "(rest " + A.rest + ")", "|", "B x" + f(B.lv).toFixed(3), "(rest " + B.rest + ")", "|", "C x" + f(C.lv).toFixed(3), "|", (100 * (dm + tr) / bb.totalSkillPoints).toFixed(1) + "%");
}
