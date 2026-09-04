/**
 * Schreibt dieses Gewerk seine Telemetriedatei wirklich?
 *
 * ===========================================================================
 * WARUM DAS EIN EIGENES MODUL IST
 * ===========================================================================
 *
 * Die Pruefung stand bis zum 04.09.2026 mitten in `tools/registry-bauen.js`,
 * einem Skript mit Nebenwirkung im Hauptteil (es schreibt `registry.json`).
 * Ein Test konnte sie deshalb nicht importieren, ohne den Generator laufen zu
 * lassen - und ungetestet blieb ausgerechnet die Pruefung, die den
 * gefaehrlichsten Registry-Fehler abfaengt.
 *
 * ===========================================================================
 * WOGEGEN SIE GEBAUT IST
 * ===========================================================================
 *
 * Ein `telemetryFile`, das niemand schreibt, ist schlimmer als gar keines.
 * Der Kern misst das Alter der Datei; existiert sie nicht, gilt "seit dem
 * Start" als Alter (`bn4net.js`, Abschnitt Telemetriealter). Der Kern wird
 * damit zum Totengraeber seines eigenen Werkzeugs, im Takt der Frischefrist -
 * er erschlaegt es, startet es neu, misst wieder nichts, erschlaegt es wieder.
 *
 * In der ersten Fassung der Registry standen ACHT solcher Namen, alle
 * plausibel gebildet ("data/<name>.json"), keiner mit einem Schreiber.
 *
 * ===========================================================================
 * WAS GILT
 * ===========================================================================
 *
 * Zwei Formen, beide woertlich:
 *
 *   1. `ns.write("data/x.json", ...)`      - der Name steht im Aufruf
 *   2. `const X = "data/x.json";` UND `ns.write(X, ...)`
 *
 * Form 2 kam am 04.09.2026 dazu (R27). `contracts.js` fuehrt seine Dateinamen
 * seit jeher als Konstanten - das ist die bessere Schreibweise, und die
 * Pruefung hat sie schlicht nicht gekannt.
 *
 * Bewusst OHNE regulaeren Ausdruck. Ein Muster, das zu viel akzeptiert, laesst
 * genau den Fehler durch, gegen den hier geprueft wird; die beiden
 * Zeichenkettensuchen koennen sich am Escaping nicht vertun.
 */

/**
 * Namen, die als Schreibaufruf zaehlen.
 *
 * `ns.write` ist der einzige echte Schreibbefehl des Spiels; die drei anderen
 * sind Hausformen, die ihn kapseln (meist um ein `ns.scp` nach home zu
 * ergaenzen). Sie stehen hier ausdruecklich, statt ueber ein Muster erraten zu
 * werden.
 */
export const SCHREIBER = ["ns.write", "nachHome", "schreib", "schreibe"];

/**
 * @param {string} txt Quelltext des Gewerks
 * @param {string} datei der Name aus `telemetryFile`
 * @param {string[]} schreiber ueberschreibbar fuer Tests
 * @returns {{ok: boolean, form: string|null, bezeichner: string|null}}
 */
export function schreiberprobe(txt, datei, schreiber = SCHREIBER) {
  if (!txt || !datei) return { ok: false, form: null, bezeichner: null };

  // Form 1: der Name steht woertlich im Aufruf.
  for (const fn of schreiber) {
    if (txt.includes(fn + '("' + datei + '"')) {
      return { ok: true, form: "literal", bezeichner: null };
    }
  }

  // Form 2: Konstante mit genau diesem Namen, und ein Aufruf mit genau
  // diesem Bezeichner. BEIDE Teile sind noetig - eine Konstante allein ist
  // kein Schreibvorgang, und ein Aufruf mit irgendeinem Bezeichner sagt
  // nichts ueber die Datei.
  const marke = ' = "' + datei + '";';
  const pos = txt.indexOf(marke);
  if (pos > 0) {
    const davor = txt.slice(0, pos).split("\n").pop().trim();
    const teile = davor.split(/\s+/);
    const bez = teile.length === 2 && teile[0] === "const" ? teile[1] : null;
    if (bez) {
      for (const fn of schreiber) {
        if (txt.includes(fn + "(" + bez + ",")) {
          return { ok: true, form: "konstante", bezeichner: bez };
        }
      }
    }
  }

  return { ok: false, form: null, bezeichner: null };
}
