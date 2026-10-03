// Audit 03.10.2026, Gruppe BN3/BN11: Krankenhaussteuer der Raid-Phasen gegen
// das knappe Einkommen in BN3/BN11.
//
// Spielregeln (wortgleich):
//   Fehlschlag mit hpLoss: Schaden = ceil(addOffset(hpLoss * diffMult, 10))
//     (Bladeburner.ts:981-988), diffMult = d^0,28 + d/650 (Bladeburner.ts:711-713)
//   takeDamage -> hp <= 0 -> hospitalize (PlayerObjectGeneralMethods.ts:266-290)
//   Kosten = min(Geld * 0,1, (hpMax - hpAktuell) * 1e5), hpAktuell schon NEGATIV
//     (Hospital/Hospital.ts:4-10) -> min(0,1*M, (hpMax - hp + Schaden) * 1e5)
//   Spieler-hpMax = floor(10 + def/10) (Person.ts) - im Spielstand 21-28
//   BN-Multiplikator: keiner (Kosten und Schaden ohne currentNodeMults)
//
// Eichung: BN2.1 09:19 -> 09:59 (nur Raid L5, Konto 5,8-9,4 Mrd = Deckelregime):
//   22 Fehlschlaege (27 Versuche, 5 Erfolge, inventar-blade.md Rechnung 3) x Deckel
//   gegen moneySourceB.hospitalization-Differenz der beiden Spielstaende.
//
// Projektion (GERECHNET_UNGEEICHT): Einkommen je Fenster aus BN2.1 (moneySourceB),
// Hack x Knotenfaktor (bn311-hack.mjs: BN3 0,119-0,172, BN11 0,025-0,036),
// Hacknet x HacknetNodeMoney, Vertraege x CodingContractMoney (BitNode.tsx case 3/11);
// Fehlschlaege je Fenster aus der BN2.1-Krankenhausbuchung zurueckgerechnet (bot-
// gleiches Verhalten: blade.js entscheidet geldblind, solange Geld*0,1 >= hpMax*1e5).
// KEINE weiteren Ausgaben modelliert -> Ergebnis = Geld, das fuer Augs/Server bliebe.
//
// Aufruf: node tools/audit/bn311-hosp.mjs
import fs from "node:fs";
import { loadSave } from "./player-save.mjs";
import { AKTIONEN, difficulty, diffMult } from "./blade-formeln.mjs";

const files = fs.readdirSync("backups").filter((f) => f.includes("BN2L1") && f.endsWith(".json.gz")).sort();

function pt(f) {
  const { player: p } = loadSave("backups/" + f);
  const s = p.moneySourceB.data || p.moneySourceB;
  return { f, h: p.playtimeSinceLastBitnode / 3.6e6, M: p.money, hosp: -(s.hospitalization || 0),
    hack: s.hacking || 0, hn: s.hacknet || 0, cc: s.codingcontract || 0, hpMax: p.hp.max };
}
const P = files.map(pt).filter((x, i, a) => i === 0 || x.h - a[i - 1].h > 0.05);

// --- Schaden und Deckel je Raid-Stufe -----------------------------------------
const raid = AKTIONEN.Raid;
const cap = (lvl, hpMax) => (hpMax + Math.ceil(raid.hpLoss * diffMult(difficulty(raid, lvl)))) * 1e5;
console.log("Raid-Schaden (ohne +-10 %):", [1, 3, 5, 8].map((l) => `L${l} ${Math.ceil(raid.hpLoss * diffMult(difficulty(raid, l)))} HP`).join(", "));
const ass = AKTIONEN.Assassination;
console.log("Assassination-Schaden:", [5, 10, 15, 20].map((l) => `L${l} ${Math.ceil(ass.hpLoss * diffMult(difficulty(ass, l)))} HP`).join(", "),
  " Typhoon", Math.ceil(AKTIONEN["Operation Typhoon"].hpLoss * diffMult(2000)), "HP");

// --- Eichung --------------------------------------------------------------
const a = P.find((x) => x.f.includes("09-19")), b = P.find((x) => x.f.includes("09-59"));
const soll = b.hosp - a.hosp;
const ist = 22 * cap(5, 28);
console.log(`\nEICHUNG 09:19->09:59: Soll (Spielstand) ${(soll / 1e9).toFixed(3)} Mrd  Ist 22 x ${(cap(5, 28) / 1e6).toFixed(1)} Mio = ${(ist / 1e9).toFixed(3)} Mrd`
  + `  (Abweichung ${(((ist - soll) / soll) * 100).toFixed(1)} %; Schaden traegt addOffset +-10 %, Bladeburner.ts:983)`);

