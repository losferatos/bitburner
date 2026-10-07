// Corp-Simulator auf der ECHTEN Spielquelle 3.0.1 (reference/v301, nur gelesen).
// Der Spielcode (Corporation.process, Division, Product, OfficeSpace, Actions, Bewertung,
// Anteilsverkauf) laeuft unveraendert; dieser Treiber spielt nur die Rolle eines Bot-Skripts,
// das vor jedem Corp-Zustand handelt (wie ein Skript, das auf ns.corporation.nextUpdate() wartet).
// Aktionen laufen ueber getNS().corporation (RAM je benutzter Funktion wird gezaehlt).
//
// Treiber-Annahmen (im Bericht genannt):
//  - Verkaufspreise: eigener "Market-TA2" aus den Spielformeln (Division.ts:322-389, helpers.ts:133ff):
//    s = Lager/10 <= Absatzgrenze D' -> TA2-Preis; sonst Material: Preis MP*D'/s (alles raus),
//    Produkt: Preis MP+Markupgrenze und Produktionslimit ~ D'. Ein Bot kann das aus getProduct/
//    getMaterial/getDivision/getOffice nachrechnen (Doku optimal-selling-price-market-ta2.md).
//  - Einkauf: eigener "Smart Supply" aus Spielinterna (Produktionsobergrenze dieses Zyklus).
//  - Zeit: je Zustand storeCycles(10)+process() = 2 s Spielzeit (engine.tsx:111-114).
import { Player } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/Player";
import { getNS, setupBasicTestingEnvironment } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/test/jest/Utilities";
import { enterBitNode } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/RedPill";
import { getDefaultBitNodeOptions } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/BitNode/BitNodeUtils";
import { Reviver } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/utils/GenericReviver";
import { RamCosts } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/Netscript/RamCostGenerator";
import { MaterialInfo } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/Corporation/MaterialInfo";
import { calculateUpgradeCost } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/Corporation/helpers";
import { CorpUpgrades } from "C:/Users/erche/Desktop/claude_projecto/bitburner/reference/v301/src/Corporation/data/CorporationUpgrades";

export const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"] as const;
const MAIN = "Aevum";
const JOBS = ["Operations", "Engineer", "Business", "Management", "Research & Development", "Intern"] as const;
type Mix = Partial<Record<(typeof JOBS)[number], number>>;

// ------------------------------------------------------------------ Zufall mit Zustand (fuer Abzweige)
export const RNG = {
  a: 1,
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
};

export interface Params {
  name: string;
  seed: number;
  hours: number;
  /** seed = kein Geschaeft; agri = nur Agriculture; doc = Agri -> Chem -> Tobacco nach Spieldoku */
  mode: "seed" | "agri" | "doc";
  /** Zeitpunkte (h), ab denen Runde k angenommen wird (Bedingungen siehe tryRound) */
  rounds: number[];
  checkpoints: number[];
  /** doc: Tobacco ohne vorherige Runde 2 bauen (h) */
  tobAt?: number;
  /** doc: Chemical-Division bauen (Standard true) */
  chem?: boolean;
  adShare?: number;
  order?: string[];
  tobAfterRound?: number;
  supMix?: Mix;
  /** Groesse der Nebenbueros relativ zum Hauptbuero */
  supRatio?: number;
  shares?: Partial<Record<"wilson" | "ads" | "main" | "up" | "sup" | "agri" | "tob", number>>;
  researchMult?: number;
  /** exact = TA2-Formel mit Spielinterna; lagK = nur aus beobachtetem Absatz (Bot-tauglich) */
  pricing?: "exact" | "lagK";
  /** Agri-Ausbau mit fester Regel statt Abzweig-Suche (bot-tauglich) */
  agriFixed?: boolean;
  /** Dummy-Divisionen vor dem Verkauf (Standard true) */
  dummies?: boolean;
  tranches?: { h: number; frac: number }[];
  greedyEvery?: number;
  verbose?: boolean;
}

export interface CheckpointResult {
  h: number;
  money: number;
  how: string;
  valuation: number;
  funds: number;
  profitPerSec: number;
  ownedFrac: number;
  dummies: number;
  rounds: number;
}

export class Sim {
  p: Params;
  ns: any;
  cns: any;
  used = new Set<string>();
  quiet = 0; // >0: im Abzweig, keine Ereignisse
  // ------- Zustand, der in Abzweigen gesichert wird
  t = 0;
  cycle = 0;
  lastLT = -999;
  freezeUntil = -1;
  roundsDone = 0;
  stage = "init";
  productSeq = 0;
  playerGot = 0;
  tranchesDone: number[] = [];
  boostTarget: Record<string, Record<string, Record<string, number>>> = {};
  dummyCount = 0;
  profitHist: number[] = [];
  // -------
  events: string[] = [];
  results: CheckpointResult[] = [];
  traj: { h: number; profit: number; funds: number; valuation: number; owned: number; rating: number; aw: number; wilson: number; ads: number; mainOffice: number }[] = [];

  constructor(p: Params) {
    this.p = p;
  }

  init() {
    RNG.a = this.p.seed >>> 0;
    Math.random = () => RNG.next();
    setupBasicTestingEnvironment();
    const NODE = Number(process.env.CORP_NODE ?? 3);
    Player.sourceFiles.set(3, 3);
    enterBitNode(true, Player.bitNodeN, NODE, getDefaultBitNodeOptions());
    Player.money = NODE === 3 ? 0 : 150e9;
    this.ns = getNS();
    const self = this;
    this.cns = new Proxy(this.ns.corporation, {
      get(target, prop: string) {
        const v = target[prop];
        if (typeof v === "function") {
          self.used.add(prop);
          return v.bind(target);
        }
        return v;
      },
    });
    if (!this.cns.createCorporation("Corp", NODE !== 3)) throw new Error("createCorporation fehlgeschlagen");
  }
  get c(): any {
    return Player.corporation!;
  }
  div(n: string): any {
    return this.c.divisions.get(n);
  }
  ramGB(): number {
    let s = 1.6;
    for (const f of this.used) s += (RamCosts as any).corporation[f] ?? 0;
    return s;
  }
  ev(s: string) {
    if (this.quiet) return;
    const line = `${(this.t / 3600).toFixed(2)}h ${s}`;
    this.events.push(line);
    if (this.p.verbose) console.log(line);
  }
  canCapex() {
    return this.cycle >= this.freezeUntil;
  }
  LT() {
    this.lastLT = this.cycle;
  }
  get profit() {
    return this.c.revenue - this.c.expenses;
  }
  /** Vermoegenszuwachs je s, wie ihn die Bewertung sieht (Corporation.ts:200) */
  get assetDelta() {
    return (this.c.totalAssets - this.c.previousTotalAssets) / 10;
  }
  noRounds = 0;
  kState: Record<string, { K?: number; P: number }> = {};

