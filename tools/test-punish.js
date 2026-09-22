/**
 * Ebene 2: Sprosse 5 - die acht Vorbedingungen (Position C.12).
 *
 * ===========================================================================
 * WARUM DIESER TEST DER SCHAERFSTE SEIN MUSS
 * ===========================================================================
 *
 * `installAugmentations` ist unwiderruflich. Es kostet gekaufte Rechner,
 * Programme, Faktionen, Reputation, Hacking-Level, Kampfwerte, das Aktiendepot
 * (`Prestige.ts:169-172`) und ein laufendes Graft; das Konto steht danach auf
 * 1.262 Dollar. Der Wiederaufbau dauert gemessen 3,1 Stunden.
 *
 * Jede der acht Vorbedingungen wird deshalb EINZELN geprueft: einmal so, dass
 * sie haelt, und einmal so, dass sie bricht. Ein Test, der nur den guten Fall
 * faehrt, belegt nichts - die Bedingungen sind ja gerade fuer die schlechten
 * Faelle da.
 *
 * Und zusaetzlich der wichtigste Fall von allen: der TROCKENLAUF. Ohne das
 * Argument `scharf` darf unter keinen Umstaenden etwas eingebaut werden, auch
 * wenn alle acht halten.
 *
 * Aufruf: node tools/test-punish.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

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

const { modul, pfad } = await ladeAusBeiden(ROOT, "punish.js");
console.log("");
console.log("=== Ebene 2: Sprosse 5 - der Einbau (C.12) ===");
console.log("    " + path.relative(ROOT, pfad).replace(/\\/g, "/"));

const WALL = 1_700_000_000_000;
const NODE_RESET = 1_600_000_000_000;

/**
 * Der gute Fall: alle acht Vorbedingungen halten.
 *
 * Jede Probe unten nimmt genau EINE davon weg. So steht in jeder Zeile, was
 * sie prueft - und ein Test, der aus einem anderen Grund gruen wird, faellt
 * durch die Gegenprobe ganz unten auf.
 */
function guterFall(aenderung = {}) {
  const dateien = {
    "data/penalty-order.json": JSON.stringify({
      rung: 5, wall: WALL - 60000, nodeReset: NODE_RESET,
      s2MotorMs: 7 * 3600000,
      wirkungslos: [1, 2, 3],
    }),
    "data/bn4net.json": JSON.stringify({ letzterMzGrund: null, motorTimeMs: 1e7 }),
    // AUS `data/einbau.json` (Skeptiker Runde 4, R2): `data/aug-queue.json`
    // hatte im ganzen Baum keinen Schreiber. `bn4rep.js` fuehrt die Zahl in
    // einbau.json unter `wartend` (bn4rep.js:1041-1046).
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2 }),
    "data/blade.json": JSON.stringify({ rang: 4000 }),
    "data/verfahren.txt": "V2 10 2",
    "data/boerse.json": JSON.stringify({ posten: 0, depotWert: 0 }),
    "data/graftauto.json": JSON.stringify({ laeuft: null }),
    "data/ausgang.json": JSON.stringify({ offen: false }),
    "data/penalties.json": JSON.stringify({ version: 1, eintraege: [] }),
    // DER HANDSCHLAG VOR DEM EINBAU (Auftrag 7.2, seit 04.09.2026).
    //
    // `punish.js` stellt vor `installAugmentations` eine Sicherungsanfrage und
    // wartet bis zu 90 s auf die Antwort der Bruecke. Im guten Fall liegt sie
    // schon da - so bleibt der Test bei seinem Gegenstand, den ACHT
    // Vorbedingungen, statt an einer Wartefrist zu haengen.
    //
    // Der Zeitstempel liegt in der Zukunft, weil `antwortDa` auf
    // `antwort.ts >= anfrage.ts` prueft und die Anfrage erst im Lauf entsteht.
    "data/backup-ok.txt": JSON.stringify({
      ts: WALL + 3600000, anlass: "pre-install", datei: "TEST_vorab.json.gz",
    }),
    ...aenderung,
  };
  // Ein Wert `null` heisst: die Datei soll FEHLEN.
  for (const [k, v] of Object.entries(dateien)) {
    if (v === null) delete dateien[k];
  }
  return dateien;
}

