/**
 * entwurf/homeram/homeram.js — Arbeitsspeicher und Rechenkerne von `home`
 * ueber die Spieloberflaeche kaufen, ohne dass ein Mensch klickt.
 *
 * ============================================================================
 * WARUM UEBERHAUPT UEBER DIE OBERFLAECHE
 * ============================================================================
 *
 * Es gibt einen direkten Netscript-Weg — `ns.singularity.upgradeHomeRam()`
 * (NetscriptFunctions/Singularity.ts:599-627) und `upgradeHomeCores()`
 * (:568-593). Beide sind hier aber doppelt unbrauchbar:
 *
 *   1. Sie rufen als Erstes `helpers.checkSingularityAccess(ctx)` auf und
 *      werfen ohne Source File 4.
 *   2. Selbst MIT Zugang kosten sie Speicher, den wir gerade nicht haben:
 *      `SF4Cost(SingularityFn2)` = 3 GB, ohne SF4 mal 16, also 48 GB
 *      (RamCostGenerator.ts:82-96 und :176-177). Bei 16 GB auf home ist das
 *      absurd.
 *
 * Der Oberflaechenweg dagegen ist offen. Die beiden Knoepfe stehen bei jedem
 * TechVendor und pruefen die Echtheit des Klicks NICHT:
 *
 *   RamButton.tsx:49    <Button disabled={...} onClick={buy}>
 *   CoresButton.tsx:43  <Button disabled={...} onClick={buy}>
 *
 * Im ganzen Quelltext gibt es genau 14 Stellen mit `isTrusted`, und keine
 * davon liegt in RamButton.tsx oder CoresButton.tsx. Vollstaendig sind das:
 * Arcade/ui/BBCabinet.tsx:17, Casino/Blackjack.tsx:143, :160 und :241,
 * Casino/utils.ts:5, Exploits/Unclickable.tsx:11,
 * Faction/ui/FactionsRoot.tsx:89 (`Join!`),
 * Infiltration/ui/InfiltrationRoot.tsx:74,
 * Locations/ui/CompanyLocation.tsx:62 und :71 (Bewerben/Arbeiten),
 * Locations/ui/HospitalLocation.tsx:23, Locations/ui/SlumsLocation.tsx:25,
 * Programs/ui/ProgramsRoot.tsx:96 und :108 ("Create program").
 * Ein gewoehnlicher `.click()` reicht hier also.
 *
 * ============================================================================
 * WARUM NICHT EINFACH CLOUD-SERVER KAUFEN — DAS WAERE 41-MAL BILLIGER
 * ============================================================================
 *
 * Das ist der ernsthafteste Einwand gegen diese Datei, und er muss beantwortet
 * werden. Cloud-RAM kostet in BitNode 1 pauschal $55.000/GB
 * (ServerPurchases.ts:35-40 mit Server/data/Constants.ts:4; die Faktoren
 * CloudServerCost und CloudServerSoftcap sind 1, BitNodeMultipliers.ts:131
 * und :134). Der Weg von 16 auf 2048 GB home kostet $4,646 Mrd fuer 2032 GB,
 * also $2,29 Mio/GB — das 41,6-Fache. Und `ns.cloud.purchaseServer` kostet nur
 * 2,25 GB (RamCostGenerator.ts:232), passt also neben den Autopiloten auf ein
 * 16-GB-home; der Weg ist in src/invest.js sogar schon gebaut.
 *
 * Trotzdem ist es nicht dasselbe, und zwar aus einem einzigen, harten Grund:
 *
 *     prestigeAugmentation setzt `this.purchasedServers = []`
 *     (PersonObjects/Player/PlayerObjectGeneralMethods.ts:109)
 *     und `this.money = 1000 + CONSTANTS.Donations` (:102).
 *
 *     prestigeHomeComputer (Server/ServerHelpers.ts:226-264) fasst weder
 *     `maxRam` noch `cpuCores` an.
 *
 * Bei JEDER Augmentierung sind also alle gekauften Rechner weg UND das Geld
 * ist weg — man startet mit $1000 und kann sich nichts nachkaufen. home-RAM
 * bleibt. Cloud-RAM ist billige Miete fuer den laufenden Durchgang, home-RAM
 * ist der einzige Speicher, mit dem der Automat nach einem Reset ueberhaupt
 * anlaeuft. Genau daraus entsteht die Fehlerfamilie, die diese Datei beenden
 * soll: Befehlsdateien per `ns.scp` hin- und herschieben, Pulswachen,
 * Doppelstarts — alles nur, weil die Werkzeuge auf gemietete Rechner
 * ausweichen muessen.
 *
 * Die Grenze der Haltbarkeit: ein BITNODE-Wechsel setzt home doch zurueck, auf
 * 8, 32 oder 128 GB je nach Source Files, und die Kerne auf 1
 * (Prestige.ts:242-249). Diese Anschaffung haelt also einen ganzen BitNode
 * lang, nicht laenger.
 *
 * Ehrlich bleiben muss man trotzdem bei der Groesse: um NUR das genannte
 * Problem zu loesen — Autopilot 9,15 GB und src/hand.js 28,75 GB zusammen auf
 * home — genuegen 64 GB fuer $45,1 Mio, also drei Klicks und 1 % der Kosten
 * des 2048er-Ziels. Alles darueber ist Vorrat fuer den Neustart nach dem
 * naechsten Reset und muss so gerechtfertigt werden, nicht mit dem Preis pro
 * GB. Wer klein anfangen will, ruft `--ram 128` auf; das kostet $146 Mio und
 * raeumt die Werkzeugfrage sofort ab.
 *
 * ============================================================================
 * WAS ES KOSTET — NACHGERECHNET
 * ============================================================================
 *
 * PlayerObjectServerMethods.ts:30-40:
 *
 *     cost = currentRam * 32000 * 1.58^log2(currentRam) * HomeComputerRamCost
 *
 * (32000 = ServerConstants.BaseCostFor1GBOfRamHome, Server/data/Constants.ts:3)
 *
 * Der Sprung KOSTET NACH DEM ALTEN STAND, nicht nach dem neuen. Die Summe von
 * 16 GB aus, jeder Schritt verdoppelt (Multiplikator 1, also BitNode 1):
 *
 *     16 ->   32       $3,19 Mio     kumuliert $0,003 Mrd
 *     32 ->   64      $10,08 Mio     kumuliert $0,013 Mrd
 *     64 ->  128      $31,86 Mio     kumuliert $0,045 Mrd
 *    128 ->  256     $100,68 Mio     kumuliert $0,146 Mrd
 *    256 ->  512     $318,16 Mio     kumuliert $0,464 Mrd
 *    512 -> 1024      $1,005 Mrd     kumuliert $1,469 Mrd
 *   1024 -> 2048      $3,177 Mrd     kumuliert $4,646 Mrd   <== Ziel 2048
 *   2048 -> 4096     $10,039 Mrd     kumuliert $14,686 Mrd
 *   4096 -> 8192     $31,724 Mrd     kumuliert $46,410 Mrd
 *
 * KORREKTUR ZUR AUFTRAGSANNAHME: 16 GB -> 2048 GB kostet rund $4,65 Mrd, nicht
 * $14,7 Mrd. Die $14,7 Mrd sind die Summe bis 4096 GB.
 *
 * Und noch eine Korrektur an einer naheliegenden Begruendung: Es gibt in
 * dieser Reihe KEINE Stelle, an der das Verhaeltnis kippt. Jede Stufe kostet
 * das 2 * 1,58 = 3,16-Fache der vorigen, also gleichbleibend etwa das
 * 2,16-Fache aller vorherigen Stufen zusammen — bei 128 GB genauso wie bei
 * 2048 GB. Der Sprung 2048 -> 4096 kostet $10,04 Mrd gegen $4,65 Mrd fuer
 * alles davor; "so teuer wie alles davor zusammen" waere untertrieben. Die
 * Voreinstellung 2048 ist deshalb eine Budgetentscheidung und keine
 * Optimumsuche: sie kostet 11 % des Guthabens und laesst Luft. 4096 GB waeren
 * mit 36 % ebenfalls bezahlbar — das entscheidet, wer den Aufruf absetzt.
 *
 * Der Multiplikator ist nur in vier BitNodes ungleich 1 (BitNode/BitNode.tsx):
 *   BN3 = 1,5 (:601)   BN9 = 5 (:808)   BN10 = 1,5 (:847)
 *   BN12 = 1,02^Stufe (:940), Stufe = aktive SF-Stufe + 1 (:1126)
 * Dieses Skript liest die BitNode-Nummer aus `ns.getResetInfo()` und setzt den
 * Multiplikator selbst — geraten wird nichts.
 *
 * Rechenkerne, PlayerObjectServerMethods.ts:42-44:
 *
 *     cost = 1e9 * 7.5^aktuelleKerne
 *
 *   1 -> 2      $7,50 Mrd
 *   2 -> 3     $56,25 Mrd     (mehr als das aktuelle Guthaben)
 *   3 -> 4    $421,88 Mrd
 *
 * Bei $41 Mrd ist also genau EIN Kern kaufbar, und er kostet mehr als der
 * ganze Weg auf 2048 GB. Deshalb steht das Kernziel voreingestellt auf 0
 * ("nicht anfassen") — wer es will, sagt es ausdruecklich mit `--cores 2`.
 *
 * Zur Wirkung, damit die Entscheidung auf richtigen Annahmen steht: Kerne
 * wirken NICHT nur auf home als Ziel. `grow()` und `weaken()` lesen die Kerne
 * des AUSFUEHRENDEN Rechners (`scripthost.cpuCores`, NetscriptFunctions.ts:288
 * und :359), gegen jedes beliebige Ziel; ausserdem profitiert `ns.share()`
 * davon (:388). Ein Kern nuetzt also allem, was auf home laeuft. Er kostet
 * hier nur eben mehr als 2032 GB home-RAM, und deshalb kommt er zuletzt.
 *
 * ============================================================================
 * WIE DER ERFOLG GEPRUEFT WIRD
 * ============================================================================
 *
 * Ausschliesslich am Spielzustand: `ns.getServerMaxRam("home")` liest
 * `server.maxRam` direkt (NetscriptFunctions.ts:992-997), und genau dieses
 * Feld erhoeht der Kauf (ServerPurchases.ts:180). Kerne ueber
 * `ns.getServer("home").cpuCores`, erhoeht in CoresButton.tsx:31.
 *
 * KEIN Bildschirmtext wird als Erfolgsbeleg genommen. Der Grund steht in
 * src/hand.js:200-206: der Puffer enthaelt Meldungen frueherer Versuche, an
 * denen jede Textpruefung sofort anschlaegt. Bildschirmtext dient hier nur
 * zum Finden von Knoepfen und zum Benennen von Fehlerlagen.
 *
 * ============================================================================
 * WARUM EIN ECHTER .click() UND KEIN AUFRUF DER REACT-PROPS
 * ============================================================================
 *
 * entwurf/join/join.js muss den Handler direkt aus den React-Props holen, weil
 * dort `isTrusted` im Weg steht. Hier ist das nicht noetig — und es waere
 * SCHAEDLICH:
 *
 *   - `purchaseRamForHomeComputer()` oeffnet bei zu wenig Geld ein Modal
 *     (ServerPurchases.ts:167) und bei erreichtem Maximum ebenfalls (:176).
 *     Das blockiert src/hand.js zwar NICHT — das Spiel-Modal setzt
 *     `disableEnforceFocus` und `disableAutoFocus` (ui/React/Modal.tsx:74
 *     und :75), der Terminalbildschirm bleibt darunter montiert, und hand.js
 *     schreibt ueber den nativen Wert-Setter statt ueber die Tastatur
 *     (src/hand.js:56-59). Es stoert aber den Menschen vor dem Bildschirm, und
 *     der `disabled`-Zustand des Knopfes ist die eingebaute Bremse davor.
 *     Sie zu umgehen hiesse, sich selbst Fenster in den Weg zu stellen.
 *   - `CoresButton.buy` liest `cost` aus dem Renderzeitpunkt (CoresButton.tsx:20)
 *     und zahlt genau diesen Betrag (:30). Wer den Handler zweimal aufruft,
 *     ohne die Neuzeichnung abzuwarten, kauft den teureren Kern zum alten
 *     Preis. Deshalb wird nach jedem Kernkauf auf einen FRISCHEN Handler
 *     gewartet (Identitaetsvergleich der onClick-Funktion), bevor wieder
 *     geklickt wird.
 *
 * Ist der Knopf `disabled`, wird also nicht geklickt, sondern gewartet und
 * danach berichtet. Ein `.click()` auf ein deaktiviertes <button> stellt der
 * Browser ohnehin nicht zu.
 *
 * ============================================================================
 * SPEICHERBEDARF UND WO DAS SKRIPT LAEUFT
 * ============================================================================
 *
 * Der Bezeichner `document` kostet pauschal 25 GB (RamCostGenerator.ts:12,
 * gebucht in RamCalculations.ts:185-188). Mit den uebrigen Aufrufen:
 *
 *   baseCost 1,60 + document 25 + getServer 2 + getResetInfo 1
 *   + scp 0,60 + getServerMoneyAvailable 0,10 + getServerMaxRam 0,05
 *   + getHostname 0,05                                    = 30,40 GB
 *
 * Das passt nicht auf ein home mit 16 GB — dieses Skript muss also selbst noch
 * auf einem fremden Rechner laufen, genau wie src/hand.js. Danach nie wieder.
 *
 * Diese Zahl muss man nicht glauben. Sobald die Datei auf home liegt, sagt das
 * Spiel sie selbst (Remote-API-Methode `calculateRam`,
 * RemoteFileAPI/MessageHandlers.ts:194-220), erreichbar ueber die Bruecke:
 *
 *   node -e "fetch('http://localhost:8795/api/rpc?method=calculateRam&filename=homeram.js&server=home').then(r=>r.json()).then(o=>console.log(o))"

 *
 * Die Funktion `upgradeHome()` ist getrennt exportiert und nimmt das Dokument
 * als Parameter. Wer sie importiert (z.B. src/hand.js, das die 25 GB ohnehin
 * zahlt), bekommt KEINEN Aufschlag: der RAM-Rechner saet nur die Bezeichner
 * des Einstiegsskripts und folgt von dort den Kanten (RamCalculations.ts:165).
 * `main` mit seinem `document` wird dabei nie erreicht.
 *
 * ============================================================================
 * AUFRUF
 * ============================================================================
 *
 *   run homeram.js                      Ziel 2048 GB, Kerne unangetastet
 *   run homeram.js --ram 128            kleines Ziel: loest die Werkzeugfrage
 *                                       fuer $146 Mio
 *   run homeram.js --ram 4096           groesseres Ziel
 *   run homeram.js --cores 2            zusaetzlich einen Kern kaufen
 *   run homeram.js --dry                nur rechnen; fasst die Oberflaeche
 *                                       NICHT an, kein Seitenwechsel
 *   run homeram.js --budget 0.4         hoechstens 40 % des Guthabens ausgeben
 *   run homeram.js --reserve 20e9       $20 Mrd unangetastet lassen
 *
 * Bericht steht danach in `data/homeram.txt` auf home.
 */

