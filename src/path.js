/**
 * Findet den Weg von home zu einem beliebigen Rechner im Netz.
 *
 * Das Terminal laesst `connect` nur zu direkten Nachbarn zu, und
 * `scan-analyze` reicht ohne DeepscanV2.exe nur drei Ebenen tief. Fuer jeden
 * Faktionsserver (avmnite-02h, I.I.I.I, run4theh111z, .//) brauchen wir aber
 * die vollstaendige Kette, um dort einen Backdoor zu setzen.
 *
 * Gibt die Kette als EINE Terminalzeile aus - Bitburner trennt mehrere
 * Befehle mit Semikolon, die Zeile laesst sich also direkt absetzen.
 *
 * Aufruf:  run path.js avmnite-02h
 *          run path.js avmnite-02h backdoor
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const ziel = ns.args[0];
  if (!ziel) {
    ns.tprint("FEHLER: kein Ziel angegeben. Beispiel: run path.js avmnite-02h");
    return;
  }
  const mitBackdoor = ns.args[1] === "backdoor";

  // Breitensuche ab home. Der erste gefundene Weg ist zugleich der kuerzeste.
  const vorgaenger = new Map([["home", null]]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    if (hier === ziel) break;
    for (const nachbar of ns.scan(hier)) {
      if (vorgaenger.has(nachbar)) continue;
      vorgaenger.set(nachbar, hier);
      schlange.push(nachbar);
    }
  }

  if (!vorgaenger.has(ziel)) {
    ns.tprint("FEHLER: " + ziel + " ist von home aus nicht erreichbar.");
    return;
  }

  const kette = [];
  for (let h = ziel; h && h !== "home"; h = vorgaenger.get(h)) kette.unshift(h);

  const befehle = ["home", ...kette.map((h) => "connect " + h)];
  if (mitBackdoor) befehle.push("backdoor");

  ns.tprint("WEG " + ziel + ": " + befehle.join("; "));
}
