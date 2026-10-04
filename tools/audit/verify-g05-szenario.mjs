// Gegenpruefung G05 (04.10.2026): Szenarien fuer INFRA-2 (Kern) und INFRA-4 (home-RAM-Leiter) in BN2.1.
//
// Alles aus den stuendlichen Spielstaenden (backups/) und den Preisformeln aus
// verify-g05-preise.mjs (geeicht: Soll = Ist auf 1.9e-16). Liest nur.
//
// Zeitachse: bnH = playtimeSinceLastBitnode in Spielstunden (== Wanduhr, solange das Spiel laeuft;
// zwischen 09:59 und 17:16 am 03.10. liegt eine LUECKE ohne Spielstand (7,28 h): die
// Einnahmen dort sind der Unterschied zweier Staende, kein Messwert je Stunde.
//
// Szenario K (Kern): Obergrenze des Rueckflusses = Summe ueber Intervalle
//   homeGw * (1 - 1/1.0625) * y * dt     (so viele grow/weaken-GB haette eine kernbewusste Planung gespart,
//   JEDES gesparte GB voll mit y $/GB*s verwertet)
// Szenario R (RAM-Leiter): Wegfall des home-RAM ueber 512 GB bei GEDROSSELTER Cloud-Pipeline (INFRA-1 offen):
//   Verlust = Summe ueber Intervalle dRam(t) * y * dt, mit y aus der Einnahmenrate des Intervalls
//   (Durchschnittsertrag je netRam, Untergrenze) bzw. 395 $/GB*s (Regression, Obergrenze).
//
// Aufruf: node tools/audit/verify-g05-szenario.mjs
import fs from "node:fs";
import { loadSave, runningScripts } from "./hack-save.mjs";
import { homeRamCost, homeCoreCost, cloudCost, BN } from "./verify-g05-preise.mjs";

const dir = "backups/";
const names = fs.readdirSync(dir).filter((f) => f.includes("BN2L1") && f >= "LIVE_197f4d61481686_BN2L1_2026-10-03T05" && f <= "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38~").sort();
const pts = [];
for (const f of names) {
  const { p, servers } = loadSave(dir + f);
  const ms = p.moneySourceB.data || p.moneySourceB;
  let net = 0, homeGw = 0;
  for (const [n, s] of Object.entries(servers)) {
    if ((!s.hasAdminRights && n !== "home") || n.startsWith("hacknet-")) continue;
    net += s.maxRam || 0;
    if (n === "home") for (const r of runningScripts(s)) if (r.filename === "worker/grow.js" || r.filename === "worker/weaken.js") homeGw += (r.ramUsage || 0) * (r.threads || 1);
  }
  // ts-Wiederholungen (Staende wenige Minuten nach dem Einbau etc.) bleiben drin; Intervalle <1 min werden unten ignoriert
  pts.push({ f, h: p.playtimeSinceLastBitnode / 3.6e6, aug: p.playtimeSinceLastAug / 3.6e6, hack: ms.hacking, net, homeRam: servers.home.maxRam, homeGw, cores: servers.home.cpuCores });
}
pts.sort((a, b) => a.h - b.h);

// Tatsaechliche home-Groessen nach data/homegrow.txt (Spielstand-Logs): Zeitpunkte in bnH
const T0 = 4 + 42 / 60 + 24 / 3600; // Knotenstart 04:42:24 lokal
const hh = (hm) => { const [h, m, s] = hm.split(":").map(Number); return h + m / 60 + s / 3600 - T0; };
const timeline = [
  { h: 0, ram: 128 }, { h: hh("05:43:49"), ram: 256 }, { h: hh("05:58:10"), ram: 512 }, { h: hh("06:43:53"), ram: 1024 },
  { h: hh("10:01:00"), ram: 2048 }, { h: hh("17:16:44"), ram: 4096 },
];
const ramAt = (h) => { let r = 128; for (const t of timeline) if (h >= t.h) r = t.ram; return r; };
console.log("home-Zeitplan (bnH): " + timeline.map((t) => t.ram + "@" + t.h.toFixed(2)).join("  "));
console.log("Kern 1->2 um bnH " + hh("08:36:52").toFixed(2) + " (08:36:52), 2048 um " + hh("10:01:00").toFixed(2) + " -> Verzug der 2048-Verdopplung durch den Kern: " + (hh("10:01:00") - hh("08:36:52")).toFixed(2) + " h nach dem Kern");

console.log("\n=== Szenario K: Obergrenze Rueckfluss des Kerns (Kern ab bnH " + hh("08:36:52").toFixed(2) + ")");
const tK = hh("08:36:52");
for (const y of [208, 242, 395]) {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const t0 = Math.max(a.h, tK), t1 = b.h;
    if (t1 <= t0 || b.h - a.h < 0.02) continue;
    // homeGw im Intervall: Mittel der Randwerte, in der Luecke 09:59-17:16 nur der Randwert vor dem Sprung auf 4096 (Untergrenze)
    const gw = (b.h - a.h > 3) ? Math.max(a.homeGw, 0) : (a.homeGw + b.homeGw) / 2;
    sum += gw * (1 - 1 / 1.0625) * y * 3600 * (t1 - t0);
  }
  console.log("  y=" + y + " $/GB*s: Obergrenze " + (sum / 1e9).toFixed(2) + " Mrd (Luecke 7,3 h nur mit Randwert; Aufschlag hoechstens ~0,3 Mrd)");
}
console.log("  Kosten Kern: " + (homeCoreCost(1) / 1e9).toFixed(2) + " Mrd; Folgekern 2->3 " + (homeCoreCost(2) / 1e9).toFixed(2) + " Mrd");

