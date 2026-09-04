/**
 * Herzschlag v2 - der Telemetrieblock, den JEDES Werkzeug schreibt.
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI GIBT
 * ===========================================================================
 *
 * Bis heute schrieb jedes Werkzeug seinen eigenen Block mit eigenen Feldnamen.
 * `blade.js:609-617` baut sich von Hand einen Minimal-Herzschlag mit
 * `wartend: true`, weil das Schema kein Feld dafuer hatte. Die Folge: der
 * Waechter kann nicht entscheiden, und die Abnahme kann nichts messen.
 *
 * ===========================================================================
 * DIE LUECKE, DIE errStreak UND okRound SCHLIESSEN
 * ===========================================================================
 *
 * Die ganze Kernrunde liegt in einem `try` (`bn4net.js:391-392,3167-3170`).
 * Ein Motor, der JEDE Runde wirft, zaehlt `round` weiter, schreibt Telemetrie
 * und sieht nach jedem Frischesignal gesund aus. Er tut nur nichts.
 *
 * Deshalb zaehlt `round` die Versuche und `okRound` die vollstaendig
 * durchlaufenen Runden. Stehen die beiden auseinander, arbeitet der Motor
 * nicht - egal wie frisch der Block ist. `errStreak` macht daraus ein Signal
 * mit Richtung: aufeinanderfolgende Ausnahmen, nicht Ausnahmen insgesamt.
 *
 * ===========================================================================
 * DER DRITTE, LEISESTE FALL: state === "wait"
 * ===========================================================================
 *
 * Ein Werkzeug kann laufen, nicht werfen und trotzdem nichts tun - es wartet
 * auf Geld, auf einen Platz, auf eine Freischaltung. Ohne Feld dafuer haelt es
 * jede Frischepruefung ruhig und zaehlt zugleich in der Traegerrechnung mit,
 * wo es keinen Fortschritt beitragen kann.
 *
 * `state: "wait"` loest beides: der Eintrag gilt als lebendig, wird aber aus
 * der Fortschrittsrechnung ausgeschlossen - er wird nicht dafuer bestraft,
 * keinen Fortschritt zu haben.
 *
 * ===========================================================================
 * EIN BLOCK OHNE errStreak UND lastError IST UNGUELTIG
 * ===========================================================================
 *
 * Das ist zugleich die Migration. Ein alter Schreiber, der die Felder nicht
 * kennt, besteht die Frischepruefung nicht mehr und faellt auf - statt still
 * weiterzulaufen und den Waechter mit einem halben Block zu fuettern.
 */

/** Schemaversion dieses Blockformats. Wandert ueber `wandere()`. */
export const HERZSCHLAG_VERSION = 2;

/** Erlaubte Werte fuer `state`. Alles andere ist ein Befund. */
export const ZUSTAENDE = ["work", "wait", "blocked", "done"];

/**
 * Erlaubte Werte fuer `blockedReason`. Die Liste ist offen - ein unbekannter
 * Grund wird uebernommen und faellt in der Auswertung als solcher auf, statt
 * verworfen zu werden. Ein verworfener Grund ist schlimmer als ein
 * unbekannter: er sieht aus wie "kein Problem".
 */
export const BLOCKGRUENDE = [
  "no_space",       // kein RAM auf einem geeigneten Wirt
  "no_role",        // Rolle/Division nicht freigeschaltet
  "no_money",       // Kontostand reicht nicht
  "not_in_division",
  "no_target",      // kein gueltiges Ziel gefunden
  "locked",         // Sperre gesetzt (z. B. install-sperre.txt)
  "not_executable", // im aktuellen Knoten unmoeglich (BN9: CloudServerLimit 0)
];

