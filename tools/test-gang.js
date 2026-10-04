/**
 * Ebene 2: gang.js gegen einen nachgebauten ns.gang (Paket P2, 03.10.2026).
 *
 * ===========================================================================
 * WAS GEPRUEFT WIRD
 * ===========================================================================
 *
 * gang.js gruendet in BN2 eine Kampfgang und fuehrt sie unbeaufsichtigt. Die
 * Gruendung ist unumkehrbar (sie nullt den Ruf der gewaehlten Faktion), die
 * Fuehrung laeuft Tage. Geprueft ist deshalb jede Entscheidung, die dort
 * Schaden anrichten kann - nicht die Spielformel (die hat ihre eigene
 * Abschreibpruefung, `tools/audit/gang-check.mjs`, 86.360 Vergleiche gegen den
 * Originalquelltext):
 *
 *   - Gruendung genau einmal je Versuch, nur mit einer BEIGETRETENEN
 *     Kampf-Faktion, und von diesen die mit dem kleinsten Ruf; nie NiteSec /
 *     The Black Hand; Pause nach einem Fehlschlag, auch ueber einen Neustart;
 *     unlesbarer Ruf zaehlt nicht als 0
 *   - Rekrutierung bis zur Grenze, aber nie ohne Grenze
 *   - Aufgabenwahl Training -> Terrorism -> Vigilante, mit den Schwellen
 *   - Aufstiegsschwellen (1,3 im Training, 2 in der Arbeit)
 *   - NIE Territory Warfare (auch kein anderer, nicht erwarteter ns.gang-Aufruf);
 *     Ausruestung NUR im Geldmodus (P2d, unten)
 *   - die Schleife haengt am Gang-Takt (kein ns.sleep), faellt auf den
 *     Zeitrueckfall zurueck, endet bei Abbruch, bei Fehlerserie und an der
 *     harten Obergrenze
 *   - Fehler werden gezaehlt und in der Telemetrie gemeldet, nicht geschluckt
 *   - Schalter data/gang-an.txt, Registry-Eintrag, Hacking-Gangs
 *   - die VORAUSSETZUNGSSPERRE vor createGang (Skeptiker-Auflage 1): ohne
 *     frische, zum Knoteneintritt passende data/bn4rep.json mit den Feldern
 *     von Paket 0 UND Paket 1 wird NIE gegruendet, und ein gesperrter Versuch
 *     zaehlt nicht und startet keine Pause
 *   - der Vertrag mit bn4rep.js: die Feldnamen der Sperre stehen im
 *     Telemetrieblock dort (erst pruefbar, wenn Paket 0/1 im Stand sind)
 *   - Logzeilen in Ortszeit, ein unlesbarer Ruf EINES Kandidaten sperrt alle
 *   - die /bb-Zeile aus data/gang.json (tools/lib/gangzeile.js)
 *   - der GELDMODUS (P2d, 04.10.2026; Abschnitte P8-P11 und S15-S19):
 *       * Modus je Runde zustandslos aus Ruf und torRunde.repNeed: Grenzen,
 *         Hysterese (untere Schwelle nur, wenn schon jemand auf der Geldaufgabe
 *         arbeitet), fehlender / alter / fremder Bedarf -> RESPECT, nach dem
 *         Einbau (Ruf 0) -> RESPECT
 *       * Aufgabenwahl: Human Trafficking statt Terrorism; Training, Aufstieg und
 *         Wanted-Regler wie zuvor, der Regler rechnet mit der Geldaufgabe
 *       * Ausruestung: nur Weapon/Armor/Vehicle/Rootkit (NIE Augmentation), nur im
 *         Modus MONEY, billigste zuerst, nie unter die Ruecklage aus
 *         data/geldbedarf.txt (fehlt sie: nichts), hoechstens EQUIP_MAX_BUYS je
 *         Runde, nach einem Aufstieg erst in der naechsten Runde neu
 *       * Telemetrie mode / repNeed / moneyGainRate / equipmentBought / Spent
 *
 *       Jede dieser Proben muss gegen gang-2 (den Stand vor P2d) ROT sein:
 *       `GANG_SRC=<alte gang.js> node tools/test-gang.js --ohne-mutanten`.
 *
 * Dazu die PURE Teile gegen die Abschreibpruefung der Sim
 * (`tools/audit/gang-formulas.mjs`): respectGain/wantedGain 3.000 Zufallsfaelle.
 *
 * ===========================================================================
 * DIE SELBSTPROBE (Mutanten)
 * ===========================================================================
 *
 * Ein Test, der gruen meldet, weil er nichts prueft, ist schlimmer als keiner.
 * Deshalb wird dieselbe Suite gegen MUTANTEN von gang.js gefahren - jeder mit
 * genau einem eingebauten Fehler der Sorte, gegen die der Test gebaut ist. Jeder
 * Mutant muss mindestens eine Probe rot machen; sonst ist DIESER TEST rot.
 * Die Mutanten leben in einem Wegwerfordner unter os.tmpdir(), nie in src/.
 *
 * ROT GEGEN DEN ALTEN STAND: `GANG_SRC=<Pfad> node tools/test-gang.js` (oder
 * `--src=<Pfad>`) prueft eine andere gang.js. Ohne die Datei (Stand vor Paket
 * P2) bricht der Test mit "nicht gefunden" ab - rot.
 *
 * Aufruf: node tools/test-gang.js [--ohne-mutanten] [--src=<Datei>]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";
import * as REG from "../src/lib/reg.js";
import * as F from "./audit/gang-formulas.mjs";
import { ohneKommentare } from "./lib/schreiberprobe.js";
import { gangZeile, GANG_FRIST_MS } from "./lib/gangzeile.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const ARGV = process.argv.slice(2);
const SRC_ARG = ARGV.find((a) => a.startsWith("--src="));
const SRC = SRC_ARG ? SRC_ARG.slice(6) : (process.env.GANG_SRC || path.join(ROOT, "src", "gang.js"));
const MIT_MUTANTEN = !ARGV.includes("--ohne-mutanten");

const W0 = 1_700_000_000_000;
const NODE_RESET = 1_699_000_000_000;   // lastNodeReset des Mocks (ein Knoteneintritt)

/**
 * Eine erfuellte data/bn4rep.json: frisch (5 s), Knoten 2, derselbe Eintritt wie
 * der Mock, Paket 0 (v1Positiv false) und Paket 1 (gateBuy true) live. `over`
 * ueberschreibt Felder; `undefined` entfernt sie (JSON.stringify laesst sie weg).
 */
const bn4repText = (over = {}) => JSON.stringify({
  zeit: W0 - 5000, knoten: 2, nodeReset: NODE_RESET, v1Positiv: false, v1LeseFehler: 0, gateBuy: true, ...over });

// ===========================================================================
// DER NACHBAU
// ===========================================================================

const abortError = () => { const e = new Error("MOCK_ABBRUCH"); e.mockAbbruch = true; return e; };
const lvlAll = (n) => ({ hack: n, str: n, def: n, dex: n, agi: n, cha: n });
const uni = (v) => ({ hack: v, str: v, def: v, dex: v, agi: v, cha: v });

/**
 * Ein kleiner Ausruestungskatalog fuer den Nachbau (Testwerte, nicht die Preise
 * des Spiels): vier erlaubte Typen in aufsteigendem Preis, dazu zwei Fallen -
 * eine billige Mitglieder-AUGMENTIERUNG (billiger als der Rootkit) und ein Stueck
 * mit unbekanntem Typ (das billigste von allen). Beide duerfen NIE gekauft werden.
 */
const EQUIP_CATALOG = [
  { name: "Mystery Item", type: "", cost: 500e3 },
  { name: "Baseball Bat", type: "Weapon", cost: 1e6 },
  { name: "Bulletproof Vest", type: "Armor", cost: 2e6 },
  { name: "Ford Flex V20", type: "Vehicle", cost: 3e6 },
  { name: "Katana", type: "Weapon", cost: 12e6 },
  { name: "NUKE Rootkit", type: "Rootkit", cost: 50e6 },
  { name: "BrachiBlades", type: "Augmentation", cost: 20e6 },
];
const EQUIP_ALLOWED = EQUIP_CATALOG.filter((x) => ["Weapon", "Armor", "Vehicle", "Rootkit"].includes(x.type));

/**
 * Eine Gang im Speicher. Sie rechnet KEINE Spielformel; sie nimmt auf, was
 * gang.js ruft, und gibt zurueck, was der Test hineinlegt. Jeder Aufruf, den
 * gang.js nicht machen darf (Warfare, Ausruestung, alles Unbekannte), wird in
 * `forbidden` vermerkt UND wirft.
 */
function newGang(c = {}) {
  const g = {
    inGang: !!c.inGang, faction: c.faction || "Slum Snakes", isHacking: !!c.isHacking,
    respect: c.respect ?? 1, wanted: c.wanted ?? 1, territory: c.territory ?? 1 / 7, warfare: false,
    members: (c.members || []).map((x) => ({
      name: x.name, task: x.task || "Unassigned", lvl: x.lvl || lvlAll(1), asc: x.asc,
      // Besitz an Ausruestung (Namen). noUpgradeInfo: getMemberInformation liefert gar
      // keine Liste (unbekannter Besitz).
      upgrades: [...(x.upgrades || [])], noUpgradeInfo: !!x.noUpgradeInfo })),
    moneyGainRate: c.moneyGainRate ?? 0,
    // Der Ausruestungskatalog (P2d): { name, type, cost }. Preise ohne Rabatt.
    catalog: c.catalog || EQUIP_CATALOG,
    // Fehlermodi der Ausruestung: Typaufruf wirft fuer diese Namen; Kauf gibt false.
    typeThrows: c.typeThrows || [], buyResult: c.buyResult ?? null,
    equipCalls: [], bought: [], pay: null,
    createResult: c.createResult ?? true, createThrows: c.createThrows || null,
    recruitResult: c.recruitResult ?? true, alwaysCanRecruit: !!c.alwaysCanRecruit,
    // Nur wo der Test Mitglieder vorgibt UND nicht ums Rekrutieren geht, wird nicht
    // rekrutiert - sonst wuchse jede vorgegebene Mannschaft mit dem Respekt.
    noRecruit: c.recruit === true ? false : !!c.members,
    setTaskResult: c.setTaskResult ?? true,
    infoThrows: c.infoThrows || [], ascendThrows: !!c.ascendThrows,
    tick: c.tick ?? 2000, maxUpdates: c.maxUpdates ?? 3,
    nextUpdateMode: c.nextUpdateMode || "ok",         // ok | never | throws
    asleepMode: c.asleepMode || "pending",            // pending | resolve | resolveThenAbort
    asleepN: c.asleepN ?? 3,
    onUpdate: c.onUpdate || null, clock: null,
    created: [], tasks: [], ascended: [], recruited: [], forbidden: [],
    updates: 0, asleepCalls: 0,
  };
  const find = (n) => {
    const x = g.members.find((y) => y.name === n);
    if (!x) throw new Error("Invalid gang member: '" + n + "'");
    return x;
  };
  const api = {
    inGang: () => g.inGang,
    createGang: (f) => {
      g.created.push(f);
      if (g.createThrows) throw new Error(g.createThrows);
      if (g.createResult) { g.inGang = true; g.faction = f; }
      return g.createResult;
    },
    getGangInformation: () => ({
      faction: g.faction, isHacking: g.isHacking, respect: g.respect, wantedLevel: g.wanted,
      wantedPenalty: g.respect / (g.respect + g.wanted), territory: g.territory,
      territoryWarfareEngaged: g.warfare, wantedLevelGainRate: 0, respectGainRate: 0,
      moneyGainRate: g.moneyGainRate,
    }),
    getMemberNames: () => g.members.map((x) => x.name),
    getMemberInformation: (n) => {
      if (g.infoThrows.includes(n)) throw new Error("kaputt: " + n);
      const x = find(n);
      const info = { name: x.name, task: x.task, ...x.lvl };
      if (!x.noUpgradeInfo) info.upgrades = x.upgrades.slice();
      return info;
    },
    // --- Ausruestung (P2d): nur im Modus MONEY erlaubt; jeder Aufruf wird vermerkt ---
    getEquipmentNames: () => { g.equipCalls.push("getEquipmentNames"); return g.catalog.map((x) => x.name); },
    getEquipmentType: (n) => {
      g.equipCalls.push("getEquipmentType");
      if (g.typeThrows.includes(n)) throw new Error("Typ kaputt: " + n);
      const it = g.catalog.find((x) => x.name === n);
      return it ? it.type : "";
    },
    getEquipmentCost: (n) => {
      g.equipCalls.push("getEquipmentCost");
      const it = g.catalog.find((x) => x.name === n);
      return it ? it.cost : Infinity;
    },
    purchaseEquipment: (member, n) => {
      g.equipCalls.push("purchaseEquipment");
      const x = find(member);
      const it = g.catalog.find((y) => y.name === n);
      if (g.buyResult !== null) return g.buyResult;
      if (!it || x.upgrades.includes(n)) return false;
      if (g.pay && !g.pay(it.cost)) return false;
      x.upgrades.push(n);
      g.bought.push({ member, item: n, type: it.type, cost: it.cost });
      return true;
    },
    canRecruitMember: () => {
      if (g.noRecruit) return false;
      if (g.members.length >= 12) return false;
      if (g.alwaysCanRecruit) return true;
      const n = g.members.length;
      return n < 3 ? true : g.respect >= Math.pow(5, n - 3 + 1);
    },
    recruitMember: (name) => {
      if (!g.recruitResult) return false;
      if (g.members.some((x) => x.name === name)) return false;
      g.members.push({ name, task: "Unassigned", lvl: lvlAll(1), asc: undefined, upgrades: [], noUpgradeInfo: false });
      g.recruited.push(name);
      return true;
    },
    setMemberTask: (n, t) => {
      const x = find(n);
      g.tasks.push([n, t]);
      x.task = t;
      return g.setTaskResult;
    },
    getAscensionResult: (n) => find(n).asc,
    ascendMember: (n) => {
      if (g.ascendThrows) throw new Error("Aufstieg kaputt");
      const x = find(n);
      g.ascended.push(n);
      x.asc = undefined;
      x.lvl = lvlAll(2);
      x.upgrades = [];          // der Aufstieg loescht die Ausruestung (GangMember.ts:308-319)
      return { respect: 0 };
    },
    nextUpdate: () => {
      g.updates++;
      if (g.nextUpdateMode === "never") return new Promise(() => {});
      if (g.nextUpdateMode === "throws") throw new Error("Must have joined gang");
      if (g.updates > g.maxUpdates) throw abortError();
      if (g.clock) g.clock(g.tick);
      if (g.onUpdate) g.onUpdate(g, g.updates);
      return Promise.resolve(g.tick);
    },
  };
  g.api = new Proxy(api, {
    get: (t, k) => (k in t ? t[k] : () => {
      g.forbidden.push(String(k));
      throw new Error("ns.gang." + String(k) + " ist hier nicht erlaubt");
    }),
  });
  return g;
}

/** ns aus dem Basis-Mock plus Gang, Ruf und Zeitrueckfall. */
function buildNs(m, fake, o) {
  const ns = Object.assign({}, m.ns);
  ns.gang = fake.api;
  ns.singularity = {
    getFactionRep: (f) => {
      const r = (o.reps || {})[f];
      if (r === "throw") throw new Error("kein Zugriff auf " + f);
      return r ?? 0;
    },
  };
  // Der Rueckfall-Timer: im Normalbetrieb ein Versprechen, das nie ankommt (der
  // Gang-Takt gewinnt). Die anderen Modi lassen ihn ablaufen - und dabei die
  // Uhr um die Wartezeit vorruecken, wie in Echtzeit.
  ns.asleep = (ms) => {
    fake.asleepCalls++;
    if (fake.asleepMode === "pending") return new Promise(() => {});
    if (fake.clock) fake.clock(ms);
    if (fake.asleepMode === "resolveThenAbort" && fake.asleepCalls > fake.asleepN) {
      return Promise.reject(abortError());
    }
    return Promise.resolve(true);
  };
  if (o.scp) ns.scp = o.scp;
  if (o.resetThrows) ns.getResetInfo = () => { throw new Error("getResetInfo kaputt"); };
  if (o.moneyThrows) ns.getServerMoneyAvailable = () => { throw new Error("Geld kaputt"); };
  return ns;
}

/** Ein Lauf von main() mit Wachhund gegen Haenger. */
async function run(mod, o = {}) {
  const fake = newGang(o.gang || {});
  const host = o.host || "home";
  // Die Voraussetzungen sind im Normalfall ERFUELLT (frisch, Knoten 2, Paket 0
  // und 1 live); jeder Test, der die Sperre pruefen will, nimmt etwas weg.
  const home = { "data/gang-an.txt": "1", "data/bn4rep.json": bn4repText(o.bn4rep), ...(o.homeFiles || {}) };
  if (o.noSwitch) delete home["data/gang-an.txt"];
  if (o.noBn4rep) delete home["data/bn4rep.json"];
  if (typeof o.bn4repRaw === "string") home["data/bn4rep.json"] = o.bn4repRaw;
  const server = { home: { ram: 512, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } };
  if (host !== "home") server[host] = { ram: 512, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 };
  const m = neuerMock({
    host, knoten: o.node ?? 2, nodeReset: NODE_RESET, wall: W0, playtime: 50 * 3600000, geld: o.money ?? 1e9,
    faktionen: o.factions || [], server,
    dateien: { home, ...(host !== "home" ? { [host]: {} } : {}) },
    maxSchlaf: o.maxSchlaf ?? 1,
    beiSchlaf: (ms, z, vor) => {
      if (typeof o.onSleep === "function") o.onSleep(z.schlafZeiten.length, m);
      vor(o.sleepAdvance ?? ms);
    },
  });
  fake.clock = (ms) => m.vor(ms);
  // Zahlung fuer Ausruestung: vom Spielerkonto des Mocks (getServerMoneyAvailable liest es).
  fake.pay = (cost) => { if (m.zustand.spieler.money < cost) return false; m.zustand.spieler.money -= cost; return true; };
  if (typeof o.onMock === "function") o.onMock(m);
  const ns = buildNs(m, fake, o);
  const back = m.uhrStellen();
  let ended = "returned";
  let err = null;
  let timer = null;
  try {
    await Promise.race([
      mod.main(ns),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("HANG")), 15000); }),
    ]);
  } catch (e) {
    if (e && e.mockAbbruch) ended = "abort";
    else if (e && e.message === "HANG") ended = "hang";
    else { ended = "threw"; err = e; }
  } finally {
    back();
    clearTimeout(timer);
  }
  let tel = null;
  try { tel = JSON.parse(m.lies("home", "data/gang.json") || "null"); } catch { tel = null; }
  return { m, fake, tel, log: m.lies("home", "data/gang-log.txt") || "", ended, err };
}

