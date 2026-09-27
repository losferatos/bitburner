/**
 * Ebene 0: B6 (Audit 26.09.2026, 2#6 / 1#4) - der Generator darf
 * BN12-Ausdruecke und negative Literale nicht mehr verwerfen.
 *
 * DER BEFUND: tools/bitnodes-tabelle.js las Knotenfelder mit der Regex
 * `\w+\s*:\s*([\d.]+)\s*,`. Das faengt zwei Faelle nicht:
 *   - negative Literale ("StaneksGiftExtraSize: -6,") - das Minuszeichen
 *     fehlte im Zeichensatz.
 *   - BN12s Felder, die auf lokale Konstanten `inc`/`dec` zeigen statt auf
 *     eine Zahl ("ScriptHackMoney: dec,") - eine Regex auf Zahlen sieht
 *     einen Bezeichner nicht als Zahl an und liess das Feld komplett weg.
 * Damit fehlten in `src/lib/bitnodes.json` fuer BN12 fast alle Felder
 * (ScriptHackMoney, ServerGrowthRate, ServerWeakenRate, HackExpGain, ...),
 * und ein Leser, der ein fehlendes Feld als 1 liest, rechnete in BN12 mit
 * den falschen Standardwerten statt mit 0,98 (Stufe 1) bis 0,94 (Stufe 3).
 *
 * NACHTRAG Skeptiker B (Einwaende 4, 5, 10): Die Nachbildung allein hat den
 * Rueckfall der Regeneration nicht gesehen - in der echten BitNode.tsx steht
 * vor `ServerStartingSecurity: 1.5` (BN12) ein Kommentar MIT KOMMA, der das
 * Feld zerschnitt; die Tabelle verlor es still. Deshalb jetzt zusaetzlich:
 *   - die Nachbildung traegt genau diesen Kommentar,
 *   - der echte Generator laeuft gegen die ECHTE reference/bitburner-src
 *     (gesucht im Repo und in der Hauptarbeitskopie; fehlt sie, wird das
 *     laut als UEBERSPRUNGEN gemeldet), und eine unabhaengige, zeilenweise
 *     Gegenprobe vergleicht jedes Literal jedes Knotens,
 *   - die eingecheckte src/lib/bitnodes.json wird gegen die Spielformel fuer
 *     BN12 (1,02^-Stufe) und gegen ServerStartingSecurity geprueft - das geht
 *     immer, auch ohne Referenz,
 *   - der Laufzeitleser (bn4net.js) wird im Mock in BN12 Stufe 3 gefahren und
 *     muss 0,9423 statt des Stufe-1-Werts 0,9804 nehmen.
 *
 * DIESER TEST baut eine kleine, echte Kopie von `BitNode.tsx` und
 * `BitNodeMultipliers.ts` nach (nicht die echten Dateien - die liegen
 * ausserhalb des Worktrees unter reference/bitburner-src, siehe
 * tools/bitnodes-tabelle.js-Kopfkommentar) und laesst den ECHTEN
 * Generator darueber laufen, in einer Wegwerf-Kopie des tools-Ordners
 * (das Skript loest seinen Referenzpfad relativ zu seinem eigenen
 * Dateiort auf - eine Wegwerf-Kopie ist deshalb der einzige Weg, es mit
 * einer Test-Referenz statt der echten laufen zu lassen).
 *
 * Aufruf: node tools/test-b6-bitnodes-tabelle.js
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

console.log("");
console.log("=== Ebene 0: B6 - bitnodes-tabelle.js gegen eine Test-Referenz ===");

// Eine stark verkuerzte, aber STRUKTURELL ECHTE Nachbildung des Musters aus
// BitNodeMultipliers.ts und BitNode.tsx - genug Felder, um Standard,
// negative Literale und den BN12-Fall (inc/dec) zu pruefen.
const MULTS_TS = `
class BitNodeMultipliers {
  ScriptHackMoney = 1;
  ServerGrowthRate = 1;
  ServerWeakenRate = 1;
  HackingLevelMultiplier = 1;
  StaneksGiftExtraSize = 1;
  DaedalusAugsRequirement = 30;
  ServerStartingSecurity = 1;
}
`;

// Leere Fuellknoten, nur damit der Plausibilitaetswaechter "gefunden < 10"
// des echten Generators nicht anschlaegt - der prueft, ob das Fall-Muster
// in BitNode.tsx ueberhaupt noch gefunden wird, und ist fuer diesen Test
// kein Pruefgegenstand.
const FUELLKNOTEN = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => `
    case ${n}: { return new BitNodeMultipliers({}); }`).join("\n");

const BITNODE_TSX = `
export function getBitNodeMultipliers(n, lvl) {
  switch (n) {
    case 2: {
      return new BitNodeMultipliers({
        ScriptHackMoney: 0.8,
        StaneksGiftExtraSize: -6,
      });
    }
    ${FUELLKNOTEN}
    case 12: {
      const inc = Math.pow(1.02, lvl);
      const dec = 1 / inc;
      return new BitNodeMultipliers({
        DaedalusAugsRequirement: Math.floor(Math.min(defaultMultipliers.DaedalusAugsRequirement + inc, 40)),
        ScriptHackMoney: dec,
        ServerGrowthRate: dec,
        ServerWeakenRate: dec,
        HackingLevelMultiplier: dec,

        //Does not scale, otherwise security might start at 300+
        ServerStartingSecurity: 1.5,
      });
    }
    default: {
      return new BitNodeMultipliers({});
    }
  }
}
`;

function baueWegwerfKopie() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "b6-test-"));
  fs.mkdirSync(path.join(tmp, "tools"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "reference", "bitburner-src", "src", "BitNode"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "src", "lib"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "tools", "bitnodes-tabelle.js"),
    path.join(tmp, "tools", "bitnodes-tabelle.js"));
  fs.writeFileSync(
    path.join(tmp, "reference", "bitburner-src", "src", "BitNode", "BitNodeMultipliers.ts"),
    MULTS_TS, "utf8");
  fs.writeFileSync(
    path.join(tmp, "reference", "bitburner-src", "src", "BitNode", "BitNode.tsx"),
    BITNODE_TSX, "utf8");
  return tmp;
}

console.log("");
console.log("-- der echte Generator laeuft gegen die Test-Referenz durch --");
let ausgabe = null;
let tmp = null;
try {
  tmp = baueWegwerfKopie();
  const stdout = execFileSync(process.execPath, [path.join(tmp, "tools", "bitnodes-tabelle.js")],
    { cwd: tmp, encoding: "utf8" });
  pruefe("der Generator bricht NICHT ab (Exit 0)", true);
  console.log(stdout.trim().split("\n").map((z) => "       " + z).join("\n"));
  const roh = fs.readFileSync(path.join(tmp, "src", "lib", "bitnodes.json"), "utf8");
  ausgabe = JSON.parse(roh);
} catch (e) {
  pruefe("der Generator bricht NICHT ab (Exit 0)", false,
    "stdout/stderr: " + (e.stdout || "") + (e.stderr || "") + String(e.message || e));
}

if (ausgabe) {
  console.log("");
  console.log("-- negative Literale kommen an (Regex-Fix) --");
  pruefe("BN2.StaneksGiftExtraSize ist -6, nicht weggelassen",
    ausgabe.knoten["2"] && ausgabe.knoten["2"].StaneksGiftExtraSize === -6,
    "erhalten: " + JSON.stringify(ausgabe.knoten["2"]));

  console.log("");
  console.log("-- BN12 (inc/dec) wird je Stufe ausgewertet --");
  const k12 = ausgabe.knoten["12"];
  pruefe("BN12 hat ScriptHackMoney im flachen Eintrag (Stufe 1)",
    k12 && Number.isFinite(k12.ScriptHackMoney), "erhalten: " + JSON.stringify(k12));
  pruefe("BN12 Stufe 1 ScriptHackMoney = 1/1.02 (dec bei lvl=1)",
    k12 && Math.abs(k12.ScriptHackMoney - 1 / 1.02) < 1e-9,
    "erhalten " + (k12 && k12.ScriptHackMoney));

  const kl12 = ausgabe.knotenLevel && ausgabe.knotenLevel["12"];
  pruefe("knotenLevel[12] traegt die Stufen 1, 2, 3",
    kl12 && ["1", "2", "3"].every((s) => s in kl12), "erhalten: " + JSON.stringify(kl12));
  if (kl12) {
    for (const [lvl, soll] of [[1, 1 / 1.02], [2, 1 / Math.pow(1.02, 2)], [3, 1 / Math.pow(1.02, 3)]]) {
      const ist = kl12[String(lvl)].ScriptHackMoney;
      pruefe("Stufe " + lvl + ": ScriptHackMoney = 1/1.02^" + lvl,
        Math.abs(ist - soll) < 1e-9, "ist=" + ist + " soll=" + soll);
    }
    // Eichpunkt gegen die echte Audit-Rechnung (2#6/1#4): Stufe 3 = 0,9423.
    pruefe("Stufe 3 trifft den im Audit genannten Wert 0,9423 (auf 4 Nachkommastellen)",
      Math.abs(kl12["3"].ScriptHackMoney - 0.9423) < 5e-5,
      "erhalten " + kl12["3"].ScriptHackMoney);
  }
  pruefe("BN12 ServerStartingSecurity 1.5 hinter einem Kommentar mit Komma kommt an",
    k12 && k12.ServerStartingSecurity === 1.5 && kl12 && kl12["3"].ServerStartingSecurity === 1.5,
    "flach " + (k12 && k12.ServerStartingSecurity));
  pruefe("DaedalusAugsRequirement (verschachtelter Ausdruck mit eigenem Komma) wird ausgewertet",
    kl12 && kl12["1"].DaedalusAugsRequirement === Math.floor(Math.min(30 + 1.02, 40)),
    "erhalten " + (kl12 && kl12["1"].DaedalusAugsRequirement));
}

console.log("");
console.log("-- ein nicht-literales Feld in einem ANDEREN Knoten bricht laut ab --");
{
  let tmp2 = null;
  try {
    tmp2 = baueWegwerfKopie();
    const kaputterBitnode = BITNODE_TSX.replace(
      "ScriptHackMoney: 0.8,",
      "ScriptHackMoney: someUnknownExpr,");
    fs.writeFileSync(
      path.join(tmp2, "reference", "bitburner-src", "src", "BitNode", "BitNode.tsx"),
      kaputterBitnode, "utf8");
    let exitCode = 0;
    let stdout = "";
    try {
      stdout = execFileSync(process.execPath, [path.join(tmp2, "tools", "bitnodes-tabelle.js")],
        { cwd: tmp2, encoding: "utf8" });
    } catch (e) {
      exitCode = e.status ?? 1;
      stdout = (e.stdout || "") + (e.stderr || "");
    }
    pruefe("Exit-Code ungleich 0", exitCode !== 0, "erhalten " + exitCode);
    pruefe("die Meldung nennt ABBRUCH", /ABBRUCH/.test(stdout), stdout);
    const zielDatei = path.join(tmp2, "src", "lib", "bitnodes.json");
    pruefe("bitnodes.json wird NICHT geschrieben", !fs.existsSync(zielDatei));
  } finally {
    if (tmp2) fs.rmSync(tmp2, { recursive: true, force: true });
  }
}

if (tmp) fs.rmSync(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// Gegen die ECHTE Spielquelle
// ---------------------------------------------------------------------------
const ERWARTUNG12 = (lvl) => 1 / Math.pow(1.02, lvl);
const echteRef = [
  path.join(ROOT, "reference", "bitburner-src", "src", "BitNode"),
  // Worktree unter .claude/worktrees/<name>: die Hauptarbeitskopie drei hoeher.
  path.resolve(ROOT, "..", "..", "..", "reference", "bitburner-src", "src", "BitNode"),
].find((d) => fs.existsSync(path.join(d, "BitNode.tsx")) && fs.existsSync(path.join(d, "BitNodeMultipliers.ts")));

/** Unabhaengige Gegenprobe: jede Zeile "Name: Zahl," je case-Block. */
function literaleJeKnoten(tsx) {
  const aus = {};
  const body = tsx.slice(tsx.indexOf("export function getBitNodeMultipliers"));
  for (const [, n, block] of body.matchAll(/case (\d+): \{([\s\S]*?)\n    \}/g)) {
    aus[n] = {};
    for (const [, f, w] of block.matchAll(/^\s*(\w+):\s*(-?[\d.]+),?\s*$/gm)) aus[n][f] = Number(w);
  }
  return aus;
}

