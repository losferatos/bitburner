/**
 * Liest den BitVerse-Bildschirm - und waehlt auf Wunsch einen BitNode.
 *
 * Nach dem Backdoor auf w0r1d_d43m0n schickt das Spiel den Spieler direkt
 * dorthin (Terminal/commands/backdoor.ts:61). Der BitNode ist damit
 * abgeschlossen, verlassen wird er aber erst mit der Wahl des naechsten - und
 * genau dann gibt es das Source-File.
 *
 * Aufruf:  node tools/task.js bitverse.js            nur nachsehen
 *          node tools/task.js bitverse.js 1          BitNode 1 erneut
 *          node tools/task.js bitverse.js 4          BitNode 4 waehlen
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const ziel = Number(ns.args[0]);
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/bitverse.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/bitverse.txt", "home", ns.getHostname());
  };

  const text = (doc.body.innerText || "");
  const imVerse = /BitVerse|Bitverse|which BitNode|Enter The BitNode/i.test(text);
  sag("Seite zeigt BitVerse: " + (imVerse ? "JA" : "nein"));
  if (!imVerse) {
    sag("Seitenanfang: " + text.slice(0, 260).replace(/\s+/g, " "));
    return;
  }

  // Im BitVerse ist jeder BitNode ein anklickbares Element. Die Beschriftung
  // traegt die Nummer.
  const kandidaten = [...doc.querySelectorAll("button, [role='button'], a, span, div")]
    .filter((e) => e.children.length === 0 && /BitNode-?\s*\d+/i.test(e.textContent || ""));
  const gefunden = [...new Set(kandidaten.map((e) => (e.textContent || "").trim()))];
  sag("Gefundene BitNode-Beschriftungen (" + gefunden.length + "):");
  for (const g of gefunden.slice(0, 20)) sag("  " + g.slice(0, 70));

  if (!Number.isFinite(ziel) || ziel < 1) {
    sag("Kein Ziel angegeben - es wurde nichts angeklickt.");
    return;
  }

  const treffer = kandidaten.find((e) => {
    const m = (e.textContent || "").match(/BitNode-?\s*(\d+)/i);
    return m && Number(m[1]) === ziel;
  });
  if (!treffer) return sag("BitNode " + ziel + " nicht auf der Seite gefunden.");

  // Vom Blatt aufsteigen, bis ein klickbares Element kommt.
  let el = treffer;
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    if (el.tagName === "BUTTON" || el.getAttribute?.("role") === "button" || el.onclick) break;
  }
  (el || treffer).click();
  sag("BitNode " + ziel + " angeklickt.");
}
