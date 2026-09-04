/**
 * Ebene 0: die drei Kontrakte aus Phase C, Position C.1.
 *
 *   src/lib/herzschlag.js   der Telemetrieblock, den jedes Werkzeug schreibt
 *   src/lib/kpi.js          die Kennzahlen-Feldliste mit Einheit und Uhr
 *   src/lib/events.js       der Ereignisstrom
 *
 * Diese Tests pruefen NICHT, dass die Module etwas tun - sie pruefen die
 * Stellen, an denen ein Kontrakt still versagt: eine Wanderung, die aus der
 * Vorlage auffuellt; eine Sollverletzung mit falscher Richtung; ein Ringpuffer,
 * der die Reihenfolge zerstoert. Alle drei sehen im Betrieb wie Erfolg aus.
 *
 * Aufruf: node tools/test-kontrakte.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(datei) {
  const kandidaten = [
    path.resolve(ROOT, "..", "bitburner-bau", "src", "lib", datei),
    path.join(ROOT, "src", "lib", datei),
  ];
  const t = kandidaten.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  src/lib/" + datei + " nicht gefunden. Gesucht in:");
    for (const k of kandidaten) console.log("    " + k);
    process.exit(1);
  }
  return t;
}

const HS = await import(pathToFileURL(finde("herzschlag.js")).href);
const KPI = await import(pathToFileURL(finde("kpi.js")).href);
const EV = await import(pathToFileURL(finde("events.js")).href);

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
console.log("=== Ebene 0: Kontrakte (C.1) ===");

// ===========================================================================
console.log("");
console.log("-- herzschlag.js: Gueltigkeit --");
{
  const voll = HS.block({
    wall: 1000, playtime: 2000, motorTimeMs: 3000, round: 10, okRound: 10,
    errStreak: 0, lastError: null, host: "home", version: "v1", state: "work",
  });
  pruefe("ein vollstaendiger Block ist gueltig", HS.gueltig(voll));
  pruefe("schema-Feld gesetzt", voll.schema === HS.HERZSCHLAG_VERSION);
  pruefe("ts und wall sind beide gefuellt", voll.ts === 1000 && voll.wall === 1000);

  // DER KERN DER MIGRATION: ein alter Schreiber faellt auf.
  const alt = { ts: 1000, round: 10, host: "home" };
  pruefe("Block ohne errStreak ist UNGUELTIG", !HS.gueltig(alt));
  pruefe("Grund nennt errStreak", /errStreak/.test(HS.ungueltigGrund(alt) || ""));
  const ohneLastError = { ts: 1000, errStreak: 0 };
  pruefe("Block ohne lastError ist UNGUELTIG", !HS.gueltig(ohneLastError));
  pruefe("ein ungueltiger Block ist NIE frisch",
    !HS.frisch(alt, 1000, 600000), "auch bei Alter 0");
}

console.log("");
console.log("-- herzschlag.js: Frische --");
{
  const b = HS.block({ wall: 100000, errStreak: 0 });
  pruefe("frisch bei Alter unter der Grenze", HS.frisch(b, 100000 + 60000, 600000));
  pruefe("nicht frisch bei Alter ueber der Grenze", !HS.frisch(b, 100000 + 700000, 600000));
  // Ein Block aus der Zukunft ist ein Uhrensprung. Ohne diese Pruefung gilt er
  // als besonders frisch - und die Frischepruefung deckt den Sprung zu.
  pruefe("Block aus der Zukunft ist NICHT frisch",
    !HS.frisch(b, 100000 - 120000, 600000));
}

console.log("");
console.log("-- herzschlag.js: state und Fortschritt --");
{
  const w = HS.block({ wall: 1, errStreak: 0, state: "work" });
  const wait = HS.block({ wall: 1, errStreak: 0, state: "wait" });
  const blocked = HS.block({ wall: 1, errStreak: 0, state: "blocked", blockedReason: "no_money" });
  pruefe("work zaehlt fuer den Fortschritt", HS.zaehltFuerFortschritt(w));
  pruefe("wait zaehlt NICHT fuer den Fortschritt", !HS.zaehltFuerFortschritt(wait),
    "ein wartendes Werkzeug wird nicht bestraft, keinen Fortschritt zu haben");
  pruefe("blocked zaehlt NICHT", !HS.zaehltFuerFortschritt(blocked));
  pruefe("blockedReason bleibt erhalten", blocked.blockedReason === "no_money");
  const unsinn = HS.block({ wall: 1, errStreak: 0, state: "fliegt" });
  pruefe("unbekannter state faellt auf work zurueck", unsinn.state === "work");
}

console.log("");
console.log("-- herzschlag.js: arbeitetWirklich (Wirkungspruefung Sprosse 3) --");
{
  const v = HS.block({ wall: 1, round: 100, okRound: 100, errStreak: 0 });
  const n = HS.block({ wall: 2, round: 101, okRound: 101, errStreak: 0 });
  pruefe("okRound waechst, errStreak 0 -> arbeitet", HS.arbeitetWirklich(v, n));

  // DER FALL, DEN round ALLEIN NICHT SIEHT: jede Runde wirft, round waechst
  // trotzdem. Nach S1 (frisch), S3a (frisch) und S3b (Engine tickt) ist dieser
  // Motor in jeder Hinsicht gesund - und tut nichts.
  const wirft = HS.block({ wall: 2, round: 101, okRound: 100, errStreak: 1 });
  pruefe("round waechst, okRound nicht -> arbeitet NICHT",
    !HS.arbeitetWirklich(v, wirft));
  const wirftOhneStreak = HS.block({ wall: 2, round: 101, okRound: 100, errStreak: 0 });
  pruefe("okRound steht still -> arbeitet NICHT, auch ohne errStreak",
    !HS.arbeitetWirklich(v, wirftOhneStreak));
}

console.log("");
console.log("-- herzschlag.js: lastError wird gekuerzt --");
{
  const lang = "x".repeat(500);
  const b = HS.block({ wall: 1, errStreak: 1, lastError: new Error(lang) });
  pruefe("msg auf 200 Zeichen gekuerzt", b.lastError.msg.length === 200,
    "erhalten " + b.lastError.msg.length);
  pruefe("Klasse uebernommen", b.lastError.cls === "Error");
  const ausText = HS.block({ wall: 1, errStreak: 1, lastError: "kaputt" });
  pruefe("Zeichenkette wird zum Fehlerobjekt", ausText.lastError.msg === "kaputt");
}

console.log("");
console.log("-- herzschlag.js: extra ueberschreibt keine Pflichtfelder --");
{
  const b = HS.block({
    wall: 1, errStreak: 0, state: "work",
    extra: { state: "done", errStreak: 99, eigenes: 42 },
  });
  pruefe("extra kann state nicht ueberschreiben", b.state === "work",
    "sonst schreibt ein Gewerk eine Bedeutung, die der Waechter anders liest");
  pruefe("extra kann errStreak nicht ueberschreiben", b.errStreak === 0);
  pruefe("werkzeugeigenes Feld kommt durch", b.eigenes === 42);
}

console.log("");
console.log("-- herzschlag.js: Wanderung setzt NULLWERTE, nicht Vorlagenwerte --");
{
  // Die NEONBREAK-Lehre (lauf.saat -> lauf.seed, 19.08.2026): eine Ergaenzung
  // aus der Vorlage haette einem laufenden Stand mitten im Spiel neue Werte
  // gegeben. Hier bedeutet das: okRound darf NICHT auf round gesetzt werden,
  // auch wenn das "plausibler" aussaehe.
  const alt = { ts: 5, round: 4000, host: "home", wartend: true };
  const neu = HS.wandere(alt);
  pruefe("gewanderter Block ist gueltig", HS.gueltig(neu));
  pruefe("okRound wird 0, NICHT round", neu.okRound === 0,
    "erhalten " + neu.okRound + " - eine Uebernahme von round waere eine Behauptung");
  pruefe("errStreak wird 0", neu.errStreak === 0);
  pruefe("lastError wird null", neu.lastError === null);
  pruefe("round bleibt unangetastet", neu.round === 4000);
  pruefe("wartend:true wird zu state 'wait'", neu.state === "wait",
    "der Sonderfall aus blade.js:609-617 wird zum Feld");
  pruefe("Herkunft vermerkt", neu.gewandertVon === 0);
  const schon = HS.wandere(HS.block({ wall: 1, errStreak: 0 }));
  pruefe("ein aktueller Block wandert nicht erneut", schon.gewandertVon === undefined);
}

// ===========================================================================
console.log("");
console.log("-- kpi.js: Feldliste und Vollstaendigkeit --");
{
  pruefe("jedes Feld nennt eine Uhr",
    Object.values(KPI.FELDER).every((d) => typeof d.uhr === "string" && d.uhr.length > 0));
  pruefe("jedes Feld nennt eine Einheit",
    Object.values(KPI.FELDER).every((d) => typeof d.einheit === "string"));
  pruefe("jedes Feld nennt eine Klasse",
    Object.values(KPI.FELDER).every((d) => ["lauf", "autonomie", "effizienz"].includes(d.klasse)));

  // Die zwei Felder, die AUSDRUECKLICH nicht in Motorzeit laufen. Ein Nenner,
  // der gedrosselt nicht messbar ist, fuehrt zum Verwerfen des Fensters.
  pruefe("T2_h laeuft in Bonuszeit, nicht Motorzeit", KPI.FELDER.T2_h.uhr === "bonus");
  pruefe("vorrat_deckung laeuft in Bonuszeit", KPI.FELDER.vorrat_deckung.uhr === "bonus");
  pruefe("t_workbench laeuft in Motorzeit", KPI.FELDER.t_workbench.uhr === "motor");
  pruefe("jump_latency_min laeuft in Wanduhr", KPI.FELDER.jump_latency_min.uhr === "wand");
  pruefe("traeger wird vom Kern gerechnet", /KERN/.test(KPI.FELDER.traeger.hinweis || ""));
}

console.log("");
console.log("-- kpi.js: leer() unterscheidet 0 von null --");
{
  const k = KPI.leer(1000);
  pruefe("Fehlerzaehler beginnen bei 0", k.manual_actions === 0 && k.false_kill_count === 0,
    "0 heisst: gemessen, war null");
  pruefe("nie gemessene Werte sind null", k.t_workbench === null && k.T2_h === null,
    "null heisst: nie gemessen - eine 0 waere ein Bestwert, den niemand erreicht hat");
  pruefe("Version gesetzt", k.version === KPI.KPI_VERSION);
}

console.log("");
console.log("-- kpi.js: pruefe() findet Unbekanntes und Fehlendes --");
{
  const k = KPI.leer(1);
  k.node = 10; k.level = 2; k.nodeReset = 5; k.augReset = 5;
  const r1 = KPI.pruefe(k);
  pruefe("ein vollstaendiger Satz ist ok", r1.ok, JSON.stringify(r1));

  k.erfundenesFeld = 7;
  const r2 = KPI.pruefe(k);
  pruefe("unbekanntes Feld wird gemeldet", r2.unbekannt.includes("erfundenesFeld"),
    "sonst schreibt Gewerk 3 andere Namen als Gewerk 7");
  delete k.erfundenesFeld;

  k.node = null;
  const r3 = KPI.pruefe(k);
  pruefe("fehlendes Pflichtfeld wird gemeldet", r3.fehlend.includes("node"));
  k.node = 10;

  k.t_workbench = "viel";
  const r4 = KPI.pruefe(k);
  pruefe("falsche Art wird gemeldet", r4.falscheArt.some((s) => s.startsWith("t_workbench")));
}

console.log("");
console.log("-- kpi.js: Regel 4 - eine NEUERE Datei wird nicht geschrieben --");
{
  const zukunft = JSON.stringify({ version: KPI.KPI_VERSION + 1, node: 10 });
  const r = KPI.laden(zukunft);
  pruefe("Schreibsperre gesetzt", r.schreibsperre === true,
    "der Rollback-Fall: eine neuere Fassung hat Felder, die dieser Code loeschen wuerde");
  pruefe("Befund nennt beide Versionen", /Version/.test(r.befund || ""));
  pruefe("die Datei bleibt unveraendert", r.kpi.node === 10);
}

console.log("");
console.log("-- kpi.js: Wanderung v1 -> v2 --");
{
  const alt = JSON.stringify({ version: 1, node: 10, level: 2, nodeReset: 100, augReset: 50 });
  const r = KPI.laden(alt);
  pruefe("gewandert ohne Schreibsperre", !r.schreibsperre && /gewandert/.test(r.befund || ""));
  pruefe("Version angehoben", r.kpi.version === KPI.KPI_VERSION);
  pruefe("Fehlerzaehler auf 0", r.kpi.false_penalty_count === 0);
  pruefe("nie gemessene Werte auf null", r.kpi.T2_h === null,
    "erhalten " + JSON.stringify(r.kpi.T2_h) + " - eine Vorlagenzahl waere erfunden");
  pruefe("Bestandsfelder unangetastet", r.kpi.node === 10 && r.kpi.level === 2);
  pruefe("Herkunft vermerkt", r.kpi.gewandertVon === 1);
}

console.log("");
console.log("-- kpi.js: Regel 3 - neuer Lauf setzt laufbezogene Felder zurueck --");
{
  const k = KPI.leer(1);
  k.node = 10; k.level = 2; k.nodeReset = 1000; k.augReset = 900;
  k.manual_actions = 5; k.t_workbench = 3.4; k.motorTimeSinceNodeMs = 99999;
  const r = KPI.laden(JSON.stringify(k), 2000);
  pruefe("neuer Lauf erkannt", /neuer Lauf/.test(r.befund || ""));
  pruefe("nodeReset uebernommen", r.kpi.nodeReset === 2000);
  pruefe("Motorzeit des Laufs auf 0", r.kpi.motorTimeSinceNodeMs === 0);
  pruefe("Autonomiezaehler auf 0", r.kpi.manual_actions === 0);
  pruefe("Effizienzwerte auf null", r.kpi.t_workbench === null,
    "Werte des alten Laufs sind fuer den neuen bedeutungslos");
  const gleich = KPI.laden(JSON.stringify(k), 1000);
  pruefe("gleicher Lauf bleibt unberuehrt", gleich.kpi.manual_actions === 5);
}

console.log("");
console.log("-- kpi.js: verletzt() kennt die Richtung --");
{
  // Ohne Richtung meldet der Bericht jeden guten Wert als Abweichung.
  pruefe("backup_age_h 2 verletzt Soll 1", KPI.verletzt("backup_age_h", 2));
  pruefe("backup_age_h 0,5 verletzt nicht", !KPI.verletzt("backup_age_h", 0.5));
  pruefe("graft_busy_pct 90 verletzt Soll 100", KPI.verletzt("graft_busy_pct", 90),
    "hier ist WENIGER schlecht");
  pruefe("graft_busy_pct 100 verletzt nicht", !KPI.verletzt("graft_busy_pct", 100));
  pruefe("next_blackop_chance 0,2 verletzt Soll 0,35", KPI.verletzt("next_blackop_chance", 0.2));
  pruefe("null verletzt nie", !KPI.verletzt("t_workbench", null));
  pruefe("Feld ohne Soll verletzt nie", !KPI.verletzt("bridge_restarts", 999));
}

console.log("");
console.log("-- kpi.js: unlesbare Datei --");
{
  const r = KPI.laden("{kaputt");
  pruefe("unlesbar ergibt einen frischen Satz", r.kpi.version === KPI.KPI_VERSION);
  pruefe("ohne Schreibsperre", !r.schreibsperre);
  pruefe("mit Befund", /unlesbar/.test(r.befund || ""));
}

// ===========================================================================
console.log("");
console.log("-- events.js: anhaengen und Uhren --");
{
  const s = EV.leer();
  EV.anhaengen(s, "boot", "Kern gestartet", { wall: 100, playtime: 200, motorTimeMs: 300 });
  pruefe("Eintrag angelegt", s.eintraege.length === 1);
  const e = s.eintraege[0];
  pruefe("alle drei Uhren geschrieben",
    e.wall === 100 && e.playtime === 200 && e.motorTimeMs === 300,
    "welche spaeter die richtige ist, weiss beim Schreiben niemand");
  const u = EV.anhaengen(s, "gibtsnicht", "test", { wall: 1 });
  pruefe("unbekannte Art wird zu note", u.art === "note");
  pruefe("unbekannte Art wird vermerkt", u.unbekannteArt === "gibtsnicht",
    "das Ereignis ist geschehen, auch wenn der Schreiber sich vertippt hat");
}

console.log("");
console.log("-- events.js: Ringpuffer --");
{
  const s = EV.leer();
  for (let i = 0; i < EV.DECKEL + 150; i++) {
    EV.anhaengen(s, "note", "Nr " + i, { wall: i });
  }
  pruefe("Deckel wird eingehalten", s.eintraege.length <= EV.DECKEL,
    "erhalten " + s.eintraege.length);
  pruefe("die JUENGSTEN bleiben",
    s.eintraege[s.eintraege.length - 1].text === "Nr " + (EV.DECKEL + 149));
  // Ein Beschnitt, der die Reihenfolge zerstoert, macht jede Abstandsrechnung
  // falsch - und faellt sonst nirgends auf.
  let sortiert = true;
  for (let i = 1; i < s.eintraege.length; i++) {
    if (s.eintraege[i].wall < s.eintraege[i - 1].wall) sortiert = false;
  }
  pruefe("Reihenfolge bleibt chronologisch", sortiert);
}

console.log("");
console.log("-- events.js: bleibende Eintraege ueberleben --");
{
  const s = EV.leer();
  EV.anhaengen(s, "jump", "BN6 -> BN10", { wall: 0 });
  EV.anhaengen(s, "install", "5 Augs", { wall: 1 });
  for (let i = 0; i < EV.DECKEL + 200; i++) {
    EV.anhaengen(s, "note", "Fuellung " + i, { wall: 10 + i });
  }
  const jump = EV.letztes(s, "jump");
  pruefe("der Knotenwechsel ist noch da", jump !== null && jump.text === "BN6 -> BN10",
    "ein Sprung ist auch nach tausend Runden die wichtigste Zeile");
  pruefe("der Einbau ist noch da", EV.letztes(s, "install") !== null);
  pruefe("Fuellung wurde beschnitten", s.eintraege.length <= EV.DECKEL + EV.DECKEL_BLEIBT);

  // Auch das Unverzichtbare braucht eine Grenze.
  const s2 = EV.leer();
  for (let i = 0; i < EV.DECKEL_BLEIBT + 40; i++) EV.anhaengen(s2, "jump", "J" + i, { wall: i });
  pruefe("auch bleibende Eintraege haben einen Deckel",
    s2.eintraege.length <= EV.DECKEL_BLEIBT, "erhalten " + s2.eintraege.length);
}

console.log("");
console.log("-- events.js: abstandMin --");
{
  const s = EV.leer();
  EV.anhaengen(s, "note", "Sprung erkannt", { wall: 0 });
  EV.anhaengen(s, "jump", "vollzogen", { wall: 90000 });
  const d = EV.abstandMin(s, "note", "jump");
  pruefe("Abstand in Minuten", Math.abs(d - 1.5) < 0.001, "erhalten " + d);

  // NIE EINE GERATENE ZAHL. Ein fehlendes Ereignis ergibt null, damit der
  // Bericht "nicht messbar" sagen kann statt "0 Minuten".
  pruefe("fehlendes Zielereignis ergibt null", EV.abstandMin(s, "note", "install") === null);
  pruefe("fehlendes Startereignis ergibt null", EV.abstandMin(s, "penalty", "jump") === null);

  const s2 = EV.leer();
  EV.anhaengen(s2, "jump", "frueher", { wall: 100 });
  EV.anhaengen(s2, "note", "spaeter", { wall: 200 });
  pruefe("falsche Reihenfolge ergibt null", EV.abstandMin(s2, "note", "jump") === null,
    "ein Vermerk NACH dem Sprung erklaert den Sprung nicht");
}

console.log("");
console.log("-- events.js: laden --");
{
  const s = EV.leer();
  EV.anhaengen(s, "jump", "x", { wall: 1 });
  const wieder = EV.laden(JSON.stringify(s));
  pruefe("Strom ueberlebt das Speichern", wieder.eintraege.length === 1);
  pruefe("unlesbar ergibt einen leeren Strom", EV.laden("{kaputt").eintraege.length === 0);
  pruefe("fehlendes Feld ergibt einen leeren Strom",
    EV.laden(JSON.stringify({ version: 1 })).eintraege.length === 0);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
