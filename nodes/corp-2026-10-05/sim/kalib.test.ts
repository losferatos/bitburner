// Eichung/Belege durch Ausfuehrung der echten Spielquelle 3.0.1:
//  K1 Seed-Auszahlung (Audit CORP-1: 104,4 Mrd nach ~32 min; Falle IPO sofort: 317 min)
//  K2 Verkaufserloes = V * g(f), g(f) = 0,5 f + 2/3 f^1,5 (eigene Formel gegen sellShares)
//  K3 Langfrist-Ausgabe X senkt assetDelta im naechsten START um 2X/10 (Corporation.ts:92 Math.abs)
//  K4 Dummy-Division: Bewertung x 1,0079741^12
//  K5 Bonuszeit: 1 Zustand je Tick -> Nachholen mit 10-facher Geschwindigkeit
//  K6 Augmentierungs-Einbau laesst Corp + Anteile stehen; Knotenwechsel loescht sie
//  K7 Bestechung: Schwelle 1e14, 1 Ruf je 1e9; Bladeburners nicht bestechbar
import { Player } from "../../../reference/v301/src/Player";
import { getNS, initGameEnvironment, setupBasicTestingEnvironment } from "../../../reference/v301/test/jest/Utilities";
import { enterBitNode } from "../../../reference/v301/src/RedPill";
import { getDefaultBitNodeOptions } from "../../../reference/v301/src/BitNode/BitNodeUtils";
import { prestigeAugmentation, prestigeSourceFile } from "../../../reference/v301/src/Prestige";
import { RNG } from "./corpsim";

initGameEnvironment();

function fresh(seed = 7) {
  RNG.a = seed;
  Math.random = () => RNG.next();
  setupBasicTestingEnvironment();
  enterBitNode(true, Player.bitNodeN, 3, getDefaultBitNodeOptions());
  Player.money = 0;
  const ns = getNS();
  ns.corporation.createCorporation("K", false);
  return { ns, c: Player.corporation! };
}
const states = (c: any, n: number) => {
  for (let i = 0; i < n; i++) {
    c.storeCycles(10);
    c.process();
  }
};
const g = (f: number) => 0.5 * f + (2 / 3) * Math.pow(f, 1.5);

test("K1 Seed-Auszahlung", () => {
  // a) 10 Marktzyklen privat, IPO(0), warten bis Kurs >= 99 % Zielkurs, alles bis 1 Aktie verkaufen
  {
    const { ns, c } = fresh(11);
    states(c, 50);
    ns.corporation.goPublic(0);
    states(c, 55); // Bewertungsliste auf oeffentliche Werte umstellen (10 Zyklen Mittel)
    let t = 210;
    while (c.sharePrice < 0.99 * c.getTargetSharePrice()) {
      states(c, 5);
      t += 10;
    }
    const m0 = Player.money;
    ns.corporation.sellShares(c.numShares - 1);
    console.log(`K1a Seed: Verkauf nach ${(t / 60).toFixed(1)} min, Erloes ${((Player.money - m0) / 1e9).toFixed(1)} Mrd (Audit: 32 min / 104,4 Mrd)`);
  }
  // b) Falle: IPO sofort bei Gruendung
  {
    const { ns, c } = fresh(12);
    ns.corporation.goPublic(0);
    states(c, 55);
    let t = 110;
    while (c.sharePrice < 0.99 * c.getTargetSharePrice() && t < 30 * 3600) {
      states(c, 5);
      t += 10;
    }
    const m0 = Player.money;
    ns.corporation.sellShares(c.numShares - 1);
    console.log(`K1b Kurs bei IPO ${0.01}, Zielkurs jetzt ${c.getTargetSharePrice().toFixed(1)}`);
    console.log(`K1b IPO sofort: Kurs erst nach ${(t / 60).toFixed(0)} min am Ziel, Erloes ${((Player.money - m0) / 1e9).toFixed(1)} Mrd (Audit: 317 min)`);
  }
  // c) ohne Warten: IPO nach 100 s, sofort verkaufen
  {
    const { ns, c } = fresh(13);
    states(c, 50);
    ns.corporation.goPublic(0);
    const m0 = Player.money;
    ns.corporation.sellShares(c.numShares - 1);
    console.log(`K1c IPO nach 100 s + sofort verkaufen (private Bewertung ${(c.valuation / 1e9).toFixed(1)} Mrd): ${((Player.money - m0) / 1e9).toFixed(1)} Mrd`);
  }
});

test("K2 Verkaufserloes = V*g(f)", () => {
  for (const [label, prep] of [
    ["privat, f=2/3", (c: any) => {}],
    ["nach Runde 1, f=0,6", (c: any, ns: any) => ns.corporation.acceptInvestmentOffer()],
    ["nach Runde 1+2, f=0,367", (c: any, ns: any) => (ns.corporation.acceptInvestmentOffer(), ns.corporation.acceptInvestmentOffer())],
  ] as [string, (c: any, ns: any) => void][]) {
    const { ns, c } = fresh(21);
    states(c, 50);
    prep(c, ns);
    states(c, 50); // Bewertungsliste wieder einschwingen lassen
    const V = c.valuation;
    const f = c.numShares / c.totalShares;
    ns.corporation.goPublic(0);
    const m0 = Player.money;
    ns.corporation.sellShares(c.numShares - 1);
    const got = Player.money - m0;
    console.log(`K2 ${label}: V ${(V / 1e9).toFixed(2)} Mrd, f ${f.toFixed(4)}, Erloes ${(got / 1e9).toFixed(3)} Mrd, V*g(f) ${((V * g(f)) / 1e9).toFixed(3)} Mrd, Abweichung ${(((got / (V * g(f))) - 1) * 100).toFixed(2)} %`);
  }
});

