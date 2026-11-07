/**
 * Ereignisstrom: bleibende Eintraege ueberleben die Schreiber auf der
 * Werkbank, ein Dauerkonflikt flutet nicht (07.11.2026).
 *
 * BN15.2, 07.11.: figwatch.js schrieb von 03:21 bis 06:41 UTC 399 gleiche
 * Vermerke "Figur-Konflikt: vergeben fuer bladeburner, tatsaechlich faktion"
 * und beschnitt den Strom dabei selbst per shift() auf 400 - ohne Ruecksicht
 * auf die bleibenden Arten. Der Sprung BN15.1 -> BN15.2 und der Einbau
 * flogen hinaus; queued_augs_at_jump und jump_latency_min verloren ihre
 * Quelle. graftauto.js trug denselben Code.
 *
 * Geprueft gegen den ns-Mock (Ebene 2):
 *  1. figwatch, 20 Runden Dauerkonflikt: hoechstens EIN Vermerk.
 *     Gegen die alte Fassung ROT (ein Vermerk je zwei Runden).
 *  2. figwatch auf vollem Strom (jump, install + 400 Vermerke): jump und
 *     install bleiben. Gegen die alte Fassung ROT.
 *  3. Konflikt wechselt (faktion -> nichts -> faktion): jeder Wechsel ein
 *     Vermerk, drei insgesamt (keine Taubheit nach der ersten Meldung).
 *  4. Flatternder Konflikt (2 Runden falsch, 1 richtig): ein Vermerk.
 *  5. graftauto.js und popups.js nutzen lib/events.js, kein Beschnitt von Hand.
 *  6. Registry: figwatch.js, graftauto.js, popups.js bringen lib/events.js mit.
 *
 * Aufruf: node tools/test-ereignisstrom.js [repo-verzeichnis]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

const W0 = 1_700_000_000_000;

function vollerStrom() {
  const e = [
    { art: "jump", text: "exit.js gestartet: BitNode 15 -> 15 Stufe 2", wall: W0 - 9e6, playtime: 0, motorTimeMs: 0,
      daten: { wartendeAugs: 1, wartendeGeprueft: true } },
    { art: "install", text: "Augmentierungen eingebaut", wall: W0 - 8e6, playtime: 0, motorTimeMs: 0 },
  ];
  for (let i = 0; i < 400; i++) e.push({ art: "note", text: "alt " + i, wall: W0 - 7e6 + i, playtime: 0, motorTimeMs: 0 });
  return JSON.stringify({ version: 1, eintraege: e });
}

// arbeit: Funktion (runde) -> getCurrentWork-Ergebnis
async function fahreFigwatch({ runden, strom, arbeit, mitAktion = null }) {
  let runde = 0;
  const m = neuerMock({
    host: "home", knoten: 15, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000, geld: 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/figure.txt": JSON.stringify({
        owner: "blade.js", action: "bladeburner", prio: 20, seq: 1,
        nodeReset: W0 - 24 * 3600000, wall: W0, leaseMs: 900000, leaseBis: W0 + 24 * 3600000,
        ...(mitAktion ? { mit: ["bn4rep.js"], mitAktion } : {}),
      }),
      ...(strom ? { "data/events.json": strom } : {}),
    } },
    maxSchlaf: runden,
    beiSchlaf: (ms, z, vorRuecken) => { runde++; m.zustand.arbeit = arbeit(runde); vorRuecken(ms); },
  });
  m.zustand.arbeit = arbeit(0);
  const modul = await ladeSpielskript(path.join(ROOT, "src", "figwatch.js"));
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  const roh = m.ns.read("data/events.json");
  return roh ? JSON.parse(roh).eintraege : [];
}

const FAKTION = { type: "FACTION", factionName: "Tian Di Hui" };
const konflikte = (e) => e.filter((x) => String(x.text).startsWith("Figur-Konflikt")).length;

console.log("\n=== Ereignisstrom: bleibende Eintraege, keine Konfliktflut ===\n");

{
  const e = await fahreFigwatch({ runden: 20, strom: null, arbeit: () => FAKTION });
  pruefe("Dauerkonflikt 20 Runden: genau ein Vermerk", konflikte(e) === 1, konflikte(e) + " Vermerke");
}
{
  const e = await fahreFigwatch({ runden: 20, strom: vollerStrom(), arbeit: () => FAKTION });
  pruefe("voller Strom: jump bleibt", e.some((x) => x.art === "jump"), e.length + " Eintraege");
  pruefe("voller Strom: install bleibt", e.some((x) => x.art === "install"));
}
{
  // Runden 0-4 Faktion, 5-9 nichts (im Mock laeuft keine Bladeburner-Aktion -
  // auch das ist ein Konflikt, aber ein anderer), 10-19 wieder Faktion
  const e = await fahreFigwatch({ runden: 20, strom: null,
    arbeit: (r) => (r >= 5 && r < 10 ? null : FAKTION) });
  pruefe("Konflikt wechselt dreimal: drei Vermerke", konflikte(e) === 3, konflikte(e) + " Vermerke");
}

{
  // Parallelarbeit Faktion ist erlaubt (mitAktion), ein Verbrechen nicht
  const VERBRECHEN = { type: "CRIME", crimeType: "Homicide" };
  const e = await fahreFigwatch({ runden: 30, strom: null, mitAktion: "faktion",
    arbeit: (r) => (r % 3 === 2 ? FAKTION : VERBRECHEN) });
  pruefe("flatternder Konflikt 30 Runden: ein Vermerk", konflikte(e) === 1, konflikte(e) + " Vermerke");
}

const graft = fs.readFileSync(path.join(ROOT, "src", "graftauto.js"), "utf8");
pruefe("graftauto.js haengt ueber lib/events.js an",
  /from "lib\/events\.js"/.test(graft) && !/eintraege\.shift\(\)/.test(graft));

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
const eintraege = Array.isArray(reg) ? reg : (reg.gewerke || reg.tools || reg.eintraege || Object.values(reg).find(Array.isArray));
const pop = fs.readFileSync(path.join(ROOT, "src", "popups.js"), "utf8");
pruefe("popups.js haengt ueber lib/events.js an",
  pop.includes('from "lib/events.js"') && !pop.includes("eintraege.slice(-200)"));

for (const n of ["figwatch.js", "graftauto.js", "popups.js"]) {
  const r = (eintraege || []).find((x) => x.name === n);
  pruefe("Registry: " + n + " bringt lib/events.js mit", !!r && (r.needsLibs || []).includes("lib/events.js"));
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
