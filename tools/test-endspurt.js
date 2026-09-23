/**
 * Ebene 0: die Endspurt-Regel und der Ausgangs-Interlock (Position C.3).
 *
 * Der Interlock ist die wichtigste Sicherung des Umbaus: er verhindert, dass
 * `bn4rep.js` einbaut, waehrend der Ausgang offen steht. Ein Einbau in diesem
 * Moment loescht ueber `prestigeAugmentation` alle gekauften Rechner und setzt
 * das Guthaben auf 1.262 Dollar - also genau die Mittel, mit denen `exit.js`
 * gestartet wird.
 *
 * Geprueft werden vor allem die beiden Richtungen, in denen er falsch liegen
 * kann:
 *
 *   - Er sperrt NICHT, wenn er sollte  -> der Deadlock bleibt.
 *   - Er sperrt, wenn er nicht sollte  -> der Bot baut nie mehr ein, und
 *     Einbauten sind der einzige Weg, auf dem er besser wird.
 *
 * Aufruf: node tools/test-endspurt.js
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
  if (!t) {
    console.log("\n  src/" + rel + " nicht gefunden.");
    process.exit(1);
  }
  return t;
}

const E = await import(pathToFileURL(finde("lib/endspurt.js")).href);

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

const JETZT = 1_700_000_000_000;

/**
 * Ein ns mit Dateisystem im Speicher - und mit dem Verhalten, das die echte
 * API hat: `fileExists` nimmt einen Host, `ns.read` NICHT. Genau diese
 * Asymmetrie war der stillste Fehler des Umbaus.
 */
function mockNs(homeDateien = {}, host = "home", lokaleDateien = null) {
  const lokal = lokaleDateien || (host === "home" ? homeDateien : {});
  return {
    fileExists: (d, h) => (h === "home" ? d in homeDateien : d in lokal),
    read: (d) => lokal[d] ?? "",           // KEIN Host-Parameter, wie im Spiel
    scp: (d, ziel, quelle) => {
      if (quelle === "home" && d in homeDateien) { lokal[d] = homeDateien[d]; return true; }
      return false;
    },
    getHostname: () => host,
  };
}

function ausgangJson(felder) {
  return JSON.stringify({ zeit: JETZT, ...felder });
}

console.log("");
console.log("=== Ebene 0: Endspurt und Interlock (C.3) ===");

console.log("");
console.log("-- lage(): lesen von home, auch von einem Fremdrechner --");
{
  const daten = { "data/ausgang.json": ausgangJson({ offen: true, eta_min: 0 }) };
  const aufHome = E.lage(mockNs(daten, "home"), JETZT);
  pruefe("auf home lesbar", aufHome.gilt && aufHome.offen === true, JSON.stringify(aufHome));

  // DER FALL, DER FAST DURCHGERUTSCHT WAERE: die Werkzeuge laufen "praktisch
  // nie home". `ns.read` liest immer lokal; wer auf home prueft und lokal
  // liest, bekommt eine leere Zeichenkette - ohne Wurf, ohne Log.
  const aufFremd = E.lage(mockNs(daten, "werkbank-1"), JETZT);
  pruefe("von einem Fremdrechner ebenso lesbar", aufFremd.gilt && aufFremd.offen === true,
    JSON.stringify(aufFremd) + " - ns.read hat keinen Host-Parameter");
}

