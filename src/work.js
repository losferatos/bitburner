/**
 * Faktionsarbeit aufnehmen - und den Fokus dabei ANLASSEN.
 *
 * Die Rep-Rate wird mit `focusPenalty()` multipliziert: ohne Fokus 0,8, mit
 * Fokus 1,0 (PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628,
 * Constants.ts:87). Wir haben den Fokus bisher immer sofort abgeschaltet und
 * damit ein Fuenftel jeder Arbeitsstunde verschenkt.
 *
 * Der Grund dafuer stand in src/hand.js:186-188 und war richtig, solange jeder
 * Hebel ueber das Terminal lief: `Page.Work` blendet die Seitenleiste aus
 * (ui/GameRoot.tsx:328-330), damit sind die Alt-Tastenkuerzel nicht mehr
 * registriert - der Automat waere handlungsunfaehig.
 *
 * Seit der Auftragslaeufer im Autopiloten Skripte per `ns.exec` startet,
 * braucht der Weg von aussen ins Spiel aber gar keine Oberflaeche mehr. Und
 * die Skripte, die eine brauchen (travel.js, homeram.js), erkennen den Zustand
 * an dem Knopf "Do something else simultaneously" und raeumen ihn selbst weg.
 * Der Fokus ist damit kein Risiko mehr, sondern nur noch ein Viertel mehr
 * Reputation.
 *
 * Aufruf:  node tools/task.js work.js "Tian Di Hui"
 *          node tools/task.js work.js "Tian Di Hui" --unfocus
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const argumente = ns.args.map(String);
  const unfocus = argumente.includes("--unfocus");
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

  if (unfocus) {
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
  // Bei --unfocus hier NICHT weitermachen. Die Schleife unten klickt den
  // Focus-Knopf, und genau der macht das Entfokussieren von eben rueckgaengig:
  // Das Skript hat sich selbst widersprochen und am Ende immer fokussiert
  // dagestanden - auch wenn der Aufrufer ausdruecklich das Gegenteil wollte.
  // Aufgefallen ist es, als buyaugs.js danach meldete, es koenne die
  // Augmentierungsseite wegen fokussierter Arbeit nicht erreichen.
  if (unfocus) {
    return sag("Arbeit fuer " + faktion + " laeuft OHNE Fokus (Faktor 0,8) - wie verlangt.");
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