/** Beschriftungsanfang des RAM-Knopfes (RamButton.tsx:50). */
const RAM_LABEL = "Upgrade 'home' RAM";
/** Beschriftungsanfang des Kern-Knopfes (CoresButton.tsx:44). */
const CORES_LABEL = "Upgrade 'home' cores";

/**
 * `ServerConstants.HomeComputerMaxRam` = 2^30 (Server/data/Constants.ts:6).
 * Praktisch kein Deckel, aber die Abbruchbedingung muss ihn kennen, sonst
 * klickt das Skript am oberen Ende in ein Modal hinein.
 */
const HOME_MAX_RAM = 1073741824;
/** CoresButton.tsx:18 — mehr als 8 Kerne gibt es nicht. */
const MAX_CORES = 8;
/** Server/data/Constants.ts:3. */
const BASE_COST_PER_GB_HOME = 32000;

/**
 * Alle acht TechVendor-Standorte mit ihrer Stadt
 * (Locations/data/LocationsMetadata.ts, Namen aus Locations/Enums.ts).
 *
 * JEDER dieser acht Haendler taugt gleich gut: `RamButton` und `CoresButton`
 * bekommen den Standort gar nicht uebergeben (TechVendorLocation.tsx:61 und
 * :63), sie haengen allein am Spieler. Die Felder techVendorMinRam/MaxRam
 * steuern nur die Cloud-Server-Knoepfe daneben. Deshalb wird genommen, was auf
 * der Karte steht, statt auf Sector-12 zu bestehen.
 *
 * Wichtig fuer die Fehlersuche: Chongqing und New Tokyo haben KEINEN
 * TechVendor. Steht der Spieler dort, ist der Kauf ohne Reise unmoeglich —
 * und das soll im Bericht stehen und nicht als "Knopf nicht gefunden"
 * durchgehen.
 */
