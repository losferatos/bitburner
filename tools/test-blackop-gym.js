/**
 * Black Op holt die Figur aus dem Gym, D2-Sonden leben (03.10.2026).
 *
 * BEFUND (aus fe3b013, BAUSTELLEN "blackOpChance/blackOpSchwelle ausserhalb
 * von waehle()"): `blackOpChance`, `blackOpSchwelle` und `spanneGenau` lagen
 * im Rumpf von `waehle()`. Vier Stellen ausserhalb riefen sie trotzdem auf;
 * dort gab es einen ReferenceError, den das umgebende try/catch still schluckte:
 *
 *   1. der Gym-Zweig der Hauptschleife ("DIE BLACK OP GEHOERT IN DIESE
 *      FRAGE", 28.08.) - eine faellige Black Op holte die Figur nie aus dem
 *      Gym, solange kein Vertrag und keine Operation ueber der Schwelle lag;
 *   2. `klemmFaktor()` (D2-Sonde) - lieferte seit D2 (27.09.) immer 1, die
 *      Chance-Faehigkeiten wurden also nie gedaempft, auch wenn alles schon
 *      bei 1,000 stand;
 *   3. `etwasFahrbarJetzt()` - `fahrbar` in data/blade.json stand seit D2
 *      immer auf false (reine Telemetrie, aber falsch).
 *
 * Geprueft wird gegen den ns-Mock (tools/mock/ns.js):
 *   A. Gym-Ausstieg: nichts ueber der Schwelle ausser der Black Op ->
 *      Black Op statt Gym; Black Op unter der Schwelle -> Gym bleibt.
 *   B. Dieselbe Feuerzahl wie `waehle()` (Chance MIT ganzem Pool): Pool
 *      traegt -> raus aus dem Gym und gefeuert; Pool seit dem letzten
 *      Einsatz geschrumpft -> im Gym bleiben (sonst Training statt Gym).
 *   B2. Im Gym laufen Faehigkeitskauf und Truppmeldung weiter (Skeptiker).
 *   C. Kein Pendeln: laeuft die Black Op, holt der Gym-Zweig die Figur ueber
 *      mehrere Runden nicht zurueck; ist sie erledigt und die naechste noch
 *      nicht faellig, geht es ins Gym zurueck.
 *   D. klemmFaktor: alles bei 1,000 -> die Chance-Faehigkeiten verlieren
 *      gegen Hyperdrive (vorher gewann immer eine Chance-Faehigkeit).
 *   E. fahrbar-Telemetrie: Operation ueber der Schwelle -> fahrbar true.
 *
 * Die Black-Op-Chance laesst sich exakt einstellen wie in
 * tools/test-trupp-sleeve.js: linear in `mults.bladeburner_success_chance`.
 *
 * ROT GEGEN DIE ALTE FASSUNG:
 *   node tools/test-blackop-gym.js --blade <alt>/src/blade.js
 * (der Ordner muss `src` heissen und `lib/` enthalten, siehe mock/lader.js).
 *
 * Aufruf: node tools/test-blackop-gym.js [--blade <pfad>]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden, ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
};
const BLADE = arg("--blade");

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

const ladeBlade = async () => (BLADE ? ladeSpielskript(BLADE) : (await ladeAusBeiden(ROOT, "blade.js")).modul);

const W0 = 1_700_000_000_000;
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
const BO = "Black Operations/Operation Typhoon";

// Vertraege und Operationen mit Spanne 0 und fester Chance: liegt sie unter
// der Schwelle, greift weder `lohntSich` noch die Field-Analysis-Ausnahme -
// genau der Zustand vom 28.08., 09:03 ("nichts ueber Schwelle").
function aktionen(o) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) raus[typ + "/" + n] = { vorrat: 100, stufe: 1, maxStufe: 15, dauer: 30000, ...vorgabe };
  };
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"], { chance: o.vertrag ?? 0.2, spanne: 0 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"], { chance: o.operation ?? 0.2, spanne: 0 });
  setze("General", ["Training", "Field Analysis", "Recruitment", "Diplomacy",
    "Hyperbolic Regeneration Chamber", "Incite Violence"], { chance: 1, vorrat: Infinity });
  // Die Mockzahl der Black Op entscheidet nicht - die gerechnete Chance tut es.
  if (o.blackOps !== false) raus[BO] = { chance: o.boMock ?? 0.01, spanne: 0, vorrat: 1 };
  return raus;
}
// Tiefstand 165 >= BBTRAIN_ZIEL 100: der Gym-Zweig ist der Weg, nicht bbtrain.
const SKILLS = { hacking: 355, strength: 183, defense: 165, dexterity: 166, agility: 166, charisma: 42, intelligence: 153 };

async function fahreBlade(o = {}) {
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
    maxSchlaf: o.runden ?? 2,
    beiSchlaf: (ms, z, vorRuecken) => { if (o.beiSchlaf) o.beiSchlaf(z); vorRuecken(1000); },
    blade: {
      drin: true, rang: o.rang ?? 3000, punkte: o.punkte ?? 0, ausdauer: [100, 100], stadt: "Sector-12",
      truppe: o.pool ?? 0,
      staedte: Object.fromEntries(STAEDTE.map((s) => [s, { chaos: o.chaos ?? 10, comms: 60, pop: 1.2e9 }])),
      aktionen: aktionen(o), fertigkeiten: {},
      blackOps: o.blackOps === false ? [] : (o.blackOpListe ?? [{ name: "Operation Typhoon", rank: 2500 }]),
    },
  });
  Object.assign(m.zustand.spieler.skills, SKILLS);
  m.zustand.spieler.mults = { bladeburner_success_chance: o.mult ?? 1 };
  if (o.opTrupp) m.zustand.blade.opTrupp = { "Operation Typhoon": o.opTrupp };
  // Wer wann ins Gym geht und wer eine laufende Bladeburner-Aktion stoppt.
  const gym = [];
  const stops = [];
  const gymOrig = m.ns.singularity.gymWorkout;
  m.ns.singularity.gymWorkout = (ort, stat) => {
    gym.push({ stat, laeuft: m.zustand.blade.aktion ? m.zustand.blade.aktion.name : null });
    return gymOrig(ort, stat);
  };
  const stopOrig = m.ns.bladeburner.stopBladeburnerAction;
  m.ns.bladeburner.stopBladeburnerAction = () => {
    stops.push(m.zustand.blade.aktion ? m.zustand.blade.aktion.type + "/" + m.zustand.blade.aktion.name : null);
    return stopOrig();
  };
  const modul = await ladeBlade();
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  let lage = null;
  try { lage = JSON.parse(m.lies("home", "data/blade.json")); } catch { lage = null; }
  const gest = m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);
  return { m, lage, gest, gym, stops, bo: gest.includes(BO),
    opTrupp: (m.zustand.blade.opTrupp || {})["Operation Typhoon"] ?? 0,
    gekauft: m.zustand.blade.gekauft.map((g) => g.name) };
}
const kurz = (r) => JSON.stringify({ aktion: r.lage && r.lage.aktion, grund: r.lage && r.lage.grund,
  gest: r.gest, gym: r.gym.length, opTrupp: r.opTrupp });

// Proberunde: die gerechnete Chance mit Faktor 1 (ohne Trupp, unter dem Tor;
// Vertraege ueber der Schwelle, damit `waehle()` laeuft und boChancen schreibt).
const probe = await fahreBlade({ rang: 1000, runden: 1, vertrag: 0.9 });
const c1 = probe.lage && probe.lage.boChancen ? probe.lage.boChancen["Operation Typhoon"] : null;
pruefe("Proberunde: blade.js rechnet die Typhoon-Chance (boChancen)", Number.isFinite(c1) && c1 > 0, String(c1));
const multFuer = (ziel) => ziel / c1;

if (Number.isFinite(c1) && c1 > 0) {
  console.log("");
  console.log("=== A. Gym-Ausstieg fuer eine faellige Black Op ===");
  {
    const r = await fahreBlade({ mult: multFuer(0.95) });
    pruefe("nichts ueber Schwelle, Black Op 0,95 >= 0,90: die Black Op startet", r.bo, kurz(r));
    pruefe("und die Figur geht NICHT ins Gym", r.gym.length === 0, kurz(r));
  }
  {
    const r = await fahreBlade({ mult: multFuer(0.5) });
    pruefe("Black Op 0,50 < 0,90: Gym (Kampfwerte aufbauen)", r.gym.length > 0 && !r.bo, kurz(r));
  }
  {
    const r = await fahreBlade({ mult: multFuer(0.95), rang: 2000 });
    pruefe("Chance reicht, Rang 2.000 < Tor 2.500: Gym, keine Black Op", r.gym.length > 0 && !r.bo, kurz(r));
  }

  console.log("");
  console.log("=== B. Dieselbe Feuerzahl wie waehle() (Chance mit ganzem Pool) ===");
  {
    // Ohne Trupp 0,85, Pool 3, der Op noch nichts zugeteilt:
    // blackOpChance allein sagt 0,85 (< 0,90), waehle() feuert mit
    // 0,85 * 4^0,05 = 0,911. Der Gym-Zweig muss wie waehle() entscheiden.
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 3 });
    pruefe("Pool 3 traegt die Op: raus aus dem Gym und gefeuert", r.bo && r.gym.length === 0, kurz(r));
    pruefe("mit dem Pool als Trupp (setTeamSize 3)", r.opTrupp === 3, kurz(r));
  }
  {
    // KONSISTENZPROBE, KEIN SPIELZUSTAND (Skeptiker 03.10.): Im Spiel kappt
    // der teamSize-Setter den teamCount jeder Op sofort auf den Pool
    // (Bladeburner.ts:83-97), der Mock tut das nicht. Geprueft wird hier nur,
    // dass Gym-Zweig und waehle() dieselbe Zahl fragen: blackOpChance allein
    // liest 0,85*4^0,05 = 0,911 und haette die Figur aus dem Gym geholt,
    // waehle() sieht 0,85 mit Pool 0 und feuert nicht.
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 0, opTrupp: 3 });
    pruefe("Pool geschrumpft (Op 3, Pool 0): keine Black Op", !r.bo, kurz(r));
    pruefe("und die Figur bleibt im Gym statt Bladeburner-Training", r.gym.length > 0
      && !r.gest.includes("General/Training"), kurz(r));
  }

  console.log("");
  console.log("=== B2. Im Gym laufen die Nebenaufgaben von waehle() weiter ===");
  {
    // Op ohne Trupp 0,85, Pool 0, Rang ueber 90 % des Tors: Gym, aber die
    // Sleeves sollen rekrutieren - sleeve.js braucht eine frische truppZeit.
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 0, runden: 3 });
    pruefe("Gym (0,85 ohne Trupp, Pool 0)", r.gym.length > 0 && !r.bo, kurz(r));
    pruefe("truppAnfrage true mit 3 fehlenden Maennern, auch im Gym",
      !!r.lage && r.lage.truppAnfrage === true && r.lage.truppFehlt === 3,
      JSON.stringify(r.lage && { tA: r.lage.truppAnfrage, fehlt: r.lage.truppFehlt }));
    pruefe("truppZeit frisch (aus dem Gym-Zweig gestempelt)",
      !!r.lage && Number.isFinite(r.lage.truppZeit), String(r.lage && r.lage.truppZeit));
  }
  {
    // Gelungene Black Op hinterlaesst Punkte, die naechste Op liegt knapp
    // darunter: die Punkte werden auch im Gym ausgegeben.
    const r = await fahreBlade({ mult: multFuer(0.5), punkte: 300, runden: 2 });
    pruefe("Gym mit 300 Punkten: Faehigkeiten werden gekauft", r.gym.length > 0 && r.gekauft.length > 0,
      r.gekauft.length + " Kaeufe");
  }

  console.log("");
  console.log("=== C. Kein Pendeln zwischen Gym und Black Op ===");
  {
    // Fuenf Runden: die Black Op laeuft weiter, der Gym-Zweig holt sie nicht
    // zurueck und stoppt sie nicht.
    const r = await fahreBlade({ mult: multFuer(0.95), runden: 5 });
    pruefe("fuenf Runden: genau ein Start der Black Op", r.gest.filter((g) => g === BO).length === 1, kurz(r));
    pruefe("kein Gym, kein Stopp der laufenden Op", r.gym.length === 0 && r.stops.length === 0,
      JSON.stringify({ gym: r.gym, stops: r.stops }));
  }
  {
    // Ab Runde 2 ist Typhoon erledigt, die naechste (Zero) hat ein Tor ueber
    // dem Rang: zurueck ins Gym, ohne die erledigte Op neu zu starten.
    let n = 0;
    const r = await fahreBlade({ mult: multFuer(0.95), runden: 4,
      blackOpListe: [{ name: "Operation Typhoon", rank: 2500 }, { name: "Operation Zero", rank: 25000 }],
      beiSchlaf: (z) => { if (++n === 1) { z.blade.blackOps[0].erledigt = true; } } });
    pruefe("Typhoon gestartet, danach erledigt: Gym fuer die naechste (Tor zu hoch)",
      r.bo && r.gym.length > 0, kurz(r));
    pruefe("Typhoon nur einmal gestartet", r.gest.filter((g) => g === BO).length === 1, kurz(r));
  }

  console.log("");
  console.log("=== D. klemmFaktor (D2-Sonde): alles bei 1,000 daempft die Chance-Faehigkeiten ===");
  {
    // Keine Black Op, alle Vertraege und Operationen sicher bei 1,000. Bei
    // gleichem Preis (Mock: 3 Punkte auf Stufe 0) gewinnt sonst Digital
    // Observer / Tracer mit 4 % - mit Klemmfaktor 0,05 nur noch 0,2 % gegen
    // Hyperdrive (~1,7 %).
    const r = await fahreBlade({ blackOps: false, vertrag: 1, operation: 1, punkte: 3, runden: 1 });
    const chanceSkills = ["Blade's Intuition", "Short-Circuit", "Digital Observer", "Cloak", "Tracer"];
    pruefe("ein Kauf, und er ist KEINE Chance-Faehigkeit",
      r.gekauft.length === 1 && !chanceSkills.includes(r.gekauft[0]), r.gekauft.join(", ") || "nichts gekauft");
  }
  {
    // Gegenprobe: Operationen noch offen (0,5) -> Klemmfaktor 1, die
    // Chance-Faehigkeit gewinnt wie bisher.
    const r = await fahreBlade({ blackOps: false, vertrag: 0.5, operation: 0.5, punkte: 3, runden: 1 });
    const chanceSkills = ["Blade's Intuition", "Short-Circuit", "Digital Observer", "Cloak", "Tracer"];
    pruefe("Gegenprobe Chancen offen: eine Chance-Faehigkeit wird gekauft",
      r.gekauft.length === 1 && chanceSkills.includes(r.gekauft[0]), r.gekauft.join(", ") || "nichts gekauft");
  }

  console.log("");
  console.log("=== E. fahrbar-Telemetrie (etwasFahrbarJetzt) ===");
  {
    const r = await fahreBlade({ blackOps: false, vertrag: 0.95, operation: 0.95, runden: 1 });
    pruefe("Operation 0,95 ueber der Schwelle: fahrbar true", !!r.lage && r.lage.fahrbar === true,
      String(r.lage && r.lage.fahrbar));
  }
  {
    // Chaos 60 > CHAOS_EIN: der Gym-Zweig laesst durch, waehle() misst.
    const r = await fahreBlade({ blackOps: false, vertrag: 0.2, operation: 0.2, chaos: 60, runden: 1 });
    pruefe("alles 0,20 (Chaos 60, damit gemessen wird): fahrbar false", !!r.lage && r.lage.fahrbar === false, String(r.lage && r.lage.fahrbar));
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
