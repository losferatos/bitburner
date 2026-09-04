/**
 * entwurf/travel/travel.js — zwischen Staedten reisen und Faktionen beitreten,
 * ohne dass ein Mensch klickt.
 *
 * ============================================================================
 * WOZU
 * ============================================================================
 *
 * Fuer Daedalus braucht der Spieler 30 verschiedene installierte
 * Augmentations. Die Bedingung ist `haveAugmentations(...)`
 * (Faction/FactionInfo.tsx:142) und prueft schlicht
 * `p.augmentations.length >= n` (Faction/FactionJoinCondition.ts:130) — der
 * NeuroFluxGovernor steht dort als EIN Eintrag mit einem `level`-Feld, zaehlt
 * also unabhaengig von seiner Stufe genau einmal. Es geht folglich um die Zahl
 * verschiedener Augmentations, und die kommt nur ueber die Zahl verschiedener
 * Faktionen zusammen.
 *
 * Die sechs Stadtfaktionen sind untereinander verfeindet
 * (Faction/FactionInfo.tsx:498, :508, :520, :530, :540, :552). Wer beitritt,
 * sperrt sich sofort und bis zur naechsten Augmentierung alle Feinde:
 *
 *     for (const enemy of faction.getInfo().enemies) {
 *       if (Factions[enemy]) Factions[enemy].isBanned = true;
 *     }
 *                                        (Faction/FactionHelpers.tsx:44-46)
 *
 * Es gibt also genau zwei Lager, und die Wahl ist unumkehrbar. Diese Datei
 * trifft die Wahl NICHT — sie bekommt sie als Argument und weigert sich,
 * etwas anderes anzufassen.
 *
 * ============================================================================
 * DIE ZWEI GEFAHRENSTELLEN, DIE DIESE DATEI ERNST NIMMT
 * ============================================================================
 *
 * 1. DAS EINLADUNGSFENSTER NENNT AUCH DIE FEINDE.
 *
 *    entwurf/join/join.js sucht das Einladungsfenster so:
 *
 *        if (!text.includes(factionName)) continue;      // join.js:266
 *
 *    Das ist hier LEBENSGEFAEHRLICH. Das Fenster listet unter dem Namen der
 *    einladenden Faktion ausdruecklich deren Feinde auf
 *    (Faction/ui/FactionInvitationManager.tsx:69-79). Steht das Fenster von
 *    Sector-12 offen, enthaelt sein Text die Zeilen "Chongqing", "New Tokyo",
 *    "Ishima", "Volhaven" — ein `includes("Chongqing")` trifft also zu, und
 *    der Klick auf `Join` traete SECTOR-12 bei. Genau der Fehlgriff, der das
 *    ganze Vorhaben zerstoert.
 *
 *    Deshalb wird hier ausschliesslich der fett gesetzte Name geprueft:
 *    `Would you like to join <b>{faction?.name}</b>?`
 *    (FactionInvitationManager.tsx:66). Ein `<b>`, dessen Text GENAU der
 *    gesuchte Name ist — sonst wird nicht geklickt.
 *
 * 2. DREI VERSCHIEDENE WELTKARTEN IM SPIEL, ZWEI DAVON REISEN NICHT.
 *
 *    `ui/React/WorldMap.tsx` wird an drei Stellen benutzt: von der Reiseagentur
 *    (Locations/ui/TravelAgencyRoot.tsx:76), vom Sleeve-Reisefenster
 *    (PersonObjects/Sleeve/ui/TravelModal.tsx:43) und vom Bladeburner-
 *    Reisefenster (Bladeburner/ui/TravelModal.tsx:35). Alle drei erzeugen
 *    dieselben anklickbaren Ein-Buchstaben-Spannen mit denselben React-Props
 *    `{ city, currentCity, onTravel }` (WorldMap.tsx:28-38).
 *
 *    Ein Klick auf die falsche verschiebt einen Sleeve fuer $200.000 oder
 *    einen Bladeburner-Standort — `Player.city` aendert sich nie, das Skript
 *    versucht es erneut, und das Geld ist jedes Mal weg.
 *
 *    Deshalb wird nur INNERHALB des Teilbaums der Reiseagentur gesucht (an der
 *    Ueberschrift `<Typography variant="h4">Travel Agency</Typography>`,
 *    TravelAgencyRoot.tsx:55, festgemacht), und jede Fundstelle innerhalb
 *    eines `.MuiModal-root` wird verworfen — MUI haengt Modals per Portal an
 *    `document.body`, sie liegen also nie im Teilbaum der Seite. Steht ein
 *    fremdes Reisefenster offen, bricht der Lauf ausdruecklich ab.
 *
 * ============================================================================
 * WIE GEREIST WIRD
 * ============================================================================
 *
 * Reisen ist billig und ohne BitNode-Aufschlag: `CONSTANTS.TravelCost` ist
 * pauschal $200.000 (Constants.ts:28), und `Person.travel` zieht genau diesen
 * Betrag ab und setzt `this.city` (PersonObjects/Person.ts:243-252). Es gibt
 * keinen Multiplikator — im ganzen Quelltext kommt kein
 * `TravelCostMultiplier` vor.
 *
 * Der Weg zur Reiseagentur (drei Stufen, weil jede eine Luecke hat):
 *
 *   1. Alt+R. `SimplePage.Travel` hat diese Standardbelegung
 *      (utils/KeyBindingUtils.ts:160-168) und `canGoToPage` gibt fuer sie
 *      immer `true` zurueck (Sidebar/ui/SidebarRoot.tsx:217-221). Der Handler
 *      prueft die Echtheit des Ereignisses NICHT
 *      (SidebarRoot.tsx:285-306). Er steigt aber vorzeitig aus, solange
 *      FOKUSSIERTE Arbeit laeuft oder das BitVerse offen ist (:296), und er
 *      laesst sich in den Einstellungen abschalten (:287); ausserdem ist die
 *      Belegung frei aenderbar.
 *   2. Der Seitenleisteneintrag "Travel" (SidebarRoot.tsx:411; die
 *      Beschriftung ist der Seitenname selbst, SidebarItem.tsx:44-46).
 *   3. Ueber die Stadtkarte: dort steht die Agentur als
 *      `<span aria-label="Travel Agency">` (Locations/ui/City.tsx:59) und
 *      `toLocation` schickt auf `Page.Travel` (City.tsx:37-39). Die Agentur
 *      hat in den Metadaten `city: null` (Locations/data/LocationsMetadata.ts:436-440)
 *      und steht damit in JEDER Stadt.
 *
 * Auf der Seite selbst:
 *
 *   - Bei abgeschalteter ASCII-Kunst steht je Stadt ein Knopf mit dem Text
 *     "Travel to <Stadt>" (TravelAgencyRoot.tsx:69). Diese Beschriftung ist
 *     eindeutig: die Sleeve- und Bladeburner-Fenster beschriften ihre Knoepfe
 *     nur mit dem nackten Stadtnamen (Sleeve/ui/TravelModal.tsx:39,
 *     Bladeburner/ui/TravelModal.tsx:31).
 *   - Sonst die Weltkarte. Dort zeigt jede Stadt nur ihren ANFANGSBUCHSTABEN
 *     (WorldMap.tsx:33). Die sechs Buchstaben A, C, S, N, I, V sind zwar
 *     zufaellig eindeutig — verlassen wird sich darauf trotzdem nicht.
 *     Stattdessen wird vom Spannenknoten aus der React-Fiber-Baum nach oben
 *     gegangen, bis eine Komponente mit `{city, currentCity, onTravel}`
 *     auftaucht. Das ist die `City`-Komponente (WorldMap.tsx:28), und ihr
 *     `city`-Prop sagt ohne Ratespiel, wohin dieser Knoten reist.
 *
 * Danach: `startTravel` oeffnet ein Bestaetigungsfenster, sofern
 * `Settings.SuppressTravelConfirmation` nicht gesetzt ist
 * (TravelAgencyRoot.tsx:44-51). Dessen Knopf "Travel" haengt an einem
 * gewoehnlichen onClick ohne Echtheitspruefung
 * (TravelConfirmationModal.tsx:29). Beide Faelle werden bedient. Vor dem Klick
 * wird der Text des Fensters gelesen und darauf bestanden, dass er GENAU eine
 * Stadt nennt und dass es die gewuenschte ist (TravelConfirmationModal.tsx:23-25).
 *
 * Nach gelungener Reise erscheint ein Meldefenster "You are now in X!"
 * (TravelAgencyRoot.tsx:30) und das Spiel springt auf die Stadtseite (:32).
 * Das Fenster wird ueber sein Kreuz geschlossen (ui/React/Modal.tsx:94), nicht
 * ueber Escape — Escape leert die GANZE Meldungsliste
 * (ui/React/AlertManager.tsx:40-46) und wuerde fremde Meldungen mitreissen.
 *
 * ============================================================================
 * WIE DER ERFOLG GEPRUEFT WIRD
 * ============================================================================
 *
 * Ausschliesslich am Spielerzustand, nie am Bildschirm:
 *
 *   Reise   -> `ns.getPlayer().city`      (NetscriptFunctions.ts:1378, eine
 *                                          Kopie von `Player.city`, gesetzt in
 *                                          Person.ts:250)
 *   Beitritt-> `ns.getPlayer().factions`  (NetscriptFunctions.ts:1385, gesetzt
 *                                          in FactionHelpers.tsx:42)
 *
 * Der Grund steht in src/hand.js:200-206: der Terminalpuffer enthaelt
 * Meldungen frueherer Versuche, an denen jede Textpruefung sofort anschlaegt.
 * Bildschirmtext dient hier nur zum FINDEN von Knoepfen und zum BENENNEN von
 * Fehlerlagen.
 *
 * ============================================================================
 * DIE SPERRLISTE IST PFLICHT — UND SIE TUT ETWAS
 * ============================================================================
 *
 * `--forbid` ist keine Zierde. Die Vorpruefung rechnet aus, welche Faktionen
 * der Plan verbrennen wuerde (die Feinde aller genannten Beitritte), und
 * verlangt, dass JEDE davon in der Sperrliste steht. Fehlt eine, laeuft gar
 * nichts — dann hat der Aufrufer die Folgen nicht ueberblickt.
 *
 * Umgekehrt wird nie eine Faktion beigetreten, die nicht woertlich in
 * `--join` steht, und eine Faktion aus `--forbid` wird nie angeklickt, auch
 * nicht versehentlich.
 *
 * ============================================================================
 * NAMEN MIT LEERZEICHEN — EIN ECHTER FALLSTRICK DES AUFTRAGSLAEUFERS
 * ============================================================================
 *
 * `src/autopilot.js:560` zerlegt die Auftragszeile mit `zeile.split(/\s+/)`.
 * "New Tokyo" oder "Tian Di Hui" kaemen dort als drei getrennte Argumente an.
 * Deshalb werden Namen hier normalisiert verglichen: Kleinschreibung, alles
 * ausser a-z und 0-9 entfernt. `NewTokyo`, `new-tokyo` und `New Tokyo` sind
 * damit derselbe Name, und `sector12` findet "Sector-12".
 *
 * Ein Name, der sich NICHT aufloesen laesst, ist ein harter Abbruch. Geraten
 * wird nichts — ein Tippfehler bei einem Faktionsnamen ist hier teurer als
 * jeder Abbruch.
 *
 * ============================================================================
 * SPEICHERBEDARF
 * ============================================================================
 *
 * Der Bezeichner `document` kostet pauschal 25 GB
 * (Netscript/RamCostGenerator.ts:12). Dazu:
 *
 *   baseCost 1,60 + document 25 + getPlayer 0,50 (SingularityFn1/4,
 *   RamCostGenerator.ts:55 und :661) + scp 0,60 + getHostname 0,05 = 27,75 GB
 *
 * Das passt nicht auf ein home mit 16 GB. Das Skript laeuft also auf einem
 * gekauften oder uebernommenen Rechner — genau dafuer gibt es den
 * Auftragslaeufer.
 *
 * Nachrechnen laesst sich das, sobald die Datei auf home liegt:
 *
 *   node -e "fetch('http://localhost:8795/api/rpc?method=calculateRam&filename=travel.js&server=home').then(r=>r.json()).then(o=>console.log(o))"
 *
 * ============================================================================
 * AUFRUF
 * ============================================================================
 *
 * Bereitstellen (die Bruecke ueberwacht `src/` und schiebt Aenderungen von
 * selbst ins Spiel, sync/bridge.js:192-214):
 *
 *   copy entwurf\travel\travel.js src\travel.js
 *
 * Trockenlauf — fasst NICHTS an, kein Seitenwechsel, kein Klick, keine Reise:
 *
 *   node tools/task.js travel.js --join Chongqing,TianDiHui,NewTokyo,Ishima --forbid Sector-12,Aevum,Volhaven --dry
 *
 * Ernstfall (Lager B):
 *
 *   node tools/task.js travel.js --join Chongqing,TianDiHui,NewTokyo,Ishima --forbid Sector-12,Aevum,Volhaven
 *
 * Nur reisen, nichts beitreten:
 *
 *   node tools/task.js travel.js --to Chongqing --join "" --forbid Sector-12,Aevum,Volhaven
 *
 * Protokoll steht Zeile fuer Zeile in `data/travel.txt` auf home.
 *
 * ============================================================================
 * PRUEFSTAND
 * ============================================================================
 *
 *   node entwurf/travel/selftest.mjs
 *
 * 25 Pruefungen ohne Spiel und ohne Browser: die Trockenlaeufe samt aller
 * Abbruchpfade, und die Entscheidungsfunktionen gegen einen Mini-DOM. Darunter
 * der Nachweis, dass das Sector-12-Einladungsfenster den naiven Textvergleich
 * tatsaechlich austricksen wuerde und dass diese Datei nicht darauf
 * hereinfaellt. Wer hier etwas aendert, laesst den Pruefstand laufen.
 *
 * Deshalb sind `findCityTarget`, `findTravelConfirmButton`,
 * `findPageJoinButton` und `readInvitationModal` exportiert: das sind die vier
 * Funktionen, die entscheiden, WOHIN geklickt wird, und genau die gehoeren
 * einzeln pruefbar. Netscript kostet das nichts — der RAM-Rechner saet nur die
 * Bezeichner des Einstiegsskripts und folgt von dort den Kanten
 * (RamCalculations.ts:165).
 */