const TECH_VENDORS = [
  { city: "Aevum", name: "ECorp" }, // Metadata:50
  { city: "Aevum", name: "Fulcrum Technologies" }, // :61
  { city: "Aevum", name: "NetLink Technologies" }, // :81
  { city: "Ishima", name: "Omega Software" }, // :165
  { city: "Ishima", name: "Storm Technologies" }, // :176
  { city: "Sector-12", name: "Alpha Enterprises" }, // :228
  { city: "Volhaven", name: "CompuTek" }, // :352
  { city: "Volhaven", name: "OmniTek Incorporated" }, // :397
];

/** Kosten des naechsten RAM-Sprungs. PlayerObjectServerMethods.ts:30-40. */
export function ramUpgradeCost(currentRam, costMult = 1) {
  return currentRam * BASE_COST_PER_GB_HOME * Math.pow(1.58, Math.log2(currentRam)) * costMult;
}

/** Kosten des naechsten Kerns. PlayerObjectServerMethods.ts:42-44. */
export function coreUpgradeCost(currentCores) {
  return 1e9 * Math.pow(7.5, currentCores);
}

/**
 * Der BitNode-Aufschlag auf den RAM-Preis.
 *
 * Nur vier BitNodes weichen von 1 ab (BitNode/BitNode.tsx:601, :808, :847,
 * :940). Fuer BN12 ist die Stufe `activeSourceFileLvl(12) + 1` (:1126); die
 * aktiven SF-Stufen liefert `ns.getResetInfo().ownedSF`
 * (NetscriptFunctions.ts:1445-1449).
 */
export function homeRamCostMult(node, sfLevelOfCurrentNode) {
  if (node === 3 || node === 10) return 1.5;
  if (node === 9) return 5;
  if (node === 12) return Math.pow(1.02, (sfLevelOfCurrentNode || 0) + 1);
  return 1;
}

/**
 * Sichtbarer Text eines Knopfes.
 *
 * Die Beschriftungen enthalten geschuetzte Leerzeichen: RamButton.tsx:50 setzt
 * "Upgrade 'home' RAM&nbsp;". Vor jedem Vergleich werden sie zu gewoehnlichen
 * Leerzeichen. Das Zeichen wird ueber seinen Codepunkt gebildet und nicht
 * woertlich in die Datei geschrieben — woertlich ueberlebt es nicht jeden
 * Transportweg, und ein stillschweigend verlorenes Zeichen wuerde hier jeden
 * Knopfvergleich scheitern lassen.
 */
const NBSP = new RegExp(String.fromCharCode(160), "g");
function labelOf(el) {
  return (el.innerText || el.textContent || "").replace(NBSP, " ").trim();
}

/**
 * React 17 legt die Props eines Host-Elements als gewoehnliche Eigenschaft auf
 * dem DOM-Knoten ab (react-dom 17.0.2, ReactDOMComponentTree.js,
 * `updateFiberProps`). Der Schluessel enthaelt einen je Seitenladung neuen
 * Zufallsanteil, deshalb wird er gesucht.
 *
 * Gebraucht wird das hier NICHT zum Klicken, sondern nur, um zu erkennen, ob
 * eine Neuzeichnung stattgefunden hat: bei jedem Rendern entsteht ein neuer
 * `onClick`-Abschluss.
 */
function reactProps(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  return key ? node[key] : null;
}

function clickHandlerOf(node) {
  const props = reactProps(node);
  return props && typeof props.onClick === "function" ? props.onClick : null;
}

/** Findet einen Knopf ueber den Anfang seiner Beschriftung. */
function findButton(doc, labelPrefix) {
  return [...doc.querySelectorAll("button")].find((b) => labelOf(b).startsWith(labelPrefix)) || null;
}

/** Stehen wir auf der Seite eines TechVendors? Nur daran, dass der Knopf da ist. */
function onVendorPage(doc) {
  return !!findButton(doc, RAM_LABEL);
}

/**
 * Benennt den Spielzustand, wenn die Oberflaeche gerade unerreichbar ist.
 *
 * Sechs Seiten rendern die Seitenleiste gar nicht (ui/GameRoot.tsx). Dort gibt
 * es AUCH KEIN Alt+W: der Tastaturhandler haengt in einem useEffect von
 * SidebarRoot (Sidebar/ui/SidebarRoot.tsx:308) und existiert nur, solange die
 * Komponente montiert ist. Ohne diese Erkennung meldet der Kauf ein
 * nichtssagendes "nicht gefunden", und niemand weiss, wo das Spiel steht.
 *
 * Das ist Bildschirmtext — aber ausschliesslich zur Lagebeschreibung, nie als
 * Beleg fuer einen gelungenen Kauf.
 */
function detectBlockedPage(doc) {
  const body = (doc.body?.innerText || "").slice(0, 4000);
  const has = (s) => body.includes(s);
  if ([...doc.querySelectorAll("button")].some((b) => labelOf(b) === "Do something else simultaneously")) {
    return "fokussierte Arbeit (Page.Work)";
  }
  if (has("Recovery Mode") || has("RECOVERY MODE")) return "Recovery-Modus — der Spielstand hat ein Problem";
  if (has("Import Save") || has("Importing this save")) return "Speicherstand-Import wartet auf eine Entscheidung";
  if (has("The Bitverse") || has("Which BitNode")) return "BitVerse (Reset laeuft)";
  // Nur "Infiltrating" (Infiltration/ui/Intro.tsx:108). NICHT auf
  // "Infiltrate" pruefen: der Knopf "Infiltrate Company"
  // (CompanyLocation.tsx:148) steht bei Alpha Enterprises auf DERSELBEN Seite,
  // die wir ansteuern.
  if (has("Infiltrating")) return "Infiltration laeuft";
  if (!doc.querySelector(".MuiDrawer-root")) return "unbekannte Sonderseite ohne Seitenleiste";
  return "";
}