async function fahre(dateien, args = [], maxSchlaf = undefined) {
  // `maxSchlaf` wird gebraucht, seit `punish.js` vor dem Einbau den
  // Handschlag stellt: der wartet bis zu 90 s in Schritten von 2 s, also
  // 45 Runden. Mit dem Standardwert braeche der Mock mitten in der Frist ab -
  // und eine Probe, die den Abbruch als "es hat gewartet" liest, prueft die
  // Sleep-Grenze des Mocks, nicht die Entscheidung des Gewerks.
  const m = neuerMock({ wall: WALL, nodeReset: NODE_RESET, knoten: 10, args,
    // OHNE `beiSchlaf` BEWEGT SICH DIE UHR NICHT. Der Mock ruecht die Zeit
    // nur vor, wenn der Test es sagt - eine Wartefrist in `Date.now()` liefe
    // sonst ewig, und `maxSchlaf` waere die einzige Grenze. Genau das ist beim
    // Handschlag passiert.
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(ms),
    ...(maxSchlaf === undefined ? {} : { maxSchlaf }) });
  for (const [d, i] of Object.entries(dateien)) m.lege("home", d, i);
  let eingebaut = false;
  // Der Mock kennt singularity nicht - hier wird die eine Funktion ergaenzt,
  // die zaehlt. Sie WIRFT nicht und laedt nichts neu; der Test will nur
  // wissen, OB sie gerufen wurde.
  m.ns.singularity = {
    installAugmentations: (cb) => { eingebaut = true; return cb; },
  };
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } finally { zurueck(); }
  let ergebnis = {};
  try { ergebnis = JSON.parse(m.lies("home", "data/punish.json") || "{}"); }
  catch { ergebnis = {}; }
  return { eingebaut, ergebnis, mock: m };
}

console.log("");
console.log("-- DER TROCKENLAUF: alle acht halten, und trotzdem passiert nichts --");
{
  const r = await fahre(guterFall());
  pruefe("NICHTS wurde eingebaut", !r.eingebaut,
    "ohne das Argument 'scharf' darf unter keinen Umstaenden etwas passieren");
  pruefe("alle acht Bedingungen halten", r.ergebnis.bedingungen?.alleErfuellt === true,
    JSON.stringify(r.ergebnis.bedingungen).slice(0, 200));
  pruefe("und es steht als Trockenlauf im Protokoll",
    /alle acht/.test(String(r.ergebnis.trockenlauf)),
    String(r.ergebnis.trockenlauf));
  pruefe("scharf ist false", r.ergebnis.scharf === false);
}

console.log("");
console.log("-- MIT 'scharf': erst dann wird gebaut --");
{
  const r = await fahre(guterFall(), ["scharf"]);
  pruefe("eingebaut", r.eingebaut);
  pruefe("und das Protokoll sagt es", r.ergebnis.ausgefuehrt === true);
}

