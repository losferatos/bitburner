/**
 * Ebene 2: `src/sleeve.js` im Hackingweg (V1: BN1/5/8/12) gegen den ns-Mock.
 *
 * ===========================================================================
 * WARUM (27.09.2026)
 * ===========================================================================
 *
 * Im BN5-Lauf 3 standen drei Sleeves zwanzig Stunden lang auf Shoplift:
 * `sleeveMin < 40 ? "Shoplift" : "Mug"` mit sleeveMin = Minimum ALLER VIER
 * Kampfwerte, und Shoplift trainiert nur dex/agi. Bei $19 Mrd auf dem Konto
 * brachten sie damit praktisch nichts. tools/sleeve-rechnung.js hat
 * gerechnet und geeicht, was stattdessen traegt: Faktionsarbeit (hacking vor
 * security), die automatische Schockerholung bis 65 stehenlassen, und
 * Verbrechen nur, wo Geld knapp ist UND Verbrechen Geld bringt (in BN8
 * nicht: CrimeMoney 0).
 *
 * Die Lagen unten sind die aus dem Backup BN5L3 16:08 (dex/agi 102, str/def
 * 1, hack 1, int 24, Schock 64) und die Faktionsliste aus data/bn4rep.json
 * desselben Backups.
 *
 * ROT GEGEN DIE ALTE FASSUNG: `node tools/test-sleeve-hackingweg.js --datei
 * <pfad>/src/sleeve.js` laedt eine andere Datei (sie muss unter einem Ordner
 * `src` liegen, der `lib/hostdatei.js` hat - so loest der Lader die Importe
 * auf). Gegen `git show <vorher>:src/sleeve.js` muessen die Proben zu
 * Faktionsarbeit, Mug, BN8 und Schockerholung rot sein.
 *
 * Aufruf: node tools/test-sleeve-hackingweg.js [--datei <pfad>]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden, ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const argDatei = (() => {
  const i = process.argv.indexOf("--datei");
  return i > 0 ? path.resolve(process.argv[i + 1]) : null;
})();

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

// Backup BN5L3 16:08, Sleeve 0 (die anderen beiden unterscheiden sich nur im int).
const SLEEVE_JETZT = { hacking: 1, strength: 1, defense: 1, dexterity: 102, agility: 102,
  charisma: 1, intelligence: 24 };
const FAKTIONEN = ["BitRunners", "The Black Hand", "NiteSec", "Aevum", "Sector-12", "Tetrads",
  "Slum Snakes", "Netburners", "Tian Di Hui", "CyberSec"];
// Faction/FactionInfo.tsx (Auszug): wer bietet welche Arbeit an.
const ARTEN = {
  "BitRunners": ["hacking"], "NiteSec": ["hacking"], "CyberSec": ["hacking"],
  "Netburners": ["hacking"], "The Black Hand": ["hacking", "field"],
  "Slum Snakes": ["field", "security"], "Tetrads": ["field", "security"],
  "Tian Di Hui": ["hacking", "security"],
};
const BN4REP = JSON.stringify({
  zielFaktion: "Slum Snakes",
  faktionen: FAKTIONEN,
  favor: { "BitRunners": 53.28, "The Black Hand": 14.81, "NiteSec": 81.28, "Aevum": 10.96,
    "Sector-12": 40.28, "Tetrads": 0, "Slum Snakes": 0.25, "Netburners": 2.1,
    "Tian Di Hui": 25.92, "CyberSec": 102.25 },
  rangliste: [
    { aug: "Combat Rib I", faktion: "Slum Snakes" },
    { aug: "SmartSonar Implant", faktion: "Slum Snakes" },
    { aug: "Artificial Bio-neural Network Implant", faktion: "BitRunners" },
  ],
});

async function fahre(o) {
  const koerper = (o.koerper || [{}, {}, {}]).map((k) => ({
    skills: { ...SLEEVE_JETZT }, shock: 64, sync: 1,
    aufgabe: { type: "CRIME", crimeType: "Shoplift" }, ...k,
  }));
  const dateien = { "data/verfahren.txt": o.verfahren || ("V1 " + (o.knoten ?? 5) + " 3") };
  if (o.mitRep !== false) {
    dateien["data/bn4rep.json"] = BN4REP;
    dateien["data/rep-modus.txt"] = (o.repModus ?? "Slum Snakes") + "|" + W0;
  }
  const m = neuerMock({
    host: "home",
    knoten: o.knoten ?? 5,
    wall: W0,
    playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000,
    augReset: W0 - 3600000,
    geld: o.geld ?? 19e9,
    koerper,
    faktionen: o.faktionen ?? FAKTIONEN,
    faktionsArten: ARTEN,
    server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: dateien },
    maxSchlaf: o.runden ?? 2,
    beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1),
  });
  const modul = argDatei ? await ladeSpielskript(argDatei)
    : (await ladeAusBeiden(ROOT, "sleeve.js")).modul;
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

function stand(m) {
  try { return JSON.parse(m.lies("home", "data/sleeve.json")); } catch { return null; }
}
const aufg = (m) => m.zustand.koerper.map((k) => k.aufgabe || {});
const kurz = (m) => JSON.stringify(aufg(m).map((a) => a.type + ":" + (a.factionName || a.crimeType || "")
  + (a.factionWorkType ? "/" + a.factionWorkType : "")));

console.log("");
console.log("=== sleeve.js im Hackingweg gegen den ns-Mock"
  + (argDatei ? " (Datei " + argDatei + ")" : "") + " ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- BN5, genug Geld: Faktionsarbeit statt Shoplift --");
{
  const m = await fahre({});
  const a = aufg(m);
  pruefe("alle drei Sleeves arbeiten fuer eine Faktion",
    a.length === 3 && a.every((x) => x.type === "FACTION"), kurz(m));
  const namen = a.map((x) => x.factionName);
  pruefe("drei VERSCHIEDENE Faktionen (das Spiel wirft sonst)",
    new Set(namen).size === 3, namen.join(", "));
  pruefe("Sleeve 0 arbeitet da, wo der Spieler gerade Reputation sammelt (Slum Snakes, security)",
    a[0].factionName === "Slum Snakes" && a[0].factionWorkType === "security", kurz(m));
  pruefe("Sleeve 1 nimmt die naechste Ranglisten-Faktion mit hacking (BitRunners)",
    a[1].factionName === "BitRunners" && a[1].factionWorkType === "hacking", kurz(m));
  pruefe("Sleeve 2 danach die mit dem meisten Favor (CyberSec 102)",
    a[2].factionName === "CyberSec", kurz(m));
  const s = stand(m);
  pruefe("die Telemetrie nennt Aufgabe, Faktion und Grund",
    !!s && s.sleeves.every((x) => /^faction:/.test(String(x.aufgabe)) && x.v1 === "faktion"
      && typeof x.faktion === "string" && x.grund === "hackingweg"),
    s ? JSON.stringify(s.sleeves.map((x) => [x.aufgabe, x.v1, x.faktion])) : "kein Stand");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Shoplift-Klemme: Geld knapp, dex/agi 102, str/def 1 -> Mug --");
{
  // Crime.ts:120-136: Mug (1,5*1 + 0,5*1 + 1,5*102 + 0,5*102 + 0,025*24) /
  // 975 / 0,2 * intBonus = 1,08 -> gedeckelt 1. 36.000 je 4 s schlaegt
  // 15.000 je 2 s. Die alte Schwelle haette wegen str/def = 1 Shoplift gewaehlt.
  const m = await fahre({ geld: 1e6 });
  pruefe("bei knappem Konto begehen die Sleeves ein Verbrechen",
    aufg(m).every((x) => x.type === "CRIME"), kurz(m));
  pruefe("und zwar Mug, nicht Shoplift",
    aufg(m).every((x) => x.crimeType === "Mug"), kurz(m));
  const s = stand(m);
  pruefe("der Grund steht in der Telemetrie (geld-knapp)",
    !!s && s.sleeves.every((x) => x.v1 === "geld-knapp"),
    s ? JSON.stringify(s.sleeves.map((x) => x.v1)) : "kein Stand");
  // Gegenprobe: ein frischer Sleeve (alles 1) - dort ist Shoplift besser
  // (Chance 0,045 gegen 0,012, mal 7.500 gegen 9.000 je Sekunde).
  const frisch = await fahre({ geld: 1e6, koerper: [{ skills: { hacking: 1, strength: 1, defense: 1,
    dexterity: 1, agility: 1, charisma: 1, intelligence: 24 } }] });
  pruefe("Gegenprobe: mit allen Werten 1 bleibt es Shoplift",
    aufg(frisch)[0].crimeType === "Shoplift", kurz(frisch));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- BN8: Verbrechen bringt null Dollar, also auch bei knappem Konto Faktion --");
{
  // BitNode.tsx:769 CrimeMoney 0. Das Gym bleibt verboten (es kostet), aber
  // Verbrechen als Geldquelle gibt es in BN8 nicht.
  const m = await fahre({ knoten: 8, geld: 1e6 });
  pruefe("BN8 mit 1 Mio auf dem Konto: Faktionsarbeit, kein Verbrechen",
    aufg(m).every((x) => x.type === "FACTION"), kurz(m));
  pruefe("und nie das Gym (Minus-Spirale vom 02.09.)",
    aufg(m).every((x) => x.type !== "CLASS"), kurz(m));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Schockerholung ueber 65 stehenlassen, darunter arbeiten --");
{
  // Das Spiel setzt beim Knotenwechsel und bei jedem Einbau selbst Recovery.
  // Ueber Schock 65 ist das die bessere Aufgabe (Rep und Exp gehen mit dem
  // Quadrat des Schockbonus; Recovery baut dreimal so schnell ab).
  const hoch = await fahre({ geld: 1e6, koerper: [
    { shock: 90, aufgabe: { type: "RECOVERY" } },
    { shock: 90, aufgabe: { type: "RECOVERY" } },
    { shock: 60, aufgabe: { type: "RECOVERY" } },
  ] });
  const a = aufg(hoch);
  pruefe("Schock 90 in Recovery: bleibt in Recovery, auch bei knappem Konto",
    a[0].type === "RECOVERY" && a[1].type === "RECOVERY", kurz(hoch));
  pruefe("Schock 60 in Recovery: wird umgesetzt (hier aufs Verbrechen, Konto knapp)",
    a[2].type === "CRIME", kurz(hoch));
  const s = stand(hoch);
  pruefe("Telemetrie: recovery mit Schockwert",
    !!s && s.sleeves[0].v1 === "recovery" && s.sleeves[0].schock === 90,
    s ? JSON.stringify(s.sleeves[0]) : "kein Stand");
  const reich = await fahre({ koerper: [{ shock: 60, aufgabe: { type: "RECOVERY" } }] });
  pruefe("Schock 60 mit Geld: Faktionsarbeit",
    aufg(reich)[0].type === "FACTION", kurz(reich));
  // Und nie selbst Recovery SETZEN - wer nicht darin ist, wird nicht zurueck-
  // gesetzt (es gibt auch keinen setToShockRecovery-Aufruf, 4 GB gespart).
  const schockNichtRecovery = await fahre({ koerper: [{ shock: 90 }] });
  pruefe("Schock 90 ohne laufende Recovery: Faktionsarbeit (kein Zurueckholen)",
    aufg(schockNichtRecovery)[0].type === "FACTION", kurz(schockNichtRecovery));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Rueckfall: nie Leerlauf --");
{
  const ohne = await fahre({ mitRep: false });
  pruefe("ohne bn4rep-Dateien: Verbrechen, nicht Leerlauf",
    aufg(ohne).every((x) => x.type === "CRIME"), kurz(ohne));
  const keinMitglied = await fahre({ faktionen: [] });
  pruefe("ohne Mitgliedschaft (Aufruf wirft): Verbrechen, nicht Leerlauf",
    aufg(keinMitglied).every((x) => x.type === "CRIME"), kurz(keinMitglied));
  const s = stand(keinMitglied);
  pruefe("und als Rueckfall gekennzeichnet, aber gesetzt",
    !!s && s.sleeves.every((x) => x.gesetzt === true && x.v1 === "rueckfall"),
    s ? JSON.stringify(s.sleeves.map((x) => [x.gesetzt, x.v1])) : "kein Stand");
  const firma = await fahre({ repModus: "Clarke Incorporated", koerper: [{}] });
  pruefe("steht in rep-modus.txt eine Firma, wird sie uebersprungen",
    aufg(firma)[0].type === "FACTION" && aufg(firma)[0].factionName === "Slum Snakes", kurz(firma));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- laufende Faktionsarbeit wird nicht umgeworfen, Aussenseiter umgesetzt --");
{
  const m = await fahre({ koerper: [
    { aufgabe: { type: "FACTION", factionName: "CyberSec", factionWorkType: "hacking" } },
    { aufgabe: { type: "FACTION", factionName: "Netburners", factionWorkType: "hacking" } },
    { aufgabe: { type: "FACTION", factionName: "BitRunners", factionWorkType: "hacking" } },
  ] });
  const a = aufg(m);
  pruefe("CyberSec und BitRunners bleiben (unter den obersten drei)",
    a[0].factionName === "CyberSec" && a[2].factionName === "BitRunners", kurz(m));
  pruefe("Netburners (nicht oben) wird auf die freie Spitze gesetzt: Slum Snakes",
    a[1].factionName === "Slum Snakes", kurz(m));
  pruefe("keine Faktion doppelt", new Set(a.map((x) => x.factionName)).size === 3, kurz(m));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ausserhalb des Hackingwegs aendert sich nichts --");
{
  const m = await fahre({ verfahren: "V2 10 2", knoten: 10, koerper: [{}, {}] });
  pruefe("V2 mit Geld: Gym wie bisher, keine Faktionsarbeit",
    aufg(m).every((x) => x.type === "CLASS"), kurz(m));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
