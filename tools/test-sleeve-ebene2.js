/**
 * Ebene 2: `src/sleeve.js` gegen den ns-Mock — der Geldboden und der
 * Nachholklumpen.
 *
 * ===========================================================================
 * WARUM AUSGERECHNET DIESES GEWERK
 * ===========================================================================
 *
 * Es ist die einzige Stelle im Bot, die `storedCycles` liest — das Feld, in
 * dem das Spiel den Nachholrückstand ablegt. Der Auftrag nennt es namentlich
 * (6.1), und der Prüfstand kannte es bis zum 04.09.2026 nicht: der
 * Nachholklumpen war als Sprung der Spielzeit modelliert, also als meine
 * Vorstellung von dem, was `storedCycles` bewirkt, statt als das Feld selbst.
 *
 * ===========================================================================
 * DIE RECHNUNG, UM DIE ES GEHT
 * ===========================================================================
 *
 * Das Gym kostet 2.400 $/s je Körper (`Work/Formulas.ts:110-127`). Ein Körper
 * mit Rückstand arbeitet in einem Takt aber nicht einen Takt lang, sondern
 * `storedCycles / 5 + Takt` Sekunden — er holt nach. Wer den Rückstand
 * ignoriert, setzt acht Körper ins Gym und ist Sekunden später bei negativem
 * Konto; `negative_balance_min` hat Soll 0.
 *
 * Die alte Schwelle im Projekt lag bei 5 Mio $ und deckte damit 67 Sekunden.
 * Acht Stunden verdeckter Tab sind 144.000 Zyklen = 28.800 Spielsekunden =
 * 69,1 Mio $ JE KÖRPER.
 *
 * Aufruf: node tools/test-sleeve-ebene2.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";
import { ohneKommentare } from "./lib/schreiberprobe.js";

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

/** Fährt `sleeve.js` einige Runden gegen den Mock. */
async function fahre(o) {
  const m = neuerMock({
    host: "home",
    knoten: o.knoten ?? 10,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000,
    augReset: W0 - 24 * 3600000,
    geld: o.geld,
    koerper: o.koerper,
    blade: o.blade,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "data/verfahren.txt": o.verfahren || "V2 10 2", ...(o.dateien || {}) } },
    maxSchlaf: o.runden ?? 2,
    // Die Zeit steht praktisch still - sonst arbeitet der Mock den Rueckstand
    // waehrend des Laufs ab, und die Probe misst etwas anderes als die Lage,
    // die sie gestellt hat.
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(o.schrittMs ?? 1),
  });
  const { modul } = await ladeAusBeiden(ROOT, "sleeve.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

function stand(m) {
  const roh = m.lies("home", "data/sleeve.json");
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

console.log("");
console.log("=== sleeve.js gegen den ns-Mock ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Mock bildet storedCycles nach dem Spiel ab --");
{
  // ZUERST DER MOCK SELBST. Ein Gewerk gegen ein falsches Modell zu pruefen
  // ist schlimmer als es gar nicht zu pruefen - man glaubt dann, es sei
  // geprueft.
  const m = neuerMock({ wall: W0, playtime: 0, koerper: [{}, {}] });

  // Zugang: ein Zyklus je 200 ms Spielzeit (CONSTANTS.MilliPerCycle).
  // Abgang: hoechstens 15 je Sekunde (Sleeve.ts:269).
  // Eine Sekunde: +5 Zyklen, -15 -> der Rueckstand kann nicht wachsen.
  m.vor(1000, 1000);
  pruefe("bei laufendem Spiel bleibt kein Rueckstand",
    m.zustand.koerper[0].storedCycles === 0,
    "5 Zyklen Zugang gegen 15 Abgang je Sekunde");

  // WANDUHR OHNE SPIELZEIT - der verdeckte Tab. Das Spiel rechnet nicht, also
  // entsteht auch kein Zyklus. Der Rueckstand entsteht erst beim WIEDERSEHEN,
  // wenn die Engine die verpasste Zeit in einem Klumpen nachreicht
  // (`engine.tsx:280-282`). Diesen Klumpen stellt ein Test direkt, wie unten -
  // ihn ueber `vor()` zu erzeugen ginge nicht, weil der Mock die Zeit dabei in
  // Sekundenschritten verrechnet und der echte Klumpen in EINEM Aufruf kommt.
  const m2 = neuerMock({ wall: W0, playtime: 0, koerper: [{}] });
  m2.vor(3600000, 0);          // eine Stunde Wanduhr, KEINE Spielzeit
  pruefe("ohne Spielzeit passiert nichts", m2.zustand.koerper[0].storedCycles === 0);

  // Der Klumpen wird direkt gesetzt - so wie ihn ein Test stellt.
  const m3 = neuerMock({ wall: W0, playtime: 0, koerper: [{ storedCycles: 144000 }] });
  pruefe("ein gesetzter Rueckstand steht", m3.zustand.koerper[0].storedCycles === 144000,
    "8 h verdeckter Tab = 144.000 Zyklen = 28.800 Spielsekunden");
  m3.vor(1000, 1000);
  pruefe("und er baut sich mit hoechstens 15 je Sekunde ab",
    Math.abs(m3.zustand.koerper[0].storedCycles - (144000 + 5 - 15)) < 0.001,
    "jetzt " + m3.zustand.koerper[0].storedCycles);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ohne Rueckstand und mit Geld: ab ins Gym --");
{
  const m = await fahre({ geld: 1e9, koerper: [{}, {}] });
  const s = stand(m);
  pruefe("der Stand wird geschrieben", !!s);
  if (s) {
    pruefe("beide Koerper sind gesetzt", s.anzahl === 2 && s.sleeves.every((x) => x.gesetzt),
      JSON.stringify(s.sleeves.map((x) => x.aufgabe)));
    pruefe("und zwar auf eine Gym-Aufgabe",
      s.sleeves.every((x) => ["str", "def", "dex", "agi"].includes(x.aufgabe)),
      s.sleeves.map((x) => x.aufgabe).join(", "));
    pruefe("die Aufgabe steht wirklich im Mock",
      m.zustand.koerper.every((k) => k.aufgabe && k.aufgabe.type === "CLASS"),
      "sonst haette das Gewerk nur berichtet, nicht gehandelt");
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- MIT Rueckstand und knappem Konto: kein Gym, sondern Geld --");
{
  // DIE PROBE, FUER DIE DER MOCK GEBAUT WURDE.
  //
  // 144.000 Zyklen = 28.800 Spielsekunden. Bei 2.400 $/s und drei zahlenden
  // Koerpern (2 Sleeves + Figur) waeren das rund 207 Mio $ - plus die
  // Reserve von 20 Mio. Mit 50 Mio auf dem Konto darf kein Koerper ins Gym.
  const m = await fahre({
    geld: 50e6,
    koerper: [{ storedCycles: 144000 }, { storedCycles: 144000 }],
  });
  const s = stand(m);
  pruefe("der Stand wird geschrieben", !!s);
  if (s) {
    pruefe("KEIN Koerper geht ins Gym",
      s.sleeves.every((x) => !["str", "def", "dex", "agi"].includes(x.aufgabe)),
      s.sleeves.map((x) => x.aufgabe).join(", "));
    pruefe("stattdessen ein Verbrechen, das zahlt",
      m.zustand.koerper.every((k) => k.aufgabe && k.aufgabe.type === "CRIME"),
      JSON.stringify(m.zustand.koerper.map((k) => k.aufgabe && k.aufgabe.crimeType)));
    pruefe("und der Grund steht im Stand", s.sleeves.every((x) => x.grund === "arm"),
      s.sleeves.map((x) => x.grund).join(", "));
    pruefe("der Rueckstand wird mitberichtet",
      s.sleeves.every((x) => x.stored >= 143000),
      "tools/checkin.js wertet waehrend des Nachholbetriebs keine Rate");
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Schwelle liegt am Rueckstand, nicht am Konto allein --");
{
  // GEGENPROBE ZUR VORIGEN. Dasselbe Konto, aber ohne Rueckstand - dann muss
  // dasselbe Geld reichen. Ohne diese Probe wuerde die vorige auch dann
  // gruen, wenn das Gewerk schlicht bei 50 Mio immer knausert.
  const m = await fahre({ geld: 50e6, koerper: [{}, {}] });
  const s = stand(m);
  pruefe("ohne Rueckstand reicht dasselbe Konto fuers Gym",
    !!s && s.sleeves.every((x) => ["str", "def", "dex", "agi"].includes(x.aufgabe)),
    s ? s.sleeves.map((x) => x.aufgabe).join(", ") : "kein Stand");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- auf dem Hackingweg gar kein Gym --");
{
  const m = await fahre({ geld: 1e9, koerper: [{}], verfahren: "V1 10 2" });
  const s = stand(m);
  pruefe("V1: der Koerper begeht ein Verbrechen",
    !!s && s.sleeves.every((x) => x.grund === "hackingweg"),
    s ? JSON.stringify(s.stand) : "kein Stand");
  pruefe("und Kampfwerte werden nicht trainiert",
    m.zustand.koerper.every((k) => k.aufgabe && k.aufgabe.type === "CRIME"));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Seed, und der Waechter darueber --");
{
  // AUFTRAG 6.1 FORDERT EINEN SEED. Heute ist im Mock nichts zufaellig - der
  // Seed hat also noch keinen Nutzer, und ein Feld ohne Leser ist in diesem
  // Projekt eine wiederkehrende Fehlerklasse.
  //
  // Deshalb bekommt er hier einen: die Probe verbietet `Math.random` im Mock.
  // Damit ist der Seed kein totes Feld, sondern die einzige erlaubte
  // Zufallsquelle - wer das erste zufaellige Verhalten einbaut, findet sie vor
  // und den bequemen Weg versperrt.
  // KOMMENTARE ZAEHLEN NICHT - dieselbe Lehre wie bei der Schreiberprobe:
  // die Zeichenkette steht in dieser Datei mehrfach in Erklaerungen, und ein
  // Test, der an einem Kommentar scheitert, wird abgeschaltet statt gelesen.
  const mockTxt = ohneKommentare(
    fs.readFileSync(path.join(HIER, "mock", "ns.js"), "utf8"));
  pruefe("der Mock benutzt kein Math.random",
    !/Math\.random/.test(mockTxt),
    "sonst waere ein Testlauf nicht wiederholbar, und ein Fehler, der nur bei"
    + " einem bestimmten Wurf auftritt, nicht nachstellbar");

  const a = neuerMock({ seed: 42 });
  const b = neuerMock({ seed: 42 });
  const c = neuerMock({ seed: 43 });
  const folge = (m) => [m.zufall(), m.zufall(), m.zufall()];
  const fa = folge(a);
  pruefe("derselbe Seed ergibt dieselbe Folge",
    JSON.stringify(fa) === JSON.stringify(folge(b)));
  pruefe("ein anderer Seed eine andere",
    JSON.stringify(fa) !== JSON.stringify(folge(c)));
  pruefe("und die Werte liegen in [0,1)",
    fa.every((x) => x >= 0 && x < 1), fa.map((x) => x.toFixed(4)).join(", "));
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


// ---------------------------------------------------------------------------
console.log("");
console.log("-- waehrend blade.js aufraeumt, legen die Sleeves kein Chaos nach (22.09.2026) --");
{
  // Bounty Hunter +0,02 und Retirement +0,04 Chaos je Erfolg, Tracking keines
  // (Bladeburner.ts:872-885). Zwei Sleeves duerfen nicht denselben Vertrag
  // fahren - einer bekommt Tracking, der andere Infiltrate.
  const kampf = { strength: 200, defense: 200, dexterity: 200, agility: 200 };
  const vertraege = {
    "Contracts/Tracking": { vorrat: 100, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Bounty Hunter": { vorrat: 200, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Retirement": { vorrat: 300, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
  };
  const lauf = (aufraeumen) => fahre({
    geld: 1e12,
    koerper: [{ skills: kampf }, { skills: kampf }],
    blade: { drin: true, aktionen: vertraege },
    dateien: { "data/blade.json": JSON.stringify({ zeit: W0, aufraeumen }) },
  });
  const auf = stand(await lauf(true));
  const aufgaben = auf ? auf.sleeves.map((x) => x.aufgabe) : [];
  pruefe("beim Aufraeumen kein Bounty Hunter und kein Retirement",
    aufgaben.length === 2 && !aufgaben.some((a) => /Bounty Hunter|Retirement/.test(String(a))),
    aufgaben.join(", ") || "kein Stand");
  pruefe("einer faehrt Tracking, der andere Infiltrate",
    aufgaben.includes("contract:Tracking") && aufgaben.includes("infiltrate"),
    aufgaben.join(", "));
  // Gegenprobe: ohne Aufraeumen duerfen die chaostreibenden Vertraege wieder.
  const frei = stand(await lauf(false));
  const aufgabenFrei = frei ? frei.sleeves.map((x) => x.aufgabe) : [];
  // Retirement hat den groessten Vorrat - ohne Aufraeumen waehlt der Code danach.
  pruefe("ohne Aufraeumen: Retirement und Bounty Hunter (nach Vorrat)",
    aufgabenFrei.includes("contract:Retirement") && aufgabenFrei.includes("contract:Bounty Hunter"),
    aufgabenFrei.join(", ") || "kein Stand");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
