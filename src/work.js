/**
 * Faktionsarbeit aufnehmen - ohne Fokus, weil der uns nichts mehr kostet.
 *
 * WARUM OHNE FOKUS (Stand 20.08.2026)
 *
 * Die Rep-Rate wird mit `focusPenalty()` multipliziert, und die Funktion sieht
 * so aus (PlayerObjectGeneralMethods.ts:622-628):
 *
 *     if (!this.hasAugmentation(NeuroreceptorManager, true)) {
 *       focus = this.focus ? 1 : CONSTANTS.BaseFocusBonus;
 *     }
 *
 * Das Neuroreceptor Management Implant ist seit dem zweiten Reset installiert.
 * Damit faellt die Abfrage ganz aus und `focusPenalty()` gibt konstant 1
 * zurueck - fokussiert wie unfokussiert. Der Fokus ist fuer die Reputation
 * seither ohne jede Wirkung.
 *
 * Und dann hat er nur noch Nachteile: `Page.Work` blendet die Seitenleiste
 * aus (ui/GameRoot.tsx:328-330), und jedes Oberflaechenskript muss den Zustand
 * erst wegraeumen, bevor es navigieren kann. Zwei davon gleichzeitig reissen
 * einander die Seite weg. Unfokussierte Arbeit laeuft mit derselben Rate und
 * laesst die Oberflache bedienbar.
 *
 * ACHTUNG BEIM NAECHSTEN RESET: Faellt das Implant weg, kostet unfokussierte
 * Arbeit sofort wieder 20 % (Constants.ts:87 BaseFocusBonus = 0.8). Es gehoert
 * deshalb zu den Pflichtkaeufen in doku/reset-plan.md. Bis es wieder steht:
 * work.js mit --focus aufrufen.
 *
 * Aufruf:  node tools/task.js work.js "Tian Di Hui"
 *          node tools/task.js work.js "Tian Di Hui" --focus
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const argumente = ns.args.map(String);
  // Ob fokussiert wird, entscheidet weiter unten der Befund am Implant - nicht
  // eine Annahme hier oben. Diese beiden Schalter uebersteuern ihn nur.
  const erzwingeFokus = argumente.includes("--focus");
  const erzwingeOhne = argumente.includes("--unfocus");
  const faktion = argumente.filter((a) => !a.startsWith("--")).join(" ").trim();
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/work.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/work.txt", "home", ns.getHostname());
  };
  if (!faktion) return sag("Kein Faktionsname angegeben.");

  // Doppelstartschutz. Der erste Schritt dieser Datei ist "laufende Arbeit
  // entfokussieren" - eine zweite Instanz reisst also genau das wieder ein,
  // was die erste gerade gesetzt hat. Am 20.08. hing eine Instanz auf bot-10
  // fest und hat den Fokus stundenlang im Minutentakt abgeschaltet, waehrend
  // jeder neue Versuch brav "laeuft mit Fokus" meldete. Beide Meldungen
  // stimmten, sie lagen nur Sekunden auseinander.
  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (gesehen.has(nachbar)) continue;
      gesehen.add(nachbar);
      schlange.push(nachbar);
    }
  }
  for (const host of gesehen) {
    for (const proc of ns.ps(host)) {
      if (proc.filename !== ns.getScriptName()) continue;
      if (host === ns.getHostname() && proc.pid === ns.pid) continue;
      return sag("Laeuft bereits auf " + host + " (PID " + proc.pid + ") - dieser Start beendet sich.");
    }
  }

  const knoepfe = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || "").trim();

  // Steht schon fokussierte Arbeit? Dann ist die Seitenleiste weg und nichts
  // laesst sich anklicken - erst aufloesen, dann neu aufsetzen.
  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) {
    raus.click();
    await ns.sleep(1000);
    sag("Laufende Arbeit entfokussiert, um an die Oberflaeche zu kommen.");
  }

  // --- Hat der Fokus ueberhaupt noch eine Wirkung? --------------------------
  //
  // Nur mit dem Neuroreceptor Management Implant ist er wirkungslos
  // (PlayerObjectGeneralMethods.ts:622-628). Ohne es kostet unfokussierte
  // Arbeit 20 % Reputation, und zwar lautlos.
  //
  // Diese Frage MUSS bei jedem Lauf frisch beantwortet werden. Ein Reset kann
  // das Implant jederzeit wegnehmen, und keine gemerkte Antwort ueberlebt das
  // zuverlaessig: Dateien auf home ueberstehen prestigeAugmentation, eine
  // veraltete Notiz wuerde also genau dann falsch liegen, wenn es teuer wird.
  //
  // Ein Skript kann die installierten Augmentierungen nicht abfragen -
  // ns.getPlayer() setzt sein Objekt in NetscriptFunctions.ts Feld fuer Feld
  // zusammen und laesst sie aus (mults, factions, skills, exp, jobs, entropy
  // sind da, augmentations nicht). Der einzige Weg fuehrt ueber die
  // Oberflaeche: Alt+A oeffnet die Augmentierungsseite
  // (KeyBindingUtils.ts:128-134).
  //
  // Die Fehlerrichtung ist mit Absicht so gewaehlt: Im Zweifel wird
  // FOKUSSIERT. Ein ueberfluessiger Fokus kostet nur Bequemlichkeit an der
  // Oberflaeche, ein faelschlich weggelassener kostet ein Fuenftel jeder
  // Arbeitsstunde - und man sieht es nirgends.
  let nrmDa = false;
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true, bubbles: true }));
  await ns.sleep(1300);
  const seite = (doc.body.innerText || "");
  const marke = seite.indexOf("Installed Augmentations");
  // Ausschliesslich der Abschnitt UNTER dieser Ueberschrift zaehlt
  // (InstalledAugmentations.tsx:60). Darueber steht "Purchased Augmentations"
  // (AugmentationsRoot.tsx:114) - die Warteschlange. Was dort liegt, ist
  // bezahlt, aber noch nicht wirksam; es wirkt erst nach dem Install. Wer
  // einfach die ganze Seite durchsucht, verwechselt beides.
  nrmDa = marke >= 0 && seite.slice(marke).includes("Neuroreceptor Management Implant");

  const wantFocus = erzwingeOhne ? false : (erzwingeFokus || !nrmDa);
  sag(nrmDa
    ? "Neuroreceptor-Implant installiert - der Fokus ist wirkungslos."
    : (marke >= 0
      ? "KEIN Neuroreceptor-Implant - ohne Fokus kostet die Arbeit 20 %."
      : "Augmentierungsseite nicht lesbar - im Zweifel wird fokussiert."));

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
  await ns.sleep(1400);

  // Schlichter Textvergleich statt eines gebauten regulaeren Ausdrucks:
  // Faktionsnamen sind feste Zeichenketten, und ein Ausdruck, der den Namen
  // erst maskieren muss, ist nur eine zusaetzliche Fehlerquelle.
  const details = knoepfe()
    .filter((b) => text(b) === "Details")
    .find((b) => (((b.parentElement || {}).parentElement || {}).innerText || "").includes(faktion));
  if (!details) return sag("Faktion \"" + faktion + "\" nicht auf der Seite gefunden.");
  details.click();
  await ns.sleep(1400);

  const hc = knoepfe().find((b) => text(b) === "Hacking Contracts" && !b.disabled);
  if (!hc) return sag("Kein Hacking-Contracts-Knopf - falsche Seite oder Faktion bietet ihn nicht.");
  hc.click();
  await ns.sleep(1600);

  if (!wantFocus) {
    const weg = knoepfe().find((b) => text(b) === "Do something else simultaneously");
    if (weg) weg.click();
    await ns.sleep(600);
  }

  // NICHT ueber ns.getPlayer() pruefen. Das Objekt enthaelt weder
  // `currentWork` noch `focus` - es wird in NetscriptFunctions.ts:1371-1389
  // Feld fuer Feld von Hand zusammengesetzt, und diese beiden sind nicht
  // dabei. Die erste Fassung dieser Datei meldete deshalb "Arbeit: KEINE",
  // waehrend im Spielstand laengst "Tian Di Hui, focus: true" stand.
  //
  // Der zweite Anlauf war ebenfalls falsch: Er las den Knopf "Do something
  // else simultaneously" als Fokus-Beweis. Den gibt es aber auch bei
  // UNfokussierter Arbeit, sobald die Arbeitsseite offen steht - er meldete
  // also stundenlang Vollzug, waehrend der Spielstand `focus: false` sagte.
  //
  // Der ehrliche Indikator ist der Gegenknopf: "Focus" im Uebersichtsfenster
  // wird ausschliesslich gerendert, wenn Arbeit laeuft UND der Fokus aus ist
  // (ui/React/CharacterOverview.tsx:293 kehrt sonst leer zurueck). Er ist
  // damit Anzeige und Reparatur in einem - sein blosses Dasein ist der
  // Fehlerbefund, und ein Klick darauf ruft `Player.startFocusing()`
  // (CharacterOverview.tsx:248-251).
  //
  // Das ist auch der einzige Weg zurueck: Es gibt im ganzen Spiel keinen
  // Pfad, der den Fokus im laufenden Betrieb von selbst wieder anschaltet.
  // Wer ihn einmal verliert, arbeitet bis zum naechsten Klick mit 80 %.
  // Ohne --focus hier NICHT weitermachen. Die Schleife unten klickt den
  // Focus-Knopf, und genau der macht das Entfokussieren von eben rueckgaengig:
  // Das Skript hat sich selbst widersprochen und am Ende immer fokussiert
  // dagestanden - auch wenn der Aufrufer ausdruecklich das Gegenteil wollte.
  // Aufgefallen ist es, als buyaugs.js danach meldete, es koenne die
  // Augmentierungsseite wegen fokussierter Arbeit nicht erreichen.
  if (!wantFocus) {
    // Zurueck aufs Terminal. Die Arbeitsseite bleibt sonst offen stehen und
    // meldet "You are currently carrying out hacking contracts for ..." - was
    // wie fokussierte Arbeit aussieht, obwohl der Fokus laengst aus ist. Es
    // gibt keinen Grund, die Oberflaeche dort zu parken: Faktionsarbeit laeuft
    // unfokussiert weiter, egal welche Seite offen ist (genau das bedeutet
    // "Do something else simultaneously"). Eine Navigation ruft zwar
    // stopFocusing() (GameRoot.tsx:271-272) - das ist hier gerade erwuenscht.
    // Erst warten, bis die Arbeitsseite tatsaechlich weg ist - DANN navigieren.
    //
    // Alt+T haengt am Tastaturhandler der Seitenleiste (SidebarRoot.tsx:303),
    // und die wird auf Page.Work gar nicht gerendert (GameRoot.tsx:325-330).
    // Solange die Arbeitsseite steht, ist die Taste also wirkungslos. Die alte
    // Fassung wartete pauschal 400 ms nach dem Klick und feuerte dann - ohne
    // je zu pruefen, ob sie ankam.
    //
    // Das hat in der Nacht zum 21.08. drei Kauflaeufe hintereinander gekostet:
    // Die Arbeitsseite blieb stehen, und buyaugs.js fand deshalb weder
    // Seitenleiste noch Augmentierungsseite. Der Fehler war nicht dort, wo er
    // gemeldet wurde.
    const arbeitsseiteOffen = () =>
      knoepfe().some((b) => text(b) === "Do something else simultaneously");
    for (let i = 0; i < 8 && arbeitsseiteOffen(); i++) await ns.sleep(400);

    doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
    await ns.sleep(500);
    const nochDrauf = arbeitsseiteOffen();
    return sag("Arbeit fuer " + faktion + " laeuft ohne Fokus - volle Rate dank"
      + " Neuroreceptor-Implant."
      + (nochDrauf
        ? "  ACHTUNG: Die Arbeitsseite steht noch - der naechste Kauflauf wird"
          + " daran scheitern."
        : "  Oberflaeche zurueck aufs Terminal."));
  }

  for (let i = 0; i < 3; i++) {
    await ns.sleep(900);
    const fokusKnopf = knoepfe().find((b) => text(b) === "Focus");
    if (!fokusKnopf) break;
    fokusKnopf.click();
  }
  await ns.sleep(900);
  const nochOffen = knoepfe().some((b) => text(b) === "Focus");
  sag(nochOffen
    ? "Arbeit fuer " + faktion + " laeuft, aber der Fokus liess sich NICHT setzen (Faktor 0,8)."
    : "Arbeit fuer " + faktion + " laeuft mit Fokus (Faktor 1,0 statt 0,8).");
}
