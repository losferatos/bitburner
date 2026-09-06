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
/**
 * Der Ordner, ab dem das Spiel Importe aufloest - also `home`.
 *
 * DAS WAR BIS ZUM 04.09.2026 SCHLICHT `path.dirname(datei)` (gefunden beim
 * Bau von tools/test-lader.js). Fuer die grossen Skripte stimmte das, weil
 * sie im Wurzelverzeichnis liegen. Fuer ein Modul im Unterordner nicht:
 * `lib/figurns.js` importiert `lib/figur.js`, und der Lader suchte das unter
 * `src/lib/lib/figur.js`.
 *
 * Das Spiel kennt keine Unterordner-Wurzeln - `isAbsolutePath`
 * (`Paths/Directory.ts:46-48`) macht aus jedem Pfad ohne fuehrenden Punkt
 * einen ab home. Also wird hier bis zum `src` hochgelaufen.
 */
function heimatOrdner(datei) {
  let o = path.dirname(path.resolve(datei));
  for (let i = 0; i < 8; i++) {
    if (path.basename(o) === "src") return o;
    const hoch = path.dirname(o);
    if (hoch === o) break;
    o = hoch;
  }
  // KEIN src IM PFAD - der Rueckfall, und er ist LAUT (Skeptiker Runde 5, W6).
  //
  // Er stellt genau den Fehler wieder her, gegen den `heimatOrdner` gebaut ist:
  // ein Modul im Unterordner sucht sein Geschwister dann unter `lib/lib/`. Das
  // still zu tun hiesse, einen Testlauf auf einem anderen Rechner oder in einem
  // anderen Ordner mit einer unerklaerlichen Fehlermeldung enden zu lassen.
  //
  // Der andere Randfall bleibt: liegen ZWEI Ordner namens `src` im Pfad -
  // etwa ein Klon unter `D:\srcitburner` -, gewinnt der naechstgelegene.
  // Das ist meist richtig und im Zweifel ueber diese Meldung erkennbar.
  console.log("  [lader] WARNUNG: kein 'src' im Pfad von " + datei
    + " - Importe werden ab dem Dateiordner aufgeloest. Ein Modul im"
    + " Unterordner wird sein Geschwister nicht finden.");
  return path.dirname(path.resolve(datei));
}

/** Ein Pfad, den Node als relativ erkennt (mit "/" statt Backslash). */
function relativ(von, ziel) {
  const r = path.relative(von, ziel).split(path.sep).join("/");
  // NICHT nur auf einen Punkt pruefen: die Kopien heissen ".mock-...", und
  // ".mock-figur-123.mjs" faengt zwar mit einem Punkt an, ist fuer Node aber
  // ein Paketname und kein Pfad (ERR_INVALID_MODULE_SPECIFIER).
  return (r.startsWith("./") || r.startsWith("../")) ? r : "./" + r;
}

/**
 * LEICHEN FRUEHERER LAEUFE WEGRAEUMEN (Skeptiker Runde 5, W1, 04.09.2026).
 *
 * Das `finally` unten laeuft bei Strg-C, `kill` oder einem Absturz NICHT.
 * Gemessen: ein SIGTERM waehrend `await import` laesst die Kopien stehen -
 * und danach sind sechs Ebene-2-Tests rot, ohne dass am geprueften Code etwas
 * fehlt. Fuenf davon schauen nur in die Wurzel von `src/`, eine Leiche in
 * `src/lib/` sieht allein `test-lader.js`.
 *
 * Geloescht wird nur, was den eigenen Namensstempel traegt UND zu einer
 * Prozessnummer gehoert, die es nicht mehr gibt. `process.kill(pid, 0)`
 * sendet kein Signal, es fragt nur nach - und wirft ESRCH, wenn der Prozess
 * weg ist. Bei wiederverwendeter Nummer bleibt die Datei liegen; das ist die
 * harmlose Richtung.
 */