/**
 * Schliesst ein stehengebliebenes Meldefenster — und NUR dieses.
 *
 * Wichtig zur Einordnung: ein offenes Modal blockiert src/hand.js NICHT. Das
 * Spiel-Modal setzt `disableEnforceFocus` und `disableAutoFocus`
 * (ui/React/Modal.tsx:73 und :76), der Terminalbildschirm bleibt darunter
 * montiert, und hand.js schreibt ohnehin ueber den nativen Wert-Setter statt
 * ueber die Tastatur (src/hand.js:56-59). Das Fenster stoert also nur den
 * Menschen vor dem Bildschirm — aber genau der schaut hier gelegentlich hin.
 *
 * Geschlossen wird ueber das Kreuz oben rechts (ui/React/Modal.tsx:95: ein
 * IconButton, der direkt `onClose` aufruft). Beim AlertManager ist das
 * `close()`, und das entfernt AUSSCHLIESSLICH die erste Meldung
 * (ui/React/AlertManager.tsx:76-80).
 *
 * Der naheliegendere Weg — ein Escape ans Dokument — waere falsch: dessen
 * Handler leert die GANZE Warteschlange (AlertManager.tsx:41-45) und wuerde
 * damit auch fremde Meldungen wegwerfen, etwa einen Ausnahmehinweis, den
 * jemand noch lesen wollte. Er bleibt nur als letzte Rueckfallebene und wird
 * dann ausdruecklich protokolliert.
 *
 * @returns {string} "" wenn nichts zu tun war, sonst wie geschlossen wurde
 */
function dismissStrayAlert(doc) {
  const modal = [...doc.querySelectorAll(".MuiModal-root")].find((m) => {
    const t = m.innerText || "";
    return (
      t.includes("enough money to purchase additional RAM") ||
      t.includes("maximum possible value") ||
      t.includes("enough money to purchase this server")
    );
  });
  if (!modal) return "";

  // tss-react behaelt den Regelnamen im erzeugten Klassennamen, deshalb ist
  // `closeButton` (Modal.tsx:32) auch im fertigen Build noch daran zu erkennen.
  // Faellt das eines Tages weg, greift die zweite Suche: das Kreuz ist der
  // einzige Knopf im Fenster ohne Beschriftung.
  const byClass = modal.querySelector('[class*="closeButton"]');
  const closer =
    (byClass && (byClass.tagName === "BUTTON" ? byClass : byClass.closest("button"))) ||
    [...modal.querySelectorAll("button")].find((b) => labelOf(b) === "");
  if (closer) {
    closer.click();
    return "Kreuz";
  }

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  return "Escape (ACHTUNG: leert die ganze Meldungsliste)";
}

/**
 * Nimmt den Nachtdienst aus dem Verkehr, solange hier die Seite gewechselt
 * wird — er bedient dieselbe Oberflaeche im 30-Sekunden-Takt.
 *
 * Gegen Verschachtelung abgesichert: hat ihn schon jemand (z.B. src/hand.js
 * fuer einen ganzen Befehlsstapel), wird er hier NICHT wieder losgelassen.
 * Die Selbstloesung per Zeitgeber ist Pflicht — am 20.08. blieb der Dienst
 * nach einem Absturz mitten im Griff fuer immer stehen.
 *
 * WAS DIESER GRIFF NICHT KANN: `__nightshift.busy` ist ein blosses Bool ohne
 * Besitzer. src/hand.js setzt es am Ende JEDES Befehlsstapels bedingungslos
 * auf false (src/hand.js:226) und raeumt es beim eigenen Start ebenfalls ab
 * (:69). Laeuft also waehrend eines Kaufs ein Terminalbefehl durch, ist der
 * Nachtdienst danach wieder los — mitten in unserer Serie. Dagegen hilft hier
 * nur die Zustandspruefung nach jedem Klick und das Wiederfinden der Seite;
 * sauber loesen liesse sich das erst mit einem Griff, der seinen Besitzer
 * kennt, und der gehoert nach src/hand.js, nicht hierher.
 */
function grabNightshift(doc) {
  let service = null;
  try {
    service = doc.defaultView.__nightshift;
  } catch {
    return () => {};
  }
  if (!service || service.busy) return () => {};
  service.busy = true;
  let timer = null;
  try {
    timer = doc.defaultView.setTimeout(() => (service.busy = false), 300000);
  } catch {
    /* kein Fenster, auch gut */
  }
  return () => {
    service.busy = false;
    if (timer !== null) {
      try {
        doc.defaultView.clearTimeout(timer);
      } catch {
        /* egal */
      }
    }
  };
}

/** Der Eintrag "City" in der Seitenleiste (Sidebar/ui/SidebarItem.tsx:43-45). */
function findSidebarCityItem(doc) {
  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== "City") continue;
    const item = el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']");
    if (item) return item;
  }
  return null;
}

/**
 * Sucht auf der Stadtkarte den Eintrag eines TechVendors.
 *
 * Zwei Darstellungen, beide muessen bedient werden (Locations/ui/City.tsx:155):
 *  - ASCII-Karte: `<span aria-label={name} onClick=...>` (:61)
 *  - Liste bei abgeschalteter ASCII-Kunst: `<Button>{name}</Button>` (:141)
 *
 * Beide haengen an einem gewoehnlichen React-onClick ohne Echtheitspruefung,
 * ein `.click()` genuegt. Beim <span> ist das wichtig zu wissen: `click()`
 * stellt das Ereignis zu, ohne die Stelle zu treffen — die Karte darf also
 * ruhig ausserhalb des Sichtfensters liegen.
 */
function findVendorEntry(doc) {
  for (const v of TECH_VENDORS) {
    const span = doc.querySelector(`[aria-label="${v.name}"]`);
    if (span) return { el: span, vendor: v };
  }
  for (const b of doc.querySelectorAll("button")) {
    const text = labelOf(b);
    const hit = TECH_VENDORS.find((v) => v.name === text);
    if (hit) return { el: b, vendor: hit };
  }
  return { el: null, vendor: null };
}

/**
 * Bringt das Spiel auf die Seite eines TechVendors.
 *
 * Zwei Wege zur Stadtkarte, weil beide je eine Luecke haben:
 *  - Alt+W: Standardbelegung fuer Page.City (utils/KeyBindingUtils.ts:150-158),
 *    der Handler prueft die Echtheit nicht (SidebarRoot.tsx:285-305) und City
 *    ist immer erlaubt (:216). Er steigt aber aus, solange FOKUSSIERTE Arbeit
 *    laeuft oder das BitVerse offen ist (:295), und er laesst sich in den
 *    Einstellungen abschalten (:286). Die Belegung ist ausserdem frei
 *    aenderbar — deshalb ist er nur der erste Versuch, nicht der einzige.
 *  - Klick auf den Seitenleisteneintrag: unabhaengig von Tastenkuerzeln.
 *
 * @returns {string} leerer String bei Erfolg, sonst der Grund
 */