/**
 * Baut einen vollstaendigen Telemetrieblock.
 *
 * Pflichtfelder nach ARCHITEKTUR 4.1. Wer ein Feld weglaesst, bekommt den
 * Nullwert - NICHT den Wert aus einer Vorlage. Das ist die NEONBREAK-Lehre
 * (`lauf.saat` -> `lauf.seed`, 19.08.2026): eine Ergaenzung aus der Vorlage
 * haette einem laufenden Stand mitten im Spiel neue Werte gegeben.
 *
 * @param {object} f Felder
 * @param {number} f.wall Date.now()
 * @param {number} f.playtime totalPlaytime in ms
 * @param {number} f.motorTimeMs Motorzeit des KERNS, nicht die eigene
 * @param {number} f.round Schleifendurchlaeufe (Versuche)
 * @param {number} f.okRound vollstaendig durchlaufene Runden
 * @param {number} f.errStreak aufeinanderfolgende Ausnahmen
 * @param {object|null} f.lastError {cls, msg, at} - msg wird gekuerzt
 * @param {number} f.nodeReset ms seit dem Knotenwechsel (getResetInfo)
 * @param {number} f.augReset ms seit dem letzten Einbau
 * @param {string} f.host Rechnername
 * @param {string} f.version Fassung des Werkzeugs - Wirkungsbeleg beim Swap
 * @param {string} f.state work|wait|blocked|done
 * @param {string|null} f.blockedReason
 * @param {object} f.extra werkzeugeigene Felder, unveraendert uebernommen
 */
export function block(f = {}) {
  const b = {
    schema: HERZSCHLAG_VERSION,
    ts: zahl(f.wall ?? f.ts, 0),
    wall: zahl(f.wall ?? f.ts, 0),
    playtime: zahl(f.playtime, 0),
    motorTimeMs: zahl(f.motorTimeMs, 0),
    round: zahl(f.round, 0),
    okRound: zahl(f.okRound, 0),
    errStreak: zahl(f.errStreak, 0),
    lastError: fehler(f.lastError),
    nodeReset: zahl(f.nodeReset, 0),
    augReset: zahl(f.augReset, 0),
    host: typeof f.host === "string" ? f.host : "",
    version: typeof f.version === "string" ? f.version : "",
    state: ZUSTAENDE.includes(f.state) ? f.state : "work",
    blockedReason: f.blockedReason == null ? null : String(f.blockedReason),
  };
  if (f.extra && typeof f.extra === "object") {
    for (const [k, v] of Object.entries(f.extra)) {
      // Werkzeugeigene Felder duerfen die Pflichtfelder nie ueberschreiben:
      // sonst schreibt ein Gewerk sein eigenes `state` und der Waechter liest
      // eine Bedeutung, die es dort nicht hat.
      if (k in b) continue;
      b[k] = v;
    }
  }
  return b;
}

function zahl(v, ersatz) {
  return Number.isFinite(v) ? v : ersatz;
}

/**
 * Normiert einen Fehler auf {cls, msg, at}. `msg` wird auf 200 Zeichen
 * gekuerzt: ein Stacktrace in der Telemetrie blaeht die Datei, und die
 * Frischepruefung liest sie in JEDER Runde.
 */
export function fehler(e) {
  if (e == null) return null;
  if (typeof e === "string") return { cls: "Error", msg: kurz(e), at: 0 };
  const cls = e.cls || e.name || (e.constructor && e.constructor.name) || "Error";
  const msg = kurz(e.msg ?? e.message ?? String(e));
  const at = Number.isFinite(e.at) ? e.at : 0;
  return { cls: String(cls), msg, at };
}

function kurz(s) {
  const t = String(s == null ? "" : s);
  return t.length > 200 ? t.slice(0, 197) + "..." : t;
}

/**
 * Ist der Block ueberhaupt auswertbar?
 *
 * Ein Block ohne `errStreak` und `lastError` ist UNGUELTIG und gilt als
 * veraltet (ARCHITEKTUR 4.1 woertlich). Das ist die Migration: ein alter
 * Schreiber faellt auf, statt still weiterzulaufen.
 */
export function gueltig(b) {
  if (!b || typeof b !== "object") return false;
  if (!Number.isFinite(b.errStreak)) return false;
  if (!("lastError" in b)) return false;
  if (!Number.isFinite(b.ts) && !Number.isFinite(b.wall)) return false;
  return true;
}

/**
 * Warum ein Block nicht gueltig ist - fuer den Befund, nicht fuer die Logik.
 * Ein blosses `false` zwingt den Leser zum Raten.
 */
