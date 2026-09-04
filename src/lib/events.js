/**
 * `data/events.json` - der Ereignisstrom.
 *
 * ===========================================================================
 * WOZU EIN STROM, WENN ES TELEMETRIE GIBT
 * ===========================================================================
 *
 * Telemetrie sagt, wie es JETZT steht. Sie kann nicht sagen, was um 03:14
 * geschehen ist - der naechste Schreibvorgang ueberschreibt sie. Genau das
 * fehlte am 04.09.2026, als die Bruecke zwischen 04:46 und 05:56 starb: kein
 * Fehler im Log, keine Zeile irgendwo, nur eine Luecke in den Sicherungen.
 *
 * Der Strom haelt fest, was nicht wiederholbar ist: Spruenge, Einbauten,
 * Strafen, Blockaden, Ausnahmen. Er ist die einzige Quelle, aus der sich
 * `jump_latency_min`, `boot_latency_min` und `ladder_rungs_ge3_per_week`
 * ueberhaupt rechnen lassen - alle drei sind Abstaende zwischen Ereignissen.
 *
 * ===========================================================================
 * DECKEL STATT WACHSTUM
 * ===========================================================================
 *
 * Die Datei liegt auf home und wird in jeder Runde gelesen. Ein Strom ohne
 * Deckel waechst ueber Wochen in den Megabytebereich und macht die Runde
 * langsamer, je laenger der Bot laeuft - ein Fehler, der sich erst nach zwei
 * Wochen zeigt und dann nach einem Speicherleck aussieht.
 *
 * Deshalb: Ringpuffer. Die JUENGSTEN `DECKEL` Eintraege bleiben, aeltere
 * fallen heraus. Ereignisse der Klasse `bleibt` sind davon ausgenommen -
 * ein Knotenwechsel ist auch nach tausend Runden noch die wichtigste Zeile
 * der Datei.
 */

export const EVENTS_VERSION = 1;

/** Wie viele gewoehnliche Eintraege der Strom haelt. */
export const DECKEL = 400;

/**
 * Wie viele der Klasse `bleibt` hoechstens ueberleben. Auch das Unverzichtbare
 * braucht eine Grenze, sonst waechst die Datei eben langsamer statt gar nicht.
 * 40 Spruenge sind die ganze Restroute - mehr wird nie gebraucht.
 */
export const DECKEL_BLEIBT = 60;

/**
 * Ereignisarten. `bleibt: true` heisst: faellt nicht aus dem Ringpuffer.
 *
 * Die Auswahl folgt der Frage "laesst sich das spaeter noch rekonstruieren?".
 * Eine Ausnahme steht auch in der Telemetrie (`lastError`), ein Knotenwechsel
 * nirgends sonst.
 */
export const ARTEN = {
  jump: { bleibt: true, text: "Knotenwechsel" },
  install: { bleibt: true, text: "Augmentierungen eingebaut" },
  boot: { bleibt: false, text: "Kern gestartet" },
  penalty: { bleibt: true, text: "Strafleiter" },
  blocked: { bleibt: false, text: "blockiert" },
  error: { bleibt: false, text: "Ausnahme" },
  gate: { bleibt: true, text: "Tor erreicht" },
  bridge: { bleibt: false, text: "Bruecke" },
  note: { bleibt: false, text: "Vermerk" },
};

/** Ein leerer Strom. */
export function leer() {
  return { version: EVENTS_VERSION, eintraege: [] };
}

/**
 * Haengt ein Ereignis an.
 *
 * ALLE DREI UHREN WERDEN MITGESCHRIEBEN, und zwar immer. Welche spaeter die
 * richtige ist, entscheidet die Frage, die man dann stellt - und die kennt
 * niemand beim Schreiben. Ein Ereignis mit nur einem Zeitstempel zwingt den
 * Leser zu der Annahme, dass die Uhren gleich liefen; nach einer Offline-Nacht
 * ist das falsch, und zwar um Stunden.
 *
 * @param {object} strom aus leer() oder laden()
 * @param {string} art Schluessel aus ARTEN
 * @param {string} text kurze Beschreibung, wird auf 160 Zeichen gekuerzt
 * @param {object} uhren {wall, playtime, motorTimeMs}
 * @param {object} daten beliebige Zusatzfelder, klein halten
 */
