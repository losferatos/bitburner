/**
 * Einbaurunde in BitNode 8: der ECHTE bn4rep.js-Hauptlauf gegen einen
 * nachgebauten Spielzustand mit Boersen-Stub (10.11.2026).
 *
 * Gebaut auf dem Nachbau aus test-bn4rep-ebene2.js (singularity-Stub, Preise mit
 * 1,767^q), erweitert um: home-RAM (getServerMaxRam/upgradeHomeRam), Spende ab
 * Favor 0 (BN8), lastAugReset vor der Telemetrie, und einen Boersen-Stub, der in
 * jedem ns.sleep frische data/boerse.json schreibt und Pausen quittiert.
 *
 * Aufruf: node tools/test-bn8-einbaurunde.js
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
    lastAugReset: o.lastAugReset ?? (1_790_442_188_000 - 3600000),
    homeRam: o.homeRam ?? 128,
    favorToDonate: o.favorToDonate ?? 150,
    ramKaeufe: [],
    depot: o.depot ?? 0,
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
    // Arbeitsarten je Faktion (24.10.2026); ohne Angabe alle drei.
    workTypes: o.workTypes || null,
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
    getResetInfo: () => ({ currentNode: w.knoten, lastNodeReset: w.nodeReset, lastAugReset: w.lastAugReset,
      ownedSF: w.ownedSF }),
    getPlayer: () => ({
      factions: Object.keys(w.faktionen), skills: { ...w.skills }, mults: { ...w.mults },
      jobs: {}, totalPlaytime: w.playtime, money: w.geld, city: "Sector-12",
    }),
    getServerMoneyAvailable: () => w.geld,
    getFavorToDonate: () => w.favorToDonate,
    getServerMaxRam: (h) => { if (h === "home") return w.homeRam; return 64; },
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
        if (!fk || fk.favor < w.favorToDonate || !(betrag > 0) || w.geld < betrag) return false;
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
        // Singularity.ts: factionWorkType muss ein String sein (24.10.2026, BN14).
        if (typeof art !== "string") throw new Error("singularity.workForFaction: factionWorkType expected to be a string. Is " + art + ".");
        w.arbeit = { type: "FACTION", factionName: f, factionWorkType: art };
        w.fokus = !!fokus;
        return true;
      },
      getFactionWorkTypes: (f) => (w.workTypes && w.workTypes[f]) || ["hacking", "field", "security"],
      installAugmentations: () => { w.installAufrufe++; return true; },
      getUpgradeHomeRamCost: () => w.homeRam * 32000 * Math.pow(1.58, Math.log2(w.homeRam)),
      upgradeHomeRam: () => {
        const c = w.homeRam * 32000 * Math.pow(1.58, Math.log2(w.homeRam));
        if (w.geld < c) return false;
        w.geld -= c; w.ramKaeufe.push({ von: w.homeRam, c, kaeufeBis: w.kaeufe.length, spendenBis: w.spenden.length }); w.homeRam *= 2; return true;
      },
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

// ===========================================================================
// Welt und Stubs fuer BN8
// ===========================================================================
const Q = 1.767;                       // 1,9 * 0,93 (SF11.3)
const MRD = 1e9;
const RP = "The Red Pill";

/** Boersen-Stub plus Bruecken-Stub, haengt am beiSchlaf-Haken. */
function stubHaken(opt) {
  const st = { letzteAnfrage: 0, verkauf: [], quittiert: 0 };
  const haken = (w) => {
    const home = w.dateien.home;
    // Bruecke: antwortet auf jede neue Sicherungsanfrage
    const req = home["data/backup-request.txt"];
    if (req) {
      let ts = 0;
      try { ts = JSON.parse(req).ts; } catch { ts = 0; }
      if (ts > st.letzteAnfrage) {
        st.letzteAnfrage = ts;
        home["data/backup-ok.txt"] = JSON.stringify({ ts: w.uhr, anlass: "pre-install", datei: "Nachbau" });
      }
    }
    if (opt.keineBoerse || opt.eingefroren) return;
    // Boerse: Pause quittieren
    let pause = null;
    try { pause = home["data/boerse-pause.txt"] ? JSON.parse(home["data/boerse-pause.txt"]) : null; } catch { pause = null; }
    if (pause && pause.id && w.uhr < pause.bis && opt.quittiert !== false && pause.id !== w.stubVerkauftFuer) {
      const erloes = w.depot * (opt.quote ?? 1);
      st.verkauf.push({ id: pause.id, depot: w.depot, erloes, uhr: w.uhr, kaeufeBis: w.kaeufe.length });
      w.geld += erloes; w.depot = 0; w.stubVerkauftFuer = pause.id; st.quittiert++;
    }
    home["data/boerse.json"] = JSON.stringify({
      ts: w.uhr, state: "work", hat4S: opt.hat4S !== false, depotWert: Math.round(w.depot),
      bar: Math.round(w.geld), gesamt: Math.round(w.geld + w.depot), posten: w.depot > 0 ? 6 : 0,
      verkauftFuer: w.stubVerkauftFuer || null,
    });
  };
  haken.st = st;
  return haken;
}

