/**
 * Ebene 0: Die Sicherungskette, ohne Spiel.
 *
 * Prueft NICHT, ob eine Sicherung gelingt - das taete sie im Zweifel auch mit
 * einem Pruefer, der immer gruen sagt. Geprueft wird, ob der Pruefer bei jedem
 * einzelnen Ablehnungsgrund tatsaechlich ROT wird. Ein Ausschluss gilt nur,
 * wenn das Werkzeug den ausgeschlossenen Fall ueberhaupt anzeigen koennte.
 *
 * Aufruf: node tools/test-backup.js
 * Exit 0 = alles gruen.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import http from "node:http";
import {
  sichere,
  lesenKennwerte,
  pruefeKennwerte,
  letzterEintrag,
  schreibeIndexZeile,
  dateiName,
  rotiere,
  alterJuengsteMin,
} from "../sync/backup.js";
import { ANLAESSE } from "../sync/instanz.js";

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + name + (zusatz ? " - " + zusatz : ""));
  }
}

/** Ein minimaler, aber strukturell echter Spielstand. */
function baueSave(opt = {}) {
  const p = {
    identifier: opt.identifier ?? "197f4d61481686",
    bitNodeN: opt.bitNodeN ?? 10,
    sourceFiles: { ctor: "JSONMap", data: opt.sf ?? [[1, 1], [4, 1], [5, 1], [6, 1], [10, 1]] },
    skills: { hacking: opt.hacking ?? 340 },
    money: opt.money ?? 1e13,
    totalPlaytime: opt.totalPlaytime ?? 1_320_000_000,
    playtimeSinceLastBitnode: 200_000_000,
    playtimeSinceLastAug: 30_000_000,
    lastSave: opt.lastSave ?? 1_788_000_000_000,
    augmentations: opt.augs ?? [{ name: "A" }],
    queuedAugmentations: opt.queued ?? [],
    sleeves: [{}, {}],
    city: "Sector-12",
    factions: ["Bladeburners"],
    bladeburner: { ctor: "Bladeburner", data: { rank: 639.1, numBlackOpsComplete: 0 } },
  };
  const st = {
    RemoteFileApiPort: opt.port ?? 12525,
    AutosaveInterval: 60,
    ExcludeRunningScriptsFromSave: false,
    AutoexecScript: "boot.js",
  };
  return {
    ctor: "BitburnerSaveObject",
    data: { PlayerSave: JSON.stringify({ data: p }), SettingsSave: JSON.stringify(st) },
  };
}

const gz = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o), "utf8"));

console.log("");
console.log("=== Ebene 0: Sicherungskette ===");
console.log("");
console.log("-- lesenKennwerte --");

{
  const k = lesenKennwerte(gz(baueSave()));
  pruefe("liest identifier", k.identifier === "197f4d61481686");
  pruefe("liest BitNode", k.bitNodeN === 10);
  // BN10 mit SF-Stufe 1 ist Lauf 2. Am 04.09.2026 gegen den echten Spielstand
  // geeicht: SF {1:1,4:1,5:1,6:1,10:1} bei bitNodeN 10, protokolliert als Lauf 2.
  pruefe("rechnet Lauf = SF-Stufe + 1", k.lauf === 2, "erhalten " + k.lauf);
  pruefe("liest Bladeburner aus dem PlayerSave", k.bladeburnerRank === 639.1);
  pruefe("liest RFA-Port", k.remoteFileApiPort === 12525);
}
{
  // Erster Lauf eines Knotens: keine SF-Stufe vorhanden -> Lauf 1.
  const k = lesenKennwerte(gz(baueSave({ bitNodeN: 8, sf: [[1, 1]] })));
  pruefe("erster Lauf eines Knotens ist Lauf 1", k.lauf === 1, "erhalten " + k.lauf);
}
{
  // Dritter Lauf: SF-Stufe 2 -> Lauf 3.
  const k = lesenKennwerte(gz(baueSave({ bitNodeN: 6, sf: [[6, 2]] })));
  pruefe("SF-Stufe 2 ergibt Lauf 3", k.lauf === 3, "erhalten " + k.lauf);
}
{
  // Fehlende Default-Felder: Das Spiel laesst sie beim Serialisieren weg.
  // Am 30.08.2026 verschwand so playerReputation und erzeugte NaN.
  const s = baueSave();
  const p = JSON.parse(s.data.PlayerSave);
  delete p.data.augmentations;
  delete p.data.queuedAugmentations;
  delete p.data.factions;
  delete p.data.bladeburner;
  s.data.PlayerSave = JSON.stringify(p);
  let ok = true;
  let k = null;
  try {
    k = lesenKennwerte(gz(s));
  } catch {
    ok = false;
  }
  pruefe("vertraegt fehlende Default-Felder", ok && k && k.augs === 0 && k.bladeburnerRank === null);
}

