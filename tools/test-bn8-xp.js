/**
 * Reiner Erfahrungsmodus in BitNode 8 (10.11.2026): Verteilung, Kaufregel,
 * homegrow-Freigabe.
 *
 * ===========================================================================
 * WAS GEPRUEFT WIRD
 * ===========================================================================
 *
 * A. Verteilung (bn4net.js gegen den Mock, Knoten 8): (fast) alles RAM geht an
 *    den Erfahrungsofen, es gibt keine hack/grow/weaken-Stapel auf Geldziele,
 *    kein share - auch nicht bei frischem data/rep-modus.txt. Fallbacks:
 *    Level 1 (nur ein Ziel erreichbar) - der Kern steht nicht ohne Arbeit da.
 * B. Ausserhalb von Knoten 8 aendert sich NICHTS: in den Knoten 4, 5 und 10
 *    sind Geldstapel und share da, der Ofen bekommt nur den Rest - und, wenn
 *    ein Vergleichsbaum (orig/) neben dem Test liegt, sind die gestarteten
 *    Prozesse Stueck fuer Stueck dieselben wie mit dem alten Code.
 * C. Die Kaufregel (lib/xpkauf.js, reine Funktionen): billigste EFFEKTIVE
 *    Kosten je GB, home zaehlt ein Drittel, geldbedarf bleibt tabu. Die
 *    Preise werden hier UNABHAENGIG von der Bibliothek nachgerechnet
 *    (ServerPurchases.ts / PlayerObjectServerMethods.ts) - die Eichung.
 * D. Die Kaufregel im Kern (Knoten 8): Auftrag in data/kaufauftrag.json,
 *    Freigabe fuer home in data/bn4net.json (xpHomeKauf), geldbedarf geachtet;
 *    in Knoten 5 bleibt die alte Mechanik.
 * E. homegrow.js: im Erfahrungsmodus kein Dreifach-Puffer, keine Brachbremse,
 *    keine Kerne, Kauf nur bei gueltiger Freigabe; sonst alte Regeln.
 *
 * Aufruf: node tools/test-bn8-xp.js [wurzel]
 *   wurzel = Ordner mit src/ (Vorgabe: der Ordner ueber tools/). Gegen den
 *   alten Code: node tools/test-bn8-xp.js orig
 *   Vergleichsbaum fuer Teil B: Umgebungsvariable BN8_ALT (Vorgabe: orig/
 *   neben tools/, falls vorhanden).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BASIS = path.resolve(HIER, "..");
const ROOT = path.resolve(process.argv[2] || BASIS);
const ALT = process.env.BN8_ALT ? path.resolve(process.env.BN8_ALT)
  : (fs.existsSync(path.join(BASIS, "orig", "src")) ? path.join(BASIS, "orig") : null);

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(name, ok, hinweis = "") {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

const EXPFARM = "worker/expfarm.js";
const WALL = 1_700_000_000_000;
const RUNDE_MS = 10000;
const SKRIPT_RAM = {
  "worker/expfarm.js": 1.75, "worker/hack.js": 1.75,
  "worker/grow.js": 1.75, "worker/weaken.js": 1.75, "worker/share.js": 4,
};
const lade = (root, rel) => ladeSpielskript(path.join(root, "src", rel));

console.log("\n=== BN8: reiner Erfahrungsmodus ===\n    " + ROOT);

// ---------------------------------------------------------------------------
// Aufbau: ein Netz mit grossem home, einem Erfahrungsziel und zwei Geldzielen
// ---------------------------------------------------------------------------
function welt(knoten, extra = {}) {
  const dateien = {
    home: {
      "bn4net.js": "// Platzhalter",
      "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
      "worker/share.js": "//", "worker/expfarm.js": "//",
      "data/verfahren.txt": "V1 5 2",
      // Frischer Reputationsmodus: ausserhalb BN8 bekommt share bis 12 %.
      "data/rep-modus.txt": "x|" + WALL,
      ...(extra.dateien || {}),
    },
  };
  const server = {
    home: { ram: extra.homeRam ?? 200000, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 },
    // Eindeutig bestes Erfahrungsziel: expValue = (3+0.3*100)/((2.5+500)/150).
    expziel: { ram: 8, used: 0, root: true, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 100, sicherheitMin: 1, wachstum: 50 },
    geldziel: { ram: 8, used: 0, root: true, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 20, sicherheitMin: 20, wachstum: 50 },
    geldziel2: { ram: 8, used: 0, root: true, geld: 5e9, geldMax: 5e9, cores: 1, ports: 0,
      hackLevel: 1, sicherheit: 25, sicherheitMin: 25, wachstum: 50 },
    ...(extra.server || {}),
  };
  return { host: "home", wall: WALL, knoten, nodeReset: 1000, geld: extra.geld ?? 1e9, server, dateien,
    skriptRam: SKRIPT_RAM, maxSchlaf: extra.runden ?? 3,
    beiSchlaf: (ms, z, vor) => vor(RUNDE_MS) };
}

async function fahre(root, knoten, extra = {}) {
  const m = neuerMock(welt(knoten, extra));
  if (extra.level) m.zustand.spieler.skills.hacking = extra.level;
  if (extra.vorher) extra.vorher(m);
  const modul = await lade(root, "bn4net.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}
const bn4json = (m) => { try { return JSON.parse(m.lies("home", "data/bn4net.json") || "null"); } catch { return null; } };
const summe = (liste) => liste.reduce((a, g) => a + g.threads, 0);

// ---------------------------------------------------------------------------
// A. Verteilung in Knoten 8
// ---------------------------------------------------------------------------
console.log("\n-- A. Knoten 8: alles RAM in den Ofen --");
{
  const m = await fahre(ROOT, 8);
  const g = m.zustand.gestartet;
  const ofen = g.filter((x) => x.datei === EXPFARM);
  const stapel = g.filter((x) => ["worker/hack.js", "worker/grow.js", "worker/weaken.js"].includes(x.datei)
    && (x.args[0] === "geldziel" || x.args[0] === "geldziel2"));
  const share = g.filter((x) => x.datei === "worker/share.js");
  const ofenGb = summe(ofen) * 1.75;
  const home = m.zustand.server.home;
  const t = bn4json(m);
  pruefe("der Ofen wird gestartet, auf das Erfahrungsziel", ofen.length > 0 && ofen.every((x) => x.args[0] === "expziel"),
    "Starts: " + ofen.length);
  pruefe("keine hack/grow/weaken-Faeden auf die Geldziele", stapel.length === 0,
    stapel.length + " Starts, z. B. " + JSON.stringify(stapel.slice(0, 2).map((x) => x.datei + "@" + x.args[0])));
  pruefe("kein share trotz frischem rep-modus.txt", share.length === 0, share.length + " Starts");
  pruefe("mindestens 95 % von home laufen im Ofen", ofenGb >= 0.95 * home.ram,
    Math.round(ofenGb) + " von " + home.ram + " GB");
  pruefe("die Telemetrie meldet den Modus (data/bn4net.json: xpModus)", !!(t && t.xpModus === true),
    JSON.stringify(t && t.xpModus));
  pruefe("kein exec wird mangels Speicher abgelehnt", m.zustand.abgelehnt.length === 0,
    JSON.stringify(m.zustand.abgelehnt.slice(0, 2)));
  const fr = ofen.map((x) => Number(x.args[1]) - x.wall);
  pruefe("jeder Ofenstart traegt eine Frist in der Zukunft", fr.length > 0 && fr.every((d) => d > 0));
}

console.log("\n-- A2. Knoten 8, Level 1: der Kern steht nicht ohne Arbeit da --");
{
  // Nach einem Einbau: nur ein Ziel (Level 1) ist erreichbar, das zweite
  // verlangt Level 10 - der Ofen laeuft auf dem einen, die Geldziele fehlen.
  const m = await fahre(ROOT, 8, {
    level: 1,
    server: {
      n00dles: { ram: 4, used: 0, root: true, geld: 7e5, geldMax: 7e5, cores: 1, ports: 0,
        hackLevel: 1, sicherheit: 1, sicherheitMin: 1, wachstum: 3000 },
      joesguns: { ram: 16, used: 0, root: true, geld: 2.5e7, geldMax: 2.5e7, cores: 1, ports: 0,
        hackLevel: 10, sicherheit: 15, sicherheitMin: 5, wachstum: 20 },
      expziel: { ram: 8, used: 0, root: false, geld: 1e6, geldMax: 1e6, cores: 1, ports: 0,
        hackLevel: 50, sicherheit: 100, sicherheitMin: 1, wachstum: 50 },
      geldziel: { ram: 8, used: 0, root: false, geld: 2e9, geldMax: 2e9, cores: 1, ports: 0,
        hackLevel: 50, sicherheit: 20, sicherheitMin: 20, wachstum: 50 },
      geldziel2: { ram: 8, used: 0, root: false, geld: 5e9, geldMax: 5e9, cores: 1, ports: 0,
        hackLevel: 50, sicherheit: 25, sicherheitMin: 25, wachstum: 50 },
    },
  });
  const ofen = m.zustand.gestartet.filter((x) => x.datei === EXPFARM);
  pruefe("bei Level 1 laeuft der Ofen auf dem erreichbaren Ziel (n00dles)",
    ofen.length > 0 && ofen.every((x) => x.args[0] === "n00dles"),
    JSON.stringify([...new Set(ofen.map((x) => x.args[0]))]));
  pruefe("und er nimmt das RAM", summe(ofen) * 1.75 >= 0.95 * m.zustand.server.home.ram);
}

// ---------------------------------------------------------------------------
// B. Ausserhalb von Knoten 8 aendert sich nichts
// ---------------------------------------------------------------------------
console.log("\n-- B. Andere Knoten: Verteilung unveraendert --");
const normiere = (m) => m.zustand.gestartet.map((g) => g.datei + "|" + g.host + "|" + g.threads + "|"
  + g.args.map((a, i) => (i === 2 || i === 3 ? "t" : String(a))).join(",")).join("\n");
for (const knoten of [4, 5, 10]) {
  const m = await fahre(ROOT, knoten);
  const g = m.zustand.gestartet;
  const stapel = g.filter((x) => ["worker/hack.js", "worker/grow.js", "worker/weaken.js"].includes(x.datei)
    && (x.args[0] === "geldziel" || x.args[0] === "geldziel2"));
  const share = g.filter((x) => x.datei === "worker/share.js");
  const t = bn4json(m);
  pruefe("Knoten " + knoten + ": Geldziele bekommen ihre Faeden", stapel.length > 0, stapel.length + " Starts");
  pruefe("Knoten " + knoten + ": share laeuft bei frischem rep-modus.txt", share.length > 0, share.length + " Starts");
  pruefe("Knoten " + knoten + ": Modus ist aus", !!(t && t.xpModus === false), JSON.stringify(t && t.xpModus));
  if (ALT) {
    const alt = await fahre(ALT, knoten);
    // Vergleich mit dem Code VOR der Aenderung. Verglichen werden nur die
    // gestarteten Prozesse - die Telemetrie traegt neue Felder.
    const a = normiere(alt), n = normiere(m);
    pruefe("Knoten " + knoten + ": gestartete Prozesse gleich dem alten Code (" + alt.zustand.gestartet.length + ")",
      a === n, a === n ? "" : "verschieden, erste Abweichung: " + (a.split("\n").find((z, i) => z !== n.split("\n")[i]) || "Laenge"));
  }
}

// ---------------------------------------------------------------------------
// C. Die Kaufregel (reine Funktionen), geeicht gegen eigene Nachrechnung
// ---------------------------------------------------------------------------
console.log("\n-- C. lib/xpkauf.js: billigste effektive Kosten --");
const xpDatei = path.join(ROOT, "src", "lib", "xpkauf.js");
if (!fs.existsSync(xpDatei)) {
  pruefe("lib/xpkauf.js existiert", false);
} else {
  const X = await import(pathToFileURL(xpDatei).href);
  // Unabhaengige Nachrechnung der Spielformeln.
  const serverPreis = (ram) => ram * 55000 * 4 ** Math.max(0, Math.log2(ram) - 6);   // Softcap 4
  const homePreis = (r) => { let f = 1; for (let i = 0; i < Math.log2(r); i++) f *= 1.58; return r * 32000 * f; };
  const preise = {};
  for (let gb = 2; gb <= 2 ** 20; gb *= 2) preise[gb] = serverPreis(gb);
  const park = (n, ram) => Array.from({ length: n }, (_, i) => ({ host: "werk-" + i, ram }));
  const basis = { geldFrei: 1e15, homeRam: 4096, park: [], limitAnzahl: 25, limitRam: 2 ** 20, preise };

  pruefe("Eichung: homeKosten(4096) = 4096*32000*1,58^12", Math.abs(X.homeKosten(4096) / homePreis(4096) - 1) < 1e-12,
    X.homeKosten(4096) + " gegen " + homePreis(4096));
  pruefe("Eichung: homeKosten(32) = 32*32000*1,58^5", Math.abs(X.homeKosten(32) / homePreis(32) - 1) < 1e-12);

  let w = X.waehleKauf({ ...basis });
  pruefe("leerer Park: der billigste GB ist ein neuer 64er (55.000 je GB)",
    w.kauf && w.kauf.art === "kauf" && w.kauf.gb === 64 && Math.abs(w.kauf.eff - 55000) < 1e-6,
    JSON.stringify(w.kauf));

  w = X.waehleKauf({ ...basis, park: park(25, 64) });
  pruefe("voller Park aus 64ern: Aufruestung 64 -> 128 (Differenz der Preise, 385.000 je GB) schlaegt home",
    w.kauf && w.kauf.art === "upgrade" && w.kauf.gb === 128 && w.kauf.host === "werk-0"
      && Math.abs(w.kauf.kosten - (serverPreis(128) - serverPreis(64))) < 1
      && Math.abs(w.kauf.eff - (serverPreis(128) - serverPreis(64)) / 64) < 1e-6,
    JSON.stringify(w.kauf));

  w = X.waehleKauf({ ...basis, park: park(25, 256) });
  const homeEff = homePreis(4096) / 4096 / 3;
  const upEff = (serverPreis(512) - serverPreis(256)) / 256;
  pruefe("Park aus 256ern: home (effektiv " + Math.round(homeEff) + ") billiger als 256 -> 512 ("
    + Math.round(upEff) + " je GB)", homeEff < upEff && w.kauf && w.kauf.art === "home" && w.kauf.gb === 8192,
    JSON.stringify(w.kauf));
  pruefe("home-Kosten gehen mit einem Drittel in den Vergleich ein",
    w.kauf && Math.abs(w.kauf.eff - homePreis(4096) / 4096 / 3) < 1e-6);
  // Mit vollem Gewicht waere die Aufruestung billiger - das Drittel entscheidet.
  pruefe("ohne das Drittel (volles Gewicht) waere die Aufruestung billiger - das Drittel entscheidet",
    homePreis(4096) / 4096 > upEff, Math.round(homePreis(4096) / 4096) + " gegen " + Math.round(upEff));

  w = X.waehleKauf({ ...basis, park: park(25, 256), geldFrei: 1e9 });
  pruefe("beste Option nicht bezahlbar (home 8192 kostet " + (homePreis(4096) / 1e9).toFixed(1)
    + " Mrd), die naechste liegt ueber dem Doppelten - nichts wird gekauft",
    w.kauf === null && w.beste && w.beste.art === "home", JSON.stringify(w.kauf));

  w = X.waehleKauf({ ...basis, park: park(25, 128), homeRam: 1024, geldFrei: 2e9 });
  // home 1024: 1024*32000*1,58^10/3/1024 = ~1,0 Mio je GB; 128 -> 256: ~1,54 Mio.
  const e1 = homePreis(1024) / 1024 / 3, e2 = (serverPreis(256) - serverPreis(128)) / 128;
  pruefe("beste (home " + Math.round(e1) + " je GB) unbezahlbar, naechste (" + Math.round(e2)
    + ") innerhalb des Doppelten und bezahlbar - die wird gekauft",
    homePreis(1024) > 2e9 && e2 <= 2 * e1 && w.kauf && w.kauf.art === "upgrade",
    JSON.stringify(w.kauf) + " homeKosten " + homePreis(1024));

  w = X.waehleKauf({ ...basis, geldFrei: 0 });
  pruefe("kein Geld, kein Kauf", w.kauf === null);

  w = X.waehleKauf({ ...basis, park: park(25, 64), limitAnzahl: 0 });
  pruefe("BitNode ohne Mietrechner (Limit 0): nur home, keine Server-Option",
    w.optionen.every((o2) => o2.art === "home") || w.optionen.every((o2) => o2.art !== "kauf"));

  w = X.waehleKauf({ ...basis, park: park(25, 64), limitRam: 64 });
  pruefe("Rechner am Groessenlimit werden nicht aufgeruestet", w.optionen.every((o2) => o2.art !== "upgrade"));
}

// ---------------------------------------------------------------------------
// D. Die Kaufregel im Kern
// ---------------------------------------------------------------------------
console.log("\n-- D. Kern: Auftrag und home-Freigabe --");
{
  const serverPreis = (ram) => ram * 55000 * 4 ** Math.max(0, Math.log2(ram) - 6);
  const preise = {};
  for (let gb = 2; gb <= 2 ** 20; gb *= 2) preise[gb] = serverPreis(gb);
  const preiseDatei = (park) => JSON.stringify({ ts: WALL, limitAnzahl: 25, limitRam: 2 ** 20,
    kaufbar: true, park, preise });
  const park = (n, ram) => Array.from({ length: n }, (_, i) => ({ host: "werk-" + i, ram }));
  const auftrag = (m) => { try { return JSON.parse(m.lies("home", "data/kaufauftrag.json") || "null"); } catch { return null; } };

  // D1: leerer Park, 10 Mrd frei.
  let m = await fahre(ROOT, 8, { geld: 1e10, runden: 2, dateien: { "data/preise.json": preiseDatei([]) } });
  let a = auftrag(m);
  pruefe("Knoten 8, leerer Park, 10 Mrd: Auftrag ueber EINEN 64er (nicht die teuerste Stufe)",
    a && a.art === "kauf" && a.gb === 64, JSON.stringify(a));
  pruefe("der Auftrag nennt den Erfahrungsmodus als Grund", !!(a && /Erfahrungsmodus/.test(a.grund || "")), a && a.grund);

  // D2: geldbedarf = gesamtes Bargeld.
  m = await fahre(ROOT, 8, { geld: 1e10, runden: 2,
    dateien: { "data/preise.json": preiseDatei([]), "data/geldbedarf.txt": "1e10" } });
  pruefe("geldbedarf.txt gleich Bargeld: nichts bestellt", auftrag(m) === null, JSON.stringify(auftrag(m)));
  m = await fahre(ROOT, 8, { geld: 1e10, runden: 2,
    dateien: { "data/preise.json": preiseDatei([]), "data/geldbedarf.txt": String(1e10 - 1e5) } });
  pruefe("geldbedarf.txt laesst 100.000 frei: nichts bestellt (64 GB kosten 3,5 Mio)", auftrag(m) === null,
    JSON.stringify(auftrag(m)));

  // D3: voller Park aus 256ern, home 4096: home ist billigster GB -> Freigabe.
  m = await fahre(ROOT, 8, { geld: 1e11, runden: 2, homeRam: 4096,
    dateien: { "data/preise.json": preiseDatei(park(25, 256)) } });
  let t = bn4json(m);
  pruefe("Knoten 8, home billiger als jede Aufruestung: Freigabe xpHomeKauf = 4096",
    !!(t && t.xpHomeKauf === 4096), JSON.stringify(t && t.xpHomeKauf));
  pruefe("und KEIN Rechner-Auftrag in derselben Runde", auftrag(m) === null, JSON.stringify(auftrag(m)));
  m = await fahre(ROOT, 8, { geld: 1e11, runden: 2, homeRam: 4096,
    dateien: { "data/preise.json": preiseDatei(park(25, 256)), "data/geldbedarf.txt": "9.9e10" } });
  t = bn4json(m);
  pruefe("geldbedarf.txt 99 Mrd von 100: home (32 Mrd) wird NICHT freigegeben", !!(t && t.xpHomeKauf === 0),
    JSON.stringify(t && t.xpHomeKauf));

  // D3b: ein Auftrag ist noch offen (kein Ergebnis) - neue Rechner warten, home
  // wird trotzdem freigegeben; ohne Preistabelle gar nichts.
  m = await fahre(ROOT, 8, { geld: 1e11, runden: 2, homeRam: 4096,
    dateien: { "data/preise.json": preiseDatei(park(25, 256)) },
    vorher: (mm) => mm.lege("home", "data/kaufauftrag.json", JSON.stringify({ id: "offen", art: "kauf", gb: 64, ts: WALL })) });
  t = bn4json(m);
  pruefe("Knoten 8, Rechnerpreise vorhanden: die Freigabe fuer home haengt nicht am Auftragsstand",
    !!(t && t.xpHomeKauf === 4096), JSON.stringify(t && t.xpHomeKauf));
  m = await fahre(ROOT, 8, { geld: 1e11, runden: 2, homeRam: 4096 });
  t = bn4json(m);
  pruefe("Knoten 8 ohne Preistabelle: keine home-Freigabe (die Rechnerpreise fehlen zum Abwaegen)",
    !!(t && t.xpHomeKauf === 0), JSON.stringify(t && t.xpHomeKauf));

  // D4: Knoten 5 - alte Mechanik, kein Erfahrungsgrund, keine Freigabe.
  m = await fahre(ROOT, 5, { geld: 1e10, runden: 2, dateien: { "data/preise.json": preiseDatei([]) } });
  a = auftrag(m); t = bn4json(m);
  pruefe("Knoten 5: der Auftrag stammt nicht aus dem Erfahrungsmodus",
    !a || !/Erfahrungsmodus/.test(a.grund || ""), JSON.stringify(a));
  pruefe("Knoten 5: keine home-Freigabe", !t || !t.xpHomeKauf, JSON.stringify(t && t.xpHomeKauf));
  if (ALT) {
    const alt = await fahre(ALT, 5, { geld: 1e10, runden: 2, dateien: { "data/preise.json": preiseDatei([]) } });
    const aa = auftrag(alt);
    const gleich = (!a && !aa) || (a && aa && a.art === aa.art && a.gb === aa.gb && a.grund === aa.grund);
    pruefe("Knoten 5: Kaufauftrag wie im alten Code", gleich, JSON.stringify(a) + " gegen " + JSON.stringify(aa));
  }
}

// ---------------------------------------------------------------------------
// E. homegrow.js
// ---------------------------------------------------------------------------
console.log("\n-- E. homegrow.js: Freigabe statt Puffer und Bremse --");
{
  async function homegrow(root, { lage, geld = 5e9, kosten = 2e9, ruecklage = 0, homeRam = 4096, kerne = 1, kernKosten = 1e9 }) {
    const dateien = { home: {} };
    if (lage) dateien.home["data/bn4net.json"] = JSON.stringify({ zeit: WALL, ...lage });
    if (ruecklage) dateien.home["data/geldbedarf.txt"] = String(ruecklage);
    const m = neuerMock({ host: "home", wall: WALL, geld, knoten: 8, dateien, maxSchlaf: 2,
      server: { home: { ram: homeRam, used: 0, root: true, geld, cores: kerne, ports: 0, hackLevel: 1 } },
      beiSchlaf: (ms, z, vor) => vor(RUNDE_MS) });
    const kauf = { ram: 0, kerne: 0 };
    m.ns.singularity.getUpgradeHomeRamCost = () => kosten;
    m.ns.singularity.getUpgradeHomeCoresCost = () => kernKosten;
    m.ns.singularity.upgradeHomeRam = () => { kauf.ram++; return true; };
    m.ns.singularity.upgradeHomeCores = () => { kauf.kerne++; return true; };
    const modul = await ladeSpielskript(path.join(root, "src", "homegrow.js"));
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck(); }
    return kauf;
  }

  // Freigabe, Bargeld zwischen 1x und 3x der Kosten, 90 % brach: alt kauft nicht.
  let k = await homegrow(ROOT, { lage: { xpModus: true, xpHomeKauf: 4096, brachAnteil: 0.9 }, geld: 2.5e9, kosten: 2e9 });
  pruefe("Erfahrungsmodus + Freigabe: gekauft bei 1,25-fachem Preis und 90 % brach", k.ram >= 1, "Kaeufe: " + k.ram);

  k = await homegrow(ROOT, { lage: { xpModus: true, xpHomeKauf: 0, brachAnteil: 0 }, geld: 1e12, kosten: 2e9 });
  pruefe("Erfahrungsmodus ohne Freigabe (xpHomeKauf 0): nicht gekauft, auch bei viel Geld", k.ram === 0, "Kaeufe: " + k.ram);

  k = await homegrow(ROOT, { lage: { xpModus: true, xpHomeKauf: 2048, brachAnteil: 0 }, geld: 1e12, kosten: 2e9 });
  pruefe("veraltete Freigabe (andere home-RAM): kein Doppelkauf", k.ram === 0, "Kaeufe: " + k.ram);

  k = await homegrow(ROOT, { lage: { xpModus: true, xpHomeKauf: 4096, brachAnteil: 0 }, geld: 5e9, kosten: 2e9, ruecklage: 4e9 });
  pruefe("geldbedarf.txt bleibt tabu: 5 Mrd bar, 4 Mrd Ruecklage, 2 Mrd Preis - nicht gekauft", k.ram === 0, "Kaeufe: " + k.ram);

  k = await homegrow(ROOT, { lage: { xpModus: true, xpHomeKauf: 4096, brachAnteil: 0 }, geld: 1e12, kosten: 2e9, kerne: 1, kernKosten: 1e9 });
  pruefe("Erfahrungsmodus: keine Kerne (wirken nicht auf Erfahrung), auch wenn sie billig sind", k.kerne === 0, "Kerne gekauft: " + k.kerne);

  // Alte Regeln ausserhalb des Modus.
  k = await homegrow(ROOT, { lage: { brachAnteil: 0.1 }, geld: 1e10, kosten: 2e9, kernKosten: 1e9 });
  pruefe("ohne Modus: Dreifach-Puffer erfuellt, wenig brach - gekauft (alte Regel)", k.ram >= 1, "Kaeufe: " + k.ram);
  pruefe("ohne Modus: Kerne werden weiter gekauft", k.kerne >= 1, "Kerne: " + k.kerne);
  k = await homegrow(ROOT, { lage: { brachAnteil: 0.1 }, geld: 5e9, kosten: 2e9 });
  pruefe("ohne Modus: unter dem Dreifachen nicht gekauft (alte Regel)", k.ram === 0, "Kaeufe: " + k.ram);
  k = await homegrow(ROOT, { lage: { brachAnteil: 0.9 }, geld: 1e12, kosten: 2e9, kernKosten: 1e18 });
  pruefe("ohne Modus: bei 90 % brach nicht gekauft (alte Brachbremse)", k.ram === 0, "Kaeufe: " + k.ram);
  k = await homegrow(ROOT, { lage: null, geld: 1e10, kosten: 2e9, kernKosten: 1e18 });
  pruefe("ohne Lagedatei: alte Regel (unbekannt = nicht brach)", k.ram >= 1, "Kaeufe: " + k.ram);
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