console.log("");
console.log("-- ohne Auftrag passiert gar nichts --");
{
  // Ein Handstart darf NICHTS tun. Die teuerste Handlung des Bots haengt nicht
  // davon ab, dass jemand die richtige Datei nicht doppelt anklickt.
  const r = await fahre(guterFall({ "data/penalty-order.json": null }), ["scharf"]);
  pruefe("nichts eingebaut", !r.eingebaut);
  pruefe("und der Grund nennt den fehlenden Auftrag",
    /kein Sprosse-5-Auftrag/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- ein ALTER Auftrag gilt nicht --");
{
  const r = await fahre(guterFall({
    "data/penalty-order.json": JSON.stringify({
      rung: 5, wall: WALL - 3600000, nodeReset: NODE_RESET,
      s2MotorMs: 7 * 3600000, wirkungslos: [1, 2, 3],
    }),
  }), ["scharf"]);
  pruefe("nichts eingebaut", !r.eingebaut);
  pruefe("Grund: aelter als zehn Minuten",
    /aelter als zehn Minuten/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- ein Auftrag aus einem ANDEREN Knoten gilt nicht --");
{
  const r = await fahre(guterFall({
    "data/penalty-order.json": JSON.stringify({
      rung: 5, wall: WALL - 60000, nodeReset: 42,
      s2MotorMs: 7 * 3600000, wirkungslos: [1, 2, 3],
    }),
  }), ["scharf"]);
  pruefe("nichts eingebaut", !r.eingebaut);
  pruefe("Grund: anderer Knoten", /anderen Knoten/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 1. S2 muss sechs Stunden MOTORZEIT alt sein --");
{
  const r = await fahre(guterFall({
    "data/penalty-order.json": JSON.stringify({
      rung: 5, wall: WALL - 60000, nodeReset: NODE_RESET,
      s2MotorMs: 3 * 3600000, wirkungslos: [1, 2, 3],
    }),
  }), ["scharf"]);
  pruefe("bei drei Stunden nichts eingebaut", !r.eingebaut);
  pruefe("und der Grund nennt beide Zahlen",
    /3 h Motorzeit.*noetig sind 6/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 2. die Sprossen 1 bis 3 muessen wirkungslos gewesen sein --");
{
  const r = await fahre(guterFall({
    "data/penalty-order.json": JSON.stringify({
      rung: 5, wall: WALL - 60000, nodeReset: NODE_RESET,
      s2MotorMs: 7 * 3600000, wirkungslos: [1, 2],
    }),
  }), ["scharf"]);
  pruefe("ohne Sprosse 3 nichts eingebaut", !r.eingebaut);
  pruefe("Grund: die Leiter wird nicht uebersprungen",
    /Sprosse 3 war nicht verifiziert wirkungslos/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 3. kein Nachholfenster --");
{
  // Nach einer Offline-Nacht bucht die Engine die Abwesenheit in EINEM Klumpen
  // (engine.tsx:280-282). Ein Traeger, der dort "nicht waechst", waechst
  // gleich um acht Stunden auf einmal.
  const r = await fahre(guterFall({
    "data/bn4net.json": JSON.stringify({
      letzterMzGrund: "Nachholklumpen: Spielzeit +28800 s bei nur 12 s Wanduhr",
      motorTimeMs: 1e7,
    }),
  }), ["scharf"]);
  pruefe("bei offenem Nachholfenster nichts eingebaut", !r.eingebaut);
  pruefe("Grund nennt das Fenster",
    /Nachholfenster offen/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 4. ohne gekaufte Augmentierung waere es ein Soft-Reset --");
{
  const r = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 0 }),
  }), ["scharf"]);
  pruefe("nichts eingebaut", !r.eingebaut);
  pruefe("Grund: ein Einbau ohne Aug ist ein Soft-Reset",
    /Soft-Reset/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));

  // Ohne die Datei ueberhaupt: auch dann nicht. Ein fehlender Wert ist kein
  // Freibrief - genau das war der Fehler von `aug-queue.json`, das niemand
  // schrieb und dessen Fehlen die Bedingung dauerhaft blockierte, ohne dass
  // es auffiel.
  const rOhne = await fahre(guterFall({ "data/einbau.json": null }), ["scharf"]);
  pruefe("ohne einbau.json erst recht nicht", !rOhne.eingebaut,
    String(rOhne.ergebnis.verweigert));

  // Und eine ALTE Zahl zaehlt nicht: zwischen dem Schreiben und jetzt kann ein
  // Einbau gelaufen sein, dann waere die Warteschlange leer.
  const r2 = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL - 45 * 60000, wartend: 3 }),
  }), ["scharf"]);
  pruefe("eine 45 Minuten alte Zahl zaehlt nicht", !r2.eingebaut,
    String(r2.ergebnis.verweigert));
  pruefe("und der Grund nennt das Alter",
    /aelter als 30 Minuten/.test(String(r2.ergebnis.verweigert)),
    String(r2.ergebnis.verweigert));
}

console.log("");
console.log("-- 5. nicht vor dem Divisionsbeitritt --");
{
  // Der Einbau setzt die Kampfwerte auf 1. Vor dem Beitritt (alle vier >= 100)
  // waeren das 6,6 Stunden Wiederaufbau fuer nichts.
  const r = await fahre(guterFall({ "data/blade.json": null }), ["scharf"]);
  pruefe("ohne Division nichts eingebaut", !r.eingebaut);
  pruefe("Grund nennt die 6,6 Stunden",
    /Kampfwerte auf 1/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));

  // Auf dem HACKINGWEG (V1) gibt es keine Division - dort darf es laufen.
  const r2 = await fahre(guterFall({
    "data/blade.json": null,
    "data/verfahren.txt": "V1 1 1",
  }), ["scharf"]);
  pruefe("auf dem Hackingweg gilt die Bedingung nicht", r2.eingebaut,
    "V1 hat keine Bladeburner-Division - " + String(r2.ergebnis.verweigert));
}