console.log("");
console.log("-- lage(): die Ausfallrichtung ist Normalbetrieb --");
{
  pruefe("fehlende Datei -> keine Lage", !E.lage(mockNs({}), JETZT).gilt);
  pruefe("und der Grund wird genannt", /fehlt/.test(E.lage(mockNs({}), JETZT).grund));
  pruefe("unlesbare Datei -> keine Lage",
    !E.lage(mockNs({ "data/ausgang.json": "{kaputt" }), JETZT).gilt);

  // Eine alte Datei heisst: ausgang.js laeuft nicht. Dann darf nichts gesperrt
  // und nichts verschleudert werden.
  const alt = { "data/ausgang.json": JSON.stringify({ zeit: JETZT - 20 * 60000, offen: true }) };
  const l = E.lage(mockNs(alt), JETZT);
  pruefe("zu alte Datei -> keine Lage", !l.gilt);
  pruefe("Grund nennt das Alter", /min alt/.test(l.grund), l.grund);
  pruefe("und nennt ausgang.js", /ausgang\.js laeuft nicht/.test(l.grund));

  const zukunft = { "data/ausgang.json": JSON.stringify({ zeit: JETZT + 5 * 60000, offen: true }) };
  pruefe("Zukunftszeit -> keine Lage", !E.lage(mockNs(zukunft), JETZT).gilt,
    "ein Uhrensprung ist keine frische Lage");
}

console.log("");
console.log("-- einbauErlaubt(): die harte Sperre --");
{
  const offen = E.lage(mockNs({ "data/ausgang.json": ausgangJson({ offen: true }) }), JETZT);
  const r = E.einbauErlaubt(offen, JETZT, JETZT);
  pruefe("bei offenem Ausgang wird NICHT eingebaut", !r.ok);
  pruefe("der Grund nennt den Rechnerpark", /Rechnerpark/.test(r.grund), r.grund);
  pruefe("und das genullte Konto", /1000 Dollar/.test(r.grund));

  const zu = E.lage(mockNs({ "data/ausgang.json": ausgangJson({ offen: false }) }), JETZT);
  pruefe("bei geschlossenem Ausgang wird eingebaut", E.einbauErlaubt(zu, JETZT, null).ok);
}

console.log("");
console.log("-- einbauErlaubt(): der Riegel gibt nach sechs Stunden auf --");
{
  const offen = E.lage(mockNs({ "data/ausgang.json": ausgangJson({ offen: true }) }), JETZT);
  const kurz = E.einbauErlaubt(offen, JETZT, JETZT - 3600000);
  pruefe("nach einer Stunde sperrt er noch", !kurz.ok);

  // Ein Riegel ohne Grenze waere derselbe Stillstand ohne Ruf, den der Umbau
  // abschafft: gelingt der Sprung nie, wuerde nie wieder eingebaut.
  const lang = E.einbauErlaubt(offen, JETZT, JETZT - E.SPERRE_HOECHSTENS_MS - 60000);
  pruefe("nach mehr als sechs Stunden gibt er auf", lang.ok);
  pruefe("und sagt, dass er aufgibt", /gibt auf/.test(lang.grund), lang.grund);
  pruefe("die Grenze sind sechs Stunden", E.SPERRE_HOECHSTENS_MS === 6 * 3600000,
    "erhalten " + E.SPERRE_HOECHSTENS_MS);
}

console.log("");
console.log("-- einbauErlaubt(): eine UNSICHERE Schaetzung sperrt nie --");
{
  // Auf dem Bladeburner-Weg ist eta_min eine untere Schranke: sie misst bis zur
  // Rangschwelle, nicht bis zur Ausfuehrung der Black Ops. Sie ist also immer
  // zu kurz. Ein Riegel, der darauf anspricht, blockierte Einbauten
  // stundenlang zu frueh - und Einbauten sind der einzige Weg nach oben.
  const unsicher = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 10, eta_sicher: false }),
  }), JETZT);
  pruefe("Lage gilt", unsicher.gilt);
  pruefe("eta_min ist da", unsicher.etaMin === 10);
  pruefe("sicher ist false", unsicher.sicher === false);
  pruefe("trotz 10 min Restzeit wird eingebaut", E.einbauErlaubt(unsicher, JETZT, null).ok,
    "eine untere Schranke darf keinen Einbau verhindern");

  const sicher = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 10, eta_sicher: true }),
  }), JETZT);
  const r = E.einbauErlaubt(sicher, JETZT, null);
  pruefe("eine SICHERE Schaetzung sperrt sehr wohl", !r.ok);
  pruefe("der Grund nennt den Wiederaufbau", /Wiederaufbau/.test(r.grund), r.grund);

  const weit = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 600, eta_sicher: true }),
  }), JETZT);
  pruefe("bei 600 min Restzeit wird eingebaut", E.einbauErlaubt(weit, JETZT, null).ok,
    "der Wiederaufbau braucht 186 min und passt noch");
}