  // ---------------------------------------------------------------- Zeit
  stepState() {
    const next = this.c.getNextState();
    if (next === "START") {
      this.maintainEmployees();
      this.strategyTick();
    }
    if (next === "PURCHASE") this.supply();
    if (next === "EXPORT") this.routes();
    if (next === "SALE") this.pricing();
    this.c.storeCycles(10);
    this.c.process();
    this.t += 2;
    if (next === "PURCHASE") this.resetBuys();
    if (next === "SALE") this.cycle++;
    if (next === "START") {
      this.profitHist.push(this.assetDelta);
      if (this.profitHist.length > 30) this.profitHist.shift();
    }
  }
  runCycles(n: number) {
    for (let i = 0; i < n * 5; i++) this.stepState();
  }

  // ---------------------------------------------------------------- Abzweig
  snapshot(): any {
    return {
      corp: JSON.stringify(Player.corporation),
      money: Player.money,
      rng: RNG.a,
      st: JSON.stringify({
        t: this.t,
        cycle: this.cycle,
        lastLT: this.lastLT,
        freezeUntil: this.freezeUntil,
        roundsDone: this.roundsDone,
        stage: this.stage,
        productSeq: this.productSeq,
        playerGot: this.playerGot,
        tranchesDone: this.tranchesDone,
        boostTarget: this.boostTarget,
        dummyCount: this.dummyCount,
        profitHist: this.profitHist,
        kState: this.kState,
      }),
    };
  }
  restore(s: any) {
    Player.corporation = JSON.parse(s.corp, Reviver);
    Player.money = s.money;
    RNG.a = s.rng;
    Object.assign(this, JSON.parse(s.st));
  }

  // ---------------------------------------------------------------- Betrieb
  maintainEmployees() {
    for (const div of this.c.divisions.values()) {
      for (const city of Object.keys(div.offices)) {
        const o = div.offices[city];
        if (o.numEmployees === 0) continue;
        // Tee +2 Energie (OfficeSpace.ts:94), Party x(1+k/1e7)+... (Actions.ts:410ff, OfficeSpace.ts:101-102);
        // Schwelle statt jeden Zyklus: bei 12 Koepfen kostet Tee je Zyklus 6 Mio, das frisst den Agri-Gewinn
        if (o.avgEnergy < o.maxEnergy - 2) this.cns.buyTea(div.name, city);
        if (o.avgMorale < o.maxMorale - 2) this.cns.throwParty(div.name, city, 2e5);
      }
    }
  }

  /** Produktion (Einheiten) dieses Zyklus fuer eine Stadt */
  unitsThisCycle(div: any, city: string): number {
    const c = this.c;
    const office = div.offices[city];
    if (!office) return 0;
    div.calculateProductionFactors();
    if (div.makesProducts) {
      const pp =
        div.getOfficeProductivity(office, { forProduct: true }) *
        c.getProductionMultiplier() *
        div.productionMult *
        div.getProductionMultiplier() *
        div.getProductProductionMultiplier();
      let u = 0;
      for (const pr of div.products.values()) {
        if (!pr.finished) continue;
        const lim = pr.cityData[city].productionLimit;
        u += Math.min(pp, lim ?? Infinity);
      }
      return u * 10;
    }
    return div.getOfficeProductivity(office) * div.productionMult * c.getProductionMultiplier() * div.getProductionMultiplier() * 10;
  }

  supply() {
    const c = this.c;
    for (const div of c.divisions.values()) {
      if (div.name.startsWith("Dummy")) continue;
      for (const city of Object.keys(div.warehouses)) {
        const wh = div.warehouses[city];
        const units = this.unitsThisCycle(div, city);
        for (const [mat, q] of Object.entries(div.requiredMaterials) as [string, number][]) {
          // intern belieferte Rohstoffe NIE vom Markt kaufen: Marktware hat Qualitaet 1 und verduennt
          // den Lagerbestand (Division.ts:571), das deckelt Pflanzen-/Produktqualitaet (Division.ts:930)
          // Lieferung per Export kommt erst im EXPORT-Zustand (nach der Produktion) -> der Vorrat jetzt ist,
          // was diese Produktion hat. Tobacco kauft Pflanzen nur zum Anlauf (Qualitaet 1 verduennt)
          if (this.suppliedInternally(div.name, mat) && (wh.materials[mat].importAmount > 0 || wh.materials[mat].stored > 0)) continue;
          const need = q * units - wh.materials[mat].stored;
          if (need > 0) this.cns.buyMaterial(div.name, city, mat, need / 10);
        }
        const bt = this.boostTarget[div.name]?.[city];
        if (bt) {
          // Platzreserve fuer den Durchfluss eines Zyklus (Ein- und Ausgang, doppelt), sonst verstopft das Lager
          // und die Produktion steht (Division.ts:607-611, 882-886)
          let free = wh.size - wh.sizeUsed - this.flowSpace(div, city, units);
          for (const [mat, target] of Object.entries(bt)) {
            const need = target - wh.materials[mat].stored;
            const sz = MaterialInfo[mat as keyof typeof MaterialInfo].size;
            if (need > 1 && free > 0) {
              const amt = Math.min(need, free / sz);
              if (amt > 1) {
                this.cns.buyMaterial(div.name, city, mat, amt / 10);
                free -= amt * sz;
              }
            }
          }
        }
      }
    }
  }
  /** Lagerplatz, den ein Zyklus Durchfluss braucht (x2 Sicherheit) */
  flowSpace(div: any, city: string, units: number): number {
    let per = 0;
    for (const [m, q] of Object.entries(div.requiredMaterials) as [string, number][]) per += q * MaterialInfo[m as keyof typeof MaterialInfo].size;
    if (div.makesProducts) per *= 2; // Produkt belegt so viel wie seine Rohstoffe (Product.ts:209-212)
    else for (const m of div.producedMaterials) per += MaterialInfo[m as keyof typeof MaterialInfo].size;
    return 2 * units * per;
  }
  suppliedInternally(dn: string, mat: string): boolean {
    if (!this.c.unlocks.has("Export")) return false;
    // Tobacco: nur Agri-Pflanzen (Qualitaet entscheidet das effektive Rating); Agri/Chem: Fehlmenge kaufen
    if (mat === "Plants" && dn === "Tob") return this.c.divisions.has("Agri");
    return false;
  }
  /** erwartete Lieferung per Export im naechsten Zyklus (Einheiten) */
  expectedImport(dn: string, city: string, mat: string): number {
    if (!this.c.unlocks.has("Export")) return 0;
    if (mat === "Chemicals" && dn === "Agri" && this.div("Chem")) return this.div("Chem").warehouses[city].materials.Chemicals.productionAmount * 10;
    if (mat === "Plants" && dn === "Chem" && this.div("Agri")) {
      const agri = this.div("Agri").warehouses[city].materials.Plants.productionAmount;
      const tob = this.div("Tob") ? this.unitsThisCycle(this.div("Tob"), city) / 10 : 0;
      return Math.max(0, agri - tob) * 10;
    }
    return 0;
  }
  resetBuys() {
    for (const div of this.c.divisions.values())
      for (const wh of Object.values(div.warehouses) as any[])
        for (const m of Object.values(wh.materials) as any[]) if (m.buyAmount) m.buyAmount = 0;
  }