// Sequenzkosten: 2048-Verdopplung haette bei Geld > 3 x Preis ausgeloest
const p2048 = homeRamCost(1024);
console.log("\n=== Sequenzkosten des Kerns (er kam vor der 2048-Verdopplung, homegrow.js: Kerne zuerst)");
console.log("  2048-Verdopplung kostet " + (p2048 / 1e9).toFixed(3) + " Mrd, Schwelle 3x = " + (3 * p2048 / 1e9).toFixed(2) + " Mrd; Kernschwelle 1,2x = " + (1.2 * homeCoreCost(1) / 1e9).toFixed(2) + " Mrd");
for (const y of [216, 300, 395]) {
  const delayH = hh("10:01:00") - hh("08:36:52") - 0.08; // ~5 min bis die 9,53-Mrd-Schwelle erreicht waere
  console.log("  y=" + y + ": 1024 GB * " + delayH.toFixed(2) + " h -> " + (1024 * y * 3600 * delayH / 1e9).toFixed(2) + " Mrd entgangene Einnahmen");
}

console.log("\n=== Szenario R: home-RAM ueber 512 GB gesperrt, Cloud-Pipeline gedrosselt (INFRA-1 offen)");
let lossAvg = 0, lossMarg = 0;
for (let i = 1; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i];
  const dt = b.h - a.h;
  if (dt < 0.02) continue;
  if (b.aug < a.aug) continue; // Einbau-Intervall (Zaehler springt): Einnahmen dort ~0
  const income = b.hack - a.hack;
  const netAvg = (a.net + b.net) / 2;
  // dRam: gewichtetes Mittel (ramAt in 50 Teilschritten) minus 512
  let dRam = 0; const N = 50;
  for (let k = 0; k < N; k++) dRam += Math.max(0, ramAt(a.h + dt * (k + 0.5) / N) - 512);
  dRam /= N;
  lossAvg += income * (dRam / netAvg);       // proportional (Durchschnittsertrag)
  lossMarg += dRam * 395 * 3600 * dt;         // Grenzertrag-Obergrenze
}
console.log("  Verlust Einnahmen BN2.1: proportional (Untergrenze) " + (lossAvg / 1e9).toFixed(1) + " Mrd, Grenzertrag 395 (Obergrenze) " + (lossMarg / 1e9).toFixed(1) + " Mrd");
let spendOver512 = 0;
for (let R = 512; R < 4096; R *= 2) spendOver512 += homeRamCost(R);
console.log("  eingesparte Ausgabe (home 512->4096): " + (spendOver512 / 1e9).toFixed(2) + " Mrd");
console.log("  Hacking-Einnahmen BN2.1 gesamt (letzter Stand): " + (pts[pts.length - 1].hack / 1e9).toFixed(1) + " Mrd");

console.log("\n=== Szenario F: INFRA-1/3 behoben (Cloud-Wiederaufbau in ~50 min), home auf 512 gedeckelt");
const cycles = 3;
let cloudExtraPerCycle = []; // 3584 GB mehr Cloud bei Park-Zustand ~ 25 x 256..512
for (const gbPerSrv of [256, 512]) {
  const extraGb = 3584; const perSrv = extraGb / 25; // 143 GB je Server
  // Grenzpreis: Schritt gbPerSrv -> 2 gbPerSrv je GB mal extraGb
  const price = (cloudCost(2 * gbPerSrv, 1, 1.3) - cloudCost(gbPerSrv, 1, 1.3)) / gbPerSrv;
  cloudExtraPerCycle.push(price * extraGb);
}
console.log("  Cloud-Ausgleich fuer 3584 GB je Zyklus: " + cloudExtraPerCycle.map((x) => (x / 1e9).toFixed(2)).join("-") + " Mrd, mal " + cycles + " Zyklen (Cloud geht beim Einbau verloren)");
const lostWindow = [116, 195].map((y) => 3584 * 0.5 * (50 / 60) * y * 3600);
console.log("  Verlust im Wiederaufbaufenster (3584 GB linear ueber 50 min -> 0): " + lostWindow.map((x) => (x / 1e9).toFixed(2)).join("-") + " Mrd je Einbau, 2 Einbauten");
const lo = spendOver512 - cycles * cloudExtraPerCycle[1] - 2 * lostWindow[1];
const hi = spendOver512 - cycles * cloudExtraPerCycle[0] - 2 * lostWindow[0];
console.log("  Netto Szenario F: +" + (lo / 1e9).toFixed(1) + " bis +" + (hi / 1e9).toFixed(1) + " Mrd je Knoten wie BN2.1");
