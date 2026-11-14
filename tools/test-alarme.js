/**
 * Test fuer B05 + B08 (14.11.2026): Alarmliste, Aufraeumwerkzeug, Neustartgrenze.
 *
 *   A. sync/alarmliste.js: Klassen, Schluessel, Ablauf, Messung, Hand-Beleg,
 *      Laden/Speichern (atomar, kaputte Datei wird beiseitegelegt).
 *      Kernsatz: ein SCHUTZALARM endet nie durch Zeit, nur durch Messung oder
 *      Beleg.
 *   B. tools/alarme.js: Aufraeumen von `## Sofort` gegen Fixtures UND gegen eine
 *      Kopie der echten BAUSTELLEN.md/ERLEDIGT.md (Zeilenenden, Kopf, andere
 *      Abschnitte unveraendert, Archiv zuerst, zweiter Lauf ist ein No-op).
 *   C. sync/neustart-grenze.js (Obergrenze) und sync/bridge-start.cmd
 *      (statische Pruefung: die Datei wird NIE ausgefuehrt).
 *   D. sync/bridge.js: die Haken sind da, und alarm() bleibt isoliert lauffaehig.
 *   E. Die Bruecke (MOCK-Rolle) gegen ein nachgebautes Spiel: Alarm wird
 *      gefuehrt, nur einmal in die Liste geschrieben, durch die Messung
 *      "socket-verifiziert" beendet; offene Alarme ueberleben einen Neustart;
 *      Ablauf und Schutz im Urteilstakt. Dauert ~75 s (der Takt ist 60 s).
 *
 * Bindet nie 12525/8795, startet keine LIVE-Bruecke, fasst keine echte Liste
 * und keine echten Sicherungen an. Aufruf: node tools/test-alarme.js [--ohne-bruecke]
 */
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import * as AL from "../sync/alarmliste.js";
import * as ALARME from "./alarme.js";
import * as GRENZE from "../sync/neustart-grenze.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const OHNE_BRUECKE = process.argv.includes("--ohne-bruecke");

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else { rot++; fehler.push(was + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
const wirft = (f) => { try { f(); return null; } catch (e) { return e; } };

const tempOrdner = [];
const prozesse = [];
function neuerOrdner(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "bb-alarme-" + name + "-"));
  tempOrdner.push(d);
  return d;
}
function raeumeAuf() {
  for (const p of prozesse) { try { if (p.exitCode === null) p.kill(); } catch { /* egal */ } }
  for (const d of tempOrdner) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* egal */ } }
}
process.on("exit", raeumeAuf);

const H = AL.STUNDE_MS;
const T0 = Date.parse("2026-11-14T00:00:00.000Z");

