/**
 * Ebene 0 am Stueck. Stufe A der Abnahme verlangt von diesem Aufruf Exit 0.
 *
 * Alle Tests laufen OHNE Spiel und ohne Bruecke. Das ist Absicht: ein
 * Testgeschirr, das eine laufende Umgebung braucht, wird genau dann nicht
 * gefahren, wenn die Umgebung kaputt ist.
 *
 * Aufruf:
 *   node tools/test-alles.js           alle
 *   node tools/test-alles.js --schnell nur die, die unter einer Sekunde brauchen
 */

import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

/**
 * Je Eintrag: Datei, worum es geht, und ob der Test schnell ist.
 * Ein Test, der hier fehlt, wird nicht gefahren - deshalb steht bei jedem, was
 * er abdeckt, damit eine Luecke beim Lesen auffaellt.
 */
const TESTS = [
  {
    datei: "test-backup.js",
    deckt: "Sicherungskette: Format, Kennwerte, jeder Ablehnungsgrund, Rotation",
    schnell: true,
  },
  {
    datei: "test-verbote.js",
    // --bau: gegen den Worktree pruefen, solange dort gebaut wird. Ein
    // Befund, der erst nach dem Einspielen kommt, kommt zu spaet.
    args: ["--bau"],
    deckt: "Verbotsgrep und Selbstblockade-Muster, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-route.js",
    deckt: "planeRoute ueber alle Routeneintraege",
    schnell: true,
  },
  {
    datei: "test-stillstandsuhr.js",
    deckt: "Stillstandsuhr des Motors",
    schnell: true,
  },
  {
    datei: "test-motorzeit.js",
    deckt: "Motorzeit gegen Drosselung, Offline-Nacht und Nachholklumpen",
    schnell: true,
  },
  {
    datei: "test-kontrakte.js",
    deckt: "Herzschlag v2, kpi.json-Feldliste und Ereignisstrom (C.1)",
    schnell: true,
  },
  {
    datei: "test-syntax.js",
    deckt: "Ebene -1: jede Datei in src/ parst (acorn aus der Referenzkopie)",
    schnell: true,
  },
  {
    datei: "test-scope-tot.js",
    deckt: "Ebene -1: kein Name in src/ ausserhalb seines Scopes (toter Aufruf im try/catch, Befund 03.10.), mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-ram.js",
    deckt: "RAM-Rechner gegen 114 Live-Messwerte, registry.json und das Tor E1",
    schnell: true,
  },
  {
    datei: "test-ram-namen.js",
    deckt: "Namenspruefer gegen die wakelock-Fehlerklasse, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-zielvalidierung.js",
    deckt: "Zielpruefung vor dem Sprung gegen die echte route.json (C.3)",
    schnell: true,
  },
  {
    datei: "test-kaltstart-budget.js",
    deckt: "passt der Kaltstart auf 32 GB - und findet eine Geldquelle Platz? (C.7/C.8)",
    schnell: true,
  },
  {
    datei: "test-registry.js",
    deckt: "Registry, Rollen-Riegel und der Migrationsbeweis gegen die heutige Liste (C.4)",
    schnell: true,
  },
  {
    datei: "test-graftwahl.js",
    deckt: "Graft-Auswahl: Vorzug, Puffer, Sprungnaehe, gegen den echten Plan (C.14)",
    schnell: true,
  },
  {
    datei: "test-figur.js",
    deckt: "Figur-Vergabepunkt: Lease, Rangfolge, Folgenummer, Knotenstempel (C.11)",
    schnell: true,
  },
  {
    datei: "test-joinrun-ebene2.js",
    deckt: "EBENE 2: joinrun.js gegen eine dauerhafte PRIO.faktion(30)-Konkurrenz - PRIO.beitritt (25) gewinnt und behaelt die Figur (C2-Blocker, Audit 3#6/6#4), auch ueber die 15-min-Lease hinaus (Integration 27.09.); ausserdem G-Ueberschiessen (eigenes Training stoppt aktiv am Ziel) und G2 (Stadt wird unter der Lease nachgezogen, kein Haemmern) (Audit-Nachmessung 27.09.)",
    schnell: true,
  },
  {
    datei: "test-ofen-raeumung.js",
    deckt: "EBENE 2: der Werkzeugstarter des Kerns raeumt auch den Erfahrungsofen (worker/expfarm.js), wenn ein Werkzeug Platz braucht (Integration 27.09.)",
    schnell: true,
  },
  {
    datei: "test-bn4life-beitritt.js",
    deckt: "EBENE 2: bn4life.js startet joinrun/netburn erst ab dem Gym-Geldboden - nach dem Sprung bleibt home fuer shop.js frei (Integration 27.09.); ausserdem G1 (Beitrittsmarke landet zuverlaessig auf home, auch von einem Fremdwirt aus, und ein laufendes joinrun.js mit Ziel 80 verhindert einen zweiten Start) (Audit-Nachmessung 27.09.)",
    schnell: true,
  },
  {
    datei: "test-leiter.js",
    deckt: "Strafleiter, Signale und die drei Waechteruhren, mit Uhren-Lint (C.6)",
    schnell: true,
  },
  {
    datei: "test-tor.js",
    deckt: "tor.js gegen praeparierte Spielstaende: Multiplikator, Verlauf, Gym-Rate",
    schnell: true,
  },
  {
    datei: "test-motor-ebene2.js",
    deckt: "EBENE 2: der echte Kern gegen den ns-Mock, drei Pflichtproben (C.1)",
    schnell: false,
  },
  {
    datei: "test-matrix-ebene2.js",
    deckt: "EBENE 2: Szenarienmatrix ueber alle 15 Knoten der Route",
    schnell: false,
  },
  {
    datei: "test-boerse.js",
    deckt: "Aktienhandel: Trendschaetzung, Kommission, Schliessung vor dem Sprung (C.15)",
    schnell: true,
  },
  {
    datei: "test-kern-c789.js",
    deckt: "EBENE 2: Platzreservierung, shop-Bedarfsbetrieb, Wirtsperren, BN9 (C.7-C.13)",
    schnell: false,
  },
  {
    datei: "test-kernwache.js",
    deckt: "EBENE 2: SELBST-Neustart des Kerns nur mit Wache, sonst verschieben; Lebenswache in guard.js",
    schnell: false,
  },
  {
    datei: "test-hacknet-ebene2.js",
    deckt: "EBENE 2: hacknet.js baut den Cache aus, wenn der Rangtausch nicht in den Speicher passt",
    schnell: false,
  },
  {
    datei: "test-kampfaugs.js",
    deckt: "EBENE 0: Kampfknoten kauft nur nuetzliche Augs; Namen gegen den Spielquelltext",
    schnell: true,
  },
  {
    datei: "test-v1kurve.js",
    deckt: "EBENE 0: V1-Referenzkurve - Offline-Fenster, Hoechststand, Restzeit fuer checkin",
    schnell: true,
  },
  {
    datei: "test-kein-wd-backdoor.js",
    deckt: "EBENE 0: nur exit.js beendet w0r1d_d43m0n - kein Backdoor-Skript schickt aufs BitVerse (F1)",
    schnell: true,
  },
  {
    datei: "test-sprosse5-kette.js",
    deckt: "EBENE 2: Waechter beauftragt, Kern startet punish.js - im Trockenlauf (C.12)",
    schnell: false,
  },
  {
    datei: "test-loeser-verify.js",
    deckt: "Die Gegenproben der 30 Vertragsloeser, gegen falsche Antworten (C4)",
    schnell: true,
  },
  {
    datei: "test-punish.js",
    deckt: "Sprosse 5: die acht Vorbedingungen und die beiden Deckel (C.12)",
    schnell: true,
  },
  {
    datei: "test-handschlag-nachhome.js",
    deckt: "EBENE 2: lib/handschlag.js setzt die Einbausperre per nachHome - erreicht home auch von der Werkbank aus (C.4)",
    schnell: true,
  },
  {
    datei: "test-graftauto-ebene2.js",
    deckt: "EBENE 2: Grafting-Automatik - Vorzug, Abbrucherkennung, Motorzeit-Quote (C.14)",
    schnell: false,
  },
  {
    datei: "test-blade-ebene2.js",
    deckt: "EBENE 2: das Traegergewerk fuer 30 der 40 Laeufe - Ausdauer, Chaos, Black-Op-Schwelle, Fertigkeiten, und das Tor 4 x 100 in bbtrain.js",
    schnell: false,
  },
  {
    datei: "test-hashes-ebene2.js",
    deckt: "EBENE 2: hashes.js - Marker ohne Server, Gym-Training im Anlauf, Rang in der Division, Deckelregel",
    schnell: true,
  },
  {
    datei: "test-sleeve-ebene2.js",
    deckt: "EBENE 2: der Geldboden der Koerper gegen den Nachholrueckstand (storedCycles) - und der Mock, der ihn nachbildet",
    schnell: false,
  },
  {
    datei: "test-sleeve-hackingweg.js",
    deckt: "EBENE 2: Sleeves im Hackingweg (V1) - Faktionsarbeit statt Shoplift, Mug/Shoplift wie Crime.ts gerechnet, BN8 ohne Verbrechensgeld, Schockerholung bis 65 stehenlassen, Rueckfall nie Leerlauf",
    schnell: false,
  },
  {
    datei: "test-bruecke.js",
    deckt: "EBENE 2: die Bruecke gegen ein nachgebautes Spiel - Rollentrennung, Wachhund, Sicherung vor pushAll, zweite Verbindung, belegter Port (Auftrag 6.1)",
    schnell: false,
  },
  {
    datei: "test-lader.js",
    deckt: "DER PRUEFSTAND SELBST: Importumschreibung, Heimatordner, keine Reste unter src/, zwei gleichzeitige Laeufe (R29)",
    schnell: false,
  },
  {
    datei: "test-guard-ebene2.js",
    deckt: "EBENE 2: der Waechter im Beobachtungsmodus, boot.js-Schonliste (C.6)",
    schnell: false,
  },
  {
    datei: "test-endspurt.js",
    deckt: "Ausgangs-Interlock und Endspurt-Regel, inkl. ns.read-Asymmetrie (C.3)",
    schnell: true,
  },
  {
    datei: "test-bn4rep-einbau.js",
    deckt: "lib/einbau.js: Fokus-Ruecknahme, BN12-Spendenformel, Daedalus-Schwelle,"
      + " Spendenrecht- und Red-Pill-Einbauzwang, Horizont-Unbezahlbarkeit,"
      + " Favor-Relevanz (Audit A1-A7), mit echten Spielstandzahlen und"
      + " echten Aug-Namen (Skeptiker-Nacharbeit)",
    schnell: true,
  },
  {
    datei: "test-bn4rep-ebene2.js",
    deckt: "EBENE 2: bn4rep.js-Hauptlauf gegen nachgebauten Spielzustand -"
      + " erste Runde nach Neustart (BN5.2 19:03), Handschlag/Interlock ohne"
      + " Prozessende und ohne NFG-Kauf, Fuellstueck nicht im Kampfknoten,"
      + " Fokus mit Karenz und NMI nur eingebaut (Skeptiker-Nacharbeit A)",
    schnell: true,
  },
  {
    datei: "test-reserve-eta.js",
    deckt: "Wirtreserve mit Verfall und Restzeit gegen Nachholklumpen (C.3)",
    schnell: true,
  },
  {
    datei: "test-analyse-eichung.js",
    deckt: "Eichung der ersetzten Analyse-Familie gegen den Spielquelltext (C.7)",
    schnell: true,
  },
  {
    datei: "test-formeln.js",
    deckt: "Die entscheidungstragenden Formeln gegen unabhaengige Eichpunkte",
    schnell: true,
  },
  {
    datei: "test-b1-security100.js",
    deckt: "B1 (Audit 26.09.2026 2#2): Server bei Sicherheit 100 bleiben fuer die Zielwahl sichtbar",
    schnell: true,
  },
  {
    datei: "test-b2-expfarm-dauerlaeufer.js",
    deckt: "EBENE 2: B2 (Audit 26.09.2026 2#1): Erfahrungsofen als Dauerlaeufer, Geldziele nicht verhungert",
    schnell: true,
  },
  {
    datei: "test-b3-darkweb-fokus.js",
    deckt: "EBENE 2: B3 (Audit 26.09.2026 6#1): darkweb.js nur ohne lebendiges bn4life",
    schnell: true,
  },
  {
    datei: "test-b6-bitnodes-tabelle.js",
    deckt: "B6 (Audit 26.09.2026 2#6/1#4): negative Literale und BN12-Stufen im Generator",
    schnell: true,
  },
  {
    datei: "test-b7-zielwahl-gegenpruefung.js",
    deckt: "EBENE 2: Gegenpruefung Skeptiker B - grow-Wellen in der Vorbereitung, kein Pendeln am achten Platz, Anlauffrist ueber eine Stapelphase",
    schnell: true,
  },
  {
    datei: "test-b8-ofen-gegenpruefung.js",
    deckt: "EBENE 2: Gegenpruefung Skeptiker B - Ofenfrist nach dem kuerzesten Takt, Ofenfaeden ohne Frist werden geraeumt",
    schnell: true,
  },
  {
    datei: "test-b5-stapeldurchsatz.js",
    deckt: "EBENE 2: B5 (Audit 26.09.2026 2#4): Stapelziele nach erreichbarem Stapeldurchsatz statt nach Rang",
    schnell: true,
  },
  {
    datei: "test-h1-weakenrate.js",
    deckt: "H1 (Audit bn12-bericht SHOULD-FIX #1): ServerWeakenRate in Vorbereitung, Mischung, Stapeltakt",
    schnell: true,
  },
  {
    datei: "test-b5-flattern.js",
    deckt: "B5-Skeptiker, Einwand 2b: keine Sprossen-Sprünge in batchThroughput über ZIELWAHL.bonusBatch hinaus",
    schnell: true,
  },
  {
    datei: "test-blackops-summe.js",
    deckt: "Die Black-Ops-Summe gegen den Quelltext (E.2 - drei Zahlen, alle falsch)",
    schnell: true,
  },
  {
    datei: "test-d2-wahre-chance.js",
    deckt: "D2 (Audit 4#2): wahre Chance statt s.min, wenn eine Black Op offen ist - Monte Carlo gegen einen Action.ts-Nachbau",
    schnell: true,
  },
  {
    datei: "test-d1-recruitment.js",
    deckt: "D1 (Audit 4#1): der Spieler rekrutiert nicht mehr selbst; Trupp nur bei echtem Bedarf und ohne den Pool zu ueberschreiben",
    schnell: false,
  },
  {
    datei: "test-d4-op-schwelle.js",
    deckt: "D4 (Audit 4#4): die feste 0,85 fuer Operationen gilt nur bei knapper Kasse - sonst entscheidet EV_Rang/min",
    schnell: false,
  },
  {
    datei: "test-trupp-sleeve.js",
    deckt: "Trupp fuer die Black Op: truppAnfrage nur bei echtem Bedarf, Feuern mit Pool, ein Sleeve rekrutiert nur, wenn der naechste Mann lohnt",
    schnell: false,
  },
  {
    datei: "test-blackop-gym.js",
    deckt: "Faellige Black Op holt die Figur aus dem Gym (dieselbe Feuerzahl wie waehle(), kein Pendeln), klemmFaktor und fahrbar leben",
    schnell: false,
  },
  {
    datei: "test-maenner-endlos.js",
    deckt: "maennerNoetig (blade.js) endet fuer jede Chance - die unbegrenzte Schleife fror am 03.10. den Spiel-Tab ein (Typhoon 0,102 gegen 0,90)",
    schnell: true,
  },
];