function raeumeLeichen(ordner, tiefe = 0) {
  if (tiefe > 3) return;
  let eintraege;
  try { eintraege = fs.readdirSync(ordner, { withFileTypes: true }); }
  catch { return; }
  for (const e of eintraege) {
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) { raeumeLeichen(voll, tiefe + 1); continue; }
    const m = /^\.mock-.*-(\d+)\.mjs$/.exec(e.name);
    if (!m) continue;
    const pid = Number(m[1]);
    if (pid === process.pid) continue;
    let lebt = true;
    try { process.kill(pid, 0); } catch { lebt = false; }
    if (!lebt) {
      try {
        fs.unlinkSync(voll);
        if (process.env.LADER_LAUT) console.log("  [lader] Leiche entfernt: " + e.name);
      } catch { /* egal */ }
    }
  }
}

export async function ladeSpielskript(datei) {
  const quelle = fs.readFileSync(datei, "utf8");
  // `ordner` ist die HEIMAT, nicht der Ordner der Datei - siehe oben.
  const ordner = heimatOrdner(datei);
  const bei = path.dirname(path.resolve(datei));

  // `from "lib/x.js"` -> ein Pfad relativ zur Datei, aber aufgeloest ab
  // HEIMAT. Nur, wenn der Pfad nicht schon relativ ist und kein Node-Paket
  // meint - Bitburner-Pfade beginnen nie mit "node:" oder "@".
  const umgeschrieben = quelle.replace(
    /(\bfrom\s+["'])(?!\.{1,2}\/|node:|@|https?:)([^"']+)(["'])/g,
    (_, a, pfad, z) => a + relativ(bei, path.resolve(ordner, pfad)) + z,
  );

  // Ein Bitburner-Import darf die Endung weglassen ("lib/calc"). Node darf das
  // nicht - die fehlende Endung wird ergaenzt, wenn die Datei so existiert.
  const mitEndung = umgeschrieben.replace(
    /(\bfrom\s+["'])(\.\.?\/[^"']+?)(["'])/g,
    (ganz, a, pfad, z) => {
      if (/\.[a-z]+$/i.test(pfad)) return ganz;
      const kandidat = path.resolve(bei, pfad + ".js");
      return fs.existsSync(kandidat) ? a + pfad + ".js" + z : ganz;
    },
  );

  // DER NAME EINER KOPIE - an EINER Stelle, fuer alle Ebenen gleich
  // (R29, Skeptiker Runde 4, 04.09.2026).
  //
  // Die Hauptdatei trug seit jeher die Prozessnummer im Namen, die
  // transitiven Kopien nicht: `lib/figur.js` wurde schlicht zu
  // `lib/figur.mjs`. Zwei gleichzeitige Testlaeufe schrieben damit dieselbe
  // Datei und loeschten im `finally` die des jeweils anderen - mitten in
  // dessen Import.
  //
  // Aufgefallen ist es nicht, weil `tools/test-alles.js` seriell laeuft. Das
  // ist eine Eigenschaft des Laeufers, keine der Sache: wer zwei Tests in
  // zwei Fenstern startet, bekam ein Verhalten, das aussieht wie ein Fehler
  // im geprueften Code.
  //
  // Und es ist mehr als eine Unbequemlichkeit: diese Dateien liegen unter
  // `src/`, und `src/` geht ueber die Bruecke ins laufende Spiel.
  const mockPfad = (absPfad) => path.join(
    path.dirname(absPfad),
    ".mock-" + path.basename(absPfad, ".js") + "-" + process.pid + ".mjs");

  raeumeLeichen(ordner);

  const ziel = mockPfad(path.resolve(datei));
  fs.writeFileSync(ziel, mitEndung, "utf8");

  // TRANSITIV, NICHT NUR EINE EBENE (04.09.2026).
  //
  // Hier wurde nur die geladene Datei umgeschrieben. Importiert sie ein Modul,
  // das SEINERSEITS im Spielstil importiert - `lib/figurns.js` holt
  // `lib/figur.js` -, findet Node beim zweiten Sprung wieder ein Paket namens
  // "lib". Der Test bricht dann mit ERR_MODULE_NOT_FOUND ab, und zwar erst,
  // wenn jemand eine solche Kette baut: bis zum 04.09. hatte kein lib-Modul
  // eigene Importe.
  //
  // Die Kopien liegen NEBEN den Originalen, damit die relativen Pfade
  // stimmen, und werden im finally alle wieder entfernt.
  const kopien = [ziel];
  const erledigt = new Set([path.resolve(datei)]);
  const schlange = [datei];
  while (schlange.length) {
    const aktuell = schlange.shift();
    const quelleJetzt = fs.readFileSync(aktuell, "utf8");
    for (const m of quelleJetzt.matchAll(
      /\bfrom\s+["'](?!\.{1,2}\/|node:|@|https?:)([^"']+)["']/g)) {
      let rel = m[1];
      if (!/\.[a-z]+$/i.test(rel)) rel += ".js";
      // Bitburner loest absolut ab home auf - also ab dem Ordner der
      // urspruenglich geladenen Datei.
      const abs = path.resolve(ordner, rel);
      if (erledigt.has(abs) || !fs.existsSync(abs)) continue;
      erledigt.add(abs);
      schlange.push(abs);
      const kopie = mockPfad(abs);
      const inhalt = fs.readFileSync(abs, "utf8")
        .replace(/(\bfrom\s+["'])(?!\.{1,2}\/|node:|@|https?:)([^"']+)(["'])/g,
          (ganz, a, p2, z) => {
            const zielAbs = path.resolve(ordner,
              /\.[a-z]+$/i.test(p2) ? p2 : p2 + ".js");
            if (!fs.existsSync(zielAbs)) return ganz;
            return a + relativ(path.dirname(abs), mockPfad(zielAbs)) + z;
          });
      fs.writeFileSync(kopie, inhalt, "utf8");
      kopien.push(kopie);
    }
  }
  // Die Hauptdatei muss auf die Kopien zeigen, nicht auf die Originale.
  const vorher = fs.readFileSync(ziel, "utf8");
  const nachher = vorher.replace(/(from\s+["'])(\.\.?\/[^"']+?)\.js(["'])/g,
    (ganz, a, p2, z) => {
      const zielAbs = path.resolve(bei, p2 + ".js");
      if (!fs.existsSync(mockPfad(zielAbs))) return ganz;
      return a + relativ(bei, mockPfad(zielAbs)) + z;
    });
  fs.writeFileSync(ziel, nachher, "utf8");
  if (process.env.LADER_LAUT) {
    console.log("  [lader] " + kopien.length + " Kopie(n), umgeschrieben: "
      + (vorher !== nachher));
  }

  try {
    // Der Zeitstempel im Namen umgeht Nodes Modul-Zwischenspeicher, damit ein
    // Test die Datei nach einer Aenderung erneut laden kann.
    return await import(pathToFileURL(ziel).href + "?t=" + Date.now());
  } finally {
    // Immer aufraeumen, auch wenn der Import wirft. Eine liegengebliebene
    // .mock-Datei unter src/ ginge ueber die Bruecke ins laufende Spiel.
    for (const k of kopien) {
      try { fs.unlinkSync(k); } catch { /* egal */ }
    }
  }
}

/**
 * Sucht ein Skript in der Live-Arbeitskopie und laedt es.
 *
 * Bis zum 06.09.2026 stand der Bau-Worktree `../bitburner-bau/src` VORN in
 * dieser Liste - richtig, solange dort gebaut wurde. Seit dem Merge am
 * 04.09. ist der Zweig vollstaendig in master; der Worktree blieb aber
 * stehen, 15 Commits hinter master, ohne `lib/hostdatei.js`. Jeder gruene
 * Ebene-2-Lauf seit dem 04.09. 17:45 hat damit den ALTEN Baum geprueft, und
 * genau die Reparatur, die am 06.09. den Haenger geloest hat, war darin
 * nicht enthalten. Der Worktree wird nur noch genommen, wenn `src/` die
 * Datei nicht hat - also praktisch nie.
 */
export async function ladeAusBeiden(root, rel) {
  const kandidaten = [
    path.join(root, "src", rel),
    path.resolve(root, "..", "bitburner-bau", "src", rel),
  ];
  const t = kandidaten.find((p) => fs.existsSync(p));
  if (!t) throw new Error("src/" + rel + " nicht gefunden (weder Worktree noch live)");
  return { modul: await ladeSpielskript(t), pfad: t };
}
