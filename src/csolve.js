/**
 * Vertragsantworten einreichen - die zweite schlanke Haelfte zu cdump.js.
 *
 * Braucht nur `attempt` (10 GB) statt `getContract` (15 GB) und passt damit
 * zusammen mit dem Grundpreis auf ein frisches home. Geloest wird ausserhalb;
 * die Antworten stehen in data/cantwort.json als
 *   [{host, datei, antwort}, ...]
 *
 * Ein Versuch ist unwiederbringlich - deshalb wird hier NICHTS geraten. Was
 * nicht in der Datei steht, wird nicht angefasst.
 *
 * Aufruf: node tools/task.js csolve.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  // Der Auftragslaeufer legt das Skript dorthin, wo Platz ist - das ist selten
  // home. ns.read liest aber immer LOKAL, und die Antwortdatei kommt von
  // aussen ueber die Bruecke, also auf home an. Deshalb zuerst holen.
  if (ns.getHostname() !== "home") {
    ns.scp("data/cantwort.json", ns.getHostname(), "home");
  }
  const roh = ns.read("data/cantwort.json");
  if (!roh) { ns.tprint("csolve: data/cantwort.json fehlt oder ist leer."); return; }
  const liste = JSON.parse(roh);
  const log = [];
  for (const a of liste) {
    let ergebnis;
    try {
      ergebnis = ns.codingcontract.attempt(a.antwort, a.datei, a.host);
    } catch (e) {
      ergebnis = "FEHLER " + String(e);
    }
    // attempt gibt bei Erfolg den Belohnungstext, bei Misserfolg "".
    log.push(a.host + " " + a.datei + " -> " + (ergebnis || "FEHLSCHLAG"));
  }
  ns.write("data/csolve.txt", log.join("\n") + "\n", "w");
  if (ns.getHostname() !== "home") ns.scp("data/csolve.txt", "home", ns.getHostname());
  ns.tprint(log.join(" | "));
}