/**
 * Was Ebene 0 nach Auftrag 6.1 noch abdecken MUSS und heute nicht abdeckt.
 * Die Liste wird ausgegeben, nicht verschwiegen: ein gruener Sammellauf, der
 * die Haelfte nicht prueft, ist gefaehrlicher als ein roter.
 */
/**
 * WAS DIESE SUITE NICHT PRUEFT.
 *
 * Sie steht hier, weil eine leere Lueckenliste die bequemste Art ist, sich
 * fertig zu fuehlen. Stufe A der Abnahme verlangt Exit 0 UND eine leere
 * Liste - beides, nicht eines.
 *
 * Alles hier Genannte braucht das laufende Spiel (Ebene 3) oder eine
 * Beobachtung ueber Stunden. Kein Mock der Welt ersetzt das: der ns-Mock
 * bildet nach, was ich vom Spiel VERSTANDEN habe, und genau die Stellen, an
 * denen ich es falsch verstanden habe, bildet er falsch nach.
 */
/**
 * Die Liste hat seit dem 04.09.2026 ZWEI Teile, und das ist der Punkt
 * (Skeptiker Runde 4, R24).
 *
 * Vorher war sie eine einzige Prosaliste, die gedruckt und ignoriert wurde -
 * die Suite endete mit Exit 0 bei neun offenen Eintraegen. Wer nur den
 * Rueckgabewert liest (ein Skill, ein Loop), bekam gruen.
 *
 * Und sie vermischte zwei Dinge, die sich nicht vermischen lassen:
 *
 *   MESSLUECKEN sind Zahlen, die jemand erheben muss. Sie leeren sich durch
 *   Messen, und Abnahmestufe A verlangt zu Recht, dass sie leer sind.
 *
 *   BAUENTSCHEIDUNGEN sind Zustaende, die sich durch Messen NIE leeren -
 *   "Sprosse 4a ist nicht gebaut" bleibt wahr, solange sie nicht gebaut ist,
 *   und das ist Absicht. Sie in dieselbe Liste zu schreiben erzeugt Druck,
 *   den Eintrag zu streichen statt etwas zu messen.
 */
