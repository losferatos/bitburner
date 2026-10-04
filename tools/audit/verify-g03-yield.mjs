// Gegenpruefung G03: Ertrag je GB*s ueber alle BN2-Spielstaende (Rate gegen Bestand,
// Spielzeit gegen Wanduhr). Ziel: ist der Durchschnittsertrag (208 $/GB*s, INFRA-1)
// ein brauchbarer Grenzertrag fuer zusaetzliches Cloud-RAM?
// Je Intervall zwischen zwei Spielstaenden desselben Knotens (moneySourceB = seit Knoten):
//   Rate = d(hackInc) / d(playtimeSinceLastBitnode),  RAM = home + Park + Fremd (Mittel)
// Dazu die Bot-Telemetrie (data/bn4net.json): effFlotte, mischung.grenz, kapFreiGb, ueberschussGb.
// Aufruf: node tools/audit/verify-g03-yield.mjs
import fs from "node:fs";
import { readSave, infraFacts } from "./infra-save.mjs";

const dir = "backups";
const files = fs.readdirSync(dir).filter((f) => /_BN2L[12]_/.test(f) && f.endsWith(".json.gz")).sort();
const rows = [];
for (const f of files) {
  let facts, servers;
  try { facts = infraFacts(dir + "/" + f); ({ servers } = readSave(dir + "/" + f)); } catch { continue; }
  const m = f.match(/_BN2L(\d)_(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)_/);
  const wall = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6])).getTime();
  let tel = null;
  const tf = servers.home.data.textFiles.data.find(([n]) => n === "data/bn4net.json");
  if (tf) { try { tel = JSON.parse((tf[1].data || tf[1]).text); } catch { /* egal */ } }
  rows.push({ f, lauf: Number(m[1]), wall, tBN: facts.sinceBitnodeH, hackInc: facts.moneySourceB.hacking || 0,
    ramHome: facts.homeRam, park: facts.purchasedRamTotal, foreign: facts.foreignRam, lvl: facts.hacking, tel,
    kind: f.match(/_(hourly|pre-\w+|connect)/)[1] });
}
console.log("Eichung Uhr: Wanduhr-Differenz gegen Spielzeit-Differenz zwischen aufeinanderfolgenden Staenden desselben Knotens");
let prev = null;
const out = [];
for (const r of rows) {
  if (prev && prev.lauf === r.lauf && r.tBN > prev.tBN) {
    const dtGame = (r.tBN - prev.tBN) * 3600;
    const dtWall = (r.wall - prev.wall) / 1000;
    const dInc = r.hackInc - prev.hackInc;
    if (dInc >= 0 && dtGame > 600) {
      const ram = (r.ramHome + r.park + r.foreign + prev.ramHome + prev.park + prev.foreign) / 2;
      out.push({ t: new Date(r.wall).toLocaleString("sv-SE").slice(5, 16), dtGame, dtWall, ratio: dtGame / dtWall,
        rate: dInc / dtGame, ram, y: dInc / dtGame / ram, lvl: r.lvl, park: r.park,
        eff: r.tel && r.tel.mischung && r.tel.mischung.effFlotte, grenz: r.tel && r.tel.mischung && r.tel.mischung.grenz,
        kapFrei: r.tel && r.tel.mischung && r.tel.mischung.kapFreiGb, ueb: r.tel && r.tel.mischung && r.tel.mischung.ueberschussGb });
    }
  }
  prev = r;
}
console.log("Zeit(Stand)  dtGame/dtWall  Lvl  RAM(GB)  Park  Rate($/s)  Ertrag($/GB*s)  effFlotte  grenz(1k,4k,16k)  kapFrei  ueberschuss");
for (const o of out) {
  console.log(o.t, " ", (o.dtGame / o.dtWall).toFixed(3), " ", o.lvl, " ", o.ram.toFixed(0), " ", o.park, " ", o.rate.toFixed(0), " ",
    o.y.toFixed(1), " ", o.eff, " ", JSON.stringify(o.grenz), " ", o.kapFrei, " ", o.ueb);
}
// HINWEIS: Eine Log-Regression ln(Ertrag) ~ ln(RAM) + ln(Level) ueber alle Intervalle wurde gerechnet und VERWORFEN
// (b = -2,6: unsinnig, weil Intervalle nach Einbau/Sprung im Anlauf liegen und RAM, Level und Anlauf kollinear sind).
// Grenz- gegen Durchschnittsertrag wird stattdessen aus (a) der Bot-Telemetrie grenz/effFlotte und (b) dem Fenster W2
// (Ertrag je GB steigt mit Park und Level) beurteilt - siehe verify-g03-beide.md Abschnitt 4.
