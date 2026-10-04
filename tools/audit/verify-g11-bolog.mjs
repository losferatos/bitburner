// Gegenpruefung G11: Black-Op-Zeitleiste und Aktionsmischung je Stunde aus dem Aktionsprotokoll (nur lesen).
import path from "node:path";
import { ladeSpielstand, homeDatei } from "./blade-lage.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-04T10-38_pre-jump.json.gz";
const { servers } = ladeSpielstand(path.join(root, "backups", datei));
const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
const ak = (homeDatei(servers, "data/aktionen.txt") || "").split("\n").filter((z) => z.trim()).map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean)
  .filter((z) => z.von >= (bj?.nodeReset || 0));
console.log("Felder", Object.keys(ak[0]).join(","));
const t0 = ak[0].von;
const h = (ms) => ((ms - t0) / 3.6e6).toFixed(2);
for (const z of ak) if (z.aktion.startsWith("Black")) console.log("t+" + h(z.von) + "h", new Date(z.von).toISOString().slice(5, 16), z.aktion.replace("Black Operations/Operation ", "BO "), "dauer", ((z.bis - z.von) / 60000).toFixed(1) + "min", "rang", Math.round(z.rangVon), "->", Math.round(z.rangBis), z.chance != null ? "chance " + z.chance : "", z.erfolg != null ? "erfolg " + z.erfolg : "");
// Mischung je Wanduhr-Stunde (seit t0)
const je = new Map();
for (const z of ak) {
  const b = Math.floor((z.von - t0) / 3.6e6);
  const e = je.get(b) || {};
  const k = z.aktion.replace("Operations/", "").replace("Contracts/", "C:").replace("General/Hyperbolic Regeneration Chamber", "Kammer").replace("Black Operations/", "BO:");
  const kk = k.startsWith("BO:") ? "BO" : k;
  e[kk] = (e[kk] || 0) + (z.bis - z.von) / 60000;
  je.set(b, e);
}
for (const [b, e] of [...je.entries()].sort((a, b) => a[0] - b[0])) {
  const tot = Object.values(e).reduce((a, c) => a + c, 0);
  console.log("h" + String(b).padStart(2), new Date(t0 + b * 3.6e6).toISOString().slice(5, 16), Object.entries(e).sort((a, c) => c[1] - a[1]).map(([k, v]) => k + " " + Math.round(100 * v / tot) + "%").join("  "));
}