// ---------------------------------------------------------------------------
// Tabellen aus dem Quelltext. Alles hier ist abgeschrieben, nichts geraten.
// ---------------------------------------------------------------------------

/** Locations/Enums.ts:70-77. Die Schreibweise ist die Spielschreibweise. */
const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

/** Constants.ts:28. Pauschal, ohne BitNode-Aufschlag (Person.ts:243-252). */
const TRAVEL_COST = 200e3;

/**
 * Wer wen sperrt (Faction/FactionInfo.tsx:498, :508, :520, :530, :540, :552).
 *
 * Diese sechs sind die EINZIGEN Faktionen mit Feinden — `FactionInfo` setzt
 * `this.enemies = params.enemies ?? []` (FactionInfo.tsx:100), und im ganzen
 * FactionInfo.tsx taucht `enemies:` genau sechsmal auf. Jede hier nicht
 * genannte Faktion sperrt beim Beitritt also niemanden.
 */
const ENEMIES = {
  "Aevum": ["Chongqing", "New Tokyo", "Ishima", "Volhaven"],
  "Sector-12": ["Chongqing", "New Tokyo", "Ishima", "Volhaven"],
  "Chongqing": ["Sector-12", "Aevum", "Volhaven"],
  "Ishima": ["Sector-12", "Aevum", "Volhaven"],
  "New Tokyo": ["Sector-12", "Aevum", "Volhaven"],
  "Volhaven": ["Chongqing", "Sector-12", "New Tokyo", "Aevum", "Ishima"],
};

/**
 * Einladungsbedingungen der Faktionen, fuer die eine REISE etwas aendert
 * (Faction/FactionInfo.tsx:495-560 und :680-694).
 *
 * Nur diese sieben stehen hier, und das ist Absicht: fuer jede andere Faktion
 * kann dieses Skript ohnehin nichts tun ausser eine bereits vorliegende
 * Einladung anzunehmen. `cities` ist die Menge der Staedte, in denen die
 * Einladung ueberhaupt entstehen kann; `money` und `hacking` sind die
 * Schwellen, die `checkForFactionInvitations` alle zwei Sekunden prueft
 * (engine.tsx:171-177 mit Zaehler 10 bei 200 ms je Zyklus).
 *
 * Wichtig: geprueft wird beim ENTSTEHEN der Einladung. Faellt das Guthaben
 * danach, bleibt die Einladung bestehen — `checkForFactionInvitations`
 * ueberspringt alles mit `alreadyInvited` (PlayerObjectGeneralMethods.ts:456).
 */
const INVITE_REQS = {
  "Aevum": { cities: ["Aevum"], money: 40e6, hacking: 0 },
  "Chongqing": { cities: ["Chongqing"], money: 20e6, hacking: 0 },
  "Ishima": { cities: ["Ishima"], money: 30e6, hacking: 0 },
  "New Tokyo": { cities: ["New Tokyo"], money: 20e6, hacking: 0 },
  "Sector-12": { cities: ["Sector-12"], money: 15e6, hacking: 0 },
  "Volhaven": { cities: ["Volhaven"], money: 50e6, hacking: 0 },
  "Tian Di Hui": { cities: ["Chongqing", "New Tokyo", "Ishima"], money: 1e6, hacking: 50 },
};

/** Beschriftung des geschuetzten Knopfes auf der Faktionsseite (FactionsRoot.tsx:123). */
const PAGE_JOIN_LABEL = "Join!";
/** Beschriftung im Einladungsfenster (FactionInvitationManager.tsx:82). */
const MODAL_JOIN_LABEL = "Join";
/** Der harmlose Ausweg aus dem Einladungsfenster (FactionInvitationManager.tsx:85). */
const MODAL_LATER_LABEL = "Decide later";
/** Ueberschrift der Reiseagentur (TravelAgencyRoot.tsx:55). */
const TRAVEL_PAGE_TITLE = "Travel Agency";

// ---------------------------------------------------------------------------
// Namen aufloesen
// ---------------------------------------------------------------------------

/**
 * Vergleichsform eines Namens.
 *
 * Der Auftragslaeufer zerlegt die Zeile an jedem Leerzeichen
 * (src/autopilot.js:560), Namen mit Leerzeichen kommen also zerrissen an.
 * Statt eine Anfuehrungszeichen-Regel zu erfinden, die dort niemand kennt,
 * wird die Schreibweise beim Vergleich weggeworfen.
 */
function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Loest einen geschriebenen Namen gegen eine Liste bekannter Namen auf. */
function resolveName(input, known) {
  const want = normalizeName(input);
  if (!want) return null;
  return known.find((k) => normalizeName(k) === want) || null;
}