async function goToVendor(doc, sleep, log, allowUnfocus) {
  if (onVendorPage(doc)) {
    log.push("Haendlerseite stand schon offen.");
    return "";
  }

  const unfocus = [...doc.querySelectorAll("button")].find((b) => labelOf(b) === "Do something else simultaneously");
  if (unfocus) {
    if (!allowUnfocus) return "fokussierte Arbeit laeuft, Entfokussieren ist nicht erlaubt";
    unfocus.click();
    // Das ist nicht kostenlos: unfokussierte Arbeit bringt dauerhaft nur noch
    // 80 % (CONSTANTS.BaseFocusBonus, PlayerObjectGeneralMethods.ts:622-628),
    // solange kein NeuroreceptorManager verbaut ist, und sie fokussiert sich
    // nicht von selbst wieder. Wer das nicht will, ruft mit --nofocusbreak auf
    // und bekommt stattdessen einen sauberen Fehlschlag.
    log.push("Fokussierte Arbeit entfokussiert — die Arbeit laeuft weiter, aber nur noch mit 80 % Ertrag, bis jemand sie wieder fokussiert.");
    await sleep(600);
  }

  if (!findVendorEntry(doc).el) {
    doc.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", altKey: true, bubbles: true }));
    log.push("Alt+W gesendet.");
    await sleep(1200);
  }

  if (!findVendorEntry(doc).el) {
    const item = findSidebarCityItem(doc);
    if (!item) {
      const why = detectBlockedPage(doc);
      return why ? `Stadtkarte unerreichbar: ${why}` : "kein Seitenleisteneintrag City gefunden";
    }
    item.click();
    log.push("Seitenleisteneintrag City angeklickt.");
    await sleep(1200);
  }

  const found = findVendorEntry(doc);
  if (!found.el) {
    const why = detectBlockedPage(doc);
    if (why) return `Stadtkarte unerreichbar: ${why}`;
    // Kein Haendler auf der Karte heisst fast immer: falsche Stadt. Chongqing
    // und New Tokyo haben keinen (LocationsMetadata.ts), dort hilft nur eine
    // Reise ueber die Travel Agency.
    return (
      "kein TechVendor auf der Stadtkarte — steht der Spieler in Chongqing oder New Tokyo? " +
      "Dort gibt es keinen; erst nach Sector-12 reisen."
    );
  }

  found.el.click();
  log.push(`Haendler "${found.vendor.name}" (${found.vendor.city}) angeklickt.`);
  await sleep(1200);

  if (!onVendorPage(doc)) {
    const why = detectBlockedPage(doc);
    return why ? `Haendlerseite unerreichbar: ${why}` : "Klick auf den Haendler blieb wirkungslos";
  }
  log.push("Haendlerseite offen, RAM-Knopf sichtbar.");
  return "";
}

/**
 * Wartet, bis eine Bedingung am SPIELZUSTAND zutrifft.
 *
 * Beide Kaeufe sind synchron (ServerPurchases.ts:180, CoresButton.tsx:31), der
 * erste Blick trifft also fast immer schon zu. Die Schleife faengt nur die
 * Neuzeichnung und den Netscript-Zustandsabgleich ab.
 */
async function waitUntil(fn, sleep, timeoutMs, stepMs) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= until) return false;
    await sleep(stepMs);
  }
}

/**
 * Kauft home-RAM und -Kerne ueber die Oberflaeche.
 *
 * @param {object}   o
 * @param {Document} o.doc              das Dokument (in Netscript: `document`)
 * @param {(ms:number)=>Promise<any>} o.sleep
 * @param {()=>number} o.getRam         `() => ns.getServerMaxRam("home")`
 * @param {()=>number} o.getCores       `() => ns.getServer("home").cpuCores`
 * @param {()=>number} o.getMoney       `() => ns.getServerMoneyAvailable("home")`
 * @param {number}  [o.targetRam=2048]  Zielgroesse in GB (wird auf eine
 *                                      Zweierpotenz abgerundet)
 * @param {number}  [o.targetCores=0]   0 = Kerne nicht anfassen
 * @param {number}  [o.budget=0.6]      hoechster Anteil des Startguthabens
 * @param {number}  [o.reserve]         absoluter Betrag, der unangetastet
 *                                      bleibt; ohne Angabe der Rest, der nach
 *                                      dem Budgetanteil uebrig bliebe
 * @param {number}  [o.costMult=1]      BitNode-Aufschlag auf den RAM-Preis
 * @param {boolean} [o.restrictHomePCUpgrade=false]  BitNode-Option
 * @param {boolean} [o.dry=false]       nur rechnen; fasst die Oberflaeche NICHT an
 * @param {boolean} [o.allowUnfocus=true]
 * @param {boolean} [o.returnToTerminal=true]
 * @param {(zeile:string)=>void} [o.onLog]  wird bei JEDER Protokollzeile sofort
 *                                      gerufen. Ohne das steht das Protokoll
 *                                      erst am Ende bereit — und ein `kill`
 *                                      mitten im Lauf haette gar nichts
 *                                      hinterlassen.
 * @returns {Promise<object>} Bericht
 */
