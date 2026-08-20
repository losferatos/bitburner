/**
 * Terminalbefehle absetzen - ohne Browser.
 *
 * Gegenstueck zu `src/hand.js`, das im Spiel laeuft und das Terminal ueber das
 * DOM bedient. Dieses Werkzeug legt die Befehlsdatei ab und holt die Ausgabe.
 *
 * Der Umweg ist noetig, weil jeder Zugriff von aussen auf den Browser in Opera
 * eine Freigabeabfrage ausloest - im laufenden Betrieb unbrauchbar.
 *
 * Aufruf:
 *   node tools/hand.js "home" "connect harakiri-sushi" "connect CSEC" backdoor
 *   node tools/hand.js --lies      nur die letzte Ausgabe zeigen
 *
 * ACHTUNG: `backdoor` ist eine Aktion mit Laufzeit. Steht sie in der Liste,
 * sendet die Hand danach nichts mehr und wartet auf die Bestaetigung im
 * Serverzustand - alles nach `backdoor` wird also verworfen.
 */

const BASE = "http://localhost:8795";

async function rpc(method, params = {}) {
  const q = new URLSearchParams({ method, ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function lies() {
  try {
    const roh = await rpc("getFile", { filename: "data/cmd-out.txt", server: "home" });
    const o = JSON.parse(roh);
    const alter = Math.round((Date.now() - o.at) / 1000);
    console.log("  (vor " + alter + " Sekunden)");
    console.log(o.text);
  } catch (e) {
    console.log("Keine Ausgabe: " + e.message);
    console.log("Laeuft hand.js im Spiel? Der Autopilot startet sie selbst,");
    console.log("sobald hand.js auf home liegt und irgendwo 25 GB frei sind.");
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (!args.length || args[0] === "--lies") {
    await lies();
    return;
  }

  await rpc("pushFile", { filename: "data/cmd.txt", content: args.join("\n"), server: "home" });
  console.log("Abgesetzt:");
  for (const a of args) console.log("  > " + a);
  console.log("");
  console.log("Ausgabe holen mit:  node tools/hand.js --lies");
}

main().catch((e) => console.log("Fehler: " + e.message));
