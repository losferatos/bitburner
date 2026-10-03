// Nachstellung des Tab-Einfrierens vom 03.10.2026: ein Durchlauf blade.js im
// ns-Mock mit Typhoon-Chance c (ohne Trupp) und Rang r. Haengt blade.js, endet
// dieser Prozess nie - der Aufrufer setzt das Zeitlimit.
// Aufruf: node tools/audit/repro-freeze.mjs --blade <pfad> --rang 2260 --chance 0.102 [--runden 2]
import { neuerMock } from "../mock/ns.js";
import { ladeSpielskript } from "../mock/lader.js";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const BLADE = arg("--blade");
const RANG = Number(arg("--rang", "2260"));
const ZIEL = Number(arg("--chance", "0.102"));
const RUNDEN = Number(arg("--runden", "2"));
const W0 = 1_700_000_000_000;
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

function aktionen() {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 100, stufe: 1, maxStufe: 15, dauer: 30000, ...vorgabe };
  };
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"], { chance: 0.9 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"], { chance: 0.95 });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { chance: 1, vorrat: Infinity });
  raus["Black Operations/Operation Typhoon"] = { chance: 0.01, spanne: 0, vorrat: 1 };
  return raus;
}
// Kampfwerte wie im Spielstand BN2L1 03.10. (gerundet)
const SKILLS = { hacking: 372, strength: 194, defense: 181, dexterity: 181, agility: 181, charisma: 57, intelligence: 153 };

async function fahre(rang, mult) {
  const m = neuerMock({
    host: "home", knoten: 2, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000, geld: 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/verfahren.txt": "V2 2 1",
      "data/bn4net.json": JSON.stringify({ wall: W0, nodeReset: W0 - 24 * 3600000, motorTimeMs: 3600000,
        okRound: 100, errStreak: 0, round: 100, phase: "normal" }),
      "data/figure.txt": JSON.stringify({ owner: "blade.js", action: "bladeburner", detail: "Rangaufbau", seq: 1,
        nodeReset: W0 - 24 * 3600000, leaseBis: W0 + 24 * 3600000 }),
    } },
    maxSchlaf: RUNDEN,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1000),
    blade: {
      drin: true, rang, punkte: 0, ausdauer: [100, 100], stadt: "Sector-12", truppe: 0,
      staedte: Object.fromEntries(STAEDTE.map((s) => [s, { chaos: 10, comms: 60, pop: 1.2e9 }])),
      aktionen: aktionen(), fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    },
  });
  Object.assign(m.zustand.spieler.skills, SKILLS);
  m.zustand.spieler.mults = { bladeburner_success_chance: mult };
  const modul = await ladeSpielskript(BLADE);
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  let lage = null;
  try { lage = JSON.parse(m.lies("home", "data/blade.json")); } catch { lage = null; }
  return lage;
}

// Probe bei Rang 1000 (Anfrage aus), Mult 1: liefert die gerechnete Chance
const probe = await fahre(1000, 1);
const c1 = probe && probe.boChancen ? probe.boChancen["Operation Typhoon"] : null;
const mult = ZIEL / c1;
const lage = await fahre(RANG, mult);
console.log(JSON.stringify({ c1, mult, rang: RANG, boChance: lage && lage.boChancen && lage.boChancen["Operation Typhoon"],
  truppAnfrage: lage && lage.truppAnfrage, fertig: true }));