console.log("");
console.log("-- lesenKennwerte lehnt Unsinn ab --");
{
  let warf = false;
  try {
    lesenKennwerte(Buffer.from("kein gzip"));
  } catch {
    warf = true;
  }
  pruefe("wirft bei falschen Magic-Bytes", warf);
}
{
  let warf = false;
  try {
    lesenKennwerte(zlib.gzipSync(Buffer.from('{"ctor":"WasAnderes"}')));
  } catch {
    warf = true;
  }
  pruefe("wirft bei falschem Klartextanfang", warf);
}
{
  // Abgeschnittene Datei - der haeufigste echte Schadensfall.
  const voll = gz(baueSave());
  let warf = false;
  try {
    lesenKennwerte(voll.subarray(0, Math.floor(voll.length / 2)));
  } catch {
    warf = true;
  }
  pruefe("wirft bei abgeschnittener Datei", warf);
}

console.log("");
console.log("-- pruefeKennwerte: jeder Ablehnungsgrund MUSS rot werden --");
{
  const k = lesenKennwerte(gz(baueSave()));
  pruefe(
    "gruen bei passenden Erwartungen",
    pruefeKennwerte(k, { identifier: "197f4d61481686", port: 12525 }).ok,
  );
  pruefe(
    "(a) falscher identifier -> rot",
    !pruefeKennwerte(k, { identifier: "andere", port: 12525 }).ok,
  );
  pruefe("(b) falscher Port -> rot", !pruefeKennwerte(k, { port: 12526 }).ok);
  pruefe(
    "(c) Rueckwaertssprung in totalPlaytime -> rot",
    !pruefeKennwerte(k, { minPlaytime: k.totalPlaytime + 1 }).ok,
  );
  pruefe(
    "(c) gleiche totalPlaytime -> gruen",
    pruefeKennwerte(k, { minPlaytime: k.totalPlaytime }).ok,
  );
  pruefe("(d) falscher BitNode -> rot", !pruefeKennwerte(k, { bitNode: 6 }).ok);
  pruefe("(d) falscher Lauf -> rot", !pruefeKennwerte(k, { lauf: 3 }).ok);
}
{
  // SEIT 22.09.2026 UMGEKEHRT: wartende Augs machen pre-jump NICHT mehr rot.
  // Ein Sprung leert auch die eingebauten Augs (prestigeSourceFile,
  // PlayerObjectGeneralMethods.ts:174) - die Regel schuetzte nichts, verhinderte
  // aber die Sicherung vor der Tuer (BAUSTELLEN Zeile 237).
  const k = lesenKennwerte(gz(baueSave({ queued: [{ name: "X" }, { name: "Y" }] })));
  pruefe(
    "(e) wartende Augs bei pre-jump -> gruen (kein Sperrgrund mehr)",
    pruefeKennwerte(k, { anlass: "pre-jump" }).ok,
  );
  pruefe(
    "(e) wartende Augs bei hourly -> gruen",
    pruefeKennwerte(k, { anlass: "hourly" }).ok,
  );
}

