/**
 * Den Reset ausloesen: Augmentations installieren.
 *
 * ============================================================================
 * WAS DABEI PASSIERT
 * ============================================================================
 *
 * Es bleiben: installierte Augmentations, home-RAM und -Kerne, alle
 * Skriptdateien, und der Favor bei Faktionen und Firmen
 * (Faction/Faction.ts:77-85 rechnet die Reputation in Favor um).
 *
 * Es geht verloren: das gesamte Guthaben bis auf 1000 Dollar plus Startgeld
 * aus Augmentations (PlayerObjectGeneralMethods.ts:102), alle gekauften
 * Server, alle Programme ausser NUKE.exe, der TOR-Router, das Hacknet, die
 * Faktionsmitgliedschaften und die gesamte Reputation - und JEDES laufende
 * Skript.
 *
 * ============================================================================
 * DIE EINE SICHERUNG, DIE ZAEHLT
 * ============================================================================
 *
 * Nach dem Install liegt der Autopilot als Datei auf home und niemand startet
 * ihn: Die Seite laedt nicht neu, es gibt also keinen Startvorgang, an den
 * sich etwas haengen koennte. Genau dieser Zustand hat in der Nacht zum
 * 20.08. fuenf Stunden Totalstillstand gekostet.
 *
 * Deshalb wird hier NICHT installiert, solange der Wiederanlauf-Waechter
 * (src/keepalive.js) nicht nachweislich im Seitenkontext steht. Das ist keine
 * Vorsicht, das ist die Bedingung: Wer ohne ihn resettet, wirft den Bot mit
 * Ansage in einen Zustand, aus dem er sich nicht selbst befreien kann.
 *
 * Aufruf:  node tools/task.js install.js --min 5
 *          node tools/task.js install.js --min 5 --dry
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const argumente = ns.args.map(String);
  const trocken = argumente.includes("--dry");
  const minIndex = argumente.indexOf("--min");
  const mindestens = minIndex >= 0 ? Number(argumente[minIndex + 1]) || 1 : 1;

  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/install.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/install.txt", "home", ns.getHostname());
  };

  const knoepfe = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || "").trim();

  // --- Sicherung 1: steht der Waechter? ------------------------------------
  const waechter = doc.defaultView && doc.defaultView.__keepalive;
  if (!waechter || !waechter.timer) {
    return sag("ABBRUCH: Der Wiederanlauf-Waechter laeuft nicht. Erst "
      + "`node tools/task.js keepalive.js`, sonst steht der Bot nach dem Reset still.");
  }
  sag("Waechter steht (Eingriffe bisher: " + (waechter.eingriffe || 0) + ").");

  // --- Sicherung 2: lohnt der Reset ueberhaupt? ----------------------------
  // Der Preisfaktor faellt beim Install auf 1 zurueck, das ist der Sinn der
  // Sache - aber jede Augmentation in der Warteschlange ist bereits bezahlt.
  // Mit zu wenigen zu resetten verschenkt genau den Grund, warum man sammelt.
  const wartend = ns.getResetInfo().ownedAugs;

  // Die Warteschlange selbst steht nur auf der Augmentationsseite - weder
  // ns.getPlayer() noch getResetInfo() geben sie her. Also erst hin.
  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1000); }
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true, bubbles: true }));
  await ns.sleep(1400);

  const installKnopf = knoepfe().find((b) => text(b) === "Install Augmentations");
  if (!installKnopf) return sag("ABBRUCH: Knopf 'Install Augmentations' nicht gefunden - falsche Seite?");
  if (installKnopf.disabled) {
    return sag("ABBRUCH: Knopf ist deaktiviert - die Warteschlange ist leer "
      + "(AugmentationsRoot.tsx:173 prueft queuedAugmentations.length === 0).");
  }

  // Zaehlen, was wirklich wartet. Der Abschnitt "Purchased Augmentations"
  // listet sie; Erfolg NIE an einer Zahl aus dem Fliesstext festmachen, aber
  // fuer eine SPERRE ist eine untere Schranke aus der Seite belastbar genug.
  const seite = (doc.body.innerText || "");
  const ab = seite.indexOf("Purchased Augmentations");
  const bis = seite.indexOf("Installed Augmentations");
  const abschnitt = ab >= 0 && bis > ab ? seite.slice(ab, bis) : "";
  const posten = (abschnitt.match(/\n/g) || []).length;
  sag("Warteschlange laut Seite: rund " + posten + " Zeilen, verlangt sind mindestens " + mindestens + ".");
  if (posten < mindestens) {
    return sag("ABBRUCH: zu wenig in der Warteschlange. Mit --min steuerbar.");
  }

  if (trocken) {
    return sag("Trockenlauf: Es wurde nichts installiert. Der Knopf waere klickbar gewesen. "
      + "Installierte Augmentations aktuell: " + wartend + ".");
  }

  // --- Ab hier gibt es kein Zurueck ----------------------------------------
  sag("INSTALLIERE. Ab jetzt sterben alle Skripte; der Waechter uebernimmt.");
  installKnopf.click();
  await ns.sleep(1200);

  // doInstall zeigt ein Bestaetigungsfenster, ausser die Einstellung
  // SuppressBuyAugmentationConfirmation ist gesetzt (AugmentationsRoot.tsx:101).
  // Beide Faelle bedienen, keinen davon voraussetzen.
  const confirm = knoepfe().find((b) => text(b) === "Confirm");
  if (confirm) {
    confirm.click();
    sag("Bestaetigt.");
  } else {
    sag("Kein Bestaetigungsfenster - Einstellung unterdrueckt es offenbar.");
  }
  await ns.sleep(3000);
  sag("Install ausgeloest. Diese Zeile steht moeglicherweise nicht mehr, "
    + "weil das Skript mitten im Satz beendet wurde - das ist der Normalfall.");
}
