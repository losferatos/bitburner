// Gegenpruefung G05: Wie viel Geld sieht homegrow (geld - Ruecklage) im Gang-Betrieb? Liest geldbedarf.txt,
// bn4rep.json (torRunde, gangHold) und das Konto aus Spielstaenden. homegrow kauft einen Kern bei
// frei > 1,2 x Kernpreis, eine RAM-Verdopplung bei frei > 3 x Preis (homegrow.js:79, 91, 117).
// Aufruf: node tools/audit/verify-g05-ruecklage.mjs <backups...>
import { loadSave, textFile } from "./hack-save.mjs";
import { homeRamCost, homeCoreCost } from "./verify-g05-preise.mjs";
for (const f of process.argv.slice(2)) {
  const { p, servers } = loadSave(f);
  const home = servers.home;
  const bed = Number(textFile(home, "data/geldbedarf.txt")) || 0;
  let rep = {};
  try { rep = JSON.parse(textFile(home, "data/bn4rep.json") || "{}"); } catch {}
  const frei = p.money - bed;
  const kern = home.cpuCores < 8 ? homeCoreCost(home.cpuCores) : Infinity;
  const ram = homeRamCost(home.maxRam);
  console.log(f.split("_").slice(-2).join("_"),
    "| Geld", (p.money / 1e9).toFixed(2), "Bedarf", (bed / 1e9).toFixed(2), "frei", (frei / 1e9).toFixed(2),
    "| Kern-Schwelle", (1.2 * kern / 1e9).toFixed(2), frei > 1.2 * kern ? "KAUF" : "-",
    "| RAM " + home.maxRam + " Schwelle", (3 * ram / 1e9).toFixed(2), frei > 3 * ram ? "KAUF" : "-",
    "| gangHold", rep.gangHold, "torRunde", rep.torRunde ? JSON.stringify({ mode: rep.torRunde.mode, repNeed: rep.torRunde.repNeed, cost: rep.torRunde.plan && rep.torRunde.plan.cost }) : null);
}
