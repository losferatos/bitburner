// Audit 03.10.2026, Gruppe BN3/BN11: Geld der Sleeves in den bisherigen V2-Laeufen
// (moneySourceB.sleeves, utils/MoneySourceTracker.ts) je Fenster zwischen zwei
// Spielstaenden. In V2 ist das ueberwiegend Bladeburner-Vertragsgeld der Sleeves
// (Bladeburner.ts:933-940 ContractBaseMoneyGain*rewardFac^(L-1), KEIN BN-Faktor;
// gebucht ueber PersonObjects/Sleeve/Work/Work.ts:19), abzueglich Gym-Kosten.
// Nur lesen. Aufruf: node tools/audit/bn311-sleevegeld.mjs
import fs from "node:fs";
import { loadSave } from "./player-save.mjs";
const runs = ["BN4L2", "BN4L3", "BN9L1", "BN9L2", "BN9L3", "BN10L2", "BN10L3", "BN2L1"];
for (const r of runs) {
  const files = fs.readdirSync("backups").filter((f) => f.includes("_" + r + "_")).sort();
  let prev = null;
  const out = [];
  for (const f of files) {
    const { player: p } = loadSave("backups/" + f);
    const s = p.moneySourceB.data || p.moneySourceB;
    const h = p.playtimeSinceLastBitnode / 3.6e6;
    const bb = p.bladeburner ? (p.bladeburner.data || p.bladeburner) : null;
    const lv = bb && bb.contracts ? Object.values(bb.contracts.data || bb.contracts).map((c) => (c.data || c).level).join("/") : "-";
    if (prev && h - prev.h > 0.3) out.push(`${prev.h.toFixed(1)}-${h.toFixed(1)} h: ${(((s.sleeves - prev.sl) / 1e9) / (h - prev.h)).toFixed(3)} Mrd/h (Vertragsstufen ${lv})`);
    prev = { h, sl: s.sleeves || 0 };
  }
  console.log(r + ": " + (out.join(" | ") || "-"));
}
