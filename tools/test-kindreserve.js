/**
 * Platz fuer Kinder-Skripte (06.10.2026). Befund live 17:12: corp.js auf
 * fulcrumtech, Wirt voll mit Arbeitern, jedes Einmal-Skript "no_space", Corp
 * "blocked". Der Kern zieht jetzt fuer Registry-Eintraege mit childRamGb auf
 * deren Wirt Platz von der Arbeiterverteilung ab (und beim Start auf der
 * Werkbank). Geprueft: Quelltext des Kerns, Registry-Feld, und dass das Feld
 * das groesste corp-act-Skript deckt (RAM per tools/ram.js gerechnet).
 *
 * Gegen den alten Stand ROT. Aufruf: node tools/test-kindreserve.js [repo]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};
console.log("\n=== Platz fuer Kinder-Skripte ===\n");

const kern = fs.readFileSync(path.join(ROOT, "src", "bn4net.js"), "utf8").replace(/\r/g, "");
pruefe("Kern baut kindReserve aus childRamGb", /const kindReserve = new Map\(\);[\s\S]{0,400}childRamGb/.test(kern));
pruefe("Arbeiterverteilung zieht kindReserve ab", kern.includes("- (kindReserve.get(host) || 0);"));
pruefe("Werkbank reserviert Kinder-Platz beim Start", /if \(!\(wo && wo\.length\)\) \{[\s\S]{0,300}childRamGb[\s\S]{0,120}werkbankReserve \+= kind/.test(kern));
pruefe("Telemetrie meldet kindReserve", kern.includes("kindReserve: Object.fromEntries("));
// Nach einem Einbau (06.10. 17:20): Werkzeug auf home oder zu kleinem Wirt ->
// Reserve auf dem groessten gerooteten Nicht-home-Wirt, auf den ein Kind passt.
pruefe("Ausweich-Wirt fuer Kinder, wenn neben dem Werkzeug kein Kind passt",
  kern.includes("if (platzHier < gb) {") && kern.includes("if (kGb >= gb && kGb > altGb)"));
pruefe("home zaehlt die Steuerungsreserve mit (kein pauschaler home-Ausschluss)",
  kern.includes('? ns.getServerMaxRam(h) - reserveHome() - 16'));
pruefe("Ausweich-Wirt: auf der Werkbank zaehlt nur der Platz neben ihren Werkzeugen (07.10. BN3.3)",
  kern.includes("const kGb = ns.getServerMaxRam(k) - (k === werkbank ? werkbankReserve : 0);"));
pruefe("Werkzeug auf der Werkbank: platzHier zieht die ganze Werkbank-Reserve ab (08.10. BN3.3)",
  /: h === werkbank\s*\? ns\.getServerMaxRam\(h\) - werkbankReserve/.test(kern));
pruefe("Ausweich-Suche ueberspringt den eben verworfenen eigenen Wirt", kern.includes('if (k === "home" || k === h || k.startsWith("hacknet-server-") || !ns.hasRootAccess(k)) continue;'));
pruefe("share-Faeden, die in die Kind-Reserve ragen, werden geraeumt (08.10. BN3.3)",
  /if \(\(kindReserve\.get\(host\) \|\| 0\) > 0 && freiJetzt\(\) < 0[\s\S]{0,120}ns\.scriptKill\("worker\/share\.js", host\);\s*prozesseHier = ns\.ps\(host\);/.test(kern));
pruefe("ohne Ausweich-Wirt bleibt die Reserve auf h und wird gemeldet",
  kern.includes("else kindOhneWirt.push(e.name);") && kern.includes("      kindOhneWirt,"));

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
const corp = (reg.eintraege || reg).find((e) => e.name === "corp.js");
pruefe("corp.js hat childRamGb in der Registry", !!corp && corp.childRamGb > 0, corp ? String(corp.childRamGb) : "kein Eintrag");

// RAM per tools/ram.js (CLI; der Import zieht ramkosten.js mit argv-Annahmen).
if (corp) {
  const { execFileSync } = await import("node:child_process");
  const kinder = fs.readdirSync(path.join(ROOT, "src")).filter((d) => /^corp-(act|tick)/.test(d));
  let max = 0, wer = "";
  for (const d of kinder) {
    let gb = 0;
    try {
      const aus = execFileSync(process.execPath, [path.join(HIER, "ram.js"), d], { cwd: path.join(HIER, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const m = aus.match(/([0-9.]+) GB\s+\S*corp-/);
      gb = m ? Number(m[1]) : 0;
    } catch { gb = 0; }
    if (gb > max) { max = gb; wer = d; }
  }
  pruefe("childRamGb deckt das groesste Kind", max > 0 && corp.childRamGb >= max, wer + " " + max.toFixed(2) + " GB");
}

