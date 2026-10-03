// Gegenpruefung G02 (Audit 03.10.2026): Hacknet-Augs im Kampfknoten.
// Rechnet die Befunde HASH-4 / BN2-1 / BN311-2 gegen die Spielstaende NACH
// dem Einbau 19:01 nach, die den Befundberichten noch fehlten.
//
// Abschnitte (jeder mit Eichung Soll/Ist, wo es einen Spielstandwert gibt):
//   1  Zeitlinien: welche Kaeufe ueberlebt haben (Tab-Einfrieren 03.10.,
//      Neuladen vom Stand lastSave 08:32:54Z)
//   2  Preisformel gegen moneySourceA.augmentations (17:17 alte, 19:01 gueltige Zeitlinie)
//   3  NFG-Schleife beim Einbau gegen die eingebaute NFG-Stufe 19:17
//   4  hacknet_node_money und Hashrate nach dem Einbau gegen den Spielstand
//   5  Gegenrechnung: Kaufregel des Bots (bn4rep.js:1737-1745) mit und ohne
//      Hacknet-Augs, inkl. Vorbedingung (FactionHelpers.tsx:56-57,88)
//   6  Nutzen der Hacknet-Augs nach dem Einbau, je Knoten der Restroute
//   7  Kompetenz-Unterschied (Action.ts:169-196, Gewichte Operation Typhoon)
//
// Formeln:
//   Preis   = base * 1,9^q * AugmentationMoneyCost  (AugmentationHelpers.ts:32-37,155-158)
//   NFG     = 750e3 * 1,14^L * 1,9^q                 (AugmentationHelpers.ts:133-138,
//             L = eingebaut + wartend, Augmentation.ts:238-246)
//   Hashrate= 0,001*level * 1,07^log2(ram) * (1+(cores-1)/5) * mult * HacknetNodeMoney
//             (Hacknet/formulas/HacknetServers.ts:4-17)
// Nur lesen. Aufruf: node tools/audit/verify-g02-calc.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAugs } from "./aug-data.mjs";
import { snapshot, listBN2Files, loadBN2 } from "./verify-g02-save.mjs";
import { kampfknotenNuetzlich } from "../../src/lib/hackaugs.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src");
const A = loadAugs();
const G = 1.9;
const isHN = (n) => /^Hacknet Node /.test(n);
const mrd = (x) => (x / 1e9).toFixed(4);
const ok = (soll, ist, tol = 1e-6) => (Math.abs(soll - ist) <= tol * Math.max(1, Math.abs(soll)) ? "OK " : "ABW");

// Grundpreise der Hacknet-Augs direkt aus Augmentations.ts gegenpruefen
// (aug-data.mjs ist ein fremder Parser - hier unabhaengig per Regex).
{
  const t = fs.readFileSync(path.join(SRC, "Augmentation", "Augmentations.ts"), "utf8");
  for (const [key, name] of [["HacknetNodeCPUUpload", "Hacknet Node CPU Architecture Neural-Upload"],
    ["HacknetNodeCacheUpload", "Hacknet Node Cache Architecture Neural-Upload"],
    ["HacknetNodeNICUpload", "Hacknet Node NIC Architecture Neural-Upload"],
    ["HacknetNodeKernelDNI", "Hacknet Node Kernel Direct-Neural Interface"],
    ["HacknetNodeCoreDNI", "Hacknet Node Core Direct-Neural Interface"]]) {
    const i = t.indexOf("[AugmentationName." + key + "]");
    const mc = Number(t.slice(i, i + 400).match(/moneyCost:\s*([\d.e]+)/)[1]);
    if (mc !== A[name].moneyCost) throw new Error("Grundpreis weicht ab: " + name);
  }
}

