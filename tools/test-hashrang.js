/**
 * Hash-Rang im Anlauf (Befund B7, 07.10.2026): hashes.js und hacknet.js gegen den ns-Mock.
 *
 * Was gilt (Rechnung: nodes/HASH-RANG-2026-10.md):
 *   - BN13/BN15, V2, in der Division, Konto UNTER 1 Mrd: Hashes gehen in Rang (bisher Verkauf),
 *     bis der Stufenpreis 1000 uebersteigt (4 Stufen = 400 Rang); der Rest wird verkauft.
 *   - BN13/BN15, Konto UEBER 1 Mrd: alte Regel, kein Preisdeckel.
 *   - Alle anderen Knoten (BN9, BN3, ...): unveraendert, unter 1 Mrd kein Rang.
 *
 * Gegenprobe: gegen die alten Dateien (git stash der src/-Aenderung) muessen die mit "NEU"
 * markierten Pruefungen rot werden, die mit "ALT" gruen bleiben.
 *
 * Aufruf: node tools/test-hashrang.js
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
  if (bedingung) { gruen++; console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : "")); }
  else { rot++; fehler.push(was + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}

const W0 = 1_700_000_000_000;
const RANG = "Exchange for Bladeburner Rank";

async function fahre(datei, o) {
  const m = neuerMock({
    host: "home",
    knoten: o.knoten,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 3600000,
    augReset: o.augReset ?? W0 - 3600000,
    geld: o.geld,
    hacknet: o.hacknet,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "data/verfahren.txt": o.verfahren ?? ("V2 " + o.knoten + " 1"), ...(o.dateien || {}) } },
    maxSchlaf: o.runden ?? 1,
    beiSchlaf: (ms, z, vor) => vor(ms),
  });
  if (o.inDivision) m.zustand.blade.drin = true;
  const { modul } = await ladeAusBeiden(ROOT, datei);
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}
const zaehle = (m, art) => m.zustand.hacknet.ausgegeben.filter((x) => x === art).length;
const stand = (m) => { try { return JSON.parse(m.lies("home", "data/hashes.json") || "null"); } catch { return null; } };
const caches = (m) => m.zustand.hacknet.kaeufe.filter((k) => k.art === "cache");

console.log("=== hashes.js: Hash-Rang im Anlauf ===");

console.log("-- 1. NEU: BN15, Division, arm (100 Mio), 1000 Hashes, Speicher 1024: Rang statt Verkauf --");
{
  const m = await fahre("hashes.js", { knoten: 15, inDivision: true, geld: 1e8, hacknet: { hashes: 1000, kapazitaet: 1024 } });
  pruefe("NEU zwei Rangstufen (250 + 500)", zaehle(m, RANG) === 2, "Rang " + zaehle(m, RANG));
  pruefe("NEU Rest 250 liegt als Vorrat (naechste Stufe 750 passt nicht)", m.zustand.hacknet.hashes === 250, "Rest " + m.zustand.hacknet.hashes);
  const s = stand(m);
  pruefe("NEU Telemetrie: rangAusHashes 200", s && s.rangAusHashes === 200, JSON.stringify(s));
}

console.log("-- 2. NEU: BN13 ebenso --");
{
  const m = await fahre("hashes.js", { knoten: 13, inDivision: true, geld: 1e8, hacknet: { hashes: 1000, kapazitaet: 1024 } });
  pruefe("NEU zwei Rangstufen", zaehle(m, RANG) === 2, "Rang " + zaehle(m, RANG));
}

console.log("-- 3. NEU: Preisdeckel 1000 - genau 4 Stufen, der Rest wird verkauft --");
{
  const m = await fahre("hashes.js", { knoten: 15, inDivision: true, geld: 1e8, runden: 2,
    hacknet: { hashes: 30000, kapazitaet: 4096 } });
  pruefe("NEU genau 4 Rangstufen (250..1000, zusammen 2500 Hashes)", zaehle(m, RANG) === 4, "Rang " + zaehle(m, RANG));
  pruefe("NEU danach Verkauf (1000 Verkaeufe je Runde, Rest folgt)", zaehle(m, "Sell for Money") === 1000, "Verkauf " + zaehle(m, "Sell for Money"));
  const s = stand(m);
  pruefe("NEU kein Cache-Bedarf ueber dem Deckel gemeldet", s && s.bedarfKapazitaet === null, JSON.stringify(s && s.bedarfKapazitaet));
}

console.log("-- 4. NEU: Speicher zu klein fuer die naechste Stufe: Bedarf wird gemeldet (unter dem Deckel) --");
{
  const m = await fahre("hashes.js", { knoten: 15, inDivision: true, geld: 1e8, hacknet: { hashes: 900, kapazitaet: 320 } });
  const s = stand(m);
  pruefe("NEU eine Stufe (250)", zaehle(m, RANG) === 1, "Rang " + zaehle(m, RANG));
  pruefe("NEU Bedarf 500 gemeldet", s && s.bedarfKapazitaet === 500, JSON.stringify(s && s.bedarfKapazitaet));
}

console.log("-- 5. ALT: Konto ueber 1 Mrd in BN15 - alte Regel, KEIN Deckel (15 Stufen: 125*15*16 = 30000 Hashes, letzter Preis 3750) --");
{
  const m = await fahre("hashes.js", { knoten: 15, inDivision: true, geld: 2e9, runden: 2, hacknet: { hashes: 30000, kapazitaet: 4096 } });
  pruefe("ALT 15 Rangstufen ohne Deckel", zaehle(m, RANG) === 15, "Rang " + zaehle(m, RANG));
}

console.log("-- 6. ALT: BN9 und BN3 arm, in der Division: weiter kein Rang --");
for (const k of [9, 3, 10, 6]) {
  const m = await fahre("hashes.js", { knoten: k, inDivision: true, geld: 1e8, hacknet: { hashes: 1000, kapazitaet: 1024 } });
  pruefe("ALT BN" + k + ": kein Rang", zaehle(m, RANG) === 0, "Rang " + zaehle(m, RANG));
  pruefe("ALT BN" + k + ": verkauft", zaehle(m, "Sell for Money") === 250, "Verkauf " + zaehle(m, "Sell for Money"));
}

console.log("-- 7. ALT: BN15 vor der Division - kein Rang --");
{
  const m = await fahre("hashes.js", { knoten: 15, inDivision: false, geld: 1e6, hacknet: { hashes: 1000, kapazitaet: 1024 } });
  pruefe("ALT kein Rang vor dem Beitritt", zaehle(m, RANG) === 0, "Rang " + zaehle(m, RANG));
}

console.log("-- 8. ALT: BN15 in V1-Lage - kein Rang --");
{
  const m = await fahre("hashes.js", { knoten: 15, verfahren: "V1 15 1", inDivision: true, geld: 1e8, hacknet: { hashes: 1000, kapazitaet: 1024 } });
  pruefe("ALT kein Rang in V1", zaehle(m, RANG) === 0, "Rang " + zaehle(m, RANG));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
  process.exit(1);
}
