/**
 * Ebene 2: der SELBST-Neustart des Kerns und die Lebenswache in guard.js.
 *
 * WARUM (22.09.2026, BAUSTELLEN "Kaltstart: SELBST bn4net.js hat keinen
 * Rueckholer"): `SELBST bn4net.js` in data/reload.txt beendete den Kern per
 * ns.exit() und verliess sich darauf, dass popups.js oder bn4life.js ihn
 * zurueckholen. Im Kaltstart laeuft keins von beiden - am 06.09. lag der
 * Kern 20 min tot.
 *
 * Jetzt zwei Haelften, beide hier geprueft:
 *   - guard.js startet einen fehlenden Kern (0 GB extra, laeuft immer).
 *   - Der Kern beendet sich nur, wenn eine Wache laeuft; sonst verschiebt er.
 *
 * Aufruf: node tools/test-kernwache.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";
import { SRC } from "./ram.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

const REGISTRY = fs.readFileSync(path.join(SRC, "registry.json"), "utf8");
const ROUTE = fs.readFileSync(path.join(SRC, "route.json"), "utf8");
const { modul: kern } = await ladeAusBeiden(ROOT, "bn4net.js");
const { modul: waechter } = await ladeAusBeiden(ROOT, "guard.js");

console.log("");
console.log("=== SELBST-Neustart und Lebenswache ===");

const logText = (m) => JSON.stringify([m.zustand.log, m.zustand.ausgabe]);
const laeuft = (m, datei, host = "home") => {
  m.zustand.prozesse.push({ pid: 900 + m.zustand.prozesse.length, filename: datei,
    host, threads: 1, args: [], gb: 0 });
};

/** Ein Kern mit SELBST-Auftrag. */
function kernMock(o = {}) {
  const m = neuerMock({
    knoten: 10,
    geld: 1e9,
    maxSchlaf: o.maxSchlaf ?? 6,
    beiSchlaf: (ms, z, vor) => vor(Math.min(ms || 10000, 10000)),
    server: {
      home: { ram: o.homeRam ?? 1024, used: o.homeUsed ?? 10.8, root: true,
        geld: 1e9, cores: 1, ports: 0, hackLevel: 1 },
      ...(o.server || {}),
    },
  });
  m.lege("home", "registry.json", REGISTRY);
  m.lege("home", "route.json", ROUTE);
  m.lege("home", "data/verfahren.txt", "V2 10 2");
  for (const w of ["worker/hack.js", "worker/grow.js", "worker/weaken.js",
                   "worker/share.js", "worker/expfarm.js"]) m.lege("home", w, "//");
  // Keine Werkzeugdateien: sonst startet der Kern in Runde 1 selbst
  // guard.js, und der Test prueft die Wache statt den Fall ohne.
  m.lege("home", "data/reload.txt", "SELBST bn4net.js");
  // bn4-stop.txt haelt den Kern davon ab, bn4life.js selbst zu holen.
  m.lege("home", "data/bn4-stop.txt", "");
  for (const [d, h] of o.laufend || []) laeuft(m, d, h);
  return m;
}

