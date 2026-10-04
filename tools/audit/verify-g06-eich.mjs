// Gegenpruefung G06: Eichungen (Soll = Wert aus dem Spielstand, Ist = eigene Formel).
//  E1  Cloud-Preisformel gegen data/preise.json (vom Spiel ueber ns.cloud.getServerCost) BN2.2 12:17
//  E2  Kosten der Parkstufen, die der Bot im Log nennt ("fuer rund 5.6m" / "38.1m")
//  E3  Amortisation des Bots aus Log: kosten/(zusatzGb*ertrag) -> zurueckgerechneter Ertrag gegen mischung.grenz
import { loadSave, textFile } from "./hack-save.mjs";
import { cloudCost } from "./infra-costs.mjs";
const { servers } = loadSave("backups/LIVE_197f4d61481686_BN2L2_2026-10-04T12-17_hourly.json.gz");
const preise = JSON.parse(textFile(servers.home, "data/preise.json")).preise;
let maxRel = 0, n = 0;
for (const [gb, p] of Object.entries(preise)) { const ist = cloudCost(Number(gb), 2); const rel = Math.abs(ist - p) / p; maxRel = Math.max(maxRel, rel); n++; }
console.log("E1 Cloud-Preise BN2 (CSS 1,3), " + n + " Groessen: max. rel. Abweichung Ist gegen Soll =", maxRel.toExponential(2));
const st = (a, b) => (cloudCost(b, 2) - cloudCost(a, 2)) / 1e6;
console.log("E2 Stufe 64->128: Ist", st(64, 128).toFixed(3), "m (Log 5.6m) | 128->256:", st(128, 256).toFixed(2), "m (Log 14.6m) | 256->512:", st(256, 512).toFixed(2), "m (Log 38.1m) | 512->1024:", st(512, 1024).toFixed(1), "m | 1024->2048:", st(1024, 2048).toFixed(1), "m");
console.log("   Park 25x128 -> 25x256:", (25 * st(128, 256) / 1e3).toFixed(3), "Mrd (Soll aus HACK/INFRA: 0,37) | -> 25x512:", (25 * (st(128, 256) + st(256, 512)) / 1e3).toFixed(3), "Mrd (Soll 1,32) | -> 25x1024:", (25 * (st(128, 256) + st(256, 512) + st(512, 1024)) / 1e3).toFixed(2), "Mrd");
// E3: aus Logzeilen den Ertrag des Bots zurueckrechnen
const cases = [
  ["BN2.1 c2 05:34 256->512, amort 276 s, grenz[0] 05:17 = 537", 38.1e6, 256, 276, 537],
  ["BN2.1 c1 09:47 128->256, amort 352 s, grenz[0] 09:46/09:59 = 324/338", 14.6e6, 128, 352, 331],
  ["BN2.1 c3 10:35 64->128, amort 150 s, grenz[0] 10:38 = 590", 5.6e6, 64, 150, 590],
  ["BN2.2 12:07 64->128, amort 364 s, grenz[0] 12:17 = 402", 5.632e6, 64, 364, 402],
];
for (const [t, k, z, am, g] of cases) console.log("E3", t, "-> Ertrag aus Log", (k / (z * am)).toFixed(0), "$/GB*s, Verhaeltnis zu grenz[0]:", (k / (z * am) / g).toFixed(2));
