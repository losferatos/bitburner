/**
 * Ebene 0: die Strafleiter mit simulierten Uhren (Position C.6).
 *
 * ===========================================================================
 * DER SATZ, AN DEM SICH ALLES AUSRICHTET
 * ===========================================================================
 *
 * "Der Waechter irrt in Richtung Untaetigkeit" (ARCHITEKTUR 5.4). Eine
 * Fehlstrafe kostet mehr als ein verpasster Haenger: der Haenger wird beim
 * naechsten Durchgang erkannt, die Fehlstrafe toetet ein gesundes Werkzeug und
 * erzeugt genau den Zustand, den sie heilen sollte.
 *
 * Diese Tests pruefen deshalb vor allem, wann der Waechter NICHT zuschlaegt.
 *
 * ===========================================================================
 * DIE UHRENFRAGE
 * ===========================================================================
 *
 * Die Motorzeit des Kerns darf keine einzige Waechterfrist tragen. Haengt der
 * Kern, steht sie - und jede in ihr gemessene Frist liefe genau in dem Fall
 * nie ab, fuer den sie gebaut wurde. Der Lint dafuer laeuft hier.
 *
 * Aufruf: node tools/test-leiter.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(rel) {
  const k = [
    path.join(ROOT, "src", rel),
    path.resolve(ROOT, "..", "bitburner-bau", "src", rel),
  ];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) { console.log("\n  src/" + rel + " nicht gefunden."); process.exit(1); }
  return t;
}

const U = await import(pathToFileURL(finde("lib/uhren.js")).href);
const L = await import(pathToFileURL(finde("lib/leiter.js")).href);

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

const W0 = 1_700_000_000_000;

console.log("");
console.log("=== Ebene 0: Strafleiter mit simulierten Uhren (C.6) ===");

// ===========================================================================
console.log("");
console.log("-- DER LINT: keine Waechterfrist laeuft in Motorzeit --");
{
  const schlecht = U.pruefeFristen(U.FRISTEN);
  pruefe("die Fristentabelle ist sauber", schlecht.length === 0, schlecht.join(" | "));

  // Gegenprobe: der Lint muss den Fehler auch finden.
  const boese = U.pruefeFristen([{ name: "test", uhr: "motor", sprosse: 2 }]);
  pruefe("eine Motorzeit-Frist in Sprosse 2 wird beanstandet", boese.length === 1,
    JSON.stringify(boese));
  pruefe("und der Grund erklaert warum", /liefe nie ab/.test(boese[0] || ""));
  pruefe("in Sprosse 5 ist Motorzeit erlaubt",
    U.pruefeFristen([{ name: "t", uhr: "motor", sprosse: 5 }]).length === 0,
    "dort misst die Frist Spielfortschritt, und der Kern laeuft");
  pruefe("eine unbekannte Uhr wird beanstandet",
    U.pruefeFristen([{ name: "t", uhr: "sonnenuhr", sprosse: 1 }]).length === 1);

  // Jede Sprosse 0-3 muss eine Frist haben, sonst prueft der Lint nichts.
  for (const n of [0, 1, 2, 3]) {
    pruefe("Sprosse " + n + " hat Fristen in der Tabelle",
      U.FRISTEN.some((f) => f.sprosse === n));
  }
}

console.log("");
console.log("-- die Waechteruhr: der Deckel ist 12 x Takt --");
{
  pruefe("120 Sekunden, nicht 20", U.GUARD_DECKEL_MS === 120000,
    "erhalten " + U.GUARD_DECKEL_MS);

  // Der belegte Fall: ein verdeckter Tab liefert eine Weckung je Minute. Bei
  // 20 s Deckel ueberschritte JEDE Nachtrunde ihn - die Leiter waere nachts
  // nie scharf, und Stufe B verlangt eine Nacht mit verdecktem Tab.
  const u = U.neu();
  let w = W0;
  let p = 100 * 3600000;
  for (let i = 0; i < 480; i++) { w += 60000; p += 60000; U.runde(u, w, p); }
  pruefe("acht gedrosselte Stunden zaehlen voll",
    Math.abs(u.guardTimeMs / 3600000 - 8) < 0.02,
    "erhalten " + (u.guardTimeMs / 3600000).toFixed(2) + " h");
  pruefe("keine Runde verworfen", u.verworfen === 0);
}

console.log("");
console.log("-- die Waechteruhr steht bei Stillstand --");
{
  const u = U.neu();
  let w = W0;
  let p = 100 * 3600000;
  for (let i = 0; i < 6; i++) { w += 10000; p += 10000; U.runde(u, w, p); }
  const vorher = u.guardTimeMs;
  w += 8 * 3600000; p += 8 * 3600000;
  const r = U.runde(u, w, p);
  pruefe("die Offline-Runde zaehlt nicht", !r.gezaehlt);
  pruefe("die Uhr steht", u.guardTimeMs === vorher);
  pruefe("und meldet einen Sprung", r.sprung === true);
  pruefe("danach gilt Karenz", U.inKarenz(u, w));
  pruefe("nach elf Minuten nicht mehr", !U.inKarenz(u, w + 11 * 60000));
}

console.log("");
console.log("-- der Engine-Puls --");
{
  const u = U.neu();
  let w = W0;
  let p = 100 * 3600000;
  // Normal: beide Uhren laufen gleich.
  for (let i = 0; i < 30; i++) { w += 10000; p += 10000; U.runde(u, w, p); }
  const gut = U.enginePuls(u);
  pruefe("bei gesunder Engine ist der Puls 1", gut && Math.abs(gut.puls - 1) < 0.01,
    gut ? "erhalten " + gut.puls.toFixed(2) : "null");

  // Die Engine steht: die Wanduhr laeuft, totalPlaytime nicht.
  const u2 = U.neu();
  let w2 = W0;
  const p2 = 100 * 3600000;
  for (let i = 0; i < 30; i++) { w2 += 10000; U.runde(u2, w2, p2); }
  const tot = U.enginePuls(u2);
  pruefe("bei stehender Engine ist der Puls 0", tot && tot.puls === 0);
  pruefe("das loest S3b aus", tot.puls < 0.2);

  // NIE EINE GERATENE ZAHL: ein zu kurzes Fenster ergibt null.
  const u3 = U.neu();
  let w3 = W0;
  let p3 = 100 * 3600000;
  for (let i = 0; i < 3; i++) { w3 += 10000; p3 += 10000; U.runde(u3, w3, p3); }
  pruefe("ein zu kurzes Fenster ergibt null", U.enginePuls(u3) === null,
    "sonst meldete der Waechter nach 30 Sekunden eine tote Engine");
}

// ===========================================================================
console.log("");
console.log("-- S1: ein Werkzeug meldet sich nicht --");
{
  const e = {
    motorTimeMs: 3600000, guardTimeMs: 3600000, wall: W0,
    kern: { wall: W0, errStreak: 0 }, puls: 1, sichtbar: true,
    eintraege: [
      { name: "blade.js", freshnessMs: 600000,
        telemetrie: { motorTimeMs: 3600000 - 300000, state: "work" } },
      { name: "sleeve.js", freshnessMs: 600000,
        telemetrie: { motorTimeMs: 3600000 - 900000, state: "work" } },
    ],
  };
  const s = L.signale(e);
  pruefe("das frische Werkzeug loest nichts aus",
    !s.some((x) => x.ziel === "blade.js"));
  pruefe("das veraltete loest S1 aus",
    s.some((x) => x.sig === "S1" && x.ziel === "sleeve.js"), JSON.stringify(s));
}

console.log("");
console.log("-- state 'wait' loest KEIN S1 aus --");
{
  // Ein wartendes Werkzeug kann keinen Fortschritt belegen und wird auch nicht
  // dafuer bestraft, keinen zu haben.
  const e = {
    motorTimeMs: 3600000, guardTimeMs: 3600000, wall: W0,
    kern: { wall: W0, errStreak: 0 }, puls: 1, sichtbar: true,
    eintraege: [{ name: "bbtrain.js", freshnessMs: 600000,
      telemetrie: { motorTimeMs: 0, state: "wait" } }],
  };
  pruefe("kein Signal fuer ein wartendes Werkzeug",
    L.signale(e).filter((x) => x.sig === "S1").length === 0);
}

console.log("");
console.log("-- S3a und S6: der Kern --");
{
  const alt = {
    motorTimeMs: 3600000, guardTimeMs: 3600000, wall: W0 + 20 * 60000,
    kern: { wall: W0, errStreak: 0 }, puls: 1, sichtbar: true, eintraege: [],
  };
  pruefe("ein 20 min alter Herzschlag loest S3a aus",
    L.signale(alt).some((x) => x.sig === "S3a"));

  const wirft = {
    motorTimeMs: 3600000, guardTimeMs: 3600000, wall: W0,
    kern: { wall: W0, errStreak: 7 }, puls: 1, sichtbar: true, eintraege: [],
  };
  const s = L.signale(wirft);
  pruefe("sieben Ausnahmen in Folge loesen S6 aus", s.some((x) => x.sig === "S6"));
  pruefe("bei vier noch nicht", !L.signale({ ...wirft, kern: { wall: W0, errStreak: 4 } })
    .some((x) => x.sig === "S6"));
}

console.log("");
console.log("-- S2 ist stumm, wenn die Route fertig ist --");
{
  const basis = {
    motorTimeMs: 3600000 * 2, guardTimeMs: 3600000, wall: W0,
    kern: { wall: W0, errStreak: 0 }, puls: 1, sichtbar: true, eintraege: [],
    letzterTraegerWert: 1000, letzterTraegerMotorMs: 0,
    kpi: { traeger: { name: "rang", wert: 1000 }, route_state: "open",
      bestwertStatus: "geeicht" },
  };
  pruefe("kein Fortschritt ueber 2 h loest S2 aus",
    L.signale(basis).some((x) => x.sig === "S2"), JSON.stringify(L.signale(basis)));

  const fertig = { ...basis, kpi: { ...basis.kpi, route_state: "done" } };
  pruefe("bei fertiger Route bleibt S2 stumm",
    !L.signale(fertig).some((x) => x.sig === "S2"),
    "ein fertiger Bot ist kein Haenger");

  const ungeeicht = { ...basis, kpi: { ...basis.kpi, bestwertStatus: "ungeeicht" } };
  pruefe("bei ungeeichtem Bestwert bleibt S2 stumm",
    !L.signale(ungeeicht).some((x) => x.sig === "S2"));

  const waechst = { ...basis, letzterTraegerWert: 900 };
  pruefe("bei wachsendem Traeger kein S2",
    !L.signale(waechst).some((x) => x.sig === "S2"));

  // DER FEHLVERSUCH (06.09.2026): Der Kern gibt als Traeger den
  // Hoechststand des Laufs weiter, nicht den Augenblickswert. Ein Rang, der
  // durch eine misslungene Black Op um 15.000 faellt, senkt den Traeger
  // also NICHT - und darf kein S2 ausloesen, solange das Hoch juenger als
  // 45 min ist. Der Test bildet den Kontrakt ab: der Traegerwert steigt
  // (1000 -> 1050), obwohl der Augenblicksrang unter dem alten Hoch liegt.
  const fehlversuch = { ...basis, letzterTraegerWert: 1000,
    kpi: { ...basis.kpi, traeger: { name: "rang", wert: 1050 } } };
  pruefe("ein Hoch ueber dem letzten Vergleichspunkt ist Wachstum, kein S2",
    !L.signale(fehlversuch).some((x) => x.sig === "S2"));
  const steht = { ...basis, letzterTraegerWert: 1050,
    kpi: { ...basis.kpi, traeger: { name: "rang", wert: 1050 } } };
  pruefe("ein Hoch, das 2 h nicht steigt, ist Stillstand - S2",
    L.signale(steht).some((x) => x.sig === "S2"),
    "Fehlversuche duerfen echten Stillstand nicht verdecken");
}

// ===========================================================================
console.log("");
console.log("-- der Zustandsautomat: Karenz vor der Strafe --");
{
  const z = L.neu(1000);
  const sig = { sig: "S1", ziel: "sleeve.js", grund: "veraltet", schwere: 1 };

  const a = L.schritt(z, sig, 0, W0);
  pruefe("erst Verdacht, keine Strafe", a.handlung === "verdacht", a.handlung);
  pruefe("Zustand SUSPECT", z.ziele["sleeve.js"].zustand === "SUSPECT");

  const b = L.schritt(z, sig, 30000, W0 + 30000);
  pruefe("waehrend der Karenz wird gewartet", b.handlung === "wartet", b.grund);

  const c = L.schritt(z, sig, 200000, W0 + 200000);
  pruefe("nach der Karenz wird ausgefuehrt", c.handlung === "ausfuehren", c.handlung);
  pruefe("Zustand EXECUTED", z.ziele["sleeve.js"].zustand === "EXECUTED");

  const d = L.schritt(z, sig, 200000 + 60000, W0);
  pruefe("danach wird auf die Wirkung gewartet", d.handlung === "wartet");

  const e = L.schritt(z, sig, 200000 + 200000, W0);
  pruefe("dann geprueft", e.handlung === "pruefen", e.handlung);
}

console.log("");
console.log("-- Entwarnung: ein Verdacht ohne Signal faellt zurueck auf HEALTHY --");
{
  // 06.09.2026: S2 setzte "fortschritt" auf SUSPECT(5); ab 11:45 wuchs der
  // Rang wieder, das Signal blieb aus - und das Ziel stand sechs Stunden auf
  // SUSPECT, weil es keinen Weg zurueck gab ausser der Karenz der teuersten
  // Sprosse.
  const z = L.neu(1000);
  const sig = { sig: "S2", ziel: "fortschritt", grund: "steht", schwere: 2 };
  L.schritt(z, sig, 0, W0, { guard: 0, engine: 0, motor: 0 });
  pruefe("Verdacht steht", z.ziele["fortschritt"].zustand === "SUSPECT");
  const raus = L.entwarnung(z, new Set(), 60000);
  pruefe("ohne Signal wird entwarnt", raus.length === 1 && raus[0] === "fortschritt");
  pruefe("Zustand HEALTHY, Sprosse 0", z.ziele["fortschritt"].zustand === "HEALTHY"
    && z.ziele["fortschritt"].sprosse === 0);

  // Liegt das Signal weiter an, bleibt der Verdacht.
  L.schritt(z, sig, 120000, W0, { guard: 120000, engine: 0, motor: 0 });
  const bleibt = L.entwarnung(z, new Set(["fortschritt"]), 130000);
  pruefe("mit Signal bleibt SUSPECT", bleibt.length === 0
    && z.ziele["fortschritt"].zustand === "SUSPECT");

  // EXECUTED wird nicht entwarnt - die Wirkungspruefung laeuft zu Ende.
  z.ziele["x"] = { zustand: "EXECUTED", sprosse: 1, seit: 0, versuche: 1 };
  const nichtX = L.entwarnung(z, new Set(), 200000);
  pruefe("EXECUTED bleibt stehen", !nichtX.includes("x")
    && z.ziele["x"].zustand === "EXECUTED");
}

console.log("");
console.log("-- Wirkung gruen: der Zaehler des ZIELS faellt auf null --");
{
  const z = L.neu(1000);
  const sig = { sig: "S1", ziel: "a.js", grund: "x", schwere: 1 };
  L.schritt(z, sig, 0, W0);
  L.schritt(z, sig, 200000, W0);
  const r = L.verifiziert(z, "a.js", true, 300000);
  pruefe("zurueck auf HEALTHY", r.zustand === "HEALTHY");
  pruefe("Sprosse zurueckgesetzt", z.ziele["a.js"].sprosse === 0);
  pruefe("Versuche zurueckgesetzt", z.ziele["a.js"].versuche === 0);

  // Ein geheiltes Werkzeug erbt nicht die Vorgeschichte eines anderen.
  const sigB = { sig: "S1", ziel: "b.js", grund: "y", schwere: 1 };
  L.schritt(z, sigB, 400000, W0);
  pruefe("das andere Ziel hat seinen eigenen Zustand",
    z.ziele["b.js"].zustand === "SUSPECT" && z.ziele["a.js"].zustand === "HEALTHY");
}

console.log("");
console.log("-- Wirkung rot: Eskalation zur naechsten GEBAUTEN Sprosse --");
{
  const z = L.neu(1000);
  const sig = { sig: "S1", ziel: "a.js", grund: "x", schwere: 1 };
  L.schritt(z, sig, 0, W0);
  L.schritt(z, sig, 200000, W0);
  const r = L.verifiziert(z, "a.js", false, 300000);
  pruefe("eskaliert", r.eskaliert === true);
  pruefe("auf Sprosse 2", r.sprosse === 2, "erhalten " + r.sprosse);

  // Weiter bis zum Ende. Das Signal ist S1 - ein Werkzeug, dessen Telemetrie
  // steht. Sprosse 4a ist nicht gebaut, Sprosse 5 hat `ausloeser: ["S2"]`.
  //
  // NACH SPROSSE 3 IST DAMIT SCHLUSS, und das ist der Punkt (Skeptiker Runde
  // 4, R3). Bis zum 04.09.2026 nahm `verifiziert` die naechste GEBAUTE
  // Sprosse ohne Ruecksicht auf ihren Ausloeser - seit Sprosse 5 gebaut ist,
  // haette ein stummes `hashes.js` nach 35 Minuten einen
  // Augmentierungs-Einbau ausgeloest. Ein Einbau macht Platzmangel schlimmer,
  // nicht besser.
  L.verifiziert(z, "a.js", false, 400000);   // -> 3
  const ende = L.verifiziert(z, "a.js", false, 500000);
  pruefe("nach Sprosse 3 kommt fuer S1 KEINE weitere", ende.zustand === "EXHAUSTED",
    "erhalten " + ende.zustand + " auf Sprosse " + ende.sprosse
    + " - Sprosse 5 ist nur ueber S2 erreichbar");
  pruefe("und es wird vermerkt", z.exhausted !== null);
  const nach = L.schritt(z, sig, 600000, W0);
  pruefe("danach passiert nichts mehr", nach.handlung === "nichts", nach.handlung);
  pruefe("aber der Grund ist lesbar", /erschoepft/.test(nach.grund));
}

console.log("");
console.log("-- Sprosse 4a ist NICHT gebaut, Sprosse 5 schon --");
{
  const s4 = L.SPROSSEN.find((s) => s.nr === 4);
  const s5 = L.SPROSSEN.find((s) => s.nr === 5);
  pruefe("4a steht als nicht gebaut in der Tabelle", s4 && s4.gebaut === false,
    "sie wird nur nach Pruefstandsbeleg gebaut - das ist kein Verhandlungspunkt");
  pruefe("und nennt ihre Bedingung", /beforeunload/.test(s4.bedingung || ""));
  // Seit dem 04.09.2026: punish.js ist gebaut und mit 35 Proben belegt.
  // Vorher endete die Leiter faktisch bei 3, und der Zustand, fuer den sie
  // gedacht ist (der Traeger waechst seit sechs Stunden Motorzeit nicht),
  // hatte keine Antwort.
  pruefe("5 steht als GEBAUT", s5 && s5.gebaut === true,
    "src/punish.js, tools/test-punish.js");
  pruefe("5 laeuft in MOTORZEIT", s5.uhr === "motor",
    "S2 misst Spielfortschritt - Auftrag 5.3 woertlich");
  pruefe("sprosseFuer liefert keine ungebaute Sprosse",
    L.sprosseFuer("S3b") === null, "S3b fuehrt zu 4a, und die gibt es noch nicht");
  // S2 steigt bei der BILLIGEN Sprosse ein, nicht beim Soft-Reset
  // (Skeptiker Runde 4, R10). Zwischen "der Traeger steht seit sechs Stunden"
  // und "alles wegwerfen" lag vorher keine Stufe.
  pruefe("aber S2 findet jetzt seine Sprosse",
    L.sprosseFuer("S2") !== null && L.sprosseFuer("S2").nr === 4.5,
    "S2 war das einzige Signal ohne gebaute Sprosse - und die erste Antwort"
    + " darauf ist das Traegergewerk, nicht der Einbau");
  const s45 = L.SPROSSEN.find((x) => x.nr === 4.5);
  pruefe("und sie ist billig: 45 min Karenz statt sechs Stunden",
    s45 && s45.karenzMs === 45 * 60000, String(s45 && s45.karenzMs));
  pruefe("mit Deckel, damit daraus keine Dauerstrafe wird",
    s45 && s45.deckelJe6h === 3, String(s45 && s45.deckelJe6h));
}

console.log("");
console.log("-- die Eskalation folgt dem AUSLOESER, nicht der Nummer (R3) --");
{
  // Derselbe Weg wie oben, aber mit S2 - dem Signal, fuer das Sprosse 5
  // gebaut ist. Hier MUSS sie erreicht werden, sonst haette der Bot auf einen
  // stehenden Traeger keine Antwort.
  const z = L.neu(1000);
  const sig = { sig: "S2", ziel: "fortschritt", schwere: 2,
    alterMotorMs: 7 * 3600000, grund: "Traeger steht" };
  const uhren = (m) => ({ guard: m, engine: m, motor: m });

  // S2 steigt bei der billigen Sprosse 4b ein, nicht bei 1 und nicht bei 5.
  const ein = L.sprosseFuer("S2");
  pruefe("S2 steigt bei Sprosse 4b ein", ein && ein.nr === 4.5,
    "erhalten " + (ein && ein.nr));

  L.schritt(z, sig, 0, W0, uhren(0));                       // -> SUSPECT
  const zuFrueh = L.schritt(z, sig, 600000, W0, uhren(600000));
  pruefe("zehn Minuten Motorzeit reichen nicht", zuFrueh.handlung === "wartet",
    zuFrueh.handlung + " - die Karenz von 4b betraegt 45 min MOTORZEIT");

  // DIE UHR IST DER PUNKT (R15). Waechterzeit bei stehender Motorzeit darf
  // NICHT reichen: eine Offline-Nacht ist kein Stillstand.
  const nurWanduhr = L.schritt(z, sig, 3 * 3600000, W0 + 3 * 3600000,
    { guard: 3 * 3600000, engine: 0, motor: 0 });
  pruefe("Waechterzeit bei stehender Motorzeit reicht NICHT",
    nurWanduhr.handlung === "wartet",
    nurWanduhr.handlung + " - sonst loeste eine Offline-Nacht die Leiter aus");

  const jetzt = L.schritt(z, sig, 3 * 3600000, W0, uhren(3 * 3600000));
  pruefe("eine Stunde Motorzeit loest 4b aus", jetzt.handlung === "ausfuehren",
    jetzt.handlung + ": " + jetzt.grund);
  pruefe("und zwar Sprosse 4b, nicht der Soft-Reset",
    jetzt.sprosse && jetzt.sprosse.nr === 4.5,
    "erhalten " + (jetzt.sprosse && jetzt.sprosse.nr));

  // Und ERST wenn 4b nichts gebracht hat, kommt der Einbau. Das ist der Punkt
  // der ganzen Aenderung: der Soft-Reset ist das letzte Mittel, nicht das
  // erste.
  const danach = L.verifiziert(z, "fortschritt", false, 4 * 3600000);
  pruefe("erst nach einer wirkungslosen 4b kommt Sprosse 5",
    danach.sprosse === 5, "erhalten " + danach.sprosse);
}

console.log("");
console.log("-- der Deckel verhindert Dauerstrafen --");
{
  const z = L.neu(1000);
  const sig = { sig: "S3a", ziel: "kern", grund: "haengt", schwere: 3 };
  const sprosse3 = L.SPROSSEN.find((s) => s.nr === 3);
  // Sprosse 3 darf 2x je 6 h.
  for (let i = 0; i < 2; i++) {
    z.ziele["kern"] = { zustand: "SUSPECT", sprosse: 3, seit: 0, versuche: i };
    const r = L.schritt(z, sig, 999999, W0 + i * 60000);
    if (r.handlung === "ausfuehren") {
      z.verlauf.push({ ziel: "kern", sprosse: 3, wall: W0 + i * 60000 });
    }
  }
  z.ziele["kern"] = { zustand: "SUSPECT", sprosse: 3, seit: 0, versuche: 2 };
  const dritt = L.schritt(z, sig, 999999, W0 + 120000);
  pruefe("der dritte Versuch prallt am Deckel ab", dritt.handlung === "deckel",
    dritt.handlung + " / " + dritt.grund);
  pruefe("und nennt die Zahlen", /2 von 2/.test(dritt.grund), dritt.grund);

  // Nach sechs Stunden ist der Deckel wieder frei.
  z.ziele["kern"] = { zustand: "SUSPECT", sprosse: 3, seit: 0, versuche: 2 };
  const spaeter = L.schritt(z, sig, 999999, W0 + 7 * 3600000);
  pruefe("nach sieben Stunden wieder erlaubt", spaeter.handlung === "ausfuehren",
    spaeter.handlung);
}

console.log("");
console.log("-- der Beobachtungsmodus schreibt, ohne zu handeln --");
{
  const p = { eintraege: [] };
  L.protokolliere(p, { rung: 1, target: "a.js", reason: "S1", wall: W0,
    result: "would-execute" });
  L.protokolliere(p, { rung: 2, target: "a.js", reason: "S1", wall: W0,
    result: "would-execute" });
  const n = L.zaehleWuerde(p);
  pruefe("beide Eintraege gezaehlt", n.gesamt === 2);
  pruefe("beide als 'haette ausgefuehrt'", n.wuerde === 2 && n.ausgefuehrt === 0);
  pruefe("nach Sprosse aufgeschluesselt", n.jeSprosse[1] === 1 && n.jeSprosse[2] === 1);

  // Der Ringpuffer haelt 200 - die Datei ist der einzige Beleg dafuer, was der
  // Waechter getan haette, und daran misst die Abnahme false_penalty_count.
  for (let i = 0; i < 250; i++) {
    L.protokolliere(p, { rung: 1, target: "x", reason: "S1", wall: W0 + i, result: "would-execute" });
  }
  pruefe("Ringpuffer bei 200", p.eintraege.length === 200, "erhalten " + p.eintraege.length);
  pruefe("die juengsten bleiben", p.eintraege[199].wall === W0 + 249);
}

console.log("");
console.log("-- der Zustand ueberlebt einen Neustart, aber nicht den Knotenwechsel --");
{
  const z = L.neu(1000);
  z.ziele["a.js"] = { zustand: "SUSPECT", sprosse: 2, seit: 0, versuche: 1 };
  const gespeichert = JSON.stringify(z);

  const gleich = L.laden(gespeichert, 1000);
  pruefe("im selben Lauf bleibt der Zustand", gleich.ziele["a.js"].sprosse === 2,
    "sonst verliert jede Sprossenzaehlung ihren Sinn, sobald der Waechter neu startet");

  const anders = L.laden(gespeichert, 2000);
  pruefe("im neuen Knoten faengt er bei null an",
    !anders.ziele["a.js"], "eine Zaehlung aus dem alten Knoten gilt nicht weiter");
  pruefe("unlesbar ergibt einen frischen Zustand",
    L.laden("{kaputt", 1000).ziele && Object.keys(L.laden("{kaputt", 1000).ziele).length === 0);
}

console.log("");
console.log("-- die Uhren ueberleben ebenso --");
{
  const u = U.neu();
  let w = W0;
  let p = 100 * 3600000;
  for (let i = 0; i < 30; i++) { w += 10000; p += 10000; U.runde(u, w, p); }
  u.nodeReset = 1000;
  const wieder = U.laden(JSON.stringify(u), 1000);
  pruefe("die Waechterzeit bleibt", wieder.guardTimeMs === u.guardTimeMs);
  pruefe("die Kette ist unterbrochen", wieder.letzteWall === null,
    "der Prozess war weg - die Pause ist keine Arbeit");
  const neuerKnoten = U.laden(JSON.stringify(u), 2000);
  pruefe("im neuen Knoten beginnt sie bei null", neuerKnoten.guardTimeMs === 0);
}

console.log("");
console.log("-- NOT_EXECUTABLE: wenn keine Sprosse helfen kann (Auftrag 5.4) --");
{
  // DER ZUSTAND STAND SEIT DEM ERSTEN ENTWURF IN `ZUSTAENDE` - und niemand
  // setzte ihn. Ein Skeptiker hat es gefunden: eine Zeichenkette ohne
  // Schreiber, und damit eine Regel, die auf nichts angewendet wurde.
  //
  // Der Fall: `exit.js` passt auf keinen Rechner. Der Bot steht, aber kein
  // Neustart hilft - es fehlt Speicher. Wer hier eskaliert, beendet der Reihe
  // nach gesunde Werkzeuge, raeumt home leer und baut am Ende Augmentierungen
  // ein, ohne dass sich am Speicher etwas aendert.
  // DIE UHREN MUESSEN MITLAUFEN. Ein festes `{guard: 0}` laesst jede Frist
  // nie ablaufen - die Falsifikation unten waere dann gruen, weil NICHTS
  // eskaliert, und nicht, weil das Merkmal wirkt.
  const uhrenBei = (ms) => ({ guard: ms, engine: ms, motor: ms });
  const uhren = uhrenBei(0);
  const sig = { sig: "S1", ziel: "blade.js", schwere: 1, grund: "Telemetrie alt" };

  const z1 = L.neu(1000);
  const r1 = L.schritt(z1, sig, 0, W0, uhren, { nichtAusfuehrbar: true,
    nichtAusfuehrbarGrund: "exit.js braucht 519 GB, groesster Rechner 128 GB" });
  pruefe("es wird NICHTS ausgefuehrt", r1.handlung === "nichts", r1.handlung);
  pruefe("der Zustand heisst NOT_EXECUTABLE",
    z1.ziele["blade.js"].zustand === "NOT_EXECUTABLE",
    z1.ziele["blade.js"].zustand);
  pruefe("und der Grund nennt die Ursache", /Speicher/.test(r1.grund), r1.grund);

  // Auch nach mehreren Runden bleibt es dabei - "eskaliert nie".
  let letzter = r1;
  for (let i = 0; i < 20; i++) {
    letzter = L.schritt(z1, sig, (i + 1) * 60000, W0 + (i + 1) * 60000,
      uhrenBei((i + 1) * 60000), { nichtAusfuehrbar: true });
  }
  pruefe("es eskaliert auch nach 20 Runden nicht",
    letzter.handlung === "nichts" && z1.ziele["blade.js"].zustand === "NOT_EXECUTABLE",
    letzter.handlung + " / " + z1.ziele["blade.js"].zustand);

  // DIE FALSIFIKATION. Ohne das Merkmal muss dieselbe Folge sehr wohl
  // eskalieren - sonst prueft die Probe oben nur, dass `schritt` nichts tut.
  const z2 = L.neu(1000);
  let gehandelt = false;
  for (let i = 0; i < 20; i++) {
    const r = L.schritt(z2, sig, i * 60000, W0 + i * 60000, uhrenBei(i * 60000));
    if (r.handlung === "ausfuehren") { gehandelt = true; break; }
  }
  pruefe("ohne das Merkmal wird sehr wohl eskaliert", gehandelt,
    "sonst misst die Probe oben nur, dass schritt() untaetig ist");

  // Und der Ausgang: faellt die Bedingung weg, geht es normal weiter. Anders
  // als EXHAUSTED ist NOT_EXECUTABLE keine Sackgasse.
  const z3 = L.neu(1000);
  L.schritt(z3, sig, 0, W0, uhren, { nichtAusfuehrbar: true });
  let wiederGehandelt = false;
  for (let i = 1; i < 20; i++) {
    const r = L.schritt(z3, sig, i * 60000, W0 + i * 60000, uhrenBei(i * 60000));
    if (r.handlung === "ausfuehren") { wiederGehandelt = true; break; }
  }
  pruefe("faellt die Bedingung weg, geht es normal weiter", wiederGehandelt,
    "NOT_EXECUTABLE ist keine Sackgasse - ein gekaufter Rechner loest ihn auf");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