async function fahreKern(m) {
  const zurueck = m.uhrStellen();
  try { await kern.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

console.log("");
console.log("-- keine Wache laeuft (Kaltstart): verschieben statt sterben --");
{
  const m = await fahreKern(kernMock({}));
  pruefe("der Kern lebt weiter", m.zustand.beendetSich !== true);
  pruefe("reload.txt bleibt stehen (naechste Runde fragt wieder)",
    (m.lies("home", "data/reload.txt") || "").includes("SELBST"));
  const n = (logText(m).match(/verschoben, bis eine da ist/g) || []).length;
  pruefe("und meldet es genau einmal, nicht jede Runde", n === 1, "gezaehlt " + n);
}

for (const [wache, host] of [["guard.js", "home"], ["popups.js", "home"],
                             ["bn4life.js", "home"]]) {
  console.log("");
  console.log("-- " + wache + " laeuft: beenden und quittieren --");
  const m = kernMock({ laufend: [[wache, host]] });
  // Ohne Bremse - sonst zaehlt nur popups.js (siehe unten). Dann holt der
  // Kern bn4life.js aber selbst, deshalb laeuft es in diesen Faellen mit.
  delete m.zustand.dateien?.home?.["data/bn4-stop.txt"];
  m.ns.rm("data/bn4-stop.txt", "home");
  await fahreKern(m);
  pruefe("der Kern beendet sich", m.zustand.beendetSich === true);
  pruefe("reload.txt ist quittiert", (m.lies("home", "data/reload.txt") || "") === "");
}

console.log("");
console.log("-- Bremse liegt: guard.js zaehlt nicht (holt nicht zurueck), popups.js schon --");
{
  // kernMock legt data/bn4-stop.txt ohnehin.
  const m = await fahreKern(kernMock({ laufend: [["guard.js", "home"], ["bn4life.js", "home"]] }));
  pruefe("mit guard + bn4life und Bremse: kein Ende", m.zustand.beendetSich !== true);
  const m2 = await fahreKern(kernMock({ laufend: [["popups.js", "home"]] }));
  pruefe("mit popups.js und Bremse: Ende", m2.zustand.beendetSich === true);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- queued_augs_at_jump: nur gestempelte Spruenge zaehlen --");
for (const [stempel, soll] of [[false, null], [true, 2]]) {
  const m = kernMock({ maxSchlaf: 14 });
  m.lege("home", "data/reload.txt", "");
  const daten = { von: 9, nach: 9, level: 3, wartendeAugs: 2 };
  if (stempel) daten.wartendeGeprueft = true;
  m.lege("home", "data/events.json", JSON.stringify({ schema: 1, eintraege: [
    { art: "jump", text: "exit.js gestartet", wall: Date.now() - 3600000,
      playtime: 0, motorTimeMs: 0, daten },
  ] }));
  await fahreKern(m);
  let kpi = null;
  try { kpi = JSON.parse(m.lies("home", "data/kpi.json")); } catch { kpi = null; }
  pruefe((stempel ? "gestempelt: " : "ungestempelt (Altbestand): ") + "Kennwert " + soll,
    kpi !== null && kpi.queued_augs_at_jump === soll,
    kpi ? "erhalten " + kpi.queued_augs_at_jump : "kpi.json fehlt");
}

// ---------------------------------------------------------------------------
const W0 = 1_700_000_000_000;
async function fahreWaechter(o = {}) {
  const m = neuerMock({
    host: "home",
    knoten: 10,
    // Frisch nach dem Reset: die Karenz greift - die Wache muss trotzdem.
    nodeReset: W0 - (o.seitResetMs ?? 2 * 60000),
    augReset: W0 - (o.seitResetMs ?? 2 * 60000),
    wall: W0,
    playtime: 100 * 3600000,
    maxSchlaf: o.runden ?? 3,
    beiSchlaf: (ms, z, vor) => vor(ms),
    skriptRam: { "bn4net.js": 10.8 },
    server: { home: { ram: o.homeRam ?? 32, used: o.homeUsed ?? 6.1, root: true,
      geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: {
      "guard.js": "//",
      "bn4net.js": "// Kern",
      "registry.json": JSON.stringify({ schema: 1, eintraege: [] }),
      "data/verfahren.txt": "V2 10 2",
      ...(o.dateien || {}),
    } },
  });
  for (const d of o.laufend || []) laeuft(m, d);
  const zurueck = m.uhrStellen();
  try { await waechter.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}
const kernStarts = (m) => m.zustand.gestartet.filter((g) => g.datei === "bn4net.js");

console.log("");
console.log("-- Waechter: Kern fehlt, frisch nach dem Reset (Karenz) --");
{
  const m = await fahreWaechter({});
  const k = kernStarts(m);
  pruefe("bn4net.js wird gestartet, trotz Karenz", k.length === 1, JSON.stringify(k));
  pruefe("auf home", k.length === 1 && k[0].host === "home");
  pruefe("und protokolliert", /neu gestartet/.test(m.lies("home", "data/guard-log.txt") || ""));
  const ev = JSON.parse(m.lies("home", "data/events.json") || "{\"eintraege\":[]}");
  pruefe("und steht im Ereignisprotokoll",
    ev.eintraege.some((e) => e.daten && e.daten.reason === "kern-neustart"));
}

console.log("");
console.log("-- Waechter: Kern fehlt, lange nach dem Reset --");
{
  const m = await fahreWaechter({ seitResetMs: 24 * 3600000 });
  pruefe("bn4net.js wird gestartet", kernStarts(m).length === 1);
}

console.log("");
console.log("-- Waechter: Kern laeuft - nichts tun --");
{
  const m = await fahreWaechter({ laufend: ["bn4net.js"] });
  pruefe("kein zweiter Start", kernStarts(m).length === 0);
}

console.log("");
console.log("-- Waechter: data/bn4-stop.txt bremst --");
{
  const m = await fahreWaechter({ dateien: { "data/bn4-stop.txt": "" } });
  pruefe("kein Start", kernStarts(m).length === 0);
}

console.log("");
console.log("-- Waechter: kein Platz - gedrosselt melden, weiter versuchen --");
{
  const m = await fahreWaechter({ homeUsed: 30, runden: 40 });
  const log = m.lies("home", "data/guard-log.txt") || "";
  const n = (log.match(/passt nicht auf home/g) || []).length;
  pruefe("kein Start", kernStarts(m).length === 0);
  pruefe("Meldung gedrosselt (1-2 in 40 Runden, nicht 40)", n >= 1 && n <= 2, "gezaehlt " + n);
  pruefe("versucht es jede Runde", m.zustand.abgelehnt.filter((a) => a.datei === "bn4net.js").length >= 30,
    "abgelehnt " + m.zustand.abgelehnt.filter((a) => a.datei === "bn4net.js").length);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