export function anhaengen(strom, art, text, uhren = {}, daten = null) {
  const e = {
    art: ARTEN[art] ? art : "note",
    text: kurz(text),
    wall: Number.isFinite(uhren.wall) ? uhren.wall : 0,
    playtime: Number.isFinite(uhren.playtime) ? uhren.playtime : 0,
    motorTimeMs: Number.isFinite(uhren.motorTimeMs) ? uhren.motorTimeMs : 0,
  };
  if (daten && typeof daten === "object") e.daten = daten;
  // Unbekannte Art ist ein Befund, kein Grund zum Verwerfen: das Ereignis ist
  // geschehen, auch wenn der Schreiber sich vertippt hat.
  if (!ARTEN[art]) e.unbekannteArt = String(art);

  strom.eintraege.push(e);
  beschneiden(strom);
  return e;
}

function kurz(s) {
  const t = String(s == null ? "" : s);
  return t.length > 160 ? t.slice(0, 157) + "..." : t;
}

/**
 * Haelt den Strom unter dem Deckel.
 *
 * Die Reihenfolge bleibt dabei erhalten - der Strom ist chronologisch, und ein
 * Beschnitt, der die bleibenden Eintraege ans Ende sortiert, macht jede
 * Abstandsrechnung falsch.
 */
export function beschneiden(strom) {
  const alle = strom.eintraege;
  const bleibend = [];
  const gewoehnlich = [];
  for (let i = 0; i < alle.length; i++) {
    const e = alle[i];
    (ARTEN[e.art] && ARTEN[e.art].bleibt ? bleibend : gewoehnlich).push(i);
  }
  const behalten = new Set();
  for (const i of bleibend.slice(-DECKEL_BLEIBT)) behalten.add(i);
  for (const i of gewoehnlich.slice(-DECKEL)) behalten.add(i);
  if (behalten.size === alle.length) return strom;
  strom.eintraege = alle.filter((_, i) => behalten.has(i));
  return strom;
}

/** Laedt den Strom. Unlesbares ergibt einen frischen - nie einen Absturz. */
export function laden(roh) {
  if (!roh) return leer();
  let s;
  try {
    s = typeof roh === "string" ? JSON.parse(roh) : roh;
  } catch {
    return leer();
  }
  if (!s || typeof s !== "object" || !Array.isArray(s.eintraege)) return leer();
  if (!Number.isFinite(s.version)) s.version = EVENTS_VERSION;
  return s;
}

/** Die juengsten n Eintraege, optional nach Art gefiltert. */
export function juengste(strom, n = 20, art = null) {
  const e = art ? strom.eintraege.filter((x) => x.art === art) : strom.eintraege;
  return e.slice(-n);
}

/** Das letzte Ereignis einer Art - oder null. */
export function letztes(strom, art) {
  for (let i = strom.eintraege.length - 1; i >= 0; i--) {
    if (strom.eintraege[i].art === art) return strom.eintraege[i];
  }
  return null;
}

/**
 * Abstand zwischen zwei Ereignisarten in Minuten - die Form, in der
 * `jump_latency_min` und `boot_latency_min` gebraucht werden.
 *
 * WELCHE UHR: der Aufrufer waehlt. `jump_latency_min` und `boot_latency_min`
 * stehen ausdruecklich in WANDUHR (ARCHITEKTUR 4.2) - sie messen, wie lange
 * der Bot brauchte, nicht wie lange er arbeitete. Ein Sprung, der wegen einer
 * Offline-Nacht drei Stunden dauerte, ist genau das: drei Stunden ohne Bot.
 *
 * @returns {number|null} null, wenn eines der beiden Ereignisse fehlt oder die
 *   Reihenfolge nicht stimmt - nie eine geratene Zahl.
 */
export function abstandMin(strom, vonArt, bisArt, uhr = "wall") {
  const bis = letztes(strom, bisArt);
  if (!bis) return null;
  let von = null;
  for (const e of strom.eintraege) {
    if (e.art !== vonArt) continue;
    if (e[uhr] > bis[uhr]) break;
    von = e;
  }
  if (!von) return null;
  const d = bis[uhr] - von[uhr];
  if (!Number.isFinite(d) || d < 0) return null;
  return d / 60000;
}
