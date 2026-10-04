// Gegenpruefung G06 (INFRA-3 / HACK-4), Rechner 1: Zeitreihe je BN2-Spielstand.
// Liest nur backups/*.json.gz. Gibt je Stand aus: Zeit, Knoten, Stunden seit
// Einbau, Level, Park (GB), home (GB), Hack-Einnahme seit Einbau, Rate zum
// Vorgaenger, wartend, kampfZuFrueh, effFlotte, kapFreiGb, ueberschuss.
// Aufruf: node tools/audit/verify-g06-series.mjs [muster]
import fs from "node:fs";
import { loadSave, textFile } from "./hack-save.mjs";

const muster = process.argv[2] || "BN2L";
const dir = "backups";
const files = fs.readdirSync(dir).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
let prev = null;
const rows = [];
for (const f of files) {
  const { save, p, servers } = loadSave(dir + "/" + f);
  const home = servers.home;
  const park = (p.purchasedServers || []).map((h) => (servers[h] ? servers[h].maxRam : 0));
  const parkGb = park.reduce((a, b) => a + b, 0);
  const j = (n) => { try { return JSON.parse(textFile(home, n)); } catch { return null; } };
  const rep = j("data/bn4rep.json") || {};
  const net = j("data/bn4net.json") || {};
  const ein = j("data/einbau.json") || {};
  const msA = (p.moneySourceA && p.moneySourceA.data) || p.moneySourceA || {};
  const t = p.totalPlaytime;
  const row = {
    f: f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", ""),
    t, sinceAugH: p.playtimeSinceLastAug / 3.6e6, lvl: p.skills.hacking,
    parkN: park.length, parkGb, homeGb: home.maxRam,
    hackA: msA.hacking || 0, serversA: msA.servers || 0, money: p.money,
    wartend: rep.wartend, zuFrueh: ein.kampfZuFrueh, gangHold: ein.gangHold,
    eff: net.mischung && net.mischung.effFlotte,
    kapFrei: net.mischung && net.mischung.kapFreiGb, kapGes: net.mischung && net.mischung.kapGesamtGb,
    ueb: net.mischung && net.mischung.ueberschussGb,
    grenz: net.mischung && net.mischung.grenz,
    netzGb: net.netz,
    share: net.shareFaeden,
  };
  if (prev && prev.sinceAugH < row.sinceAugH) {
    const dt = (row.t - prev.t) / 1000;
    row.rate = (row.hackA - prev.hackA) / dt;   // $/s Hack-Einnahme zwischen den Staenden
    row.dt = dt;
  }
  rows.push(row);
  prev = row;
}
for (const r of rows) {
  console.log(
    r.f.padEnd(34), "seitAug", r.sinceAugH.toFixed(2).padStart(6), "h  L", String(r.lvl).padStart(4),
    " park", String(r.parkN).padStart(2) + "x", String(r.parkGb).padStart(6), "GB  home", String(r.homeGb).padStart(5),
    " hackA", (r.hackA / 1e9).toFixed(2).padStart(6), "Mrd", " rate", r.rate ? (r.rate / 1e3).toFixed(0).padStart(6) + "k$/s" : "     -     ",
    " wart", r.wartend, " zuFr", r.zuFrueh, " hold", r.gangHold,
    " eff", r.eff, " kapFrei", r.kapFrei, " ueb", r.ueb, " grenz", JSON.stringify(r.grenz),
  );
}
