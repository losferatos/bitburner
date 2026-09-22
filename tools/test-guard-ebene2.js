/**
 * Ebene 2: der Waechter laeuft gegen den ns-Mock.
 *
 * ===========================================================================
 * WAS HIER BEWIESEN WERDEN MUSS
 * ===========================================================================
 *
 * Position C.6 liefert den Waechter im BEOBACHTUNGSMODUS aus. Der Beweis
 * dafuer ist nicht, dass er etwas tut - sondern dass er nichts tut:
 *
 *   - Er erkennt einen haengenden Kern und schreibt es auf.
 *   - Er fuehrt KEINE Sprosse aus, solange `guard-modus.txt` nicht auf
 *     `enforce` steht.
 *   - Er bestraft NICHT waehrend der Karenz nach einem Reset - das ist die
 *     haeufigste Fehlstrafe ueberhaupt.
 *   - Er laeuft nicht von selbst bis EXHAUSTED hoch. Ohne diese Regel meldete
 *     er nach einer Nacht eine Erschoepfung, die er selbst erzeugt hat.
 *
 * Aufruf: node tools/test-guard-ebene2.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

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

console.log("");
console.log("=== Ebene 2: der Waechter gegen den ns-Mock ===");

const W0 = 1_700_000_000_000;

/** Fuer den Schonlisten-Test: guard.js und ausgang.js sind killSafe:false. */
// Der Quelltext des Waechters - fuer die Proben, die eine Regel im Code
// belegen statt sie ueber Stunden zu erfahren.
const SRC_GUARD = [
  path.join(ROOT, "src", "guard.js"),
  path.resolve(ROOT, "..", "bitburner-bau", "src", "guard.js"),
].find((x) => fs.existsSync(x));

const REGISTRY_MIT_KILLSAFE = JSON.stringify({
  schema: 1,
  eintraege: [
    { name: "guard.js", ramBaseGb: 6.1, verfahren: "alle", knoten: "alle",
      phase: "beide", hostRule: "home", priority: 2, evictRank: 99,
      restartPolicy: "always", killSafe: false, precondition: {} },
    { name: "ausgang.js", ramBaseGb: 8.15, verfahren: "alle", knoten: "alle",
      phase: "beide", hostRule: "any", priority: 8, evictRank: 99,
      restartPolicy: "always", killSafe: false, precondition: {} },
    { name: "blade.js", ramBaseGb: 94.35, verfahren: "alle", knoten: "alle",
      phase: "normal", hostRule: "werkbank", priority: 10, evictRank: 10,
      restartPolicy: "always", killSafe: true, precondition: {} },
  ],
});

/** Eine Registry mit genau einem ueberwachten Werkzeug - mehr braucht es nicht. */
const REGISTRY = JSON.stringify({
  schema: 1,
  eintraege: [
    { name: "blade.js", args: [], ramBaseGb: 94.35, ramSingGb: 0,
      verfahren: "alle", knoten: "alle", phase: "beide",
      telemetryFile: "data/blade.json", freshnessMs: 600000, taktMs: 30000,
      hostRule: "werkbank", priority: 10, evictRank: 10,
      restartPolicy: "always", precondition: {} },
  ],
});

