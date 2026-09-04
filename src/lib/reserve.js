/**
 * Geldreserven - was gerade nicht ausgegeben werden darf.
 *
 * ===========================================================================
 * DER DEADLOCK, DEN DIESE DATEI AUFLOEST (ARCHITEKTUR E10)
 * ===========================================================================
 *
 * Zwei Auftragsregeln widersprechen sich direkt:
 *
 *   - Kurz vor einem Knotenwechsel soll der Bot sein Geld ausgeben, weil das
 *     Guthaben beim Prestige ohnehin auf 1000 Dollar faellt (`Prestige.ts:73`;
 *     die Begruendung steht ausgeschrieben in `bn4net.js:766-786`).
 *   - Fuer den Sprung selbst braucht `exit.js` einen Wirt mit genug RAM. Ist
 *     keiner da, muss einer gekauft oder `home` ausgebaut werden - und das
 *     kostet genau das Geld, das die erste Regel gerade verbrennt.
 *
 * Ohne Reserve stabilisiert sich der Fehler selbst: Der Bot gibt alles aus,
 * kann den Wirt nicht bezahlen, springt nicht, verdient weiter, gibt wieder
 * alles aus. `ausgang.js:333-346` meldet dann `wirtFehlt` und wartet auf die
 * naechste Runde - stundenlang, ohne dass etwas kaputt aussieht.
 *
 * Die Reserve wird deshalb VOR der Endspurt-Regel abgezogen.
 *
 * ===========================================================================
 * WARUM EIN ZWEITER KANAL UND NICHT geldbedarf.txt
 * ===========================================================================
 *
 * `data/geldbedarf.txt` hat heute genau einen Schreiber: `bn4rep.js:1205`,
 * fuer verdiente Augmentierungen. Gelesen wird sie an fuenf Stellen
 * (`bn4net.js:676`, `bn4life.js:249` und drei weitere ueber `geldFrei`).
 *
 * Ein zweiter Schreiber auf derselben Datei wuerde den ersten still
 * ueberschreiben - mal die Augmentierung, mal den Wirt, je nachdem wer zuletzt
 * schrieb. Das faellt nie als Fehler auf, sondern nur als "der Bot kauft
 * manchmal die Augmentierung nicht".
 *
 * Deshalb: getrennte Dateien, ein gemeinsamer Leser, Summe beim Lesen.
 *
 * ===========================================================================
 * JEDE RESERVE VERFAELLT
 * ===========================================================================
 *
 * Eine Reserve ohne Verfallsdatum ist ein Speicherleck in Geldform. Stirbt
 * `ausgang.js`, waehrend die Reserve steht, bleibt das Geld fuer immer
 * gesperrt - und niemand sucht danach, weil der Kontostand ja stimmt.
 *
 * `wirtreserve.txt` traegt deshalb ein `bis`. Ist es ueberschritten, gilt die
 * Reserve als nicht vorhanden. Der Schreiber erneuert sie in jeder Runde;
 * hoert er auf, loest sie sich von selbst auf.
 */

/** Der alte Kanal: eine nackte Zahl, ein Schreiber (bn4rep.js). */
export const KANAL_AUG = "data/geldbedarf.txt";

/** Der neue Kanal: JSON mit Verfall, geschrieben von ausgang.js. */
export const KANAL_WIRT = "data/wirtreserve.txt";

/** Wie lange eine Wirtreserve ohne Erneuerung gilt. */
export const WIRT_GUELTIG_MS = 10 * 60000;

/**
 * Liest die Augmentierungsreserve. Format unveraendert: eine nackte Zahl.
 * Diese Datei hat KEIN Verfallsdatum - sie ist der bestehende Vertrag mit
 * bn4rep.js, und ein einseitig eingefuehrter Verfall wuerde eine erarbeitete
 * Augmentierung verfallen lassen.
 */