  /** Exportmengen je Zyklus neu setzen (Bedarf des Abnehmers im naechsten Zyklus minus Lager).
   *  Die Doku-Formel (IPROD+IINV/10)*(-1) liefert nur den VORZYKLUS-Verbrauch nach und blockiert
   *  das Hochfahren (Abnehmer ohne Vorrat verbraucht 0 -> bekommt 0). Reihenfolge = FIFO (Division.ts:727). */
  routes() {
    const c = this.c;
    if (!c.unlocks.has("Export")) return;
    const ns = this.cns;
    const routes: [string, string, string, number][] = []; // src, dst, mat, Anteil Bedarf
    if (this.div("Agri") && this.div("Tob")) routes.push(["Agri", "Tob", "Plants", 1]);
    if (this.div("Agri") && this.div("Chem")) routes.push(["Agri", "Chem", "Plants", 1]);
    if (this.div("Chem") && this.div("Agri")) routes.push(["Chem", "Agri", "Chemicals", 0.2]);
    for (const city of CITIES) {
      for (const [src, dst, mat] of routes) {
        const m = this.div(src).warehouses[city].materials[mat];
        for (let i = m.exports.length - 1; i >= 0; i--) if (m.exports[i].division === dst) ns.cancelExportMaterial(src, city, dst, city, mat);
      }
      for (const [src, dst, mat, q] of routes) {
        const d = this.div(dst);
        const need = (q * this.unitsThisCycle(d, city)) / 10 - d.warehouses[city].materials[mat].stored / 10;
        if (need > 0) ns.exportMaterial(src, city, dst, city, mat, String(need * 1.05));
      }
    }
  }

  /** eigener Market-TA2 (exakt nach Division.ts:322-389) */
  pricing() {
    const c = this.c;
    for (const div of c.divisions.values()) {
      if (div.name.startsWith("Dummy")) continue;
      const AF = div.getAdvertisingFactors()[0];
      const SM = c.getSalesMult() * div.getSalesMultiplier();
      for (const city of Object.keys(div.warehouses)) {
        const office = div.offices[city];
        if (!office) continue;
        const wh = div.warehouses[city];
        const BF = div.getBusinessFactor(office);
        for (const mat of div.producedMaterials) {
          const m = wh.materials[mat];
          const s = m.stored / 10;
          const MP = m.marketPrice;
          const ML = m.getMarkupLimit();
          const D = (m.quality + 0.001) * div.getMarketFactor(m) * BF * SM * AF;
          let price = MP;
          if (s > 1e-9 && D > 0) price = s <= D ? ML / Math.sqrt(s / D) + MP : (MP * D) / s;
          if (!Number.isFinite(price) || price > 1e300) price = 1e300;
          this.cns.sellMaterial(div.name, city, mat, "MAX", String(price));
        }
        for (const pr of div.products.values()) {
          if (!pr.finished) continue;
          const cd = pr.cityData[city];
          const s = cd.stored / 10;
          let MP = 0;
          for (const [rm, q] of Object.entries(pr.requiredMaterials) as [string, number][]) MP += q * wh.materials[rm].marketPrice;
          MP *= 5;
          const ML = Math.max(cd.effectiveRating, 0.001) / pr.markup;
          const D = 0.5 * Math.pow(cd.effectiveRating, 0.65) * div.getMarketFactor(pr) * BF * SM * AF;
          let price = MP;
          if (s > 1e-9 && D > 0) price = s <= D ? ML / Math.sqrt(s / D) + MP : MP + ML;
          if (this.p.pricing === "lagK") {
            // Bot-tauglich (Doku optimal-selling-price-market-ta2.md): K = verkauft*(P-MP)^2 aus dem Vorzyklus,
            // Preis 5 % ueber der Schaetzung, damit der Verkauf gedeckelt bleibt und K messbar ist.
            const key = pr.name + "|" + city;
            const last = this.kState[key];
            if (last && cd.actualSellAmount > 0 && last.P > MP) this.kState[key].K = cd.actualSellAmount * (last.P - MP) ** 2;
            const K = this.kState[key]?.K;
            price = K === undefined ? MP * 1e6 : s > 1e-9 ? MP + 1.05 * Math.sqrt(K / s) : MP;
            this.kState[key] = { K: K ?? 0, P: price };
            if (K === undefined) delete this.kState[key].K;
            this.kState[key].P = price;
          }
          if (!Number.isFinite(price) || price > 1e300) price = 1e300;
          this.cns.sellProduct(div.name, city, pr.name, "MAX", String(price), false);
          // Produktion auf Absatz begrenzen, sonst verstopft das Lager
          const prodRate = cd.productionAmount;
          if (s > 3 * D && D > 0) this.cns.limitProductProduction(div.name, city, pr.name, D * 1.05);
          else if (cd.productionLimit !== null && s < D) this.cns.limitProductProduction(div.name, city, pr.name, Math.max(cd.productionLimit * 1.5, prodRate * 1.5, 1));
        }
      }
    }
  }

