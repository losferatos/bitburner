// G09: Gegenprobe LP-Annahmen: Stadt eingefroren (keine Pop-/Comms-/Chaos-Aenderung durch Raids, keine Ereignisse), Zustand 07:33.
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { startFromSave, ensemble, setStatPath, setSkillPath } from "./verify-g09-sim.mjs";
setStatPath(null); setSkillPath(null);
const key = process.argv[2] || "T07-33";
const f = listRun("BN2L1").find((x) => x.includes(key));
const { p } = readSave(f);
const base = startFromSave(p);
const N = Number(process.argv[3] || 200);
console.log("Stand", f.slice(25, 52), "Raid-Vorrat", fmt(base.act.Raid.count, 1), "Stufe", base.act.Raid.level, "Pop", Math.round(base.city.pop / 1e6) + "M Chaos", fmt(base.city.chaos, 1));
for (const frozen of [true, false]) {
  console.log(frozen ? "\n-- Stadt EINGEFROREN (LP-Annahme)" : "\n-- Stadt DYNAMISCH (Spielregeln)");
  for (const H of [1, 2, 3]) {
    const row = [];
    for (const [name, c] of Object.entries({ "alle Gym (Spieler allein)": { sleeves: ["gym", "gym", "gym"] }, "3x Infiltrate": { sleeves: ["infil", "infil", "infil"] }, "2x Infiltrate": { sleeves: ["infil", "infil", "gym"] } })) {
      const r = ensemble(base, { ...c, hours: H, growth: 0, raidFirst: true, income: 3e9, frozenCity: frozen }, N, 77);
      row.push(`${name}: ${fmt((r.rank - base.rank) / H, 0)} Rang/h (Raids ${fmt(r.raids / H, 0)}/h, Krankenhaus ${fmt(r.money / 1e9 / H, 2)} Mrd/h)`);
    }
    console.log(`Horizont ${H} h: ` + row.join(" | "));
  }
}
console.log("\nLP (sleeve-lp.mjs, 07:33): Spieler allein 124 Rang/h; 3x Infiltrate 252; 2x Infiltrate + 1 Kammer 310.");
