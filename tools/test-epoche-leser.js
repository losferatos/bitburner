/**
 * Ebene 2: die Epochen-Leser in ausgang.js und exit.js (Skeptiker 14.11.2026).
 *
 * WAS DIESER TEST BEWEIST
 * Die Uebergabe haette FERTIG gemeldet, obwohl ausgang.js und exit.js noch fest
 * route.json (Lauf 1) lasen - der Bot waere in BN4.1 nach BN10 gesprungen
 * (nicht umkehrbar). Der Nachweis hier ist ein FUNKTIONSNACHWEIS: die echten
 * Skripte laufen im Mock, die Routenwahl wird ueber das beobachtbare Ergebnis
 * geprueft (Zeile in data/exit.txt, data/verfahren.txt, data/ausgang.json) -
 * nicht ueber einen Textvergleich im Quelltext.
 *
 * Geprueft wird
 *   1. Lauf-1-Lage (BN8.3, route.json): dasselbe Ziel wie planeRoute auf
 *      route.json, mit und ohne leere/fehlende epoche.json (BITGLEICH).
 *   2. Frischer Stand OHNE epoche.json: KEIN Sprung (BN1.1 und BN4.1).
 *   3. Epoche lauf2: BN1.1 -> Ziel 4, BN4.1/4.2 -> 4, BN4.3 -> 1; BN10 abgelehnt.
 *   4. Unbekannte/kaputte Epoche: kein Sprung.
 *   5. exit.js auf einem Fremdrechner: holt Epoche und Route von home; eine alte
 *      Kopie auf dem Wirt zaehlt nicht, wenn home keine Epochendatei hat.
 *   6. ausgang.js: Verfahren aus der Epochenroute (BN4.1 lauf2 -> V1), und die
 *      Route von Lauf 1 im frischen Stand wird abgelehnt (kein verfahren.txt).
 *   7. lauf2-uebergabe.js: pruefeLeser meldet fehlende Leser, der echte Stand ist ok.
 *
 * Aufruf: node --import file:///.../tools/cpu.mjs tools/test-epoche-leser.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";
import { pruefeLeser } from "./lauf2-uebergabe.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, ok, hinweis = "") {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; fehler.push(name + (hinweis ? " - " + hinweis : "")); console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
}

const lies = (rel) => fs.readFileSync(path.join(SRC, rel), "utf8");
const ROUTE1 = lies("route.json");
const ROUTE2 = lies("route-lauf2.json");
const R = await import(pathToFileURL(path.join(SRC, "lib", "route.js")).href);
const exitModul = await ladeSpielskript(path.join(SRC, "exit.js"));
const ausgangModul = await ladeSpielskript(path.join(SRC, "ausgang.js"));

const EPOCHE_LAUF2 = JSON.stringify({ epoche: "lauf2" });

function dateienHome(extra = {}) {
  return { "route.json": ROUTE1, "route-lauf2.json": ROUTE2, ...extra };
}

/** Laeuft exit.js mit --pruefen und liefert die Zeile aus data/exit.txt. */
async function fahreExit({ knoten, sf, ziel, home = {}, host = "home", wirt = {} }) {
  const m = neuerMock({ knoten, ownedSF: new Map(Object.entries(sf).map(([k, v]) => [Number(k), v])),
    host, args: [ziel, "--pruefen"], maxSchlaf: 3 });
  for (const [d, i] of Object.entries(dateienHome(home))) m.lege("home", d, i);
  if (host !== "home") for (const [d, i] of Object.entries(wirt)) m.lege(host, d, i);
  const zurueck = m.uhrStellen();
  try { await exitModul.main(m.ns); } catch (e) { /* Mock-Grenze reicht */ } finally { zurueck(); }
  return (m.lies("home", "data/exit.txt") || m.lies(host, "data/exit.txt") || "");
}

/** Laeuft ausgang.js eine Runde; liefert verfahren.txt und ausgang.json. */
async function fahreAusgang({ knoten, sf, home = {} }) {
  const m = neuerMock({ knoten, ownedSF: new Map(Object.entries(sf).map(([k, v]) => [Number(k), v])),
    maxSchlaf: 1, beiSchlaf: (ms, z, vor) => vor(ms) });
  for (const [d, i] of Object.entries(dateienHome(home))) m.lege("home", d, i);
  const zurueck = m.uhrStellen();
  try { await ausgangModul.main(m.ns); } catch (e) { /* Mock-Grenze reicht */ } finally { zurueck(); }
  let aj = {};
  try { aj = JSON.parse(m.lies("home", "data/ausgang.json") || "{}"); } catch { aj = {}; }
  return { verfahren: (m.lies("home", "data/verfahren.txt") || "").trim(), ausgang: aj, mock: m,
    protokoll: m.lies("home", "data/ausgang.txt") || "" };
}

