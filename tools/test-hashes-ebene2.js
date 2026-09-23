/**
 * Ebene 2: hashes.js gegen den ns-Mock (19.09.2026).
 *
 * Das BN9-Gewerk war vom 02.09. bis 19.09. in keinem Knoten je gelaufen
 * (requiresFeature ohne `features` in der Lage) - und hatte deshalb auch
 * keinen Test. Hier stehen die vier Lagen, die es unterscheiden muss:
 *
 *   1. kein Hacknet-Server, kein Server-Modus  -> Marker, Ende
 *   2. V2 vor der Division (Anlauf)             -> Improve Gym Training
 *   3. V2 in der Division, Konto > 1 Mrd        -> Exchange for Bladeburner Rank
 *   4. V1                                       -> Sell for Money
 *
 * Dazu die Deckelregel: passt die naechste Gym-Stufe nicht mehr in den
 * Speicher, faellt es auf Verkauf zurueck, statt den Vorrat am Deckel liegen
 * zu lassen.
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
  if (bedingung) {
    gruen++;
    console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

const W0 = 1_700_000_000_000;

async function fahre(o) {
  const m = neuerMock({
    host: "home",
    knoten: o.knoten ?? 9,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 3600000,
    augReset: W0 - 3600000,
    geld: o.geld ?? 1e6,
    hacknet: o.hacknet,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "data/verfahren.txt": o.verfahren || "V2 9 1", ...(o.dateien || {}) } },
    maxSchlaf: o.runden ?? 1,
    beiSchlaf: o.beiSchlaf || ((ms, z, vorRuecken) => vorRuecken(1)),
  });
  if (o.inDivision) m.zustand.blade.drin = true;
  const { modul } = await ladeAusBeiden(ROOT, "hashes.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

const stand = (m) => { try { return JSON.parse(m.lies("home", "data/hashes.json") || "null"); } catch { return null; } };
const zaehle = (m, art) => m.zustand.hacknet.ausgegeben.filter((x) => x === art).length;

console.log("");
console.log("=== hashes.js gegen den ns-Mock ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 1. kein Hacknet-Server, kein Server-Modus: Marker und Ende --");
{
  const m = await fahre({ knoten: 10, hacknet: { kapazitaet: 0, serverModus: false } });
  const marker = m.lies("home", "data/keine-hacknet.txt");
  pruefe("data/keine-hacknet.txt wird geschrieben", !!marker, String(marker));
  pruefe("mit der Knotennummer", String(marker || "").trim() === "10", String(marker));
  pruefe("und nichts wird ausgegeben", m.zustand.hacknet.ausgegeben.length === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 1b. Server-Modus ohne Server: warten, kein Marker --");
{
  const m = await fahre({ knoten: 9, hacknet: { kapazitaet: 0, serverModus: true } });
  pruefe("kein Marker im Server-Modus", !m.lies("home", "data/keine-hacknet.txt"));
  // Der Waechter misst hashes.json gegen freshnessMs 900000; ohne Herzschlag
  // waere jede Wartephase ueber 15 min ein S1-Kill (Skeptiker 19.09.).
  const s = stand(m);
  pruefe("schreibt trotzdem Telemetrie mit state 'wait'", s && s.state === "wait",
    JSON.stringify(s));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 1c. BitNode 8: keine Hashes moeglich, Marker und Ende --");
{
  // Mit SF9 gibt es dort Server (maxNumNodes 20), aber HacknetNodeMoney 0
  // (BitNode.tsx:770) - der Wartezweig wuerde ewig warten.
  const m = await fahre({ knoten: 8, verfahren: "V1 8 1",
    hacknet: { hashes: 0, kapazitaet: 1024, serverModus: true } });
  pruefe("Marker in BitNode 8", String(m.lies("home", "data/keine-hacknet.txt") || "").trim() === "8");
  pruefe("nichts ausgegeben", m.zustand.hacknet.ausgegeben.length === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2. Anlauf (V2, nicht in der Division): Gym-Training --");
{
  // 1.280 Hashes, Speicher 1.280 - die Lage vom 19.09. 02:47. Stufen 1-6
  // kosten 50+100+...+300 = 1.050; die siebte (350) passt noch in den
  // Speicher, aber nicht mehr in den Vorrat (230).
  const m = await fahre({ geld: 1e9, hacknet: { hashes: 1280, kapazitaet: 1280 } });
  pruefe("kauft Improve Gym Training", zaehle(m, "Improve Gym Training") === 6,
    "gekauft: " + zaehle(m, "Improve Gym Training"));
  pruefe("und verkauft dabei nichts", zaehle(m, "Sell for Money") === 0);
  pruefe("Rest bleibt fuer die naechste Stufe liegen", m.zustand.hacknet.hashes === 230,
    "Rest " + m.zustand.hacknet.hashes);
  const s = stand(m);
  pruefe("Telemetrie nennt die Art", s && s.art === "Improve Gym Training" && s.gym === 6,
    JSON.stringify(s));
  pruefe("und state 'work'", s && s.state === "work");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2a. Anlauf, aber arm (unter 50 Mio): erst verkaufen --");
{
  // Knoteneintritt: 1.000 $ auf dem Konto. Gym-Stufen kaufen hiesse, dass
  // niemand die Gym-Gebuehr zahlen kann (bbtrain ab 5 Mio, sleeve ab 20 Mio).
  const m = await fahre({ geld: 1000, hacknet: { hashes: 1280, kapazitaet: 1280 } });
  pruefe("kein Gym-Kauf unter dem Geldboden", zaehle(m, "Improve Gym Training") === 0);
  pruefe("stattdessen Verkauf", zaehle(m, "Sell for Money") === 320,
    "verkauft: " + zaehle(m, "Sell for Money"));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2c. Stufendeckel: ab Stufe 6 wird verkauft, auch mit Geld und Platz --");
{
  // Speicher 4.096 (Cache 7), Stufe 6 erreicht, die siebte (350) passte.
  const m = await fahre({ geld: 1e9, hacknet: { hashes: 2000, kapazitaet: 4096,
    stufen: { "Improve Gym Training": 6 } } });
  pruefe("kein siebter Gym-Kauf", zaehle(m, "Improve Gym Training") === 0);
  pruefe("Verkauf", zaehle(m, "Sell for Money") === 500, "verkauft: " + zaehle(m, "Sell for Money"));
  // Und von Stufe 4 aus: genau bis 6, nicht darueber.
  const m2 = await fahre({ geld: 1e9, hacknet: { hashes: 2000, kapazitaet: 4096,
    stufen: { "Improve Gym Training": 4 } } });
  pruefe("von Stufe 4 aus genau zwei Kaeufe", zaehle(m2, "Improve Gym Training") === 2,
    "gekauft: " + zaehle(m2, "Improve Gym Training"));
  pruefe("und danach nichts verkauft (Rest bleibt fuer die naechste Runde)",
    zaehle(m2, "Sell for Money") === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2b. Deckelregel: passt die Stufe nicht in den Speicher, wird verkauft --");
{
  // Speicher 64 (gekaufter Server, Cache 1), Stufe 1 erreicht: die zweite
  // kostet 100 > 64.
  const m = await fahre({ geld: 1e9, hacknet: { hashes: 64, kapazitaet: 64,
    stufen: { "Improve Gym Training": 1 } } });
  pruefe("kein weiterer Gym-Kauf", zaehle(m, "Improve Gym Training") === 0);
  pruefe("stattdessen Verkauf", zaehle(m, "Sell for Money") === 16,
    "verkauft: " + zaehle(m, "Sell for Money"));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3. in der Division mit Konto > 1 Mrd: Rang --");
{
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 } });
  pruefe("kauft Exchange for Bladeburner Rank", zaehle(m, "Exchange for Bladeburner Rank") === 2,
    "gekauft: " + zaehle(m, "Exchange for Bladeburner Rank"));
  pruefe("kein Gym mehr nach dem Beitritt", zaehle(m, "Improve Gym Training") === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3b. in der Division, aber arm: Verkauf, kein Gym --");
{
  const m = await fahre({ inDivision: true, geld: 1e6, hacknet: { hashes: 400, kapazitaet: 1280 } });
  pruefe("verkauft", zaehle(m, "Sell for Money") === 100, "verkauft: " + zaehle(m, "Sell for Money"));
  pruefe("kein Gym", zaehle(m, "Improve Gym Training") === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 4. V1-Knoten: Verkauf, kein Gym --");
{
  const m = await fahre({ knoten: 9, verfahren: "V1 9 1", hacknet: { hashes: 400, kapazitaet: 1280 } });
  pruefe("verkauft", zaehle(m, "Sell for Money") === 100, "verkauft: " + zaehle(m, "Sell for Money"));
  pruefe("kein Gym in V1", zaehle(m, "Improve Gym Training") === 0);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 4b. verfahren.txt aus einem anderen Knoten zaehlt nicht --");
{
  const m = await fahre({ knoten: 9, verfahren: "V2 4 3", hacknet: { hashes: 400, kapazitaet: 1280 } });
  pruefe("ohne gueltige Rolle: Verkauf", zaehle(m, "Sell for Money") === 100);
  pruefe("kein Gym", zaehle(m, "Improve Gym Training") === 0);
}

// ---------------------------------------------------------------------------
// WIEDERAUFBAU IN DER DIVISION (23.09.2026). Die Division ueberlebt einen
// Einbau, die Kampfwerte nicht - der Spielstand vom 23.09. zeigte Improve
// Gym Training Stufe 0 nach einem ganzen Wiederaufbau.
const bladeFrisch = (tiefstand, zeit = W0 - 60000) => ({
  "data/blade.json": JSON.stringify({ zeit, tiefstand, rang: 400 }),
});

console.log("");
console.log("-- 5. Kampfaufbau IN der Division: Gym vor Rang --");
{
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 },
    dateien: bladeFrisch(60) });
  pruefe("kauft Improve Gym Training", zaehle(m, "Improve Gym Training") >= 1,
    "gym: " + zaehle(m, "Improve Gym Training"));
  pruefe("und keinen Rang, solange Gym ansteht", zaehle(m, "Exchange for Bladeburner Rank") === 0,
    "rang: " + zaehle(m, "Exchange for Bladeburner Rank"));
  pruefe("Telemetrie meldet aufbau", stand(m) && stand(m).aufbau === true, JSON.stringify(stand(m)));
}

console.log("");
console.log("-- 5a. Division, Kampfwerte bei 100: kein Gym, Rang --");
{
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 },
    dateien: bladeFrisch(100) });
  pruefe("kein Gym", zaehle(m, "Improve Gym Training") === 0);
  pruefe("Rang", zaehle(m, "Exchange for Bladeburner Rank") === 2);
}

console.log("");
console.log("-- 5b. blade.json von VOR dem letzten Einbau zaehlt nicht --");
{
  // augReset liegt bei W0 - 1 h; ein Stand von W0 - 2 h ist vom alten Leben.
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 },
    dateien: bladeFrisch(5, W0 - 2 * 3600000) });
  pruefe("kein Gym auf alter Lage", zaehle(m, "Improve Gym Training") === 0);
}

console.log("");
console.log("-- 5c. Gym-Deckel mit gemessener Rate: ueber Stufe 6 hinaus --");
{
  // Runde 1 misst noch nichts (Deckel 6, Stufe 6 steht) und verkauft; im
  // Schlaf kommen 500 Hashes in 10 s dazu = 50/s. Runde 2 rechnet damit:
  // Stufe 6 kostet 350 Hashes = 7 s und spart 1.364 s - kaufen.
  const m = await fahre({ inDivision: true, geld: 1e8, runden: 3,
    hacknet: { hashes: 100, kapazitaet: 1280, stufen: { "Improve Gym Training": 6 } },
    dateien: bladeFrisch(60),
    beiSchlaf: (ms, z, vor) => { z.hacknet.hashes += 500; vor(10000); } });
  pruefe("kauft Stufe 7 (ueber dem alten Deckel)", zaehle(m, "Improve Gym Training") >= 1,
    "gym: " + zaehle(m, "Improve Gym Training") + ", rate " + (stand(m) && stand(m).rate));
}

console.log("");
console.log("-- 6. Rangtausch passt nicht in den Speicher: verkaufen und Bedarf melden --");
{
  // Der Fall aus dem Spielstand vom 23.09.: Rang-Stufe 2 (750), Speicher 576.
  const m = await fahre({ inDivision: true, geld: 2e9,
    hacknet: { hashes: 576, kapazitaet: 576, stufen: { "Exchange for Bladeburner Rank": 2 } },
    dateien: bladeFrisch(100) });
  pruefe("verkauft statt zu warten", zaehle(m, "Sell for Money") === 144,
    "verkauft: " + zaehle(m, "Sell for Money"));
  pruefe("keine Skillpunkte (Ausweich vom Skeptiker gekippt)", zaehle(m, "Exchange for Bladeburner SP") === 0);
  pruefe("meldet bedarfKapazitaet 750", stand(m) && stand(m).bedarfKapazitaet === 750,
    JSON.stringify(stand(m)));
  pruefe("und rangAusHashes 200 mit augReset-Stempel",
    stand(m) && stand(m).rangAusHashes === 200 && stand(m).augReset === W0 - 3600000,
    JSON.stringify(stand(m)));
}

console.log("");
console.log("-- 6b. Aug-Ruecklage ist tabu: kein Rang, solange Konto - Ruecklage < 1 Mrd --");
{
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 },
    dateien: { ...bladeFrisch(100), "data/geldbedarf.txt": "9680000000" } });
  pruefe("kein Rang", zaehle(m, "Exchange for Bladeburner Rank") === 0,
    "rang: " + zaehle(m, "Exchange for Bladeburner Rank"));
  pruefe("verkauft fuer die Ruecklage", zaehle(m, "Sell for Money") === 250);
  pruefe("und meldet keinen Cache-Bedarf", stand(m) && stand(m).bedarfKapazitaet === null);
}

console.log("");
console.log("-- 6c. Kampfwerte 100, blade weicht aber fuers Training: Gym zaehlt --");
{
  const m = await fahre({ inDivision: true, geld: 2e9, hacknet: { hashes: 1000, kapazitaet: 1280 },
    dateien: { "data/blade.json": JSON.stringify({ zeit: W0 - 60000, tiefstand: 100, weichtTraining: true }) } });
  pruefe("kauft Gym", zaehle(m, "Improve Gym Training") >= 1, "gym: " + zaehle(m, "Improve Gym Training"));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
  process.exit(1);
}
