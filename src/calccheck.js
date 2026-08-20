/**
 * Die eigenen Nachbildungen gegen die echten Formeln pruefen.
 *
 * lib/calc.js bildet ein halbes Dutzend Spielformeln von Hand nach - hackChance,
 * hackPercent, growThreads, die drei Laufzeiten. Sie waren nie ueberpruefbar:
 * ohne Formulas.exe gibt es im Spiel keine zweite Quelle, gegen die man haette
 * rechnen koennen. Die gesamte Zielauswahl (targetScore) und die komplette
 * Stapelplanung haengen an diesen Nachbildungen.
 *
 * Seit dem Kauf gibt es die zweite Quelle. Diese Messung stellt beide Werte
 * nebeneinander. Weicht etwas ab, ist nicht die Nachbildung "ungenau" - dann
 * plant der Verwalter seit Tagen mit falschen Zahlen.
 *
 * @param {NS} ns
 */
import * as calc from "lib/calc.js";

export async function main(ns) {
  ns.disableLog("ALL");
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/calccheck.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/calccheck.txt", "home", ns.getHostname());
  };
  if (!ns.fileExists("Formulas.exe", "home")) return sag("Formulas.exe fehlt.");

  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const n of ns.scan(hier)) { if (!gesehen.has(n)) { gesehen.add(n); schlange.push(n); } }
  }

  const spieler = ns.getPlayer();
  // calc.js erwartet den Spieler in eigener Form. Wie genau, verraet der
  // Aufrufer im Autopiloten - hier dieselben Felder.
  const p = {
    skill: spieler.skills.hacking,
    int: spieler.skills.intelligence,
    multChance: spieler.mults.hacking_chance,
    multMoney: spieler.mults.hacking_money,
    multSpeed: spieler.mults.hacking_speed,
    multGrow: spieler.mults.hacking_grow,
    multExp: spieler.mults.hacking_exp,
  };

  const ziele = [...gesehen]
    .filter((h) => h !== "home" && !h.startsWith("bot-"))
    .map((h) => ns.getServer(h))
    .filter((s) => s.hasAdminRights && (s.moneyMax || 0) > 0 && s.requiredHackingSkill <= p.skill)
    .sort((a, b) => b.moneyMax - a.moneyMax)
    .slice(0, 10);

  // calc.js arbeitet mit einem EIGENEN Serverformat, nicht mit dem von
  // ns.getServer(). Der erste Anlauf dieser Messung hat das uebersehen und
  // ns.getServer() direkt hineingereicht - heraus kamen lauter Nullen und
  // NaN, und einen Moment lang sah es aus, als rechne der Verwalter seit
  // Tagen mit Muell. Der Fehler lag in der Messung. Die Abbildung unten ist
  // dieselbe wie im Autopiloten (autopilot.js:487-497).
  const alsCalc = (s, sec) => ({
    host: s.hostname,
    root: s.hasAdminRights,
    ram: s.maxRam,
    moneyMax: s.moneyMax,
    moneyNow: s.moneyAvailable,
    sec: sec,
    secMin: s.minDifficulty,
    growth: s.serverGrowth,
    reqSkill: s.requiredHackingSkill,
  });

  const abw = (eigen, echt) => {
    if (!Number.isFinite(eigen) || !Number.isFinite(echt) || echt === 0) return "--";
    const d = (eigen / echt - 1) * 100;
    return (d >= 0 ? "+" : "") + d.toFixed(2) + "%";
  };

  sag("Ziel                 chance eigen/echt      pct eigen/echt      hackTime eigen/echt");
  sag("-".repeat(86));
  const summen = { chance: [], pct: [], zeit: [], grow: [] };

  for (const s of ziele) {
    const k = ns.getServer(s.hostname);
    k.hackDifficulty = k.minDifficulty;
    k.moneyAvailable = k.moneyMax;

    const c = alsCalc(k, k.minDifficulty);
    const cEigen = calc.hackChance(c, p);
    const cEcht = ns.formulas.hacking.hackChance(k, spieler);
    const pEigen = calc.hackPercent(c, p);
    const pEcht = ns.formulas.hacking.hackPercent(k, spieler);
    const tEigen = calc.hackTime(c, p);
    const tEcht = ns.formulas.hacking.hackTime(k, spieler);

    summen.chance.push(cEigen / cEcht);
    summen.pct.push(pEigen / pEcht);
    summen.zeit.push(tEigen / tEcht);

    sag(s.hostname.padEnd(20)
      + (cEigen * 100).toFixed(1).padStart(7) + "/" + (cEcht * 100).toFixed(1).padStart(6)
      + abw(cEigen, cEcht).padStart(9)
      + (pEigen * 100).toFixed(3).padStart(9) + "/" + (pEcht * 100).toFixed(3).padStart(7)
      + abw(pEigen, pEcht).padStart(9)
      + Math.round(tEigen).toString().padStart(9) + "/" + Math.round(tEcht).toString().padStart(7)
      + abw(tEigen, tEcht).padStart(9));
  }

  // growThreads getrennt: hier ist der Zustand entscheidend, nicht der Server.
  sag("");
  sag("Grow-Faeden (von halb auf voll, vorbereiteter Server, 1 Kern)");
  sag("Ziel                    eigen      echt   Abweichung");
  for (const s of ziele) {
    const k = ns.getServer(s.hostname);
    k.hackDifficulty = k.minDifficulty;
    k.moneyAvailable = k.moneyMax / 2;
    const cg = alsCalc(k, k.minDifficulty);
    cg.moneyNow = k.moneyMax / 2;
    const gEigen = Math.ceil(calc.growThreads(cg, k.moneyMax, k.moneyMax / 2, p, 1));
    const gEcht = ns.formulas.hacking.growThreads(k, spieler, k.moneyMax, 1);
    summen.grow.push(gEigen / Math.max(1, gEcht));
    sag("  " + s.hostname.padEnd(20) + String(gEigen).padStart(8) + String(gEcht).padStart(10)
      + abw(gEigen, gEcht).padStart(13));
  }

  const mittel = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length - 1) * 100 : 0;
  sag("");
  sag("Mittlere Abweichung der Nachbildung:");
  sag("  hackChance  " + mittel(summen.chance).toFixed(3) + " %");
  sag("  hackPercent " + mittel(summen.pct).toFixed(3) + " %");
  sag("  hackTime    " + mittel(summen.zeit).toFixed(3) + " %");
  sag("  growThreads " + mittel(summen.grow).toFixed(3) + " %");
}