console.log("");
console.log("-- Dateinamen und Anlass-Erkennung --");
{
  const k = lesenKennwerte(gz(baueSave()));
  const d = new Date(2026, 8, 4, 1, 13);
  for (const anlass of Object.keys(ANLAESSE)) {
    const n = dateiName(k, anlass, "LIVE_", true, d);
    const m = /_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(n);
    pruefe("Anlass '" + anlass + "' aus dem Namen lesbar", m && m[1] === anlass,
      "Name " + n + ", erkannt " + (m ? m[1] : "nichts"));
  }
  pruefe(
    "echter Name vom 04.09. wird erkannt",
    /_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(
      "LIVE_197f4d61481686_BN10L2_2026-09-04T01-13_manual.json.gz",
    )[1] === "manual",
  );
  pruefe(
    "b64-Variante wird erkannt",
    /_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(
      "LIVE_x_BN1L1_2026-09-04T01-13_hourly-b64.json",
    )[1] === "hourly",
  );

  // DER KOLLISIONSZUSATZ DARF DIE ROTATION NICHT BRECHEN (04.09.2026).
  //
  // Zwei Sicherungen derselben Minute trugen bis heute denselben Namen: die
  // zweite ueberschrieb die erste, und der Index bekam zwei Zeilen mit
  // verschiedenen Pruefsummen auf EINE Datei.
  //
  // Der erste Reparaturversuch haengte den Zusatz hinter den Anlass
  // (`..._connect-2.json.gz`) und brach damit `anlassVon`: die Datei hatte
  // keinen Anlass mehr, fiel aus der Rotation und blieb liegen. Gemessen nach
  // einem halben Tag Testlaeufen: 10 rotierte Sicherungen und 79
  // unaufraeumbare. Deshalb steht der Zusatz jetzt am Zeitstempel.
  for (const [anlass, lauf] of [["connect", 2], ["pre-jump", 3], ["hourly", 7]]) {
    const n = dateiName(k, anlass, "LIVE_", true, d, lauf);
    const m = /_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(n);
    pruefe("Lauf " + lauf + ": Anlass '" + anlass + "' bleibt lesbar",
      m && m[1] === anlass, n + " -> " + (m ? m[1] : "nichts"));
    pruefe("  und der Name ist ein anderer als Lauf 1",
      n !== dateiName(k, anlass, "LIVE_", true, d), n);
  }
  pruefe("Lauf 1 traegt keinen Zusatz",
    dateiName(k, "connect", "LIVE_", true, d, 1)
      === dateiName(k, "connect", "LIVE_", true, d),
    "der Normalfall darf sich nicht aendern");
}

console.log("");
console.log("-- letzterEintrag nimmt das Maximum, nicht die letzte Zeile --");
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bbtest-"));
  schreibeIndexZeile(tmp, { ts: "1", datei: "LIVE_a.json.gz", totalPlaytime: 500 });
  schreibeIndexZeile(tmp, { ts: "2", datei: "LIVE_b.json.gz", totalPlaytime: 900 });
  // Nebenlaeufig geschrieben, kleinerer Wert als letzte Zeile:
  schreibeIndexZeile(tmp, { ts: "3", datei: "LIVE_c.json.gz", totalPlaytime: 700 });
  const l = letzterEintrag(tmp, "LIVE_");
  pruefe("nimmt den groessten totalPlaytime-Wert", l && Number(l.totalPlaytime) === 900,
    "erhalten " + (l ? l.totalPlaytime : "null"));
  schreibeIndexZeile(tmp, { ts: "4", datei: "TEST_d.json.gz", totalPlaytime: 99999 });
  const l2 = letzterEintrag(tmp, "LIVE_");
  pruefe("ignoriert TEST_-Zeilen bei Praefix LIVE_", l2 && Number(l2.totalPlaytime) === 900);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("");