export async function upgradeHome(o) {
  const { doc, sleep, getRam, getCores, getMoney } = o;
  const targetCores = o.targetCores ?? 0;
  const budget = o.budget ?? 0.6;
  const costMult = o.costMult ?? 1;
  const dry = !!o.dry;
  const allowUnfocus = o.allowUnfocus !== false;

  // Das Protokoll wird durchgereicht, nicht gesammelt. Wer `onLog` mitgibt,
  // hat jede Zeile sofort auf der Platte.
  const log = [];
  log.push = ((push) =>
    function (zeile) {
      if (typeof o.onLog === "function") {
        try {
          o.onLog(zeile);
        } catch {
          /* der Aufrufer darf uns nicht umbringen */
        }
      }
      return push.call(this, zeile);
    })(Array.prototype.push);

  // Ziel auf eine Zweierpotenz abrunden. home-RAM kann gar nichts anderes
  // annehmen (ServerPurchases.ts:180 verdoppelt nur), ein krummes Ziel wuerde
  // die Schleife sonst einen Schritt zu weit treiben.
  const rawTarget = o.targetRam ?? 2048;
  let targetRam = Math.pow(2, Math.floor(Math.log2(Math.max(1, rawTarget))));
  if (targetRam !== rawTarget) log.push(`Ziel ${rawTarget} GB auf ${targetRam} GB abgerundet (nur Zweierpotenzen).`);
  if (targetRam > HOME_MAX_RAM) {
    targetRam = HOME_MAX_RAM;
    log.push(`Ziel auf den Spieldeckel ${HOME_MAX_RAM} GB begrenzt (Server/data/Constants.ts:6).`);
  }

  const startRam = getRam();
  const startCores = getCores();
  const startMoney = getMoney();

  // Zwei Bremsen, und es lohnt sich zu wissen, wann welche greift:
  //  - `spendCap` deckelt die SUMME der geplanten Kaeufe.
  //  - `reserve` ist ein absoluter Boden fuer das Guthaben.
  //
  // Ohne eigene Vorgabe sind beide aus demselben Startguthaben abgeleitet und
  // binden dann rechnerisch an derselben Stelle — die Ruecklage ist in diesem
  // Fall KEINE zweite, unabhaengige Sicherung. Verschieden werden sie erst,
  // sobald waehrend des Laufs Geld hereinkommt (bei $7 Mio/s durchaus) oder
  // ein anderes Skript welches ausgibt: dann haelt der Deckel die Gesamtsumme,
  // und der Boden verhindert, dass der letzte Kauf die Kasse leert.
  // Wer eine echte, vom Budget unabhaengige Ruecklage will, gibt sie mit
  // `--reserve` als Betrag vor.
  const spendCap = startMoney * budget;
  const reserve = Number.isFinite(o.reserve) && o.reserve > 0 ? o.reserve : startMoney * (1 - budget);
  let planned = 0;

  const report = {
    ok: false,
    dry,
    startRam,
    startCores,
    startMoney,
    ram: startRam,
    cores: startCores,
    targetRam,
    targetCores,
    ramSteps: 0,
    coreSteps: 0,
    plannedSpend: 0,
    reason: "",
    atTerminal: null,
    log,
  };

  log.push(
    `Start: ${startRam} GB / ${startCores} Kerne / $${startMoney.toExponential(3)}; ` +
      `Ziel ${targetRam} GB${targetCores ? " / " + targetCores + " Kerne" : ""}; ` +
      `Ruecklage $${reserve.toExponential(3)}, Ausgabedeckel $${spendCap.toExponential(3)}, ` +
      `RAM-Preisfaktor ${costMult}.`,
  );

  if (o.restrictHomePCUpgrade) {
    log.push("ACHTUNG: BitNode-Option restrictHomePCUpgrade ist aktiv — RAM endet bei 128 GB, Kerne sind gesperrt (RamButton.tsx:24, CoresButton.tsx:18).");
  }

  // Erst gucken, dann handeln. Ist alles schon erreicht, wird die Seite nicht
  // angefasst — ein Seitenwechsel mitten in einem Terminalbefehl von
  // src/hand.js waere sonst ein Schaden ohne jeden Nutzen. `finish` navigiert
  // trotzdem zum Terminal, falls wir gerade woanders stehen; `backToTerminal`
  // ist ein Nichtstun, wenn das Eingabefeld schon da ist.
  if (startRam >= targetRam && (targetCores === 0 || startCores >= Math.min(targetCores, MAX_CORES))) {
    log.push("Ziel steht bereits — es wird nichts gekauft.");
    report.ok = true;
    return await finish(o, report, () => {}, sleep, log);
  }

  // ---- Trockenlauf: reine Rechnung, kein Griff an die Oberflaeche ---------
  //
  // Bewusst VOR allem anderen. Ein `--dry`, das Meldefenster schliesst, die
  // Arbeit entfokussiert und durch drei Seiten navigiert, waere kein
  // Trockenlauf — und genau die Nebenwirkungen will man ja vermeiden, wenn man
  // erst einmal nur nachsehen moechte, was der Plan kostet.
  if (dry) {
    log.push("Trockenlauf: es wird gerechnet, nicht navigiert und nicht geklickt.");
    const ramPlan = dryPreview(
      { log, kind: "RAM", target: targetRam, hardCap: o.restrictHomePCUpgrade ? 128 : HOME_MAX_RAM,
        nextCost: (cur) => ramUpgradeCost(cur, costMult), getMoney, reserve,
        budgetLeft: () => spendCap - planned, plannedSoFar: () => planned,
        onSpend: (c) => (planned += c) },
      startRam,
    );
    report.ramSteps = ramPlan.steps;
    report.reason = ramPlan.reason;
    if (targetCores > startCores && !ramPlan.reason) {
      const corePlan = dryPreview(
        { log, kind: "Kerne", target: Math.min(targetCores, MAX_CORES),
          hardCap: o.restrictHomePCUpgrade ? startCores : MAX_CORES,
          nextCost: (cur) => coreUpgradeCost(cur), getMoney, reserve,
          budgetLeft: () => spendCap - planned, plannedSoFar: () => planned,
          onSpend: (c) => (planned += c) },
        startCores,
      );
      report.coreSteps = corePlan.steps;
      if (corePlan.reason && !report.reason) report.reason = corePlan.reason;
    }
    report.ok = !report.reason;
    report.plannedSpend = planned;
    return report;
  }

  const closed = dismissStrayAlert(doc);
  if (closed) log.push(`Ein stehengebliebenes Meldefenster wurde geschlossen (${closed}).`);

  const release = grabNightshift(doc);
  try {
    const navProblem = await goToVendor(doc, sleep, log, allowUnfocus);
    if (navProblem) {
      report.reason = navProblem;
      return await finish(o, report, release, sleep, log);
    }

    // ---- RAM -------------------------------------------------------------
    const ramOutcome = await buyLoop({
      doc,
      sleep,
      log,
      label: RAM_LABEL,
      kind: "RAM",
      read: getRam,
      getMoney,
      target: targetRam,
      hardCap: o.restrictHomePCUpgrade ? 128 : HOME_MAX_RAM,
      nextCost: (cur) => ramUpgradeCost(cur, costMult),
      needFreshHandler: false, // purchaseRamForHomeComputer rechnet den Preis
      // selbst neu (ServerPurchases.ts:165) — ein veralteter Abschluss kann
      // hier nichts falsch machen.
      budgetLeft: () => spendCap - planned,
      reserve,
      onSpend: (c) => {
        planned += c;
      },
    });
    report.ram = getRam();
    report.ramSteps = ramOutcome.steps;
    if (ramOutcome.reason) report.reason = ramOutcome.reason;

    // ---- Kerne -----------------------------------------------------------
    // Nur, wenn ausdruecklich gewuenscht UND der RAM-Teil nicht schon an
    // Geld oder Oberflaeche gescheitert ist. Sonst wuerde derselbe Fehler
    // zweimal auflaufen und die Fehlermeldung ueberschreiben.
    if (targetCores > getCores() && !ramOutcome.reason) {
      const coreOutcome = await buyLoop({
        doc,
        sleep,
        log,
        label: CORES_LABEL,
        kind: "Kerne",
        read: getCores,
        getMoney,
        target: Math.min(targetCores, MAX_CORES),
        hardCap: o.restrictHomePCUpgrade ? getCores() : MAX_CORES,
        nextCost: (cur) => coreUpgradeCost(cur),
        // CoresButton.buy zahlt den beim Rendern eingefrorenen Preis
        // (CoresButton.tsx:20 und :30). Vor dem naechsten Klick muss deshalb
        // eine Neuzeichnung stattgefunden haben.
        needFreshHandler: true,
        budgetLeft: () => spendCap - planned,
        reserve,
        onSpend: (c) => {
          planned += c;
        },
      });
      report.cores = getCores();
      report.coreSteps = coreOutcome.steps;
      if (coreOutcome.reason && !report.reason) report.reason = coreOutcome.reason;
    }

    report.ok = report.ram >= targetRam && (targetCores === 0 || report.cores >= Math.min(targetCores, MAX_CORES));
  } catch (e) {
    // Kein Fehler darf nach draussen: dieses Skript ist das Werkzeug, das den
    // Steuerkanal ueberhaupt erst billig machen soll. Es soll nicht stumm
    // sterben, sondern seinen Grund in die Ausgabedatei schreiben.
    report.reason = "Ausnahme: " + (e && e.message ? e.message : String(e));
    log.push(report.reason);
  }

  report.plannedSpend = planned;
  return await finish(o, report, release, sleep, log);
}

/**
 * Zum Terminal zurueck, DANN den Nachtdienst freigeben.
 *
 * Die Reihenfolge ist nicht beliebig: `backToTerminal` schickt Alt+T und
 * klickt notfalls die Seitenleiste an, braucht also gut zwei Sekunden. Wer den
 * Dienst vorher freigibt, laesst ihn genau in dieser Zeit wieder auf dieselbe
 * Oberflaeche los — die Verschachtelung, die der Griff verhindern soll.
 */
async function finish(o, report, release, sleep, log) {
  report.plannedSpend = report.plannedSpend || 0;
  try {
    // Im Trockenlauf wird auch hier nicht navigiert. Sonst haette ein `--dry`
    // auf einem bereits erreichten Ziel doch noch die Seite gewechselt — und
    // genau das soll `--dry` nie tun.
    if (o.returnToTerminal !== false && !o.dry) {
      report.atTerminal = await backToTerminal(o.doc, sleep, log);
    }
  } finally {
    release();
  }
  return report;
}

/**
 * Die eigentliche Kaufschleife — fuer RAM und Kerne dieselbe.
 *
 * Der Aufbau folgt genau der Lehre aus dem Stillstand vom 20.08.: die Schleife
 * klickt nie stur weiter, sondern leitet jeden Schritt aus dem gemessenen
 * Zustand ab und bricht ab, sobald sich zweimal hintereinander nichts bewegt.
 */
