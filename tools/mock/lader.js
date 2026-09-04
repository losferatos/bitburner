/**
 * Laedt ein Bitburner-Skript in Node - trotz der Importe im Spielstil.
 *
 * ===========================================================================
 * DAS HINDERNIS
 * ===========================================================================
 *
 * Bitburner loest Importe ABSOLUT AB home auf: `import { x } from "lib/y.js"`.
 * Node kennt das nicht und sucht ein Paket namens `lib`. Deshalb liess sich
 * bisher keine Datei mit Importen aus Node heraus laden - und genau die
 * grossen sind es, die Importe haben: `bn4net.js`, `ausgang.js`, `exit.js`,
 * `bn4rep.js`.
 *
 * Die Folge war eine Luecke, die im Testregister als "Ebene 2 fehlt" stand:
 * geprueft wurden reine Funktionen (Ebene 0) und der echte Browser (Ebene 3),
 * dazwischen nichts. Der Motorzeit-Einbau in den Kern, die Registry-Aufloesung
 * und der Strafleiter-Automat liegen alle in dieser Luecke.
 *
 * ===========================================================================
 * DER WEG
 * ===========================================================================
 *
 * Den Quelltext lesen, die Importpfade auf relative umschreiben, das Ergebnis
 * in eine Wegwerfdatei neben das Original legen und von dort importieren.
 * "Neben das Original", weil die relativen Importe dann weiter stimmen.
 *
 * Umgeschrieben wird NUR die Importzeile. Am Rest der Datei aendert sich
 * nichts - was laeuft, ist derselbe Code, den das Spiel ausfuehrt. Ein Lader,
 * der den Prueflingsgegenstand veraendert, prueft etwas anderes als das, was
 * spaeter laeuft.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} datei absoluter Pfad zur Skriptdatei
 * @returns {Promise<object>} das Modul
 */
export async function ladeSpielskript(datei) {
  const quelle = fs.readFileSync(datei, "utf8");
  const ordner = path.dirname(datei);

  // `from "lib/x.js"` -> `from "./lib/x.js"`, aber nur, wenn der Pfad nicht
  // schon relativ ist und kein Node-Paket meint. Bitburner-Pfade beginnen nie
  // mit "node:" oder "@".
  const umgeschrieben = quelle.replace(
    /(\bfrom\s+["'])(?!\.{1,2}\/|node:|@|https?:)([^"']+)(["'])/g,
    (_, a, pfad, z) => a + "./" + pfad + z,
  );

  // Ein Bitburner-Import darf die Endung weglassen ("lib/calc"). Node darf das
  // nicht - die fehlende Endung wird ergaenzt, wenn die Datei so existiert.
  const mitEndung = umgeschrieben.replace(
    /(\bfrom\s+["'])(\.\/[^"']+?)(["'])/g,
    (ganz, a, pfad, z) => {
      if (/\.[a-z]+$/i.test(pfad)) return ganz;
      const kandidat = path.join(ordner, pfad + ".js");
      return fs.existsSync(kandidat) ? a + pfad + ".js" + z : ganz;
    },
  );

  const name = ".mock-" + path.basename(datei, ".js") + "-" + process.pid + ".mjs";
  const ziel = path.join(ordner, name);
  fs.writeFileSync(ziel, mitEndung, "utf8");

  try {
    // Der Zeitstempel im Namen umgeht Nodes Modul-Zwischenspeicher, damit ein
    // Test die Datei nach einer Aenderung erneut laden kann.
    return await import(pathToFileURL(ziel).href + "?t=" + Date.now());
  } finally {
    // Immer aufraeumen, auch wenn der Import wirft. Eine liegengebliebene
    // .mock-Datei unter src/ ginge ueber die Bruecke ins laufende Spiel.
    try { fs.unlinkSync(ziel); } catch { /* egal */ }
  }
}

/**
 * Sucht ein Skript im Worktree oder in der Live-Arbeitskopie und laedt es.
 * Der Worktree hat Vorrang, solange eine Position dort noch gebaut wird.
 */
export async function ladeAusBeiden(root, rel) {
  const kandidaten = [
    path.resolve(root, "..", "bitburner-bau", "src", rel),
    path.join(root, "src", rel),
  ];
  const t = kandidaten.find((p) => fs.existsSync(p));
  if (!t) throw new Error("src/" + rel + " nicht gefunden (weder Worktree noch live)");
  return { modul: await ladeSpielskript(t), pfad: t };
}