// ---------------------------------------------------------------------------
console.log("=== 1. Zeitlinien BN2.1 (lastSave = letzter persistierter Stand) ===");
const files = listBN2Files("2026-10-03T09-59");
const snaps = {};
for (const f of files) {
  const s = snapshot(f);
  const { p } = loadBN2(f);
  snaps[s.stamp] = s;
  console.log(`  ${s.stamp} ${s.anlass.padEnd(12)} lastSave ${new Date(p.lastSave).toISOString().slice(11, 19)}Z`
    + `  q ${String(s.q.length).padStart(2)}  augA ${mrd(s.augA).padStart(8)} Mrd  Geld ${mrd(s.money).padStart(8)} Mrd  NFG ${s.nfgInst}`);
}
console.log("  -> 17:16/17:17 (q 7/11) und 18:04/18:39 (q 5) tragen alle lastSave 08:32:54Z: der Tab hing,");
console.log("     nichts davon wurde gespeichert. 18:45 (lastSave 16:44:18Z) ist der erste gespeicherte Stand");
console.log("     danach - neu geladen vom Stand mit q=5. Die Kaeufe 17:16/17:17 (BN2-1-Rechnung) sind verworfen.");

// ---------------------------------------------------------------------------
console.log("\n=== 2. Eichung Preisformel (Summe in Warteschlangen-Reihenfolge) ===");
const priceSum = (names, q0 = 0, mm = 1) => names.reduce((s, n, i) => s + A[n].moneyCost * mm * Math.pow(G, q0 + i), 0);
for (const st of ["2026-10-03T17-17", "2026-10-03T19-01"]) {
  const s = snaps[st];
  const ist = priceSum(s.q);
  console.log(`  ${st}: Soll moneySourceA.augmentations ${mrd(s.augA)} Mrd / Ist Formel ${mrd(ist)} Mrd  ${ok(s.augA, ist)}`);
}
const S1901 = snaps["2026-10-03T19-01"];
console.log("  Warteschlange 19:01 mit Preis je Platz:");
S1901.q.forEach((n, i) => console.log(`    q=${String(i).padStart(2)} ${(isHN(n) ? "[HN] " : "     ") + n.padEnd(48)} ${mrd(A[n].moneyCost * Math.pow(G, i))} Mrd`));

// ---------------------------------------------------------------------------
console.log("\n=== 3. Eichung NFG-Schleife beim Einbau 19:00:30 (bn4rep.js:1660-1685, Geld als einzige Grenze) ===");
function nfgLevels(budget, L0, q0) {
  let k = 0, spent = 0;
  for (;;) {
    const pr = 750e3 * Math.pow(1.14, L0 + k) * Math.pow(G, q0 + k);
    if (spent + pr > budget) return { k, spent, next: pr };
    spent += pr; k++;
  }
}
const S1917 = snaps["2026-10-03T19-17"];
const geldEinbau = 15550e6;      // bn4rep-log 19:00:30 "bei 15550m Guthaben"
for (const g of [geldEinbau, S1901.money]) {
  const r = nfgLevels(g, S1901.nfgInst, S1901.q.length);
  console.log(`  Geld ${mrd(g)} Mrd, L0=${S1901.nfgInst}, q=${S1901.q.length}: Ist ${r.k} Stufen (${mrd(r.spent)} Mrd)`
    + ` | Soll (Spielstand 19:17 NFG ${S1917.nfgInst} - ${S1901.nfgInst}) ${S1917.nfgInst - S1901.nfgInst}  ${r.k === S1917.nfgInst - S1901.nfgInst ? "OK " : "ABW"}`);
}

// ---------------------------------------------------------------------------
console.log("\n=== 4. Eichung hacknet_node_money und Hashrate nach dem Einbau ===");
const hnProd = S1901.q.filter(isHN).reduce((m, n) => m * A[n].mults.hacknet_node_money, 1);
const nfgStep = 1.01 + 262 / 1e6 / 100;   // Augmentations.ts:1175 (1.01 + donationBonus), Constants.ts:107 Donations 262
const multSoll = S1917.hnMult;
const multIst = snaps["2026-10-03T09-59"].hnMult * hnProd * Math.pow(nfgStep, S1917.nfgInst - S1901.nfgInst);
console.log(`  hacknet_node_money: 09:59 ${snaps["2026-10-03T09-59"].hnMult.toFixed(6)} x Hacknet-Augs ${hnProd.toFixed(6)} x NFG^3`
  + ` -> Ist ${multIst.toFixed(6)} / Soll 19:17 ${multSoll.toFixed(6)}  ${ok(multSoll, multIst, 1e-6)}`);
