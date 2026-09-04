/**
 * Ebene 0: die Graft-Auswahl (Position C.14).
 *
 * ===========================================================================
 * WORUM ES GEHT
 * ===========================================================================
 *
 * Grafting ist laut Auftrag der groesste Posten nach der Route: Faktor 10 bis
 * 20 auf den Rangweg, wirksam in 30 der 40 Restlaeufe. Heute entscheidet ein
 * Mensch ueber `tools/graftnext.js` - damit ist es das einzige Gewerk, das
 * jemanden braucht, und es steht still, sobald niemand hinsieht.
 *
 * Die Auswahl ist eine reine Funktion und laesst sich vollstaendig ohne Spiel
 * pruefen. Der teure Teil bleibt in `graft.js`.
 *
 * Aufruf: node tools/test-graftwahl.js
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
  if (!t) { console.log("\n  src/" + rel + " nicht gefunden."); process.exit(1); }
  return t;
}

const G = await import(pathToFileURL(finde("lib/graftwahl.js")).href);
const PLAN = JSON.parse(fs.readFileSync(finde("graftplan.json"), "utf8"));

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

const MRD = 1e9;

/** Ein Plan, klein genug, um ihn zu ueberblicken. */
const KLEIN = {
  vorzug: { name: "Violet Congruity Implant", regel: "so frueh wie bezahlbar" },
  reihenfolge: ["A", "B", "C"],
};

const preise = { A: 1 * MRD, B: 2 * MRD, C: 3 * MRD, "Violet Congruity Implant": 150 * MRD };
const dauern = { A: 600000, B: 1200000, C: 1800000, "Violet Congruity Implant": 846000 };

const lage = (o) => ({
  plan: KLEIN, besitzt: [], preise, dauern,
  geld: 1000 * MRD, etaMin: null, etaSicher: false, laeuft: null,
  ...o,
});

console.log("");
console.log("=== Ebene 0: Graft-Auswahl (C.14) ===");

console.log("");
console.log("-- der Vorzug kommt zuerst --");
{
  const r = G.naechstes(lage({}));
  pruefe("Violet Congruity vor der Liste", r.name === "Violet Congruity Implant", r.name);
  pruefe("und der Grund nennt die Regel", /frueh wie bezahlbar/.test(r.grund), r.grund);

  // Der belegte Grund: es loescht die Entropie rueckwirkend, und danach
  // erzeugt kein Graft mehr welche. Wer zuerst graftet, arbeitet den Rest mit
  // vollen Multiplikatoren ab statt mit 0,98^n.
  const danach = G.naechstes(lage({ besitzt: ["Violet Congruity Implant"] }));
  pruefe("danach kommt die Liste", danach.name === "A", danach.name);
}

console.log("");
console.log("-- der Vorzug WARTET, statt uebersprungen zu werden --");
{
  // Der ganze Sinn ist, dass er VOR den anderen kommt. Wer bei Geldmangel zum
  // naechsten weitergeht, hat ihn faktisch ans Ende geschoben - und damit die
  // Entropie fuer alle 38 Stuecke mitgenommen.
  const r = G.naechstes(lage({ geld: 10 * MRD }));
  pruefe("nichts wird gegraftet", r.name === null);
  pruefe("und es gilt als Warten", r.wartet === true);
  pruefe("der Grund nennt Preis und Bestand", /150\.00 Mrd.*10\.00 Mrd/.test(r.grund),
    r.grund);
}

console.log("");
console.log("-- die Liste der Reihe nach --");
{
  const ohneVorzug = { ...KLEIN, vorzug: null };
  const r1 = G.naechstes(lage({ plan: ohneVorzug }));
  pruefe("A ist der erste", r1.name === "A");
  const r2 = G.naechstes(lage({ plan: ohneVorzug, besitzt: ["A"] }));
  pruefe("dann B", r2.name === "B");
  const r3 = G.naechstes(lage({ plan: ohneVorzug, besitzt: ["A", "B", "C"] }));
  pruefe("dann nichts mehr", r3.name === null);
  pruefe("und der Grund sagt es", /alles gegraftet/.test(r3.grund), r3.grund);
}

console.log("");
console.log("-- nicht graftbare Stuecke werden uebersprungen --");
{
  // Ein Stueck ohne Preis ist noch nicht freigeschaltet. Es zu ueberspringen
  // ist richtig - anders als beim Vorzug, wo die Reihenfolge der Zweck ist.
  const ohneVorzug = { ...KLEIN, vorzug: null };
  const r = G.naechstes(lage({ plan: ohneVorzug, preise: { B: 2 * MRD, C: 3 * MRD } }));
  pruefe("A faellt aus, B kommt dran", r.name === "B", r.name);
}