/**
 * Zerlegt eine Kommaliste. Leere Stuecke fallen weg, damit ein versehentliches
 * `--join a,,b` nicht in einem leeren Namen endet.
 */
function splitList(s) {
  return String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// DOM-Handwerk. Uebernommen aus entwurf/join/join.js und entwurf/homeram/homeram.js.
// ---------------------------------------------------------------------------

/**
 * Sichtbarer Text eines Elements, robust gegen geschuetzte Leerzeichen.
 *
 * Das Zeichen wird ueber seinen Codepunkt gebildet und nicht woertlich in die
 * Datei geschrieben: woertlich ueberlebt es nicht jeden Transportweg, und ein
 * stillschweigend verlorenes Zeichen liesse hier jeden Vergleich scheitern.
 */
const NBSP = new RegExp(String.fromCharCode(160), "g");
function labelOf(el) {
  return ((el && (el.innerText || el.textContent)) || "").replace(NBSP, " ").trim();
}

/**
 * Die React-Props eines DOM-Knotens.
 *
 * React 17 (package.json:42) legt sie als gewoehnliche, aufzaehlbare
 * Eigenschaft auf dem Knoten ab: `node["__reactProps$<zufall>"] = props`
 * (react-dom 17.0.2, ReactDOMComponentTree.js, `updateFiberProps` — aufgerufen
 * bei createInstance UND bei jedem commitUpdate, der Wert ist also nie
 * veraltet). Der Zufallsanteil wechselt je Seitenladung, deshalb wird der
 * Schluessel gesucht statt fest verdrahtet.
 */
function reactProps(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  return key ? node[key] : null;
}

/** Der Fiber-Knoten zu einem DOM-Element (React 17: "__reactFiber$..."). */
function reactFiber(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
  return key ? node[key] : null;
}

/**
 * Sammelt alle unterschiedlichen onClick-Handler an diesem Knopf und an seinen
 * Vorfahren im Fiber-Baum.
 *
 * Gebraucht wird das NUR fuer den `Join!`-Knopf, der als einziger auf dem Weg
 * `event.isTrusted` prueft (FactionsRoot.tsx:89). `isTrusted` laesst sich nicht
 * faelschen — es ist per DOM-Spezifikation [LegacyUnforgeable]. Der Handler
 * dagegen liegt offen: MUI reicht `onClick` unveraendert an das native
 * <button> durch (@mui/material 5.18.0, ButtonBase.js), und
 * `acceptInvitation` liest aus dem Ereignis AUSSCHLIESSLICH `isTrusted`. Also
 * wird der Handler direkt aufgerufen. Es laeuft dabei exakt derselbe Pfad wie
 * bei einem echten Klick, dieselbe Funktion `joinFaction(Factions[name])`
 * (FactionHelpers.tsx:35) — es wird nichts am Spielstand vorbeigeschrieben.
 *
 * Die Vorfahrensuche ist die Rueckfallebene fuer den Fall, dass eine spaetere
 * MUI-Fassung `onClick` doch einpackt; dann sitzt der echte Handler am
 * <Button>-Element aus FactionsRoot. Die Liste ist nach Naehe sortiert.
 */
function collectClickHandlers(btn, maxDepth = 12) {
  const found = [];
  const seen = new Set();
  const add = (fn) => {
    if (typeof fn === "function" && !seen.has(fn)) {
      seen.add(fn);
      found.push(fn);
    }
  };
  const props = reactProps(btn);
  if (props) add(props.onClick);
  let fiber = reactFiber(btn);
  for (let i = 0; fiber && i < maxDepth; i++) {
    if (fiber.memoizedProps) add(fiber.memoizedProps.onClick);
    fiber = fiber.return;
  }
  return found;
}

/**
 * Ein Ereignisobjekt, wie der Handler es erwartet.
 *
 * `acceptInvitation` liest nur `isTrusted`. Die uebrigen Felder sind fuer den
 * Fall da, dass die Rueckfallebene einen MUI-eigenen Handler erwischt — der
 * fasst `target`, `currentTarget`, `key` und `defaultPrevented` an und wuerde
 * sonst mit einem TypeError abbrechen.
 */
function makeTrustedLikeEvent(node) {
  return {
    isTrusted: true,
    type: "click",
    target: node,
    currentTarget: node,
    relatedTarget: null,
    bubbles: true,
    cancelable: true,
    eventPhase: 2,
    defaultPrevented: false,
    timeStamp: Date.now(),
    button: 0,
    buttons: 0,
    detail: 1,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: undefined,
    nativeEvent: null,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    stopImmediatePropagation() {},
    persist() {},
    isDefaultPrevented() {
      return this.defaultPrevented;
    },
    isPropagationStopped() {
      return false;
    },
  };
}

/**
 * Ein Seitenleisteneintrag ueber seine Beschriftung.
 *
 * Nicht ueber den Text des ganzen Eintrags suchen: neben der Beschriftung
 * sitzt ein Badge mit der Zahl ungesehener Einladungen (SidebarItem.tsx:37),
 * der Text lautet dann z.B. "2Factions". Gesucht wird deshalb der
 * Beschriftungsknoten (SidebarItem.tsx:44-46) und von dort der Listeneintrag.
 *
 * Ein zugeklapptes Ziehharmonika-Menue stoert nicht: MUIs `Collapse` haengt
 * ohne `unmountOnExit` nichts aus, und `.click()` stellt das Ereignis zu, ohne
 * die Stelle zu treffen.
 */
function findSidebarItem(doc, label) {
  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== label) continue;
    const item = el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']");
    if (item) return item;
  }
  return null;
}

/** Alle offenen Modals mit ihrem Text. */
function openModals(doc) {
  return [...doc.querySelectorAll(".MuiModal-root")];
}

/**
 * Benennt den Spielzustand, wenn die Oberflaeche unerreichbar ist.
 *
 * Sechs Seiten rendern die Seitenleiste gar nicht (ui/GameRoot.tsx). Dort gibt
 * es AUCH KEINE Tastenkuerzel: der Handler haengt in einem useEffect von
 * SidebarRoot (SidebarRoot.tsx:308) und existiert nur, solange die Komponente
 * montiert ist. Beide Wege sind dann gleichzeitig tot.
 *
 * Ohne diese Erkennung meldet der Lauf nur ein nichtssagendes "nicht
 * gefunden", und niemand weiss, wo das Spiel steht. Das ist Bildschirmtext —
 * aber ausschliesslich zur Lagebeschreibung, nie als Erfolgsbeleg.
 */
function detectBlockedPage(doc) {
  const body = (doc.body ? doc.body.innerText || "" : "").slice(0, 4000);
  const has = (s) => body.includes(s);
  if ([...doc.querySelectorAll("button")].some((b) => labelOf(b) === "Do something else simultaneously")) {
    return "fokussierte Arbeit (Page.Work)";
  }
  if (has("Recovery Mode") || has("RECOVERY MODE")) return "Recovery-Modus — der Spielstand hat ein Problem";
  if (has("Import Save") || has("Importing this save")) return "Speicherstand-Import wartet auf eine Entscheidung";
  if (has("The Bitverse") || has("Which BitNode")) return "BitVerse (Reset laeuft)";
  if (has("Infiltrating")) return "Infiltration laeuft";
  if (!doc.querySelector(".MuiDrawer-root")) return "unbekannte Sonderseite ohne Seitenleiste";
  return "";
}

/**
 * Ein fremdes Reisefenster ist ein Abbruchgrund, kein Hindernis.
 *
 * Sleeve- und Bladeburner-Reisefenster zeigen dieselbe Weltkarte wie die
 * Reiseagentur (Sleeve/ui/TravelModal.tsx:43, Bladeburner/ui/TravelModal.tsx:35).
 * Der Suchbereich schliesst sie zwar aus, aber wenn eines offen steht, hat ein
 * Mensch oder ein anderes Skript gerade etwas anderes vor — dann wird hier
 * nicht dazwischengeklickt.
 */
function detectForeignTravelModal(doc) {
  for (const m of openModals(doc)) {
    const t = m.innerText || "";
    if (t.includes("Have this sleeve travel")) return "ein Sleeve-Reisefenster steht offen";
    if (t.includes("Bladeburner activities")) return "ein Bladeburner-Reisefenster steht offen";
  }
  return "";
}

/**
 * Schliesst ein Meldefenster, dessen Text zu einem der Muster passt — und NUR
 * dieses.
 *
 * Geschlossen wird ueber das Kreuz oben rechts (ui/React/Modal.tsx:94: ein
 * IconButton, der direkt `onClose` aufruft). Beim AlertManager ist das
 * `close()`, und das entfernt AUSSCHLIESSLICH die erste Meldung
 * (ui/React/AlertManager.tsx:76-80).
 *
 * Der naheliegendere Weg — Escape ans Dokument — waere falsch: dessen Handler
 * leert die GANZE Warteschlange (AlertManager.tsx:40-46) und wuerde auch
 * fremde Meldungen wegwerfen. Er bleibt letzte Rueckfallebene und wird dann
 * ausdruecklich protokolliert.
 *
 * tss-react behaelt den Regelnamen im erzeugten Klassennamen, deshalb ist
 * `closeButton` (Modal.tsx:32) auch im fertigen Build wiederzufinden.
 */
