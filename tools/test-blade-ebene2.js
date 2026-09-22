/**
 * Ebene 2: `src/blade.js` gegen den ns-Mock — die Entscheidung, nicht die Formel.
 *
 * ===========================================================================
 * WARUM DAS DIE LETZTE GROSSE LÜCKE WAR
 * ===========================================================================
 *
 * `blade.js` ist das Trägergewerk für **30 der 40 Läufe** der Restroute: auf
 * dem V2-Weg hängt der Fortschritt am Bladeburner-Rang, und der entsteht hier.
 * Bis zum 04.09.2026 hatte es keine einzige Ebene-2-Probe — der
 * Bladeburner-Namensraum des Mocks warf schlicht „nicht gebaut".
 *
 * Gemessen wurde es trotzdem: `tools/test-formeln.js` eicht die Formeln gegen
 * den Spielquelltext, `tools/ratencheck.js` die Raten gegen 406 echte
 * Abschnitte. Was fehlte, war die Stufe dazwischen — **welche Aktion wählt das
 * Gewerk in welcher Lage**.
 *
 * ===========================================================================
 * WAS HIER GEPRÜFT WIRD, UND WAS NICHT
 * ===========================================================================
 *
 * Geprüft wird die **Entscheidung**: ruht es bei leerer Ausdauer? Räumt es
 * Chaos auf, wenn die Stadt über der Schwelle liegt? Greift es eine Black Op
 * an, deren Erfolgschance unter der Sicherheitsmarke liegt? Tritt es bei
 * 4 × 100 bei?
 *
 * NICHT geprüft wird die Mechanik des Spiels. Der Mock rechnet keine
 * Erfolgschance aus Kampfwerten — er gibt zurück, was der Test hineinschreibt.
 * Das ist Absicht: eine nachgebaute Spielformel im Prüfstand ist eine zweite
 * Wahrheit, die auseinanderläuft. Die Formeln haben ihren eigenen, gegen den
 * Quelltext geeichten Test.
 *
 * Aufruf: node tools/test-blade-ebene2.js
 */

import path from "node:path";
import fs from "node:fs";
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
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing",
  "New Tokyo", "Ishima"];

/** Alle Städte gleich, damit die Stadtwahl kein Rauschen erzeugt. */
function staedte(o = {}) {
  const raus = {};
  for (const s of STAEDTE) {
    raus[s] = { chaos: o.chaos ?? 10, comms: o.comms ?? 60, pop: o.pop ?? 1.2e9 };
  }
  if (o.je) Object.assign(raus, o.je);
  return raus;
}

/** Alle Aktionen mit Vorrat und Chance — der Test verschiebt einzelne. */
function aktionen(o = {}) {
  const raus = {};
  const setze = (typ, namen, vorgabe) => {
    for (const n of namen) {
      raus[typ + "/" + n] = { vorrat: 100, stufe: 1, maxStufe: 15,
        dauer: 30000, ...vorgabe };
    }
  };
  setze("Contracts", ["Tracking", "Bounty Hunter", "Retirement"],
    { chance: o.vertragChance ?? 0.9 });
  setze("Operations", ["Investigation", "Undercover Operation", "Sting Operation",
    "Raid", "Stealth Retirement Operation", "Assassination"],
    { chance: o.opChance ?? 0.95 });
  setze("General", ["Training", "Field Analysis", "Recruitment",
    "Diplomacy", "Hyperbolic Regeneration Chamber", "Incite Violence"],
    { chance: 1, vorrat: Infinity });
  if (o.je) {
    for (const [k, v] of Object.entries(o.je)) {
      raus[k] = { ...(raus[k] || { vorrat: 100, stufe: 1, maxStufe: 15, dauer: 30000 }), ...v };
    }
  }
  return raus;
}