console.log("");
console.log("-- lohntSich(): Posten gegen Restzeit --");
{
  const sicher = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 30, eta_sicher: true }),
  }), JETZT);
  pruefe("ein Posten ueber 60 min lohnt nicht mehr", !E.lohntSich(sicher, 60).ok);
  pruefe("ein Posten ueber 10 min schon", E.lohntSich(sicher, 10).ok);
  pruefe("der Grund nennt beide Zahlen",
    /30 min.*60 min/.test(E.lohntSich(sicher, 60).grund), E.lohntSich(sicher, 60).grund);

  const unsicher = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 5, eta_sicher: false }),
  }), JETZT);
  pruefe("unsichere Schaetzung blockiert keinen Posten", E.lohntSich(unsicher, 600).ok);

  const keine = E.lage(mockNs({}), JETZT);
  pruefe("ohne Lage lohnt sich alles", E.lohntSich(keine, 9999).ok,
    "im Zweifel Normalbetrieb - nichts sperren, nichts verschleudern");
}

console.log("");
console.log("-- geldIstVerderblich() --");
{
  const nah = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 30, eta_sicher: true }),
  }), JETZT);
  pruefe("unter 60 min ist Geld verderblich", E.geldIstVerderblich(nah));

  const fern = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 300, eta_sicher: true }),
  }), JETZT);
  pruefe("bei 300 min nicht", !E.geldIstVerderblich(fern));
  pruefe("ohne Lage nicht", !E.geldIstVerderblich(E.lage(mockNs({}), JETZT)));
  pruefe("die Schwelle sind 60 Minuten", E.VERDERBLICH_AB_MIN === 60,
    "erhalten " + E.VERDERBLICH_AB_MIN);
}

console.log("");
console.log("-- die Konstanten, mit ABSOLUTEN Zahlen --");
{
  pruefe("HOECHSTALTER_MS sind 15 Minuten", E.HOECHSTALTER_MS === 900000,
    "erhalten " + E.HOECHSTALTER_MS);
  pruefe("WIEDERAUFBAU_MIN ist 186 (gemessen 3,1 h)", E.WIEDERAUFBAU_MIN === 186,
    "erhalten " + E.WIEDERAUFBAU_MIN);
  pruefe("SPERRE_HOECHSTENS_MS sind 6 Stunden", E.SPERRE_HOECHSTENS_MS === 21600000);
}

console.log("");
console.log("-- zeile(): der Grund steht im Protokoll --");
{
  const l = E.lage(mockNs({
    "data/ausgang.json": ausgangJson({ offen: false, eta_min: 30, eta_sicher: true }),
  }), JETZT);
  const z = E.zeile(l);
  pruefe("nennt die Restzeit", /30 min/.test(z), z);
  pruefe("nennt die Verderblichkeit", /verderblich/.test(z));
  pruefe("ohne Lage bleibt es lesbar", /keine Lage/.test(E.zeile(E.lage(mockNs({}), JETZT))));
}