const MESSLUECKEN = [
  "EBENE 3, KALTSTART: ein echter Knotenwechsel auf 32 GB home. Der "
    + "Budgettest rechnet ihn nach, aber gerechnet ist nicht gemessen - "
    + "t_workbench gegen den Knotenpreis ist die Zahl, die zaehlt (C.7).",
  "EBENE 3, VERTRAGSKETTE: erster Vertrag geloest UND kassiert vor Minute 20. "
    + "Die Loeser sind gegen 360 erzeugte Instanzen und je eine unabhaengige "
    + "Gegenprobe gehalten, aber noch nie gegen einen echten Vertrag im Spiel "
    + "- ein Versuch ist unwiederbringlich (C.8).",
  "EBENE 3, STRAFLEITER: je Sprosse ein provozierter Haenger. Der Pflichttest "
    + "aus Auftrag 5.2 (Kern-Motorzeit eingefroren, Engine tickt weiter) "
    + "laesst sich nur im Spiel stellen (C.9, C.10).",
  "BITNODE 8 UND 9 sind nur gerechnet, nie gefahren. boerse.js hat 31 Proben, "
    + "aber keine einzige gegen einen echten Markt (C.13, C.15).",
  "GRAFTING im Betrieb: graft_busy_pct gegen 100 und graft_aborted = 0 "
    + "brauchen einen Lauf ueber Stunden, nicht eine Mock-Runde (C.14).",
  "DER FIGUR-VERGABEPUNKT ist gegen sieben Handlungsstellen geprueft, aber "
    + "figure_conflict = 0 ueber 12 h ist eine Messung, keine Zusicherung (C.11).",
  "DIE BRUECKE ist seit dem 04.09.2026 gegen ein nachgebautes Spiel geprueft "
    + "(tools/test-bruecke.js, 77 Proben). OFFEN bleibt der Zweig, den ein "
    + "Mock nicht stellen kann: uncaughtException im laufenden Betrieb, und "
    + "der Wachhund gegen einen ECHTEN zweiten Spiel-Tab.",
  "JEDER KENNWERT MIT SOLL HAT JETZT EINEN SCHREIBER (04.09.2026). Offen "
    + "bleibt die MESSUNG von next_blackop_chance: sie gilt laut Auftrag erst, "
    + "wenn getNextBlackOp() etwas liefert (erste Operation bei 2.500 Rang, "
    + "gemessen 596), und bis dahin steht sie zu Recht auf null. Bis der Rang "
    + "reicht, ist die Zahl gebaut, aber nicht belegt.",
  "DER MOCK RECHNET KEINE SPIELMECHANIK. Er kennt seit dem 04.09.2026 die "
    + "Koerper (storedCycles), den Seed und die Division (31 Funktionen) - "
    + "aber er leitet keine Erfolgschance aus Kampfwerten ab, er gibt "
    + "zurueck, was der Test hineinschreibt. Geprueft ist damit die "
    + "ENTSCHEIDUNG der Gewerke, nicht die Formel des Spiels; die hat ihren "
    + "eigenen, gegen den Quelltext geeichten Test. Was daraus folgt: ein "
    + "Fehler in einer Formel faellt hier NICHT auf.",
];