const rate = (level, ram, cores, mult, hnm = 1) => 0.001 * level * Math.pow(1.07, Math.log2(ram)) * (1 + (cores - 1) / 5) * mult * hnm;
for (const h of S1917.hn) {
  const ist = rate(h.level, h.ram, h.cores, multSoll);
  console.log(`  ${h.host} L${h.level} R${h.ram} C${h.cores}: Soll ${h.rate.toFixed(8)} / Ist ${ist.toFixed(8)} H/s  ${ok(h.rate, ist, 1e-9)}`);
}
const fleetNow = S1917.hn.reduce((s, h) => s + h.rate, 0);
console.log(`  Flotte nach dem Einbau (netburn.js, 'Keine Aufruestung mehr moeglich', Geld 48.667 $): ${fleetNow.toFixed(4)} H/s`);
console.log(`  Kein Hash-Kauf nach dem Einbau: Stufen alle 0, Hashes ${snaps["2026-10-03T19-17"].hashes.toFixed(0)} -> ${snaps["2026-10-03T20-17"].hashes.toFixed(0)}`
  + ` -> ${snaps["2026-10-03T21-17"].hashes.toFixed(0)} von 320 (hashes.js wartet, hacknet.js beendet sich)`);

// ---------------------------------------------------------------------------
console.log("\n=== 5. Gegenrechnung: Kaufregel des Bots auf dem neu geladenen Stand (q=5) ===");
// Verdient und im Angebot zum Kaufzeitpunkt 18:45: die sechs gekauften plus
// Augmented Targeting II (Sector-12, 8.750 Ruf; Sector-12 hatte 14.262), das
// am Vorbedingungs-Test scheiterte. Teurere verdiente Stuecke (data/bn4rep.json
// teuerstesVerdiente 174.735 Mrd bei q=11) sind in beiden Faellen unbezahlbar.
const base5 = snaps["2026-10-03T18-04"].q;            // Stand nach dem Neuladen
const earned = ["Neurotrainer II", "Augmented Targeting II", "Hacknet Node Kernel Direct-Neural Interface",
  "Augmented Targeting I", "Hacknet Node CPU Architecture Neural-Upload",
  "Hacknet Node Cache Architecture Neural-Upload", "Hacknet Node NIC Architecture Neural-Upload"];
function replay(mitHashes, money0) {
  const queue = base5.slice();
  let money = money0;
  const owned = new Set(queue);
  const offen = earned.filter((n) => kampfknotenNuetzlich(n, mitHashes));
  const log = [];
  for (let runde = 0; runde < 20; runde++) {
    const q0 = queue.length;
    // bn4rep.js:670-678: Preis zum Rundenbeginn; :1737 absteigend sortiert
    const kand = offen.filter((n) => !owned.has(n)).map((n) => ({ n, preis: A[n].moneyCost * Math.pow(G, q0) }))
      .sort((a, b) => b.preis - a.preis);
    let gekauft = 0;
    for (const k of kand) {
      if (money < k.preis) continue;                                   // :1739 alter Preis
      const pre = A[k.n].prereqs.every((p) => owned.has(p));            // FactionHelpers.tsx:56-57
      const echt = A[k.n].moneyCost * Math.pow(G, queue.length);         // getAugCost zum Kaufzeitpunkt
      if (!pre) { log.push(`r${runde} ${k.n}: Vorbedingung fehlt`); continue; }
      if (money < echt) { log.push(`r${runde} ${k.n}: ${mrd(echt)} Mrd > Geld`); continue; }
      money -= echt; queue.push(k.n); owned.add(k.n); gekauft++;
      log.push(`r${runde} q=${queue.length - 1} ${k.n} ${mrd(echt)} Mrd`);
    }
    if (!gekauft) break;
  }
  return { queue, spent: money0 - money, log };
}
// Startgeld: Geld 18:45 + Ausgaben seit q=5 (Einkommen zwischen Kauf und Stand vernachlaessigt;
// es kuerzt sich in der Differenz ohnehin heraus)
const S1845 = snaps["2026-10-03T18-45"];
const spentActual = S1901.augA - snaps["2026-10-03T18-04"].augA;
const money0 = S1845.money + spentActual;
const mit = replay(true, money0);
console.log("  mit Hacknet-Augs (heutige Regel, mitHashes = SF9):");
mit.log.forEach((z) => console.log("    " + z));
const same = mit.queue.join("|") === S1901.q.join("|");
console.log(`  Eichung Reihenfolge: Soll (Spielstand 19:01) == Ist (Nachspielen)  ${same ? "OK " : "ABW"}`
  + `;  Ausgabe Soll ${mrd(spentActual)} / Ist ${mrd(mit.spent)} Mrd ${ok(spentActual, mit.spent)}`);
