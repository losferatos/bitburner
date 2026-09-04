/**
 * Zentrale Konstanten fuer Bruecke, Werkzeuge und Pruefstand.
 *
 * WARUM DIESE DATEI EXISTIERT (04.09.2026)
 * Vorher standen Ports und Pfade in jeder Datei einzeln - 8795 war in dutzenden
 * Werkzeugen hart verdrahtet, der Sicherungsort in gar keiner. Damit gab es
 * keinen Ort, an dem sich LIVE von TEST trennen laesst, und genau diese
 * Trennung ist der wichtigste Riegel vor Erics Spielstand: eine Testinstanz,
 * die versehentlich Port 12525 anwaehlt, verdraengt den Live-Socket
 * (bridge.js:394-402) und schiebt anschliessend Testcode in die live file.
 *
 * Der Fingerabdruck, der LIVE von einer Kopie trennt, ist NICHT der
 * identifier - der wird beim Kopieren mitgenommen (PlayerObject.ts) - sondern
 * der RemoteFileApiPort im SettingsSave. Deshalb steht er hier je Rolle.
 *
 * PFADE WERDEN NORMALISIERT VERGLICHEN. Windows liefert mal Klein-, mal
 * Grossschreibung des Laufwerksbuchstabens und mal Vorwaerts-, mal
 * Rueckwaertsschraegstriche; ein Vergleich auf Zeichengleichheit haette die
 * Rollenpruefung der Bruecke je nach Aufrufweg zufaellig scharf oder stumpf
 * gemacht.
 */

import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

/** Projektwurzel = der Ordner ueber sync/. */
export const ROOT = path.resolve(HIER, "..");

/**
 * Der Pfad, an dem die LIVE-Rolle ueberhaupt zulaessig ist.
 * Ein Worktree (bitburner-bau) liegt daneben und faellt hier durch - so kann
 * eine Bau-Sitzung im Worktree die Live-Bruecke nicht versehentlich starten.
 */
export const LIVE_ROOT = path.join(
  "C:",
  "Users",
  "erche",
  "Desktop",
  "claude_projecto",
  "bitburner",
);

/** Der einzige Spielstand, der als LIVE gilt. */
export const LIVE_IDENTIFIER = "197f4d61481686";