async function fahre(o = {}) {
  const m = neuerMock({
    host: "home",
    knoten: 10,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000,
    augReset: W0 - 24 * 3600000,
    geld: o.geld ?? 1e12,
    server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "data/verfahren.txt": "V2 10 2",
      // DIE FIGUR MUSS VERGEBEN SEIN (04.09.2026).
      //
      // `blade.js` fragt vor JEDEM `startAction` den Vergabepunkt: eine
      // Bladeburner-Aktion beendet jede laufende Arbeit der Figur, auch einen
      // Graft fuer 14,63 Mrd. Ohne Vergabe wartet es - und ein Test ohne
      // diese Datei wuerde messen, dass die Figurwache funktioniert, statt
      // die Aktionswahl.
      //
      // Der Fall "Figur NICHT vergeben" hat einen eigenen Abschnitt weiter
      // unten; er ist ein Gegenstand fuer sich.
      // DER KNOTENSTEMPEL. `lib/figurns.js` liest ihn aus `data/bn4net.json`
      // (nicht aus `ns.getResetInfo` - das kostet 1 GB). Fehlt die Datei, gilt
      // 0, und JEDE Vergabe faellt als "aus einem anderen Lauf" durch. Ein
      // Test ohne diese Datei misst genau das - nicht die Aktionswahl.
      "data/bn4net.json": JSON.stringify({
        wall: W0, nodeReset: W0 - 24 * 3600000, motorTimeMs: 3600000,
        okRound: 100, errStreak: 0, round: 100, phase: "normal",
      }),
      "data/figure.txt": JSON.stringify({
        owner: o.figurBesitzer ?? "blade.js",
        action: "bladeburner",
        detail: "Rangaufbau",
        seq: 1,
        nodeReset: W0 - 24 * 3600000,
        leaseBis: W0 + 24 * 3600000,
      }),
      ...(o.dateien || {}),
    } },
    maxSchlaf: o.runden ?? 3,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(o.schrittMs ?? 1000),
    blade: {
      drin: o.drin !== false,
      rang: o.rang ?? 1000,
      punkte: o.punkte ?? 0,
      ausdauer: o.ausdauer ?? [100, 100],
      stadt: o.stadt ?? "Sector-12",
      truppe: o.truppe ?? 6,
      staedte: staedte(o.stadtLage || {}),
      aktionen: aktionen(o.aktionLage || {}),
      fertigkeiten: o.fertigkeiten || {},
      blackOps: o.blackOps || [{ name: "Operation Typhoon", rank: 2500 }],
    },
  });
  if (o.skills) Object.assign(m.zustand.spieler.skills, o.skills);
  if (o.hp) m.zustand.spieler.hp = o.hp;

  const { modul } = await ladeAusBeiden(ROOT, "blade.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

/** Welche Aktionen hat das Gewerk gestartet? */
function gestartet(m) {
  return m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);
}