const erlaubt = (t) => /Ziel geprueft/.test(t);
const abgelehnt = (t) => /SPRUNG ABGELEHNT/.test(t);

console.log("");
console.log("=== Ebene 2: Epochen-Leser in exit.js / ausgang.js ===");

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 1. Lauf-1-Lage bitgleich zu route.json --");
{
  // Zustaende entlang der echten Lauf-1-Route: SF am Routenanfang (BN10.2:
  // SF1/4/5/6/10 je 1), danach je Eintrag die SF-Stufe nachgefuehrt. An jedem
  // vierten Eintrag (und am letzten) wird verglichen.
  const r1 = JSON.parse(ROUTE1).route;
  const sf = { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 };
  let geprueft = 0;
  for (let k = 0; k < r1.length; k++) {
    const e = r1[k];
    if (k % 4 === 0 || k === r1.length - 1) {
      const plan = R.planeRoute(r1, e.node, sf, (d) => d in dateienHome());   // wie das Spiel: braucht = Datei auf home
      const z = plan.ziel ? plan.ziel.node : null;
      if (z !== null) {
        geprueft++;
        for (const [name, ep] of [["ohne epoche.json", {}], ["leere epoche.json", { "epoche.json": "" }], ["epoche lauf1", { "epoche.json": '{"epoche":"lauf1"}' }]]) {
          const t = await fahreExit({ knoten: e.node, sf, ziel: z, home: ep });
          pruefe("Lauf 1, Eintrag " + k + " (BN" + e.node + "." + e.level + ") " + name + ": Ziel " + z + " geprueft", erlaubt(t), t.split(/\r?\n/).slice(-2).join(" | "));
        }
        const f = await fahreExit({ knoten: e.node, sf, ziel: z === 10 ? 9 : 10 });
        pruefe("Lauf 1, Eintrag " + k + ": falsches Ziel abgelehnt", abgelehnt(f) || z === (z === 10 ? 9 : 10));
        const a = await fahreAusgang({ knoten: e.node, sf });
        const erwartet = plan.verfahren + " " + e.node + " " + (plan.lauf ? plan.lauf.level : "0");
        pruefe("Lauf 1, Eintrag " + k + ": ausgang.js Verfahren " + erwartet, a.verfahren === erwartet, JSON.stringify(a.verfahren));
      }
    }
    sf[e.node] = Math.max(sf[e.node] || 0, e.level);
  }
  pruefe("mindestens 8 Lauf-1-Lagen verglichen", geprueft >= 8, String(geprueft));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 2. Frischer Stand OHNE epoche.json: KEIN Sprung --");
for (const [knoten, sf, label] of [[1, {}, "BN1.1 (keine SF)"], [4, { 1: 1 }, "BN4.1 nach BN1.1"], [4, { 1: 1, 4: 1 }, "BN4.2"], [4, { 1: 1, 4: 2 }, "BN4.3"]]) {
  for (const ziel of [4, 10, 1]) {
    const t = await fahreExit({ knoten, sf, ziel });
    pruefe(label + ", Ziel " + ziel + ": abgelehnt (Lauf-1-Route gilt dort nicht)", abgelehnt(t) && !erlaubt(t), t.split("\n").slice(-1)[0]);
  }
  const a = await fahreAusgang({ knoten, sf });
  pruefe(label + ": ausgang.js laedt keine Route (kein Ausgang), meldet den Grund",
    a.verfahren === "" && /Route nicht ladbar/.test(a.protokoll), a.protokoll.split(/\r?\n/).slice(-2).join(" | "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3. Epoche lauf2: Route aus route-lauf2.json --");
for (const [knoten, sf, ziel, label] of [
  [1, {}, 4, "BN1.1 -> 4"],
  [4, { 1: 1 }, 4, "BN4.1 -> 4"],
  [4, { 1: 1, 4: 1 }, 4, "BN4.2 -> 4"],
  [4, { 1: 1, 4: 2 }, 1, "BN4.3 -> 1"],
]) {
  const t = await fahreExit({ knoten, sf, ziel, home: { "epoche.json": EPOCHE_LAUF2 } });
  pruefe("lauf2 " + label + ": Sprung geprueft", erlaubt(t), t.split("\n").slice(-1)[0]);
  const f = await fahreExit({ knoten, sf, ziel: 10, home: { "epoche.json": EPOCHE_LAUF2 } });
  pruefe("lauf2 " + label.split(" ")[0] + ": BN10 abgelehnt", abgelehnt(f), f.split("\n").slice(-1)[0]);
}
{
  // Verfahren und Lauf der Routen-Eintraege, wie ausgang.js sie ablegt.
  const a = await fahreAusgang({ knoten: 4, sf: { 1: 1 }, home: { "epoche.json": EPOCHE_LAUF2 } });
  pruefe("ausgang.js lauf2 in BN4.1: Verfahren V1, Knoten 4, Lauf 1 (V1, nicht V2)", a.verfahren === "V1 4 1", JSON.stringify(a.verfahren));
  const b = await fahreAusgang({ knoten: 1, sf: {}, home: { "epoche.json": EPOCHE_LAUF2 } });
  pruefe("ausgang.js lauf2 in BN1.1: V1 1 1", b.verfahren === "V1 1 1", JSON.stringify(b.verfahren));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 4. Kaputte oder unbekannte Epoche: kein Sprung --");
for (const [inhalt, label] of [['{"epoche":"lauf3"}', "lauf3"], ["{kaputt", "kein JSON"], ['{"epoche":5}', "falscher Typ"], ["lauf9", "unbekannter Name"]]) {
  const t = await fahreExit({ knoten: 4, sf: { 1: 1 }, ziel: 4, home: { "epoche.json": inhalt } });
  pruefe("Epoche " + label + ": abgelehnt", abgelehnt(t), t.split("\n").slice(-1)[0]);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 5. exit.js auf einem Fremdrechner --");
{
  const t = await fahreExit({ knoten: 4, sf: { 1: 1 }, ziel: 4, host: "werk-0",
    home: { "epoche.json": EPOCHE_LAUF2 }, wirt: {} });
  pruefe("Wirt ohne eigene Dateien: Epoche und Route kommen per scp von home", erlaubt(t), t.split("\n").slice(-1)[0]);
  // Alte Kopie auf dem Wirt, home hat KEINE Epochendatei: es gilt Lauf 1 (abgelehnt im frischen Stand).
  const s = await fahreExit({ knoten: 4, sf: { 1: 1 }, ziel: 4, host: "werk-0", home: {},
    wirt: { "epoche.json": EPOCHE_LAUF2, "route-lauf2.json": ROUTE2, "route.json": ROUTE1 } });
  pruefe("alte epoche.json auf dem Wirt zaehlt nicht, wenn home keine hat", abgelehnt(s), s.split("\n").slice(-1)[0]);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 6. Uebergabe-Werkzeug: Leser-Nachweis --");
{
  pruefe("pruefeLeser auf dem echten src/: keine Maengel", pruefeLeser(ROOT).length === 0, pruefeLeser(ROOT).join("; "));
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TEMP || "."), "leser-"));
  try {
    fs.mkdirSync(path.join(tmp, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "ausgang.js"), lies("ausgang.js").replace(/leseEpoche/g, "x"));
    fs.writeFileSync(path.join(tmp, "src", "exit.js"), lies("exit.js"));
    fs.writeFileSync(path.join(tmp, "src", "route-lauf2.json"), ROUTE2);
    fs.writeFileSync(path.join(tmp, "src", "lib", "route.js"), lies("lib/route.js"));
    const m = pruefeLeser(tmp);
    pruefe("pruefeLeser erkennt einen fehlenden Leser in ausgang.js", m.some((x) => /ausgang\.js/.test(x) && /leseEpoche/.test(x)), m.join("; "));
    fs.rmSync(path.join(tmp, "src", "exit.js"));
    pruefe("pruefeLeser erkennt eine fehlende exit.js", pruefeLeser(tmp).some((x) => /exit\.js fehlt/.test(x)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { for (const f of fehler) console.log("  - " + f); process.exit(1); }
