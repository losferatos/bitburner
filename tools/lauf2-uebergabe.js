/**
 * LAUF-2-UEBERGABE DER BRUECKE (Z1, Bauplan Lauf 2, 14.11.2026).
 *
 * Der EINZIGE Weg, die LIVE-Bruecke auf einen neuen Spielstand umzustellen.
 * Einmalig, von Hand, mit ausdruecklichem identifier. Ohne `--ausfuehren`
 * nur Trockenlauf mit Plan.
 *
 * WARUM ES DAS BRAUCHT
 * Die Bruecke weist einen frischen Spielstand ab, und das zu Recht: er hat
 * einen neuen identifier (PlayerObject.ts:160, im Konstruktor gewuerfelt) und
 * eine Spielzeit von Minuten gegen einen Anker von ueber 2.000 h. Genau so
 * sieht aber auch ein verlorenes Browserprofil aus. Deshalb folgt der Wechsel
 * NIE aus beobachtetem Zustand, sondern nur aus diesem Befehl
 * (5c-skeptiker-kaltstart.md, Abschnitt 3a, sieben Randbedingungen).
 *
 * WAS ES TUT (in dieser Reihenfolge - jede Teilstrecke ist fuer sich sicher,
 * weil die identifier-Pruefung erst mit Schritt 4 auf das neue Spiel zeigt)
 *   1. Pruefen: Bruecke aus, identifier im Brueckenprotokoll als abgewiesen
 *      gesehen, Lauf-1-Kette lesbar (alle sha256, juengste Sicherung entpackt).
 *   2. Lauf-1-Kette archivieren: alle `LIVE_*`-Dateien und INDEX.tsv in
 *      Primaer UND Spiegel nach `<ort>/lauf1/`. Dort liest sie weder
 *      `rotiere()` noch die Ankersuche - die alten Staende koennen nicht mehr
 *      als "aelteste" herausrotiert werden (5c 3a, Punkt 2).
 *   3. `data/` nach `data/lauf1/` (Heartbeat-Anker, Spiegel aus dem Spiel,
 *      Sperrdateien - nichts davon gehoert in Lauf 2; 5c 3a, Punkt 7).
 *   4. `sync/identitaet.json` schreiben: Epoche, identifier, Startanker.
 *      Erst ab hier gilt das neue Spiel. Die Riegel bleiben voll wirksam:
 *      identifier-Pruefung gegen den neuen Wert, Rueckwaertssprung gegen den
 *      Anker der neuen Epoche.
 *
 * AUFRUF
 *   node tools/lauf2-uebergabe.js --pin <identifier>               Trockenlauf
 *   node tools/lauf2-uebergabe.js --pin <identifier> --ausfuehren  Uebergabe
 *   Weitere Schalter:
 *     --epoche <lauf<N>>   Zielepoche (Vorgabe: naechste Nummer)
 *     --ohne-sichtung      identifier muss NICHT im Brueckenprotokoll stehen
 *                          (nur, wenn das Protokoll fehlt; der identifier ist
 *                          dann vorher gegen das Spiel gelesen worden)
 *     --instance TEST      Pruefstand-Rolle (pruefstand/data, pruefstand/backups,
 *                          pruefstand/identitaet-test.json; die TEST-Bruecke
 *                          liest sie mit --identitaet pruefstand/identitaet-test.json).
 *                          Eine TEST-Bruecke ohne --identitaet prueft keinen
 *                          identifier und protokolliert daher keine Abweisung:
 *                          beim ersten Mal --ohne-sichtung. Leere Kette erlaubt.
 *     --root <ordner>      NUR TESTS: alles unter diesem Ordner
 *                          (data/, sync/identitaet.json, backups-primaer/,
 *                          backups-spiegel/). Ports nur mit --pruef-ports.
 *     --pruef-ports a,b    NUR TESTS: diese Ports als "Bruecke laeuft" pruefen
 *
 * EXIT 0 = Uebergabe erfolgt bzw. Trockenlauf ohne Hindernis,
 *      2 = abgelehnt (Hindernis, nichts veraendert), 1 = Aufruf- oder
 *      unerwarteter Fehler (Ausgabe lesen: was schon geschehen ist, steht da).
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ROOT as TOOL_ROOT,
  LIVE_ROOT,
  LIVE1_IDENTIFIER,
  BACKUP_PRIMAER,
  BACKUP_SPIEGEL,
  BACKUP_TEST,
  INDEX_NAME,
  ROLLEN,
  IDENTIFIER_MUSTER,
  EPOCHEN_MUSTER,
  ladeIdentitaet,
  pfadGleich,
  textAusArgv,
} from "../sync/instanz.js";
import { leseIndex, lesenKennwerte } from "../sync/backup.js";

// ---------------------------------------------------------------------------
// Aufruf
// ---------------------------------------------------------------------------

/**
 * Baut den Kontext (welche Ordner, welche Rolle) aus dem Aufruf. Exportiert
 * fuer den Test; wirft bei unzulaessiger Kombination.
 */