function lage(m) {
  const roh = m.lies("home", "data/blade.json");
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

console.log("");
console.log("=== blade.js gegen den ns-Mock ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Normalfall: es arbeitet --");
let normal = null;
{
  const m = await fahre({});
  normal = gestartet(m);
  pruefe("es startet ueberhaupt eine Aktion", normal.length > 0,
    normal.join(", ") || "(nichts)");
  pruefe("und schreibt seine Lage", !!lage(m), "data/blade.json fehlt");
  pruefe("die Lage nennt Rang und Aktion",
    !!lage(m) && Number.isFinite(lage(m).rang) && !!lage(m).aktion,
    JSON.stringify(lage(m) && { rang: lage(m).rang, aktion: lage(m).aktion }));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- leere Ausdauer: in die Kammer, nicht in den Einsatz --");
{
  // AUSDAUER_RUHE = 0,51. Unter der Marke faellt die Erfolgschance
  // (`Bladeburner.ts:167-169`), und ein Einsatz mit halber Chance verliert
  // Rang statt welchen zu bringen (`Bladeburner.ts:1055-1059`).
  const m = await fahre({ ausdauer: [20, 100] });
  const g = gestartet(m);
  pruefe("es geht in die Regenerationskammer",
    g.some((x) => /Hyperbolic Regeneration Chamber/.test(x)),
    g.join(", ") || "(nichts)");
  pruefe("und faehrt KEINEN Vertrag und KEINE Operation",
    !g.some((x) => x.startsWith("Contracts/") || x.startsWith("Operations/")),
    g.join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Gegenprobe: volle Ausdauer, keine Kammer --");
{
  // OHNE DIESE PROBE waere die vorige auch dann gruen, wenn das Gewerk IMMER
  // in die Kammer ginge.
  const m = await fahre({ ausdauer: [100, 100] });
  const g = gestartet(m);
  pruefe("bei voller Ausdauer keine Kammer",
    !g.some((x) => /Hyperbolic Regeneration Chamber/.test(x)),
    g.join(", ") || "(nichts)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Chaos ueber der Schwelle: aufraeumen --");
{
  // CHAOS_EIN = 50. Chaos senkt die Erfolgschancen aller Aktionen in der
  // Stadt; ab der Schwelle lohnt Diplomatie mehr als der naechste Vertrag.
  const m = await fahre({ stadtLage: { chaos: 80 } });
  const g = gestartet(m);
  const l = lage(m);
  pruefe("es merkt sich das Chaos", !!l && l.chaos >= 79,
    l ? "chaos=" + l.chaos : "keine Lage");
  pruefe("und meldet den Aufraeummodus", !!l && l.aufraeumen === true,
    l ? String(l.aufraeumen) : "?");
  // NICHT DIPLOMACY (das war meine erste Erwartung, und sie war falsch).
  //
  // Beide senken das Chaos prozentual, aber nur eines gibt dabei Rang. Im
  // Spiel gemessen (27.08.2026, Charisma 287, Chaos 50,8): Raid + 1,5 Stealth
  // Retirements ergeben 49,3 Rang/min, Raid + 1,9 Diplomacy-Laeufe 34,0 -
  // plus 45 Prozent. Diplomacy ist strikt dominiert, solange die SR-Chance
  // hoch ist.
  pruefe("gefahren wird Stealth Retirement, nicht Diplomacy",
    g.some((x) => /Stealth Retirement/.test(x)) && !g.some((x) => /Diplomacy/.test(x)),
    g.join(", ") || "(nichts)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Chaos hoch UND kein Vertrag ueber der Schwelle: Diplomacy, nicht Gym --");
{
  // DER FALL VOM 11.09.2026 (BitNode 4 Lauf 2, aus der Sicherung 05:15):
  // Chaos 52-75 in allen sechs Staedten, jede Vertragschance unter
  // SICHER_VERTRAG (0,45), Kampfwerte 140, Ausdauer voll. Die Probe oben
  // faehrt Chaos 80 mit Vertragschance 0,9 - dort sagt `lohntSich` noch ja,
  // und `waehle()` wird erreicht. HIER sagt es nein, und bis zum 11.09. ging
  // die Figur dann ins Gym: Rang 36 je Stunde ueber 10,4 h, Chaos stand.
  //
  // Erwartet: die Figur raeumt auf. Stealth Retirement scheidet mit Chance
  // 0,40 aus (SR_CHANCE_MIN 0,70), also Diplomacy - und KEIN Gym.
  const m = await fahre({
    stadtLage: { chaos: 56 },
    aktionLage: { vertragChance: 0.40, opChance: 0.40 },
    skills: { strength: 140, defense: 140, dexterity: 144, agility: 140 },
  });
  const g = gestartet(m);
  const l = lage(m);
  pruefe("kein Gym - das Chaos ist der Grund zu arbeiten",
    !(m.zustand.arbeit && m.zustand.arbeit.type === "CLASS")
      && !(l && /^Gym\//.test(String(l.aktion))),
    l ? "aktion=" + l.aktion + " grund=" + l.grund : "keine Lage");
  pruefe("Diplomacy wird gefahren",
    g.some((x) => /Diplomacy/.test(x)), g.join(", ") || "(nichts)");
  pruefe("und der Aufraeummodus ist gemeldet", !!l && l.aufraeumen === true,
    l ? String(l.aufraeumen) : "?");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Gegenprobe: Chaos unter der Schwelle, nichts fahrbar -> Gym ist richtig --");
{
  // Ohne Chaos ist "nichts ueber Schwelle" ein echter Grund fuers Gym: es
  // gibt nichts aufzuraeumen und nichts zu verdienen. Der neue Fall darf
  // hier NICHT greifen.
  const m = await fahre({
    stadtLage: { chaos: 20 },
    aktionLage: { vertragChance: 0.40, opChance: 0.40 },
    skills: { strength: 140, defense: 140, dexterity: 144, agility: 140 },
  });
  const g = gestartet(m);
  pruefe("bei Chaos 20 keine Diplomacy",
    !g.some((x) => /Diplomacy/.test(x)), g.join(", ") || "(nichts)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ...aber bei duenner Bevoelkerung doch Diplomacy --");
{
  // DIE GRENZE IST DIE BEVOELKERUNG, nicht die Chance. Stealth Retirement
  // senkt sie um 0,5 Prozent je Erfolg (`Bladeburner.ts:848`), und sie wirkt
  // ueber `(pop/1e9)^0,7` auf die Erfolgschance JEDER Operation. Unter 0,8e9
  // faellt Raid unter seine Schwelle - dann ist Diplomacy richtig, weil sie
  // nichts verbraucht.
  const m = await fahre({ stadtLage: { chaos: 80, pop: 0.5e9 } });
  const g = gestartet(m);
  pruefe("unter 0,8 Mrd Einwohnern wird Diplomacy gefahren",
    g.some((x) => /Diplomacy/.test(x)),
    g.join(", ") || "(nichts)");
  pruefe("und kein Stealth Retirement mehr",
    !g.some((x) => /Stealth Retirement/.test(x)), g.join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Gegenprobe: wenig Chaos, kein Aufraeumen --");
{
  const m = await fahre({ stadtLage: { chaos: 5 } });
  const l = lage(m);
  pruefe("bei Chaos 5 kein Aufraeummodus", !!l && l.aufraeumen !== true,
    l ? String(l.aufraeumen) : "keine Lage");
  pruefe("und keine Diplomatie",
    !gestartet(m).some((x) => /Diplomacy/.test(x)),
    gestartet(m).join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- eine Black Op mit zu kleiner Chance wird NICHT angegangen --");
{
  // SICHER_BLACKOP = 0,35. Eine misslungene Black Op ist unwiederbringlich:
  // sie kostet Rang, und der Vorrat ist endlich - jede Operation gibt es
  // genau einmal.
  const m = await fahre({
    rang: 5000,                       // Rang reicht fuer die Operation
    blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    aktionLage: { je: { "Black Operations/Operation Typhoon":
      { chance: 0.05, spanne: 0.01, vorrat: 1 } } },
  });
  const g = gestartet(m);
  pruefe("die Black Op bleibt liegen",
    !g.some((x) => x.startsWith("Black Operations/")),
    g.join(", ") || "(nichts)");
  pruefe("stattdessen wird weitergearbeitet", g.length > 0, g.join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- vor dem Endspiel feuert erst 0,90, im Endspiel schon 0,35 (11.09.2026) --");
{
  // Der Mock rechnet keine Chance aus Kampfwerten (Intelligenz fehlt, die
  // Formel liefert NaN), also gilt die Spanne aus aktionLage. Die Liste
  // enthaelt Daedalus, damit die Schranke lesbar ist.
  const liste = [
    { name: "Operation Typhoon", rank: 2500 },
    { name: "Operation Daedalus", rank: 400000 },
  ];
  const lage = (chance) => ({ je: { "Black Operations/Operation Typhoon":
    { chance, spanne: 0, vorrat: 1 } } });
  const m1 = await fahre({ rang: 9000, blackOps: liste, aktionLage: lage(0.60) });
  pruefe("Rang 9.000, Chance 0,60: die Black Op bleibt liegen (Boden 0,90)",
    !gestartet(m1).some((x) => x.startsWith("Black Operations/")),
    gestartet(m1).join(", ") || "(nichts)");
  const m2 = await fahre({ rang: 9000, blackOps: liste, aktionLage: lage(0.95) });
  pruefe("Rang 9.000, Chance 0,95: die Black Op wird gefahren",
    gestartet(m2).some((x) => x.startsWith("Black Operations/")),
    gestartet(m2).join(", ") || "(nichts)");
  const m3 = await fahre({ rang: 400000, blackOps: liste, aktionLage: lage(0.60) });
  pruefe("Rang 400.000 (Endspiel), Chance 0,60: die Black Op wird gefahren (Boden 0,35)",
    gestartet(m3).some((x) => x.startsWith("Black Operations/")),
    gestartet(m3).join(", ") || "(nichts)");
  const m4 = await fahre({ rang: 9000, blackOps: [liste[0]], aktionLage: lage(0.60) });
  pruefe("ohne lesbare Daedalus-Schranke gilt 'frueh': bleibt liegen",
    !gestartet(m4).some((x) => x.startsWith("Black Operations/")),
    gestartet(m4).join(", ") || "(nichts)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ohne Rang gar keine Black Op --");
{
  const m = await fahre({
    rang: 100,
    blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    aktionLage: { je: { "Black Operations/Operation Typhoon":
      { chance: 0.99, spanne: 0, vorrat: 1 } } },
  });
  pruefe("trotz hoher Chance keine Black Op bei Rang 100",
    !gestartet(m).some((x) => x.startsWith("Black Operations/")),
    gestartet(m).join(", ") || "(nichts)");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- das Tor 4 x 100: der Beitritt liegt in bbtrain.js --");
{
  // NICHT IN blade.js. Das war meine erste Erwartung, und sie war falsch:
  // `blade.js` faehrt den Motor NACH dem Beitritt, `bbtrain.js` trainiert
  // davor und tritt bei. Der Test prueft deshalb bbtrain.js - dieselbe
  // Mock-Division, ein anderes Gewerk.
  const bau = async (werte) => {
    const m = neuerMock({
      host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
      nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
      server: { home: { ram: 512, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
      dateien: { home: { "data/verfahren.txt": "V2 10 2" } },
      maxSchlaf: 3,
      beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1000),
      blade: { drin: false, staedte: staedte(), aktionen: aktionen() },
    });
    Object.assign(m.zustand.spieler.skills, werte);
    const { modul } = await ladeAusBeiden(ROOT, "bbtrain.js");
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck(); }
    return m;
  };

  const zu = await bau({ strength: 90, defense: 90, dexterity: 90, agility: 90 });
  pruefe("mit 90 in allen Werten kein Beitritt", zu.zustand.blade.drin === false,
    "sonst waere die Probe unten nur ein Zaehler");

  const auf = await bau({ strength: 100, defense: 100, dexterity: 100, agility: 100 });
  pruefe("mit 100 tritt es bei", auf.zustand.blade.drin === true,
    "das Tor aus dem Auftrag: 4 x 100, Beitritt sofort");
  pruefe("und der Zeitpunkt wird festgehalten",
    !!auf.lies("home", "data/bbjoin.txt"),
    "an ihm haengt der Zwei-Stunden-Kontrollpunkt aus nodes/ROUTE.md");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Fertigkeitspunkte werden ausgegeben, nicht gehortet --");
{
  const m = await fahre({ punkte: 500 });
  pruefe("es kauft Fertigkeiten", m.zustand.blade.gekauft.length > 0,
    m.zustand.blade.gekauft.length + "x, zuerst "
    + m.zustand.blade.gekauft.slice(0, 3).map((k) => k.name).join(", "));
  pruefe("und gibt dabei Punkte aus", m.zustand.blade.punkte < 500,
    "noch " + m.zustand.blade.punkte + " von 500");

  const leer = await fahre({ punkte: 0 });
  pruefe("ohne Punkte kauft es nichts", leer.zustand.blade.gekauft.length === 0,
    "sonst waere die Probe oben nur ein Zaehler");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Anlaufphase: weichtTraining steht in JEDER Ausweichrunde (22.09.2026) --");
{
  // DER WAECHTER LIEST DIESE FLAGGE, um in der Anlaufphase den Kampfwert-
  // Tiefstand statt des Rangs als Traeger zu nehmen (bn4net.js). Sie stand
  // zuerst nur in der ERSTEN Ausweichrunde auf true; ab der zweiten setzte
  // der Rundenkopf sie zurueck, und niemand setzte sie wieder. Im Spiel stand
  // "weicht bbtrain, Kampfwerte 81" neben `weichtTraining: false`.
  //
  // Eine Runde haette das nicht gezeigt. Deshalb vier: das Weichen schlaeft
  // 30 s je Runde, die Probe laeuft also sicher ueber mehrere Rundenkoepfe.
  const niedrig = { strength: 80, defense: 85, dexterity: 90, agility: 81 };
  const m = await fahre({ skills: niedrig, runden: 4, schrittMs: 30000 });
  const l = lage(m);
  pruefe("es weicht (Grund nennt bbtrain)", !!l && /weicht bbtrain/.test(String(l.grund)),
    l ? "grund=" + l.grund : "keine Lage");
  pruefe("und meldet weichtTraining: true auch nach mehreren Runden",
    !!l && l.weichtTraining === true, l ? String(l.weichtTraining) : "keine Lage");
  pruefe("der Tiefstand steht daneben (der Waechter braucht ihn als Traeger)",
    !!l && l.tiefstand === 80, l ? "tiefstand=" + l.tiefstand : "?");

  // GEGENPROBE: ohne sie waere die Probe oben auch gruen, wenn die Flagge
  // immer true waere - und dann waere der Rang als Traeger nie zurueck.
  const hoch = await fahre({ runden: 4, schrittMs: 30000 });
  const lh = lage(hoch);
  pruefe("bei Kampfwerten >= 100 steht sie auf false",
    !!lh && lh.weichtTraining === false, lh ? String(lh.weichtTraining) : "keine Lage");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  for (const ordner of [path.join(ROOT, "src"),
    path.resolve(ROOT, "..", "bitburner-bau", "src")]) {
    if (!fs.existsSync(ordner)) continue;
    const reste = [];
    const suche = (o, tiefe = 0) => {
      if (tiefe > 3) return;
      for (const e of fs.readdirSync(o, { withFileTypes: true })) {
        if (e.isDirectory()) suche(path.join(o, e.name), tiefe + 1);
        else if (e.name.startsWith(".mock-")) reste.push(e.name);
      }
    };
    suche(ordner);
    pruefe("keine Reste in " + path.basename(path.dirname(ordner)) + "/src",
      reste.length === 0, reste.join(", "));
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
