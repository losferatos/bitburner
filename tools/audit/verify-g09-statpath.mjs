// G09: Kampfwert-Verlauf des Spielers im Knoten (aus den BN2L1-Staenden) als Pfad fuer die Simulation.
import { listRun, readSave, bbOf } from "./verify-g09-lib.mjs";
export function statPath(run = "BN2L1", maxH = 5.4) {
  const out = [];
  for (const f of listRun(run)) {
    const { p } = readSave(f);
    const h = p.playtimeSinceLastBitnode / 3.6e6;
    if (h > maxH) break;
    const s = p.skills;
    out.push({ h, str: s.strength, def: s.defense, dex: s.dexterity, agi: s.agility, hack: s.hacking, cha: s.charisma });
  }
  return out;
}

export function skillPath(run = "BN2L1", maxH = 5.4) {
  const out = [];
  for (const f of listRun(run)) {
    const { p } = readSave(f);
    const h = p.playtimeSinceLastBitnode / 3.6e6;
    if (h > maxH) break;
    out.push({ h, lv: { ...bbOf(p).skills } });
  }
  return out;
}
