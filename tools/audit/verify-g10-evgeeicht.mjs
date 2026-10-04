// Gegenpruefung G10 (BLADE-1): Eichung des Raid-Ertragsmodells (Erfolge x 55 x 1,1^(L-1) - Fehlschlaege x 2,5 x 1,1^(L-1))
// gegen den REALISIERTEN Raid-Rang aus dem Aktionsprotokoll (data/aktionen.txt, Summe rangBis-rangVon der Raid-Abschnitte).
// Soll = Protokoll, Ist = Modell aus den Zaehlern (successes/failures/level) der Spielstaende.
// Aufruf: node tools/audit/verify-g10-evgeeicht.mjs
import fs from "node:fs";
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
function lauf(muster, letzteDatei) {
  const dateien = fs.readdirSync(path.join(root, "backups")).filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
  let prev = null, modell = 0;
  for (const f of dateien) {
    const { p } = ladeSpielstand(path.join(root, "backups", f));
    const r = flach(p.bladeburner).operations.Raid;
    if (prev) {
      const dok = r.successes - prev.successes, dfl = r.failures - prev.failures;
      if (dok >= 0 && dfl >= 0) {
        const Lm = (r.level + prev.level) / 2;
        // Stufen steigen mit den Erfolgen: Mitte der Stufen ist eine grobe Naeherung -> geometrisches Mittel der Faktoren
        const f1 = Math.pow(1.1, prev.level - 1), f2 = Math.pow(1.1, r.level - 1);
        const fm = f1 === f2 ? f1 : (f2 - f1) / Math.log(f2 / f1);
        modell += dok * 55 * fm - dfl * 2.5 * fm;
      }
    }
    prev = { successes: r.successes, failures: r.failures, level: r.level };
  }
  const { servers } = ladeSpielstand(path.join(root, "backups", letzteDatei));
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean).filter((z) => z.von >= bj.nodeReset);
  let soll = 0, ms = 0;
  for (const z of ak) if (z.aktion === "Operations/Raid" && Number.isFinite(z.rangBis) && Number.isFinite(z.rangVon)) { soll += z.rangBis - z.rangVon; ms += z.bis - z.von; }
  console.log(muster, "| Raid-Rang Soll (Protokoll)", soll.toFixed(0), " Ist (Modell aus Zaehlern)", modell.toFixed(0), " Abweichung", (100 * (modell / soll - 1)).toFixed(1) + " %", "| Raid-Zeit", (ms / 60000).toFixed(0), "min");
}
lauf("BN2L1", "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38_pre-jump.json.gz");
lauf("BN2L2", "LIVE_197f4d61481686_BN2L2_2026-10-04T13-17_hourly.json.gz");
