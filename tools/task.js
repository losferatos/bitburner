/**
 * Ein Skript im Spiel starten - ohne Terminal, ohne Hand.
 *
 * Legt die Zeile in data/task.txt ab; der Autopilot sieht sie in der naechsten
 * Runde, sucht einen Rechner mit genug Speicher, kopiert das Skript dorthin und
 * startet es. Der Umweg ueber das Terminal entfaellt damit vollstaendig - und
 * mit ihm die drei Fehlerquellen, die den 20.08. gekostet haben: `connect`,
 * eine Befehlsdatei, die nicht ankommt, und eine Hand, die staendig umzieht.
 *
 * Aufruf:  node tools/task.js homeram.js --ram 2048
 */

const BASE = "http://localhost:8795";

async function rpc(method, params = {}) {
  const body = await (await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, ...params }))).json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log("Aufruf: node tools/task.js <skript.js> [argumente...]");
  process.exit(1);
}
// JSON statt Leerzeichen: Faktionen heissen "Tian Di Hui" und "New Tokyo",
// und ein leeres Argument ("") verschwindet beim Zusammenfuegen ganz. Beides
// haette den Empfaenger die Argumente falsch zuordnen lassen - er haette den
// naechsten Schalter als Wert des vorigen gelesen und waere mit "fehlt"
// abgebrochen. Eine Kodierung, die Grenzen kennt, statt einer, die raet.
await rpc("pushFile", { filename: "data/task.txt", content: JSON.stringify(args), server: "home" });
console.log("Auftrag abgelegt: " + args.map((a) => JSON.stringify(a)).join(" "));
console.log("Der Autopilot startet ihn in der naechsten Runde.");