/**
 * Bewusste Bauentscheidungen. Sie stehen hier, damit sie nicht in Vergessenheit
 * geraten - aber sie sind KEINE Messluecke und blockieren Stufe A nicht.
 */
const ENTSCHIEDEN = [
  "SPROSSE 4a ist nicht gebaut und wird es nicht, bevor ein Ebene-3-Lauf "
    + "zeigt, dass ein skriptausgeloester Reload keinen beforeunload-Dialog "
    + "stehen laesst - so steht es im Auftrag. Aus dem Quelltext belegt: der "
    + "save-Prop existiert (GameRoot.tsx:536-541), und der Handler ist eine "
    + "schlichte Zuweisung an window.onbeforeunload (index.tsx:55), also mit "
    + "= null aufhebbar. Es fehlt die MESSUNG, nicht die Kenntnis.",
  "SPROSSE 5 laeuft im TROCKENLAUF: der Kern haengt 'scharf' nur an, wenn "
    + "data/punish-scharf.txt auf home liegt, und die legt ein Mensch. Das ist "
    + "der Trockenlauf, den der Auftrag vor der Schaerfe verlangt.",
    "DER BAU IST SEIT DEM 04.09.2026, 17:31 IM SPIEL. Eingespielt wurde "
    + "gestuft und mit Gegenprobe je Datei (tools/einspielen.js), neu "
    + "gestartet mit PID-Beleg (tools/neustart.js). Seit 21:00 sind auf Erics "
    + "Ansage auch die beiden letzten Schalter um: data/guard-modus.txt steht "
    + "auf 'enforce' (Sprosse 1 und 2 greifen ein, 3 und 5 beobachten), und "
    + "die Einbausperre ist aufgehoben - der Bot darf die sieben wartenden "
    + "Augmentierungen einbauen, sobald er nichts Besseres mehr kaufen kann. "
    + "NICHT eingespielt bleibt graftplan.json: sie ist der Zuender fuer "
    + "graftauto.js und wuerde binnen 60 s einen echten Graft ueber 450 Mrd "
    + "ausloesen. Sie steht in data/nicht-schieben.txt und geht auch beim "
    + "Verbinden nicht mit hinaus.",
];

