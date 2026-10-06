// Bot-Simulator: laesst die BOT-Skripte (bau/src/corp.js + corp-act-*.js + corp-tick.js) gegen die
// ECHTE Spielquelle 3.0.1 laufen. Das Spiel (Corporation.process, Bewertung, Runden, Verkauf) ist
// Originalcode; simuliert werden nur Netscript-Huelle (Dateien, Ports, exec, Wirte) und der Takt.
//
// Ehrlichkeitspruefungen:
//  - RAM je Skript mit dem ECHTEN Spielrechner (src/Script/RamCalculations.ts). Ein Skript darf im
//    Simulator nur die Corp-Funktionen aufrufen, die der Rechner statisch gezaehlt hat - sonst wirft
//    die Huelle wie das Spiel ("dynamic RAM").
//  - Die Bot-Fassung sieht nur ns.corporation-Rueckgaben (Proxy auf getNS().corporation).
//  - EICHUNG: Produktionsschaetzung, Kostenformeln und gemessenes D gegen Spielinterna.
//
// Aufruf (aus reference/v301):
//   CORP_SEEDS=1,2,3 CORP_HOURS=2.5 node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim
import * as fs from "fs";
import * as path from "path";
import { Player } from "../../../../reference/v301/src/Player";
import { getNS, setupBasicTestingEnvironment, initGameEnvironment } from "../../../../reference/v301/test/jest/Utilities";
import { enterBitNode } from "../../../../reference/v301/src/RedPill";
import { getDefaultBitNodeOptions } from "../../../../reference/v301/src/BitNode/BitNodeUtils";
import { calculateRamUsage } from "../../../../reference/v301/src/Script/RamCalculations";
import { Script } from "../../../../reference/v301/src/Script/Script";

initGameEnvironment();

const BAU = path.resolve(__dirname, "../src");
const ROOT = path.resolve(__dirname, "../../../..");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];

// ------------------------------------------------------------------ Zufall (wie sim/corpsim.ts RNG)
const RNG = {
  a: 1,
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};

// ------------------------------------------------------------------ RAM mit dem Spielrechner
function libCode(rel: string): string {
  const own = path.join(BAU, rel);
  if (fs.existsSync(own)) return fs.readFileSync(own, "utf8");
  return fs.readFileSync(path.join(ROOT, "src", rel), "utf8");
}
const SCRIPTS = fs.readdirSync(BAU).filter((f) => f.endsWith(".js"));
// Module beim Laden holen, nicht erst in exec (jest erlaubt require nur waehrend des Testlaufs)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MODS: Record<string, any> = Object.fromEntries(SCRIPTS.map((f) => [f, require(path.join(BAU, f))]));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LIB = require(path.join(BAU, "lib/corplib.js"));
const RAM: Record<string, { cost: number; corp: Set<string>; entries: string[] }> = {};
function computeRam() {
  const others = new Map<any, any>();
  for (const rel of ["lib/corplib.js", "lib/corpact.js", "lib/herzschlag.js", "lib/hostdatei.js"]) others.set(rel, new Script(rel as any, libCode(rel), "home"));
  for (const f of SCRIPTS) {
    const r: any = calculateRamUsage(fs.readFileSync(path.join(BAU, f), "utf8"), f as any, "home", others);
    if (r.errorCode !== undefined) throw new Error(`RAM ${f}: ${r.errorCode} ${r.errorMessage}`);
    const corp = new Set<string>();
    for (const e of r.entries) if (String(e.name).startsWith("corporation.")) corp.add(String(e.name).slice(12));
    // Funktionen mit 0 GB (nextUpdate, hasCorporation) zaehlt der Rechner nicht als Eintrag - im Spiel frei
    corp.add("nextUpdate");
    corp.add("hasCorporation");
    RAM[f] = { cost: r.cost, corp, entries: r.entries.filter((e: any) => e.cost > 0).map((e: any) => `${e.name} ${e.cost}`) };
  }
}

