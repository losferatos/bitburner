// Audit 03.10.2026, Gruppe BN3/BN11: Woher kam das Geld in den bisherigen
// V2-Laeufen - ALLE Quellen aus moneySourceB (nicht nur Hack/Hacknet/Sleeves),
// und was bleibt davon in BN3 und BN11 uebrig?
//
// Gemessen: moneySourceB (seit Knotenbeginn, utils/MoneySourceTracker.ts:8-28)
// aus dem jeweils letzten Spielstand je V2-Lauf.
// Hochgerechnet (GERECHNET_UNGEEICHT): jede Quelle x ihr Knotenfaktor
// BN-Ziel / BN-Quelle (BitNode.tsx case 2/3/4/9/10/11):
//   hacking     : ServerMaxMoney * ScriptHackMoney (Wachstumsrate NICHT drin -> obere Schranke)
//   bladeburner : 1 ueberall (Bladeburner.ts:933-940, ContractBaseMoneyGain ohne BN-Faktor)
//   sleeves     : 1 - in V2 sind die Sleeves nach dem Kaltstart auf Bladeburner (Vertraege/Infiltrate);
//                 deren Vertragsgeld bucht das Spiel auf "sleeves" (Work.ts:19) OHNE BN-Faktor
//                 (Bladeburner.ts:933-940); Gym-Kosten und Sleeve-Augs laufen ueber denselben Topf
//   crime       : CrimeMoney
//   codingcontract: CodingContractMoney
//   hacknet     : HacknetNodeMoney
//   work        : CompanyWorkMoney
//
// Aufruf: node tools/audit/bn311-geld.mjs
import { loadSave, jsonMap } from "./player-save.mjs";

const B = "backups/LIVE_197f4d61481686_";
export const RUNS = [
  { f: "BN4L2_2026-09-12T11-44_pre-install.json.gz", note: "BN4.2 bis Ende" },
  { f: "BN4L3_2026-09-14T16-44_pre-install.json.gz", note: "BN4.3 bis 17 BO" },
  { f: "BN9L1_2026-09-18T21-51_pre-install.json.gz", note: "BN9.1" },
  { f: "BN9L2_2026-09-22T10-51_pre-jump.json.gz", note: "BN9.2 ganz" },
  { f: "BN9L3_2026-09-24T16-25_pre-jump.json.gz", note: "BN9.3 ganz" },
  { f: "BN10L2_2026-09-06T01-55_pre-install.json.gz", note: "BN10.2" },
  { f: "BN10L3_2026-09-10T08-17_pre-install.json.gz", note: "BN10.3 bis 19 BO" },
  { f: "BN2L1_2026-10-03T17-17_hourly.json.gz", note: "BN2.1 laufend" },
];

// BitNode.tsx:563-916 (fehlend = 1)
export const MULT = {
  2: { SMM: 0.08, SHM: 1, CM: 3, CCM: 1, HNM: 1, CWM: 1, AMC: 1, ARC: 1 },
  3: { SMM: 0.04, SHM: 0.2, CM: 0.25, CCM: 1, HNM: 0.25, CWM: 0.25, AMC: 3, ARC: 3 },
  4: { SMM: 0.1125, SHM: 0.2, CM: 0.2, CCM: 1, HNM: 0.05, CWM: 0.1, AMC: 1, ARC: 1 },
  9: { SMM: 0.01, SHM: 0.1, CM: 0.5, CCM: 1, HNM: 1, CWM: 0.5, AMC: 1, ARC: 1 },
  10: { SMM: 1, SHM: 0.5, CM: 0.5, CCM: 1, HNM: 0.5, CWM: 0.5, AMC: 5, ARC: 2 },
  11: { SMM: 0.01, SHM: 1, CM: 3, CCM: 0.25, HNM: 0.1, CWM: 0.5, AMC: 2, ARC: 1 },
};

const g = (x) => (x / 1e9).toFixed(1);

export function moneyOf(file) {
  const { save, player } = loadSave(file);
  const b = player.moneySourceB.data || player.moneySourceB;
  const hInNode = (player.playtimeSinceLastBitnode || 0) / 3.6e6;
  return { player, b, hInNode, node: player.bitNodeN };
}

function main() {
  // Pruefen: stehen die Faktoren oben wirklich so im Quellcode? (fuer 3/11 gegen bitnodes.json)
  console.log("Quelle            h    bladeb  hacking  sleeves  crime  contr  hacknet  work  class  hosp  augs  servers  total+");
  const rows = [];
  for (const r of RUNS) {
    let m;
    try { m = moneyOf(B + r.f); } catch (e) { console.log(r.note, "FEHLT", e.message); continue; }
    const b = m.b;
    const inc = Object.entries(b).filter(([k, v]) => k !== "total" && v > 0).reduce((a, [, v]) => a + v, 0);
    rows.push({ ...r, m, inc });
    console.log(
      r.note.padEnd(16),
      m.hInNode.toFixed(1).padStart(5),
      g(b.bladeburner || 0).padStart(8),
      g(b.hacking || 0).padStart(8),
      g(b.sleeves || 0).padStart(8),
      g(b.crime || 0).padStart(6),
      g(b.codingcontract || 0).padStart(6),
      g(b.hacknet || 0).padStart(8),
      g(b.work || 0).padStart(5),
      g(b.class || 0).padStart(6),
      g(b.hospitalization || 0).padStart(5),
      g(b.augmentations || 0).padStart(6),
      g(b.servers || 0).padStart(7),
      g(inc).padStart(7),
    );
  }

  console.log("\nHochrechnung: gleiche Quellmengen, Knotenfaktoren BN3 bzw. BN11 (obere Schranke fuer Hacking)");
  console.log("Quelle -> Ziel   h    Einnahmen  davon BB  Hack  Sleeves/Crime  Kaufkraft (/AugMoneyCost)  Anteil der Quelle");
  for (const ziel of [3, 11]) {
    for (const r of rows) {
      const q = MULT[r.m.node];
      const z = MULT[ziel];
      const b = r.m.b;
      const bb = b.bladeburner || 0;
      const hack = (b.hacking || 0) * (z.SMM * z.SHM) / (q.SMM * q.SHM);
      const sl = (b.sleeves || 0) + (b.crime || 0) * z.CM / q.CM;
      const cc = (b.codingcontract || 0) * z.CCM / q.CCM;
      const hn = (b.hacknet || 0) * z.HNM / q.HNM;
      const wk = (b.work || 0) * z.CWM / q.CWM;
      const sum = bb + hack + sl + cc + hn + wk;
      // Kaufkraft relativ zur Quelle: Summe / AMC_ziel gegen Einnahmen / AMC_quelle
      const kk = (sum / z.AMC) / (r.inc / q.AMC);
      console.log(
        `BN${r.m.node}->BN${ziel}`.padEnd(10), r.note.padEnd(16),
        g(sum).padStart(8), g(bb).padStart(8), g(hack).padStart(7), g(sl).padStart(8),
        `  ${(kk * 100).toFixed(1)} % der Kaufkraft der Quelle`,
      );
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("bn311-geld.mjs")) main();
