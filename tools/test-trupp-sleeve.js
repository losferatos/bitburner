/**
 * Trupp fuer die Black Op: blade.js meldet den echten Bedarf, sleeve.js
 * schickt GENAU EINEN Sleeve auf Recruitment, wenn der naechste Mann lohnt
 * (03.10.2026, BAUSTELLEN "truppAnfrage hat keinen Leser").
 *
 * Geprueft wird:
 *   A. die Rechnung in src/sleeve.js gegen tools/trupp-rechnung.js (zwei
 *      Abschriften derselben Quellcodezeilen, Ebene 0),
 *   B. die Wahl des Rekrutierers (rein, ohne Mock),
 *   C. blade.js gegen den ns-Mock: Anfrage nur bei echtem Bedarf, Feuern
 *      MIT dem Pool, und der Pool wird der Op wirklich zugeteilt,
 *   D. sleeve.js gegen den ns-Mock: ein Sleeve rekrutiert, wird nicht neu
 *      gesetzt, und kehrt ohne Anfrage zurueck; der Hackingweg bleibt unberuehrt.
 *
 * Die Black-Op-Chance laesst sich im Mock exakt einstellen: blade.js rechnet
 * sie aus den Spielerwerten (blackOpChance), und sie ist linear in
 * `mults.bladeburner_success_chance` (Action.ts:190). Eine Proberunde mit
 * Faktor 1 liefert c1, danach ergibt Faktor ziel/c1 genau die Wunschchance.
 *
 * ROT GEGEN DIE ALTE FASSUNG:
 *   node tools/test-trupp-sleeve.js --blade <alt>/src/blade.js --sleeve <alt>/src/sleeve.js
 * (der Ordner muss `src` heissen und `lib/` enthalten, siehe mock/lader.js).
 *
 * Aufruf: node tools/test-trupp-sleeve.js [--blade <pfad>] [--sleeve <pfad>]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden, ladeSpielskript } from "./mock/lader.js";
import * as R from "./trupp-rechnung.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
};
const BLADE = arg("--blade");
const SLEEVE = arg("--sleeve");

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
const ladeSleeve = async () => (SLEEVE ? ladeSpielskript(SLEEVE) : (await ladeAusBeiden(ROOT, "sleeve.js")).modul);

const W0 = 1_700_000_000_000;
const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

// ---------------------------------------------------------------------------
console.log("");
console.log("=== A. Rechnung in sleeve.js = Rechnung in tools/trupp-rechnung.js ===");
const S = await ladeSleeve();
{
  const da = ["rekrutierZeitS", "rekrutierChance", "naechsterMannS", "mannGewinnS", "waehleRekrutierer", "istRekrutierung"]
    .filter((n) => typeof S[n] === "function");
  pruefe("sleeve.js exportiert die Truppfunktionen", da.length === 6, da.join(", ") || "keine");
  if (da.length === 6) {
    let abw = 0, faelle = 0;
    for (const cha of [1, 2, 5, 10, 25, 52, 100, 264, 1000]) {
      for (let k = 0; k <= 12; k++) {
        faelle++;
        if (S.naechsterMannS(cha, k) !== R.naechsterMannS(cha, k)) abw++;
        if (S.rekrutierZeitS(cha) !== R.rekrutierZeitS(cha)) abw++;
        if (Math.abs(S.mannGewinnS(k, 0.115) - R.mannGewinnS(k, 0.115)) > 1e-9) abw++;
      }
    }
    pruefe("gleiche Zahlen in " + faelle + " Faellen (Charisma 1-1000, Trupp 0-12)", abw === 0, abw + " Abweichungen");
    pruefe("Quellcodezeile nachgerechnet: Charisma 1 -> 299 s, 264 -> 206 s",
      S.rekrutierZeitS(1) === 299 && S.rekrutierZeitS(264) === 206,
      S.rekrutierZeitS(1) + " / " + S.rekrutierZeitS(264));
    pruefe("Charisma 1, Trupp 2: Chance 1/3, also 897 s je Mann",
      S.naechsterMannS(1, 2) === 897, String(S.naechsterMannS(1, 2)));
  }
  pruefe("maennerNoetig: 0,85 gegen 0,90 braucht 3 Mann (3^0,05 = 1,0565 reicht nicht, 4^0,05 = 1,0718 reicht)",
    R.maennerNoetig(0.85, 0.9) === 3, String(R.maennerNoetig(0.85, 0.9)));
  let mAbw = 0;
  for (let c = 0.5; c < 1; c += 0.0037) {
    const n = R.maennerNoetig(c, 0.9);
    if (!(c * R.truppBonus(n) >= 0.9) || (n > 1 && c * R.truppBonus(n - 1) >= 0.9)) mAbw++;
  }
  pruefe("maennerNoetig ist die KLEINSTE ausreichende Zahl (136 Chancen 0,50-0,99)", mAbw === 0, mAbw + " falsch");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=== B. Wer rekrutiert? (rein, ohne Mock) ===");
if (typeof S.waehleRekrutierer === "function") {
  const bj = (o = {}) => ({ zeit: W0, truppZeit: W0, truppAnfrage: true, truppFehlt: 3, truppPool: 0, ...o });
  const k3 = [{ cha: 1, kampf: 39, rekrutiert: false }, { cha: 1, kampf: 38, rekrutiert: false },
    { cha: 1, kampf: 40, rekrutiert: false }];
  pruefe("keine Anfrage -> keiner", S.waehleRekrutierer(bj({ truppAnfrage: false }), W0, k3).nr === -1);
  pruefe("Anfrage 6 min alt -> keiner (Frische 5 min)", S.waehleRekrutierer(bj(), W0 + 6 * 60000, k3).nr === -1);
  pruefe("Datei frisch (zeit), aber Truppfrage eingefroren (truppZeit 10 min alt) -> keiner",
    S.waehleRekrutierer(bj({ zeit: W0, truppZeit: W0 - 10 * 60000 }), W0, k3).nr === -1);
  pruefe("Anfrage ohne truppFehlt -> keiner (alte blade.js-Fassung)",
    S.waehleRekrutierer({ zeit: W0, truppZeit: W0, truppAnfrage: true }, W0, k3).nr === -1);
  const w = S.waehleRekrutierer(bj(), W0, k3);
  pruefe("Charisma-Gleichstand: der schwaechste Kaempfer (Sleeve 1, Tiefstand 38)", w.nr === 1, JSON.stringify(w));
  const k3b = [{ cha: 1, kampf: 38 }, { cha: 7, kampf: 60 }, { cha: 1, kampf: 38 }];
  pruefe("hoechstes Charisma gewinnt vor dem Kampfwert", S.waehleRekrutierer(bj(), W0, k3b).nr === 1);
  const k3c = [{ cha: 9, kampf: 38 }, { cha: 1, kampf: 38 }, { cha: 1, kampf: 60, rekrutiert: true }];
  pruefe("wer schon rekrutiert, bleibt (kein Neusetzen)", S.waehleRekrutierer(bj(), W0, k3c).nr === 2);
  // Kosten = Sleeve-Zeit * 0,05 (Vertragsrang des Sleeves), nicht die
  // Sleeve-Zeit selbst (Skeptiker 03.10.).
  pruefe("Charisma 1, Pool 5: der sechste Mann lohnt (1.794 s * 0,05 = 90 s gegen 241 s)",
    S.waehleRekrutierer(bj({ truppPool: 5 }), W0, k3).nr === 1,
    S.waehleRekrutierer(bj({ truppPool: 5 }), W0, k3).grund);
  pruefe("Charisma 1, Pool 30: lohnt nicht mehr (463 s gegen 50 s)",
    S.waehleRekrutierer(bj({ truppPool: 30 }), W0, k3).nr === -1,
    S.waehleRekrutierer(bj({ truppPool: 30 }), W0, k3).grund);
} else {
  pruefe("waehleRekrutierer vorhanden", false, "fehlt in sleeve.js");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=== C. blade.js gegen den Mock ===");

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
  // Spanne 0 und eine Mockchance, die NIE reicht: entscheiden muss die
  // gerechnete Chance, nicht die Mockzahl.
  raus["Black Operations/Operation Typhoon"] = { chance: 0.01, spanne: 0, vorrat: 1 };
  return raus;
}
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
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1000),
    blade: {
      drin: true, rang: o.rang ?? 3000, punkte: 0, ausdauer: [100, 100], stadt: "Sector-12",
      truppe: o.pool ?? 0,
      staedte: Object.fromEntries(STAEDTE.map((s) => [s, { chaos: 10, comms: 60, pop: 1.2e9 }])),
      aktionen: aktionen(), fertigkeiten: {},
      blackOps: [{ name: "Operation Typhoon", rank: 2500 }],
    },
  });
  Object.assign(m.zustand.spieler.skills, SKILLS);
  m.zustand.spieler.mults = { bladeburner_success_chance: o.mult ?? 1 };
  if (o.opTrupp) m.zustand.blade.opTrupp = { "Operation Typhoon": o.opTrupp };
  const modul = await ladeBlade();
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  let lage = null;
  try { lage = JSON.parse(m.lies("home", "data/blade.json")); } catch { lage = null; }
  const gest = m.zustand.blade.gestartet.map((g) => g.typ + "/" + g.name);
  return { m, lage, gest, bo: gest.includes("Black Operations/Operation Typhoon"),
    opTrupp: (m.zustand.blade.opTrupp || {})["Operation Typhoon"] ?? 0 };
}

// Proberunde: die gerechnete Chance mit Faktor 1 (ohne Trupp).
const probe = await fahreBlade({ rang: 1000, runden: 1 });
const c1 = probe.lage && probe.lage.boChancen ? probe.lage.boChancen["Operation Typhoon"] : null;
pruefe("Proberunde: blade.js rechnet die Typhoon-Chance (boChancen)", Number.isFinite(c1) && c1 > 0, String(c1));
const multFuer = (ziel) => ziel / c1;
const kurz = (r) => JSON.stringify({ tA: r.lage && r.lage.truppAnfrage, fehlt: r.lage && r.lage.truppFehlt,
  pool: r.lage && r.lage.truppPool, bo: r.bo, opTrupp: r.opTrupp });

if (Number.isFinite(c1) && c1 > 0) {
  console.log("");
  console.log("-- Chance ohne Trupp 0,85 gegen Schwelle 0,90, Pool leer: Anfrage mit 3 fehlenden Maennern --");
  {
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 0 });
    pruefe("truppAnfrage true", !!r.lage && r.lage.truppAnfrage === true, kurz(r));
    pruefe("truppFehlt 3 (3^0,05*0,85 = 0,898 < 0,90 <= 4^0,05*0,85)", !!r.lage && r.lage.truppFehlt === 3, kurz(r));
    pruefe("truppPool 0", !!r.lage && r.lage.truppPool === 0, kurz(r));
    pruefe("truppZeit gestempelt (Frische fuer sleeve.js)", !!r.lage && Number.isFinite(r.lage.truppZeit),
      String(r.lage && r.lage.truppZeit));
    pruefe("die Black Op feuert NICHT (0,85 < 0,90)", !r.bo, r.gest.join(", "));
  }

  console.log("");
  console.log("-- dieselbe Chance, Pool 3: keine Anfrage, Feuer MIT Trupp, der Op wirklich zugeteilt --");
  {
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 3 });
    pruefe("truppAnfrage false (Pool reicht)", !!r.lage && r.lage.truppAnfrage === false, kurz(r));
    pruefe("die Black Op feuert (0,85 * 4^0,05 = 0,911 >= 0,90)", r.bo, r.gest.join(", "));
    pruefe("und der Pool ist ihr zugeteilt (setTeamSize(B, Typhoon, 3))", r.opTrupp === 3, kurz(r));
  }

  console.log("");
  console.log("-- Chance ohne Trupp traegt schon (0,95): Feuer OHNE Trupp, auch wenn ein alter Einsatz stand --");
  {
    const r = await fahreBlade({ mult: multFuer(0.95), pool: 4, opTrupp: 4 });
    pruefe("die Black Op feuert", r.bo, r.gest.join(", "));
    pruefe("der Einsatz steht auf 0 - kein Mann wird verheizt", r.opTrupp === 0, kurz(r));
    pruefe("keine Anfrage", !!r.lage && r.lage.truppAnfrage === false, kurz(r));
  }

  console.log("");
  console.log("-- ein schon zugeteilter Trupp verfaelscht die Chance ohne Trupp nicht --");
  {
    // blackOpChance liest den Trupp DIESER Op. Steht dort 3 (frueherer
    // Tick), waere die Rohchance 0,85*4^0,05 = 0,911 - die Rechnung muss
    // trotzdem 0,85 sehen und mit Pool 2 eine Anfrage stellen.
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 3, opTrupp: 3, runden: 1 });
    pruefe("mit Pool 3 und Einsatz 3: Feuer, keine Anfrage", r.bo && r.lage.truppAnfrage === false, kurz(r));
    // Gegen die alte Fassung ROT: sie setzte den Einsatz vor `startAction`
    // auf 0 und rief dann `blackOpChance()` ausserhalb von `waehle()` - der
    // ReferenceError fiel ins catch, der Trupp blieb bei 0.
    pruefe("und nach dem Start steht der Trupp noch bei 3 (nicht auf 0 geloescht)", r.opTrupp === 3, kurz(r));
  }

  console.log("");
  console.log("-- Chance 0,50: Luecke groesser als Faktor 1,2 - keine Anfrage --");
  {
    const r = await fahreBlade({ mult: multFuer(0.5), pool: 0 });
    pruefe("truppAnfrage false", !!r.lage && r.lage.truppAnfrage === false, kurz(r));
    pruefe("truppFehlt 0", !!r.lage && r.lage.truppFehlt === 0, kurz(r));
  }

  console.log("");
  console.log("-- Vorlauf: Chance 0,78 (0,78*1,2 >= 0,90, aber 6 Mann reichen nicht) - Anfrage auf 6 --");
  {
    const r = await fahreBlade({ mult: multFuer(0.78), pool: 2 });
    pruefe("truppAnfrage true", !!r.lage && r.lage.truppAnfrage === true, kurz(r));
    pruefe("truppFehlt 4 (Ziel min(noetig, 6) = 6, Pool 2)", !!r.lage && r.lage.truppFehlt === 4, kurz(r));
    pruefe("nicht gefeuert (0,78*3^0,05 = 0,82)", !r.bo, r.gest.join(", "));
  }

  console.log("");
  console.log("-- Pool 6, gebraucht 3: nur 3 Mann gehen mit (Verluste wachsen mit dem Einsatz) --");
  {
    const r = await fahreBlade({ mult: multFuer(0.85), pool: 6 });
    pruefe("gefeuert", r.bo, r.gest.join(", "));
    pruefe("Einsatz 3, nicht 6", r.opTrupp === 3, kurz(r));
  }

  console.log("");
  console.log("-- Rang: Anfrage erst ab 90 % des Tors --");
  {
    const weit = await fahreBlade({ mult: multFuer(0.85), pool: 0, rang: 2000 });
    pruefe("Rang 2.000 (80 % von 2.500): keine Anfrage", !!weit.lage && weit.lage.truppAnfrage === false, kurz(weit));
    const nah = await fahreBlade({ mult: multFuer(0.85), pool: 0, rang: 2300 });
    pruefe("Rang 2.300 (92 %): Anfrage", !!nah.lage && nah.lage.truppAnfrage === true, kurz(nah));
    pruefe("und vor dem Tor feuert nichts", !nah.bo, nah.gest.join(", "));
  }

  console.log("");
  console.log("-- der Lagewert vom 03.10. (Chance 0,07, Pool 0) meldet KEINEN Bedarf mehr --");
  {
    const r = await fahreBlade({ mult: multFuer(0.0715), pool: 0, rang: 1260 });
    pruefe("truppAnfrage false (bis heute true - das Rauschen)", !!r.lage && r.lage.truppAnfrage === false, kurz(r));
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=== D. sleeve.js gegen den Mock ===");

async function fahreSleeve(o) {
  const m = neuerMock({
    host: "home", knoten: o.knoten ?? 2, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000, geld: 1e12,
    koerper: o.koerper,
    blade: { drin: true, aktionen: {
      "Contracts/Tracking": { vorrat: 100, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
      "Contracts/Bounty Hunter": { vorrat: 200, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
      "Contracts/Retirement": { vorrat: 300, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    } },
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "data/verfahren.txt": o.verfahren || "V2 2 1",
      ...(o.blade ? { "data/blade.json": JSON.stringify(o.blade) } : {}) } },
    maxSchlaf: o.runden ?? 2,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1),
  });
  const modul = await ladeSleeve();
  const gesetzt = [];
  const orig = m.ns.sleeve.setToBladeburnerAction;
  m.ns.sleeve.setToBladeburnerAction = (i, art, name) => { gesetzt.push(i + ":" + art); return orig(i, art, name); };
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  let st = null;
  try { st = JSON.parse(m.lies("home", "data/sleeve.json")); } catch { st = null; }
  return { m, st, gesetzt, aufgaben: st ? st.sleeves.map((x) => x.aufgabe) : [] };
}
const kampf = (k, cha = 1) => ({ strength: k, defense: k, dexterity: k, agility: k, charisma: cha });
const anfrage = { zeit: W0, truppZeit: W0, truppAnfrage: true, truppFehlt: 3, truppPool: 0 };

{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(60) }, { skills: kampf(45) }, { skills: kampf(70) }],
    blade: anfrage, runden: 3 });
  pruefe("Anfrage, Charisma-Gleichstand: genau EIN Sleeve rekrutiert, der schwaechste (Sleeve 1)",
    r.aufgaben.filter((a) => a === "recruitment").length === 1 && r.aufgaben[1] === "recruitment",
    r.aufgaben.join(", "));
  const rek = r.gesetzt.filter((g) => g === "1:Recruitment").length;
  pruefe("ueber drei Takte nur EINMAL gesetzt (laufende Arbeit bleibt)", rek === 1, r.gesetzt.join(" "));
  pruefe("die anderen fahren Vertraege", /^contract:/.test(r.aufgaben[0]) && /^contract:/.test(r.aufgaben[2]),
    r.aufgaben.join(", "));
}
{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(38) }, { skills: kampf(38, 4) }],
    blade: anfrage });
  pruefe("Gym-Phase (Kampfwert 38): der mit Charisma 4 rekrutiert, der andere bleibt im Gym",
    r.aufgaben[1] === "recruitment" && r.aufgaben[0] !== "recruitment", r.aufgaben.join(", "));
}
{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(60) }, { skills: kampf(45) }],
    blade: { ...anfrage, truppPool: 30 } });
  pruefe("Pool 30, Charisma 1: lohnt nicht - niemand rekrutiert",
    !r.aufgaben.includes("recruitment"), r.aufgaben.join(", ") + " / " + (r.st && r.st.trupp && r.st.trupp.grund));
}
{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(60) }, { skills: kampf(45) }],
    blade: { ...anfrage, truppAnfrage: false } });
  pruefe("ohne Anfrage: niemand rekrutiert", !r.aufgaben.includes("recruitment"), r.aufgaben.join(", "));
}
{
  // Zurueck in den normalen Zweig: Sleeve 1 rekrutiert schon, die Anfrage
  // ist weg - er muss im selben Takt wieder einen Vertrag bekommen.
  const r = await fahreSleeve({
    koerper: [{ skills: kampf(60) },
      { skills: kampf(45), aufgabe: { type: "BLADEBURNER", actionType: "General", actionName: "Recruitment" } }],
    blade: { ...anfrage, truppAnfrage: false }, runden: 1 });
  pruefe("Anfrage weg: der Rekrutierer faehrt wieder Vertrag", /^contract:/.test(r.aufgaben[1]), r.aufgaben.join(", "));
}
{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(60) }, { skills: kampf(45) }],
    blade: { ...anfrage, truppZeit: W0 - 10 * 60000 } });
  pruefe("blade.json 10 min alt: niemand rekrutiert", !r.aufgaben.includes("recruitment"), r.aufgaben.join(", "));
}
{
  const r = await fahreSleeve({ koerper: [{ skills: kampf(60) }, { skills: kampf(45) }],
    blade: anfrage, verfahren: "V1 2 1" });
  pruefe("Hackingweg (V1): kein Recruitment, trotz Anfrage", !r.aufgaben.includes("recruitment")
    && !r.gesetzt.some((g) => /Recruitment/.test(g)), r.aufgaben.join(", "));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehlerListe) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
