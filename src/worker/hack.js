/**
 * Ein-Zweck-Arbeiter: hackt einmal und beendet sich.
 *
 * Bewusst winzig gehalten - jede zusaetzliche ns-Funktion wuerde den
 * RAM-Bedarf JEDES Threads erhoehen, und davon laufen tausende.
 * Kosten: 1.60 GB Grundlast + 0.10 GB fuer hack = 1.70 GB.
 * Date.now() und ns.args kosten nichts, die Terminrechnung ist also gratis.
 *
 * args: [ziel, verzoegerungMs, landeZeit, aktionsDauerMs, kennung]
 *
 * Warum der Arbeiter selbst rechnet:
 * Zwischen ns.exec und dem ersten Befehl dieses Skripts liegt eine
 * unbekannte, schwankende Zeit - das Spiel muss das Modul erst uebersetzen und
 * einreihen. Wuerde die Steuerung die Verzoegerung vorgeben, ginge genau diese
 * Schwankung ungefiltert in den Landezeitpunkt ein. Deshalb bekommt der
 * Arbeiter den ZIELZEITPUNKT und rechnet die Verzoegerung im Moment seines
 * Starts selbst aus. Damit ist die Verzoegerung zwischen exec und Start
 * herausgekuerzt.
 *
 * Die Verzoegerung liegt bewusst INNERHALB der Aktion (additionalMsec) statt
 * in einem sleep davor: das Spiel bestimmt die Laufzeit einmalig beim
 * Aufruf (NetscriptHelpers.tsx:544) und wartet dann genau so lange. Ein sleep
 * davor wuerde die Laufzeit erst nach dem Aufwachen bestimmen - dann mit einer
 * anderen Sicherheitsstufe und damit einer anderen Dauer.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  await ns.hack(ns.args[0], { additionalMsec: verzoegerung(ns) });
}

/**
 * Liefert die Wartezeit in Millisekunden.
 * Faellt auf ns.args[1] zurueck, wenn kein Termin mitgegeben wurde - so
 * arbeitet dieser Arbeiter auch mit einer aelteren Steuerung zusammen.
 */
function verzoegerung(ns) {
  const landeZeit = Number(ns.args[2]);
  const dauer = Number(ns.args[3]);
  let ms = Number(ns.args[1]) || 0;
  if (Number.isFinite(landeZeit) && landeZeit > 0 && Number.isFinite(dauer) && dauer > 0) {
    ms = landeZeit - Date.now() - dauer;
  }
  // Das Spiel weist negative Werte und Werte ueber 1e9 mit einem Fehler ab
  // (NetscriptHelpers.tsx:363). Ein zu spaet gestarteter Auftrag soll aber
  // einfach sofort loslaufen, nicht das Skript abbrechen.
  if (!(ms > 0)) return 0;
  return Math.min(1e9, Math.round(ms));
}
