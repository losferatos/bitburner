// Audit 03.10.2026 (INFRA): Wie viel kostet die 10-Minuten-Sperre nach
// jedem Cloud-Ausbau (Befund INFRA-1)?
//
// Mechanik (Belege im Bericht):
//   shop.js:149-174 schreibt data/preise.json (Park) VOR der Ausfuehrung des
//   Auftrags; bn4net.js:1446-1529 liest den alten Park, bestellt denselben
//   Ausbau erneut; shop.js:250-266 bekommt getServerUpgradeCost = -1
//   (Cloud.ts:94-103 faengt den Fehler und gibt -1 zurueck), haelt den
//   Auftrag als "warte auf Geld" offen; bn4net.js:254-272 wartet 600 s.
//
// Vorgehen:
//   1. Alle Kauf-/Ausbau-Zeilen aus data/bn4net-log.txt aller BN2.1-Spielstaende
//      (Log liegt im Spielstand auf home) zusammenfuehren.
//   2. Park-RAM ueber die Zeit rekonstruieren und an den Spielstaenden eichen
//      (purchasedRamTotal Soll/Ist).
//   3. Gegenlauf ohne Sperre: dieselben Ausbauten im 40-s-Takt (eine
//      bn4net-Runde 10 s + eine shop-Runde 30 s), begrenzt durch das Geld
//      (Bot-Regel kosten*2 <= Geld) und die echte Geldkurve aus den
//      Spielstaenden.
//   4. Verlust = Summe (t_echt - t_gegen) * zusaetzliche GB * Ertrag je GB*s.
//      Ertrag geeicht: moneySourceB.hacking-Zuwachs / Netz-RAM zwischen den
//      Spielstaenden (201-222 $/GB*s, flach ueber 3,5-8,9 TB).
//
// Aufruf: node tools/audit/infra-throttle.mjs
import fs from "node:fs";
import { readSave, infraFacts } from "./infra-save.mjs";
import { cloudCost } from "./infra-costs.mjs";