function dismissAlert(doc, patterns) {
  const modal = openModals(doc).find((m) => {
    const t = m.innerText || "";
    return patterns.some((p) => t.includes(p));
  });
  if (!modal) return "";

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
 * Gegen Verschachtelung abgesichert: hat ihn schon jemand, wird er hier NICHT
 * wieder losgelassen. Die Selbstloesung per Zeitgeber ist Pflicht — am 20.08.
 * blieb der Dienst nach einem Absturz mitten im Griff fuer immer stehen.
 *
 * Der Griff wird je Schritt genommen und nicht fuer den ganzen Lauf: ein Lauf
 * kann Minuten dauern (Warten auf Einladungen), und so lange darf der
 * Nachtdienst nicht stillstehen.
 */
function grabNightshift(doc, holdMs = 120000) {
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
    timer = doc.defaultView.setTimeout(() => (service.busy = false), holdMs);
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

/** Wartet, bis eine Bedingung zutrifft. Liefert false bei Zeitablauf. */
async function waitUntil(fn, sleep, timeoutMs, stepMs) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() >= until) return false;
    await sleep(stepMs);
  }
}

/**
 * Loest fokussierte Arbeit, falls erlaubt — sie blockiert sowohl die
 * Tastenkuerzel (SidebarRoot.tsx:296) als auch die Seitenleiste.
 *
 * Das ist nicht kostenlos: unfokussierte Arbeit bringt dauerhaft nur noch
 * 80 % (PlayerObjectGeneralMethods.ts:622-628), solange kein
 * NeuroreceptorManager verbaut ist, und sie fokussiert sich nicht von selbst
 * wieder.
 */
async function unfocusIfNeeded(doc, sleep, log, allowUnfocus) {
  const btn = [...doc.querySelectorAll("button")].find((b) => labelOf(b) === "Do something else simultaneously");
  if (!btn) return "";
  if (!allowUnfocus) return "fokussierte Arbeit laeuft, Entfokussieren ist nicht erlaubt";
  btn.click();
  log("Fokussierte Arbeit entfokussiert — sie laeuft weiter, aber nur noch mit 80 % Ertrag.");
  await sleep(600);
  return "";
}

// ---------------------------------------------------------------------------
// Reiseagentur
// ---------------------------------------------------------------------------

/**
 * Der Teilbaum der Reiseagentur, oder null.
 *
 * Festgemacht an der Ueberschrift (TravelAgencyRoot.tsx:55). MUI bildet
 * `variant="h4"` auf ein `<h4>` ab. Zurueckgegeben wird das Elternelement, und
 * das ist eng: GameRoot rendert die aktuelle Seite als
 * `<Box className={classes.root}>{mainPage}</Box>` (ui/GameRoot.tsx:554), und
 * `TravelAgencyRoot` gibt ein Fragment aus Ueberschrift und Reiseziel-Box
 * zurueck (:54-81). In diesem Elternelement liegt also nur die Reiseagentur.
 *
 * Das Bestaetigungsfenster liegt NICHT darin — MUI haengt Modals per Portal an
 * `document.body`. Und genau deshalb liegen auch die Weltkarten der Sleeve-
 * und Bladeburner-Reisefenster ausserhalb.
 */
function travelScope(doc) {
  for (const h of doc.querySelectorAll("h4")) {
    if (labelOf(h) === TRAVEL_PAGE_TITLE) return h.parentElement || null;
  }
  return null;
}

const onTravelPage = (doc) => !!travelScope(doc);

/**
 * Bringt das Spiel auf die Seite der Reiseagentur.
 *
 * @returns {string} leer bei Erfolg, sonst der Grund
 */
async function goToTravelAgency(doc, sleep, log, allowUnfocus) {
  if (onTravelPage(doc)) {
    log("Reiseagentur stand schon offen.");
    return "";
  }

  const foreign = detectForeignTravelModal(doc);
  if (foreign) return foreign;

  const focusProblem = await unfocusIfNeeded(doc, sleep, log, allowUnfocus);
  if (focusProblem) return focusProblem;

  // Stufe 1: Alt+R (KeyBindingUtils.ts:160-168).
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "r", code: "KeyR", altKey: true, bubbles: true }));
  log("Alt+R gesendet.");
  await sleep(1200);
  if (onTravelPage(doc)) return "";

  // Stufe 2: der Seitenleisteneintrag "Travel" (SidebarRoot.tsx:411).
  const item = findSidebarItem(doc, "Travel");
  if (item) {
    item.click();
    log("Seitenleisteneintrag Travel angeklickt.");
    await sleep(1200);
    if (onTravelPage(doc)) return "";
  }

  // Stufe 3: ueber die Stadtkarte. Die Agentur steht in jeder Stadt
  // (LocationsMetadata.ts:436-440) als span mit aria-label (City.tsx:59).
  const city = findSidebarItem(doc, "City");
  if (city) {
    city.click();
    log("Seitenleisteneintrag City angeklickt.");
    await sleep(1200);
  }
  const agency =
    doc.querySelector(`[aria-label="${TRAVEL_PAGE_TITLE}"]`) ||
    [...doc.querySelectorAll("button")].find((b) => labelOf(b) === TRAVEL_PAGE_TITLE);
  if (agency) {
    agency.click();
    log("Reiseagentur auf der Stadtkarte angeklickt.");
    await sleep(1200);
    if (onTravelPage(doc)) return "";
  }

  const why = detectBlockedPage(doc);
  return why ? `Reiseagentur unerreichbar: ${why}` : "Seitenwechsel zur Reiseagentur blieb wirkungslos";
}

/**
 * Findet auf der Reiseagenturseite das Ziel fuer die genannte Stadt.
 *
 * Zwei Darstellungen (TravelAgencyRoot.tsx:60-78) und drei Sicherungen:
 *
 *  a) Liste bei abgeschalteter ASCII-Kunst: Knopf "Travel to <Stadt>" (:69).
 *     Diese Beschriftung gibt es nur hier; die Sleeve- und
 *     Bladeburner-Fenster beschriften nur mit dem nackten Stadtnamen.
 *  b) Weltkarte: die Ein-Buchstaben-Spanne, identifiziert ueber das
 *     `city`-Prop der umgebenden `City`-Komponente (WorldMap.tsx:28-38). Der
 *     Buchstabe selbst wird NICHT als Beweis genommen.
 *
 * Alles ausserhalb von `scope` und alles innerhalb eines `.MuiModal-root`
 * wird verworfen — das ist die Sperre gegen die Sleeve- und
 * Bladeburner-Weltkarten.
 *
 * @returns {{el: Element|null, how: string, offered: string[], note: string}}
 */
export function findCityTarget(scope, cityName) {
  const offered = [];

  // a) Listendarstellung.
  const listHits = [];
  for (const b of scope.querySelectorAll("button")) {
    const text = labelOf(b);
    if (!text.startsWith("Travel to ")) continue;
    const named = text.slice("Travel to ".length).trim();
    offered.push(named);
    if (named === cityName) listHits.push(b);
  }
  if (listHits.length === 1) return { el: listHits[0], how: "Liste", offered, note: "" };
  if (listHits.length > 1) {
    return { el: null, how: "", offered, note: `${listHits.length} Knoepfe "Travel to ${cityName}" — nichts angeklickt` };
  }

  // b) Weltkarte ueber die React-Props der City-Komponente.
  const mapHits = [];
  for (const span of scope.querySelectorAll("span")) {
    // `City` rendert genau einen Buchstaben (WorldMap.tsx:33 bzw. :38). Das
    // ist nur ein billiger Vorfilter, entschieden wird an den Props.
    if ((span.textContent || "").trim().length !== 1) continue;
    if (span.closest(".MuiModal-root")) continue;
    let fiber = reactFiber(span);
    for (let i = 0; fiber && i < 15; i++) {
      const mp = fiber.memoizedProps;
      if (
        mp &&
        typeof mp.city === "string" &&
        typeof mp.currentCity === "string" &&
        typeof mp.onTravel === "function"
      ) {
        offered.push(mp.city);
        // Die aktuelle Stadt bekommt gar kein onClick (WorldMap.tsx:39-40) —
        // ein Klick darauf waere wirkungslos, aber irrefuehrend.
        if (mp.city === cityName && mp.city !== mp.currentCity) mapHits.push(span);
        break;
      }
      fiber = fiber.return;
    }
  }
  if (mapHits.length === 1) return { el: mapHits[0], how: "Weltkarte", offered, note: "" };
  if (mapHits.length > 1) {
    return { el: null, how: "", offered, note: `${mapHits.length} Kartenknoten fuer ${cityName} — nichts angeklickt` };
  }

  return { el: null, how: "", offered, note: "" };
}

/**
 * Das Bestaetigungsfenster, sofern es die GESUCHTE Stadt nennt.
 *
 * Der Text lautet "Would you like to travel to {city}? The trip will cost ..."
 * (TravelConfirmationModal.tsx:23-25). Verlangt wird, dass GENAU EIN
 * Stadtname in dieser Wendung vorkommt und dass es der gewuenschte ist. Nennt
 * das Fenster eine andere Stadt oder mehrere, wird nicht geklickt — eine
 * Fehlreise kostet $200.000 und stellt den Spieler in die falsche Stadt.
 *
 * @returns {{btn: Element|null, reason: string}}
 */
