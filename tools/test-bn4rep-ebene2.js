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
import { fileURLToPath, pathToFileURL } from "node:url";
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
    // P2c: lastNodeReset (Wanduhr). Ohne Angabe 1 - der Knoten ist dann uralt.
    nodeReset: o.nodeReset ?? 1,
    // Zusammenfuehrung P0+P1: eine Map, egal ob die Szenarien Paare (P0) oder eine
    // Map-Unterklasse (P1, SfWirft) liefern - die Unterklasse muss unkopiert bleiben.
    ownedSF: o.ownedSF instanceof Map ? o.ownedSF : new Map(o.ownedSF ?? [[4, 3], [5, 1]]),
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
    // Wird bei jedem ns.sleep gerufen - fuer das, was im Spiel NEBEN bn4rep
    // geschieht (Bruecke antwortet, graft.js startet, ausgang.js schreibt).
    beiSchlaf: o.beiSchlaf || null,
    // Protokoll fuer die Zusicherungen
    schlaf: [],
    kaeufe: [],
    // H2/Skeptiker-Fund 5: Namen, deren purchaseAugmentation() trotz
    // erfuellter Vorbedingungen mit false antwortet (Testhaken, s.o.).
    kaufSperre: o.kaufSperre ? new Set(o.kaufSperre) : null,
    markeWirft: !!o.markeWirft,
    spenden: [],
    setFocus: [],
    installAufrufe: 0,
    // P1 / AUG-4 (03.10.2026): die Gang. `da` = ns.gang.inGang(), `bonusMs` =
    // ns.gang.getBonusTime() (Zahl oder Funktion der Welt), `wirftInGang` /
    // `wirftBonus` lassen den jeweiligen Aufruf werfen. Ohne Angabe: keine Gang
    // - dann kennt bn4rep sie nur, wenn der Knoten ein Kampfknoten MIT
    // Verfahrensmarke V2 ist (nurKampfStuecke).
    gang: { da: false, bonusMs: 0, wirftInGang: false, wirftBonus: false, ...(o.gang || {}) },
    gangAufrufe: { inGang: 0, getBonusTime: 0 },
    // Preisfaktor je wartendem Stueck: 1,9; mit SF11 kleiner (AugmentationHelpers.ts:28-30).
    priceStep: o.priceStep ?? 1.9,
  };
  if (!w.dateien[w.host]) w.dateien[w.host] = {};
  return w;
}

/** Preis wie `getAugCost` (AugmentationHelpers.ts:127-160): Basis x Knoten x 1,9^q, NFG x 1,14^Stufe. */
function preis(w, aug) {
  const a = w.augs[aug];
  if (!a) throw new Error("Nachbau: unbekannte Augmentierung " + aug);
  return a.basis * w.moneyMult * Math.pow(w.priceStep, w.warteschlange.length);
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
    fileExists: (f, h = w.host) => {
      // Testhaken (P0/GANG-2): die Lesung der V1-Marke wirft - der Zaehler
      // v1LeseFehler muss steigen und The Red Pill gesperrt bleiben.
      if (w.markeWirft && f === "data/verfahren.txt") throw new Error("Lesefehler (Testhaken)");
      return f in dateiHost(h);
    },
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
      if (w.beiSchlaf) w.beiSchlaf(w);
      if (w.schlaf.length > w.schlafBudget) throw new Error(STOP);
    },
    // ownedSF je Welt einstellbar (P0/G02): die alte Regel `mitHashes` las hier
    // SF9 mit, die neue fragt nur noch den Knoten - ein Test, der SF9 nie
    // setzt, koennte den Unterschied nicht zeigen.
    getResetInfo: () => ({ currentNode: w.knoten, lastNodeReset: w.nodeReset, lastAugReset: 2,
      ownedSF: w.ownedSF }),
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
      // H2/Skeptiker-Fund 5 (27.09.2026): AugmentationHelpers.tsx prueft
      // Vorgaenger-Stuecke vor dem Kauf. `w.augs[a].prereq` ist die
      // Namensliste, Vorgabe leer (kein Test kannte das bisher, weil
      // bn4rep.js die Funktion vor diesem Fix nie rief).
      getAugmentationPrereq: (a) => [...(w.augs[a].prereq || [])],
      // FactionHelpers.tsx purchaseAugmentation: Mitglied, im Katalog, Rep,
      // Geld, nicht schon besessen (NFG ausgenommen).
      purchaseAugmentation: (f, a) => {
        // Testhaken fuer den Kauf-Ruecklauf (H2, Skeptiker-Fund 5): simuliert
        // einen Kaufversuch, der trotz erfuellter Rep/Preis/Prereq-Pruefung
        // scheitert (im echten Spiel z. B., weil der Preis sich zwischen
        // Auswahl und Kauf durch einen parallelen Kauf schon erhoeht hat).
        if (w.kaufSperre && w.kaufSperre.has(a)) return false;
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
      // P0 (GANG-2): der Kampfknoten-Einbau verlangt ein wartendes Stueck, das
      // den Wiederaufbau verkuerzt (WIEDERAUFBAU_MULTS) - ohne Werte hier
      // bliebe jeder V2-Einbau im Test an `wiederaufbauHilfe` haengen.
      // `augs[a].stats` (optional) = die Faktoren der Aug; ohne Angabe {} wie bisher.
      getAugmentationStats: (a) => ({ ...((w.augs[a] && w.augs[a].stats) || {}) }),
    },
    bladeburner: { inBladeburner: () => w.imBladeburner },
    // Singularity-fremder Namensraum, 0 GB je Aufruf (RamCostGenerator.ts:274-301):
    // NetscriptFunctions/Gang.ts:53-55 inGang, :340-343 getBonusTime (wirft ohne Gang).
    gang: {
      inGang: () => {
        w.gangAufrufe.inGang++;
        if (w.gang.wirftInGang) throw new Error("Nachbau: ns.gang.inGang geworfen");
        return !!w.gang.da;
      },
      getBonusTime: () => {
        w.gangAufrufe.getBonusTime++;
        if (w.gang.wirftBonus) throw new Error("Nachbau: ns.gang.getBonusTime geworfen");
        if (!w.gang.da) throw new Error("Must have joined gang");
        return typeof w.gang.bonusMs === "function" ? w.gang.bonusMs(w) : w.gang.bonusMs;
      },
    },
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

// ===========================================================================
// GEGENPRUEFUNG (nodes/audit-2026-09-26/skeptiker-A.md, Abschnitt
// "Gegenpruefung"): Luecken der Nacharbeit, je ROT auf fe3e911 (G1) bzw. 685ad40 (G2).
// ===========================================================================

// ---------------------------------------------------------------------------
console.log("\n-- Gegenpruefung G1: Handschlag scheitert, NFG waere kaufbar --");
{
  // Wie "Handschlag scheitert" oben, aber Daedalus fuehrt NFG. Der Handschlag
  // ist das dritte Tor, das den Einbau verweigern kann - stand er hinter der
  // NFG-Schleife, lag nach der Verweigerung eine Handvoll Stufen in der
  // Warteschlange, und jedes weitere Stueck des Zyklus kostete je Stufe x1,9
  // mehr (AugmentationHelpers.ts getGenericAugmentationPriceMultiplier),
  // ohne dass ein Einbau folgte (Sperre 1 h, danach dasselbe).
  const w = welt1903({ geld: 1e9, einkommen: 0, schlafBudget: 80 });
  w.faktionen.Daedalus.rep = 1.2e6;
  w.faktionen.Daedalus.augs.push(NFG);
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  const handschlaege = r.log.split("\n").filter((z) => z.includes("Handschlag gestellt")).length;
  pruefe("der Handschlag wurde gestellt und verweigert", handschlaege === 1
    && r.log.includes("Einbau ausgesetzt"), "Handschlaege: " + handschlaege);
  const nfg = w.kaeufe.filter((k) => k.a === NFG).length;
  pruefe("keine NFG-Stufe gekauft, wenn der Handschlag den Einbau verweigert", nfg === 0,
    "NFG-Kaeufe: " + nfg);
  pruefe("kein installAugmentations", w.installAufrufe === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- Gegenpruefung G1: Graft beginnt waehrend des Handschlags --");
{
  // Der Handschlag wartet bis zu 90 s auf die Bruecke. graft.js hat die
  // hoehere Figurprioritaet (lib/figur.js: graft 10, faktion 30) und kann in
  // dieser Zeit ein Graft starten. installAugmentations toetet es ohne
  // Erstattung (Work/GraftingWork.tsx:75-83). Die letzte Graftpruefung stand
  // VOR dem Handschlag - hier antwortet die Bruecke nach 10 s, und im selben
  // Augenblick beginnt das Graft.
  let beantwortet = false;
  const w = welt1903({
    geld: 1e9, einkommen: 0, schlafBudget: 60,
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || beantwortet) return;
      if (welt.uhr - JSON.parse(anfrage).ts < 10000) return;
      beantwortet = true;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
      welt.arbeit = { type: "GRAFTING", augmentation: "QLink" };
    },
  });
  w.faktionen.Daedalus.rep = 1.2e6;
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("die Bruecke hat geantwortet (Handschlag erlaubt)", beantwortet
    && r.log.includes("Sicherung gruen"), "beantwortet=" + beantwortet);
  pruefe("kein installAugmentations, solange das Graft laeuft", w.installAufrufe === 0,
    "installAugmentations: " + w.installAufrufe);
}

// ---------------------------------------------------------------------------
console.log("\n-- Gegenpruefung G1: der Normalfall baut weiter ein, NFG nach dem Handschlag --");
{
  // Waechter fuer die neue Reihenfolge: Bruecke antwortet, kein Graft, kein
  // Ausgang - der Einbau muss kommen, mit NFG-Stufen, und die Stufen muessen
  // NACH der Sicherung gekauft sein (sonst waere G1 nur verschoben).
  let anfrageTs = null;
  const w = welt1903({
    geld: 1e9, einkommen: 0, schlafBudget: 60,
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || anfrageTs !== null) return;
      anfrageTs = JSON.parse(anfrage).ts;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
    },
  });
  w.faktionen.Daedalus.rep = 1.2e6;
  w.faktionen.Daedalus.augs.push(NFG);
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("genau ein installAugmentations, danach endet main", w.installAufrufe === 1
    && r.ende === "return", "install " + w.installAufrufe + ", Ende " + r.ende);
  const nfg = w.kaeufe.filter((k) => k.a === NFG);
  pruefe("NFG-Stufen vor dem Einbau gekauft", nfg.length > 0, "NFG-Kaeufe: " + nfg.length);
  pruefe("alle NFG-Stufen NACH der Sicherungsanfrage", anfrageTs !== null
    && nfg.every((k) => k.uhr >= anfrageTs),
    "Anfrage " + anfrageTs + ", erste Stufe " + (nfg[0] && nfg[0].uhr));
}

