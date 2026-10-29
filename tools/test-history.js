/**
 * sync/history.js - Verlauf fuer das Dashboard (29.10.2026).
 *
 * Prueft: Probe aus echten Feldnamen, veraltete Dateien bleiben draussen
 * (Vorknoten, Wartephase), Deckel, Takt (hoechstens alle 5 min, auch ueber
 * einen Neustart hinweg), keine Probe ohne Spiel, kaputte Datei wird
 * beiseitegelegt statt ueberschrieben, Ruecklauf der Spielzeit, Uhr
 * zurueckgestellt, atomares Schreiben ohne Restdatei.
 *
 * Aufruf: node tools/test-history.js [pfad/zu/history.js]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, "../sync/history.js");
const { buildSample, appendSample, createHistory, SAMPLE_MS } = await import(pathToFileURL(target).href);

let red = 0;
const check = (what, ok, extra = "") => {
  console.log((ok ? "  ok    " : "  ROT   ") + what + (extra ? "  (" + extra + ")" : ""));
  if (!ok) red++;
};

const RESET = 1793300365647;
const W = RESET + 3 * 3600000;
// Feldnamen wie im Spiel am 29.10.2026
const blade = (o = {}) => ({ zeit: W, nodeReset: RESET, rang: 129, chance: 0.11, aktion: "Operations/Raid", spielzeit: 6152675800, ...o });
const exit = (o = {}) => ({ zeit: W, knoten: 13, lauf: { node: 13, level: 2, verfahren: "V2" }, ...o });
const net = (o = {}) => ({ zeit: W, nodeReset: RESET, knoten: 13, geld: 1.5e9, hacking: 812, playtime: 6152670000, motorTimeMs: 11e6, ...o });

console.log("-- buildSample --");
{
  const s = buildSample(W, blade(), exit(), net());
  check("Rang und Chance", s.rank === 129 && s.chance === 0.11);
  check("Knoten und Lauf", s.node === 13 && s.level === 2 && s.method === "V2");
  check("Uhr: pt und motor aus bn4net.json", s.pt === 6152670000 && s.motor === 11e6);
  check("nodeReset in der Probe", s.nodeReset === RESET);
  check("Geld und Hacking", s.money === 1.5e9 && s.hacking === 812);
  const alt = buildSample(W, blade({ nodeReset: RESET - 86400000, rang: 4.5e6 }), exit(), net());
  check("blade.json aus dem Vorknoten: kein Rang", alt && alt.rank === null && alt.money === 1.5e9);
  const stale = buildSample(W, blade({ zeit: W - 3600000 }), exit(), net());
  check("blade.json eine Stunde alt: kein Rang", stale && stale.rank === null);
  const wart = buildSample(W, { zeit: W, nodeReset: RESET, wartend: true, tiefstand: 40 }, exit(), net());
  check("Wartephase (wartend): kein Rang, kein NaN", wart && wart.rank === null);
  const exAlt = buildSample(W, blade(), exit({ zeit: W - 3600000 }), net());
  check("ausgang.json alt: Lauf unbekannt, Knoten aus bn4net", exAlt.level === null && exAlt.node === 13);
  // Wechsel 13.2 -> 13.3: gleicher Knoten, ausgang.json noch vom Vorlauf (vor dem Knotenstart geschrieben)
  const nr2 = W - 60000;
  const wechsel = buildSample(W, blade({ nodeReset: nr2, zeit: nr2 - 1000 }), exit({ zeit: nr2 - 1000 }), net({ nodeReset: nr2 }));
  check("Laufwechsel im selben Knoten: altes ausgang.json etikettiert nicht", wechsel && wechsel.level === null);
  check("Laufwechsel: blade.json von vor dem Start zaehlt nicht", wechsel && wechsel.rank === null);
  check("ohne frische bn4net.json: keine Probe", buildSample(W, blade(), exit(), net({ zeit: W - 3600000 })) === null);
  check("ohne alles: keine Probe", buildSample(W, null, null, null) === null);
  check("Rang 0 bleibt 0, nicht null", buildSample(W, blade({ rang: 0 }), exit(), net()).rank === 0);
}

console.log("-- appendSample --");
{
  let l = [];
  for (let i = 0; i < 12; i++) l = appendSample(l, { t: i, pt: i, nodeReset: 1 }, 10);
  check("Deckel haelt die juengsten", l.length === 10 && l[0].t === 2 && l[9].t === 11);
  const back = appendSample(l, { t: 99, pt: 5, nodeReset: 1 }, 10);
  check("Spielzeit rueckwaerts: Zukunft faellt weg", back.every((s) => s.pt <= 5) && back[back.length - 1].t === 99);
  const other = appendSample(l, { t: 99, pt: 0, nodeReset: 2 }, 100);
  check("anderer Knotenlauf: nichts faellt weg", other.length === 11);
}

console.log("-- createHistory --");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hist-"));
const file = path.join(dir, "h.json");
let clock = W;
let calls = 0;
let online = true;
const request = async (method, params) => {
  calls++;
  if (!online) throw new Error("Spiel ist nicht verbunden");
  const map = { "data/blade.json": blade({ zeit: clock }), "data/ausgang.json": exit({ zeit: clock }), "data/bn4net.json": net({ zeit: clock }) };
  return JSON.stringify(map[params.filename]);
};
const logs = [];
{
  const h = createHistory({ file, request, now: () => clock, log: (t) => logs.push(t) });
  check("erste Probe wird geschrieben", await h.maybeSample() === true);
  check("Datei liegt, keine .tmp", fs.existsSync(file) && !fs.existsSync(file + ".tmp"));
  clock += 60000;
  calls = 0;
  check("nach 1 min keine zweite", await h.maybeSample() === false && calls === 0);
  clock += SAMPLE_MS;
  check("nach 6 min die zweite", await h.maybeSample() === true);
  check("zwei Proben in der Datei", (await h.readList()).length === 2);

  // Neustart: frische Instanz, juengste Probe 1 min alt
  clock += 60000;
  const h2 = createHistory({ file, request, now: () => clock });
  check("nach Neustart keine Extraprobe", await h2.maybeSample() === false);

  // Spiel weg: keine Probe, kein Absturz
  clock += SAMPLE_MS;
  online = false;
  const h3 = createHistory({ file, request, now: () => clock });
  check("ohne Spiel keine Probe", await h3.maybeSample() === false);
  check("weiter zwei Proben", (await h3.readList()).length === 2);
  online = true;

  // bn4net aus dem Zwischenspeicher der Bruecke
  clock += SAMPLE_MS;
  calls = 0;
  const h4 = createHistory({ file, request, now: () => clock, getNet: () => net({ zeit: clock, geld: 7 }) });
  check("bn4net aus dem Zwischenspeicher", await h4.maybeSample() === true && calls === 2);
  check("und der Wert stammt von dort", (await h4.readList()).slice(-1)[0].money === 7);

  // Uhr zurueckgestellt: trotzdem eine Probe
  clock -= 2 * 3600000;
  const h5 = createHistory({ file, request, now: () => clock });
  check("Uhr zurueckgestellt: Probe trotzdem", await h5.maybeSample() === true);

  // Kaputte Datei: beiseitelegen, nicht still ueberschreiben
  clock += 4 * 3600000;
  fs.writeFileSync(file, "{kaputt");
  const h6 = createHistory({ file, request, now: () => clock, log: (t) => logs.push(t) });
  check("kaputte Datei: neu begonnen", await h6.maybeSample() === true && (await h6.readList()).length === 1);
  check("und die kaputte liegt daneben", fs.readdirSync(dir).some((n) => n.includes(".corrupt-")));
  check("und es steht im Log", logs.some((t) => t.includes("beiseitegelegt")));

  // Gleichzeitige Aufrufe schreiben nur einmal
  clock += SAMPLE_MS;
  const h7 = createHistory({ file, request, now: () => clock });
  const r = await Promise.all([h7.maybeSample(), h7.maybeSample(), h7.maybeSample()]);
  check("nebenlaeufig nur eine Probe", r.filter(Boolean).length === 1 && (await h7.readList()).length === 2);

  // Gesperrte Datei (kein ENOENT, kein Parsefehler): werfen, nichts ueberschreiben
  clock += SAMPLE_MS;
  const before = fs.readFileSync(file, "utf8");
  fs.rmSync(file);
  fs.mkdirSync(file); // ein Ordner an der Stelle: readFile wirft EISDIR
  const h8 = createHistory({ file, request, now: () => clock });
  let threw = false;
  try { await h8.maybeSample(); } catch { threw = true; }
  check("Lesefehler wirft statt zu ueberschreiben", threw);
  calls = 0;
  clock += 30000;
  check("nach dem Lesefehler kein Neuversuch im 30-s-Takt", await h8.maybeSample() === false && calls === 0);
  fs.rmdirSync(file);
  fs.writeFileSync(file, before);
}
fs.rmSync(dir, { recursive: true, force: true });

console.log(red ? "ROT: " + red : "alles gruen");
process.exit(red ? 1 : 0);