console.log("");
console.log("-- der echte Generator gegen die echte reference/bitburner-src --");
if (!echteRef) {
  console.log("  UEBERSPRUNGEN: reference/bitburner-src nicht gefunden (Repo und Hauptarbeitskopie).");
  console.log("  Holen: siehe tools/bitnodes-tabelle.js, Kopfkommentar.");
} else {
  let tmp3 = null;
  try {
    tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), "b6-echt-"));
    fs.mkdirSync(path.join(tmp3, "tools"), { recursive: true });
    fs.mkdirSync(path.join(tmp3, "reference", "bitburner-src", "src", "BitNode"), { recursive: true });
    fs.mkdirSync(path.join(tmp3, "src", "lib"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "tools", "bitnodes-tabelle.js"), path.join(tmp3, "tools", "bitnodes-tabelle.js"));
    for (const d of ["BitNode.tsx", "BitNodeMultipliers.ts"]) {
      fs.copyFileSync(path.join(echteRef, d), path.join(tmp3, "reference", "bitburner-src", "src", "BitNode", d));
    }
    let lauf = null;
    try {
      execFileSync(process.execPath, [path.join(tmp3, "tools", "bitnodes-tabelle.js")], { cwd: tmp3, encoding: "utf8" });
      lauf = JSON.parse(fs.readFileSync(path.join(tmp3, "src", "lib", "bitnodes.json"), "utf8"));
    } catch (e) {
      pruefe("Generator laeuft gegen die echte Quelle durch", false, (e.stdout || "") + String(e.message || e));
    }
    if (lauf) {
      const quelle = literaleJeKnoten(fs.readFileSync(path.join(echteRef, "BitNode.tsx"), "utf8"));
      const fehlt = [];
      for (const [n, felder] of Object.entries(quelle)) {
        for (const [f, w] of Object.entries(felder)) {
          if (!(f in lauf.standard)) continue;
          const ist = (lauf.knoten[n] || {})[f];
          if (ist !== w) fehlt.push("BN" + n + " " + f + " soll " + w + " ist " + ist);
        }
      }
      pruefe("jedes Literal jedes Knotens der echten BitNode.tsx steht in der Tabelle ("
        + Object.values(quelle).reduce((a, x) => a + Object.keys(x).length, 0) + " Zeilen)",
        fehlt.length === 0, fehlt.slice(0, 5).join("; "));
      const eingecheckt = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "bitnodes.json"), "utf8"));
      pruefe("die eingecheckte src/lib/bitnodes.json ist genau diese Erzeugung",
        JSON.stringify({ ...eingecheckt, erzeugtAm: 0 }) === JSON.stringify({ ...lauf, erzeugtAm: 0 }),
        "neu erzeugen: node tools/bitnodes-tabelle.js");
    }
  } finally {
    if (tmp3) fs.rmSync(tmp3, { recursive: true, force: true });
  }
}