console.log("");
console.log("-- kampfEinbauSperre(): kein Einbau im Wiederaufbau, und erst nach 2x seiner Dauer mit Rang (22.09.2026) --");
{
  const H = 3600000;
  const k = (s, d, x, a) => ({ strength: s, defense: d, dexterity: x, agility: a });
  // Die beiden Einbauten vom 22.09. (Sicherungen pre-install):
  const f1 = E.kampfEinbauSperre(k(100, 100, 100, 100), { aufbauDauerMs: 5 * H, seitAufbauMs: 0.2 * H });
  pruefe("16:21 - Kampfwerte gerade 100, Rang 0: gesperrt (Wiederaufbau eben erst fertig)",
    f1.gesperrt && f1.zuFrueh && !f1.aufbau, JSON.stringify(f1));
  const f2 = E.kampfEinbauSperre(k(90, 89, 89, 89), {});
  pruefe("20:38 - Tiefstand 89 (Wiederaufbau laeuft): gesperrt",
    f2.gesperrt && f2.aufbau, JSON.stringify(f2));
  // Skeptiker Runde 2, H2: 20 h Wiederaufbau -> 40 h mit Rang noetig.
  const lang = E.kampfEinbauSperre(k(150, 150, 150, 150), { aufbauDauerMs: 20 * H, seitAufbauMs: 25 * H });
  pruefe("20 h Wiederaufbau, erst 25 h Rang seitdem: gesperrt (40 h noetig)",
    lang.gesperrt && lang.noetigMs === 40 * H, JSON.stringify(lang));
  const kurz = E.kampfEinbauSperre(k(150, 150, 150, 150), { aufbauDauerMs: 2 * H, seitAufbauMs: 11 * H });
  pruefe("kurzer Wiederaufbau: trotzdem mindestens 12 h", kurz.gesperrt && kurz.noetigMs === 12 * H,
    JSON.stringify(kurz));
  // Gegenproben - sonst waere alles oben auch gruen, wenn die Sperre immer griffe.
  const frei = E.kampfEinbauSperre(k(250, 240, 260, 230), { aufbauDauerMs: 7 * H, seitAufbauMs: 15 * H });
  pruefe("7 h Wiederaufbau, 15 h Rang seitdem: frei", !frei.gesperrt, JSON.stringify(frei));
  const grenze = E.kampfEinbauSperre(k(100, 100, 100, 100), { aufbauDauerMs: 7 * H, seitAufbauMs: 14 * H });
  pruefe("genau 2x Dauer: frei (Mindestabstand)", !grenze.gesperrt, JSON.stringify(grenze));
  const ohne = E.kampfEinbauSperre(k(300, 300, 300, 300), {});
  pruefe("ohne Uhr sperrt nur der Wiederaufbau", !ohne.gesperrt, JSON.stringify(ohne));
  const nul = E.kampfEinbauSperre(k(300, 300, 300, 300), { aufbauDauerMs: null, seitAufbauMs: null });
  pruefe("auch null (Lesefehler in bn4rep.js) sperrt nicht fuer immer", !nul.gesperrt, JSON.stringify(nul));
}

console.log("");
console.log("-- Aug-Ruecklage: nur erreichbare Stuecke (23.09.2026) --");
{
  pruefe("augRuecklage ist exportiert", typeof E.augRuecklage === "function");
  if (typeof E.augRuecklage === "function") {
    // Der Fall vom 23.09.: Simulacrum 150 Mrd * 613 neben zwei erreichbaren.
    const kand = [
      { aug: "Blade's Simulacrum", preis: 150e9 * 613, rep: 1815, repReq: 1250 },
      { aug: "A", preis: 6e9, rep: 10, repReq: 5 },
      { aug: "B", preis: 3e9, rep: 10, repReq: 5 },
      { aug: "C (nicht verdient)", preis: 1e9, rep: 1, repReq: 5 },
    ];
    const r = E.augRuecklage(kand, 1e9);
    pruefe("Simulacrum (92 Billionen) zaehlt nicht, A+B schon: 9 Mrd", r === 9e9, String(r));
    pruefe("unverdiente zaehlen nie", E.augRuecklage([kand[3]], 1e12) === 0);
    pruefe("Konto 0 (nach Einbau): nichts reserviert", E.augRuecklage(kand, 0) === 0);
    pruefe("Grenze genau 10x zaehlt noch", E.augRuecklage([{ preis: 10e9, rep: 1, repReq: 1 }], 1e9) === 10e9);
    pruefe("unlesbare Preise zaehlen nicht", E.augRuecklage([{ preis: NaN, rep: 1, repReq: 1 }], 1e9) === 0);
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
