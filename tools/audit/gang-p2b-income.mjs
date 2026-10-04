// P2b: Einkommen des Bots (ohne Gang) aus Spielstaenden (NUR LESEN).
// moneySourceA = Quellen seit dem letzten Einbau (PlayerObjectGeneralMethods / MoneySourceTracker),
// moneySourceB = seit dem BitNode-Eintritt. Aufruf: node tools/audit/gang-p2b-income.mjs [datei.json.gz ...]
import fs from "node:fs";
import { loadLive, loadBackup } from "./gang-p2b-live.mjs";

function rows(save) {
  const p = JSON.parse(save.data.PlayerSave).data;
  const unwrap = (x) => (x && x.data !== undefined && x.ctor ? x.data : x);
  return { A: unwrap(p.moneySourceA), B: unwrap(p.moneySourceB), money: p.money, sinceAug: p.playtimeSinceLastAug, sinceNode: p.playtimeSinceLastBitnode };
}
const files = process.argv.slice(2);
const saves = files.length ? files.map((f) => ({ f, s: loadBackup(f) })) : [{ f: "LIVE", s: await loadLive() }];
for (const { f, s } of saves) {
  const r = rows(s);
  console.log(f.split(/[\/]/).pop(), "money", Math.round(r.money), "sinceAug h", (r.sinceAug / 3.6e6).toFixed(3), "sinceNode h", (r.sinceNode / 3.6e6).toFixed(2));
  console.log(" A:", JSON.stringify(r.A));
}
