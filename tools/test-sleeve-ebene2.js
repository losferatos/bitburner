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
    beiSchlaf: (ms, z, vorRuecken) => {
      if (o.zwischendurch) o.zwischendurch(m, z);
      return vorRuecken(o.schrittMs ?? 1);
    },
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

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Skeptiker-Audit 26.09.2026 Fund 5: knappe Operation schlaegt Vertrag --");
{
  // In der Op-Phase faehrt der Spieler eine Operation (Assassination), keine
  // Vertraege - deren Vorrat waechst dann nur, und Sleeves blieben bislang
  // IMMER auf Vertraegen, obwohl Infiltrate genauso auf Operationen wirkt
  // (Bladeburner.ts:1251-1263). Gerechnet in src/sleeve.js (Kommentar beim
  // neuen Block): 160-200/h Verbrauch gegen 7,9/h Nachwuchs plus bis zu
  // ~80/h aus Infiltrate - kein voller Ausgleich, aber eine Nettoabflussrate
  // um bis zu ein Drittel niedriger, deshalb die Schwelle: unter 2 h Vorrat
  // (200/h * 2h = 400) geht der Sleeve auf Infiltrate, obwohl Vertraege noch
  // reichlich Vorrat haetten.
  const kampf = { strength: 200, defense: 200, dexterity: 200, agility: 200 };
  const vertraegeUndOps = (assassinationVorrat) => ({
    "Contracts/Tracking": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Bounty Hunter": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Retirement": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Operations/Assassination": { vorrat: assassinationVorrat, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
  });
  const lauf = (assassinationVorrat) => fahre({
    geld: 1e12,
    koerper: [{ skills: kampf }, { skills: kampf }],
    blade: { drin: true, aktionen: vertraegeUndOps(assassinationVorrat) },
    dateien: { "data/blade.json": JSON.stringify({ zeit: W0, istAktion: "Operations/Assassination" }) },
  });

  const knapp = stand(await lauf(50));   // 50 < 400 = 200/h * 2h
  const aufgabenKnapp = knapp ? knapp.sleeves.map((x) => x.aufgabe) : [];
  // Seit 12.10.2026 nur EIN Nachfueller (Infiltrate-Ertrag 30*sqrt(N)/h,
  // der zweite Sleeve bringt nur 12,4/h dazu - ein Vertrag gibt sofort Rang).
  pruefe(
    "Assassination knapp (50 von 400 Vorlauf): genau EIN Sleeve geht auf Infiltrate, der andere faehrt Vertrag",
    aufgabenKnapp.length === 2 && aufgabenKnapp.filter((a) => a === "infiltrate").length === 1
      && aufgabenKnapp.filter((a) => /^contract:/.test(String(a))).length === 1,
    aufgabenKnapp.join(", ") || "kein Stand",
  );
  pruefe("... mit Grund in der Telemetrie",
    !!knapp && knapp.sleeves.some((x) => x.aufgabe === "infiltrate" && x.infilGrund === "knapp:Assassination"),
    knapp ? JSON.stringify(knapp.sleeves.map((x) => x.infilGrund)) : "kein Stand");

  const reichlich = stand(await lauf(5000));   // weit ueber der Schwelle
  const aufgabenReichlich = reichlich ? reichlich.sleeves.map((x) => x.aufgabe) : [];
  pruefe(
    "Assassination reichlich (5.000): Sleeves fahren wieder Vertraege wie zuvor",
    aufgabenReichlich.length === 2 && aufgabenReichlich.every((a) => /^contract:/.test(String(a))),
    aufgabenReichlich.join(", ") || "kein Stand",
  );
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ein laufender Infiltrate wird abgeloest, sobald sein Grund weg ist (12.10.2026) --");
{
  // BN11.3: alle drei Sleeves 18,7 h auf Infiltrate, 1.268 Retirement /
  // 1.247 Tracking / 586 Bounty Hunter auf Vorrat. Der INFILTRATE-Zweig hielt
  // ihn fuer immer fest. Der Mock legte Infiltrate bis heute als BLADEBURNER
  // ab - der Zweig lief in keinem Test.
  const kampf = { strength: 200, defense: 200, dexterity: 200, agility: 200 };
  const aktionen = (raidVorrat) => ({
    "Contracts/Tracking": { vorrat: 1247, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Bounty Hunter": { vorrat: 586, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Retirement": { vorrat: 1268, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Operations/Raid": { vorrat: raidVorrat, stufe: 1, maxStufe: 10, chance: 0.5, dauer: 30000 },
  });
  const infil = () => ({ type: "INFILTRATE", cyclesWorked: 123 });
  const lauf = (raidVorrat, extra = {}) => fahre({
    geld: 1e12,
    koerper: [{ skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }],
    blade: { drin: true, aktionen: aktionen(raidVorrat) },
    dateien: { "data/blade.json": JSON.stringify({ zeit: W0, istAktion: "Operations/Raid", ...extra }) },
  });

  const m1 = await lauf(602);
  const a1 = m1.zustand.koerper.map((k) => k.aufgabe && (k.aufgabe.actionName || k.aufgabe.type));
  pruefe("Vorrat reichlich, Raid nicht knapp: alle drei Sleeves verlassen Infiltrate fuer Vertraege",
    a1.length === 3 && a1.every((x) => ["Tracking", "Bounty Hunter", "Retirement"].includes(x)), a1.join(", "));
  pruefe("... und zwar drei verschiedene", new Set(a1).size === 3, a1.join(", "));

  const m2 = await lauf(50);   // 50 < 400: Raid knapp
  const a2 = m2.zustand.koerper.map((k) => k.aufgabe);
  pruefe("Raid knapp: Sleeve 0 bleibt als einziger Nachfueller auf Infiltrate, ungestoert (cyclesWorked 123)",
    a2[0] && a2[0].type === "INFILTRATE" && a2[0].cyclesWorked === 123,
    a2.map((x) => x && (x.actionName || x.type + "/" + x.cyclesWorked)).join(", "));
  pruefe("... Sleeve 1 und 2 fahren Vertraege",
    a2.slice(1).every((x) => x && x.type === "BLADEBURNER" && x.actionType === "Contracts"),
    a2.map((x) => x && (x.actionName || x.type)).join(", "));

  // Hysterese: Vertraege nur 10 auf Vorrat - Infiltrate wird nicht verlassen.
  {
    const m = await fahre({
      geld: 1e12,
      koerper: [{ skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }],
      blade: { drin: true, aktionen: {
        "Contracts/Tracking": { vorrat: 10, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
        "Contracts/Bounty Hunter": { vorrat: 10, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
        "Contracts/Retirement": { vorrat: 10, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
      } },
      dateien: { "data/blade.json": JSON.stringify({ zeit: W0 }) },
    });
    const a = m.zustand.koerper.map((k) => k.aufgabe);
    pruefe("Hysterese: bei Vorrat 10 (unter 20) bleibt Infiltrate ungestoert",
      a.every((x) => x && x.type === "INFILTRATE" && x.cyclesWorked === 123),
      a.map((x) => x && (x.actionName || x.type + "/" + x.cyclesWorked)).join(", "));
  }

  // Alle drei auf Vertraegen, Raid wird knapp: der LETZTE gibt ab und fuellt nach.
  {
    const vertrag = (n) => ({ type: "BLADEBURNER", actionType: "Contracts", actionName: n });
    const m = await fahre({
      geld: 1e12,
      koerper: [{ skills: kampf, aufgabe: vertrag("Tracking") }, { skills: kampf, aufgabe: vertrag("Bounty Hunter") },
        { skills: kampf, aufgabe: vertrag("Retirement") }],
      blade: { drin: true, aktionen: aktionen(50) },
      dateien: { "data/blade.json": JSON.stringify({ zeit: W0, istAktion: "Operations/Raid" }) },
    });
    const a = m.zustand.koerper.map((k) => k.aufgabe);
    pruefe("Raid knapp, alle auf Vertraegen: Sleeve 2 wird Nachfueller, 0 und 1 bleiben auf ihren Vertraegen",
      a[0].actionName === "Tracking" && a[1].actionName === "Bounty Hunter" && a[2].type === "INFILTRATE",
      a.map((x) => x && (x.actionName || x.type)).join(", "));
  }

  // Spieler wechselt zwischen Raid und Diplomacy (12.10.2026, Skeptiker
  // Runde 2): der Nachfueller bleibt ueber den Wechsel auf Infiltrate.
  {
    let runde = 0;
    const m = await fahre({
      geld: 1e12,
      runden: 3,
      koerper: [{ skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }],
      blade: { drin: true, aktionen: aktionen(50) },
      dateien: { "data/blade.json": JSON.stringify({ zeit: W0, istAktion: "Operations/Raid" }) },
      zwischendurch: (mm) => {
        runde++;
        mm.zustand.dateien.home["data/blade.json"] = JSON.stringify({ zeit: W0, istAktion: "General/Diplomacy" });
      },
    });
    const a = m.zustand.koerper.map((k) => k.aufgabe);
    pruefe("Raid -> Diplomacy: Nachfueller bleibt ungestoert auf Infiltrate (Gedaechtnis 10 min)",
      runde >= 1 && a[0] && a[0].type === "INFILTRATE" && a[0].cyclesWorked === 123,
      "Runden " + runde + ": " + a.map((x) => x && (x.actionName || x.type + "/" + x.cyclesWorked)).join(", "));
  }

  // Veraltete blade.json (blade.js haengt): keine knappe Operation mehr.
  {
    const m = await fahre({
      geld: 1e12,
      koerper: [{ skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }, { skills: kampf, aufgabe: infil() }],
      blade: { drin: true, aktionen: aktionen(50) },
      dateien: { "data/blade.json": JSON.stringify({ zeit: W0 - 3600000, istAktion: "Operations/Raid" }) },
    });
    const a = m.zustand.koerper.map((k) => k.aufgabe);
    pruefe("blade.json eine Stunde alt: Raid gilt nicht als knapp, alle drei fahren Vertraege",
      a.every((x) => x && x.type === "BLADEBURNER"), a.map((x) => x && (x.actionName || x.type)).join(", "));
  }

  // Aufraeumen: nur Tracking erlaubt - einer nimmt es, die anderen bleiben
  // ungestoert auf Infiltrate.
  const m3 = await lauf(602, { aufraeumen: true });
  const a3 = m3.zustand.koerper.map((k) => k.aufgabe);
  const tracking = a3.filter((x) => x && x.actionName === "Tracking").length;
  const ungestoert = a3.filter((x) => x && x.type === "INFILTRATE" && x.cyclesWorked === 123).length;
  pruefe("Aufraeumen: genau einer faehrt Tracking, zwei bleiben ungestoert auf Infiltrate",
    tracking === 1 && ungestoert === 2, a3.map((x) => x && (x.actionName || x.type + "/" + x.cyclesWorked)).join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Chaos-Bremse: Sleeves legen kein Chaos nach, einer faehrt Diplomacy (12.10.2026) --");
{
  // 12.10.: nach dem Einbau trainierte die Figur, die Sleeves fuhren beim
  // Nachholen Retirement/Bounty Hunter - Ishima von 6 auf ueber 50, ohne dass
  // jemand aufraeumte (blade.json chaos war in diesem Pfad null).
  const kampf = { strength: 200, defense: 200, dexterity: 200, agility: 200 };
  const aktionen = {
    "Contracts/Tracking": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Bounty Hunter": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Retirement": { vorrat: 1000, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
  };
  const vertrag = (n) => ({ type: "BLADEBURNER", actionType: "Contracts", actionName: n });
  const diplo = () => ({ type: "BLADEBURNER", actionType: "General", actionName: "Diplomacy", cyclesWorked: 77 });
  const lauf = (chaosHier, aufgaben, extra = {}) => fahre({
    geld: 1e12,
    koerper: aufgaben.map((a) => ({ skills: kampf, aufgabe: a })),
    blade: { drin: true, aktionen },
    dateien: { "data/blade.json": JSON.stringify({ zeit: W0, chaosHier, ...extra }) },
  });
  const zeige = (a) => a.map((x) => x && (x.actionName || x.type)).join(", ");
  const drei = () => [vertrag("Tracking"), vertrag("Bounty Hunter"), vertrag("Retirement")];

  {
    const a = (await lauf(54, drei())).zustand.koerper.map((k) => k.aufgabe);
    pruefe("Chaos 54: genau ein Sleeve faehrt Diplomacy",
      a.filter((x) => x && x.actionName === "Diplomacy").length === 1, zeige(a));
    pruefe("... kein Bounty Hunter, kein Retirement mehr",
      !a.some((x) => x && /Bounty Hunter|Retirement/.test(String(x.actionName))), zeige(a));
    pruefe("... Tracking laeuft weiter (legt kein Chaos nach)",
      a.some((x) => x && x.actionName === "Tracking"), zeige(a));
  }
  {
    const a = (await lauf(49, drei())).zustand.koerper.map((k) => k.aufgabe);
    pruefe("Chaos 49 (blade.js haelt 47-50 selbst): keine Bremse, drei Vertraege",
      a.every((x) => x && x.actionType === "Contracts"), zeige(a));
  }
  {
    const a = (await lauf(42, [vertrag("Tracking"), vertrag("Bounty Hunter"), diplo()])).zustand.koerper.map((k) => k.aufgabe);
    pruefe("Chaos 42 und Diplomacy laeuft: sie bleibt, ungestoert (cyclesWorked 77)",
      a[2] && a[2].actionName === "Diplomacy" && a[2].cyclesWorked === 77, zeige(a));
  }
  {
    const a = (await lauf(38, [vertrag("Tracking"), vertrag("Bounty Hunter"), diplo()])).zustand.koerper.map((k) => k.aufgabe);
    pruefe("Chaos 38: Diplomacy endet, der Sleeve faehrt wieder einen Vertrag",
      a[2] && a[2].actionType === "Contracts", zeige(a));
  }
  {
    const a = (await lauf(20, drei())).zustand.koerper.map((k) => k.aufgabe);
    pruefe("Chaos 20: alles wie gehabt, drei Vertraege",
      a.every((x) => x && x.actionType === "Contracts"), zeige(a));
  }
  {
    const a = (await lauf(60, drei(), { zeit: W0 - 3600000 })).zustand.koerper.map((k) => k.aufgabe);
    pruefe("blade.json eine Stunde alt: keine Bremse auf alte Zahl",
      a.every((x) => x && x.actionType === "Contracts"), zeige(a));
  }
  const blade = ohneKommentare(fs.readFileSync(path.join(ROOT, "src", "blade.js"), "utf8"));
  pruefe("blade.js schreibt chaosHier bei jedem blade.json-Schreiben, im Fehlerfall null",
    blade.includes("chaosHier: (() => { try { const c = ns.bladeburner.getCityChaos(ns.bladeburner.getCity());"));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