const LUECKEN = MESSLUECKEN;

const nurSchnell = process.argv.includes("--schnell");

function fahre(datei, args = []) {
  return new Promise((fertig) => {
    const p = path.join(HIER, datei);
    if (!fs.existsSync(p)) {
      fertig({ datei, rc: 127, ausgabe: "Datei fehlt: " + p });
      return;
    }
    const beginn = Date.now();
    // ZWEI AENDERUNGEN AM 04.09.2026 (Skeptiker Runde 5, W5):
    //
    //   `process.execPath` statt "node" - findet die Umgebung `node` nicht auf
    //   dem PATH (Aufgabenplanung, ein .cmd mit eigenem PATH, ein anderer
    //   Rechner), bricht die Suite mit ENOENT ab statt zu laufen.
    //
    //   `timeout` - es gab keines. Haengt eine Testdatei, haengt die Suite
    //   endlos, und niemand sieht warum. Bei Ebene-2-Tests, die echte Prozesse
    //   und Sockets fahren, ist das die falsche Vorgabe. 180 s ist reichlich:
    //   die langsamste Datei braucht gemessen 39 s.
    execFile(process.execPath, [p, ...args],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 180000,
        killSignal: "SIGKILL" },
      (err, out, errout) => {
        const abgewuergt = err && err.killed;
        fertig({
          datei,
          rc: err ? (err.code ?? 1) : 0,
          ms: Date.now() - beginn,
          ausgabe: (out || "") + (errout || "")
            + (abgewuergt ? String.fromCharCode(10) + "  ABGEBROCHEN: laenger als 180 s - die Datei haengt." + String.fromCharCode(10) : ""),
        });
      });
  });
}

