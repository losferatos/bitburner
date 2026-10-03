// Erzeugt tools/mock/tor-runde-gang-bn2.json: die Eingabe und die Sollwerte fuer
// tools/test-tor-runde.js (Einheitstest von waehleTorRunde, lib/einbau.js).
//
// WARUM EINE FESTE DATEI. Der Test soll die geplante Runde gegen
// tools/audit/gang-round.mjs `bestRound` halten (verify-g01-betrieb.md PAKET 1:
// "gleiche Menge, gleiche Reihenfolge, Kosten <= Budget"). bestRound braucht
// aber den Spielquelltext (reference/, nicht im Repo) und einen Spielstand
// (backups/, ebenfalls nicht im Repo). Diese Datei friert die Eingabe (das
// Angebot der Gang-Faktion in BN2 mit Voraussetzungen und Faktoren, die Stufen
// aus dem Spielstand) UND die Antworten von bestRound ein - der Test laeuft
// damit ueberall. Wo die Quellen vorliegen, rechnet er zusaetzlich bestRound
// live nach und prueft, dass die Datei nicht abgedriftet ist.
//
// Aufruf (braucht backups/ und reference/bitburner-src/ im Baum, in dem es laeuft):
//   node tools/audit/tor-runde-fixture.mjs [Spielstand.json.gz]
import fs from "node:fs";
import path from "node:path";
import { parseAugs, gangOffer } from "./gang-augs.mjs";
import { readSave } from "./gang-save.mjs";
import { bestRound } from "./gang-round.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const saveFile = process.argv[2]
  || path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
const { p } = readSave(saveFile);

// Dieselben Filter wie in gang-round.mjs (Zeilen 21-38).
const COMBAT = ["strength", "defense", "dexterity", "agility"];
const owned = new Set([...(p.augmentations || []), ...(p.queuedAugmentations || [])].map((a) => a.name));
const augs = parseAugs();
const offer = gangOffer(augs, 2, 1).filter((a) => !owned.has(a.name) && COMBAT.some((s) => (a[s] || 1) > 1));

const levels = {
  hacking: p.skills.hacking, strength: p.skills.strength, defense: p.skills.defense,
  dexterity: p.skills.dexterity, agility: p.skills.agility, intelligence: p.skills.intelligence,
};

const cases = [];
for (const q0 of [0, (p.queuedAugmentations || []).length]) {
  for (const budget of [30e9, 48e9, 100e9]) {
    const r = bestRound(budget, q0);
    cases.push({ budget, q0, seq: r.seq, cost: r.cost, comp: r.comp });
  }
}

const out = {
  hinweis: "ERZEUGT von tools/audit/tor-runde-fixture.mjs aus tools/audit/gang-round.mjs bestRound. Nicht von Hand pflegen.",
  quelle: path.basename(saveFile),
  levels,
  owned: [...owned],
  offer: offer.map((a) => ({
    name: a.name, repCost: a.repCost, moneyCost: a.moneyCost, prereqs: a.prereqs,
    strength: a.strength, defense: a.defense, dexterity: a.dexterity, agility: a.agility,
  })),
  cases,
};
const ziel = path.join(ROOT, "tools", "mock", "tor-runde-gang-bn2.json");
fs.writeFileSync(ziel, JSON.stringify(out, null, 1), "utf8");
console.log("geschrieben: " + ziel + " (" + offer.length + " Angebote, " + cases.length + " Faelle)");
for (const c of cases) {
  console.log("  Budget " + (c.budget / 1e9) + " Mrd, q0 " + c.q0 + ": " + c.seq.length + " Augs, Kosten "
    + (c.cost / 1e9).toFixed(2) + " Mrd, x" + c.comp.toFixed(3));
}
