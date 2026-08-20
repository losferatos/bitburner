/**
 * Boersenzugang kaufen - der einzige Grosskauf, der den Reset ueberlebt.
 *
 * KORREKTUR EINER FRUEHEREN ANNAHME: In der Nacht zum 20.08. stand in meinen
 * Notizen, der Boersenzugang ueberlebe den Reset nicht, mit Verweis auf
 * PlayerObjectGeneralMethods.ts:163-166. Die Zeilen stimmen, die Zuordnung
 * nicht: sie stehen in `prestigeSourceFile` (ab Zeile 143), nicht in
 * `prestigeAugmentation` (ab Zeile 80). Der Zugang faellt also erst beim
 * BitNode-Wechsel, nicht beim Augmentieren. Damit gehoert er in dieselbe
 * Klasse wie home-RAM: er ueberlebt, waehrend jeder Dollar Bargeld verbrennt.
 *
 * Vier Posten, in dieser Reihenfolge - die spaeteren sind ohne die frueheren
 * gesperrt (StockMarket/data/Constants.ts:7-10):
 *
 *   WSE Account                  200 Mio
 *   TIX API Access                 5 Mrd    <- ohne das kein ns.stock.*
 *   4S Market Data                 1 Mrd
 *   4S Market Data TIX API        25 Mrd    <- liefert getForecast()
 *
 * Der letzte Posten ist der eigentliche: `getForecast()` gibt die
 * Wahrscheinlichkeit, dass ein Papier steigt. Damit wird Aktienhandel zu einer
 * Rechenaufgabe statt zu einer Wette.
 *
 * Keiner der vier Knoepfe prueft `isTrusted`
 * (StockMarket/ui/InfoAndPurchases.tsx:68,111,158,207) - ein gewoehnliches
 * .click() genuegt. Die Boerse hat `city: null`
 * (Locations/data/LocationsMetadata.ts:441-445), ist also aus jeder Stadt
 * erreichbar; Reisen entfaellt.
 *
 * ACHTUNG fuer spaeter: Offene Aktienpositionen sind beim Install ersatzlos
 * weg. Vor jedem Reset muss alles verkauft sein.
 *
 * Aufruf:  node tools/task.js stockaccess.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/stock.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/stock.txt", "home", ns.getHostname());
  };

  const knoepfe = () => [...doc.querySelectorAll("button,[role='button'],li,a,span")];
  const text = (b) => (b.innerText || "").trim();
  const geld = () => ns.getServerMoneyAvailable("home");

  const POSTEN = [
    [/^Buy WSE Account/i, "WSE Account", 200e6],
    [/^Buy Trade Information eXchange \(TIX\) API Access/i, "TIX API", 5e9],
    [/^Buy 4S Market Data Access/i, "4S Market Data", 1e9],
    [/^Buy 4S Market Data TIX API Access/i, "4S TIX API", 25e9],
  ];
  const GESAMT = POSTEN.reduce((a, p) => a + p[2], 0);

  if (geld() < GESAMT * 1.1) {
    return sag("Zu wenig Guthaben: $" + Math.round(geld() / 1e9) + " Mrd, gebraucht werden "
      + Math.round(GESAMT / 1e9) + " Mrd plus Puffer.");
  }

  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(900); sag("Arbeit entfokussiert."); }

  // Zur Stadtkarte und von dort zur Boerse.
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true, bubbles: true }));
  await ns.sleep(1400);

  // NICHT ueber den sichtbaren Text suchen. Die Stadtkarte laeuft standardmaessig
  // als ASCII-Kunst, und dort ist jeder Ort nur EIN Zeichen - die Boerse ein
  // Dollarzeichen (Locations/ui/City.tsx:53). Der erste Anlauf suchte nach dem
  // Wort "World Stock Exchange" und fand folgerichtig nichts.
  //
  // Der Name steht im aria-label des Spans (City.tsx:61), und der ist in
  // beiden Ansichten da - in der ASCII-Karte wie in der Listenansicht.
  const boerse = doc.querySelector('[aria-label="World Stock Exchange"]')
    || knoepfe().find((b) => text(b) === "World Stock Exchange");
  if (!boerse) return sag("Standort \"World Stock Exchange\" nicht auf der Karte gefunden.");
  boerse.click();
  // 2,5 s statt 1,6: Beim Versuch um 15:04 war die Seite nach 1,6 s noch nicht
  // aufgebaut, und die Kaufknoepfe fehlten. Die Diagnose mit 2,5 s fand sie
  // alle vier auf Anhieb.
  await ns.sleep(2500);

  let gekauft = 0;
  for (const [muster, name, preis] of POSTEN) {
    // NUR <button>, nicht knoepfe(). Der Kaufknopf steckt in einem Tooltip,
    // und der umhuellt ihn mit einem <span> (InfoAndPurchases.tsx:109-114).
    // Dieser span traegt denselben innerText und steht in der Dokument-
    // reihenfolge VOR dem Button - die weit gefasste Suche hat also drei
    // Anlaeufe lang die Huelle geklickt, die keinen onClick hat. Der Knopf
    // blieb stehen, das Konto unveraendert, und die Meldung "Kauf abgelehnt"
    // war voellig richtig.
    //
    // Derselbe Fehler wie am 20.08. bei /TOR/i, das "Sector-12" traf: eine
    // Suche, die mehr Elementarten einschliesst als noetig, findet zuverlaessig
    // das falsche.
    const knopf = [...doc.querySelectorAll("button")].find((b) => muster.test(text(b)) && !b.disabled);
    if (!knopf) {
      // Kein Knopf heisst entweder "schon gekauft" (dann steht dort ein
      // Haken statt eines Knopfes) oder "gesperrt, weil die Vorstufe fehlt".
      sag(name + ": kein Knopf - vermutlich schon vorhanden oder gesperrt.");
      continue;
    }
    if (geld() < preis) { sag(name + ": Guthaben reicht nicht mehr. Ende."); break; }
    knopf.click();
    await ns.sleep(2000);
    // NICHT am fallenden Guthaben pruefen. Genau daran ist der Versuch um
    // 15:04 gescheitert: Der WSE-Zugang kostet 200 Mio, und bei 141 Mio $/s
    // verdient der Bot waehrend der zwei Sekunden Wartezeit mehr, als der Kauf
    // kostet - das Konto steht hinterher HOEHER da. Dieselbe Falle wie beim
    // Waechter: Je erfolgreicher der Bot, desto blinder wird das Guthaben als
    // Indikator.
    //
    // Der ehrliche Beweis ist der Knopf selbst: nach dem Kauf ersetzt ihn die
    // Oberflaeche durch einen Haken (InfoAndPurchases.tsx:105-115). Ist er weg,
    // ist gekauft.
    const nochDa = [...doc.querySelectorAll("button")].some((b) => muster.test(text(b)));
    if (!nochDa) {
      gekauft++;
      sag("gekauft: " + name + " fuer $" + (preis / 1e9).toFixed(2) + " Mrd");
    } else {
      sag(name + ": Knopf steht noch - Kauf abgelehnt, breche ab.");
      break;
    }
  }
  sag("Fertig. " + gekauft + " von " + POSTEN.length + " Posten gekauft, Guthaben jetzt $"
    + Math.round(geld() / 1e9) + " Mrd.");
}