console.log("");
console.log("===========================================");
console.log("  Ebene 0 - alle Tests ohne Spiel");
console.log("===========================================");

const auswahl = TESTS.filter((t) => !nurSchnell || t.schnell);
const ergebnisse = [];

for (const t of auswahl) {
  const r = await fahre(t.datei, t.args || []);
  ergebnisse.push({ ...t, ...r });
  const zeichen = r.rc === 0 ? "gruen" : "ROT  ";
  console.log("");
  console.log("  [" + zeichen + "] " + t.datei + "  (" + (r.ms ?? "?") + " ms)");
  console.log("           " + t.deckt);
  if (r.rc !== 0) {
    console.log("");
    for (const z of r.ausgabe.split("\n").slice(-25)) console.log("      " + z);
  }
}

const rot = ergebnisse.filter((r) => r.rc !== 0);

console.log("");
console.log("===========================================");
console.log("  " + (ergebnisse.length - rot.length) + " von " + ergebnisse.length + " gruen");
if (rot.length) {
  for (const r of rot) console.log("  ROT: " + r.datei + " (Exit " + r.rc + ")");
}
console.log("===========================================");
console.log("");
console.log("  MESSLUECKEN - Zahlen, die jemand erheben muss (Auftrag 6.1):");
for (const l of MESSLUECKEN) console.log("    - " + l);
console.log("");
console.log("  BEWUSST SO GEBAUT - keine Luecke, aber nicht vergessen:");
for (const l of ENTSCHIEDEN) console.log("    - " + l);
console.log("");

