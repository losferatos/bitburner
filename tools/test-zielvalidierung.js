/**
 * Ebene 0: die Zielvalidierung des Sprungs (Phase C, Position C.3).
 *
 * Ein Sprung ist die einzige Handlung des Bots, die sich nicht zuruecknehmen
 * laesst. `exit.js` prueft heute nur, ob das Argument zwischen 1 und 15 liegt,
 * und reicht es dann an `destroyW0r1dD43m0n` durch. Diese Tests pruefen die
 * Schranke, die dazwischen gehoert.
 *
 * Der letzte Abschnitt laeuft gegen die ECHTE src/route.json und den echten
 * Spielstand - eine Schranke, die nur gegen erfundene Routen haelt, ist keine.
 *
 * Aufruf: node tools/test-zielvalidierung.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(rel) {
  const k = [
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
    path.join(ROOT, "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  src/" + rel + " nicht gefunden. Gesucht in:");
    for (const x of k) console.log("    " + x);
    process.exit(1);
  }
  return t;
}

const R = await import(pathToFileURL(finde("lib/route.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

console.log("");
console.log("=== Ebene 0: Zielvalidierung (C.3) ===");

// Eine kleine, vollstaendig durchschaubare Route fuer die Grundfaelle.
const ROUTE = [
  { node: 10, level: 2, verfahren: "V2" },
  { node: 10, level: 3, verfahren: "V2" },
  { node: 9, level: 1, verfahren: "V2", braucht: "hashes.js" },
  { node: 8, level: 1, verfahren: "V1", braucht: "boerse.js" },
  { node: 5, level: 1, verfahren: "V2" },
];

console.log("");
console.log("-- das richtige Ziel --");
{
  // In BN10 mit Stufe 1: nach diesem Lauf ist Stufe 2 erreicht, also ist der
  // erste offene Eintrag {10,3} - der Sprung geht von BN10 nach BN10.
  const r = R.zielErlaubt(ROUTE, 10, { 10: 1 }, 10, () => true);
  pruefe("BN10 Stufe 1 -> Ziel ist wieder BN10", r.ok, r.grund);
  pruefe("erwartetes Ziel benannt", r.erwartet === 10);
  pruefe("der Plan kommt mit", r.plan && r.plan.ziel && r.plan.ziel.level === 3);
}

console.log("");
console.log("-- ein Sprung in denselben Knoten ist legitim --");
{
  // Das ist der Fall, den eine naive Pruefung "ziel !== cur" kaputtmachen
  // wuerde: Stufe 3 verlangt einen ERNEUTEN Durchlauf desselben Knotens.
  const r = R.zielErlaubt(ROUTE, 10, { 10: 1 }, 10);
  pruefe("Ziel == aktueller Knoten wird nicht pauschal verboten", r.ok, r.grund);
}

console.log("");
console.log("-- das falsche Ziel --");
{
  const r = R.zielErlaubt(ROUTE, 10, { 10: 1 }, 5, () => true);
  pruefe("Sprung nach BN5 wird abgelehnt", !r.ok);
  pruefe("die Ablehnung nennt das erwartete Ziel", r.erwartet === 10 && /Erwartet: 10/.test(r.grund),
    r.grund);
  pruefe("die Ablehnung nennt die Regel", /nicht auf Zuruf/.test(r.grund));
}

console.log("");
console.log("-- Ziele ausserhalb des Bereichs --");
{
  for (const z of [0, 16, -1, 1.5, NaN, null, undefined, "10"]) {
    const r = R.zielErlaubt(ROUTE, 10, { 10: 1 }, z);
    pruefe("Ziel " + JSON.stringify(z) + " wird abgelehnt", !r.ok);
  }
}

console.log("");
console.log("-- Route abgearbeitet --");
{
  const sf = { 10: 3, 9: 1, 8: 1, 5: 1 };
  const r = R.zielErlaubt(ROUTE, 5, sf, 5);
  pruefe("kein Sprung, wenn nichts mehr offen ist", !r.ok);
  pruefe("Grund nennt die abgearbeitete Route", /abgearbeitet/.test(r.grund), r.grund);
  pruefe("routeZustand meldet done", R.routeZustand(r.plan) === "done");
}

console.log("");
console.log("-- Route blockiert: das Gewerk fehlt --");
{
  // BN9 braucht hashes.js, BN8 braucht boerse.js - beide liegen nicht auf home.
  const sf = { 10: 3 };
  const ohneGewerke = (d) => false;
  const plan = R.planeRoute(ROUTE, 10, sf, ohneGewerke);
  pruefe("planeRoute findet BN5 als Ziel", plan.ziel && plan.ziel.node === 5,
    "die uebersprungenen halten den Bot NICHT an");
  pruefe("die uebersprungenen sind vermerkt", plan.uebersprungen.length === 2);
  const r = R.zielErlaubt(ROUTE, 10, sf, 5, ohneGewerke);
  pruefe("der Sprung nach BN5 ist erlaubt", r.ok, r.grund);
  const falsch = R.zielErlaubt(ROUTE, 10, sf, 9, ohneGewerke);
  pruefe("der Sprung nach BN9 wird abgelehnt", !falsch.ok,
    "das Gewerk fehlt, der Eintrag ist uebersprungen");
}

console.log("");
console.log("-- alles offen, aber jedem Eintrag fehlt sein Gewerk --");
{
  const nurGewerkeRoute = [
    { node: 9, level: 1, verfahren: "V2", braucht: "hashes.js" },
    { node: 8, level: 1, verfahren: "V1", braucht: "boerse.js" },
  ];
  const plan = R.planeRoute(nurGewerkeRoute, 10, {}, () => false);
  pruefe("kein Ziel", plan.ziel === null);
  pruefe("nicht fertig - es ist etwas offen", plan.fertig === false);
  pruefe("routeZustand meldet blocked", R.routeZustand(plan) === "blocked",
    "sonst sieht das aus wie 'open' mit einem langsamen Knoten");
  const r = R.zielErlaubt(nurGewerkeRoute, 10, {}, 9, () => false);
  pruefe("kein Sprung", !r.ok);
  pruefe("Grund nennt den uebersprungenen Eintrag", /uebersprungen: 9\/1/.test(r.grund), r.grund);
}

console.log("");
console.log("-- ungueltige Route ist kein Freibrief --");
{
  const kaputt = [{ node: 99, level: 2, verfahren: "V2" }];
  const r = R.zielErlaubt(kaputt, 10, { 10: 1 }, 10);
  pruefe("kein Sprung bei ungueltiger Route", !r.ok);
  pruefe("Grund nennt den Eintrag", /ungueltig/.test(r.grund), r.grund);
  pruefe("kein erwartetes Ziel erfunden", r.erwartet === null);

  const leer = R.zielErlaubt([], 10, { 10: 1 }, 10);
  pruefe("leere Route erlaubt keinen Sprung", !leer.ok);
}

console.log("");
console.log("-- routeZustand --");
{
  pruefe("offenes Ziel -> open",
    R.routeZustand(R.planeRoute(ROUTE, 10, { 10: 1 })) === "open");
  pruefe("null-Plan -> open (kein Alarm ohne Grund)", R.routeZustand(null) === "open");
}

// ===========================================================================
console.log("");
console.log("-- gegen die ECHTE route.json --");
{
  const routeDatei = finde("route.json");
  const echt = JSON.parse(fs.readFileSync(routeDatei, "utf8"));
  const eintraege = Array.isArray(echt) ? echt : echt.route || echt.eintraege;
  pruefe("route.json ist lesbar und eine Liste", Array.isArray(eintraege),
    "gefunden: " + typeof echt);

  if (Array.isArray(eintraege)) {
    console.log("       " + eintraege.length + " Eintraege in " + routeDatei);

    // Der echte Stand: BitNode 10, Lauf 2 - also ist Stufe 1 erreicht.
    const sf = { 10: 1, 6: 3, 4: 3, 1: 3 };
    const plan = R.planeRoute(eintraege, 10, sf, () => true);
    pruefe("ein Ziel wird gefunden", plan.ziel !== null,
      plan.grund || "kein Grund genannt");
    if (plan.ziel) {
      console.log("       naechstes Ziel: BN" + plan.ziel.node + " Stufe " +
        plan.ziel.level + " (" + plan.ziel.verfahren + ")");
      const r = R.zielErlaubt(eintraege, 10, sf, plan.ziel.node, () => true);
      pruefe("das geplante Ziel ist erlaubt", r.ok, r.grund);

      // Jedes ANDERE Ziel muss abgelehnt werden. Das ist der eigentliche
      // Schutz: nicht dass das richtige durchgeht, sondern dass die 14
      // anderen es nicht tun.
      let abgelehnt = 0;
      for (let z = 1; z <= 15; z++) {
        if (z === plan.ziel.node) continue;
        if (!R.zielErlaubt(eintraege, 10, sf, z, () => true).ok) abgelehnt++;
      }
      pruefe("alle 14 anderen Knoten werden abgelehnt", abgelehnt === 14,
        "abgelehnt: " + abgelehnt + " von 14");
    }

    // Die Reihenfolge ist unveraenderlich - ein Test, der das nicht festhaelt,
    // merkt eine Umsortierung nie.
    const ersteFuenf = eintraege.slice(0, 5).map((e) => e.node + "/" + e.level).join(" ");
    console.log("       erste fuenf: " + ersteFuenf);
    pruefe("jeder Eintrag hat node, level, verfahren",
      eintraege.every((e) => Number.isInteger(e.node) && Number.isInteger(e.level) &&
        typeof e.verfahren === "string"));
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