export function baueKontext(argv, toolRoot = TOOL_ROOT) {
  const root = textAusArgv(argv, "--root", "");
  const instanz = (textAusArgv(argv, "--instance", "") || "").toUpperCase();
  const pruefPorts = (textAusArgv(argv, "--pruef-ports", "") || "")
    .split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);

  if (root && instanz) throw new Error("--root und --instance schliessen sich aus");

  if (root) {
    const r = path.resolve(root);
    // Ein Testordner darf nie im Live-Baum oder an den echten Sicherungsorten
    // liegen - sonst waere --root der Weg, die Riegel unten zu umgehen.
    const verboten = [LIVE_ROOT, BACKUP_PRIMAER, BACKUP_SPIEGEL, toolRoot];
    for (const v of verboten) {
      const rel = path.relative(path.resolve(v), r);
      if (pfadGleich(r, v) || (rel && !rel.startsWith("..") && !path.isAbsolute(rel))) {
        throw new Error("--root " + r + " liegt in/auf " + v + " - nur fuer Wegwerfordner");
      }
    }
    // Und er muss sich als Probe ausweisen: ein vertipptes --root (etwa der
    // Benutzerordner) wuerde sonst dessen data/ verschieben.
    if (!fs.existsSync(path.join(r, "PROBE.txt"))) {
      throw new Error("--root " + r + " hat keine PROBE.txt - nur fuer Wegwerfordner, die ein Test anlegt");
    }
    return {
      art: "PROBE",
      root: r,
      identitaetDatei: path.join(r, "sync", "identitaet.json"),
      vorgabeIdentifier: LIVE1_IDENTIFIER,
      dataDir: path.join(r, "data"),
      orte: [path.join(r, "backups-primaer"), path.join(r, "backups-spiegel")],
      prefix: "LIVE_",
      ports: pruefPorts,
    };
  }
  if (pruefPorts.length) throw new Error("--pruef-ports nur mit --root");

  if (instanz === "TEST") {
    return {
      art: "TEST",
      root: toolRoot,
      identitaetDatei: path.join(toolRoot, "pruefstand", "identitaet-test.json"),
      vorgabeIdentifier: null,
      dataDir: ROLLEN.TEST.dataDir,
      orte: [BACKUP_TEST],
      prefix: ROLLEN.TEST.prefix,
      ports: [ROLLEN.TEST.rfaPort, ROLLEN.TEST.dashPort],
    };
  }
  if (instanz && instanz !== "LIVE") throw new Error("--instance nur TEST (LIVE ist die Vorgabe)");

  return {
    art: "LIVE",
    root: toolRoot,
    identitaetDatei: path.join(toolRoot, "sync", "identitaet.json"),
    vorgabeIdentifier: LIVE1_IDENTIFIER,
    dataDir: ROLLEN.LIVE.dataDir,
    orte: [BACKUP_PRIMAER, BACKUP_SPIEGEL],
    prefix: ROLLEN.LIVE.prefix,
    ports: [ROLLEN.LIVE.rfaPort, ROLLEN.LIVE.dashPort],
  };
}

/** LIVE nur in der Arbeitskopie - dieselben zwei Bedingungen wie die Bruecke. */
function pruefeLiveBaum(ctx) {
  if (ctx.art !== "LIVE") return null;
  if (!pfadGleich(ctx.root, LIVE_ROOT)) {
    return "LIVE-Uebergabe nur in " + LIVE_ROOT + " (dieser Baum: " + ctx.root + ")";
  }
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.root, encoding: "utf8" }).trim();
    if (!pfadGleich(top, LIVE_ROOT)) return "Git-Wurzel ist " + top + " - ein Worktree, nicht die Arbeitskopie";
  } catch (e) {
    return "git rev-parse schlug fehl: " + e.message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pruefungen
// ---------------------------------------------------------------------------

function pidLebt(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === "EPERM";
  }
}

/** Reiner TCP-Verbindungsversuch, es wird nichts gesendet. */
function portBelegt(port, msMax = 1500) {
  return new Promise((res) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const t = setTimeout(() => { s.destroy(); res(false); }, msMax);
    s.once("connect", () => { clearTimeout(t); s.destroy(); res(true); });
    s.once("error", () => { clearTimeout(t); res(false); });
  });
}

/** Laeuft eine Bruecke auf diesem Datenordner/diesen Ports? Liefert Gruende. */
export async function brueckeLaeuft(ctx) {
  const gruende = [];
  const pidDatei = path.join(ctx.dataDir, "bridge.pid");
  if (fs.existsSync(pidDatei)) {
    try {
      const j = JSON.parse(fs.readFileSync(pidDatei, "utf8"));
      if (pidLebt(Number(j.pid))) {
        gruende.push("PID " + j.pid + " aus " + pidDatei + " lebt (Bruecke seit " + j.seit + "?)"
          + " - ist es nicht die Bruecke, die Datei von Hand entfernen");
      }
    } catch {
      // Unlesbar: dann entscheiden die Ports.
    }
  }
  for (const p of ctx.ports) {
    if (await portBelegt(p)) gruende.push("Port " + p + " ist belegt");
  }
  return gruende;
}

/**
 * Sucht im Brueckenprotokoll die Abweisung genau dieses identifiers.
 * Die Bruecke schreibt: "ALARM Socket abgewiesen: ... | identifier <neu> statt <alt>",
 * und beim Rueckwaertssprung im selben Satz "totalPlaytime <n> liegt mehr als 60 s
 * hinter ...". Liefert die juengste Zeile.
 */