// DIE LISTE IST EIN TOR, KEINE PROSA (Skeptiker Runde 4, R24).
//
// Vorher wurde sie gedruckt und ignoriert: die Suite endete mit Exit 0 bei
// neun offenen Eintraegen. Wer nur den Rueckgabewert liest - ein Skill, ein
// Loop, ein Mensch in Eile -, bekam gruen.
//
// Jetzt ist Exit 0 dasselbe wie Stufe A: alle Testdateien gruen UND keine
// offene Messluecke. Wer trotzdem nur die Tests fahren will, sagt es
// ausdruecklich (`--nur-tests`) - eine Abkuerzung, die man tippen muss, ist
// keine, die man aus Versehen nimmt.
const nurTests = process.argv.includes("--nur-tests");
const stufeA = rot.length === 0 && MESSLUECKEN.length === 0;

if (nurTests) {
  console.log("  --nur-tests: die Messluecken zaehlen fuer den Rueckgabewert nicht.");
  console.log("");
  process.exit(rot.length ? 1 : 0);
}

console.log("  Stufe A = alle Tests gruen UND keine offene Messluecke.");
console.log("  Stand: " + (rot.length ? rot.length + " rote Testdatei(en)" : "Tests gruen")
  + ", " + MESSLUECKEN.length + " offene Messluecke(n) -> "
  + (stufeA ? "STUFE A ERREICHT" : "Stufe A NICHT erreicht"));
console.log("");

process.exit(stufeA ? 0 : 1);
