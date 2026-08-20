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

import zlib from "node:zlib";

const BASE = "http://localhost:8795";

async function rpc(method, params = {}) {
  const q = new URLSearchParams({ method, ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

/**
 * Wo laeuft die Hand gerade?
 *
 * Der Grund fuer diesen Umweg ist am 20.08. gemessen worden: die Hand liegt
 * fast nie auf home (dort sind nur 16 GB, sie braucht 28,75), und ihr eigenes
 * ns.scp("data/cmd.txt", HIER, "home") holt die Befehlsdatei NICHT
 * zuverlaessig herueber - es meldet Erfolg und kopiert trotzdem nicht. Auf home
 * stand der neue Befehl, auf ihrer Maschine noch der zehn Minuten alte. In
 * dieser Zeit war der Autopilot tot und niemand konnte ihn neu starten.
 *
 * Also wird die Datei direkt dorthin gelegt, wo sie gelesen wird. Der Umweg
 * ueber home bleibt als Rueckfallebene bestehen - er schadet nicht und deckt
 * den Fall ab, dass die Hand gerade umzieht.
 */
async function handHost() {
  try {
    const r = await rpc("getSaveFile");
    const save = JSON.parse(zlib.gunzipSync(Buffer.from(r.save, "latin1")).toString("utf8"));
    const alle = JSON.parse(save.data.AllServersSave);
    for (const k of Object.keys(alle)) {
      const srv = alle[k] && alle[k].data;
      if (!srv) continue;
      for (const proc of srv.runningScripts || []) {
        if ((proc.data || proc).filename === "hand.js") return srv.hostname;
      }
    }
  } catch {
    // Kein Spielstand lesbar - dann eben nur home.
  }
  return null;
}

async function lies() {
  const wo = (await handHost()) || "home";
  try {
    const roh = await rpc("getFile", { filename: "data/cmd-out.txt", server: wo });
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

  // Direkt an die Maschine der Hand, NICHT an home. Ihr eigenes ns.scp holt
  // die Datei nicht zuverlaessig herueber - es meldet Erfolg und kopiert
  // trotzdem nicht. Auf home stand dann der neue Befehl, bei ihr der zehn
  // Minuten alte, und beim naechsten Mal liefen beide Stapel vermischt durchs
  // Terminal: gesendet wurde "home; connect bot-1; run homeram.js", angekommen
  // ist "connect bot-1; home; run homeram.js" - und lief damit auf der
  // falschen Maschine. Eine Ablage, eine Wahrheit.
  const wo = (await handHost()) || "home";
  await rpc("pushFile", { filename: "data/cmd.txt", content: args.join("\n"), server: wo });
  console.log("Abgesetzt an " + wo + ":");
  for (const a of args) console.log("  > " + a);
  console.log("");
  console.log("Ausgabe holen mit:  node tools/hand.js --lies");
}

main().catch((e) => console.log("Fehler: " + e.message));
