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
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
