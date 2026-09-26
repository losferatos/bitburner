/**
 * Ebene 2: der ECHTE Hauptlauf von `src/bn4rep.js` gegen einen nachgebauten
 * Spielzustand - Skeptiker-Nacharbeit Paket A (nodes/audit-2026-09-26/
 * skeptiker-A.md, Einwand 7: "ungeprueft ist alles, was entscheidet").
 *
 * ===========================================================================
 * WARUM EIN EIGENER NACHBAU STATT tools/mock/ns.js
 * ===========================================================================
 *
 * `tools/mock/ns.js` kennt aus dem Singularity-Namensraum bewusst nur, was
 * die uebrigen Gewerke brauchen (getCurrentWork, stopAction, gymWorkout,
 * travelToCity) und wirft bei allem anderen. bn4rep ruft rund dreissig
 * Singularity-Funktionen - Faktionen, Augmentierungen, Preise mit dem
 * Aufschlag 1,9^q, Spenden, Arbeit, Fokus, Einbau. Diese Teilmenge steht
 * hier, eng am Spiel (Quellstellen je Funktion), und nur hier: ein Mock, der
 * das ganze Spiel nachbaut, waere ein zweites Spiel mit eigenen Fehlern.
 *
 * Was der Nachbau NICHT kann, wirft - und `RUNDENFEHLER` im bn4rep-Log laesst
 * jede Pruefung rot werden. Sonst koennte ein Szenario gruen sein, nur weil
 * die Runde an einer fehlenden Funktion vorzeitig abbricht.
 *
 * ===========================================================================
 * GEGENPROBE GEGEN DEN ALTEN STAND
 * ===========================================================================
 *
 * `BN4REP_SRC=<src-Ordner vor der Nacharbeit> node tools/test-bn4rep-ebene2.js`
 * faehrt dieselben Szenarien gegen den alten Code. Jedes Szenario hier deckt
 * einen Einwand und ist dort ROT, hier GRUEN (Beleg im Fix-Stand des
 * Berichts).
 *
 * Aufruf: node tools/test-bn4rep-ebene2.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = process.env.BN4REP_SRC ? path.resolve(process.env.BN4REP_SRC) : path.join(ROOT, "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); return; }
  rot++;
  fehler.push(name + (hinweis ? " - " + hinweis : ""));
  console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
}

const NFG = "NeuroFlux Governor";
const STOP = "MOCK-SCHLAFBUDGET-ERSCHOEPFT";

/**
 * Der nachgebaute Spielzustand.
 *
 * @param {object} o
 *   host        Rechner, auf dem bn4rep laeuft (werk-0 = Werkbank, wie im Betrieb)
 *   knoten      aktueller BitNode
 *   moneyMult   AugmentationMoneyCost des Knotens (BN5: 2)
 *   geld, einkommen ($/s seit Einbau, getTotalScriptIncome()[1])
 *   faktionen   {name: {favor, rep, augs: [...]}}
 *   augs        {name: {repReq, basis}}
 *   installiert, warteschlange  Namenslisten
 *   arbeit, fokus
 *   skills, mults
 *   dateien     {host: {datei: inhalt}}
 *   schlafBudget  nach so vielen ns.sleep endet der Lauf mit STOP
 */
function baueWelt(o) {
  const w = {
    host: o.host || "home",
    uhr: 1_790_442_188_000,
    start: 1_790_442_188_000,
    knoten: o.knoten ?? 5,
    moneyMult: o.moneyMult ?? 2,
    geld: o.geld,
    einkommen: o.einkommen ?? 0,
    faktionen: o.faktionen,
    augs: o.augs,
    installiert: [...(o.installiert || [])],
    warteschlange: [...(o.warteschlange || [])],
    arbeit: o.arbeit || null,
    fokus: o.fokus ?? true,
    skills: { hacking: 3878, strength: 1000, defense: 1000, dexterity: 1000, agility: 1000,
      charisma: 100, intelligence: 0, ...(o.skills || {}) },
    mults: { hacking: 9.98, faction_rep: 3.083, ...(o.mults || {}) },
    playtime: 100 * 3600000,
    dateien: { home: {}, ...(o.dateien || {}) },
    imBladeburner: o.imBladeburner ?? true,
    bnMults: { FactionWorkRepGain: 1, DaedalusAugsRequirement: 30, WorldDaemonDifficulty: 1.5,
      ...(o.bnMults || {}) },
    schlafBudget: o.schlafBudget ?? 40,
    // Protokoll fuer die Zusicherungen
    schlaf: [],
    kaeufe: [],
    spenden: [],
    setFocus: [],
    installAufrufe: 0,
  };
  if (!w.dateien[w.host]) w.dateien[w.host] = {};
  return w;
}

