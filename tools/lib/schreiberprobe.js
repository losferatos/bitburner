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
 * DIE GEFAEHRLICHE RICHTUNG IST DAS FALSCH-POSITIV
 * ===========================================================================
 *
 * Das ist die Lehre aus Skeptikerrunde 5 (04.09.2026). Die erste Fassung
 * dieses Moduls trug den Kommentar "bewusst ohne regulaeren Ausdruck, die
 * Zeichenkettensuche kann sich am Escaping nicht vertun". Das Argument traegt
 * nicht: Escaping ist ein geloestes Problem, und gemessen hatte die
 * Textsuche DREI Falsch-Positive und FUENF Falsch-Negative.
 *
 * Die drei Falsch-Positive waren die schlimmen - sie lassen genau den Fehler
 * durch, gegen den das Modul gebaut ist:
 *
 *   1. Eine AUSKOMMENTIERTE Schreibzeile galt als Schreiber.
 *   2. `beschreibe("data/x.json", …)` galt als Schreiber, weil `schreibe`
 *      eine Teilzeichenkette davon ist.
 *   3. Eine lokal beschattete Konstante mit anderem Wert galt als Schreiber.
 *
 * Und ein Falsch-Negativ war fast so schlimm: `export const X = "…"` wurde
 * abgelehnt, obwohl das die im Projekt uebliche Schreibweise ist. Ein
 * Generator, der zu Unrecht ablehnt, wird abgeschaltet.
 *
 * ===========================================================================
 * WAS GILT
 * ===========================================================================
 *
 * Zuerst werden Kommentare entfernt (Zeilen- und Blockkommentare). Dann zwei
 * Formen, beide woertlich, beide mit Wortgrenze vor dem Aufrufnamen:
 *
 *   1. `ns.write("data/x.json", …)`  - der Name steht im Aufruf
 *   2. `const X = "data/x.json";` oder `export const X = "…";`
 *      UND `ns.write(X, …)`
 *
 * Zeichenketten duerfen in beiden Formen doppelt ODER einfach begrenzt sein.
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
 * Kommentare heraus. Grob, aber in die sichere Richtung: ein Schreibaufruf,
 * der faelschlich als Kommentar gilt, erzeugt eine Beanstandung - die faellt
 * auf. Ein Kommentar, der faelschlich als Code gilt, winkt einen Namen ohne
 * Schreiber durch - und den sieht niemand.
 *
 * Zeichenketten mit `//` darin (etwa "https://…") wuerden hier gekuerzt. Das
 * ist hingenommen: ein Dateiname im Spiel enthaelt kein `//`.
 */
export function ohneKommentare(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Steht an Position `i` wirklich der Aufrufname - oder nur sein Ende?
 * `beschreibe(` endet auf `schreibe(`, und das darf nicht zaehlen.
 */
function eigenstaendig(txt, i) {
  if (i === 0) return true;
  return !/[A-Za-z0-9_$.]/.test(txt[i - 1]);
}

/** Kommt `fn(<arg>` im Text vor, mit Wortgrenze davor? */
function ruftAuf(txt, fn, arg) {
  const muster = fn + "(" + arg;
  let i = txt.indexOf(muster);
  while (i !== -1) {
    if (eigenstaendig(txt, i)) return true;
    i = txt.indexOf(muster, i + 1);
  }
  return false;
}

/**
 * @param {string} txt Quelltext des Gewerks
 * @param {string} datei der Name aus `telemetryFile`
 * @param {string[]} schreiber ueberschreibbar fuer Tests
 * @returns {{ok: boolean, form: string|null, bezeichner: string|null}}
 */
export function schreiberprobe(txt, datei, schreiber = SCHREIBER) {
  if (!txt || !datei) return { ok: false, form: null, bezeichner: null };
  const code = ohneKommentare(txt);

  // Form 1: der Name steht woertlich im Aufruf - doppelt oder einfach begrenzt.
  for (const fn of schreiber) {
    for (const q of ['"', "'"]) {
      if (ruftAuf(code, fn, q + datei + q)) {
        return { ok: true, form: "literal", bezeichner: null };
      }
    }
  }

  // Form 2: Konstante mit genau diesem Namen, und ein Aufruf mit genau
  // diesem Bezeichner. BEIDE Teile sind noetig - eine Konstante allein ist
  // kein Schreibvorgang, und ein Aufruf mit irgendeinem Bezeichner sagt
  // nichts ueber die Datei.
  //
  // Beschattung: kommt derselbe Bezeichner mehrfach als Konstante vor und
  // zeigt eine davon auf eine ANDERE Datei, gilt er nicht. Lieber eine
  // Beanstandung zu viel als ein Name ohne Schreiber.
  for (const q of ['"', "'"]) {
    const marke = " = " + q + datei + q + ";";
    let pos = code.indexOf(marke);
    while (pos > 0) {
      const davor = code.slice(0, pos).split("\n").pop().trim();
      const teile = davor.split(/\s+/);
      let bez = null;
      if (teile.length === 2 && teile[0] === "const") bez = teile[1];
      if (teile.length === 3 && teile[0] === "export" && teile[1] === "const") bez = teile[2];
      if (bez) {
        // Wird derselbe Bezeichner anderswo auf etwas anderes gesetzt?
        const andere = new RegExp(
          "(?:^|\\s)(?:export\\s+)?const\\s+" + bez.replace(/[$]/g, "\\$")
          + "\\s*=\\s*[\"'](?!" + datei.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\"'])",
          "m");
        if (!andere.test(code)) {
          for (const fn of schreiber) {
            // Erlaubt `ns.write(X,` und `ns.write(X ,` - Leerzeichen vor dem
            // Komma ist eine Formatierung, keine andere Bedeutung.
            if (ruftAuf(code, fn, bez + ",") || ruftAuf(code, fn, bez + " ,")) {
              return { ok: true, form: "konstante", bezeichner: bez };
            }
          }
        }
      }
      pos = code.indexOf(marke, pos + 1);
    }
  }

  return { ok: false, form: null, bezeichner: null };
}
