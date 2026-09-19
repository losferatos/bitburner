/**
 * Ebene 2: der Kern laeuft gegen einen ns-Mock.
 *
 * ===========================================================================
 * DIE LUECKE, DIE DAS SCHLIESST
 * ===========================================================================
 *
 * Bis heute gab es Ebene 0 (reine Funktionen) und Ebene 3 (Browser mit echtem
 * Spiel), dazwischen nichts. Der Motorzeit-Einbau in `bn4net.js` lag genau in
 * dieser Luecke: das Modul war mit 30 Pruefungen belegt, sein EINBAU aber
 * nicht - und ein richtiges Modul, das an der falschen Stelle aufgerufen wird,
 * ist genauso kaputt wie ein falsches.
 *
 * Hier laeuft der echte Kern. Nicht ein Nachbau, nicht ein Ausschnitt: dieselbe
 * Datei, die das Spiel ausfuehrt, geladen ueber `tools/mock/lader.js`, der nur
 * die Importzeilen auf Node-Schreibweise bringt.
 *
 * ===========================================================================
 * WAS GEPRUEFT WIRD
 * ===========================================================================
 *
 * Die drei Pflichtproben aus Auftrag 3.1, diesmal am eingebauten Zustand:
 *
 *   8 h gedrosselt  = 8 h Motorzeit
 *   8 h Rechner aus = 0
 *   Nachholklumpen  = 0
 *
 * Aufruf: node tools/test-motor-ebene2.js
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
console.log("=== Ebene 2: der Kern gegen den ns-Mock ===");

// ---------------------------------------------------------------------------
// Ein Netz, das gross genug ist, damit der Kern etwas zu tun findet.
function grundzustand(extra = {}) {
  return {
    host: "home",
    knoten: 10,
    nodeReset: 1000,
    geld: 1e9,
    server: {
      home: { ram: 64, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 },
      "n00dles": { ram: 4, used: 0, root: true, geld: 1e6, cores: 1, ports: 0, hackLevel: 1 },
      "foodnstuff": { ram: 16, used: 0, root: true, geld: 5e6, cores: 1, ports: 0, hackLevel: 5 },
    },
    dateien: {
      home: {
        "bn4net.js": "// Platzhalter, damit getScriptRam und exec etwas finden",
        "worker/hack.js": "//", "worker/grow.js": "//", "worker/weaken.js": "//",
        "worker/share.js": "//",
        "data/verfahren.txt": "V2 10 2",
      },
    },
    ...extra,
  };
}

/**
 * Faehrt den Kern fuer eine gegebene Zahl von Runden. Die Uhr steuert der
 * Aufrufer ueber `beiSchlaf` - so laesst sich eine Nacht in Millisekunden
 * simulieren.
 */
async function fahre(runden, beiSchlaf, extra = {}) {
  const m = neuerMock({ ...grundzustand(extra), maxSchlaf: runden, beiSchlaf });
  const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
  // Die Gewerke lesen die Wanduhr ueber Date.now(), nicht ueber ns. Ohne
  // diesen Griff bewegt sie sich im Test nicht, und die Motorzeit saehe in
  // jeder Runde einen Nachholklumpen.
  const zurueck = m.uhrStellen();
  try {
    await modul.main(m.ns);
  } catch (e) {
    if (!e.mockAbbruch) throw e;
  } finally {
    zurueck();
  }
  return m;
}