/** Preis wie `getAugCost` (AugmentationHelpers.ts:127-160): Basis x Knoten x 1,9^q, NFG x 1,14^Stufe. */
function preis(w, aug) {
  const a = w.augs[aug];
  if (!a) throw new Error("Nachbau: unbekannte Augmentierung " + aug);
  return a.basis * w.moneyMult * Math.pow(1.9, w.warteschlange.length);
}

function baueNs(w) {
  const dateiHost = (h) => {
    if (!w.dateien[h]) w.dateien[h] = {};
    return w.dateien[h];
  };
  const unbekannt = (n) => () => { throw new Error("Nachbau kennt ns." + n + " nicht"); };
  const ns = {
    disableLog: () => {},
    print: () => {},
    tprint: () => {},
    getHostname: () => w.host,
    write: (f, data, mode = "a") => {
      const d = dateiHost(w.host);
      d[f] = mode === "w" ? String(data) : (d[f] || "") + String(data);
    },
    read: (f) => dateiHost(w.host)[f] ?? "",
    fileExists: (f, h = w.host) => f in dateiHost(h),
    rm: (f, h = w.host) => { const d = dateiHost(h); const da = f in d; delete d[f]; return da; },
    // scp(dateien, ziel, quelle): wie NetscriptFunctions.ts scp - kopiert,
    // was auf der Quelle liegt; false, wenn eine Datei fehlt.
    scp: (files, ziel, quelle = w.host) => {
      let alle = true;
      for (const f of [].concat(files)) {
        const q = dateiHost(quelle);
        if (!(f in q)) { alle = false; continue; }
        dateiHost(ziel)[f] = q[f];
      }
      return alle;
    },
    sleep: async (ms) => {
      w.schlaf.push(ms);
      w.uhr += ms;
      if (w.schlaf.length > w.schlafBudget) throw new Error(STOP);
    },
    getResetInfo: () => ({ currentNode: w.knoten, lastNodeReset: 1, lastAugReset: 2,
      ownedSF: new Map([[4, 3], [5, 1]]) }),
    getPlayer: () => ({
      factions: Object.keys(w.faktionen), skills: { ...w.skills }, mults: { ...w.mults },
      jobs: {}, totalPlaytime: w.playtime, money: w.geld, city: "Sector-12",
    }),
    getServerMoneyAvailable: () => w.geld,
    getFavorToDonate: () => 150,
    getBitNodeMultipliers: () => ({ ...w.bnMults }),
    // NetscriptFunctions.ts:1240-1251: [laufende Skripte, seit dem Einbau].
    getTotalScriptIncome: () => [0, w.einkommen],
    serverExists: () => false,
    getServer: () => ({ backdoorInstalled: false, requiredHackingSkill: 0 }),
    ps: () => [],
    singularity: {
      getOwnedAugmentations: (gekauft) => (gekauft
        ? [...w.installiert, ...w.warteschlange] : [...w.installiert]),
      getFactionRep: (f) => w.faktionen[f].rep,
      getFactionFavor: (f) => w.faktionen[f].favor,
      getAugmentationsFromFaction: (f) => [...w.faktionen[f].augs],
      getAugmentationRepReq: (a) => w.augs[a].repReq,
      getAugmentationPrice: (a) => preis(w, a),
      // FactionHelpers.tsx purchaseAugmentation: Mitglied, im Katalog, Rep,
      // Geld, nicht schon besessen (NFG ausgenommen).
      purchaseAugmentation: (f, a) => {
        const fk = w.faktionen[f];
        if (!fk || !fk.augs.includes(a)) return false;
        if (a !== NFG && (w.installiert.includes(a) || w.warteschlange.includes(a))) return false;
        if (fk.rep < w.augs[a].repReq) return false;
        const p = preis(w, a);
        if (w.geld < p) return false;
        w.geld -= p;
        w.warteschlange.push(a);
        w.kaeufe.push({ f, a, p, uhr: w.uhr });
        return true;
      },
      // donation.ts:8-35: Favor >= 150 noetig, Rep = Betrag/1e6 x faction_rep x FWRG.
      donateToFaction: (f, betrag) => {
        const fk = w.faktionen[f];
        if (!fk || fk.favor < 150 || !(betrag > 0) || w.geld < betrag) return false;
        w.geld -= betrag;
        fk.rep += betrag / 1e6 * w.mults.faction_rep * w.bnMults.FactionWorkRepGain;
        w.spenden.push({ f, betrag, uhr: w.uhr });
        return true;
      },
      getCurrentWork: () => (w.arbeit ? { ...w.arbeit } : null),
      isFocused: () => w.fokus,
      // Singularity.ts:537-553: wirft ohne Arbeit, setzt sonst den Fokus.
      setFocus: (f) => {
        if (!w.arbeit) throw new Error("Not currently working");
        w.setFocus.push({ uhr: w.uhr, f });
        const vorher = w.fokus;
        w.fokus = !!f;
        return vorher !== w.fokus;
      },
      workForFaction: (f, art, fokus) => {
        w.arbeit = { type: "FACTION", factionName: f, factionWorkType: art };
        w.fokus = !!fokus;
        return true;
      },
      getFactionWorkTypes: () => ["hacking", "field", "security"],
      installAugmentations: () => { w.installAufrufe++; return true; },
      quitJob: () => {},
      getCompanyRep: () => 0,
      getCompanyFavor: () => 0,
      applyToCompany: () => "",
      workForCompany: () => false,
      getAugmentationStats: () => ({}),
    },
    bladeburner: { inBladeburner: () => w.imBladeburner },
  };
  return new Proxy(ns, { get: (z, n) => (n in z ? z[n] : unbekannt(String(n))) });
}