function grundzustand(extra = {}, dateienExtra = {}) {
  return {
    host: "home",
    knoten: 10,
    // Der Reset liegt weit zurueck, damit die Karenz nicht greift.
    nodeReset: W0 - 24 * 3600000,
    augReset: W0 - 24 * 3600000,
    wall: W0,
    playtime: 100 * 3600000,
    server: { home: { ram: 64, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: {
      home: {
        "guard.js": "//",
        "registry.json": REGISTRY,
        "data/verfahren.txt": "V2 10 2",
        "blade.js": "//",
        ...dateienExtra,
      },
    },
    ...extra,
  };
}

async function fahre(runden, dateien = {}, extra = {}, beiSchlaf = null) {
  const m = neuerMock({
    ...grundzustand(extra, dateien),
    maxSchlaf: runden,
    beiSchlaf: beiSchlaf || ((ms, z, vor) => vor(ms)),
  });
  const { modul } = await ladeAusBeiden(ROOT, "guard.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return m;
}

function json(m, datei) {
  const roh = m.lies("home", datei);
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Waechter laeuft und schreibt seinen Herzschlag --");
let ersterZustand = null;
{
  const m = await fahre(5, {
    "data/bn4net.json": JSON.stringify({ wall: W0, motorTimeMs: 3600000,
      okRound: 100, errStreak: 0, round: 100 }),
    "data/blade.json": JSON.stringify({ motorTimeMs: 3600000, state: "work",
      errStreak: 0, lastError: null, ts: W0 }),
  });
  const w = json(m, "data/watchdog.json");
  ersterZustand = w;
  pruefe("watchdog.json wird geschrieben", w !== null,
    m.zustand.log.slice(-3).join(" | "));
  if (w) {
    pruefe("mit Herzschlag-Pflichtfeldern",
      "errStreak" in w && "lastError" in w && "okRound" in w && "guardTimeMs" in w);
    pruefe("schema 2", w.schema === 2);
    pruefe("Modus steht drin", w.modus === "observe", "erhalten " + w.modus);
    pruefe("der Waechter selbst wirft nicht", w.errStreak === 0,
      w.lastError ? w.lastError.msg : "");
    pruefe("und zaehlt vollstaendige Runden", w.okRound >= 1, "okRound=" + w.okRound);
  }
}

console.log("");
console.log("-- der Modus und die Handbremse (W10 und Nachtrag) --");
{
  // Ohne Datei: observe. Das ist der Rueckfall und bleibt so - ein Waechter,
  // der ohne jede Angabe zuschlaegt, waere die falsche Vorgabe.
  const ohne = await fahre(3, {});
  pruefe("ohne guard-modus.txt bleibt es bei observe",
    (json(ohne, "data/watchdog.json") || {}).modus === "observe");

  // Mit "enforce": scharf. Das ist der Zustand, den boot.js seit W10 setzt.
  const scharf = await fahre(3, { "data/guard-modus.txt": "enforce" });
  pruefe("mit enforce wird er scharf",
    (json(scharf, "data/watchdog.json") || {}).modus === "enforce");

  // DIE HANDBREMSE. `data/guard-observe.txt` sticht "enforce" - und zwar in
  // derselben Runde, in der sie liegt, nicht erst beim naechsten boot.js.
  // Der Riegel wirkt sonst erst nach dem naechsten Wiederanlauf, und
  // ausgerechnet eine Notbremse darf nicht auf einen Neustart warten.
  const gebremst = await fahre(3, {
    "data/guard-modus.txt": "enforce",
    "data/guard-observe.txt": "1",
  });
  pruefe("guard-observe.txt sticht enforce sofort",
    (json(gebremst, "data/watchdog.json") || {}).modus === "observe",
    "erhalten " + (json(gebremst, "data/watchdog.json") || {}).modus);
}

console.log("");
console.log("-- scharf ist nicht gleich scharf (R12) --");
{
  // Bis zum 04.09.2026 gab es einen Schalter fuer die ganze Leiter. Ein
  // Pruefer hat das als eigenen Befund gefuehrt: Sprosse 1 und 2 sind billig
  // und umkehrbar, Sprosse 3 raeumt home leer und Sprosse 5 ist ein
  // Soft-Reset. Es gab keine Moeglichkeit, die unteren scharf und die oberen
  // in Beobachtung zu halten.
  //
  // Geprueft wird die Freigabetabelle selbst - sie steht im Waechter, und ein
  // Testlauf ueber Stunden waere der falsche Weg, sie zu belegen.
  const q = fs.readFileSync(SRC_GUARD, "utf8");
  pruefe("es gibt drei Modi", /enforce-alles/.test(q),
    "enforce, enforce-alles, observe");
  pruefe("bei 'enforce' sind nur die billigen Sprossen frei",
    /\[0, 1, 2, 4\.5\]/.test(q),
    "frei sind 0, 1, 2 und 4b - alle umkehrbar. Sprosse 3 raeumt home leer,"
    + " Sprosse 5 ist ein Soft-Reset");
  pruefe("und bei 'enforce-alles' auch die teuren",
    /\[0, 1, 2, 3, 4, 4\.5, 5\]/.test(q));
  pruefe("und die Ausfuehrung fragt die Tabelle",
    /SCHARFE_SPROSSEN\.includes\(r\.sprosse\.nr\)/.test(q),
    "sonst waere die Tabelle Zierde");
  pruefe("die Beobachtungsmeldung nennt den Weg zur Freigabe",
    /enforce-alles'\."/.test(q) || /enforce-alles/.test(q),
    "wer den Riegel sieht, soll auch wissen, wie er ihn loest");
}

console.log("");
console.log("-- ein haengender Kern wird ERKANNT --");
{
  // Der Kern-Herzschlag ist 30 Minuten alt -> S3a.
  const m = await fahre(40, {
    "data/bn4net.json": JSON.stringify({ wall: W0 - 30 * 60000, motorTimeMs: 3600000,
      okRound: 100, errStreak: 0, round: 100 }),
  }, {}, (ms, z, vor) => vor(30000));
  const w = json(m, "data/watchdog.json");
  const p = json(m, "data/penalties.json");
  pruefe("S3a wird gemeldet",
    !!w && (w.signaleJetzt || []).some((s) => s.sig === "S3a"),
    JSON.stringify(w && w.signaleJetzt));
  pruefe("und im Protokoll steht ein Eintrag",
    !!p && p.eintraege.length > 0, "penalties.json leer");
}

console.log("");
console.log("-- ABER: im Beobachtungsmodus wird NICHTS ausgefuehrt --");
{
  const m = await fahre(60, {
    "data/bn4net.json": JSON.stringify({ wall: W0 - 30 * 60000, motorTimeMs: 3600000,
      okRound: 100, errStreak: 0, round: 100 }),
  }, {}, (ms, z, vor) => vor(30000));
  const p = json(m, "data/penalties.json");
  pruefe("Eintraege vorhanden", !!p && p.eintraege.length > 0);
  if (p && p.eintraege.length) {
    const alle = p.eintraege.every((e) => e.result === "would-execute");
    pruefe("ALLE tragen result 'would-execute'", alle,
      p.eintraege.map((e) => e.result).join(", "));
    pruefe("kein Prozess wurde getoetet", m.zustand.getoetet.length === 0,
      m.zustand.getoetet.map((x) => x.filename).join(", "));
    pruefe("kein Prozess wurde gestartet", m.zustand.gestartet.length === 0,
      m.zustand.gestartet.map((x) => x.datei).join(", "));
  }
  // Der Beleg fuer die Abnahme: was HAETTE er getan.
  const w = json(m, "data/watchdog.json");
  pruefe("der Zustand des Kerns ist vermerkt",
    !!w && !!w.ziele && !!w.ziele["kern"], JSON.stringify(w && w.ziele));
}

console.log("");
console.log("-- er laeuft NICHT von selbst bis EXHAUSTED hoch --");
{
  // Ohne diese Regel eskalierte er in einer Nacht durch alle Sprossen und
  // meldete am Morgen eine Erschoepfung, die er selbst erzeugt hat.
  const m = await fahre(200, {
    "data/bn4net.json": JSON.stringify({ wall: W0 - 30 * 60000, motorTimeMs: 3600000,
      okRound: 100, errStreak: 0, round: 100 }),
  }, {}, (ms, z, vor) => vor(60000));
  const w = json(m, "data/watchdog.json");
  pruefe("kein EXHAUSTED im Beobachtungsmodus",
    !!w && (!w.ziele["kern"] || w.ziele["kern"].zustand !== "EXHAUSTED"),
    w && w.ziele["kern"] ? w.ziele["kern"].zustand : "kein Eintrag");
  pruefe("und kein exhausted-Vermerk", !!w && w.exhausted === null,
    JSON.stringify(w && w.exhausted));
}

console.log("");
console.log("-- waehrend der Karenz wird nicht bestraft --");
{
  // Der haeufigste Fehlalarm ueberhaupt: unmittelbar nach einem Einbau kann
  // der Kern gar nicht laufen. Ihn dafuer zu bestrafen erzeugt genau den
  // Zustand, den die Strafe heilen soll.
  const m = await fahre(20, {
    "data/bn4net.json": JSON.stringify({ wall: W0 - 30 * 60000, motorTimeMs: 0,
      okRound: 0, errStreak: 0, round: 0 }),
  }, { nodeReset: W0 - 60000, augReset: W0 - 60000 }, (ms, z, vor) => vor(10000));
  const w = json(m, "data/watchdog.json");
  const p = json(m, "data/penalties.json");
  pruefe("der Waechter meldet Karenz", !!w && w.state === "wait",
    w ? w.state : "kein Zustand");
  pruefe("und den Grund", !!w && w.blockedReason === "locked");
  pruefe("kein einziger Straf-Eintrag", !p || p.eintraege.length === 0,
    p ? p.eintraege.length + " Eintraege" : "");
}

console.log("");
console.log("-- ein gesunder Bot erzeugt KEINEN Eintrag --");
{
  const m = await fahre(60, {
    "data/bn4net.json": JSON.stringify({ wall: W0, motorTimeMs: 3600000,
      okRound: 500, errStreak: 0, round: 500 }),
    "data/blade.json": JSON.stringify({ motorTimeMs: 3600000, state: "work",
      errStreak: 0, lastError: null, ts: W0 }),
  }, {}, (ms, z, vor) => {
    // Beide Uhren laufen mit - Kern und Werkzeug bleiben frisch.
    vor(10000);
    const k = JSON.parse(z.dateien.home["data/bn4net.json"]);
    k.wall = z.wall; k.motorTimeMs += 10000; k.okRound++; k.round++;
    z.dateien.home["data/bn4net.json"] = JSON.stringify(k);
    const b = JSON.parse(z.dateien.home["data/blade.json"]);
    b.motorTimeMs = k.motorTimeMs; b.ts = z.wall;
    z.dateien.home["data/blade.json"] = JSON.stringify(b);
  });
  const p = json(m, "data/penalties.json");
  pruefe("keine Strafe bei gesundem Bot", !p || p.eintraege.length === 0,
    p ? JSON.stringify(p.eintraege.slice(0, 2)) : "");
  const w = json(m, "data/watchdog.json");
  pruefe("und keine Signale", !!w && (w.signaleJetzt || []).length === 0,
    JSON.stringify(w && w.signaleJetzt));
  pruefe("die Waechteruhr laeuft", !!w && w.guardTimeMs > 0,
    w ? String(w.guardTimeMs) : "");
}

console.log("");
console.log("-- der Zustand ueberlebt einen Neustart --");
{
  const dateien = {
    "data/bn4net.json": JSON.stringify({ wall: W0 - 30 * 60000, motorTimeMs: 3600000,
      okRound: 100, errStreak: 0, round: 100 }),
  };
  const m1 = await fahre(40, dateien, {}, (ms, z, vor) => vor(30000));
  const uhren1 = json(m1, "data/watchdog-uhren.json");
  pruefe("die Uhren werden geschrieben", uhren1 !== null && uhren1.guardTimeMs > 0);

  if (uhren1) {
    const m2 = await fahre(5, {
      ...dateien,
      "data/watchdog-uhren.json": JSON.stringify(uhren1),
      "data/watchdog.json": m1.lies("home", "data/watchdog.json"),
    }, {}, (ms, z, vor) => vor(10000));
    const uhren2 = json(m2, "data/watchdog-uhren.json");
    pruefe("die Waechterzeit wird uebernommen",
      !!uhren2 && uhren2.guardTimeMs >= uhren1.guardTimeMs,
      uhren2 ? uhren1.guardTimeMs + " -> " + uhren2.guardTimeMs : "");
  }
}

console.log("");
console.log("-- der Vergleichspunkt von S2 ueberlebt KEINEN Knotenwechsel (11.09.2026) --");
{
  // DER FALL VOM 10.09.: Sprung BN10 -> BN4. Der Kern reichte das alte
  // blade.json zehn Minuten lang als "frisch" durch, der Waechter setzte den
  // Vergleichspunkt auf Rang 444.908 aus BN10 - und schleppte ihn danach
  // ueber jeden Neustart aus watchdog.json weiter. Gegen 444.908 waechst ein
  // Rang von 464 nie: S2 stand seit dem Sprung durchgehend an, Sprosse 4.5
  // startete blade.js dreimal grundlos neu, Sprosse 5 lag dreimal auf
  // "would-execute".
  //
  // `leiter.laden()` setzt bei anderem watchdog.nodeReset ALLES zurueck - im
  // Vorfall war watchdog.nodeReset aber schon der neue Knoten, nur der
  // Traegerpunkt stammte aus dem alten. Genau das stellt diese Probe her.
  const kern = JSON.stringify({ wall: W0, motorTimeMs: 3600000,
    okRound: 100, errStreak: 0, round: 100 });
  const kpi = JSON.stringify({ traeger: { name: "rang", wert: 464 },
    route_state: "open", bestwertStatus: "geeicht" });
  const wd = (traeger) => JSON.stringify({ version: 1, nodeReset: W0 - 24 * 3600000,
    ziele: {}, verlauf: [], blockedHosts: {}, exhausted: null, ...traeger });

  const fremd = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    "data/watchdog.json": wd({ letzterTraegerWert: 444908, letzterTraegerMotorMs: 600000,
      letzterTraegerWall: W0 - 3600000, letzterTraegerNodeReset: W0 - 48 * 3600000 }) });
  const wf = json(fremd, "data/watchdog.json");
  pruefe("ein Vergleichspunkt aus einem anderen Knoten wird verworfen",
    wf && wf.letzterTraegerWert === 464, "letzterTraegerWert=" + (wf ? wf.letzterTraegerWert : "?"));
  pruefe("mit dem Stempel des aktuellen Knotens",
    wf && wf.letzterTraegerNodeReset === W0 - 24 * 3600000,
    "letzterTraegerNodeReset=" + (wf ? wf.letzterTraegerNodeReset : "?"));
  pruefe("das wird gemeldet", fremd.zustand.log.some((z) => /anderen Knoten verworfen/.test(z)),
    fremd.zustand.log.slice(-4).join(" | "));

  const eigen = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    // Motorabstand 10 min: unter den 45 min, ab denen die Setzregel einen
    // gewachsenen Traeger als neuen Punkt nimmt. Sonst misst die Probe die
    // Setzregel statt die Erhaltung.
    "data/watchdog.json": wd({ letzterTraegerWert: 400, letzterTraegerMotorMs: 3000000,
      letzterTraegerWall: W0 - 3600000, letzterTraegerNodeReset: W0 - 24 * 3600000,
      letzterTraegerName: "rang" }) });
  const we = json(eigen, "data/watchdog.json");
  pruefe("aus demselben Knoten bleibt der Punkt erhalten (sonst 45 min blind)",
    we && we.letzterTraegerWert === 400, "letzterTraegerWert=" + (we ? we.letzterTraegerWert : "?"));

  // DER FALL VOM 22.09.2026: Punkt 137, gesetzt als noch das Hacking-Level
  // trug, gegen einen Rang von 8 nach dem Bladeburner-Beitritt. Gleicher
  // Knoten, also griff der Knotenstempel nicht; der Name fehlte, also griff
  // auch der Namensvergleich nicht. S2 stand an, bis der Rang ueber 137 lag.
  const ohneName = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    "data/watchdog.json": wd({ letzterTraegerWert: 137000, letzterTraegerMotorMs: 3000000,
      letzterTraegerWall: W0 - 3600000, letzterTraegerNodeReset: W0 - 24 * 3600000 }) });
  const wn = json(ohneName, "data/watchdog.json");
  pruefe("ein Punkt OHNE Namen (Altbestand vor dem 22.09.) wird verworfen",
    wn && wn.letzterTraegerWert === 464, "letzterTraegerWert=" + (wn ? wn.letzterTraegerWert : "?"));
  pruefe("und traegt danach den Namen des aktuellen Traegers",
    wn && wn.letzterTraegerName === "rang", "letzterTraegerName=" + (wn ? wn.letzterTraegerName : "?"));

  const anderer = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    "data/watchdog.json": wd({ letzterTraegerWert: 137000, letzterTraegerMotorMs: 3000000,
      letzterTraegerWall: W0 - 3600000, letzterTraegerNodeReset: W0 - 24 * 3600000,
      letzterTraegerName: "hacking" }) });
  const wa = json(anderer, "data/watchdog.json");
  pruefe("ein Punkt eines ANDEREN Traegers (hacking -> rang) wird verworfen",
    wa && wa.letzterTraegerWert === 464, "letzterTraegerWert=" + (wa ? wa.letzterTraegerWert : "?"));
  pruefe("und der Wechsel wird gemeldet",
    anderer.zustand.log.some((z) => /Traeger gewechselt: hacking -> rang/.test(z)),
    anderer.zustand.log.slice(-4).join(" | "));

  // SKEPTIKER B1: Ein Einbau setzt Kampfwerte und Hacking zurueck, der Name
  // bleibt. Ein Punkt von VOR dem letzten Einbau ist verfallen.
  const einbau = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    "data/watchdog.json": wd({ letzterTraegerWert: 137000, letzterTraegerMotorMs: 3000000,
      letzterTraegerWall: W0 - 3 * 3600000, letzterTraegerNodeReset: W0 - 24 * 3600000,
      letzterTraegerName: "rang" }) }, { augReset: W0 - 2 * 3600000 });
  const we2 = json(einbau, "data/watchdog.json");
  pruefe("ein Punkt von VOR dem letzten Einbau wird verworfen",
    we2 && we2.letzterTraegerWert === 464, "letzterTraegerWert=" + (we2 ? we2.letzterTraegerWert : "?"));

  // SKEPTIKER B2: In der Wechselrunde darf S2 den neuen Traeger NICHT gegen
  // den Punkt des alten messen. Punkt alt genug (60 min Motorzeit), sonst
  // wuerde die Probe nur die 45-min-Schwelle messen.
  const s2Probe = async (name) => {
    const m = await fahre(1, { "data/bn4net.json": kern,
      "data/kpi.json": JSON.stringify({ traeger: { name: "rang", wert: 5 },
        route_state: "open", bestwertStatus: "geeicht" }),
      "data/watchdog.json": wd({ letzterTraegerWert: 99, letzterTraegerMotorMs: 0,
        letzterTraegerWall: W0 - 3600000, letzterTraegerNodeReset: W0 - 24 * 3600000,
        letzterTraegerName: name }) });
    const w = json(m, "data/watchdog.json");
    return !!(w && w.ziele && w.ziele.fortschritt);
  };
  pruefe("Gegenprobe: gleicher Traeger, Rang 5 gegen 99 -> S2 schlaegt an",
    await s2Probe("rang") === true, "sonst misst die Probe unten nichts");
  pruefe("in der Wechselrunde kampfwerte -> rang KEIN S2-Verdacht",
    await s2Probe("kampfwerte") === false);

  const alt = await fahre(3, { "data/bn4net.json": kern, "data/kpi.json": kpi,
    "data/watchdog.json": wd({ letzterTraegerWert: 444908, letzterTraegerMotorMs: 600000,
      letzterTraegerWall: W0 - 3600000 }) });
  const wo = json(alt, "data/watchdog.json");
  pruefe("ohne Stempel (Altbestand von vor dem 11.09.) wird der Punkt verworfen",
    wo && wo.letzterTraegerWert === 464, "letzterTraegerWert=" + (wo ? wo.letzterTraegerWert : "?"));
}