export function findTravelConfirmButton(doc, cityName) {
  for (const m of openModals(doc)) {
    const text = m.innerText || "";
    if (!text.includes("Would you like to travel to")) continue;
    const named = CITIES.filter((c) => text.includes("travel to " + c));
    if (named.length !== 1) {
      return { btn: null, reason: `Bestaetigungsfenster nennt ${named.length} Staedte (${named.join(", ") || "keine"})` };
    }
    if (named[0] !== cityName) {
      return { btn: null, reason: `Bestaetigungsfenster fragt nach "${named[0]}", gewollt war "${cityName}"` };
    }
    const btn = [...m.querySelectorAll("button")].find((b) => labelOf(b) === "Travel");
    if (!btn) return { btn: null, reason: "Bestaetigungsfenster ohne Knopf Travel" };
    return { btn, reason: "" };
  }
  return { btn: null, reason: "" };
}

/**
 * Reist in die genannte Stadt.
 *
 * @returns {Promise<{ok:boolean, reason:string, spent:number}>}
 */
async function travelTo(c) {
  const { doc, sleep, log, cityName, getCity, getMoney } = c;

  if (getCity() === cityName) {
    log(`Bereits in ${cityName} — keine Reise noetig.`);
    return { ok: true, reason: "", spent: 0 };
  }

  // `startTravel` tut bei zu wenig Geld schlicht NICHTS (TravelAgencyRoot.tsx:41-43).
  // Ohne diese Vorpruefung klickte das Skript zweimal ins Leere und meldete
  // "wirkungslos", statt den wahren Grund zu nennen.
  const money = getMoney();
  if (money < TRAVEL_COST) {
    return { ok: false, reason: `Guthaben $${money.toExponential(3)} deckt den Fahrpreis $${TRAVEL_COST.toExponential(3)} nicht`, spent: 0 };
  }

  const navProblem = await goToTravelAgency(doc, sleep, log, c.allowUnfocus);
  if (navProblem) return { ok: false, reason: navProblem, spent: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const scope = travelScope(doc);
    if (!scope) {
      const back = await goToTravelAgency(doc, sleep, log, c.allowUnfocus);
      if (back) return { ok: false, reason: back, spent: 0 };
      continue;
    }

    const target = findCityTarget(scope, cityName);
    if (target.note) log("Zielsuche: " + target.note);
    if (!target.el) {
      return {
        ok: false,
        reason:
          `kein Reiseziel "${cityName}" auf der Seite gefunden ` +
          `(angeboten: ${[...new Set(target.offered)].join(", ") || "nichts"})`,
        spent: 0,
      };
    }

    target.el.click();
    log(`Ziel ${cityName} angeklickt (${target.how}), Versuch ${attempt}.`);

    // Zwei moegliche Ausgaenge: entweder ist die Reise schon geschehen
    // (Settings.SuppressTravelConfirmation, TravelAgencyRoot.tsx:44-47), oder
    // das Bestaetigungsfenster steht offen (:48-50).
    let arrived = false;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (getCity() === cityName) {
        arrived = true;
        break;
      }
      const confirm = findTravelConfirmButton(doc, cityName);
      if (confirm.reason) return { ok: false, reason: confirm.reason, spent: 0 };
      if (confirm.btn) {
        confirm.btn.click();
        log("Bestaetigungsfenster: Travel geklickt.");
        arrived = await waitUntil(() => getCity() === cityName, sleep, 6000, 250);
        break;
      }
      await sleep(250);
    }
    if (!arrived) arrived = await waitUntil(() => getCity() === cityName, sleep, 2000, 250);

    if (arrived) {
      // "You are now in X!" (TravelAgencyRoot.tsx:30). Wegraeumen, damit der
      // Mensch vor dem Bildschirm nicht auf einem Stapel Fenster sitzt.
      const closed = dismissAlert(doc, ["You are now in "]);
      if (closed) log(`Ankunftsmeldung geschlossen (${closed}).`);
      log(`Angekommen in ${cityName}; Spielerzustand bestaetigt es.`);
      return { ok: true, reason: "", spent: TRAVEL_COST };
    }

    log(`Versuch ${attempt}: Stadt blieb ${getCity()}.`);
    await sleep(700);
  }

  // Zweimal keine Wirkung — nicht weiterklicken. Jeder weitere Klick koennte
  // bei geaenderter Oberflaeche etwas anderes treffen, und jede Reise kostet.
  const why = detectBlockedPage(doc);
  return {
    ok: false,
    reason: `zwei Reiseversuche nach ${cityName} ohne Wirkung (Stadt ist ${getCity()})${why ? "; Lage: " + why : ""}`,
    spent: 0,
  };
}

// ---------------------------------------------------------------------------
// Faktionsbeitritt
// ---------------------------------------------------------------------------

const onFactionsPage = (doc) =>
  !!(doc.querySelector("span.factions-invites") || doc.querySelector("span.factions-joined"));

/** Bringt das Spiel auf die Faktionsseite (Alt+F, sonst Seitenleiste). */
async function goToFactionsPage(doc, sleep, log, allowUnfocus) {
  if (onFactionsPage(doc)) return "";

  const focusProblem = await unfocusIfNeeded(doc, sleep, log, allowUnfocus);
  if (focusProblem) return focusProblem;

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", altKey: true, bubbles: true }));
  log("Alt+F gesendet.");
  await sleep(1200);
  if (onFactionsPage(doc)) return "";

  const item = findSidebarItem(doc, "Factions");
  if (!item) {
    const why = detectBlockedPage(doc);
    return why ? `Faktionsseite unerreichbar: ${why}` : "kein Seitenleisteneintrag Factions gefunden";
  }
  item.click();
  log("Seitenleisteneintrag Factions angeklickt.");
  await sleep(1200);
  if (onFactionsPage(doc)) return "";

  const why = detectBlockedPage(doc);
  return why ? `Faktionsseite unerreichbar: ${why}` : "Seitenwechsel zur Faktionsseite blieb wirkungslos";
}

/**
 * Die Faktionskarte (MUI Paper) oberhalb eines Knopfes.
 *
 * Die Verschachtelung ist <Paper><Box display="flex"> ... <Button/> ...
 * (FactionsRoot.tsx:96-124), vom Knopf also genau zwei Schritte nach oben.
 * Der Ersatzweg darf nicht weiter gehen: eine Ebene hoeher liegt der Container
 * mit ALLEN Karten.
 */
function cardOf(btn) {
  return btn.closest(".MuiPaper-root") || (btn.parentElement && btn.parentElement.parentElement) || null;
}

/**
 * Gehoert die Karte GENAU zur gesuchten Faktion?
 *
 * Der Name steht in einem eigenen span (FactionsRoot.tsx:145). Eine
 * eingeladene Faktion ist dort nie verzerrt dargestellt: `receiveInvite` setzt
 * im selben Moment `discovery = known` (FactionHelpers.tsx:29), und
 * `CorruptibleText` greift nur bei unbekannten.
 *
 * Es gibt hier bewusst KEINEN Teilstring-Ersatzweg wie in
 * entwurf/join/join.js:249. Ein Fehlgriff sperrt sofort alle Feinde der
 * getroffenen Faktion (FactionHelpers.tsx:44-46) und ist bis zur naechsten
 * Augmentierung unumkehrbar. Lieber ein sauberer Fehlschlag.
 */
function cardMatchesExactly(card, factionName) {
  for (const s of card.querySelectorAll("span")) {
    if ((s.textContent || "").trim() === factionName) return true;
  }
  return false;
}

/**
 * Sucht den Join!-Knopf der genannten Faktion.
 *
 * Gesucht wird nur innerhalb von `span.factions-invites` (FactionsRoot.tsx:265).
 * Nur dort kann der Knopf stehen: die Geruechteliste filtert eingeladene
 * Faktionen heraus (:232), und Mitglieder bekommen statt "Join!" die Knoepfe
 * "Details" und "Augments" (:117-118).
 */
export function findPageJoinButton(doc, factionName) {
  const scope = doc.querySelector("span.factions-invites");
  if (!scope) return { btn: null, offered: [], note: "keine Einladungsspalte auf der Seite" };

  const offered = [];
  const hits = [];
  for (const b of scope.querySelectorAll("button")) {
    if (labelOf(b) !== PAGE_JOIN_LABEL) continue;
    const card = cardOf(b);
    if (!card) continue;
    const text = (card.innerText || "").split("\n").map((z) => z.trim()).filter(Boolean);
    offered.push(text[1] || text[0] || "?");
    if (cardMatchesExactly(card, factionName)) hits.push(b);
  }
  if (hits.length === 1) return { btn: hits[0], offered, note: "" };
  if (hits.length > 1) return { btn: null, offered, note: `${hits.length} Karten passen exakt — nichts angeklickt` };
  return { btn: null, offered, note: "" };
}

/**
 * Liest, welche Faktion das Einladungsfenster gerade anbietet.
 *
 * NUR ueber den fett gesetzten Namen (FactionInvitationManager.tsx:66). Der
 * uebrige Text des Fensters listet die FEINDE der Faktion auf (:69-79) — eine
 * `includes`-Pruefung auf den Faktionsnamen, wie sie entwurf/join/join.js:266
 * benutzt, wuerde beim Sector-12-Fenster auf "Chongqing" anschlagen und beim
 * Klick SECTOR-12 beitreten. Das ist der teuerste denkbare Fehlgriff.
 *
 * @returns {{modal: Element|null, faction: string}}
 */
export function readInvitationModal(doc) {
  for (const m of openModals(doc)) {
    const text = m.innerText || "";
    if (!text.includes("You received a faction invitation")) continue;
    for (const b of m.querySelectorAll("b")) {
      const name = (b.textContent || "").trim();
      if (name) return { modal: m, faction: name };
    }
    return { modal: m, faction: "" };
  }
  return { modal: null, faction: "" };
}

