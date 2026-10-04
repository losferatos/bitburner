// Audit 04.10.2026, Gegenpruefung G04 (share, HACK-1): Eichung des Hack-Modells
// gegen die GEMESSENE Hackeinnahme, aber mit der WIRKLICHEN Belegung je Ziel
// (nicht der Annahme "nach Effizienz gefuellt" wie in hack-park.mjs).
//
// Modell je Ziel: Stapelziele (data/bn4net.json batchZiele) = perS/ramCeiling
// aus batchThroughput, offene Ziele = targetMetrics.steadyEff (calc.js, geeicht
// gegen ns.formulas in data/calccheck.txt). Das Erfahrungsziel (expZiel) zaehlt
// 0 $. Belegung = laufende Worker je Ziel (args[0]) in GB.
//   modell(t) = Summe GB(ziel) * eff(ziel)
// Eichgroesse: r = gemessene Hackeinnahme / Modell. Gemessen wird zwischen
// zwei aufeinanderfolgenden Staenden desselben Laufs (moneySourceA.hacking,
// Delta durch Delta playtimeSinceLastBitnode); Modell = Mittel beider Staende.
//
// Aufruf: node tools/audit/verify-g04-calib.mjs <muster> [bnGrowth] [bnShm]
// Liest nur.
import fs from "node:fs";
import path from "node:path";
import { loadSave, runningScripts, textFile } from "./hack-save.mjs";
import { targetMetrics, batchThroughput, hackTime } from "../../src/lib/calc.js";

const muster = process.argv[2] || "BN2L1";
const bnGrowth = Number(process.argv[3] || 0.8);
const bnShm = Number(process.argv[4] || 1);
const dir = "backups";
const RAM = { hackT: 1.75, growT: 1.8, weakenT: 1.8 };

function analyse(file) {
  const { p, servers } = loadSave(path.join(dir, file));
  const pl = {
    skill: p.skills.hacking, int: p.skills.intelligence,
    multMoney: p.mults.hacking_money, multChance: p.mults.hacking_chance,
    multGrow: p.mults.hacking_grow, multSpeed: p.mults.hacking_speed,
  };
  let netz = 0, shareGb = 0;
  const fill = {};
  for (const [n, s] of Object.entries(servers)) {
    if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
    netz += s.maxRam || 0;
    for (const r of runningScripts(s)) {
      const f = String(r.filename);
      if (!f.startsWith("worker/")) continue;
      const gb = (r.ramUsage || 0) * (r.threads || 1);
      if (f === "worker/share.js") { shareGb += gb; continue; }
      const t = String((r.args || [])[0] ?? "?");
      fill[t] = (fill[t] || 0) + gb;
    }
  }
  let tele = null;
  try { tele = JSON.parse(textFile(servers.home, "data/bn4net.json")); } catch { tele = null; }
  const stapelSet = new Set((tele && tele.batchZiele) || []);
  const expZiel = tele ? tele.expZiel : null;
  let modell = 0, geldGb = 0;
  const detail = [];
  for (const [t, gb] of Object.entries(fill)) {
    const s = servers[t];
    if (!s || !(s.moneyMax > 0)) { continue; }
    geldGb += gb;
    if (t === expZiel) continue;
    const tIst = hackTime({ sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill }, pl, 1);
    const kz = targetMetrics(s, pl, tIst, {
      ramHackT: RAM.hackT, ramGrowT: RAM.growT, ramWeakenT: RAM.weakenT,
      bnScriptHackMoney: bnShm, bnServerGrowthRate: bnGrowth, bnServerWeakenRate: 1,
      mixMoneyHigh: 0.95, kapAbzug: 0.2, secOk: 1, moneyLow: 0.75, prepRamGb: netz * 0.3,
    });
    let eff = kz.steadyEff || 0, art = "offen";
    if (stapelSet.has(t)) {
      const bt = batchThroughput(kz, s.moneyMax, netz, RAM, 1);
      if (bt) { eff = bt.perS / bt.ramCeiling; art = "stapel"; }
    }
    modell += gb * eff;
    detail.push(t + ":" + art + ":" + gb.toFixed(0) + "x" + eff.toFixed(0));
  }
  return {
    file, hack: p.skills.hacking, hackSum: p.moneySourceA.data.hacking, play: p.playtimeSinceLastBitnode / 1000,
    aug: p.playtimeSinceLastAug / 1000, netz, shareGb, geldGb, modell, detail, stapel: [...stapelSet], expZiel,
  };
}

const files = fs.readdirSync(dir).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
const st = files.map(analyse);
console.log("paar\tdauerMin\tgemessen$/s\tmodell$/s\tr\thack\tgeldGb\tshareGb\tAnteilShare");
const rs = [];
for (let i = 1; i < st.length; i++) {
  const a = st[i - 1], b = st[i];
  const dt = b.play - a.play;
  // Aug-Einbau dazwischen (playtimeSinceLastAug faellt) -> Paar auslassen
  if (b.aug < a.aug || dt <= 0 || b.hackSum < a.hackSum) continue;
  const gem = (b.hackSum - a.hackSum) / dt;
  const mod = (a.modell + b.modell) / 2;
  const ereignis = /connect|hotswap|install|jump/.test(a.file + b.file) ? "*" : "";
  const r = gem / mod;
  if (!ereignis && dt > 3000) rs.push({ r, a, b, gem, mod });
  console.log([a.file.replace(/^LIVE_\w+?_/, "").replace(".json.gz", "").slice(0, 28) + ">" + b.file.slice(-22, -8), (dt / 60).toFixed(0) + ereignis,
    gem.toFixed(0), mod.toFixed(0), r.toFixed(3), b.hack, ((a.geldGb + b.geldGb) / 2).toFixed(0), ((a.shareGb + b.shareGb) / 2).toFixed(0),
    (((a.shareGb + b.shareGb) / 2) / ((a.netz + b.netz) / 2)).toFixed(3)].join("\t"));
}
const mw = rs.reduce((x, y) => x + y.r, 0) / (rs.length || 1);
const sd = Math.sqrt(rs.reduce((x, y) => x + (y.r - mw) ** 2, 0) / (rs.length || 1));
console.log("\nsaubere Stundenpaare:", rs.length, " r Mittel", mw.toFixed(3), " Streuung", sd.toFixed(3),
  " min", Math.min(...rs.map((x) => x.r)).toFixed(3), " max", Math.max(...rs.map((x) => x.r)).toFixed(3));
if (process.env.DETAIL) for (const x of st) console.log(x.file.slice(-34), x.detail.join(" "), "| stapel", x.stapel.join(","), "exp", x.expZiel);