export function sichtung(dataDir, pin) {
  const muster = new RegExp("identifier " + pin + " statt (\\S+)");
  let treffer = null;
  for (const name of ["bridge.log.1", "bridge.log"]) {   // alt vor neu
    const p = path.join(dataDir, name);
    if (!fs.existsSync(p)) continue;
    for (const zeile of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = muster.exec(zeile);
      if (!m) continue;
      const t = /totalPlaytime (\d+(?:\.\d+)?) liegt/.exec(zeile);
      // Was das abgewiesene Spiel ist (Bruecke haengt "Spielstand BN<n> Lauf <l>,
      // <m> SF, Spielzeit <t> ms" an). Aeltere Protokolle haben die Zeile nicht.
      const w = /Spielstand BN(\d+) Lauf (\d+), (\d+) SF, Spielzeit (\d+(?:\.\d+)?) ms/.exec(zeile);
      treffer = {
        ts: zeile.split("\t")[0],
        statt: m[1],
        totalPlaytime: t ? Number(t[1]) : (w ? Number(w[4]) : null),
        bitNode: w ? Number(w[1]) : null,
        lauf: w ? Number(w[2]) : null,
        anzahlSf: w ? Number(w[3]) : null,
        datei: name,
      };
    }
  }
  return treffer;
}

/**
 * Dateien in data/, die KONFIGURATION sind und keinen Zustand halten. Sie
 * gehoeren nicht ins Archiv, sondern in den neuen Datenordner: sonst verliert
 * die Bruecke ihre Sperre, und pushAll schiebt ins frische Spiel, was in Lauf 1
 * bewusst zurueckgehalten wurde (nicht-schieben.txt sperrt graftplan.json, den
 * Zuender fuer rund 450 Mrd. - Erics Entscheidung, nicht die der Uebergabe;
 * Skeptiker 14.11.2026). Beim Wiederaufnahme-Vergleich zaehlen sie nicht mit.
 */
export const KONFIG_DATEIEN = ["nicht-schieben.txt"];

/**
 * Prueft, ob die Leser der Epoche im Spiel-Code stehen. Ohne sie faehrt der
 * Bot im frischen Spielstand die Route von Lauf 1 (BN4.1 -> BN10, nicht
 * umkehrbar; Skeptiker 14.11.2026). Textnachweis - den Funktionsnachweis
 * fuehrt tools/test-epoche-leser.js.
 * @returns {string[]} Maengel, leer = in Ordnung
 */
export function pruefeLeser(root) {
  const maengel = [];
  const lies = (rel) => {
    try { return fs.readFileSync(path.join(root, "src", rel), "utf8"); } catch { return null; }
  };
  for (const datei of ["ausgang.js", "exit.js"]) {
    const t = lies(datei);
    if (t === null) { maengel.push("src/" + datei + " fehlt"); continue; }
    for (const wort of ["leseEpoche", "ladeRoute", "EPOCHE_DATEI"]) {
      if (!t.includes(wort)) maengel.push("src/" + datei + " nutzt " + wort + " nicht (Epochen-Leser fehlt)");
    }
  }
  for (const datei of ["route-lauf2.json", "lib/route.js"]) {
    if (lies(datei) === null) maengel.push("src/" + datei + " fehlt");
  }
  return maengel;
}