// --- Fehlschlaege je Fenster aus BN2.1 ---------------------------------------
const win = [];
for (let i = 1; i < P.length; i++) {
  const x = P[i - 1], y = P[i];
  const dh = y.h - x.h;
  const Mavg = (x.M + y.M) / 2;
  const c = Math.min(0.1 * Mavg, cap(y.h < 2 ? 1 : 5, y.hpMax));
  const n = (y.hosp - x.hosp) / c;
  win.push({ t0: x.h, t1: y.h, dh, n, hack: y.hack - x.hack, hn: y.hn - x.hn, cc: y.cc - x.cc });
}
// Fenster 0 -> erster Stand (0 bis 0,85 h)
const f0 = P[0];
win.unshift({ t0: 0, t1: f0.h, dh: f0.h, n: f0.hosp / Math.min(0.1 * f0.M, cap(1, f0.hpMax)), hack: f0.hack, hn: f0.hn, cc: f0.cc });
console.log("\nBN2.1 Fenster (h, toedliche Fehlschlaege geschaetzt, Hack Mrd):");
for (const w of win) console.log(`  ${w.t0.toFixed(2)}-${w.t1.toFixed(2)} h  n=${w.n.toFixed(0).padStart(3)}  (${(w.n / w.dh).toFixed(0)}/h)  hack ${(w.hack / 1e9).toFixed(2)}`);

// --- Simulation ------------------------------------------------------------
function sim({ hackF, hnF, ccF, label, steuer = true }) {
  let M = 1000, hospSum = 0, inc = 0;
  const STEP = 1 / 360; // 10 s
  const spuren = [];
  for (const w of win) {
    const steps = Math.max(1, Math.round(w.dh / STEP));
    const iStep = (w.hack * hackF + w.hn * hnF + w.cc * ccF) / steps;
    const nStep = w.n / steps;
    let acc = 0;
    for (let s = 0; s < steps; s++) {
      M += iStep; inc += iStep;
      acc += nStep;
      while (steuer && acc >= 1) {
        const c = Math.min(0.1 * M, cap(w.t1 < 2 ? 1 : 5, 28));
        M -= c; hospSum += c; acc -= 1;
      }
    }
    spuren.push({ t: w.t1, M });
  }
  return { label, M, hospSum, inc, spuren };
}

const SZ = [
  { label: "BN2 (Pruefung: eigenes Einkommen)", hackF: 1, hnF: 1, ccF: 1 },
  { label: "BN3 Hack 0,172", hackF: 0.172, hnF: 0.25, ccF: 1 },
  { label: "BN3 Hack 0,119", hackF: 0.119, hnF: 0.25, ccF: 1 },
  { label: "BN11 Hack 0,036", hackF: 0.036, hnF: 0.1, ccF: 0.25 },
  { label: "BN11 Hack 0,025", hackF: 0.025, hnF: 0.1, ccF: 0.25 },
  { label: "BN11 Hack 0,036 + 3 Sleeves Mug", hackF: 0.036, hnF: 0.1, ccF: 0.25, extra: 0.248e9 },
];
console.log("\nSimulation 0 -> 12,6 h (Ausgaben ausser Krankenhaus NICHT abgezogen):");
console.log("Szenario                               Einkommen  Krankenhaus  Rest mit Steuer  Rest ohne  Anteil Steuer   Konto bei 5,3 h");
for (const z of SZ) {
  if (z.extra) {
    // Sleeve-Verbrechen als gleichmaessiger Zusatz je Fenster
    for (const w of win) w._cc = w.cc;
  }
  const W0 = win.map((w) => ({ ...w }));
  if (z.extra) for (const w of win) w.cc = w._cc + (z.extra * w.dh) / z.ccF;
  const m = sim(z), o = sim({ ...z, steuer: false });
  const at53 = m.spuren.find((s) => s.t > 5.2);
  console.log(`${z.label.padEnd(38)} ${(m.inc / 1e9).toFixed(2).padStart(8)}  ${(m.hospSum / 1e9).toFixed(2).padStart(10)}  ${(m.M / 1e9).toFixed(2).padStart(14)}  ${(o.M / 1e9).toFixed(2).padStart(9)}  ${((m.hospSum / m.inc) * 100).toFixed(0).padStart(10)} %   ${(at53.M / 1e9).toFixed(3)} Mrd`);
  if (z.extra) for (let i = 0; i < win.length; i++) win[i].cc = W0[i]._cc;
}

// --- Gleichgewicht ----------------------------------------------------------
console.log("\nGleichgewichtskonto waehrend Raid (10-%-Regime): M* = I / (0,1 f)  [nur wenn 0,1 M* < Deckel 43 Mio]");
for (const [name, I] of [["BN2 4,2+0,5 Mrd/h", 4.7e9], ["BN3 0,71-0,92", 0.8e9], ["BN11 0,17-0,22", 0.2e9], ["BN11 + Sleeve-Mug", 0.45e9]]) {
  const row = [15, 33, 60].map((f) => {
    const m = I / (0.1 * f);
    const regime = 0.1 * m > 43e6 ? "Deckel" : "10%";
    const steuer = regime === "Deckel" ? Math.min(I, f * 43e6) : I;
    return `f=${f}/h: M*=${(m / 1e9).toFixed(2)} Mrd (${regime}, Steuer ${(steuer / 1e9).toFixed(2)} Mrd/h)`;
  });
  console.log("  " + name.padEnd(20), row.join(" | "));
}
