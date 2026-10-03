// Audit 03.10.2026, Bereich HACK: Wieviel grow/weaken-Speicher verschenkt der
// Bot, weil er Faeden mit cores=1 plant, obwohl sie auf Wirten mit mehreren
// Kernen laufen?
//
// Spielformeln (reference/bitburner-src/src):
//   getCoreBonus(c) = 1 + (c-1)/16                     Server/ServerHelpers.ts:315-318
//   weaken: 0.05 * threads * coreBonus * WeakenRate    Server/ServerHelpers.ts:320-323
//   grow:   log-Wachstum * coreBonus * threads         Server/formulas/grow.ts:102-123
//   share:  threads * intBonus(int,2) * coreBonus      NetworkShare/Share.ts:21-24
//   Weltserver-Kerne: random in [ceil(layer/2), layer] Server/ServerHelpers.ts:403-405
// hack bekommt KEINEN Kernbonus (calculatePercentMoneyHacked kennt keine Kerne).
//
// Gemessen wird am echten Spielstand: je Wirt laufende grow/weaken-Faeden und
// seine Kerne. "Ueberschuss" = Faeden * (1 - 1/coreBonus) - so viele Faeden
// haetten bei kernbewusster Planung dieselbe Wirkung gehabt.
// Aufruf: node tools/audit/hack-kerne.mjs <backup.json.gz>
import { loadSave, runningScripts } from "./hack-save.mjs";

const coreBonus = (c) => 1 + ((c || 1) - 1) / 16;
const file = process.argv[2];
const { servers } = loadSave(file);

let netz = 0, gwGb = 0, gwSparGb = 0, hackGb = 0, shareGb = 0;
let ramMehrkern = 0, ramMehrkernGewicht = 0;
const zeilen = [];
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
  netz += s.maxRam || 0;
  const cb = coreBonus(s.cpuCores);
  if ((s.maxRam || 0) > 0 && cb > 1) { ramMehrkern += s.maxRam; ramMehrkernGewicht += s.maxRam * cb; }
  let gw = 0, h = 0, sh = 0;
  for (const r of runningScripts(s)) {
    const gb = (r.ramUsage || 0) * (r.threads || 1);
    if (r.filename === "worker/grow.js" || r.filename === "worker/weaken.js") gw += gb;
    else if (r.filename === "worker/hack.js") h += gb;
    else if (r.filename === "worker/share.js") sh += gb;
  }
  gwGb += gw; hackGb += h; shareGb += sh;
  const spar = gw * (1 - 1 / cb);
  gwSparGb += spar;
  if (gw > 0 && cb > 1) zeilen.push([n, s.cpuCores, cb.toFixed(4), s.maxRam, gw.toFixed(1), spar.toFixed(1)].join("\t"));
}
console.log("wirt\tkerne\tbonus\tmaxRam\tgrowWeakenGb\tsparGb");
console.log(zeilen.join("\n"));
console.log("---");
console.log("Netz (gerootet, ohne Hacknet) GB:", netz);
console.log("grow+weaken GB:", gwGb.toFixed(1), " hack GB:", hackGb.toFixed(1), " share GB:", shareGb.toFixed(1));
console.log("davon bei kernbewusster Planung frei GB:", gwSparGb.toFixed(1),
  "=", (100 * gwSparGb / netz).toFixed(2) + " % des Netzes");
console.log("Mehrkern-RAM GB:", ramMehrkern, " mittlerer Bonus dort:", (ramMehrkernGewicht / Math.max(1, ramMehrkern)).toFixed(4));
// Obergrenze: alle grow/weaken-Faeden auf die Mehrkern-Wirte gelegt (soweit Platz)
const anteilGW = gwGb / Math.max(1, gwGb + hackGb);
console.log("grow/weaken-Anteil an Geldarbeitern:", (100 * anteilGW).toFixed(1) + " %");
