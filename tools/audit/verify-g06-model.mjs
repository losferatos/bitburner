// Gegenpruefung G06, Rechner 3: das Segmentmodell von hack-park.mjs (Formeln
// aus src/lib/calc.js) gegen MEHRERE Staende geeicht, nicht nur gegen einen.
//
// Je Stand: Geldarbeiter-RAM (laufende worker/*-Skripte ohne share), Modell-
// einnahme bei dieser Belegung, gemessene Einnahme (zentrale Differenz der
// kumulierten moneySourceA.hacking zwischen Nachbarstaenden desselben Zyklus),
// Realisierungsquote r = gemessen/Modell. Stabil r -> das Modell traegt
// Grenzaussagen; schwankt r -> nicht.
//
// Segmente: nur Ziele, die im Stand TATSAECHLICH Arbeiter tragen (Arg = Host),
// weil die Zielwahl des Bots unvorbereitete/gesperrte Ziele nicht bedient.
// Stapelziele (batchZiele der Telemetrie) bieten ramCeiling zu perS/ramCeiling,
// offene Ziele kapazitaet zu steadyEff (wie hack-park.mjs).
//
// Aufruf: node tools/audit/verify-g06-model.mjs <muster> [von] [bis]
//   muster  z.B. BN2L1 ; von/bis = Teilstrings der Dateinamen (Zeitfenster)
import fs from "node:fs";
import { loadSave, textFile, runningScripts } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";

const muster = process.argv[2] || "BN2L1";
const von = process.argv[3] || "";
const bis = process.argv[4] || "~";
const files = fs.readdirSync("backups")
  .filter((f) => f.includes(muster) && f.endsWith(".json.gz") && f >= von && f <= bis).sort();
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };

function analyse(file) {
  const { p, servers, save } = loadSave("backups/" + file);
  const pl = { skill: p.skills.hacking, int: p.skills.intelligence,
    multMoney: p.mults.hacking_money, multChance: p.mults.hacking_chance,
    multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed };
  const tele = JSON.parse(textFile(servers.home, "data/bn4net.json") || "{}");
  let geldGb = 0, shareGb = 0, netz = 0;
  const imSpiel = new Set();
  const procs = {};
  for (const [n, s] of Object.entries(servers)) {
    if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
    netz += s.maxRam || 0;
    for (const r of runningScripts(s)) {
      const gb = (r.ramUsage || 0) * (r.threads || 1);
      if (r.filename === "worker/share.js") shareGb += gb;
      else if (String(r.filename).startsWith("worker/")) {
        geldGb += gb;
        for (const a of (r.args || [])) if (servers[a]) { imSpiel.add(a); procs[a] = (procs[a] || 0) + gb; }
      }
    }
  }
  const stapel = new Set(tele.batchZiele || []);
  const expZiel = tele.expZiel || "joesguns";
  const bnGrowth = (tele.bnWerte && tele.bnWerte.serverGrowthRate) || 0.8;
  const bnShm = (tele.bnWerte && tele.bnWerte.scriptHackMoney) || 1;
  const seg = [];
  for (const [n, s] of Object.entries(servers)) {
    if (!imSpiel.has(n) || n === expZiel) continue;
    if (!s.hasAdminRights || s.purchasedByPlayer || !(s.moneyMax > 0)) continue;
    const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
    const kz = targetMetrics(s, pl, tIst, { ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
      bnScriptHackMoney: bnShm, bnServerGrowthRate: bnGrowth, bnServerWeakenRate: 1, mixMoneyHigh: 0.95,
      kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3 });
    if (!(kz.steadyEff > 0)) continue;
    const bt = batchThroughput(kz, s.moneyMax, netz, RAM, 1);
    if (stapel.has(n) && bt) seg.push({ host: n, art: "stapel", cap: bt.ramCeiling, eff: bt.perS / bt.ramCeiling });
    else seg.push({ host: n, art: "offen", cap: kz.kapazitaet, eff: kz.steadyEff });
  }
  seg.sort((a, b) => b.eff - a.eff);
  const income = (gb) => {
    let rest = gb, sum = 0, grenz = 0;
    for (const s of seg) { if (rest <= 0) break; const t = Math.min(rest, s.cap); sum += t * s.eff; rest -= t; grenz = s.eff; }
    return { sum, grenz, unbelegt: Math.max(0, rest) };
  };
  const msA = (p.moneySourceA && p.moneySourceA.data) || p.moneySourceA || {};
  const park = (p.purchasedServers || []).reduce((a, h) => a + (servers[h] ? servers[h].maxRam : 0), 0);
  return { file, t: p.totalPlaytime, sinceAug: p.playtimeSinceLastAug, hackA: msA.hacking || 0, lvl: pl.skill,
    geldGb, shareGb, netz, park, seg, income, inc: income(geldGb), n: seg.length,
    capSum: seg.reduce((a, s) => a + s.cap, 0) };
}

