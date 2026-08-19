/**
 * Oberflaechen-Fahrplaene fuer Bitburner 3.0.1.
 *
 * Zweck: Ohne Source File 4 (Singularity-API) kann kein Skript im Spiel
 * Programme kaufen, Faktionen beitreten, arbeiten oder Augmentations
 * installieren. Das geht nur ueber die Oberflaeche. Dieses Modul kann den
 * Browser NICHT selbst bedienen — es liefert fuer jede dieser Aufgaben eine
 * maschinenlesbare Schrittfolge, die der Hauptagent mit seinen
 * Browser-Werkzeugen abarbeitet.
 *
 * Die Begruendung zu jedem Schritt (Fundstellen im Spielquellcode, exakte
 * Beschriftungen, Fehlerfaelle) steht in doku/oberflaeche.md.
 *
 * Aufruf als Bibliothek:
 *   import { travelTo } from "./tools/ui.js";
 *   const plan = travelTo({ city: "Aevum" });
 *
 * Aufruf auf der Kommandozeile:
 *   node tools/ui.js                        # Aufgabenliste
 *   node tools/ui.js travelTo Aevum         # Fahrplan lesbar ausgeben
 *   node tools/ui.js travelTo Aevum --json  # Fahrplan als JSON
 *
 * ---------------------------------------------------------------------------
 * SCHEMA
 * ---------------------------------------------------------------------------
 *
 * Eine Aufgabe liefert einen PLAN:
 *
 *   {
 *     aufgabe: "travelTo",          // Name der Funktion
 *     titel: "Nach Aevum reisen",   // eine Zeile, deutsch
 *     voraussetzungen: [ String ],  // was gelten muss, bevor man anfaengt
 *     schritte: [ Schritt ],        // der eigentliche Ablauf, der Reihe nach
 *     erfolg: String,               // woran man erkennt, dass es geklappt hat
 *     fehlschlaege: [ Fehlschlag ]  // was schiefgehen kann und wie es aussieht
 *   }
 *
 * Ein FEHLSCHLAG:
 *
 *   { lage: String, zeichen: String, mittel: String }
 *     lage    - was der Fall ist (z. B. "zu wenig Geld")
 *     zeichen - woran man es im Browser merkt
 *     mittel  - was dann zu tun ist
 *
 * Ein SCHRITT hat immer `art` und `zweck` und je nach Art weitere Felder.
 * Gemeinsame Zusatzfelder:
 *
 *   optional : true  -> der Schritt darf entfallen, wenn `wenn` nicht zutrifft
 *   wenn     : Bedingung in Prosa, unter der der Schritt ueberhaupt noetig ist
 *
 * Die acht Arten:
 *
 * 1) { art: "nav", ziel, hotkey, suche, gruppe, zweck }
 *      Seitenwechsel. `hotkey` ist der bevorzugte Weg (z. B. "Alt+F"); ist er
 *      null, gibt es keinen. `suche` ist der Text des Sidebar-Eintrags als
 *      Ersatzweg, `gruppe` die Sidebar-Gruppe, die dafuer aufgeklappt sein
 *      muss (zugeklappte Gruppen haben ihre Eintraege nicht im DOM).
 *      Hotkeys wirken NICHT, solange fokussierte Arbeit laeuft.
 *
 * 2) { art: "klick", suche, treffer, trusted, zweck }
 *      Klick auf ein Element mit sichtbarem Text `suche`.
 *      `treffer` sagt, wie verglichen wird:
 *        "praefix"  - Text beginnt damit (Regelfall, weil viele Knoepfe
 *                     Preis oder Prozentwert anhaengen)
 *        "genau"    - Text ist exakt gleich
 *        "enthaelt" - Text kommt irgendwo vor
 *      `trusted: true` heisst: der Knopf prueft `event.isTrusted`. Ein
 *      `element.click()` aus einer JS-Auswertung heraus tut dann NICHTS,
 *      kommentarlos. Es braucht einen echten Eingabe-Event.
 *      Optional `aria`: ein `aria-label`, das als stabilerer Anker taugt.
 *
 * 3) { art: "tippen", suche, text, zweck }
 *      Text in ein Eingabefeld schreiben, das ueber seinen Platzhalter oder
 *      sein Label `suche` gefunden wird. Ohne Enter. Alle Felder sind
 *      kontrollierte React-Komponenten: echtes Tippen funktioniert, ein
 *      `input.value = "..."` aus JavaScript heraus wuerde React entgehen.
 *
 * 4) { art: "taste", taste, zweck }
 *      Eine Taste druecken, ohne dass ein Element gemeint ist — praktisch nur
 *      "Escape", um einen Dialog zu schliessen. Die einfachen Meldungen des
 *      Spiels haben KEINEN OK-Knopf (AlertManager.tsx:89-93).
 *
 * 5) { art: "terminal", befehl, erwartet, zweck }
 *      Befehl ins Terminal tippen und mit Enter abschicken.
 *      Das Eingabefeld ist `#terminal-input`, die Ausgabe steht in `#terminal`.
 *      `erwartet` ist der Text, der danach in der Ausgabe stehen sollte.
 *      Mehrere Befehle lassen sich mit ";" in einer Zeile verketten.
 *
 * 6) { art: "pruefe", erwartet, fehlt, zweck }
 *      Nichts anklicken, nur hinsehen. `erwartet` ist der Text oder Zustand,
 *      der da sein muss; `fehlt` sagt, was es bedeutet, wenn er fehlt.
 *
 * 7) { art: "warte", bis, maxSekunden, zweck }
 *      Warten, bis eine Bedingung eintritt. Keine festen Sekunden abwarten,
 *      sondern `bis` pruefen; `maxSekunden` ist nur die Reissleine.
 *
 * 8) { art: "hinweis", text, zweck }
 *      Kein Schritt im Browser, sondern etwas, das der Agent wissen muss —
 *      etwa dass nach einem Install alle Skripte neu ausgespielt werden
 *      muessen.
 *
 * Abweichung von der Hausregel "Bezeichner englisch": die Schluessel der
 * Schritte sind deutsch, weil das Schema so vorgegeben wurde und der
 * Hauptagent es so liest. Funktionsnamen und interne Variablen sind englisch.
 */

// ---------------------------------------------------------------------------
// Stammdaten aus dem Spielquellcode
// ---------------------------------------------------------------------------

/** Staedte. Quelle: src/Locations/Enums.ts:70-77 */
export const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

/** Reisekosten je Fahrt. Quelle: src/Constants.ts:28 */
export const TRAVEL_COST = 200e3;

/** Preis des TOR-Routers. Quelle: src/Constants.ts:44 */
export const TOR_ROUTER_COST = 200e3;

/**
 * Darkweb-Sortiment in der Reihenfolge, in der `buy -a` es abarbeitet.
 * Quelle: src/DarkWeb/DarkWebItems.ts, Namen aus src/Programs/Enums.ts.
 */
export const DARKWEB_PROGRAMS = [
  { name: "BruteSSH.exe", price: 500e3, use: "Opens up SSH Ports." },
  { name: "FTPCrack.exe", price: 1500e3, use: "Opens up FTP Ports." },
  { name: "relaySMTP.exe", price: 5e6, use: "Opens up SMTP Ports." },
  { name: "HTTPWorm.exe", price: 30e6, use: "Opens up HTTP Ports." },
  { name: "SQLInject.exe", price: 250e6, use: "Opens up SQL Ports." },
  { name: "ServerProfiler.exe", price: 500e3, use: "Displays detailed server information." },
  { name: "DeepscanV1.exe", price: 500e3, use: "Enables 'scan-analyze' with a depth up to 5." },
  { name: "DeepscanV2.exe", price: 25e6, use: "Enables 'scan-analyze' with a depth up to 10." },
  { name: "AutoLink.exe", price: 1e6, use: "Enables direct connect via 'scan-analyze'." },
  { name: "DarkscapeNavigator.exe", price: 50e6, use: "Unlock access to the Dark Net." },
  { name: "Formulas.exe", price: 5e9, use: "Unlock access to the formulas API." },
];