console.log("");
console.log("-- der Puffer: ein Graft raeumt das Konto nicht leer --");
{
  const ohneVorzug = { ...KLEIN, vorzug: null };
  pruefe("bei genau dem Preis wird nicht gegraftet",
    G.naechstes(lage({ plan: ohneVorzug, geld: 1 * MRD })).name === null,
    "sonst blockiert der Graft jeden Augmentierungskauf danach");
  pruefe("beim Doppelten schon",
    G.naechstes(lage({ plan: ohneVorzug, geld: 2 * MRD })).name === "A");
  pruefe("der Faktor ist 2", G.PUFFER_FAKTOR === 2);

  const b = G.bezahlbar(1 * MRD, 1.9 * MRD);
  pruefe("bezahlbar() nennt alle drei Zahlen",
    /1\.00 Mrd.*2\.00 Mrd.*1\.90 Mrd/.test(b.grund), b.grund);
}

console.log("");
console.log("-- nichts beginnen, was der Sprung zerreisst --");
{
  const ohneVorzug = { ...KLEIN, vorzug: null };
  // A braucht 10 Minuten. Der Sprung kommt in 5 - sicher gemessen.
  const r = G.naechstes(lage({ plan: ohneVorzug, etaMin: 5, etaSicher: true }));
  pruefe("kein Graft vor dem Sprung", r.name === null);
  pruefe("und der Grund nennt beide Zeiten", /10 min.*5 min/.test(r.grund), r.grund);

  const reicht = G.naechstes(lage({ plan: ohneVorzug, etaMin: 60, etaSicher: true }));
  pruefe("bei 60 min Restzeit wird gegraftet", reicht.name === "A");
}

console.log("");
console.log("-- eine UNSICHERE Schaetzung blockiert nicht --");
{
  // Auf dem Bladeburner-Weg ist eta_min eine untere Schranke und damit immer
  // zu kurz. Wer darauf reagiert, graftet stundenlang gar nicht mehr - und
  // Grafting ist der groesste Ertragsposten ueberhaupt.
  const ohneVorzug = { ...KLEIN, vorzug: null };
  const r = G.naechstes(lage({ plan: ohneVorzug, etaMin: 1, etaSicher: false }));
  pruefe("bei unsicherer Schaetzung wird gegraftet", r.name === "A", r.grund);
  const ohne = G.naechstes(lage({ plan: ohneVorzug, etaMin: null }));
  pruefe("ohne Schaetzung ebenso", ohne.name === "A");
}

console.log("");
console.log("-- ein laufender Graft wird nicht gestoert --");
{
  const r = G.naechstes(lage({ laeuft: "Bionic Legs" }));
  pruefe("es wird nichts Neues begonnen", r.name === null);
  pruefe("und der Grund nennt das laufende Stueck", /Bionic Legs/.test(r.grund), r.grund);
  pruefe("es gilt NICHT als Warten", r.wartet === false,
    "warten heisst 'koennte nicht', hier heisst es 'tut schon'");
}

console.log("");
console.log("-- gegen den ECHTEN Plan --");
{
  pruefe("graftplan.json ist lesbar", Array.isArray(PLAN.reihenfolge));
  console.log("       " + PLAN.anzahl + " Eintraege, Vorzug: "
    + (PLAN.vorzug ? PLAN.vorzug.name : "keiner"));
  pruefe("er hat 38 Eintraege", PLAN.reihenfolge.length === 38,
    "erhalten " + PLAN.reihenfolge.length);
  pruefe("keiner doppelt",
    new Set(PLAN.reihenfolge).size === PLAN.reihenfolge.length);
  pruefe("der Vorzug steht NICHT in der Liste",
    !PLAN.vorzug || !PLAN.reihenfolge.includes(PLAN.vorzug.name),
    "sonst waere er zweimal dran");
  pruefe("und seine Begruendung nennt die Entropie",
    !!PLAN.vorzug && /[Ee]ntropie/.test(PLAN.vorzug.grund || ""),
    PLAN.vorzug ? PLAN.vorzug.grund : "kein Vorzug");

  // Der erste Griff im echten Betrieb: nichts besessen, viel Geld.
  const echt = G.naechstes({
    plan: PLAN, besitzt: [], geld: 1e12, etaMin: null, etaSicher: false, laeuft: null,
    preise: Object.fromEntries([...PLAN.reihenfolge, PLAN.vorzug.name]
      .map((n) => [n, 1 * MRD])),
    dauern: {},
  });
  pruefe("der erste Griff ist der Vorzug", echt.name === PLAN.vorzug.name, echt.name);

  const ohneVorzug = G.naechstes({
    plan: PLAN, besitzt: [PLAN.vorzug.name], geld: 1e12,
    etaMin: null, etaSicher: false, laeuft: null,
    preise: Object.fromEntries(PLAN.reihenfolge.map((n) => [n, 1 * MRD])),
    dauern: {},
  });
  pruefe("dann der erste Listeneintrag", ohneVorzug.name === PLAN.reihenfolge[0],
    ohneVorzug.name);
}

console.log("");
console.log("-- der Fortschritt --");
{
  const f = G.fortschritt(KLEIN, ["A", "B"]);
  pruefe("zaehlt richtig", f.fertig === 2 && f.offen === 1 && f.gesamt === 3);
  pruefe("und rechnet Prozent", f.prozent === 67, "erhalten " + f.prozent);
  const leer = G.fortschritt(null, []);
  pruefe("ein fehlender Plan ergibt null", leer.gesamt === 0 && leer.prozent === 0);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