console.log("");
console.log("-- 5b. auf dem Bladeburner-Weg nur mit Wiederaufbauhilfe (R9) --");
{
  // Der Befund aus dem Spielquelltext: `prestigeAugmentation` setzt alle
  // Kampfwerte auf 1 (PlayerObjectGeneralMethods.ts:86-100), der Bladeburner
  // ueberlebt aber mitsamt Rang. Die Erfolgswahrscheinlichkeit ist ein
  // Potenzprodukt der Kampfwerte (Action.ts:169-195), ein Fehlschlag zieht
  // Rang AB (Bladeburner.ts:1055-1059).
  //
  // Ein Einbau auf dem V2-Weg erzeugt also genau die Stagnation, die Sprosse 5
  // beheben soll - es sei denn, ein wartendes Stueck verkuerzt den
  // Wiederaufbau. Diese Frage beantwortet bn4rep.js, nicht punish.js.
  const r = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2,
      wiederaufbauHilfe: false }),
  }), ["scharf"]);
  pruefe("ohne Wiederaufbauhilfe wird auf dem V2-Weg nicht eingebaut",
    !r.eingebaut, String(r.ergebnis.verweigert));
  pruefe("und der Grund nennt die Kampfwerte",
    /Kampfwerte auf 1/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));

  // Die Gegenprobe: MIT Hilfe geht es durch. Sonst waere die Bedingung ein
  // stiller Riegel statt einer Abwaegung.
  const r2 = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2,
      wiederaufbauHilfe: true }),
  }), ["scharf"]);
  pruefe("mit Wiederaufbauhilfe baut es ein", r2.eingebaut,
    String(r2.ergebnis.verweigert));

  // Und ohne die Angabe (alte Datei) bleibt es beim alten Verhalten - eine
  // Sperre, die aus einem fehlenden Feld heraus greift, waere schlimmer als
  // ein Einbau zuviel.
  const r3 = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2 }),
  }), ["scharf"]);
  pruefe("ohne die Angabe gilt die alte, grosszuegige Regel", r3.eingebaut,
    String(r3.ergebnis.verweigert));
}

console.log("");
console.log("-- die Einbausperre aus bn4rep.js gilt auch fuer Sprosse 5 (22.09.2026) --");
{
  // Skeptiker Runde 2, M4: Wiederaufbau laeuft oder hat sich noch nicht
  // bezahlt gemacht -> kein Einbau, auch nicht scharf.
  const auf = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2,
      wiederaufbauHilfe: true, kampfAufbau: true, kampfZuFrueh: false }),
  }), ["scharf"]);
  pruefe("im Wiederaufbau baut Sprosse 5 nicht ein", !auf.eingebaut,
    String(auf.ergebnis.verweigert));
  const frueh = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2,
      wiederaufbauHilfe: true, kampfAufbau: false, kampfZuFrueh: true }),
  }), ["scharf"]);
  pruefe("vor Ablauf der Sperrfrist ebenfalls nicht", !frueh.eingebaut,
    String(frueh.ergebnis.verweigert));
  const frei = await fahre(guterFall({
    "data/einbau.json": JSON.stringify({ zeit: WALL, wartend: 2,
      wiederaufbauHilfe: true, kampfAufbau: false, kampfZuFrueh: false }),
  }), ["scharf"]);
  pruefe("Gegenprobe: beide frei -> es baut ein", frei.eingebaut,
    String(frei.ergebnis.verweigert));
}

