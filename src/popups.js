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

  // React 17 legt die Host-Props als __reactProps$<zufall> auf den DOM-Knoten.
  // Ein .click() geht bei MUI-Knoepfen oft ins Leere (im Projekt 22-mal am
  // TOR-Knopf belegt, src/darkweb.js:178-184), der Aufruf des Handlers nicht.
  const reactKlick = (el) => {
    for (const k of Object.keys(el)) {
      if (!k.startsWith("__reactProps$")) continue;
      const props = el[k];
      if (props && typeof props.onClick === "function") { props.onClick(); return true; }
    }
    el.click();
    return true;
  };

  // Nur Knoepfe, die nichts entscheiden und nichts zerstoeren. "Join" steht
  // bewusst NICHT dabei: ob eine Faktion betreten wird, entscheidet bn4rep -
  // manche Faktionen sind untereinander verfeindet und sperren sich
  // gegenseitig bis zum naechsten Einbau (FactionInvitationManager.tsx:56-58).
  // Die Einladung bleibt nach "Decide later" bestehen und geht nicht verloren.
  const HARMLOS = ["decide later", "close", "cancel", "ok", "dismiss", "later", "got it"];

  const knoepfeSchliessen = () => {
    let getan = 0;
    for (const modal of doc.querySelectorAll(".MuiModal-root")) {
      for (const b of modal.querySelectorAll("button")) {
        const t = (b.textContent || "").trim().toLowerCase();
        if (!HARMLOS.includes(t)) continue;
        try { reactKlick(b); getan++; } catch { /* naechster Knopf */ }
        break;   // je Dialog nur einen Knopf
      }
    }
    return getan;
  };

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
        // Was Escape nicht erwischt hat, hat einen eigenen Handler am Modal
        // statt am Dokument - Ereignisse blubbern nach oben, nicht nach unten.
        // Solche Dialoge werden ueber ihren Knopf geschlossen. Mehrere Runden,
        // weil hinter einem Dialog der naechste warten kann: die Einladungen
        // stehen in einer Liste und close() nimmt nur die erste heraus
        // (FactionInvitationManager.tsx:45-49).
        for (let runde = 0; runde < 12 && dialogOffen(); runde++) {
          if (!knoepfeSchliessen()) break;
          await ns.sleep(150);
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