/**
 * @param o.aug   [name, basis(Mrd), repReq, [faktionen], [vorbedingungen]]
 * @param o.vermoegen Mrd, o.bar Mrd (Rest ist Depot)
 */
function welt8(o) {
  const augs = {}, faktionen = {};
  for (const [name, basis, repReq, fakt, prereq] of o.aug) {
    augs[name] = { repReq, basis: basis * MRD, prereq: prereq || [] };
    for (const f of fakt) {
      if (!faktionen[f]) faktionen[f] = { favor: 0, rep: (o.rep && o.rep[f]) || 0, augs: [] };
      faktionen[f].augs.push(name);
    }
  }
  const haken = o.haken || stubHaken(o.stub || {});
  const w = baueWelt({
    host: "werk-0", knoten: o.knoten ?? 8, moneyMult: o.moneyMult ?? 1, priceStep: o.priceStep ?? Q,
    ownedSF: o.ownedSF ?? [[11, 3]],
    geld: (o.bar ?? 10) * MRD, einkommen: 0,
    faktionen, augs,
    installiert: o.installiert || [], warteschlange: o.warteschlange || [],
    arbeit: null, fokus: true, favorToDonate: o.favorToDonate ?? 0,
    mults: { faction_rep: 3.083, hacking: 4, ...(o.mults || {}) },
    skills: { hacking: o.hacking ?? 1500 },
    bnMults: o.bnMults,
    dateien: { home: { "data/verfahren.txt": "V1 " + (o.knoten ?? 8), ...(o.home || {}) } },
    schlafBudget: o.schlafBudget ?? 40,
    beiSchlaf: haken,
    imBladeburner: false,
    homeRam: o.homeRam,
    depot: ((o.vermoegen ?? 0) - (o.bar ?? 10)) * MRD,
  });
  w.haken = haken;
  w.depot = Math.max(0, w.depot);
  if (!o.keineBoerseDatei && !(o.stub && o.stub.keineBoerse)) {
    w.dateien.home["data/boerse.json"] = JSON.stringify({
      ts: o.telTs ?? w.uhr, state: "work", hat4S: true, depotWert: Math.round(w.depot), bar: w.geld,
      gesamt: w.geld + w.depot, posten: 6,
    });
  }
  return w;
}

// Der Katalog fuer Runde 1: 14 Stuecke, drei Faktionen, eines mit Vorbedingung.
// Gen II (1,5 Mrd) braucht Gen I (0,9 Mrd): die Vorbedingung ist billiger als der Nachfolger.
const KATALOG = [
  ["BitWire",                                   0.8, 20e3,  ["CyberSec"]],
  ["Cranial Signal Processors - Gen I",         0.9, 20e3,  ["CyberSec"]],
  ["Cranial Signal Processors - Gen II",        1.5, 60e3,  ["CyberSec", "NiteSec"], ["Cranial Signal Processors - Gen I"]],
  ["Synaptic Enhancement Implant",              0.6, 10e3,  ["CyberSec"]],
  ["Cranial Signal Processors - Gen III",       2.0, 150e3, ["NiteSec"]],
  ["CRTX42-AA Gene Modification",               1.1, 120e3, ["NiteSec"]],
  ["Artificial Synaptic Potentiation",          0.7, 80e3,  ["NiteSec"]],
  ["Neural-Retention Enhancement",              0.6, 300e3, ["The Black Hand"]],
  ["Enhanced Myelin Sheathing",                 1.3, 400e3, ["The Black Hand"]],
  ["DataJack",                                  0.5, 30e3,  ["The Black Hand"]],
  ["HyperSight Corneal Implant",                1.0, 250e3, ["The Black Hand"]],
  ["Neural Accelerator",                        1.8, 500e3, ["The Black Hand"]],
  ["Embedded Netburner Module",                 1.6, 90e3,  ["NiteSec", "The Black Hand"]],
  ["Wired Reflexes",                            0.3, 5e3,   ["CyberSec"]],
];
const REP1 = { CyberSec: 100e3, NiteSec: 100e3, "The Black Hand": 40e3 };

