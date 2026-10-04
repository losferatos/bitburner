// Audit 04.10.2026, Gegenpruefung G04 (share, HACK-1): die Bauvorgabe als
// ausfuehrbarer Beleg. Zwei KOPIEN von src/ im Scratchpad (der Lader legt
// Wegwerfdateien neben das Original - src/ im Repo bleibt unberuehrt, die
// Bruecke schiebt src/ sonst sofort ins Spiel):
//   orig  = src/ unveraendert  -> der Befund muss sich zeigen (Bug im echten Code)
//   patch = src/ + Gate        -> BN2/V2 ohne share, alle anderen Knoten wie bisher
//
// Gate (Spiegel der Bauvorgabe):
//   let bnFactionPassiveRepGain = 1;   (neben bnServerWeakenRate)
//   if (Number.isFinite(k.FactionPassiveRepGain)) bnFactionPassiveRepGain = k.FactionPassiveRepGain;
//   nach der Berechnung von repModus:
//   if (repModus && bnFactionPassiveRepGain === 0 && regLage.verfahren === "V2") repModus = false;
//
// Aufruf: node tools/audit/verify-g04-gate.mjs <scratchdir>
import fs from "node:fs";
import path from "node:path";
import { neuerMock } from "../mock/ns.js";
import { ladeSpielskript } from "../mock/lader.js";

const scratch = path.resolve(process.argv[2] || "g04-scratch");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const quelle = path.join(ROOT, "src");