/**
 * Raeumt ein Einladungsfenster weg, das eine NICHT gewuenschte Faktion
 * anbietet — ueber "Decide later" (FactionInvitationManager.tsx:85).
 *
 * Das ist harmlos: `close()` nimmt nur den ersten Eintrag aus der Anzeigeliste
 * der Komponente (:46-50). `Player.factionInvitations` bleibt unberuehrt, die
 * Einladung steht weiter auf der Faktionsseite. Es wird also nichts
 * abgelehnt, nur der Blick freigeraeumt.
 */
function dismissInvitationModal(doc, log) {
  const found = readInvitationModal(doc);
  if (!found.modal) return false;
  const later = [...found.modal.querySelectorAll("button")].find((b) => labelOf(b) === MODAL_LATER_LABEL);
  if (!later) return false;
  later.click();
  log(`Einladungsfenster von "${found.faction || "?"}" mit "${MODAL_LATER_LABEL}" weggeraeumt — NICHT beigetreten.`);
  return true;
}

/**
 * Tritt einer Faktion bei. Der Name muss woertlich in `allowed` stehen.
 *
 * @returns {Promise<{ok:boolean, how:string, reason:string}>}
 */
async function joinFaction(c) {
  const { doc, sleep, log, factionName, isMember, allowed, forbidden } = c;

  // Die Sperre gegen den Fehlgriff, und zwar VOR jedem Blick auf die
  // Oberflaeche. Wer hier nicht durchkommt, klickt nichts.
  if (!allowed.includes(factionName)) {
    return { ok: false, how: "none", reason: `"${factionName}" steht nicht in --join — es wird nichts angeklickt` };
  }
  if (forbidden.includes(factionName)) {
    return { ok: false, how: "none", reason: `"${factionName}" steht in --forbid` };
  }
  if (isMember(factionName)) {
    log(`Bereits Mitglied von ${factionName}.`);
    return { ok: true, how: "already", reason: "" };
  }

  // --- Weg A: das Einladungsfenster steht offen und nennt GENAU diese Faktion
  //
  // Der billigste Weg: kein Seitenwechsel, kein Ereignisobjekt noetig.
  // `join()` nimmt gar kein Ereignis entgegen (FactionInvitationManager.tsx:54),
  // die Echtheitspruefung greift hier nicht.
  const modal = readInvitationModal(doc);
  if (modal.modal) {
    if (modal.faction === factionName) {
      const btn = [...modal.modal.querySelectorAll("button")].find((b) => labelOf(b) === MODAL_JOIN_LABEL);
      if (btn) {
        btn.click();
        log(`Einladungsfenster von ${factionName}: Join geklickt.`);
        if (await waitUntil(() => isMember(factionName), sleep, 4000, 400)) {
          return { ok: true, how: "modal", reason: "" };
        }
        log("Fenster geklickt, Spielerzustand unveraendert — weiter mit der Faktionsseite.");
      }
    } else if (modal.faction) {
      // Ein fremdes Fenster liegt im Weg. Es wird NICHT angeklickt, sondern
      // weggeraeumt. Genau hier waere der Fehlgriff passiert, gegen den diese
      // Datei gebaut ist.
      if (forbidden.includes(modal.faction)) {
        log(`ACHTUNG: Einladungsfenster von "${modal.faction}" steht offen — das ist eine gesperrte Faktion.`);
      }
      if (c.dismissForeignInvites) dismissInvitationModal(doc, log);
      await sleep(400);
    }
  }

  // --- Weg B: der geschuetzte Knopf auf der Faktionsseite ------------------
  const navProblem = await goToFactionsPage(doc, sleep, log, c.allowUnfocus);
  if (navProblem) return { ok: false, how: "none", reason: navProblem };

  let found = findPageJoinButton(doc, factionName);
  const until = Date.now() + (c.buttonWaitMs || 6000);
  while (!found.btn && Date.now() < until) {
    await sleep(500);
    found = findPageJoinButton(doc, factionName);
  }
  if (found.note) log("Kartensuche: " + found.note);
  if (!found.btn) {
    return {
      ok: false,
      how: "none",
      reason: `keine offene Einladung fuer "${factionName}" (Seite zeigt: ${found.offered.join(", ") || "keine"})`,
    };
  }

  const handlers = collectClickHandlers(found.btn);
  if (handlers.length === 0) {
    return { ok: false, how: "none", reason: "am Knopf haengt kein React-onClick (React-Fassung geaendert?)" };
  }
  for (let i = 0; i < handlers.length; i++) {
    try {
      handlers[i](makeTrustedLikeEvent(found.btn));
    } catch (e) {
      log(`Kandidat ${i} warf ${e && e.name}: ${e && e.message}`);
      continue;
    }
    if (await waitUntil(() => isMember(factionName), sleep, 2500, 400)) {
      log(`${factionName}: Beitritt vom Spielerzustand bestaetigt.`);
      return { ok: true, how: "reactProps", reason: "" };
    }
    log(`Kandidat ${i} lief durch, aber der Spielerzustand aenderte sich nicht.`);
  }

  // Der Handler lief und tat nichts. Das hat dann NICHT mit isTrusted zu tun,
  // sondern mit den beiden anderen Bedingungen in FactionsRoot.tsx:89 — die
  // Einladung ist weg, oder die Faktion ist gesperrt, weil wir schon bei einem
  // ihrer Feinde sind (FactionHelpers.tsx:44-46).
  return {
    ok: false,
    how: "none",
    reason: "Handler lief, joinFaction blieb wirkungslos (Einladung abgelaufen oder Faktion gesperrt)",
  };
}

/**
 * Ein Anlauf: auf die Faktionsseite, auf die Einladung warten, beitreten.
 *
 * Der Nachtdienst-Griff liegt hier drin und nicht um den ganzen Lauf: das
 * Warten auf eine Einladung kann eine Minute dauern, und so lange darf der
 * Dienst nicht stillstehen. Der Griff loest sich nach 120 s ohnehin selbst
 * (grabNightshift) — deshalb wird er hier mit der Wartezeit plus Zuschlag
 * genommen, sonst laeuft er mitten im Warten ab und der Dienst faehrt uns in
 * die Seite.
 */