/**
 * Faehrt bn4rep.main, bis das Schlafbudget erschoepft ist oder main endet.
 * @returns {{ende: "budget"|"return"|"fehler", fehlerText?: string, log: string}}
 */
async function fahre(w) {
  const modul = await ladeSpielskript(path.join(SRC, "bn4rep.js"));
  const ns = baueNs(w);
  const echteNow = Date.now;
  Date.now = () => w.uhr;
  let ende = "return";
  let fehlerText = "";
  try {
    await modul.main(ns);
  } catch (e) {
    const t = String(e && e.message ? e.message : e);
    if (t.includes(STOP)) ende = "budget";
    else { ende = "fehler"; fehlerText = t; }
  } finally {
    Date.now = echteNow;
  }
  const log = w.dateien[w.host]["data/bn4rep-log.txt"] || "";
  return { ende, fehlerText, log };
}

/** Echte Rundenfehler (nicht der Budget-Abbruch) - der Nachbau muss vollstaendig sein. */
const rundenfehler = (log) => log.split("\n")
  .filter((z) => z.includes("RUNDENFEHLER") && !z.includes(STOP));

// Der Stand BN5.2 19:03 (Spielstand 19-03 pre-install, bn4rep-Log 19:03:08):
// Daedalus Favor 150,6 mit 836k Rep (2,5 Mio fuer Red Pill minus 1.663.757
// fehlend laut Log), Aevum Favor 77,3 mit 21.024 Rep, drei Stuecke wartend,
// 36 installiert, Konto 13,808 Mrd, Skripteinkommen seit Einbau 1,04 Mrd/s.
const AUGS_1903 = {
  "The Red Pill": { repReq: 2.5e6, basis: 0 },
  "Embedded Netburner Module Core V3 Upgrade": { repReq: 1.75e6, basis: 7.5e9 },
  "Embedded Netburner Module Direct Memory Access Upgrade": { repReq: 1e6, basis: 7e9 },
  "Embedded Netburner Module Analyze Engine": { repReq: 625e3, basis: 6e9 },
  "Synthetic Heart": { repReq: 750e3, basis: 2.875e9 },
  "NEMEAN Subdermal Weave": { repReq: 875e3, basis: 3.25e9 },
  "PCMatrix": { repReq: 1e5, basis: 2e9 },
  [NFG]: { repReq: 1000, basis: 1e6 },
};
const welt1903 = (o = {}) => baueWelt({
  host: "werk-0",
  knoten: 5,
  moneyMult: 2,
  geld: 13808e6,
  einkommen: 1040136493.75,
  faktionen: {
    Daedalus: { favor: 150.6, rep: 836243, augs: ["The Red Pill",
      "Embedded Netburner Module Core V3 Upgrade",
      "Embedded Netburner Module Direct Memory Access Upgrade",
      "Embedded Netburner Module Analyze Engine", "Synthetic Heart", "NEMEAN Subdermal Weave"] },
    Aevum: { favor: 77.3, rep: 21024, augs: ["PCMatrix"] },
  },
  augs: AUGS_1903,
  installiert: Array.from({ length: 36 }, (_, i) => "Alt-" + i),
  warteschlange: ["Embedded Netburner Module Analyze Engine", "Synthetic Heart",
    "NEMEAN Subdermal Weave"],
  arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
  fokus: true,
  dateien: { home: { "data/verfahren.txt": "V1 5" } },
  ...o,
});

