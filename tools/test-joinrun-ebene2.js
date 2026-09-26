/**
 * Ebene 2: `src/joinrun.js` gegen den ns-Mock - der C2-Blocker (26.09.2026,
 * Audit-Fund 3#6/6#4, Paket C).
 *
 * ===========================================================================
 * WARUM
 * ===========================================================================
 *
 * joinrun.js beantragte die Figur bisher mit `PRIO.gym` (40). bn4rep.js
 * beantragt `PRIO.faktion` (30) praktisch pausenlos, sobald irgendeine
 * Faktion Arbeit hat - in einem V1-Knoten (BN5.3, BN12.1-3) ist das der
 * Dauerzustand, nicht die Ausnahme. `vergib()` (lib/figur.js) waehlt bei
 * jedem Tick die kleinere Zahl: 30 < 40, also gewann bn4rep IMMER, und
 * joinrun trainierte in einem V1-Knoten faktisch nie (Bericht 3#6/6#4).
 *
 * Die pure Arbitrierung (RED bei PRIO 40, GREEN bei PRIO.beitritt 25) steht
 * bereits in `tools/test-figur.js` gegen `vergib()` selbst. Dieser Test hier
 * prueft die ANDERE Haelfte: laeuft `joinrun.js` WIRKLICH (ueber den
 * ns-Mock) gegen eine gleichzeitig laufende Konkurrenzanfrage, bekommt und
 * BEHAELT es die Figur mit seiner tatsaechlichen Beantragung
 * (`FIG_PRIO.beitritt` aus `lib/figur.js`, importiert in joinrun.js selbst -
 * kein nachgebauter Wert)?
 *
 * DER "KERN" WIRD IM TEST NACHGEBAUT (kein Mock dafuer vorhanden): jeder
 * `ns.sleep`-Aufruf (`beiSchlaf`) sammelt die Antragsdateien ein - genau wie
 * `bn4net.js` Abschnitt 9b - ruft `vergib()` (dieselbe Funktion, die auch der
 * echte Kern aufruft) auf und schreibt `data/figure.txt`. joinrun.js selbst
 * bleibt dabei unveraendert; nur die Schiedsrichter-Rolle des Kerns wird
 * nachgestellt.
 *
 * Aufruf: node tools/test-joinrun-ebene2.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

const F = await import(pathToFileURL(path.join(ROOT, "src", "lib", "figur.js")).href);

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
const NR = 0;   // knotenStempel(ns) faellt ohne data/bn4net.json auf 0 zurueck

/**
 * Baut den Kern-Schiedsrichter nach: liest alle bekannten Antragsdateien,
 * ruft `vergib()` (dieselbe Funktion wie bn4net.js Abschnitt 9b) und schreibt
 * `data/figure.txt`. `konkurrenz`, wenn gesetzt, erneuert JEDEN Tick einen
 * PRIO.faktion(30)-Antrag von "bn4rep.js" - das bildet den V1-Dauerzustand
 * nach, in dem bn4rep praktisch pausenlos Faktionsarbeit beantragt.
 */
function baueSchiedsrichter({ konkurrenz }) {
  return (ms, z, vor) => {
    const dh = z.dateien.home || (z.dateien.home = {});
    if (konkurrenz) {
      const bnAntrag = F.antrag("bn4rep.js", F.PRIO.faktion, "faktion",
        "irgendeine Faktion", "Faktionsarbeit", { wall: z.wall, motorTimeMs: 0, nodeReset: NR });
      dh["data/figure-request-bn4rep.js.json"] = JSON.stringify(bnAntrag);
    }
    const antraege = [];
    for (const [name, inhalt] of Object.entries(dh)) {
      if (!name.startsWith("data/figure-request-")) continue;
      try { antraege.push(JSON.parse(inhalt)); } catch { /* unlesbar zaehlt nicht */ }
    }
    let bisher = null;
    try { bisher = dh["data/figure.txt"] ? JSON.parse(dh["data/figure.txt"]) : null; } catch { bisher = null; }
    const e = F.vergib(antraege, bisher, z.wall, NR, undefined);
    dh["data/figure.txt"] = JSON.stringify(e.vergabe || {
      owner: null, action: null,
      seq: (bisher && Number.isFinite(bisher.seq) ? bisher.seq : 0) + 1,
      wall: z.wall, nodeReset: NR, leaseBis: 0,
    });
    vor(ms);
  };
}