async function joinStep(c) {
  const { doc, sleep, log, faction, isMember } = c;
  const release = grabNightshift(doc, c.inviteWaitMs + 60000);
  try {
    const navProblem = await goToFactionsPage(doc, sleep, log, c.allowUnfocus);
    if (navProblem) return { ok: false, how: "none", reason: navProblem };

    // Die Wartebedingung darf NUR auf die gewuenschte Faktion anspringen. Ein
    // blosses "irgendein Einladungsfenster steht offen" haette bei offenem
    // Sector-12-Fenster das Warten sofort beendet, und dem eigentlichen
    // Beitritt waeren nur die sechs Sekunden Knopfsuche geblieben.
    const waited = await waitUntil(
      () => {
        if (isMember(faction)) return true;
        if (findPageJoinButton(doc, faction).btn) return true;
        const m = readInvitationModal(doc);
        if (!m.modal) return false;
        if (m.faction === faction) return true;
        // Fremdes Fenster: wegraeumen und weiterwarten. Es wird NIE
        // angeklickt, nur ueber "Decide later" aus dem Weg geschafft.
        if (c.dismissForeignInvites) dismissInvitationModal(doc, log);
        return false;
      },
      sleep,
      c.inviteWaitMs,
      1000,
    );
    if (!waited) log(`${faction}: nach ${Math.round(c.inviteWaitMs / 1000)} s keine Einladung sichtbar.`);

    // Die Fehlgriffsperre. Alle Vorpruefungen weiter unten schuetzen den
    // BEABSICHTIGTEN Klick - keine davon merkt, wenn ein Klick woanders
    // landet: ein fremder Ereignisbehandler aus dem Aufstieg im Baum, ein
    // Fenster, das zwischen Lesen und Klicken die Faktion wechselt, ein
    // anderer Automat, der gleichzeitig zugreift. Der Schaden waere der
    // teuerste im ganzen Spiel, denn ein Beitritt sperrt sofort alle Feinde
    // der getroffenen Faktion (FactionHelpers.tsx:45-47).
    //
    // Ein Vorher-Nachher-Vergleich der Mitgliedsliste kostet nichts und faengt
    // JEDE dieser Varianten ab, auch die, an die niemand gedacht hat.
    const vorher = new Set(isMember.liste ? isMember.liste() : []);
    const erg = await joinFaction({
      doc,
      sleep,
      log,
      factionName: faction,
      isMember,
      allowed: c.allowed,
      forbidden: c.forbidden,
      allowUnfocus: c.allowUnfocus,
      dismissForeignInvites: c.dismissForeignInvites,
    });
    if (isMember.liste) {
      const dazu = isMember.liste().filter((f) => !vorher.has(f) && f !== faction);
      if (dazu.length) {
        log("FEHLGRIFF: unbeabsichtigt beigetreten -> " + dazu.join(", ") + ". Lauf wird abgebrochen.");
        throw new Error("Fehlgriff beim Beitritt: " + dazu.join(", "));
      }
    }
    return erg;
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Vorpruefung: was der Plan kostet und was er verbrennt
// ---------------------------------------------------------------------------

/**
 * Prueft den Plan, bevor irgendetwas angefasst wird.
 *
 * Vier harte Abbruchgruende, alle unumkehrbar-teuer, wenn man sie erst
 * unterwegs bemerkt:
 *  1. ein Name laesst sich nicht aufloesen (Tippfehler),
 *  2. ein Name steht in beiden Listen,
 *  3. der Plan ist in sich widerspruechlich (zwei verfeindete Beitritte),
 *  4. der Plan wuerde eine Faktion verbrennen, die NICHT in `--forbid` steht.
 *
 * Punkt 4 ist der eigentliche Zweck der Sperrliste: sie ist die
 * Unterschrift des Aufrufers unter die Folgen.
 *
 * @returns {{ok:boolean, errors:string[], warnings:string[], burns:string[]}}
 */
export function checkPlan(joinNames, forbidNames, memberFactions) {
  const errors = [];
  const warnings = [];

  const burnSet = new Set();
  for (const f of joinNames) for (const e of ENEMIES[f] || []) burnSet.add(e);

  for (const f of joinNames) {
    if (forbidNames.includes(f)) errors.push(`"${f}" steht gleichzeitig in --join und --forbid`);
  }

  // Zwei verfeindete Beitritte im selben Auftrag: der zweite wuerde am
  // gesperrten Knopf scheitern, nachdem der erste bereits Tatsachen
  // geschaffen hat.
  for (const f of joinNames) {
    for (const e of ENEMIES[f] || []) {
      if (joinNames.includes(e)) errors.push(`"${f}" und "${e}" sind verfeindet — der Plan widerspricht sich`);
    }
  }

  // Bereits erworbene Mitgliedschaften koennen ein Ziel unerreichbar machen.
  // `isBanned` steht nicht in `ns.getPlayer()`, laesst sich aus der
  // Mitgliederliste und der Feindtabelle aber sicher ableiten.
  for (const f of joinNames) {
    const blocker = memberFactions.find((m) => (ENEMIES[m] || []).includes(f));
    if (blocker) errors.push(`"${f}" ist durch die bestehende Mitgliedschaft bei "${blocker}" gesperrt`);
  }

  const missing = [...burnSet].filter((b) => !forbidNames.includes(b) && !joinNames.includes(b));
  if (missing.length) {
    errors.push(
      `der Plan sperrt ${missing.join(", ")} — diese Namen fehlen in --forbid. ` +
        `Die Sperrliste muss jede Faktion nennen, die der Plan verbrennt.`,
    );
  }

  for (const f of joinNames) {
    if (memberFactions.includes(f)) warnings.push(`"${f}" ist bereits beigetreten — wird uebersprungen`);
    if (!INVITE_REQS[f]) {
      warnings.push(`fuer "${f}" ist keine Ortsbedingung bekannt — es wird nicht dafuer gereist, nur beigetreten`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, burns: [...burnSet] };
}

/**
 * Baut die Schrittfolge: welche Stadt, welche Beitritte dort.
 *
 * Als Ziel wird die Stadt genommen, die die MEISTEN noch offenen Beitritte
 * bedient. Das spart Fahrten: fuer Chongqing + Tian Di Hui genuegt eine.
 */
export function buildRoute(pending, startCity) {
  const steps = [];
  let city = startCity;
  const left = [...pending];

  for (let guard = 0; guard < 12 && left.length; guard++) {
    // Erst alles einsammeln, was von hier aus geht.
    const hereNow = left.filter((f) => !INVITE_REQS[f] || INVITE_REQS[f].cities.includes(city));
    if (hereNow.length) {
      steps.push({ city, join: hereNow, travel: false });
      for (const f of hereNow) left.splice(left.indexOf(f), 1);
      continue;
    }
    // Sonst dorthin, wo am meisten wartet. `left[0]` hat hier garantiert eine
    // Ortsbedingung — ohne eine waere es oben schon in `hereNow` gelandet.
    const options = INVITE_REQS[left[0]].cities;
    let best = options[0];
    let bestCount = -1;
    for (const opt of options) {
      const n = left.filter((f) => INVITE_REQS[f] && INVITE_REQS[f].cities.includes(opt)).length;
      if (n > bestCount) {
        bestCount = n;
        best = opt;
      }
    }
    // Reise und die dort faelligen Beitritte sind EIN Schritt. Getrennt
    // gefuehrt liest sich der Plan als "Chongqing -> Chongqing", und schlimmer:
    // ein Abbruch zwischen beiden Teilschritten waere schwerer zuzuordnen.
    const there = left.filter((f) => !INVITE_REQS[f] || INVITE_REQS[f].cities.includes(best));
    steps.push({ city: best, join: there, travel: true });
    for (const f of there) left.splice(left.indexOf(f), 1);
    city = best;
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Der Automat
// ---------------------------------------------------------------------------

/**
 * @param {object} o
 * @param {Document|null} o.doc  im Trockenlauf ausdruecklich `null`
 * @param {(ms:number)=>Promise<any>} o.sleep
 * @param {()=>object} o.player  `() => ns.getPlayer()`
 * @param {string[]} o.join      aufgeloeste Faktionsnamen, Reihenfolge zaehlt
 * @param {string[]} o.forbid    aufgeloeste Sperrliste (Pflicht)
 * @param {string}  [o.travelTo] zusaetzliches Reiseziel ohne Beitritt
 * @param {number}  [o.inviteWaitMs=60000]
 * @param {number}  [o.maxTravels=6]
 * @param {boolean} [o.dry=false]
 * @param {(z:string)=>void} o.log
 */
export async function run(o) {
  const log = o.log;
  const dry = !!o.dry;
  const player = o.player;
  const getCity = () => player().city;
  const getMoney = () => player().money;
  const isMember = (f) => player().factions.includes(f);
  // Die vollstaendige Liste haengt an derselben Quelle - sie wird fuer die
  // Fehlgriffsperre gebraucht, die nach jedem Klick Vorher gegen Nachher
  // haelt. Als Eigenschaft und nicht als zweites Argument, damit die
  // bestehende Aufrufkette unveraendert bleibt.
  isMember.liste = () => player().factions.slice();

  const report = {
    ok: false,
    dry,
    startCity: getCity(),
    endCity: getCity(),
    joined: [],
    failed: [],
    travels: 0,
    spent: 0,
    reason: "",
    atTerminal: null,
  };

  const members = player().factions.slice();
  const plan = checkPlan(o.join, o.forbid, members);
  for (const w of plan.warnings) log("Hinweis: " + w);
  if (!plan.ok) {
    for (const e of plan.errors) log("ABBRUCH: " + e);
    report.reason = plan.errors[0];
    return report;
  }
  log(`Sperrliste deckt ab, was der Plan verbrennt: ${plan.burns.join(", ") || "nichts"}.`);

  const pending = o.join.filter((f) => !members.includes(f));
  const route = buildRoute(pending, getCity());
  if (o.travelTo && (!route.length || route[route.length - 1].city !== o.travelTo)) {
    route.push({ city: o.travelTo, join: [], travel: true });
  }

  const travels = route.filter((s) => s.travel).length;
  log(`Plan ab ${getCity()}: ${route.map((s) => s.city + (s.join.length ? " [" + s.join.join(" + ") + "]" : "")).join(" -> ")}`);
  log(`Das sind ${travels} Reise(n) fuer $${(travels * TRAVEL_COST).toExponential(3)}.`);

  // ---- Trockenlauf ------------------------------------------------------
  //
  // Bewusst VOR allem anderen und mit `doc === null`: ein Trockenlauf, der
  // Fenster schliesst, entfokussiert und durch drei Seiten navigiert, waere
  // keiner. Die Nebenwirkungen sind ja genau das, was man erst einmal
  // vermeiden will.
  if (dry) {
    const money = getMoney();
    const skills = player().skills || {};
    for (const f of pending) {
      const req = INVITE_REQS[f];
      if (!req) {
        log(`[trocken] ${f}: keine Ortsbedingung bekannt — nur beitretbar, wenn schon eingeladen.`);
        continue;
      }
      const restMoney = money - travels * TRAVEL_COST;
      const moneyOk = restMoney >= req.money;
      const hackOk = (skills.hacking || 0) >= req.hacking;
      log(
        `[trocken] ${f}: Stadt ${req.cities.join("/")}, braucht $${req.money.toExponential(3)}` +
          (req.hacking ? ` und Hacking ${req.hacking}` : "") +
          ` -> Geld ${moneyOk ? "reicht" : "REICHT NICHT"} ($${restMoney.toExponential(3)} nach den Fahrten)` +
          (req.hacking ? `, Hacking ${hackOk ? "reicht" : "REICHT NICHT"} (${skills.hacking || 0})` : ""),
      );
      if (!moneyOk || !hackOk) report.failed.push(f);
    }
    report.travels = travels;
    report.spent = travels * TRAVEL_COST;
    report.ok = report.failed.length === 0;
    if (!report.ok) report.reason = "Einladungsbedingungen nicht erfuellt: " + report.failed.join(", ");
    log("[trocken] Es wurde nichts angefasst: keine Seite gewechselt, kein Klick, keine Reise.");
    return report;
  }

  const doc = o.doc;
  const maxTravels = o.maxTravels || 6;

  try {
    for (const step of route) {
      if (step.travel) {
        if (report.travels >= maxTravels) {
          report.reason = `Reisegrenze ${maxTravels} erreicht`;
          break;
        }
        const release = grabNightshift(doc);
        let res;
        try {
          res = await travelTo({
            doc,
            sleep: o.sleep,
            log,
            cityName: step.city,
            getCity,
            getMoney,
            allowUnfocus: o.allowUnfocus,
          });
        } finally {
          release();
        }
        if (!res.ok) {
          report.reason = `Reise nach ${step.city} gescheitert: ${res.reason}`;
          break;
        }
        report.travels++;
        report.spent += res.spent;
      }

      for (const faction of step.join) {
        // Die Einladung entsteht nicht sofort: der Zaehler laeuft alle 10
        // Zyklen ab (engine.tsx:176), bei 200 ms je Zyklus also rund alle
        // zwei Sekunden. Gewartet wird auf den KNOPF, nicht auf einen Text.
        const req = INVITE_REQS[faction];
        const skills = player().skills || {};
        if (req && getMoney() < req.money) {
          log(
            `${faction}: Guthaben $${getMoney().toExponential(3)} liegt unter der Einladungsschwelle ` +
              `$${req.money.toExponential(3)} — die Einladung kann gar nicht entstehen.`,
          );
        }
        if (req && (skills.hacking || 0) < req.hacking) {
          log(`${faction}: Hacking ${skills.hacking || 0} liegt unter der Schwelle ${req.hacking}.`);
        }

        // Zwei Anlaeufe, dann Schluss. Ein zweiter ist NICHT sinnlos: der
        // haeufigste Grund fuer einen Fehlschlag ist, dass src/hand.js
        // zwischendurch Alt+T geschickt und uns die Seite weggezogen hat.
        // Gefahrlos ist er, weil `joinFaction` zuerst die Mitgliedschaft
        // prueft — war der erste Anlauf doch erfolgreich, tut der zweite
        // nichts. Ein dritter waere blindes Weiterklicken.
        let res = { ok: false, how: "none", reason: "kein Versuch unternommen" };
        for (let attempt = 1; attempt <= 2 && !res.ok; attempt++) {
          if (attempt > 1) {
            log(`${faction}: zweiter Anlauf (erster scheiterte an "${res.reason}").`);
            await o.sleep(1000);
          }
          res = await joinStep({
            doc,
            sleep: o.sleep,
            log,
            faction,
            isMember,
            allowed: o.join,
            forbidden: o.forbid,
            allowUnfocus: o.allowUnfocus,
            dismissForeignInvites: o.dismissForeignInvites !== false,
            inviteWaitMs: o.inviteWaitMs || 60000,
          });
        }

        if (res.ok) {
          report.joined.push(faction);
          const banned = ENEMIES[faction] || [];
          if (banned.length) log(`${faction} beigetreten — damit sind ${banned.join(", ")} bis zur naechsten Augmentierung gesperrt.`);
        } else {
          report.failed.push(faction);
          log(`${faction}: NICHT beigetreten — ${res.reason}`);
        }
      }
    }
  } catch (e) {
    // Kein Fehler darf nach draussen: der Bericht ist der einzige Kanal, ueber
    // den von aussen sichtbar wird, wo der Lauf stehengeblieben ist.
    report.reason = "Ausnahme: " + (e && e.message ? e.message : String(e));
    log(report.reason);
  }

  report.endCity = getCity();
  report.ok = !report.reason && report.failed.length === 0;
  report.atTerminal = await backToTerminal(doc, o.sleep, log);
  return report;
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

  const item = findSidebarItem(doc, "Terminal");
  if (item) item.click();
  await sleep(900);

  const done = there();
  if (!done) log("ACHTUNG: Rueckkehr zum Terminal misslungen — der naechste Terminalbefehl wird scheitern.");
  return done;
}

// ---------------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------------

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const flags = ns.flags([
    ["join", ""], // Kommaliste. Nur was hier steht, wird beigetreten.
    ["forbid", ""], // Kommaliste. PFLICHT.
    ["to", ""], // zusaetzliches Reiseziel ohne Beitritt
    ["wait", 60], // Sekunden auf eine Einladung warten
    ["maxtravels", 6],
    ["out", "data/travel.txt"],
    ["dry", false],
    ["nofocusbreak", false],
    ["keepforeigninvites", false],
    ["help", false],
  ]);

  const OUT = String(flags.out);
  const HOST = ns.getHostname();

  // ns.write und ns.read arbeiten IMMER auf dem Rechner, auf dem das Skript
  // laeuft — und das ist hier nicht home (27,75 GB passen dort nicht hin).
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
    // Nach JEDER Zeile: stirbt das Skript mitten im Lauf — `kill`, oder ein
    // ScriptDeath aus ns.sleep, der ohne Vorwarnung kommt —, ist der Stand
    // bis dahin trotzdem von aussen lesbar.
    flush();
  };

  say(`# travel.js — ${new Date().toISOString()} auf ${HOST}`);

  if (flags.help) {
    say("Aufruf: run travel.js --join <Liste> --forbid <Liste> [--to Stadt] [--wait 60] [--dry]");
    say("  Listen sind kommagetrennt OHNE Leerzeichen: NewTokyo,TianDiHui,Sector-12");
    say("  (der Auftragslaeufer zerlegt die Zeile an jedem Leerzeichen, src/autopilot.js:560)");
    say("  --forbid ist PFLICHT und muss jede Faktion nennen, die der Plan sperrt.");
    say("  --dry rechnet nur und fasst die Oberflaeche nicht an.");
    return;
  }

  // ---- Namen aufloesen. Geraten wird nichts. ----------------------------
  const knownFactions = Object.keys(ENEMIES).concat(Object.keys(INVITE_REQS));
  const uniqueFactions = [...new Set(knownFactions)];

  const rawJoin = splitList(flags.join);
  const rawForbid = splitList(flags.forbid);

  if (rawForbid.length === 0) {
    say("ABBRUCH: --forbid fehlt. Die Sperrliste ist Pflicht.");
    say("  Sie muss jede Faktion nennen, die der Plan bis zur naechsten Augmentierung sperrt.");
    say("  Beispiel: --join Chongqing,TianDiHui,NewTokyo,Ishima --forbid Sector-12,Aevum,Volhaven");
    ns.tprint("travel.js: ABBRUCH, --forbid fehlt.");
    return;
  }

  const join = [];
  const forbid = [];
  let nameError = "";
  for (const raw of rawJoin) {
    // Aufgeloest wird gegen ALLE bekannten Faktionsnamen, nicht nur gegen die
    // mit Ortsbedingung — sonst waere ein Tippfehler bei "Chongqing" nicht von
    // einer Faktion ohne Ortsbedingung zu unterscheiden.
    const r = resolveName(raw, uniqueFactions);
    if (!r) nameError = nameError || `--join: "${raw}" ist kein bekannter Faktionsname`;
    else join.push(r);
  }
  for (const raw of rawForbid) {
    const r = resolveName(raw, uniqueFactions);
    if (!r) nameError = nameError || `--forbid: "${raw}" ist kein bekannter Faktionsname`;
    else forbid.push(r);
  }
  let travelTo = "";
  if (flags.to) {
    travelTo = resolveName(flags.to, CITIES);
    if (!travelTo) nameError = nameError || `--to: "${flags.to}" ist keine bekannte Stadt`;
  }

  if (nameError) {
    say("ABBRUCH: " + nameError);
    say("  Bekannte Faktionen mit Ortsbedingung: " + Object.keys(INVITE_REQS).join(", "));
    say("  Bekannte Staedte: " + CITIES.join(", "));
    say("  Schreibweise egal (Gross/Klein, Bindestriche, Leerzeichen) — der Name selbst nicht.");
    ns.tprint("travel.js: ABBRUCH, " + nameError);
    return;
  }

  say(`--join   : ${join.join(", ") || "(nichts)"}`);
  say(`--forbid : ${forbid.join(", ")}`);
  if (travelTo) say(`--to     : ${travelTo}`);
  const p0 = ns.getPlayer();
  say(`Start    : ${p0.city}, $${p0.money.toExponential(4)}, Hacking ${p0.skills.hacking}, Mitglied bei ${p0.factions.length} Faktion(en)`);

  const report = await run({
    // Im Trockenlauf bekommt der Automat GAR KEIN Dokument. Damit ist
    // strukturell ausgeschlossen, dass er etwas anfasst — nicht nur
    // versprochen.
    doc: flags.dry ? null : document,
    sleep: (ms) => ns.sleep(ms),
    player: () => ns.getPlayer(),
    join,
    forbid,
    travelTo,
    inviteWaitMs: Number(flags.wait) * 1000,
    maxTravels: Number(flags.maxtravels),
    dry: !!flags.dry,
    allowUnfocus: !flags.nofocusbreak,
    dismissForeignInvites: !flags.keepforeigninvites,
    log: (z) => say("  " + z),
  });

  say("--- Ergebnis ---");
  say(`Stadt      : ${report.startCity} -> ${report.endCity}`);
  say(`Reisen     : ${report.travels} fuer $${report.spent.toExponential(3)}`);
  say(`Beigetreten: ${report.joined.join(", ") || "nichts"}`);
  say(`Gescheitert: ${report.failed.join(", ") || "nichts"}`);
  say(`Ziel erreicht: ${report.ok ? "JA" : "NEIN"}${report.reason ? " — " + report.reason : ""}`);
  say(
    `Zurueck am Terminal: ${
      report.atTerminal === null ? "nicht geprueft" : report.atTerminal ? "ja" : "NEIN — hand.js wird den naechsten Befehl verschlucken"
    }`,
  );
  say(`Faktionen jetzt: ${ns.getPlayer().factions.join(", ") || "keine"}`);

  ns.tprint(
    `travel: ${report.startCity} -> ${report.endCity}, beigetreten: ${report.joined.join(", ") || "nichts"}. ` +
      (report.ok ? "Ziel erreicht." : report.reason || "unvollstaendig"),
  );
}