const ohne = replay(false, money0);
console.log("  ohne Hacknet-Augs (mitHashes = false):");
ohne.log.forEach((z) => console.log("    " + z));
const extra = mit.spent - ohne.spent;
const geldCf = geldEinbau + extra;
const nfgMit = nfgLevels(geldEinbau, S1901.nfgInst, mit.queue.length);
const nfgOhne = nfgLevels(geldCf, S1901.nfgInst, ohne.queue.length);
// Zerlegung: was die Hacknet-Stuecke direkt kosten, was sie ATI verteuern,
// und wohin das frei werdende Geld ohne sie flieesst (ATII + NFG).
const directHN = S1901.q.map((n, i) => (isHN(n) ? A[n].moneyCost * Math.pow(G, i) : 0)).reduce((a, b) => a + b, 0);
const atiMit = A["Augmented Targeting I"].moneyCost * Math.pow(G, S1901.q.indexOf("Augmented Targeting I"));
const atiOhne = A["Augmented Targeting I"].moneyCost * Math.pow(G, ohne.queue.indexOf("Augmented Targeting I"));
const atiiOhne = A["Augmented Targeting II"].moneyCost * Math.pow(G, ohne.queue.indexOf("Augmented Targeting II"));
const hnVerursacht = directHN + (atiMit - atiOhne);
console.log(`  Von den Hacknet-Stuecken verursacht: ${mrd(hnVerursacht)} Mrd = ${(100 * hnVerursacht / S1901.augA).toFixed(1)} % der`
  + ` Aug-Ausgaben des Zyklus (${mrd(S1901.augA)} Mrd), ${(100 * hnVerursacht / spentActual).toFixed(1)} % der Kaeufe nach dem Neuladen`);
console.log(`    = Preis der 4 Stuecke ${mrd(directHN)} Mrd + Treppe auf ATI (q6 statt q7) ${mrd(atiMit - atiOhne)} Mrd`);
console.log(`    ohne sie flieesst davon ${mrd(atiiOhne)} Mrd in Augmented Targeting II (q7), Rest ${mrd(extra)} Mrd in NFG`);
console.log(`  Warteschlange beim Einbau: mit ${mit.queue.length} (echte ${mit.queue.filter((n) => !isHN(n)).length}) | ohne ${ohne.queue.length} (echte ${ohne.queue.length})`);
console.log(`  Zusaetzliches echtes Stueck ohne Hacknet: ${ohne.queue.filter((n) => !mit.queue.includes(n)).join(", ") || "-"}`);
console.log(`  NFG beim Einbau: mit ${nfgMit.k} Stufen (Geld ${mrd(geldEinbau)}, q=${mit.queue.length}) | ohne ${nfgOhne.k} Stufen`
  + ` (Geld ${mrd(geldCf)}, q=${ohne.queue.length})`);
const nfgOhneOhneATII = nfgLevels(geldEinbau + hnVerursacht, S1901.nfgInst, ohne.queue.length - 1);
console.log(`  (Variante ohne ATII-Kauf, wie BN2-1 rechnet: ${nfgOhneOhneATII.k} NFG-Stufen)`);