const files = fs.readdirSync("backups").filter((f) => f.includes("_BN2L1_")).sort();
const lines = new Set();
const saves = [];
for (const f of files) {
  const { servers } = readSave("backups/" + f);
  const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/bn4net-log.txt");
  const text = tf ? (tf[1].data || tf[1]).text : "";
  for (const l of text.split("\n")) if (/bestellt|erledigt \(werk/.test(l)) lines.add(l);
  const x = infraFacts("backups/" + f);
  const hhmm = f.match(/T(\d\d)-(\d\d)_/);
  saves.push({ f, t: Number(hhmm[1]) * 3600 + Number(hhmm[2]) * 60, park: x.purchasedRamTotal,
    money: x.money, servers: -(x.moneySourceB.servers || 0), hackInc: x.moneySourceB.hacking || 0,
    ram: x.homeRam + x.purchasedRamTotal + x.foreignRam, tBN: x.sinceBitnodeH });
}
const sec = (l) => { const [h, mi, s] = l.slice(0, 8).split(":").map(Number); return h * 3600 + mi * 60 + s; };
const sorted = [...lines].sort((a, b) => sec(a) - sec(b));

// Ereignisse: Kauf (Rechner bestellt: X GB) wird mit dem folgenden "erledigt"
// wirksam; Ausbau "werk-N: a -> b GB bestellt" ebenso. Ein Ausbau-Auftrag,
// nach dem binnen 600 s kein "erledigt" fuer diesen Host kommt, ist die
// Doppelbestellung (nie ausgefuehrt).
const events = [];
let pending = null;
for (const l of sorted) {
  const t = sec(l);
  let mm;
  if ((mm = l.match(/Rechner bestellt: (\d+) GB/))) pending = { t, kind: "kauf", gb: Number(mm[1]) };
  else if ((mm = l.match(/(werk-\d+): (\d+) -> (\d+) GB bestellt.*amortisiert in (\d+) s/)))
    pending = { t, kind: "upgrade", host: mm[1], from: Number(mm[2]), to: Number(mm[3]), amort: Number(mm[4]) };
  else if ((mm = l.match(/erledigt \((werk-\d+)\)/)) && pending) {
    events.push({ ...pending, done: t, host: pending.host || mm[1] });
    pending = null;
  }
}
const upgrades = events.filter((e) => e.kind === "upgrade");
const kaeufe = events.filter((e) => e.kind === "kauf");
console.log("Kaeufe:", kaeufe.length, " ausgefuehrte Ausbauten:", upgrades.length);
const gaps = upgrades.slice(1).map((u, i) => u.done - upgrades[i].done);
gaps.sort((a, b) => a - b);
console.log("Abstand zwischen ausgefuehrten Ausbauten: min", gaps[0], "s, Median", gaps[gaps.length >> 1],
  "s, max", gaps[gaps.length - 1], "s");

// --- Park ueber die Zeit rekonstruieren und eichen -------------------------
const parkAt = (t, evs) => evs.filter((e) => e.done <= t)
  .reduce((a, e) => a + (e.kind === "kauf" ? e.gb : e.to - e.from), 0);
console.log("\nEichung Rekonstruktion (Park-GB) an den Spielstaenden:");
for (const s of saves) console.log("  " + s.f.slice(31, 47), "Soll(Spielstand)", s.park, "Ist(Log)", parkAt(s.t, events));

// --- Ertrag je GB*s aus den Spielstaenden ----------------------------------
const yields = [];
for (let i = 1; i < saves.length; i++) {
  const dt = (saves[i].tBN - saves[i - 1].tBN) * 3600;
  yields.push((saves[i].hackInc - saves[i - 1].hackInc) / dt / ((saves[i].ram + saves[i - 1].ram) / 2));
}
const yMean = yields.reduce((a, b) => a + b, 0) / yields.length;
console.log("\nErtrag $/GB*s zwischen den Spielstaenden:", yields.map((y) => y.toFixed(0)).join(" "), "-> Mittel", yMean.toFixed(0));

// --- Geldkurve (echt) -------------------------------------------------------
// vor dem ersten Spielstand: linear von 0 (Knotenstart) bis zum ersten Wert
const t0 = saves[0].t - saves[0].tBN * 3600;
const moneyCurve = [{ t: t0, money: 0 }, ...saves.map((s) => ({ t: s.t, money: s.money }))];
const moneyAt = (t) => {
  if (t <= moneyCurve[0].t) return 0;
  for (let i = 1; i < moneyCurve.length; i++) {
    if (t <= moneyCurve[i].t) {
      const a = moneyCurve[i - 1], b = moneyCurve[i];
      return a.money + (b.money - a.money) * (t - a.t) / (b.t - a.t);
    }
  }
  return moneyCurve[moneyCurve.length - 1].money;
};

// --- Gegenlauf: gleiche Ausbauten, 40-s-Takt, Geldregel kosten*2 <= Geld --
function counterfactual(seq, takt = 40) {
  let tPrev = seq.length ? seq[0].done - takt : 0;
  let extraSpent = 0;   // im Gegenlauf frueher ausgegebenes Geld
  const out = [];
  for (const u of seq) {
    const cost = cloudCost(u.to, 2) - cloudCost(u.from, 2);
    let t = tPrev + takt;
    // Geldregel aus bn4net.js:1513 (kosten * 2 <= geldFrei, Ruecklage 0 in BN2)
    while (t < u.done && moneyAt(t) - extraSpent < 2 * cost) t += 10;
    if (t > u.done) t = u.done;
    out.push({ ...u, cf: t, cost });
    extraSpent += cost;   // bis zum echten Kauf zusaetzlich gebunden
    // nach dem echten Kauf gleicht sich das aus (dieselbe Ausgabe)
    extraSpent -= out.filter((o) => o.done <= t).reduce((a, o) => a + (o.counted ? 0 : (o.counted = true, o.cost)), 0);
    tPrev = t;
  }
  return out;
}
const cf = counterfactual(upgrades);
const end = saves[saves.length - 1].t;
let gbSec = 0;
for (const u of cf) gbSec += (Math.min(u.done, end) - u.cf) * (u.to - u.from);
console.log("\nGegenlauf (nur die tatsaechlich ausgefuehrten " + cf.length + " Ausbauten, 40-s-Takt):");
console.log("  letzter Ausbau echt", new Date(cf[cf.length - 1].done * 1000).toISOString().slice(11, 19),
  "gegen", new Date(cf[cf.length - 1].cf * 1000).toISOString().slice(11, 19));
console.log("  GB*s Vorsprung", gbSec.toExponential(3));
for (const y of [150, Math.round(yMean), 220]) {
  console.log("  Verlust bei " + y + " $/GB*s: " + (gbSec * y / 1e9).toFixed(2) + " Mrd $");
}
const totalInc = saves[saves.length - 1].hackInc;
console.log("  zum Vergleich: Hacking-Einnahmen BN2.1 bis 09:59:", (totalInc / 1e9).toFixed(2), "Mrd $");

// --- Obergrenze nach Bot-Regel: alle 25 auf 256 GB (Schritt 128->256 haelt
// den 600-s-Deckel bei >= 191 $/GB*s; 256->512 braucht 248 und faellt beim
// geeichten Ertrag durch) -----------------------------------------------------
const step = (from) => (cloudCost(2 * from, 2) - cloudCost(from, 2)) / from;
console.log("\nSchwelle 600 s je Schritt: 64->128", (step(64) / 600).toFixed(0), "| 128->256", (step(128) / 600).toFixed(0),
  "| 256->512", (step(256) / 600).toFixed(0), "| 512->1024", (step(512) / 600).toFixed(0), "$/GB*s");
// Gegenlauf B: nach den echten Ausbauten weiter 128->256 fuer die restlichen 21
const rest = [];
let tB = cf[cf.length - 1].cf;
for (let i = 4; i < 25; i++) rest.push({ from: 128, to: 256, done: Infinity, host: "werk-" + i });
let spent = 0, gbSecB = 0;
for (const r of rest) {
  const cost = cloudCost(256, 2) - cloudCost(128, 2);
  tB += 40;
  while (tB < end && moneyAt(tB) - spent < 2 * cost) tB += 10;
  if (tB >= end) break;
  spent += cost;
  gbSecB += (end - tB) * 128;
}
console.log("Gegenlauf B (zusaetzlich 21x 128->256 nach Bot-Regel): GB*s", gbSecB.toExponential(3),
  "-> bei " + Math.round(yMean) + " $/GB*s " + (gbSecB * yMean / 1e9).toFixed(2) + " Mrd $ zusaetzlich");
console.log("Summe A+B bei " + Math.round(yMean) + " $/GB*s: " + ((gbSec + gbSecB) * yMean / 1e9).toFixed(2) + " Mrd $ in "
  + ((end - t0) / 3600).toFixed(1) + " h = " + ((gbSec + gbSecB) * yMean / 1e9 / ((end - t0) / 3600)).toFixed(2) + " Mrd $/h");