async function fahre(o = {}) {
  const m = neuerMock({
    host: "home",
    knoten: o.knoten ?? 5,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: NR,
    augReset: W0 - 3600000,
    geld: o.geld ?? 5e9,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { ...(o.dateien || {}) } },
    maxSchlaf: o.runden ?? 4,
    beiSchlaf: o.beiSchlaf || baueSchiedsrichter({ konkurrenz: o.konkurrenz }),
  });

  // WAS DER MOCK NICHT KENNT (er baut nicht jedes ns nach, siehe
  // tools/mock/ns.js): `getPlayer()` spiegelt `zustand.spieler` 1:1, also
  // reichen zusaetzliche Felder direkt am Objekt.
  m.zustand.spieler.city = "Sector-12";        // keine Reise-Nebenwirkung noetig
  m.zustand.spieler.factions = [];             // noch in keiner der drei Zielfaktionen
  m.zustand.spieler.skills = {
    strength: 10, defense: 10, dexterity: 10, agility: 10, hacking: 100,
  };
  // gymWorkout/getCurrentWork/travelToCity kennt der Mock schon (fuer
  // bbtrain.js gebaut); die restlichen Singularity-Aufrufe im Faktionsteil
  // von joinrun.js fehlen - Stubs direkt am Proxy-Ziel (wie in
  // test-hacknet-ebene2.js Probe 5 fuer getPurchaseNodeCost/purchaseNode).
  m.ns.singularity.checkFactionInvitations = () => [];
  m.ns.singularity.joinFaction = () => false;
  m.ns.singularity.getAugmentationsFromFaction = () => [];
  m.ns.singularity.getAugmentationRepReq = () => 0;
  m.ns.singularity.getOwnedAugmentations = () => [];

  // DIE DAEDALUS-SCHWELLE (Ebene 2, siehe unten): der Mock kennt weder
  // `getResetInfo().ownedAugs` noch `getBitNodeMultipliers` von Haus aus.
  // `ownedAugsSize` setzt die installierten Augs direkt in resetInfo (ein
  // flacher Spread in `getPlayer`-Manier, siehe tools/mock/ns.js); ohne
  // `bnMult` bleibt `ns.getBitNodeMultipliers` schlicht undefiniert und der
  // Aufruf `ns.getBitNodeMultipliers()` wirft von selbst (TypeError) - genau
  // der "kein SF5/BN5"-Fall, den joinrun.js abfaengt.
  if (Number.isFinite(o.ownedAugsSize)) {
    m.zustand.resetInfo.ownedAugs = new Map(
      Array.from({ length: o.ownedAugsSize }, (_, i) => ["Aug" + i, 1]));
  }
  if (Number.isFinite(o.bnMult)) {
    m.ns.getBitNodeMultipliers = () => ({ DaedalusAugsRequirement: o.bnMult });
  }

  const { modul } = await ladeAusBeiden(ROOT, "joinrun.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

console.log("");
console.log("=== joinrun.js gegen den ns-Mock (C2-Blocker, 26.09.2026) ===");

console.log("");
console.log("-- 1. ohne Konkurrenz: trainiert wie erwartet --");
{
  const m = await fahre({ konkurrenz: false, runden: 3 });
  pruefe("gymWorkout wurde aufgerufen", m.zustand.arbeit && m.zustand.arbeit.type === "CLASS",
    JSON.stringify(m.zustand.arbeit));
}

console.log("");
console.log("-- 2. GREEN: PRIO.beitritt (25) gewinnt gegen eine DAUERHAFTE PRIO.faktion(30) --");
{
  // bn4rep.js erneuert seinen Antrag JEDEN Tick (baueSchiedsrichter mit
  // konkurrenz:true) - der V1-Dauerzustand aus Bericht 3#6/6#4. Mit der
  // alten Beantragung (PRIO.gym, 40) haette joinrun hier NIE trainiert; mit
  // `FIG_PRIO.beitritt` (25, aus lib/figur.js, unveraendert von joinrun.js
  // selbst importiert) muss es die Figur bekommen.
  const m = await fahre({ konkurrenz: true, runden: 6 });
  pruefe("joinrun bekommt die Figur trotz Dauerkonkurrenz auf PRIO.faktion",
    m.zustand.arbeit && m.zustand.arbeit.type === "CLASS",
    "arbeit=" + JSON.stringify(m.zustand.arbeit) + " - das war GENAU der C2-Blocker (Audit 3#6/6#4)");
  const vergabe = m.lies("home", "data/figure.txt");
  const v = vergabe ? JSON.parse(vergabe) : null;
  pruefe("die Vergabe steht auf joinrun.js", v && v.owner === "joinrun.js", JSON.stringify(v));
}

console.log("");
console.log("-- 3. UND BEHAELT sie: kein Ping-Pong ueber mehrere Ticks --");
{
  // Laenger laufen lassen (10 Runden) - waere PRIO.beitritt nicht echt
  // niedriger als PRIO.faktion, wechselte die Vergabe bei jedem erneuerten
  // bn4rep-Antrag zurueck (das Ping-Pong-Muster, das die Figur-Regel
  // ueberhaupt verhindern soll, Position C.11).
  const m = await fahre({ konkurrenz: true, runden: 10 });
  const log = m.lies("home", "data/joinrun.txt") || "";
  const nichtFrei = (log.match(/Figur nicht frei/g) || []).length;
  pruefe("am Ende trainiert joinrun (nicht bn4rep)",
    m.zustand.arbeit && m.zustand.arbeit.type === "CLASS", JSON.stringify(m.zustand.arbeit));
  pruefe("hoechstens die ERSTE Runde meldet 'Figur nicht frei' (Anlauf, bevor die erste Vergabe steht)",
    nichtFrei <= 1, "Meldungen: " + nichtFrei + "\n" + log);
}

console.log("");
console.log("-- 4. die Daedalus-Schwelle: 29/30/31 gegen BN12 (31), throws -> fail open --");
{
  /**
   * DIE URSPRUENGLICHE AUFTRAGSLAGE (Paket C, Punkt 2) VERLANGTE GENAU DIESE
   * DREI ZAHLEN GEGEN BN12 (31) UND DEN THROW-FALL - bislang nur durch
   * Quelltext-Review belegt (FactionJoinCondition.ts:130 `p.augmentations
   * .length >= n`, BitNode.tsx:922 `Math.floor(Math.min(30 + 1.02^lvl, 40))`
   * = 31 fuer BN12 Stufe 1-3), NICHT durch einen Ebene-2-Lauf von joinrun.js
   * selbst. Das war eine Luecke im ersten Durchgang - hier geschlossen.
   */
  const einZug = { runden: 2 };   // ein bis zwei Ticks reichen fuer den Entscheid am Start

  const m29 = await fahre({ ...einZug, ownedAugsSize: 29, bnMult: 31 });
  pruefe("29 von 31 (BN12-Schwelle): Daedalus offen, joinrun trainiert",
    m29.zustand.arbeit && m29.zustand.arbeit.type === "CLASS",
    "arbeit=" + JSON.stringify(m29.zustand.arbeit));

  const m30 = await fahre({ ...einZug, ownedAugsSize: 30, bnMult: 31 });
  pruefe("30 von 31 (BN12-Schwelle): Daedalus offen, joinrun trainiert",
    m30.zustand.arbeit && m30.zustand.arbeit.type === "CLASS",
    "arbeit=" + JSON.stringify(m30.zustand.arbeit));

  const m31 = await fahre({ ...einZug, ownedAugsSize: 31, bnMult: 31 });
  pruefe("31 von 31 (BN12-Schwelle erreicht): Daedalus zu, KEIN Training",
    !m31.zustand.arbeit, "arbeit=" + JSON.stringify(m31.zustand.arbeit));
  const marke31 = m31.lies("home", "data/beitritt-erledigt.txt");
  pruefe("und die Marke wird sofort gesetzt (bn4life.js liest sie vor dem naechsten Start)",
    !!marke31, "Marke: " + JSON.stringify(marke31));
  const log31 = m31.lies("home", "data/joinrun.txt") || "";
  pruefe("mit der erwarteten Meldung", log31.includes("kein Training noetig"), log31);

  // FAIL OPEN: der Aufruf wirft (kein SF5/BN5 im Mock, `bnMult` bewusst
  // weggelassen) - selbst bei 31 von 31 Augs (Schwelle laengst erreicht,
  // WAERE sie bekannt) bleibt `daedalusOffen` auf seinem Startwert `true`
  // (joinrun.js: "dann wird NICHT blockiert - die alte, unkritische Seite").
  // Ohne Ausbau blockiert ein Gewerk, dem die Schwelle unbekannt ist, sonst
  // grundlos ein Training, das anderswo (BN ohne SF5/BN5) noch noetig ist.
  const mWirft = await fahre({ ...einZug, ownedAugsSize: 31 });   // kein bnMult -> wirft
  pruefe("ohne SF5/BN5 (Aufruf wirft): fail open, joinrun trainiert trotz 31 Augs",
    mWirft.zustand.arbeit && mWirft.zustand.arbeit.type === "CLASS",
    "arbeit=" + JSON.stringify(mWirft.zustand.arbeit));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
