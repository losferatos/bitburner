// Haken fuer tools/audit/catch-instrument.mjs. Aufruf: node --import <diese Datei> <Test>
// Schreibt beim Prozessende JSON-Zeilen in die Datei $CATCH_HOOK_AUS (angehaengt):
//   {datei, zeile, klasse, nachricht, n, test}    ein catch wurde betreten (Fehlerklasse + Meldung)
//   {art:"try", datei, zeile, n, test}            ein try-Block wurde betreten (Abdeckung)
// Ohne die Umgebungsvariable passiert nichts.

import fs from "node:fs";

const aus = process.env.CATCH_HOOK_AUS;
if (aus) {
  const tab = new Map();
  const eintritt = new Map();
  globalThis.__ct = (datei, zeile) => {
    const k = datei + "|" + zeile;
    eintritt.set(k, (eintritt.get(k) ?? 0) + 1);
  };
  globalThis.__cc = (datei, zeile, fehler) => {
    const klasse = fehler && fehler.constructor ? fehler.constructor.name : typeof fehler;
    const nachricht = String(fehler && fehler.message !== undefined ? fehler.message : fehler).replace(/\s+/g, " ").slice(0, 200);
    const schluessel = datei + "|" + zeile + "|" + klasse + "|" + nachricht;
    tab.set(schluessel, (tab.get(schluessel) ?? 0) + 1);
  };
  process.on("exit", () => {
    try {
      const test = process.argv[1] ? process.argv[1].split(/[\\/]/).pop() : "?";
      const zeilen = [];
      for (const [k, n] of tab) {
        const teile = k.split("|");
        zeilen.push(JSON.stringify({ datei: teile[0], zeile: Number(teile[1]), klasse: teile[2], nachricht: teile.slice(3).join("|"), n, test }));
      }
      for (const [k, n] of eintritt) {
        const teile = k.split("|");
        zeilen.push(JSON.stringify({ art: "try", datei: teile[0], zeile: Number(teile[1]), n, test }));
      }
      if (zeilen.length) fs.appendFileSync(aus, zeilen.join(String.fromCharCode(10)) + String.fromCharCode(10));
    } catch { /* egal */ }
  });
}