export function augReserve(ns) {
  if (!ns.fileExists(KANAL_AUG, "home")) return 0;
  const v = Number(ns.read(KANAL_AUG));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Liest die Wirtreserve. Abgelaufene Reserven zaehlen null.
 *
 * @returns {{betrag: number, bis: number, zweck: string, abgelaufen: boolean}}
 */
export function wirtReserve(ns, jetzt) {
  const leer = { betrag: 0, bis: 0, zweck: "", abgelaufen: false };
  if (!ns.fileExists(KANAL_WIRT, "home")) return leer;
  let r;
  try {
    r = JSON.parse(ns.read(KANAL_WIRT));
  } catch {
    return leer;
  }
  if (!r || typeof r !== "object") return leer;
  const betrag = Number(r.betrag);
  const bis = Number(r.bis);
  if (!Number.isFinite(betrag) || betrag <= 0) return leer;
  if (!Number.isFinite(bis) || jetzt > bis) {
    return { betrag: 0, bis, zweck: String(r.zweck || ""), abgelaufen: true };
  }
  return { betrag, bis, zweck: String(r.zweck || ""), abgelaufen: false };
}

/**
 * Die Summe aller geltenden Reserven - das, was NICHT ausgegeben werden darf.
 *
 * @param {NS} ns
 * @param {number} jetzt Date.now()
 */
export function gesamt(ns, jetzt) {
  return augReserve(ns) + wirtReserve(ns, jetzt).betrag;
}

/**
 * Frei verfuegbares Geld auf home.
 *
 * Das ist die Zahl, gegen die jeder Kauf zu pruefen ist. Ein Kauf, der
 * `getServerMoneyAvailable` direkt nimmt, umgeht beide Reserven.
 */
export function frei(ns, jetzt) {
  return ns.getServerMoneyAvailable("home") - gesamt(ns, jetzt);
}

/**
 * Setzt oder erneuert die Wirtreserve.
 *
 * Der Schreiber ruft das in JEDER Runde auf, solange der Sprung naht. Das
 * Verfallsdatum wandert dabei mit; hoert der Schreiber auf, loest sich die
 * Reserve nach WIRT_GUELTIG_MS von selbst auf.
 *
 * @param {NS} ns
 * @param {number} betrag Dollar
 * @param {number} jetzt Date.now()
 * @param {string} zweck kurze Begruendung, landet in der Datei
 */
export function setzeWirtReserve(ns, betrag, jetzt, zweck = "Wirt fuer exit.js") {
  const b = Number(betrag);
  if (!Number.isFinite(b) || b <= 0) return loescheWirtReserve(ns);
  const inhalt = JSON.stringify({
    betrag: Math.round(b),
    bis: jetzt + WIRT_GUELTIG_MS,
    zweck,
    gesetztAm: jetzt,
  });
  ns.write(KANAL_WIRT, inhalt, "w");
  if (ns.getHostname() !== "home") {
    try { ns.scp(KANAL_WIRT, "home", ns.getHostname()); } catch { /* egal */ }
  }
  return b;
}

/**
 * Loescht die Wirtreserve.
 *
 * NICHT ueber `ns.rm` - die Datei liegt auf home, das aufrufende Skript
 * womoeglich woanders, und ein fehlgeschlagenes rm bliebe unbemerkt. Ein
 * geschriebener Nullbetrag ist auf jedem Weg eindeutig.
 */
export function loescheWirtReserve(ns) {
  ns.write(KANAL_WIRT, JSON.stringify({ betrag: 0, bis: 0, zweck: "" }), "w");
  if (ns.getHostname() !== "home") {
    try { ns.scp(KANAL_WIRT, "home", ns.getHostname()); } catch { /* egal */ }
  }
  return 0;
}

/**
 * Reine Rechenfunktion fuer die Tests - dieselbe Logik ohne ns.
 *
 * Sie existiert, weil die Verfallslogik der Teil ist, der still versagt, und
 * eine Pruefung im laufenden Spiel dafuer zu langsam ist: der Fall tritt erst
 * zehn Minuten nach dem Tod des Schreibers ein.
 */
export function gilt(reserve, jetzt) {
  if (!reserve || typeof reserve !== "object") return false;
  const betrag = Number(reserve.betrag);
  const bis = Number(reserve.bis);
  if (!Number.isFinite(betrag) || betrag <= 0) return false;
  if (!Number.isFinite(bis)) return false;
  return jetzt <= bis;
}
