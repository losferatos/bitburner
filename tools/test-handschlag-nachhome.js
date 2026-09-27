/**
 * Ebene 2: `lib/handschlag.js` - die Einbausperre muss auf HOME landen,
 * auch wenn das aufrufende Gewerk auf der Werkbank laeuft (Paket C.4,
 * Audit-Fund 6#5, 26.09.2026).
 *
 * ===========================================================================
 * WARUM DIESER TEST
 * ===========================================================================
 *
 * `bn4rep.js` hat `hostRule: "werkbank"` und sitzt fast nie auf home. Schlaegt
 * der Handschlag fehl (Bruecke tot, keine junge Sicherung), setzte
 * `handschlag()` die Einbausperre bis zum 26.09.2026 mit einem lokalen
 * `ns.write` - ohne `scp` nach home. `bn4rep.js` liest die Sperre aber ueber
 * `liesVonHome(INSTALL_LOCK_FILE)` (bn4rep.js:797), also IMMER von home. Lief
 * `bn4rep` gerade auf der Werkbank, sah es die eigene Sperre nie: die
 * einstuendige Wartezeit wirkte nicht, und der Prozess (der bei einem
 * Handschlag-Fehlschlag per `return` endet, bn4rep.js:1395-1397) haemmerte im
 * Neustarttakt des Kerns gegen dieselbe tote Bruecke - gemessen in der Nacht
 * 24./25.09.2026 6,5 Stunden lang.
 *
 * `tools/test-punish.js` deckt den Handschlag-Fehlschlag bereits ab, aber
 * IMMER auf Host "home" (der Mock-Standard) - genau der Fall, in dem
 * `ns.write` und `nachHome` sich nicht unterscheiden. Dieser Test laeuft
 * ausdruecklich auf einem FREMDEN Host, um den Unterschied zu zeigen.
 *
 * Aufruf: node tools/test-handschlag-nachhome.js
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

const WALL = 1_700_000_000_000;
const NODE_RESET = 1_600_000_000_000;

console.log("");
console.log("=== lib/handschlag.js: Einbausperre erreicht home (C.4) ===");

console.log("");
console.log("-- auf der WERKBANK (fulcrumtech), ohne Antwort und ohne junge Sicherung --");
{
  const m = neuerMock({
    host: "fulcrumtech", wall: WALL, nodeReset: NODE_RESET, knoten: 10,
    // OHNE beiSchlaf bewegt sich die Uhr nicht - die 90-s-Wartefrist
    // von handschlag() liefe sonst gegen eine stehende Date.now().
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(ms),
    // Kein data/backup-ok.txt, kein data/bridge.json: der schlimmste Fall.
    server: { home: { ram: 32, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      fulcrumtech: { ram: 64, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    maxSchlaf: 46,   // WARTE_MAX_MS 90000 / 2000 = 45 Runden
  });

  const { modul } = await ladeAusBeiden(ROOT, "lib/handschlag.js");
  const meldungen = [];
  const zurueck = m.uhrStellen();
  let ergebnis;
  try {
    ergebnis = await modul.handschlag(m.ns, "install", "bn4rep", NODE_RESET,
      (t) => meldungen.push(t));
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }

  pruefe("handschlag() lehnt ab (keine Sicherung)", !!ergebnis && ergebnis.darf === false,
    ergebnis ? JSON.stringify(ergebnis) : "(kein Ergebnis - Mock-Abbruch vor dem Rueckgabewert)");

  const aufHome = m.lies("home", "data/install-sperre.txt");
  pruefe("die Sperre liegt auf HOME, nicht nur auf der Werkbank",
    !!aufHome,
    "bn4rep.js:797 liest sie ausschliesslich von home - eine lokale Sperre"
    + " auf fulcrumtech waere fuer bn4rep unsichtbar");

  if (aufHome) {
    let geparst = null;
    try { geparst = JSON.parse(aufHome); } catch { /* geparst bleibt null */ }
    pruefe("sie ist gueltiges JSON mit reason 'handschlag'",
      !!geparst && geparst.reason === "handschlag", aufHome);
    pruefe("und hat ein 'bis', das bn4rep.js:943-948 versteht",
      !!geparst && Number.isFinite(geparst.bis) && geparst.bis > WALL,
      geparst ? JSON.stringify(geparst) : "");
  }

  const aufWerkbank = m.lies("fulcrumtech", "data/install-sperre.txt");
  pruefe("und sie liegt (wie bei nachHome ueblich) auch lokal auf der Werkbank",
    !!aufWerkbank);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
