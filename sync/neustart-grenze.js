/**
 * Zaehler und Protokoll fuer sync/bridge-start.cmd (B05, 14.11.2026).
 *
 * Die Neustartschleife darf die Bruecke nicht endlos neu starten: eine Bruecke,
 * die an einem Konfigurationsfehler oder einem kaputten Spielstand-Lesen
 * jedes Mal binnen Sekunden stirbt, wuerde sonst Sicherungen, Platte und Log
 * im Zehnsekundentakt fluten. Diese Datei ist die Obergrenze: HOECHSTENS
 * `max` Neustarts je Zeitfenster (Vorgabe 5 je 60 min). Danach endet die
 * Schleife, und `data/bridge-start-gestoppt.txt` sagt warum - Eric und /bb
 * sehen die Bruecke dann als "aus", nicht als "laeuft vielleicht".
 *
 * Aufrufe (aus der .cmd):
 *   node sync/neustart-grenze.js --max 5 [--fenster-min 60]
 *       Einen Neustart anmelden. Exit 0 = erlaubt (und gezaehlt), 4 = Grenze.
 *   node sync/neustart-grenze.js --log "Text"
 *       Eine Zeile in data/bridge-start.log (ISO-Zeit, Tab, Text).
 *   node sync/neustart-grenze.js --start
 *       Schleife beginnt: Zaehler leeren, Stoppdatei loeschen.
 *   node sync/neustart-grenze.js --gestoppt "Grund"
 *       Stoppdatei schreiben.
 * Optional --data <ordner> (Vorgabe: data/ neben sync/), nur fuer Tests.
 *
 * Fehler im Zaehler (Platte voll, Datei gesperrt) zaehlen als GRENZE: im
 * Zweifel steht die Schleife, sie laeuft nicht ungezaehlt weiter.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const VORGABE_MAX = 5;
export const VORGABE_FENSTER_MIN = 60;
export const LOG_MAX_BYTES = 200000;
export const LOG_BEHALTEN_BYTES = 100000;
export const EXIT_GRENZE = 4;

/**
 * Reine Entscheidung. `zeiten` = Zeitpunkte frueherer Neustarts (ms).
 * Rueckgabe: { erlaubt, zeiten } - `zeiten` ist die bereinigte Liste, mit
 * `jetzt` NUR dann, wenn der Neustart erlaubt ist (ein abgelehnter zaehlt
 * nicht mit, sonst ginge die Schleife nie wieder an).
 */
export function entscheide(zeiten, jetzt, max = VORGABE_MAX, fensterMin = VORGABE_FENSTER_MIN) {
  const grenze = jetzt - fensterMin * 60000;
  // Zeitpunkte aus der Zukunft (Uhr zurueckgestellt) zaehlen mit - im Zweifel gegen den Neustart.
  const im = zeiten.filter((t) => Number.isFinite(t) && t > grenze);
  if (im.length >= max) return { erlaubt: false, zeiten: im };
  return { erlaubt: true, zeiten: [...im, jetzt] };
}

function datenOrdner(argv) {
  const i = argv.indexOf("--data");
  return path.resolve(i >= 0 ? argv[i + 1] : path.join(HIER, "..", "data"));
}
function wert(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function leseZeiten(datei) {
  try {
    return fs.readFileSync(datei, "utf8").split(/\r?\n/).map((z) => Number(z.trim())).filter((n) => Number.isFinite(n) && n > 0);
  } catch (e) {
    if (e && e.code === "ENOENT") return [];
    throw e;
  }
}

/** Eine Zeile anhaengen; ueber LOG_MAX_BYTES wird auf die letzten LOG_BEHALTEN_BYTES gekuerzt. */
export function schreibeLog(datei, text, jetzt = Date.now()) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.appendFileSync(datei, new Date(jetzt).toISOString() + "\t" + String(text).replace(/[\r\n]+/g, " ") + "\n");
  try {
    if (fs.statSync(datei).size > LOG_MAX_BYTES) {
      const roh = fs.readFileSync(datei, "utf8");
      const rest = roh.slice(-LOG_BEHALTEN_BYTES);
      fs.writeFileSync(datei, rest.slice(rest.indexOf("\n") + 1));
    }
  } catch { /* Kuerzen ist Pflege, kein Grund abzubrechen */ }
}

export function main(argv, jetzt = Date.now()) {
  const dir = datenOrdner(argv);
  const zeitenDatei = path.join(dir, "bridge-start-zeiten.txt");
  const logDatei = path.join(dir, "bridge-start.log");
  const stoppDatei = path.join(dir, "bridge-start-gestoppt.txt");
  fs.mkdirSync(dir, { recursive: true });

  if (argv.includes("--start")) {
    fs.writeFileSync(zeitenDatei, "");
    fs.rmSync(stoppDatei, { force: true });
    schreibeLog(logDatei, "Schleife gestartet", jetzt);
    return 0;
  }
  if (argv.includes("--log")) {
    schreibeLog(logDatei, wert(argv, "--log") || "", jetzt);
    return 0;
  }
  if (argv.includes("--gestoppt")) {
    const grund = wert(argv, "--gestoppt") || "unbekannt";
    fs.writeFileSync(stoppDatei, new Date(jetzt).toISOString() + "\n" + grund + "\n");
    schreibeLog(logDatei, "GESTOPPT: " + grund, jetzt);
    return 0;
  }
  if (argv.includes("--max")) {
    const max = Number(wert(argv, "--max"));
    const fenster = Number(wert(argv, "--fenster-min") || VORGABE_FENSTER_MIN);
    if (!Number.isInteger(max) || max < 1 || !Number.isFinite(fenster) || fenster <= 0) {
      throw new Error("--max braucht eine ganze Zahl >= 1, --fenster-min eine Zahl > 0");
    }
    const r = entscheide(leseZeiten(zeitenDatei), jetzt, max, fenster);
    if (r.erlaubt) {
      fs.writeFileSync(zeitenDatei, r.zeiten.join("\n") + "\n");
      schreibeLog(logDatei, "Neustart " + r.zeiten.length + " von " + max + " je " + fenster + " min erlaubt", jetzt);
      return 0;
    }
    fs.writeFileSync(zeitenDatei, r.zeiten.join("\n") + "\n");
    const grund = "Obergrenze erreicht: " + max + " Neustarts in " + fenster + " min. "
      + "Die Bruecke ist AUS. Ursache in data/bridge.log suchen, dann sync\\bridge-start.cmd neu starten.";
    fs.writeFileSync(stoppDatei, new Date(jetzt).toISOString() + "\n" + grund + "\n");
    schreibeLog(logDatei, "GESTOPPT: " + grund, jetzt);
    return EXIT_GRENZE;
  }
  throw new Error("Aufruf: --max <n> | --log <text> | --start | --gestoppt <grund>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let code;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    console.error("neustart-grenze: " + (e && e.message ? e.message : e));
    code = 1; // Fehler = keine Freigabe fuer den Neustart
  }
  process.exit(code);
}
