/**
 * Einer Faktion beitreten - als einmaliger Auftrag.
 *
 * Die eigentliche Arbeit macht `join.js`, das den geschuetzten Join!-Knopf
 * bedient: `acceptInvitation` verwirft synthetische Klicks, weil es
 * `event.isTrusted` prueft (Faction/ui/FactionsRoot.tsx:89) - und dieses Feld
 * ist per DOM-Spezifikation nicht faelschbar. Der Handler selbst liegt aber
 * offen im Dokument, weil React 17 die Props eines Host-Elements als
 * gewoehnliche Eigenschaft `__reactProps$<zufall>` ablegt und MUI `onClick`
 * unveraendert an das native <button> durchreicht. Aufgerufen wird damit
 * exakt dieselbe Funktion wie beim echten Klick.
 *
 * Diese Datei ist nur die Huelle: Sie reicht das Dokument herein (deshalb
 * kostet `join.js` selbst keinen Speicher - der RAM-Rechner bucht rein
 * namensbasiert, RamCalculations.ts:185-192) und prueft den Erfolg am
 * Spielerzustand.
 *
 * Der Name muss EXAKT der Spielname sein: "Tian Di Hui", nicht "TianDiHui".
 *
 * Aufruf:  node tools/task.js joinfac.js NiteSec
 *
 * @param {NS} ns
 */
import { joinFaction } from "join.js";

export async function main(ns) {
  const doc = document;
  const faktion = ns.args.map(String).join(" ").trim();
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/joinfac.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/joinfac.txt", "home", ns.getHostname());
  };
  if (!faktion) return sag("Kein Faktionsname angegeben.");

  const mitglied = () => ns.getPlayer().factions.includes(faktion);
  if (mitglied()) return sag("Bereits Mitglied von " + faktion + ".");

  // Die Fehlgriffsperre. Ein Beitritt sperrt sofort alle Feinde der
  // getroffenen Faktion (FactionHelpers.tsx:45-47) - der teuerste denkbare
  // Fehler im Spiel, und keine Vorpruefung merkt, wenn ein Klick woanders
  // landet. Vorher-Nachher-Vergleich kostet nichts und faengt jede Variante.
  const vorher = new Set(ns.getPlayer().factions);

  const res = await joinFaction({
    doc,
    factionName: faktion,
    sleep: (ms) => ns.sleep(ms),
    isMember: mitglied,
    allowUnfocus: true,
    returnToTerminal: false,
  });

  const dazu = ns.getPlayer().factions.filter((f) => !vorher.has(f));
  const falsch = dazu.filter((f) => f !== faktion);
  if (falsch.length) sag("FEHLGRIFF: unbeabsichtigt beigetreten -> " + falsch.join(", "));

  sag(faktion + ": " + (res.ok ? "BEIGETRETEN (" + res.how + ")" : "gescheitert - " + res.reason));
  for (const z of res.log || []) sag("  " + z);
}