  // ---------------------------------------------------------------- Bausteine
  setJobs(dn: string, city: string, mix: Mix) {
    const o = this.div(dn).offices[city];
    const n = o.numEmployees;
    for (const j of JOBS) this.cns.setJobAssignment(dn, city, j, 0);
    const keys = Object.keys(mix) as (keyof Mix)[];
    const tot = keys.reduce((a, k) => a + (mix[k] ?? 0), 0);
    const cnt: Record<string, number> = {};
    let rest = n;
    for (const k of keys) {
      cnt[k] = Math.floor((n * (mix[k] ?? 0)) / tot);
      rest -= cnt[k];
    }
    const order = [...keys].sort((a, b) => (mix[b] ?? 0) - (mix[a] ?? 0));
    for (let i = 0; rest > 0; i++, rest--) cnt[order[i % order.length]]++;
    for (const k of keys) if (cnt[k] > 0) this.cns.setJobAssignment(dn, city, k, cnt[k]);
  }
  fill(dn: string, city: string, mix: Mix) {
    const o = this.div(dn).offices[city];
    while (o.numEmployees < o.size) this.cns.hireEmployee(dn, city, "Unassigned");
    this.setJobs(dn, city, mix);
  }
  officeCost(dn: string, city: string, by: number) {
    return this.cns.getOfficeSizeUpgradeCost(dn, city, by);
  }
  grow(dn: string, city: string, by: number, mix: Mix) {
    this.cns.upgradeOfficeSize(dn, city, by);
    this.LT();
    this.fill(dn, city, mix);
  }
  upCost(name: string) {
    const u = (CorpUpgrades as any)[name];
    return calculateUpgradeCost(u.basePrice, u.priceMult, this.c.upgrades[name].level, 1 as any);
  }
  up(name: string) {
    this.cns.levelUpgrade(name);
    this.LT();
  }
  whCostAll(dn: string) {
    let s = 0;
    for (const city of Object.keys(this.div(dn).warehouses)) s += this.cns.getUpgradeWarehouseCost(dn, city, 1);
    return s;
  }
  whAll(dn: string) {
    for (const city of Object.keys(this.div(dn).warehouses)) this.cns.upgradeWarehouse(dn, city, 1);
    this.LT();
  }
  /** Boost-Ziel: optimale Mischung fuer Lageranteil frac, Geld budget (Lagrange, Doku boost-material.md) */
  setBoost(dn: string, frac: number, budget: number): number {
    const div = this.div(dn);
    const f: Record<string, number> = {
      "Real Estate": div.realEstateFactor,
      Hardware: div.hardwareFactor,
      Robots: div.robotFactor,
      "AI Cores": div.aiCoreFactor,
    };
    const cities = Object.keys(div.warehouses);
    const perCity = budget / cities.length;
    this.boostTarget[dn] ??= {};
    let spent = 0;
    for (const city of cities) {
      const wh = div.warehouses[city];
      const size = (n: string) => MaterialInfo[n as keyof typeof MaterialInfo].size;
      const solve = (S: number) => {
        let names = Object.keys(f).filter((n) => f[n] > 0);
        for (let it = 0; it < 4; it++) {
          const sf = names.reduce((a, n) => a + f[n], 0);
          const ss = names.reduce((a, n) => a + size(n), 0);
          const x: Record<string, number> = {};
          for (const n of names) x[n] = (f[n] * (S + 500 * ss)) / (size(n) * sf) - 500;
          const neg = names.filter((n) => x[n] < 0);
          if (!neg.length) return x;
          names = names.filter((n) => x[n] >= 0);
        }
        return {} as Record<string, number>;
      };
      const cur = this.boostTarget[dn][city] ?? {};
      const costOf = (x: Record<string, number>) =>
        Object.entries(x).reduce((a, [n, q]) => a + Math.max(0, q - Math.max(cur[n] ?? 0, wh.materials[n].stored)) * wh.materials[n].marketPrice, 0);
      let S = Math.max(0, Math.min(wh.size * frac, wh.size - this.flowSpace(div, city, this.unitsThisCycle(div, city)) - 1));
      let x = solve(S);
      if (costOf(x) > perCity) {
        let lo = 0,
          hi = S;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (costOf(solve(mid)) > perCity) hi = mid;
          else lo = mid;
        }
        x = solve(lo);
      }
      spent += costOf(x);
      for (const n of Object.keys(x)) cur[n] = Math.max(cur[n] ?? 0, x[n]);
      this.boostTarget[dn][city] = cur;
    }
    return spent;
  }
  newDivision(ind: string, dn: string, mix: Mix | null, size = 3) {
    const ns = this.cns;
    ns.expandIndustry(ind, dn);
    for (const city of CITIES) {
      if (city !== "Sector-12") {
        ns.expandCity(dn, city);
        ns.purchaseWarehouse(dn, city);
      }
      if (mix) {
        if (size > 3) ns.upgradeOfficeSize(dn, city, size - 3);
        this.fill(dn, city, mix);
      }
    }
    this.LT();
  }

  // ---------------------------------------------------------------- gieriger Ausbau per Abzweig
  /** misst den mittleren Gewinn nach h Zyklen mit/ohne Aktion (gleiche Zufallszahlen) */
  greedy(cands: { name: string; cost: number; apply: () => void }[], reserve: number, horizon = 6): string | null {
    const ok = cands.filter((x) => x.cost > 0 && x.cost <= this.c.funds - reserve);
    if (!ok.length) return null;
    const s0 = this.snapshot();
    this.quiet++;
    const measure = () => {
      this.freezeUntil = Number.MAX_SAFE_INTEGER;
      this.runCycles(horizon);
      const h = this.profitHist.slice(-2);
      return h.reduce((a, b) => a + b, 0) / h.length;
    };
    const base = measure();
    this.restore(s0);
    let best: any = null;
    for (const cd of ok) {
      cd.apply();
      const pa = measure();
      this.restore(s0);
      const score = (pa - base) / cd.cost;
      if (!best || score > best.score) best = { ...cd, score };
    }
    this.quiet--;
    // lohnt bei privater Bewertung, wenn 315e3*dP > Kosten/3 (Corporation.ts:214-216)
    if (best && best.score > 1 / 945e3) {
      best.apply();
      this.ev(`Ausbau ${best.name} (${(best.cost / 1e9).toFixed(1)} Mrd, dP/$ ${(best.score * 1e6).toFixed(2)}e-6)`);
      return best.name;
    }
    return null;
  }

  agriMix(n: number): Mix {
    if (n <= 4) return { Operations: 1, Engineer: 1, Business: 1, Management: 1 };
    if (n <= 9) return { Operations: 2, Engineer: 2, Business: 1, Management: 2, "Research & Development": 1 };
    return { Operations: 3, Engineer: 4, Business: 1.5, Management: 2.5, "Research & Development": 1 };
  }
  agriCands(): { name: string; cost: number; apply: () => void }[] {
    const c = this.c;
    const out: { name: string; cost: number; apply: () => void }[] = [];
    const o = this.div("Agri").offices["Sector-12"];
    out.push({
      name: "Agri Buero +3",
      cost: 6 * this.officeCost("Agri", "Sector-12", 3),
      apply: () => {
        for (const city of CITIES) this.grow("Agri", city, 3, this.agriMix(o.size + 3));
      },
    });
    out.push({ name: "Agri Lager +1", cost: this.whCostAll("Agri"), apply: () => this.whAll("Agri") });
    out.push({ name: "Smart Storage", cost: this.upCost("Smart Storage"), apply: () => this.up("Smart Storage") });
    out.push({ name: "Smart Factories", cost: this.upCost("Smart Factories"), apply: () => this.up("Smart Factories") });
    out.push({ name: "Agri Werbung", cost: this.cns.getHireAdVertCost("Agri"), apply: () => this.cns.hireAdVert("Agri") });
    const room = c.funds * 0.25;
    out.push({ name: "Agri Boost", cost: room, apply: () => this.setBoost("Agri", 0.75, room) });
    return out;
  }

  // ---------------------------------------------------------------- Strategie
  strategyTick() {
    const h = this.t / 3600;
    if (this.p.tranches) {
      for (let i = 0; i < this.p.tranches.length; i++) {
        const tr = this.p.tranches[i];
        if (!this.tranchesDone.includes(i) && h >= tr.h && this.c.shareSaleCooldown <= 0 && this.canCapex()) {
          this.tranchesDone.push(i);
          const got = this.sellFraction(tr.frac);
          this.playerGot += got;
          this.ev(`Tranche ${tr.frac} -> ${(got / 1e9).toFixed(1)} Mrd an den Spieler`);
        }
      }
    }
    this.tryRound();
    if (!this.canCapex() || this.p.mode === "seed") return;
    if (this.stage === "init") this.setupAgri();
    if (this.p.mode === "agri") return this.growAgriGreedy();
    this.docTick();
  }

  /** Runde k annehmen, wenn Zeit erreicht und 11 Zyklen ohne Langfrist-Ausgabe */
  tryRound() {
    if (this.noRounds || this.roundsDone >= this.p.rounds.length || this.c.public) return;
    const h = this.t / 3600;
    const Tr = this.p.rounds[this.roundsDone];
    if (h < Tr - 150 / 3600) return;
    if (!this.roundReady()) return;
    if (this.freezeUntil < Number.MAX_SAFE_INTEGER) {
      this.freezeUntil = Number.MAX_SAFE_INTEGER;
      this.beforeRound();
      return;
    }
    if (h >= Tr && this.cycle - this.lastLT >= 11) {
      const off = this.cns.getInvestmentOffer();
      this.cns.acceptInvestmentOffer();
      this.roundsDone++;
      this.ev(`Runde ${off.round}: ${(off.funds / 1e9).toFixed(1)} Mrd fuer ${off.shares / 1e6} Mio Anteile (Bewertung ${(this.c.valuation / 1e9).toFixed(1)} Mrd, Gewinn ${(this.profit / 1e6).toFixed(2)} Mio/s)`);
      this.freezeUntil = -1;
    }
  }
  roundReady(): boolean {
    const k = this.roundsDone; // 0 = Runde 1
    if (this.p.mode !== "doc") return true;
    if (k === 1) {
      // Doku: RP Agri >= 700, Chem >= 390
      const a = this.div("Agri")?.researchPoints ?? 0;
      const ch = this.div("Chem")?.researchPoints ?? 390;
      return (a >= 700 && ch >= 390) || this.t / 3600 >= this.p.rounds[1] + 0.5;
    }
    if (k >= 2) {
      const tob = this.div("Tob");
      if (!tob) return false;
      let fin = 0;
      for (const pr of tob.products.values()) if (pr.finished) fin++;
      return fin >= (k === 2 ? 2 : 3) || this.t / 3600 >= this.p.rounds[k] + 1;
    }
    return true;
  }
  beforeRound() {
    // Dummy-Divisionen heben das Angebot (x1,008 je Buero/Lager, Corporation.ts:211/219)
    if (this.p.dummies !== false) this.buildDummies(this.c.valuation);
  }

  setupAgri() {
    const ns = this.cns;
    this.newDivision("Agriculture", "Agri", null);
    for (const city of CITIES) {
      ns.upgradeOfficeSize("Agri", city, 1);
      this.fill("Agri", city, this.agriMix(4));
    }
    ns.hireAdVert("Agri");
    ns.hireAdVert("Agri");
    this.stage = "agri";
    this.ev(`Agri aufgebaut, Fonds ${(this.c.funds / 1e9).toFixed(1)} Mrd`);
  }

  growAgriGreedy(reserve = 2e9) {
    if (this.cycle % (this.p.greedyEvery ?? 3) !== 0) return;
    if (this.p.agriFixed) return this.growAgriFixed(reserve);
    for (let i = 0; i < 4; i++) if (!this.greedy(this.agriCands(), reserve)) break;
  }
  /** bot-taugliche feste Regel (ohne Abzweige), nachgebaut aus dem, was die Abzweig-Suche waehlte:
   *  Smart Storage bis 2, Smart Factories bis 13, Werbung bis 6, Rest Boosts; danach billigstes von SF/Werbung/Lager */
  growAgriFixed(reserve: number) {
    const c = this.c;
    const ns = this.cns;
    const spend = () => c.funds - reserve;
    for (let g = 0; g < 40; g++) {
      if (c.upgrades["Smart Storage"].level < 2 && this.upCost("Smart Storage") < spend()) { this.up("Smart Storage"); continue; }
      if (c.upgrades["Smart Factories"].level < 13 && this.upCost("Smart Factories") < spend() * 0.5) { this.up("Smart Factories"); continue; }
      if (this.div("Agri").numAdVerts < 6 && ns.getHireAdVertCost("Agri") < spend() * 0.3) { ns.hireAdVert("Agri"); continue; }
      break;
    }
    if (spend() > 1e9) this.setBoost("Agri", 0.75, spend() * 0.8);
    // spaeter: alle 3 Zyklen eine Kleinigkeit, wenn sie <= 10 % der Kasse kostet
    const sf = this.upCost("Smart Factories"), ad = ns.getHireAdVertCost("Agri"), wh = this.whCostAll("Agri");
    const m = Math.min(sf, ad, wh);
    if (m < 0.1 * spend()) {
      if (m === sf) this.up("Smart Factories");
      else if (m === ad) ns.hireAdVert("Agri");
      else this.whAll("Agri");
    }
  }

  chemMix: Mix = { Operations: 1, Engineer: 2, Business: 0.5, Management: 1, "Research & Development": 1.5 };
  tobMain: Mix = { Operations: 2.5, Engineer: 3, Business: 1.5, Management: 3 };
  get tobSup(): Mix {
    return this.p.supMix ?? { Operations: 1.5, Engineer: 1, Business: 0.5, Management: 1, "Research & Development": 6 };
  }

  docTick() {
    const c = this.c;
    const ns = this.cns;
    const h = this.t / 3600;
    // Phase 1: Agri bis Runde 1
    if (this.roundsDone === 0 && this.stage === "agri" && !(this.p.tobAt !== undefined && h >= this.p.tobAt)) {
      return this.growAgriGreedy(2e9);
    }
    // Phase 2: feste Schritte in Reihenfolge; Reserve = Kosten des naechsten Schritts, Rest gierig in Agri
    {
      const wantTob = this.roundsDone >= (this.p.tobAfterRound ?? 2) || (this.p.tobAt !== undefined && h >= this.p.tobAt);
      const o = this.div("Agri").offices["Sector-12"];
      const steps: { name: string; cond: boolean; cost: () => number; run: () => void }[] = [
        { name: "Export", cond: !c.unlocks.has("Export"), cost: () => 20e9, run: () => ns.purchaseUnlock("Export") },
        {
          name: "Chemical",
          // nach Tobacco nur noch opportunistisch (blockiert sonst den Produktausbau stundenlang)
          cond: this.p.chem !== false && !this.div("Chem") && (this.stage !== "tob" || c.funds > 3 * 121e9),
          cost: () => 70e9 + 45e9 + 6e9,
          run: () => {
            this.newDivision("Chemical", "Chem", this.chemMix);
            this.whAll("Chem");
          },
        },
        {
          name: "Agri-Bueros 8",
          cond: o.size < 8,
          cost: () => 6 * this.officeCost("Agri", "Sector-12", 8 - o.size),
          run: () => {
            for (const city of CITIES) this.grow("Agri", city, 8 - this.div("Agri").offices[city].size, this.agriMix(8));
          },
        },
        {
          name: "Tobacco",
          cond: wantTob && !this.div("Tob"),
          cost: () => 20e9 + 45e9 + 20e9 + 2e9,
          run: () => {
            this.newDivision("Tobacco", "Tob", null);
            for (const city of CITIES) {
              if (city === MAIN) {
                ns.upgradeOfficeSize("Tob", city, 12);
                this.fill("Tob", city, this.tobMain);
              } else this.fill("Tob", city, this.tobSup);
            }
            this.stage = "tob";
          },
        },
      ];
      const order = this.p.order ?? ["Export", "Chemical", "Agri-Bueros 8", "Tobacco"];
      steps.sort((x, y) => order.indexOf(x.name) - order.indexOf(y.name));
      let reserve = 2e9;
      for (const st of steps) {
        if (!st.cond) continue;
        const cost = st.cost();
        if (c.funds >= cost + 1e9) {
          st.run();
          this.LT();
          this.ev(`Schritt ${st.name} (${(cost / 1e9).toFixed(1)} Mrd), Fonds danach ${(c.funds / 1e9).toFixed(1)} Mrd`);
          continue;
        }
        reserve = cost + 1e9;
        break;
      }
      if (this.stage === "tob") {
        // offene Schritte haben Vorrang vor dem Produktausbau
        const pending = steps.some((st) => st.cond);
        if (!pending || c.funds > reserve) this.productTick(pending ? reserve : 0);
        return;
      }
      while (this.div("Agri").numAdVerts < 8 && ns.getHireAdVertCost("Agri") < (c.funds - reserve) * 0.5) ns.hireAdVert("Agri");
      this.growAgriGreedy(reserve);
      if (this.div("Chem") && c.funds > reserve) this.tendSupport("Chem", 0.02);
    }
  }

  /** Nebendivisionen (Agri/Chem) moderat mitziehen */
  tendSupport(dn: string, share: number) {
    const c = this.c;
    const div = this.div(dn);
    if (!div) return;
    const wh = div.warehouses[MAIN];
    if (wh.sizeUsed > 0.85 * wh.size && this.whCostAll(dn) < share * c.funds) this.whAll(dn);
    this.setBoost(dn, 0.6, share * c.funds);
  }

  productTick(reserve = 0) {
    const c = this.c;
    const F = () => Math.max(0, c.funds - reserve);
    const ns = this.cns;
    const tob = this.div("Tob");
    // Produkte: immer eines in Entwicklung
    let developing = false;
    let worst: any = null;
    for (const pr of tob.products.values()) {
      if (!pr.finished) developing = true;
      else {
        if (!pr._seen) {
          pr._seen = true;
          this.ev(`Produkt ${pr.name} fertig: Rating ${pr.rating.toFixed(0)}, eff ${pr.cityData[MAIN].effectiveRating.toFixed(0)}, Markup ${pr.markup.toFixed(3)}`);
        }
        if (!worst || pr.rating < worst.rating) worst = pr;
      }
    }
    if (!developing) {
      if (tob.products.size >= tob.maxProducts && worst) ns.discontinueProduct("Tob", worst.name);
      const inv = Math.max(1e8, F() * 0.01);
      if (F() > 2 * inv + 1e9) {
        ns.makeProduct("Tob", MAIN, `P${++this.productSeq}`, inv, inv);
        this.LT();
      }
    }
    // Forschung: nur wenn Vorrat >= 3x Kosten (RP-Vorrat hebt die Produktqualitaet, Product.ts:149)
    const lists: [string, string[]][] = [
      ["Tob", ["Hi-Tech R&D Laboratory", "uPgrade: Fulcrum", "Overclock", "uPgrade: Capacity.I", "Self-Correcting Assemblers", "Drones", "Drones - Assembly", "uPgrade: Capacity.II", "Automatic Drug Administration", "CPH4 Injections", "Drones - Transport", "Sti.mu", "Go-Juice"]],
      ["Agri", ["Hi-Tech R&D Laboratory", "Overclock", "Drones", "Drones - Assembly", "Self-Correcting Assemblers", "Drones - Transport"]],
      ["Chem", ["Hi-Tech R&D Laboratory", "Overclock", "Drones", "Drones - Assembly", "Self-Correcting Assemblers"]],
    ];
    for (const [dn, list] of lists) {
      const div = this.div(dn);
      if (!div) continue;
      for (const r of list) {
        if (div.hasResearch(r)) continue;
        let cost = 0;
        try {
          cost = ns.getResearchCost(dn, r);
        } catch {
          continue;
        }
        if (div.researchPoints >= (this.p.researchMult ?? 2) * cost) {
          try {
            ns.research(dn, r);
            this.ev(`Forschung ${dn}: ${r}`);
          } catch {
            /* Voraussetzung */
          }
        }
        break;
      }
    }
    if (F() < 2e9) return;
    const sh = { wilson: 0.5, ads: 0.3, main: 0.2, up: 0.05, sup: 0.02, agri: 0.08, tob: 0.03, ...(this.p.shares ?? {}) };
    // Wilson, wenn bezahlbar (Doku general-advice.md: "Buy Wilson if you can afford it")
    for (let g = 0; g < 5; g++) {
      const w = this.upCost("Wilson Analytics");
      if (w > sh.wilson * F()) break;
      this.up("Wilson Analytics");
    }
    // Werbung (Doku: mindestens 20 % der Mittel)
    let adB = sh.ads * F();
    for (let g = 0; g < 300; g++) {
      const cost = ns.getHireAdVertCost("Tob");
      if (cost > adB || cost > F()) break;
      ns.hireAdVert("Tob");
      adB -= cost;
    }
    // Hauptbuero
    for (let g = 0; g < 3; g++) {
      const cost = this.officeCost("Tob", MAIN, 15);
      if (cost > sh.main * F()) break;
      this.grow("Tob", MAIN, 15, this.tobMain);
    }
    // Corp-Upgrades, billigstes zuerst, je Stueck <= sh.up der Mittel
    const ups = ["Smart Factories", "Smart Storage", "FocusWires", "Neural Accelerators", "Speech Processor Implants", "Nuoptimal Nootropic Injector Implants", "ABC SalesBots", "Project Insight"];
    for (let g = 0; g < 40; g++) {
      let best = ups[0];
      for (const u of ups) if (this.upCost(u) < this.upCost(best)) best = u;
      if (this.upCost(best) > sh.up * F()) break;
      this.up(best);
    }
    // Nebenbueros Tobacco (RP + Absatz in 5 Staedten)
    for (const city of CITIES) {
      if (city === MAIN) continue;
      const so = tob.offices[city];
      if (so.size >= (this.p.supRatio ?? 1) * tob.offices[MAIN].size) continue;
      const cost = this.officeCost("Tob", city, 6);
      if (cost < sh.sup * F()) this.grow("Tob", city, 6, this.tobSup);
    }
    // Plants-Versorgung: Tobacco-Bedarf (alle Produkte ungedrosselt) gegen Agri-Produktion
    let demand = 0,
      sup = 0;
    for (const city of CITIES) {
      demand += this.unitsThisCycle(tob, city) / 10;
      sup += this.div("Agri").warehouses[city].materials.Plants.productionAmount;
    }
    if (demand > 0.9 * sup) {
      const o = this.div("Agri").offices["Sector-12"];
      if (6 * this.officeCost("Agri", "Sector-12", 3) < sh.agri * F()) for (const city of CITIES) this.grow("Agri", city, 3, this.agriMix(o.size + 3));
      this.tendSupport("Agri", sh.agri);
    } else this.tendSupport("Agri", sh.agri / 4);
    // Chemicals-Versorgung und -Qualitaet
    const chem = this.div("Chem");
    if (chem) {
      const co = chem.offices["Sector-12"];
      if (co.size < 9 && 6 * this.officeCost("Chem", "Sector-12", 3) < 0.02 * F()) for (const city of CITIES) this.grow("Chem", city, 3, this.chemMix);
      this.tendSupport("Chem", 0.01);
    }
    // Tobacco-Lager + Boosts
    const wh = tob.warehouses[MAIN];
    if (wh.sizeUsed > 0.7 * wh.size && this.whCostAll("Tob") < sh.tob * F()) this.whAll("Tob");
    this.setBoost("Tob", 0.5, sh.tob * F());
  }

  // ---------------------------------------------------------------- Dummy-Divisionen
  /** baut Restaurant-Dummies (10 Mrd + 5 Bueros + 5 Lager = 55 Mrd, +12 Bueros/Lager -> x1,1),
   *  solange 0,1*V > Kosten/3 (private Bewertung zaehlt Fonds/3) und Divisionsgrenze 20 */
  buildDummies(V: number): number {
    let n = 0;
    while (this.c.divisions.size < this.c.maxDivisions && this.c.funds > 56e9 && 0.1 * V > 55e9 / 3) {
      const dn = `Dummy${++this.dummyCount}`;
      this.newDivision("Restaurant", dn, null);
      V *= 1.1;
      n++;
    }
    if (n) this.ev(`${n} Dummy-Divisionen gebaut`);
    return n;
  }

  // ---------------------------------------------------------------- Anteilsverkauf
  sellFraction(frac: number): number {
    const c = this.c;
    if (!c.public) this.cns.goPublic(0);
    if (c.shareSaleCooldown > 0) return 0;
    const n = Math.min(c.numShares - 1, Math.floor(c.numShares * frac));
    if (n < 1) return 0;
    const m0 = Player.money;
    this.cns.sellShares(n);
    return Player.money - m0;
  }

  /** Liquidationswert jetzt: Dummies, 11 Zyklen Investitionsstopp, dann bestes von
   *  (a) IPO + sofort verkaufen (private Durchschnittsbewertung) und
   *  (b) IPO, 11 Zyklen (oeffentliche Bewertung), verkaufen. */
  liquidationValue(): { money: number; how: string; valuation: number; profit: number; dummies: number } {
    const s0 = this.snapshot();
    this.quiet++;
    this.noRounds++;
    const d = this.p.dummies !== false && this.p.mode !== "seed" ? this.buildDummies(this.c.valuation) : 0;
    this.freezeUntil = Number.MAX_SAFE_INTEGER;
    this.runCycles(11);
    const s1 = this.snapshot();
    const profit = this.profitHist.slice(-5).reduce((a, b) => a + b, 0) / 5; // assetDelta-Mittel
    const val = this.c.valuation;
    let best = { money: 0, how: "-", valuation: val, profit, dummies: d };
    const wasPublic = this.c.public;
    const got = this.sellFraction(1);
    if (got > best.money) best = { money: got, how: wasPublic ? "Verkauf" : "IPO+sofort", valuation: val, profit, dummies: d };
    this.restore(s1);
    if (!this.c.public) {
      this.cns.goPublic(0);
      this.runCycles(11);
      const g2 = this.sellFraction(1);
      if (g2 > best.money) best = { money: g2, how: "IPO+11Zyklen", valuation: this.c.valuation, profit, dummies: d };
    }
    this.restore(s0);
    this.quiet--;
    this.noRounds--;
    return best;
  }

  diag(): string {
    const c = this.c;
    const out: string[] = [];
    out.push(`Wilson ${c.upgrades["Wilson Analytics"].level} SF ${c.upgrades["Smart Factories"].level} SS ${c.upgrades["Smart Storage"].level} FW ${c.upgrades["FocusWires"].level} ABC ${c.upgrades["ABC SalesBots"].level} PI ${c.upgrades["Project Insight"].level}`);
    for (const dn of ["Agri", "Chem", "Tob"]) {
      const d = this.div(dn);
      if (!d) continue;
      const o = d.offices[MAIN];
      const w = d.warehouses[MAIN];
      let s = `${dn}: RP ${fmt(d.researchPoints)} ads ${d.numAdVerts} aw ${d.awareness.toExponential(1)} pop ${d.popularity.toExponential(1)} AF ${d.getAdvertisingFactors()[0].toExponential(2)} pm ${d.productionMult.toFixed(1)} | ${MAIN}: buero ${o.size} wh ${w.sizeUsed.toFixed(0)}/${w.size.toFixed(0)} rev ${fmt(d.lastCycleRevenue)}/s`;
      for (const m of d.producedMaterials) s += ` ${m} q ${w.materials[m].quality.toFixed(1)} prod ${w.materials[m].productionAmount.toFixed(1)} sold ${w.materials[m].actualSellAmount.toFixed(1)}`;
      for (const pr of d.products.values()) {
        if (!pr.finished) continue;
        const cd = pr.cityData[MAIN];
        s += `
     ${pr.name} rating ${pr.rating.toFixed(0)} eff ${cd.effectiveRating.toFixed(0)} markup ${pr.markup.toFixed(3)} prod ${cd.productionAmount.toFixed(1)} sold ${cd.actualSellAmount.toFixed(1)} preis ${fmt(pr.uiMarketPrice[MAIN] ?? 0)} lim ${cd.productionLimit?.toFixed(1)}`;
      }
      out.push(s);
    }
    return out.join(String.fromCharCode(10) + "   ");
  }

  run(): CheckpointResult[] {
    this.init();
    const cps = [...this.p.checkpoints].sort((a, b) => a - b);
    let ci = 0;
    const end = this.p.hours * 3600;
    let nextTraj = 0;
    while (this.t < end + 1 && ci < cps.length) {
      if (this.t >= nextTraj * 3600 && this.c.getNextState() === "START") {
        const tob = this.div("Tob");
        let best = 0;
        if (tob) for (const pr of tob.products.values()) if (pr.finished) best = Math.max(best, pr.rating);
        this.traj.push({
          h: nextTraj,
          profit: this.profitHist.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, this.profitHist.length)),
          funds: this.c.funds,
          valuation: this.c.valuation,
          owned: this.c.numShares / this.c.totalShares,
          rating: best,
          aw: tob ? tob.awareness : 0,
          wilson: this.c.upgrades["Wilson Analytics"].level,
          ads: tob ? tob.numAdVerts : 0,
          mainOffice: tob ? tob.offices[MAIN].size : 0,
        });
        nextTraj += 0.5;
      }
      if (this.t >= cps[ci] * 3600 && this.c.getNextState() === "START") {
        const lv = this.liquidationValue();
        const c = this.c;
        const r: CheckpointResult = {
          h: cps[ci],
          money: lv.money + this.playerGot,
          how: lv.how,
          valuation: lv.valuation,
          funds: c.funds,
          profitPerSec: lv.profit,
          ownedFrac: c.numShares / c.totalShares,
          dummies: lv.dummies,
          rounds: this.roundsDone,
        };
        this.results.push(r);
        if (this.p.verbose)
          console.log(
            `[${this.p.name}] ${cps[ci]}h: SPIELER ${fmt(r.money)} (Tranchen ${fmt(this.playerGot)}) via ${lv.how}, Dummies ${lv.dummies}; Bewertung ${fmt(lv.valuation)}, Gewinn ${fmt(lv.profit)}/s, Fonds ${fmt(c.funds)}, Anteil ${(r.ownedFrac * 100).toFixed(1)} %`,
          );
        if (this.p.verbose) console.log("   " + this.diag());
        ci++;
        continue;
      }
      this.stepState();
    }
    return this.results;
  }
}

export function fmt(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e15) return x.toExponential(2);
  if (a >= 1e12) return (x / 1e12).toFixed(2) + " Bio";
  if (a >= 1e9) return (x / 1e9).toFixed(1) + " Mrd";
  if (a >= 1e6) return (x / 1e6).toFixed(2) + " Mio";
  return x.toFixed(0);
}
