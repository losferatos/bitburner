/**
 * Ebene 0+2: `src/bn4life.js` holt die Figur in den Corp-Knoten nach
 * Sector-12, sobald fuer The Syndicate nur noch die Stadt fehlt (H2-light,
 * 06.10.2026).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * Gemessen auf den Sicherungen (nodes/corp-2026-10-05/hebel/syndikat.mjs):
 * In Zyklus 1 von BN2.3 waren ab 8,8 h alle Syndicate-Bedingungen ausser der
 * Stadt erfuellt (Karma -97,6, Kampf min 225, Hacking 391, 34 Mrd $), die
 * Figur stand aber bis zum Einbau (12,4 h) in Ishima - dorthin schickt sie
 * joinrun.js, und niemand holte sie zurueck. In BN3.1 dasselbe ab 19,25 h.
 * In BN3 kostet das die Syndicate-Stuecke in der ersten Corp-Torrunde
 * (Bestechung nur fuer Mitglieder): 1,5-2,2 h je Lauf (hebel/vorlage.md).
 *
 * Gegen den alten Stand ist der Test ROT: syndicateTripDue gibt es dort nicht,
 * und bn4life.js laesst die Figur in Ishima stehen.
 *
 * Aufruf: node tools/test-syndicate-reise.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

// Spielerstand aus der BN2.3-Sicherung 15:50 (Knotenstunde 8,77): alles
// erfuellt ausser der Stadt.
const BN23 = {
  city: "Ishima",
  factions: ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Tetrads", "Slum Snakes",
    "Netburners", "Tian Di Hui", "CyberSec", "Bladeburners"],
  money: 3.4e10,
  skills: { hacking: 391, strength: 232, defense: 225, dexterity: 225, agility: 225 },
  jobs: {},
};
const KARMA_BN23 = -97.6;

const { modul } = await ladeAusBeiden(ROOT, "bn4life.js");

console.log("");
console.log("=== bn4life.js: Syndicate-Reise in den Corp-Knoten (H2-light 06.10.2026) ===");
console.log("");
console.log("-- Ebene 0: syndicateTripDue --");
{
  const f = modul.syndicateTripDue;
  pruefe("syndicateTripDue ist exportiert", typeof f === "function", typeof f);
  if (typeof f === "function") {
    const mit = (aend, karma = KARMA_BN23, knoten = 3) =>
      f({ ...BN23, ...aend, skills: { ...BN23.skills, ...(aend.skills || {}) } }, karma, knoten);
    pruefe("BN3, Ishima, alles erfuellt (Stand BN2.3 8,77 h) -> reisen", mit({}) === true);
    pruefe("dasselbe in Chongqing/New Tokyo/Volhaven -> reisen",
      ["Chongqing", "New Tokyo", "Volhaven"].every((c) => mit({ city: c }) === true));
    pruefe("BN2 (kein Corp-Knoten) -> NICHT reisen", mit({}, KARMA_BN23, 2) === false);
    pruefe("BN10 -> NICHT reisen", mit({}, KARMA_BN23, 10) === false);
    pruefe("schon in Sector-12 -> nicht reisen", mit({ city: "Sector-12" }) === false);
    pruefe("schon in Aevum -> nicht reisen (Aevum zaehlt auch)", mit({ city: "Aevum" }) === false);
    pruefe("schon Mitglied -> nicht reisen",
      mit({ factions: [...BN23.factions, "The Syndicate"] }) === false);
    pruefe("Karma -89 (Grenze -90) -> nicht reisen", mit({}, -89) === false);
    pruefe("Karma genau -90 -> reisen (FactionJoinCondition: karma <= n)", mit({}, -90) === true);
    pruefe("ein Kampfwert 199 -> nicht reisen", mit({ skills: { agility: 199 } }) === false);
    pruefe("alle Kampfwerte genau 200 -> reisen",
      mit({ skills: { strength: 200, defense: 200, dexterity: 200, agility: 200 } }) === true);
    pruefe("Hacking 199 -> nicht reisen", mit({ skills: { hacking: 199 } }) === false);
    pruefe("10,1 Mio (nach 200k Reise unter 10 Mio) -> nicht reisen", mit({ money: 10.1e6 }) === false);
    pruefe("12,1 Mio (Puffer 2 Mio ueber 10,2 nicht erreicht) -> nicht reisen", mit({ money: 12.1e6 }) === false);
    pruefe("12,2 Mio -> reisen", mit({ money: 12.2e6 }) === true);
    pruefe("Stelle bei der CIA (ausgeschriebener Name) -> nicht reisen",
      mit({ jobs: { "Central Intelligence Agency": "Field Agent" } }) === false);
    pruefe("Stelle bei der NSA -> nicht reisen",
      mit({ jobs: { "National Security Agency": "Field Agent" } }) === false);
    pruefe("Stelle bei einer anderen Firma stoert nicht",
      mit({ jobs: { MegaCorp: "Software Engineering Intern" } }) === true);
    pruefe("kaputter Spielerdatensatz -> nicht reisen, kein Wurf", f(null, -100, 3) === false);
  }
  const g = modul.graftStartPending;
  pruefe("graftStartPending ist exportiert", typeof g === "function", typeof g);
  if (typeof g === "function") {
    const t = 1_800_000_000_000;
    const antrag = (wall) => JSON.stringify({ tool: "graft.js", prio: 10, action: "graft", wall, ttlMs: 150000 });
    pruefe("New Tokyo + frischer Graft-Antrag -> Reise zurueckhalten", g("New Tokyo", antrag(t - 10000), t) === true);
    pruefe("New Tokyo + abgelaufener Antrag -> Reise frei", g("New Tokyo", antrag(t - 200000), t) === false);
    pruefe("New Tokyo ohne Antrag -> Reise frei", g("New Tokyo", "", t) === false);
    pruefe("Ishima + frischer Antrag -> Reise frei (graft.js reist selbst)", g("Ishima", antrag(t - 10000), t) === false);
    pruefe("kaputter Antrag -> Reise frei, kein Wurf", g("New Tokyo", "{kaputt", t) === false);
  }
}

console.log("");
console.log("-- Gleichlauf mit lib/corpgeld.js CORP_MONEY_NODES --");
{
  const corpgeld = await import(pathToFileURL(path.join(ROOT, "src", "lib", "corpgeld.js")).href);
  pruefe("SYNDICATE_TRIP_NODES == CORP_MONEY_NODES",
    JSON.stringify(modul.SYNDICATE_TRIP_NODES) === JSON.stringify(corpgeld.CORP_MONEY_NODES),
    JSON.stringify(modul.SYNDICATE_TRIP_NODES) + " / " + JSON.stringify(corpgeld.CORP_MONEY_NODES));
  pruefe("Zielstadt erfuellt die Stadtbedingung (Aevum oder Sector-12)",
    ["Aevum", "Sector-12"].includes(modul.SYNDICATE_CITY), String(modul.SYNDICATE_CITY));
}

/** Eine Runde bn4life.js im Mock; liefert Reisen und Log. */
async function fahre({ knoten, stadt, karma, faktionen = BN23.factions, skills = BN23.skills }) {
  const m = neuerMock({
    host: "home",
    knoten,
    wall: W0,
    playtime: 8.77 * 3600000,
    nodeReset: W0 - 8.77 * 3600000,
    augReset: W0 - 8.77 * 3600000,
    geld: BN23.money,
    faktionen,
    server: { home: { ram: 512, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    // Die Beitrittsmarke gilt schon - der Test soll nicht joinrun.js starten.
    dateien: { home: { "bn4net.js": "//", "data/beitritt-erledigt.txt": String(W0) } },
    maxSchlaf: 1,
  });
  m.zustand.spieler.city = stadt;
  m.zustand.spieler.skills = { ...skills };
  const reisen = [];
  // Der Mock baut nur die Teilmenge, die Gewerke rufen; was bn4life.js hier
  // zusaetzlich braucht, wird fuer diesen Test eingehaengt. Der Proxy des
  // Mocks hat keine set-Falle - die Zuweisung landet im Zielobjekt.
  m.ns.heart = { break: () => karma };
  m.ns.singularity.checkFactionInvitations = () => [];
  m.ns.singularity.joinFaction = () => false;
  m.ns.singularity.travelToCity = (c) => {
    reisen.push(c); m.zustand.spieler.city = c; return true;
  };
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return { reisen, log: m.lies("home", "data/bn4life-log.txt") || "" };
}

console.log("");
console.log("-- Ebene 2: eine Runde bn4life.js --");
{
  const { reisen, log } = await fahre({ knoten: 3, stadt: "Ishima", karma: KARMA_BN23 });
  pruefe("BN3, Ishima, Stand BN2.3 8,77 h: Reise nach Sector-12",
    reisen.includes("Sector-12"), JSON.stringify(reisen) + " | " + log.slice(-300));
  pruefe("und das steht im Log", /The Syndicate/.test(log), log.slice(-300));
}
{
  const { reisen } = await fahre({ knoten: 2, stadt: "Ishima", karma: KARMA_BN23 });
  pruefe("BN2 mit demselben Stand: keine Reise", reisen.length === 0, JSON.stringify(reisen));
}
{
  const { reisen } = await fahre({ knoten: 3, stadt: "Ishima", karma: -70.6 });
  pruefe("BN3, Karma -70,6 (BN2.3 bei 7,77 h): noch keine Reise", reisen.length === 0, JSON.stringify(reisen));
}
{
  const { reisen } = await fahre({ knoten: 3, stadt: "Sector-12", karma: KARMA_BN23 });
  pruefe("BN3, schon in Sector-12: keine Reise", reisen.length === 0, JSON.stringify(reisen));
}
{
  const { reisen } = await fahre({ knoten: 3, stadt: "Ishima", karma: KARMA_BN23,
    faktionen: [...BN23.factions, "The Syndicate"] });
  pruefe("BN3, schon Mitglied: keine Reise", reisen.length === 0, JSON.stringify(reisen));
}

console.log("");
console.log(`=== ${gruen} gruen, ${rot} rot ===`);
if (rot) {
  for (const f of fehler) console.log("  - " + f);
  process.exit(1);
}
