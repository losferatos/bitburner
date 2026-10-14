/**
 * Referenzkurve wird nach einem schnelleren, abgeschlossenen Lauf nachgezogen
 * (Befund 05.10.2026: BN2.3 rechnete mit BN2.1 = 29,1 h statt BN2.2 = 19,8 h).
 *
 * Gegen den alten Stand ROT: tools/lib/kurvepflege.js fehlt, checkin.js ruft
 * nichts auf.
 *
 * Aufruf: node tools/test-kurvepflege.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

console.log("\n=== Referenzkurve nachziehen ===\n");

const lib = path.join(ROOT, "tools", "lib", "kurvepflege.js");
let kurveErsetzen = null;
if (fs.existsSync(lib)) ({ kurveErsetzen } = await import(pathToFileURL(lib).href));
pruefe("tools/lib/kurvepflege.js vorhanden", typeof kurveErsetzen === "function");

const kurve = (start, max, dauerH, n = 30) => ({
  rangSpanne: [start, max], dauerH,
  punkte: Array.from({ length: n }, (_, i) => ({ h: (dauerH * i) / (n - 1), rang: start + ((max - start) * i) / (n - 1) })),
});
const BN21 = kurve(68, 488516, 29.087);
const BN22 = kurve(6, 550010, 19.79);

if (kurveErsetzen) {
  pruefe("BN2.2 (19,8 h) ersetzt BN2.1 (29,1 h) - der Befund", kurveErsetzen(BN21, BN22).ersetzen);
  pruefe("BN2.1 ersetzt BN2.2 nicht (langsamer)", !kurveErsetzen(BN22, BN21).ersetzen);
  pruefe("gleich schnell: kein Ersatz", !kurveErsetzen(BN22, kurve(6, 550010, 19.78)).ersetzen);
  pruefe("Bruchstueck ohne Anlauf (Start 5.297) verworfen", !kurveErsetzen(BN21, kurve(5297, 4560000, 3)).ersetzen);
  pruefe("Lauf ohne Ausgang (max 48.635) verworfen", !kurveErsetzen(BN21, kurve(6, 48635, 2)).ersetzen);
  pruefe("Kandidat mit unter 5 Punkten verworfen", !kurveErsetzen(BN21, kurve(6, 550010, 10, 4)).ersetzen);
  pruefe("fehlende alte Kurve: vollstaendiger Kandidat wird genommen", kurveErsetzen(null, BN22).ersetzen);
  pruefe("unvollstaendige alte Kurve: vollstaendiger Kandidat wird genommen", kurveErsetzen(kurve(6, 48635, 2), BN21).ersetzen);
}

// Bonuszeit-Vorrat (05.10.2026): BN2.2, Sicherung 04:49 mit 98.281 Zyklen.
let effektiveSpielzeit = null;
if (fs.existsSync(lib)) ({ effektiveSpielzeit } = await import(pathToFileURL(lib).href));
pruefe("effektiveSpielzeit vorhanden", typeof effektiveSpielzeit === "function");
if (effektiveSpielzeit) {
  pruefe("98.281 Zyklen = 5,46 h werden abgezogen",
    Math.abs((1116.25 * 3.6e6 - effektiveSpielzeit(1116.25 * 3.6e6, 98281)) / 3.6e6 - 5.4601) < 0.001);
  pruefe("ohne Vorrat unveraendert", effektiveSpielzeit(1000, 0) === 1000 && effektiveSpielzeit(1000, undefined) === 1000);
  pruefe("negativer Vorrat zaehlt nicht", effektiveSpielzeit(1000, -5) === 1000);
}
const bauer = fs.readFileSync(path.join(ROOT, "tools", "rangkurve-bauen.js"), "utf8");
pruefe("rangkurve-bauen.js zieht den Vorrat bei Sicherungen ab",
  bauer.includes("effektiveSpielzeit(p.totalPlaytime, sc)"));

const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
const iAuf = checkin.indexOf("kurveAuffrischen(ROOT, knoten)");
const iLes = checkin.indexOf("restzeitAusKurve(knoten, rang)");
pruefe("checkin.js frischt die Kurve auf", iAuf >= 0);
pruefe("... und zwar VOR dem ersten Lesen (Cache in lib/rangkurve.js)", iAuf >= 0 && iLes > iAuf);

// Ab Knotenstart vergleichen (11.10.2026): BN11.1 17,8 h + 10,7 h Anlauf,
// BN11.2 22,5 h + 1,0 h Anlauf. Der zweite ist schneller.
if (kurveErsetzen) {
  const mitStart = (k, off) => ({ ...k, nullpunkt: { hSeitKnotenstart: off } });
  const BN111 = mitStart(kurve(215, 454620, 17.784), 10.725);
  const BN112 = mitStart(kurve(12, 452560, 22.511), 1.025);
  pruefe("BN11.2 (23,5 h ab Knotenstart) ersetzt BN11.1 (28,5 h)", kurveErsetzen(BN111, BN112).ersetzen);
  pruefe("BN11.1 ersetzt BN11.2 nicht", !kurveErsetzen(BN112, BN111).ersetzen);
  const loch = { ...BN112, punkte: [{ h: 0, rang: 46 }, { h: 0.1, rang: 60 }, { h: 0.2, rang: 80 }, { h: 11, rang: 28767 }, { h: 12.7, rang: 184320 }, { h: 13.1, rang: 458657 }] };
  pruefe("Kandidat mit 10,8 h Messloch ersetzt nichts (BN2.3-Fall)", !kurveErsetzen(BN111, loch).ersetzen);
  // Altkurve beginnt nach dem Anlauf (BN6.1 ab Rang 80.340): ein Kandidat
  // ab Rang 5 ersetzt sie, auch wenn er laenger dauert (14.10.2026).
  const BN61 = kurve(80340, 452411, 10.044);
  const BN62 = mitStart(kurve(5, 466026, 26.735), 0.716);
  pruefe("Kandidat mit Anlauf ersetzt eine Kurve ohne Anlauf (BN6.2 statt BN6.1)", kurveErsetzen(BN61, BN62).ersetzen);
  pruefe("Abstand nur auf einer Seite bekannt: Vergleich ab Rangpunkt wie bisher",
    !kurveErsetzen(kurve(215, 454620, 17.784), BN112).ersetzen);
}

// Der Bauer waehlt unter fertigen Laeufen den schnellsten, nicht den hoechsten.
// Synthetischer Knoten 99 in einer Wegwerf-Wurzel mit echten gz-Sicherungen.
{
  const os = await import("node:os");
  const { gzipSync } = await import("node:zlib");
  const { execFileSync } = await import("node:child_process");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kurvepflege-"));
  try {
    fs.mkdirSync(path.join(tmp, "tools", "lib"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "backups"));
    fs.mkdirSync(path.join(tmp, "data"));
    fs.copyFileSync(path.join(ROOT, "tools", "rangkurve-bauen.js"), path.join(tmp, "tools", "rangkurve-bauen.js"));
    fs.copyFileSync(lib, path.join(tmp, "tools", "lib", "kurvepflege.js"));
    // Juengster Check-in steht in einem anderen Knoten: beide Laeufe gelten als fertig.
    fs.writeFileSync(path.join(tmp, "data", "checkin.json"), JSON.stringify({ punkte: [{ ts: Date.now(), knoten: 6, spielzeit: 0, rang: 0 }] }));
    const H = 3.6e6;
    const zeilen = ["kopf"];
    const sicherung = (lauf, i, total, seitStart, rang) => {
      const datei = path.join(tmp, "backups", "s" + lauf + "-" + i + ".json.gz");
      const p = { bitNodeN: 99, totalPlaytime: total, playtimeSinceLastBitnode: seitStart,
        bladeburner: { data: { rank: rang, storedCycles: 0 } } };
      fs.writeFileSync(datei, gzipSync(JSON.stringify({ data: { PlayerSave: JSON.stringify({ data: p }) } })));
      zeilen.push(["t", "d", "h", "id", 99, lauf, total, "hourly", 1, datei, datei].join("\t"));
    };
    // Lauf 1: Start bei 0, erster Rang nach 10 h, 400k nach 28 h, endet bei 455.000.
    const l1 = [[10, 200], [13, 2000], [16, 8000], [19, 20000], [22, 60000], [25, 150000], [28, 410000], [28.5, 455000]];
    l1.forEach(([h, r], i) => sicherung(1, i, h * H, h * H, r));
    // Lauf 2: Start bei 30 h, erster Rang nach 1 h, 400k nach 22 h, endet bei 452.000.
    const l2 = [[1, 12], [4, 500], [6, 1000], [9, 4000], [12, 10000], [15, 40000], [18, 100000], [21, 300000], [22, 410000], [23.5, 452000]];
    l2.forEach(([h, r], i) => sicherung(2, i, (30 + h) * H, h * H, r));
    fs.writeFileSync(path.join(tmp, "backups", "INDEX.tsv"), zeilen.join("\n"));
    const out = path.join(tmp, "kurve.json");
    execFileSync(process.execPath, [path.join(tmp, "tools", "rangkurve-bauen.js"), "--knoten", "99", "--mit-sicherungen", "--out", out],
      { cwd: tmp, stdio: "ignore", timeout: 30000 });
    const k = JSON.parse(fs.readFileSync(out, "utf8"));
    pruefe("Bauer nimmt den schnelleren Lauf (Start Rang 12), nicht den hoeheren", k.rangSpanne[0] === 12, JSON.stringify(k.rangSpanne));
    // Dritter, noch schnellerer Lauf mit 9 h Loch: darf nicht gewinnen.
    [[0.5, 30], [9.5, 300000], [10, 420000], [10.5, 430000], [11, 440000]].forEach(([h, r], i) => sicherung(3, i, (60 + h) * H, h * H, r));
    fs.writeFileSync(path.join(tmp, "backups", "INDEX.tsv"), zeilen.join("\n"));
    execFileSync(process.execPath, [path.join(tmp, "tools", "rangkurve-bauen.js"), "--knoten", "99", "--mit-sicherungen", "--out", out + "2"],
      { cwd: tmp, stdio: "ignore", timeout: 30000 });
    pruefe("Lauf mit Messloch gewinnt nicht, auch wenn schneller", JSON.parse(fs.readFileSync(out + "2", "utf8")).rangSpanne[0] === 12);

    // BN6.2-Fall (14.10.2026): Rang flackert am Anfang 5 -> 4 -> 0, und ein
    // Check-in mit roher Spielzeit liegt hinter einer Sicherung mit hoeherem
    // Rang. Beides darf den Lauf nicht zerteilen; der Lauf ist der schnellste.
    [[0.5, 5], [1, 4], [1.5, 0], [2, 273], [4, 1352], [6, 5852], [9, 23520], [11, 46109], [13, 254605],
      [14, 410000], [14.5, 466026]].forEach(([h, r], i) => sicherung(4, i, (100 + h) * H, h * H, r));
    fs.writeFileSync(path.join(tmp, "backups", "INDEX.tsv"), zeilen.join("\n"));
    fs.writeFileSync(path.join(tmp, "data", "checkin.json"), JSON.stringify({ punkte: [
      { ts: Date.now() - 5000, knoten: 99, lauf: 4, spielzeit: (100 + 10) * H, rang: 1366 },
      { ts: Date.now(), knoten: 6, spielzeit: 0, rang: 0 }] }));
    execFileSync(process.execPath, [path.join(tmp, "tools", "rangkurve-bauen.js"), "--knoten", "99", "--mit-sicherungen", "--out", out + "3"],
      { cwd: tmp, stdio: "ignore", timeout: 30000 });
    const k3 = JSON.parse(fs.readFileSync(out + "3", "utf8"));
    pruefe("Rangflackern 5->4->0 und verschobener Check-in zerteilen den Lauf nicht (BN6.2)",
      k3.rangSpanne[0] === 5 && k3.punkte.length === 11, JSON.stringify(k3.rangSpanne) + " / " + k3.punkte.length + " Punkte");
    pruefe("... mit Abstand 1 h zum Knotenstart", Math.abs(k.nullpunkt.hSeitKnotenstart - 1) < 1e-6);
  } catch (e) {
    pruefe("Bauer-Probe lief durch", false, e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
