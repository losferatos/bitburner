/**
 * Ebene 2: `src/bn4life.js` startet joinrun.js/netburn.js erst, wenn Geld fuer
 * das Gym da ist (Integrationspruefung 27.09.2026).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * Nach einem Knotensprung (home 128 GB mit SF9.3, 1.262 $ Guthaben) startete
 * bn4life.js in seiner ersten Runde joinrun.js (31,45 GB bei SF4.3) und
 * netburn.js (26,75 GB) auf home. joinrun.js trainiert aber erst ab 5 Mio
 * (`Konto unter 5 Mio - kein Gym, warte`) und wartete so bis zu 45 Minuten,
 * ohne etwas zu tun - mit 58,2 GB auf home. Nachgerechnet mit tools/ram.js
 * und der Startreihenfolge der Registry: danach bleiben 0,55 GB frei, und
 * shop.js (7,00 GB, hostRule home, der einzige Preislieferant fuer den
 * Rechnerkauf) findet keinen Platz. Auf master war es derselbe Fall mit
 * 5,65 GB frei (joinrun 26,35) - Paket C (+5,10 GB fuer die Daedalus-Pruefung)
 * hat die Luecke vergroessert, nicht erzeugt.
 *
 * Jetzt startet bn4life die beiden erst ab demselben Geldboden, den joinrun
 * fuer das Gym selbst verlangt. Die Beitrittsmarke wird erst mit dem Start
 * gesetzt - der Lauf geht also nicht verloren, er kommt nur spaeter.
 *
 * Aufruf: node tools/test-bn4life-beitritt.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

const W0 = 1_700_000_000_000;

async function fahre(geld) {
  const m = neuerMock({
    host: "home",
    knoten: 1,
    wall: W0,
    playtime: 60000,
    nodeReset: W0 - 60000,
    augReset: W0 - 60000,
    geld,
    server: { home: { ram: 128, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "joinrun.js": "//", "netburn.js": "//", "bn4net.js": "//" } },
    maxSchlaf: 1,
  });
  m.zustand.spieler.factions = [];
  const { modul } = await ladeAusBeiden(ROOT, "bn4life.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  const gestartet = m.zustand.gestartet.map((g) => g.datei);
  return { m, gestartet };
}

console.log("");
console.log("=== bn4life.js: Beitrittslauf erst mit Gym-Geld (Integration 27.09.2026) ===");

{
  const { m, gestartet } = await fahre(1262);
  pruefe("frisch nach dem Sprung (1.262 $): joinrun.js wird NICHT gestartet",
    !gestartet.includes("joinrun.js"), gestartet.join(", "));
  pruefe("und netburn.js auch nicht", !gestartet.includes("netburn.js"), gestartet.join(", "));
  pruefe("und die Beitrittsmarke bleibt offen (der Lauf kommt spaeter)",
    !m.lies("home", "data/beitritt-erledigt.txt"));
}
{
  const { m, gestartet } = await fahre(6e6);
  pruefe("mit 6 Mio: joinrun.js wird gestartet", gestartet.includes("joinrun.js"),
    gestartet.join(", ") + " | log: " + (m.lies("home", "data/bn4life-log.txt") || "").slice(-400));
  pruefe("und netburn.js mit", gestartet.includes("netburn.js"), gestartet.join(", "));
  pruefe("und die Marke ist gesetzt", !!m.lies("home", "data/beitritt-erledigt.txt"));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