console.log("");
console.log("-- die eingecheckte Tabelle gegen die Spielformel (immer) --");
{
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "bitnodes.json"), "utf8"));
  const k12 = t.knoten["12"] || {};
  pruefe("BN12 ServerStartingSecurity = 1.5 (BitNode.tsx, 'Does not scale')", k12.ServerStartingSecurity === 1.5,
    "ist " + k12.ServerStartingSecurity);
  const kl = (t.knotenLevel || {})["12"] || {};
  for (const lvl of [1, 2, 3]) {
    const st = kl[String(lvl)] || {};
    const ok = ["ScriptHackMoney", "ServerGrowthRate", "ServerWeakenRate", "HackExpGain"]
      .every((f) => Math.abs((st[f] ?? NaN) - ERWARTUNG12(lvl)) < 1e-12);
    pruefe("BN12 Stufe " + lvl + ": ScriptHackMoney/ServerGrowthRate/ServerWeakenRate/HackExpGain = 1,02^-" + lvl,
      ok, JSON.stringify({ shm: st.ScriptHackMoney, sgr: st.ServerGrowthRate }));
  }
  pruefe("BN5 unveraendert: ScriptHackMoney 0.15, ServerStartingSecurity 2",
    t.knoten["5"] && t.knoten["5"].ScriptHackMoney === 0.15 && t.knoten["5"].ServerStartingSecurity === 2);
}