function telemetrie(m) {
  const roh = m.lies("home", "data/bn4net.json");
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- der Kern laeuft ueberhaupt --");
let ersteTelemetrie = null;
{
  const m = await fahre(5, (ms, z, vor) => vor(ms));
  const t = telemetrie(m);
  ersteTelemetrie = t;
  pruefe("Telemetrie wird geschrieben", t !== null,
    "data/bn4net.json fehlt - der Kern kam nicht bis zum Schreiben");
  if (t) {
    pruefe("runde zaehlt", t.runde >= 1, "runde=" + t.runde);
    pruefe("der Kern hat Runden vollstaendig durchlaufen", t.okRound >= 1,
      "okRound=" + t.okRound + " bei runde=" + t.runde +
      (t.lastError ? " - letzter Fehler: " + t.lastError.msg : ""));
  }
}

console.log("");
console.log("-- Herzschlag v2: die Pflichtfelder --");
{
  const t = ersteTelemetrie;
  if (!t) {
    pruefe("Telemetrie vorhanden", false, "ohne sie sind die Feldpruefungen sinnlos");
  } else {
    for (const feld of ["schema", "wall", "playtime", "motorTimeMs", "okRound",
                        "errStreak", "host", "state"]) {
      pruefe("Feld " + feld + " steht im Block", feld in t,
        "ARCHITEKTUR 4.1 - ohne diese Felder kann der Waechter nichts entscheiden");
    }
    pruefe("lastError ist vorhanden (auch als null)", "lastError" in t);
    pruefe("schema ist 2", t.schema === 2, "erhalten " + t.schema);
    pruefe("state ist ein erlaubter Wert",
      ["work", "wait", "blocked", "done"].includes(t.state), "erhalten " + t.state);
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- PFLICHTPROBE 1: acht Stunden gedrosselt = acht Stunden Motorzeit --");
{
  // Der verdeckte Tab bekommt eine Weckung je Minute. Die Spielzeit laeuft
  // dabei mit - das Spiel rechnet, es meldet sich nur seltener.
  const runden = 480;   // 8 h bei einer Runde je Minute
  const m = await fahre(runden, (ms, z, vor) => vor(60000));
  const t = telemetrie(m);
  pruefe("Telemetrie da", t !== null);
  if (t) {
    const stunden = t.motorTimeMs / 3600000;
    pruefe("rund acht Stunden Motorzeit", Math.abs(stunden - 8) < 0.2,
      "erhalten " + stunden.toFixed(2) + " h aus " + t.runde + " Runden");
    pruefe("keine Runde verworfen", (t.verworfeneRunden || 0) === 0,
      "verworfen: " + t.verworfeneRunden);
  }
}

console.log("");
console.log("-- PFLICHTPROBE 2: acht Stunden Rechner aus = null Motorzeit --");
{
  let schlaefe = 0;
  const m = await fahre(12, (ms, z, vor) => {
    schlaefe++;
    // Nach fuenf normalen Runden ist der Rechner acht Stunden aus. Beide Uhren
    // springen: die Engine bucht die Abwesenheit auf totalPlaytime nach.
    if (schlaefe === 5) vor(8 * 3600000, 8 * 3600000);
    else vor(10000);
  });
  const t = telemetrie(m);
  pruefe("Telemetrie da", t !== null);
  if (t) {
    const stunden = t.motorTimeMs / 3600000;
    // 11 Runden a 10 s = rund 110 s = 0,03 h. Die acht Stunden duerfen NICHT
    // dabei sein.
    pruefe("die Nacht zaehlt NICHT als Motorzeit", stunden < 0.1,
      "erhalten " + stunden.toFixed(4) + " h - erwartet unter 0,1");
    pruefe("die Runde wurde verworfen", (t.verworfeneRunden || 0) >= 1,
      "verworfen: " + t.verworfeneRunden);
    pruefe("der Grund nennt den Deckel", /Deckel/.test(t.letzterMzGrund || ""),
      t.letzterMzGrund || "kein Grund vermerkt");
  }
}

console.log("");
console.log("-- PFLICHTPROBE 3: der Nachholklumpen zaehlt null --");
{
  let schlaefe = 0;
  const m = await fahre(12, (ms, z, vor) => {
    schlaefe++;
    // Die Engine verarbeitet acht Stunden Rueckstand in EINER Runde: die
    // Wanduhr zeigt zehn Sekunden, die Spielzeit springt um acht Stunden.
    if (schlaefe === 5) vor(10000, 8 * 3600000);
    else vor(10000);
  });
  const t = telemetrie(m);
  pruefe("Telemetrie da", t !== null);
  if (t) {
    const stunden = t.motorTimeMs / 3600000;
    pruefe("der Klumpen zaehlt NICHT", stunden < 0.1,
      "erhalten " + stunden.toFixed(4) + " h");
    pruefe("die Runde wurde verworfen", (t.verworfeneRunden || 0) >= 1);
    pruefe("der Grund nennt den Klumpen", /Nachholklumpen/.test(t.letzterMzGrund || ""),
      t.letzterMzGrund || "kein Grund vermerkt");
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Uhr ueberlebt einen Neustart --");
{
  // Erst eine Stunde fahren, dann den Zustand mitnehmen und neu starten.
  const m1 = await fahre(360, (ms, z, vor) => vor(10000));
  const gespeichert = m1.lies("home", "data/motorzeit.json");
  pruefe("motorzeit.json wurde geschrieben", !!gespeichert,
    "ohne sie beginnt die Uhr nach jedem Neustart bei null");

  if (gespeichert) {
    const vorher = JSON.parse(gespeichert).motorTimeMs;
    pruefe("sie traegt eine Motorzeit", vorher > 0, "erhalten " + vorher);

    const start = grundzustand();
    start.dateien.home["data/motorzeit.json"] = gespeichert;
    const m2 = neuerMock({ ...start, maxSchlaf: 40, beiSchlaf: (ms, z, vor) => vor(10000) });
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck2 = m2.uhrStellen();
    try { await modul.main(m2.ns); } catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck2(); }
    const t = telemetrie(m2);
    pruefe("die Motorzeit wurde uebernommen", t && t.motorTimeMs >= vorher,
      t ? "vorher " + vorher + ", jetzt " + t.motorTimeMs : "keine Telemetrie");

    // DIE AUSFALLZEIT ZWISCHEN DEN LAEUFEN DARF NICHT DAZUKOMMEN. Der Prozess
    // war weg; diese Zeit ist keine Arbeit.
    const dazu = t ? t.motorTimeMs - vorher : 0;
    pruefe("die Pause zwischen den Laeufen zaehlt nicht mit", dazu < 10 * 60000,
      "dazugekommen: " + (dazu / 60000).toFixed(1) + " min bei 39 gefahrenen Runden");
  }
}

console.log("");
console.log("-- der Knotenwechsel setzt die Uhr zurueck --");
{
  const m1 = await fahre(360, (ms, z, vor) => vor(10000));
  const gespeichert = m1.lies("home", "data/motorzeit.json");
  if (gespeichert) {
    const start = grundzustand({ nodeReset: 999999 });   // anderer Lauf
    start.dateien.home["data/motorzeit.json"] = gespeichert;
    const m2 = neuerMock({ ...start, maxSchlaf: 20, beiSchlaf: (ms, z, vor) => vor(10000) });
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck3 = m2.uhrStellen();
    try { await modul.main(m2.ns); } catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck3(); }
    const t = telemetrie(m2);
    pruefe("die Uhr beginnt im neuen Knoten neu",
      t && t.motorTimeMs < 10 * 60000,
      t ? "erhalten " + (t.motorTimeMs / 60000).toFixed(1) + " min" : "keine Telemetrie");
  } else {
    pruefe("Vorbedingung: motorzeit.json vorhanden", false);
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- C.5: der Kern liest die Registry --");
{
  // Mit Registry: die Werkzeugliste kommt von dort.
  const registry = fs.readFileSync(
    [path.resolve(ROOT, "..", "bitburner-bau", "src", "registry.json"),
     path.join(ROOT, "src", "registry.json")].find((p) => fs.existsSync(p)), "utf8");

  const m = await fahre(5, (ms, z, vor) => vor(ms), {
    dateien: { home: {
      "bn4net.js": "//", "worker/hack.js": "//", "worker/grow.js": "//",
      "worker/weaken.js": "//", "worker/share.js": "//",
      "data/verfahren.txt": "V2 10 2",
      "registry.json": registry,
      // Die Werkzeuge muessen liegen, sonst filtert die Registry sie weg.
      "blade.js": "//", "ausgang.js": "//", "sleeve.js": "//", "bbtrain.js": "//",
      "bn4life.js": "//", "homegrow.js": "//", "contracts.js": "//",
      "hacknet.js": "//", "popups.js": "//", "bn4rep.js": "//", "bn4door.js": "//",
      "hashes.js": "//", "wakelock.js": "//",
    } },
  });
  const zeile = m.zustand.log.find((z) => z.includes("Werkzeugliste"));
  pruefe("der Kern meldet, woher die Liste kommt", !!zeile, m.zustand.log.slice(0, 3).join(" | "));
  if (zeile) {
    console.log("       " + zeile.trim());
    pruefe("und sie kommt aus der Registry", /aus registry\.json/.test(zeile), zeile);
    pruefe("die Rolle wurde erkannt", /Rolle V2/.test(zeile), zeile);
  }
}

console.log("");
console.log("-- C.5: der Kern meldet Feature 9 - hashes.js nur in BN9 oder mit SF9 --");
{
  // DER BEFUND VOM 10.09.: baueLage() lieferte kein `features`, hashes.js
  // stand in KEINEM Knoten in der Werkzeugliste. Belegt wird das Auftauchen
  // in `fehlend:` (der Mock-Kern fuellt home mit Arbeitern, der Start selbst
  // scheitert am Platz - siehe die csolve-Probe oben).
  const registry = fs.readFileSync(
    [path.resolve(ROOT, "..", "bitburner-bau", "src", "registry.json"),
     path.join(ROOT, "src", "registry.json")].find((p) => fs.existsSync(p)), "utf8");
  const dateien = {
    "bn4net.js": "//", "worker/hack.js": "//", "worker/grow.js": "//",
    "worker/weaken.js": "//", "worker/share.js": "//",
    "registry.json": registry, "hashes.js": "//", "hacknet.js": "//",
    "ausgang.js": "//", "bn4life.js": "//", "popups.js": "//", "wakelock.js": "//",
  };
  const lauf = async (knoten, ownedSF, verfahren) => {
    const m = await fahre(3, (ms, z, vor) => vor(ms), {
      knoten, ownedSF,
      dateien: { home: { ...dateien, "data/verfahren.txt": verfahren } },
    });
    return String(m.lies("home", "data/bn4net-log.txt") || "") + "\n" + m.zustand.log.join("\n");
  };
  // Passt es auf home (im Mock ja: 5,95 GB), startet der Kern es sofort -
  // dann steht "hashes.js laeuft" im Log statt "fehlend".
  const gelistet = (text) => /hashes\.js laeuft|fehlend: [^\n]*hashes\.js/.test(text);
  const inBn9 = await lauf(9, new Map(), "V2 9 1");
  pruefe("in BitNode 9 steht hashes.js in der Liste",
    gelistet(inBn9), "hashes.js taucht nie als fehlend auf");
  const inBn10ohne = await lauf(10, new Map(), "V2 10 2");
  pruefe("in BitNode 10 ohne SF9 steht es NICHT in der Liste",
    !gelistet(inBn10ohne), "hashes.js in BN10 ohne SF9 gelistet");
  const inBn10mit = await lauf(10, new Map([[9, 1]]), "V2 10 2");
  pruefe("in BitNode 10 MIT SF9 steht es in der Liste",
    gelistet(inBn10mit), "SF9 wird nicht als Feature erkannt");
}

console.log("");
console.log("-- C.5: ohne Registry traegt die eingebaute Liste --");
{
  // DER FALL, DER SONST DEN BOT STILLLEGT: nach einem Knotenwechsel, bevor
  // die Bruecke die Dateien nachgeschoben hat, gibt es keine registry.json.
  const m = await fahre(5, (ms, z, vor) => vor(ms));
  const zeile = m.zustand.log.find((z) => z.includes("Werkzeugliste"));
  pruefe("der Kern laeuft trotzdem", !!zeile);
  if (zeile) {
    console.log("       " + zeile.trim());
    pruefe("und faellt auf die eingebaute Liste zurueck", /EINGEBAUT/.test(zeile), zeile);
  }
  const t = telemetrie(m);
  pruefe("die Telemetrie wird weiter geschrieben", t !== null);
}

console.log("");
console.log("-- C.5: der Rollen-Riegel greift auch im Kern --");
{
  const registry = fs.readFileSync(
    [path.resolve(ROOT, "..", "bitburner-bau", "src", "registry.json"),
     path.join(ROOT, "src", "registry.json")].find((p) => fs.existsSync(p)), "utf8");
  // verfahren.txt steht auf Knoten 6, der Lauf ist in 10 - die Datei stammt
  // noch aus dem vorigen Knoten.
  const m = await fahre(5, (ms, z, vor) => vor(ms), {
    dateien: { home: {
      "bn4net.js": "//", "worker/weaken.js": "//",
      "data/verfahren.txt": "V1 6 2",
      "registry.json": registry,
      "blade.js": "//", "ausgang.js": "//", "wakelock.js": "//",
    } },
  });
  const zeile = m.zustand.log.find((z) => z.includes("Werkzeugliste"));
  pruefe("die Rolle gilt als unbekannt", !!zeile && /Rolle unbekannt/.test(zeile),
    zeile || "keine Zeile");
}

console.log("");
console.log("-- keine .mock-Datei bleibt liegen --");
{
  // Eine liegengebliebene Wegwerfdatei unter src/ ginge ueber die Bruecke ins
  // laufende Spiel. Der Lader raeumt im finally auf; das wird hier geprueft.
  for (const wurzel of [path.join(ROOT, "src"),
                        path.resolve(ROOT, "..", "bitburner-bau", "src")]) {
    if (!fs.existsSync(wurzel)) continue;
    const reste = fs.readdirSync(wurzel).filter((f) => f.startsWith(".mock-"));
    pruefe("keine Reste in " + path.basename(path.dirname(wurzel)) + "/src",
      reste.length === 0, reste.join(", "));
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Werkzeugliste folgt den Dateien JE RUNDE (10.09.2026) --");
{
  // DER FALL, DER DEN CONTRACT-ZYKLUS ZWEIMAL GETOETET HAT.
  //
  // `cdump.js` und `csolve.js` schliessen einander aus: cdump laeuft, solange
  // `data/cantwort.json` FEHLT, csolve, solange sie LIEGT. Bis zum 10.09. baute
  // der Kern seine Werkzeugliste nur beim Wechsel von Knoten, Rolle oder Phase.
  // Wer beim Bau nicht drinstand, kam bis zum naechsten Wechsel nicht vor -
  // auch dann nicht, wenn seine Vorbedingung laengst erfuellt war.
  //
  // Gemessen am 06.09.: um 13:00 lag die Datei beim Listenbau nicht vor,
  // csolve.js stand danach in keiner einzigen Runde zur Wahl, und die von
  // cdump geschriebenen Antworten blieben liegen. Am 10.09. im frischen
  // BitNode 4 derselbe Stillstand.
  //
  // Diese Probe stellt genau das her: Start OHNE cantwort.json, die Datei
  // faellt in Runde 3 an. Danach MUSS csolve.js starten.
  const REG = JSON.stringify({
    schema: 1,
    eintraege: [
      { name: "bn4net.js", verfahren: "alle", knoten: "alle", phase: "beide",
        hostRule: "home", ramBaseGb: 10.8, priority: 1, restartPolicy: "always",
        needsLibs: [], precondition: {} },
      { name: "cdump.js", verfahren: "alle", knoten: "alle", phase: "kaltstart",
        hostRule: "home", ramBaseGb: 6, priority: 5, restartPolicy: "until-done",
        needsLibs: [], precondition: { forbidsFile: "data/cantwort.json" } },
      { name: "csolve.js", verfahren: "alle", knoten: "alle", phase: "kaltstart",
        hostRule: "home", ramBaseGb: 6, priority: 6, restartPolicy: "until-done",
        needsLibs: [], precondition: { requiresFile: "data/cantwort.json" } },
    ],
  });
  // Der Mock wird hier selbst gebaut, nicht ueber `fahre`: die Probe muss
  // MITTEN im Lauf eine Datei anlegen und braucht die Referenz vorher.
  //
  // KEINE HACKZIELE (sonst misst die Probe etwas anderes): mit gerooteten
  // Servern belegt der Kern home bis auf zwei Gigabyte mit Arbeitern, und der
  // Werkzeugstart scheitert dann am Platz statt an der Liste. Ohne Root gibt
  // es nichts zu hacken, und der Speicher bleibt frei fuer das, was hier
  // geprueft wird.
  let runde = 0;
  let m;
  m = neuerMock({
    ...grundzustand({
      // home wird knapp ueber der Kaltstart-Grenze gehalten (64 GB ist die
      // Grenze, darueber gilt "normal" und die beiden Gewerke fallen aus der
      // Auswahl) - und die Arbeiter bekommen einen eigenen Rechner, damit sie
      // home nicht bis auf ein Gigabyte fuellen. Sonst scheitert der
      // Werkzeugstart am Platz statt an der Liste, und die Probe misst etwas
      // anderes als sie soll.
      server: {
        home: { ram: 64, used: 0, root: true, geld: 1e9, cores: 1, ports: 0,
          hackLevel: 1 },
        "n00dles": { ram: 256, used: 0, root: true, geld: 1e6, cores: 1,
          ports: 0, hackLevel: 1 },
      },
      dateien: {
        home: {
          "bn4net.js": "//", "cdump.js": "//", "csolve.js": "//",
          "worker/hack.js": "//", "worker/grow.js": "//",
          "worker/weaken.js": "//", "worker/share.js": "//",
          "data/verfahren.txt": "V2 10 2",
          "registry.json": REG,
        },
      },
    }),
    maxSchlaf: 40,
    beiSchlaf: (ms, z, vor) => {
      runde++;
      // Ab Runde 3 liegen Antworten vor - so, wie cdump.js sie schriebe.
      if (runde === 3) {
        m.lege("home", "data/cantwort.json",
          JSON.stringify([{ host: "n00dles", datei: "c.cct", typ: "T", antwort: 1 }]));
      }
      vor(ms);
    },
  });
  {
    const { modul } = await ladeAusBeiden(ROOT, "bn4net.js");
    const zurueck = m.uhrStellen();
    try { await modul.main(m.ns); }
    catch (e) { if (!e.mockAbbruch) throw e; }
    finally { zurueck(); }
  }
  const log = String(m.lies("home", "data/bn4net-log.txt") || "");
  if (process.env.DEBUG_LISTE) {
    console.log("---- Kernlog der Probe ----");
    console.log(log);
    console.log("---- cantwort:", m.lies("home", "data/cantwort.json"));
    console.log("---- Runden:", runde);
    console.log("---- Prozesse home:", JSON.stringify(m.ns.ps("home")));
    console.log("---- RAM csolve:", m.ns.getScriptRam("csolve.js", "home"),
      "frei:", m.ns.getServerMaxRam("home") - m.ns.getServerUsedRam("home"));
  }
  pruefe("cdump.js laeuft, solange cantwort.json fehlt",
    /cdump\.js laeuft/.test(log),
    "cdump.js kam gar nicht erst vor");
  // Der Beleg ist das Auftauchen in der Liste, nicht der Start selbst: der
  // Mock-Kern fuellt home mit Arbeitern (auch wenn ein groesserer Rechner
  // daneben steht), und der Start scheitert dann am Platz. Vor dem 10.09.
  // stand csolve.js in KEINER Runde in `fehlend` - es war gar nicht in der
  // Liste. Genau das prueft diese Zeile.
  pruefe("csolve.js steht in der Werkzeugliste, sobald cantwort.json anfaellt",
    /fehlend: [^\n]*csolve\.js/.test(log),
    "csolve.js taucht nie als fehlend auf - die Liste haengt wieder am Bauzeitpunkt");
  // Und die Gegenrichtung: cdump.js verschwindet aus der Liste, sobald die
  // Datei liegt - es darf danach in keiner `fehlend`-Zeile mehr stehen.
  const nachher = log.split(/\n/).filter((z) => /fehlend:/.test(z));
  pruefe("cdump.js faellt aus der Liste, sobald cantwort.json liegt",
    nachher.length > 0 && nachher.every((z) => !/fehlend: [^|]*cdump\.js/.test(z)),
    nachher.slice(-2).join(" || "));
}
console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
