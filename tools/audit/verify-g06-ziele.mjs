// Gegenpruefung G06 (HACK-4), Rechner 2: Zustand der drei angeblich "Rang 0"-
// Ziele (the-hub, johnson-ortho, crush-fitness) ueber alle BN2-Staende, dazu
// wer im Stand laeuft (Skripte pro Ziel-Argument).
// Aufruf: node tools/audit/verify-g06-ziele.mjs [muster] [host,host,...]
import fs from "node:fs";
import { loadSave, textFile, runningScripts } from "./hack-save.mjs";

const muster = process.argv[2] || "BN2L";
const hosts = (process.argv[3] || "the-hub,johnson-ortho,crush-fitness").split(",");
const dir = "backups";
const files = fs.readdirSync(dir).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
for (const f of files) {
  const { p, servers } = loadSave(dir + "/" + f);
  const j = (n) => { try { return JSON.parse(textFile(servers.home, n)); } catch { return null; } };
  const net = j("data/bn4net.json") || {};
  // Prozesse, die ein Ziel als Argument tragen
  const cnt = {};
  for (const [n, s] of Object.entries(servers)) {
    for (const r of runningScripts(s)) {
      const a = r.args || [];
      for (const h of hosts) if (a.includes(h)) {
        cnt[h] = cnt[h] || { procs: 0, thr: 0, files: new Set() };
        cnt[h].procs++; cnt[h].thr += r.threads || 1; cnt[h].files.add(r.filename.replace("worker/", ""));
      }
    }
  }
  const cols = hosts.map((h) => {
    const s = servers[h];
    if (!s) return h + ": -";
    const fill = (s.moneyAvailable / s.moneyMax).toFixed(2);
    const c = cnt[h] ? cnt[h].procs + "p/" + cnt[h].thr + "t[" + [...cnt[h].files].join(",") + "]" : "0";
    return h + " req" + s.requiredHackingSkill + " sec" + s.hackDifficulty.toFixed(0) + "/" + s.minDifficulty + " fill" + fill + " run:" + c;
  });
  console.log(f.replace("LIVE_197f4d61481686_", "").replace(".json.gz", "").padEnd(34),
    "L" + p.skills.hacking, "ziel", net.ziel, "n", net.zieleAnzahl, "batch", JSON.stringify(net.batchZiele), "|", cols.join(" | "));
}
