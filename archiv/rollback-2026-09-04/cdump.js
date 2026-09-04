/**
 * Vertraege auslesen - die schlanke Haelfte.
 *
 * WARUM GETRENNT VON contracts.js
 *
 * contracts.js loest im Spiel und braucht dafuer 17,65 GB (getContract allein
 * kostet 15). Nach einem BitNode-Wechsel hat home 32 GB, davon belegt bn4net
 * 16,25 - es bleiben 15,75, und das reicht nicht. Ausgerechnet in der Phase,
 * in der Vertraege die mit Abstand schnellste Geldquelle sind: Das Netz haengt
 * dann an sechs Servern ohne Portbedarf, und ohne Geld gibt es weder TOR noch
 * Portprogramme noch Mietrechner.
 *
 * Deshalb hier nur das Auslesen: getContractType und getData kosten je 5 GB,
 * zusammen also 10 statt der 15 von getContract. Geloest wird ausserhalb, die
 * Antwort kommt ueber data/cantwort.json zurueck und wird von csolve.js
 * eingereicht (attempt, 10 GB). Beide Haelften passen einzeln auf ein frisches
 * home, zusammen wuerden sie es nicht.
 *
 * Aufruf: node tools/task.js cdump.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const gesehen = new Set(["home"]);
  const rand = ["home"];
  while (rand.length) {
    const h = rand.pop();
    for (const n of ns.scan(h)) if (!gesehen.has(n)) { gesehen.add(n); rand.push(n); }
  }
  const raus = [];
  for (const host of gesehen) {
    for (const datei of ns.ls(host, ".cct")) {
      let typ = "?", daten = null;
      try { typ = ns.codingcontract.getContractType(datei, host); } catch (e) { typ = String(e); }
      try { daten = ns.codingcontract.getData(datei, host); } catch (e) { daten = String(e); }
      raus.push({ host, datei, typ, daten });
    }
  }
  ns.write("data/cdump.json", JSON.stringify(raus), "w");
  ns.tprint("Vertraege ausgelesen: " + raus.length);
}