console.log("-- Rotation --");
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bbrot-"));
  const inhalt = gz(baueSave());
  let n = 0;
  const lege = (anlass, anzahl) => {
    for (let i = 0; i < anzahl; i++) {
      const f = path.join(
        tmp,
        "LIVE_197f4d61481686_BN10L2_2026-09-0" + ((n % 9) + 1) + "T0" + (n % 10) + "-0" + (i % 10) + "_" + anlass + ".json.gz",
      );
      fs.writeFileSync(f, inhalt);
      // Alter staffeln, damit die Reihenfolge bestimmt ist.
      const t = new Date(Date.now() - (1000 - n) * 60000);
      fs.utimesSync(f, t, t);
      n++;
    }
  };
  lege("hourly", 60);
  lege("pre-jump", 5);
  lege("pre-install", 4);
  lege("emergency", 3);
  lege("pre-hotswap", 30);
  lege("connect", 20);
  lege("manual", 40);

  rotiere(tmp, "LIVE_");
  const da = fs.readdirSync(tmp);
  const zaehle = (a) =>
    da.filter((f) => (/_((?:pre-)?[a-z]+)(?:-b64)?\.json(?:\.gz)?$/.exec(f) || [])[1] === a).length;

  pruefe("hourly auf 48 gedeckelt", zaehle("hourly") === 48, "erhalten " + zaehle("hourly"));
  pruefe("pre-hotswap auf 20 gedeckelt", zaehle("pre-hotswap") === 20, "erhalten " + zaehle("pre-hotswap"));
  pruefe("connect auf 10 gedeckelt", zaehle("connect") === 10, "erhalten " + zaehle("connect"));
  pruefe("manual auf 30 gedeckelt", zaehle("manual") === 30, "erhalten " + zaehle("manual"));
  pruefe("pre-jump UNANGETASTET", zaehle("pre-jump") === 5, "erhalten " + zaehle("pre-jump"));
  pruefe("pre-install UNANGETASTET", zaehle("pre-install") === 4, "erhalten " + zaehle("pre-install"));
  pruefe("emergency UNANGETASTET", zaehle("emergency") === 3, "erhalten " + zaehle("emergency"));

  const alter = alterJuengsteMin(tmp, "LIVE_");
  pruefe("alterJuengsteMin liefert eine Zahl", typeof alter === "number" && alter >= 0);
  pruefe("alterJuengsteMin ist null bei leerem Ort", alterJuengsteMin(path.join(tmp, "gibtsnicht")) === null);

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("");
console.log("-- sichere(): Epochenpraefix (Z1, Lauf-2-Uebergabe) --");
{
  // Ein Wegwerf-Server spielt die Bruecke: /api/rpc?method=getSaveFile.
  // Port vom Betriebssystem, nie 8795.
  let aktuell = null;
  const srv = http.createServer((req, res) => {
    // Ohne "close" haelt fetch die Verbindung offen, und process.exit am Ende
    // trifft unter Windows einen schliessenden Handle (libuv-Assertion,
    // Exit != 0 trotz gruen - gemessen 14.11.2026).
    res.setHeader("connection", "close");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ result: { save: aktuell.toString("latin1"), binary: true, identifier: "x" } }));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const dashPort = srv.address().port;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bbepoche-"));
  const L1 = "197f4d61481686";
  const NEU = "abc123def456";
  const MIN = 60000;

  // Oben liegt noch die Lauf-1-Kette: 12 connect-Sicherungen und ein Index
  // mit 2.000 h (der Fall "Archiv vergessen" oder "halb gelaufen").
  const alt = gz(baueSave({ identifier: L1, totalPlaytime: 2000 * 3600000 }));
  for (let i = 0; i < 12; i++) {
    const f = "LIVE_" + L1 + "_BN8L3_2026-11-0" + (i % 9 + 1) + "T0" + (i % 10) + "-00_connect.json.gz";
    fs.writeFileSync(path.join(tmp, f), alt);
    const t = new Date(Date.now() - (100 - i) * 60000);
    fs.utimesSync(path.join(tmp, f), t, t);
    schreibeIndexZeile(tmp, { ts: "t" + i, datei: f, identifier: L1, totalPlaytime: 2000 * 3600000 });
  }
  const zaehleL1 = () => fs.readdirSync(tmp).filter((f) => f.startsWith("LIVE_" + L1 + "_")).length;

  // 1. Standardpfad (ohne Epochenpraefix): das frische Spiel faellt am
  //    Lauf-1-Anker durch - genau das heutige Verhalten.
  aktuell = gz(baueSave({ identifier: NEU, totalPlaytime: 5 * MIN, bitNodeN: 1, sf: [] }));
  let r = await sichere({ dashPort, anlass: "connect", praefix: "LIVE_", erwartetIdentifier: NEU,
    erwartetPort: 12525, primaer: tmp, spiegel: null });
  pruefe("ohne Epochenpraefix: frisches Spiel gegen Lauf-1-Index abgelehnt (wie heute)",
    !r.ok && r.gruende.some((g) => /Rueckwaertssprung/.test(g)), JSON.stringify(r.gruende));
  pruefe("  und keine Datei geschrieben, keine Lauf-1-Datei geloescht", r.orte.length === 0 && zaehleL1() === 12);

  // 2. Mit Epochenpraefix: nur Zeilen LIVE_<neu>_ zaehlen -> angenommen.
  r = await sichere({ dashPort, anlass: "connect", praefix: "LIVE_", epochenPraefix: "LIVE_" + NEU + "_",
    erwartetIdentifier: NEU, erwartetPort: 12525, primaer: tmp, spiegel: null });
  pruefe("mit Epochenpraefix: frisches Spiel gesichert", r.ok && r.datei.startsWith("LIVE_" + NEU + "_BN1L1_"),
    JSON.stringify(r.gruende) + " " + r.datei);
  pruefe("  Rotation ruehrt die Lauf-1-Dateien nicht an (12 connect > Deckel 10)", zaehleL1() === 12,
    "noch " + zaehleL1());
  pruefe("  Index-Anker der Epoche ist der neue Stand", Number(letzterEintrag(tmp, "LIVE_" + NEU + "_").totalPlaytime) === 5 * MIN);
  pruefe("  der Lauf-1-Anker steht unveraendert daneben", Number(letzterEintrag(tmp, "LIVE_").totalPlaytime) === 2000 * 3600000);

  // 3. Der Riegel bleibt in der Epoche: aeltere Kopie (2 min) faellt durch,
  //    ein fremder identifier auch.
  aktuell = gz(baueSave({ identifier: NEU, totalPlaytime: 2 * MIN, bitNodeN: 1, sf: [] }));
  r = await sichere({ dashPort, anlass: "connect", praefix: "LIVE_", epochenPraefix: "LIVE_" + NEU + "_",
    erwartetIdentifier: NEU, erwartetPort: 12525, primaer: tmp, spiegel: null });
  pruefe("in der Epoche: Rueckwaertssprung abgelehnt", !r.ok && r.gruende.some((g) => /Rueckwaertssprung/.test(g)));
  aktuell = alt;
  r = await sichere({ dashPort, anlass: "connect", praefix: "LIVE_", epochenPraefix: "LIVE_" + NEU + "_",
    erwartetIdentifier: NEU, erwartetPort: 12525, primaer: tmp, spiegel: null });
  pruefe("in der Epoche: Lauf-1-Stand am identifier abgelehnt", !r.ok && r.gruende.some((g) => /identifier/.test(g)));

  // 4. Gegenprobe zum alten Verhalten: OHNE Epochenpraefix haette die
  //    Rotation die Lauf-1-Dateien als aelteste herausgenommen - deshalb
  //    archiviert die Uebergabe sie vorher (5c 3a, Punkt 2).
  aktuell = gz(baueSave({ identifier: L1, totalPlaytime: 2001 * 3600000 }));
  r = await sichere({ dashPort, anlass: "connect", praefix: "LIVE_", erwartetIdentifier: L1,
    erwartetPort: 12525, primaer: tmp, spiegel: null });
  pruefe("Gegenprobe ohne Epochenpraefix: Rotation kappt die Lauf-1-connect auf den Deckel",
    r.ok && fs.readdirSync(tmp).filter((f) => f.startsWith("LIVE_") && f.endsWith("_connect.json.gz")).length === 10,
    r.ok + " / " + fs.readdirSync(tmp).length);

  await new Promise((res) => srv.close(res));
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
// exitCode statt process.exit (14.11.2026): nach dem fetch() in sichere()
// schliesst Node unter Windows noch einen Handle; ein hartes exit() trifft
// ihn ("Assertion failed ... UV_HANDLE_CLOSING") und endet mit Code != 0,
// obwohl alles gruen war. So laeuft die Schleife sauber leer.
process.exitCode = rot ? 1 : 0;
