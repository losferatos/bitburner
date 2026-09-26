/**
 * Ebene 2: `src/hacknet.js` gegen den ns-Mock - der Cache-Ausbau fuer den
 * Rangtausch (23.09.2026).
 *
 * WARUM: hashes.js tauscht Hashes in Bladeburner-Rang, Stufe L kostet
 * 250*(L+1) und muss auf einmal in den Speicher passen. Niemand baute den
 * Cache aus - 9 Server mit Cache 1 = 576 Hashes, der Rangtausch stand ab
 * Stufe 2 (750) still. hashes.js meldet jetzt `bedarfKapazitaet`, und
 * hacknet.js baut darauf den kleinsten Cache aus (hoechstens 5 % des Kontos).
 *
 * Aufruf: node tools/test-hacknet-ebene2.js
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
const neunServer = () => Array.from({ length: 9 }, () => ({ cache: 1 }));

async function fahre(o = {}) {
  const hashesJson = o.hashesJson === undefined
    ? { zeit: W0 - 30000, knoten: 9, state: "work", bedarfKapazitaet: 750 }
    : o.hashesJson;
  const m = neuerMock({
    host: "home",
    knoten: o.knoten ?? 9,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 3600000,
    augReset: W0 - 3600000,
    geld: o.geld ?? 2e9,
    hacknet: { hashes: 0, server: o.server || neunServer() },
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      ...(hashesJson ? { "data/hashes.json": JSON.stringify(hashesJson) } : {}),
      ...(o.geldbedarf ? { "data/geldbedarf.txt": String(o.geldbedarf) } : {}),
    } },
    maxSchlaf: o.runden ?? 2,
    beiSchlaf: (ms, z, vor) => vor(ms),
  });
  const { modul } = await ladeAusBeiden(ROOT, "hacknet.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}
const caches = (m) => m.zustand.hacknet.kaeufe.filter((k) => k.art === "cache");

console.log("");
console.log("=== hacknet.js gegen den ns-Mock ===");

console.log("");
console.log("-- 1. Rangtausch braucht 750, Speicher 576: Cache ausbauen --");
{
  const m = await fahre({ runden: 3 });
  const c = caches(m);
  pruefe("baut den Cache aus", c.length >= 1, JSON.stringify(c));
  pruefe("zuerst 10 Mio (Cache 1 -> 2)", c.length >= 1 && Math.abs(c[0].kosten - 10e6) < 1,
    c.length ? String(c[0].kosten) : "");
  pruefe("jeweils auf dem kleinsten Cache, nicht zweimal derselbe Server",
    c.length < 2 || c[0].i !== c[1].i, JSON.stringify(c.map((x) => x.i)));
  pruefe("hoert auf, sobald 750 passen (576 + 64 + 64 + 64 = 768)",
    m.ns.hacknet.hashCapacity() >= 750 && c.length === 3,
    "Kapazitaet " + m.ns.hacknet.hashCapacity() + ", Kaeufe " + c.length);
}

console.log("");
console.log("-- 1b. mehr Runden: kein Ausbau ueber den Bedarf hinaus --");
{
  const m = await fahre({ runden: 8 });
  pruefe("bleibt bei 3 Ausbauten", caches(m).length === 3, "Kaeufe " + caches(m).length);
}

console.log("");
console.log("-- 2. kein Bedarf gemeldet: kein Cache --");
{
  const m = await fahre({ hashesJson: { zeit: W0 - 30000, knoten: 9, state: "work", bedarfKapazitaet: null } });
  pruefe("kein Ausbau", caches(m).length === 0);
}

console.log("");
console.log("-- 2b. Meldung veraltet oder aus einem anderen Knoten: kein Cache --");
{
  const alt = await fahre({ hashesJson: { zeit: W0 - 20 * 60000, knoten: 9, bedarfKapazitaet: 750 } });
  pruefe("veraltet: kein Ausbau", caches(alt).length === 0);
  const fremd = await fahre({ hashesJson: { zeit: W0 - 30000, knoten: 10, bedarfKapazitaet: 750 } });
  pruefe("anderer Knoten: kein Ausbau", caches(fremd).length === 0);
  const ohne = await fahre({ hashesJson: null });
  pruefe("ohne Datei: kein Ausbau", caches(ohne).length === 0);
}

console.log("");
console.log("-- 3. Konto zu klein (5 % unter dem Preis): kein Cache --");
{
  const m = await fahre({ geld: 1e8 });
  pruefe("bei 100 Mio (Grenze 5 Mio) kein Ausbau fuer 10 Mio", caches(m).length === 0);
}

console.log("");
console.log("-- 3b. 2 Mrd Konto, aber 1,9 Mrd Aug-Ruecklage: kein Cache --");
{
  const m = await fahre({ geld: 2e9, geldbedarf: 1.9e9 });
  pruefe("frei 100 Mio -> Grenze 5 Mio, kein Ausbau fuer 10 Mio", caches(m).length === 0,
    "Kaeufe " + caches(m).length);
}

console.log("");
console.log("-- 4. ausserhalb von BitNode 9: nichts --");
{
  const m = await fahre({ knoten: 10, hashesJson: { zeit: W0 - 30000, knoten: 10, bedarfKapazitaet: 750 } });
  pruefe("kein Ausbau", caches(m).length === 0);
}

console.log("");
console.log("-- 5. der ERSTE Server: nur in BitNode 9 (26.09.2026, Audit-Fund 5#6/C3) --");
{
  // DAS FEATURE HAENGT NICHT AN BITNODE 9. `hasHacknetServers` gilt ab SF9 in
  // JEDEM Knoten (lib/reg.js:merkmale), und der Server faellt bei JEDEM
  // Augmentierungs-Einbau weg - nicht nur beim Knotenwechsel. Vorher kaufte
  // hacknet.js den ersten Server ungeachtet des Knotens, sobald `serverModus`
  // (SF9) vorlag und `numNodes()` bei 0 stand - in einem V1-Knoten fuer
  // 19.000 $ ein Server, der 125 $/s Verkaufswert bringt und danach nur noch
  // RAM belegt.
  //
  // Der Mock stubbt `getPurchaseNodeCost`/`purchaseNode` sonst auf
  // Infinity/-1 (kein Server-Kauf im Repertoire) - hier werden sie fuer
  // genau diese Probe ueberschrieben, um den VERSUCH zu zaehlen.
  async function ersterServerVersuche(knoten) {
    const m = neuerMock({
      host: "home", knoten, wall: W0, playtime: 100 * 3600000,
      nodeReset: W0 - 3600000, augReset: W0 - 3600000, geld: 2e9,
      hacknet: { hashes: 0, server: [], serverModus: true },
      server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
      maxSchlaf: 2,
      beiSchlaf: (ms, z, vor) => vor(ms),
    });
    let versucht = 0;
    m.ns.hacknet.getPurchaseNodeCost = () => 19000;
    m.ns.hacknet.purchaseNode = () => { versucht++; return -1; };
    const { modul } = await ladeAusBeiden(ROOT, "hacknet.js");
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck(); }
    return versucht;
  }

  const ausserhalb = await ersterServerVersuche(5);
  pruefe("BitNode 5 (kein BN9, aber SF9-Feature vorhanden): kein Kaufversuch",
    ausserhalb === 0, "Versuche: " + ausserhalb);

  const bn9 = await ersterServerVersuche(9);
  pruefe("BitNode 9: kauft den ersten Server weiterhin (Regression)",
    bn9 >= 1, "Versuche: " + bn9);
}

console.log("");
console.log("-- 6. ausserhalb BN9 ohne Kapazitaet: Marker setzen und beenden (26.09.2026, Audit-Fund 5#6, C3-Nachtrag) --");
{
  // Der SF9.3-Gratis-Server ist weg (kapazitaet 0), und ausserhalb BN9 kauft
  // dieses Skript nie einen neuen ("NUR in BitNode 9", s. Docstring). Vorher
  // lief es hier bis zum naechsten Sprung leer weiter (5 min Takt) und hielt
  // dafuer dauerhaft ~9 GB auf der Werkbank - jetzt setzt es denselben Marker
  // wie hashes.js und beendet sich, `maxSchlaf: 1` genuegt also schon.
  const m = await fahre({ knoten: 5, server: [], hashesJson: null, runden: 1 });
  const marker = m.lies("home", "data/keine-hacknet.txt");
  pruefe("data/keine-hacknet.txt wird geschrieben", !!marker, String(marker));
  pruefe("mit der Knotennummer", String(marker || "").trim() === "5", String(marker));
}

console.log("");
console.log("-- 6b. in BitNode 9 bleibt es dagegen im Wartezweig (kein Marker) --");
{
  const m = await fahre({ knoten: 9, server: [], hashesJson: null, runden: 1 });
  pruefe("kein Marker in BN9 - hacknet.js kauft dort noch selbst",
    !m.lies("home", "data/keine-hacknet.txt"));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