// ===========================================================================
console.log("-- A. Alarmliste --");
{
  const k = AL.klassifiziere("Grosser Schub verweigert (12 Dateien) - sieht nach einem Merge aus");
  pruefe("Titel mit Zahl -> Regel 'schub-gross', Schutz, ohne Ablauf", k.name === "schub-gross" && k.klasse === "schutz" && k.ablaufMs === null && k.messung === "schub-ok");
  pruefe("'Schub verweigert - Zweit-Tab-Sperre' ist NICHT 'schub-master' (Reihenfolge der Regeln)",
    AL.klassifiziere("Schub verweigert - Zweit-Tab-Sperre").name === "schub-zweittab");
  pruefe("'Schub verweigert (3 nicht in master)' -> schub-master", AL.klassifiziere("Schub verweigert (3 nicht in master) - Fehlgriff?").name === "schub-master");
  pruefe("Spiel-Tab nicht verbunden: Zustand, 24 h, Messung tab-verbunden",
    (() => { const x = AL.klassifiziere("Spiel-Tab nicht verbunden"); return x.klasse === "zustand" && x.ablaufMs === 24 * H && x.messung === "tab-verbunden"; })());
  const u = AL.klassifiziere("Etwas ganz Neues 17");
  pruefe("unbekannter Titel: Vorfall, 7 Tage, Schluessel ohne Ziffern", u.klasse === "vorfall" && u.ablaufMs === 168 * H && !u.bekannt && u.name === AL.klassifiziere("Etwas ganz Neues 99").name);
  const alleSchutz = AL.REGELN.filter((r) => r.klasse === "schutz");
  pruefe("jede Regel nennt eine Klasse; Schutz hat nie einen Ablauf", AL.REGELN.every((r) => ["zustand", "vorfall", "schutz"].includes(r.klasse)) && alleSchutz.every((r) => r.ablaufH === undefined));
  pruefe("alle Schutz-Regeln mit Messung nennen eine Messung, die die Bruecke kennt",
    alleSchutz.filter((r) => r.messung).every((r) => ["sicherung-gruen", "schub-ok", "zweittab-frei", "socket-verifiziert", "verbindung-mit-anker", "master-index-ok"].includes(r.messung)));

  // melden / zaehlen
  const l = AL.leereListe();
  const a = AL.melde(l, { titel: "Telemetrie veraltet", text: "t1", quelle: "bruecke" }, T0).eintrag;
  pruefe("erste Meldung eroeffnet", a.status === "offen" && a.anzahl === 1 && a.ablaufAm === T0 + 24 * H);
  const b = AL.melde(l, { titel: "Telemetrie veraltet", text: "t2" }, T0 + 6 * H);
  pruefe("Wiederholung zaehlt, eroeffnet nicht neu, rueckt den Ablauf nach",
    !b.neu && b.eintrag === a && a.anzahl === 2 && a.ablaufAm === T0 + 30 * H && a.text === "t2" && l.alarme.length === 1);

  // Ablauf
  pruefe("Zustand: vor dem Ablauf nichts", AL.verfalle(l, T0 + 29 * H).length === 0);
  const v = AL.verfalle(l, T0 + 30 * H);
  pruefe("Zustand: laeuft ab (24 h nach der letzten Wiederholung)", v.length === 1 && v[0].status === "beendet" && v[0].beendetDurch === "ablauf");
  const c = AL.melde(l, { titel: "Telemetrie veraltet", text: "neu" }, T0 + 31 * H);
  pruefe("nach dem Ende beginnt derselbe Schluessel NEU (kein Wiederbeleben)", c.neu && c.eintrag.id !== a.id && l.alarme.length === 2);

  // Schutz: nie durch Zeit
  const s = AL.melde(l, { titel: "Fremde Spielverbindung abgewiesen", text: "x" }, T0).eintrag;
  pruefe("Schutzalarm hat kein Ablaufdatum", s.klasse === "schutz" && s.ablaufAm === null);
  pruefe("Schutzalarm ueberlebt 1000 Tage Ablaufpruefung", AL.verfalle(l, T0 + 1000 * 24 * H).every((x) => x.klasse !== "schutz") && s.status === "offen");
  pruefe("Messung ohne Beleg beendet nichts", AL.messe(l, "socket-verifiziert", "", T0 + H).length === 0 && AL.messe(l, "socket-verifiziert", "   ", T0 + H).length === 0 && s.status === "offen");
  pruefe("falsche Messung beendet nichts", AL.messe(l, "sicherung-gruen", "Sicherung gruen", T0 + H).length === 0 && s.status === "offen");
  const m = AL.messe(l, "socket-verifiziert", "Verifiziert: abc BN1 L1", T0 + 2 * H);
  pruefe("richtige Messung MIT Beleg beendet ihn", m.length === 1 && s.status === "beendet" && s.beendetDurch === "messung:socket-verifiziert" && s.beleg === "Verifiziert: abc BN1 L1");

  // Hand
  const z = AL.melde(l, { titel: "Ausgang blockiert - exit.js passt auf keinen Rechner", text: "" }, T0).eintrag;
  pruefe("Schutzalarm ohne Messung: kein Ablauf, keine Messung", z.ablaufAm === null && z.messung === null);
  pruefe("von Hand ohne Beleg verweigert", /Beleg/.test(String(wirft(() => AL.beende(l, z.id, {}, T0)))) && z.status === "offen");
  pruefe("von Hand mit zu kurzem Beleg verweigert", wirft(() => AL.beende(l, z.id, { beleg: "ok" }, T0)) !== null && z.status === "offen");
  pruefe("von Hand mit Beleg (ueber den Schluessel) beendet",
    AL.beende(l, z.schluessel, { beleg: "exit.js laeuft wieder, getScriptRam 6.2 GB" }, T0 + H).status === "beendet" && z.beendetDurch === "hand");
  const zu = AL.melde(l, { titel: "Telemetrie veraltet", text: "" }, T0 + 40 * H).eintrag;
  pruefe("Zustandsalarm von Hand ohne Beleg beendbar", AL.beende(l, zu.id, {}, T0 + 41 * H).status === "beendet");
  pruefe("unbekannter Alarm: Fehler", wirft(() => AL.beende(l, "gibtsnicht", { beleg: "x".repeat(20) })) !== null);

  // Historie
  const g = AL.leereListe();
  for (let i = 0; i < 130; i++) {
    const e = AL.melde(g, { titel: "Telemetrie veraltet", text: String(i) }, T0 + i * 100 * H).eintrag;
    AL.beende(g, e.id, {}, T0 + i * 100 * H + 1);
  }
  const offenStehen = AL.melde(g, { titel: "Fremde Spielverbindung abgewiesen", text: "" }, T0).eintrag;
  for (let i = 0; i < 130; i++) {
    const e = AL.melde(g, { titel: "Telemetrie veraltet", text: String(i) }, T0 + 20000 * H + i * 100 * H).eintrag;
    AL.beende(g, e.id, {}, T0 + 20000 * H + i * 100 * H + 1);
  }
  pruefe("Historie auf " + AL.HISTORIE_MAX + " beendete begrenzt, offene bleiben alle",
    g.alarme.filter((x) => x.status === "beendet").length === AL.HISTORIE_MAX && g.alarme.includes(offenStehen));
  pruefe("Uebersicht nennt nur offene, mit Ende", AL.uebersicht(g).length === 1 && AL.uebersicht(g)[0].endetDurch === "messung:socket-verifiziert");

  // Platte
  const dir = neuerOrdner("platte");
  const datei = path.join(dir, "alarme.json");
  const leer = await AL.lade(datei);
  pruefe("fehlende Datei: leere Liste, kein Fehler", leer.kaputt === null && leer.liste.alarme.length === 0);
  const ll = AL.leereListe();
  AL.melde(ll, { titel: "Fremde Spielverbindung abgewiesen", text: "abc" }, T0);
  await AL.speichere(datei, ll);
  const rt = await AL.lade(datei);
  pruefe("speichern -> laden ist verlustfrei, kein .tmp bleibt", JSON.stringify(rt.liste) === JSON.stringify(ll) && !fs.existsSync(datei + ".tmp"));
  fs.writeFileSync(datei, "{halb");
  const kp = await AL.lade(datei);
  pruefe("kaputte Datei: leere Liste, Meldung, Original BEISEITEGELEGT (nicht ueberschrieben)",
    !!kp.kaputt && kp.liste.alarme.length === 0 && kp.beiseite && fs.readFileSync(kp.beiseite, "utf8") === "{halb");
  fs.writeFileSync(datei, JSON.stringify({ schema: 99, alarme: [] }));
  pruefe("falsche Form (schema 99) gilt als kaputt", !!(await AL.lade(datei)).kaputt);
}

