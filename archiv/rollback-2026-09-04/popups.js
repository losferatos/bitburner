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
 * ZWEITE AUFGABE: WACHE UEBER bn4net.js (23.08.2026)
 *
 * Der Bot hat eine Wachkette - boot.js startet bn4net, bn4life startet bn4net
 * nach, bn4net startet alles Uebrige. Nach einem BitNode-Wechsel fehlt genau
 * ein Glied: bn4life ist dort 293,8 GB gross (Singularity kostet ausserhalb
 * von BitNode 4 das Sechzehnfache) und laeuft stundenlang nicht. Stirbt
 * bn4net in diesem Fenster - oder beendet es sich auf Zuruf, um neuen Code zu
 * laden -, steht der Bot still, bis ein Mensch "run bn4net.js" tippt. Genau
 * das ist am 23.08. um 17:40 passiert.
 *
 * Diese Datei ist der einzige sinnvolle Platz fuer die Wache: Sie ist das
 * kleinste Werkzeug der Liste (passt auf jedes frische home), braucht kein
 * Singularity, laeuft ohnehin dauerhaft und wird von bn4net selbst
 * nachgestartet, wenn sie fehlt. Die beiden bewachen sich damit gegenseitig.
 *
 * Aufruf: run popups.js   (laeuft dauerhaft, ~3,3 GB)
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

  // --- Zwischensequenzen wegklicken ------------------------------------------
  //
  // Beim Betreten von BitNode 6 stand der Lauf am 24.08.2026 still, bis Eric
  // von Hand "Continue ..." gedrueckt hat. Das ist keine Kleinigkeit: Der Bot
  // soll die restlichen Knoten unbeaufsichtigt durchlaufen, und jeder Knoten
  // mit einer Vorgeschichte haette einen Menschen an der Tastatur verlangt.
  //
  // Der Knopf kommt aus CinematicText.tsx:34 und ist der EINZIGE mit diesem
  // Text im ganzen Spiel (gegengeprueft: nur ein Treffer in src/**/*.tsx).
  // Benutzt wird die Komponente an zwei Stellen, beide harmlos:
  //   BladeburnerCinematic.tsx  - die Synthoid-Vorgeschichte von BitNode 6
  //   BitverseRoot.tsx          - der Enders-Text nach einem Knotenabschluss
  // In beiden Faellen beendet der Klick nur den Text. Die Knotenauswahl im
  // Bitverse laeuft ueber eigene Portal-Symbole und wird davon nicht beruehrt.
  //
  // Der Knopf erscheint erst, wenn der Text fertig getippt ist (10 ms je
  // Zeichen, CinematicLine.tsx:24) - bei BitNode 6 also nach gut zwanzig
  // Sekunden. Deshalb wird er nicht einmalig gesucht, sondern in jedem Takt.
  let sequenzen = 0;
  const sequenzWeiterklicken = () => {
    for (const b of doc.querySelectorAll("button")) {
      const text = (b.textContent || "").trim().toLowerCase();
      if (!text.startsWith("continue")) continue;
      reactKlick(b);
      sequenzen++;
      ns.print("Zwischensequenz weggeklickt (" + sequenzen + ". Mal).");
      return true;
    }
    return false;
  };

  // --- Wache ueber bn4net.js -------------------------------------------------
  // Bewusst ohne jede Bedingung ausser "laeuft nicht und passt": Wer hier
  // klug sein will (Karenzzeit, Fehlversuchszaehler, Stillstandserkennung),
  // baut die naechste Stelle, an der der Bot aus einem gut gemeinten Grund
  // NICHT startet. Ein Doppelstart ist harmlos - bn4net hat einen eigenen
  // Doppelinstanz-Waechter, der die juengere Instanz beendet.
  let wachMeldungen = 0;
  const wache = () => {
    if (ns.ps("home").some((p) => p.filename === "bn4net.js")) return;
    const frei = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    if (!ns.fileExists("bn4net.js", "home")) return;
    const pid = ns.exec("bn4net.js", "home");
    if (pid) {
      wachMeldungen++;
      ns.print("bn4net.js lag still und wurde neu gestartet (pid " + pid + ").");
      ns.write("data/popups-wache.txt",
        new Date().toLocaleTimeString() + "  bn4net.js neu gestartet (pid "
        + pid + "), " + wachMeldungen + ". Mal." + String.fromCharCode(10), "a");
    } else {
      ns.write("data/popups-wache.txt",
        new Date().toLocaleTimeString() + "  bn4net.js liess sich nicht starten,"
        + " home hat " + frei.toFixed(2) + " GB frei." + String.fromCharCode(10), "a");
    }
  };

  // --- Faktionseinladungen annehmen ------------------------------------------
  // Der Einladungsdialog ist die EINZIGE Stelle, an der ein Beitritt ohne
  // echten Tastendruck moeglich ist: FactionInvitationManager.tsx:53-59
  // prueft im Handler nur `alreadyInvited` und `isBanned`, nicht `isTrusted`
  // - anders als der Join!-Knopf auf der Faktionsseite
  // (FactionsRoot.tsx:88-94). Genau diese Luecke nutzt auch src/join.js.
  //
  // WARUM HIER UND NICHT IN bn4rep. bn4rep ist ausserhalb von BitNode 4
  // 768,3 GB gross und laeuft nach einem Knotenwechsel stundenlang nicht -
  // in genau der Phase also, in der die ersten Einladungen eintreffen und
  // ohne Mitgliedschaft gar keine Reputation entsteht. Hier kostet es nichts:
  // die Dialoge werden ohnehin durchgegangen.
  //
  // DIE EINZIGE GEFAHR IST DER FEHLGRIFF. Ein Beitritt sperrt sofort alle
  // Feinde der Faktion bis zum naechsten Einbau (FactionHelpers.tsx:45-47).
  // Feinde haben laut FactionInfo.tsx ausschliesslich die sechs
  // Stadtfaktionen (Aevum, Chongqing, Ishima, New Tokyo, Sector-12,
  // Volhaven) - und genau dann rendert der Dialog den Satz "is enemies
  // with". Ist er da, wird nicht beigetreten, sondern auf "Decide later"
  // geklickt; die Einladung bleibt erhalten und bn4rep entscheidet spaeter
  // mit vollem Ueberblick.
  let beigetreten = 0;
  const einladungAnnehmen = (modal) => {
    const text = modal.textContent || "";
    if (!text.includes("You received a faction invitation")) return false;
    if (text.includes("is enemies with")) return false;   // Stadtfaktion: Finger weg
    const b = modal.querySelector("b");
    const name = b ? (b.textContent || "").trim() : "";
    for (const knopf of modal.querySelectorAll("button")) {
      if ((knopf.textContent || "").trim().toLowerCase() !== "join") continue;
      try {
        reactKlick(knopf);
        beigetreten++;
        ns.write("data/popups-beitritt.txt",
          new Date().toLocaleTimeString() + "  beigetreten: " + (name || "?")
          + String.fromCharCode(10), "a");
        return true;
      } catch { return false; }
    }
    return false;
  };

  const knoepfeSchliessen = () => {
    let getan = 0;
    for (const modal of doc.querySelectorAll(".MuiModal-root")) {
      // Erst die Einladung pruefen - danach ist der Dialog ohnehin zu.
      if (einladungAnnehmen(modal)) { getan++; continue; }
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
      // Die Wache zuerst: ein stehender Bot ist teurer als ein offener Dialog.
      wache();
      // Zuerst die Zwischensequenz: sie ist KEIN Modal (Router.toPage, nicht
      // MuiModal-root) und wird von der Escape-Logik unten nicht erfasst.
      sequenzWeiterklicken();

      if (dialogOffen()) {
        // Einladungen ZUERST, vor dem Escape-Schlag. Der keydown-Handler in
        // AlertManager.tsx leert die ganze Warteschlange auf einmal; ein
        // Einladungsdialog waere danach weg, bevor er gelesen wurde. Die
        // Einladung selbst ginge dabei nicht verloren (close() behaelt sie),
        // aber jeder Beitritt haette einen ganzen Takt Verspaetung.
        for (const modal of doc.querySelectorAll(".MuiModal-root")) {
          einladungAnnehmen(modal);
        }
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
      ns.write("data/popups.txt", `${Date.now()}|${geschlossen}|${beigetreten}|${sequenzen}`, "w");
    } catch (e) {
      ns.print("FEHLER: " + String(e && e.message ? e.message : e));
      await ns.sleep(60000);
    }
    await ns.sleep(TAKT_MS);
  }
}