/** Vergleicht zwei Pfade unabhaengig von Schraegstrichform und Gross/Kleinschreibung. */
export function pfadGleich(a, b) {
  if (!a || !b) return false;
  const norm = (s) => path.resolve(String(s)).replace(/[/\\]+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

export const ROLLEN = {
  LIVE: {
    instance: "LIVE",
    rfaPort: 12525,
    dashPort: 8795,
    dataDir: path.join(ROOT, "data"),
    identifier: LIVE_IDENTIFIER,
    prefix: "LIVE_",
  },
  TEST: {
    instance: "TEST",
    rfaPort: 12526,
    dashPort: 8796,
    dataDir: path.join(ROOT, "pruefstand", "data"),
    identifier: null, // Kopie traegt denselben identifier - nur der Port trennt
    prefix: "TEST_",
  },
  /**
   * DIE DRITTE ROLLE: fuer automatisierte Tests gegen ein NACHGEBAUTES Spiel
   * (04.09.2026, Skeptiker Runde 5, B1).
   *
   * Sie ist noetig, weil TEST zwei Dinge zugleich war: die Instanz, mit der
   * ein Mensch einen KLON von Erics Spielstand fuehrt, und die Instanz, gegen
   * die `tools/test-bruecke.js` ein erfundenes Spiel laufen laesst.
   *
   * Der Schaden daraus ist gemessen worden: Der Brueckentest muss mit einer
   * Spielzeit OBERHALB des vorhandenen Ankers arbeiten (sonst weist die
   * Bruecke ihn zu Recht ab), und jede verifizierte Verbindung schreibt eine
   * Sicherung in denselben Index. Nach wenigen Laeufen stand der Anker der
   * TEST-Rolle auf 6.800 Stunden - eine echte Spielstandskopie mit 369
   * Stunden waere ab da als "Rueckwaertssprung" abgelehnt worden, und zwar
   * dauerhaft: `rotiere()` loescht Dateien, keine Indexzeilen.
   *
   * MOCK hat deshalb einen eigenen Ablageort und einen eigenen Praefix.
   * Erfundene Spielzeiten und echte gehoeren nicht in denselben Index.
   *
   * Die Ports haben KEINE Vorgabe: wer diese Rolle benutzt, waehlt sie
   * bewusst und frei (`net.createServer().listen(0)` im Test).
   */
  MOCK: {
    instance: "MOCK",
    rfaPort: 0,
    dashPort: 0,
    dataDir: path.join(ROOT, "pruefstand", "mock"),
    identifier: null,
    prefix: "MOCK_",
  },
};

/**
 * Sicherungsorte. Der erste liegt AUSSERHALB des Repos, weil `backups/` in
 * .gitignore steht und im selben Arbeitsbaum wie die Worktrees liegt: ein
 * `git clean -xdf` loeschte sonst das gesamte Netz auf einen Schlag.
 * Der zweite ist nur der Spiegel.
 */
export const BACKUP_PRIMAER = path.join(os.homedir(), "bitburner-backups");
export const BACKUP_SPIEGEL = path.join(ROOT, "backups");
export const BACKUP_TEST = path.join(ROOT, "pruefstand", "backups");
/** Eigener Ablageort der MOCK-Rolle - siehe ROLLEN.MOCK. */
export const BACKUP_MOCK = path.join(ROOT, "pruefstand", "mock-backups");
export const INDEX_NAME = "INDEX.tsv";

/** Anlaesse und ihre Aufbewahrung. null = unbegrenzt. */
export const ANLAESSE = {
  hourly: 48,
  /**
   * DER SCHNELLE TAKT BRAUCHT EINEN EIGENEN NAMEN (Skeptikerrunde 6, 04.09.2026).
   *
   * Steht der Zweit-Tab-Verdacht, sichert die Bruecke alle fuenf statt alle
   * sechzig Minuten. Der erste Entwurf behielt dafuer den Anlassnamen
   * "hourly" - "damit die Rotation greift". Sie greift dann auch, und zwar
   * genau falsch herum: `hourly: 48` ist ein STUECKZAHLdeckel, kein
   * Altersdeckel.
   *
   *     48 Dateien x 60 min = 48,0 h Historie
   *     48 Dateien x  5 min =  4,0 h Historie
   *
   * Nach vier Stunden stehendem Alarm waere JEDE Sicherung von VOR dem
   * Vorfall aus der Rotation gefallen - also genau der Bestand, aus dem man
   * wiederherstellen wuerde, und genau das Beweismittel, das die
   * Alarmmeldung selbst anfordert ("sinkt totalPlaytime in den
   * Sicherungen?"). Eine Massnahme zum Schutz des Spielstands haette in vier
   * Stunden die Belege weggeraeumt, unbeaufsichtigt, ueber Nacht.
   *
   * Zwei Skeptiker haben es unabhaengig voneinander gefunden. Es ist die
   * Fehlerklasse "Rate oder Bestand" aus CLAUDE.md: die Rate wurde erhoeht,
   * ohne zu pruefen, was das mit dem Bestand macht.
   *
   * 144 Stueck sind zwoelf Stunden im Fuenfminutentakt - lang genug, dass
   * eine Nacht hineinpasst.
   */
  race: 144,
  connect: 10,
  "pre-hotswap": 20,
  "pre-install": null,
  "pre-jump": null,
  emergency: null,
  manual: 30,
};

/** Budget je Ablageort in Byte. Beim Ueberschreiten zuerst pre-hotswap, dann connect. */
/**
 * 300 statt 150 MB, seit es den Anlass `race` gibt. Gemessene Dateigroesse
 * 662 KB; 144 Rennsicherungen wiegen 96 MB, und die duerfen die 48
 * Stundenstaende (32 MB) nicht aus dem Budget draengen - sonst kaeme der
 * Deckel aus ANLAESSE zwar nicht mehr zum Zug, das Budget aber schon, und
 * der Befund waere derselbe mit einem anderen Namen.
 */
export const BACKUP_BUDGET_BYTES = 300 * 1024 * 1024;
/**
 * `race` steht VOR `manual` und `hourly`: die Rennsicherungen sind die
 * zahlreichsten und einzeln die am wenigsten wertvollen (fuenf Minuten
 * Abstand). Wenn geraeumt werden muss, gehen sie zuerst - aber erst, nachdem
 * die Schubsicherungen und die Verbindungsstaende dran waren.
 */
export const RAEUM_REIHENFOLGE = ["pre-hotswap", "connect", "race", "manual", "hourly"];

/**
 * Dateien auf home, bei denen deleteFile zusaetzlich confirm=<name> verlangt.
 * Sie sind der Rueckweg des Bots aus jedem Zustand; ein versehentliches
 * Loeschen von boot.js macht den naechsten Knotenwechsel unwiederbringlich
 * still, weil das Autoexec-Skript dann fehlt.
 */
export const SCHONLISTE = ["boot.js", "bn4net.js", "exit.js", "ausgang.js", "route.json"];

export function rolleAusArgv(argv) {
  const i = argv.indexOf("--instance");
  if (i === -1 || !argv[i + 1]) return null;
  const name = String(argv[i + 1]).toUpperCase();
  return ROLLEN[name] || null;
}

export function zahlAusArgv(argv, flag, ersatz) {
  const i = argv.indexOf(flag);
  if (i === -1 || !argv[i + 1]) return ersatz;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) ? n : ersatz;
}

export function textAusArgv(argv, flag, ersatz) {
  const i = argv.indexOf(flag);
  if (i === -1 || !argv[i + 1]) return ersatz;
  return argv[i + 1];
}