const members = (names, lvl = 1, extra = {}) => names.map((n) => ({
  name: n, lvl: typeof lvl === "number" ? lvlAll(lvl) : lvl, ...extra }));

// ===========================================================================
// DIE SUITE
// ===========================================================================

async function suite(mod, srcText, loud) {
  const out = { passed: 0, failed: [] };
  const check = (name, cond, extra = "") => {
    if (cond) {
      out.passed++;
      if (loud) console.log("  ok    " + name);
    } else {
      out.failed.push(name + (extra ? " - " + extra : ""));
      if (loud) console.log("  ROT   " + name + (extra ? " - " + extra : ""));
    }
  };
  const head = (t) => { if (loud) { console.log(""); console.log("-- " + t + " --"); } };
  const J = (x) => JSON.stringify(x);

  // -------------------------------------------------------------------------
  head("P1. chooseFounder: kleinster Ruf, nur Kampf-Faktionen");
  {
    let r = mod.chooseFounder(["Slum Snakes", "Tetrads", "The Syndicate"],
      { "Slum Snakes": 0, "Tetrads": 0, "The Syndicate": 2082 });
    check("Gleichstand 0/0: Slum Snakes (Reihenfolge der Liste)", r.faction === "Slum Snakes", J(r));
    r = mod.chooseFounder(["Slum Snakes", "Tetrads"], { "Slum Snakes": 500, "Tetrads": 12 });
    check("kleinerer Ruf gewinnt: Tetrads", r.faction === "Tetrads", J(r));
    r = mod.chooseFounder(["NiteSec", "The Black Hand"], { "NiteSec": 0, "The Black Hand": 0 });
    check("nur Hacking-Gang-Faktionen: keine Gruendung", r.faction === null && r.reason === "no_faction", J(r));
    r = mod.chooseFounder(["NiteSec", "Slum Snakes"], { "NiteSec": 0, "Slum Snakes": 9e6 });
    check("NiteSec mit Ruf 0 schlaegt Slum Snakes NICHT", r.faction === "Slum Snakes", J(r));
    r = mod.chooseFounder([], {});
    check("nichts beigetreten: no_faction", r.faction === null && r.reason === "no_faction");
    r = mod.chooseFounder(["Slum Snakes"], { "Slum Snakes": null });
    check("unlesbarer Ruf (null) zaehlt nicht als 0", r.faction === null && r.reason === "rep_unreadable", J(r));
    r = mod.chooseFounder(["Slum Snakes"], {});
    check("fehlender Ruf (undefined) zaehlt nicht als 0", r.faction === null && r.reason === "rep_unreadable");
    r = mod.chooseFounder(["Slum Snakes"], { "Slum Snakes": NaN });
    check("NaN-Ruf zaehlt nicht als 0", r.faction === null && r.reason === "rep_unreadable");
    // Skeptiker 03.10.2026: Kommentar ("im Zweifel nicht gruenden") und Code
    // (uebersprang nur die betroffene Faktion) sagten Verschiedenes. Die
    // unlesbare koennte die mit dem kleinsten Ruf sein, die lesbare viel Ruf
    // haben, der mit der Gruendung verfaellt - also sperrt EIN unlesbarer
    // Kandidat die Gruendung.
    r = mod.chooseFounder(["Slum Snakes", "Tetrads"], { "Slum Snakes": null, "Tetrads": 7 });
    check("ein unlesbarer Kandidat sperrt, auch wenn ein anderer lesbar ist",
      r.faction === null && r.reason === "rep_unreadable" && r.unreadable === "Slum Snakes", J(r));
    r = mod.chooseFounder(["Slum Snakes", "Tetrads"], { "Slum Snakes": 7, "Tetrads": undefined });
    check("auch der zweite Kandidat unlesbar: gesperrt (Reihenfolge egal)",
      r.faction === null && r.reason === "rep_unreadable" && r.unreadable === "Tetrads", J(r));
    r = mod.chooseFounder(["Slum Snakes"], { "Slum Snakes": "5" });
    check("Ruf als Text ist kein Ruf: gesperrt", r.faction === null && r.reason === "rep_unreadable", J(r));
    r = mod.chooseFounder(["NiteSec", "Slum Snakes"], { "NiteSec": null, "Slum Snakes": 4 });
    check("unlesbarer Ruf einer HACKING-Faktion zaehlt nicht (sie ist kein Kandidat)", r.faction === "Slum Snakes", J(r));
    r = mod.chooseFounder(["The Dark Army", "Speakers for the Dead"],
      { "The Dark Army": 3, "Speakers for the Dead": 3 });
    check("Gleichstand: Reihenfolge Speakers vor Dark Army", r.faction === "Speakers for the Dead", J(r));
    check("Liste fuehrt keine Hacking-Faktion",
      !mod.COMBAT_FACTIONS.includes("NiteSec") && !mod.COMBAT_FACTIONS.includes("The Black Hand")
      && mod.COMBAT_FACTIONS.length === 5, J(mod.COMBAT_FACTIONS));
  }

  // -------------------------------------------------------------------------
  head("P2. Aufstiegsfaktor und Schwellen");
  {
    check("Faktor einheitlich 2 -> 2", Math.abs(mod.ascensionFactor(uni(2)) - 2) < 1e-9);
    check("Training 1,299 -> nein", mod.shouldAscend("train", uni(1.299)) === false);
    check("Training 1,301 -> ja", mod.shouldAscend("train", uni(1.301)) === true);
    check("Arbeit 1,9 -> nein", mod.shouldAscend("work", uni(1.9)) === false);
    check("Arbeit 1,99 -> nein (Trainingsschwelle gilt hier NICHT)", mod.shouldAscend("work", uni(1.99)) === false);
    check("Arbeit 2,05 -> ja", mod.shouldAscend("work", uni(2.05)) === true);
    check("Training: Faktor 1,6 auf str/def/dex (1,6^0,6 = 1,326) -> ja",
      mod.shouldAscend("train", { hack: 1, str: 1.6, def: 1.6, dex: 1.6, agi: 1, cha: 1 }) === true);
    check("Training: Faktor 1,5 auf str/def/dex (1,5^0,6 = 1,275) -> nein",
      mod.shouldAscend("train", { hack: 1, str: 1.5, def: 1.5, dex: 1.5, agi: 1, cha: 1 }) === false);
    check("agi hat Gewicht 0: nur agi 1000 -> nein",
      mod.shouldAscend("train", { hack: 1, str: 1, def: 1, dex: 1, agi: 1000, cha: 1 }) === false);
    check("undefined/null -> nein", mod.shouldAscend("train", undefined) === false && mod.shouldAscend("train", null) === false);
    check("NaN in einem Stat -> nein", mod.shouldAscend("train", { ...uni(5), str: NaN }) === false);
    check("negativer Stat -> nein", mod.shouldAscend("train", { ...uni(5), def: -1 }) === false);
    check("fehlender Stat -> nein", mod.shouldAscend("train", { hack: 5, str: 5, def: 5, dex: 5, agi: 5 }) === false);
  }

  // -------------------------------------------------------------------------
  head("P3. Phase aus den Stufen (zustandslos)");
  {
    check("5 Stats je 500 -> gewichtet 500 -> Arbeit (>=)", mod.phaseOf(lvlAll(500)) === "work");
    check("5 Stats je 499 -> gewichtet 499 -> Training", mod.phaseOf(lvlAll(499)) === "train");
    check("agi zaehlt nicht: agi 9999, Rest 499 -> Training",
      mod.phaseOf({ ...lvlAll(499), agi: 9999 }) === "train");
    check("frisches Mitglied (alles 1) -> Training", mod.phaseOf(lvlAll(1)) === "train");
    check("nach einem Aufstieg (Stufen ~2) wieder Training", mod.phaseOf(lvlAll(3)) === "train");
  }

  // -------------------------------------------------------------------------
  head("P4. Formeln und Aufgabendaten gegen die Abschreibpruefung der Sim");
  {
    // Seit P2d gehoert die Geldaufgabe Human Trafficking dazu (TASK_MONEY).
    const wanted4 = [mod.TASK_TRAIN, mod.TASK_WORK, mod.TASK_JUSTICE, mod.TASK_MONEY];
    // Gegen den alten Stand fehlt TASK_MONEY: dann ROT (paramOk), aber kein Absturz in der Schleife unten.
    const names = wanted4.filter((n) => typeof n === "string" && mod.TASKS[n]);
    let paramOk = names.length === wanted4.length;
    for (const n of names) {
      const a = mod.TASKS[n], b = F.TASKS[n];
      if (!a || !b) { paramOk = false; continue; }
      if (a.baseRespect !== b.baseRespect || a.baseWanted !== b.baseWanted || a.difficulty !== b.difficulty) paramOk = false;
      for (const s of mod.STATS) if (a.w[s] !== b.w[s]) paramOk = false;
      if (a.territory.respect !== b.territory.respect || a.territory.wanted !== b.territory.wanted) paramOk = false;
    }
    check("Aufgabenparameter wortgleich zu gang-formulas.mjs", paramOk);
    {
      // Die Geldaufgabe vollstaendig, auch Geld und Gebietsfaktor Geld (P2d).
      const a = mod.TASKS[mod.TASK_MONEY], b = F.TASKS["Human Trafficking"];
      check("Geldaufgabe heisst Human Trafficking", mod.TASK_MONEY === "Human Trafficking", String(mod.TASK_MONEY));
      check("Human Trafficking: baseMoney 360, Gebietsfaktor Geld 1,5, Gewichte summieren sich auf 100",
        !!a && a.baseMoney === b.baseMoney && a.territory.money === b.territory.money
        && mod.STATS.reduce((s, k) => s + a.w[k], 0) === 100, J(a));
    }

    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let maxRel = 0, bad = 0, cases = 0;
    for (let i = 0; i < 3000; i++) {
      const lvl = {};
      for (const s of mod.STATS) lvl[s] = 1 + Math.floor(rnd() * rnd() * 4000);
      const g = { respect: 1 + rnd() * rnd() * 1e7, wantedLevel: 1 + rnd() * 1e4, territory: 0.01 + rnd() * 0.5 };
      for (const n of names) {
        const a1 = mod.respectGain(mod.TASKS[n], lvl, g), b1 = F.respectGain(g, lvl, F.TASKS[n], 1);
        const a2 = mod.wantedGain(mod.TASKS[n], lvl, g), b2 = F.wantedGain(g, lvl, F.TASKS[n]);
        for (const [a, b] of [[a1, b1], [a2, b2]]) {
          cases++;
          const rel = Math.abs(a - b) / Math.max(1e-300, Math.abs(b), Math.abs(a));
          if (!(Math.abs(a - b) < 1e-12 || rel < 1e-12)) bad++;
          if (rel > maxRel && Math.abs(a - b) >= 1e-12) maxRel = rel;
        }
      }
    }
    check("respectGain/wantedGain: " + cases + " Faelle ohne Abweichung", bad === 0, bad + " Abweichungen, max rel " + maxRel);
  }

  // -------------------------------------------------------------------------
  head("P5. planTasks: Training, Terrorism, Vigilante");
  {
    const g1 = { respect: 1000, wantedLevel: 1, wantedPenalty: 0.5, territory: 1 / 7 };
    let p = mod.planTasks(g1, [
      { name: "a", task: "Unassigned", lvl: lvlAll(1) },
      { name: "b", task: "Unassigned", lvl: lvlAll(600) },
      { name: "c", task: "Unassigned", lvl: lvlAll(499) },
      { name: "d", task: "Unassigned", lvl: lvlAll(500) }]);
    check("alles 1 -> Train Combat", p.assign.a === "Train Combat", J(p.assign));
    check("gewichtet 600 -> Terrorism", p.assign.b === "Terrorism", J(p.assign));
    check("499 -> Train Combat, 500 -> Terrorism", p.assign.c === "Train Combat" && p.assign.d === "Terrorism", J(p.assign));
    check("wantedLevel 1: kein Vigilante, auch bei Strafe 0,5", p.justice === 0, J(p));

    const work = (n) => Array.from({ length: n }, (_, i) => ({ name: "w" + i, task: "Terrorism", lvl: lvlAll(600) }));
    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.99, territory: 1 / 7 }, work(4));
    check("Strafe 0,99 (>= 0,95): kein Vigilante", p.justice === 0, J(p));
    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.95, territory: 1 / 7 }, work(4));
    check("Strafe genau 0,95: kein Vigilante (nur darunter)", p.justice === 0, J(p));
    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.94, territory: 1 / 7 }, work(4));
    check("Strafe 0,94 und wanted 50: Vigilante", p.justice >= 1, J(p));

    // Erwartete Anzahl unabhaengig mit der Sim-Formel nachgerechnet.
    const gg = { respect: 1000, wantedLevel: 50, territory: 1 / 7 };
    const wl = lvlAll(600);
    let sum = 4 * F.wantedGain(gg, wl, F.TASKS["Terrorism"]);
    let expected = 0;
    for (let i = 0; i < 4 && sum > 0; i++) {
      sum -= F.wantedGain(gg, wl, F.TASKS["Terrorism"]);
      sum += F.wantedGain(gg, wl, F.TASKS["Vigilante Justice"]);
      expected++;
    }
    p = mod.planTasks({ ...gg, wantedPenalty: 0.5 }, work(4));
    check("Anzahl Vigilante = Sim-Rechnung (" + expected + " von 4, Rest bleibt in Terrorism)",
      p.justice === expected && expected > 0 && expected < 4, "gefunden " + p.justice + ", erwartet " + expected);

    // Reihenfolge: die mit dem kleinsten Respektbeitrag zuerst.
    const mixed = [600, 700, 800, 900].map((n, i) => ({ name: "m" + n, task: "Terrorism", lvl: lvlAll(n) }));
    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.5, territory: 1 / 7 }, mixed);
    const kept = Object.keys(p.assign).filter((k) => p.assign[k] === "Terrorism");
    check("Vigilante trifft zuerst den schwaechsten (m600), der staerkste bleibt in Terrorism",
      p.assign.m600 === "Vigilante Justice" && (kept.length === 0 || kept.includes("m900")), J(p.assign));

    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.5, territory: 1 / 7 }, [
      { name: "t1", task: "Train Combat", lvl: lvlAll(100) }, { name: "t2", task: "Train Combat", lvl: lvlAll(200) }]);
    check("nur Trainierende: kein Vigilante (Training erzeugt keinen Wanted)", p.justice === 0, J(p));

    p = mod.planTasks(g1, [{ name: "x", task: "Terrorism", lvl: lvlAll(900), ascended: true }]);
    check("in dieser Runde aufgestiegen -> Train Combat trotz alter Stufen", p.assign.x === "Train Combat", J(p));

    check("freeName: G01 zuerst", mod.freeName([]) === "G01");
    check("freeName: Luecke G02", mod.freeName(["G01", "G03"]) === "G02");
    check("freeName: voll -> null (kein Endlosversuch)",
      mod.freeName(Array.from({ length: 24 }, (_, i) => "G" + String(i + 1).padStart(2, "0"))) === null);
  }

  // -------------------------------------------------------------------------
  head("S1a. Gruendung: genau einmal, Slum Snakes bei Ruf 0/0/2082");
  {
    const r = await run(mod, {
      factions: ["Slum Snakes", "Tetrads", "The Syndicate"],
      reps: { "Slum Snakes": 0, "Tetrads": 0, "The Syndicate": 2082 },
      gang: { maxUpdates: 4 },
    });
    check("createGang genau einmal, mit Slum Snakes", J(r.fake.created) === J(["Slum Snakes"]), J(r.fake.created));
    check("danach 3 Mitglieder rekrutiert (G01..G03)", J(r.fake.recruited) === J(["G01", "G02", "G03"]), J(r.fake.recruited));
    check("alle drei im Training", r.fake.members.every((x) => x.task === "Train Combat"), J(r.fake.members.map((x) => x.task)));
    check("Telemetrie: createAttempts 1, lastCreate.ok", r.tel && r.tel.createAttempts === 1 && r.tel.lastCreate && r.tel.lastCreate.ok === true, J(r.tel && r.tel.lastCreate));
    check("Log: genau eine Zeile GRUENDUNG", (r.log.match(/GRUENDUNG/g) || []).length === 1, r.log.slice(0, 300));
    check("Log nennt die Kandidaten mit Ruf", /Slum Snakes=0/.test(r.log) && /The Syndicate=2082/.test(r.log));
    check("kein verbotener ns.gang-Aufruf", r.fake.forbidden.length === 0, J(r.fake.forbidden));
  }

  head("S1b. Gruendung: kleinster Ruf entscheidet");
  {
    const r = await run(mod, { factions: ["Slum Snakes", "Tetrads"], reps: { "Slum Snakes": 100, "Tetrads": 0 },
      gang: { maxUpdates: 1 } });
    check("Tetrads (Ruf 0) statt Slum Snakes (Ruf 100)", J(r.fake.created) === J(["Tetrads"]), J(r.fake.created));
  }

  head("S1c. Keine Gruendung ohne beigetretene Kampf-Faktion");
  {
    let r = await run(mod, { factions: ["NiteSec", "The Black Hand"], reps: { "NiteSec": 0, "The Black Hand": 0 }, maxSchlaf: 4 });
    check("nur NiteSec/The Black Hand: createGang nie", r.fake.created.length === 0, J(r.fake.created));
    check("Telemetrie: wartend, Grund no_faction", r.tel && r.tel.state === "wait" && r.tel.blockedReason === "no_faction", J(r.tel && [r.tel.state, r.tel.blockedReason]));
    check("kein weiterer ns.gang-Aufruf ausser inGang", r.fake.forbidden.length === 0, J(r.fake.forbidden));
    r = await run(mod, { factions: [], maxSchlaf: 3 });
    check("nichts beigetreten: createGang nie", r.fake.created.length === 0);
    r = await run(mod, { factions: ["NiteSec", "The Black Hand", "Slum Snakes"], reps: { "Slum Snakes": 50 }, gang: { maxUpdates: 1 } });
    check("neben Hacking-Faktionen wird die Kampf-Faktion gewaehlt", J(r.fake.created) === J(["Slum Snakes"]), J(r.fake.created));
  }

  head("S1d. Fehlschlag: nicht haemmern (Pause 10 min, Wanduhr)");
  {
    // Je Schlaf rueckt die Uhr um 30 s (Leerlauftakt). 15 Schlaefe = 7,5 min.
    let r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 15 });
    check("7,5 min nach dem Fehlschlag: weiterhin 1 Versuch", r.fake.created.length === 1, "Versuche " + r.fake.created.length);
    check("Grund create_pause/create_failed in der Telemetrie", r.tel && /^create_(pause|failed)$/.test(String(r.tel.blockedReason)), J(r.tel && r.tel.blockedReason));
    r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 25 });
    check("nach 12 min: genau 2 Versuche (Pause ist um, nicht mehr)", r.fake.created.length === 2, "Versuche " + r.fake.created.length);
    r = await run(mod, { factions: ["Slum Snakes"], gang: { createThrows: "Nope" }, maxSchlaf: 6 });
    check("createGang wirft: 1 Versuch, Pause greift", r.fake.created.length === 1, "Versuche " + r.fake.created.length);
    check("und der Fehler ist gezaehlt (byCall.createGang)", r.tel && r.tel.errors && r.tel.errors.byCall.createGang === 1, J(r.tel && r.tel.errors));
    check("lastError nennt die Ursache", r.tel && r.tel.lastError && /Nope/.test(r.tel.lastError.msg), J(r.tel && r.tel.lastError));
  }

  head("S1e. Die Pause ueberlebt einen Neustart; Zeitstempel aus der Zukunft gelten nicht");
  {
    const stamp = (t) => ({ "data/gang.json": JSON.stringify({ lastCreateAt: t, lastCreate: { faction: "Slum Snakes", ok: false, at: t } }) });
    let r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 3, homeFiles: stamp(W0 - 2 * 60000) });
    check("Versuch vor 2 min (aus data/gang.json): kein neuer Versuch", r.fake.created.length === 0, "Versuche " + r.fake.created.length);
    r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 3, homeFiles: stamp(W0 - 11 * 60000) });
    check("Versuch vor 11 min: neuer Versuch erlaubt", r.fake.created.length === 1, "Versuche " + r.fake.created.length);
    r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 3, homeFiles: stamp(W0 + 1e9) });
    check("Zeitstempel aus der Zukunft wird ignoriert", r.fake.created.length === 1, "Versuche " + r.fake.created.length);
    r = await run(mod, { factions: ["Slum Snakes"], gang: { createResult: false }, maxSchlaf: 2, homeFiles: { "data/gang.json": "{kaputt" } });
    check("kaputte Telemetrie: Fehler gezaehlt, Lauf geht weiter",
      r.ended !== "threw" && r.tel && r.tel.errors && r.tel.errors.byCall.telemetry_read === 1, J(r.tel && r.tel.errors) + " " + r.ended);
  }

  head("S1f. Unlesbarer Ruf");
  {
    let r = await run(mod, { factions: ["Slum Snakes"], reps: { "Slum Snakes": "throw" }, maxSchlaf: 2 });
    check("Ruf nicht lesbar: nicht gegruendet", r.fake.created.length === 0, J(r.fake.created));
    check("Grund rep_unreadable, Fehler gezaehlt", r.tel && r.tel.blockedReason === "rep_unreadable" && r.tel.errors.byCall.factionRep >= 1, J(r.tel && [r.tel.blockedReason, r.tel.errors]));
    r = await run(mod, { factions: ["Slum Snakes", "Tetrads"], reps: { "Slum Snakes": "throw", "Tetrads": 5 }, maxSchlaf: 3 });
    check("ein Kandidat unlesbar, einer lesbar: NICHT gegruendet (Skeptiker 03.10.)", r.fake.created.length === 0, J(r.fake.created));
    check("Grund rep_unreadable, kein Versuch gezaehlt", r.tel && r.tel.blockedReason === "rep_unreadable" && r.tel.createAttempts === 0, J(r.tel && [r.tel.blockedReason, r.tel.createAttempts]));
  }

  head("S1g. Schon in einer Gang: nie gruenden");
  {
    const r = await run(mod, { factions: ["Slum Snakes"], gang: { inGang: true, members: members(["G01", "G02", "G03"]), maxUpdates: 5 } });
    check("createGang nie", r.fake.created.length === 0);
  }

  // -------------------------------------------------------------------------
  head("S2. Rekrutierung");
  {
    let r = await run(mod, { gang: { inGang: true, recruit: true, respect: 1, members: members(["G01", "G02", "G03"]), maxUpdates: 2 } });
    check("3 Mitglieder, Respekt 1: nicht rekrutiert", r.fake.recruited.length === 0, J(r.fake.recruited));
    r = await run(mod, { gang: { inGang: true, recruit: true, respect: 625, members: members(["G01", "G02", "G03"]), maxUpdates: 2 } });
    check("Respekt 625: bis 7 Mitglieder (5^1..5^4)", r.fake.members.length === 7, "Mitglieder " + r.fake.members.length);
    check("Namen eindeutig, lueckenlos G04..G07", J(r.fake.recruited) === J(["G04", "G05", "G06", "G07"]), J(r.fake.recruited));
    r = await run(mod, { gang: { inGang: true, recruit: true, respect: 1e12, members: members(["G01", "G02", "G03"]), maxUpdates: 2 } });
    check("sehr hoher Respekt: genau 12, nie mehr", r.fake.members.length === 12, "Mitglieder " + r.fake.members.length);
    r = await run(mod, { gang: { inGang: true, recruit: true, alwaysCanRecruit: true, members: members(["G01"]), maxUpdates: 2 } });
    check("canRecruitMember meldet immer true: Schleife endet bei 12", r.fake.members.length === 12 && r.ended !== "hang", "Mitglieder " + r.fake.members.length + " " + r.ended);
    r = await run(mod, { gang: { inGang: true, recruit: true, alwaysCanRecruit: true, recruitResult: false, members: members(["G01"]), maxUpdates: 2 } });
    check("recruitMember gibt false: gezaehlt, kein Haemmern",
      r.fake.recruited.length === 0 && r.tel && r.tel.errors.byCall.recruitMember >= 1 && r.ended !== "hang", J(r.tel && r.tel.errors));
    r = await run(mod, { gang: { inGang: true, recruit: true, respect: 625, members: members(["G01", "G03", "G02"]), maxUpdates: 2 } });
    check("vorhandene Namen werden nicht doppelt vergeben", new Set(r.fake.members.map((x) => x.name)).size === r.fake.members.length, J(r.fake.members.map((x) => x.name)));
  }

  // -------------------------------------------------------------------------
  head("S3. Aufgaben in der Schleife");
  {
    const lv = (n) => lvlAll(n);
    let r = await run(mod, { gang: { inGang: true, respect: 1000, wanted: 1,
      members: [{ name: "G01", lvl: lv(1) }, { name: "G02", lvl: lv(600) }, { name: "G03", lvl: lv(499) }], maxUpdates: 3 } });
    const task = (n) => r.fake.members.find((x) => x.name === n).task;
    check("Mitglied auf 1 -> Train Combat; 600 -> Terrorism; 499 -> Train Combat",
      task("G01") === "Train Combat" && task("G02") === "Terrorism" && task("G03") === "Train Combat", J(r.fake.members.map((x) => [x.name, x.task])));
    check("setMemberTask nur einmal je Mitglied (3 Aufrufe in 3 Runden)", r.fake.tasks.length === 3, J(r.fake.tasks));
    check("Telemetrie: taskCounts", r.tel && r.tel.taskCounts && r.tel.taskCounts["Train Combat"] === 2 && r.tel.taskCounts["Terrorism"] === 1, J(r.tel && r.tel.taskCounts));

    // Vigilante aus der Schleife: wanted 50, Strafe 0,5.
    r = await run(mod, { gang: { inGang: true, respect: 50, wanted: 50,
      members: members(["G01", "G02", "G03", "G04"], 600, { task: "Terrorism" }), maxUpdates: 2 } });
    const jus = r.fake.members.filter((x) => x.task === "Vigilante Justice").length;
    check("wanted 50 / Strafe 0,5: Vigilante gesetzt", jus >= 1 && jus <= 4, "Vigilante " + jus);
    r = await run(mod, { gang: { inGang: true, respect: 50, wanted: 1,
      members: members(["G01", "G02", "G03", "G04"], 600, { task: "Terrorism" }), maxUpdates: 2 } });
    check("wanted 1: kein Vigilante", r.fake.members.every((x) => x.task === "Terrorism"), J(r.fake.members.map((x) => x.task)));
    r = await run(mod, { gang: { inGang: true, respect: 1e6, wanted: 50,
      members: members(["G01", "G02", "G03", "G04"], 600, { task: "Terrorism" }), maxUpdates: 2 } });
    check("Strafe >= 0,95: kein Vigilante", r.fake.members.every((x) => x.task === "Terrorism"), J(r.fake.members.map((x) => x.task)));
    check("keine Aufgabenaenderung, wenn alles schon stimmt (0 Aufrufe)", r.fake.tasks.length === 0, J(r.fake.tasks));

    // Vigilante-Mitglieder kehren zurueck, wenn die Strafe wieder hoch ist.
    r = await run(mod, { gang: { inGang: true, respect: 50, wanted: 50,
      members: members(["G01", "G02", "G03", "G04"], 600, { task: "Vigilante Justice" }), maxUpdates: 3,
      onUpdate: (g) => { g.respect = 1e7; g.wanted = 1; } } });
    check("Strafe wieder gut: zurueck auf Terrorism", r.fake.members.every((x) => x.task === "Terrorism"), J(r.fake.members.map((x) => x.task)));
  }

  // -------------------------------------------------------------------------
  head("S4. Aufstieg");
  {
    const asc = (v) => uni(v);
    // nur str/def/dex wachsen (Train Combat laesst hack und cha unberuehrt)
    const combatAsc = (v) => ({ hack: 1, str: v, def: v, dex: v, agi: 1, cha: 1 });
    let r = await run(mod, { gang: { inGang: true, respect: 1000,
      members: [{ name: "G01", lvl: lvlAll(100), asc: combatAsc(1.5) }, { name: "G02", lvl: lvlAll(100), asc: combatAsc(1.6) }], maxUpdates: 2 } });
    check("Training: 1,5 -> nein, 1,6 -> ja", J(r.fake.ascended) === J(["G02"]), J(r.fake.ascended));
    r = await run(mod, { gang: { inGang: true, respect: 1000,
      members: [{ name: "G01", lvl: lvlAll(600), asc: asc(1.9), task: "Terrorism" }, { name: "G02", lvl: lvlAll(600), asc: asc(2.1), task: "Terrorism" }], maxUpdates: 2 } });
    check("Arbeit: 1,9 -> nein, 2,1 -> ja", J(r.fake.ascended) === J(["G02"]), J(r.fake.ascended));
    const g2 = r.fake.members.find((x) => x.name === "G02");
    check("Aufgestiegener aus der Arbeit geht zurueck ins Training (Terrorism -> Train Combat)", g2.task === "Train Combat", g2.task);
    r = await run(mod, { gang: { inGang: true, members: [{ name: "G01", lvl: lvlAll(100) }], maxUpdates: 2 } });
    check("getAscensionResult undefined (noch nicht aufsteigbar): kein Aufstieg, kein Fehler",
      r.fake.ascended.length === 0 && r.tel.errors.total === 0, J(r.tel && r.tel.errors));
    r = await run(mod, { gang: { inGang: true, ascendThrows: true, members: [{ name: "G01", lvl: lvlAll(100), asc: asc(3) }], maxUpdates: 2 } });
    check("ascendMember wirft: gezaehlt, Lauf geht weiter",
      r.tel && r.tel.errors.byCall.ascendMember >= 1 && r.ended !== "threw", J(r.tel && r.tel.errors));
    r = await run(mod, { gang: { inGang: true, members: [{ name: "G01", lvl: lvlAll(100), asc: { ...asc(3), str: NaN } }], maxUpdates: 2 } });
    check("Ergebnis mit NaN: kein Aufstieg", r.fake.ascended.length === 0, J(r.fake.ascended));
    check("Telemetrie zaehlt Aufstiege", (await run(mod, { gang: { inGang: true, members: [{ name: "G01", lvl: lvlAll(100), asc: asc(3) }], maxUpdates: 2, tick: 15000 } })).tel.ascensions === 1);
  }

  // -------------------------------------------------------------------------
  head("S5. Verboten: Warfare, Ausruestung, alles Unerwartete");
  {
    const r = await run(mod, {
      factions: ["Slum Snakes"], reps: { "Slum Snakes": 0 },
      gang: { respect: 1e7, wanted: 40, maxUpdates: 60, tick: 15000,
        onUpdate: (g, n) => {
          for (const x of g.members) { x.lvl = lvlAll(Math.min(900, 1 + n * 20)); x.asc = n % 7 === 0 ? uni(2.5) : undefined; }
          g.wanted = 1 + (n % 5) * 20;
        } } });
    check("60 Takte: kein verbotener ns.gang-Aufruf", r.fake.forbidden.length === 0, J(r.fake.forbidden));
    check("Warfare bleibt aus", r.fake.warfare === false);
    check("Lauf erreichte Mitglieder und Aufstiege", r.fake.members.length >= 3 && r.fake.ascended.length >= 1, r.fake.members.length + " Mitglieder, " + r.fake.ascended.length + " Aufstiege");
    const code = ohneKommentare(srcText);
    check("Quelltext (ohne Kommentare) kennt setTerritoryWarfare nicht", !/setTerritoryWarfare/.test(code));
    // Seit P2d kennt der Quelltext die Ausruestung - aber nur hinter dem Modus MONEY.
    // Im Modus RESPECT (hier: kein Bedarf in bn4rep.json) darf KEIN Equipment-Aufruf fallen.
    check("Modus RESPECT: kein einziger Equipment-Aufruf in 60 Takten (auch nicht lesend)",
      r.fake.equipCalls.length === 0, J(r.fake.equipCalls.slice(0, 5)));
    check("Quelltext kennt kein getInstallResult", !/getInstallResult/.test(code));
    check("Quelltext nennt den Typ 'Augmentation' nirgends im Code (nur in Kommentaren)", !/["']Augmentation["']/.test(code));
    check("Quelltext ruft nie Territory Warfare als Aufgabe", !/["']Territory Warfare["']/.test(code));
  }

  // -------------------------------------------------------------------------
  head("S6. Die Schleife: Gang-Takt, Rueckfall, Abbruch, Grenzen");
  {
    let r = await run(mod, { gang: { inGang: true, members: members(["G01", "G02", "G03"]), maxUpdates: 8 } });
    check("im Normalbetrieb kein ns.sleep (Takt = nextUpdate)", r.m.zustand.schlafZeiten.filter((x) => x === 30000).length === 0
      && r.fake.updates >= 8, "Schlaf " + J(r.m.zustand.schlafZeiten) + ", Updates " + r.fake.updates);
    check("Abbruch im Warten beendet main() (kein Haenger)", r.ended === "abort", r.ended);
    check("Telemetrie zaehlt Takte", r.tel && r.tel.updates >= 1, J(r.tel && r.tel.updates));

    // Der Takt steht: nextUpdate kommt nie, der Rueckfall (asleep) liefert.
    r = await run(mod, { gang: { inGang: true, nextUpdateMode: "never", asleepMode: "resolveThenAbort", asleepN: 6,
      members: [{ name: "G01", lvl: lvlAll(1) }, { name: "G02", lvl: lvlAll(700) }], tick: 20000 } });
    check("Takt steht: der Rueckfall treibt die Schleife (>= 6 Zeitueberschreitungen)", r.fake.asleepCalls >= 6 && r.ended === "abort", "asleep " + r.fake.asleepCalls + ", " + r.ended);
    check("und die Fuehrung laeuft im Rueckfall weiter (Aufgaben gesetzt)",
      r.fake.members.find((x) => x.name === "G01").task === "Train Combat" && r.fake.members.find((x) => x.name === "G02").task === "Terrorism", J(r.fake.members.map((x) => x.task)));
    check("Telemetrie bleibt im Rueckfall frisch (timeouts gezaehlt)", r.tel && r.tel.timeouts >= 1 && r.tel.ts > W0, J(r.tel && [r.tel.timeouts, r.tel.ts]));

    // Fehlerserie: nextUpdate wirft immer, der Schlaf bricht nicht ab.
    r = await run(mod, { gang: { inGang: true, nextUpdateMode: "throws", members: members(["G01"]) }, maxSchlaf: 100000 });
    check("Fehlerserie: main() endet von selbst (kein Haenger)", r.ended === "returned", r.ended + " " + (r.err && r.err.message));
    check("Zustand blocked/err_streak und errStreak = MAX_ERR_STREAK",
      r.tel && r.tel.state === "blocked" && r.tel.blockedReason === "err_streak" && r.tel.errStreak === mod.MAX_ERR_STREAK, J(r.tel && [r.tel.state, r.tel.blockedReason, r.tel.errStreak]));
    check("nextUpdate-Fehler gezaehlt (byCall.nextUpdate = MAX_ERR_STREAK)", r.tel && r.tel.errors.byCall.nextUpdate === mod.MAX_ERR_STREAK, J(r.tel && r.tel.errors));
    check("Fehlerpausen: je Fehler ein Schlaf (kein Kreisrennen)", r.m.zustand.schlafZeiten.length === mod.MAX_ERR_STREAK - 1 || r.m.zustand.schlafZeiten.length === mod.MAX_ERR_STREAK, "Schlaefe " + r.m.zustand.schlafZeiten.length);

    // Harte Obergrenze.
    r = await run(mod, { gang: { inGang: true, members: members(["G01", "G02", "G03"]), maxUpdates: Infinity, tick: 0 } });
    check("MAX_ROUNDS erreicht: main() endet sauber", r.ended === "returned", r.ended + " " + (r.err && r.err.message));
    check("Telemetrie: round = MAX_ROUNDS, state done, Grund max_rounds",
      r.tel && r.tel.round === mod.MAX_ROUNDS && r.tel.state === "done" && r.tel.blockedReason === "max_rounds", J(r.tel && [r.tel.round, r.tel.state, r.tel.blockedReason]));
    check("MAX_ROUNDS ist begrenzt (<= 100000)", mod.MAX_ROUNDS > 0 && mod.MAX_ROUNDS <= 100000, String(mod.MAX_ROUNDS));
  }

  // -------------------------------------------------------------------------
  head("S7. Der Schalter data/gang-an.txt");
  {
    let r = await run(mod, { noSwitch: true, factions: ["Slum Snakes"], gang: { inGang: true, members: members(["G01"]), maxUpdates: 5 } });
    check("ohne Schalter: main() kehrt sofort zurueck", r.ended === "returned", r.ended);
    check("ohne Schalter: kein einziger Gang-Aufruf", r.fake.tasks.length === 0 && r.fake.created.length === 0 && r.fake.updates === 0, J([r.fake.tasks, r.fake.created]));
    check("ohne Schalter: Telemetrie done/switch_off", r.tel && r.tel.state === "done" && r.tel.blockedReason === "switch_off", J(r.tel && [r.tel.state, r.tel.blockedReason]));
  }
  {
    // Der Schalter faellt mitten im Lauf weg. Der Kern beendet ein laufendes
    // Werkzeug nicht, wenn die Vorbedingung nachtraeglich wegfaellt - also muss
    // gang.js es selbst merken. `onMock` reicht den Mock heraus, damit der Test
    // die Datei waehrend des Laufs loeschen kann.
    let handle = null;
    const r = await run(mod, { gang: { inGang: true, members: members(["G01", "G02", "G03"]), maxUpdates: 50,
      onUpdate: (g, n) => { if (n === 4 && handle) delete handle.zustand.dateien.home["data/gang-an.txt"]; } },
      onMock: (m) => { handle = m; } });
    check("Schalter faellt weg: Steuerung endet nach dem naechsten Takt", r.ended === "returned" && r.fake.updates >= 4 && r.fake.updates <= 6, r.ended + " Updates " + r.fake.updates);
    check("und meldet done/switch_off", r.tel && r.tel.state === "done" && r.tel.blockedReason === "switch_off", J(r.tel && [r.tel.state, r.tel.blockedReason]));
  }

  // -------------------------------------------------------------------------
  head("S8. Hacking-Gang (z.B. von Hand mit NiteSec gegruendet)");
  {
    const r = await run(mod, { gang: { inGang: true, isHacking: true, faction: "NiteSec", respect: 1e6,
      members: members(["G01", "G02", "G03"]), maxUpdates: 3 } });
    check("keine Aufgaben, kein Rekrutieren (Terrorism gibt es dort nicht)", r.fake.tasks.length === 0 && r.fake.recruited.length === 0, J([r.fake.tasks, r.fake.recruited]));
    check("Telemetrie blocked/hacking_gang", r.tel && r.tel.state === "blocked" && r.tel.blockedReason === "hacking_gang", J(r.tel && [r.tel.state, r.tel.blockedReason]));
  }

  // -------------------------------------------------------------------------
  head("S9. Fehler werden gezaehlt, nicht geschluckt");
  {
    let r = await run(mod, { gang: { inGang: true, respect: 1000, infoThrows: ["G02"],
      members: [{ name: "G01", lvl: lvlAll(1) }, { name: "G02", lvl: lvlAll(1) }, { name: "G03", lvl: lvlAll(600) }], maxUpdates: 3, tick: 15000 } });
    check("kaputtes Mitglied: Fehler gezaehlt", r.tel && r.tel.errors.byCall.getMemberInformation >= 1, J(r.tel && r.tel.errors));
    check("lastError benennt den Aufruf", r.tel && r.tel.lastError && r.tel.lastError.call === "getMemberInformation" && /G02/.test(r.tel.lastError.msg), J(r.tel && r.tel.lastError));
    check("die uebrigen werden weiter gefuehrt", r.fake.members.find((x) => x.name === "G03").task === "Terrorism" && r.fake.members.find((x) => x.name === "G01").task === "Train Combat");
    check("das kaputte Mitglied wird NICHT auf Verdacht umgesetzt", r.fake.members.find((x) => x.name === "G02").task === "Unassigned");
    check("okRound waechst nicht in Fehlerrunden", r.tel && r.tel.okRound < r.tel.round, J(r.tel && [r.tel.okRound, r.tel.round]));
    check("einzelne Aufruffehler erhoehen errStreak nicht", r.tel && r.tel.errStreak === 0, J(r.tel && r.tel.errStreak));
    r = await run(mod, { gang: { inGang: true, setTaskResult: false, members: members(["G01"]), maxUpdates: 2, tick: 15000 } });
    check("setMemberTask gibt false: gezaehlt", r.tel && r.tel.errors.byCall.setMemberTask >= 1, J(r.tel && r.tel.errors));
    r = await run(mod, { host: "werk-0", scp: () => false, gang: { inGang: true, members: members(["G01"]), maxUpdates: 2, tick: 15000 } });
    check("Telemetrie erreicht home nicht (scp false): gezaehlt, kein Absturz", r.ended !== "threw", r.ended + " " + (r.err && r.err.message));
    r = await run(mod, { gang: { inGang: true, members: members(["G01"]), maxUpdates: 2, tick: 15000 } });
    check("fehlerfreier Lauf: errors.total = 0", r.tel && r.tel.errors.total === 0 && r.tel.lastError === null, J(r.tel && [r.tel.errors, r.tel.lastError]));
  }

  // -------------------------------------------------------------------------
  head("S10. Telemetrie data/gang.json (Pflichtfelder, Werkbank)");
  {
    const r = await run(mod, { host: "werk-0", gang: { inGang: true, faction: "Slum Snakes", respect: 1234, wanted: 3,
      members: members(["G01", "G02", "G03"]), maxUpdates: 3, tick: 15000 }, reps: { "Slum Snakes": 321 } });
    const t = r.tel;
    check("Block liegt auf home (von der Werkbank per scp)", !!t, "keine Telemetrie auf home");
    const must = ["ts", "wall", "playtime", "motorTimeMs", "round", "okRound", "errStreak", "lastError", "host", "version", "state", "blockedReason"];
    check("alle Pflichtfelder aus ARCHITEKTUR 4.1 da", t && must.every((k) => k in t), J(t && must.filter((k) => !(k in t))));
    check("errStreak und lastError sind Felder (sonst gilt der Block als veraltet)", t && t.errStreak === 0 && t.lastError === null);
    check("host = Werkbank, state work", t && t.host === "werk-0" && t.state === "work", J(t && [t.host, t.state]));
    check("Gang-Felder: inGang, faction, members, respect, wanted, penalty",
      t && t.inGang === true && t.faction === "Slum Snakes" && t.members === 3 && t.respect === 1234 && t.wanted === 3
      && Math.abs(t.penalty - 1234 / 1237) < 1e-9, J(t));
    check("factionRep aus getFactionRep", t && t.factionRep === 321, J(t && t.factionRep));
    check("ts ist die Wanduhr des Laufs", t && Number.isFinite(t.ts) && t.ts >= W0 && t.ts === t.wall);
    check("ohne Gang auf der Werkbank: ebenfalls Telemetrie", (await run(mod, { host: "werk-0", factions: [], maxSchlaf: 2 })).tel !== null);
  }

  // -------------------------------------------------------------------------
  head("S11. Registry-Eintrag und Gating");
  {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
    const e = reg.eintraege.find((x) => x.name === "gang.js");
    const blade = reg.eintraege.find((x) => x.name === "blade.js");
    const rep = reg.eintraege.find((x) => x.name === "bn4rep.js");
    check("Eintrag gang.js existiert", !!e);
    if (e) {
      check("verfahren V2, knoten [2], phase normal", e.verfahren === "V2" && J(e.knoten) === "[2]" && e.phase === "normal", J([e.verfahren, e.knoten, e.phase]));
      check("needsFigure none, killSafe, restartPolicy always", e.needsFigure === "none" && e.killSafe === true && e.restartPolicy === "always");
      check("Telemetrie data/gang.json, Schalter data/gang-an.txt", e.telemetryFile === "data/gang.json" && e.precondition && e.precondition.requiresFile === "data/gang-an.txt");
      check("Prioritaet hinter blade.js und bn4rep.js", e.priority > blade.priority && e.priority > rep.priority, e.priority + " gegen " + blade.priority + "/" + rep.priority);
      check("freshnessMs deckt den Rueckfalltakt (mindestens 10 min)", e.freshnessMs >= 600000);
      check("werkbank-Gewerk kopiert nach home", e.hostRule === "werkbank" && e.scpToHome === true);
      check("needsLibs fuehrt lib/hostdatei.js (der Kern loest nicht transitiv auf)", (e.needsLibs || []).includes("lib/hostdatei.js"));
      const lage = (o) => ({ node: 2, verfahren: "V2", phase: "normal", dateiDa: (d) => d !== "data/gang-an.txt" || o.schalter, ...o });
      check("Gating: BN2 + V2 + Schalter -> gilt", REG.gilt(e, lage({ schalter: true })).gilt === true);
      const ohne = REG.gilt(e, lage({ schalter: false }));
      check("Gating: ohne Schalter -> wartet auf data/gang-an.txt", ohne.gilt === false && /gang-an/.test(ohne.grund), J(ohne));
      check("Gating: BN3 -> gilt nicht", REG.gilt(e, lage({ schalter: true, node: 3 })).gilt === false);
      check("Gating: BN2 aber V1 -> gilt nicht", REG.gilt(e, lage({ schalter: true, verfahren: "V1" })).gilt === false);
      check("Gating: Kaltstart-Phase -> gilt nicht", REG.gilt(e, lage({ schalter: true, phase: "kaltstart" })).gilt === false);
      check("Gating: Rolle unbekannt (verfahren.txt noch vom alten Knoten) -> gilt nicht",
        REG.gilt(e, lage({ schalter: true, verfahren: "unbekannt" })).gilt === false);
    }
  }

  // -------------------------------------------------------------------------
  head("P6. checkPrereq: Paket 0 UND Paket 1 live, frisch, richtiger Knoteneintritt");
  // Gegen den Stand VOR der Reparatur (GANG_SRC=<alte gang.js>) gibt es die
  // Funktionen nicht: dann ROT mit klarer Aussage statt eines Absturzes.
  const hasPrereq = typeof mod.checkPrereq === "function" && typeof mod.localStamp === "function";
  check("checkPrereq und localStamp sind exportiert (Voraussetzungssperre vorhanden)", hasPrereq);
  if (hasPrereq) {
    const NOW = W0;
    const good = { zeit: NOW - 5000, knoten: 2, nodeReset: 777, v1Positiv: false, gateBuy: true };
    const ri = { currentNode: 2, lastNodeReset: 777 };
    const chk = (tel, reset = ri, now = NOW) => mod.checkPrereq(tel, now, reset);
    const without = (k) => { const c = { ...good }; delete c[k]; return c; };
    const mentions = (r, re) => r.missing.some((x) => re.test(x));
    let r = chk(good);
    check("alles da -> ok, nichts fehlt", r.ok === true && r.missing.length === 0, J(r));

    r = chk(null);
    check("keine Datei (null) -> nicht ok", r.ok === false && mentions(r, /fehlt oder ist unlesbar/), J(r));
    check("Text statt Objekt -> nicht ok", chk("x").ok === false && chk(42).ok === false && chk([good]).ok === false);

    // Paket 0
    r = chk(without("v1Positiv"));
    check("Paket 0: Feld fehlt (alte bn4rep.js) -> nicht ok", r.ok === false && mentions(r, /Paket 0 nicht live/), J(r));
    check("Paket 0: Text 'false' ist kein Boolean -> nicht ok", chk({ ...good, v1Positiv: "false" }).ok === false);
    check("Paket 0: null -> nicht ok", chk({ ...good, v1Positiv: null }).ok === false);
    check("Paket 0: 0 -> nicht ok", chk({ ...good, v1Positiv: 0 }).ok === false);
    r = chk({ ...good, v1Positiv: true });
    check("Paket 0: v1Positiv true (TRP waere Kandidat) -> nicht ok", r.ok === false && mentions(r, /ist true/), J(r));

    // Paket 1
    r = chk(without("gateBuy"));
    check("Paket 1: Feld fehlt -> nicht ok", r.ok === false && mentions(r, /Paket 1 nicht live/), J(r));
    check("Paket 1: false -> nicht ok", chk({ ...good, gateBuy: false }).ok === false);
    check("Paket 1: Text 'true' -> nicht ok", chk({ ...good, gateBuy: "true" }).ok === false);
    check("Paket 1: 1 -> nicht ok", chk({ ...good, gateBuy: 1 }).ok === false);
    check("P0 ohne P1 reicht nicht, P1 ohne P0 reicht nicht",
      chk({ ...good, gateBuy: undefined }).ok === false && chk({ ...good, v1Positiv: undefined }).ok === false);

    // Frische (Grenze: genau 30 min noch ok, darueber nicht)
    check("Frist: 29 min alt -> ok", chk({ ...good, zeit: NOW - 29 * 60000 }).ok === true);
    check("Frist: genau 30 min alt -> ok", chk({ ...good, zeit: NOW - 30 * 60000 }).ok === true);
    r = chk({ ...good, zeit: NOW - 31 * 60000 });
    check("Frist: 31 min alt -> nicht ok (veraltet)", r.ok === false && mentions(r, /veraltet/), J(r));
    r = chk({ ...good, zeit: NOW + 120000 });
    check("Uhrensprung: 2 min aus der Zukunft -> nicht ok", r.ok === false && mentions(r, /Zukunft/), J(r));
    check("30 s aus der Zukunft (Toleranz 60 s) -> ok", chk({ ...good, zeit: NOW + 30000 }).ok === true);
    r = chk(without("zeit"));
    check("ohne Zeitstempel -> nicht ok", r.ok === false && mentions(r, /ohne Zeitstempel/), J(r));
    check("Zeit als Text -> nicht ok", chk({ ...good, zeit: "heute" }).ok === false);
    check("ts statt zeit (wie der Kern es liest) -> ok", chk({ ...without("zeit"), ts: NOW - 1000 }).ok === true);
    check("wall statt zeit -> ok", chk({ ...without("zeit"), wall: NOW - 1000 }).ok === true);

    // Knoteneintritt
    r = chk({ ...good, knoten: 3 });
    check("anderer Knoten -> nicht ok", r.ok === false && mentions(r, /Knoteneintritt/), J(r));
    r = chk({ ...good, nodeReset: 778 });
    check("gleicher Knoten, anderer Eintritt (nodeReset) -> nicht ok", r.ok === false && mentions(r, /Knoteneintritt/), J(r));
    check("nodeReset fehlt -> nicht ok", chk(without("nodeReset")).ok === false);
    check("knoten fehlt -> nicht ok", chk(without("knoten")).ok === false);
    check("Knoten als Text '2' -> nicht ok", chk({ ...good, knoten: "2" }).ok === false);
    r = chk(good, null);
    check("getResetInfo nicht lesbar -> nicht ok", r.ok === false && mentions(r, /getResetInfo/), J(r));
    check("getResetInfo ohne Zahlen -> nicht ok",
      chk(good, { currentNode: NaN, lastNodeReset: 777 }).ok === false && chk(good, {}).ok === false);

    // Alles auf einmal: die Telemetrie nennt ALLE Maengel, nicht nur den ersten.
    r = chk({});
    check("leere Datei: alle vier Maengel gesammelt (Zeit, Knoten, Paket 0, Paket 1)", r.ok === false && r.missing.length === 4, J(r));

    // Vertrag: die Feldnamen sind die mit Paket 0 / Paket 1 vereinbarten.
    check("Feldname Paket 0 ist v1Positiv, Paket 1 ist gateBuy",
      mod.PREREQ_P0_FIELD === "v1Positiv" && mod.PREREQ_P1_FIELD === "gateBuy", J([mod.PREREQ_P0_FIELD, mod.PREREQ_P1_FIELD]));
    check("Frist = freshnessMs des bn4rep-Eintrags (30 min)", mod.PREREQ_MAX_AGE_MS === 30 * 60000);

    // Ortszeit statt UTC (Log).
    check("localStamp: 23:05:09 aus lokalen Bestandteilen", mod.localStamp(new Date(2026, 9, 3, 23, 5, 9)) === "23:05:09");
    check("localStamp: fuehrende Nullen", mod.localStamp(new Date(2026, 0, 1, 1, 2, 3)) === "01:02:03");
  }

  // -------------------------------------------------------------------------
  head("S12. Die Sperre vor createGang (Skeptiker-Auflage 1): ohne P0 UND P1 NIE gegruendet");
  {
    const base = { factions: ["Slum Snakes"], reps: { "Slum Snakes": 0 }, gang: { maxUpdates: 1 }, maxSchlaf: 6 };
    const blocked = async (label, extra, re) => {
      const r = await run(mod, { ...base, ...extra });
      check(label + ": createGang 0x", r.fake.created.length === 0, J(r.fake.created));
      check(label + ": Telemetrie wait/prereq_missing",
        r.tel && r.tel.state === "wait" && r.tel.blockedReason === "prereq_missing", J(r.tel && [r.tel.state, r.tel.blockedReason]));
      check(label + ": prereq.missing nennt den Grund",
        r.tel && r.tel.prereq && r.tel.prereq.ok === false && r.tel.prereq.missing.some((x) => re.test(x)), J(r.tel && r.tel.prereq));
      check(label + ": kein Versuch gezaehlt, keine Pause gestartet",
        r.tel && r.tel.createAttempts === 0 && r.tel.lastCreateAt === 0, J(r.tel && [r.tel.createAttempts, r.tel.lastCreateAt]));
      check(label + ": kein verbotener Gang-Aufruf, kein Haenger", r.fake.forbidden.length === 0 && r.ended !== "hang", J(r.fake.forbidden) + " " + r.ended);
      return r;
    };
    await blocked("bn4rep.json fehlt", { noBn4rep: true }, /fehlt oder ist unlesbar/);
    await blocked("Paket 0 fehlt (alte bn4rep.js)", { bn4rep: { v1Positiv: undefined } }, /Paket 0 nicht live/);
    await blocked("Paket 1 fehlt", { bn4rep: { gateBuy: undefined } }, /Paket 1 nicht live/);
    await blocked("beide fehlen (Stand von heute: bn4rep.js ohne P0/P1)", { bn4rep: { v1Positiv: undefined, gateBuy: undefined } }, /Paket 0 nicht live/);
    await blocked("v1Positiv true", { bn4rep: { v1Positiv: true } }, /ist true/);
    await blocked("bn4rep.json veraltet (31 min)", { bn4rep: { zeit: W0 - 31 * 60000 } }, /veraltet/);
    await blocked("bn4rep.json aus dem alten Knoteneintritt (nodeReset)", { bn4rep: { nodeReset: NODE_RESET - 5000 } }, /Knoteneintritt/);
    await blocked("bn4rep.json aus einem anderen Knoten", { bn4rep: { knoten: 3 } }, /Knoteneintritt/);

    let r = await blocked("bn4rep.json kaputt (halbes JSON)", { bn4repRaw: '{"zeit": 1, "gateBuy": tr' }, /fehlt oder ist unlesbar/);
    check("kaputtes JSON ist als Fehler gezaehlt (byCall.bn4rep_parse), nicht still", r.tel && r.tel.errors.byCall.bn4rep_parse >= 1, J(r.tel && r.tel.errors));
    r = await blocked("getResetInfo wirft", { resetThrows: true }, /getResetInfo/);
    check("getResetInfo-Fehler ist gezaehlt (byCall.resetInfo)", r.tel && r.tel.errors.byCall.resetInfo >= 1, J(r.tel && r.tel.errors));

    // Sechs Takte lang gesperrt: EINE Logzeile, nicht sechs.
    r = await run(mod, { ...base, bn4rep: { gateBuy: undefined } });
    check("Log: genau eine Zeile GRUENDUNG GESPERRT ueber sechs Takte", (r.log.match(/GRUENDUNG GESPERRT/g) || []).length === 1, r.log.slice(0, 400));
    check("Log nennt den Grund im Klartext", /GRUENDUNG GESPERRT: .*gateBuy/.test(r.log), r.log.slice(0, 300));
    // Das Alter waechst mit jedem Takt ("31 min" -> "34 min"): derselbe Befund, EINE Zeile.
    r = await run(mod, { ...base, bn4rep: { zeit: W0 - 31 * 60000 }, maxSchlaf: 12 });
    check("Log: veraltete Datei, Alter waechst ueber sechs Minuten - trotzdem nur eine Zeile",
      (r.log.match(/GRUENDUNG GESPERRT/g) || []).length === 1 && /veraltet \(31 min/.test(r.log), r.log.slice(0, 400));

    // Alles da: genau ein Aufruf, Telemetrie zeigt ok.
    r = await run(mod, { ...base });
    check("alles da: createGang genau 1x", J(r.fake.created) === J(["Slum Snakes"]), J(r.fake.created));
    check("alles da: prereq.ok true, nichts fehlt", r.tel && r.tel.prereq && r.tel.prereq.ok === true && r.tel.prereq.missing.length === 0, J(r.tel && r.tel.prereq));
    check("alles da: Log meldet die erfuellten Voraussetzungen", /Voraussetzungen erfuellt/.test(r.log));

    // Die Voraussetzung kommt MITTEN im Lauf (P1 wird eingespielt): ab dann geht es los.
    const seen = [];
    r = await run(mod, { ...base, noBn4rep: true, maxSchlaf: 12, gang: { maxUpdates: 2 },
      onSleep: (n, m) => {
        seen.push(n);
        if (n === 4) m.lege("home", "data/bn4rep.json", bn4repText({ zeit: m.zustand.wall - 2000 }));
      } });
    check("Voraussetzung erscheint nach 4 Takten: danach genau 1x gegruendet", J(r.fake.created) === J(["Slum Snakes"]), J(r.fake.created) + " Schlaefe " + J(seen));
    check("... ohne dass die Sperre eine Pause erzeugt haette (sofort im naechsten Takt)",
      r.tel && r.tel.createAttempts === 1 && r.tel.lastCreate && r.tel.lastCreate.ok === true, J(r.tel && [r.tel.createAttempts, r.tel.lastCreate]));
    check("Log: erst GESPERRT, dann erfuellt, dann GRUENDUNG",
      /GRUENDUNG GESPERRT[\s\S]*Voraussetzungen erfuellt[\s\S]*GRUENDUNG #1/.test(r.log), r.log.slice(0, 500));

    // Die Pause nach einem echten Fehlschlag bleibt davon unberuehrt.
    r = await run(mod, { ...base, gang: { createResult: false }, maxSchlaf: 15 });
    check("Fehlschlag trotz erfuellter Sperre: 1 Versuch in 7,5 min (Pause greift weiter)", r.fake.created.length === 1, "Versuche " + r.fake.created.length);

    // Schon in einer Gang: die Sperre schuetzt nur den unumkehrbaren Schritt.
    r = await run(mod, { noBn4rep: true, factions: ["Slum Snakes"],
      gang: { inGang: true, members: members(["G01", "G02", "G03"], 600), maxUpdates: 3, tick: 15000 } });
    check("in Gang und ohne bn4rep.json: die Fuehrung laeuft normal (Aufgaben gesetzt)",
      r.fake.tasks.length === 3 && r.tel && r.tel.state === "work" && r.tel.blockedReason === null, J(r.fake.tasks) + " " + J(r.tel && [r.tel.state, r.tel.blockedReason]));
    check("in Gang: keine Pruefung (prereq bleibt null)", r.tel && r.tel.prereq === null, J(r.tel && r.tel.prereq));
    check("in Gang: kein Fehler gezaehlt", r.tel && r.tel.errors.total === 0, J(r.tel && r.tel.errors));

    // Auf der Werkbank: bn4rep.json wird von home geholt (liesVonHome), nicht lokal gelesen.
    r = await run(mod, { ...base, host: "werk-0" });
    check("Werkbank: bn4rep.json von home gelesen, gegruendet", J(r.fake.created) === J(["Slum Snakes"]), J(r.fake.created) + " " + J(r.tel && r.tel.prereq));
    r = await run(mod, { ...base, host: "werk-0", noBn4rep: true });
    check("Werkbank ohne bn4rep.json auf home: gesperrt", r.fake.created.length === 0);
  }

  // -------------------------------------------------------------------------
  head("S13. Vertrag mit bn4rep.js: die Feldnamen der Sperre stehen im Telemetrieblock");
  {
    const repPath = path.join(ROOT, "src", "bn4rep.js");
    const repCode = ohneKommentare(fs.readFileSync(repPath, "utf8").split("\r\n").join("\n"));
    const a = repCode.indexOf("letzteTelemetrie = {");
    const b = repCode.indexOf('ns.write("data/bn4rep.json", JSON.stringify(letzteTelemetrie)');
    const block = a >= 0 && b > a ? repCode.slice(a, b) : "";
    for (const [label, field] of [["Paket 0", mod.PREREQ_P0_FIELD], ["Paket 1", mod.PREREQ_P1_FIELD]]) {
      if (typeof field !== "string") { check(label + ": gang.js exportiert den Feldnamen", false); continue; }
      const irgendwo = new RegExp("\\b" + field + "\\b").test(repCode);
      if (!irgendwo) {
        // Noch nicht im Stand: das ist der Zustand VOR der Uebernahme von P0/P1. Kein Fehler -
        // aber laut. Die Sperre ist dann zu (fail closed), und genau das soll sie sein.
        if (loud) console.log("  OFFEN " + label + ": bn4rep.js schreibt '" + field + "' noch nicht - gang.js gruendet erst nach der Uebernahme");
        continue;
      }
      check(label + ": '" + field + "' steht im Telemetrieblock letzteTelemetrie von bn4rep.js",
        block.length > 0 && new RegExp("(^|[\\s{,])" + field + "\\s*[,:]").test(block), "Block " + (block ? "gefunden, Feld darin nicht" : "nicht gefunden"));
    }
    check("der Telemetrieblock hat die Felder knoten, nodeReset und zeit (Knoteneintritt und Frische der Sperre)",
      block.length === 0 || (/\bknoten\b/.test(block) && /\bnodeReset\b/.test(block) && /\bzeit\b/.test(block)), "Block " + (block ? "gefunden" : "nicht gefunden"));
  }

  // -------------------------------------------------------------------------
  head("S14. Logzeilen in Ortszeit, nicht UTC");
  {
    // Die Datumsfunktionen werden festgenagelt, damit der Test in JEDER
    // Zeitzone dasselbe misst: Ortszeit 07:08:09, UTC-Weg 03:04:05.
    const D = Date.prototype;
    const saved = { h: D.getHours, m: D.getMinutes, s: D.getSeconds, iso: D.toISOString };
    D.getHours = () => 7; D.getMinutes = () => 8; D.getSeconds = () => 9;
    D.toISOString = () => "2000-01-01T03:04:05.000Z";
    let r;
    try {
      r = await run(mod, { gang: { inGang: true, members: members(["G01"]), maxUpdates: 1 } });
    } finally {
      D.getHours = saved.h; D.getMinutes = saved.m; D.getSeconds = saved.s; D.toISOString = saved.iso;
    }
    check("die Startzeile beginnt mit der Ortszeit 07:08:09", /^07:08:09 {2}gang\.js gestartet/m.test(r.log), r.log.slice(0, 120));
    check("kein UTC-Stempel 03:04:05 im Log", !/03:04:05/.test(r.log), r.log.slice(0, 120));
  }

  // -------------------------------------------------------------------------
  head("P7. Die /bb-Zeile aus data/gang.json (tools/lib/gangzeile.js)");
  {
    const NOW = W0;
    const base = { ts: NOW - 60000, wall: NOW - 60000, inGang: true, state: "work", blockedReason: null,
      faction: "Slum Snakes", members: 6, respect: 12345, factionRep: 4321, penalty: 0.987,
      ascensions: 2, errors: { total: 0, byCall: {} }, lastError: null, createAttempts: 1 };
    check("keine Datei -> keine Zeile (gang.js lief nie)", gangZeile(null, NOW) === null && gangZeile(undefined, NOW) === null && gangZeile("x", NOW) === null);
    check("ohne Zeitstempel -> eine Zeile, die es sagt", /ohne Zeitstempel/.test(gangZeile({ inGang: true }, NOW) || ""));
    let z = gangZeile({ ...base, ts: NOW - 11 * 60000, wall: NOW - 11 * 60000 }, NOW);
    check("11 min alt -> 'laeuft nicht' mit dem Neustartweg", /11 min alt/.test(z) && /gang\.js laeuft nicht/.test(z) && /neustart\.js bn4net\.js/.test(z), z);
    check("genau 10 min alt -> noch frisch", /^GANG: Slum Snakes/.test(gangZeile({ ...base, ts: NOW - GANG_FRIST_MS, wall: NOW - GANG_FRIST_MS }, NOW)));
    z = gangZeile(base, NOW);
    check("laufende Gang: Faktion, Mitglieder, Respekt, Ruf, Strafe, Aufstiege, Fehler",
      /^GANG: Slum Snakes, 6 Mitglieder, Respekt 12\.345, Ruf 4\.321, Strafe 0\.99, Aufstiege 2, Fehler 0\.$/.test(z), z);
    z = gangZeile({ ...base, errors: { total: 3, byCall: { setMemberTask: 3 } }, lastError: { call: "setMemberTask", msg: "kaputt" } }, NOW);
    check("Fehler: Zahl und letzter Aufruf stehen drin", /Fehler 3\./.test(z) && /Letzter Fehler: setMemberTask - kaputt/.test(z), z);
    z = gangZeile({ ...base, inGang: false, blockedReason: "prereq_missing", state: "wait",
      prereq: { ok: false, missing: ["Paket 0 nicht live: Feld v1Positiv fehlt", "Paket 1 nicht live: Feld gateBuy fehlt"] } }, NOW);
    check("gesperrt: sagt GESPERRT und nennt BEIDE Maengel",
      /noch keine Gang/.test(z) && /GESPERRT/.test(z) && /v1Positiv/.test(z) && /gateBuy/.test(z), z);
    z = gangZeile({ ...base, inGang: false, blockedReason: "prereq_missing", prereq: null }, NOW);
    check("gesperrt ohne prereq-Feld: kein Absturz, 'Grund unbekannt'", /Grund unbekannt/.test(z), z);
    z = gangZeile({ ...base, inGang: false, blockedReason: "create_failed", createAttempts: 2 }, NOW);
    check("Gruendung fehlgeschlagen: Grund und Versuche", /create_failed/.test(z) && /Gruendungsversuche 2/.test(z), z);
    z = gangZeile({ ...base, state: "blocked", blockedReason: "hacking_gang" }, NOW);
    check("Hacking-Gang: Steuerung steht", /Steuerung steht \(blocked: hacking_gang\)/.test(z), z);
    z = gangZeile({ ...base, state: "done", blockedReason: "switch_off" }, NOW);
    check("Schalter weg: Steuerung steht (done: switch_off)", /Steuerung steht \(done: switch_off\)/.test(z), z);
    z = gangZeile({ ...base, factionRep: null, penalty: undefined }, NOW);
    check("fehlende Zahlen: Fragezeichen statt Absturz", /Ruf \?/.test(z) && /Strafe \?/.test(z), z);

    // Gegenprobe mit der ECHTEN Telemetrie eines Laufs: Schreiber und Leser passen zusammen.
    const r = await run(mod, { gang: { inGang: true, faction: "Slum Snakes", respect: 1234, wanted: 3,
      members: members(["G01", "G02", "G03"]), maxUpdates: 2, tick: 15000 }, reps: { "Slum Snakes": 321 } });
    const zr = r.tel ? gangZeile(r.tel, r.tel.ts + 1000) : null;
    check("echte Telemetrie eines Laufs wird gelesen", !!zr && /^GANG: Slum Snakes, 3 Mitglieder, Respekt 1\.234, Ruf 321,/.test(zr), String(zr));
    const rs = await run(mod, { factions: ["Slum Snakes"], reps: { "Slum Snakes": 0 }, bn4rep: { gateBuy: undefined }, maxSchlaf: 3 });
    const zs = rs.tel ? gangZeile(rs.tel, rs.tel.ts + 1000) : null;
    check("echte Telemetrie einer Sperre: Zeile nennt den Mangel", !!zs && /GESPERRT/.test(zs) && /gateBuy/.test(zs), String(zs));
  }

  // ===========================================================================
  // DER GELDMODUS (P2d, 04.10.2026)
  // ===========================================================================
  // Die reinen Funktionen fehlen im Stand vor P2d (gang-2): dann ROT mit klarer
  // Aussage statt eines Absturzes.
  const has = (...fns) => fns.every((f) => typeof mod[f] === "function");
  const REQ = 1_250_000;            // hoechster Rufbedarf des Bedarfsplans (SPTN-97)
  const NEED = REQ * 1.02;          // wie bn4rep.js / lib/einbau.js: repReq x REP_NEED_MARGIN
  const NOWM = W0;
  const goodTel = (over = {}) => ({
    zeit: NOWM - 5000, knoten: 2, nodeReset: 777, v1Positiv: false, gateBuy: true,
    torRunde: { repNeed: NEED, repNeedFaction: "Slum Snakes", repNeedWhy: "" }, ...over });
  const resetInfo = { currentNode: 2, lastNodeReset: 777 };

  // -------------------------------------------------------------------------
  head("P8. chooseMode: Grenzen, Hysterese, unbrauchbarer Bedarf");
  check("chooseMode ist exportiert (Geldmodus vorhanden)", has("chooseMode"));
  check("REP_NEED_MARGIN 1,02 und die Modusnamen", mod.REP_NEED_MARGIN === 1.02 && mod.MODE_RESPECT === "respect" && mod.MODE_MONEY === "money",
    J([mod.REP_NEED_MARGIN, mod.MODE_RESPECT, mod.MODE_MONEY]));
  if (has("chooseMode")) {
    const cm = (rep, need, onMoney = false) => mod.chooseMode({ rep, need, onMoney });
    check("rep knapp unter dem Bedarf -> respect", cm(NEED - 1, NEED) === "respect");
    check("rep genau auf dem Bedarf -> money (>=)", cm(NEED, NEED) === "money");
    check("rep weit darueber -> money", cm(1e9, NEED) === "money");
    check("Ruf 0 (nach dem Einbau) -> respect, auch mit Geldaufgabe zuvor", cm(0, NEED, true) === "respect" && cm(0, NEED, false) === "respect");
    // Hysterese: mit Geldaufgabe zuvor gilt die untere Schwelle = der Rufbedarf selbst (need / 1,02).
    check("Hysterese: auf der Geldaufgabe bleibt es bei rep == need/1,02 (hier REQ) money", cm(REQ, NEED, true) === "money");
    check("Hysterese: ... und bei rep 1 unter REQ geht es zurueck auf respect", cm(REQ - 1, NEED, true) === "respect");
    check("ohne Geldaufgabe zuvor gilt die obere Schwelle: rep == REQ -> respect", cm(REQ, NEED, false) === "respect");
    check("ohne Geldaufgabe: zwischen REQ und NEED -> respect, mit Geldaufgabe -> money",
      cm((REQ + NEED) / 2, NEED, false) === "respect" && cm((REQ + NEED) / 2, NEED, true) === "money");
    check("onMoney nur als echtes true: 1 / 'ja' zaehlen nicht", cm(REQ, NEED, 1) === "respect" && cm(REQ, NEED, "ja") === "respect");
    // Unbrauchbarer Bedarf -> respect (gang-2), egal wie hoch der Ruf ist.
    for (const [label, need] of [["null", null], ["undefined", undefined], ["0", 0], ["negativ", -5], ["NaN", NaN],
      ["Infinity", Infinity], ["Text", "1275000"], ["Objekt", {}]]) {
      check("Bedarf " + label + " -> respect", cm(1e12, need) === "respect" && cm(1e12, need, true) === "respect");
    }
    for (const [label, rep] of [["NaN", NaN], ["undefined", undefined], ["null", null], ["Text", "9e9"], ["Infinity", Infinity]]) {
      check("Ruf " + label + " (unlesbar) -> respect trotz Bedarf", cm(rep, NEED) === "respect" && cm(rep, NEED, true) === "respect");
    }
    check("zustandslos: gleiche Eingabe, gleiche Antwort (keine Merker)",
      cm(NEED, NEED, false) === cm(NEED, NEED, false) && cm(REQ, NEED, true) === cm(REQ, NEED, true));
  }

  // -------------------------------------------------------------------------
  head("P9. repNeedOf: Bedarf nur aus frischer, passender, eigener Telemetrie");
  check("repNeedOf ist exportiert", has("repNeedOf"));
  if (has("repNeedOf")) {
    const rn = (tel, reset = resetInfo, faction = "Slum Snakes", now = NOWM) => mod.repNeedOf(tel, now, reset, faction);
    let r = rn(goodTel());
    check("alles stimmt -> der Bedarf, kein Grund", r.need === NEED && r.why === "", J(r));
    check("keine Datei (null) / Text / Liste -> kein Bedarf",
      rn(null).need === null && rn("x").need === null && rn([goodTel()]).need === null && rn(42).need === null);
    // Frische wie die Voraussetzungssperre: 30 min.
    check("29 min alt -> ok, genau 30 min -> ok", rn(goodTel({ zeit: NOWM - 29 * 60000 })).need === NEED && rn(goodTel({ zeit: NOWM - 30 * 60000 })).need === NEED);
    r = rn(goodTel({ zeit: NOWM - 31 * 60000 }));
    check("31 min alt -> kein Bedarf (veraltet)", r.need === null && /veraltet/.test(r.why), J(r));
    r = rn(goodTel({ zeit: NOWM + 120000 }));
    check("2 min aus der Zukunft -> kein Bedarf", r.need === null && /Zukunft/.test(r.why), J(r));
    check("30 s aus der Zukunft -> ok (Toleranz 60 s)", rn(goodTel({ zeit: NOWM + 30000 })).need === NEED);
    const ohneZeit = goodTel(); delete ohneZeit.zeit;
    check("ohne Zeitstempel -> kein Bedarf; ts / wall statt zeit -> ok",
      rn(ohneZeit).need === null && rn({ ...ohneZeit, ts: NOWM - 1000 }).need === NEED && rn({ ...ohneZeit, wall: NOWM - 1000 }).need === NEED);
    check("Zeit als Text -> kein Bedarf", rn(goodTel({ zeit: "heute" })).need === null);
    // Knoteneintritt
    check("anderer Knoten -> kein Bedarf", rn(goodTel({ knoten: 3 })).need === null);
    check("gleicher Knoten, anderer Eintritt (nodeReset) -> kein Bedarf", rn(goodTel({ nodeReset: 778 })).need === null);
    check("getResetInfo nicht lesbar -> kein Bedarf", rn(goodTel(), null).need === null && rn(goodTel(), { currentNode: NaN, lastNodeReset: 777 }).need === null);
    // torRunde und repNeed
    check("kein torRunde-Block -> kein Bedarf", rn(goodTel({ torRunde: undefined })).need === null && rn(goodTel({ torRunde: null })).need === null && rn(goodTel({ torRunde: [] })).need === null);
    r = rn(goodTel({ torRunde: { repNeed: null, repNeedFaction: "Slum Snakes", repNeedWhy: "Plan enthaelt kein Stueck der Gang-Faktion" } }));
    check("repNeed null -> kein Bedarf, der Grund aus bn4rep wird mitgenommen", r.need === null && /Plan enthaelt/.test(r.why), J(r));
    for (const [label, v] of [["0", 0], ["negativ", -3], ["NaN", NaN], ["Text", "1275000"], ["Infinity", Infinity], ["fehlt", undefined]]) {
      check("repNeed " + label + " -> kein Bedarf", rn(goodTel({ torRunde: { repNeed: v, repNeedFaction: "Slum Snakes" } })).need === null);
    }
    // Faktion
    r = rn(goodTel(), resetInfo, "Tetrads");
    check("Bedarf gilt fuer Slum Snakes, die Gang ist bei Tetrads -> kein Bedarf", r.need === null && /Tetrads/.test(r.why), J(r));
    check("Gang-Faktion unbekannt (null / leer) -> kein Bedarf", rn(goodTel(), resetInfo, null).need === null && rn(goodTel(), resetInfo, "").need === null);
    check("repNeedFaction fehlt -> kein Bedarf", rn(goodTel({ torRunde: { repNeed: NEED } })).need === null);
  }

  // -------------------------------------------------------------------------
  head("P10. equipmentWishlist: billigste zuerst, nur Fehlendes");
  check("equipmentWishlist ist exportiert", has("equipmentWishlist"));
  if (has("equipmentWishlist")) {
    const items = [{ name: "Katana", cost: 12e6 }, { name: "Baseball Bat", cost: 1e6 }, { name: "Bulletproof Vest", cost: 2e6 }];
    let w = mod.equipmentWishlist([{ name: "A", upgrades: [] }, { name: "B", upgrades: ["Baseball Bat"] }], items);
    check("fehlende Paare, billigstes Stueck zuerst: Bat(A), Vest(A), Vest(B), Katana(A), Katana(B)",
      J(w.map((x) => x.item + "/" + x.member)) === J(["Baseball Bat/A", "Bulletproof Vest/A", "Bulletproof Vest/B", "Katana/A", "Katana/B"]),
      J(w.map((x) => x.item + "/" + x.member)));
    check("die Kosten stehen in der Liste", w[0].cost === 1e6 && w[w.length - 1].cost === 12e6);
    check("Besitz wird abgezogen: ein Mitglied mit allem steht nicht darin",
      mod.equipmentWishlist([{ name: "A", upgrades: ["Katana", "Baseball Bat", "Bulletproof Vest"] }], items).length === 0);
    check("unbekannter Besitz (null / fehlt) -> das Mitglied wird uebersprungen",
      mod.equipmentWishlist([{ name: "A", upgrades: null }, { name: "B" }, { name: "C", upgrades: [] }], items).every((x) => x.member === "C"));
    check("gleicher Preis: nach Stueck- und Mitgliedsname (deterministisch)",
      J(mod.equipmentWishlist([{ name: "B", upgrades: [] }, { name: "A", upgrades: [] }], [{ name: "Y", cost: 5 }, { name: "X", cost: 5 }]).map((x) => x.item + x.member))
      === J(["XA", "XB", "YA", "YB"]));
    check("leere Eingaben -> leere Liste", mod.equipmentWishlist([], items).length === 0 && mod.equipmentWishlist([{ name: "A", upgrades: [] }], []).length === 0
      && mod.equipmentWishlist(undefined, undefined).length === 0);
  }

  // -------------------------------------------------------------------------
  head("P11. planTasks im Geldmodus: Human Trafficking, Regler mit der Geldaufgabe");
  check("Geldmodus-Funktionen vorhanden (chooseMode, repNeedOf, equipmentWishlist)", has("chooseMode", "repNeedOf", "equipmentWishlist"));
  if (has("chooseMode")) {
    const g1 = { respect: 1000, wantedLevel: 1, wantedPenalty: 0.5, territory: 1 / 7 };
    const four = [
      { name: "a", task: "Unassigned", lvl: lvlAll(1) },
      { name: "b", task: "Unassigned", lvl: lvlAll(600) },
      { name: "c", task: "Unassigned", lvl: lvlAll(499) },
      { name: "d", task: "Unassigned", lvl: lvlAll(500) }];
    let p = mod.planTasks(g1, four, "money");
    check("money: Training bleibt Train Combat (1 und 499), Arbeit ab 500 ist Human Trafficking",
      p.assign.a === "Train Combat" && p.assign.c === "Train Combat" && p.assign.b === "Human Trafficking" && p.assign.d === "Human Trafficking", J(p.assign));
    p = mod.planTasks(g1, four, "respect");
    check("respect (ausdruecklich): Terrorism wie zuvor", p.assign.b === "Terrorism" && p.assign.d === "Terrorism", J(p.assign));
    p = mod.planTasks(g1, four);
    check("ohne Modusangabe: Terrorism (gang-2 bleibt Vorgabe)", p.assign.b === "Terrorism", J(p.assign));
    p = mod.planTasks(g1, four, "geld");
    check("unbekannter Modus -> Terrorism (nicht still auf Geld)", p.assign.b === "Terrorism", J(p.assign));
    p = mod.planTasks(g1, [{ name: "x", task: "Human Trafficking", lvl: lvlAll(900), ascended: true }], "money");
    check("money: in dieser Runde aufgestiegen -> Train Combat trotz alter Stufen", p.assign.x === "Train Combat", J(p.assign));
    check("Zaehler: taskCounts nennt Human Trafficking", mod.planTasks(g1, four, "money").counts["Human Trafficking"] === 2);

    // Der Wanted-Regler rechnet mit der Geldaufgabe: erwartete Anzahl unabhaengig mit der Sim-Formel.
    const expectedFor = (taskName, n, gg, lv) => {
      const T = F.TASKS[taskName], V = F.TASKS["Vigilante Justice"];
      let sum = n * F.wantedGain(gg, lv, T), e = 0;
      for (let i = 0; i < n && sum > 0; i++) { sum -= F.wantedGain(gg, lv, T); sum += F.wantedGain(gg, lv, V); e++; }
      return e;
    };
    const gg = { respect: 1000, wantedLevel: 20, territory: 1 / 7 };
    const wl = lvlAll(700);
    const six = Array.from({ length: 6 }, (_, i) => ({ name: "h" + i, task: "Human Trafficking", lvl: wl }));
    const eHT = expectedFor("Human Trafficking", 6, gg, wl);
    const eTerror = expectedFor("Terrorism", 6, gg, wl);
    p = mod.planTasks({ ...gg, wantedPenalty: 0.5 }, six, "money");
    check("Regler mit Human Trafficking: " + eHT + " von 6 auf Vigilante (Sim-Rechnung)", p.justice === eHT && eHT > 0 && eHT < 6, "gefunden " + p.justice + ", erwartet " + eHT);
    check("... und das ist NICHT die Terrorism-Zahl (" + eTerror + ") - der Test trennt die beiden", eHT !== eTerror, eHT + " gegen " + eTerror);
    p = mod.planTasks({ ...gg, wantedPenalty: 0.5 }, six.map((m) => ({ ...m, task: "Terrorism" })), "respect");
    check("Regler im Modus respect weiter mit Terrorism: " + eTerror, p.justice === eTerror, "gefunden " + p.justice);
    p = mod.planTasks({ ...gg, wantedPenalty: 0.99 }, six, "money");
    check("money, Strafe 0,99: kein Vigilante", p.justice === 0);
    p = mod.planTasks({ ...gg, wantedLevel: 1, wantedPenalty: 0.5 }, six, "money");
    check("money, wanted 1: kein Vigilante (wie zuvor)", p.justice === 0);
    const mixedHT = [700, 800, 900, 1000].map((n) => ({ name: "m" + n, task: "Human Trafficking", lvl: lvlAll(n) }));
    p = mod.planTasks({ respect: 1000, wantedLevel: 50, wantedPenalty: 0.5, territory: 1 / 7 }, mixedHT, "money");
    check("money: Vigilante trifft zuerst den schwaechsten (m700), der staerkste bleibt auf Human Trafficking",
      p.assign.m700 === "Vigilante Justice" && (p.justice === 4 || p.assign.m1000 === "Human Trafficking"), J(p.assign));
  }

  // -------------------------------------------------------------------------
  // Hilfen fuer die Laeufe im Geldmodus.
  const SS = "Slum Snakes";
  const torRunde = (over = {}) => ({ mode: "locked", repNeed: NEED, repNeedFaction: SS, repNeedAug: "SPTN-97 Gene Modification", repNeedWhy: "", ...over });
  /** Ein Lauf mit gueltigem Bedarf und Ruf; `noNeedFile` laesst data/geldbedarf.txt weg. */
  const moneyRun = (o = {}) => {
    const homeFiles = { ...(o.noNeedFile ? {} : { "data/geldbedarf.txt": o.needFile ?? "0" }), ...(o.homeFiles || {}) };
    const { noNeedFile, needFile, ...rest } = o;
    return run(mod, {
      reps: { [SS]: 2_000_000 },
      bn4rep: { torRunde: torRunde() },
      ...rest, homeFiles,
    });
  };
  const hasTasks = (r, expected) => J(r.fake.members.map((x) => x.name + ":" + x.task)) === J(expected);

  // -------------------------------------------------------------------------
  head("S15. Der Modus in der Schleife: money bei Ruf >= Bedarf, sonst respect");
  {
    const crew = () => [...members(["G01", "G02", "G03", "G04"], 600, { task: "Terrorism" }), { name: "G05", lvl: lvlAll(1) }];
    let r = await moneyRun({ gang: { inGang: true, respect: 1e6, wanted: 1, members: crew(), maxUpdates: 2, tick: 15000, moneyGainRate: 123456 } });
    check("Ruf 2 Mio >= Bedarf: die vier Arbeitenden auf Human Trafficking, der Neue im Training",
      hasTasks(r, ["G01:Human Trafficking", "G02:Human Trafficking", "G03:Human Trafficking", "G04:Human Trafficking", "G05:Train Combat"]),
      J(r.fake.members.map((x) => x.task)));
    check("Telemetrie: mode money, repNeed, kein Grund, moneyGainRate aus dem Spiel",
      r.tel && r.tel.mode === "money" && r.tel.repNeed === NEED && r.tel.repNeedWhy === "" && r.tel.moneyGainRate === 123456,
      J(r.tel && [r.tel.mode, r.tel.repNeed, r.tel.repNeedWhy, r.tel.moneyGainRate]));
    check("Telemetrie: taskCounts nennt Human Trafficking 4", r.tel && r.tel.taskCounts["Human Trafficking"] === 4, J(r.tel && r.tel.taskCounts));
    check("Log: genau eine Moduszeile, mit Ruf und Bedarf", (r.log.match(/MODUS/g) || []).length === 1 && /MODUS - -> money \(Ruf 2000000, Bedarf 1275000\)/.test(r.log), r.log.slice(0, 300));
    check("kein Fehler, Lauf ohne Haenger", r.tel && r.tel.errors.total === 0 && r.ended === "abort", J(r.tel && r.tel.errors) + " " + r.ended);

    // Die Grenze.
    r = await moneyRun({ reps: { [SS]: NEED - 1 }, gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
    check("Ruf einen unter dem Bedarf: Terrorism, mode respect", r.fake.members.slice(0, 4).every((x) => x.task === "Terrorism") && r.tel.mode === "respect",
      J(r.fake.members.map((x) => x.task)) + " " + (r.tel && r.tel.mode));
    r = await moneyRun({ reps: { [SS]: NEED }, gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
    check("Ruf genau auf dem Bedarf: Human Trafficking", r.fake.members.slice(0, 4).every((x) => x.task === "Human Trafficking"), J(r.fake.members.map((x) => x.task)));

    // Fehlender, unbrauchbarer oder fremder Bedarf -> respect (gang-2), auch bei riesigem Ruf.
    const respectCases = [
      ["bn4rep.json ohne torRunde", { bn4rep: { torRunde: undefined } }],
      ["torRunde ohne repNeed", { bn4rep: { torRunde: { mode: "locked" } } }],
      ["repNeed null", { bn4rep: { torRunde: torRunde({ repNeed: null, repNeedWhy: "kein Plan" }) } }],
      ["repNeed 0", { bn4rep: { torRunde: torRunde({ repNeed: 0 }) } }],
      ["repNeed als Text", { bn4rep: { torRunde: torRunde({ repNeed: "1275000" }) } }],
      ["bn4rep.json 31 min alt", { bn4rep: { zeit: W0 - 31 * 60000 } }],
      ["bn4rep.json aus dem alten Knoteneintritt", { bn4rep: { nodeReset: NODE_RESET - 5000 } }],
      ["bn4rep.json aus einem anderen Knoten", { bn4rep: { knoten: 3 } }],
      ["Bedarf fuer eine andere Faktion", { bn4rep: { torRunde: torRunde({ repNeedFaction: "Tetrads" }) } }],
      ["Bedarf ohne Faktionsangabe", { bn4rep: { torRunde: torRunde({ repNeedFaction: undefined }) } }],
      ["bn4rep.json fehlt", { noBn4rep: true }],
      ["bn4rep.json kaputt (halbes JSON)", { bn4repRaw: '{"zeit": 1, "torRunde": {"repNe' }],
      ["getResetInfo wirft", { resetThrows: true }],
    ];
    for (const [label, extra] of respectCases) {
      r = await moneyRun({ reps: { [SS]: 1e12 }, ...extra, gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
      check("Rueckfall RESPECT (" + label + "): Terrorism, mode respect, kein Equipment-Aufruf",
        r.fake.members.slice(0, 4).every((x) => x.task === "Terrorism") && r.tel && r.tel.mode === "respect" && r.fake.equipCalls.length === 0,
        J(r.fake.members.map((x) => x.task)) + " " + J(r.tel && [r.tel.mode, r.tel.repNeedWhy]) + " " + r.fake.equipCalls.length);
    }
    r = await moneyRun({ reps: { [SS]: 1e12 }, bn4rep: { torRunde: torRunde({ repNeedFaction: "Tetrads" }) }, gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
    check("fremde Faktion: repNeedWhy nennt es", r.tel && /Tetrads/.test(r.tel.repNeedWhy) && r.tel.repNeed === null, J(r.tel && [r.tel.repNeed, r.tel.repNeedWhy]));
    r = await moneyRun({ reps: { [SS]: 1e12 }, bn4repRaw: '{"zeit": 1, "torRunde": {"repNe', gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
    check("kaputtes bn4rep.json ist ein GEZAEHLTER Fehler (byCall.bn4rep_parse)", r.tel && r.tel.errors.byCall.bn4rep_parse >= 1, J(r.tel && r.tel.errors));
    r = await moneyRun({ reps: { [SS]: "throw" }, gang: { inGang: true, respect: 1e6, members: crew(), maxUpdates: 1, tick: 15000 } });
    check("Ruf nicht lesbar: respect, Fehler gezaehlt (byCall.factionRep)", r.tel && r.tel.mode === "respect" && r.tel.errors.byCall.factionRep >= 1
      && r.fake.members.slice(0, 4).every((x) => x.task === "Terrorism"), J(r.tel && [r.tel.mode, r.tel.errors]));

    // Hysterese in der Schleife: die gesetzten Aufgaben sind das Gedaechtnis.
    const hy = (task, rep) => moneyRun({ reps: { [SS]: rep }, gang: { inGang: true, respect: 1e6, members: members(["G01", "G02", "G03", "G04"], 600, { task }), maxUpdates: 1, tick: 15000 } });
    r = await hy("Human Trafficking", REQ);
    check("Hysterese: auf Human Trafficking bei Ruf == Rufbedarf (unter dem Schaltwert) bleibt es dabei - 0 Aufgabenaenderungen",
      r.fake.tasks.length === 0 && r.fake.members.every((x) => x.task === "Human Trafficking") && r.tel.mode === "money", J(r.fake.tasks) + " " + (r.tel && r.tel.mode));
    r = await hy("Terrorism", REQ);
    check("... auf Terrorism mit demselben Ruf wird NICHT umgeschaltet (obere Schwelle gilt)",
      r.fake.tasks.length === 0 && r.fake.members.every((x) => x.task === "Terrorism") && r.tel.mode === "respect", J(r.fake.tasks) + " " + (r.tel && r.tel.mode));
    r = await hy("Human Trafficking", REQ - 1);
    check("Ruf 1 unter dem Rufbedarf: zurueck auf Terrorism", r.fake.members.every((x) => x.task === "Terrorism") && r.tel.mode === "respect", J(r.fake.members.map((x) => x.task)));

    // Einbau: der Faktionsruf faellt auf 0 -> Terrorism, ein neuer Zyklus beginnt von selbst.
    r = await moneyRun({ reps: { [SS]: 0 }, gang: { inGang: true, respect: 1e6, members: members(["G01", "G02", "G03", "G04"], 600, { task: "Human Trafficking" }), maxUpdates: 1, tick: 15000 } });
    check("nach dem Einbau (Ruf 0, bn4rep.json noch mit altem Bedarf): Terrorism, mode respect",
      r.fake.members.every((x) => x.task === "Terrorism") && r.tel.mode === "respect", J(r.fake.members.map((x) => x.task)));

    // Mitten im Lauf: Ruf hoch -> money, danach Einbau (Ruf 0) -> respect. Zwei Moduszeilen.
    const reps = { [SS]: 0 };
    r = await moneyRun({ reps, gang: { inGang: true, respect: 1e6, members: members(["G01", "G02"], 600, { task: "Terrorism" }), maxUpdates: 4, tick: 15000,
      onUpdate: (g, n) => { if (n === 1) reps[SS] = 3e6; if (n === 3) reps[SS] = 0; } } });
    check("Lauf: respect -> money -> respect, die Aufgaben folgen", r.fake.tasks.some((t) => t[1] === "Human Trafficking")
      && r.fake.members.every((x) => x.task === "Terrorism") && (r.log.match(/MODUS/g) || []).length === 3, J(r.fake.tasks) + " | " + r.log.slice(0, 400));

    // Hacking-Gang: gar keine Fuehrung, kein Modus.
    r = await moneyRun({ gang: { inGang: true, isHacking: true, faction: "NiteSec", members: members(["G01"]), maxUpdates: 1 } });
    check("Hacking-Gang: mode bleibt null, kein Equipment-Aufruf", r.tel && r.tel.mode === null && r.fake.equipCalls.length === 0, J(r.tel && r.tel.mode));
  }

  // -------------------------------------------------------------------------
  head("S16. Der Wanted-Regler im Lauf rechnet mit Human Trafficking");
  {
    const sixHT = members(["G01", "G02", "G03", "G04", "G05", "G06"], 700, { task: "Human Trafficking" });
    const T = F.TASKS["Human Trafficking"], V = F.TASKS["Vigilante Justice"], TT = F.TASKS["Terrorism"];
    // Respekt 100 bei wanted 20 -> Strafe 0,83 < 0,95: der Regler schlaegt an.
    let r = await moneyRun({ gang: { inGang: true, respect: 100, wanted: 20, members: sixHT, maxUpdates: 1, tick: 15000 } });
    const jus = r.fake.members.filter((x) => x.task === "Vigilante Justice").length;
    const ggRun = { respect: 100, wantedLevel: 20, territory: 1 / 7 };
    const exp = (task) => {
      let sum = 6 * F.wantedGain(ggRun, lvlAll(700), task), e = 0;
      for (let i = 0; i < 6 && sum > 0; i++) { sum -= F.wantedGain(ggRun, lvlAll(700), task); sum += F.wantedGain(ggRun, lvlAll(700), V); e++; }
      return e;
    };
    check("Lauf, wanted 20 / Respekt 100 (Strafe 0,83): Vigilante-Zahl = Rechnung mit Human Trafficking (" + exp(T) + ")",
      jus === exp(T) && jus > 0, "gefunden " + jus + ", HT " + exp(T) + ", Terrorism " + exp(TT));
    check("... und der Rest bleibt auf Human Trafficking", r.fake.members.filter((x) => x.task === "Human Trafficking").length === 6 - jus);
    check("Telemetrie: Vigilante gezaehlt", r.tel && r.tel.taskCounts["Vigilante Justice"] === jus, J(r.tel && r.tel.taskCounts));
  }

  // -------------------------------------------------------------------------
  head("S17. Ausruestung im Geldmodus: Typen, Reihenfolge, Ruecklage, Grenzen");
  {
    const allowedSum = EQUIP_ALLOWED.reduce((s, x) => s + x.cost, 0);
    const trio = () => members(["G01", "G02", "G03"], 600, { task: "Human Trafficking" });
    const spentOf = (r) => r.fake.bought.reduce((s, b) => s + b.cost, 0);

    // a) Alles kaufen, was erlaubt ist - und nichts anderes.
    let r = await moneyRun({ money: 1e9, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 1, tick: 15000 } });
    check("3 Mitglieder x 5 erlaubte Stuecke = 15 Kaeufe", r.fake.bought.length === 15, "Kaeufe " + r.fake.bought.length);
    check("NIE Augmentation und nie ein Stueck mit unbekanntem Typ (BrachiBlades 20 Mio, Mystery Item 0,5 Mio sind billiger als der Rootkit)",
      r.fake.bought.length === 15 && r.fake.bought.every((b) => ["Weapon", "Armor", "Vehicle", "Rootkit"].includes(b.type))
      && !r.fake.bought.some((b) => b.item === "BrachiBlades" || b.item === "Mystery Item"), J(r.fake.bought.map((b) => b.item)));
    check("billigste zuerst: die Preise der Kaeufe fallen nie", r.fake.bought.length === 15 && r.fake.bought.every((b, i) => i === 0 || b.cost >= r.fake.bought[i - 1].cost), J(r.fake.bought.map((b) => b.cost)));
    check("Telemetrie: equipmentBought 15, equipmentSpent = Summe", r.tel && r.tel.equipmentBought === 15 && r.tel.equipmentSpent === 3 * allowedSum, J(r.tel && [r.tel.equipmentBought, r.tel.equipmentSpent]));
    check("das Konto sank um genau die Ausgabe", spentOf(r) === 3 * allowedSum && Math.abs(r.m.zustand.spieler.money - (1e9 - spentOf(r))) < 1, String(r.m.zustand.spieler.money));
    check("keine Doppelkaeufe: purchaseEquipment genau 15x gerufen, kein Fehler",
      r.fake.equipCalls.filter((c) => c === "purchaseEquipment").length === 15 && r.tel.errors.total === 0, J(r.tel && r.tel.errors));
    check("Log nennt die Ausruestung", /AUSRUESTUNG: 15 Stuecke/.test(r.log), r.log.slice(0, 300));
    // Zwei Runden gelaufen (maxUpdates 1): die Liste wurde EINMAL gelesen (7 Typaufrufe), Preise nur in
    // der ersten Runde (5 fehlende Stuecke); in der zweiten hat jeder alles - keine Preisabfrage mehr.
    check("Dauerzustand: Liste einmal gelesen, Preise nur fuer Fehlendes (1 x Namen, 7 x Typ, 5 x Preis)",
      r.fake.equipCalls.filter((c) => c === "getEquipmentNames").length === 1
      && r.fake.equipCalls.filter((c) => c === "getEquipmentType").length === EQUIP_CATALOG.length
      && r.fake.equipCalls.filter((c) => c === "getEquipmentCost").length === 5, J(r.fake.equipCalls.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {})));

    // b) Ruecklage: nie unter data/geldbedarf.txt.
    const duo = () => members(["G01", "G02"], 600, { task: "Human Trafficking" });
    r = await moneyRun({ money: 20e6, needFile: "5000000", gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Konto 20 Mio, Ruecklage 5 Mio: Bat, Bat, Vest, Vest, Ford, Ford (12 Mio) - dann ist Katana (12 Mio) zu teuer (3 Mio frei)",
      J(r.fake.bought.map((b) => b.item)) === J(["Baseball Bat", "Baseball Bat", "Bulletproof Vest", "Bulletproof Vest", "Ford Flex V20", "Ford Flex V20"]), J(r.fake.bought.map((b) => b.item)));
    check("das Konto bleibt >= Ruecklage (8 Mio >= 5 Mio)", r.m.zustand.spieler.money >= 5e6 && Math.abs(r.m.zustand.spieler.money - 8e6) < 1, String(r.m.zustand.spieler.money));
    check("Grund in der Telemetrie: Geld unter Preis + Ruecklage", r.tel && /Ruecklage/.test(String(r.tel.equipmentBlock)), J(r.tel && r.tel.equipmentBlock));
    r = await moneyRun({ money: 7e6, needFile: "5000000", gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Konto minus Ruecklage == Preis genau: Kauf erlaubt (>=), danach Schluss: Bat, Bat",
      J(r.fake.bought.map((b) => b.item)) === J(["Baseball Bat", "Baseball Bat"]) && r.m.zustand.spieler.money === 5e6, J(r.fake.bought.map((b) => b.item)) + " " + r.m.zustand.spieler.money);
    r = await moneyRun({ money: 5e6, needFile: "5000000", gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Konto == Ruecklage: nichts gekauft (im Modus money, sonst waere es trivial)", r.tel.mode === "money" && r.fake.bought.length === 0 && r.m.zustand.spieler.money === 5e6, J(r.fake.bought.length) + " " + r.tel.mode);
    r = await moneyRun({ money: 1e12, needFile: "999999999999", gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Ruecklage fast so gross wie das Konto: nichts gekauft (im Modus money)", r.tel.mode === "money" && r.fake.bought.length === 0);

    // c) Ruecklage fehlt oder ist unlesbar: NICHTS kaufen.
    for (const [label, extra] of [["fehlt", { noNeedFile: true }], ["unlesbar (Text)", { needFile: "abc" }], ["leer", { needFile: "" }], ["negativ", { needFile: "-5" }], ["NaN", { needFile: "NaN" }]]) {
      r = await moneyRun({ money: 1e9, ...extra, gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 1, tick: 15000 } });
      check("data/geldbedarf.txt " + label + ": kein Kauf, Grund in der Telemetrie",
        r.fake.bought.length === 0 && !r.fake.equipCalls.includes("purchaseEquipment") && r.tel && /geldbedarf/.test(String(r.tel.equipmentBlock)),
        r.fake.bought.length + " " + J(r.tel && r.tel.equipmentBlock));
    }
    r = await moneyRun({ money: 1e9, needFile: "0", gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Gegenprobe: Ruecklage '0' ist eine gueltige Zahl -> es wird gekauft (2 x 5)", r.fake.bought.length === 10, J(r.fake.bought.length));
    r = await moneyRun({ money: 1e9, moneyThrows: true, gang: { inGang: true, respect: 1e6, members: duo(), maxUpdates: 0, tick: 15000 } });
    check("Konto nicht lesbar: kein Kauf, Fehler gezaehlt (byCall.money)", r.fake.bought.length === 0 && r.tel && r.tel.errors.byCall.money >= 1, J(r.tel && r.tel.errors));

    // d) Harte Obergrenze je Runde.
    const twelve = () => members(["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G10", "G11", "G12"], 600, { task: "Human Trafficking" });
    r = await moneyRun({ money: 1e12, gang: { inGang: true, respect: 1e9, members: twelve(), maxUpdates: 0, tick: 15000 } });
    check("12 Mitglieder x 5 Stuecke = 60 Wuensche, EINE Runde: genau EQUIP_MAX_BUYS (24) gekauft",
      mod.EQUIP_MAX_BUYS === 24 && r.fake.bought.length === 24, "Kaeufe " + r.fake.bought.length);
    check("... und es sind die billigsten: erst alle zwoelf Bats, dann alle zwoelf Vests",
      r.fake.bought.length === 24 && r.fake.bought.slice(0, 12).every((b) => b.item === "Baseball Bat") && r.fake.bought.slice(12).every((b) => b.item === "Bulletproof Vest"), J(r.fake.bought.map((b) => b.item)));
    r = await moneyRun({ money: 1e12, gang: { inGang: true, respect: 1e9, members: twelve(), maxUpdates: 1, tick: 15000 } });
    check("zwei Runden: 2 x 24 = 48 von 60", r.fake.bought.length === 48, "Kaeufe " + r.fake.bought.length);
    r = await moneyRun({ money: 1e12, gang: { inGang: true, respect: 1e9, members: twelve(), maxUpdates: 2, tick: 15000 } });
    check("drei Runden: alle 60, nicht mehr", r.fake.bought.length === 60, "Kaeufe " + r.fake.bought.length);

    // e) Aufstieg: die Ausruestung ist weg, in der Aufstiegsrunde wird nicht gekauft, in der naechsten neu.
    const full = EQUIP_ALLOWED.map((x) => x.name);
    const snap = {};
    r = await moneyRun({ money: 1e9, gang: { inGang: true, respect: 1e6, maxUpdates: 2, tick: 15000,
      members: [{ name: "G01", lvl: lvlAll(600), task: "Human Trafficking", asc: uni(2.5), upgrades: full.slice(0, 2) },
        { name: "G02", lvl: lvlAll(600), task: "Human Trafficking", upgrades: full.slice() }],
      onUpdate: (g, n) => { snap[n] = g.bought.filter((b) => b.member === "G01").length; } } });
    // G01 hat vor dem Aufstieg nur 2 von 5 Stuecken: ein Stand, der in der Aufstiegsrunde NICHT mehr gilt (der Aufstieg
    // loescht alles) - gang.js darf auf ihm nicht kaufen, sonst kaeme die falsche Zahl (3 statt 0) heraus.
    check("G01 steigt auf (2,5 >= 2) und hat danach nichts mehr", J(r.fake.ascended) === J(["G01"]), J(r.fake.ascended));
    check("in der Aufstiegsrunde wird fuer G01 NICHT gekauft (Besitz veraltet), in der naechsten Runde alle 5 neu",
      snap[1] === 0 && snap[2] === 5, J(snap));
    check("G02 (hat alles) bekommt nichts zusaetzlich (G01 schon: 5 Stuecke)", r.fake.bought.length === 5 && r.fake.bought.every((b) => b.member === "G01"), J(r.fake.bought.map((b) => b.member)));

    // f) Fehler: Kauf wird abgelehnt -> gezaehlt, Runde bricht ab (kein Haemmern).
    r = await moneyRun({ money: 1e9, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 1, tick: 15000, buyResult: false } });
    check("purchaseEquipment gibt false: gezaehlt, je Runde genau ein Versuch (zwei Runden -> 2 Aufrufe)",
      r.fake.equipCalls.filter((c) => c === "purchaseEquipment").length === 2 && r.tel.errors.byCall.purchaseEquipment === 2 && r.ended === "abort",
      J(r.fake.equipCalls.filter((c) => c === "purchaseEquipment").length) + " " + J(r.tel && r.tel.errors));

    // g) Typ-Aufruf wirft fuer ein Stueck: gezaehlt, das Stueck wird nicht gekauft, der Rest schon.
    r = await moneyRun({ money: 1e9, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 0, tick: 15000, typeThrows: ["Katana"] } });
    check("Typaufruf wirft fuer Katana: byCall.getEquipmentType gezaehlt, Katana nie gekauft, der Rest (3 x 4) schon",
      r.tel.errors.byCall.getEquipmentType >= 1 && !r.fake.bought.some((b) => b.item === "Katana") && r.fake.bought.length === 12, J(r.tel && r.tel.errors) + " " + r.fake.bought.length);

    // h) Besitz unbekannt: fuer dieses Mitglied nichts.
    r = await moneyRun({ money: 1e9, gang: { inGang: true, respect: 1e6, maxUpdates: 0, tick: 15000,
      members: [{ name: "G01", lvl: lvlAll(600), task: "Human Trafficking", noUpgradeInfo: true }, { name: "G02", lvl: lvlAll(600), task: "Human Trafficking" }] } });
    check("Mitglied ohne Besitzliste: nichts fuer ihn, der andere wird ausgestattet",
      r.fake.bought.length === 5 && r.fake.bought.every((b) => b.member === "G02"), J(r.fake.bought.map((b) => b.member)));

    // i) Nie im Modus RESPECT, auch nicht mit Geld im Ueberfluss.
    r = await moneyRun({ money: 1e12, reps: { [SS]: 10 }, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 3, tick: 15000 } });
    check("Modus RESPECT: kein Kauf und kein einziger Equipment-Aufruf, equipmentBought 0",
      r.fake.bought.length === 0 && r.fake.equipCalls.length === 0 && r.tel.equipmentBought === 0 && r.tel.equipmentSpent === 0, J(r.fake.equipCalls));

    // j) Auf der Werkbank: Bedarf und Ruecklage kommen von home.
    r = await moneyRun({ host: "werk-0", money: 1e9, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 0, tick: 15000 } });
    check("Werkbank: bn4rep.json und geldbedarf.txt werden von home geholt - money, 15 Kaeufe",
      r.tel && r.tel.mode === "money" && r.fake.bought.length === 15, J(r.tel && r.tel.mode) + " " + r.fake.bought.length);
    r = await moneyRun({ host: "werk-0", money: 1e9, noNeedFile: true, gang: { inGang: true, respect: 1e6, members: trio(), maxUpdates: 0, tick: 15000 } });
    check("Werkbank ohne geldbedarf.txt auf home: kein Kauf (im Modus money)", r.tel.mode === "money" && r.fake.bought.length === 0);
  }

  // -------------------------------------------------------------------------
  head("S18. Vertrag mit bn4rep.js und lib/einbau.js: Feldnamen und Sicherheitszuschlag");
  {
    const EIN = await import(pathToFileURL(path.join(ROOT, "src", "lib", "einbau.js")).href);
    check("REP_NEED_MARGIN in gang.js == REP_NEED_MARGIN in lib/einbau.js", mod.REP_NEED_MARGIN === EIN.REP_NEED_MARGIN && EIN.REP_NEED_MARGIN === 1.02,
      J([mod.REP_NEED_MARGIN, EIN.REP_NEED_MARGIN]));
    const repCode = ohneKommentare(fs.readFileSync(path.join(ROOT, "src", "bn4rep.js"), "utf8").split("\r\n").join("\n"));
    check("bn4rep.js schreibt torRunde.repNeed und repNeedFaction (die Felder, die gang.js liest)",
      /\brepNeed\s*:\s*rn\.repNeed\b/.test(repCode) && /\brepNeedFaction\s*:/.test(repCode));
    check("gang.js liest genau diese Felder: torRunde / repNeed / repNeedFaction im Quelltext",
      /tel\.torRunde/.test(ohneKommentare(srcText)) && /tr\.repNeed\b/.test(ohneKommentare(srcText)) && /tr\.repNeedFaction/.test(ohneKommentare(srcText)));
    check("EQUIP_TYPES sind genau Weapon, Armor, Vehicle, Rootkit", J(mod.EQUIP_TYPES) === J(["Weapon", "Armor", "Vehicle", "Rootkit"]), J(mod.EQUIP_TYPES));
    check("Version gang-3 in der Telemetrie", (await run(mod, { gang: { inGang: true, members: members(["G01"]), maxUpdates: 0 } })).tel.version === "gang-3");
  }

  return out;
}

// ===========================================================================
// MUTANTEN
// ===========================================================================

const MUTANTS = [
  ["Pause nach Fehlschlag entfernt (haemmert)", "export const CREATE_PAUSE_MS = 10 * 60000;", "export const CREATE_PAUSE_MS = 0;"],
  ["NiteSec zaehlt als Kampf-Faktion", '  "Slum Snakes",\n  "Tetrads",', '  "NiteSec",\n  "Slum Snakes",\n  "Tetrads",'],
  ["erste lesbare statt kleinster Ruf", "if (best === null || rep < best.rep) best = { f, rep };", "if (best === null) best = { f, rep };"],
  ["unlesbarer Ruf zaehlt als 0", 'if (typeof rep !== "number" || !Number.isFinite(rep)) {', "if (false) {"],
  ["unlesbarer Ruf: nur diese Faktion uebersprungen (alter Stand)", 'return { faction: null, reason: "rep_unreadable", candidates, unreadable: f };', "continue;"],
  ["Territory Warfare eingeschaltet", "st.warfare = info.territoryWarfareEngaged === true;", "st.warfare = info.territoryWarfareEngaged === true; ns.gang.setTerritoryWarfare(true);"],
  ["Ausruestung gekauft", "st.members = names.length;", 'st.members = names.length; ns.gang.purchaseEquipment(names[0], "Rusty Brick");'],
  ["Fehler werden nicht gezaehlt", "const noteError = (label, e) => {", "const noteError = (label, e) => { return;"],
  ["Aufstiegsschwelle Training zu niedrig", "export const ASC_TRAIN = 1.3;", "export const ASC_TRAIN = 1.0;"],
  ["Aufstiegsschwelle Arbeit = Training", "export const ASC_WORK = 2;", "export const ASC_WORK = 1.3;"],
  ["ns.sleep statt Gang-Takt", 'Promise.resolve(ns.gang.nextUpdate()).then(() => "update"),', 'ns.sleep(30000).then(() => "update"),'],
  ["Hacking-Gang-Sperre entfernt", "if (st.isHacking) {", "if (false) {"],
  ["Vigilante auch bei wanted 1", "g.wantedLevel > 1 && g.wantedPenalty < WANTED_FLOOR", "g.wantedPenalty < WANTED_FLOOR"],
  ["Vigilante-Schwelle 1,01 statt 0,95", "export const WANTED_FLOOR = 0.95;", "export const WANTED_FLOOR = 1.01;"],
  ["Trainingsziel 5000 statt 500", "export const TRAIN_UNTIL = 500;", "export const TRAIN_UNTIL = 5000;"],
  ["Schalter wird nicht geprueft", "if (!switchOn()) {", "if (false) {"],
  ["Rekrutierung ohne Namenspruefung", 'const name = freeName(names);', 'const name = "G01";'],
  ["Gruendung ohne Marke vor dem Aufruf", "st.lastCreateAt = Date.now();\n    const call", "const call"],
  ["Fehlerserie beendet nie", "if (st.errStreak >= MAX_ERR_STREAK) {", "if (false) {"],
  ["Telemetrie ohne errStreak", "errStreak: st.errStreak, lastError: st.lastError,", "lastError: st.lastError,"],
  // --- Voraussetzungssperre und Beifang der Reparatur (03.10.2026) ---
  ["Sperre vor createGang entfernt", "if (!prereqOk()) {", "if (false) {"],
  ["Sperre prueft Paket 1 nicht", "if (tel[PREREQ_P1_FIELD] !== true) {", "if (false) {"],
  ["Sperre: fehlendes Paket-0-Feld gilt als ok", 'if (typeof p0 !== "boolean") {', "if (false) {"],
  ["Sperre: v1Positiv true wird akzeptiert", "} else if (p0 === true) {", "} else if (false) {"],
  ["Sperre prueft die Frische nicht", "else if (age > PREREQ_MAX_AGE_MS)", "else if (false)"],
  ["Sperre prueft den Knoteneintritt nicht", "} else if (tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset) {", "} else if (false) {"],
  ["Sperre prueft nur die Knotennummer, nicht den Eintritt", "tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset", "tel.knoten !== reset.currentNode"],
  ["gesperrter Versuch zaehlt als Versuch und startet die Pause", 'st.blockedReason = "prereq_missing";\n      return false;', 'st.blockedReason = "prereq_missing"; st.createAttempts++; st.lastCreateAt = Date.now();\n      return false;'],
  ["Sperre loggt in jedem Takt", "if (sig !== st.prereqSig) {", "if (true) {"],
  ["Log-Signatur mit Ziffern (neue Zeile je Minute)", 'res.missing.map((m) => m.replace(/\\d+/g, "#")).join(" | ")', 'res.missing.join(" | ")'],
  ["Paket-1-Feld heisst anders", 'export const PREREQ_P1_FIELD = "gateBuy";', 'export const PREREQ_P1_FIELD = "torKauf";'],
  ["Logzeit in UTC", "const stamp = localStamp(new Date(Date.now()));", "const stamp = new Date(Date.now()).toISOString().slice(11, 19);"],
  // --- Geldmodus (P2d, 04.10.2026) ---
  ["Modus: keine Hysterese (untere Schwelle fehlt)", "if (onMoney === true) return rep * REP_NEED_MARGIN >= need ? MODE_MONEY : MODE_RESPECT;", "if (false) return MODE_MONEY;"],
  ["Modus: Hysterese zu weit (halber Bedarf)", "if (onMoney === true) return rep * REP_NEED_MARGIN >= need ? MODE_MONEY : MODE_RESPECT;", "if (onMoney === true) return rep * REP_NEED_MARGIN * 2 >= need ? MODE_MONEY : MODE_RESPECT;"],
  ["Modus: schaltet schon bei halbem Bedarf", "return rep >= need ? MODE_MONEY : MODE_RESPECT;", "return rep >= need / 2 ? MODE_MONEY : MODE_RESPECT;"],
  ["Modus: Hysterese-Merker immer aus", "members.some((m) => m.task === TASK_MONEY)", "false"],
  ["Modus: Ruf unlesbar zaehlt als genug", "if (typeof rep !== \"number\" || !Number.isFinite(rep)) return MODE_RESPECT;", "if (false) return MODE_RESPECT;"],
  ["Modus: fehlender Bedarf zaehlt als 0 (immer Geld)", "if (typeof need !== \"number\" || !Number.isFinite(need) || !(need > 0)) return MODE_RESPECT;", "if (false) return MODE_RESPECT;"],
  ["Bedarf: Frische nicht geprueft", "if (age > PREREQ_MAX_AGE_MS) return none(", "if (false) return none("],
  ["Bedarf: Faktion nicht geprueft", "|| tr.repNeedFaction !== faction", "|| false"],
  ["Bedarf: Knoteneintritt nicht geprueft", "if (tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset) {\n    return none(", "if (false) {\n    return none("],
  ["Bedarf: aus der Zukunft akzeptiert", "if (age < -60000) return none(BN4REP_FILE + \" stammt aus der Zukunft\");", ""],
  ["Geldmodus nutzt Terrorism statt Human Trafficking", "const workName = mode === MODE_MONEY ? TASK_MONEY : TASK_WORK;", "const workName = TASK_WORK;"],
  ["Regler rechnet im Geldmodus mit Terrorism", "const workTask = TASKS[workName];", "const workTask = TASKS[TASK_WORK];"],
  ["Ausruestung auch im Modus RESPECT", "if (mode !== MODE_MONEY) return;\n\n    const names = equipNames", "const names = equipNames"],
  ["Ausruestung ohne Ruecklage", "if (!(money - reserve >= w.cost))", "if (!(money >= w.cost))"],
  ["Ausruestung: Ruecklage fehlt gilt als 0", "const reserve = need === \"\" ? NaN : Number(need);", "const reserve = need === \"\" ? 0 : Number(need);"],
  ["Ausruestung: negative Ruecklage akzeptiert", "if (!Number.isFinite(reserve) || reserve < 0) {", "if (!Number.isFinite(reserve)) {"],
  ["Ausruestung: Typfilter weg (auch Augmentation)", "if (EQUIP_TYPES.includes(type.value)) allowed.push(name);", "allowed.push(name);"],
  ["Ausruestung: Typliste um Augmentation erweitert", "export const EQUIP_TYPES = [\"Weapon\", \"Armor\", \"Vehicle\", \"Rootkit\"];", "export const EQUIP_TYPES = [\"Weapon\", \"Armor\", \"Vehicle\", \"Rootkit\", \"Augmentation\"];"],
  ["Ausruestung: keine Obergrenze je Runde", "bought < EQUIP_MAX_BUYS", "bought < 100000"],
  ["Ausruestung: teuerste zuerst", "out.sort((a, b) => (a.cost - b.cost)", "out.sort((a, b) => (b.cost - a.cost)"],
  ["Ausruestung: Aufsteiger sofort (veralteter Besitz)", "const eligible = members.filter((m) => !m.ascended && Array.isArray(m.upgrades));", "const eligible = members.filter((m) => Array.isArray(m.upgrades));"],
  ["Ausruestung: kauft auch Besessenes", "if (!have.has(it.name)) out.push(", "if (true) out.push("],
  ["Ausruestung: Kaufabbruch bei false fehlt", "if (buy.value !== true) {\n        noteError(\"purchaseEquipment\", new Error(\"purchaseEquipment(\" + w.member + \", \" + w.item + \") gab \" + String(buy.value)));\n        break;\n      }", "if (buy.value !== true) { noteError(\"purchaseEquipment\", new Error(\"x\")); }"],
  ["Ausruestung: Ausgabe nicht gezaehlt", "st.equipmentSpent += spent;", ""],
  ["Modus: Moduszeile in jedem Takt", "if (mode !== st.mode) {", "if (true) {"],
  ["Telemetrie ohne moneyGainRate", "moneyGainRate: st.moneyGainRate,\n      equipmentBought", "equipmentBought"],
  ["Geldaufgabe mit falschem Namen", "export const TASK_MONEY = \"Human Trafficking\";", "export const TASK_MONEY = \"Traffick Illegal Arms\";"],
  ["Sicherheitszuschlag 1,0 statt 1,02", "export const REP_NEED_MARGIN = 1.02;", "export const REP_NEED_MARGIN = 1.0;"],
];

async function loadVariant(text, tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gangtest-" + tag + "-"));
  try {
    fs.mkdirSync(path.join(dir, "src", "lib"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "src", "lib", "hostdatei.js"), path.join(dir, "src", "lib", "hostdatei.js"));
    const file = path.join(dir, "src", "gang.js");
    fs.writeFileSync(file, text, "utf8");
    return await ladeSpielskript(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ===========================================================================
// LAUF
// ===========================================================================

console.log("");
console.log("=== gang.js gegen den ns.gang-Nachbau ===");
console.log("  Pruefling: " + SRC);

if (!fs.existsSync(SRC)) {
  console.log("");
  console.log("  ROT   gang.js nicht gefunden: " + SRC + " (Stand vor Paket P2?)");
  console.log("");
  console.log("=== 0 gruen, 1 rot ===");
  process.exit(1);
}

const srcText = fs.readFileSync(SRC, "utf8").split("\r\n").join("\n");
const mod = await loadVariant(srcText, "orig");
const main = await suite(mod, srcText, true);

let mutantFail = [];
if (MIT_MUTANTEN && main.failed.length === 0) {
  console.log("");
  console.log("-- Selbstprobe: " + MUTANTS.length + " Mutanten, jeder muss eine Probe rot machen --");
  let i = 0;
  for (const [name, find, repl] of MUTANTS) {
    i++;
    if (!srcText.includes(find)) {
      mutantFail.push("Mutant '" + name + "': Fundstelle nicht im Quelltext (Mutant veraltet)");
      console.log("  ROT   Mutant '" + name + "': Fundstelle fehlt");
      continue;
    }
    const mtext = srcText.replace(find, repl);
    let killedBy = null;
    try {
      const mm = await loadVariant(mtext, "m" + i);
      const res = await suite(mm, mtext, false);
      if (res.failed.length) killedBy = res.failed[0];
    } catch (e) {
      killedBy = "Lauf bricht ab: " + String(e && e.message ? e.message : e).slice(0, 80);
    }
    if (killedBy) console.log("  ok    erkannt: " + name + "  <- " + killedBy.slice(0, 90));
    else {
      mutantFail.push("Mutant '" + name + "' wurde von KEINER Probe erkannt");
      console.log("  ROT   NICHT erkannt: " + name);
    }
  }
}

const passed = main.passed;
const failed = main.failed.length + mutantFail.length;
console.log("");
console.log("=== " + passed + " gruen, " + failed + " rot ===");
if (failed) {
  console.log("");
  for (const f of main.failed) console.log("  ROT: " + f);
  for (const f of mutantFail) console.log("  ROT: " + f);
  process.exit(1);
}