function kopiere(ziel) {
  fs.rmSync(ziel, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.cpSync(quelle, ziel, { recursive: true, filter: (p) => !/\.mock-/.test(p) });
}
const origDir = path.join(scratch, "orig", "src");
const patchDir = path.join(scratch, "patch", "src");
kopiere(origDir);
kopiere(patchDir);

// --- Patch anwenden (Zeichenketten muessen GENAU einmal vorkommen) ---------
const CR = String.fromCharCode(13);
let code = fs.readFileSync(path.join(patchDir, "bn4net.js"), "utf8").split(CR + "\n").join("\n");
function ersetze(alt, neu) {
  const n = code.split(alt).length - 1;
  if (n !== 1) throw new Error("Patch-Anker nicht eindeutig (" + n + "x): " + alt.slice(0, 60));
  code = code.replace(alt, () => neu);
}
ersetze("  let bnServerWeakenRate = 1;\n", "  let bnServerWeakenRate = 1;\n  let bnFactionPassiveRepGain = 1;\n");
ersetze("      if (Number.isFinite(k.ServerWeakenRate)) bnServerWeakenRate = k.ServerWeakenRate;\n",
  "      if (Number.isFinite(k.ServerWeakenRate)) bnServerWeakenRate = k.ServerWeakenRate;\n"
  + "      if (Number.isFinite(k.FactionPassiveRepGain)) bnFactionPassiveRepGain = k.FactionPassiveRepGain;\n");
ersetze("      const shareBraucht = repModus ? ns.getScriptRam(\"worker/share.js\", \"home\") : 0;\n",
  "      // G04-GATE: Passivruf 0 (BN2) und Kampfrolle V2 -> share hat keinen Abnehmer.\n"
  + "      if (repModus && bnFactionPassiveRepGain === 0 && regLage.verfahren === \"V2\") repModus = false;\n"
  + "      const shareBraucht = repModus ? ns.getScriptRam(\"worker/share.js\", \"home\") : 0;\n");
fs.writeFileSync(path.join(patchDir, "bn4net.js"), code);

// --- Test ------------------------------------------------------------------
let gruen = 0, rot = 0;
const pruefe = (name, ok, hinweis = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
};
const tabelle = fs.readFileSync(path.join(quelle, "lib", "bitnodes.json"), "utf8");
const WALL = 1_700_000_000_000;

async function fahre(dir, knoten, verfahren, vorhandeneShareFaeden = 0) {
  const m = neuerMock({
    host: "home", wall: WALL, knoten, nodeReset: 1000, geld: 1e9, maxSchlaf: 4,
    server: {
      home: { ram: 20000, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
      expziel: { ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0, hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50 },
      geldziel: { ram: 8, used: 0, root: true, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0, hackLevel: 1, sicherheit: 20, sicherheitMin: 20, wachstum: 50 },
    },
    dateien: { home: {
      "bn4net.js": "//", "lib/bitnodes.json": tabelle,
      "data/verfahren.txt": verfahren + " " + knoten + " 1",
      "data/rep-modus.txt": "Sector-12|" + WALL,        // frisch, wie bn4rep ihn in jeder Runde schreibt
      "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//", "worker/share.js": "//", "worker/expfarm.js": "//",
    } },
    skriptRam: { "worker/hack.js": 1.75, "worker/grow.js": 1.8, "worker/weaken.js": 1.8, "worker/share.js": 4, "worker/expfarm.js": 1.75 },
  });
  if (vorhandeneShareFaeden) {
    m.zustand.prozesse.push({ pid: 9001, filename: "worker/share.js", host: "home", threads: vorhandeneShareFaeden, args: [], gb: 4 * vorhandeneShareFaeden });
    m.zustand.server.home.used += 4 * vorhandeneShareFaeden;
  }
  const modul = await ladeSpielskript(path.join(dir, "bn4net.js"));
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
  const shareStarts = m.zustand.gestartet.filter((g) => g.datei === "worker/share.js");
  const shareKills = m.zustand.getoetet.filter((g) => g.filename === "worker/share.js");
  const shareLaeuft = m.zustand.prozesse.filter((p) => p.filename === "worker/share.js").reduce((n, p) => n + p.threads, 0);
  const tel = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
  return { starts: shareStarts.reduce((n, g) => n + g.threads, 0), kills: shareKills.length, laeuft: shareLaeuft, tel, m };
}

console.log("");
console.log("=== G04 Gate: share nur mit Abnehmer (Passivruf 0 + V2) ===");
const a = await fahre(origDir, 2, "V2");
pruefe("ORIG BN2/V2, rep-modus frisch: share wird gestartet (Befund reproduziert)", a.starts > 0, "gestartet " + a.starts + " Faeden, laeuft " + a.laeuft);
const b = await fahre(patchDir, 2, "V2");
pruefe("PATCH BN2/V2: kein einziger share-Faden", b.starts === 0 && b.laeuft === 0, "gestartet " + b.starts + ", laeuft " + b.laeuft);
const c = await fahre(patchDir, 2, "V2", 300);
pruefe("PATCH BN2/V2 mit 300 laufenden share-Faeden: werden beendet, keine neuen", c.kills > 0 && c.laeuft === 0 && c.starts === 0,
  "kills " + c.kills + ", laeuft " + c.laeuft + ", gestartet " + c.starts);
const d = await fahre(patchDir, 5, "V1");
const d0 = await fahre(origDir, 5, "V1");
pruefe("PATCH BN5/V1: share unveraendert (gleiche Faedenzahl wie ORIG)", d.starts > 0 && d.starts === d0.starts, "patch " + d.starts + " / orig " + d0.starts);
const e = await fahre(patchDir, 6, "V2");
const e0 = await fahre(origDir, 6, "V2");
pruefe("PATCH BN6/V2 (Passivruf 1): share unveraendert", e.starts > 0 && e.starts === e0.starts, "patch " + e.starts + " / orig " + e0.starts);
const f = await fahre(patchDir, 2, "V1");
pruefe("PATCH BN2 aber V1 (Hackingweg, hypothetisch): share unveraendert an", f.starts > 0, "gestartet " + f.starts);
const g = await fahre(patchDir, 12, "V1");
const g0 = await fahre(origDir, 12, "V1");
pruefe("PATCH BN12/V1 (Passivruf 0,98, Stufentabelle): share unveraendert", g.starts > 0 && g.starts === g0.starts, "patch " + g.starts + " / orig " + g0.starts);
console.log("");
console.log("Telemetrie bnWerte (patch BN2):", JSON.stringify(b.tel && b.tel.bnWerte), "| shareFaeden", b.tel && b.tel.shareFaeden, "| orig shareFaeden", a.tel && a.tel.shareFaeden);
console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
