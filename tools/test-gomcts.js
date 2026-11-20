/**
 * Baumsuche fuer IPvGO: src/lib/gomcts.js (24.10.2026).
 *
 * Faelle:
 *   1. Regel-Engine gegen den Spielcode (tools/goprobe/eich.mjs): Legalitaet,
 *      Brett nach jedem Zug und Flaechenwertung ohne Abweichung. Braucht
 *      reference/ (gitignored) - fehlt es, wird der Fall uebersprungen.
 *   2. Zaehlerueberlauf: stamp/seen sind Int32Array; ein Markenzaehler ueber
 *      2^31 liess chainLibs endlos laufen (im Pruefstand nach ~140 s). Laeuft
 *      in einem Kindprozess mit Frist, weil der alte Fehler haengt statt zu werfen.
 *   3. Sucher: advance haelt das Wurzelbrett gleich dem unabhaengig
 *      nachgespielten Brett; Wurzelkinder respektieren Historie und Sperrliste.
 *   4. Zugwahl: offensichtlicher Schlag, kein eigenes Auge fuellen, Pass ohne Zug.
 *   5. rolloutFast (20.11.2026): gleiche Politik wie rollout() auf dem 19x19-
 *      Startbrett gegen "????????????", Leerliste konsistent, deutlich schneller.
 *
 * Aufruf: node tools/test-gomcts.js [pfad/zu/gomcts.js]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const DATEI = path.resolve(process.argv[2] || path.join(ROOT, "src", "lib", "gomcts.js"));

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(was, ok, zusatz = "") {
  if (ok) { gruen++; console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : "")); }
  else { rot++; fehler.push(was + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}

console.log("\n=== lib/gomcts.js (" + DATEI + ") ===\n");
if (!fs.existsSync(DATEI)) {
  pruefe("gomcts.js vorhanden", false, "fehlt");
  console.log("\nROT: " + rot);
  process.exit(1);
}
const M = await import(pathToFileURL(DATEI).href);

// ---------------------------------------------------------------------------
console.log("-- 1. Regel-Engine gegen den Spielcode --");
{
  const ref = path.join(ROOT, "reference", "bitburner-src", "src", "Go", "boardAnalysis", "goAI.ts");
  if (!fs.existsSync(ref)) {
    console.log("  --    uebersprungen: reference/ fehlt");
  } else {
    const r = spawnSync(process.execPath, ["--no-warnings", "--import", "./tools/goprobe/register.mjs",
      "tools/goprobe/eich.mjs", "120", DATEI], { cwd: ROOT, encoding: "utf8", timeout: 240000 });
    let j = null;
    try { j = JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch { j = null; }
    pruefe("Eichlauf liefert ein Ergebnis", !!j, j ? "" : String(r.stderr).slice(0, 300));
    if (j) {
      pruefe("ueber 5.000 Zuege verglichen", j.zuege > 5000, String(j.zuege));
      pruefe("Legalitaet ohne Abweichung (Wiederholung getrennt)", j.legalAbweichung === 0, JSON.stringify(j.beispiele).slice(0, 300));
      pruefe("Brett nach jedem Zug identisch", j.brettAbweichung === 0);
      pruefe("Flaechenwertung identisch", j.wertungAbweichung === 0);
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- 2. Markenzaehler ueber 2^31 --");
{
  const code = [
    "const M = await import(" + JSON.stringify(pathToFileURL(DATEI).href) + ");",
    "const geo = M._intern.geomOf(7);",
    "geo.mark = 2 ** 31 - 50; if ('seenMark' in geo) geo.seenMark = 2 ** 31 - 50;",
    "const g = new Uint8Array(49); g[0] = 1; g[8] = 2;",
    "const r = M.mctsMove(g, 7, { playouts: 300, seed: 3 });",
    "console.log(JSON.stringify({ ok: true, r, mark: geo.mark }));",
  ].join("\n");
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8", timeout: 20000 });
  let j = null;
  try { j = JSON.parse(String(r.stdout).trim()); } catch { j = null; }
  pruefe("Suche endet trotz Zaehler nahe 2^31 (Frist 20 s)", !!j && j.ok,
    r.error ? String(r.error.code || r.error) : String(r.stderr).slice(0, 200));
  pruefe("Zaehler wurde zurueckgesetzt", !!j && j.mark < 1e9, j ? String(j.mark) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- 3. Sucher: Baumuebernahme --");
{
  const { geomOf, play } = M._intern;
  const n = 7, geo = geomOf(n);
  const CH = [".", "X", "O", "#"];
  const key = (b) => { let s = ""; for (let i = 0; i < b.length; i++) s += CH[b[i]]; return s; };
  let abweichung = 0, illegalWurzel = 0, schritte = 0;
  for (let p = 0; p < 30; p++) {
    const g = new Uint8Array(49); g[6] = 3; g[42] = 3;
    const hist = new Set([key(g)]);
    const s = M.createSearcher(n, { seed: 100 + p, keyOf: key, history: hist });
    s.reset(g, 1, 0);
    const echt = g.slice(); let ko = -1; const koOut = [-1];
    let c = 1;
    for (let k = 0; k < 30; k++) {
      s.setContext({ history: hist });
      s.simulate(Infinity, 60);
      let mv;
      if (c === 1) { const r = s.result(); mv = r.type === "pass" ? -1 : r.i; }
      else {
        const frei = [];
        for (let i = 0; i < 49; i++) { const t = echt.slice(); if (play(geo, t, i, 2, ko, koOut) >= 0) frei.push(i); }
        mv = frei.length ? frei[(p * 7 + k * 13) % frei.length] : -1;
      }
      if (mv >= 0) {
        const t = echt.slice();
        if (play(geo, t, mv, c, ko, koOut) < 0 || (c === 1 && hist.has(key(t)))) { illegalWurzel++; break; }
        echt.set(t); ko = koOut[0];
        hist.add(key(echt));
      } else ko = -1;
      if (!s.advance(mv)) { abweichung++; break; }
      schritte++;
      if (key(s.boardAtRoot()) !== key(echt)) { abweichung++; break; }
      c = 3 - c;
    }
  }
  pruefe("Wurzelbrett folgt dem nachgespielten Brett", abweichung === 0, schritte + " Schritte, " + abweichung + " Abweichungen");
  pruefe("gewaehlte Zuege sind legal und wiederholen keine Stellung", illegalWurzel === 0, String(illegalWurzel));

  // Entscheidender Schlag: Schwarz Spalten 0-3, Weiss Spalten 4-6, nur Punkt
  // 24 (3,3) frei - beide Gruppen in Atari, wer zieht, schlaegt alles.
  const g = new Uint8Array(49);
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) g[x * 7 + y] = y <= 3 ? 1 : 2;
  g[24] = 0;
  const frei = M.mctsMove(g, 7, { playouts: 400, seed: 5 });
  const gesperrt = M.mctsMove(g, 7, { playouts: 400, seed: 5, blocked: new Set([24]) });
  pruefe("Schlag wird gefunden (24)", frei.type === "move" && frei.i === 24, JSON.stringify(frei));
  pruefe("gesperrter Punkt wird nicht gewaehlt", !(gesperrt.type === "move" && gesperrt.i === 24), JSON.stringify(gesperrt));
}

// ---------------------------------------------------------------------------
console.log("\n-- 4. Zugwahl: Augen und Pass --");
{
  // Schwarz besitzt das ganze Brett bis auf zwei Augen: kein Zug fuellt sie.
  const g = new Uint8Array(49).fill(1);
  g[0] = 0; g[48] = 0;
  const r = M.mctsMove(g, 7, { playouts: 200, seed: 1 });
  pruefe("eigene Augen werden nicht gefuellt -> Pass", r.type === "pass", JSON.stringify(r));
  const voll = new Uint8Array(49).fill(1); voll[10] = 3;
  pruefe("kein freier Punkt -> Pass", M.mctsMove(voll, 7, { playouts: 50, seed: 1 }).type === "pass");

  // Falsches Auge (Skeptiker 24.10.): Punkt 24 ist rundum schwarz, aber die
  // schwarze Kette 17 hat nur noch diese Freiheit (sonst rundum weiss).
  const { geomOf, isEye, areaScore } = M._intern;
  const geo = geomOf(7);
  const f = new Uint8Array(49).fill(2);
  f[24] = 0; f[17] = 1; f[23] = 1; f[25] = 1; f[31] = 1;
  f[22] = 0; f[26] = 0; f[30] = 0; f[32] = 0;              // die anderen drei haben Luft
  pruefe("falsches Auge (Kette mit nur dieser Freiheit) gilt nicht als Auge", isEye(geo, f, 24, 1) === false);
  const echt = new Uint8Array(49).fill(1); echt[24] = 0; echt[0] = 0;
  pruefe("echtes Auge bleibt Auge", isEye(geo, echt, 24, 1) === true);

  // Zu grosse leere Gebiete gehoeren niemandem (scoring.ts: mehr als n^2 - 3).
  const duenn = new Uint8Array(49); duenn[24] = 1;
  const sc = areaScore(geo, duenn);
  pruefe("ein Stein auf leerem Brett: 1 Punkt, nicht 49", sc[0] === 1 && sc[1] === 0, JSON.stringify(sc));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- 5. Schnelle Zufallspartie (rolloutFast, 19x19 gegen ????????????) --");
{
  // Startbrett des Gegners "????????????" (tools/goprobe/board-wd.mjs, 20.11.2026):
  // 267 Punkte, 7 weisse Vorgabesteine.
  const rows = ["#####...........###", "####..........#####", "##..........O...###", "#................##",
    "......###......####", ".......###..O....##", "........##........#", "..............#####",
    "...................", "..####.............", "...................", "..............#####",
    "........##...O....#", ".......###.......##", "...O..###...O..####", "#................##",
    "##..O..O........###", "####..........#####", "#####...........###"];
  const n = 19, N = n * n;
  const g0 = new Uint8Array(N);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    const c = rows[x][y]; g0[x * n + y] = c === "X" ? 1 : c === "O" ? 2 : c === "#" ? 3 : 0;
  }
  const { geomOf, rollout, rolloutFast, mulberry, chainLibs } = M._intern;
  pruefe("rolloutFast ist vorhanden", typeof rolloutFast === "function");
  if (typeof rolloutFast === "function") {
    const geo = geomOf(n);
    const R = 400;
    const lauf = (schnell, oppModel) => {
      const rnd = mulberry(11); const b = new Uint8Array(N); const moves = new Int16Array(N);
      let sb = 0, kaputt = 0, tot = 0, summe = 0;
      const t0 = performance.now();
      for (let r = 0; r < R; r++) {
        b.set(g0);
        const sc = schnell ? rolloutFast(geo, b, 1, -1, rnd, null, oppModel, true, 0)
          : rollout(geo, b, 1, -1, rnd, moves, null, oppModel, true, 0);
        sb += sc[0]; summe += sc[0] + sc[1];
        if (schnell) {
          // Leerliste stimmt mit dem Brett ueberein.
          let e = 0;
          for (let i = 0; i < N; i++) {
            if (b[i] === 0) { e++; if (geo.pos[i] < 0 || geo.pos[i] >= geo.ne || geo.emp[geo.pos[i]] !== i) kaputt++; }
            else if (geo.pos[i] !== -1) kaputt++;
          }
          if (e !== geo.ne) kaputt++;
        }
        // Keine Kette ohne Freiheit auf dem Endbrett.
        for (let i = 0; i < N; i++) if ((b[i] === 1 || b[i] === 2) && chainLibs(geo, b, i, 1) === 0) tot++;
      }
      return { schwarz: sb / R, kaputt, tot, ms: (performance.now() - t0) / R, flaeche: summe / R };
    };
    for (const om of [false, true]) {
      const alt = lauf(false, om), neu = lauf(true, om);
      pruefe("Leerliste konsistent, keine tote Kette (oppModel " + om + ")", neu.kaputt === 0 && neu.tot === 0 && alt.tot === 0,
        JSON.stringify({ kaputt: neu.kaputt, tot: neu.tot }));
      // Mittelwert der schwarzen Punkte: Streuung je Partie ~19, Standardfehler
      // bei 400 Stueck ~1 je Seite - 5 Punkte Abstand waeren ein anderer Spieler.
      pruefe("gleiche Politik: schwarze Punkte im Mittel wie rollout() (oppModel " + om + ")",
        Math.abs(alt.schwarz - neu.schwarz) < 5, alt.schwarz.toFixed(1) + " / " + neu.schwarz.toFixed(1));
      pruefe("mindestens dreimal so schnell (oppModel " + om + ")", neu.ms * 3 < alt.ms,
        alt.ms.toFixed(2) + " ms / " + neu.ms.toFixed(2) + " ms");
    }
    // Der Sucher benutzt sie mit opt.fast und liefert einen legalen Zug.
    const z = M.mctsMove(g0, n, { komi: 9.5, seed: 3, fast: true, playouts: 600 });
    pruefe("mctsMove mit fast: legaler Zug auf dem Startbrett", z.type === "move" && g0[z.i] === 0, JSON.stringify(z));
  }
}

console.log("");
if (rot) {
  console.log("ROT: " + rot + " von " + (gruen + rot));
  for (const f of fehler) console.log("  - " + f);
  process.exit(1);
}
console.log("ALLES GRUEN: " + gruen + " Pruefungen");
