/**
 * Corp-Geld BN3 (06.10.2026): bn4rep.js-Hauptlauf gegen einen nachgebauten BN3-Stand
 * mit gezuendeter Corp. Harness (baueWelt, baueNs, fahre) unveraendert aus
 * tools/test-bn4rep-ebene2.js uebernommen (Zeilen 46-307).
 *
 * ROT gegen den alten Code, GRUEN gegen den Spiegel:
 *   BN4REP_SRC=nodes/corp-2026-10-05/bot/alt/src node nodes/corp-2026-10-05/bot/tests/test-corp-torrunde.js   (rot)
 *   BN4REP_SRC=nodes/corp-2026-10-05/bot/src     node nodes/corp-2026-10-05/bot/tests/test-corp-torrunde.js   (gruen)
 * Ohne BN4REP_SRC: der Spiegel. NIE gegen src/ fahren - der Lader legt .mock-Dateien neben die
 * Quellen, und src/ geht ueber die Bruecke ins Spiel.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const BOT = path.resolve(HIER, "..");
const ROOT = path.resolve(BOT, "..", "..", "..");
const { ladeSpielskript } = await import(pathToFileURL(path.join(ROOT, "tools", "mock", "lader.js")).href);
const SRC = process.env.BN4REP_SRC ? path.resolve(process.env.BN4REP_SRC) : path.join(BOT, "src");
if (path.resolve(SRC) === path.resolve(ROOT, "src")) { console.log("Abbruch: nie gegen src/ fahren."); process.exit(2); }
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
        if (w.scpFehler && w.scpFehler.has(f)) { alle = false; continue; }   // Testhaken H3: scp scheitert
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
    getResetInfo: () => ({ currentNode: w.knoten, lastNodeReset: w.nodeReset, lastAugReset: w.augReset ?? 2,
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

// ===========================================================================
// BN3-WELT MIT CORP
// ===========================================================================
// Preise roh (Augmentations.ts), moneyMult 3 = BN3 AugmentationMoneyCost (BitNode.tsx:619);
// Ruf schon x3 (getAugmentationRepReq liefert den Knotenwert, BitNode.tsx:620).
const { COMBAT_AUGS } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);
const BO_JSON = fs.readFileSync(path.join(SRC, "lib", "blackops.json"), "utf8");
const JETZT = 1_790_442_188_000;               // baueWelt: uhr
const PLAYTIME_NOW = 100 * 3600000;            // baueWelt: playtime
const NODE_RESET = JETZT - 20 * 3600000;
const AUGS_BN3 = {
  "Hyperion Plasma Cannon V1": { repReq: 37500, basis: 2.75e9 },
  "BLADE-51b Tesla Armor": { repReq: 37500, basis: 1.375e9 },
  "ORION-MKIV Shoulder": { repReq: 18750, basis: 0.55e9 },
  "GOLEM Serum": { repReq: 93750, basis: 11e9 },                 // Bladeburners, Ruf fehlt: unbestechlich
  "Bionic Arms": { repReq: 187500, basis: 0.275e9 },             // Tetrads, nur mit Bestechung
  "HemoRecirculator": { repReq: 30000, basis: 0.045e9 },         // Tetrads
  "The Black Hand": { repReq: 300000, basis: 0.55e9 },           // The Black Hand, nur mit Bestechung
  "Augmented Targeting II": { repReq: 26250, basis: 0.0425e9 },  // Sector-12, verdient
  "Neurotrainer II": { repReq: 30000, basis: 0.045e9 },          // NiteSec: nur Erfahrung, Zuwachs 0
  [NFG]: { repReq: 1500, basis: 0.75e6 },
};
for (const [n, a] of Object.entries(AUGS_BN3)) if (COMBAT_AUGS[n]) a.stats = COMBAT_AUGS[n];
const FAKT_BN3 = () => ({
  Bladeburners: { favor: 1, rep: 60000, augs: ["Hyperion Plasma Cannon V1", "BLADE-51b Tesla Armor", "ORION-MKIV Shoulder", "GOLEM Serum"] },
  Tetrads: { favor: 1, rep: 1000, augs: ["Bionic Arms", "HemoRecirculator", NFG] },
  "The Black Hand": { favor: 1, rep: 2000, augs: ["The Black Hand", NFG] },
  "Sector-12": { favor: 1, rep: 30000, augs: ["Augmented Targeting II", NFG] },
  NiteSec: { favor: 1, rep: 1000, augs: ["Neurotrainer II", NFG] },
});
const FIN0 = { phase: "oeffentlich", ignitedAt: 9.5, sales: [{ h: 9.6 }] };
const mitErloes = (summe, augReset = 2) => ({ finance: { ...FIN0, erloesAug: { augReset, summe } } });
const corpJson = (over = {}) => JSON.stringify({
  schema: 2, ts: JETZT - 5000, wall: JETZT - 5000, nodeReset: NODE_RESET, state: "work",
  public: true, valuation: 2e15, funds: 2e15, owned: 0.5, fundingRounds: 4,
  finance: { phase: "oeffentlich", ignitedAt: 9.5, sales: [{ h: 9.6 }] }, ...over,
});
const UHR_OFFEN = JSON.stringify({ augReset: 2, playtime: 0, fertig: 1000 });
const UHR_GESPERRT = JSON.stringify({ augReset: 2, playtime: 0, fertig: PLAYTIME_NOW - 3600000 });
const dBN3 = (extra = {}) => ({
  "data/verfahren.txt": "V2 3 1",
  "lib/blackops.json": BO_JSON,
  "data/blade.json": JSON.stringify({ zeit: 0, naechsteBlackOp: "Operation Typhoon" }),
  "data/einbau-uhr.json": UHR_GESPERRT,
  "data/corp.json": corpJson(),
  ...extra,
});
const weltBN3 = (o = {}) => baueWelt({
  host: "werk-0", knoten: 3, moneyMult: 3, geld: 60e9, einkommen: 1e6, nodeReset: NODE_RESET,
  skills: { hacking: 372, strength: 236, defense: 236, dexterity: 241, agility: 240, intelligence: 155 },
  mults: { hacking: 1.5, faction_rep: 1.43 },
  faktionen: FAKT_BN3(), augs: AUGS_BN3,
  installiert: ["NeuroFlux Governor", "Neurotrainer I", "Wired Reflexes"],
  warteschlange: [], schlafBudget: 8,
  ...o,
  dateien: { home: dBN3(o.extraDateien || {}), ...(o.dateien || {}) },
});
const teleVon = (w) => { try { return JSON.parse(w.dateien.home["data/bn4rep.json"] || "null"); } catch { return null; } };
const reqVon = (w) => { try { return JSON.parse(w.dateien.home["data/corp-geld.txt"] || "null"); } catch { return null; } };
const vollstaendig = (r) => rundenfehler(r.log).length === 0 && r.ende !== "fehler";
const vollHinweis = (r) => rundenfehler(r.log).concat(r.fehlerText).join(" | ").slice(0, 300);
const antwortetBruecke = (welt) => {
  const anfrage = welt.dateien.home["data/backup-request.txt"];
  if (!anfrage || welt.dateien.home["data/backup-ok.txt"]) return;
  welt.dateien.home["data/backup-ok.txt"] = JSON.stringify({ ts: welt.uhr, anlass: "pre-install", datei: "Nachbau" });
};
const corpFrisch = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000 }); };
const kette = (...f) => (welt) => f.forEach((g) => g(welt));

console.log("\n=== Corp-Geld BN3 gegen " + SRC + " ===");

// ---------------------------------------------------------------------------
console.log("\n-- K1: Corp gezuendet, Tor gesperrt (Wiederaufbau zu jung) -> kein Kauf, Anforderung mit Bestechung --");
{
  const w = weltBN3({ geld: 20e9 });   // weniger als die volle Runde (53 Mrd): betrag > 0
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("K1: kein einziger Kauf (alt: alles Verdiente sofort, teuerste zuerst)", w.kaeufe.length === 0,
    "Kaeufe: " + w.kaeufe.map((k) => k.a).join(", "));
  const q = reqVon(w);
  pruefe("data/corp-geld.txt liegt auf home, Schnittstelle v1 (ts, nodeReset, augReset, von bn4rep)",
    !!q && q.v === 1 && q.von === "bn4rep" && q.nodeReset === NODE_RESET && q.augReset === 2
    && Math.abs(q.ts - w.uhr) < 3600000, JSON.stringify(q).slice(0, 200));
  pruefe("bestechung: Tetrads (Bionic Arms 187.500 - 1.000) und The Black Hand (300.000 - 2.000)",
    !!q && q.bestechung && q.bestechung.Tetrads === 186500 && q.bestechung["The Black Hand"] === 298000,
    q ? JSON.stringify(q.bestechung) : "");
  pruefe("bestechung: nie Bladeburners (GOLEM Serum fehlt Ruf), nie NiteSec (Neurotrainer II bringt der Runde nichts)",
    !!q && q.bestechung && !("Bladeburners" in q.bestechung) && !("NiteSec" in q.bestechung), q ? JSON.stringify(q.bestechung) : "");
  const t = teleVon(w);
  pruefe("bn4rep.json offenJeFaktion bleibt wie bisher (NiteSec fehlt 29.000 - fuer sleeve.js), die Anforderung nimmt es nicht",
    !!t && t.offenJeFaktion && t.offenJeFaktion.NiteSec && t.offenJeFaktion.NiteSec.fehlt === 29000, t ? JSON.stringify(t.offenJeFaktion) : "");
  pruefe("Telemetrie: torRunde.mode locked, torRunde.corp mit derselben Bestechung",
    !!t && t.torRunde && t.torRunde.mode === "locked" && t.torRunde.corp
    && JSON.stringify(t.torRunde.corp.bestechung) === JSON.stringify(q && q.bestechung), t && t.torRunde ? JSON.stringify(t.torRunde.corp).slice(0, 240) : "");
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("F1/B1: geldbedarf.txt nie ueber dem Konto (alt: volle Runde 53 Mrd > Konto 20 Mrd), mindestens die kaufbare Runde; betrag = Kosten - Konto",
    !!t && t.torRunde && t.torRunde.corp && bedarf <= 20e9 && bedarf >= t.torRunde.plan.cost - 1
    && !!q && q.betrag > 0 && q.betrag === Math.ceil(t.torRunde.corp.plan.cost - 20e9),
    "bedarf " + bedarf + ", Plan " + (t && t.torRunde && t.torRunde.corp ? t.torRunde.corp.plan.cost : "?") + ", betrag " + (q && q.betrag));
  pruefe("der volle Plan enthaelt mehr als die kaufbare Runde (Bionic Arms, The Black Hand)",
    !!t && t.torRunde && t.torRunde.corp && t.torRunde.corp.plan.n > t.torRunde.plan.n && t.torRunde.corp.plan.gain > t.torRunde.plan.gain,
    t && t.torRunde ? JSON.stringify([t.torRunde.plan, t.torRunde.corp && t.torRunde.corp.plan]) : "");
  pruefe("kein installAugmentations", w.installAufrufe === 0);
  console.log("        (Anforderung: " + JSON.stringify(q) + "; Log: " + r.log.split(String.fromCharCode(10)).filter((z) => /CORP|TORRUNDE/.test(z)).join(" / ").slice(0, 600) + ")");
}

// ---------------------------------------------------------------------------
console.log("\n-- K2: Corp NICHT gezuendet -> alles wie heute (alte Schleife, keine Anforderung) --");
{
  const w = weltBN3({ extraDateien: { "data/corp.json": corpJson({ public: false, finance: null, valuation: 4e11 }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("K2: die alte Schleife kauft, teuerste zuerst (erstes Stueck Hyperion Plasma Cannon V1)",
    w.kaeufe.length >= 3 && w.kaeufe[0].a === "Hyperion Plasma Cannon V1", w.kaeufe.map((k) => k.a).join(", "));
  pruefe("keine data/corp-geld.txt", !("data/corp-geld.txt" in w.dateien.home));
}

// ---------------------------------------------------------------------------
console.log("\n-- K3: anderer Knoten / anderer nodeReset / V1 -> alles wie heute --");
{
  const w = weltBN3({ knoten: 9, extraDateien: { "data/verfahren.txt": "V2 9 1" } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("K3: BN9 mit gezuendeter corp.json: alte Schleife kauft, keine Anforderung",
    w.kaeufe.length >= 3 && !("data/corp-geld.txt" in w.dateien.home), w.kaeufe.map((k) => k.a).join(", "));
}
{
  const w = weltBN3({ extraDateien: { "data/corp.json": corpJson({ nodeReset: NODE_RESET - 1 }) } });
  await fahre(w);
  pruefe("K3b: corp.json aus einem anderen Knoten (nodeReset) -> alte Schleife, keine Anforderung",
    w.kaeufe.length >= 3 && !("data/corp-geld.txt" in w.dateien.home), w.kaeufe.map((k) => k.a).join(", "));
}
{
  const w = weltBN3({ extraDateien: { "data/verfahren.txt": "V1 3 1" } });
  await fahre(w);
  pruefe("K3c: BN3 im Hackingweg (V1) -> keine Anforderung", !("data/corp-geld.txt" in w.dateien.home));
}

// ---------------------------------------------------------------------------
console.log("\n-- K4: Tor offen, Bestechung fehlt noch, corp.json frisch -> warten: weder Kauf noch Einbau --");
{
  const w = weltBN3({ extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 12, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("K4: kein Kauf (alt: sofort)", w.kaeufe.length === 0, w.kaeufe.map((k) => k.a).join(", "));
  pruefe("kein Einbau, kein Handschlag", w.installAufrufe === 0 && !w.dateien.home["data/backup-request.txt"]);
  const t = teleVon(w);
  pruefe("Telemetrie mode corpwait, waits true", !!t && t.torRunde && t.torRunde.mode === "corpwait" && t.torRunde.corp && t.torRunde.corp.waits === true,
    t && t.torRunde ? JSON.stringify([t.torRunde.mode, t.torRunde.corp && t.torRunde.corp.waitNote]) : "");
  pruefe("der Wartezustand liegt auf home (ueberlebt einen Neustart)", "data/torrunde-corpwait.json" in w.dateien.home);
}

// ---------------------------------------------------------------------------
console.log("\n-- K5: Tor offen, Ruf geliefert, Geld da -> die Runde (nur Planstuecke), dann Einbau --");
{
  const f = FAKT_BN3();
  f.Tetrads.rep = 200000; f["The Black Hand"].rep = 310000; f.NiteSec.rep = 40000;
  const w = weltBN3({ geld: 600e9, faktionen: f, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 80, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const namen = w.kaeufe.map((k) => k.a);
  pruefe("K5: Bionic Arms (Tetrads) und The Black Hand gekauft", namen.includes("Bionic Arms") && namen.includes("The Black Hand"), namen.join(", "));
  pruefe("Neurotrainer II (verdient, aber ohne Zuwachs) NICHT gekauft (alt: gekauft)", !namen.includes("Neurotrainer II"), namen.join(", "));
  console.log("        (Kaeufe: " + w.kaeufe.map((k) => k.a + " " + (k.p / 1e9).toFixed(2) + " Mrd").join(" > ") + ")");
  pruefe("gekauft als Torrunde (Log 'Torrunde 1/N')", /Torrunde 1\/\d+/.test(r.log), "");
  pruefe("danach der Einbau (installAugmentations, main endet)", w.installAufrufe === 1 && r.ende === "return",
    "install " + w.installAufrufe + ", Ende " + r.ende);
}

// ---------------------------------------------------------------------------
console.log("\n-- K6: Tor offen, Bestechung fehlt, corp.json 30 min alt -> nicht warten, kaufbare Runde, Einbau --");
{
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN, "data/corp.json": corpJson({ ts: JETZT - 30 * 60000, wall: JETZT - 30 * 60000 }) },
    schlafBudget: 80, beiSchlaf: antwortetBruecke });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const namen = w.kaeufe.map((k) => k.a);
  pruefe("K6: Runde ohne Bestechungsstuecke gekauft (Hyperion zuerst), kein Bionic Arms, kein Neurotrainer",
    namen[0] === "Hyperion Plasma Cannon V1" && !namen.includes("Bionic Arms"), namen.join(", "));
  pruefe("K6: und eingebaut", w.installAufrufe === 1, "install " + w.installAufrufe);
  pruefe("K6: die Anforderung wird trotzdem geschrieben (Signal = Tatsache der Zuendung)", !!reqVon(w));
}

// ---------------------------------------------------------------------------
console.log("\n-- K7: Tor offen, Bestechung kommt nie (corp.json frisch) -> nach 90 min ohne Fortschritt wird gekauft --");
{
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3000, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const t0 = w.kaeufe.length ? (w.kaeufe[0].uhr - JETZT) / 60000 : -1;
  pruefe("K7: erster Kauf nach >= 90 und < 120 min Warten (alt: sofort)", t0 >= 90 && t0 < 120, "erster Kauf nach " + t0.toFixed(1) + " min");
  pruefe("K7: und eingebaut", w.installAufrufe === 1, "install " + w.installAufrufe);
}

// ---------------------------------------------------------------------------
console.log("\n-- K8: Tor offen, Bestechung trifft nach 40 min ein -> dann die volle Runde --");
{
  const bestechenNach40 = (welt) => {
    if (welt.uhr - JETZT >= 40 * 60000) { welt.faktionen.Tetrads.rep = 187500; welt.faktionen["The Black Hand"].rep = 300000; }
  };
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3000, beiSchlaf: kette(corpFrisch, antwortetBruecke, bestechenNach40) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  const t0 = w.kaeufe.length ? (w.kaeufe[0].uhr - JETZT) / 60000 : -1;
  const namen = w.kaeufe.map((k) => k.a);
  pruefe("K8: erster Kauf nach 40-45 min, Bionic Arms und The Black Hand dabei", t0 >= 40 && t0 < 45 && namen.includes("Bionic Arms") && namen.includes("The Black Hand"),
    t0.toFixed(1) + " min: " + namen.join(", "));
  pruefe("K8: Einbau", w.installAufrufe === 1);
}

// ---------------------------------------------------------------------------
console.log("\n-- K9: Neustart von bn4rep waehrend des Wartens setzt die Wartezeit nicht zurueck --");
{
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 200, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  await fahre(w);     // ~50 min Warten, dann Abbruch (Budget)
  const vorher = w.kaeufe.length;
  w.schlaf = []; w.schlafBudget = 3000;
  await fahre(w);
  const t0 = w.kaeufe.length ? (w.kaeufe[0].uhr - JETZT) / 60000 : -1;
  pruefe("K9: kein Kauf im ersten Lauf, im zweiten nach insgesamt 90-120 min (nicht 90 min nach dem Neustart)",
    vorher === 0 && t0 >= 90 && t0 < 120, "vorher " + vorher + ", erster Kauf nach " + t0.toFixed(1) + " min");
}

let CG_PRE = null;
try { CG_PRE = await import(pathToFileURL(path.join(SRC, "lib", "corpgeld.js")).href); } catch { CG_PRE = null; }
// ===========================================================================
// SKEPTIKER-FIXES (06.10.2026 abends): je Fix rot gegen v1 (bot/v1/src), gruen gegen bot/src
// ===========================================================================
const freiFuerBn4net = (w) => w.geld - Number(w.dateien.home["data/geldbedarf.txt"] || 0);   // bn4net.js:1274-1294
const UHR_BALD = JSON.stringify({ augReset: 2, playtime: PLAYTIME_NOW - 12 * 3600000, fertig: PLAYTIME_NOW - 11.5 * 3600000 });   // Tor in 30 min

console.log("\n-- F1/B1/K9: Ruf 0 nach dem Einbau, Tor weit -> bn4net behaelt das ganze Konto --");
{
  const f = FAKT_BN3();
  for (const x of Object.values(f)) x.rep = 0;
  const w = weltBN3({ geld: 5e9, faktionen: f, extraDateien: { "data/corp.json": corpJson({ state: "blocked", blockedReason: "no_space" }) } });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("F1: Corp blockiert, Ruf 0 -> geldbedarf 0, frei fuer bn4net = ganzes Konto (alt: volle Runde reserviert, Rechnerkauf gesperrt)",
    freiFuerBn4net(w) === w.geld, "frei " + freiFuerBn4net(w) + " von " + w.geld + ", geldbedarf " + w.dateien.home["data/geldbedarf.txt"]);
}
{
  const f = FAKT_BN3();
  for (const x of Object.values(f)) x.rep = 0;
  const w = weltBN3({ geld: 5e9, faktionen: f });
  await fahre(w);
  pruefe("F1b/R3-FIX1: Corp liefert, Ruf 0, aber noch kein Erloes -> ganzes Konto frei wie mit Gang (v3: 4,5 Mrd gesperrt)",
    freiFuerBn4net(w) === w.geld, "frei " + freiFuerBn4net(w) + " von " + w.geld);
}
{
  const w = weltBN3({ geld: 2e12, extraDateien: { "data/einbau-uhr.json": UHR_BALD, "data/corp.json": corpJson(mitErloes(40e9)) } });
  await fahre(w);
  const t = teleVon(w);
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("F1c/R3-FIX1: Erloes seit Einbau 40 Mrd -> Ruecklage = 40 Mrd (zwischen kaufbarer 23 und voller Runde 53 Mrd)",
    Math.abs(bedarf - 40e9) <= 1, "bedarf " + bedarf + ", voll " + (t && t.torRunde && t.torRunde.corp ? t.torRunde.corp.plan.cost : "?"));
}
{
  const w = weltBN3({ geld: 2e12, extraDateien: { "data/einbau-uhr.json": UHR_BALD, "data/corp.json": corpJson({ state: "blocked", blockedReason: "no_space" }) } });
  await fahre(w);
  const t = teleVon(w);
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("F1d: Tor in 30 min, corp.js blockiert -> nur die kaufbare Runde, keine Bestechung (alt: volle Runde 53 Mrd)",
    !!t && t.torRunde && t.torRunde.corp && Math.abs(bedarf - t.torRunde.plan.cost) <= 1 && bedarf < 50e9,
    "bedarf " + bedarf + ", kaufbar " + (t && t.torRunde ? t.torRunde.plan.cost : "?"));
}

console.log("\n-- F3/E3: Signal an, aber corp.js blockiert / kein Boersengang -> am offenen Tor NICHT warten --");
for (const [name, over] of [
  ["state blocked", { state: "blocked", blockedReason: "no_space" }],
  ["finance.blocked no_ipo_path, privat", { public: false, finance: { phase: "halten", ignitedAt: 9.5, blocked: "no_ipo_path" } }],
  ["gezuendet, aber Phase halten (Runde 4 fehlt)", { public: false, finance: { phase: "halten", ignitedAt: 9.5 } }],
]) {
  const frisch = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, ...over }); };
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 80, beiSchlaf: kette(frisch, antwortetBruecke) });
  frisch(w);
  const r = await fahre(w);
  pruefe("F3 (" + name + "): Runde sofort gekauft und eingebaut (alt: bis 90 min corpwait)",
    vollstaendig(r) && w.kaeufe.length > 0 && (w.kaeufe[0].uhr - JETZT) < 5 * 60000 && w.installAufrufe === 1,
    "erster Kauf nach " + (w.kaeufe.length ? ((w.kaeufe[0].uhr - JETZT) / 60000).toFixed(1) : "-") + " min, install " + w.installAufrufe);
}

console.log("\n-- F4/E4: Faktion mit Spendenrecht -> Spende aus dem Konto statt Bestechung --");
{
  const f = FAKT_BN3();
  f.Tetrads.favor = 160; f["The Black Hand"].rep = 310000;
  // 9 Mrd: der alte Spendenweg fuers Ziel (bn4rep ~3101) bleibt unter seiner 1-Mrd-Schwelle
  const w = weltBN3({ geld: 9e9, faktionen: f, extraDateien: { "data/einbau-uhr.json": UHR_GESPERRT } });
  await fahre(w);
  const q = reqVon(w);
  const t = teleVon(w);
  pruefe("F4: Tetrads nicht in bestechung, aber als Spende im Plan (alt: bestechung Tetrads 186.500)",
    !!q && q.bestechung && !("Tetrads" in q.bestechung) && !!t && t.torRunde && t.torRunde.corp && t.torRunde.corp.spende
    && t.torRunde.corp.spende.Tetrads && t.torRunde.corp.spende.Tetrads.ruf === 186500,
    JSON.stringify(t && t.torRunde && t.torRunde.corp).slice(0, 700) + " " + JSON.stringify(t && t.favor));
}
{
  const f = FAKT_BN3();
  f.Tetrads.favor = 160; f["The Black Hand"].rep = 310000;
  const w = weltBN3({ geld: 600e9, faktionen: f, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 80, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("F4b: am offenen Tor an Tetrads gespendet, danach Bionic Arms gekauft und eingebaut (alt: keine Spende)",
    w.spenden.some((x) => x.f === "Tetrads") && w.kaeufe.some((k) => k.a === "Bionic Arms") && w.installAufrufe === 1,
    "Spenden " + JSON.stringify(w.spenden.map((x) => x.f)) + ", Kaeufe " + w.kaeufe.map((k) => k.a).join(", "));
}

console.log("\n-- F5/E5: nach dem Kauf am Tor nichts mehr anfordern --");
{
  const w = weltBN3({ geld: 600e9, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3000, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  await fahre(w);
  const q = reqVon(w);
  pruefe("F5: nach Kauf (Wartezeit abgelaufen, Bestechung kam nie) betrag 0 und bestechung {} (alt: Tetrads/Black Hand weiter angefordert)",
    w.kaeufe.length > 0 && !!q && q.betrag === 0 && Object.keys(q.bestechung || {}).length === 0, JSON.stringify(q));
}

console.log("\n-- F6/E6: Bestechung nur, was die Corp-Kasse tragen kann (25 % je Faktion) --");
{
  const w = weltBN3({ geld: 20e9, extraDateien: { "data/corp.json": corpJson({ funds: 1.2e15 }) } });
  await fahre(w);
  const q = reqVon(w);
  pruefe("F6: Kasse 1,2e15 -> je Faktion hoechstens 294.117 Ruf: Tetrads ja, The Black Hand (298.000) nein (alt: beide)",
    !!q && q.bestechung && q.bestechung.Tetrads === 186500 && !("The Black Hand" in q.bestechung), JSON.stringify(q && q.bestechung));
}
{
  const w = weltBN3({ geld: 20e9, extraDateien: { "data/corp.json": corpJson({ funds: 5e14 }) } });
  await fahre(w);
  const q = reqVon(w);
  pruefe("F6b: Kasse unter 1e15 -> keine Bestechung angefordert (alt: angefordert)", !!q && Object.keys(q.bestechung || {}).length === 0, JSON.stringify(q && q.bestechung));
}

console.log("\n-- F10/S7: corp.json verschwindet nach der Zuendung -> alte Kaufschleife bleibt aus --");
{
  let n = 0;
  const weg = (welt) => { n++; if (n === 1) delete welt.dateien.home["data/corp.json"]; };
  const w = weltBN3({ geld: 600e9, schlafBudget: 6, beiSchlaf: weg });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("F10: kein Kauf (alt: ab der zweiten Runde kauft die alte Schleife alles)", w.kaeufe.length === 0, w.kaeufe.map((k) => k.a).join(", "));
}

console.log("\n-- F7/F8/F9: Warte-Uhr --");
if (CG_PRE) {
  const base = { gateOpen: true, deliverable: true, fresh: true, gainNow: 1.5, gainFull: 2.2, betrag: 1e15, ruf: 1e5, shortfall: 1e15 };
  let st = null, wr = null;
  for (let t = 0; t <= 60 * 60000; t += 15000) { wr = CG_PRE.corpWait(st, { ...base, nowMs: t }); st = wr.state; }
  wr = CG_PRE.corpWait(st, { ...base, nowMs: 61 * 60000, gateOpen: false }); st = wr.state;
  wr = CG_PRE.corpWait(st, { ...base, nowMs: 62 * 60000 }); st = wr.state;
  pruefe("F7/K7: Tor flackert (1 min zu) -> Wartezeit bleibt bei ~60 min (alt: 0)", st.aktivMs >= 59 * 60000, "aktivMs " + Math.round(st.aktivMs / 60000) + " min");
  st = null;
  wr = CG_PRE.corpWait(st, { ...base, nowMs: 0 }); st = wr.state;
  wr = CG_PRE.corpWait(st, { ...base, nowMs: 8 * 3600000, deliverable: false, fresh: false }); st = wr.state;
  pruefe("F8/S2: erste Runde nach 8 h Pause, corp.json noch alt -> wartet (Karenz; alt: kauft sofort)", wr.waits === true, wr.reason);
  for (let t = 8 * 3600000 + 15000; t <= 8 * 3600000 + 11 * 60000; t += 15000) { wr = CG_PRE.corpWait(st, { ...base, nowMs: t, deliverable: false, fresh: false }); st = wr.state; }
  pruefe("F8b: nach 11 min immer noch alt -> nicht mehr warten", wr.waits === false, wr.reason);
  st = null;
  for (let t = 0; t <= 60 * 60000; t += 15000) { wr = CG_PRE.corpWait(st, { ...base, nowMs: t, gainFull: 1.59, betrag: 1e15 * (1 - t / 4e6) }); st = wr.state; }
  pruefe("F9/S6: Gewinn x1,06 -> nach 60 min kein Warten mehr (Grenze ~53 min; alt: weiter)", wr.waits === false, wr.reason);
}

console.log("\n-- F11/K8: Check-in-Befund 'Signal an, Corp liefert nicht' --");
{
  const { gateRoundStatus } = await import(pathToFileURL(path.join(SRC, "..", "tools", "lib", "gate-round-status.js")).href);
  const tele = { zeit: JETZT, torRunde: { mode: "locked", plan: { n: 3, cost: 1e10, gain: 1.3 },
    corp: { plan: { n: 6, cost: 5e12, gain: 2.1 }, betrag: 4e12, bestechung: {}, waits: false, fresh: true, deliverable: false, blocked: "corp.js blockiert (no_space)" } } };
  const g = gateRoundStatus({ tele, blade: null, nowMs: JETZT });
  pruefe("F11: Befund nennt die blockierte Corp", g.findings.some((z) => /Corp liefert nicht/.test(z) && /no_space/.test(z)), g.findings.join(" | "));
}

// ===========================================================================
// SKEPTIKER RUNDE 2 (06.10.2026 abends): rot gegen bot/v2/src, gruen gegen bot/src
// ===========================================================================
console.log("\n-- R2-E2: Freiraum ist keine Ratsche - ein Ausgeber, der jede Runde alles Freie nimmt, bekommt hoechstens 500 Mrd --");
{
  let ausgegeben = 0;
  const ausgeber = (welt) => {
    corpFrisch(welt);
    const frei = welt.geld - Number(welt.dateien.home["data/geldbedarf.txt"] || 0);
    if (frei > 1e9) { ausgegeben += frei; welt.geld -= frei; }
  };
  const ausgeberE = (welt) => { ausgeber(welt); welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, ...mitErloes(1.5e12) }); };
  const w = weltBN3({ geld: 2e12, faktionen: (() => { const f = FAKT_BN3(); f.Tetrads.rep = 0; f["The Black Hand"].rep = 0; return f; })(),
    augs: { ...AUGS_BN3, "The Black Hand": { ...AUGS_BN3["The Black Hand"], basis: 1000e9 } }, schlafBudget: 40, beiSchlaf: ausgeberE,
    extraDateien: { "data/corp.json": corpJson(mitErloes(1.5e12)) } });
  await fahre(w);
  pruefe("R2-E2/R3-FIX1: Konto 2 Bio, davon 1,5 Bio Corp-Erloes: in 40 Runden geht nur das eigene Geld (0,5 Bio) an andere, der Erloes bleibt", ausgegeben <= 5e11 + 1 && ausgegeben >= 5e11 - 1,
    "ausgegeben " + (ausgegeben / 1e9).toFixed(0) + " Mrd");
}

console.log("\n-- R2-E3: angefordertes Corp-Geld ist geschuetzt, auch wenn das Tor 11 h entfernt ist --");
{
  const w = weltBN3({ geld: 2e12, extraDateien: { "data/corp.json": corpJson(mitErloes(1e12)) } });
  await fahre(w);
  const t = teleVon(w);
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("R2-E3/R3-FIX1: Erloes 1 Bio > volle Runde -> geldbedarf = volle Runde (53 Mrd)",
    !!t && t.torRunde && t.torRunde.corp && Math.abs(bedarf - t.torRunde.corp.plan.cost) <= 1 && bedarf > t.torRunde.plan.cost,
    "bedarf " + bedarf + ", voll " + (t && t.torRunde && t.torRunde.corp ? t.torRunde.corp.plan.cost : "?") + ", kaufbar " + (t && t.torRunde ? t.torRunde.plan.cost : "?"));
}

console.log("\n-- R2-E4: Spende passt nur mit Teilplan ins Konto -> wird trotzdem gespendet und gekauft --");
{
  const f = FAKT_BN3();
  f.Tetrads.favor = 160; f["The Black Hand"].rep = 310000;
  const w = weltBN3({ geld: 150e9, faktionen: f, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3000, beiSchlaf: kette(corpFrisch, antwortetBruecke) });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("R2-E4: an Tetrads gespendet und Bionic Arms gekauft (alt: nie gespendet, Bionic Arms fehlt)",
    w.spenden.some((x) => x.f === "Tetrads") && w.kaeufe.some((k) => k.a === "Bionic Arms"),
    "Spenden " + JSON.stringify(w.spenden.map((x) => [x.f, Math.round(x.betrag / 1e9)])) + ", Kaeufe " + w.kaeufe.map((k) => k.a).join(", "));
  console.log("        (Spendenzeilen: " + r.log.split(String.fromCharCode(10)).filter((z) => /SPENDE|gespendet|GESPENDET/.test(z)).join(" / ").slice(0, 400) + ")");
}
if (CG_PRE && CG_PRE.corpFitPlan) {
  const EIN = await import(pathToFileURL(path.join(SRC, "lib", "einbau.js")).href);
  const inp = [{ aug: "X", faktion: "F", rep: Infinity, repReq: 10, preis: 10, prereq: [], mults: { strength: 1.5 }, fehlt: 10, weg: "spende", spende: 100 },
    { aug: "Y", faktion: "G", rep: 5, repReq: 5, preis: 50, prereq: [], mults: { strength: 1.2 }, fehlt: 0, weg: "frei" }];
  const fit = CG_PRE.corpFitPlan(EIN.waehleTorRunde, inp, 120, new Set(), { skills: { strength: 100 } });
  pruefe("R2-E4b corpFitPlan: Plan + Spende <= Budget", fit.plan.cost + fit.spendeGeld <= 120, JSON.stringify([fit.plan.seq, fit.plan.cost, fit.spendeGeld]));
} else pruefe("R2-E4b corpFitPlan vorhanden", false);

console.log("\n-- R2-K5: Runde nur teilweise gekauft -> nicht 'fertig', es wird weiter angefordert --");
{
  const f = FAKT_BN3();
  f.Tetrads.rep = 200000; f["The Black Hand"].rep = 310000;
  const w = weltBN3({ geld: 600e9, faktionen: f, kaufSperre: ["BLADE-51b Tesla Armor"],
    extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 4, beiSchlaf: corpFrisch });
  await fahre(w);
  let st = null;
  try { st = JSON.parse(w.dateien.home["data/torrunde-corpwait.json"] || "null"); } catch { st = null; }
  pruefe("R2-K5: ein Stueck gekauft, dann Abbruch -> fertig nicht gesetzt (alt: fertig nach dem ersten Stueck)",
    w.kaeufe.length >= 1 && !(st && st.fertig === true), "Kaeufe " + w.kaeufe.map((k) => k.a).join(", ") + ", Zustand " + JSON.stringify(st));
}

console.log("\n-- R2-K6: corp.js verliert seinen Zustand (ignitedAt fehlt) -> alte Kaufschleife bleibt aus, auch nach Neustart --");
{
  let n = 0;
  const verlust = (welt) => { n++; if (n >= 1) welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, public: false, finance: null }); };
  const w = weltBN3({ geld: 600e9, schlafBudget: 6, beiSchlaf: verlust });
  const r = await fahre(w);
  pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
  pruefe("R2-K6: kein Kauf nach dem Zustandsverlust (alt: alte Schleife kauft)", w.kaeufe.length === 0, w.kaeufe.map((k) => k.a).join(", "));
  w.schlaf = []; w.schlafBudget = 4;
  await fahre(w);   // bn4rep neu gestartet, corp.json weiter ohne Zuendung
  pruefe("R2-K6b: auch nach Neustart von bn4rep kein Kauf (Merker data/corp-gezuendet.txt)", w.kaeufe.length === 0, w.kaeufe.map((k) => k.a).join(", "));
}


// ===========================================================================
// SKEPTIKER RUNDE 3: rot gegen bot/v3/src, gruen gegen bot/src
// ===========================================================================
console.log("\n-- R3-FIX1: Erloes aus einem frueheren Einbau (augReset 1) schuetzt nichts --");
{
  const w = weltBN3({ geld: 2e12, extraDateien: { "data/corp.json": corpJson(mitErloes(1e12, 1)) } });
  await fahre(w);
  const t = teleVon(w);
  const bedarf = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("R3-FIX1: geldbedarf = kaufbare Runde (v3: volle Runde)", !!t && t.torRunde && Math.abs(bedarf - t.torRunde.plan.cost) <= 1,
    "bedarf " + bedarf + ", kaufbar " + (t && t.torRunde ? t.torRunde.plan.cost : "?"));
}
console.log("\n-- R3-FIX2: corp.js hebt geldbedarf.txt nach dem Verkauf an - bn4rep setzt das nicht zurueck, bis erloesAug da ist --");
{
  let n = 0;
  const verkauf = (welt) => {
    n++;
    if (n === 2) {   // Verkauf: 300 Mrd an den Spieler, geldbedarf.txt sofort angehoben, corp.json noch ohne Erloes
      welt.geld += 300e9;
      welt.dateien.home["data/geldbedarf.txt"] = String(Number(welt.dateien.home["data/geldbedarf.txt"] || 0) + 300e9);
    }
    if (n === 6) welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, ...mitErloes(300e9) });
    else if (n < 6) corpFrisch(welt);
  };
  const w = weltBN3({ geld: 20e9, schlafBudget: 4, beiSchlaf: verkauf });
  await fahre(w);
  const b1 = Number(w.dateien.home["data/geldbedarf.txt"]);
  pruefe("R3-FIX2: zwei Runden nach dem Verkauf ist die Anhebung noch drin (>= 300 Mrd; v3: zurueckgesetzt)", b1 >= 300e9 - 1, "geldbedarf " + b1);
  w.schlaf = []; w.schlafBudget = 8;
  await fahre(w);
  const b2 = Number(w.dateien.home["data/geldbedarf.txt"]);
  const t = teleVon(w);
  pruefe("R3-FIX2b: nach erloesAug in corp.json gilt die normale Rechnung (min(volle Runde, Erloes))",
    !!t && t.torRunde && t.torRunde.corp && Math.abs(b2 - Math.min(t.torRunde.corp.plan.cost + 0, 300e9)) <= 1, "geldbedarf " + b2 + " " + JSON.stringify([t && t.torRunde && t.torRunde.plan, t && t.torRunde && t.torRunde.corp, w.geld]).slice(0, 600));
}
console.log("\n-- R3-KLEIN4: Tor offen, nichts mehr zu planen -> fertig, keine Tranche mehr --");
{
  const f = FAKT_BN3();
  f.Bladeburners.augs = ["GOLEM Serum"]; f.Tetrads.augs = [NFG]; f["The Black Hand"].augs = [NFG]; f["Sector-12"].augs = [NFG]; f.NiteSec.augs = [NFG];
  const w = weltBN3({ geld: 600e9, faktionen: f, warteschlange: ["Hyperion Plasma Cannon V1", "BLADE-51b Tesla Armor", "ORION-MKIV Shoulder"],
    extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3, beiSchlaf: corpFrisch });
  await fahre(w);
  let st = null;
  try { st = JSON.parse(w.dateien.home["data/torrunde-corpwait.json"] || "null"); } catch { st = null; }
  const q = reqVon(w);
  pruefe("R3-KLEIN4: fertig gesetzt, Anforderung 0 (v3: nicht fertig)", !!st && st.fertig === true && !!q && q.betrag === 0, JSON.stringify(st));
}
console.log("\n-- R3-KLEIN5/6: corpFitPlan nimmt den besseren Plan; Spende mit x1,02 --");
if (CG_PRE && CG_PRE.corpFitPlan) {
  const EIN = await import(pathToFileURL(path.join(SRC, "lib", "einbau.js")).href);
  const inp = [{ aug: "X", faktion: "F", rep: Infinity, repReq: 10, preis: 1, prereq: [], mults: { strength: 1.1 }, fehlt: 10, weg: "spende", spende: 100 },
    { aug: "Y", faktion: "G", rep: 5, repReq: 5, preis: 50, prereq: [], mults: { strength: 1.5 }, fehlt: 0, weg: "frei" }];
  const fit = CG_PRE.corpFitPlan(EIN.waehleTorRunde, inp, 120, new Set(), { skills: { strength: 100 } });
  pruefe("R3-KLEIN5: ohne die teure Spende (Y, Gewinn x1,5) statt X allein (v3: X)", fit.plan.seq.join(",") === "Y" && fit.spendeGeld === 0, JSON.stringify([fit.plan.seq, fit.plan.gain]));
  const inp2 = CG_PRE.corpPlanInput([{ aug: "B", faktion: "T", rep: 0, repReq: 100 }], { donate: { threshold: 75, favorOf: () => 80, geldFuerRep: (r) => r * 1e6 } });
  pruefe("R3-KLEIN6: Spendenbetrag im Plan mit x1,02 (102 Mio fuer 100 Ruf; v3: 100 Mio)", inp2[0].spende === 102e6, JSON.stringify(inp2));
}


// ===========================================================================
// NACHPRUEFER RUNDE 3: rot gegen bot/v4/src, gruen gegen bot/src
// ===========================================================================
console.log("\n-- N-ERNST-1: corp.json zeigt den Erloes schon in derselben Runde -> nicht doppelt zaehlen --");
{
  let n = 0;
  const verkauf = (welt) => {
    n++;
    if (n === 2) {   // Verkauf 300 Mrd: geldbedarf angehoben UND corp.json im selben Zyklus
      welt.geld += 300e9;
      welt.dateien.home["data/geldbedarf.txt"] = String(Number(welt.dateien.home["data/geldbedarf.txt"] || 0) + 300e9);
    }
    welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, ...(n >= 2 ? mitErloes(300e9) : {}) });
  };
  const w = weltBN3({ geld: 20e9, schlafBudget: 4, beiSchlaf: verkauf });
  await fahre(w);
  const b = Number(w.dateien.home["data/geldbedarf.txt"]);
  const t = teleVon(w);
  const soll = t && t.torRunde && t.torRunde.corp ? Math.min(t.torRunde.corp.plan.cost, 300e9) : NaN;
  pruefe("N-ERNST-1: Ruecklage = min(volle Runde, Erloes) = " + Math.round(soll / 1e9) + " Mrd (v4: bis zum Konto aufgeblaeht)", Math.abs(b - soll) <= 1,
    "geldbedarf " + b + ", Konto " + w.geld);
}
console.log("\n-- N-ERNST-2: Corp liefert NICHT, nichts kaufbar -> nicht 'fertig' --");
{
  const f = FAKT_BN3();
  f.Bladeburners.augs = ["GOLEM Serum"]; f.Tetrads.augs = [NFG]; f["The Black Hand"].augs = [NFG]; f["Sector-12"].augs = [NFG]; f.NiteSec.augs = [NFG];
  const alt = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, state: "blocked", blockedReason: "no_space" }); };
  const w = weltBN3({ geld: 600e9, faktionen: f, warteschlange: ["Hyperion Plasma Cannon V1", "BLADE-51b Tesla Armor", "ORION-MKIV Shoulder"],
    extraDateien: { "data/einbau-uhr.json": UHR_OFFEN }, schlafBudget: 3, beiSchlaf: alt });
  alt(w);
  await fahre(w);
  let st = null;
  try { st = JSON.parse(w.dateien.home["data/torrunde-corpwait.json"] || "null"); } catch { st = null; }
  pruefe("N-ERNST-2: Corp blockiert -> fertig NICHT gesetzt (v4: gesetzt)", !(st && st.fertig === true), JSON.stringify(st));
}
console.log("\n-- N-ERNST-2b: Budget zu klein (Konto 0, keine Tranche), aber Stuecke in Reichweite -> nicht 'fertig' --");
{
  const w = weltBN3({ geld: 0, extraDateien: { "data/einbau-uhr.json": UHR_OFFEN, "data/corp.json": corpJson({ owned: 0 }) },
    schlafBudget: 3, beiSchlaf: (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, owned: 0 }); } });
  await fahre(w);
  let st = null;
  try { st = JSON.parse(w.dateien.home["data/torrunde-corpwait.json"] || "null"); } catch { st = null; }
  pruefe("N-ERNST-2b: fertig NICHT gesetzt (v4: gesetzt)", !(st && st.fertig === true), JSON.stringify(st));
}
if (CG_PRE) {
  const r = CG_PRE.corpPendingRaise(null, { homeValue: 400e9, lastWritten: 100e9, erloes: 300e9, erloesAtWrite: 0, nowMs: 1 });
  pruefe("N-ERNST-1b corpPendingRaise: Erloes schon da -> keine schwebende Anhebung", r.pend === null && r.extra === 0, JSON.stringify(r));
}

// ===========================================================================
// H3 (06.10.2026 abends): erste Corp-Runde des Knotens mit 6 h statt 12 h Einbausperre.
// Rot gegen den Spiegel vor H3 (H3-1, H3-8), gruen gegen bot/src; alle anderen sind Gegenproben.
// ===========================================================================
{
  const H = 3600000;
  // 7 h seit dem Ende des Aufbaus, Aufbau 0,1 h (BN3.1 live: 5,7 min): alt gesperrt (12 h), neu frei (6 h).
  const UHR_7H = JSON.stringify({ augReset: 2, playtime: PLAYTIME_NOW - 7.1 * H, fertig: PLAYTIME_NOW - 7 * H });
  const UHR_5H = JSON.stringify({ augReset: 2, playtime: PLAYTIME_NOW - 5.1 * H, fertig: PLAYTIME_NOW - 5 * H });
  const geliefert = () => { const f = FAKT_BN3(); f.Tetrads.rep = 200000; f["The Black Hand"].rep = 310000; f.NiteSec.rep = 40000; return f; };
  // corp.json je Schlaf frisch, mit dem Finanzteil `fin` (erloesAug, soldTotal, sales, bribed)
  const corpMit = (fin) => (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, finance: { ...FIN0, ...fin } }); };
  const lauf = async (uhr, fin, o = {}) => {
    const w = weltBN3({ geld: 600e9, faktionen: geliefert(), extraDateien: { "data/einbau-uhr.json": uhr }, schlafBudget: 80,
      beiSchlaf: kette(corpMit(fin), antwortetBruecke), ...o });
    corpMit(fin)(w);
    const r = await fahre(w);
    return { w, r, t: teleVon(w) };
  };
  const ERLOES = { erloesAug: { augReset: 2, summe: 40e9 }, soldTotal: 40e9, sales: [{ h: 9.6, wall: JETZT - H, got: 40e9 }] };

  console.log("\n-- H3-1: erste Corp-Runde (Erloes seit diesem Einbau), 7 h nach dem Aufbau -> Runde und Einbau (alt: gesperrt bis 12 h) --");
  {
    const { w, r, t } = await lauf(UHR_7H, ERLOES);
    pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
    pruefe("H3-1: Runde gekauft (Bionic Arms, The Black Hand)", w.kaeufe.some((k) => k.a === "Bionic Arms") && w.kaeufe.some((k) => k.a === "The Black Hand"),
      w.kaeufe.map((k) => k.a).join(", ") + " | Modus " + (t && t.torRunde ? t.torRunde.mode + " " + t.torRunde.reason : "?"));
    pruefe("H3-1: und eingebaut", w.installAufrufe === 1, "install " + w.installAufrufe);
  }
  console.log("\n-- H3-2: Zuendung, aber noch KEIN Corp-Geld in dieser Runde -> 12 h bleiben --");
  {
    const { w, r, t } = await lauf(UHR_7H, { erloesAug: { augReset: 2, summe: 0 }, soldTotal: 0, sales: [] });
    pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
    pruefe("H3-2: kein Kauf, kein Einbau, Tor gesperrt (bezahlt gemacht)", w.kaeufe.length === 0 && w.installAufrufe === 0
      && !!t && t.torRunde && t.torRunde.mode === "locked" && /bezahlt/.test(t.torRunde.reason || ""),
      w.kaeufe.map((k) => k.a).join(", ") + " | " + (t && t.torRunde ? t.torRunde.mode + " " + t.torRunde.reason : "?"));
  }
  console.log("\n-- H3-3: Corp-Geld, aber schon eine Corp-Runde in einem frueheren Einbau (soldTotal > Erloes) -> 12 h --");
  {
    const { w, t } = await lauf(UHR_7H, { ...ERLOES, soldTotal: 140e9 });
    pruefe("H3-3: kein Kauf, kein Einbau", w.kaeufe.length === 0 && w.installAufrufe === 0,
      w.kaeufe.map((k) => k.a).join(", ") + " | " + (t && t.torRunde ? t.torRunde.mode : "?"));
  }
  console.log("\n-- H3-4: Verkauf vor diesem Einbau (sales.wall < augReset) -> 12 h --");
  {
    const { w } = await lauf(UHR_7H, { ...ERLOES, sales: [{ h: 3, wall: 1, got: 1e9 }, ...ERLOES.sales] });
    pruefe("H3-4: kein Einbau", w.installAufrufe === 0 && w.kaeufe.length === 0, "install " + w.installAufrufe);
  }
  console.log("\n-- H3-5: erste Corp-Runde, aber erst 5 h nach dem Aufbau -> gesperrt (6 h) --");
  {
    const { w, t } = await lauf(UHR_5H, ERLOES);
    pruefe("H3-5: kein Kauf, kein Einbau, Grund nennt die 6 h", w.kaeufe.length === 0 && w.installAufrufe === 0
      && !!t && t.torRunde && /6 h/.test(t.torRunde.reason || ""), t && t.torRunde ? String(t.torRunde.reason) : "?");
  }
  console.log("\n-- H3-6: nur Bestechung seit diesem Einbau (kein Verkauf) zaehlt als Corp-Geld --");
  {
    const { w } = await lauf(UHR_7H, { erloesAug: { augReset: 2, summe: 0 }, soldTotal: 0, sales: [], bribed: { Tetrads: { wall: JETZT - H, rep: 186500, total: 186500 } } });
    pruefe("H3-6: Runde und Einbau", w.installAufrufe === 1, "install " + w.installAufrufe + ", Kaeufe " + w.kaeufe.map((k) => k.a).join(", "));
  }
  console.log("\n-- H3-7: ohne Zuendung (alte Schleife) gelten weiter 12 h --");
  {
    const ohne = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, public: false, finance: null, valuation: 4e11 }); };
    const mk = (uhr) => weltBN3({ geld: 600e9, faktionen: geliefert(), extraDateien: { "data/einbau-uhr.json": uhr }, schlafBudget: 80, beiSchlaf: kette(ohne, antwortetBruecke) });
    const wOffen = mk(UHR_OFFEN); ohne(wOffen); await fahre(wOffen);
    const w7 = mk(UHR_7H); ohne(w7); await fahre(w7);
    pruefe("H3-7: Gegenprobe - mit offener Uhr baut die alte Schleife ein", wOffen.installAufrufe === 1, "install " + wOffen.installAufrufe);
    pruefe("H3-7: 7 h nach dem Aufbau baut sie NICHT ein", w7.installAufrufe === 0, "install " + w7.installAufrufe);
  }
  console.log("\n-- H3-8: Telemetrie torRunde.corp.firstRound --");
  {
    const { t } = await lauf(UHR_5H, ERLOES, { schlafBudget: 3 });
    pruefe("H3-8: firstRound true bei Erloes ohne Vorgeschichte", !!t && t.torRunde && t.torRunde.corp && t.torRunde.corp.firstRound === true,
      t && t.torRunde && t.torRunde.corp ? JSON.stringify(t.torRunde.corp).slice(0, 200) : "?");
  }
  let CGH = null;
  try { CGH = await import(pathToFileURL(path.join(SRC, "lib", "corpgeld.js")).href); } catch { CGH = null; }
  const fr = CGH && CGH.corpFirstRound;
  pruefe("H3-9: lib/corpgeld.js exportiert corpFirstRound", typeof fr === "function");
  if (typeof fr === "function") {
    const tel = (fin, over = {}) => JSON.parse(corpJson({ finance: { ...FIN0, ...fin }, ...over }));
    pruefe("H3-9a erste Runde", fr(tel(ERLOES), NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: 2 }).first === true);
    pruefe("H3-9b anderer Knoten -> nein", fr(tel(ERLOES), NODE_RESET + 1, 2).first === false);
    pruefe("H3-9c corp.json null -> nein", fr(null, NODE_RESET, 2).first === false);
    {
      const r9d = fr(tel({ erloesAug: { augReset: 1, summe: 40e9 }, soldTotal: 40e9 }), NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: 2 });
      pruefe("H3-9d Erloes eines anderen Einbaus zaehlt nicht (passender Merker, uses false)", r9d.uses === false && r9d.first === false, JSON.stringify(r9d));
    }
    pruefe("H3-9e Bestechung vor diesem Einbau -> frueher", fr(tel({ ...ERLOES, bribed: { Tetrads: { wall: 1, rep: 5, total: 5 } } }), NODE_RESET, 2).earlier === true);
    pruefe("H3-9f Schaetzung der offenen Buchung (summe > soldTotal) ist keine fruehere Runde",
      fr(tel({ ...ERLOES, erloesAug: { augReset: 2, summe: 44e9 } }), NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: 2 }).first === true);
  }

  // -------------------------------------------------------------------------
  // SKEPTIKER H3 (06.10.2026 abends): eigener Merker data/corp-first-round.json statt corp.js-Feldern.
  // Rot gegen den H3-Stand davor (H3-10, H3-11, H3-12, H3-15, H3-16), gruen jetzt.
  // -------------------------------------------------------------------------
  const FIRST = "data/corp-first-round.json";
  const merker = (augReset, nodeReset = NODE_RESET) => JSON.stringify({ nodeReset, augReset });
  const uhrFuer = (augReset, seitH) => JSON.stringify({ augReset, playtime: PLAYTIME_NOW - (seitH + 0.1) * H, fertig: PLAYTIME_NOW - seitH * H });
  const lauf2 = async ({ augReset = 2, seitH = 7, fin, dateien = {}, corp = null }) => {
    const w = weltBN3({ geld: 600e9, faktionen: geliefert(), extraDateien: { "data/einbau-uhr.json": uhrFuer(augReset, seitH), ...dateien },
      schlafBudget: 80, beiSchlaf: kette(corp || corpMit(fin), antwortetBruecke) });
    w.augReset = augReset;
    (corp || corpMit(fin))(w);
    const r = await fahre(w);
    return { w, r, t: teleVon(w) };
  };

  console.log("\n-- H3-10: zweite Corp-Runde, die NUR besticht (corp.js ueberschreibt bribed.wall) -> 12 h --");
  {
    const { w, r } = await lauf2({ fin: { erloesAug: { augReset: 2, summe: 0 }, soldTotal: 0, sales: [], bribed: { Tetrads: { wall: JETZT - H, rep: 186500, total: 400000 } } },
      dateien: { [FIRST]: merker(1) } });
    pruefe("Nachbau vollstaendig", vollstaendig(r), vollHinweis(r));
    pruefe("H3-10: Merker aus Zyklus 1 -> kein Einbau nach 7 h (vorher: 6 h, eingebaut)", w.installAufrufe === 0 && w.kaeufe.length === 0,
      "install " + w.installAufrufe + ", Kaeufe " + w.kaeufe.map((k) => k.a).join(", "));
  }
  console.log("\n-- H3-11: Zustandsverlust von corp.js (soldTotal/sales nur aus diesem Zyklus) -> 12 h dank Merker --");
  {
    const { w } = await lauf2({ fin: ERLOES, dateien: { [FIRST]: merker(1) } });
    pruefe("H3-11: kein Einbau (vorher: sah wie die erste Runde aus)", w.installAufrufe === 0, "install " + w.installAufrufe);
  }
  console.log("\n-- H3-12: Einbau OHNE Corp-Geld nach der Zuendung verbraucht die Ausnahme --");
  {
    // Zyklus 2: gezuendet, Corp liefert nicht (corp.json 30 min alt) -> kaufbare Runde, Einbau ohne Corp-Geld
    const altCorp = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: JETZT - 30 * 60000, wall: JETZT - 30 * 60000 }); };
    const a = await lauf2({ augReset: 2, seitH: 30, corp: altCorp });
    pruefe("H3-12a: Zyklus 2 baut ohne Corp-Geld ein", a.w.installAufrufe === 1, "install " + a.w.installAufrufe);
    const m = a.w.dateien.home[FIRST];
    pruefe("H3-12b: Merker fuer Zyklus 2 geschrieben", !!m && JSON.parse(m).augReset === 2 && JSON.parse(m).nodeReset === NODE_RESET, String(m));
    // Zyklus 3: erste Runde MIT Corp-Geld, 7 h nach dem Aufbau
    const b = await lauf2({ augReset: 3, fin: { ...ERLOES, erloesAug: { augReset: 3, summe: 40e9 } }, dateien: m ? { [FIRST]: m } : {} });
    pruefe("H3-12c: Zyklus 3 hat 12 h - kein Einbau nach 7 h (vorher: 6 h, eingebaut)", b.w.installAufrufe === 0, "install " + b.w.installAufrufe);
  }
  console.log("\n-- H3-13: Einbau VOR der Zuendung verbraucht sie nicht (zweiter Einbau = erste Corp-Runde) --");
  {
    const ohne = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, public: false, finance: null, valuation: 4e11 }); };
    const a = await lauf2({ augReset: 2, seitH: 30, corp: ohne });
    pruefe("H3-13a: Zyklus 2 (ohne Zuendung) baut ein, kein Merker", a.w.installAufrufe === 1 && !(FIRST in a.w.dateien.home), "install " + a.w.installAufrufe);
    const b = await lauf2({ augReset: 3, fin: { ...ERLOES, erloesAug: { augReset: 3, summe: 40e9 } } });
    pruefe("H3-13b: Zyklus 3 = erste Corp-Runde: 6 h, Einbau nach 7 h", b.w.installAufrufe === 1, "install " + b.w.installAufrufe);
  }
  console.log("\n-- H3-14: Merker aus einem anderen Knoten zaehlt wie keiner --");
  {
    const { w } = await lauf2({ fin: ERLOES, dateien: { [FIRST]: merker(2, NODE_RESET - 5) } });
    const m = w.dateien.home[FIRST];
    pruefe("H3-14: Einbau nach 7 h, Merker neu fuer diesen Knoten", w.installAufrufe === 1 && !!m && JSON.parse(m).nodeReset === NODE_RESET && JSON.parse(m).augReset === 2,
      "install " + w.installAufrufe + ", Merker " + m);
  }
  console.log("\n-- H3-15: kaputter Merker gilt als verbraucht --");
  {
    const { w } = await lauf2({ fin: ERLOES, dateien: { [FIRST]: "kaputt{" } });
    const m = w.dateien.home[FIRST];
    pruefe("H3-15: kein Einbau, Merker ueberschrieben mit augReset null", w.installAufrufe === 0 && !!m && m.startsWith("{") && JSON.parse(m).augReset === null,
      "install " + w.installAufrufe + ", Merker " + m);
  }
  console.log("\n-- H3-16: data/einbau.json zeigt die 6-h-Frist getrennt (combatEarlyCorp) --");
  {
    const { w } = await lauf2({ fin: ERLOES, seitH: 7 });
    let e = null; try { e = JSON.parse(w.dateien.home["data/einbau.json"] || "null"); } catch { e = null; }
    pruefe("H3-16: kampfZuFrueh true (12 h, punish.js), combatEarlyCorp false (6 h vorbei)", !!e && e.kampfZuFrueh === true && e.combatEarlyCorp === false,
      e ? JSON.stringify({ k: e.kampfZuFrueh, c: e.combatEarlyCorp, f: e.corpFirstRound }) : "keine einbau.json");
  }
  const lt = CGH && CGH.corpFirstLatch;
  pruefe("H3-17: lib/corpgeld.js exportiert corpFirstLatch", typeof lt === "function");
  if (typeof lt === "function") {
    pruefe("H3-17a fehlt -> neu, schreiben", JSON.stringify(lt("", false, 7, 9)) === JSON.stringify({ latch: { nodeReset: 7, augReset: 9 }, write: true }));
    pruefe("H3-17b liegt da, aber nicht lesbar -> kein Merker, nicht schreiben", lt("", true, 7, 9).latch === null && lt("", true, 7, 9).write === false);
    pruefe("H3-17c gleicher Knoten -> unveraendert", JSON.stringify(lt(merker(5, 7), true, 7, 9)) === JSON.stringify({ latch: { nodeReset: 7, augReset: 5, used: false }, write: false }));
    {
      const telE = JSON.parse(corpJson({ finance: { ...FIN0, ...ERLOES } }));
      pruefe("H3-17d derselbe Erloes: passender Merker -> erste Runde, Merker eines anderen Zyklus -> nicht",
        fr(telE, NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: 2 }).first === true
        && fr(telE, NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: 1 }).first === false
        && fr(telE, NODE_RESET, 2, { nodeReset: NODE_RESET, augReset: null }).first === false);
    }
  }

  // -------------------------------------------------------------------------
  // SKEPTIKER H3 RUNDE 2: Verbrauch vor dem Einbau, sticky, durchgehender Ablauf.
  // Rot gegen den Stand davor: H3-19b, H3-21b/c, H3-22, H3-23, H3-24.
  // -------------------------------------------------------------------------
  const merkerVon = (w) => { try { return JSON.parse(w.dateien.home[FIRST] || "null"); } catch { return "kaputt"; } };
  // Naechster Zyklus in DERSELBEN Welt: alles, was bn4rep auf home hinterlassen hat, bleibt liegen.
  const naechsterZyklus = async (w, augReset, fin, o = {}) => {
    w.augReset = augReset;
    w.dateien.home["data/einbau-uhr.json"] = uhrFuer(augReset, o.seitH ?? 7);
    delete w.dateien.home["data/backup-request.txt"]; delete w.dateien.home["data/backup-ok.txt"];
    w.kaeufe = []; w.installAufrufe = 0; w.schlaf = []; w.schlafBudget = 80;
    if (o.gang !== undefined) w.gang.da = o.gang;
    w.beiSchlaf = kette(corpMit(fin), antwortetBruecke); corpMit(fin)(w);
    if (o.vorher) o.vorher(w);
    const r = await fahre(w);
    return { w, r };
  };
  const ERLOES3 = { ...ERLOES, erloesAug: { augReset: 3, summe: 40e9 } };

  console.log("\n-- H3-18: durchgehend - Zyklus 2 erste Corp-Runde baut ein, Zyklus 3 liest den Merker selbst --");
  {
    const a = await lauf2({ fin: ERLOES });
    const m2 = merkerVon(a.w);
    pruefe("H3-18a: Zyklus 2 baut nach 7 h ein, Merker {augReset 2}", a.w.installAufrufe === 1 && !!m2 && m2.augReset === 2, "install " + a.w.installAufrufe + ", Merker " + JSON.stringify(m2));
    const b = await naechsterZyklus(a.w, 3, ERLOES3);
    pruefe("H3-18b: Zyklus 3 (zweite Corp-Runde) baut nach 7 h NICHT ein", b.w.installAufrufe === 0, "install " + b.w.installAufrufe);
    // Gegenprobe: dieselbe Kette ohne den Merker - dann baute Zyklus 3 ein (es ist wirklich der Merker).
    const c = await lauf2({ fin: ERLOES });
    const d = await naechsterZyklus(c.w, 3, ERLOES3, { vorher: (w) => { delete w.dateien.home[FIRST]; } });
    pruefe("H3-18c: Gegenprobe ohne Merker baut Zyklus 3 ein", d.w.installAufrufe === 1, "install " + d.w.installAufrufe);
  }
  console.log("\n-- H3-19: sticky - first war true, danach verliert corp.js erloesAug --");
  {
    const a = await lauf2({ fin: ERLOES, dateien: {} }).catch((e) => ({ w: null, e }));
    pruefe("H3-19a: Merker traegt used:true nach einer ersten Corp-Runde", !!a.w && merkerVon(a.w) && merkerVon(a.w).used === true, a.w ? JSON.stringify(merkerVon(a.w)) : String(a.e));
    const { w } = await lauf2({ fin: { erloesAug: { augReset: 2, summe: 0 }, soldTotal: 0, sales: [] },
      dateien: { [FIRST]: JSON.stringify({ nodeReset: NODE_RESET, augReset: 2, used: true }) } });
    pruefe("H3-19b: used:true haelt first ohne Erloes -> Einbau nach 7 h", w.installAufrufe === 1, "install " + w.installAufrufe);
  }
  console.log("\n-- H3-20: scp-Fehler beim Merker -> liegt nicht auf home -> 12 h --");
  {
    const w = weltBN3({ geld: 600e9, faktionen: geliefert(), extraDateien: { "data/einbau-uhr.json": uhrFuer(2, 7) }, schlafBudget: 80,
      beiSchlaf: kette(corpMit(ERLOES), antwortetBruecke) });
    w.scpFehler = new Set([FIRST]); corpMit(ERLOES)(w);
    await fahre(w);
    pruefe("H3-20: kein Einbau, kein Merker auf home", w.installAufrufe === 0 && !(FIRST in w.dateien.home), "install " + w.installAufrufe);
  }
  console.log("\n-- H3-21: corp.json den ganzen Zyklus unlesbar (Zuendung nur im Merker corp-gezuendet.txt) --");
  {
    const kaputt = (welt) => { welt.dateien.home["data/corp.json"] = "kaputt{"; };
    const mk = (first) => {
      const w = weltBN3({ geld: 600e9, faktionen: geliefert(),
        extraDateien: { "data/einbau-uhr.json": uhrFuer(2, 7), "data/corp-gezuendet.txt": String(NODE_RESET), ...(first ? { [FIRST]: first } : {}) },
        schlafBudget: 80, beiSchlaf: kette(kaputt, antwortetBruecke) });
      kaputt(w); return w;
    };
    const w0 = mk(null); await fahre(w0);
    pruefe("H3-21a: ohne festgehaltene Runde -> 12 h, kein Einbau", w0.installAufrufe === 0, "install " + w0.installAufrufe);
    const w1 = mk(JSON.stringify({ nodeReset: NODE_RESET, augReset: 2, used: true })); await fahre(w1);
    pruefe("H3-21b: mit used:true -> erste Corp-Runde haelt, Einbau", w1.installAufrufe === 1, "install " + w1.installAufrufe);
    const w2 = mk(JSON.stringify({ nodeReset: NODE_RESET, augReset: 2 })); await fahre(w2);
    pruefe("H3-21c: Merker ohne used -> 12 h", w2.installAufrufe === 0, "install " + w2.installAufrufe);
  }
  console.log("\n-- H3-22: Einbau ohne corpGate-Sichtung (Gang) nach der Zuendung -> Verbrauchs-Merker -> naechster Zyklus 12 h --");
  {
    const w = weltBN3({ geld: 600e9, faktionen: geliefert(), gang: { da: true }, extraDateien: { "data/einbau-uhr.json": uhrFuer(2, 30) }, schlafBudget: 80,
      beiSchlaf: kette(corpMit(ERLOES), antwortetBruecke) });
    w.augReset = 2; corpMit(ERLOES)(w);
    await fahre(w);
    const m = merkerVon(w);
    pruefe("H3-22a: mit Gang eingebaut, Verbrauchs-Merker {augReset null}", w.installAufrufe === 1 && !!m && m.nodeReset === NODE_RESET && m.augReset === null,
      "install " + w.installAufrufe + ", Merker " + JSON.stringify(m));
    const b = await naechsterZyklus(w, 3, ERLOES3, { gang: false });
    pruefe("H3-22b: Zyklus 3 ohne Gang, Corp-Geld, 7 h -> kein Einbau", b.w.installAufrufe === 0, "install " + b.w.installAufrufe);
  }
  console.log("\n-- H3-23: Einbau VOR der Zuendung schreibt keinen Verbrauchs-Merker --");
  {
    const ohne = (welt) => { welt.dateien.home["data/corp.json"] = corpJson({ ts: welt.uhr - 5000, wall: welt.uhr - 5000, public: false, finance: null, valuation: 4e11 }); };
    const w = weltBN3({ geld: 600e9, faktionen: geliefert(), gang: { da: true }, extraDateien: { "data/einbau-uhr.json": uhrFuer(2, 30) }, schlafBudget: 80,
      beiSchlaf: kette(ohne, antwortetBruecke) });
    ohne(w); await fahre(w);
    pruefe("H3-23: eingebaut, kein Merker", w.installAufrufe === 1 && !(FIRST in w.dateien.home), "install " + w.installAufrufe + ", Merker " + w.dateien.home[FIRST]);
  }
  const cl = CGH && CGH.corpConsumeLatch;
  pruefe("H3-24: lib/corpgeld.js exportiert corpConsumeLatch", typeof cl === "function");
  if (typeof cl === "function") {
    const telZ = JSON.parse(corpJson());
    const basis = { tel: telZ, ignitedLatch: "", knoten: 3, nodeReset: NODE_RESET, latchRaw: "", latchExists: false };
    pruefe("H3-24a gezuendet, kein Merker -> verbraucht", cl(basis) === JSON.stringify({ nodeReset: NODE_RESET, augReset: null }));
    pruefe("H3-24b Merker dieses Knotens liegt -> nichts", cl({ ...basis, latchRaw: merker(2), latchExists: true }) === null);
    pruefe("H3-24c Merker eines anderen Knotens -> verbraucht", cl({ ...basis, latchRaw: merker(2, 7), latchExists: true }) !== null);
    pruefe("H3-24d nicht gezuendet -> nichts", cl({ ...basis, tel: JSON.parse(corpJson({ public: false, finance: null })) }) === null);
    pruefe("H3-24e Zuendung nur aus corp-gezuendet.txt -> verbraucht", cl({ ...basis, tel: null, ignitedLatch: String(NODE_RESET) }) !== null);
    pruefe("H3-24f anderer Knoten (BN9) -> nichts", cl({ ...basis, knoten: 9 }) === null);
    pruefe("H3-24g Merker liegt, aber unlesbar -> nichts", cl({ ...basis, latchRaw: "", latchExists: true }) === null);
  }
}

// ===========================================================================
// lib/corpgeld.js einzeln
// ===========================================================================
console.log("\n-- E: lib/corpgeld.js einzeln --");
let CG = null;
try { CG = await import(pathToFileURL(path.join(SRC, "lib", "corpgeld.js")).href); } catch { CG = null; }
pruefe("lib/corpgeld.js vorhanden", !!CG);
if (CG) try {
  const tel = JSON.parse(corpJson());
  const sig = (o = {}) => CG.corpSignal(o.tel === undefined ? tel : o.tel, { knoten: 3, nodeReset: NODE_RESET, nurKampfStuecke: true, nowMs: JETZT, ...o });
  pruefe("E1 Signal an bei ignitedAt, frisch", sig().active && sig().fresh);
  pruefe("E2 aus: nicht gezuendet, nicht oeffentlich", !sig({ tel: { ...tel, public: false, finance: { ignitedAt: null } } }).active);
  pruefe("E3 an: oeffentlich ohne ignitedAt", sig({ tel: { ...tel, finance: null } }).active);
  pruefe("E4 aus: Knoten 2 / V1 / anderer nodeReset / fehlt", !sig({ knoten: 2 }).active && !sig({ nurKampfStuecke: false }).active
    && !sig({ nodeReset: 5 }).active && !sig({ tel: null }).active);
  pruefe("E5 an, aber nicht frisch: 21 min alt", sig({ nowMs: JETZT - 5000 + 21 * 60000 }).active && !sig({ nowMs: JETZT - 5000 + 21 * 60000 }).fresh);
  const inp = CG.corpPlanInput([
    { aug: "A", faktion: "Bladeburners", rep: 10, repReq: 100 },
    { aug: "B", faktion: "X", rep: 10, repReq: 100 },
    { aug: "B", faktion: "Y", rep: 50, repReq: 100 },
    { aug: "C", faktion: "Z", rep: 100, repReq: 100 },
  ], {});
  pruefe("E6 Eingabe: verdient zuerst, Bladeburners ohne Ruf faellt weg, je Name kleinster Fehlbetrag zuerst",
    inp.map((k) => k.aug + k.faktion).join(",") === "CZ,BY,BX" && inp[1].rep === Infinity && inp[1].fehlt === 50, JSON.stringify(inp));
  const req = CG.corpRequest({ steps: [{ aug: "C", faktion: "Z" }, { aug: "B", faktion: "Y" }], cost: 5e12 }, inp, 1e12);
  pruefe("E7 Anforderung: betrag = Kosten - Konto, Bestechung nur fuer Planstuecke", req.betrag === 4e12 && JSON.stringify(req.bestechung) === JSON.stringify({ Y: 50 }) && req.ruf === 50, JSON.stringify(req));
  pruefe("E8 betrag nie negativ", CG.corpRequest({ steps: [], cost: 1e9 }, [], 5e9).betrag === 0);
  const txt = JSON.parse(CG.corpRequestText({ nowMs: 7, nodeReset: 1, augReset: 2, betrag: 3.4, bestechung: { Y: 50 } }));
  pruefe("E9 Text: genau die Schnittstelle", Object.keys(txt).join(",") === "v,ts,nodeReset,augReset,betrag,bestechung,von" && txt.betrag === 3, JSON.stringify(txt));
  let st = null;
  const base = { gateOpen: true, deliverable: true, gainNow: 1.5, gainFull: 2.2, betrag: 1e15, ruf: 1e5 };
  let wr = CG.corpWait(st, { ...base, nowMs: 0 }); st = wr.state;
  pruefe("E10 wartet bei offenem Tor, frisch, Gewinn x1,47", wr.waits);
  pruefe("E11 kein Warten: Tor zu / liefert nicht / Gewinn < 5 %", !CG.corpWait(st, { ...base, nowMs: 1, gateOpen: false }).waits
    && !CG.corpWait(st, { ...base, nowMs: 1, deliverable: false }).waits && !CG.corpWait(st, { ...base, nowMs: 1, gainFull: 1.55 }).waits);
  for (let t = 15000; t <= 91 * 60000; t += 15000) { wr = CG.corpWait(st, { ...base, nowMs: t }); st = wr.state; }
  pruefe("E12 nach 91 min ohne Fortschritt: kein Warten mehr", !wr.waits, wr.reason);
  st = null;
  for (let t = 0, sf = 1e15; t <= 4.1 * 3600000; t += 15000) { if (t % (30 * 60000) === 0) sf *= 0.8; wr = CG.corpWait(st, { ...base, nowMs: t, betrag: sf }); st = wr.state; }
  pruefe("E13 mit Fortschritt: nach 4 h aktiver Zeit Schluss", !wr.waits && /4\.\d h/.test(wr.reason), wr.reason);
  st = null; wr = CG.corpWait(st, { ...base, nowMs: 0 }); st = wr.state;
  wr = CG.corpWait(st, { ...base, nowMs: 8 * 3600000 }); st = wr.state;
  pruefe("E14 Pause von 8 h (Rechner aus) zaehlt nicht als Wartezeit", wr.waits && st.aktivMs === 0, JSON.stringify(st));
  pruefe("E15 Zustand gilt nur fuer denselben Einbau", CG.readCorpWaitState({ ...st, augReset: 5 }, 8 * 3600000, 5) !== null
    && CG.readCorpWaitState({ ...st, augReset: 4 }, 8 * 3600000, 5) === null);
} catch (e) { pruefe("E-Teil: Schnittstelle von lib/corpgeld.js passt", false, String(e).slice(0, 120)); }

// ===========================================================================
// Leser tools/lib/gate-round-status.js (Spiegel bzw. alt)
// ===========================================================================
console.log("\n-- L: Check-in-Leser kennt corpwait und die Corp-Zeile --");
{
  const { gateRoundStatus } = await import(pathToFileURL(path.join(SRC, "..", "tools", "lib", "gate-round-status.js")).href);
  const tele = { zeit: JETZT, torRunde: { mode: "corpwait", plan: { n: 3, cost: 1e10, gain: 1.3 },
    corp: { plan: { n: 6, cost: 5e12, gain: 2.1 }, betrag: 4e12, bestechung: { Tetrads: 186500 }, waits: true, waitNote: "wartet seit 12 min", fresh: true } } };
  const g = gateRoundStatus({ tele, blade: null, nowMs: JETZT });
  pruefe("L1 Zeile fuer corpwait (nicht 'Modus corpwait')", g.lines.some((z) => /Corp kommen noch/.test(z)), g.lines.join(" | "));
  pruefe("L2 Corp-Zeile mit Bestechung", g.lines.some((z) => /Corp-Geld: volle Runde 6 Stuecke/.test(z) && /Tetrads 186\.500/.test(z)), g.lines.join(" | "));
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