// ---------------------------------------------------------------------------
// Der Laufzeitleser: bn4net.js im Mock, BN12 Stufe 3 (SF12 auf 2)
// ---------------------------------------------------------------------------
console.log("");
console.log("-- bn4net.js liest die Stufe (BN12.3) statt des flachen Stufe-1-Werts --");
{
  const { neuerMock } = await import("./mock/ns.js");
  const { ladeAusBeiden } = await import("./mock/lader.js");
  const tabelle = fs.readFileSync(path.join(ROOT, "src", "lib", "bitnodes.json"), "utf8");
  const fahre = async (knoten, ownedSF) => {
    const m = neuerMock({
      host: "home", wall: 1_700_000_000_000, knoten, nodeReset: 1000, geld: 1e9, maxSchlaf: 1, ownedSF,
      server: { home: { ram: 4096, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
      dateien: { home: { "bn4net.js": "//", "lib/bitnodes.json": tabelle, "data/verfahren.txt": "V1 " + knoten + " 1",
        "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//", "worker/share.js": "//" } },
    });
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
    const tel = JSON.parse(m.lies("home", "data/bn4net.json") || "null");
    return tel && tel.bnWerte ? tel.bnWerte : null;
  };
  const w123 = await fahre(12, new Map([[12, 2], [1, 3]]));
  pruefe("BN12 mit SF12.2 (Stufe 3): ScriptHackMoney 0,9423",
    w123 && Math.abs(w123.scriptHackMoney - ERWARTUNG12(3)) < 1e-12, JSON.stringify(w123));
  const w121 = await fahre(12, new Map([[1, 3]]));
  pruefe("BN12 ohne SF12 (Stufe 1): ScriptHackMoney 0,9804",
    w121 && Math.abs(w121.scriptHackMoney - ERWARTUNG12(1)) < 1e-12, JSON.stringify(w121));
  const w5 = await fahre(5, new Map([[5, 1], [1, 3]]));
  pruefe("BN5 (keine Stufentabelle): ScriptHackMoney 0,15 wie bisher",
    w5 && w5.scriptHackMoney === 0.15, JSON.stringify(w5));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
