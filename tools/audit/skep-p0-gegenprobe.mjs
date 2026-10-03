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
import { ladeSpielskript } from "file:///C:/Users/erche/Desktop/claude_projecto/.claude/worktrees/bb-p0-bau/tools/mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
if (!process.env.BN4REP_SRC) { console.log("BN4REP_SRC fehlt - nie gegen die Live-src (Bruecke!)"); process.exit(2); }
const SRC = path.resolve(process.env.BN4REP_SRC);
if (/claude_projecto[\/]+bitburner[\/]+src/i.test(SRC)) { console.log("BN4REP_SRC zeigt auf die Live-src - Abbruch"); process.exit(2); }

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
    ownedSF: o.ownedSF ?? [[4, 3], [5, 1]],
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
    getResetInfo: () => ({ currentNode: w.knoten, lastNodeReset: 1, lastAugReset: 2,
      ownedSF: new Map(w.ownedSF) }),
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
      getAugmentationStats: (a) => ({ ...((w.augs[a] && w.augs[a].stats) || {}) }),
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
// ===========================================================================
// SKEPTIKER P0 (03.10.2026): eigene Gegenproben
// ===========================================================================
const weltV1Ausgang = (marke) => baueWelt({
  host: "werk-0", knoten: 5, moneyMult: 1, geld: 5e9, einkommen: 1e6,
  faktionen: { Daedalus: { favor: 150, rep: 3e6, augs: ["Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
  augs: AUGS_GANG,
  installiert: ["The Red Pill", ...Array.from({ length: 30 }, (_, i) => "Alt-" + i)],
  warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
  arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
  fokus: true,
  skills: { hacking: 400 },
  dateien: { home: Object.assign({ "data/company-order.txt": "off", "data/einbau-uhr.json": UHR_FREI },
    marke === null ? {} : { "data/verfahren.txt": marke }) },
  schlafBudget: 40,
  beiSchlaf: backupGruen,
});
console.log("\n-- K1: V1-Knoten, The Red Pill EINGEBAUT, Marke kippt (ausgangSteht-Regress?) --");
for (const marke of ["V1 5 2", "V2 5 0", null, "V1 4 2", ""]) {
  const w = weltV1Ausgang(marke);
  const r = await fahre(w);
  console.log("  Marke " + JSON.stringify(marke) + ": installAufrufe=" + w.installAufrufe
    + " ende=" + r.ende + " rundenfehler=" + rundenfehler(r.log).length
    + " kaeufe=" + JSON.stringify(w.kaeufe.map((k) => k.a)));
  const tele = (() => { try { return JSON.parse(w.dateien.home["data/einbau.json"] || "null"); } catch { return null; } })();
  if (tele) console.log("     einbau.json: kampfknoten=" + tele.kampfknoten + " redPillWartet=" + tele.redPillWartet + " gesperrt=" + tele.gesperrt);
}

console.log("\n-- K2: V2 mit Gang, Marke fehlt: Hacknet-Stueck und Hacking-Stuecke trotzdem gekauft? --");
{
  const NIC = "Hacknet Node NIC Architecture Neural-Upload";
  for (const marke of ["V2 2 1", null]) {
    const w = baueWelt({
      host: "werk-0", knoten: 2, moneyMult: 1, geld: 50e9, einkommen: 1e6,
      ownedSF: [[4, 3], [5, 1], [9, 3]],
      faktionen: { Netburners: { favor: 0, rep: 50e3, augs: [NIC] },
        "Slum Snakes": { favor: 0, rep: 3e6, augs: ["The Red Pill", "Bionic Arms"] } },
      augs: { ...AUGS_GANG, [NIC]: { repReq: 3.75e3, basis: 4.5e6 } },
      installiert: Array.from({ length: 12 }, (_, i) => "Alt-" + i),
      warteschlange: [],
      fokus: true,
      dateien: { home: Object.assign({ "data/einbau-uhr.json": UHR_FREI },
        marke === null ? {} : { "data/verfahren.txt": marke }) },
      schlafBudget: 8,
      beiSchlaf: backupGruen,
    });
    const r = await fahre(w);
    console.log("  Marke " + JSON.stringify(marke) + ": kaeufe=" + JSON.stringify(w.kaeufe.map((k) => k.a))
      + " rundenfehler=" + rundenfehler(r.log).length + " ende=" + r.ende);
  }
}
console.log("\n-- K3: wie K1 (Marke fehlt), aber realistische Kampf-Tore: Uhr, Division, Kampfwerte --");
{
  const varianten = [
    ["nicht in Division, Uhr passend+alt", { imBladeburner: false, uhr: UHR_FREI }],
    ["in Division, Uhr aus altem Einbau (augReset 1), Kampf 1000", { imBladeburner: true, uhr: JSON.stringify({ augReset: 1, playtime: 0, fertig: 1000 }) }],
    ["in Division, keine Uhr, Kampf 1000", { imBladeburner: true, uhr: null }],
    ["in Division, Uhr passend+alt, Kampf 50", { imBladeburner: true, uhr: UHR_FREI, kampf: 50 }],
    ["in Division, Uhr passend+alt, Kampf 1000 (= K1)", { imBladeburner: true, uhr: UHR_FREI }],
  ];
  for (const [name, v] of varianten) {
    const dat = { "data/company-order.txt": "off" };
    if (v.uhr) dat["data/einbau-uhr.json"] = v.uhr;
    const k = v.kampf ?? 1000;
    const w = baueWelt({
      host: "werk-0", knoten: 5, moneyMult: 1, geld: 5e9, einkommen: 1e6,
      faktionen: { Daedalus: { favor: 150, rep: 3e6, augs: ["Bionic Arms", "Bionic Legs", "Bionic Spine"] } },
      augs: AUGS_GANG,
      installiert: ["The Red Pill", ...Array.from({ length: 30 }, (_, i) => "Alt-" + i)],
      warteschlange: ["Bionic Arms", "Bionic Legs", "Bionic Spine"],
      arbeit: { type: "FACTION", factionName: "Daedalus", factionWorkType: "hacking" },
      fokus: true,
      skills: { hacking: 400, strength: k, defense: k, dexterity: k, agility: k },
      imBladeburner: v.imBladeburner,
      dateien: { home: dat },
      schlafBudget: 40,
      beiSchlaf: backupGruen,
    });
    const r = await fahre(w);
    console.log("  " + name + ": installAufrufe=" + w.installAufrufe + " ende=" + r.ende
      + " rundenfehler=" + rundenfehler(r.log).length);
  }
}
console.log("\nfertig");
