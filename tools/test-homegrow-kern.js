/**
 * G50 (14.11.2026): Kernkauf nur mit Ertragspruefung (src/homegrow.js).
 *
 * ===========================================================================
 * WAS GEPRUEFT WIRD
 * ===========================================================================
 *
 * A. Reine Funktionen, geeicht an UNABHAENGIG bekannten Werten:
 *    - knotenHackFaktor gegen die Knotenwerte aus BitNode.tsx (reference/v301,
 *      hier von Hand eingetragen: BN3 0,2 x 0,04; BN4 0,2 x 0,1125; BN8 Gain 0;
 *      BN9 0,1 x 0,01; BN11 ServerMaxMoney 0,01; BN2 0,08).
 *    - kernKaufErlaubt gegen die Kostenformel 1e9 * 7,5^Kerne
 *      (PlayerObjectServerMethods.ts:43) und den Kernbonus 1 + (k-1)/16
 *      (NetscriptFunctions.ts:288): Kern 2 braucht bei 12 h Horizont
 *      R >= 7,5e9 * 16 / 43200, Kern 3 R >= 56,25e9 * 17 / 43200.
 * B. homegrow.js gegen den Mock: neue Lagen (BN9/3/11 gesperrt, kleiner
 *    erwarteter Ertrag gesperrt, grosser Ertrag und unbekannter Ertrag frei).
 * C. BITGLEICH: Ohne die neue Lage (keine Knotennummer, kein Stapelblock,
 *    unkritischer Knoten) trifft die neue Fassung dieselben Kaufentscheidungen
 *    und schreibt denselben Log wie die Fassung vom Commit 294b593 (master vom
 *    14.11.2026, vor G50). Die alte Fassung wird per git show geholt; ist git
 *    oder der Commit nicht da, wird Teil C uebersprungen (nicht rot).
 *
 * Aufruf: node tools/test-homegrow-kern.js
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BASIS = path.resolve(HIER, "..");
const ALT_COMMIT = "294b593";
const WALL = 1_700_000_000_000;
const RUNDE_MS = 10000;

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(name, ok, hinweis = "") {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; fehler.push(name + (hinweis ? " - " + hinweis : "")); console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
}
const nah = (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

const neu = await ladeSpielskript(path.join(BASIS, "src", "homegrow.js"));
const TABELLE_TEXT = fs.readFileSync(path.join(BASIS, "src", "lib", "bitnodes.json"), "utf8");
const TABELLE = JSON.parse(TABELLE_TEXT);

// ---------------------------------------------------------------------------
console.log("\n=== G50 Kernkauf-Ertragspruefung ===\n    " + BASIS);
console.log("\n-- A. Reine Funktionen --");
// ---------------------------------------------------------------------------
{
  // Werte aus BitNode.tsx (reference/v301): Faktor = ScriptHackMoney x Gain x ServerMaxMoney
  const soll = { 1: 1, 2: 0.08, 3: 0.2 * 0.04, 4: 0.2 * 0.1125, 8: 0, 9: 0.1 * 0.01, 11: 0.01 };
  for (const [n, f] of Object.entries(soll)) {
    const ist = neu.knotenHackFaktor(TABELLE, Number(n), 1);
    pruefe("Knotenfaktor BN" + n + " = " + f, ist !== null && nah(ist, f), "ist " + ist);
  }
  const f12 = neu.knotenHackFaktor(TABELLE, 12, 1);
  pruefe("Knotenfaktor BN12.1 knapp unter 1 (Stufentabelle)", f12 > 0.5 && f12 < 1, "ist " + f12);
  pruefe("unbekannter Knoten/Tabelle -> null (keine Knotensperre)",
    neu.knotenHackFaktor(null, 9, 1) === null && neu.knotenHackFaktor(TABELLE, NaN, 1) === null
    && neu.knotenHackFaktor({}, 9, 1) === null);

  pruefe("Ertrag: Summe ueber Stapelziele", neu.erwarteterHackertrag({ ziele: [{ erwartetProS: 3 }, { erwartetProS: 4 }, { phase: "prep" }] }) === 7);
  pruefe("Ertrag: keine Zahl -> null", neu.erwarteterHackertrag({ ziele: [{ phase: "prep" }] }) === null
    && neu.erwarteterHackertrag(null) === null && neu.erwarteterHackertrag({}) === null);

  // Eichung an der Kostenformel: Kern 2 kostet 1e9 * 7,5^1 (Kerne=1 -> naechster ist 7,5e9)
  const preis = (kerne) => 1e9 * Math.pow(7.5, kerne);
  pruefe("Preisformel: Kern 2 = 7,5 Mrd, Kern 3 = 56,25 Mrd (63,75 Mrd zusammen, BN9.1)",
    nah(preis(1), 7.5e9) && nah(preis(2), 56.25e9) && nah(preis(1) + preis(2), 63.75e9));
  const H = neu.KERN_HORIZONT_S;
  const rMin1 = preis(1) * 16 / H;          // Kern 1 -> 2: Anteil 1/16
  const rMin2 = preis(2) * 17 / H;          // Kern 2 -> 3: Anteil (1/16)/(1+1/16) = 1/17
  const urteil = (kerne, r) => neu.kernKaufErlaubt({ kerne, kernKosten: preis(kerne), knotenFaktor: 1, ertragProSek: r });
  pruefe("Kern 2: Schwelle " + Math.round(rMin1) + " $/s (12 h Horizont): knapp drueber frei", urteil(1, rMin1 * 1.001).erlaubt);
  pruefe("Kern 2: knapp drunter gesperrt", !urteil(1, rMin1 * 0.999).erlaubt);
  pruefe("Kern 3: Schwelle " + Math.round(rMin2) + " $/s: knapp drueber frei, knapp drunter gesperrt",
    urteil(2, rMin2 * 1.001).erlaubt && !urteil(2, rMin2 * 0.999).erlaubt);
  pruefe("Ertrag unbekannt (null) -> frei (alte Regel)", neu.kernKaufErlaubt({ kerne: 1, kernKosten: 7.5e9, knotenFaktor: 1, ertragProSek: null }).erlaubt);
  pruefe("Knoten unbekannt und Ertrag unbekannt -> frei", neu.kernKaufErlaubt({ kerne: 1, kernKosten: 7.5e9, knotenFaktor: null, ertragProSek: null }).erlaubt);
  pruefe("Knotenfaktor 0,01 (BN11) sperrt auch bei riesigem Ertrag", !neu.kernKaufErlaubt({ kerne: 1, kernKosten: 7.5e9, knotenFaktor: 0.01, ertragProSek: 1e12 }).erlaubt);
  pruefe("Knotenfaktor 0,0225 (BN4) sperrt nicht", neu.kernKaufErlaubt({ kerne: 1, kernKosten: 7.5e9, knotenFaktor: 0.0225, ertragProSek: null }).erlaubt);
  // Bei 85 Mrd/s (Spaetphase, homegrow-Kommentar) sind Kern 2-6 frei
  let alleFrei = true;
  for (let k = 1; k <= 5; k++) alleFrei = alleFrei && neu.kernKaufErlaubt({ kerne: k, kernKosten: preis(k), knotenFaktor: 1, ertragProSek: 85e9 }).erlaubt;
  pruefe("Spaetphase 85 Mrd/s: Kerne 2-6 alle frei", alleFrei);
}

// ---------------------------------------------------------------------------
// Mock-Lauf von homegrow.js (zwei Runden), gibt Kaeufe und Log zurueck
// ---------------------------------------------------------------------------
async function homegrow(modul, { lage, geld = 1e12, kosten = 2e9, kerne = 1, kernKosten = 7.5e9, alt = 0, tabelle = true, homeRam = 4096 }) {
  const dateien = { home: {} };
  if (tabelle) dateien.home["lib/bitnodes.json"] = TABELLE_TEXT;
  if (lage) dateien.home["data/bn4net.json"] = JSON.stringify({ zeit: WALL - alt, ...lage });
  const m = neuerMock({ host: "home", wall: WALL, geld, knoten: lage && lage.knoten ? lage.knoten : 1, dateien, maxSchlaf: 2,
    server: { home: { ram: homeRam, used: 0, root: true, geld, cores: kerne, ports: 0, hackLevel: 1 } },
    beiSchlaf: (ms, z, vor) => vor(RUNDE_MS) });
  const kauf = { ram: 0, kerne: 0 };
  m.ns.singularity.getUpgradeHomeRamCost = () => kosten;
  m.ns.singularity.getUpgradeHomeCoresCost = () => kernKosten;
  m.ns.singularity.upgradeHomeRam = () => { kauf.ram++; return true; };
  m.ns.singularity.upgradeHomeCores = () => { kauf.kerne++; return true; };
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  const text = (m.zustand.dateien.home && m.zustand.dateien.home["data/homegrow.txt"]) || "";
  // Zeitstempel vorn abschneiden (Format "Uhrzeit  Text"), Lauf-unabhaengig vergleichen
  kauf.log = text.split("\n").filter(Boolean).map((z) => { const i = z.indexOf("  "); return i >= 0 ? z.slice(i + 2) : z; });
  return kauf;
}

const stapel = (r) => ({ gap: 200, ziele: [{ ziel: "x", phase: "batch", erwartetProS: r }] });

console.log("\n-- B. homegrow.js, neue Lagen --");
{
  const reich = { geld: 1e13, kernKosten: 7.5e9 };
  for (const n of [9, 3, 11]) {
    const k = await homegrow(neu, { ...reich, lage: { knoten: n, bnWerte: { stufe: 1 }, brachAnteil: 0 } });
    pruefe("BN" + n + ": Kern trotz viel Geld NICHT gekauft", k.kerne === 0, "Kerne " + k.kerne);
    pruefe("BN" + n + ": Sperre steht im Log", k.log.some((z) => /Kern 2 nicht gekauft/.test(z)), JSON.stringify(k.log));
  }
  let k = await homegrow(neu, { ...reich, lage: { knoten: 4, bnWerte: { stufe: 1 }, brachAnteil: 0, stapel: stapel(1e5) } });
  pruefe("BN4, erwartet 100.000 $/s: nicht gekauft", k.kerne === 0, "Kerne " + k.kerne);
  k = await homegrow(neu, { ...reich, lage: { knoten: 4, bnWerte: { stufe: 1 }, brachAnteil: 0, stapel: stapel(5e7) } });
  pruefe("BN4, erwartet 50 Mio $/s: gekauft", k.kerne >= 1, "Kerne " + k.kerne);
  k = await homegrow(neu, { ...reich, lage: { knoten: 4, bnWerte: { stufe: 1 }, brachAnteil: 0 } });
  pruefe("BN4, kein Stapelblock (Ertrag unbekannt): gekauft wie bisher", k.kerne >= 1, "Kerne " + k.kerne);
  k = await homegrow(neu, { ...reich, lage: { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 }, alt: 130000 });
  pruefe("BN9, Lagedatei 130 s alt (nicht frisch): wie unbekannt, gekauft", k.kerne >= 1, "Kerne " + k.kerne);
  k = await homegrow(neu, { ...reich, lage: { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 }, tabelle: false });
  pruefe("BN9 ohne lib/bitnodes.json (Tabelle fehlt), ohne Stapel: alte Regel, gekauft", k.kerne >= 1, "Kerne " + k.kerne);
  k = await homegrow(neu, { ...reich, lage: { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 } });
  pruefe("BN9: Speicherkauf bleibt unberuehrt (G50 betrifft nur Kerne)", k.ram >= 1, "Ram " + k.ram);
  k = await homegrow(neu, { ...reich, kerne: 8, lage: { knoten: 4, bnWerte: { stufe: 1 }, brachAnteil: 0, stapel: stapel(5e7) } });
  pruefe("8 Kerne: nie gekauft", k.kerne === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- C. Bitgleich gegen die Fassung vom Commit " + ALT_COMMIT + " --");
// ---------------------------------------------------------------------------
let altModul = null, tmp = null;
try {
  const quelle = execFileSync("git", ["show", ALT_COMMIT + ":src/homegrow.js"], { cwd: BASIS, encoding: "utf8", maxBuffer: 1 << 22 });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hg-alt-"));
  fs.mkdirSync(path.join(tmp, "src", "lib"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "homegrow.js"), quelle);
  fs.copyFileSync(path.join(BASIS, "src", "lib", "hostdatei.js"), path.join(tmp, "src", "lib", "hostdatei.js"));
  altModul = await ladeSpielskript(path.join(tmp, "src", "homegrow.js"));
} catch (e) {
  console.log("  (uebersprungen: alte Fassung nicht holbar: " + String(e.message).split("\n")[0] + ")");
}
if (altModul) {
  pruefe("alte Fassung hat keine G50-Funktionen (Vergleichsbasis echt alt)", typeof altModul.kernKaufErlaubt === "undefined");
  const lagen = [
    ["keine Lagedatei", null],
    ["leere Lage", {}],
    ["brach 10 %", { brachAnteil: 0.1 }],
    ["brach 90 %", { brachAnteil: 0.9 }],
    ["Erfahrungsmodus + Freigabe", { xpModus: true, xpHomeKauf: 4096, brachAnteil: 0.9 }],
    ["BN1 mit Knotenblock", { knoten: 1, bnWerte: { stufe: 1 }, brachAnteil: 0 }],
    ["BN5 mit Knotenblock", { knoten: 5, bnWerte: { stufe: 1 }, brachAnteil: 0.2 }],
    ["BN4 ohne Stapelziele", { knoten: 4, bnWerte: { stufe: 1 }, brachAnteil: 0.2, stapel: { gap: 200, ziele: [{ phase: "prep" }] } }],
    ["BN7 ohne Stapelblock", { knoten: 7, bnWerte: { stufe: 1 }, brachAnteil: 0 }],
    ["BN13 ohne Stapelblock", { knoten: 13, bnWerte: { stufe: 1 }, brachAnteil: 0.5 }],
    ["BN12.2 ohne Stapelblock", { knoten: 12, bnWerte: { stufe: 2 }, brachAnteil: 0 }],
    ["BN9 mit alter Lagedatei (nicht frisch)", { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 }, 200000],
  ];
  let faelle = 0, abweichung = 0;
  for (const [name, lage, alter] of lagen) {
    for (const geld of [1e9, 1e10, 1e12]) {
      for (const kosten of [2e9, 1e18]) {
        for (const [kerne, kernKosten] of [[1, 7.5e9], [2, 56.25e9], [5, 2.37e13], [7, 1e18], [8, 1e9]]) {
          for (const ruecklage of [false]) {
            const p = { lage, geld, kosten, kerne, kernKosten, alt: alter || 0 };
            const a = await homegrow(altModul, p);
            const b = await homegrow(neu, p);
            faelle++;
            const gleich = a.ram === b.ram && a.kerne === b.kerne && JSON.stringify(a.log) === JSON.stringify(b.log);
            if (!gleich) {
              abweichung++;
              pruefe("bitgleich: " + name + " geld " + geld + " kosten " + kosten + " kerne " + kerne, false,
                "alt " + JSON.stringify([a.ram, a.kerne, a.log]) + " neu " + JSON.stringify([b.ram, b.kerne, b.log]));
            }
          }
        }
      }
    }
  }
  pruefe("bitgleich: " + faelle + " Faelle (12 Lagen x Geld x Preise x Kerne), 0 Abweichungen", abweichung === 0, abweichung + " Abweichungen");
  // Gegenprobe, dass der Vergleich Zaehne hat: BN9 frisch gibt einen echten Unterschied
  const a = await homegrow(altModul, { lage: { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 }, geld: 1e13, kernKosten: 7.5e9 });
  const b = await homegrow(neu, { lage: { knoten: 9, bnWerte: { stufe: 1 }, brachAnteil: 0 }, geld: 1e13, kernKosten: 7.5e9 });
  pruefe("Gegenprobe: BN9 frisch - alt kauft Kerne, neu nicht", a.kerne >= 1 && b.kerne === 0, "alt " + a.kerne + ", neu " + b.kerne);
}
if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* egal */ } }

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