/**
 * Alle TechVendor. Wichtig: min/max RAM betreffen NUR die Cloud-Server-Knoepfe.
 * Die Knoepfe fuer home-RAM und home-Kerne sind bei jedem Vendor gleich und
 * unbeschraenkt (src/Locations/ui/TechVendorLocation.tsx:59-63). Fuer
 * home-Upgrades ist also jeder Vendor gleich gut.
 * Quelle: src/Locations/data/LocationsMetadata.ts, src/Locations/Enums.ts.
 */
export const TECH_VENDORS = [
  { location: "Alpha Enterprises", city: "Sector-12", cloudMinRam: 2, cloudMaxRam: 8 },
  { location: "NetLink Technologies", city: "Aevum", cloudMinRam: 8, cloudMaxRam: 64 },
  { location: "Omega Software", city: "Ishima", cloudMinRam: 4, cloudMaxRam: 128 },
  { location: "CompuTek", city: "Volhaven", cloudMinRam: 8, cloudMaxRam: 256 },
  { location: "Storm Technologies", city: "Ishima", cloudMinRam: 32, cloudMaxRam: 512 },
  { location: "ECorp", city: "Aevum", cloudMinRam: 128, cloudMaxRam: 512 },
  { location: "OmniTek Incorporated", city: "Volhaven", cloudMinRam: 128, cloudMaxRam: 1024 },
  { location: "Fulcrum Technologies", city: "Aevum", cloudMinRam: 256, cloudMaxRam: 1024 },
];

/**
 * Die zwoelf Verbrechen. `button` ist der Praefix des Knopftextes in den
 * Slums, `working` der Text, der danach auf der Work-Seite steht — die beiden
 * sind NICHT gleich.
 * Quelle: src/Crime/Enums.ts, src/Crime/Crimes.ts, src/ui/WorkInProgressRoot.tsx:224
 */
export const CRIMES = [
  { button: "Shoplift", working: "to shoplift", difficulty: 1 / 20 },
  { button: "Rob Store", working: "to rob a store", difficulty: 1 / 5 },
  { button: "Mug", working: "to mug", difficulty: 1 / 5 },
  { button: "Larceny", working: "larceny", difficulty: 1 / 3 },
  { button: "Deal Drugs", working: "to deal drugs", difficulty: 1 },
  { button: "Bond Forgery", working: "to forge bonds", difficulty: 1 / 2 },
  { button: "Traffick Arms", working: "to traffic arms", difficulty: 2 },
  { button: "Homicide", working: "homicide", difficulty: 1 },
  { button: "Grand Theft Auto", working: "grand theft auto", difficulty: 8 },
  { button: "Kidnap", working: "to kidnap", difficulty: 5 },
  { button: "Assassination", working: "to assassinate", difficulty: 8 },
  { button: "Heist", working: "a heist", difficulty: 18 },
];

/**
 * Arbeitsarten bei Faktionen. `button` steht auf der Faktionsseite,
 * `working` auf der Work-Seite danach.
 * Quelle: src/Faction/ui/FactionRoot.tsx:125-141, src/ui/WorkInProgressRoot.tsx:371-375
 */
export const FACTION_WORK_TYPES = {
  hacking: { button: "Hacking Contracts", working: "carrying out hacking contracts" },
  field: { button: "Field Work", working: "carrying out field missions" },
  security: { button: "Security Work", working: "performing security detail" },
};

/**
 * Sidebar-Navigation. `hotkey` aus src/utils/KeyBindingUtils.ts:66ff,
 * Beschriftung und Gruppe aus src/Sidebar/ui/SidebarRoot.tsx.
 * Die Beschriftung ist der Seitenname selbst (SidebarItem.tsx:44).
 */
export const PAGES = {
  Terminal: { hotkey: "Alt+T", group: "Hacking" },
  "Script Editor": { hotkey: "Alt+E", group: "Hacking" },
  "Active Scripts": { hotkey: "Alt+S", group: "Hacking" },
  "Create Program": { hotkey: "Alt+P", group: "Hacking" },
  Stats: { hotkey: "Alt+C", group: "Character" },
  Factions: { hotkey: "Alt+F", group: "Character" },
  Augmentations: { hotkey: "Alt+A", group: "Character" },
  Hacknet: { hotkey: "Alt+H", group: "Character" },
  City: { hotkey: "Alt+W", group: "World" },
  Travel: { hotkey: "Alt+R", group: "World" },
  Job: { hotkey: "Alt+J", group: "World" },
  Options: { hotkey: "Alt+O", group: "Help" },
  Milestones: { hotkey: null, group: "Help" },
  Documentation: { hotkey: "Alt+U", group: "Help" },
};

/** Die zwei DOM-Anker, die das Spiel ausdruecklich anbietet. */
export const ANCHORS = {
  terminalInput: "#terminal-input",
  terminalOutput: "#terminal",
};

/** Server, deren Backdoor eine Faktionseinladung ausloest. Quelle: src/Server/data/SpecialServers.ts */
export const FACTION_BACKDOOR_SERVERS = {
  CSEC: "CyberSec",
  "avmnite-02h": "NiteSec",
  "I.I.I.I": "The Black Hand",
  run4theh111z: "BitRunners",
  ".": "The Dark Army",
  "The-Cave": "Daedalus",
  fulcrumassets: "Fulcrum Secret Technologies",
};

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Seitenwechsel als Schritt. Nimmt Hotkey und Sidebar-Weg zugleich mit. */
function navStep(page, zweck) {
  const info = PAGES[page];
  if (!info) throw new Error(`Unbekannte Seite: ${page}`);
  return {
    art: "nav",
    ziel: page,
    hotkey: info.hotkey,
    suche: page,
    gruppe: info.group,
    zweck,
  };
}

function clickStep(suche, zweck, extra = {}) {
  return { art: "klick", suche, treffer: "praefix", trusted: false, zweck, ...extra };
}

function terminalStep(befehl, zweck, erwartet = null) {
  return { art: "terminal", befehl, erwartet, zweck };
}

function checkStep(erwartet, zweck, fehlt = null) {
  return { art: "pruefe", erwartet, fehlt, zweck };
}

/**
 * Ein Ort in der aktuellen Stadt wird geoeffnet.
 * Mit eingeschaltetem "Disable ASCII art" ist das ein Knopf mit dem Ortsnamen
 * (City.tsx:141), sonst nur ein Buchstabe mit aria-label (City.tsx:61).
 */
function openLocationSteps(location, zweck) {
  return [
    navStep("City", "Stadtansicht oeffnen"),
    {
      art: "klick",
      suche: location,
      treffer: "genau",
      aria: location,
      trusted: false,
      zweck,
      wenn:
        "Ist 'Disable ASCII art' aus, gibt es keinen Knopf mit diesem Text, " +
        "sondern nur einen Buchstaben mit aria-label. Dann ueber das aria-label gehen.",
    },
    checkStep(
      `Der Knopf "Return to World" ist da und die Ueberschrift lautet "${location}"`,
      "Bestaetigen, dass der richtige Ort offen ist",
      "Die Ueberschrift kann verfremdet aussehen, wenn der zugehoerige Server eine Backdoor hat " +
        "(CorruptibleText, GenericLocation.tsx:117-127). Dagegen hilft der Schalter " +
        "'Disable text effects'. Ist er aus, lieber an einem ortstypischen Text festmachen — " +
        "beim TechVendor etwa \"More RAM means more scripts on 'home'\", in den Slums an den " +
        "Verbrechen-Knoepfen.",
    ),
  ];
}

/** Ein Dialog ohne OK-Knopf wird weggeraeumt. */
function dismissDialogStep(text, zweck) {
  return {
    art: "taste",
    taste: "Escape",
    zweck,
    wenn:
      `Nur wenn der Dialog "${text}" erscheint. Er hat KEINEN OK-Knopf ` +
      "(AlertManager.tsx:89-93) — Escape druecken oder das X oben rechts klicken.",
    optional: true,
  };
}

function assertOneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`Unbekannter Wert fuer ${label}: ${JSON.stringify(value)}. Erlaubt: ${allowed.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Aufgabe 0 — Oberflaeche automatentauglich einstellen
// ---------------------------------------------------------------------------

/**
 * Einmalig vor dem ersten Lauf. Schaltet die ASCII-Kunst ab (macht aus
 * Buchstaben beschriftete Knoepfe) und wahlweise die beiden
 * Bestaetigungsdialoge.
 *
 * Abwaegung: Die Suppress-Schalter machen die Ablaeufe kuerzer, kosten aber
 * die Erfolgsdialoge als Rueckmeldung. Alle Plaene hier funktionieren mit und
 * ohne — die betroffenen Schritte sind `optional`.
 */
export function prepareUi({ suppressTravelConfirmation = true, suppressAugConfirmation = true } = {}) {
  const schritte = [
    navStep("Options", "Einstellungen oeffnen"),
    clickStep("Interface", "Reiter 'Interface' waehlen", { treffer: "genau" }),
    clickStep("Disable ASCII art", "Stadtkarte und Weltkarte auf beschriftete Knoepfe umstellen", {
      treffer: "genau",
      wenn: "Nur klicken, wenn der Schalter noch aus ist — er kippt bei jedem Klick.",
    }),
    clickStep("Disable text effects", "Verhindern, dass Ueberschriften flackernd verfremdet werden", {
      treffer: "genau",
      wenn:
        "Nur klicken, wenn der Schalter noch aus ist. Ohne ihn ersetzt CorruptibleText auf jeder " +
        "Location-Seite, deren Server eine Backdoor hat, laufend zufaellige Zeichen in der " +
        "Ueberschrift (GenericLocation.tsx:117-127) — Textvergleiche auf die Ueberschrift schlagen " +
        "dann sporadisch fehl.",
    }),
  ];

  if (suppressTravelConfirmation || suppressAugConfirmation) {
    schritte.push(clickStep("Gameplay", "Reiter 'Gameplay' waehlen", { treffer: "genau" }));
  }
  if (suppressTravelConfirmation) {
    schritte.push(
      clickStep("Suppress travel confirmations", "Reisen ohne Rueckfrage", {
        treffer: "genau",
        wenn: "Nur klicken, wenn der Schalter noch aus ist.",
      }),
    );
  }
  if (suppressAugConfirmation) {
    schritte.push(
      clickStep("Suppress augmentations confirmation", "Aug-Kauf UND Aug-Installation ohne Rueckfrage", {
        treffer: "genau",
        wenn: "Nur klicken, wenn der Schalter noch aus ist.",
      }),
    );
  }

  schritte.push(navStep("Terminal", "Zurueck auf eine neutrale Seite"));

  return {
    aufgabe: "prepareUi",
    titel: "Oberflaeche fuer den Automaten einstellen",
    voraussetzungen: ["Spiel geladen, keine fokussierte Arbeit am Laufen (sonst greifen die Hotkeys nicht)"],
    schritte,
    erfolg:
      "Auf der City-Seite stehen beschriftete Knoepfe statt der ASCII-Karte. " +
      "Der jeweilige Schalter in Options ist blau/an.",
    fehlschlaege: [
      {
        lage: "Schalter war schon an und wurde erneut geklickt",
        zeichen: "ASCII-Karte ist wieder da",
        mittel: "Zustand des Switch vor dem Klick pruefen, nicht blind klicken.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 1a — TOR-Router kaufen
// ---------------------------------------------------------------------------

/**
 * Der TOR-Router ist ein Knopf beim TechVendor, kein Terminalbefehl.
 * @param {string} [city] Stadt, in der man gerade ist. Bestimmt nur, welcher
 *   Vendor vorgeschlagen wird; jeder TechVendor verkauft denselben Router.
 */
export function buyTorRouter({ city = "Sector-12" } = {}) {
  assertOneOf(city, CITIES, "city");
  const vendor = TECH_VENDORS.find((v) => v.city === city);
  if (!vendor) {
    throw new Error(
      `In ${city} gibt es keinen TechVendor. TechVendor gibt es nur in ` +
        `Sector-12, Aevum, Ishima und Volhaven — erst dorthin reisen (travelTo).`,
    );
  }

  return {
    aufgabe: "buyTorRouter",
    titel: `TOR-Router bei ${vendor.location} in ${city} kaufen`,
    voraussetzungen: [
      `Spieler ist in ${city}`,
      `Mindestens $${TOR_ROUTER_COST.toLocaleString("en-US")} auf dem Konto`,
      "Kein TOR-Router vorhanden (sonst ist der Knopf disabled und zeigt 'Purchased')",
    ],
    schritte: [
      ...openLocationSteps(vendor.location, `TechVendor ${vendor.location} oeffnen`),
      checkStep(
        "Knopf beginnt mit 'Purchase TOR router' und ist NICHT disabled",
        "Vorab pruefen, ob der Kauf ueberhaupt moeglich ist",
        "Ist er disabled, fehlt Geld oder der Router ist schon da ('- Purchased').",
      ),
      clickStep("Purchase TOR router", "TOR-Router kaufen"),
      dismissDialogStep("You have purchased a TOR router!", "Erfolgsdialog wegklicken"),
      checkStep(
        "Knopftext lautet jetzt 'Purchase TOR router - Purchased', Knopf disabled",
        "Erfolg belegen",
      ),
    ],
    erfolg:
      "Dialog 'You have purchased a TOR router!' und danach der Knopftext " +
      "'Purchase TOR router - Purchased'. Gegenprobe im Terminal: 'buy -l' listet das Sortiment, " +
      "statt den Fehler 'You need to be able to connect to the Dark Web' zu werfen.",
    fehlschlaege: [
      {
        lage: "zu wenig Geld",
        zeichen: "Knopf ist disabled, Preis ausgegraut",
        mittel: "Erst Geld verdienen. Ueber die Oberflaeche erscheint keine Fehlermeldung.",
      },
      {
        lage: "falsche Stadt",
        zeichen: "Auf der City-Seite gibt es keinen der acht TechVendor",
        mittel: "travelTo() nach Sector-12, Aevum, Ishima oder Volhaven.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 1b — Programme im Darkweb kaufen
// ---------------------------------------------------------------------------

/**
 * Programme kauft man ausschliesslich ueber das Terminal. Es gibt keine
 * Darkweb-Seite und keine Kaufknoepfe.
 *
 * Bewusst KEIN `buy -a`: `buyAllDarkwebItems` bricht beim ersten
 * unbezahlbaren Posten komplett ab (DarkWeb.tsx:100-103) und ueberspringt
 * damit auch alle billigen Posten dahinter. Einzelkaeufe in aufsteigender
 * Preisreihenfolge sind das Richtige.
 *
 * @param {string[]} [programs] Namen wie in DARKWEB_PROGRAMS. Vorgabe: die
 *   fuenf Port-Oeffner plus Formulas.exe.
 */
export function buyPrograms({
  programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe", "Formulas.exe"],
} = {}) {
  const known = DARKWEB_PROGRAMS.map((p) => p.name);
  for (const name of programs) assertOneOf(name, known, "program");

  // Aufsteigend nach Preis, damit ein Geldmangel nur die teuren Posten trifft.
  const ordered = programs
    .map((name) => DARKWEB_PROGRAMS.find((p) => p.name === name))
    .sort((a, b) => a.price - b.price);

  const schritte = [
    navStep("Terminal", "Terminal oeffnen"),
    terminalStep("buy -l", "Sortiment und Besitzstand ansehen", "Zeilen mit Programmname, Preis oder [OWNED]"),
  ];

  for (const p of ordered) {
    schritte.push(
      terminalStep(
        `buy ${p.name}`,
        `${p.name} kaufen ($${p.price.toLocaleString("en-US")})`,
        `You have purchased the ${p.name} program. The new program can be found on your home computer.`,
      ),
    );
  }

  schritte.push(
    terminalStep("buy -l", "Gegenprobe", "Die gekauften Programme stehen jetzt mit [OWNED] statt einem Preis."),
  );

  return {
    aufgabe: "buyPrograms",
    titel: `Darkweb-Programme kaufen: ${ordered.map((p) => p.name).join(", ")}`,
    voraussetzungen: [
      "TOR-Router vorhanden (sonst verweigert 'buy' den Dienst)",
      `Geld: $${ordered.reduce((s, p) => s + p.price, 0).toLocaleString("en-US")} fuer die volle Liste`,
      "Der 'buy'-Befehl geht von ueberall, ein 'connect darkweb' ist nicht noetig",
    ],
    schritte,
    erfolg:
      "Je Programm die Zeile 'You have purchased the <Name> program. ...' im Terminal, " +
      "und danach '[OWNED]' in der Ausgabe von 'buy -l'.",
    fehlschlaege: [
      {
        lage: "kein TOR-Router",
        zeichen:
          'Rote Zeile: You need to be able to connect to the Dark Web to use the "buy" command. ' +
          "(Maybe there's a TOR router you can buy somewhere)",
        mittel: "Erst buyTorRouter() abarbeiten.",
      },
      {
        lage: "zu wenig Geld",
        zeichen: "Rote Zeile: Not enough money to purchase <Name>",
        mittel: "Posten ueberspringen und spaeter erneut versuchen. Die billigeren Posten sind davon nicht betroffen.",
      },
      {
        lage: "schon vorhanden",
        zeichen: "You already have the <Name> program",
        mittel: "Nichts. Kein Fehler.",
      },
      {
        lage: "Name falsch geschrieben",
        zeichen: "Rote Zeile: Unrecognized item: <name>",
        mittel:
          "Namen aus DARKWEB_PROGRAMS nehmen. Achtung: 'relaySMTP.exe' faengt klein an, " +
          "'SQLInject.exe' hat drei Grossbuchstaben. Der Vergleich selbst ist unempfindlich " +
          "gegen Gross- und Kleinschreibung (DarkWeb.tsx:46).",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 2 — home-RAM und Kerne
// ---------------------------------------------------------------------------

function homeUpgradePlan({ kind, count, city }) {
  assertOneOf(city, CITIES, "city");
  const vendor = TECH_VENDORS.find((v) => v.city === city);
  if (!vendor) {
    throw new Error(
      `In ${city} gibt es keinen TechVendor. Erst nach Sector-12, Aevum, Ishima oder Volhaven reisen.`,
    );
  }

  const isRam = kind === "ram";
  const label = isRam ? "Upgrade 'home' RAM" : "Upgrade 'home' cores";
  const shape = isRam ? "(8.00GB -> 16.00GB) - $1.032m" : "(1 -> 2) - $7.500b";

  const schritte = [...openLocationSteps(vendor.location, `TechVendor ${vendor.location} oeffnen`)];

  for (let i = 1; i <= count; i++) {
    schritte.push(
      checkStep(
        `Knopf beginnt mit "${label}" und ist NICHT disabled`,
        `Stufe ${i} von ${count}: pruefen, ob der Kauf moeglich ist`,
        `Disabled heisst: zu wenig Geld ODER Maximum erreicht. Bei Maximum steht "${label} - Max".`,
      ),
      clickStep(label, `Stufe ${i} von ${count} kaufen`),
      checkStep(
        `Der Klammerteil im Knopftext ist eine Stufe weitergerueckt, Form: "${label} ${shape}"`,
        "Erfolg belegen — es gibt keinen Dialog und keinen Toast",
      ),
    );
  }

  return {
    aufgabe: isRam ? "upgradeHomeRam" : "upgradeHomeCores",
    titel: `home-${isRam ? "RAM" : "Kerne"} ${count}x aufruesten bei ${vendor.location} in ${city}`,
    voraussetzungen: [
      `Spieler ist in ${city}`,
      "Genug Geld — der Knopf ist sonst disabled, ohne Fehlermeldung",
      isRam
        ? "RAM ist noch nicht am Maximum (2^30 GB, bzw. 128 GB bei BitNode-Option restrictHomePCUpgrade)"
        : "Weniger als 8 Kerne",
      "Jeder TechVendor kann das Gleiche — min/max RAM in TECH_VENDORS betreffen nur Cloud-Server",
    ],
    schritte,
    erfolg:
      `Der Knopftext rueckt je Kauf eine Stufe weiter (${isRam ? "8.00GB -> 16.00GB wird zu 16.00GB -> 32.00GB" : "(1 -> 2) wird zu (2 -> 3)"}) ` +
      "und der Preis steigt. Gegenprobe im Terminal: 'home; free' bzw. 'home; analyze'.",
    fehlschlaege: [
      {
        lage: "zu wenig Geld",
        zeichen: "Knopf disabled, Preis ausgegraut",
        mittel: "Warten oder Geld verdienen. Kein Dialog, kein Toast.",
      },
      {
        lage: "Maximum erreicht",
        zeichen: `Knopftext lautet "${label} - Max"`,
        mittel: "Nichts mehr zu holen.",
      },
      {
        lage: "falsche Stadt",
        zeichen: "Auf der City-Seite gibt es keinen TechVendor",
        mittel: "travelTo() nach Sector-12, Aevum, Ishima oder Volhaven.",
      },
    ],
  };
}

/** home-RAM verdoppeln, `count` mal hintereinander. */
export function upgradeHomeRam({ count = 1, city = "Sector-12" } = {}) {
  return homeUpgradePlan({ kind: "ram", count, city });
}

/** home-Kerne um `count` erhoehen (Maximum 8). */
export function upgradeHomeCores({ count = 1, city = "Sector-12" } = {}) {
  return homeUpgradePlan({ kind: "cores", count, city });
}

// ---------------------------------------------------------------------------
// Aufgabe 3 — Faktion beitreten
// ---------------------------------------------------------------------------

/**
 * Der Knopf heisst "Join!" — mit Ausrufezeichen. Er prueft `event.isTrusted`
 * (FactionsRoot.tsx:89), ein Skript-Klick tut also nichts.
 */
export function joinFaction({ faction }) {
  if (!faction || typeof faction !== "string") {
    throw new Error("joinFaction braucht den Faktionsnamen, z. B. { faction: 'CyberSec' }");
  }

  return {
    aufgabe: "joinFaction",
    titel: `Faktion ${faction} beitreten`,
    voraussetzungen: [
      "Es liegt eine Einladung vor. Ohne Einladung gibt es den Knopf gar nicht — er ist nicht disabled, sondern fehlt.",
      "Die Faktion ist nicht gebannt (Feind einer bereits beigetretenen Faktion).",
      "Der Sidebar-Eintrag 'Factions' existiert nur bei canOpenFactions.",
    ],
    schritte: [
      navStep("Factions", "Faktionsuebersicht oeffnen"),
      checkStep(
        `Ueberschrift "Faction Invitations" ist vorhanden und die Karte "${faction}" steht darunter`,
        "Pruefen, ob die Einladung wirklich offen ist",
        "Fehlt die Ueberschrift, gibt es keine offene Einladung. Der rote Zaehler an der Sidebar taugt " +
          "NICHT als Pruefung — er zaehlt nur ungesehene Einladungen und verschwindet nach dem ersten Besuch.",
      ),
      {
        art: "klick",
        suche: "Join!",
        treffer: "genau",
        trusted: true,
        zweck: `Einladung von ${faction} annehmen`,
        wenn:
          `Der richtige "Join!"-Knopf ist der in derselben Karte wie der Text "${faction}". ` +
          "Bei mehreren offenen Einladungen gibt es mehrere gleich beschriftete Knoepfe.",
      },
      dismissDialogStep("Warnung ueber verfeindete Faktionen", "Etwaigen Dialog wegklicken"),
      checkStep(
        `In der Karte "${faction}" stehen jetzt die Knoepfe "Details" und "Augments" statt "Join!"`,
        "Erfolg belegen",
      ),
    ],
    erfolg:
      `Die Karte "${faction}" ist von "Faction Invitations" nach "Your Factions" gewandert, ` +
      `"Join!" ist durch "Details" und "Augments" ersetzt, und rechts stehen "0 favor" und "0 rep".`,
    fehlschlaege: [
      {
        lage: "Klick war kein echter Eingabe-Event",
        zeichen: "Nichts passiert, keine Meldung, der Knopf bleibt stehen",
        mittel:
          "FactionsRoot.tsx:89 prueft event.isTrusted. Mit echten Browser-Eingaben klicken, " +
          "nicht mit element.click() aus einer JS-Auswertung.",
      },
      {
        lage: "keine Einladung",
        zeichen: "Es gibt keine Ueberschrift 'Faction Invitations' und keinen 'Join!'-Knopf",
        mittel:
          "Einladungen kommen vom Spiel. Ueblicher Ausloeser: Backdoor auf dem zugehoerigen Server " +
          "(siehe FACTION_BACKDOOR_SERVERS), Geldschwelle, Stadt oder Firmen-Reputation. " +
          "Die Bedingungen stehen als Checkliste im Tooltip auf dem Faktionsnamen.",
      },
      {
        lage: "Einladungs-Popup ist im Weg",
        zeichen:
          "Modal mit 'You received a faction invitation.' und den Knoepfen 'Join' (ohne Ausrufezeichen) " +
          "und 'Decide later'",
        mittel:
          "Das ist ein zweiter, gleichwertiger Weg. Entweder dort 'Join' klicken (ebenfalls echter " +
          "Eingabe-Event noetig) oder mit 'Decide later' wegraeumen und den Weg ueber die Seite gehen.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 4 — Fuer eine Faktion arbeiten
// ---------------------------------------------------------------------------

export function workForFaction({ faction, workType = "hacking" }) {
  if (!faction || typeof faction !== "string") {
    throw new Error("workForFaction braucht den Faktionsnamen, z. B. { faction: 'CyberSec' }");
  }
  assertOneOf(workType, Object.keys(FACTION_WORK_TYPES), "workType");
  const work = FACTION_WORK_TYPES[workType];

  return {
    aufgabe: "workForFaction",
    titel: `Fuer ${faction} arbeiten (${work.button})`,
    voraussetzungen: [
      `Mitglied bei ${faction} — sonst zeigt die Seite nur "You have not joined ${faction} yet!"`,
      `Die Faktion bietet diese Arbeitsart an. Tut sie es nicht, fehlt der Knopf "${work.button}" ganz ` +
        "(er ist nicht disabled).",
      "Bei der eigenen Gang-Faktion gibt es ueberhaupt keine Arbeitsknoepfe.",
    ],
    schritte: [
      navStep("Factions", "Faktionsuebersicht oeffnen"),
      {
        art: "klick",
        suche: "Details",
        treffer: "genau",
        trusted: false,
        zweck: `Faktionsseite von ${faction} oeffnen`,
        wenn: `Der richtige "Details"-Knopf ist der in derselben Karte wie der Text "${faction}".`,
      },
      checkStep(`Ueberschrift mit dem Faktionsnamen "${faction}"`, "Auf der richtigen Faktionsseite gelandet?"),
      clickStep(work.button, `Arbeit "${work.button}" beginnen`, { treffer: "genau" }),
      checkStep(
        `Ueberschrift "You are currently ${work.working} for ${faction}"`,
        "Bestaetigen, dass die Arbeit laeuft",
        "Bleibt die Seite stehen, wurde der Knopf nicht getroffen.",
      ),
      {
        art: "hinweis",
        text:
          "Ab jetzt laeuft fokussierte Arbeit. Die Sidebar-Hotkeys wirken NICHT mehr " +
          "(SidebarRoot.tsx:287). Zum Weiterarbeiten erst stopWork() oder den Knopf " +
          "'Do something else simultaneously' benutzen — letzterer beendet die Arbeit nicht, " +
          "sondern hebt nur den Fokus auf (mit Ertragsabschlag).",
        zweck: "Folgeschritte planen",
      },
    ],
    erfolg:
      `Work-Seite mit "You are currently ${work.working} for ${faction}" und einer wachsenden Zeile ` +
      '"Current Faction Reputation: X (Y / sec)".',
    fehlschlaege: [
      {
        lage: "nicht Mitglied",
        zeichen: `"You have not joined ${faction} yet!" mit Knopf "Back to Factions"`,
        mittel: "Erst joinFaction() abarbeiten.",
      },
      {
        lage: "Arbeitsart wird nicht angeboten",
        zeichen: `Der Knopf "${work.button}" ist nicht auf der Seite`,
        mittel:
          "Andere Arbeitsart nehmen. Vorhanden sind je nach Faktion 'Hacking Contracts', " +
          "'Field Work', 'Security Work'.",
      },
      {
        lage: "es lief schon eine andere Arbeit",
        zeichen: "Ein Dialog mit dem Abschlussbericht der vorherigen Arbeit poppt hoch",
        mittel:
          "Kein Fehler — die alte Arbeit wird stillschweigend ersetzt " +
          "(PlayerObjectWorkMethods.ts:5-10). Dialog mit Escape wegraeumen.",
      },
    ],
  };
}

/**
 * Laufende Arbeit beenden.
 * @param {"faction"|"crime"|"company"|"gym"|"course"|"program"|"grafting"} [kind]
 *   Der Knopftext haengt an der Art der Arbeit — es gibt KEINEN gemeinsamen
 *   "Stop"-Knopf. Quelle: src/ui/WorkInProgressRoot.tsx.
 */
export function stopWork({ kind = "faction" } = {}) {
  const labels = {
    faction: "Stop Faction work",
    crime: "Stop committing crime",
    company: "Stop working",
    gym: "Stop training at gym",
    course: "Stop taking course",
    program: "Stop creating program",
    grafting: "Stop grafting",
  };
  assertOneOf(kind, Object.keys(labels), "kind");
  const label = labels[kind];

  return {
    aufgabe: "stopWork",
    titel: `Laufende Arbeit beenden (${label})`,
    voraussetzungen: [
      "Es laeuft eine Arbeit. Laeuft keine, leitet die Work-Seite sofort aufs Terminal um.",
      "Man ist auf der Work-Seite. Ist der Fokus aufgehoben, fuehrt der Knopf 'Focus' in der " +
        "Uebersicht links wieder dorthin.",
    ],
    schritte: [
      checkStep(
        "Die Work-Seite ist offen (Ueberschrift beginnt mit 'You are currently' oder 'You are attempting')",
        "Ausgangslage pruefen",
        "Ist stattdessen das Terminal zu sehen, laeuft keine Arbeit — nichts zu tun.",
      ),
      clickStep(label, "Arbeit beenden", { treffer: "genau" }),
      dismissDialogStep("Abschlussbericht der Arbeit", "Dialog wegklicken"),
      checkStep(
        "Die Work-Seite ist weg (bei Faktionsarbeit: zurueck auf der Faktionsseite, bei Verbrechen: in den Slums)",
        "Erfolg belegen",
      ),
    ],
    erfolg: "Die Work-Seite ist verlassen und die Sidebar-Hotkeys wirken wieder.",
    fehlschlaege: [
      {
        lage: "falscher Knopftext gesucht",
        zeichen: `"${label}" ist nicht auf der Seite`,
        mittel:
          "Der Text haengt an der Arbeitsart. Faktionsarbeit heisst 'Stop Faction work', " +
          "NICHT 'Stop working' — das ist Firmenarbeit.",
      },
      {
        lage: "'Do something else simultaneously' geklickt",
        zeichen: "Die Seite wechselt, aber die Uebersicht links zeigt weiter laufende Arbeit",
        mittel: "Dieser Knopf beendet nichts. Ueber 'Focus' zurueck und den richtigen Knopf nehmen.",
      },
      {
        lage: "nur die Seite verlassen (Hotkey/Sidebar)",
        zeichen: "Uebersicht links zeigt weiter 'Working for ...'",
        mittel:
          "Seitenwechsel hebt nur den Fokus auf (GameRoot.tsx:273), er beendet die Arbeit nicht. " +
          "Ueber 'Focus' zurueck und stoppen.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 5 — Augmentations kaufen und installieren
// ---------------------------------------------------------------------------

export function buyAugmentation({ faction, augmentation }) {
  if (!faction || !augmentation) {
    throw new Error("buyAugmentation braucht { faction, augmentation }");
  }

  return {
    aufgabe: "buyAugmentation",
    titel: `${augmentation} bei ${faction} kaufen`,
    voraussetzungen: [
      `Mitglied bei ${faction}`,
      "Genug Reputation bei der Faktion und genug Geld",
      "Etwaige Voraussetzungs-Augmentations sind gekauft oder installiert",
      "Der Preis steigt mit jeder gekauften, noch nicht installierten Aug (Faktor 1.9 je Stueck)",
    ],
    schritte: [
      navStep("Factions", "Faktionsuebersicht oeffnen"),
      {
        art: "klick",
        suche: "Augments",
        treffer: "genau",
        trusted: false,
        zweck: `Aug-Liste von ${faction} oeffnen`,
        wenn:
          `Der richtige "Augments"-Knopf ist der in derselben Karte wie "${faction}". ` +
          'Alternativer Weg: "Details" -> "Purchase Augmentations".',
      },
      checkStep(`Ueberschrift "Faction Augmentations - ${faction}"`, "Auf der richtigen Seite?"),
      {
        art: "tippen",
        suche: "Filter augmentations",
        text: augmentation,
        zweck:
          "Filterfeld benutzen, damit nur die gesuchte Zeile stehen bleibt — sonst muss man den " +
          'richtigen "Buy"-Knopf unter vielen gleich beschrifteten finden',
        optional: true,
      },
      checkStep(
        `In der Zeile "${augmentation}" steht links ein Knopf "Buy", der NICHT disabled ist`,
        "Kaufbarkeit pruefen",
        "Ist er disabled, fehlt Geld, Reputation oder eine Voraussetzungs-Aug. Am Knopf steht dazu " +
          "NICHTS — den Grund liest man an den Anforderungszeilen darunter ab (Geldbetrag und " +
          "'X rep' mit Haken- oder Leer-Kaestchen) bzw. an 'Missing N pre-requisite(s)'. " +
          "Steht dort 'Owned' statt 'Buy', ist sie schon gekauft.",
      ),
      {
        art: "klick",
        suche: "Buy",
        treffer: "genau",
        trusted: false,
        zweck: `${augmentation} kaufen`,
        wenn: `Der richtige "Buy"-Knopf ist der in derselben Zeile wie "${augmentation}".`,
      },
      clickStep("Purchase", "Kauf bestaetigen", {
        treffer: "genau",
        optional: true,
        wenn:
          "Nur wenn 'Suppress augmentations confirmation' aus ist. Der Dialog zeigt " +
          `"Would you like to purchase the ${augmentation} Augmentation for $...?" und hat KEINEN Cancel-Knopf.`,
      }),
      dismissDialogStep("You purchased " + augmentation + ". ...", "Erfolgsdialog wegklicken"),
      checkStep(
        `Der Knopf in der Zeile "${augmentation}" zeigt jetzt "Owned", und "Price multiplier:" ist gestiegen`,
        "Erfolg belegen",
      ),
    ],
    erfolg:
      `Knopf wechselt von "Buy" auf "Owned", die Zeile rutscht in den blasseren unteren Block, ` +
      'der "Price multiplier:" steigt, und der rote Zaehler am Sidebar-Eintrag "Augmentations" zaehlt hoch.',
    fehlschlaege: [
      {
        lage: "zu wenig Geld oder Reputation",
        zeichen: "Knopf disabled; in den Anforderungszeilen ist das Kaestchen leer statt angehakt",
        mittel: "Reputation erarbeiten (workForFaction) oder Geld verdienen.",
      },
      {
        lage: "Voraussetzungs-Aug fehlt",
        zeichen: "'Missing 1 pre-requisite(s)' mit rotem Icon",
        mittel: "Erst die Vorgaenger-Aug kaufen. Der Tooltip nennt sie.",
      },
      {
        lage: "NeuroFlux Governor",
        zeichen: 'Der Knopf zeigt dauerhaft "Buy", nie "Owned"',
        mittel:
          "Das ist richtig so — NFG ist wiederholbar und bleibt immer in der kaufbaren Liste. " +
          "Erfolg erkennt man am Levelzusatz im Namen, der um eins steigt.",
      },
    ],
  };
}

export function installAugmentations() {
  return {
    aufgabe: "installAugmentations",
    titel: "Gekaufte Augmentations installieren",
    voraussetzungen: [
      "Mindestens eine gekaufte, noch nicht installierte Aug — sonst ist der Knopf disabled.",
      "Bewusstsein darueber, dass das ein Soft Reset ist: Geld, Skills, Reputation, alle Server ausser " +
        "home und alle laufenden Skripte sind danach weg. home-RAM und home-Kerne bleiben.",
    ],
    schritte: [
      {
        art: "hinweis",
        text:
          "Vor dem Install: laufende Arbeit beenden und den Spielstand exportieren, wenn er wichtig ist. " +
          "Der Knopf 'Backup Save' auf derselben Seite gibt zusaetzlich +1 Favor bei allen Faktionen, " +
          "wenn der Bonus verfuegbar ist (Text lautet dann 'Backup Save (+1 favor to all factions)').",
        zweck: "Datenverlust vermeiden",
      },
      navStep("Augmentations", "Augmentations-Seite oeffnen"),
      checkStep(
        'Ueberschrift "Purchased Augmentations" mit einer nicht leeren Liste',
        "Pruefen, dass es ueberhaupt etwas zu installieren gibt",
        "Steht dort 'No Augmentations have been purchased yet', ist der Install-Knopf disabled.",
      ),
      clickStep("Install Augmentations", "Installation ausloesen", { treffer: "genau" }),
      clickStep("Confirm", "Soft Reset bestaetigen", {
        treffer: "genau",
        optional: true,
        wenn:
          "Nur wenn 'Suppress augmentations confirmation' aus ist. Der Dialog hat keinen Titel, " +
          "beginnt mit 'Installing will reset' und hat nur den einen Knopf 'Confirm'.",
      }),
      dismissDialogStep("You wake up in your home...you feel different...", "Abschlussdialog wegklicken"),
      checkStep(
        "Die Seite ist jetzt das Terminal, und der rote Zaehler am Sidebar-Eintrag 'Augmentations' ist weg",
        "Erfolg belegen",
      ),
      {
        art: "hinweis",
        text:
          "NACH dem Install laufen keine Skripte mehr (prestigeWorkerScripts killt alles). " +
          "Die RFA-Bruecke muss die Skripte neu ausspielen und den Autopiloten neu starten, " +
          "sonst steht das Spiel still. Skripte auf 'home' bleiben als Dateien erhalten, sie laufen nur nicht.",
        zweck: "Den Automaten wieder in Gang bringen",
      },
    ],
    erfolg:
      "Dialog 'You slowly drift to sleep ... You wake up in your home...you feel different...', " +
      "danach steht die Seite auf Terminal, der Sidebar-Zaehler ist weg, und auf der " +
      "Augmentations-Seite stehen die Augs unter 'Installed Augmentations'.",
    fehlschlaege: [
      {
        lage: "nichts gekauft",
        zeichen: "Der Knopf 'Install Augmentations' ist disabled",
        mittel: "Erst buyAugmentation() abarbeiten.",
      },
      {
        lage: "Skripte laufen danach nicht wieder an",
        zeichen: "'Active Scripts' ist leer, Telemetrie bleibt stehen",
        mittel: "Ueber die Bruecke die Skripte neu ausspielen und den Autopiloten starten.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 6 — Reisen
// ---------------------------------------------------------------------------

export function travelTo({ city }) {
  assertOneOf(city, CITIES, "city");

  return {
    aufgabe: "travelTo",
    titel: `Nach ${city} reisen`,
    voraussetzungen: [
      `Mindestens $${TRAVEL_COST.toLocaleString("en-US")} auf dem Konto. ` +
        "ACHTUNG: Bei zu wenig Geld ist der Knopf NICHT disabled und es gibt KEINE Meldung — " +
        "der Klick verpufft still. Kontostand vorher pruefen.",
      `Man ist nicht schon in ${city} (die eigene Stadt fehlt in der Auswahl).`,
    ],
    schritte: [
      navStep("Travel", "Reisebuero oeffnen"),
      checkStep('Ueberschrift "Travel Agency"', "Auf der richtigen Seite?"),
      checkStep(
        `Der Satz "From <aktuelle Stadt>, you can travel to any other city! A ticket costs $200.000k." ` +
          "zeigt den Betrag NICHT ausgegraut",
        "Geld pruefen, bevor der Klick still verpufft",
        "Ausgegraut heisst: nicht bezahlbar. Dann bricht der Klick kommentarlos ab.",
      ),
      {
        art: "klick",
        suche: `Travel to ${city}`,
        treffer: "genau",
        trusted: false,
        zweck: `Reiseziel ${city} waehlen`,
        wenn:
          "Setzt 'Disable ASCII art' voraus. Ist es aus, gibt es statt Knoepfen eine ASCII-Weltkarte, " +
          `in der nur der erste Buchstabe der Stadt klickbar ist ("${city[0]}") — mit dem vollen ` +
          "Stadtnamen als Tooltip, ohne aria-label. Dann besser erst prepareUi() laufen lassen.",
      },
      clickStep("Travel", "Reise bestaetigen", {
        treffer: "genau",
        optional: true,
        wenn:
          "Nur wenn 'Suppress travel confirmations' aus ist. Der Dialog zeigt " +
          `"Would you like to travel to ${city}? The trip will cost $200.000k." ` +
          'und hat die Knoepfe "Travel" und "Cancel".',
      }),
      dismissDialogStep(`You are now in ${city}!`, "Erfolgsdialog wegklicken"),
      checkStep(
        `Die Seite ist City, und ganz oben steht die Zeile "${city}"`,
        "Erfolg belegen — dieser Marker gilt unabhaengig von den Suppress-Einstellungen",
      ),
    ],
    erfolg:
      `Dialog "You are now in ${city}!" (falls nicht unterdrueckt), danach die City-Seite mit "${city}" ` +
      "als erster Zeile. Gegenprobe: auf der Reiseseite beginnt der Satz jetzt mit " +
      `"From ${city},".`,
    fehlschlaege: [
      {
        lage: "zu wenig Geld",
        zeichen:
          "Nichts passiert. Kein Dialog, keine Meldung, der Knopf ist nicht disabled. " +
          "Einziges Zeichen: der Betrag im Einleitungssatz ist ausgegraut.",
        mittel:
          "Das ist der gefaehrlichste Fehlschlag in dieser Sammlung, weil er wie Erfolg aussieht. " +
          "Immer den Stadtnamen auf der City-Seite gegenpruefen.",
      },
      {
        lage: "ASCII-Weltkarte statt Knoepfen",
        zeichen: "Kein Knopf 'Travel to ...' zu finden, stattdessen ein Buchstabenbild",
        mittel: "prepareUi() laufen lassen, das schaltet 'Disable ASCII art' ein.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 7 — Verbrechen
// ---------------------------------------------------------------------------

/**
 * Verbrechen wiederholen sich von selbst, endlos, bis man abbricht
 * (CrimeWork.ts:35-50). Einmal starten reicht also.
 */
export function commitCrime({ crime = "Homicide" } = {}) {
  const entry = CRIMES.find((c) => c.button.toLowerCase() === String(crime).toLowerCase());
  if (!entry) {
    throw new Error(
      `Unbekanntes Verbrechen: ${JSON.stringify(crime)}. Erlaubt: ${CRIMES.map((c) => c.button).join(", ")}`,
    );
  }

  return {
    aufgabe: "commitCrime",
    titel: `Verbrechen begehen: ${entry.button}`,
    voraussetzungen: [
      "Keine. Es gibt kein Stat-Minimum, kein Verbrechen ist gesperrt, auch nicht bei 0.00 % Erfolgschance.",
      "'The Slums' gibt es in allen sechs Staedten — reisen ist nicht noetig.",
    ],
    schritte: [
      ...openLocationSteps("The Slums", "Slums oeffnen"),
      {
        art: "klick",
        suche: entry.button,
        treffer: "praefix",
        trusted: true,
        zweck: `${entry.button} beginnen`,
        wenn:
          `Der volle Knopftext lautet "${entry.button} (XX.XX% chance of success)" — nur auf den ` +
          "Praefix pruefen. Achtung bei Praefix-Ueberschneidungen: es gibt kein Paar, bei dem ein " +
          "Name Praefix eines anderen ist, aber die Chance-Angabe darf beim Vergleich nicht stoeren.",
      },
      checkStep(
        `Work-Seite mit der Ueberschrift "You are attempting ${entry.working}"`,
        "Bestaetigen, dass das Verbrechen laeuft",
        "Bleibt die Slums-Seite stehen, war der Klick kein echter Eingabe-Event " +
          "(SlumsLocation.tsx:25 prueft event.isTrusted).",
      ),
      {
        art: "hinweis",
        text:
          "Das Verbrechen wiederholt sich endlos von selbst. Es gibt kein Setting dafuer. " +
          "Beenden mit stopWork({ kind: 'crime' }) — Knopf 'Stop committing crime'. " +
          "Solange es laeuft, wirken die Sidebar-Hotkeys nicht.",
        zweck: "Dauerlauf einplanen",
      },
    ],
    erfolg:
      `Work-Seite mit "You are attempting ${entry.working}", darunter "Success chance: XX.XX%", ` +
      '"Gains (on success)" und ein Fortschrittsbalken mit "XX.XX% done".',
    fehlschlaege: [
      {
        lage: "Klick war kein echter Eingabe-Event",
        zeichen: "Nichts passiert, die Slums-Seite bleibt stehen",
        mittel: "Mit echten Browser-Eingaben klicken. SlumsLocation.tsx:25 prueft event.isTrusted.",
      },
      {
        lage: "einzelner Durchgang misslungen",
        zeichen: "Nichts Sichtbares — kein Toast, kein Dialog",
        mittel:
          "Kein Handlungsbedarf. Bei Fehlschlag gibt es kein Geld, die Exp werden geviertelt, " +
          "und der naechste Durchgang beginnt sofort.",
      },
      {
        lage: "'The Slums' nicht anklickbar",
        zeichen: "Auf der City-Seite steht nur ein Buchstabenbild",
        mittel:
          "Entweder prepareUi() laufen lassen, oder das Element ueber aria-label=\"The Slums\" ansprechen " +
          "(City.tsx:61).",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Aufgabe 8 — Backdoor
// ---------------------------------------------------------------------------

/**
 * Backdoor laeuft ueber das Terminal.
 *
 * @param {string[]} route Die Kette der Hostnamen von home bis zum Ziel,
 *   OHNE "home" am Anfang. `connect` akzeptiert nur direkte Nachbarn oder
 *   bereits mit Backdoor versehene Server (connect.ts:23-46) — die Route muss
 *   also stimmen. Sie berechnet man am besten im Spiel per Breitensuche ueber
 *   ns.scan() und reicht sie ueber die Bruecke heraus.
 * @param {boolean} [chained] Alles in einer Terminalzeile mit ';' statt
 *   einzeln. Kuerzer, aber die Zwischenschritte sind nicht einzeln pruefbar.
 */
export function installBackdoor({ route, chained = false }) {
  if (!Array.isArray(route) || route.length === 0) {
    throw new Error(
      "installBackdoor braucht { route: ['nachbar1', ..., 'ziel'] } — die Kette ab home, ohne 'home' selbst.",
    );
  }
  const target = route[route.length - 1];

  const schritte = [navStep("Terminal", "Terminal oeffnen")];

  if (chained) {
    schritte.push(
      terminalStep(
        ["home", ...route.map((h) => `connect ${h}`)].join("; "),
        `In einem Rutsch bis ${target} verbinden`,
        `Connected to ${target}`,
      ),
    );
  } else {
    schritte.push(terminalStep("home", "Von home aus starten, damit die Kette definiert beginnt", "Connected to home"));
    for (const host of route) {
      schritte.push(terminalStep(`connect ${host}`, `Weiter zu ${host}`, `Connected to ${host}`));
    }
  }

  schritte.push(
    terminalStep(
      "analyze",
      "Vorbedingungen pruefen: Root-Rechte und noetiges Hacking-Level",
      "Root Access: YES, sowie 'Backdoor: NO' und 'Required hacking skill for hack() and backdoor: N'",
    ),
    terminalStep("backdoor", `Backdoor auf ${target} setzen`, null),
    {
      art: "warte",
      bis:
        "Das Eingabefeld #terminal-input ist wieder aktiv (nicht mehr disabled) und der " +
        "Fortschrittsbalken unter dem Terminal ist verschwunden.",
      maxSekunden: 1800,
      zweck:
        "Die Dauer betraegt ein Viertel der Hackdauer (Terminal.ts:243) und haengt an Serverwerten " +
        "und Spielerlevel — deshalb keine feste Wartezeit, sondern auf den Zustand pruefen.",
    },
    checkStep(`Zeile "Backdoor on '${target}' successful!" in der Terminalausgabe`, "Erfolg belegen"),
    terminalStep("analyze", "Gegenprobe", "Backdoor: YES"),
  );

  return {
    aufgabe: "installBackdoor",
    titel: `Backdoor auf ${target} setzen`,
    voraussetzungen: [
      `Root-Rechte auf ${target} (vorher per Skript nuke()) — sonst: "You do not have admin rights for this machine!"`,
      `Hacking-Level >= requiredHackingSkill von ${target}`,
      "Die Route stimmt: jeder Sprung muss ein direkter Nachbar sein oder ein Server mit Backdoor.",
      `${target} ist kein eigener Server und nicht 'home'.`,
    ],
    schritte,
    erfolg:
      `Terminalzeile "Backdoor on '${target}' successful!", und 'analyze' zeigt danach "Backdoor: YES".`,
    fehlschlaege: [
      {
        lage: "Route falsch",
        zeichen:
          "Cannot directly connect to <host>. Make sure the server is backdoored or adjacent to your current server",
        mittel:
          "Route neu berechnen. Im Terminal hilft 'scan' (Nachbarn) und 'scan-analyze <tiefe>'; " +
          "die Tiefe ist ohne Programme auf 3 begrenzt, mit DeepscanV1.exe auf 5, mit DeepscanV2.exe auf 10.",
      },
      {
        lage: "Hostname existiert nicht",
        zeichen: "Invalid hostname: '<host>'",
        mittel: "Schreibweise pruefen. Hostnamen sind gross-/kleinschreibungsempfindlich, z. B. 'CSEC', 'I.I.I.I'.",
      },
      {
        lage: "keine Root-Rechte",
        zeichen: "You do not have admin rights for this machine!",
        mittel: "Erst per Skript Ports oeffnen und nuke() ausfuehren.",
      },
      {
        lage: "Hacking-Level zu klein",
        zeichen:
          "Your hacking skill is not high enough to install a backdoor on this machine. " +
          "Try analyzing the machine to determine the required hacking skill.",
        mittel: "Weiter hacken, spaeter erneut versuchen. 'analyze' nennt den noetigen Wert.",
      },
      {
        lage: "schon vorhanden",
        zeichen:
          'Gelbe Warnung: You have already installed a backdoor on this server. You can check the "Backdoor" ' +
          'status via the "analyze" command.',
        mittel: "Kein Fehler. Die Aktion laeuft trotzdem los; man kann sie einfach durchlaufen lassen.",
      },
      {
        lage: "Ziel ist w0r1d_d43m0n",
        zeichen: "Die Seite springt auf BitVerse",
        mittel:
          "Das beendet den BitNode. Nur absichtlich ausloesen — nicht als Nebenwirkung eines " +
          "automatischen Backdoor-Durchlaufs.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Katalog und Ausgabe
// ---------------------------------------------------------------------------

/** Alle Aufgaben unter ihrem Namen, fuer den CLI-Aufruf und zum Nachschlagen. */
export const TASKS = {
  prepareUi,
  buyTorRouter,
  buyPrograms,
  upgradeHomeRam,
  upgradeHomeCores,
  joinFaction,
  workForFaction,
  stopWork,
  buyAugmentation,
  installAugmentations,
  travelTo,
  commitCrime,
  installBackdoor,
};

/** Einen Plan als lesbaren Text ausgeben. */
export function renderPlan(plan) {
  const out = [];
  out.push(`# ${plan.titel}   [${plan.aufgabe}]`);
  out.push("");
  out.push("Voraussetzungen:");
  for (const v of plan.voraussetzungen) out.push(`  - ${v}`);
  out.push("");
  out.push("Schritte:");
  plan.schritte.forEach((s, i) => {
    const n = String(i + 1).padStart(2, " ");
    let head;
    switch (s.art) {
      case "nav":
        head = `NAV      -> ${s.ziel}` + (s.hotkey ? `  (${s.hotkey})` : "") + `  [Sidebar: ${s.gruppe} / ${s.suche}]`;
        break;
      case "klick":
        head = `KLICK    "${s.suche}"  (${s.treffer}${s.trusted ? ", ECHTER EINGABE-EVENT NOETIG" : ""})`;
        break;
      case "tippen":
        head = `TIPPEN   "${s.text}"  in das Feld "${s.suche}"`;
        break;
      case "taste":
        head = `TASTE    ${s.taste}`;
        break;
      case "terminal":
        head = `TERMINAL ${s.befehl}`;
        break;
      case "pruefe":
        head = `PRUEFE   ${s.erwartet}`;
        break;
      case "warte":
        head = `WARTE    bis: ${s.bis}  (max ${s.maxSekunden}s)`;
        break;
      case "hinweis":
        head = `HINWEIS  ${s.text}`;
        break;
      default:
        head = `?? ${JSON.stringify(s)}`;
    }
    out.push(`${n}. ${head}`);
    if (s.zweck) out.push(`      Zweck: ${s.zweck}`);
    if (s.optional) out.push("      (optional)");
    if (s.wenn) out.push(`      Bedingung: ${s.wenn}`);
    if (s.art === "terminal" && s.erwartet) out.push(`      Erwartet: ${s.erwartet}`);
    if (s.art === "pruefe" && s.fehlt) out.push(`      Wenn nicht: ${s.fehlt}`);
    if (s.aria) out.push(`      Ersatzanker: aria-label="${s.aria}"`);
  });
  out.push("");
  out.push(`Erfolg: ${plan.erfolg}`);
  if (plan.fehlschlaege?.length) {
    out.push("");
    out.push("Fehlschlaege:");
    for (const f of plan.fehlschlaege) {
      out.push(`  - ${f.lage}`);
      out.push(`      Zeichen: ${f.zeichen}`);
      out.push(`      Mittel:  ${f.mittel}`);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Kommandozeile
// ---------------------------------------------------------------------------

/**
 * Die Positionsargumente je Aufgabe, damit der CLI-Aufruf kurz bleibt.
 * Alles andere geht ueber die Bibliotheksfunktion.
 */
const CLI_ARGS = {
  prepareUi: [],
  buyTorRouter: ["city"],
  buyPrograms: ["programs"], // kommagetrennt
  upgradeHomeRam: ["count", "city"],
  upgradeHomeCores: ["count", "city"],
  joinFaction: ["faction"],
  workForFaction: ["faction", "workType"],
  stopWork: ["kind"],
  buyAugmentation: ["faction", "augmentation"],
  installAugmentations: [],
  travelTo: ["city"],
  commitCrime: ["crime"],
  installBackdoor: ["route"], // kommagetrennt
};

function buildArgs(taskName, positional) {
  const names = CLI_ARGS[taskName] ?? [];
  const params = {};
  names.forEach((name, i) => {
    const raw = positional[i];
    if (raw === undefined) return;
    if (name === "programs" || name === "route") params[name] = raw.split(",").map((s) => s.trim());
    else if (name === "count") params[name] = Number(raw);
    else params[name] = raw;
  });
  return params;
}

function main(argv) {
  const asJson = argv.includes("--json");
  const rest = argv.filter((a) => a !== "--json");
  const taskName = rest[0];

  if (!taskName || !TASKS[taskName]) {
    console.log("Oberflaechen-Fahrplaene fuer Bitburner. Aufgaben:\n");
    for (const name of Object.keys(TASKS)) {
      const args = (CLI_ARGS[name] ?? []).map((a) => `<${a}>`).join(" ");
      console.log(`  node tools/ui.js ${name} ${args}`.trimEnd());
    }
    console.log("\n  --json  gibt den Plan als JSON aus statt als Text");
    console.log("\nBeispiele:");
    console.log("  node tools/ui.js travelTo Aevum");
    console.log("  node tools/ui.js buyPrograms BruteSSH.exe,FTPCrack.exe");
    console.log("  node tools/ui.js installBackdoor n00dles,CSEC --json");
    console.log("\nDie Begruendung zu jedem Schritt steht in doku/oberflaeche.md");
    return;
  }

  let plan;
  try {
    plan = TASKS[taskName](buildArgs(taskName, rest.slice(1)));
  } catch (error) {
    console.error("Fehler: " + error.message);
    process.exitCode = 1;
    return;
  }

  console.log(asJson ? JSON.stringify(plan, null, 2) : renderPlan(plan));
}

// Nur ausfuehren, wenn die Datei direkt gestartet wurde, nicht beim Import.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/ui.js")) {
  main(process.argv.slice(2));
}
