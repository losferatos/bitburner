// Audit 03.10.2026, Bereich HACK: Verlauf ueber mehrere Spielstaende eines
// Knotens - RAM-Belegung je Arbeiterart, share-Faeden, Arbeit der Figur,
// Hacking-Einnahme. Liest nur.
// Aufruf: node tools/audit/hack-verlauf.mjs <muster> (z.B. BN2L1)
import fs from "node:fs";
import path from "node:path";
import { loadSave, runningScripts } from "./hack-save.mjs";

const muster = process.argv[2] || "BN2L1";
const dir = "backups";
const files = fs.readdirSync(dir).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
console.log("datei\tplaytimeNodeH\thack\tnetzGb\tworkerGb\tshareThr\tshareGb\texpZielGb\tarbeit\thackGeld\tgeld");
for (const f of files) {
  const { p, servers } = loadSave(path.join(dir, f));
  let netz = 0, worker = 0, shareThr = 0, shareGb = 0;
  for (const s of Object.values(servers)) {
    if (!s.hasAdminRights) continue;
    if (String(s.hostname).startsWith("hacknet-")) continue;
    netz += s.maxRam || 0;
    for (const r of runningScripts(s)) {
      if (!String(r.filename).startsWith("worker/")) continue;
      worker += (r.ramUsage || 0) * (r.threads || 1);
      if (r.filename === "worker/share.js") { shareThr += r.threads; shareGb += r.ramUsage * r.threads; }
    }
  }
  const w = p.currentWork ? (p.currentWork.ctor + ":" + ((p.currentWork.data || {}).factionName || (p.currentWork.data || {}).classType || "")) : "null";
  console.log([f.replace(/^LIVE_\w+?_/, "").replace(".json.gz", ""), (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2), p.skills.hacking,
    netz, worker.toFixed(0), shareThr, shareGb.toFixed(0), "-", w,
    (p.moneySourceA.data.hacking / 1e9).toFixed(2) + "b", (p.money / 1e9).toFixed(2) + "b"].join("\t"));
}
