/**
 * Dateien lesen und schreiben, die auf home wohnen - von jedem Wirt aus.
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI GIBT
 * ===========================================================================
 *
 * `ns.read` liest IMMER vom eigenen Rechner (NetscriptFunctions.ts:1120-1122;
 * die Signatur hat keinen Host-Parameter). `ns.write` schreibt lokal.
 * `ns.scp` ERSETZT die Datei am Ziel, es mischt nicht
 * (BaseServer.ts:255-291). Wer also eine home-Datei von einem Fremdwirt aus
 * benutzt, muss sie holen, bearbeiten und zurueckschieben - in dieser
 * Reihenfolge und mit den richtigen Waechtern.
 *
 * Am 04.09.2026 standen SECHS handgeschriebene Fassungen dieses Musters im
 * Projekt, in DREI verschiedenen Qualitaeten:
 *
 *   ausgang.js    mit `fileExists(datei, "home")`-Waechter   richtig
 *   figwatch.js   mit Waechter                                richtig
 *   graftauto.js  mit Waechter                                richtig
 *   punish.js     mit Waechter                                richtig
 *   boerse.js     Waechter auf home, gelesen wird LOKAL       falsch
 *   export.js     gar kein Holen                              falsch
 *
 * Beide falschen Fassungen kosteten an dem Tag beinahe Daten: `export.js`
 * schrieb um 18:31 eine Falschmeldung in Erics einzigen Meldekanal, weil es
 * `data/bridge.json` auf werk-0 suchte; `boerse.js` haette beim Kauf der
 * 4S-TIX-API den gesamten Ereignisstrom auf home durch EINEN Eintrag
 * ersetzt - und der Strom ist laut `lib/events.js` die einzige Quelle fuer
 * drei Kennwerte, die als Abstaende zwischen Ereignissen berechnet werden.
 *
 * Sechs Kopien heisst: der naechste Fall wird wieder erst gefunden, wenn er
 * Daten gekostet hat. Deshalb gibt es das Muster ab jetzt einmal.
 *
 * ===========================================================================
 * DIE DREI FALLSTRICKE, DIE HIER ABGERAEUMT SIND
 * ===========================================================================
 *
 * (1) `ns.scp` WIRFT NICHT, wenn die Quelldatei fehlt. Es protokolliert,
 *     setzt `noFailures = false` und gibt das zurueck
 *     (NetscriptFunctions.ts:803-808 und :835). Jedes `try/catch` um ein scp
 *     ist fuer diesen Fall wirkungslos - nur der Rueckgabewert sagt etwas.
 *
 * (2) Schlaegt das Holen fehl, liegt aber noch eine ALTE Fassung lokal
 *     (Altbestand vom letzten Aufenthalt auf diesem Wirt), dann liest man
 *     stillschweigend einen veralteten Stand. Deshalb ZUERST fragen, ob home
 *     die Datei ueberhaupt hat: hat es sie nicht, ist "" die richtige
 *     Antwort - nicht der Altbestand.
 *
 * (3) Zurueckgeschoben werden darf nur, was die home-Fassung auch enthaelt.
 *     Beim Anhaengen heisst das: erst holen, dann anhaengen, und nur
 *     schieben, wenn das Holen geklappt hat oder home die Datei gar nicht
 *     hat. Sonst ersetzt eine kurze lokale Fassung eine lange auf home.
 *
 * ===========================================================================
 * WAS DAS AN ARBEITSSPEICHER KOSTET
 * ===========================================================================
 *
 * `fileExists` 0,1 GB, `scp` 0,6 GB, `read` und `write` je 0 GB. Bitburner
 * rechnet die Vereinigungsmenge ueber den ganzen Modulgraphen, also kostet
 * dieses Modul nichts zusaetzlich in einem Gewerk, das die Funktionen ohnehin
 * benutzt - und das tun alle vier Nutzer.
 *
 * ACHTUNG: Der Kern loest Importe NICHT transitiv auf
 * (bn4net.js:3795-3803). Ein Gewerk, das `lib/handschlag.js` einbindet, muss
 * `lib/hostdatei.js` SELBST in seinem `needsLibs` fuehren.
 */