const rows = files.map(analyse);
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const a = rows[i - 1], b = rows[i + 1];
  // gemessene Rate: zentrale Differenz, nur innerhalb desselben Zyklus (sinceAug waechst)
  let lo = r, hi = r;
  if (a && a.sinceAug < r.sinceAug) lo = a;
  if (b && b.sinceAug > r.sinceAug) hi = b;
  const dt = (hi.t - lo.t) / 1000;
  r.rate = dt > 0 ? (hi.hackA - lo.hackA) / dt : NaN;
  // Modell: Mittel der Staende lo..hi (gleiche Gewichtung)
  const ms = [lo, r, hi].map((x) => x.inc.sum);
  r.modell = (lo === r || hi === r) ? (lo === hi ? r.inc.sum : (lo.inc.sum + r.inc.sum + (hi === r ? r.inc.sum : hi.inc.sum)) / 3) : ms.reduce((x, y) => x + y, 0) / 3;
  r.q = r.rate / r.modell;
}
console.log("Stand".padEnd(36), "seitAug L  park   netz  geldGb share  n  capSum   modell$/s  gemessen$/s  r    unbel  grenzEff");
for (const r of rows) {
  console.log(r.file.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(36),
    (r.sinceAug / 3.6e6).toFixed(2).padStart(6), String(r.lvl).padStart(3), String(r.park).padStart(6), String(r.netz).padStart(6),
    r.geldGb.toFixed(0).padStart(6), r.shareGb.toFixed(0).padStart(5), String(r.n).padStart(2), r.capSum.toFixed(0).padStart(7),
    (r.modell / 1e3).toFixed(0).padStart(8) + "k", (r.rate / 1e3).toFixed(0).padStart(8) + "k", r.q.toFixed(3).padStart(6),
    r.inc.unbelegt.toFixed(0).padStart(6), r.inc.grenz.toFixed(0).padStart(5));
}

// --- Gegenprobe gegen die Telemetrie des Bots: grenz = Grenzertrag der naechsten
// 1024 / 4096 / 16384 GB (data/bn4net.json mischung.grenz, Modelleinheiten).
// Hier: Mittel ueber die naechsten g GB im eigenen Modell, ebenfalls ohne r.
if (process.env.GRENZ) {
  console.log("\nGrenzertrag Modell vs Bot-Telemetrie [1024, 4096, 16384] $/GB*s");
  for (const r of rows) {
    const { p, servers } = loadSave("backups/" + r.file);
    const tele = JSON.parse(textFile(servers.home, "data/bn4net.json") || "{}");
    const m = [1024, 4096, 16384].map((g) => Math.round((r.income(r.geldGb + g).sum - r.inc.sum) / g));
    console.log(r.file.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(36), "Modell", JSON.stringify(m),
      " Bot", JSON.stringify(tele.mischung && tele.mischung.grenz), " kapFrei Bot", tele.mischung && tele.mischung.kapFreiGb, " Modell capSum-geld", Math.round(r.capSum - r.geldGb));
  }
}
