/**
 * Popup-Waechter: schliesst die aufgelaufenen Spiel-Dialoge von selbst.
 *
 * WIE ES GEHT
 * AlertManager.tsx:40-47 haengt einen keydown-Handler an document, der bei
 * "Escape" die GANZE Warteschlange auf einmal leert (setAlerts([])) - nicht
 * nur den obersten Dialog. Der Handler prueft weder isTrusted noch
 * canBeDismissedEasily; ein synthetisch abgeschicktes KeyboardEvent tut es
 * also genauso wie ein Tastendruck. Genau deshalb braucht es hier keinen
 * Browser von aussen.
 *
 * WARUM globalThis["document"]
 * Die RAM-Rechnung sucht nur den woertlichen Bezeichner "document"
 * (RamCalculations.ts:185-192) und sieht in Zeichenketten nie hinein. Ueber
 * die Zeichenkette gelesen kostet der Zugriff also nichts statt 25 GB. Das
 * ist derselbe Kniff, den src/exploit.js fuer den Bypass-Exploit benutzt.
 *
 * WARUM NICHT EINFACH IM TAKT DRUECKEN
 * Escape schliesst auch andere Oberflaechenteile. Wer im Spiel gerade ein
 * Menue offen hat, bekaeme es unter den Haenden weggeraeumt. Deshalb wird
 * vorher geprueft, ob ueberhaupt ein Dialog offen ist, und nur dann gefeuert.
 *
 * Aufruf: run popups.js   (laeuft dauerhaft, ~2 GB)
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const doc = globalThis["document"];
  const TAKT_MS = 15000;
  let geschlossen = 0;

  // MUI rendert jeden offenen Dialog als .MuiModal-root im Koerper. Ist
  // keiner da, gibt es nichts zu tun - dann bleibt die Escape-Taste in Ruhe.
  const dialogOffen = () => !!doc.querySelector(".MuiModal-root");

  while (true) {
    try {
      if (dialogOffen()) {
        // Zweimal mit Abstand: der erste Schlag leert die Alert-Warteschlange,
        // ein zweiter erwischt einen Dialog, der erst dadurch sichtbar wurde.
        for (let i = 0; i < 2; i++) {
          doc.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Escape", code: "Escape", keyCode: 27, which: 27,
            bubbles: true, cancelable: true,
          }));
          await ns.sleep(120);
        }
        if (!dialogOffen()) {
          geschlossen++;
          ns.print(`Dialoge geschlossen (${geschlossen}. Mal).`);
        }
      }
      ns.write("data/popups.txt", `${Date.now()}|${geschlossen}`, "w");
    } catch (e) {
      ns.print("FEHLER: " + String(e && e.message ? e.message : e));
      await ns.sleep(60000);
    }
    await ns.sleep(TAKT_MS);
  }
}