console.log("");
console.log("=== bn4rep.js Hauptlauf gegen nachgebauten Spielzustand (" + SRC + ") ===");

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 1: erste Runde nach dem Start, Stand BN5.2 19:03 --");
{
  // Der Einbau um 19:03:08 war ein Fehlausloeser (PCMatrix 27,44 Mrd bei
  // 13,81 Mrd Konto, 1 Mrd/s Zufluss). Die alte 4x-Regel haette hier
  // geschwiegen; die erste Fassung der Horizontregel startete den Schaetzer
  // bei 0 und baute in der ERSTEN Runde nach jedem Neustart ein.
  const w = welt1903({ schlafBudget: 6 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (kein echter Rundenfehler)", rundenfehler(r.log).length === 0
    && r.ende !== "fehler", rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  // Beleg, dass die Runde die Einbauentscheidung ueberhaupt erreicht hat:
  // die Telemetrie data/einbau.json steht direkt davor.
  let tele = null;
  try { tele = JSON.parse(w.dateien.home["data/einbau.json"] || "null"); } catch { tele = null; }
  pruefe("die Einbauentscheidung wurde erreicht (einbau.json, wartend 3)",
    !!tele && tele.wartend === 3, JSON.stringify(tele).slice(0, 120));
  const einbau = r.log.split("\n").find((z) => z.includes("EINBAU:"));
  pruefe("kein EINBAU in den ersten Runden nach dem Start", !einbau, einbau || "");
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 5: Handschlag scheitert -> weiterlaufen, Sperre auf home --");
{
  // Ein Einbau, der in beiden Fassungen feuert: DMA verdient (Daedalus
  // 1,2 Mio Rep) und mit 96 Mrd bei 1 Mrd Konto und ohne Einkommen wirklich
  // unbezahlbar. Die Bruecke antwortet nicht, keine junge Sicherung -
  // handschlag() verweigert.
  const w = welt1903({ geld: 1e9, einkommen: 0, schlafBudget: 80 });
  w.faktionen.Daedalus.rep = 1.2e6;
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  const handschlaege = r.log.split("\n").filter((z) => z.includes("Handschlag gestellt")).length;
  pruefe("der Handschlag wurde gestellt (Einbau hat ausgeloest)", handschlaege >= 1,
    "Handschlaege: " + handschlaege);
  pruefe("main endet NICHT nach dem verweigerten Einbau", r.ende === "budget",
    "Ende: " + r.ende);
  const sperre = w.dateien.home["data/install-sperre.txt"];
  pruefe("die Sperre liegt auf home (nicht nur lokal auf werk-0)", !!sperre && sperre.includes("bis"),
    String(sperre).slice(0, 80));
  pruefe("die Sperre wirkt: kein zweiter Handschlag im Budget", handschlaege === 1,
    "Handschlaege: " + handschlaege);
  pruefe("kein installAugmentations", w.installAufrufe === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 5: Ausgang offen -> kein NFG-Kauf, weiterlaufen --");
{
  // Dieselbe Lage, aber data/ausgang.json meldet den Ausgang offen. Der
  // Interlock muss VOR der NFG-Schleife greifen: sonst kauft jeder Anlauf
  // Stufen mit dem Geld, das exit.js braucht.
  const w = welt1903({ geld: 1e9, einkommen: 0, schlafBudget: 12 });
  w.faktionen.Daedalus.rep = 1.2e6;
  w.faktionen.Daedalus.augs.push(NFG);
  w.dateien.home["data/ausgang.json"] = JSON.stringify({ zeit: w.uhr, offen: true });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("der Einbau war faellig und wurde ausgesetzt", r.log.includes("ausgesetzt"));
  const nfg = w.kaeufe.filter((k) => k.a === NFG).length;
  pruefe("keine NFG-Stufe gekauft, solange der Ausgang offen ist", nfg === 0, "NFG-Kaeufe: " + nfg);
  pruefe("main endet NICHT", r.ende === "budget", "Ende: " + r.ende);
  // Jede Runde fragt das Tor erneut - die Meldung darf das Log trotzdem
  // nicht alle 15 s fuellen (12 Schlafaufrufe ~ 3 min < 5 min Drossel).
  const meldungen = r.log.split("\n").filter((z) => z.includes("ausgesetzt")).length;
  pruefe("die Aussetz-Meldung ist gedrosselt (1 in ~3 min)", meldungen === 1, "Meldungen: " + meldungen);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 3: Fuellstueck im Kampfknoten --");
{
  // BitNode 6 ohne V1-Marke: bladeburnerTraegtHier() = true. Tian Di Hui
  // Favor 100, 320k Rep -> kumuliert 156k + 320k >= 462,5k: Spendenrecht
  // faellig, Synfibril Muscle noch offen. Warteschlange leer. Die Einbau-Uhr
  // steht lange zurueck, damit keine Kampf-Einbausperre greift - nur die
  // neue Vorbedingung soll den Kauf verhindern.
  const w = baueWelt({
    host: "werk-0", knoten: 6, moneyMult: 1, geld: 10e9, einkommen: 1e6,
    faktionen: { "Tian Di Hui": { favor: 100, rep: 320e3, augs: ["Synfibril Muscle", NFG] } },
    augs: { "Synfibril Muscle": { repReq: 437.5e3, basis: 1.125e9 }, [NFG]: { repReq: 1000, basis: 1e6 } },
    installiert: Array.from({ length: 20 }, (_, i) => "Alt-" + i),
    warteschlange: [],
    dateien: { home: { "data/einbau-uhr.json": JSON.stringify({ augReset: 2, playtime: 0, fertig: 1000 }) } },
    schlafBudget: 6,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  const nfg = w.kaeufe.filter((k) => k.a === NFG).length;
  pruefe("im Kampfknoten keine Fuellstufe (kein Einbau kaeme nach)", nfg === 0,
    "NFG-Kaeufe: " + nfg + (r.log.includes("FUELLSTUECK:") ? " (Log: FUELLSTUECK)" : ""));
}
{
  // Gegenprobe im Hackingknoten: dieselbe Lage in BN5 mit V1-Marke -> die
  // Stufe wird gekauft (A4 bleibt wirksam, wo es hingehoert).
  const w = baueWelt({
    host: "werk-0", knoten: 5, moneyMult: 2, geld: 10e9, einkommen: 1e6,
    faktionen: { BitRunners: { favor: 100, rep: 320e3, augs: ["BitRunners Neurolink", NFG] } },
    augs: { "BitRunners Neurolink": { repReq: 875e3, basis: 4.375e9 }, [NFG]: { repReq: 1000, basis: 1e6 } },
    installiert: Array.from({ length: 20 }, (_, i) => "Alt-" + i),
    warteschlange: [],
    dateien: { home: { "data/verfahren.txt": "V1 5" } },
    schlafBudget: 6,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  const erste = w.kaeufe[0];
  pruefe("im Hackingknoten wird die Fuellstufe gekauft (erster Kauf, vor dem Einbau)",
    !!erste && erste.a === NFG && r.log.includes("FUELLSTUECK:"),
    "erster Kauf: " + JSON.stringify(erste));
  // Danach oeffnet die Stufe den Spendenrecht-Einbau - und der Grund im Log
  // muss das Spendenrecht nennen (Einwand 11), nicht "naechste Huerde".
  const einbau = r.log.split("\n").find((z) => z.includes("EINBAU:")) || "";
  pruefe("der folgende Einbau nennt das Spendenrecht als Grund",
    einbau.includes("Spendenrecht bei BitRunners"), einbau.slice(0, 160));
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwaende 4 und 8: Fokus --");
const weltFokus = (o = {}) => baueWelt({
  host: "werk-0", knoten: 5, moneyMult: 2, geld: 5e9, einkommen: 1e7,
  faktionen: { CyberSec: { favor: 20, rep: 1000, augs: ["Synaptic Enhancement Implant"] } },
  augs: {
    "Synaptic Enhancement Implant": { repReq: 2000, basis: 7.5e6 },
    "Neuroreceptor Management Implant": { repReq: 75e3, basis: 5.5e8 },
  },
  installiert: Array.from({ length: 20 }, (_, i) => "Alt-" + i),
  warteschlange: [],
  arbeit: { type: "FACTION", factionName: "CyberSec", factionWorkType: "hacking" },
  fokus: false,
  dateien: { home: { "data/verfahren.txt": "V1 5" } },
  schlafBudget: 8,
  ...o,
});
{
  // NMI nur GEKAUFT: das Spiel ignoriert die Warteschlange
  // (hasAugmentation(NMI, true), Person.ts:232-239) - die Strafe x0,8 gilt,
  // der Fokus muss zurueck.
  const w = weltFokus({ warteschlange: ["Neuroreceptor Management Implant"] });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("NMI nur gekauft: der Fokus wird trotzdem zurueckgeholt", w.setFocus.length >= 1,
    "setFocus-Aufrufe: " + w.setFocus.length);
}
{
  // NMI EINGEBAUT: keine Strafe, kein setFocus.
  const w = weltFokus({ installiert: ["Neuroreceptor Management Implant",
    ...Array.from({ length: 19 }, (_, i) => "Alt-" + i)] });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("NMI eingebaut: kein setFocus", w.setFocus.length === 0, "setFocus-Aufrufe: " + w.setFocus.length);
}
{
  // Karenz: darkweb.js hat gerade "Do something else" geklickt und
  // navigiert per Tastenkuerzel - ein setFocus in den ersten Sekunden
  // bricht es ab. Erst nach 30 s ohne Fokus zurueckholen, aber dann sicher.
  const w = weltFokus();
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  const erster = w.setFocus[0];
  pruefe("kein setFocus in den ersten 30 s ohne Fokus",
    !!erster && erster.uhr - w.start >= 30000,
    erster ? "erster Aufruf nach " + ((erster.uhr - w.start) / 1000) + " s" : "gar kein Aufruf");
  pruefe("danach wird er zurueckgeholt (Rate nicht dauerhaft bei 80 %)", w.fokus === true,
    "fokus=" + w.fokus);
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