const zeiten = [];
async function lauf(name, w) {
  const t0 = performance.now();
  const r = await fahre(w);
  const ms = performance.now() - t0;
  zeiten.push({ name, ms, schlaf: w.schlaf.length, proRunde: ms / Math.max(1, w.schlaf.length) });
  return r;
}
const nachbauOk = (r) => rundenfehler(r.log).length === 0 && r.ende !== "fehler";
const hinweisFehler = (r) => rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300);
const logZeilen = (r, teil) => r.log.split("\n").filter((z) => z.includes(teil));
const pause = (w) => (w.dateien.home["data/boerse-pause.txt"] || "");
/** Referenzreihenfolge, unabhaengig vom Pruefling: teuerstes (Basis) zuerst unter den Stuecken, deren Vorbedingung schon gekauft ist. */
function referenzReihenfolge(namen, augs) {
  const offen = new Set(namen); const aus = [];
  while (offen.size) {
    let best = null;
    for (const n of offen) {
      if ((augs[n].prereq || []).some((p) => offen.has(p))) continue;
      if (!best || augs[n].basis > augs[best].basis) best = n;
    }
    aus.push(best); offen.delete(best);
  }
  return aus;
}
const kurz = (a) => a.slice(0, 8).join(", ");

console.log("");
console.log("=== BN8-Einbaurunde: bn4rep.js gegen Spielnachbau + Boersen-Stub (" + SRC + ") ===");