function sha256Datei(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

/**
 * Prueft die Kette EINES Ablageorts: alle Dateien mit Rollenpraefix,
 * Indexzeilen, sha256, die juengste Sicherung entpackt.
 */
export function pruefeKette(ort, prefix, erwartetIdentifier) {
  const r = {
    ort,
    vorhanden: fs.existsSync(ort),
    index: false,
    zeilen: 0,
    dateien: [],
    ohneZeile: [],
    shaFalsch: [],
    shaOk: 0,
    fremdeIdentifier: 0,
    juengste: null,
    fehler: [],
  };
  if (!r.vorhanden) return r;
  r.index = fs.existsSync(path.join(ort, INDEX_NAME));
  r.dateien = fs.readdirSync(ort).filter((f) => f.startsWith(prefix)
    && fs.statSync(path.join(ort, f)).isFile());
  const zeilen = leseIndex(ort).filter((z) => (z.datei || "").startsWith(prefix));
  r.zeilen = zeilen.length;
  const mitZeile = new Set(zeilen.map((z) => z.datei));
  r.ohneZeile = r.dateien.filter((f) => !mitZeile.has(f));
  // Die Zeile mit der hoechsten Spielzeit, deren Datei noch da ist, ist der
  // letzte gesicherte Stand.
  let juengste = null;
  for (const z of zeilen) {
    if (erwartetIdentifier && z.identifier !== erwartetIdentifier) r.fremdeIdentifier++;
    const p = path.join(ort, z.datei);
    if (!fs.existsSync(p)) continue;               // weggerottet - erwartet
    const sha = sha256Datei(p);
    if (z.sha256 && sha !== z.sha256) r.shaFalsch.push(z.datei);
    else r.shaOk++;
    if (!juengste || Number(z.totalPlaytime) > Number(juengste.totalPlaytime)) juengste = z;
  }
  if (juengste) {
    const p = path.join(ort, juengste.datei);
    try {
      const k = lesenKennwerte(fs.readFileSync(p), !/-b64\.json$/.test(juengste.datei));
      r.juengste = {
        datei: juengste.datei,
        anlass: juengste.anlass,
        ts: juengste.ts,
        sha256: juengste.sha256,
        mtime: fs.statSync(p).mtime.toISOString(),
        identifier: k.identifier,
        bitNode: k.bitNodeN,
        lauf: k.lauf,
        totalPlaytime: k.totalPlaytime,
        shaPasst: !juengste.sha256 || sha256Datei(p) === juengste.sha256,
      };
      if (erwartetIdentifier && k.identifier !== erwartetIdentifier) {
        r.fehler.push("juengste Sicherung " + juengste.datei + " traegt identifier " + k.identifier);
      }
      if (!r.juengste.shaPasst) r.fehler.push("juengste Sicherung " + juengste.datei + ": sha256 passt nicht zum Index");
    } catch (e) {
      r.fehler.push("juengste Sicherung " + juengste.datei + " nicht lesbar: " + e.message);
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function naechsteEpoche(name) {
  const n = Number(String(name || "lauf1").replace(/^lauf/, ""));
  return "lauf" + ((Number.isInteger(n) && n > 0 ? n : 1) + 1);
}

/**
 * Prueft alles und liefert den Plan. Veraendert NICHTS.
 */
export async function plane(argv, ctx) {
  const plan = { ctx, hindernisse: [], hinweise: [], schritte: [], bereitsErledigt: false };
  const H = (t) => plan.hindernisse.push(t);

  const pin = textAusArgv(argv, "--pin", "");
  plan.pin = pin;
  if (!pin) H("--pin <identifier> fehlt (der identifier des NEUEN Spiels, aus der Abweisung der Bruecke)");
  else if (!IDENTIFIER_MUSTER.test(pin)) H("--pin " + pin + " ist kein cyrb53-identifier (1-14 Zeichen 0-9a-f)");

  // Falscher Baum: sofort zurueck, ohne Ports anzuklopfen oder die echte
  // Kette zu lesen - aus einem Worktree hat die LIVE-Uebergabe nichts zu tun.
  const baum = pruefeLiveBaum(ctx);
  if (baum) {
    H(baum);
    plan.altEpoche = "?";
    plan.zielEpoche = "?";
    return plan;
  }

  const alt = ladeIdentitaet(ctx.identitaetDatei, ctx.vorgabeIdentifier);
  plan.alt = alt;
  if (alt.fehler) H("Identitaetsdatei " + ctx.identitaetDatei + " ist ungueltig: " + alt.fehler);
  const altEpoche = alt.epoche || "lauf1";
  const zielEpoche = textAusArgv(argv, "--epoche", "") || naechsteEpoche(altEpoche);
  plan.altEpoche = altEpoche;
  plan.zielEpoche = zielEpoche;
  if (!EPOCHEN_MUSTER.test(zielEpoche)) H("--epoche " + zielEpoche + " hat nicht die Form lauf<N>");
  if (zielEpoche === altEpoche) H("Zielepoche " + zielEpoche + " ist die laufende");

  if (pin && alt.identifier === pin) {
    if (alt.aktiv) {
      plan.bereitsErledigt = true;
      plan.hinweise.push("Die Identitaetsdatei steht schon auf " + pin + " (Epoche " + alt.epoche + ") - nichts zu tun.");
      return plan;
    }
    H("--pin " + pin + " ist der laufende identifier - ein frisches Spiel hat einen neuen");
  }

  // Bruecke aus?
  for (const g of await brueckeLaeuft(ctx)) H("Bruecke laeuft: " + g + " - erst beenden");

  // Leser der Epoche im Spiel-Code (nur LIVE: dort gehen src/ und epoche.json
  // ins Spiel). Fehlen sie, springt der Bot in Lauf 2 mit der Route von Lauf 1.
  if (ctx.art === "LIVE") {
    for (const m of pruefeLeser(ctx.root)) H("Epochen-Leser: " + m + " - erst einbauen und mergen");
    // Laeuft die Neustartschleife (bridge-start.cmd)? In ihren 10 Sekunden
    // Pause sieht die Pid-/Portpruefung oben nichts, danach laedt die neue
    // Bruecke die ALTE Identitaet (Skeptiker 14.11.2026). Nicht pruefbar = Hinweis.
    try {
      const aus = execFileSync("powershell", ["-NoProfile", "-Command",
        "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*bridge-star[t].cmd*' -and $_.ProcessId -ne $PID } | Measure-Object).Count"],
      { encoding: "utf8", timeout: 20000 }).trim();
      if (Number(aus) > 0) H("Die Neustartschleife bridge-start.cmd laeuft (" + aus + " Prozess(e)) - Fenster/cmd.exe beenden, nicht nur die Bruecke");
    } catch {
      plan.hinweise.push("Neustartschleife nicht pruefbar (PowerShell) - von Hand sicherstellen, dass bridge-start.cmd nicht laeuft");
    }
  }

  // Gesehen? (Bei einer Wiederaufnahme liegt das Protokoll schon im Archiv.)
  // Nur mit gueltigem pin - er geht in einen regulaeren Ausdruck.
  if (pin && IDENTIFIER_MUSTER.test(pin)) {
    const s = sichtung(ctx.dataDir, pin) || sichtung(path.join(ctx.dataDir, altEpoche), pin);
    plan.sichtung = s;
    if (s) {
      plan.hinweise.push("Gesehen: " + s.ts + " in " + s.datei + " abgewiesen ('identifier " + pin
        + " statt " + s.statt + "')" + (s.totalPlaytime != null
        ? ", Spielzeit damals " + (s.totalPlaytime / 60000).toFixed(1) + " min" : ""));
      // Gegenprobe fuer den Menschen (5c 3a Punkt 4): ein frisches Spiel ist
      // BN1, Lauf 1, wenige Minuten, keine SF. Alles andere ist verdaechtig.
      if (s.bitNode !== null) {
        const frisch = s.bitNode === 1 && s.lauf === 1 && s.anzahlSf === 0;
        plan.hinweise.push("Abgewiesenes Spiel: BN" + s.bitNode + ", Lauf " + s.lauf + ", " + s.anzahlSf + " SF"
          + (frisch ? " - passt zu einem frischen Spiel"
            : " - ACHTUNG: KEIN frisches Spiel (erwartet BN1, Lauf 1, 0 SF). Gehoert dieser identifier wirklich"
              + " zum neuen Spiel, oder ist es ein anderer Stand/ein Profilverlust?"));
      } else {
        plan.hinweise.push("Die Abweisung nennt BN/Lauf/SF nicht (aelteres Protokoll) - das Spiel selbst gegenlesen:"
          + " BN1, Lauf 1, Spielzeit wenige Minuten, keine SF.");
      }
      if (alt.identifier && s.statt !== alt.identifier) {
        H("die Abweisung nennt als erwarteten identifier " + s.statt + ", laufend ist " + alt.identifier);
      }
    } else if (argv.includes("--ohne-sichtung")) {
      plan.hinweise.push("identifier " + pin + " NICHT im Brueckenprotokoll - --ohne-sichtung gesetzt");
    } else {
      H("identifier " + pin + " steht nicht im Brueckenprotokoll (" + path.join(ctx.dataDir, "bridge.log")
        + "). Erst das neue Spiel an die Bruecke haengen und abweisen lassen; Tippfehler? "
        + "Nur wenn das Protokoll fehlt: --ohne-sichtung");
    }
  }
  plan.startanker = plan.sichtung && Number.isFinite(plan.sichtung.totalPlaytime)
    ? plan.sichtung.totalPlaytime : 0;

  // Kette. WIEDERAUFNAHME: ist ein Ort schon vollstaendig archiviert (oben
  // weder Kettendateien noch Index, im Archiv ein Index), wird das Archiv
  // geprueft statt des leeren Orts, und das Verschieben entfaellt.
  plan.ketten = ctx.orte.map((o) => {
    const k = pruefeKette(o, ctx.prefix, alt.identifier);
    const archiv = path.join(o, altEpoche);
    if (k.vorhanden && !k.index && !k.dateien.length && fs.existsSync(path.join(archiv, INDEX_NAME))) {
      const a = pruefeKette(archiv, ctx.prefix, alt.identifier);
      a.schonArchiviert = true;
      a.ortOben = o;
      return a;
    }
    return k;
  });
  const primaer = plan.ketten[0];
  if (!primaer.vorhanden || !primaer.zeilen) {
    // LIVE ohne Kette waere ein Widerspruch (dann fehlt das Netz, nicht nur
    // das Archiv). Der Pruefstand darf frisch sein (K11: neuer Dev-Build-Stand).
    const t = "Primaere Ablage " + primaer.ort + " hat keine Kette (" + ctx.prefix + "-Zeilen)";
    if (ctx.art === "TEST") plan.hinweise.push(t + " - Pruefstand, nichts zu archivieren");
    else H(t + " - nichts zu archivieren?");
  }
  for (const k of plan.ketten) {
    if (k.schonArchiviert) {
      plan.hinweise.push(k.ortOben + ": schon archiviert (" + k.ort + ") - Wiederaufnahme");
      for (const f of k.fehler) H(k.ort + ": " + f);
      continue;
    }
    for (const f of k.fehler) H(k.ort + ": " + f);
    if (k.shaFalsch.length) {
      plan.hinweise.push(k.ort + ": " + k.shaFalsch.length + " Datei(en) mit abweichender sha256 (archiviert"
        + " wird trotzdem, nichts geht verloren): " + k.shaFalsch.slice(0, 3).join(", ")
        + (k.shaFalsch.length > 3 ? ", ..." : ""));
    }
    if (k.fremdeIdentifier) plan.hinweise.push(k.ort + ": " + k.fremdeIdentifier + " Indexzeile(n) mit anderem identifier");
    const archiv = path.join(k.ort, altEpoche);
    if (fs.existsSync(path.join(archiv, INDEX_NAME))) {
      if (k.index) H(archiv + " hat schon einen INDEX.tsv, und " + k.ort + " auch - von Hand klaeren");
      else plan.hinweise.push(archiv + " existiert schon (Wiederaufnahme): fehlende Dateien werden nachgezogen");
    }
  }
  if (primaer.juengste) {
    const j = primaer.juengste;
    const alterH = (Date.now() - Date.parse(j.mtime)) / 3600000;
    plan.hinweise.push("Juengster gesicherter Stand: " + j.datei + " (BN" + j.bitNode + " L" + j.lauf + ", "
      + (j.totalPlaytime / 3.6e6).toFixed(2) + " h, " + alterH.toFixed(1) + " h alt)");
    if (alterH > 2) {
      plan.hinweise.push("ACHTUNG: der juengste Stand ist " + alterH.toFixed(1) + " h alt. Lief das alte Spiel"
        + " danach noch, fehlt dieser Fortschritt in der Kette.");
    }
  }

  // Datenordner. Wiederaufnahme: liegt dort NUR das Archiv, ist der Schritt
  // schon gelaufen. Liegt daneben etwas Neues, hat inzwischen jemand
  // geschrieben (eine Bruecke?) - das klaert ein Mensch.
  plan.dataArchiv = path.join(ctx.dataDir, altEpoche);
  plan.dataEintraege = fs.existsSync(ctx.dataDir) ? fs.readdirSync(ctx.dataDir) : [];
  plan.dataSchonVerschoben = false;
  if (fs.existsSync(plan.dataArchiv)) {
    const ohneKonfig = plan.dataEintraege.filter((n) => !KONFIG_DATEIEN.includes(n));
    if (ohneKonfig.length === 1 && ohneKonfig[0] === altEpoche) {
      plan.dataSchonVerschoben = true;
      plan.hinweise.push(ctx.dataDir + ": schon nach " + plan.dataArchiv + " verschoben - Wiederaufnahme");
    } else {
      H(plan.dataArchiv + " existiert schon, und daneben liegt anderes - von Hand klaeren");
    }
  }
  if (fs.existsSync(ctx.dataDir + "." + altEpoche + "-uebergabe")) {
    H(ctx.dataDir + "." + altEpoche + "-uebergabe existiert (abgebrochene Uebergabe) - von Hand klaeren");
  }

  // Schritte
  for (const k of plan.ketten) {
    if (!k.vorhanden || k.schonArchiviert) continue;
    plan.schritte.push("Kette archivieren: " + k.dateien.length + " " + ctx.prefix + "-Datei(en)"
      + (k.index ? " + " + INDEX_NAME : "") + "  " + k.ort + " -> " + path.join(k.ort, altEpoche));
  }
  if (!plan.dataSchonVerschoben) {
    plan.schritte.push("Datenordner: " + ctx.dataDir + " -> " + plan.dataArchiv
      + " (" + plan.dataEintraege.length + " Eintraege)");
  }
  const konfig = KONFIG_DATEIEN.filter((n) => fs.existsSync(path.join(plan.dataSchonVerschoben ? plan.dataArchiv : ctx.dataDir, n)));
  plan.konfig = konfig;
  if (konfig.length) {
    plan.schritte.push("Konfiguration zurueck in den neuen Datenordner kopieren: " + konfig.join(", ")
      + " (Sperrliste, kein Zustand - ohne sie schiebt die Bruecke ins frische Spiel, was in Lauf 1 gesperrt war)");
  }
  if (ctx.art === "LIVE") {
    try {
      const getrackt = execFileSync("git", ["ls-files", "--", "data"], { cwd: ctx.root, encoding: "utf8" })
        .split(/\r?\n/).filter(Boolean).map((f) => f.replace(/^data\//, ""));
      const andere = getrackt.filter((f) => !KONFIG_DATEIEN.includes(f));
      if (andere.length) {
        plan.hinweise.push("In data/ liegen getrackte Dateien ausser der Konfiguration (" + andere.join(", ")
          + ") - nach der Uebergabe zeigt git status sie als geloescht, nicht committen (git add -A / commit -a!).");
      }
    } catch { /* kein git - nur ein Hinweis weniger */ }
  }
  plan.schritte.push("Identitaet schreiben: " + ctx.identitaetDatei + "  Epoche " + zielEpoche
    + ", identifier " + (pin || "?") + ", Startanker " + plan.startanker + " ms");
  return plan;
}

// ---------------------------------------------------------------------------
// Ausfuehren
// ---------------------------------------------------------------------------

function verschiebeKette(k, prefix, altEpoche, protokoll) {
  const ziel = path.join(k.ort, altEpoche);
  fs.mkdirSync(ziel, { recursive: true });
  const namen = fs.readdirSync(k.ort).filter((f) => f.startsWith(prefix)
    && fs.statSync(path.join(k.ort, f)).isFile());
  // Erst die Dateien, dann der Index: bricht es dazwischen ab, liegt der
  // Index noch oben, und ein zweiter Lauf zieht nach (Wiederaufnahme).
  for (const f of namen) {
    const nach = path.join(ziel, f);
    if (fs.existsSync(nach)) throw new Error("Ziel existiert schon: " + nach);
    fs.renameSync(path.join(k.ort, f), nach);
  }
  protokoll.push(namen.length + " Datei(en) nach " + ziel);
  const idx = path.join(k.ort, INDEX_NAME);
  if (fs.existsSync(idx)) {
    fs.renameSync(idx, path.join(ziel, INDEX_NAME));
    protokoll.push(INDEX_NAME + " nach " + ziel);
  }
  return { ziel, anzahl: namen.length };
}

export async function fuehreAus(plan) {
  const { ctx } = plan;
  const protokoll = [];
  const jetzt = new Date().toISOString();
  const archive = [];
  try {
    // 2. Kette
    for (const k of plan.ketten) {
      if (!k.vorhanden) continue;
      if (k.schonArchiviert) {
        archive.push(k.ort);
        protokoll.push("schon archiviert: " + k.ort);
        continue;
      }
      const a = verschiebeKette(k, ctx.prefix, plan.altEpoche, protokoll);
      // Gegenprobe am neuen Ort: die juengste Sicherung muss dort lesbar und
      // mit derselben sha256 liegen.
      if (k.juengste) {
        const p = path.join(a.ziel, k.juengste.datei);
        if (!fs.existsSync(p)) throw new Error("nach dem Verschieben fehlt " + p);
        if (k.juengste.sha256 && sha256Datei(p) !== k.juengste.sha256) {
          throw new Error("nach dem Verschieben passt die sha256 von " + p + " nicht mehr");
        }
      }
      const manifest = {
        epoche: plan.altEpoche,
        identifier: plan.alt.identifier,
        archiviertAm: jetzt,
        von: k.ort,
        dateien: a.anzahl,
        indexZeilen: k.zeilen,
        shaGeprueft: k.shaOk,
        shaAbweichend: k.shaFalsch,
        juengste: k.juengste,
        hinweis: "Archiv der Sicherungskette " + plan.altEpoche + ". Von rotiere() und der Ankersuche"
          + " nicht gelesen. Pruefen: node tools/backup-check.js <datei> --expect-id "
          + plan.alt.identifier + " --expect-port <port> --index " + path.join(a.ziel, INDEX_NAME),
      };
      fs.writeFileSync(path.join(a.ziel, "ARCHIV.json"), JSON.stringify(manifest, null, 1), "utf8");
      archive.push(a.ziel);
    }

    // 3. Datenordner - als Ganzes umbenennen: haelt ein anderer Prozess eine
    // Datei offen, schlaegt die Umbenennung fehl, BEVOR etwas bewegt ist.
    if (plan.dataSchonVerschoben) {
      protokoll.push("Datenordner schon verschoben: " + plan.dataArchiv);
    } else if (fs.existsSync(ctx.dataDir)) {
      const zwischen = ctx.dataDir + "." + plan.altEpoche + "-uebergabe";
      if (fs.existsSync(zwischen)) throw new Error(zwischen + " existiert schon");
      fs.renameSync(ctx.dataDir, zwischen);
      fs.mkdirSync(ctx.dataDir, { recursive: true });
      fs.renameSync(zwischen, plan.dataArchiv);
      protokoll.push("Datenordner nach " + plan.dataArchiv);
    } else {
      fs.mkdirSync(ctx.dataDir, { recursive: true });
      protokoll.push("Datenordner war leer/fehlte - neu angelegt");
    }

    // 3b. Konfiguration zurueck (Kopie, das Archiv behaelt ihr Original).
    for (const n of KONFIG_DATEIEN) {
      const quelle = path.join(plan.dataArchiv, n);
      const ziel = path.join(ctx.dataDir, n);
      if (fs.existsSync(quelle) && !fs.existsSync(ziel)) {
        fs.copyFileSync(quelle, ziel);
        protokoll.push("Konfiguration " + n + " in den neuen Datenordner kopiert");
      }
    }

    // 4. Identitaet - als letzter Schritt und atomar (tmp + rename).
    const vorgaenger = [];
    if (plan.alt.aktiv) {
      try {
        const j = JSON.parse(fs.readFileSync(ctx.identitaetDatei, "utf8"));
        if (Array.isArray(j.vorgaenger)) vorgaenger.push(...j.vorgaenger);
      } catch {
        // die Pruefung oben hat die Datei schon gelesen
      }
    }
    vorgaenger.push({
      epoche: plan.altEpoche,
      identifier: plan.alt.identifier,
      bis: jetzt,
      sicherungsArchiv: archive,
      datenArchiv: plan.dataArchiv,
      letzterStand: plan.ketten[0] && plan.ketten[0].juengste
        ? {
          datei: plan.ketten[0].juengste.datei,
          bitNode: plan.ketten[0].juengste.bitNode,
          lauf: plan.ketten[0].juengste.lauf,
          totalPlaytime: plan.ketten[0].juengste.totalPlaytime,
        }
        : null,
    });
    const inhalt = {
      format: 1,
      epoche: plan.zielEpoche,
      identifier: plan.pin,
      seit: jetzt,
      anker: {
        totalPlaytime: plan.startanker,
        quelle: plan.sichtung
          ? "Abweisung im Brueckenprotokoll " + plan.sichtung.ts
          : "keine Sichtung (--ohne-sichtung) - Epochenbeginn 0",
      },
      vorgaenger,
      hinweis: "Nur tools/lauf2-uebergabe.js schreibt diese Datei. Die Bruecke liest sie beim Start"
        + " (sync/instanz.js). Kaputt = Bruecke startet nicht. Fehlt sie, gilt wieder Lauf 1.",
    };
    fs.mkdirSync(path.dirname(ctx.identitaetDatei), { recursive: true });
    const tmp = ctx.identitaetDatei + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(inhalt, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, ctx.identitaetDatei);
    // Gegenprobe mit genau dem Lader, den die Bruecke benutzt.
    const neu = ladeIdentitaet(ctx.identitaetDatei, ctx.vorgabeIdentifier);
    if (neu.fehler || neu.identifier !== plan.pin || neu.epoche !== plan.zielEpoche) {
      throw new Error("die geschriebene Identitaetsdatei liest sich falsch: " + JSON.stringify(neu));
    }
    protokoll.push("Identitaet geschrieben: " + ctx.identitaetDatei);

    // Spur im neuen Datenordner (dort sucht man nach einem Vorfall zuerst).
    fs.writeFileSync(path.join(ctx.dataDir, "uebergabe-" + plan.zielEpoche + ".json"),
      JSON.stringify({ am: jetzt, von: plan.altEpoche, nach: plan.zielEpoche, identifier: plan.pin,
        protokoll }, null, 1), "utf8");
    return { ok: true, protokoll };
  } catch (e) {
    return { ok: false, protokoll, fehler: e.message };
  }
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------

function zeigePlan(plan, ausfuehren) {
  const c = plan.ctx;
  console.log("");
  console.log("=== Lauf-Uebergabe der Bruecke [" + c.art + "] " + (ausfuehren ? "AUSFUEHREN" : "TROCKENLAUF") + " ===");
  console.log("  Identitaet  " + c.identitaetDatei);
  if (plan.alt) {
    console.log("  laufend     Epoche " + plan.altEpoche + ", identifier " + plan.alt.identifier
      + " (" + plan.alt.quelle + ")");
  }
  console.log("  neu         Epoche " + plan.zielEpoche + ", identifier " + (plan.pin || "?"));
  if (plan.ketten) {
    for (const k of plan.ketten) {
      console.log("  Kette       " + k.ort + ": " + (k.vorhanden
        ? k.dateien.length + " Dateien, " + k.zeilen + " Indexzeilen, sha256 ok " + k.shaOk
          + ", abweichend " + k.shaFalsch.length + ", ohne Zeile " + k.ohneZeile.length
        : "fehlt"));
    }
  }
  for (const h of plan.hinweise) console.log("  Hinweis     " + h);
  if (plan.schritte.length) {
    console.log("");
    console.log("  Plan:");
    plan.schritte.forEach((s, i) => console.log("    " + (i + 1) + ". " + s));
  }
  if (plan.hindernisse.length) {
    console.log("");
    console.log("  HINDERNISSE - es wird nichts veraendert:");
    for (const h of plan.hindernisse) console.log("    - " + h);
  }
  console.log("");
}

async function main() {
  const argv = process.argv.slice(2);
  const ausfuehren = argv.includes("--ausfuehren");
  let ctx;
  try {
    ctx = baueKontext(argv);
  } catch (e) {
    console.log("  AUFRUFFEHLER: " + e.message);
    return 1;
  }
  const plan = await plane(argv, ctx);
  zeigePlan(plan, ausfuehren);
  if (plan.bereitsErledigt) return 0;
  if (plan.hindernisse.length) return 2;
  if (!ausfuehren) {
    console.log("  Trockenlauf ohne Hindernis. Ausfuehren mit --ausfuehren.");
    console.log("");
    return 0;
  }
  const r = await fuehreAus(plan);
  for (const z of r.protokoll) console.log("  erledigt    " + z);
  if (!r.ok) {
    const jetzt = ladeIdentitaet(ctx.identitaetDatei, ctx.vorgabeIdentifier);
    console.log("");
    console.log("  FEHLER: " + r.fehler);
    console.log("  Identitaetsdatei jetzt: " + (jetzt.fehler ? "UNGUELTIG (" + jetzt.fehler + ")"
      : "Epoche " + jetzt.epoche + ", identifier " + jetzt.identifier + " (" + jetzt.quelle + ")"));
    console.log("  Steht dort noch der alte identifier, weist die Bruecke das neue Spiel weiter ab - nichts verloren.");
    console.log("  Erneut aufrufen setzt fort (Wiederaufnahme); doku/spielstand-schutz.md, Lauf-2-Uebergabe.");
    console.log("");
    return 1;
  }
  // Nachkontrolle: hat eine Neustartschleife waehrenddessen eine Bruecke
  // hochgezogen, laeuft die mit der ALTEN Identitaet im Speicher.
  const nachher = await brueckeLaeuft(ctx);
  if (nachher.length) {
    console.log("");
    console.log("  WARNUNG: jetzt laeuft eine Bruecke (" + nachher.join("; ") + ").");
    console.log("  Sie hat die alte Identitaet geladen - beenden (samt Neustartschleife) und neu starten.");
  }
  console.log("");
  console.log("  FERTIG. Naechste Schritte:");
  if (ctx.art === "LIVE") {
    console.log("    1. git add sync/identitaet.json && git commit -m \"Lauf-2-Uebergabe: identifier " + plan.pin + "\"");
    console.log("    2. Bruecke wie gewohnt starten; im Protokoll muss 'Identitaet: Epoche " + plan.zielEpoche
      + "' und danach 'Verifiziert in ...' fuer das neue Spiel stehen.");
    // Zusammenbau 14.11.2026: Die Bruecke kennt die Epoche aus sync/identitaet.json,
    // das Spiel sieht sync/ nicht. Die Route waehlt der Bot ueber home:epoche.json
    // (src/lib/route.js, leseEpoche/ladeRoute) - die Datei setzt dieses Werkzeug
    // bewusst NICHT, sie geht per Commit nach src/ (Bruecke schiebt sie).
    console.log("    3. Route der neuen Epoche: src/epoche.json mit {\"epoche\": \"" + plan.zielEpoche
      + "\"} anlegen und committen (fehlt sie, faehrt der Bot die Lauf-1-Route route.json).");
    // Die Leser sind seit dem Zusammenbau Voraussetzung (plane: Hindernis), kein Hinweis mehr.
    if (plan.zielEpoche !== "lauf2") {
      console.log("       Hinweis: src/lib/route.js kennt nur lauf1/lauf2; fuer " + plan.zielEpoche
        + " liefert ladeRoute eine leere Route (kein Sprung), bis ROUTE_DATEI erweitert ist.");
    }
  } else if (ctx.art === "TEST") {
    console.log("    TEST-Bruecke mit --identitaet " + path.relative(ctx.root, ctx.identitaetDatei) + " starten.");
  }
  console.log("");
  return 0;
}

// Nur als Programm ausfuehren, nicht beim Import durch den Test.
const alsProgramm = !!process.argv[1] && pfadGleich(process.argv[1], fileURLToPath(import.meta.url));
if (alsProgramm) {
  main().then((code) => process.exit(code), (e) => {
    console.log("  UNERWARTETER FEHLER: " + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