export function ungueltigGrund(b) {
  if (!b || typeof b !== "object") return "kein Objekt";
  if (!Number.isFinite(b.errStreak)) return "errStreak fehlt (Schreiber vor v2)";
  if (!("lastError" in b)) return "lastError fehlt (Schreiber vor v2)";
  if (!Number.isFinite(b.ts) && !Number.isFinite(b.wall)) return "kein Zeitstempel";
  return null;
}

/**
 * Ist der Block frisch genug?
 *
 * WELCHE UHR: Wanduhr. Der Block wird von einem Werkzeug geschrieben, das im
 * selben Browser laeuft wie der Leser - beide sehen dieselbe Drosselung. Ein
 * Vergleich in Motorzeit wuerde eine Uhr benutzen, die der Schreiber gar nicht
 * fuehrt (nur der Kern tut das).
 *
 * Ein ungueltiger Block ist NIE frisch, unabhaengig vom Alter.
 */
export function frisch(b, jetzt, maxAlterMs) {
  if (!gueltig(b)) return false;
  const ts = Number.isFinite(b.ts) ? b.ts : b.wall;
  const alter = jetzt - ts;
  // Ein Block aus der Zukunft ist ein Uhrensprung, kein frischer Block.
  if (alter < -60000) return false;
  return alter <= maxAlterMs;
}

/**
 * Traegt der Eintrag zur Fortschrittsrechnung bei?
 *
 * Ein wartendes Werkzeug kann keinen Fortschritt belegen und wird auch nicht
 * dafuer bestraft, keinen zu haben (ARCHITEKTUR 4.1). Dasselbe gilt fuer
 * blockierte und fertige Eintraege.
 */
export function zaehltFuerFortschritt(b) {
  return gueltig(b) && b.state === "work";
}

/**
 * Arbeitet der Schreiber wirklich, oder zaehlt er nur hoch?
 *
 * Die Wirkungspruefung der Sprosse 3 verlangt "round waechst UND errStreak
 * == 0". Mit `okRound` ist das pruefbar statt nur gefordert: zwei Bloecke
 * nacheinander, und `okRound` muss mitgewachsen sein.
 */
export function arbeitetWirklich(vorher, nachher) {
  if (!gueltig(vorher) || !gueltig(nachher)) return false;
  if (nachher.errStreak > 0) return false;
  return nachher.okRound > vorher.okRound;
}

/**
 * Wandert einen alten Block auf das aktuelle Schema.
 *
 * REGEL AUS ARCHITEKTUR 4.3: ein Feld, das die Wanderung nicht kennt, bekommt
 * den NULLWERT - nie einen Wert aus einer Vorlage. Deshalb steht hier kein
 * Spread ueber ein `neuerBlock()`, sondern eine benannte Zuordnung je Feld.
 *
 * v0/v1 -> v2: `errStreak`, `okRound`, `lastError`, `state`, `blockedReason`
 * kamen neu dazu. Ein alter Block hat sie nicht; sie werden auf ihren Nullwert
 * gesetzt und NICHT geraten. `okRound: 0` bei `round: 4000` sieht falsch aus -
 * und genau das ist der Zweck: der Block faellt auf.
 */
export function wandere(roh) {
  if (!roh || typeof roh !== "object") return null;
  const v = Number.isFinite(roh.schema) ? roh.schema : 0;
  if (v >= HERZSCHLAG_VERSION) return roh;

  const b = { ...roh };
  b.schema = HERZSCHLAG_VERSION;
  if (!Number.isFinite(b.errStreak)) b.errStreak = 0;
  if (!("lastError" in b)) b.lastError = null;
  if (!Number.isFinite(b.okRound)) b.okRound = 0;
  if (!Number.isFinite(b.motorTimeMs)) b.motorTimeMs = 0;
  // `wartend: true` war der Sonderfall aus blade.js:609-617. Er wird zum Feld.
  if (!ZUSTAENDE.includes(b.state)) b.state = roh.wartend === true ? "wait" : "work";
  if (!("blockedReason" in b)) b.blockedReason = null;
  b.gewandertVon = v;
  return b;
}
