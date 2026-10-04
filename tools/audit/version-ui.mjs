// VERSION-UI (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Der Bot steuert Teile des Spiels ueber die Oberflaeche (DOM): Knoepfe nach Beschriftung suchen, Dialoge nach
// Text schliessen, Seiten nach Ueberschrift erkennen (join.js, travel.js, buyaugs.js, homeram.js, popups.js, ...).
// Solche Texte stammen aus dem Spielquelltext (*.tsx). Dieses Werkzeug zieht aus den DOM-treibenden Dateien alle
// Zeichenketten- und Regex-Literale (acorn), die wie Oberflaechentexte aussehen, und sucht jedes im Quelltext der
// LAUFENDEN Fassung (reference/v301) und der dev-Fassung (reference/bitburner-src):
//   GLEICH      in beiden gefunden             -> ueberlebt das Update
//   NUR LIVE    nur in v301 gefunden           -> BRICHT, sobald das Spiel auf 3.0.2 wechselt
//   NUR DEV     nur in dev gefunden            -> Bot-Text stammt aus dev (waere im LAUFENDEN Spiel falsch)
//   KEINER      in keiner Fassung              -> bot-eigener Text oder anders zusammengesetzt (nicht beurteilbar)
// Regex-Literale werden gegen die Zeilen geprueft, nicht als Teilstring.
//
// Eichung (SELBSTPROBE): "Opened SSH Port(22)!" (nur v301, dev schreibt "Port (22)") MUSS NUR LIVE sein;
// "Opened SSH Port (22)!" MUSS NUR DEV sein; "Opened FTP Port (21)!" MUSS GLEICH sein.
//
// Aufruf: node tools/audit/version-ui.mjs [--alle]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const SRC = path.join(ROOT, "src");
const LIVE = path.join(ROOT, "reference", "v301", "src");
const DEV = path.join(ROOT, "reference", "bitburner-src", "src");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);
const ALLE = process.argv.includes("--alle");

function walk(dir, rel = "", out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(dir, r, out);
    else if (/\.(ts|tsx|json|md)$/.test(r)) out.push(r);
  }
  return out;
}
function lade(dir) {
  const teile = [];
  for (const f of walk(dir)) {
    if (/\.d\.ts$/.test(f) || f.startsWith("Documentation/") || f.startsWith("Achievements/")) continue;
    // Texte in JSX stehen oft auf mehreren Zeilen / mit HTML-Entities
    teile.push(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  const gross = teile.join("\n");
  const normal = gross.replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
  return { gross, normal, zeilen: gross.split("\n") };
}
const live = lade(LIVE);
const dev = lade(DEV);

const DOM_DATEIEN = ["autopilot.js", "backdoor.js", "bitverse.js", "buyaugs.js", "buyone.js", "darkweb.js", "donate.js", "exploit3.js",
  "exportbonus.js", "hacktimer.js", "hand.js", "homeram.js", "install.js", "join.js", "keepalive.js", "popups.js", "probe.js", "probe2.js",
  "probe3.js", "sonde.js", "stockaccess.js", "stopnight.js", "stopwork.js", "torprobe.js", "travel.js", "work.js"];

function textArt(s) {
  if (s.length < 4 || s.length > 70) return false;
  if (/^[a-z0-9_./\-]+\.(js|json|txt|ts)$/.test(s)) return false; // Dateipfade
  if (/^(data|lib|worker)\//.test(s)) return false;
  if (!/[A-Za-z]{3}/.test(s)) return false;
  if (/^[a-z]+([A-Z][a-z]+)*$/.test(s) && !/\s/.test(s)) return false; // camelCase-Bezeichner
  if (/^[a-z_]+$/.test(s)) return false;
  return /\s/.test(s) || /^[A-Z]/.test(s) || /[!?:.]$/.test(s);
}
function sammle(code) {
  const out = [];
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true }); } catch { return out; }
  const walkN = (n) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Literal") {
      if (typeof n.value === "string" && textArt(n.value)) out.push({ art: "str", wert: n.value, zeile: n.loc.start.line });
      else if (n.regex) out.push({ art: "re", wert: n.regex.pattern, flags: n.regex.flags, zeile: n.loc.start.line });
    } else if (n.type === "TemplateLiteral" && n.expressions.length === 0) {
      const v = n.quasis[0].value.cooked;
      if (textArt(v)) out.push({ art: "str", wert: v, zeile: n.loc.start.line });
    }
    for (const k of Object.keys(n)) {
      if (k === "loc") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walkN); else if (v && typeof v.type === "string") walkN(v);
    }
  };
  walkN(ast);
  return out;
}
function suche(korpus, eintrag) {
  if (eintrag.art === "str") {
    const s = eintrag.wert.replace(/\s+/g, " ");
    return korpus.normal.includes(s) || korpus.gross.includes(eintrag.wert);
  }
  try {
    const re = new RegExp(eintrag.wert, eintrag.flags.replace(/[gy]/g, ""));
    return korpus.zeilen.some((z) => re.test(z));
  } catch { return null; }
}

// Selbstprobe
{
  const t = (wert) => ({ live: suche(live, { art: "str", wert }), dev: suche(dev, { art: "str", wert }) });
  const a = t("Opened SSH Port(22)!"), b = t("Opened SSH Port (22)!"), c = t("Opened FTP Port (21)!");
  const ok = a.live && !a.dev && !b.live && b.dev && c.live && c.dev;
  console.log("SELBSTPROBE: " + (ok ? "OK" : "FEHLER " + JSON.stringify({ a, b, c })));
  if (!ok) process.exit(2);
}

const bericht = { GLEICH: 0, "NUR LIVE": [], "NUR DEV": [], KEINER: 0, regexUnklar: 0 };
const proDatei = {};
for (const f of DOM_DATEIEN) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) continue;
  const funde = sammle(fs.readFileSync(p, "utf8"));
  const gesehen = new Set();
  for (const e of funde) {
    const key = e.art + ":" + e.wert;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    const l = suche(live, e), d = suche(dev, e);
    if (l === null || d === null) { bericht.regexUnklar++; continue; }
    let st = "KEINER";
    if (l && d) st = "GLEICH"; else if (l && !d) st = "NUR LIVE"; else if (!l && d) st = "NUR DEV";
    if (st === "GLEICH" || st === "KEINER") bericht[st]++;
    else bericht[st].push({ datei: f, zeile: e.zeile, art: e.art, wert: e.wert });
    (proDatei[f] = proDatei[f] || { GLEICH: 0, "NUR LIVE": 0, "NUR DEV": 0, KEINER: 0 })[st]++;
  }
}
console.log("Literale (eindeutig je Datei): GLEICH " + bericht.GLEICH + ", NUR LIVE " + bericht["NUR LIVE"].length + ", NUR DEV " + bericht["NUR DEV"].length + ", KEINER " + bericht.KEINER + ", Regex nicht auswertbar " + bericht.regexUnklar);
console.log("\nJe Datei:");
for (const [f, v] of Object.entries(proDatei)) console.log("  " + f.padEnd(16) + JSON.stringify(v));
console.log("\nNUR LIVE (bricht beim Wechsel auf dev):");
for (const e of bericht["NUR LIVE"]) console.log("  " + e.datei + ":" + e.zeile + "  [" + e.art + "] " + JSON.stringify(e.wert));
console.log("\nNUR DEV (Bot-Text stammt aus dev, im laufenden Spiel nicht vorhanden):");
for (const e of bericht["NUR DEV"]) console.log("  " + e.datei + ":" + e.zeile + "  [" + e.art + "] " + JSON.stringify(e.wert));
