/**
 * Field Analysis, wenn die Unschaerfe die Wahl kippen kann (05.11.2026).
 *
 * Gemessen in BN15.1, Volhaven: Raid brachte 34,2 Rang/min, Retirement 4,8,
 * aber der Motor sah Raid mit s.min = 0,337 (Spanne bis 1,0) und waehlte
 * Retirement. popEst lag bei einem Drittel der echten Bevoelkerung.
 *
 * Geprueft gegen den ns-Mock (Ebene 2):
 *  1. Raid [0,15-1,00] unter Retirement im Ertrag an der Untergrenze, an
 *     der Obergrenze weit vorn, nichts laeuft -> Field Analysis.
 *     Gegen die alte Fassung ROT (sie startet Retirement).
 *  2. Gegenprobe: Raid scharf geschaetzt und gut -> Raid, keine Analyse.
 *  3. Gegenprobe: Raid scharf geschaetzt und schlecht -> Retirement, keine
 *     Analyse (nichts aufzuklaeren).
 *  4. Gegenprobe: Retirement laeuft seit 80 von 94 s -> fertig fahren, keine
 *     Analyse (Restertrag schlaegt die Hoffnung).
 *
 * Aufruf: node tools/test-hoffnung.js [pfad/zu/blade.js]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden, ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const ZIEL = process.argv[2] ? path.resolve(process.argv[2]) : null;

let gruen = 0;
let rot = 0;
const fehlerListe = [];

function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehlerListe.push(text + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + text + (zusatz ? " - " + zusatz : ""));
  }
}

const W0 = 1_700_000_000_000;
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

function staedte() {
  const raus = {};
  for (const s of STAEDTE) raus[s] = { chaos: 10, comms: 60, pop: 1.2e9 };
  return raus;
}

// Retirement Stufe 71, 94 s, Chance 0,8-1,0: im Mock 25,2 Rang/min an der
// Untergrenze. Raid Stufe 18, 100 s, 55*1,1^17 = 278 Rang: im Mock 29,9 bei
// Chance 0,25, 99,7 bei 0,75 (ohne Chaos- und Bevoelkerungszuschlag, Chaos 10).
// raid = { chance, spanne } -> Spanne [chance-spanne, chance+spanne].
function aktionen(raid) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 0, stufe: 1, maxStufe: 100, dauer: 30000, chance: 1, ...vorgabe };
  };
  setze("Contracts", ["Tracking", "Bounty Hunter"], {});
  setze("Contracts", ["Retirement"], { vorrat: 100, stufe: 71, dauer: 94000, chance: 0.9, spanne: 0.1 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Stealth Retirement Operation", "Assassination"], {});
  setze("Operations", ["Raid"], { vorrat: 100, stufe: 18, dauer: 100000, ...raid });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { vorrat: Infinity });
  return raus;
}

async function fahre({ raid, laeuft = null, zeitMs = 0 }) {
  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
    geld: 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/verfahren.txt": "V2 10 2",
      "data/bn4net.json": JSON.stringify({
        wall: W0, nodeReset: W0 - 24 * 3600000, motorTimeMs: 3600000,
        okRound: 100, errStreak: 0, round: 100, phase: "normal",
      }),
      "data/figure.txt": JSON.stringify({
        owner: "blade.js", action: "bladeburner", detail: "Rangaufbau", seq: 1,
        nodeReset: W0 - 24 * 3600000, leaseBis: W0 + 24 * 3600000,
      }),
    } },
    maxSchlaf: 2,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1000),
    blade: {
      drin: true, rang: 1000, punkte: 0, ausdauer: [100, 100],
      stadt: "Sector-12", truppe: 6, staedte: staedte(),
      aktionen: aktionen(raid), fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 999999 }],
    },
  });
  m.zustand.spieler.hp = { current: 100, max: 100 };
  if (laeuft) {
    const [type, name] = laeuft.split("/");
    m.zustand.blade.aktion = { type, name };
    m.zustand.blade.aktionZeitMs = zeitMs;
  }
  const { modul } = ZIEL ? { modul: await ladeSpielskript(ZIEL) } : await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  return m;
}

const gestartet = (m) => m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);

console.log("");
console.log("=== Hoffnung: Field Analysis bei kippbarer Wahl" + (ZIEL ? " (" + ZIEL + ")" : "") + " ===");

console.log("");
console.log("-- Raid unscharf [0,15-1,00], an der Untergrenze hinter Retirement --");
{
  const m = await fahre({ raid: { chance: 0.575, spanne: 0.425 } });
  const g = gestartet(m);
  pruefe("Field Analysis wird gestartet", g[0] === "General/Field Analysis",
    g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe: Raid scharf bei 0,75 -> Raid, keine Analyse --");
{
  const m = await fahre({ raid: { chance: 0.75, spanne: 0 } });
  const g = gestartet(m);
  pruefe("Raid wird gestartet", g[0] === "Operations/Raid", g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe: Raid scharf bei 0,15 -> Retirement, keine Analyse --");
{
  const m = await fahre({ raid: { chance: 0.15, spanne: 0 } });
  const g = gestartet(m);
  pruefe("Retirement wird gestartet", g[0] === "Contracts/Retirement",
    g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("-- Gegenprobe: Retirement laeuft seit 80 von 94 s, Raid unscharf -> fertig fahren --");
{
  const m = await fahre({ raid: { chance: 0.575, spanne: 0.425 }, laeuft: "Contracts/Retirement", zeitMs: 80000 });
  const g = gestartet(m);
  pruefe("keine Field Analysis, kein Raid", !g.includes("General/Field Analysis") && !g.includes("Operations/Raid"),
    g.join(", ") || "(nichts gestartet)");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