// ---------------------------------------------------------------------------
console.log("\n-- Gegenpruefung G2: Ausgang 37 min offen - der Waechter bleibt ruhig --");
{
  // Seit `return` -> `continue` endet jede Runde bei offenem Ausgang am Tor
  // und schreibt data/bn4rep.json nicht mehr. Der Waechter (guard.js,
  // Modus enforce: Sprosse 1 und 2 scharf) misst diese Datei gegen
  // freshnessMs 30 min (registry.json) und haette bn4rep nach 30 min neu
  // gestartet und danach seinen Wirt eine Stunde gesperrt - fuer ein
  // Skript, das absichtlich wartet. Vorher war der Prozess an dieser Stelle
  // zu Ende, und die Leiter fand ihn meist gar nicht ("laeuft nirgends").
  // ausgang.js erneuert ausgang.json alle paar Sekunden (sonst gilt die Lage
  // nach 15 min als veraltet und der Riegel faellt, lib/endspurt.js).
  const { signale } = await import(pathToFileURL(path.join(SRC, "lib", "leiter.js")).href);
  const w = welt1903({
    geld: 1e9, einkommen: 0, schlafBudget: 150,
    beiSchlaf: (welt) => {
      welt.dateien.home["data/ausgang.json"] = JSON.stringify({ zeit: welt.uhr, offen: true });
    },
  });
  w.faktionen.Daedalus.rep = 1.2e6;
  w.faktionen.Daedalus.augs.push(NFG);
  w.dateien.home["data/ausgang.json"] = JSON.stringify({ zeit: w.uhr, offen: true });
  // Die Telemetrie aus der letzten Runde VOR dem Oeffnen des Ausgangs.
  w.dateien.home["data/bn4rep.json"] = JSON.stringify({ zeit: w.uhr - 15000, wartend: 3 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("der Lauf stand ueber 30 min am Tor", w.uhr - w.start > 1800000
    && w.installAufrufe === 0 && w.kaeufe.length === 0,
    ((w.uhr - w.start) / 60000).toFixed(1) + " min, Kaeufe " + w.kaeufe.length);
  let tele = null;
  try { tele = JSON.parse(w.dateien.home["data/bn4rep.json"] || "null"); } catch { tele = null; }
  pruefe("data/bn4rep.json auf home ist frisch", !!tele && w.uhr - tele.zeit <= 60000,
    tele ? "Alter " + ((w.uhr - tele.zeit) / 60000).toFixed(1) + " min" : "fehlt");
  pruefe("und sagt, dass bn4rep wartet (state wait, wartend 3)", !!tele && tele.state === "wait"
    && tele.wartend === 3, JSON.stringify(tele).slice(0, 160));
  // Die echte Signalrechnung des Waechters (lib/leiter.js) auf genau diese Datei.
  const sig = signale({
    eintraege: [{ name: "bn4rep.js", freshnessMs: 1800000, telemetrie: tele }],
    wall: w.uhr, sichtbar: true, kern: null, puls: null, kpi: null, bridge: null,
  }).filter((s) => s.sig === "S1");
  pruefe("lib/leiter.js signale(): kein S1 gegen bn4rep.js", sig.length === 0,
    sig.map((s) => s.grund).join(" | "));
}

// ---------------------------------------------------------------------------
console.log("\n-- H2: Daedalus-Fuellstueck vor dem Einbau (BN12, Schwelle 31, bn12-bericht.md MINOR #3) --");
{
  // 29 installiert + The Red Pill gekauft, nicht eingebaut -> redPillWartet
  // erzwingt den Einbau UNABHAENGIG von jeder Kauf-/Firmenlogik (A6), noch
  // BEVOR Abschnitt 2 ("Kaufen, was bezahlt und verdient ist") in dieser
  // Runde ueberhaupt drankaeme - genau das macht dieses Szenario zur echten
  // Probe fuer den NEUEN Ausloeser-Riegel statt fuer die laengst bestehende
  // Kaufschleife. Ohne den H2-Fix wuerde dieser Einbau bei 30 von 31
  // installierten Stuecken haengen bleiben (distinkt: 29 installiert + Red
  // Pill wartend = 30); Zusatzstueck steht bei derselben Faktion bereit
  // (Rep erfuellt, billig) und muss VOR dem Einbau gekauft werden.
  const AUGS_BN12 = {
    "The Red Pill": { repReq: 2.5e6, basis: 0 },
    Zusatzstueck: { repReq: 5e4, basis: 1e6 },
    [NFG]: { repReq: 1000, basis: 1e6 },
  };
  const w = baueWelt({
    host: "werk-0", knoten: 12, moneyMult: 1,
    geld: 5e9, einkommen: 1e6,
    bnMults: { DaedalusAugsRequirement: 31 },
    faktionen: { Daedalus: { favor: 150.6, rep: 3e6, augs: ["The Red Pill", "Zusatzstueck", NFG] } },
    augs: AUGS_BN12,
    installiert: Array.from({ length: 29 }, (_, i) => "Alt-" + i),
    warteschlange: ["The Red Pill"],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    // "V1 12" (nicht "V1 5" wie welt1903): bladeburnerTraegtHier() prueft
    // Verfahren GEGEN den Knoten dieses Szenarios (12) - stimmt die Zahl
    // nicht, gilt BN12 faelschlich als Kampfknoten (bladeburnerTraegtHier()
    // faellt auf `true` zurueck), wiederaufbauHilfe bleibt dann false und
    // der ganze Einbau bleibt gesperrt (erste Fassung dieses Tests lief
    // deshalb ins Schlafbudget, ohne je die Einbauzeile zu erreichen).
    // Firmenphase abgeschaltet (data/company-order.txt "off"): dieses
    // Szenario prueft den Einbau-Ausloeser, nicht die Firmenwahl.
    dateien: { home: { "data/verfahren.txt": "V1 12", "data/company-order.txt": "off" } },
    schlafBudget: 30,
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
    },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (kein echter Rundenfehler)", rundenfehler(r.log).length === 0
    && r.ende !== "fehler", rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("das Fuellstueck wurde gekauft, bevor eingebaut wurde (nicht die alte Kaufschleife)",
    r.log.includes("Daedalus-Fuellstueck: Zusatzstueck"), r.log.slice(0, 400));
  pruefe("der Einbau selbst lief (installAugmentations, Ende return)",
    w.installAufrufe === 1 && r.ende === "return", "install " + w.installAufrufe + ", Ende " + r.ende);
}
{
  // Gegenprobe: 30 installiert + Red Pill wartend -> distinkt ist bereits 31,
  // trifft die Schwelle genau. Kein Fuellstueck-Kauf noetig, obwohl
  // Zusatzstueck weiterhin bereitstuende.
  const AUGS_BN12 = {
    "The Red Pill": { repReq: 2.5e6, basis: 0 },
    Zusatzstueck: { repReq: 5e4, basis: 1e6 },
    [NFG]: { repReq: 1000, basis: 1e6 },
  };
  const w = baueWelt({
    host: "werk-0", knoten: 12, moneyMult: 1,
    geld: 5e9, einkommen: 1e6,
    bnMults: { DaedalusAugsRequirement: 31 },
    faktionen: { Daedalus: { favor: 150.6, rep: 3e6, augs: ["The Red Pill", "Zusatzstueck", NFG] } },
    augs: AUGS_BN12,
    installiert: Array.from({ length: 30 }, (_, i) => "Alt-" + i),
    warteschlange: ["The Red Pill"],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    dateien: { home: { "data/verfahren.txt": "V1 12", "data/company-order.txt": "off" } },
    schlafBudget: 30,
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
    },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", rundenfehler(r.log).length === 0 && r.ende !== "fehler",
    rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("kein Fuellstueck-Kauf, wenn die Schwelle ohnehin getroffen wird (31 von 31)",
    !r.log.includes("Daedalus-Fuellstueck"), r.log.slice(0, 400));
  pruefe("installAugmentations laeuft trotzdem", w.installAufrufe === 1 && r.ende === "return");
}

// ---------------------------------------------------------------------------
console.log("\n-- H2/Skeptiker-Fund 5: unerfuellte Vorbedingung wird uebersprungen --");
{
  // Wie oben (29 installiert, Red Pill wartend -> Gate greift), aber
  // "Gesperrt" ist BILLIGER als "Teurer" und haette ohne den Prereq-Filter
  // gewonnen (waehleDaedalusFuellstueck sortiert nach Preis) - es fehlt ihm
  // aber "Vorstufe", die weder installiert noch in der Warteschlange steht.
  // Ohne den Fix versucht der Bot "Gesperrt" zu kaufen, purchaseAugmentation
  // lehnt wegen des Vorgaengers ab (im echten Spiel: AugmentationHelpers.tsx),
  // und der Zyklus verpufft ganz - hier im Mock waere das sogar noch
  // schlimmer sichtbar, weil "Gesperrt" gar nicht im Faktionskatalog fehlt,
  // sondern nur am Prereq scheitert (die Rueckrufkette VOR dem Fix kennt
  // diesen Grund gar nicht und probiert nichts anderes).
  const AUGS_BN12 = {
    "The Red Pill": { repReq: 2.5e6, basis: 0 },
    Gesperrt: { repReq: 5e4, basis: 1e6, prereq: ["Vorstufe"] },
    Teurer: { repReq: 5e4, basis: 2e6 },
    [NFG]: { repReq: 1000, basis: 1e6 },
  };
  const w = baueWelt({
    host: "werk-0", knoten: 12, moneyMult: 1,
    geld: 5e9, einkommen: 1e6,
    bnMults: { DaedalusAugsRequirement: 31 },
    faktionen: { Daedalus: { favor: 150.6, rep: 3e6, augs: ["The Red Pill", "Gesperrt", "Teurer", NFG] } },
    augs: AUGS_BN12,
    installiert: Array.from({ length: 29 }, (_, i) => "Alt-" + i),
    warteschlange: ["The Red Pill"],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    dateien: { home: { "data/verfahren.txt": "V1 12", "data/company-order.txt": "off" } },
    schlafBudget: 30,
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
    },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (kein echter Rundenfehler)", rundenfehler(r.log).length === 0
    && r.ende !== "fehler", rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("'Gesperrt' (Vorstufe fehlt) wurde NICHT gekauft",
    !w.kaeufe.some((k) => k.a === "Gesperrt"), JSON.stringify(w.kaeufe));
  pruefe("stattdessen 'Teurer' (kein Prereq) wurde gekauft",
    r.log.includes("Daedalus-Fuellstueck: Teurer"), r.log.slice(0, 400));
  pruefe("der Einbau selbst lief (installAugmentations, Ende return)",
    w.installAufrufe === 1 && r.ende === "return", "install " + w.installAufrufe + ", Ende " + r.ende);
}

// ---------------------------------------------------------------------------
console.log("\n-- H2/Skeptiker-Fund 5: Kauf-Ruecklauf, wenn das billigste Stueck trotzdem scheitert --");
{
  // "Billig" erfuellt Rep/Preis/Prereq, aber purchaseAugmentation() lehnt es
  // trotzdem ab (kaufSperre - im echten Spiel z. B. ein Preisanstieg
  // zwischen Auswahl und Kauf). Ohne Ruecklauf versucht der alte Code kein
  // zweites Stueck mehr in dieser Runde.
  const AUGS_BN12 = {
    "The Red Pill": { repReq: 2.5e6, basis: 0 },
    Billig: { repReq: 5e4, basis: 1e6 },
    Teurer: { repReq: 5e4, basis: 2e6 },
    [NFG]: { repReq: 1000, basis: 1e6 },
  };
  const w = baueWelt({
    host: "werk-0", knoten: 12, moneyMult: 1,
    geld: 5e9, einkommen: 1e6,
    bnMults: { DaedalusAugsRequirement: 31 },
    faktionen: { Daedalus: { favor: 150.6, rep: 3e6, augs: ["The Red Pill", "Billig", "Teurer", NFG] } },
    augs: AUGS_BN12,
    installiert: Array.from({ length: 29 }, (_, i) => "Alt-" + i),
    warteschlange: ["The Red Pill"],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    dateien: { home: { "data/verfahren.txt": "V1 12", "data/company-order.txt": "off" } },
    schlafBudget: 30,
    kaufSperre: ["Billig"],
    beiSchlaf: (welt) => {
      const anfrage = welt.dateien.home["data/backup-request.txt"];
      if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
      welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
        ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
    },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (kein echter Rundenfehler)", rundenfehler(r.log).length === 0
    && r.ende !== "fehler", rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
  pruefe("'Billig' wurde versucht, aber nicht tatsaechlich gekauft",
    !w.kaeufe.some((k) => k.a === "Billig"), JSON.stringify(w.kaeufe));
  pruefe("stattdessen 'Teurer' wurde gekauft (Kauf-Ruecklauf statt Abbruch)",
    r.log.includes("Daedalus-Fuellstueck: Teurer"), r.log.slice(0, 400));
  pruefe("der Einbau selbst lief (installAugmentations, Ende return)",
    w.installAufrufe === 1 && r.ende === "return", "install " + w.installAufrufe + ", Ende " + r.ende);
}

// ===========================================================================
// P1 / AUG-4 (03.10.2026): KAMPFKNOTEN MIT GANG - KAUFAUFSCHUB UND TORRUNDE
// (nodes/audit-2026-10-03/verify-g01-betrieb.md PAKET 1; S4-S6 sind die dort
// vorgegebenen Szenarien, S7-S13 die Fehlermodi, die der Bau dazu gefunden hat)
// ===========================================================================
//
// Die Welt: BN2.2, V2-Marke, Slum Snakes als Gang-Faktion mit 1,5 Mio Ruf, dazu
// die Bladeburners mit einem verdienten Stueck, 60 Mrd auf dem Konto, zwoelf
// Augs installiert. Namen, Ruf und Preise der Gang-Augs aus
// tools/audit/gang-augs.json (Augmentations.ts), die Faktoren aus COMBAT_AUGS.
const { COMBAT_AUGS } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);
const BO_JSON = (() => {
  try { return fs.readFileSync(path.join(SRC, "lib", "blackops.json"), "utf8"); } catch { return ""; }
})();
const PLAYTIME_NOW = 100 * 3600000;   // baueWelt: playtime
const AUGS_GANG = {
  // Nur Erfahrungsfaktoren: kein Zuwachs der Competence, aber combatNutzen > 0 -
  // die alte Schleife kauft sie sofort, die Torrunde nie.
  "Neurotrainer I": { repReq: 1000, basis: 4e6 },
  "Wired Reflexes": { repReq: 1250, basis: 2.5e6 },
  "Combat Rib I": { repReq: 7500, basis: 23.75e6 },
  "Bionic Spine": { repReq: 45000, basis: 125e6 },
  "Bionic Arms": { repReq: 62500, basis: 275e6 },
  "Graphene Bionic Arms Upgrade": { repReq: 500000, basis: 3.75e9, prereq: ["Bionic Arms"] },
  "Neotra": { repReq: 562500, basis: 2.875e9 },
  "NEMEAN Subdermal Weave": { repReq: 875000, basis: 3.25e9 },
  "Graphene Bone Lacings": { repReq: 1125000, basis: 4.25e9 },
  "SPTN-97 Gene Modification": { repReq: 1250000, basis: 4.875e9 },
  // 1,625 Mio Ruf: fehlt der Gang noch (1,5 Mio) - haelt "offen" gefuellt, damit
  // die Runde bis zur Telemetrie kommt.
  "Graphene Bionic Spine Upgrade": { repReq: 1625000, basis: 6e9, prereq: ["Bionic Spine"] },
  "Hyperion Plasma Cannon V1": { repReq: 1250, basis: 5.5e9 },
  [NFG]: { repReq: 1000, basis: 1e6 },
};
for (const [n, a] of Object.entries(AUGS_GANG)) if (COMBAT_AUGS[n]) a.stats = COMBAT_AUGS[n];
const GANG_AUGS = Object.keys(AUGS_GANG).filter((n) => n !== "Hyperion Plasma Cannon V1");
const dGang = (extra = {}) => ({
  "data/verfahren.txt": "V2 2 1",
  "lib/blackops.json": BO_JSON,
  "data/blade.json": JSON.stringify({ zeit: 0, naechsteBlackOp: "Operation Typhoon" }),
  // Wiederaufbau seit Stunde 0 vorbei, 100 h her: kein Kampf-Sperrzeitraum.
  "data/einbau-uhr.json": JSON.stringify({ augReset: 2, playtime: 0, fertig: 1000 }),
  ...extra,
});
const einbauUhrJung = () => JSON.stringify({ augReset: 2, playtime: 0, fertig: PLAYTIME_NOW - 3600000 });
const weltGang = (o = {}) => baueWelt({
  host: "werk-0", knoten: 2, moneyMult: 1, geld: 60e9, einkommen: 1e6,
  skills: { hacking: 372, strength: 194, defense: 181, dexterity: 181, agility: 181, intelligence: 153 },
  mults: { hacking: 1.5, faction_rep: 1.33 },
  faktionen: {
    "Slum Snakes": { favor: 0, rep: 1.5e6, augs: GANG_AUGS },
    Bladeburners: { favor: 0, rep: 9505, augs: ["Hyperion Plasma Cannon V1"] },
  },
  augs: AUGS_GANG,
  installiert: Array.from({ length: 12 }, (_, i) => "Alt-" + i),
  warteschlange: [],
  gang: { da: true, bonusMs: 0 },
  schlafBudget: 12,
  ...o,
  dateien: { home: dGang(), ...(o.dateien || {}) },
});
const teleVon = (w) => { try { return JSON.parse(w.dateien.home["data/bn4rep.json"] || "null"); } catch { return null; } };
const vollstaendig = (r) => rundenfehler(r.log).length === 0 && r.ende !== "fehler";
const vollHinweis = (r) => rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300);
const antwortetBruecke = (welt) => {
  const anfrage = welt.dateien.home["data/backup-request.txt"];
  if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
  welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({ ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
};
// Nach dem ersten Kauf legt ein Mensch (oder die Firmenphase) eine Einbausperre: die
// naechste Runde ist "gesperrt", kauft nichts mehr und kommt bis zur Telemetrie -
// so ist die Runde NACH der Torrunde pruefbar (die Runde mit dem Kauf endet mit
// `continue`, ihre Telemetrie entsteht erst spaeter; deshalb die Summenzaehler).
const sperreNachErstemKauf = (welt) => {
  if (!welt.kaeufe.length || welt.dateien.home["data/install-sperre.txt"]) return;
  welt.dateien.home["data/install-sperre.txt"] = JSON.stringify({
    ts: welt.uhr, reason: "test", bis: welt.uhr + 10 * 3600000 });
};

// ---------------------------------------------------------------------------
console.log("\n-- P1 S4: Gang, Einbau gesperrt (Wiederaufbau zu jung), Ruf 1,5 Mio, 60 Mrd -> 0 Kaeufe --");
{
  const w = weltGang({ dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("S4: kein einziger Kauf, aus keiner Faktion (alt: Hyperion V1, SPTN-97, Graphene Bone Lacings u. a. sofort)",
    w.kaeufe.length === 0, "Kaeufe: " + w.kaeufe.map((k) => k.a + "@" + k.f).join(", "));
  pruefe("auch nicht aus den Bladeburners (Hyperion V1 war verdient)",
    !w.kaeufe.some((k) => k.f === "Bladeburners"));
  const t = teleVon(w);
  pruefe("Telemetrie torRunde.mode = locked, Grund nennt den jungen Wiederaufbau",
    !!t && !!t.torRunde && t.torRunde.mode === "locked" && /nicht bezahlt/.test(t.torRunde.reason),
    t && t.torRunde ? JSON.stringify(t.torRunde).slice(0, 200) : "keine Telemetrie");
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("data/geldbedarf.txt = Kosten der Planrunde (mit 1,9^i): > 1 Mrd, <= Konto, gleich torRunde.plan.cost",
    Number.isFinite(bedarf) && bedarf > 1e9 && bedarf <= 60e9 && !!t && !!t.torRunde
    && Math.abs(bedarf - t.torRunde.plan.cost) <= 1, "geldbedarf " + bedarf + ", Plan " + (t && t.torRunde ? t.torRunde.plan.cost : "?"));
  pruefe("das Log nennt die Sperre und den Plan", r.log.includes("TORRUNDE: Einbau gesperrt") && r.log.includes("Plan:"),
    r.log.split("\n").filter((z) => z.includes("TORRUNDE")).slice(0, 2).join(" | "));
  pruefe("kein installAugmentations", w.installAufrufe === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S5: Tor offen, Bonuszeit 0 -> die Torrunde: nur Planstuecke, teuerste zuerst --");
{
  const w = weltGang({ schlafBudget: 6, beiSchlaf: sperreNachErstemKauf });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("S5: erster Kauf = erstes Planstueck (SPTN-97 Gene Modification, die teuerste der Runde)",
    w.kaeufe[0] && w.kaeufe[0].a === "SPTN-97 Gene Modification", w.kaeufe[0] ? w.kaeufe[0].a : "kein Kauf");
  const m = /Torrunde 1\/(\d+)/.exec(r.log);
  const n = m ? Number(m[1]) : 0;
  const runde = w.kaeufe.slice(0, n);
  pruefe("das Log nennt die Rundenlaenge (Torrunde 1/N), N >= 5", n >= 5, String(n));
  pruefe("nur Planstuecke: Neurotrainer I (nur Erfahrung, kein Zuwachs der Competence) NICHT gekauft, die Bladeburners-Aug (zu teuer je Zuwachs) auch nicht",
    !w.kaeufe.some((k) => k.a === "Neurotrainer I" || k.f === "Bladeburners"),
    w.kaeufe.map((k) => k.a).join(", "));
  const basen = runde.map((k) => AUGS_GANG[k.a].basis);
  pruefe("teuerste zuerst: die Grundpreise der Runde fallen nie, Voraussetzungen stehen vor ihrem Nachfolger",
    runde.length === n && basen.every((b, i) => i === 0 || b <= basen[i - 1]
      || (AUGS_GANG[runde[i - 1].a].prereq || []).includes(runde[i].a)),
    runde.map((k) => k.a).join(" > "));
  pruefe("Preis je Position = Grundpreis x 1,9^Position (die Warteschlange war leer)",
    runde.every((k, i) => Math.abs(k.p - AUGS_GANG[k.a].basis * Math.pow(1.9, i)) < 1),
    runde.map((k) => Math.round(k.p / 1e6)).join(","));
  pruefe("die Runde kostet zusammen hoechstens das Konto (60 Mrd)",
    runde.reduce((s, k) => s + k.p, 0) <= 60e9, String(runde.reduce((s, k) => s + k.p, 0)));
  const t = teleVon(w);
  pruefe("Telemetrie (der Runde NACH dem Kauf): boughtTotal = Rundenlaenge, lastRound nennt Anzahl und erstes Stueck",
    !!t && !!t.torRunde && t.torRunde.boughtTotal === n && !!t.torRunde.lastRound
    && t.torRunde.lastRound.n === n && t.torRunde.lastRound.first === w.kaeufe[0].a,
    t && t.torRunde ? JSON.stringify(t.torRunde).slice(0, 260) : "keine Telemetrie");
  pruefe("und die Runde danach ist gesperrt (mode locked), kauft nichts mehr",
    !!t && !!t.torRunde && t.torRunde.mode === "locked" && w.kaeufe.length === n, "Kaeufe " + w.kaeufe.length + ", N " + n);
  pruefe("Gewichte aus blackops.json: naechste Op Typhoon laut blade.json", !!t && !!t.torRunde
    && /blackops\.json:OperationTyphoon/.test(t.torRunde.weights), t && t.torRunde ? t.torRunde.weights : "");
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("geldbedarf.txt: nach der Runde nur noch das, was die naechste Planrunde mit dem Rest kosten wuerde (<= Restgeld)",
    Number.isFinite(bedarf) && bedarf <= w.geld + 1, "bedarf " + bedarf + ", Geld " + w.geld);
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S6: Tor offen, Bonuszeit 10 min -> weder Kauf noch Einbau --");
{
  // Drei Stuecke warten schon (vor der Gang gekauft): ohne den Aufschub wuerde
  // der Einbau sofort laufen, vor jeder Runde.
  const w = weltGang({
    gang: { da: true, bonusMs: 10 * 60000 },
    warteschlange: ["Wired Reflexes", "Combat Rib I", "Bionic Spine"],
    schlafBudget: 6,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("S6: kein Kauf, solange der Gang-Vorrat nachgeholt wird", w.kaeufe.length === 0,
    "Kaeufe: " + w.kaeufe.map((k) => k.a).join(", "));
  pruefe("und auch kein Einbau: kein Handschlag, kein installAugmentations",
    w.installAufrufe === 0 && !w.dateien.home["data/backup-request.txt"],
    "install " + w.installAufrufe + ", Handschlag " + !!w.dateien.home["data/backup-request.txt"]);
  const t = teleVon(w);
  pruefe("Telemetrie: mode bonus, bonusMs 600000, Begruendung nennt das Nachholen",
    !!t && !!t.torRunde && t.torRunde.mode === "bonus" && t.torRunde.bonusMs === 600000
    && /wird noch nachgeholt/.test(t.torRunde.bonusNote), t && t.torRunde ? JSON.stringify(t.torRunde).slice(0, 220) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S7: Tor offen mit schon wartenden Stuecken -> ERST die Runde, DANN der Einbau --");
{
  const w = weltGang({
    warteschlange: ["Wired Reflexes", "Combat Rib I", "Bionic Spine"],
    schlafBudget: 80, beiSchlaf: antwortetBruecke,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const zeilen = r.log.split("\n");
  const iKauf = zeilen.findIndex((z) => z.includes("GEKAUFT: SPTN-97 Gene Modification"));
  const iEinbau = zeilen.findIndex((z) => z.includes("EINBAU:"));
  pruefe("die Torrunde wird gekauft, BEVOR der Einbau ausloest (drei wartende Stuecke wuerden ihn sofort ausloesen)",
    iKauf >= 0 && (iEinbau === -1 || iKauf < iEinbau), "Kauf Zeile " + iKauf + ", Einbau Zeile " + iEinbau);
  pruefe("danach baut die naechste Runde regulaer ein (EINBAU, installAugmentations, main endet)",
    iEinbau > iKauf && w.installAufrufe === 1 && r.ende === "return",
    "Einbau Zeile " + iEinbau + ", install " + w.installAufrufe + ", Ende " + r.ende);
  pruefe("im Einbau stecken das Planstueck SPTN-97 neben den drei alten, und kein Neurotrainer I",
    w.warteschlange.includes("SPTN-97 Gene Modification") && w.warteschlange.includes("Wired Reflexes")
    && w.warteschlange.includes("Combat Rib I") && !w.warteschlange.includes("Neurotrainer I"),
    w.warteschlange.join(", "));
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S8: ns.gang.inGang wirft -> Fehler gezaehlt, alte Schleife als Rueckfall --");
{
  // 600 Mrd, damit auch der Kleinkram bezahlbar bleibt, wenn die alte Schleife
  // zuerst die teuren Stuecke kauft (Preis x1,9 je Stueck).
  const w = weltGang({ geld: 600e9, gang: { da: true, wirftInGang: true }, dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) }, schlafBudget: 3 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (der Wurf kommt nicht als RUNDENFEHLER an)", vollstaendig(r), vollHinweis(r));
  pruefe("die alte Kaufschleife laeuft trotz Sperre (Neurotrainer I und die Bladeburners-Aug werden gekauft)",
    w.kaeufe.some((k) => k.a === "Neurotrainer I") && w.kaeufe.some((k) => k.f === "Bladeburners"),
    w.kaeufe.map((k) => k.a).join(", "));
  const t = teleVon(w);
  pruefe("der Fehler steht in der Telemetrie (torRunde.gangErrors >= 1, lastGangError nennt inGang)",
    !!t && !!t.torRunde && t.torRunde.gangErrors >= 1 && /inGang/.test(t.torRunde.lastGangError),
    t && t.torRunde ? JSON.stringify(t.torRunde) : "keine Telemetrie");
  pruefe("und im Log (gedrosselt, genau einmal)", r.log.split("\n").filter((z) => z.includes("TORRUNDE Fehler")).length === 1);
}
{
  const w = weltGang({ gang: { da: true, wirftBonus: true }, schlafBudget: 6, beiSchlaf: sperreNachErstemKauf });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("getBonusTime wirft: es wird NICHT gewartet, die Runde wird gekauft",
    w.kaeufe.length >= 5 && w.kaeufe[0].a === "SPTN-97 Gene Modification", w.kaeufe.map((k) => k.a).join(", "));
  const t = teleVon(w);
  pruefe("Fehler gezaehlt (gangErrors >= 1, lastGangError nennt getBonusTime), Runde in boughtTotal",
    !!t && !!t.torRunde && t.torRunde.gangErrors >= 1 && /getBonusTime/.test(t.torRunde.lastGangError)
    && t.torRunde.boughtTotal === w.kaeufe.length, t && t.torRunde ? JSON.stringify(t.torRunde).slice(0, 260) : "keine Telemetrie");
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S9: der Vorrat sinkt nie (gedrosselter Tab) -> nach 30 min kauft die Runde trotzdem --");
{
  const w = weltGang({ gang: { da: true, bonusMs: 10 * 60000 }, schlafBudget: 1000 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const erster = w.kaeufe[0];
  const stunden = erster ? (erster.uhr - w.start) / 3600000 : null;
  pruefe("kein Kauf in den ersten 30 Minuten, danach die Runde (Stillstandsschutz gegen 'nie mehr einbauen')",
    stunden !== null && stunden >= 0.5 && stunden < 0.6,
    (stunden === null ? "nie gekauft" : "erster Kauf nach " + stunden.toFixed(2) + " h")
    + ", Lauf " + ((w.uhr - w.start) / 3600000).toFixed(2) + " h, Schlafaufrufe " + w.schlaf.length
    + ", Verteilung " + JSON.stringify(w.schlaf.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {})));
  pruefe("das Log sagt, dass der Vorrat nicht sinkt", r.log.includes("sinkt seit") && r.log.includes("trotzdem gekauft"),
    r.log.split("\n").filter((z) => z.includes("TORRUNDE")).slice(-1)[0] || "");
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// P2c (04.10.2026): KAUFAUFSCHUB VOR DER GANG. Dieselbe Lage wie S10 (V2 in BN2,
// keine Gang, verdiente Kampfstuecke, 600 Mrd), aber der Schalter
// data/gang-an.txt liegt und der Knoten ist jung: die alte Schleife darf nichts
// kaufen. Gegen den alten Stand ROT (er kauft Hyperion V1, SPTN-97 ...).
console.log("\n-- P2c H1: Gang geplant (Schalter), noch nicht gegruendet, Knoten 1 h alt -> 0 Kaeufe --");
{
  const w = weltGang({ geld: 600e9, gang: { da: false }, nodeReset: 1_790_442_188_000 - 3600000, schlafBudget: 3,
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung(), "data/gang-an.txt": "an" }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("H1: kein einziger Kauf vor der Gruendung (alt: Hyperion V1, SPTN-97 u. a. sofort)",
    w.kaeufe.length === 0, "Kaeufe: " + w.kaeufe.map((k) => k.a + "@" + k.f).join(", "));
  pruefe("H1: das Log nennt den Aufschub", r.log.includes("KAUFAUFSCHUB VOR DER GANG"),
    r.log.split("\n").filter((z) => /KAUFAUFSCHUB|Kaufaufschub/.test(z)).join(" | "));
  const t = teleVon(w);
  pruefe("H1: Telemetrie gangHold true", !!t && t.gangHold === true, t ? String(t.gangHold) : "keine Telemetrie");
  pruefe("H1: kein installAugmentations", w.installAufrufe === 0);
}
console.log("\n-- P2c H2: Schalter liegt, aber der Knoten ist aelter als die Frist (7 h) -> alte Schleife kauft --");
{
  const w = weltGang({ geld: 600e9, gang: { da: false }, nodeReset: 1_790_442_188_000 - 7 * 3600000, schlafBudget: 3,
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung(), "data/gang-an.txt": "an" }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("H2: Rueckfall nach der Frist - die alte Schleife kauft wieder (Hyperion V1 zuerst)",
    w.kaeufe[0] && w.kaeufe[0].a === "Hyperion Plasma Cannon V1", w.kaeufe.map((k) => k.a).join(", "));
  const t = teleVon(w);
  pruefe("H2: Telemetrie gangHold false", !!t && t.gangHold === false, t ? String(t.gangHold) : "keine Telemetrie");
}
console.log("\n-- P2c H3: Knoten jung, aber KEIN Schalter -> alte Schleife kauft (wie S10) --");
{
  const w = weltGang({ geld: 600e9, gang: { da: false }, nodeReset: 1_790_442_188_000 - 3600000, schlafBudget: 3,
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("H3: ohne Schalter kauft die alte Schleife", w.kaeufe.length > 0 && !r.log.includes("KAUFAUFSCHUB VOR DER GANG"),
    w.kaeufe.map((k) => k.a).join(", "));
}
console.log("\n-- P2c H4: Schalter, Knoten jung, aber Hackingknoten-Marke (V1 2) -> kein Aufschub --");
{
  const w = weltGang({ geld: 600e9, gang: { da: false }, nodeReset: 1_790_442_188_000 - 3600000, schlafBudget: 3,
    dateien: { home: dGang({ "data/verfahren.txt": "V1 2 1", "data/einbau-uhr.json": einbauUhrJung(), "data/gang-an.txt": "an" }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("H4: im V1 greift der Aufschub nicht", !r.log.includes("KAUFAUFSCHUB VOR DER GANG"),
    r.log.split("\n").filter((z) => /KAUFAUFSCHUB/.test(z)).join(" | "));
}
console.log("\n-- P2c H5: Gang steht, Knoten jung, Schalter -> Block 1c entscheidet (kein gangHold) --");
{
  const w = weltGang({ gang: { da: true }, nodeReset: 1_790_442_188_000 - 3600000,
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung(), "data/gang-an.txt": "an" }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const t = teleVon(w);
  pruefe("H5: gangHold false, Torrunde locked (wie S4)", !!t && t.gangHold === false && !!t.torRunde && t.torRunde.mode === "locked",
    t ? JSON.stringify({ gangHold: t.gangHold, mode: t.torRunde && t.torRunde.mode }) : "keine Telemetrie");
  pruefe("H5: kein Kauf", w.kaeufe.length === 0, w.kaeufe.map((k) => k.a).join(", "));
}

console.log("\n-- P1 S10: ohne Gang aendert sich NICHTS (V2, Einbau gesperrt, trotzdem Kauf) --");
{
  const w = weltGang({ geld: 600e9, gang: { da: false }, dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) }, schlafBudget: 3 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const basenAlt = w.kaeufe.map((k) => AUGS_GANG[k.a].basis);
  pruefe("die alte Schleife kauft alles Verdiente, teuerste zuerst (Hyperion V1 5,5 Mrd vor SPTN-97), auch den Kleinkram",
    w.kaeufe[0] && w.kaeufe[0].a === "Hyperion Plasma Cannon V1" && w.kaeufe.some((k) => k.a === "Neurotrainer I")
    && basenAlt.every((b, i) => i === 0 || b <= basenAlt[i - 1]),
    w.kaeufe.map((k) => k.a).join(", "));
  pruefe("auch die Bladeburners (Hyperion V1) wie bisher", w.kaeufe.some((k) => k.f === "Bladeburners"));
  pruefe("keine Torrunden-Zeile im Log, kein getBonusTime-Aufruf", !r.log.includes("TORRUNDE") && w.gangAufrufe.getBonusTime === 0,
    "getBonusTime-Aufrufe: " + w.gangAufrufe.getBonusTime);
  const t = teleVon(w);
  pruefe("Telemetrie torRunde ist null (kein Fehler, keine Gang)", !!t && t.torRunde === null, t ? JSON.stringify(t.torRunde) : "keine Telemetrie");
  // Und data/geldbedarf.txt bleibt die alte Summe aller verdienten Stuecke (augRuecklage).
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("geldbedarf.txt ist die alte Ruecklage (augRuecklage), hier nach dem Kauf der verdienten Stuecke klein",
    Number.isFinite(bedarf), String(bedarf));
}
{
  // Kein Kampfknoten (V1 5): die Gang wird nicht einmal gefragt.
  const w = welt1903({ schlafBudget: 6 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("Hackingknoten (V1): ns.gang.inGang wird nie gerufen", w.gangAufrufe.inGang === 0,
    "Aufrufe: " + w.gangAufrufe.inGang);
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S11: Preisfaktor mit SF11 (1,9 x 0,96) -> die Runde wird nicht ueberschaetzt --");
{
  const w = weltGang({
    schlafBudget: 6, beiSchlaf: sperreNachErstemKauf,
    ownedSF: new Map([[4, 3], [5, 1], [11, 1]]), priceStep: 1.9 * 0.96,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const m = /Torrunde 1\/(\d+)/.exec(r.log);
  const n = m ? Number(m[1]) : 0;
  pruefe("kein Abbruch wegen Preisabweichung, die ganze geplante Runde wird gekauft",
    n >= 5 && !r.log.includes("TORRUNDE abgebrochen") && w.kaeufe.length >= n, "N " + n + ", Kaeufe " + w.kaeufe.length);
  const t = teleVon(w);
  const gekauftSumme = w.kaeufe.slice(0, n).reduce((s, k) => s + k.p, 0);
  pruefe("Plankosten = tatsaechliche Kosten der Runde (SF11 eingerechnet)",
    !!t && !!t.torRunde && !!t.torRunde.lastRound && n > 0 && Math.abs(t.torRunde.lastRound.cost - gekauftSumme) <= 1,
    "Plan " + (t && t.torRunde && t.torRunde.lastRound ? t.torRunde.lastRound.cost : "?") + " / gekauft " + gekauftSumme);
}
{
  // Der Plan irrt (SF11 steht im Spiel, die Welt rechnet aber mit 1,9): abbrechen statt blind kaufen.
  const w = weltGang({
    schlafBudget: 6, beiSchlaf: sperreNachErstemKauf,
    ownedSF: new Map([[4, 3], [5, 1], [11, 3]]), priceStep: 1.9,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("Preis ueber Plan (> 1 %): 'TORRUNDE abgebrochen', nur das Stueck vor der Abweichung gekauft",
    r.log.includes("TORRUNDE abgebrochen") && w.kaeufe.length === 1, "Kaeufe " + w.kaeufe.length);
  const t = teleVon(w);
  pruefe("Telemetrie planDrift >= 1", !!t && !!t.torRunde && t.torRunde.planDrift >= 1, t && t.torRunde ? String(t.torRunde.planDrift) : "keine Telemetrie");
}

// ---------------------------------------------------------------------------
// Skeptiker-Urteil AUFLAGE zu P1 (03.10.2026): S12-S16. Auflage 1 (der Leser) und
// Auflage 2 (Faehigkeiten in der Potenz) plus die Hinweise (Wartegrenze 30 min mit
// Zustand in data/, Halt des Einbaus nach abgebrochener Torrunde).
// ---------------------------------------------------------------------------
const EINBAU = await import(pathToFileURL(path.join(SRC, "lib", "einbau.js")).href);
const { gateRoundStatus } = await import(pathToFileURL(path.join(HIER, "lib", "gate-round-status.js")).href);
const jsonVon = (w, datei) => { try { return JSON.parse(w.dateien.home[datei] || "null"); } catch { return null; } };
// Der Leser (tools/checkin.js) auf der Telemetrie, die der Nachbau wirklich schreibt: Schreiber und Leser
// gegeneinander gehalten (Lehre 03.10.: Fehler gezaehlt, aber von niemandem gelesen).
const leser = (w, nowMs = w.uhr) => gateRoundStatus({
  tele: jsonVon(w, "data/bn4rep.json"), blade: jsonVon(w, "data/blade.json"), nowMs, before: null,
});

// Die Eingabe der Planung, wie bn4rep.js sie aus der Welt baut (alle Gang-Stuecke mit Kampffaktor, dazu die
// Bladeburners-Aug), und die Runde fuer zwei Stufensaetze - roh und effektiv.
const planAusWelt = (levels, geld, wartend = 0) => {
  const ty = EINBAU.blackOpWeights(JSON.parse(BO_JSON), "Operation Typhoon");
  const eingabe = [];
  for (const n of GANG_AUGS) {
    if (!COMBAT_AUGS[n]) continue;
    eingabe.push({ aug: n, faktion: "Slum Snakes", rep: 1.5e6, repReq: AUGS_GANG[n].repReq,
      preis: AUGS_GANG[n].basis * Math.pow(1.9, wartend), prereq: AUGS_GANG[n].prereq || [], mults: COMBAT_AUGS[n] });
  }
  eingabe.push({ aug: "Hyperion Plasma Cannon V1", faktion: "Bladeburners", rep: 9505, repReq: 1250,
    preis: AUGS_GANG["Hyperion Plasma Cannon V1"].basis * Math.pow(1.9, wartend), prereq: [],
    mults: COMBAT_AUGS["Hyperion Plasma Cannon V1"] });
  const besitz = new Set(Array.from({ length: 12 }, (_, i) => "Alt-" + i));
  return EINBAU.waehleTorRunde(eingabe, geld, besitz, {
    skills: levels, weights: ty.weights, decays: ty.decays, startMults: {}, priceStep: 1.9,
  });
};
const WELT_STUFEN = { hacking: 372, strength: 194, defense: 181, dexterity: 181, agility: 181, intelligence: 153 };
const bladeJson = (extra) => JSON.stringify({ zeit: 1_790_442_188_000, naechsteBlackOp: "Operation Typhoon", ...extra });

console.log("\n-- P1 S12: Reaper 12 / Evasive System 13 aus data/blade.json -> die Runde wird mit effektiven Stufen geplant --");
{
  const eff = EINBAU.bladeEffFactors ? EINBAU.bladeEffFactors(12, 13) : null;
  const effLevels = EINBAU.effectiveLevels && eff ? EINBAU.effectiveLevels(WELT_STUFEN, eff) : WELT_STUFEN;
  const erwEff = planAusWelt(effLevels, 60e9);
  const erwRoh = planAusWelt(WELT_STUFEN, 60e9);
  pruefe("Testfall ist empfindlich: der Zuwachs der Runde unterscheidet sich zwischen rohen und effektiven Stufen um > 0,05",
    Math.abs(erwEff.gain - erwRoh.gain) > 0.05, "effektiv x" + erwEff.gain.toFixed(4) + ", roh x" + erwRoh.gain.toFixed(4));

  const w = weltGang({
    schlafBudget: 6, beiSchlaf: sperreNachErstemKauf,
    dateien: { home: dGang({ "data/blade.json": bladeJson({ skillLevels: { reaper: 12, evasive: 13 }, skillLevelsError: null }) }) },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const m = /Torrunde 1\/(\d+)/.exec(r.log);
  const n = m ? Number(m[1]) : 0;
  pruefe("die gekaufte Runde ist die, die mit EFFEKTIVEN Stufen geplant wird (Menge und Reihenfolge)",
    n === erwEff.seq.length && w.kaeufe.slice(0, n).map((k) => k.a).join(">") === erwEff.seq.join(">"),
    "gekauft " + w.kaeufe.slice(0, n).map((k) => k.a).join(">") + " / erwartet " + erwEff.seq.join(">"));
  const t = teleVon(w);
  pruefe("lastRound.gain = Zuwachs mit effektiven Stufen (nicht der mit rohen)",
    !!t && !!t.torRunde && !!t.torRunde.lastRound && Math.abs(t.torRunde.lastRound.gain - erwEff.gain) < 0.002
    && Math.abs(t.torRunde.lastRound.gain - erwRoh.gain) > 0.05,
    t && t.torRunde && t.torRunde.lastRound ? "gemeldet " + t.torRunde.lastRound.gain + ", effektiv " + erwEff.gain.toFixed(3) + ", roh " + erwRoh.gain.toFixed(3) : "keine Telemetrie");
  const sk = t && t.torRunde ? t.torRunde.skills : null;
  pruefe("Telemetrie torRunde.skills: Quelle blade.json, Reaper 12, Evasive 13, Faktoren x1,24 und x1,8848",
    !!sk && sk.source === "blade.json" && sk.reaper === 12 && sk.evasive === 13
    && Math.abs(sk.strengthFactor - 1.24) < 1e-9 && Math.abs(sk.dexterityFactor - 1.8848) < 1e-9, JSON.stringify(sk));
  const l = leser(w);
  pruefe("der Leser (checkin) nennt die eingerechneten Faehigkeiten, ohne Befund",
    l.lines.some((z) => /Faehigkeiten eingerechnet: Reaper 12, Evasive System 13/.test(z)) && l.findings.length === 0,
    l.lines.join(" | ") + " || " + l.findings.join(" | "));
}
{
  // Gegenprobe: blade.json ohne Stufen, zu alt, oder mit Fehler -> rohe Stufen, und die Telemetrie sagt WARUM.
  const faelle = [
    ["blade.json ohne skillLevels (altes blade.js)", bladeJson({}), /ohne skillLevels/, 0],
    ["blade.json 40 min alt", JSON.stringify({ zeit: 1_790_442_188_000 - 40 * 60000, naechsteBlackOp: "Operation Typhoon",
      skillLevels: { reaper: 12, evasive: 13 } }), /min alt/, 0],
    ["blade.js meldet einen Fehler", bladeJson({ skillLevels: null, skillLevelsError: "Bladeburner nicht verfuegbar" }), /blade\.js meldet/, 1],
  ];
  for (const [name, inhalt, grund, fehler] of faelle) {
    const w = weltGang({ schlafBudget: 6, beiSchlaf: sperreNachErstemKauf, dateien: { home: dGang({ "data/blade.json": inhalt }) } });
    const r = await fahre(w);
    pruefe("Nachbau vollstaendig (" + name + ")", vollstaendig(r), vollHinweis(r));
    const t = teleVon(w);
    const sk = t && t.torRunde ? t.torRunde.skills : null;
    pruefe(name + ": rohe Stufen, Telemetrie nennt den Grund", !!sk && sk.source === "roh" && grund.test(sk.why), JSON.stringify(sk));
    const erwRoh = planAusWelt(WELT_STUFEN, 60e9);
    pruefe(name + ": die Runde ist die mit rohen Stufen",
      !!t && !!t.torRunde && !!t.torRunde.lastRound && Math.abs(t.torRunde.lastRound.gain - erwRoh.gain) < 0.002,
      t && t.torRunde && t.torRunde.lastRound ? "gemeldet " + t.torRunde.lastRound.gain + ", roh " + erwRoh.gain.toFixed(3) : "keine Telemetrie");
    pruefe(name + ": " + (fehler ? "ein Fehler von blade.js wird als Fehler GEZAEHLT (gangErrors, lastGangError nennt skillLevels)" : "kein gezaehlter Fehler (nur ein Hinweis)"),
      fehler ? (!!t && !!t.torRunde && t.torRunde.gangErrors >= 1 && /skillLevels/.test(t.torRunde.lastGangError))
        : (!!t && !!t.torRunde && t.torRunde.gangErrors === 0), t && t.torRunde ? t.torRunde.gangErrors + " / " + t.torRunde.lastGangError : "");
    const l = leser(w);
    pruefe(name + ": der Leser sagt, dass die Faehigkeiten NICHT eingerechnet sind" + (fehler ? " und meldet den Fehler als Befund" : ""),
      l.lines.some((z) => /Faehigkeiten NICHT eingerechnet/.test(z)) && (fehler ? l.findings.length >= 1 : true),
      l.lines.join(" | ") + " || " + l.findings.join(" | "));
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S13: Neustart von bn4rep mitten im Warten -> die Wartegrenze (30 min) beginnt nicht von vorn --");
{
  const w = weltGang({
    gang: { da: true, bonusMs: 10 * 60000 }, schlafBudget: 100000,
    beiSchlaf: (welt) => { if (welt.uhr - welt.start >= 25 * 60000) welt.schlafBudget = -1; },
  });
  const r1 = await fahre(w);
  pruefe("erster Lauf: endet nach 25 min (Schlafbudget), nichts gekauft", r1.ende === "budget" && w.kaeufe.length === 0,
    "Ende " + r1.ende + ", Kaeufe " + w.kaeufe.length);
  const datei = jsonVon(w, "data/torrunde-wait.json");
  pruefe("data/torrunde-wait.json liegt auf home: min 600000, seit am Anfang, zuletzt kurz vor dem Ende",
    !!datei && datei.min === 600000 && datei.seit - w.start < 60000 && w.uhr - datei.zuletzt < 60000,
    JSON.stringify(datei));
  const tele1 = teleVon(w);
  pruefe("Telemetrie torRunde.wait zeigt denselben Zustand", !!tele1 && !!tele1.torRunde && !!tele1.torRunde.wait
    && tele1.torRunde.wait.seit === (datei && datei.seit), tele1 && tele1.torRunde ? JSON.stringify(tele1.torRunde.wait) : "");
  // Neustart: neues Modul, dieselbe Welt (dieselben Dateien, dieselbe Uhr).
  w.schlafBudget = w.schlaf.length + 100000;
  w.beiSchlaf = (welt) => { if (welt.kaeufe.length) welt.schlafBudget = -1; };
  const r2 = await fahre(w);
  pruefe("zweiter Lauf (Neustart): kauft die Runde", r2.ende === "budget" && w.kaeufe.length >= 5, "Ende " + r2.ende + ", Kaeufe " + w.kaeufe.length);
  const minuten = w.kaeufe.length ? (w.kaeufe[0].uhr - w.start) / 60000 : null;
  pruefe("erster Kauf nach 30 bis 31 min Gesamtwartezeit - NICHT erst 30 min nach dem Neustart (= 55 min) und nicht nach 2 h",
    minuten !== null && minuten >= 30 && minuten < 31, minuten === null ? "nie gekauft" : minuten.toFixed(2) + " min");
  pruefe("der Zustand bleibt nach der Grenze stehen (gleiches seit): die naechste Runde wartet nicht erneut, ein weiterer Neustart auch nicht",
    !!jsonVon(w, "data/torrunde-wait.json") && jsonVon(w, "data/torrunde-wait.json").seit === datei.seit,
    JSON.stringify(jsonVon(w, "data/torrunde-wait.json")));
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S14: das erste Planstueck wird vom Spiel abgelehnt -> der Einbau haelt zurueck (hoechstens 20 Runden) --");
{
  // Drei Stuecke warten (S7): ohne den Halt baute der Einbau in derselben Runde ohne Torrunde ein.
  const w = weltGang({
    warteschlange: ["Wired Reflexes", "Combat Rib I", "Bionic Spine"],
    kaufSperre: ["SPTN-97 Gene Modification"],
    schlafBudget: 600, beiSchlaf: antwortetBruecke,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  // main kehrt mit dem Einbau zurueck: das Ende des Laufs ist der Einbau-Zeitpunkt.
  const sek = w.installAufrufe === 1 && r.ende === "return" ? (w.uhr - w.start) / 1000 : null;
  pruefe("der Einbau kommt NICHT in den ersten Runden (alt: sofort in der Runde des Abbruchs), aber nach hoechstens 20 Runden (rund 5 min)",
    sek !== null && sek >= 290 && sek < 600 && w.installAufrufe === 1 && r.ende === "return",
    "Einbau nach " + (sek === null ? "nie" : sek.toFixed(0) + " s") + ", install " + w.installAufrufe + ", Ende " + r.ende);
  const zeilen = r.log.split("\n");
  const abbruch = zeilen.filter((z) => z.includes("TORRUNDE abgebrochen")).length;
  pruefe("die Abbruch-Logzeile ist gedrosselt: genau eine in 20 Runden (alt: eine je Runde)", abbruch === 1, String(abbruch));
  pruefe("und das Ende des Halts steht einmal im Log", zeilen.filter((z) => /TORRUNDE: 20 Runden in Folge/.test(z)).length === 1,
    zeilen.filter((z) => z.includes("TORRUNDE")).slice(-3).join(" | "));
  const t = teleVon(w);
  pruefe("Telemetrie: buyFailures >= 20 (jeder Abbruch wird gezaehlt, auch ohne Logzeile), abortStreak >= 20",
    !!t && !!t.torRunde && t.torRunde.buyFailures >= 20 && t.torRunde.abortStreak >= 20,
    t && t.torRunde ? JSON.stringify({ b: t.torRunde.buyFailures, s: t.torRunde.abortStreak }) : "keine Telemetrie");
  pruefe("kein Gang-Stueck wurde gekauft (SPTN-97 ist abgelehnt; die NeuroFlux-Stufen kauft der Einbau selbst mit dem Restgeld), die drei alten warten",
    w.kaeufe.every((k) => k.a === NFG) && w.warteschlange.slice(0, 3).join() === "Wired Reflexes,Combat Rib I,Bionic Spine", "Kaeufe " + w.kaeufe.map((k) => k.a + "@" + Math.round((k.uhr - w.start) / 1000) + "s").join(", ") + ", Warteschlange " + w.warteschlange.length);
  const l = leser(w);
  pruefe("der Leser meldet die abgelehnten Kaeufe als Befund",
    l.findings.some((z) => /Kaeufe der Runde vom Spiel abgelehnt/.test(z)), l.findings.join(" | "));
}
{
  // Der Halt ist an die Runde gebunden: bricht die Runde NACH dem ersten Kauf ab, entsteht kein Halt (gateBought > 0 -> continue).
  const w = weltGang({
    ownedSF: new Map([[4, 3], [5, 1], [11, 3]]), priceStep: 1.9,   // wie S11b: der Plan irrt beim zweiten Stueck
    warteschlange: [], schlafBudget: 6, beiSchlaf: sperreNachErstemKauf,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const t = teleVon(w);
  pruefe("Abbruch nach dem ersten Kauf: abortStreak bleibt 0 (der Einbau wird nicht zusaetzlich zurueckgehalten)",
    !!t && !!t.torRunde && t.torRunde.abortStreak === 0 && w.kaeufe.length === 1, t && t.torRunde ? String(t.torRunde.abortStreak) : "keine Telemetrie");
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S15: der Block wirft in JEDER Runde -> Rueckfall auf die alte Schleife, aber sichtbar (Schreiber UND Leser) --");
{
  class SfWirft extends Map {
    get(k) { if (k === 11) throw new Error("Nachbau: SF11 nicht lesbar"); return super.get(k); }
  }
  // Einbau gesperrt, 600 Mrd: die alte Schleife kauft trotz Sperre alles Verdiente - das ist die Folge, die der Leser melden muss.
  const w = weltGang({
    geld: 600e9, ownedSF: new SfWirft([[4, 3], [5, 1]]),
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) }, schlafBudget: 3,
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig (der Wurf kommt nicht als RUNDENFEHLER an)", vollstaendig(r), vollHinweis(r));
  pruefe("die alte Schleife kauft trotz Einbausperre (Neurotrainer I) - P1 ist de facto aus",
    w.kaeufe.some((k) => k.a === "Neurotrainer I"), w.kaeufe.map((k) => k.a).join(", "));
  const t = teleVon(w);
  pruefe("Telemetrie torRunde.mode = error, gangErrors >= 1, lastGangError nennt den Block",
    !!t && !!t.torRunde && t.torRunde.mode === "error" && t.torRunde.gangErrors >= 1
    && /Torrunde-Block: .*SF11/.test(t.torRunde.lastGangError), t && t.torRunde ? JSON.stringify(t.torRunde) : "keine Telemetrie");
  const l = leser(w);
  pruefe("der Leser (tools/checkin.js) meldet 'P1 IST AUS' als Befund und nennt den Fehler",
    l.findings.some((z) => /P1 IST AUS/.test(z) && /SF11/.test(z)) && l.lines.some((z) => /FEHLER-RUECKFALL/.test(z)),
    l.findings.join(" | ") + " || " + l.lines.join(" | "));
}
{
  // S8 (ns.gang.inGang wirft): Modus normal mit Fehlerzaehler - auch das liest der Leser.
  const w = weltGang({ geld: 600e9, gang: { da: true, wirftInGang: true }, dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) }, schlafBudget: 3 });
  await fahre(w);
  const l = leser(w);
  pruefe("ns.gang.inGang wirft: der Leser meldet die Fehler und dass die alte Kaufschleife ohne Aufschub lief",
    l.findings.some((z) => /Fehler in der Torrunde gezaehlt/.test(z) && /ohne Aufschub/.test(z) && /inGang/.test(z)), l.findings.join(" | "));
}

// ---------------------------------------------------------------------------
console.log("\n-- P1 S16: data/einbau.json spiegelt den Grund der Torrunde (wer dort nachsieht, warum kein Einbau kommt) --");
{
  const w = weltGang({
    gang: { da: true, bonusMs: 10 * 60000 },
    warteschlange: ["Wired Reflexes", "Combat Rib I", "Bionic Spine"],
    schlafBudget: 6,
  });
  await fahre(w);
  const eb = jsonVon(w, "data/einbau.json");
  pruefe("einbau.json: torRunde.mode bonus, bonusNote nennt das Nachholen, installHeld true",
    !!eb && !!eb.torRunde && eb.torRunde.mode === "bonus" && /nachgeholt/.test(eb.torRunde.bonusNote || "") && eb.torRunde.installHeld === true
    && eb.torRunde.bonusMs === 600000, JSON.stringify(eb && eb.torRunde));
  const l = leser(w);
  pruefe("der Leser nennt den Wartegrund (Vorrat 600 s, Grenze 30 min)",
    l.lines.some((z) => /Gang-Vorrat wird noch nachgeholt/.test(z) && /600 s/.test(z) && /Grenze 30 min/.test(z)), l.lines.join(" | "));
}
{
  const w = weltGang({ dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) }, schlafBudget: 4 });
  await fahre(w);
  const eb = jsonVon(w, "data/einbau.json");
  pruefe("einbau.json im gesperrten Zustand: torRunde.mode locked mit Grund", !!eb && !!eb.torRunde && eb.torRunde.mode === "locked" && /nicht bezahlt/.test(eb.torRunde.reason || ""),
    JSON.stringify(eb && eb.torRunde));
}
{
  const w = weltGang({ gang: { da: false }, schlafBudget: 3, geld: 600e9, dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) } });
  await fahre(w);
  const eb = jsonVon(w, "data/einbau.json");
  pruefe("ohne Gang: einbau.json traegt torRunde null", !!eb && eb.torRunde === null, JSON.stringify(eb && eb.torRunde));
  pruefe("ohne Gang: kein data/torrunde-wait.json", !("data/torrunde-wait.json" in w.dateien.home));
}

// ===========================================================================
// P2d (04.10.2026): GELDMODUS DER GANG - DER RUFBEDARF IN DER TELEMETRIE
// (nodes/audit-2026-10-03/verify-p2b-gang.md Abschnitt 3 und 8, verify-p2b-substanz.md S3)
// ===========================================================================
//
// bn4rep.js rechnet neben der echten Torrunde einen ZWEITEN Plan ueber alle
// Kampfstuecke ohne Rufgrenze, mit dem vierfachen Geld von jetzt, und schreibt
// torRunde.repNeed = 1,02 x hoechster Rufbedarf der Stuecke dieses Plans bei der
// Gang-Faktion (Slum Snakes). gang.js liest die Zahl. Die Gang-Faktion kommt aus
// data/gang.json (gang.js schreibt sie); fehlt sie, gibt es keinen Bedarf.
//
// Die Welt ist weltGang(): Slum Snakes mit 1,5 Mio Ruf, SPTN-97 (1,25 Mio) und
// Graphene Bionic Spine Upgrade (1,625 Mio) im Angebot, Tor gesperrt (junger
// Wiederaufbau) - die Runde erreicht die Telemetrie, gekauft wird nichts.
const GANG_JETZT = 1_790_442_188_000;     // baueWelt: uhr
const gangJson = (over = {}) => JSON.stringify({ ts: GANG_JETZT - 5000, wall: GANG_JETZT - 5000, inGang: true, faction: "Slum Snakes", ...over });
const needWelt = (o = {}) => {
  const { gangDatei, ...rest } = o;
  const extra = { "data/einbau-uhr.json": einbauUhrJung() };
  if (gangDatei !== null) extra["data/gang.json"] = gangDatei ?? gangJson();
  return weltGang({ schlafBudget: 3, ...rest, dateien: { home: dGang(extra) } });
};
const rnVon = (w) => { const t = teleVon(w); return t && t.torRunde ? t.torRunde : null; };

// ---------------------------------------------------------------------------
console.log("\n-- P2d N1: Budget 240 Mrd (4 x 60 Mrd) -> der Plan braucht 1,625 Mio (Bionic Spine Upgrade) -> repNeed 1.657.500 --");
{
  const w = needWelt({ geld: 60e9 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const tr = rnVon(w);
  pruefe("repNeed = 1,02 x 1.625.000 = 1.657.500", !!tr && Math.abs(tr.repNeed - 1.02 * 1625000) < 1e-6, tr ? String(tr.repNeed) : "keine Telemetrie");
  pruefe("repNeedFaction ist Slum Snakes, das bestimmende Stueck Graphene Bionic Spine Upgrade",
    !!tr && tr.repNeedFaction === "Slum Snakes" && tr.repNeedAug === "Graphene Bionic Spine Upgrade", tr ? JSON.stringify([tr.repNeedFaction, tr.repNeedAug]) : "");
  pruefe("der Bedarfsplan hat das 4fache Budget (240 Mrd) und mehrere Stuecke",
    !!tr && !!tr.repNeedPlan && tr.repNeedPlan.budget === 240e9 && tr.repNeedPlan.n >= 5 && tr.repNeedPlan.cost <= 240e9, tr ? JSON.stringify(tr.repNeedPlan) : "");
  pruefe("kein Fehler gezaehlt (gangErrors 0), kein Grund", !!tr && tr.gangErrors === 0 && tr.repNeedWhy === "", tr ? JSON.stringify([tr.gangErrors, tr.repNeedWhy]) : "");
  pruefe("der echte Plan ist davon unberuehrt: Rufbedarf der echten Runde liegt unter 1,5 Mio (Spine Upgrade fehlt dort der Ruf)",
    !!tr && tr.plan.n >= 5 && tr.plan.first !== "Graphene Bionic Spine Upgrade", tr ? JSON.stringify(tr.plan) : "");
  pruefe("The Red Pill nie im Bedarf (2,5 Mio -> 2.550.000 waere es gewesen)", !!tr && tr.repNeed < 2.5e6, tr ? String(tr.repNeed) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N2: kleines Budget (4 x 5 Mrd = 20 Mrd) -> der Plan braucht nur 1,25 Mio (SPTN-97) -> repNeed 1.275.000 --");
{
  const w = needWelt({ geld: 5e9 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const tr = rnVon(w);
  pruefe("repNeed = 1,02 x 1.250.000 = 1.275.000, Stueck SPTN-97 Gene Modification",
    !!tr && Math.abs(tr.repNeed - 1.02 * 1250000) < 1e-6 && tr.repNeedAug === "SPTN-97 Gene Modification", tr ? JSON.stringify([tr.repNeed, tr.repNeedAug]) : "keine Telemetrie");
  pruefe("Budget 20 Mrd in der Telemetrie", !!tr && !!tr.repNeedPlan && tr.repNeedPlan.budget === 20e9, tr ? JSON.stringify(tr.repNeedPlan) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N2b: Konto 40 Mrd (Budget 160 Mrd) liegt noch UNTER der Schwelle zum Spine Upgrade -> 1.275.000 (grenzt den Faktor 4 nach oben ein) --");
{
  const w = needWelt({ geld: 40e9 });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const tr = rnVon(w);
  pruefe("repNeed 1.275.000 bei Budget 160 Mrd (bei 60 Mrd Konto, Budget 240 Mrd, sind es 1.657.500 - N1)",
    !!tr && Math.abs(tr.repNeed - 1.02 * 1250000) < 1e-6 && tr.repNeedPlan.budget === 160e9, tr ? JSON.stringify([tr.repNeed, tr.repNeedPlan]) : "keine Telemetrie");
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N3: kein Bedarf ohne Gang-Faktion (data/gang.json fehlt / alt / meldet keine Gang / andere Faktion) --");
{
  const faelle = [
    ["data/gang.json fehlt", { gangDatei: null }, /gang\.json/],
    ["data/gang.json 11 min alt", { gangDatei: gangJson({ ts: GANG_JETZT - 11 * 60000, wall: GANG_JETZT - 11 * 60000 }) }, /veraltet/],
    ["data/gang.json meldet keine Gang", { gangDatei: gangJson({ inGang: false }) }, /keine Gang/],
    ["data/gang.json ohne Faktion", { gangDatei: gangJson({ faction: undefined }) }, /Faktion/],
    ["die Gang gehoert zu Tetrads (kein Stueck von Tetrads im Angebot)", { gangDatei: gangJson({ faction: "Tetrads" }) }, /kein Stueck der Gang-Faktion/],
  ];
  for (const [label, o, re] of faelle) {
    const w = needWelt({ geld: 60e9, ...o });
    const r = await fahre(w);
    const tr = rnVon(w);
    pruefe(label + ": repNeed null mit Grund, Nachbau vollstaendig, kein gezaehlter Fehler",
      vollstaendig(r) && !!tr && tr.repNeed === null && re.test(tr.repNeedWhy) && tr.gangErrors === 0,
      tr ? JSON.stringify([tr.repNeed, tr.repNeedWhy, tr.gangErrors]) : "keine Telemetrie " + vollHinweis(r));
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N4: data/gang.json kaputt -> GEZAEHLTER Fehler, repNeed null, die echte Torrunde bleibt heil --");
{
  const w = needWelt({ geld: 60e9, gangDatei: "{kaputt" });
  const r = await fahre(w);
  const tr = rnVon(w);
  pruefe("Nachbau vollstaendig (der Wurf wird im Block gefangen)", vollstaendig(r), vollHinweis(r));
  pruefe("gangErrors >= 1, lastGangError nennt repNeed, repNeed null",
    !!tr && tr.gangErrors >= 1 && /repNeed/.test(tr.lastGangError) && tr.repNeed === null, tr ? JSON.stringify([tr.gangErrors, tr.lastGangError, tr.repNeed]) : "keine Telemetrie");
  pruefe("der echte Plan steht trotzdem (Modus locked, Plan mit Stuecken)", !!tr && tr.mode === "locked" && tr.plan.n >= 5, tr ? JSON.stringify([tr.mode, tr.plan]) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N5: The Red Pill im Angebot der Gang-Faktion (2,5 Mio) beeinflusst den Bedarf nicht --");
{
  const w = needWelt({
    geld: 600e9,
    augs: { ...AUGS_GANG, "The Red Pill": { repReq: 2.5e6, basis: 0 } },
    faktionen: {
      "Slum Snakes": { favor: 0, rep: 1.5e6, augs: [...GANG_AUGS, "The Red Pill"] },
      Bladeburners: { favor: 0, rep: 9505, augs: ["Hyperion Plasma Cannon V1"] },
    },
  });
  const r = await fahre(w);
  const tr = rnVon(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("repNeed bleibt 1.657.500 (Bionic Spine Upgrade), nicht 2.550.000", !!tr && Math.abs(tr.repNeed - 1.02 * 1625000) < 1e-6, tr ? String(tr.repNeed) : "keine Telemetrie");
  pruefe("kein Kauf, The Red Pill nicht in der Warteschlange", w.kaeufe.length === 0 && !w.warteschlange.includes("The Red Pill"), w.kaeufe.map((k) => k.a).join(", "));
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N6: ein Stueck, das eine FREMDE Faktion mit genug Ruf verkauft, treibt den Bedarf nicht --");
{
  // Bladeburners (Ruf 2 Mio) verkaufen das Spine Upgrade (1,625 Mio) SCHON jetzt, die Gang-Faktion bietet es
  // ebenfalls an (Ruf 1,5 Mio, fehlt noch). Es ist ohne Gang-Ruf kaufbar und darf den Bedarf nicht bestimmen:
  // dann bestimmt SPTN-97 (1,25 Mio) das Maximum. Gegenprobe ist N1 (Bladeburners mit 9.505 Ruf): 1.657.500.
  const w = needWelt({
    geld: 60e9,
    faktionen: {
      "Slum Snakes": { favor: 0, rep: 1.5e6, augs: GANG_AUGS },
      Bladeburners: { favor: 0, rep: 2e6, augs: ["Hyperion Plasma Cannon V1", "Graphene Bionic Spine Upgrade"] },
    },
  });
  const r = await fahre(w);
  const tr = rnVon(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("SPTN-97 (1,25 Mio) bestimmt den Bedarf, nicht das bei Bladeburners kaufbare Spine Upgrade: 1.275.000",
    !!tr && tr.repNeedAug === "SPTN-97 Gene Modification" && Math.abs(tr.repNeed - 1.02 * 1250000) < 1e-6, tr ? JSON.stringify([tr.repNeedAug, tr.repNeed]) : "keine Telemetrie");
}

// ---------------------------------------------------------------------------
console.log("\n-- P2d N7: ein Stueck einer FREMDEN Faktion ohne genug Ruf kommt nicht in den Bedarfsplan (kein Gang-Ruf macht es kaufbar) --");
{
  // Tian Di Hui (Ruf 100) bietet Photosynthetic Cells (9 Mio Ruf) an: ohne deren Ruf nicht kaufbar, und die Gang liefert
  // ihn nicht. Es darf weder Budget verbrauchen noch den Bedarf beruehren - der Plan ist derselbe wie ohne diese Faktion.
  const basis = needWelt({ geld: 60e9 });
  await fahre(basis);
  const w = needWelt({
    geld: 60e9,
    augs: { ...AUGS_GANG, "Photosynthetic Cells": { repReq: 9e6, basis: 5e9, stats: COMBAT_AUGS["Photosynthetic Cells"] } },
    faktionen: {
      "Slum Snakes": { favor: 0, rep: 1.5e6, augs: GANG_AUGS },
      Bladeburners: { favor: 0, rep: 9505, augs: ["Hyperion Plasma Cannon V1"] },
      "Tian Di Hui": { favor: 0, rep: 100, augs: ["Photosynthetic Cells"] },
    },
  });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const a = rnVon(basis), tr = rnVon(w);
  pruefe("derselbe Bedarfsplan (Stuecke, Kosten) und derselbe Bedarf wie ohne die fremde Faktion",
    !!a && !!tr && JSON.stringify(a.repNeedPlan) === JSON.stringify(tr.repNeedPlan) && a.repNeed === tr.repNeed,
    JSON.stringify([a && a.repNeedPlan, tr && tr.repNeedPlan, a && a.repNeed, tr && tr.repNeed]));
}

// ===========================================================================
// PAKET 0 (03.10.2026, Audit "vollstaendig", verify-g01-betrieb.md Abschnitt 1
// und 5, verify-g02-beide.md Abschnitt 5/7): zwei Fehlregeln, die im
// Bladeburner-Knoten mit Gang bzw. mit SF9 zuschlagen.
// ===========================================================================
// ZUSAMMENFUEHRUNG (04.10.2026, Zweig integ-gang-2026-10-04): die Hilfen dieses
// Abschnitts (AUGS_GANG, weltGang, teleVon, vollstaendig) heissen genauso wie die des
// P1-Abschnitts oben, tun aber Verschiedenes (vollstaendig() prueft hier selbst).
// Darum steht der ganze P0-Abschnitt in einem eigenen Block - innen unveraendert.
{

// ---------------------------------------------------------------------------
console.log("\n-- P0 GANG-2: The Red Pill im Bladeburner-Knoten (Gang-Faktion bietet sie an) --");
// In BN2 haengt das Spiel mit Gang The Red Pill an die Angebotsliste der
// Gang-Faktion (FactionHelpers.tsx:172-183). Preis 0, Ruf 2,5 Mio: die alte
// Kaufschleife kaufte sie in der Runde, in der der Ruf reicht - ein Stueck,
// das sich nie aus der Warteschlange holen laesst, jedes weitere um x1,9
// verteuert und (ausgangSteht) nach dem Einbau jeden weiteren Einbau sperrt.
const AUGS_GANG = {
  "The Red Pill": { repReq: 2.5e6, basis: 0 },
  "Bionic Arms": { repReq: 62.5e3, basis: 4.3e8, stats: { strength: 1.3, dexterity: 1.3 } },
  "Bionic Legs": { repReq: 75e3, basis: 3.7e8, stats: { agility: 1.6 } },
  "Bionic Spine": { repReq: 45e3, basis: 1.2e8, stats: { strength: 1.15, defense: 1.15 } },
  // Unverdient (Ruf 3 Mio < 4,5 Mio): haelt die Runde im Arbeitszweig, damit sie
  // die Telemetrie (data/bn4rep.json) erreicht - ohne offenes Stueck endet sie
  // vorher ("keine offenen Augmentierungen").
  "Graphene Bone Lacings": { repReq: 4.5e6, basis: 1.5e9, stats: { strength: 1.7, defense: 1.7 } },
  [NFG]: { repReq: 1000, basis: 1e6 },
};
// Einbau-Uhr weit zurueck, damit keine Kampf-Einbausperre (lib/endspurt.js)
// mitspielt - geprueft wird allein die Red-Pill-Regel.
const UHR_FREI = JSON.stringify({ augReset: 2, playtime: 0, fertig: 1000 });
const backupGruen = (welt) => {
  const anfrage = welt.dateien.home["data/backup-request.txt"];
  if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
  welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({
    ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
};
const weltGang = (o = {}) => baueWelt({
  host: "werk-0", knoten: 2, moneyMult: 1, geld: 50e9, einkommen: 1e6,
  faktionen: { "Slum Snakes": { favor: 0, rep: 3e6,
    augs: ["The Red Pill", "Bionic Arms"] } },
  augs: AUGS_GANG,
  installiert: Array.from({ length: 12 }, (_, i) => "Alt-" + i),
  warteschlange: [],
  fokus: true,
  dateien: { home: { "data/verfahren.txt": "V2 2 1", "data/einbau-uhr.json": UHR_FREI } },
  schlafBudget: 8,
  beiSchlaf: backupGruen,
  ...o,
});
const trpGekauft = (w) => w.kaeufe.filter((k) => k.a === "The Red Pill").length;
const FAKTION_OFFEN = () => ({ "Slum Snakes": { favor: 0, rep: 3e6,
  augs: ["The Red Pill", "Bionic Arms", "Graphene Bone Lacings"] } });
const teleVon = (w) => {
  try { return JSON.parse(w.dateien.home["data/bn4rep.json"] || "null"); } catch { return null; }
};
const vollstaendig = (r) => pruefe("Nachbau vollstaendig (kein echter Rundenfehler)",
  rundenfehler(r.log).length === 0 && r.ende !== "fehler",
  rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300));
{
  // S1: V2 in Knoten 2, Ruf 3 Mio -> kein Red-Pill-Kauf. Bionic Arms steht im
  // selben Angebot und MUSS gekauft werden: sonst koennte das Szenario nur
  // gruen sein, weil die Runde die Kaufschleife nie erreicht.
  const w = weltGang({ faktionen: FAKTION_OFFEN() });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S1: V2 'V2 2 1': Bionic Arms gekauft (die Kaufschleife lief)",
    w.kaeufe.some((k) => k.a === "Bionic Arms"), JSON.stringify(w.kaeufe.map((k) => k.a)));
  pruefe("S1: V2 'V2 2 1', Ruf 3 Mio: KEIN Kauf von The Red Pill", trpGekauft(w) === 0,
    JSON.stringify(w.kaeufe.map((k) => k.a)));
  const tele = teleVon(w);
  pruefe("S1: Telemetrie nennt v1Positiv false und v1LeseFehler 0 (fuer die Abnahme von aussen)",
    !!tele && tele.v1Positiv === false && tele.v1LeseFehler === 0, JSON.stringify(tele && {
      v1Positiv: tele.v1Positiv, v1LeseFehler: tele.v1LeseFehler }));
}
{
  // S4: die Lesung der Marke WIRFT (ns.fileExists wirft). Zweifel = kein Red
  // Pill, und der Fehler wird gezaehlt und gemeldet statt verschluckt.
  const w = weltGang({ markeWirft: true, faktionen: FAKTION_OFFEN(), schlafBudget: 8 });
  const r = await fahre(w);
  vollstaendig(r);
  const tele = teleVon(w);
  pruefe("S4: Marke nicht lesbar: KEIN Kauf von The Red Pill", trpGekauft(w) === 0,
    JSON.stringify(w.kaeufe.map((k) => k.a)));
  pruefe("S4: Marke nicht lesbar: v1LeseFehler steht in der Telemetrie (>= 1) und v1Positiv ist false",
    !!tele && tele.v1LeseFehler >= 1 && tele.v1Positiv === false,
    JSON.stringify(tele && { v1Positiv: tele.v1Positiv, v1LeseFehler: tele.v1LeseFehler })
      + " Ende " + r.ende + " " + r.fehlerText.slice(0, 120));
  pruefe("S4: der Lesefehler steht im Log (nicht still)", r.log.includes("V1-Nachweis nicht lesbar"),
    r.log.slice(0, 200));
}
{
  // S2: dieselbe Lage OHNE data/verfahren.txt. Die alte Filterung
  // (`nurKampfStuecke`) schaltet sich dann AUS (catch -> false) - ein Fix nur
  // in lib/hackaugs.js (kampfknotenNuetzlich) liesse TRP hier durch. Zweifel
  // heisst: kein Red Pill.
  const w = weltGang({ dateien: { home: { "data/einbau-uhr.json": UHR_FREI } } });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S2: ohne verfahren.txt: Bionic Arms gekauft (die Kaufschleife lief)",
    w.kaeufe.some((k) => k.a === "Bionic Arms"), JSON.stringify(w.kaeufe.map((k) => k.a)));
  pruefe("S2: ohne verfahren.txt: KEIN Kauf von The Red Pill", trpGekauft(w) === 0,
    JSON.stringify(w.kaeufe.map((k) => k.a)));
}
{
  // S2b: die Datei stammt aus dem VORIGEN Knoten (boot.js loescht sie absichtlich
  // nicht, lib/reg.js:21-34): "V1 5 2" in Knoten 2 ist kein positiver Nachweis.
  const w = weltGang({ dateien: { home: { "data/verfahren.txt": "V1 5 2",
    "data/einbau-uhr.json": UHR_FREI } } });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S2b: 'V1 5 2' in Knoten 2 (fremder Knoten): KEIN Kauf von The Red Pill",
    trpGekauft(w) === 0, JSON.stringify(w.kaeufe.map((k) => k.a)));
}
{
  // S2c: V2-Marke, aber unlesbarer Rest - und die Marke "V10" darf nicht als
  // "beginnt mit V1" durchgehen.
  const w = weltGang({ dateien: { home: { "data/verfahren.txt": "V10 2 1",
    "data/einbau-uhr.json": UHR_FREI } } });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S2c: Marke 'V10 2 1' ist kein V1: KEIN Kauf von The Red Pill",
    trpGekauft(w) === 0, JSON.stringify(w.kaeufe.map((k) => k.a)));
}
{
  // S3: The Red Pill steckt schon im Spielstand (Handkauf oder alte Fassung),
  // V2, Sperre offen, drei Kampfstuecke warten. Die Dauersperre `ausgangSteht`
  // (nur im Hackingweg sinnvoll, dort baut bn4rep nach dem Ausgangsstueck nie
  // mehr ein) darf den Einbau im V2 nicht mehr verhindern.
  const w = weltGang({
    geld: 5e9,
    faktionen: { "Slum Snakes": { favor: 0, rep: 3e6,
      augs: ["The Red Pill", "Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
    installiert: ["The Red Pill", ...Array.from({ length: 11 }, (_, i) => "Alt-" + i)],
    warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
    skills: { hacking: 400 },
    schlafBudget: 60,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S3: V2, Red Pill eingebaut, 3 Kampfstuecke warten: Einbau findet statt",
    w.installAufrufe === 1 && r.ende === "return",
    "install " + w.installAufrufe + ", Ende " + r.ende);
}
{
  // S3b: die Zwangsregel `redPillWartet` (Einbau unabhaengig von der
  // Mindestwarteschlange) darf im V2 nicht greifen: Red Pill + EIN Kampfstueck
  // = 2 Stuecke < 3. Ein Handkauf von TRP sperrt sonst das Mindestmass, das die
  // Regel vom 28.08.2026 (Einbau kostet im Kampfknoten Stunden) erzwingt.
  const w = weltGang({
    geld: 5e9,
    faktionen: { "Slum Snakes": { favor: 0, rep: 3e6,
      augs: ["The Red Pill", "Bionic Arms"] } },
    warteschlange: ["The Red Pill", "Bionic Arms"],
    skills: { hacking: 400 },
    schlafBudget: 30,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S3b: V2, Red Pill WARTET (2 Stuecke < 3): kein Zwangseinbau",
    w.installAufrufe === 0, "install " + w.installAufrufe);
}
{
  // S3c: der Daedalus-Fuellstueck-Pfad (H2, kurz vor dem Einbau, wenn der
  // Einbau bei Schwelle-1 Stuecken landen wuerde) sammelt seine Kandidaten
  // selbst - und waehlt das BILLIGSTE kaufbare. The Red Pill kostet 0. Auch
  // dieser zweite Kaufpfad darf im V2 kein TRP kaufen.
  const w = weltGang({
    geld: 5e9,
    faktionen: { "Slum Snakes": { favor: 0, rep: 3e6,
      augs: ["The Red Pill", "Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
    installiert: Array.from({ length: 26 }, (_, i) => "Alt-" + i),
    warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
    skills: { hacking: 400 },
    schlafBudget: 60,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("S3c: V2, Einbau bei 26+3 = 29 von 30 (Fuellstueck-Pfad): KEIN Kauf von The Red Pill",
    trpGekauft(w) === 0, JSON.stringify(w.kaeufe.map((k) => k.a)));
  pruefe("S3c: der Einbau lief (der Fuellstueck-Block wurde ueberhaupt erreicht)",
    w.installAufrufe === 1 && r.ende === "return", "install " + w.installAufrufe + ", Ende " + r.ende);
}
for (const [marke, knoten] of [["V1 5 2", 5], ["V1b 15 1", 15], ["V1 2 1", 2]]) {
  // Gegenprobe: im Hackingweg (V1/V1b, Knoten stimmt) bleibt The Red Pill ein
  // Kaufkandidat. Ohne diese Probe waere "nie kaufen" ebenfalls gruen.
  const w = baueWelt({
    host: "werk-0", knoten, moneyMult: 1, geld: 5e9, einkommen: 1e6,
    faktionen: { Daedalus: { favor: 150, rep: 3e6, augs: ["The Red Pill"] } },
    augs: { "The Red Pill": { repReq: 2.5e6, basis: 0 } },
    installiert: Array.from({ length: 30 }, (_, i) => "Alt-" + i),
    warteschlange: [],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    dateien: { home: { "data/verfahren.txt": marke, "data/company-order.txt": "off" } },
    schlafBudget: 6,
    beiSchlaf: backupGruen,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("Gegenprobe '" + marke + "' in Knoten " + knoten + ": The Red Pill wird gekauft",
    trpGekauft(w) === 1, JSON.stringify(w.kaeufe.map((k) => k.a)));
}
{
  // S5: Telemetrie im Hackingweg: v1Positiv true. Der Ruf (1 Mio) reicht fuer
  // The Red Pill noch nicht - das offene Stueck haelt die Runde im
  // Arbeitszweig, der die Telemetrie schreibt.
  const w = baueWelt({
    host: "werk-0", knoten: 5, moneyMult: 1, geld: 5e9, einkommen: 1e6,
    faktionen: { Daedalus: { favor: 150, rep: 1e6, augs: ["The Red Pill"] } },
    augs: { "The Red Pill": { repReq: 2.5e6, basis: 0 } },
    installiert: Array.from({ length: 30 }, (_, i) => "Alt-" + i),
    warteschlange: [],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    dateien: { home: { "data/verfahren.txt": "V1 5 2", "data/company-order.txt": "off" } },
    schlafBudget: 6,
  });
  const r = await fahre(w);
  vollstaendig(r);
  const tele = teleVon(w);
  pruefe("S5: V1 'V1 5 2' in Knoten 5: Telemetrie nennt v1Positiv true und v1LeseFehler 0",
    !!tele && tele.v1Positiv === true && tele.v1LeseFehler === 0,
    JSON.stringify(tele && { v1Positiv: tele.v1Positiv, v1LeseFehler: tele.v1LeseFehler }));
}
{
  // Gegenprobe zum Ausgang: V1, Red Pill eingebaut, Hacking unter dem Ziel ->
  // die Dauersperre gilt weiter (kein Einbau), obwohl wartend >= 3.
  const w = baueWelt({
    host: "werk-0", knoten: 5, moneyMult: 1, geld: 5e9, einkommen: 1e6,
    faktionen: { Daedalus: { favor: 150, rep: 3e6, augs: ["Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
    augs: AUGS_GANG,
    installiert: ["The Red Pill", ...Array.from({ length: 30 }, (_, i) => "Alt-" + i)],
    warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
    arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
    fokus: true,
    skills: { hacking: 400 },
    dateien: { home: { "data/verfahren.txt": "V1 5 2", "data/company-order.txt": "off" } },
    schlafBudget: 40,
    beiSchlaf: backupGruen,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("Gegenprobe V1 + Red Pill eingebaut: ausgangSteht sperrt jeden weiteren Einbau",
    w.installAufrufe === 0, "install " + w.installAufrufe);
}
{
  // S6 (Skeptiker-Auflage zu GANG-2, 03.10.2026): die Dauersperre `ausgangSteht`
  // wird nur mit POSITIVEM V2-Nachweis geloest, nie "im Zweifel". The Red Pill
  // eingebaut + drei Kampfstuecke warten, Kampfwerte 1000, Einbau-Uhr frei,
  // imBladeburner true (das sind die Tore, die den Einbau sonst von selbst
  // abfangen koennten - sie sind hier ALLE offen, damit allein die Sperre
  // zaehlt). Fehlt die Marke, ist sie leer, nennt sie einen fremden Knoten oder
  // ein unbekanntes Kuerzel, dann kann es der Hackingweg sein, und ein Einbau
  // dort wirft die Hacking-Erfahrung auf Level 1 zurueck - nicht umkehrbar.
  const weltTrpEingebaut = (marke) => weltGang({
    knoten: 5,
    geld: 5e9,
    faktionen: { "Slum Snakes": { favor: 0, rep: 3e6,
      augs: ["The Red Pill", "Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
    installiert: ["The Red Pill", ...Array.from({ length: 11 }, (_, i) => "Alt-" + i)],
    warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
    skills: { hacking: 400 },
    imBladeburner: true,
    dateien: { home: marke === null
      ? { "data/einbau-uhr.json": UHR_FREI }
      : { "data/verfahren.txt": marke, "data/einbau-uhr.json": UHR_FREI } },
    schlafBudget: 60,
  });
  // Kontrolle: mit positivem V2-Nachweis (richtiger Knoten) laeuft derselbe
  // Aufbau in den Einbau. Ohne diese Probe waere "0 Einbauten" unten auch dann
  // gruen, wenn die Runde den Einbau-Zweig nie erreicht.
  {
    const w = weltTrpEingebaut("V2 5 1");
    const r = await fahre(w);
    vollstaendig(r);
    pruefe("S6 Kontrolle: Marke 'V2 5 1' in Knoten 5, Red Pill eingebaut, 3 Kampfstuecke: Einbau findet statt",
      w.installAufrufe === 1 && r.ende === "return",
      "install " + w.installAufrufe + ", Ende " + r.ende);
  }
  for (const [marke, was] of [
    [null, "Marke fehlt"],
    ["", "Marke leer"],
    ["V1 4 2", "fremder Knoten (V1 4 2 in Knoten 5)"],
    ["V1c 5 2", "unbekanntes Kuerzel (V1c)"],
    ["V2 4 1", "V2-Marke eines fremden Knotens"],
    ["V1 5 2", "V1-Marke des eigenen Knotens"],
  ]) {
    const w = weltTrpEingebaut(marke);
    const r = await fahre(w);
    vollstaendig(r);
    pruefe("S6: Red Pill eingebaut, 3 Kampfstuecke warten, " + was + ": KEIN Einbau",
      w.installAufrufe === 0, "install " + w.installAufrufe + ", Ende " + r.ende);
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- P0 G02: Hacknet-Stuecke nur dort, wo nach dem Einbau Hacknet-Server gekauft werden --");
// Die Hacknet-Augs wirken erst NACH dem Einbau, und der Einbau loescht alle
// Hacknet-Server (PlayerObjectGeneralMethods.ts:130-131). Den SF9.3-Gratisserver
// gibt es nur beim Knotenwechsel (Prestige.ts:327-339); neu gekauft wird nur in
// BN9 (src/hacknet.js). Die alte Regel `mitHashes` = "SF9 vorhanden" kaufte die
// vier Stuecke in jedem V2-Knoten (BN2.1: 8,92 Mrd, 43,7 % der Aug-Ausgaben).
const NIC = "Hacknet Node NIC Architecture Neural-Upload";
const AUGS_HASH = {
  [NIC]: { repReq: 3.75e3, basis: 4.5e6 },
  "Bionic Arms": { repReq: 62.5e3, basis: 4.3e8, stats: { strength: 1.3, dexterity: 1.3 } },
  [NFG]: { repReq: 1000, basis: 1e6 },
};
for (const [knoten, erwartet] of [[2, false], [3, false], [11, false], [15, false], [9, true]]) {
  const w = baueWelt({
    host: "werk-0", knoten, moneyMult: 1, geld: 50e9, einkommen: 1e6,
    // SF9 ist in ALLEN Faellen da - nur der Knoten soll entscheiden.
    ownedSF: [[4, 3], [5, 1], [9, 3]],
    faktionen: { Netburners: { favor: 0, rep: 50e3, augs: [NIC] },
      "Slum Snakes": { favor: 0, rep: 70e3, augs: ["Bionic Arms"] } },
    augs: AUGS_HASH,
    installiert: Array.from({ length: 12 }, (_, i) => "Alt-" + i),
    warteschlange: [],
    fokus: true,
    dateien: { home: { "data/verfahren.txt": "V2 " + knoten + " 1", "data/einbau-uhr.json": UHR_FREI } },
    schlafBudget: 8,
    beiSchlaf: backupGruen,
  });
  const r = await fahre(w);
  vollstaendig(r);
  pruefe("G02 Knoten " + knoten + " (SF9.3 da): Bionic Arms gekauft (die Kaufschleife lief)",
    w.kaeufe.some((k) => k.a === "Bionic Arms"), JSON.stringify(w.kaeufe.map((k) => k.a)));
  const nic = w.kaeufe.filter((k) => k.a === NIC).length;
  pruefe("G02 Knoten " + knoten + " (SF9.3 da): Hacknet-Stueck " + (erwartet ? "WIRD" : "wird NICHT") + " gekauft",
    (nic === 1) === erwartet, "Hacknet-Kaeufe: " + nic + " " + JSON.stringify(w.kaeufe.map((k) => k.a)));
}
}

// ===========================================================================
// ZUSAMMENFUEHRUNG P0 + P1 + P2 (04.10.2026, Zweig integ-gang-2026-10-04):
// DER VERTRAG ZWISCHEN bn4rep.js UND gang.js ZUR LAUFZEIT
// ===========================================================================
//
// gang.js gruendet erst, wenn data/bn4rep.json "v1Positiv: false" (Paket 0) und
// "gateBuy: true" (Paket 1) meldet, frisch ist und zum Knoteneintritt gehoert
// (checkPrereq). test-gang.js prueft dafuer nur die QUELLE von bn4rep.js. Hier
// laeuft die vereinte bn4rep.js wirklich, und ihre geschriebene Telemetrie geht
// durch dieselbe Pruefung - Feldnamen, Typen, Frische und Knoteneintritt.
console.log("\n-- Z1 Vertrag bn4rep.js -> gang.js: die echte Telemetrie besteht die Voraussetzungssperre --");
{
  const GANG = await ladeSpielskript(path.join(SRC, "gang.js"));
  const reset = { currentNode: 2, lastNodeReset: 1 };   // wie getResetInfo() des Nachbaus
  // Ein Kampfknoten ohne Gang (V2-Marke), wie vor der Gruendung: kaufen laeuft in der
  // alten Schleife, aber die Telemetrie muss die Sperre schon jetzt freigeben.
  const w = weltGang({ gang: { da: false }, schlafBudget: 4,
    dateien: { home: dGang({ "data/einbau-uhr.json": einbauUhrJung() }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const t = teleVon(w);
  pruefe("die Runde schreibt data/bn4rep.json", !!t);
  pruefe("Paket 0: v1Positiv ist ein Boolean und false (V2-Marke -> The Red Pill kein Kandidat)",
    !!t && t.v1Positiv === false, t ? String(t.v1Positiv) : "keine Telemetrie");
  pruefe("Paket 1: gateBuy ist true (der Kaufaufschub steckt in dieser Fassung)",
    !!t && t.gateBuy === true, t ? String(t.gateBuy) : "keine Telemetrie");
  pruefe("knoten, nodeReset und zeit stehen drin (Knoteneintritt und Frische)",
    !!t && t.knoten === 2 && t.nodeReset === 1 && Number.isFinite(t.zeit), t ? JSON.stringify([t.knoten, t.nodeReset, t.zeit]) : "-");
  const urteil = t ? GANG.checkPrereq(t, t.zeit + 5000, reset) : { ok: false, missing: ["keine Telemetrie"] };
  pruefe("gang.js checkPrereq: ok mit der echten Telemetrie von bn4rep.js",
    urteil.ok === true, urteil.missing.join(" | "));
  // Gegenprobe: dieselbe Telemetrie in einem V1-Knoten (Marke V1 fuer diesen Knoten) -> die Sperre MUSS zu sein.
  const w1 = weltGang({ gang: { da: false }, schlafBudget: 4,
    // Einbausperre, damit die Runde die Telemetrie erreicht (sonst baut der V1-Knoten ein und
    // die Runde endet vorher mit `continue`).
    dateien: { home: dGang({ "data/verfahren.txt": "V1 2 1", "data/einbau-uhr.json": einbauUhrJung(),
      "data/install-sperre.txt": JSON.stringify({ ts: 1_790_442_188_000, reason: "test", bis: 1_790_442_188_000 + 10 * 3600000 }) }) } });
  const r1 = await fahre(w1);
  const t1 = teleVon(w1);
  pruefe("Gegenprobe V1-Marke: v1Positiv true -> checkPrereq sperrt (The Red Pill waere Kaufkandidat)",
    !!t1 && t1.v1Positiv === true && GANG.checkPrereq(t1, t1.zeit + 5000, reset).ok === false,
    vollHinweis(r1) + " " + (t1 ? String(t1.v1Positiv) : "keine Telemetrie"));
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