console.log("");
console.log("-- 6. das Depot muss leer sein --");
{
  const r = await fahre(guterFall({
    "data/boerse.json": JSON.stringify({ posten: 4, depotWert: 12e9 }),
  }), ["scharf"]);
  pruefe("mit offenen Posten nichts eingebaut", !r.eingebaut);
  pruefe("Grund nennt Zahl und Wert",
    /4 Posten \(12\.00 Mrd\)/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 7. kein laufendes Graft --");
{
  const r = await fahre(guterFall({
    "data/graftauto.json": JSON.stringify({ laeuft: "The Blade's Simulacrum" }),
  }), ["scharf"]);
  pruefe("bei laufendem Graft nichts eingebaut", !r.eingebaut);
  pruefe("Grund nennt die fehlende Erstattung",
    /GraftingWork\.tsx:75-83/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- 8. ein offener Ausgang wird GESPRUNGEN, nicht resettet --");
{
  // Der haeufigste S2-Fall ueberhaupt: fertiger Knoten, blockierter Sprung.
  // Ein Einbau behebt das nicht - er raeumt nur den Park leer.
  const r = await fahre(guterFall({
    "data/ausgang.json": JSON.stringify({ offen: true }),
  }), ["scharf"]);
  pruefe("bei offenem Ausgang nichts eingebaut", !r.eingebaut);
  pruefe("Grund: gesprungen, nicht resettet",
    /GESPRUNGEN, nicht resettet/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));
}

console.log("");
console.log("-- die Deckel: einmal je Knotenstufe, einmal je 24 h --");
{
  const r = await fahre(guterFall({
    "data/penalties.json": JSON.stringify({
      version: 1,
      eintraege: [{ rung: 5, result: "executed", wall: WALL - 3600000,
        nodeReset: NODE_RESET }],
    }),
  }), ["scharf"]);
  pruefe("ein zweites Mal im selben Knoten geht nicht", !r.eingebaut);
  pruefe("Grund nennt die Knotenstufe",
    /je Knotenstufe/.test(String(r.ergebnis.verweigert)),
    String(r.ergebnis.verweigert));

  const r2 = await fahre(guterFall({
    "data/penalties.json": JSON.stringify({
      version: 1,
      eintraege: [{ rung: 5, result: "executed", wall: WALL - 3600000,
        nodeReset: 42 }],
    }),
  }), ["scharf"]);
  pruefe("und auch nicht binnen 24 h in einem anderen Knoten", !r2.eingebaut,
    String(r2.ergebnis.verweigert));

  const r3 = await fahre(guterFall({
    "data/penalties.json": JSON.stringify({
      version: 1,
      eintraege: [{ rung: 5, result: "executed", wall: WALL - 30 * 3600000,
        nodeReset: 42 }],
    }),
  }), ["scharf"]);
  pruefe("nach 30 h in einem anderen Knoten wieder", r3.eingebaut,
    String(r3.ergebnis.verweigert));
}

console.log("");
console.log("-- DER HANDSCHLAG: ohne Sicherung wird NICHT eingebaut --");
{
  // Auftrag 7.2 unterscheidet hier bewusst zwischen Sprung und Einbau: der
  // Sprung geht auch ohne Sicherung (ein offener Ausgang kostet laufend
  // Zeit), der Einbau nicht (er ist beliebig oft nachholbar, der Verlust bei
  // einem Fehlgriff betraegt Tage).
  //
  // Gestellt wird der schlimmste Fall: keine Antwort der Bruecke UND keine
  // junge Sicherung. Der Handschlag wartet dann 90 s - der Mock bricht
  // vorher ab, und genau das ist der Beweis, dass gewartet statt gebaut wird.
  const ohne = guterFall({ "data/backup-ok.txt": null, "data/bridge.json": null });
  const r = await fahre(ohne, ["scharf"], 60);
  pruefe("es baut NICHT ein", !r.eingebaut,
    "der Verlust bei einem Fehlgriff betraegt Tage");
  pruefe("und es setzt die Einbausperre",
    !!r.mock.lies("home", "data/install-sperre.txt"),
    "sonst versuchte es der Kern in der naechsten Runde wieder");
  pruefe("die Sperre nennt den Handschlag als Grund",
    (() => {
      try {
        return JSON.parse(r.mock.lies("home", "data/install-sperre.txt")).reason
          === "handschlag";
      } catch { return false; }
    })(), "ein Mensch muss sehen, WARUM gesperrt ist");

  // Und die Gegenprobe zur Gegenprobe: mit einer JUNGEN Sicherung (aber ohne
  // Antwort) DARF gebaut werden - sonst stuende der Bot bei jeder kurzen
  // Brueckenstoerung.
  const jung = guterFall({
    "data/backup-ok.txt": null,
    "data/bridge.json": JSON.stringify({
      lastVerifiedBackup: { ts: WALL - 3600000, file: "LIVE_x.json.gz" },
    }),
  });
  const r2 = await fahre(jung, ["scharf"], 60);
  pruefe("mit einer Sicherung von vor einer Stunde baut es ein", r2.eingebaut,
    "sonst blockiert jede kurze Brueckenstoerung den Einbau");
  pruefe("und es setzt dann KEINE Sperre",
    !r2.mock.lies("home", "data/install-sperre.txt"));
}

console.log("");
console.log("-- die Gegenprobe: jede Probe muss aus IHREM Grund rot sein --");
{
  // Ohne diese Zeile koennte jede Probe oben aus einem beliebigen anderen
  // Grund verweigert haben, und der Test saehe trotzdem gruen aus.
  const r = await fahre(guterFall(), ["scharf"]);
  pruefe("der gute Fall baut wirklich ein", r.eingebaut,
    "sonst pruefen alle Proben oben nur, dass ueberhaupt etwas schiefgeht");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
