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
console.log("-- 5. ueber die Lease hinaus: joinrun haelt sein eigenes Training (Integration, 27.09.2026) --");
{
  /**
   * DER FALL, DEN ABSCHNITT 3 NICHT SIEHT. Abschnitt 3 laeuft 10 Ticks zu
   * 15 s = 150 s - weit unter LEASE_MS (15 min). joinrun erneuerte seinen
   * Antrag nur, solange KEIN Kurs lief (`if (!trainiertSchon)`); sobald sein
   * eigenes Training stand, verfiel der Antrag nach ANTRAG_TTL_MS (150 s), die
   * Lease lief 15 min nach der letzten Erneuerung ab, und der naechste
   * bn4rep-Antrag (faktion, 30) bekam die Figur. bn4rep ruft dann
   * workForFaction - das beendet das Gym. joinrun beantragt 15 s spaeter
   * wieder mit 25 und gewinnt: ein Ping-Pong im 15-Minuten-Takt, genau das,
   * was lib/figur.js verhindern soll.
   *
   * Hier spielt der Schiedsrichter bn4rep MIT seiner Handlung nach: haelt
   * bn4rep die Figur und laeuft keine Faktionsarbeit, startet es sie (so wie
   * bn4rep.js :2374ff. nach `figFrei`). 90 Ticks = 22,5 min > 15 min Lease.
   */
  let gymStarts = 0;
  let bn4repUebernahmen = 0;
  const schiri = baueSchiedsrichter({ konkurrenz: true });
  const m = await fahre({
    konkurrenz: true,
    runden: 90,
    beiSchlaf: (ms, z, vor) => {
      schiri(ms, z, vor);
      const dh = z.dateien.home || {};
      let v = null;
      try { v = dh["data/figure.txt"] ? JSON.parse(dh["data/figure.txt"]) : null; } catch { v = null; }
      if (v && v.owner === "bn4rep.js" && !(z.arbeit && z.arbeit.type === "FACTION")) {
        z.arbeit = { type: "FACTION", factionName: "CyberSec", factionWorkType: "hacking" };
        bn4repUebernahmen++;
      }
    },
  });
  // gymWorkout zaehlen: der Mock kennt keinen Zaehler, also am Ende aus dem
  // Protokoll von joinrun.js lesen ("Training <feld> (...)").
  const log = m.lies("home", "data/joinrun.txt") || "";
  gymStarts = (log.match(/Training (strength|defense|dexterity|agility) \(/g) || []).length;
  pruefe("bn4rep bekommt die Figur waehrend joinrun trainiert NIE (kein Ablauf der Lease)",
    bn4repUebernahmen === 0, bn4repUebernahmen + " Uebernahme(n) durch bn4rep in 22,5 min");
  pruefe("genau EIN Gym-Start in 22,5 min (kein 15-Minuten-Ping-Pong)",
    gymStarts === 1, gymStarts + " Gym-Starts\n" + log);
  pruefe("am Ende trainiert joinrun noch",
    m.zustand.arbeit && m.zustand.arbeit.type === "CLASS", JSON.stringify(m.zustand.arbeit));
}

console.log("");
console.log("-- 6. fremdes Training (bbtrain) wird NICHT beantragt --");
{
  // Laeuft schon ein Kurs, den joinrun NICHT gestartet hat (bbtrain.js mit
  // PRIO.gym 40), darf joinrun ihn nicht mit 25 an sich reissen - sonst
  // verlore bbtrain die Figur an einen Antragsteller, der gar nichts tut.
  const m = await fahre({
    konkurrenz: false,
    runden: 4,
    dateien: {},
  });
  // Vorbelegung nach dem Start ist im Mock nicht vorgesehen - deshalb hier
  // der einfachste Beleg: ein Lauf, der mit laufendem Kurs BEGINNT.
  const m2 = neuerMock({
    host: "home", knoten: 5, wall: W0, playtime: 100 * 3600000, nodeReset: NR,
    augReset: W0 - 3600000, geld: 5e9,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {} },
    maxSchlaf: 4,
    beiSchlaf: baueSchiedsrichter({ konkurrenz: false }),
  });
  m2.zustand.spieler.city = "Sector-12";
  m2.zustand.spieler.factions = [];
  m2.zustand.spieler.skills = { strength: 10, defense: 10, dexterity: 10, agility: 10, hacking: 100 };
  m2.zustand.arbeit = { type: "CLASS", classType: "agi", location: "Powerhouse Gym" };
  m2.ns.singularity.checkFactionInvitations = () => [];
  m2.ns.singularity.joinFaction = () => false;
  m2.ns.singularity.getAugmentationsFromFaction = () => [];
  m2.ns.singularity.getAugmentationRepReq = () => 0;
  m2.ns.singularity.getOwnedAugmentations = () => [];
  const { modul } = await ladeAusBeiden(ROOT, "joinrun.js");
  const zurueck = m2.uhrStellen();
  try { await modul.main(m2.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  pruefe("kein joinrun-Antrag, solange ein fremder Kurs laeuft",
    !m2.lies("home", "data/figure-request-joinrun.js.json"),
    String(m2.lies("home", "data/figure-request-joinrun.js.json")));
  pruefe("(Gegenprobe) ohne fremden Kurs beantragt joinrun",
    !!m.lies("home", "data/figure-request-joinrun.js.json"));
}

console.log("");
console.log("-- 7. Ueberschiessen: das eigene Training endet aktiv, sobald sein Ziel erreicht ist --");
{
  /**
   * AUDIT G-UEBERSCHIESSEN (27.09.2026). Die Schleife hat `offen.length`
   * bisher nur beim NAECHSTEN Durchlauf geprueft, aber `gymWorkout` laeuft im
   * Spiel WEITER, bis etwas anderes die Figur uebernimmt - `Player.
   * currentWork` ist an kein Skript gebunden. Belegt an der Sicherung von
   * heute: Staerke 1 -> ~199 statt Ziel 80 in einem einzigen Lauf. Nur
   * Agilitaet fehlt hier zu Beginn; nachdem das Spiel sie (unabhaengig vom
   * Skript) ueber das Ziel getrieben hat, muss joinrun den eigenen Kurs aktiv
   * beenden statt ihn weiterlaufen zu lassen.
   */
  const ZIEL_TEST = 20;
  const m = neuerMock({
    host: "home", knoten: 5, wall: W0, playtime: 100 * 3600000, nodeReset: NR,
    augReset: W0 - 3600000, geld: 5e9, args: [ZIEL_TEST],
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {} },
    maxSchlaf: 6,
    beiSchlaf: (ms, z, vor) => {
      baueSchiedsrichter({ konkurrenz: false })(ms, z, vor);
      // Sobald joinrun selbst "agi" trainiert, treibt das Spiel den Wert
      // (unabhaengig vom Skript) ueber das Ziel - genau der Beleg von heute.
      if (!z.__ueberschossen && z.arbeit && z.arbeit.classType === "agi") {
        z.spieler.skills.agility = ZIEL_TEST + 5;
        z.__ueberschossen = true;
      }
    },
  });
  m.zustand.spieler.city = "Sector-12";
  m.zustand.spieler.factions = [];
  m.zustand.spieler.skills = { strength: ZIEL_TEST, defense: ZIEL_TEST, dexterity: ZIEL_TEST, agility: 5, hacking: 100 };
  m.ns.singularity.checkFactionInvitations = () => [];
  m.ns.singularity.joinFaction = () => false;
  m.ns.singularity.getAugmentationsFromFaction = () => [];
  m.ns.singularity.getAugmentationRepReq = () => 0;
  m.ns.singularity.getOwnedAugmentations = () => [];
  const { modul } = await ladeAusBeiden(ROOT, "joinrun.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  pruefe("stopAction wurde aufgerufen, sobald Agilitaet das Ziel erreichte",
    m.zustand.gestoppt === true, "gestoppt=" + m.zustand.gestoppt);
  pruefe("am Ende laeuft KEIN Kurs mehr (kein Weitertrainieren ueber das Ziel hinaus)",
    !m.zustand.arbeit, JSON.stringify(m.zustand.arbeit));
  const log = m.lies("home", "data/joinrun.txt") || "";
  pruefe("das Log nennt das erreichte Ziel fuer agi",
    log.includes("agi erreicht"), log);
}

console.log("");
console.log("-- 8. Stadt wird unter der Lease nachgezogen (Audit G2/6#4) --");
{
  /**
   * Beleg aus der Sicherung von heute: 10:08:39 bis 10:29:24, 84 mal
   * "gymWorkout(dex) abgelehnt." im 15-Sekunden-Takt, OHNE dass joinrun die
   * Figur je verlor - `gymWorkout` lehnt bei falscher Stadt ab
   * (Singularity.ts:302-336), und die Reise stand bisher nur EINMAL vor der
   * Schleife. Die alte Reise VOR der Schleife faengt eine Drift zum Start ab
   * - der eigentliche Fehler zeigt sich erst, wenn die Stadt WAEHREND des
   * Laufs wegdriftet (bn4life.js reist fuer die Aevum-Faktion, ohne
   * Lease-Pruefung). Hier startet die Figur richtig in Sector-12, trainiert
   * Fingerfertigkeit (dex) bis zum Ziel - und GENAU IN DEM MOMENT, in dem das
   * Ziel erreicht ist, "reist" bn4life sie nach Aevum, bevor joinrun den
   * naechsten Wert (Agilitaet) angehen kann.
   */
  const ZIEL_TEST = 20;
  const m = neuerMock({
    host: "home", knoten: 5, wall: W0, playtime: 100 * 3600000, nodeReset: NR,
    augReset: W0 - 3600000, geld: 5e9, args: [ZIEL_TEST],
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {} },
    maxSchlaf: 8,
    beiSchlaf: (ms, z, vor) => {
      baueSchiedsrichter({ konkurrenz: false })(ms, z, vor);
      // dex erreicht das Ziel UND die Figur driftet im selben Moment ab -
      // bn4life.js reist unabhaengig von der Figur-Lease (Abschnitt "1b").
      if (!z.__abgedriftet && z.arbeit && z.arbeit.classType === "dex") {
        z.spieler.skills.dexterity = ZIEL_TEST;
        z.spieler.city = "Aevum";
        z.__abgedriftet = true;
      }
    },
  });
  m.zustand.spieler.city = "Sector-12";
  m.zustand.spieler.factions = [];
  m.zustand.spieler.skills = { strength: ZIEL_TEST, defense: ZIEL_TEST, dexterity: 5, agility: 5, hacking: 100 };
  m.ns.singularity.checkFactionInvitations = () => [];
  m.ns.singularity.joinFaction = () => false;
  m.ns.singularity.getAugmentationsFromFaction = () => [];
  m.ns.singularity.getAugmentationRepReq = () => 0;
  m.ns.singularity.getOwnedAugmentations = () => [];
  // Der Mock kennt die Stadtpruefung von Haus aus nicht (er merkt sich nur,
  // was gewaehlt wurde) - hier nachgebaut, wie es das Spiel tatsaechlich tut.
  const echtGymWorkout = m.ns.singularity.gymWorkout.bind(m.ns.singularity);
  m.ns.singularity.gymWorkout = (ort, stat, focus) =>
    m.zustand.spieler.city === "Sector-12" ? echtGymWorkout(ort, stat, focus) : false;

  const { modul } = await ladeAusBeiden(ROOT, "joinrun.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  const log = m.lies("home", "data/joinrun.txt") || "";
  pruefe("joinrun reist unter der Lease selbst zurueck nach Sector-12",
    m.zustand.spieler.city === "Sector-12", "Stadt: " + m.zustand.spieler.city);
  pruefe("und trainiert Agilitaet danach erfolgreich - kein einziges 'abgelehnt' im Log",
    !log.includes("abgelehnt"), log);
  pruefe("am Ende laeuft der Kurs fuer agi",
    m.zustand.arbeit && m.zustand.arbeit.classType === "agi", JSON.stringify(m.zustand.arbeit));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