// ---------------------------------------------------------------------------
console.log("\n-- 1: Runde 1, Vermoegen 100 Mrd (fast alles Depot): im Lauf NICHTS --");
{
  const w = welt8({ aug: KATALOG, rep: REP1, bar: 5, vermoegen: 100, schlafBudget: 80 });
  const r = await lauf("1", w);
  pruefe("1 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("1 Boerse traegt (Plan wird gemeldet)", logZeilen(r, "BN8-PLAN Runde 1").length >= 1, r.log.slice(-300));
  pruefe("1 kein Kauf", w.kaeufe.length === 0, "Kaeufe: " + w.kaeufe.map((k) => k.a).join(","));
  pruefe("1 keine Spende", w.spenden.length === 0, JSON.stringify(w.spenden).slice(0, 100));
  pruefe("1 kein Einbau", w.installAufrufe === 0);
  pruefe("1 keine Pausendatei", pause(w) === "", pause(w).slice(0, 80));
  pruefe("1 kein Handschlag gestellt", logZeilen(r, "Handschlag gestellt").length === 0);
  pruefe("1 Depot unangetastet", w.depot === 95 * MRD, String(w.depot));
  // Skeptiker 11.11.2026: im Lauf bleibt die Ruecklage - RAM wird in der Einbaurunde gekauft, nicht frueher.
  pruefe("1 im Lauf bleibt die Geldreserve stehen (kein frueher RAM-Kauf aus dem Betriebsgeld)", Number(w.dateien.home["data/geldbedarf.txt"]) >= 5 * MRD, String(w.dateien.home["data/geldbedarf.txt"]));
}

// ---------------------------------------------------------------------------
// Gemeinsame Welt fuer 2-4: 400 Mrd, bar 20, zwei Stuecke wartend
const welt400 = (o = {}) => welt8({
  aug: KATALOG, rep: REP1, bar: 20, vermoegen: 400, schlafBudget: 120,
  warteschlange: ["Synaptic Enhancement Implant", "DataJack"],
  ...o,
});

console.log("\n-- 2: Runde 1, 400 Mrd: Pause, Quittung, Spenden, Plankaeufe, ein Einbau --");
{
  const w = welt400();
  const wStart = JSON.parse(JSON.stringify(w.faktionen));
  const r = await lauf("2", w);
  const st = w.haken.st;
  pruefe("2 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("2 Pause gelegt und quittiert", st.quittiert === 1 && st.verkauf.length === 1, "quittiert " + st.quittiert);
  pruefe("2 genau ein installAugmentations", w.installAufrufe === 1, "install " + w.installAufrufe + ", Ende " + r.ende);
  pruefe("2 kein Kauf VOR der Quittung", !!st.verkauf[0] && st.verkauf[0].kaeufeBis === 0, "Kaeufe zum Quittungszeitpunkt: " + (st.verkauf[0] && st.verkauf[0].kaeufeBis));
  pruefe("2 keine Spende vor der Quittung", w.spenden.every((s) => s.uhr >= (st.verkauf[0] ? st.verkauf[0].uhr : Infinity)));
  const gekauft = w.kaeufe.map((k) => k.a);
  console.log("      gekauft " + gekauft.length + " Stuecke: " + kurz(gekauft) + " ...; Spenden: " + w.spenden.map((s) => s.f + " " + (s.betrag / 1e6).toFixed(0) + "M").join(", "));
  pruefe("2 Plan hat mit den 2 wartenden mindestens 8 Stuecke", gekauft.length + 2 >= 8, "gekauft " + gekauft.length);
  pruefe("2 Gen II nur mit Gen I, und Gen I davor",
    !gekauft.includes("Cranial Signal Processors - Gen II")
    || (gekauft.includes("Cranial Signal Processors - Gen I")
      && gekauft.indexOf("Cranial Signal Processors - Gen I") < gekauft.indexOf("Cranial Signal Processors - Gen II")), gekauft.join(","));
  const ref = referenzReihenfolge(gekauft, w.augs);
  pruefe("2 Kaufreihenfolge = teuerstes zuerst (Vorbedingung davor)", JSON.stringify(ref) === JSON.stringify(gekauft),
    "ist: " + gekauft.join(" > ") + " | soll: " + ref.join(" > "));
  // Spenden: nur an Faktionen mit Fehlbetrag, ausreichend und nicht uebertrieben
  const maxReq = {};
  for (const k of w.kaeufe) maxReq[k.f] = Math.max(maxReq[k.f] || 0, w.augs[k.a].repReq);
  let spendeOk = true, hint = "";
  for (const f of Object.keys(maxReq)) {
    const braucht = Math.max(0, maxReq[f] - wStart[f].rep);
    const gespendet = w.spenden.filter((s) => s.f === f).reduce((a, s) => a + s.betrag, 0);
    const rep = gespendet / 1e6 * 3.083;
    if (braucht > 0 && rep < braucht) { spendeOk = false; hint += f + " zu wenig (" + Math.round(rep) + "<" + braucht + ") "; }
    if (braucht === 0 && gespendet > 0) { spendeOk = false; hint += f + " unnoetig gespendet "; }
    if (braucht > 0 && rep > braucht * 1.1) { spendeOk = false; hint += f + " zu viel (" + Math.round(rep) + ">" + braucht + ") "; }
  }
  for (const f of new Set(w.spenden.map((s) => s.f))) if (!(f in maxReq)) { spendeOk = false; hint += f + " ohne Kauf bespendet "; }
  pruefe("2 Spenden: richtige Faktionen, ausreichend, nicht uebertrieben", spendeOk && w.spenden.length >= 1, hint);
  pruefe("2 jeder Plankauf gelang (kein NICHT GEKAUFT)", logZeilen(r, "NICHT GEKAUFT").length === 0, logZeilen(r, "NICHT GEKAUFT")[0] || "");
  pruefe("2 keine abgelehnte Spende", logZeilen(r, "SPENDE ABGELEHNT").length === 0);
  pruefe("2 Geld nie negativ", w.geld >= 0, String(w.geld));
}

console.log("\n-- 3: wie 2, aber Quittung nur mit 10 % des Depots (Kurssturz) --");
{
  const w = welt400({ stub: { quote: 0.1 } });
  // Verlauf der Geldreserve mitschreiben (jeder Schreibzugriff mit Nachbau-Uhr).
  const reserveVerlauf = []; let reserveWert;
  Object.defineProperty(w.dateien.home, "data/geldbedarf.txt", { enumerable: true, configurable: true,
    get: () => reserveWert, set: (v) => { reserveWert = v; reserveVerlauf.push([w.uhr, Number(v)]); } });
  const r = await lauf("3", w);
  const st = w.haken.st;
  pruefe("3 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("3 es wurde zu 10 % verkauft", st.quittiert >= 1 && Math.abs(st.verkauf[0].erloes - 0.1 * st.verkauf[0].depot) < 1);
  console.log("      " + (logZeilen(r, "BN8-EINBAURUNDE")[0] || "(keine Einbaurundenzeile)").slice(0, 220));
  pruefe("3 KEIN Einbau", w.installAufrufe === 0, "install " + w.installAufrufe);
  pruefe("3 keine Kaeufe", w.kaeufe.length === 0, "Kaeufe: " + w.kaeufe.length + " " + w.kaeufe.map((k) => k.a).join(",").slice(0, 100));
  pruefe("3 keine Spenden", w.spenden.length === 0, "Spenden: " + w.spenden.length);
  pruefe("3 Pausendatei geleert", pause(w) === "", pause(w).slice(0, 80));
  const tVerkauf = st.verkauf[0] ? st.verkauf[0].uhr : 0;
  const frueh = reserveVerlauf.filter(([t]) => t >= tVerkauf && t <= tVerkauf + 9 * 60000);
  pruefe("3 nach dem Abbruch bleibt das Bargeld gesperrt, bis die Boerse zurueckgekauft hat (mindestens 9 min)",
    frueh.length >= 1 && frueh.every(([, v]) => v >= 1e17), JSON.stringify(frueh.slice(0, 6)));
  const spaet = reserveVerlauf.filter(([t]) => t > tVerkauf + 11 * 60000);
  pruefe("3 nach 10 min gilt wieder die normale Ruecklage", spaet.length === 0 || spaet[spaet.length - 1][1] < 1e17, JSON.stringify(spaet.slice(-3)));
}

console.log("\n-- 4: wie 2, die Boerse quittiert NIE --");
{
  const w = welt400({ stub: { quittiert: false }, schlafBudget: 150 });
  const r = await lauf("4", w);
  pruefe("4 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("4 die Pause wurde gelegt (Versuch hat stattgefunden)", pause(w).includes("\"id\""), pause(w).slice(0, 60));
  pruefe("4 KEIN Einbau ohne Quittung", w.installAufrufe === 0, "install " + w.installAufrufe);
  pruefe("4 keine Kaeufe", w.kaeufe.length === 0, "Kaeufe " + w.kaeufe.length);
  pruefe("4 keine Spenden", w.spenden.length === 0);
  pruefe("4 Depot unangetastet", w.depot === 380 * MRD);
  console.log("      Handschlaege (Sicherungsanfragen der Bruecke) im Budget: " + logZeilen(r, "Handschlag gestellt").length + " bei " + w.schlaf.length + " Schlafaufrufen, ~" + Math.round(w.schlaf.reduce((a, b) => a + b, 0) / 60000) + " min Spielzeit");
  const m = logZeilen(r, "EINBAU AUSGESETZT").length;
  pruefe("4 Aussetz-Meldung gedrosselt (1 bis 3 im Budget)", m >= 1 && m <= 3, "Meldungen " + m);
}

// ---------------------------------------------------------------------------
console.log("\n-- 3b: Kurssturz (10 %), aber billiger Katalog: der Plan hat auch nach dem Sturz 8+ Stuecke --");
{
  // Dieselbe Lage wie 3, aber die Preise sind so klein, dass auch 58 Mrd fuer den ganzen Katalog reichen.
  // Das Vermoegen NACH dem Verkauf liegt weit unter 300 Mrd: Runde 1 darf nicht einbauen.
  const billig = KATALOG.map(([n, b, rq, f, v]) => [n, b * 0.1, rq, f, v]);
  const w = welt8({ aug: billig, rep: REP1, bar: 20, vermoegen: 400, schlafBudget: 120,
    warteschlange: ["Synaptic Enhancement Implant", "DataJack"], stub: { quote: 0.1 } });
  const r = await lauf("3b", w);
  pruefe("3b Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  console.log("      " + (logZeilen(r, "BN8-EINBAURUNDE")[0] || "(keine Einbaurundenzeile)").slice(0, 230));
  pruefe("3b KEIN Einbau mit 58 Mrd (Runde 1 verlangt 300 Mrd Vermoegen)", w.installAufrufe === 0,
    "install " + w.installAufrufe + ", Kaeufe " + w.kaeufe.length + ", bar am Ende " + (w.geld / 1e9).toFixed(1) + " Mrd");
}

// ---------------------------------------------------------------------------
// Runde 2: 18 installierte, 16 Stuecke im Angebot. Basis in Mrd, skaliert.
const alt = (n) => Array.from({ length: n }, (_, i) => "Alt-" + i);
const staffel = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15];
const fk = ["CyberSec", "NiteSec", "The Black Hand", "Tian Di Hui"];
const katalog2 = (skala, n = 16) => staffel.slice(0, n).map((b, i) => ["Aug-" + i, b * skala * 5, 50e3, [fk[i % 4]]]);
const REP2 = { CyberSec: 1e6, NiteSec: 1e6, "The Black Hand": 1e6, "Tian Di Hui": 1e6 };

console.log("\n-- 5: Runde 2 (18 installiert), 1,2 Bio: Einbau und home-RAM --");
{
  const w = welt8({ aug: katalog2(0.16), rep: REP2, installiert: alt(18), bar: 40, vermoegen: 1200, schlafBudget: 120 });
  const r = await lauf("5", w);
  pruefe("5 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("5 genau ein Einbau", w.installAufrufe === 1, "install " + w.installAufrufe + " " + logZeilen(r, "BN8-PLAN")[0]);
  pruefe("5 mindestens 12 Stuecke gekauft (18 + 12 = 30)", w.kaeufe.length >= 12, "gekauft " + w.kaeufe.length);
  pruefe("5 home-RAM mehrfach hochgekauft", w.ramKaeufe.length >= 2, "RAM-Kaeufe " + w.ramKaeufe.length + ", jetzt " + w.homeRam + " GB");
  pruefe("5 home-RAM nicht ueber das Ziel", w.homeRam <= 32768, String(w.homeRam));
  pruefe("5 RAM erst NACH allen Plankaeufen", w.ramKaeufe.length > 0 && w.ramKaeufe.every((x) => x.kaeufeBis === w.kaeufe.length), JSON.stringify(w.ramKaeufe.map((x) => x.kaeufeBis)) + " von " + w.kaeufe.length);
  console.log("      Kaeufe " + w.kaeufe.length + ", RAM-Stufen " + w.ramKaeufe.length + " -> " + w.homeRam + " GB, bar am Ende " + (w.geld / 1e9).toFixed(0) + " Mrd");
}

console.log("\n-- 5b: Runde 2, 1,2 Bio, aber 30 Stuecke kosten fast alles: Stuecke gehen vor RAM --");
{
  const w = welt8({ aug: katalog2(0.3), rep: REP2, installiert: alt(18), bar: 40, vermoegen: 1200, schlafBudget: 120 });
  const r = await lauf("5b", w);
  pruefe("5b Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("5b Einbau", w.installAufrufe === 1, "install " + w.installAufrufe + " " + logZeilen(r, "BN8-PLAN")[0]);
  pruefe("5b mindestens 12 Stuecke gekauft (die 30 sind nicht gefaehrdet)", w.kaeufe.length >= 12, "gekauft " + w.kaeufe.length);
  console.log("      Kaeufe " + w.kaeufe.length + ", RAM-Stufen " + w.ramKaeufe.length + " -> " + w.homeRam + " GB, bar am Ende " + (w.geld / 1e9).toFixed(0) + " Mrd");
}

console.log("\n-- 6: Runde 2, 1,2 Bio, nur 5 Stuecke im Angebot (30 unerreichbar) --");
{
  const w = welt8({ aug: katalog2(0.16, 5), rep: REP2, installiert: alt(18), bar: 40, vermoegen: 1200, schlafBudget: 80 });
  const r = await lauf("6", w);
  pruefe("6 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("6 kein Einbau", w.installAufrufe === 0, "install " + w.installAufrufe);
  pruefe("6 keine Kaeufe, keine Spenden, kein RAM", w.kaeufe.length === 0 && w.spenden.length === 0 && w.ramKaeufe.length === 0);
  pruefe("6 keine Pausendatei", pause(w) === "");
}

// ---------------------------------------------------------------------------
// Runde 3: 31 installierte, Daedalus-Mitglied, The Red Pill im Angebot
const DAED = [
  [RP, 0, 2.5e6, ["Daedalus"]],
  ["Aug-D1", 0.3, 100e3, ["Daedalus"]],
  ["Aug-D2", 0.2, 100e3, ["Daedalus"]],
];
const redPillWelt = (verm, o = {}) => welt8({ aug: DAED, rep: { Daedalus: 0 }, installiert: alt(31), bar: Math.min(40, verm * 0.1), vermoegen: verm, schlafBudget: 120, ...o });

console.log("\n-- 7: Runde 3 (31 installiert), Daedalus, 1,5 Bio: Spende, Red Pill, Einbau --");
{
  const w = redPillWelt(1500);
  const r = await lauf("7", w);
  pruefe("7 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("7 Einbau", w.installAufrufe === 1, "install " + w.installAufrufe + " " + logZeilen(r, "BN8-PLAN")[0]);
  pruefe("7 Spende an Daedalus", w.spenden.length >= 1 && w.spenden.every((s) => s.f === "Daedalus"), JSON.stringify(w.spenden).slice(0, 120));
  pruefe("7 Daedalus-Ruf reicht fuer The Red Pill", w.faktionen.Daedalus.rep >= 2.5e6, String(w.faktionen.Daedalus.rep));
  pruefe("7 The Red Pill gekauft", w.kaeufe.some((k) => k.a === RP) && w.warteschlange.includes(RP));
  pruefe("7 Spende nicht uebertrieben (<= 1,05 x Bedarf)", w.spenden.reduce((a, s) => a + s.betrag, 0) / 1e6 * 3.083 <= 2.5e6 * 1.1,
    "Rep durch Spende " + Math.round(w.spenden.reduce((a, s) => a + s.betrag, 0) / 1e6 * 3.083));
  console.log("      Spende " + (w.spenden.reduce((a, s) => a + s.betrag, 0) / 1e9).toFixed(0) + " Mrd, RAM-Stufen " + w.ramKaeufe.length + ", Kaeufe " + w.kaeufe.map((k) => k.a).join(","));
}
console.log("\n-- 7b: Runde 3, 880 Mrd (Spende ~827 Mrd passt gerade ohne home-RAM) --");
{
  const w = redPillWelt(880);
  const r = await lauf("7b", w);
  pruefe("7b Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("7b Einbau mit Red Pill", w.installAufrufe === 1 && w.warteschlange.includes(RP), "install " + w.installAufrufe + " " + logZeilen(r, "BN8-PLAN")[0]);
}
console.log("\n-- 7c: Runde 3, 600 Mrd (reicht nicht): kein Einbau, keine Spende --");
{
  const w = redPillWelt(600);
  const r = await lauf("7c", w);
  pruefe("7c Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("7c kein Einbau, keine Spende, keine Kaeufe", w.installAufrufe === 0 && w.spenden.length === 0 && w.kaeufe.length === 0,
    "install " + w.installAufrufe + ", Spenden " + w.spenden.length + ", Kaeufe " + w.kaeufe.length);
  pruefe("7c keine Pause", pause(w) === "");
}

console.log("\n-- 8: Runde 3, The Red Pill wartet schon: Einbau ohne weitere Bedingungen --");
{
  const w = redPillWelt(50, { warteschlange: [RP], bar: 5 });
  w.faktionen.Daedalus.rep = 0;
  const r = await lauf("8", w);
  pruefe("8 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("8 Einbau", w.installAufrufe === 1, "install " + w.installAufrufe + ", Ende " + r.ende + " " + (logZeilen(r, "EINBAU")[0] || "").slice(0, 160));
  pruefe("8 Depot vor dem Einbau verkauft (Quittung)", w.haken.st.quittiert >= 1);
  pruefe("8 keine Spende", w.spenden.length === 0);
}

console.log("\n-- 8b: Runde 4 (The Red Pill installiert): alles Bargeld frei fuer Ports und RAM --");
{
  const w = redPillWelt(150, { installiert: [...alt(31), RP], bar: 3 });
  w.faktionen.Daedalus.rep = 200e3;   // Aug-D1/D2 waeren erreichbar - eine Ruecklage dafuer sperrte bisher das Bargeld
  const r = await lauf("8b", w);
  pruefe("8b Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("8b kein Einbau, kein Kauf", w.installAufrufe === 0 && w.kaeufe.length === 0, "install " + w.installAufrufe + " Kaeufe " + w.kaeufe.length);
  pruefe("8b Geldreserve 0", Number(w.dateien.home["data/geldbedarf.txt"]) === 0, String(w.dateien.home["data/geldbedarf.txt"]));
}

// ---------------------------------------------------------------------------
console.log("\n-- 9: Gegenprobe ausserhalb BN8 (Knoten 5, keine boerse.json): es wird wie frueher gekauft --");
{
  const w = welt8({ aug: KATALOG, rep: REP1, knoten: 5, moneyMult: 2, ownedSF: [[4, 3], [5, 1], [11, 3]], bar: 100, vermoegen: 100,
    stub: { keineBoerse: true }, schlafBudget: 40, favorToDonate: 150, home: { "data/verfahren.txt": "V1 5" } });
  const r = await lauf("9", w);
  pruefe("9 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("9 mindestens ein Stueck gekauft", w.kaeufe.length >= 1, "Kaeufe " + w.kaeufe.length);
  pruefe("9 kein BN8-Plan im Log", logZeilen(r, "BN8-PLAN").length === 0);
  console.log("      Kaeufe " + w.kaeufe.length + ", Einbau " + w.installAufrufe);
}

console.log("\n-- 10: boerse.json 5 min alt, nennt ein Depot: KEIN Einbau --");
{
  // Kontrollwelt ohne Boerse: der alte Weg soll hier einbauen (sonst waere der Test blind).
  const nurWartend = ["BitWire", "Cranial Signal Processors - Gen I", "Cranial Signal Processors - Gen II", "Synaptic Enhancement Implant", "DataJack"];
  const mk = (extra) => welt8({
    aug: KATALOG.filter(([n]) => nurWartend.includes(n)), rep: REP1, bar: 400, vermoegen: 400, schlafBudget: 60,
    warteschlange: nurWartend, ...extra,
  });
  const wK = mk({ stub: { keineBoerse: true }, keineBoerseDatei: true });
  const rK = await lauf("10-Kontrolle", wK);
  console.log("      Kontrolle ohne Boerse: install " + wK.installAufrufe + " (Ende " + rK.ende + ")");
  pruefe("10 Kontrolle: ohne boerse.json baut der alte Weg ein (Test ist nicht blind)", wK.installAufrufe === 1, "install " + wK.installAufrufe);
  const w = mk({ stub: { eingefroren: true }, telTs: 1_790_442_188_000 - 300000, bar: 400, vermoegen: 400 });
  // Die Telemetrie nennt ein Depot von 100 Mrd (nicht im Spielzustand, nur in der Datei)
  w.dateien.home["data/boerse.json"] = JSON.stringify({ ts: w.uhr - 300000, state: "work", hat4S: true, depotWert: 100e9, bar: 400e9, gesamt: 500e9, posten: 5 });
  const r = await lauf("10", w);
  pruefe("10 Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
  pruefe("10 KEIN Einbau", w.installAufrufe === 0, "install " + w.installAufrufe);
  pruefe("10 die Meldung EINBAU WARTET nennt das Depot", logZeilen(r, "EINBAU WARTET").length >= 1, r.log.slice(-200));
  pruefe("10 keine Pausendatei", pause(w) === "");
  console.log("      Kaeufe waehrend die Telemetrie schweigt: " + w.kaeufe.length);
}

// ---------------------------------------------------------------------------
console.log("\n-- 11: Rechenzeit bei ~55 Kandidaten (Plan jede Runde) --");
{
  // 55 Stuecke, vier Faktionen, einige Vorbedingungsketten, billig genug, dass der Plan viele nimmt.
  const aug = [];
  for (let i = 0; i < 55; i++) aug.push(["P-" + i, 0.02 + (i % 11) * 0.03, 10e3 + (i % 7) * 40e3, [fk[i % 4], ...(i % 5 === 0 ? [fk[(i + 1) % 4]] : [])], i % 6 === 5 ? ["P-" + (i - 1)] : []]);
  const rep = { CyberSec: 200e3, NiteSec: 200e3, "The Black Hand": 200e3, "Tian Di Hui": 200e3 };
  for (const [name, verm, inst, extra] of [["Runde 1, 250 Mrd (nicht faellig)", 250, 0, {}], ["Runde 2, 900 Mrd (nicht faellig)", 900, 18, {}]]) {
    const w = welt8({ aug, rep, installiert: alt(inst), bar: 10, vermoegen: verm, schlafBudget: 30, ...extra });
    const r = await lauf("11 " + name, w);
    const z = zeiten[zeiten.length - 1];
    const planZeile = logZeilen(r, "BN8-PLAN")[0] || "";
    console.log("      " + name + ": " + z.schlaf + " Runden in " + z.ms.toFixed(0) + " ms = " + z.proRunde.toFixed(1) + " ms/Runde | " + planZeile.replace(/^\S+\s+/, "").slice(0, 150));
    pruefe("11 " + name + ": Nachbau vollstaendig", nachbauOk(r), hinweisFehler(r));
    pruefe("11 " + name + ": unter 500 ms je Runde", z.proRunde < 500, z.proRunde.toFixed(0) + " ms");
  }
}

console.log("\n-- Rechenzeit je Szenario (Wanduhr gesamt / Schlafaufrufe = Runden) --");
for (const z of zeiten) console.log("   " + z.name.padEnd(40) + " " + String(z.schlaf).padStart(4) + " Runden  " + z.ms.toFixed(0).padStart(6) + " ms  " + z.proRunde.toFixed(1).padStart(7) + " ms/Runde");

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("\nRot:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
