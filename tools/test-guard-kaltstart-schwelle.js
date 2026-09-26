/**
 * Ebene 0: `guard.js` - die Kaltstart-Schwelle des Phasen-Rueckfalls
 * (Audit-Fund 6#7, Paket C.5, 26.09.2026).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * Der Waechter faellt auf `ns.getServerMaxRam("home") <= 64` zurueck, wenn er
 * keinen frischen Kernblock sieht - das war die Schwelle, solange home nach
 * jedem Reset mit 32 GB startet. `Prestige.ts:241-242` setzt home ab
 * Source-File 9 Stufe 2 aber auf 128 GB (Eric hat SF9.3): "<=64" ist dann in
 * GENAU dem Fenster, in dem der Waechter allein zustaendig ist, nie mehr wahr
 * gewesen - er haette "normal" angenommen und die Kaltstart-Gewerke (cdump,
 * csolve, darkweb, sleevecrime) nicht ueberwacht, obwohl kein Park stand.
 *
 * Reine Funktion, keine Spielumgebung noetig.
 *
 * Aufruf: node tools/test-guard-kaltstart-schwelle.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

// guard.js importiert lib/uhren.js, lib/leiter.js, lib/reg.js, lib/events.js
// im Spielstil ("lib/x.js", absolut ab home) - ein blosser `import()` von
// Node aus scheitert daran (ERR_MODULE_NOT_FOUND). `ladeAusBeiden` schreibt
// die Importzeilen relativ um, genau wie fuer die anderen Ebene-2-Tests.
const { modul: GUARD } = await ladeAusBeiden(ROOT, "guard.js");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

console.log("");
console.log("=== Ebene 0: guard.js - homeKaltstartSchwelleGb (6#7) ===");

console.log("");
console.log("-- ohne SF9 (oder Stufe 1): die alte Schwelle 64 --");
{
  pruefe("kein ownedSF", GUARD.homeKaltstartSchwelleGb(undefined) === 64);
  pruefe("leere Map", GUARD.homeKaltstartSchwelleGb(new Map()) === 64);
  pruefe("leeres Objekt", GUARD.homeKaltstartSchwelleGb({}) === 64);
  pruefe("SF9 Stufe 1 (Map)", GUARD.homeKaltstartSchwelleGb(new Map([[9, 1]])) === 64);
  pruefe("SF9 Stufe 1 (Objekt)", GUARD.homeKaltstartSchwelleGb({ 9: 1 }) === 64);
}

console.log("");
console.log("-- ab SF9 Stufe 2: home startet mit 128 GB (Prestige.ts:241-242) --");
{
  pruefe("SF9 Stufe 2 (Map)", GUARD.homeKaltstartSchwelleGb(new Map([[9, 2]])) === 128);
  pruefe("SF9 Stufe 3 (Erics Stand, Objekt)", GUARD.homeKaltstartSchwelleGb({ 9: 3 }) === 128);
}

console.log("");
console.log("-- die eigentliche Regression: 96 GB home nach einem Sprung mit SF9.3 --");
{
  // BELEGT (Bericht 6#7): 01:04 nach BN5-Start standen bei SF9.3 bereits
  // 117 GB von 128 belegt. Die ALTE Schwelle (<=64) haette diesen Zustand
  // schon bei viel weniger Belegung faelschlich als "normal" gemeldet -
  // hier reicht ein einfacherer Beleg: 96 GB frisches home (< 128, > 64)
  // muss mit SF9.3 weiterhin als Kaltstart gelten.
  const schwelle = GUARD.homeKaltstartSchwelleGb({ 9: 3 });
  pruefe("96 GB gilt mit SF9.3 als Kaltstart (96 <= " + schwelle + ")", 96 <= schwelle);
  const schwelleAlt = 64;
  pruefe("die ALTE Schwelle haette das verfehlt (96 > 64)", 96 > schwelleAlt);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
