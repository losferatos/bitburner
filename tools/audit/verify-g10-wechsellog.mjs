// Gegenpruefung G10 (BLADE-1): Aktionsprotokoll rund um den Stadtwechsel Sector-12 -> Ishima
// in BN2.1 (Fenster in Lokalzeit). Zeigt, ob nach dem Wechsel Field Analysis / Stillstand folgte.
// Aufruf: node tools/audit/verify-g10-wechsellog.mjs [von=09:40] [bis=10:40] [backup]
import path from "node:path";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const von = process.argv[2] || "09:40", bis = process.argv[3] || "10:40";
const datei = process.argv[4] || "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38_pre-jump.json.gz";
const { servers } = ladeSpielstand(path.join(root, "backups", datei));
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
const lokal = (ms) => new Date(ms + 2 * 3.6e6).toISOString().slice(5, 19).replace("T", " ");
for (const z of ak) {
  const l = lokal(z.von);
  if (l.slice(0, 5) !== "10-03") continue;
  const hm = l.slice(6, 11);
  if (hm < von || hm > bis) continue;
  console.log(l, ((z.bis - z.von) / 1000).toFixed(0).padStart(5) + "s", z.aktion.padEnd(46), "Rang", (z.rangVon).toFixed(0), "->", (z.rangBis).toFixed(0), "|", (z.grund || "").slice(0, 90));
}