/**
 * Den Inhalt einer home-Datei lesen, egal auf welchem Wirt man laeuft.
 *
 * @param {NS} ns
 * @param {string} datei
 * @returns {string} "" wenn home die Datei nicht hat oder etwas schiefging
 */
export function liesVonHome(ns, datei) {
  try {
    // Der Waechter aus Fallstrick (2): existiert sie auf home nicht, ist ""
    // die Wahrheit - ein lokaler Altbestand waere eine Luege.
    if (!ns.fileExists(datei, "home")) return "";
    const hier = ns.getHostname();
    if (hier !== "home" && !ns.scp(datei, hier, "home")) {
      // Sie liegt auf home, war aber nicht zu holen. Auch hier waere der
      // lokale Altbestand eine Luege.
      return "";
    }
    return ns.read(datei) || "";
  } catch {
    return "";
  }
}

/**
 * Eine home-Datei vollstaendig schreiben, egal auf welchem Wirt man laeuft.
 *
 * @param {NS} ns
 * @param {string} datei
 * @param {string} inhalt
 * @returns {boolean} ob der Inhalt auf home angekommen ist
 */
export function nachHome(ns, datei, inhalt) {
  try {
    ns.write(datei, inhalt, "w");
    const hier = ns.getHostname();
    if (hier === "home") return true;
    return ns.scp(datei, "home", hier) === true;
  } catch {
    return false;
  }
}

/**
 * Eine Zeile an eine home-Datei anhaengen, ohne sie zu zerstoeren.
 *
 * Das ist der Fall, an dem die handgeschriebenen Fassungen gescheitert sind:
 * anhaengen ist LESEN und SCHREIBEN, nicht nur schreiben.
 *
 * `maxZeilen` deckelt die Datei auf die juengsten N Zeilen. Ohne Deckel
 * waechst sie unbegrenzt und liegt danach in JEDEM Autosave, jeder Sicherung
 * und jedem Export - `aktionen.txt` wuchs mit rund 115 KB je Tag, und
 * niemand im Spiel liest mehr als die letzten paar hundert Zeilen.
 *
 * @param {NS} ns
 * @param {string} datei
 * @param {string} zeile   mit abschliessendem Zeilenumbruch
 * @param {number} [maxZeilen]  0 oder fehlend = kein Deckel
 * @returns {boolean} ob die Zeile auf home angekommen ist
 */
export function haengeAnHome(ns, datei, zeile, maxZeilen) {
  try {
    const hier = ns.getHostname();
    if (hier === "home") {
      if (maxZeilen > 0) return nachHome(ns, datei, deckle(ns.read(datei) || "", zeile, maxZeilen));
      ns.write(datei, zeile, "a");
      return true;
    }
    const aufHome = ns.fileExists(datei, "home");
    const geholt = aufHome ? ns.scp(datei, hier, "home") : false;
    // Fallstrick (3): schieben nur, wenn die lokale Fassung die von home
    // enthaelt - oder home gar keine hat.
    const darfSchieben = geholt || !aufHome;
    if (maxZeilen > 0) {
      const alt = darfSchieben ? (ns.read(datei) || "") : "";
      ns.write(datei, deckle(alt, zeile, maxZeilen), "w");
    } else {
      ns.write(datei, zeile, "a");
    }
    if (!darfSchieben) return false;
    return ns.scp(datei, "home", hier) === true;
  } catch {
    return false;
  }
}

/** Die juengsten `max` Zeilen behalten, die neue angehaengt. */
function deckle(alt, zeile, max) {
  const zeilen = alt ? alt.split("\n").filter((z) => z.trim()) : [];
  zeilen.push(zeile.replace(/\n+$/, ""));
  return zeilen.slice(-max).join("\n") + "\n";
}
