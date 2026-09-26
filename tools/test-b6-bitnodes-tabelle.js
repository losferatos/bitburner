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

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
