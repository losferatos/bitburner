// Gegenpruefung G05: Zeitreihe ueber die stuendlichen Spielstaende eines Knotens:
// home-RAM/Kerne, Park, Einnahmen (moneySourceB.hacking), Serverausgaben, laufende GB je Skriptart.
// Aufruf: node tools/audit/verify-g05-zeitreihe.mjs <muster> [von] [bis]   (Muster: Teil des Dateinamens)
import fs from "node:fs";
import { loadSave, runningScripts } from "./hack-save.mjs";

const [muster, von = "", bis = "9"] = process.argv.slice(2);
const files = fs.readdirSync("backups").filter((f) => f.includes(muster) && f >= von && f <= bis + "~").sort();
let prev = null;
for (const f of files) {
  let d;
  try { d = loadSave("backups/" + f); } catch (e) { console.log(f, "FEHLER", String(e)); continue; }
  const { p, servers } = d;
  const ms = (p.moneySourceB && p.moneySourceB.data) || p.moneySourceB || {};
  const msA = (p.moneySourceA && p.moneySourceA.data) || p.moneySourceA || {};
  let park = 0, parkN = 0;
  for (const h of p.purchasedServers || []) { const s = servers[h]; if (s) { park += s.maxRam; parkN++; } }
  const cat = { grow: 0, weaken: 0, hack: 0, share: 0, other: 0, homeGw: 0, homeShare: 0, homeHack: 0, homeCtl: 0 };
  let netRam = 0;
  for (const [n, s] of Object.entries(servers)) {
    if (!s.hasAdminRights && n !== "home") continue;
    if (n.startsWith("hacknet-")) continue;
    netRam += s.maxRam || 0;
    for (const r of runningScripts(s)) {
      const gb = (r.ramUsage || 0) * (r.threads || 1);
      const fn = r.filename;
      const isHome = n === "home";
      if (fn === "worker/grow.js") { cat.grow += gb; if (isHome) cat.homeGw += gb; }
      else if (fn === "worker/weaken.js") { cat.weaken += gb; if (isHome) cat.homeGw += gb; }
      else if (fn === "worker/hack.js") { cat.hack += gb; if (isHome) cat.homeHack += gb; }
      else if (fn === "worker/share.js") { cat.share += gb; if (isHome) cat.homeShare += gb; }
      else if (isHome) cat.homeCtl += gb;
      else cat.other += gb;
    }
  }
  const h = servers.home;
  const hrs = p.playtimeSinceLastBitnode / 3.6e6;
  const row = {
    f: f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", ""),
    bnH: hrs.toFixed(2), augH: (p.playtimeSinceLastAug / 3.6e6).toFixed(2),
    homeRam: h.maxRam, cores: h.cpuCores, park, parkN, netRam,
    money: (p.money / 1e9).toFixed(2),
    hackSrcB: (ms.hacking / 1e9).toFixed(2), serversB: (ms.servers / 1e9).toFixed(3),
    hackSrcA: (msA.hacking / 1e9).toFixed(2),
    gw: (cat.grow + cat.weaken).toFixed(0), hk: cat.hack.toFixed(0), sh: cat.share.toFixed(0),
    homeGw: cat.homeGw.toFixed(0), homeHk: cat.homeHack.toFixed(0), homeSh: cat.homeShare.toFixed(0), homeCtl: cat.homeCtl.toFixed(0),
  };
  if (prev) {
    const dt = hrs - prev.hrs;
    row.rateHack = dt > 0.05 ? ((ms.hacking - prev.hack) / 1e9 / dt).toFixed(2) : "-";
  }
  prev = { hrs, hack: ms.hacking };
  console.log(JSON.stringify(row));
}