// ===========================================================================
console.log("");
console.log("-- B. tools/alarme.js: ## Sofort aufraeumen --");
{
  const KOPF = ["# Offene Baustellen", "", "Regelkopf, bleibt.", "", "---", ""];
  const eintrag = (titel, text = "Text.") => ["### " + titel, "", text, ""];
  const stand = [
    ...KOPF,
    "## Sofort", "",
    ...eintrag("Telemetrie veraltet", "Das Spiel ist verbunden, aber ..."),
    ...eintrag("Schub verweigert (3 nicht in master) - Fehlgriff?", "Liste: a.js, b.js"),
    ...eintrag("Schub verweigert (5 nicht in master) - Fehlgriff?", "Liste: c.js"),
    ...eintrag("Fremde Spielverbindung abgewiesen", "Gruende: identifier x statt y"),
    ...eintrag("Telemetrie veraltet", "aeltere Kopie"),
    ...eintrag("Spielstand kam als Base64-Klartext", "alt\n\n*Alarm base64#1 (vorfall) seit 2026-09-01T00:00:00.000Z; laeuft ab 2026-09-04T00:00:00.000Z (ohne Wiederholung).*"),
    ...eintrag("ERLEDIGT 22.09.2026: Sleeves", "weg damit"),
    ...eintrag("Handpunkt: tor.js blind", "Entscheidung offen"),
    "## Offen, nach Dringlichkeit", "",
    ...eintrag("Ein offener Punkt"),
    "## Erledigt", "", "keine", "",
  ];
  const archivStand = ["# Erledigte Baustellen", "", "Kopf des Archivs.", "", "---", "", "### Schon archiviert", "", "x", "", "---", ""];
  const eol = (zeilen, crlf) => zeilen.join(crlf ? "\r\n" : "\n");
  const baue = (crlf) => {
    const wurzel = neuerOrdner("wurzel");
    fs.mkdirSync(path.join(wurzel, "nodes"), { recursive: true });
    fs.writeFileSync(path.join(wurzel, "nodes", "BAUSTELLEN.md"), eol(stand, crlf));
    fs.writeFileSync(path.join(wurzel, "nodes", "ERLEDIGT.md"), eol(archivStand, crlf));
    return wurzel;
  };
  const JETZT = Date.parse("2026-11-14T03:00:00.000Z");
  const lese = (w, n) => fs.readFileSync(path.join(w, "nodes", n), "utf8");

  const wurzel0 = baue(false);
  const z0 = ALARME.zerlege(lese(wurzel0, "BAUSTELLEN.md").split("\n"));
  const p0 = ALARME.plane(z0, { jetzt: JETZT });
  const titelArchiv = p0.archiv.map((x) => x.item.titel);
  const titelBleibt = p0.bleibt.map((x) => x.titel);
  pruefe("Plan: beide Telemetrie-Meldungen (Momentaufnahme) gehen ins Archiv", titelArchiv.filter((t) => t === "Telemetrie veraltet").length === 2);
  pruefe("Plan: von zwei 'Schub verweigert' bleibt der juengste (oberste), der aeltere geht",
    titelBleibt.includes("Schub verweigert (3 nicht in master) - Fehlgriff?") && titelArchiv.includes("Schub verweigert (5 nicht in master) - Fehlgriff?"));
  pruefe("Plan: Schutzalarm 'Fremde Spielverbindung' bleibt - ohne Messung nie", titelBleibt.includes("Fremde Spielverbindung abgewiesen") && !titelArchiv.includes("Fremde Spielverbindung abgewiesen"));
  pruefe("Plan: abgelaufener Vorfall (Fussnote: seit 01.09.) geht", titelArchiv.includes("Spielstand kam als Base64-Klartext"));
  pruefe("Plan: ERLEDIGT-markierter Punkt geht", titelArchiv.includes("ERLEDIGT 22.09.2026: Sleeves"));
  pruefe("Plan: Handpunkt bleibt", titelBleibt.includes("Handpunkt: tor.js blind") && p0.bleibt.find((x) => x.titel.startsWith("Handpunkt")).art === "hand");
  pruefe("Plan: eingetragen werden nur die bleibenden Auto-Alarme (2 Schutz)", p0.eintragen.length === 2 && p0.eintragen.every((x) => x.k.klasse === "schutz"));
  const pm = ALARME.plane(z0, { jetzt: JETZT, messungen: { "socket-verifiziert": "Verifiziert: abc BN1 L1 um 03:00" } });
  pruefe("Plan mit Messung: nur dann geht auch der juengste Schutzalarm dieser Messung",
    pm.archiv.some((x) => x.item.titel === "Fremde Spielverbindung abgewiesen" && /Messung 'socket-verifiziert'/.test(x.grund))
    && !pm.archiv.some((x) => x.item.titel.startsWith("Schub verweigert (3")));

  // Altersangabe aus der Ablage der Bruecke
  const ablageDir = neuerOrdner("ablage");
  fs.writeFileSync(path.join(ablageDir, "2026-11-13T20-00-00-000Z-spiel.md"), "### Spielstand kam als Base64-Klartext\n\nneu\n");
  fs.writeFileSync(path.join(ablageDir, "2026-10-01T20-00-00-000Z-spiel.md"), "### Neuer Fund ohne Regel\n\nx\n");
  const ablage = ALARME.leseAblage(ablageDir);
  pruefe("Ablage: Titel -> Zeitstempel aus dem Dateinamen", ablage.get("Spielstand kam als Base64-Klartext")[0] === Date.parse("2026-11-13T20:00:00.000Z"));
  const stand2 = stand.join("\n").split("\n").filter((z) => !z.startsWith("*Alarm base64#1")).map((z) => z === "alt" ? "alt ohne Fussnote" : z);
  const p2 = ALARME.plane(ALARME.zerlege(stand2), { jetzt: JETZT, ablage });
  pruefe("Vorfall mit bekanntem Alter UNTER dem Ablauf (Ablage: gestern) bleibt und wird gefuehrt",
    p2.bleibt.some((x) => x.art === "vorfall") && p2.eintragen.some((x) => x.item.titel.startsWith("Spielstand kam")));
  const p3 = ALARME.plane(ALARME.zerlege(stand2), { jetzt: JETZT });
  pruefe("Vorfall mit UNBEKANNTEM Alter bleibt (wird nicht blind geloescht)", p3.bleibt.some((x) => x.art === "vorfall") && !p3.archiv.some((x) => x.item.titel.startsWith("Spielstand kam")));

  // Ausfuehren, CRLF und LF
  for (const crlf of [false, true]) {
    const w = baue(crlf);
    const daten = path.join(w, "data");
    const vorB = lese(w, "BAUSTELLEN.md");
    const z = ALARME.zerlege(vorB.replace(/\r\n/g, "\n").split("\n"));
    const plan = ALARME.plane(z, { jetzt: JETZT });
    const erg = await ALARME.fuehreAus(plan, { baustellen: path.join(w, "nodes", "BAUSTELLEN.md"), archiv: path.join(w, "nodes", "ERLEDIGT.md"), datenOrdner: daten, jetzt: JETZT });
    const nachB = lese(w, "BAUSTELLEN.md");
    const nachA = lese(w, "ERLEDIGT.md");
    const tag = crlf ? " (CRLF)" : " (LF)";
    pruefe("fuehreAus" + tag + ": " + plan.archiv.length + " archiviert, " + plan.bleibt.length + " bleiben",
      erg.archiviert === plan.archiv.length && erg.bleibt === plan.bleibt.length && plan.archiv.length === 5);
    pruefe("Zeilenenden bleiben" + tag, crlf ? !/[^\r]\n/.test(nachB) && !/[^\r]\n/.test(nachA) : !nachB.includes("\r") && !nachA.includes("\r"));
    const nz = ALARME.zerlege(nachB.replace(/\r\n/g, "\n").split("\n"));
    const sofort = nz.sections.find((s) => s.title === "Sofort");
    const titelSofort = nz.lines.slice(sofort.start, sofort.end).filter((l) => l.startsWith("### ")).map((l) => l.slice(4));
    pruefe("Sofort enthaelt danach nur Bleibendes" + tag, JSON.stringify(titelSofort.sort()) === JSON.stringify(["Fremde Spielverbindung abgewiesen", "Handpunkt: tor.js blind", "Schub verweigert (3 nicht in master) - Fehlgriff?"].sort()), titelSofort.join(" | "));
    pruefe("Regelkopf und alle anderen Abschnitte unveraendert" + tag,
      nachB.replace(/\r\n/g, "\n").split("\n").slice(0, 6).join("\n") === vorB.replace(/\r\n/g, "\n").split("\n").slice(0, 6).join("\n")
      && nachB.includes("## Offen, nach Dringlichkeit") && nachB.includes("### Ein offener Punkt") && nachB.includes("## Erledigt"));
    pruefe("Archiv: Kopf und alter Bestand bleiben, 5 neue oben mit Grund" + tag,
      nachA.startsWith(archivStand.slice(0, 5).join(crlf ? "\r\n" : "\n")) && nachA.includes("### Schon archiviert")
      && (nachA.match(/Archiviert 2026-11-14T03:00:00.000Z von tools\/alarme.js/g) || []).length === 5
      && nachA.indexOf("Telemetrie veraltet") < nachA.indexOf("Schon archiviert"));
    pruefe("Sicherungskopie der Liste liegt vor" + tag, fs.readdirSync(path.join(daten, "alarme-bereinigung")).length === 1
      && fs.readFileSync(path.join(daten, "alarme-bereinigung", fs.readdirSync(path.join(daten, "alarme-bereinigung"))[0]), "utf8") === vorB);
    const liste = (await AL.lade(path.join(daten, "alarme.json"))).liste;
    pruefe("alarme.json: die zwei Schutzalarme stehen offen, mit Sofort-Titel" + tag,
      liste.alarme.length === 2 && liste.alarme.every((a) => a.klasse === "schutz" && a.status === "offen" && a.sofortTitel));
    // zweiter Lauf = No-op
    const plan2 = ALARME.plane(ALARME.zerlege(lese(w, "BAUSTELLEN.md").replace(/\r\n/g, "\n").split("\n")), { jetzt: JETZT });
    pruefe("zweiter Lauf: nichts mehr zu archivieren" + tag, plan2.archiv.length === 0);
  }

  // Alles abgeraeumt -> "keine"
  {
    const w = neuerOrdner("leer");
    fs.mkdirSync(path.join(w, "nodes"));
    const s = [...KOPF, "## Sofort", "", ...eintrag("ERLEDIGT x: a"), ...eintrag("UEBERHOLT y: b"), "## Offen", "", "## Erledigt", "", "keine", ""];
    fs.writeFileSync(path.join(w, "nodes", "BAUSTELLEN.md"), s.join("\n"));
    fs.writeFileSync(path.join(w, "nodes", "ERLEDIGT.md"), archivStand.join("\n"));
    const plan = ALARME.plane(ALARME.zerlege(s), { jetzt: JETZT });
    await ALARME.fuehreAus(plan, { baustellen: path.join(w, "nodes", "BAUSTELLEN.md"), archiv: path.join(w, "nodes", "ERLEDIGT.md"), datenOrdner: path.join(w, "data"), jetzt: JETZT });
    pruefe("leerer Abschnitt steht danach als 'keine' (wie liste.js --sofort-leeren)",
      /## Sofort\n\nkeine\n\n## Offen/.test(fs.readFileSync(path.join(w, "nodes", "BAUSTELLEN.md"), "utf8")));
  }

  // Gegen die ECHTE Liste dieses Worktrees, auf einer Kopie
  {
    const echtB = path.join(ROOT, "nodes", "BAUSTELLEN.md");
    const echtA = path.join(ROOT, "nodes", "ERLEDIGT.md");
    if (fs.existsSync(echtB) && fs.existsSync(echtA)) {
      const w = neuerOrdner("echt");
      fs.mkdirSync(path.join(w, "nodes"));
      fs.copyFileSync(echtB, path.join(w, "nodes", "BAUSTELLEN.md"));
      fs.copyFileSync(echtA, path.join(w, "nodes", "ERLEDIGT.md"));
      const vorB = fs.readFileSync(path.join(w, "nodes", "BAUSTELLEN.md"), "utf8");
      const vorA = fs.readFileSync(path.join(w, "nodes", "ERLEDIGT.md"), "utf8");
      const zv = ALARME.zerlege(vorB.replace(/\r\n/g, "\n").split("\n"));
      const plan = ALARME.plane(zv, { jetzt: JETZT });
      const sofortV = zv.sections.find((s) => s.title.startsWith("Sofort"));
      const sofortZeilenVor = sofortV.end - sofortV.start;
      await ALARME.fuehreAus(plan, { baustellen: path.join(w, "nodes", "BAUSTELLEN.md"), archiv: path.join(w, "nodes", "ERLEDIGT.md"), datenOrdner: path.join(w, "data"), jetzt: JETZT });
      const nachB = fs.readFileSync(path.join(w, "nodes", "BAUSTELLEN.md"), "utf8").replace(/\r\n/g, "\n");
      const nachA = fs.readFileSync(path.join(w, "nodes", "ERLEDIGT.md"), "utf8").replace(/\r\n/g, "\n");
      const zn = ALARME.zerlege(nachB.split("\n"));
      const sofortN = zn.sections.find((s) => s.title.startsWith("Sofort"));
      pruefe("echte Liste (Kopie): Regelkopf unveraendert", zn.lines.slice(0, zn.headEnd + 1).join("\n") === zv.lines.slice(0, zv.headEnd + 1).join("\n"));
      pruefe("echte Liste (Kopie): Abschnitte ab '## Offen' Byte fuer Byte unveraendert",
        zn.lines.slice(sofortN.end).join("\n") === zv.lines.slice(sofortV.end).join("\n"));
      pruefe("echte Liste (Kopie): Sofort schrumpft (" + sofortZeilenVor + " -> " + (sofortN.end - sofortN.start) + " Zeilen), Handpunkte bleiben",
        sofortN.end - sofortN.start < sofortZeilenVor && plan.bleibt.every((b) => nachB.includes("### " + b.titel)));
      pruefe("echte Liste (Kopie): jeder archivierte Punkt steht im Archiv UND nicht mehr in der Liste",
        plan.archiv.every((x) => nachA.includes("### " + x.item.titel) && !nachB.includes("### " + x.item.titel)));
      pruefe("echte Liste (Kopie): Archiv behaelt seinen alten Bestand (Rest nach den neuen Eintraegen identisch)",
        nachA.endsWith(vorA.replace(/\r\n/g, "\n").split("\n").slice(ALARME.zerlege(vorA.replace(/\r\n/g, "\n").split("\n")).headEnd + 1).join("\n")));
    } else {
      console.log("  (echte Liste nicht im Worktree - Teil uebersprungen)");
    }
  }

  // Kommandozeile
  {
    const w = baue(false);
    const daten = path.join(w, "data");
    const lauf = (args) => new Promise((res) => {
      const p = spawn(process.execPath, [path.join(ROOT, "tools", "alarme.js"), "--wurzel", w, "--data", daten, ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      let t = ""; p.stdout.on("data", (d) => { t += d; }); p.stderr.on("data", (d) => { t += d; });
      p.on("exit", (code) => res({ code, text: t }));
    });
    const vorher = lese(w, "BAUSTELLEN.md");
    const trocken = await lauf(["--bereinigen", "--jetzt", "2026-11-14T03:00:00.000Z"]);
    pruefe("CLI --bereinigen ohne --ausfuehren: Trockenlauf, schreibt NICHTS", trocken.code === 0 && /TROCKENLAUF/.test(trocken.text) && lese(w, "BAUSTELLEN.md") === vorher && !fs.existsSync(daten));
    const ausf = await lauf(["--bereinigen", "--ausfuehren", "--jetzt", "2026-11-14T03:00:00.000Z"]);
    pruefe("CLI --bereinigen --ausfuehren schreibt", ausf.code === 0 && lese(w, "BAUSTELLEN.md") !== vorher && fs.existsSync(path.join(daten, "alarme.json")), ausf.text.slice(-200));
    const zeige = await lauf(["--zeige"]);
    pruefe("CLI --zeige nennt die offenen Alarme", zeige.code === 0 && /Offene Alarme \(2\)/.test(zeige.text), zeige.text.slice(0, 200));
    const ohne = await lauf(["--beende", "socket#" + "x"]);
    pruefe("CLI --beende mit unbekanntem Alarm: Fehler", ohne.code === 1);
    const liste = (await AL.lade(path.join(daten, "alarme.json"))).liste;
    const sid = liste.alarme.find((a) => a.schluessel === "socket").id;
    const ohneBeleg = await lauf(["--beende", sid]);
    pruefe("CLI --beende Schutzalarm OHNE Beleg: verweigert, Alarm bleibt offen", ohneBeleg.code === 1 && /Beleg/.test(ohneBeleg.text)
      && (await AL.lade(path.join(daten, "alarme.json"))).liste.alarme.find((a) => a.id === sid).status === "offen");
    const mitBeleg = await lauf(["--beende", sid, "--beleg", "Verifiziert: abc BN1 L1, 03:10"]);
    pruefe("CLI --beende mit Beleg: beendet", mitBeleg.code === 0 && (await AL.lade(path.join(daten, "alarme.json"))).liste.alarme.find((a) => a.id === sid).status === "beendet");
    const duenn = await lauf(["--bereinigen", "--messung", "socket-verifiziert=ok"]);
    pruefe("CLI --messung mit dünnem Beleg verweigert".replace("dünnem", "duennem"), duenn.code === 1 && /Beleg zu duenn/.test(duenn.text));
  }
}

// ===========================================================================
console.log("");
console.log("-- C. Neustartgrenze und bridge-start.cmd --");
{
  const J = 1e12;
  let r = GRENZE.entscheide([], J, 3, 60);
  pruefe("erster Neustart erlaubt und gezaehlt", r.erlaubt && r.zeiten.length === 1);
  r = GRENZE.entscheide([J - 1000, J - 2000, J - 3000], J, 3, 60);
  pruefe("vierter Neustart in einer Stunde (Grenze 3): verweigert, NICHT mitgezaehlt", !r.erlaubt && r.zeiten.length === 3);
  r = GRENZE.entscheide([J - 61 * 60000, J - 62 * 60000, J - 1000], J, 3, 60);
  pruefe("Neustarts aelter als das Fenster zaehlen nicht", r.erlaubt && r.zeiten.length === 2);
  r = GRENZE.entscheide([J + 5000, J + 6000, J + 7000], J, 3, 60);
  pruefe("Zeitpunkte aus der Zukunft (Uhr zurueckgestellt) zaehlen mit: im Zweifel gegen den Neustart", !r.erlaubt);
  r = GRENZE.entscheide(["x", NaN, null], J, 1, 60);
  pruefe("Muell in der Zeitenliste wird ignoriert, nicht gezaehlt", r.erlaubt);

  const dir = neuerOrdner("grenze");
  const cli = (args, jetzt) => GRENZE.main(["--data", dir, ...args], jetzt);
  cli(["--start"], J);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push(cli(["--max", "5"], J + i * 1000));
  pruefe("Schleife: 5 Neustarts erlaubt, der 6. in derselben Stunde = Exit 4", codes.slice(0, 5).every((c) => c === 0) && codes[5] === GRENZE.EXIT_GRENZE, codes.join(","));
  pruefe("Stoppdatei sagt, dass die Bruecke AUS ist", /Bruecke ist AUS/.test(fs.readFileSync(path.join(dir, "bridge-start-gestoppt.txt"), "utf8")));
  pruefe("ein 7. Versuch bleibt verweigert (abgelehnte zaehlen nicht, die fruehen laufen aber noch)", cli(["--max", "5"], J + 7000) === GRENZE.EXIT_GRENZE);
  pruefe("eine Stunde spaeter geht es wieder", cli(["--max", "5"], J + 61 * 60000 + 6000) === 0);
  cli(["--start"], J + 2 * H);
  pruefe("--start leert Zaehler und Stoppdatei", !fs.existsSync(path.join(dir, "bridge-start-gestoppt.txt")) && GRENZE.leseZeiten(path.join(dir, "bridge-start-zeiten.txt")).length === 0);
  pruefe("Aufruf ohne Argumente: Fehler (kein Freibrief)", wirft(() => cli([], J)) !== null);
  pruefe("--max 0 / --max abc: Fehler", wirft(() => cli(["--max", "0"], J)) !== null && wirft(() => cli(["--max", "abc"], J)) !== null);
  fs.writeFileSync(path.join(dir, "bridge-start-zeiten.txt"), "");
  fs.rmSync(path.join(dir, "bridge-start-zeiten.txt"));
  fs.mkdirSync(path.join(dir, "bridge-start-zeiten.txt"));
  const proc = await new Promise((res) => {
    const p = spawn(process.execPath, [path.join(ROOT, "sync", "neustart-grenze.js"), "--data", dir, "--max", "5"], { stdio: ["ignore", "pipe", "pipe"] });
    p.on("exit", (c) => res(c));
  });
  pruefe("Zaehler nicht lesbar (Pfad ist ein Ordner): Exit != 0 - die Schleife steht, sie laeuft nicht ungezaehlt weiter", proc !== 0, "exit " + proc);
  const logd = path.join(dir, "bridge-start.log");
  for (let i = 0; i < 4000; i++) GRENZE.schreibeLog(logd, "Zeile " + i + " " + "x".repeat(60), J);
  pruefe("Log wird auf " + GRENZE.LOG_MAX_BYTES / 1000 + " kB begrenzt und bleibt zeilenweise lesbar",
    fs.statSync(logd).size <= GRENZE.LOG_MAX_BYTES && fs.readFileSync(logd, "utf8").split("\n").filter(Boolean).every((z) => /^\d{4}-\d\d-\d\dT[\d:.]+Z\t/.test(z)));

  // Die .cmd: nur lesen, nie ausfuehren
  const cmdPfad = path.join(ROOT, "sync", "bridge-start.cmd");
  const cmd = fs.readFileSync(cmdPfad, "utf8");
  const zeilen = cmd.split("\r\n");
  pruefe("bridge-start.cmd: CRLF durchgehend (LF-only bricht goto :label)", !/[^\r]\n/.test(cmd) && zeilen.length > 40);
  pruefe("bridge-start.cmd: nur ASCII", /^[\x00-\x7f]*$/.test(cmd));
  const marken = new Set(zeilen.filter((z) => /^:\w+/.test(z)).map((z) => z.slice(1).trim().toLowerCase()));
  const sprung = zeilen.flatMap((z) => { const m = z.match(/goto :(\w+)/ig); return m ? m.map((x) => x.split(":")[1].toLowerCase()) : []; });
  pruefe("bridge-start.cmd: jedes goto hat sein Ziel (" + [...new Set(sprung)].join(",") + ")", sprung.length >= 5 && sprung.every((s) => marken.has(s)));
  pruefe("bridge-start.cmd: Neustart nur NACH der Grenzpruefung (Aufruf --max steht vor dem ping/goto :schleife)",
    cmd.indexOf("neustart-grenze.js --max") > 0 && cmd.indexOf("neustart-grenze.js --max") < cmd.indexOf("goto :schleife"));
  pruefe("bridge-start.cmd: Exit 2 und 3 beenden die Schleife (kein Neuversuch)", /if "%RC%"=="2" goto :portbelegt/.test(cmd) && /if "%RC%"=="3" goto :startfehler/.test(cmd));
  pruefe("bridge-start.cmd: Wartezeit per ping, nicht timeout (WMI-Start hat keine Konsole)", /ping -n \d+ 127\.0\.0\.1/.test(cmd) && !/^\s*timeout\b/im.test(cmd));
  pruefe("bridge-start.cmd: Grenzfehler (Exit != 0) fuehrt zu :grenze, nicht zum Weiterlaufen", /if not "%ERRORLEVEL%"=="0" goto :grenze/.test(cmd));
  pruefe("bridge-start.cmd: startet LIVE und nichts anderes", /node sync\\bridge\.js --instance LIVE/.test(cmd) && (cmd.match(/bridge\.js/g) || []).filter((x) => x).length >= 1);
  pruefe("bridge-start.cmd: KEIN Autostart-Eintrag (kein schtasks, keine Startup-Verknuepfung, keine Registry)", !/^(?!\s*REM).*(schtasks|\\Startup\\|reg add|HKCU|HKLM)/im.test(cmd));
  pruefe("bridge-start.cmd: Standard 5 je Stunde, ueberschreibbar", /if "%BRIDGE_START_MAX%"=="" set BRIDGE_START_MAX=5/.test(cmd));
}

// ===========================================================================
console.log("");
console.log("-- D. sync/bridge.js: Haken --");
{
  const q = fs.readFileSync(path.join(ROOT, "sync", "bridge.js"), "utf8").replace(/\r\n/g, "\n");
  const anz = (re) => (q.match(re) || []).length;
  pruefe("bridge.js importiert die Alarmliste", /import \* as AL from "\.\/alarmliste\.js";/.test(q));
  for (const m of ["sicherung-gruen", "socket-verifiziert", "verbindung-mit-anker", "schub-ok", "master-index-ok", "tab-verbunden", "telemetrie-frisch", "autosave-frisch", "zweittab-frei"]) {
    pruefe("Messung '" + m + "' wird irgendwo gemessen", anz(new RegExp('alarmMessung\\("' + m + '"')) >= 1);
  }
  pruefe("jede Messung, auf die eine Regel wartet, hat einen Haken in der Bruecke",
    [...new Set(AL.REGELN.map((r) => r.messung).filter(Boolean))].every((m) => q.includes('alarmMessung("' + m + '"')));
  pruefe("alarm() meldet in die Liste", /async function alarm\([^)]*\) \{[\s\S]*?alarmMelde\(titel, text, quelle\)/.test(q));
  pruefe("sofortZeile fragt die Liste, bevor es in ## Sofort schreibt", /async function sofortZeile[\s\S]*?alarmMelde\(titel, text, quelle\)[\s\S]*?if \(!r\.neu && r\.eintrag\.sofortTitel && \(!IST_LIVE \|\| sofortSteht\(r\.eintrag\.sofortTitel\)\)\) return;/.test(q));
  // Skeptiker 14.11.2026: eine auf dem normalen Weg abgehakte Meldung wird bei Wiederholung neu eingetragen.
  pruefe("sofortSteht prueft ## Sofort der Arbeitsliste (abgehakt = neu eintragen)", /function sofortSteht\(titel\)[\s\S]*?BAUSTELLEN\.md[\s\S]*?catch \{\s*return true;/.test(q));
  pruefe("sofortErledigen sucht nur im Abschnitt sofort (liste.js --abschnitt)", q.includes('"--abschnitt", "sofort"'));
  {
    const k1 = AL.klassifiziere("Zweite RFA-Verbindung - alte stumm");
    const k2 = AL.klassifiziere("Zweite RFA-Verbindung");
    pruefe("Zweite Verbindung bei stummer alter: Vorfall mit Ablauf, keine Messung 'zweittab-frei' (Reconnect-Verdacht verschwindet nicht binnen einer Minute)",
      k1.klasse === "vorfall" && k1.messung === null && k1.ablaufMs > 0 && k2.klasse === "schutz" && k2.messung === "zweittab-frei");
    const k3 = AL.klassifiziere("Sicherung vor Codeschub fehlgeschlagen");
    pruefe("'Sicherung vor Codeschub fehlgeschlagen' endet durch 'schub-ok', nicht durch irgendeine gruene Sicherung", k3.klasse === "schutz" && k3.messung === "schub-ok");
    pruefe("verweigerte Schub-Sicherung legt den Stapel in den Rueckstau (zurueckgestellt + SCHUB_OFFEN)",
      /const ok = await sichereJetzt\("pre-hotswap"\);\s*if \(!ok\) \{[\s\S]{0,700}zurueckgestellt\.add\(d\);\s*await schreibeSchubOffen\(stapel\);/.test(q));
  }
  pruefe("Messung steht in sichereJetzt NACH dem Aufheben des Sicherungsalarms und wirft nie nach aussen",
    q.indexOf('alarmMessung("sicherung-gruen"') > q.indexOf('state.alarm.quelle === "sicherung"') && /async function alarmMessung[\s\S]*?try \{[\s\S]*?catch \(err\)/.test(q));
  pruefe("Alarmpflege (Ablauf) laeuft im Urteilstakt", /async function faelleUrteile\(\) \{\s*const jetzt = Date\.now\(\);[\s\S]*?alarmPflege\(jetzt\)/.test(q));
  pruefe("Schutzalarme: alarmVerfall ruft nur AL.verfalle (das Schutz ausnimmt)", /AL\.verfalle\(liste, Date\.now\(\)\)/.test(q));
  pruefe("gemessenes Ende setzt die Sechs-Stunden-Bremse der Urteile zurueck (Wiederholung = neuer Vorfall)",
    /startsWith\("messung:"\)[\s\S]{0,400}letztesUrteil\.nichtVerbunden = 0[\s\S]{0,120}letztesUrteil\.eingefroren = 0[\s\S]{0,120}letztesUrteil\.autosave = 0/.test(q));
  pruefe("Dashboard-Zustand nennt die offenen Alarme",/alarme: alarmListe \? AL\.uebersicht\(alarmListe\) : \[\],/.test(q));
}

// ===========================================================================
if (OHNE_BRUECKE) {
  console.log("");
  console.log("-- E. Bruecke uebersprungen (--ohne-bruecke) --");
} else {
  console.log("");
  console.log("-- E. Die Bruecke (MOCK) mit der Alarmliste --");
  const { WebSocket } = await import("ws");
  const freierPort = () => new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
  });
  const starteBruecke = (args) => {
    const proc = spawn(process.execPath, [path.join(ROOT, "sync", "bridge.js"), ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    prozesse.push(proc);
    const zeilen = [];
    const sammle = (d) => { for (const z of String(d).split("\n")) if (z.trim()) zeilen.push(z.trim()); };
    proc.stdout.on("data", sammle);
    proc.stderr.on("data", sammle);
    const exit = new Promise((res) => { proc.on("exit", (c) => res(c)); proc.on("error", () => res(-1)); });
    return { proc, zeilen, exit };
  };
  const zaehle = (b, re) => b.zeilen.filter((z) => re.test(z)).length;
  async function warteAufMehr(b, re, vorher, msMax = 30000) {
    const bis = Date.now() + msMax;
    while (Date.now() < bis) { if (zaehle(b, re) > vorher) return true; await schlaf(100); }
    return false;
  }
  async function warteBis(f, msMax) {
    const bis = Date.now() + msMax;
    while (Date.now() < bis) { if (f()) return true; await schlaf(150); }
    return f();
  }
  const baueSave = ({ identifier, playtime, port }) => {
    const p = {
      identifier, bitNodeN: 1, sourceFiles: { ctor: "JSONMap", data: [] }, skills: { hacking: 100 }, money: 1e6,
      totalPlaytime: playtime, playtimeSinceLastBitnode: playtime / 2, playtimeSinceLastAug: playtime / 4,
      lastSave: Date.now(), augmentations: [], queuedAugmentations: [], sleeves: [], city: "Sector-12", factions: [], bladeburner: null,
    };
    const st = { RemoteFileApiPort: port, AutosaveInterval: 60, ExcludeRunningScriptsFromSave: false, AutoexecScript: "boot.js" };
    const save = { ctor: "BitburnerSaveObject", data: { PlayerSave: JSON.stringify({ ctor: "PlayerObject", data: p }), SettingsSave: JSON.stringify(st), AllServersSave: "{}" } };
    return zlib.gzipSync(Buffer.from(JSON.stringify(save), "utf8"));
  };
  function starteSpiel(rfaPort, saveBuf) {
    const ws = new WebSocket("ws://127.0.0.1:" + rfaPort);
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      const antwort = (result) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
      if (m.method === "getSaveFile") return antwort({ save: saveBuf.toString("latin1"), binary: true, identifier: "x" });
      if (m.method === "getFileMetadata") return antwort({ filename: m.params.filename, ramUsage: 1 });
      if (m.method === "getAllFiles" || m.method === "getFileNames") return antwort([]);
      if (m.method === "getFile") return ws.send(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: "not found" }));
      if (m.method === "getDefinitionFile") return antwort("");
      return antwort("OK");
    });
    ws.on("error", () => {});
    return { schliessen: () => { try { ws.close(); } catch { /* egal */ } } };
  }

  const MIN = 60000;
  const ID = (Date.now().toString(16) + process.pid.toString(16)).slice(-14);
  const FREMD = "ffffffffffffff";
  const tmp = neuerOrdner("bruecke");
  const idDatei = path.join(tmp, "identitaet.json");
  fs.writeFileSync(idDatei, JSON.stringify({ format: 1, epoche: "lauf2", identifier: ID, anker: { totalPlaytime: 4 * MIN } }));
  const srcDir = path.join(tmp, "src");
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, "probe.js"), "export async function main(ns) {}\n");
  const liste = path.join(tmp, "master.txt");
  fs.writeFileSync(liste, "probe.js\n");
  const dataRel = path.join("pruefstand", "t-alarme-" + process.pid);
  const dataAbs = path.join(ROOT, dataRel);
  fs.mkdirSync(dataAbs, { recursive: true });
  tempOrdner.push(dataAbs);
  const mockAblage = path.join(ROOT, "pruefstand", "mock-backups");
  const alarmDatei = path.join(dataAbs, "alarme.json");
  const lies = () => { try { return JSON.parse(fs.readFileSync(alarmDatei, "utf8")); } catch { return null; } };
  const offene = () => (lies() ? lies().alarme.filter((a) => a.status === "offen") : []);

  // Vorgefundener Zustand (wie nach einem Neustart): ein offener Schutzalarm
  // "socket", ein Zustandsalarm "tab" mit abgelaufenem Ablauf, ein
  // abgelaufener Vorfall "base64", ein Schutzalarm "ausgang" (nur von Hand).
  const alt = AL.leereListe();
  const vorzeit = Date.now() - 10 * 24 * H;
  AL.melde(alt, { titel: "Fremde Spielverbindung abgewiesen", text: "vorher" }, vorzeit);
  AL.melde(alt, { titel: "Spielstand kam als Base64-Klartext", text: "vorher" }, vorzeit);
  AL.melde(alt, { titel: "Ausgang blockiert - exit.js passt auf keinen Rechner", text: "vorher" }, vorzeit);
  AL.melde(alt, { titel: "Telemetrie veraltet", text: "vorher" }, vorzeit);
  fs.writeFileSync(alarmDatei, JSON.stringify(alt));

  const rfa = await freierPort();
  const dash = await freierPort();
  const args = ["--instance", "MOCK", "--rfa-port", String(rfa), "--dash-port", String(dash), "--no-watch",
    "--data-dir", dataRel, "--src-dir", srcDir, "--master-liste", liste, "--identitaet", idDatei];
  let b = starteBruecke(args);
  await warteAufMehr(b, /Identitaet: Epoche lauf2/, 0, 15000);

  // 1. Ein fremdes Spiel: Alarm wird gefuehrt UND gezaehlt (der vorhandene, nicht ein neuer)
  let s = starteSpiel(rfa, baueSave({ identifier: FREMD, playtime: 10 * MIN, port: rfa }));
  pruefe("fremdes Spiel abgewiesen", await warteAufMehr(b, /Socket abgewiesen/, 0, 20000), b.zeilen.slice(-3).join(" | "));
  await warteBis(() => offene().some((a) => a.schluessel === "socket" && a.anzahl >= 2), 5000);
  const sock = offene().find((a) => a.schluessel === "socket");
  pruefe("der beim Start GELADENE Alarm 'socket' wurde weitergezaehlt (Zustand ueberlebt den Neustart)", !!sock && sock.seit === Math.floor(vorzeit) && sock.anzahl >= 2, JSON.stringify(sock));
  pruefe("  Klasse Schutz, ohne Ablaufdatum, Messung socket-verifiziert", sock && sock.klasse === "schutz" && sock.ablaufAm === null && sock.messung === "socket-verifiziert");
  const sofortTest = path.join(dataAbs, "sofort-test.md");
  const eintraege = () => (fs.existsSync(sofortTest) ? (fs.readFileSync(sofortTest, "utf8").match(/^### Fremde Spielverbindung abgewiesen/gm) || []).length : 0);
  pruefe("  'Fremde Spielverbindung abgewiesen' steht genau EINMAL in der Meldedatei", eintraege() === 1, "n=" + eintraege());
  s.schliessen();
  await warteAufMehr(b, /getrennt/i, 0, 15000);
  s = starteSpiel(rfa, baueSave({ identifier: FREMD, playtime: 11 * MIN, port: rfa }));
  await warteAufMehr(b, /Socket abgewiesen/, 1, 20000);
  await schlaf(600);
  pruefe("  ein zweiter Vorfall derselben Ursache wird gezaehlt, aber nicht erneut eingetragen", eintraege() === 1 && (offene().find((a) => a.schluessel === "socket") || {}).anzahl >= 3,
    "n=" + eintraege() + " anzahl=" + (offene().find((a) => a.schluessel === "socket") || {}).anzahl);
  s.schliessen();
  await warteAufMehr(b, /getrennt/i, 1, 15000);
  pruefe("  das Dashboard-Feld/bridge-alarm.json trug den Einzelplatz (alter Weg unveraendert)", fs.existsSync(path.join(dataAbs, "bridge-alarm.json")));

  // 2. Das richtige Spiel: die Messung beendet den Schutzalarm
  const vorVer = zaehle(b, /Verifiziert in/);
  s = starteSpiel(rfa, baueSave({ identifier: ID, playtime: 5 * MIN, port: rfa }));
  pruefe("richtiges Spiel verifiziert", await warteAufMehr(b, /Verifiziert in/, vorVer, 20000), b.zeilen.slice(-3).join(" | "));
  const beendet = await warteBis(() => { const l = lies(); return l && l.alarme.some((a) => a.schluessel === "socket" && a.status === "beendet"); }, 8000);
  const sockEnde = lies().alarme.find((a) => a.schluessel === "socket");
  pruefe("Messung 'socket-verifiziert' beendet den Schutzalarm, mit Beleg", beendet && sockEnde.beendetDurch === "messung:socket-verifiziert" && /Verifiziert: /.test(sockEnde.beleg), JSON.stringify(sockEnde));
  pruefe("  und der Einzelplatz state.alarm ist mit weg (bridge-alarm.json)", await warteBis(() => !fs.existsSync(path.join(dataAbs, "bridge-alarm.json")), 5000));
  pruefe("  im Protokoll steht 'Alarm beendet'", b.zeilen.some((z) => /Alarm beendet \(.*abgewiesen/.test(z)));

  // 3. Urteilstakt (60 s): Ablauf, Messung tab-verbunden, Schutz bleibt
  console.log("        (warte auf den Urteilstakt der Bruecke, bis ~70 s)");
  const takt = await warteBis(() => { const l = lies(); return l && l.alarme.some((a) => a.schluessel === "base64" && a.status === "beendet"); }, 75000);
  const l3 = lies();
  const f = (k) => l3.alarme.find((a) => a.schluessel === k);
  pruefe("Urteilstakt: abgelaufener Vorfall (10 Tage, Ablauf 72 h) ist beendet durch 'ablauf'", takt && f("base64").beendetDurch === "ablauf", JSON.stringify(f("base64")));
  pruefe("Urteilstakt: Zustandsalarm 'Telemetrie veraltet' beendet (Ablauf oder Messung)", f("telemetrie").status === "beendet", JSON.stringify(f("telemetrie")));
  pruefe("Urteilstakt: Schutzalarm 'ausgang' (10 Tage alt, keine Messung) steht NOCH offen - Zeit allein beendet ihn nie",
    f("ausgang").status === "offen" && f("ausgang").ablaufAm === null);

  // 4. Neustart der Bruecke: offene Alarme bleiben offen
  s.schliessen();
  b.proc.kill();
  await b.exit;
  b = starteBruecke(args);
  await warteAufMehr(b, /Identitaet: Epoche lauf2/, 0, 15000);
  await schlaf(1500);
  const l4 = lies();
  pruefe("nach dem Bruecken-Neustart: 'ausgang' offen, beendete bleiben beendet, nichts verloren",
    l4.alarme.find((a) => a.schluessel === "ausgang").status === "offen" && l4.alarme.find((a) => a.schluessel === "socket").status === "beendet" && l4.alarme.length === l3.alarme.length);
  b.proc.kill();
  await b.exit;

  // 5. Kaputte alarme.json: wird beiseitegelegt, Bruecke laeuft weiter
  fs.writeFileSync(alarmDatei, "{halb");
  b = starteBruecke(args);
  await warteAufMehr(b, /Identitaet: Epoche lauf2/, 0, 15000);
  const s5 = starteSpiel(rfa, baueSave({ identifier: FREMD, playtime: 12 * MIN, port: rfa }));
  await warteAufMehr(b, /Socket abgewiesen/, 0, 20000);
  const ok5 = await warteBis(() => fs.readdirSync(dataAbs).some((x) => x.startsWith("alarme.json.kaputt-")), 5000);
  pruefe("kaputte alarme.json: Original beiseitegelegt, Meldung im Protokoll, Bruecke laeuft weiter",
    ok5 && b.zeilen.some((z) => /alarme\.json .*beiseitegelegt/.test(z)) && b.proc.exitCode === null);
  s5.schliessen();
  b.proc.kill();
  await b.exit;

  // Eigene Sicherungen dieses Laufs wegraeumen.
  for (const fn of fs.readdirSync(mockAblage).filter((x) => x.startsWith("MOCK_" + ID + "_"))) {
    try { fs.rmSync(path.join(mockAblage, fn)); } catch { /* egal */ }
  }
  // Die Indexzeilen dieses Laufs bleiben stehen (wie bei test-lauf2-uebergabe.js):
  // der Index ist geteilt, ein Umschreiben koennte gleichzeitige Anhaenge anderer
  // Laeufe verlieren. Sie tragen den Laufpraefix und Spielzeiten von Minuten.
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
raeumeAuf();
process.exitCode = rot ? 1 : 0;
