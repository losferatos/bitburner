/**
 * Backdoor auf einem Faktionsserver setzen - als einmaliger Auftrag.
 *
 * Warum eigenstaendig und nicht ueber die Hand: `src/hand.js` ist ein
 * Dauerlaeufer mit Herzschlag, Selbsterneuerung und einer Befehlsdatei, die
 * per `ns.scp` von home geholt wird - und genau dieses scp meldet Erfolg,
 * ohne zu kopieren. Am 20.08. stand deshalb auf home der neue Befehl und bei
 * ihr der zehn Minuten alte. Ein Backdoor ist ein einmaliger Vorgang; er
 * braucht keinen Dauerlaeufer, sondern einen Auftrag mit Anfang und Ende.
 *
 * Der Weg kommt aus der Telemetrie des Autopiloten (`factionPaths`), die ihn
 * jede Runde neu aus dem laufenden Netz berechnet. Das ist Pflicht und keine
 * Bequemlichkeit: **das Netz wird bei JEDEM Reset neu verdrahtet**, ein
 * notierter Weg ist danach wertlos, und `connect` scheitert mit "Cannot
 * directly connect".
 *
 * Aufruf:  node tools/task.js backdoor.js avmnite-02h
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const ziel = String(ns.args[0] || "").trim();
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/backdoor.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/backdoor.txt", "home", ns.getHostname());
  };
  if (!ziel) return sag("Kein Zielrechner angegeben.");

  // Schon erledigt? Dann gar nicht erst anfassen.
  try {
    if (ns.getServer(ziel).backdoorInstalled) return sag(ziel + ": Backdoor liegt bereits.");
  } catch (e) {
    return sag("Rechner \"" + ziel + "\" unbekannt: " + (e && e.message ? e.message : String(e)));
  }

  // Den Weg selbst suchen statt ihn zu glauben. Breitensuche ab home liefert
  // den kuerzesten, und sie kennt das Netz von JETZT.
  const vorgaenger = new Map([["home", null]]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (vorgaenger.has(nachbar)) continue;
      vorgaenger.set(nachbar, hier);
      schlange.push(nachbar);
    }
  }
  if (!vorgaenger.has(ziel)) return sag("Kein Weg zu " + ziel + " im aktuellen Netz.");
  const kette = [];
  for (let h = ziel; h && h !== "home"; h = vorgaenger.get(h)) kette.unshift(h);

  const terminal = (befehl) => {
    const el = doc.getElementById("terminal-input");
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
    setter.call(el, befehl);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    return true;
  };

  // Fokussierte Arbeit blendet die Seitenleiste aus (ui/GameRoot.tsx:328-330)
  // und mit ihr das Terminal. Erst aufloesen, sonst geht ins Leere, was wir
  // tippen.
  const raus = [...doc.querySelectorAll("button")]
    .find((b) => (b.innerText || "").trim() === "Do something else simultaneously");
  if (raus) {
    raus.click();
    await ns.sleep(1200);
    sag("Fokussierte Arbeit aufgeloest, um ans Terminal zu kommen.");
  }
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await ns.sleep(900);
  if (!doc.getElementById("terminal-input")) return sag("Terminal nicht erreichbar - Seite blockiert.");

  sag("Weg: home -> " + kette.join(" -> "));
  if (!terminal("home")) return sag("Terminal nahm den ersten Befehl nicht an.");
  await ns.sleep(700);
  for (const hop of kette) {
    if (!terminal("connect " + hop)) return sag("Terminal nahm 'connect " + hop + "' nicht an.");
    await ns.sleep(700);
  }

  // Ab hier NICHTS mehr senden: `backdoor` ist eine Aktion mit Laufzeit, und
  // jede weitere Terminaleingabe bricht sie ab.
  terminal("backdoor");
  sag("backdoor abgesetzt - warte auf Bestaetigung im Serverzustand.");

  // Erfolg NIE am Bildschirmtext ablesen. Der Puffer enthaelt Meldungen
  // frueherer Versuche, an denen jede Textpruefung sofort anschlaegt; genau
  // daran wurde am 20.08. viel zu frueh Vollzug gemeldet.
  for (let i = 0; i < 100; i++) {
    await ns.sleep(3000);
    try {
      if (ns.getServer(ziel).backdoorInstalled) return sag("BACKDOOR BESTAETIGT auf " + ziel + ".");
    } catch (e) { /* weiter versuchen */ }
  }
  sag("Backdoor auf " + ziel + " nach 5 Minuten nicht bestaetigt.");
}