console.log("");
console.log("-- boot.js raeumt den Waechter NICHT weg (die Schonliste) --");
{
  // Der Fall: bn4net startet fuenf Minuten lang nicht, und boot.js raeumt
  // home frei. Bis heute beendete es dabei ALLES ausser sich selbst - also
  // auch den Waechter, die einzige Instanz, die einen nicht startenden Kern
  // bemerken und melden wuerde.
  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
    server: { home: { ram: 8, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    // EIGENE GROESSEN STATT DER REGISTRY (Skeptiker Runde 3, W5).
    //
    // Seit der Mock `exec` gegen `used` bucht, waeren die echten Zahlen hier
    // im Weg: blade.js kostet bei SF4.1 174,35 GB und liesse sich auf einem
    // 8-GB-home gar nicht erst starten - die drei Prozesse, die boot.js hier
    // vorfinden SOLL, gaebe es dann nicht.
    //
    // Der Gegenstand dieser Probe ist die Schonliste, nicht die Knappheit:
    // home ist klein, drei Werkzeuge halten es besetzt, der Kern passt nicht
    // mehr hinein. Genau diese Lage wird hier gestellt - 3 x 2 GB von 8, und
    // die 10,80 des Kerns passen nicht in die restlichen 2.
    skriptRam: { "guard.js": 2, "ausgang.js": 2, "blade.js": 2, "bn4net.js": 10.8 },
    dateien: { home: { "boot.js": "//", "guard.js": "//", "ausgang.js": "//",
      "blade.js": "//", "registry.json": REGISTRY_MIT_KILLSAFE } },
    maxSchlaf: 70,
    beiSchlaf: (ms, z, vor) => vor(5000),
  });
  // Die Prozesse, die boot.js vorfindet.
  for (const [datei, pid] of [["guard.js", 0], ["ausgang.js", 0], ["blade.js", 0]]) {
    m.ns.exec(datei, "home", 1);
  }
  const vorher = m.ns.ps("home").map((p) => p.filename).sort();

  const { modul } = await ladeAusBeiden(ROOT, "boot.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }

  const getoetet = m.zustand.getoetet.map((x) => x.filename);
  console.log("       vorher: " + vorher.join(", "));
  console.log("       getoetet: " + (getoetet.join(", ") || "(nichts)"));

  pruefe("der Waechter ueberlebt das Aufraeumen", !getoetet.includes("guard.js"),
    "boot.js haette seine eigene Aufsicht weggeraeumt");
  pruefe("ausgang.js ueberlebt ebenso", !getoetet.includes("ausgang.js"));
  pruefe("aber aufgeraeumt wurde trotzdem", getoetet.includes("blade.js"),
    "sonst raeumt boot.js gar nichts mehr und home bleibt voll");
}

console.log("");
console.log("-- ohne Registry traegt die Notliste --");
{
  const m = neuerMock({
    host: "home", knoten: 10, wall: W0, playtime: 100 * 3600000,
    nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000,
    server: { home: { ram: 8, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    // EIGENE GROESSEN STATT DER REGISTRY (Skeptiker Runde 3, W5).
    //
    // Seit der Mock `exec` gegen `used` bucht, waeren die echten Zahlen hier
    // im Weg: blade.js kostet bei SF4.1 174,35 GB und liesse sich auf einem
    // 8-GB-home gar nicht erst starten - die drei Prozesse, die boot.js hier
    // vorfinden SOLL, gaebe es dann nicht.
    //
    // Der Gegenstand dieser Probe ist die Schonliste, nicht die Knappheit:
    // home ist klein, drei Werkzeuge halten es besetzt, der Kern passt nicht
    // mehr hinein. Genau diese Lage wird hier gestellt - 3 x 2 GB von 8, und
    // die 10,80 des Kerns passen nicht in die restlichen 2.
    skriptRam: { "guard.js": 2, "ausgang.js": 2, "blade.js": 2, "bn4net.js": 10.8 },
    // KEINE registry.json - der Fall nach einem Knotenwechsel, bevor die
    // Bruecke die Dateien nachgeschoben hat.
    dateien: { home: { "boot.js": "//", "guard.js": "//", "blade.js": "//" } },
    maxSchlaf: 70,
    beiSchlaf: (ms, z, vor) => vor(5000),
  });
  m.ns.exec("guard.js", "home", 1);
  m.ns.exec("blade.js", "home", 1);
  const { modul } = await ladeAusBeiden(ROOT, "boot.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  const getoetet = m.zustand.getoetet.map((x) => x.filename);
  pruefe("der Waechter ueberlebt auch ohne Registry", !getoetet.includes("guard.js"),
    "lieber ein Prozess zu viel als der Waechter zu wenig");
}

console.log("");
console.log("-- FEHLKILL: eine andere Uhr haelt das Werkzeug fuer frisch --");
{
  // false_kill_count HAT SOLL 0 UND IST ABNAHMEBEDINGUNG (Auftrag 5.2). Die
  // Zahl hatte bis zum 04.09.2026 keinen Schreiber - sie stand dauerhaft auf
  // null und war damit unfaelschbar, genau wie false_penalty_count vorher.
  //
  // Der gestellte Fall ist der, den dieses Projekt am haeufigsten getroffen
  // hat: gegen die falsche Uhr gemessen. Der Kern haengt, seine MOTORZEIT
  // steht - und blade.js, das die Motorzeit mitschreibt, sieht dadurch alt
  // aus, obwohl sein eigener Herzschlag in ENGINEZEIT frisch ist. Der
  // Waechter erschlaegt dann ein gesundes Werkzeug, weil der Kern steht.
  const kernMotor = 10 * 3600000;
  const m = neuerMock({
    // blade.js kostet echt 94,35 GB und passt nicht auf ein 64-GB-home -
    // der Mock bucht seit R21 gegen `used` und startet es gar nicht erst.
    // Gegenstand dieser Probe ist die Uhrenwahl, nicht die Knappheit.
    ...grundzustand({ skriptRam: { "blade.js": 2, "guard.js": 6.1 } }, {
      "data/guard-modus.txt": "enforce",
      // Der Kern lebt (kein S3a), aber seine Motorzeit ist weit vorn.
      "data/bn4net.json": JSON.stringify({
        wall: W0, motorTimeMs: kernMotor, okRound: 100, errStreak: 0, round: 100,
        phase: "normal",
      }),
      // blade.js: in MOTORZEIT 10 h alt (weit ueber der Frist von 10 min),
      // in ENGINEZEIT 60 s alt - also kerngesund.
      "data/blade.json": JSON.stringify({
        motorTimeMs: kernMotor - 10 * 3600000 + 1,
        playtime: 100 * 3600000 - 60000,
        ts: W0 - 60000,
      }),
    }),
    maxSchlaf: 40,
    beiSchlaf: (ms, z, vor) => vor(30000),
  });
  m.ns.exec("blade.js", "home", 1);

  const { modul } = await ladeAusBeiden(ROOT, "guard.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }

  const w = json(m, "data/watchdog.json");
  const getoetet = m.zustand.getoetet.map((x) => x.filename);
  pruefe("S1 feuert auf blade.js",
    !!w && (w.signaleJetzt || []).some((x) => x.sig === "S1" && x.ziel === "blade.js"),
    JSON.stringify(w && w.signaleJetzt));
  pruefe("und der Kill trifft wirklich", getoetet.includes("blade.js"),
    getoetet.join(", ") || "(nichts getoetet)");
  pruefe("er wird als FEHLKILL gezaehlt",
    !!w && w.false_kill_count > 0,
    "false_kill_count = " + JSON.stringify(w && w.false_kill_count));
  const p2 = json(m, "data/penalties.json");
  const mitFehlkill = p2 ? p2.eintraege.filter((e) => e.fehlkill) : [];
  pruefe("und der Eintrag nennt die Uhr", mitFehlkill.length > 0
    && mitFehlkill[0].fehlkill.includes("Enginezeit"),
    mitFehlkill.length ? mitFehlkill[0].fehlkill.join(", ") : "kein Eintrag mit fehlkill");
}

console.log("");
console.log("-- ein ECHTER Haenger ist KEIN Fehlkill --");
{
  // DIE GEGENPROBE. Ohne sie wuerde die Zahl auch dann steigen, wenn der
  // Waechter recht hatte - und eine Kennzahl, die immer anschlaegt, ist so
  // wertlos wie eine, die nie anschlaegt.
  //
  // Derselbe Aufbau, nur ist blade.js jetzt in JEDER Uhr alt.
  const kernMotor = 10 * 3600000;
  const m = neuerMock({
    // blade.js kostet echt 94,35 GB und passt nicht auf ein 64-GB-home -
    // der Mock bucht seit R21 gegen `used` und startet es gar nicht erst.
    // Gegenstand dieser Probe ist die Uhrenwahl, nicht die Knappheit.
    ...grundzustand({ skriptRam: { "blade.js": 2, "guard.js": 6.1 } }, {
      "data/guard-modus.txt": "enforce",
      "data/bn4net.json": JSON.stringify({
        wall: W0, motorTimeMs: kernMotor, okRound: 100, errStreak: 0, round: 100,
        phase: "normal",
      }),
      "data/blade.json": JSON.stringify({
        motorTimeMs: kernMotor - 10 * 3600000 + 1,
        playtime: 100 * 3600000 - 10 * 3600000,
        ts: W0 - 10 * 3600000,
      }),
    }),
    maxSchlaf: 40,
    beiSchlaf: (ms, z, vor) => vor(30000),
  });
  m.ns.exec("blade.js", "home", 1);

  const { modul } = await ladeAusBeiden(ROOT, "guard.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }

  const w = json(m, "data/watchdog.json");
  pruefe("der Kill trifft auch hier",
    m.zustand.getoetet.map((x) => x.filename).includes("blade.js"));
  pruefe("aber er zaehlt NICHT als Fehlkill",
    !!w && w.false_kill_count === 0,
    "false_kill_count = " + JSON.stringify(w && w.false_kill_count));
}

console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  for (const wurzel of [path.join(ROOT, "src"),
                        path.resolve(ROOT, "..", "bitburner-bau", "src")]) {
    if (!fs.existsSync(wurzel)) continue;
    const reste = fs.readdirSync(wurzel).filter((f) => f.startsWith(".mock-"));
    pruefe("keine Reste in " + path.basename(path.dirname(wurzel)) + "/src",
      reste.length === 0, reste.join(", "));
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
