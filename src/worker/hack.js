/**
 * Ein-Zweck-Arbeiter: hackt einmal und beendet sich.
 *
 * Bewusst winzig gehalten - jede zusaetzliche ns-Funktion wuerde den
 * RAM-Bedarf JEDES Threads erhoehen, und davon laufen tausende.
 * Kosten: 1.60 GB Grundlast + 0.10 GB fuer hack + 0.05 GB fuer getHackTime
 * = 1.75 GB. Date.now() und ns.args kosten nichts.
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
 * Und seit dem 22.08.2026 misst er auch die DAUER selbst (0.05 GB je Faden).
 * Der Grund ist gemessen und nicht theoretisch: Das Spiel bestimmt die
 * Laufzeit einmalig im Moment des ns.hack-Aufrufs aus der DANN geltenden
 * Sicherheit (NetscriptHelpers.tsx:598, ein einziges setTimeout in
 * netscriptDelay :469-482, keine Neubewertung waehrend des Wartens). Zwischen
 * der Messung in der Steuerung und diesem Aufruf liegt aber der Rest einer
 * Runde - bei 95 Rechnern Sekunden. Landet in dieser Zeit ein hack eines
 * anderen Stapels, steigt die Sicherheit; fuer omega-net sind 177 hack-Faeden
 * +0.354 Sicherheit auf ein Minimum von rund 10, also +3,5 % Laufzeit. Auf
 * eine weaken-Zeit von 134 s sind das 4,5 Sekunden Versatz - das Elffache des
 * Landeabstands von 400 ms. Ein Stapel, dessen Reihenfolge sich dreht, raeumt
 * das Ziel leer.
 * Misst der Arbeiter dagegen unmittelbar vor dem Aufruf (kein await
 * dazwischen, also derselbe Tick und dieselbe Sicherheit), ist die Dauer
 * exakt dieselbe, die das Spiel gleich verwendet: Gesamtwartezeit
 * = dauer + additionalMsec = landeZeit - jetzt. Die Landung stimmt dann
 * unabhaengig von Sicherheit, Level und Startverzoegerung.
 *
 * Die Verzoegerung liegt bewusst INNERHALB der Aktion (additionalMsec) statt
 * in einem sleep davor: das Spiel bestimmt die Laufzeit einmalig beim
 * Aufruf und wartet dann genau so lange. Ein sleep davor wuerde die Laufzeit
 * erst nach dem Aufwachen bestimmen - dann mit einer anderen Sicherheitsstufe
 * und damit einer anderen Dauer.
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
  let dauer = Number(ns.args[3]);
  // Selbst messen schlaegt den mitgegebenen Wert. try/catch, weil
  // getHackTime bei einem Ziel ohne Root-Zugriff wirft - dann bleibt der
  // Wert der Steuerung stehen, statt dass der Faden ersatzlos stirbt.
  try {
    const gemessen = ns.getHackTime(ns.args[0]);
    if (Number.isFinite(gemessen) && gemessen > 0) dauer = gemessen;
  } catch { /* Ziel nicht lesbar - mitgegebene Dauer behalten */ }
  let ms = Number(ns.args[1]) || 0;
  if (Number.isFinite(landeZeit) && landeZeit > 0 && Number.isFinite(dauer) && dauer > 0) {
    ms = landeZeit - Date.now() - dauer;
  }
  // Das Spiel weist negative Werte und Werte ueber 1e9 mit einem Fehler ab
  // (NetscriptHelpers.tsx:413-418). Ein zu spaet gestarteter Auftrag soll aber
  // einfach sofort loslaufen, nicht das Skript abbrechen.
  if (!(ms > 0)) return 0;
  return Math.min(1e9, Math.round(ms));
}