// ------------------------------------------------------------------ Netscript-Huelle
interface World {
  files: Map<string, string>;
  ports: Map<number, string[]>;
  hosts: Record<string, { max: number; used: number }>;
  running: Map<number, string>;
  pid: number;
  waiting: boolean;
  crashes: string[];
  tickDiag: any[];
  stopped?: boolean;
  tickpLast?: any;
  clock: number;
  timers: { at: number; res: (v: any) => void }[];
}
// Simulierte Wanduhr: +2 s je Corp-Zustand; Schlaefe ab 5 s laufen gegen diese Uhr (Herzschlag-Test)
function fireTimers(w: World) {
  const due = w.timers.filter((x) => x.at <= w.clock);
  w.timers = w.timers.filter((x) => x.at > w.clock);
  for (const x of due) x.res(true);
}
function simSleep(w: World, ms: number, dead: () => boolean): Promise<any> {
  if (dead()) return new Promise(() => undefined);
  if (ms >= 5000) return new Promise((r) => w.timers.push({ at: w.clock + ms, res: r }));
  return new Promise((r) => setImmediate(() => r(true)));
}
let W: World;
const DEAD = new Set<number>();
function makeNs(script: string, host: string, args: any[], w: World): any {
  const myPid = w.pid;
  const real: any = getNS();
  const allowed = RAM[script].corp;
  const corp = new Proxy(real.corporation, {
    get(t: any, p: string) {
      const v = t[p];
      if (w.stopped || DEAD.has(myPid)) throw new Error("Lauf beendet");
      if (typeof v !== "function") return v;
      if (!allowed.has(p)) throw new Error(`RAM-Verstoss: ${script} ruft corporation.${p}, statisch nicht gezaehlt`);
      if (p === "nextUpdate")
        return () => {
          w.waiting = true;
          return v.call(t);
        };
      return v.bind(t);
    },
  });
  return {
    args,
    pid: w.pid,
    corporation: corp,
    getHostname: () => host,
    getResetInfo: () => real.getResetInfo(),
    disableLog() {},
    print() {},
    tprint() {},
    sleep: (ms: number) => simSleep(w, ms, () => !!w.stopped || DEAD.has(myPid)),
    asleep: (ms: number) => simSleep(w, ms, () => !!w.stopped || DEAD.has(myPid)),
    read: (f: string) => w.files.get(f) ?? "",
    write: (f: string, d: string, mode: string) => {
      w.files.set(f, mode === "a" ? (w.files.get(f) ?? "") + d : String(d));
    },
    fileExists: (f: string) => w.files.has(f) || SCRIPTS.includes(f),
    scp: () => true,
    scan: (h: string) => (h === "home" ? ["werk"] : ["home"]),
    hasRootAccess: () => true,
    getServerMaxRam: (h: string) => w.hosts[h].max,
    getServerUsedRam: (h: string) => w.hosts[h].used,
    getScriptRam: (s: string) => RAM[s]?.cost ?? 0,
    exec: (s: string, h: string, _th: number, ...a: any[]) => startScript(s, h, a, w),
    readPort: (p: number) => w.ports.get(p)?.shift() ?? "NULL PORT DATA",
    writePort: (p: number, d: string) => {
      if (!w.ports.has(p)) w.ports.set(p, []);
      w.ports.get(p)!.push(d);
      if (script === "corp-tick.js") { w.tickDiag.push(JSON.parse(d)); (w as any).tickLast = JSON.parse(d); }
      if (script === "corp-tickp.js") w.tickpLast = JSON.parse(d);
      return null;
    },
  };
}
function startScript(script: string, host: string, args: any[], w: World = W): number {
  if (w.stopped) return 0;
  const ram = RAM[script]?.cost;
  if (!ram) return 0;
  if (w.hosts[host].used + ram > w.hosts[host].max) return 0;
  const pid = ++w.pid;
  const nsPid = pid;
  w.hosts[host].used += ram;
  w.running.set(pid, script);
  const mod = MODS[script];
  const ns = makeNs(script, host, args, w);
  void nsPid;
  Promise.resolve()
    .then(() => mod.main(ns))
    .catch((e: any) => w.crashes.push(`${script}: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e}`))
    .finally(() => {
      w.hosts[host].used -= ram;
      w.running.delete(pid);
    });
  return pid;
}
async function settle(coordPid: number) {
  for (let i = 0; i < 100000; i++) {
    if (W.crashes.length) throw new Error("Absturz: " + W.crashes.join(" || "));
    if (!W.running.has(coordPid)) throw new Error("Koordinator beendet");
    // Koordinator ruht: wartet auf nextUpdate oder schlaeft lang (z. B. ohne Corp)
    // (offene asleep-Timer aus dem Herzschlag-Rennen zaehlen NICHT als Ruhe, solange eine Corp existiert -
    //  sonst liefe die Corp weiter, waehrend der Bot mitten im Zyklus steht)
    if (W.running.size === 1 && (W.waiting || (!Player.corporation && W.timers.length))) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error("Stillstand: Koordinator wartet nicht auf nextUpdate. log=" + (W.files.get("data/corp-log.txt") || "").slice(-1500) + " tele=" + (W.files.get("data/corp.json") || "").slice(0, 1500));
}

// ------------------------------------------------------------------ Eichung gegen Spielinterna
function internalUnits(div: any, city: string): number {
  const c: any = Player.corporation!;
  const office = div.offices[city];
  div.calculateProductionFactors();
  if (div.makesProducts) {
    let n = 0;
    for (const pr of div.products.values()) if (pr.finished) n++;
    return div.getOfficeProductivity(office, { forProduct: true }) * c.getProductionMultiplier() * div.productionMult * div.getProductionMultiplier() * div.getProductProductionMultiplier() * n * 10;
  }
  return div.getOfficeProductivity(office) * div.productionMult * c.getProductionMultiplier() * div.getProductionMultiplier() * 10;
}
function internalD(div: any, city: string, mat: string): number {
  const c: any = Player.corporation!;
  const m = div.warehouses[city].materials[mat];
  const AF = div.getAdvertisingFactors()[0];
  const SM = c.getSalesMult() * div.getSalesMultiplier();
  return (m.quality + 0.001) * div.getMarketFactor(m) * div.getBusinessFactor(div.offices[city]) * SM * AF;
}

const fm = (x: number) => (Math.abs(x) >= 1e15 ? x.toExponential(2) : Math.abs(x) >= 1e12 ? (x / 1e12).toFixed(2) + "T" : Math.abs(x) >= 1e9 ? (x / 1e9).toFixed(1) + "G" : (x / 1e6).toFixed(2) + "M");
const CFG = process.env.CORP_CFG ?? "";
const TAG = process.env.CORP_TAG ?? "E2";
const seeds = (process.env.CORP_SEEDS ?? "1").split(",").map(Number);
const HOURS = Number(process.env.CORP_HOURS ?? "2.5");

beforeAll(() => computeRam());

test("RAM je Skript (Spielrechner)", () => {
  for (const f of SCRIPTS) console.log(`RAM ${f.padEnd(20)} ${RAM[f].cost.toFixed(2)} GB  ${RAM[f].entries.join(", ")}`);
  for (const f of SCRIPTS) expect(RAM[f].cost).toBeLessThanOrEqual(100);
});

for (const seed of seeds) {
  test(`Bot Etappe 1, Saat ${seed}, ${HOURS} h`, async () => {
    RNG.a = seed >>> 0;
    Math.random = () => RNG.next();
    setupBasicTestingEnvironment();
    enterBitNode(true, Player.bitNodeN, 3, getDefaultBitNodeOptions());
    Player.money = 0;
    W = { files: new Map(), ports: new Map(), hosts: { home: { max: 128, used: 100 }, werk: { max: 512, used: 294 } }, running: new Map(), pid: 0, waiting: false, crashes: [], tickDiag: [], clock: 1.79e12, timers: [] };
    const realNow = Date.now.bind(Date);
    Date.now = () => W.clock;
    // CORP_NOSPACE=h: bis h Stunden passt neben corp.js kein Einmal-Skript (Skeptiker E1 #1)
    // CORP_NOSPACE=a,b: von a bis b Stunden passt neben corp.js kein Einmal-Skript (Skeptiker E1 #1)
    const NS2 = (process.env.CORP_NOSPACE ?? "").split(",").filter(Boolean).map(Number);
    let nsState = 0;
    // CORP_PAUSE=h,n: bei h Stunden steht die Corp, die Wanduhr laeuft n x 60 s (verdeckter Tab, Skeptiker E1 #3)
    const PAUSE = (process.env.CORP_PAUSE ?? "").split(",").filter(Boolean).map(Number);
    let pauseBeats = -1;
    if (CFG) W.files.set("data/corp-config.txt", CFG);
    const t0 = realNow();
    let coord = startScript("corp.js", "werk", []);
    // CORP_RESTART=a,b: Koordinator stirbt bei a h (Einbau, F8) und startet bei b h neu
    const RS = (process.env.CORP_RESTART ?? "").split(",").filter(Boolean).map(Number);
    let restarted = 0;
    try {
    let t = 0;
    let lastRound = 0;
    let lastFunds = 0;
    const traj: any[] = [];
    const rounds: any[] = [];
    const calUnitsBy: Record<string, number[]> = {};
    const calD: number[] = [];
    let maxErrStreak = 0;
    let nextTraj = 0;
    let cycle = 0;
    while (t < HOURS * 3600 + 1) {
      if (NS2.length === 2 && nsState === 0 && t >= NS2[0] * 3600) {
        W.hosts.werk.max = 294 + RAM["corp.js"].cost + 5;
        W.hosts.home.max = 100;
        nsState = 1;
      }
      if (nsState === 1 && t >= NS2[1] * 3600) {
        W.hosts.werk.max = 512;
        W.hosts.home.max = 128;
        nsState = 2;
      }
      if (PAUSE.length === 2 && pauseBeats < 0 && t >= PAUSE[0] * 3600) {
        await settle(coord);
        const walls = new Set<number>();
        for (let i = 0; i < PAUSE[1]; i++) {
          W.clock += 60000;
          fireTimers(W);
          for (let k = 0; k < 300; k++) await new Promise((r) => setImmediate(r));
          walls.add(JSON.parse(W.files.get("data/corp.json") || "{}").wall);
        }
        pauseBeats = walls.size;
      }
      if (RS.length === 2 && restarted === 0 && t >= RS[0] * 3600) {
        DEAD.add(coord);
        W.running.delete(coord);
        W.hosts.werk.used -= RAM["corp.js"].cost;
        // CORP_STATELOSS=1: Zustandsdatei weg (scp-Fehler, kaputtes JSON - Skeptiker E1 #2)
        if (process.env.CORP_STATELOSS === "1") W.files.delete("data/corp-state.txt");
        restarted = 1;
      }
      if (restarted === 1) {
        if (t >= RS[1] * 3600) {
          W.waiting = false;
          coord = startScript("corp.js", "werk", []);
          restarted = 2;
        } else {
          const c0: any = Player.corporation!;
          c0.storeCycles(10);
          c0.process();
          t += 2;
          W.clock += 2000;
          continue;
        }
      }
      await settle(coord);
      W.waiting = false;
      if (!Player.corporation) {
        // noch keine Corp (Gruendung scheitert, z. B. kein Platz): nur die Uhr laeuft
        W.clock += 2000;
        fireTimers(W);
        t += 2;
        continue;
      }
      const c: any = Player.corporation!;
      const next = c.getNextState();
      // Zustand zwischen START und PURCHASE: Bot hat gehandelt -> Eichung
      if (next === "PURCHASE" && W.tickDiag.length) {
        const d = W.tickDiag[W.tickDiag.length - 1];
        const agri = c.divisions.get("Agri");
        if (d.diag) {
          for (const [key, v] of Object.entries(d.diag) as [string, any][]) {
            const [dn, city] = key.split("|");
            const div = c.divisions.get(dn);
            if (!div) continue;
            const real = internalUnits(div, city);
            if (v.units > 0 && real > 0) (calUnitsBy[dn] ??= []).push(v.units / real - 1);
          }
        }
        if (agri && d.price && cycle % 10 === 0) {
          for (const city of CITIES) {
            const pr = d.price["Agri|" + city + "|Plants"];
            const Dreal = internalD(agri, city, "Plants");
            if (pr && pr.d > 0 && Dreal > 0) calD.push(pr.d / Dreal - 1);
          }
        }
        if (process.env.CORP_PDEBUG && agri && d.price) {
          const m = agri.warehouses["Sector-12"].materials.Plants;
          const pr = d.price["Agri|Sector-12|Plants"];
          if (((W as any).pdbg ??= 0) < Number(process.env.CORP_PDEBUG)) {
            (W as any).pdbg++;
            console.log(`PD t=${(t / 3600).toFixed(3)} D=${pr?.d?.toExponential(3)} kind=${pr?.kind} x=${pr?.x?.toExponential(3)} Dreal=${internalD(agri, "Sector-12", "Plants").toExponential(3)} stored=${m.stored.toFixed(1)} sold=${m.actualSellAmount.toFixed(2)} prod=${m.productionAmount.toFixed(2)} MP=${m.marketPrice.toFixed(0)} price=${m.desiredSellPrice} q=${m.quality.toFixed(2)}`);
          }
        }
        W.tickDiag.length = 0;
      }
      if (next === "START") {
        const tele = JSON.parse(W.files.get("data/corp.json") || "{}");
        maxErrStreak = Math.max(maxErrStreak, tele.errStreak || 0);
        if ((tele.errStreak || 0) > 5) throw new Error("errStreak > 5: " + JSON.stringify(tele.lastError));
        if (t >= nextTraj * 3600) {
          console.log(`Fortschritt ${nextTraj} h, Wand ${((Date.now() - t0) / 1000).toFixed(0)} s, ${tele.stage} | ${tele.next}`);
          traj.push({
            h: nextTraj,
            funds: c.funds,
            valuation: c.valuation,
            assetDelta: (c.totalAssets - c.previousTotalAssets) / 10,
            profit: c.revenue - c.expenses,
            owned: c.numShares / c.totalShares,
            fundingRound: c.fundingRound,
            rating: (() => {
              const tob = c.divisions.get("Tob");
              let b = 0;
              if (tob) for (const pr of tob.products.values()) if (pr.finished) b = Math.max(b, pr.rating);
              return b;
            })(),
            aw: c.divisions.get("Tob")?.awareness ?? 0,
            wilson: c.upgrades["Wilson Analytics"].level,
            ads: c.divisions.get("Tob")?.numAdVerts ?? 0,
            mainOffice: c.divisions.get("Tob")?.offices["Aevum"]?.size ?? 0,
            liq: tele.liquidation,
            stage: tele.stage,
            next: tele.next,
          });
          nextTraj += 0.5;
        }
      }
      lastFunds = c.funds;
      c.storeCycles(10);
      c.process();
      t += 2;
      W.clock += 2000;
      fireTimers(W);
      if (next === "SALE") cycle++;
      if (c.fundingRound !== lastRound) lastRound = c.fundingRound;
    }
    // Runden aus dem Bot-Protokoll
    const st = JSON.parse(W.files.get("data/corp-state.txt") || "{}");
    rounds.push(...(st.rounds || []));
    // Kostenformeln gegen die echten Getter (EICHUNG)
    const real: any = getNS().corporation;
    const L = LIB;
    const costErr: string[] = [];
    const rel = (a: number, b: number) => Math.abs(a / b - 1);
    if (Player.corporation && (Player.corporation as any).divisions.has("Agri")) {
    for (const u of ["Smart Factories", "Smart Storage", "Wilson Analytics", "ABC SalesBots", "Project Insight", "FocusWires"])
      if (rel(L.upgradeCost(u, real.getUpgradeLevel(u)), real.getUpgradeLevelCost(u)) > 1e-12) costErr.push(u);
    const ag = real.getOffice("Agri", "Aevum");
    for (const by of [1, 3, 6, 15]) if (rel(L.officeUpCost(ag.size, by), real.getOfficeSizeUpgradeCost("Agri", "Aevum", by)) > 1e-12) costErr.push("office+" + by);
    const wl = real.getWarehouse("Agri", "Aevum").level;
    if (rel(L.warehouseUpCost(wl), real.getUpgradeWarehouseCost("Agri", "Aevum", 1)) > 1e-12) costErr.push("warehouse");
    if (rel(L.adCost(real.getDivision("Agri").numAdVerts), real.getHireAdVertCost("Agri")) > 1e-12) costErr.push("advert");
    }
    const pct = (a: number[]) => {
      const s = [...a].sort((x, y) => x - y);
      return s.length ? { n: s.length, min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] } : null;
    };
    const res = {
      seed,
      hours: HOURS,
      wallSec: (Date.now() - t0) / 1000,
      rounds,
      traj,
      events: (W.files.get("data/corp-log.txt") || "").split("\n").filter(Boolean),
      errors: st.errors,
      maxErrStreak,
      eichung: { unitsRelErr: Object.fromEntries(Object.entries(calUnitsBy).map(([k, v]) => [k, pct(v)])), dRelErr: pct(calD), costErr },
      ram: Object.fromEntries(SCRIPTS.map((f) => [f, RAM[f].cost])),
      finalState: st,
      finalTele: JSON.parse(W.files.get("data/corp.json") || "{}"),
      lastTickp: W.tickpLast,
      lastTick: (W as any).tickLast,
      pauseBeats,
    };
    fs.writeFileSync(path.join(OUT, `${TAG}_s${seed}.json`), JSON.stringify(res, null, 1));
    console.log(
      `Saat ${seed}: Runden ${JSON.stringify(rounds)}\n` +
        traj.map((p) => `  ${p.h}h F ${fm(p.funds)} V ${fm(p.valuation)} dA ${fm(p.assetDelta)}/s G ${fm(p.profit)}/s Anteil ${(p.owned * 100).toFixed(1)}% R ${p.rating.toFixed(0)} aw ${p.aw.toExponential(1)} W ${p.wilson} ads ${p.ads} HB ${p.mainOffice} | ${p.stage} | ${p.next}`).join("\n") +
        `\n  Eichung: ${JSON.stringify(res.eichung)}\n  Fehler: ${JSON.stringify(st.errors)}\n  Ereignisse:\n    ${res.events.slice(0, 80).join("\n    ")}`,
    );
    if (Player.corporation) expect(costErr).toEqual([]);
    const fr = Player.corporation ? (Player.corporation as any).fundingRound : 0;
    console.log(`ERGEBNIS fundingRound=${fr} pauseBeats=${pauseBeats}`);
    if (process.env.CORP_EXPECT_ROUND) expect(fr).toBe(Number(process.env.CORP_EXPECT_ROUND));
    if (process.env.CORP_EXPECT_MINROUND) expect(fr).toBeGreaterThanOrEqual(Number(process.env.CORP_EXPECT_MINROUND));
    if (process.env.CORP_EXPECT_BEATS) expect(pauseBeats).toBeGreaterThanOrEqual(Number(process.env.CORP_EXPECT_BEATS));
    void lastFunds;
    } finally {
      W.stopped = true;
      Date.now = realNow;
    }
  });
}