async function buyLoop(c) {
  const { doc, sleep, log, label, kind, read, getMoney, target, hardCap, nextCost } = c;
  let steps = 0;
  let stagnant = 0;
  let renavigations = 0;
  // Getrennt vom zuruecksetzbaren Zaehler: eine harte Obergrenze fuer den
  // ganzen Lauf. Jede Rueckkehr zur Haendlerseite ist ein Seitenwechsel, und
  // jeder Seitenwechsel kann src/hand.js einen laufenden Befehlsstapel
  // zerreissen (hand.js:196 bricht ab, und hand.js:127 hat die Befehlszeile da
  // schon als erledigt vermerkt — sie wird NIE wiederholt). Ein Pingpong ueber
  // zwanzig Runden waere also teuer, auch wenn er am Ende ans Ziel kaeme.
  let renavigationsTotal = 0;

  for (let guard = 0; guard < 64; guard++) {
    const cur = read();
    if (cur >= target) {
      if (steps > 0) log.push(`${kind}: Ziel ${target} erreicht.`);
      return { steps, reason: "" };
    }
    if (cur >= hardCap) {
      return { steps, reason: `${kind}: Spieldeckel bei ${hardCap} erreicht, Ziel ${target} ist unerreichbar` };
    }

    const cost = nextCost(cur);
    const money = getMoney();
    const left = c.budgetLeft();

    if (cost > left) {
      return {
        steps,
        reason:
          `${kind}: naechster Schritt von ${cur} kostet $${cost.toExponential(3)}, ` +
          `der Ausgabedeckel laesst nur noch $${left.toExponential(3)} zu`,
      };
    }
    if (money - cost < c.reserve) {
      return {
        steps,
        reason:
          `${kind}: naechster Schritt von ${cur} kostet $${cost.toExponential(3)}, ` +
          `Guthaben $${money.toExponential(3)} minus Ruecklage $${c.reserve.toExponential(3)} reicht nicht`,
      };
    }

    let btn = findButton(doc, label);
    if (!btn) {
      // Ein anderes Skript kann uns die Seite unter den Fuessen weggezogen
      // haben — src/hand.js schickt bei jedem Befehl Alt+T. Zurueckfinden ist
      // richtig, endlos wieder aufsteigen nicht. Der Zaehler wird nach jedem
      // gelungenen Kauf zurueckgesetzt: gegen einen Automaten, der alle paar
      // Sekunden dazwischenfunkt, darf man beliebig oft zurueckkehren —
      // verboten ist nur, ohne jeden Fortschritt im Kreis zu laufen.
      if (renavigations >= 2 || renavigationsTotal >= 6) {
        return {
          steps,
          reason:
            `${kind}: Knopf "${label}" verschwunden (${renavigationsTotal} Rueckkehrversuche im Lauf) — ` +
            `es navigiert offenbar noch jemand anders. Abgebrochen, statt src/hand.js weiter Befehle zu zerreissen`,
        };
      }
      renavigations++;
      renavigationsTotal++;
      log.push(`${kind}: Knopf weg — Haendlerseite wird erneut angesteuert (${renavigationsTotal}. Mal im Lauf).`);
      const problem = await goToVendor(doc, sleep, log, true);
      if (problem) return { steps, reason: `${kind}: ${problem}` };
      continue;
    }

    // Deaktivierte Knoepfe werden NICHT umgangen. `disabled` ist der Stand der
    // letzten Neuzeichnung; die kommt im Spieltakt (useCycleRerender,
    // ui/React/hooks.ts:24-31), also warten wir kurz darauf.
    if (btn.disabled) {
      const enabled = await waitUntil(
        () => {
          btn = findButton(doc, label) || btn;
          return !btn.disabled;
        },
        sleep,
        3000,
        200,
      );
      if (!enabled) {
        // Die Diagnose muss den haeufigsten Fall zuerst nennen, sonst sucht man
        // an der falschen Stelle. `disabled` kommt bei RamButton.tsx:49 und
        // CoresButton.tsx:43 aus `!Player.canAfford(cost)`; zwischen unserer
        // Geldmessung und dem Klick koennen Aktien-, Server- oder
        // Hacknet-Skripte laengst zugegriffen haben. Deshalb wird das Guthaben
        // hier NEU gelesen und der Grund daraus abgeleitet.
        const nowMoney = getMoney();
        const why =
          nowMoney < cost
            ? `das Guthaben ist inzwischen auf $${nowMoney.toExponential(3)} gefallen und deckt die ` +
              `$${cost.toExponential(3)} nicht mehr — ein anderes Skript hat dazwischen eingekauft`
            : `bei $${nowMoney.toExponential(3)} Guthaben waeren $${cost.toExponential(3)} bezahlbar; ` +
              `dann stimmt entweder der Preisfaktor nicht, das Maximum ist erreicht, oder eine ` +
              `BitNode-Option sperrt den Kauf`;
        return { steps, reason: `${kind}: Knopf bleibt deaktiviert — ${why}` };
      }
    }

    const before = read();
    const handlerBefore = clickHandlerOf(btn);
    btn.click();
    steps++;

    const moved = await waitUntil(() => read() > before, sleep, 3000, 200);

    if (moved) {
      stagnant = 0;
      renavigations = 0;
      c.onSpend(cost);
      log.push(`${kind}: ${before} -> ${read()} fuer geschaetzte $${cost.toExponential(3)}.`);
      if (c.needFreshHandler) {
        // Warten, bis nach dem Klick mindestens einmal neu gezeichnet wurde.
        //
        // Das ist kein Test, der fehlschlagen soll — TechVendorLocation nutzt
        // `useCycleRerender` (TechVendorLocation.tsx:40, ui/React/hooks.ts:24-32)
        // und zeichnet in JEDEM Spieltakt neu, der Abschluss wechselt also
        // ohnehin. Es ist eine Wartebedingung mit Beweiskraft: sobald der
        // onClick-Abschluss ein anderer ist als der eben geklickte, hat ein
        // Rendern NACH unserem Kauf stattgefunden, und der neue Abschluss hat
        // `Player.getUpgradeHomeCoresCost()` mit der neuen Kernzahl gelesen.
        // Ohne das kaufte der naechste Klick den TEUREREN Kern zum ALTEN Preis
        // (CoresButton.tsx:20 friert `cost` beim Rendern ein, :30 zahlt genau
        // diesen Betrag). Schlaegt es doch fehl, steht die Oberflaeche — und
        // dann ist Abbrechen richtig.
        const fresh = await waitUntil(
          () => {
            const b = findButton(doc, label);
            return !!b && clickHandlerOf(b) !== handlerBefore;
          },
          sleep,
          3000,
          200,
        );
        if (!fresh) {
          return { steps, reason: `${kind}: Oberflaeche hat nach dem Kauf nicht neu gezeichnet — weitere Kaeufe abgebrochen, um nicht den alten Preis zu zahlen` };
        }
      } else {
        await sleep(200);
      }
      continue;
    }

    stagnant++;
    const strayClosed = dismissStrayAlert(doc);
    if (strayClosed) log.push(`${kind}: Meldefenster nach dem Klick geschlossen (${strayClosed}).`);
    log.push(`${kind}: Klick ${stagnant} blieb wirkungslos (Stand unveraendert bei ${before}).`);
    if (stagnant >= 2) {
      return {
        steps,
        reason:
          `${kind}: zweimal hintereinander keine Aenderung (Stand ${before}, erwartete Kosten ` +
          `$${cost.toExponential(3)}, Guthaben $${getMoney().toExponential(3)}) — abgebrochen statt weiterzuklicken`,
      };
    }
    await sleep(700);
  }

  return { steps, reason: `${kind}: Sicherheitsgrenze von 64 Durchlaeufen erreicht` };
}

/**
 * Vorschau ohne Kauf. Rechnet den ganzen Weg durch, damit `--dry` die
 * Gesamtkosten zeigt, statt an einem unveraenderten Zustand haengenzubleiben.
 *
 * Geprueft werden dieselben zwei Bremsen wie im Ernstfall — die Vorschau soll
 * denselben Abbruchgrund liefern, den der echte Lauf liefern wuerde.
 */