test("K3 Langfrist-Ausgabe senkt assetDelta um 2X/10", () => {
  const { ns, c } = fresh(31);
  ns.corporation.expandIndustry("Restaurant", "R");
  states(c, 60);
  // genau vor START messen
  while (c.getNextState() !== "START") states(c, 1);
  const before = (c.totalAssets - c.previousTotalAssets) / 10;
  const X = ns.corporation.getUpgradeLevelCost("Smart Factories");
  ns.corporation.levelUpgrade("Smart Factories"); // Quelle "upgrades" = langfristig (FundsSource.ts:7)
  states(c, 5);
  const after = (c.totalAssets - c.previousTotalAssets) / 10;
  console.log(`K3 assetDelta vorher ${before.toFixed(0)}/s, nach Ausgabe X=${(X / 1e9).toFixed(2)} Mrd: ${(after / 1e9).toFixed(4)} Mrd/s; erwartet -2X/10 = ${((-2 * X) / 10 / 1e9).toFixed(4)} Mrd/s (Doku-Formel ohne Math.abs: 0)`);
});

test("K4 Dummy-Division", () => {
  const { ns, c } = fresh(41);
  states(c, 60);
  const v0 = c.cycleValuation;
  ns.corporation.expandIndustry("Restaurant", "D1");
  for (const city of ["Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"]) {
    ns.corporation.expandCity("D1", city);
    ns.corporation.purchaseWarehouse("D1", city);
  }
  states(c, 5 * 12);
  const v1 = c.cycleValuation;
  console.log(`K4 Bueros+Lager ${c.numberOfOfficesAndWarehouses}; Zyklusbewertung ${(v0 / 1e9).toFixed(2)} -> ${(v1 / 1e9).toFixed(2)} Mrd; Fonds ${(c.funds / 1e9).toFixed(1)} Mrd; Faktor 1,0079741^12 = ${Math.pow(1.0079741404289038, 12).toFixed(4)}; (10e9+F/3)*Faktor = ${(((10e9 + c.funds / 3) * Math.pow(1.0079741404289038, 12)) / 1e9).toFixed(2)} Mrd`);
});

test("K5 Bonuszeit 10x", () => {
  const { c } = fresh(51);
  // 1 h offline = 18000 Zyklen gespeichert (engine.tsx:329)
  c.storeCycles(18000);
  let ticks = 0;
  const st0 = c.state.state;
  let statesDone = 0;
  while (c.storedCycles >= 10) {
    c.storeCycles(1); // laufender Tick (engine.tsx:113)
    const before = c.state.state;
    c.process();
    if (c.state.state !== before) statesDone++;
    ticks++;
  }
  console.log(`K5 1 h Offline: ${statesDone} Zustaende in ${ticks} Ticks = ${((ticks * 0.2) / 60).toFixed(1)} min Echtzeit (Faktor ${(3600 / (ticks * 0.2)).toFixed(2)}); Startzustand ${st0}`);
});

test("K6 Persistenz", () => {
  const { ns, c } = fresh(61);
  states(c, 50);
  ns.corporation.goPublic(0);
  const shares = c.numShares;
  Player.money = 5e9;
  prestigeAugmentation();
  const c2 = Player.corporation;
  console.log(`K6 nach Augmentierungs-Einbau: Corp ${c2 ? "vorhanden" : "WEG"}, Anteile ${c2?.numShares === shares ? "gleich" : "anders"}, Fonds ${(c2?.funds ?? 0) / 1e9} Mrd, Spielergeld ${Player.money}`);
  prestigeSourceFile(false);
  console.log(`K6 nach Knotenwechsel (prestigeSourceFile): Corp ${Player.corporation ? "vorhanden" : "WEG"}`);
});

test("K7 Bestechung", () => {
  const { ns, c } = fresh(71);
  states(c, 50);
  Player.factions.push("CyberSec" as any, "Bladeburners" as any);
  const r1 = ns.corporation.bribe("CyberSec", 1e9);
  c.valuation = 1e14; // Schwelle kuenstlich erreicht (nur fuer den Beleg der Regeln)
  const r2 = ns.corporation.bribe("CyberSec", 2e9);
  let r3: any;
  try {
    r3 = ns.corporation.bribe("Bladeburners", 1e9);
  } catch (e) {
    r3 = String(e).slice(0, 80);
  }
  console.log(`K7 Bewertung < 1e14: ${r1}; >= 1e14, 2 Mrd an CyberSec: ${r2}, Ruf jetzt ${(globalThis as any).x ?? ""}; Bladeburners: ${r3}`);
});