// ---------------------------------------------------------------------------
console.log("\n=== 6. Nutzen der Hacknet-Augs nach dem Einbau (nur netburn-Flotte, Autoverkauf 4 H = 1 Mio $) ===");
const VAL = 1e6 / 4;
const fleetOhne = fleetNow / hnProd;
console.log(`  BN2.1 gemessen: Flotte ${fleetNow.toFixed(4)} H/s mit, ${fleetOhne.toFixed(4)} H/s ohne -> +${((fleetNow - fleetOhne) * 3600 * VAL / 1e6).toFixed(1)} Mio $/h`
  + ` (erst wenn 320 Hashes voll sind; davor 0)`);
// Ziel von netburn.js: Level-Summe 105, RAM 10, Kerne 5 auf 5 Server
const fullFleet = (mult, hnm) => 5 * rate(21, 2, 1, mult, hnm);
const bnHN = { 2: 1, 3: 0.25, 11: 0.1, 6: 0.2, 7: 0.2, 14: 0.25, 13: 0.4, 15: 1, 8: 0 };
console.log("  Obergrenze: netburn-Ziel erreicht (5 x L21 R2 C1), alle 4 Stuecke (x" + hnProd.toFixed(3) + "), Mult wie BN2.1:");
for (const [bn, hnm] of Object.entries(bnHN)) {
  const g = (fullFleet(multSoll, hnm) - fullFleet(multSoll / hnProd, hnm)) * 3600 * VAL;
  console.log(`    BN${bn.padEnd(3)} HacknetNodeMoney ${String(hnm).padEnd(5)} +${(g / 1e6).toFixed(1).padStart(6)} Mio $/h`);
}

// ---------------------------------------------------------------------------
console.log("\n=== 7. Kompetenz-Unterschied fuer den naechsten Zyklus (Action.ts:169-196, Typhoon-Gewichte) ===");
const S2217 = snapshot(listBN2Files("2026-10-03T22-17")[0]);
const { p: p2217 } = loadBN2(S2217.file);
const sk = p2217.skills;
const W = { hacking: [0.1, 0.6], strength: [0.2, 0.8], defense: [0.2, 0.8], dexterity: [0.2, 0.8], agility: [0.2, 0.8], intelligence: [0.1, 0.75] };
const terms = Object.fromEntries(Object.entries(W).map(([k, [w, d]]) => [k, w * Math.pow(sk[k], d)]));
const C = Object.values(terms).reduce((a, b) => a + b, 0);
const el = (k) => W[k][1] * terms[k] / C;
const elCombat = ["strength", "defense", "dexterity", "agility"].reduce((s, k) => s + el(k), 0);
const dATII = Math.log(A["Augmented Targeting II"].mults.dexterity);
const dNFG = (nfgOhne.k - nfgMit.k) * Math.log(nfgStep);
const dlnC = el("dexterity") * dATII + elCombat * dNFG;
console.log(`  Werte 22:17 str/def/dex/agi ${sk.strength}/${sk.defense}/${sk.dexterity}/${sk.agility}, hack ${sk.hacking}, int ${sk.intelligence}`);
console.log(`  Elastizitaet Kompetenz: dex ${el("dexterity").toFixed(3)}, alle vier Kampfwerte ${elCombat.toFixed(3)}`);
console.log(`  ohne Hacknet-Augs: ATII (dex x1,2) + ${nfgOhne.k - nfgMit.k} NFG -> Kompetenz x${Math.exp(dlnC).toFixed(4)}`
  + ` (ATII-Anteil x${Math.exp(el("dexterity") * dATII).toFixed(4)} nur bis zum naechsten Einbau,`
  + ` NFG-Anteil x${Math.exp(elCombat * dNFG).toFixed(4)} bis Knotenende)`);
console.log("  Typhoon-Chance (blade.json): 19:17 0,1473 | 20:17 0,2237 | 21:17 0,2683 | 22:17 0,2839 ->"
  + ` ln-Zuwachs zuletzt ${Math.log(0.2839 / 0.2683).toFixed(4)}/h; Schwelle 0,90 braucht noch ${Math.log(0.9 / 0.2839).toFixed(3)}`);
console.log(`  -> Vorsprung ${dlnC.toFixed(4)} ln-Einheiten = ${(dlnC / Math.log(0.2839 / 0.2683)).toFixed(2)} h beim letzten Zuwachs (faellt weiter -> eher mehr)`);