function dryPreview(c, from) {
  let cur = from;
  let steps = 0;
  // `spent` startet bei dem, was ein vorheriger Abschnitt (RAM vor Kernen)
  // schon verplant hat — sonst wuerde die Kernvorschau dasselbe Geld ein
  // zweites Mal ausgeben.
  const money = c.getMoney();
  let spent = c.plannedSoFar ? c.plannedSoFar() : 0;
  for (let i = 0; i < 64 && cur < c.target; i++) {
    if (cur >= c.hardCap) return { steps, reason: `${c.kind} [trocken]: Spieldeckel bei ${c.hardCap} erreicht` };
    const cost = c.nextCost(cur);
    const left = c.budgetLeft();
    if (cost > left) {
      return {
        steps,
        reason: `${c.kind} [trocken]: ab ${cur} reicht der Ausgabedeckel nicht mehr ($${cost.toExponential(3)} noetig, $${left.toExponential(3)} frei)`,
      };
    }
    if (money - spent - cost < c.reserve) {
      return {
        steps,
        reason: `${c.kind} [trocken]: ab ${cur} unterschreitet der Kauf die Ruecklage ($${cost.toExponential(3)} noetig, $${(money - spent - c.reserve).toExponential(3)} verfuegbar)`,
      };
    }
    c.log.push(`[trocken] ${c.kind}: ${cur} -> ${c.kind === "RAM" ? cur * 2 : cur + 1} fuer $${cost.toExponential(3)}`);
    c.onSpend(cost);
    spent += cost;
    steps++;
    cur = c.kind === "RAM" ? cur * 2 : cur + 1;
  }
  return { steps, reason: "" };
}

/**
 * Zurueck ans Terminal — und nachsehen, ob es geklappt hat.
 *
 * Ohne diese Pruefung verschluckt src/hand.js den naechsten Befehl: es gibt
 * auf, wenn `terminal-input` fehlt (src/hand.js:153-160). Ein blindes Alt+T
 * reicht nicht, auf den Seiten ohne Seitenleiste gibt es den Handler nicht.
 */
async function backToTerminal(doc, sleep, log) {
  const there = () => !!doc.getElementById("terminal-input");
  if (there()) return true;

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", code: "KeyT", altKey: true, bubbles: true }));
  await sleep(900);
  if (there()) return true;

  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== "Terminal") continue;
    el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']")?.click();
    break;
  }
  await sleep(900);
  const done = there();
  if (!done) log.push("ACHTUNG: Rueckkehr zum Terminal misslungen — der naechste Terminalbefehl wird scheitern.");
  return done;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const flags = ns.flags([
    ["ram", 2048],
    ["cores", 0],
    ["budget", 0.6],
    ["reserve", 0], // 0 = aus dem Budgetanteil ableiten
    ["out", "data/homeram.txt"],
    ["dry", false],
    ["nofocusbreak", false],
    ["help", false],
  ]);

  const OUT = String(flags.out);
  const HOST = ns.getHostname();

  // ns.write und ns.read arbeiten IMMER auf dem Rechner, auf dem das Skript
  // laeuft — und das ist hier nicht home (30,4 GB passen dort nicht hin).
  // Der Bericht muss aber auf home landen, sonst ist er von aussen nicht
  // lesbar. Derselbe Fallstrick wie in src/hand.js:42-51.
  const lines = [];
  const flush = () => {
    try {
      ns.write(OUT, lines.join("\n") + "\n", "w");
      if (HOST !== "home") ns.scp(OUT, "home", HOST);
    } catch (e) {
      ns.print("Bericht konnte nicht geschrieben werden: " + e);
    }
  };
  const say = (s) => {
    lines.push(s);
    ns.print(s);
    flush(); // nach JEDER Zeile: stirbt das Skript mitten im Lauf, ist der
    // Stand bis dahin trotzdem von aussen lesbar.
  };

  say(`# homeram.js — ${new Date().toISOString()} auf ${HOST}`);

  if (flags.help) {
    say("Aufruf: run homeram.js [--ram 2048] [--cores 0] [--budget 0.6] [--reserve 0] [--dry] [--nofocusbreak] [--out data/homeram.txt]");
    say("  --dry rechnet nur und fasst die Oberflaeche nicht an.");
    say("  --reserve <Betrag> haelt einen festen Betrag frei, unabhaengig vom Budgetanteil.");
    return;
  }

  // Parameter aus dem ZUSTAND ableiten statt zu raten — das ist die Lehre aus
  // dem Stillstand vom 20.08. Der RAM-Preis haengt am BitNode
  // (BitNode/BitNode.tsx:565ff), und `restrictHomePCUpgrade` kann den Kauf
  // ganz sperren (RamButton.tsx:24).
  const reset = ns.getResetInfo();
  const node = reset.currentNode;
  const sfLevel = reset.ownedSF instanceof Map ? reset.ownedSF.get(node) || 0 : 0;
  const costMult = homeRamCostMult(node, sfLevel);
  const restrict = !!(reset.bitNodeOptions && reset.bitNodeOptions.restrictHomePCUpgrade);
  say(`BitNode ${node} (SF-Stufe ${sfLevel}) -> RAM-Preisfaktor ${costMult}; restrictHomePCUpgrade=${restrict}`);

  const report = await upgradeHome({
    doc: document,
    sleep: (ms) => ns.sleep(ms),
    getRam: () => ns.getServerMaxRam("home"),
    getCores: () => ns.getServer("home").cpuCores,
    getMoney: () => ns.getServerMoneyAvailable("home"),
    targetRam: Number(flags.ram),
    targetCores: Number(flags.cores),
    budget: Number(flags.budget),
    reserve: Number(flags.reserve),
    costMult,
    restrictHomePCUpgrade: restrict,
    dry: !!flags.dry,
    allowUnfocus: !flags.nofocusbreak,
    returnToTerminal: true,
    // Jede Protokollzeile sofort auf die Platte. Ohne das haette ein `kill`
    // mitten im Lauf nur die zwei Kopfzeilen hinterlassen: `report.log` wird
    // erst nach der Rueckkehr aus upgradeHome uebergeben, und ein ScriptDeath
    // aus ns.sleep kommt ohne Vorwarnung.
    onLog: (z) => say("  " + z),
  });

  say("--- Ergebnis ---");
  say(`RAM   : ${report.startRam} -> ${report.ram} GB (Ziel ${report.targetRam}, ${report.ramSteps} Klick(s))`);
  say(`Kerne : ${report.startCores} -> ${report.cores} (Ziel ${report.targetCores || "unveraendert"}, ${report.coreSteps} Klick(s))`);
  say(`Geld  : $${report.startMoney.toExponential(4)} -> $${ns.getServerMoneyAvailable("home").toExponential(4)}`);
  say(`Geplant ausgegeben (geschaetzt): $${report.plannedSpend.toExponential(4)}`);
  say(`Ziel erreicht: ${report.ok ? "JA" : "NEIN"}${report.reason ? " — " + report.reason : ""}`);
  say(`Zurueck am Terminal: ${report.atTerminal === null ? "nicht geprueft" : report.atTerminal ? "ja" : "NEIN — hand.js wird den naechsten Befehl verschlucken"}`);

  // Zum Schluss noch einmal in die Spielkonsole, damit ein Blick ins Fenster
  // reicht, falls die Datei nicht ankommt.
  ns.tprint(`homeram: ${report.startRam} -> ${report.ram} GB, Kerne ${report.startCores} -> ${report.cores}. ${report.ok ? "Ziel erreicht." : report.reason}`);
}
