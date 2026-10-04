// P2b: Eichung des Gang-Rechners gang-p2b-sim.mjs an der echten Gang (NUR LESEN).
//
// A  Momentanraten aller Backups/Live gegen die im Spielstand gespeicherten Raten
// B  Stundenspruenge (Zustand am Anfang -> Zustand am Ende), ECHTER Regler (src/gang.js), inkl.
//    Aufstiegszahl gegen gang-log.txt
// C  Einbau-Schritt (07:05 pre-install -> 07:17): Favor, Aufstiegspunkte x0,95, Rufnullung
// D  Kette ueber mehrere Stunden und den Einbau ohne Neuansatz (03:17 -> Live)
// E  Orchestrator-Messpunkte (07:32:56 und 07:34:41) und Wanduhr gegen Spielzeit
// F  Regler-Gleichheit: lokale Nachbildung planLocal gegen die echte planTasks (0 Abweichungen)
// G  NPC-Macht (AllGangs): Monte Carlo der Quellen-Dynamik gegen den echten Stand nach 1.293 Updates
//
// Aufruf: node tools/audit/gang-p2b-calib.mjs [--live] [--livefile datei.json] [--log gang-log.txt]
//   --live        zusaetzlich frischen Live-Spielstand ueber die Bruecke lesen (getSaveFile, nur lesen)
//   --livefile    gespeicherter Live-Schnappschuss (gang-p2b-live.mjs --out)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "./gang-formulas.mjs";
import * as S from "./gang-p2b-sim.mjs";
import { snapshot, loadBackup, loadLive } from "./gang-p2b-live.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const { fmt, pct } = S;

const args = (() => {
  const a = {};
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) if (v[i].startsWith("--")) { a[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith("--") ? v[++i] : true; }
  return a;
})();

// --- Schnappschuesse ---------------------------------------------------------
const BK = path.join(ROOT, "backups");
const bkFiles = fs.readdirSync(BK).filter((f) => /BN2L1_2026-10-04T0[1-7]-\d\d_(hourly|pre-install)\.json\.gz$/.test(f)).sort();
const snaps = bkFiles.map((f) => ({ f: f.replace(/^LIVE_\w+?_BN2L1_/, "").replace(".json.gz", ""), s: snapshot(loadBackup(path.join(BK, f))) }));
let live = null;
if (args.livefile) live = JSON.parse(fs.readFileSync(args.livefile, "utf8"));
else if (args.live) live = snapshot(await loadLive());
if (live) snaps.push({ f: "LIVE", s: live });

const real = await S.loadRealController();
const out = [];
const say = (...x) => { console.log(...x); };
const rel = (a, b) => (b ? (a / b - 1) * 100 : NaN);
const logText = args.log && fs.existsSync(args.log) ? fs.readFileSync(args.log, "utf8") : null;
const secOf = (hms) => { const [h, m, s] = hms.split(":").map(Number); return h * 3600 + m * 60 + s; };
const ascInLog = (from, to) => (logText ? logText.split("\n").filter((l) => l.includes("AUFSTIEG") && secOf(l.slice(0, 8)) >= secOf(from) && secOf(l.slice(0, 8)) < secOf(to)).length : null);

// ---------------------------------------------------------------------------
say("=== A. Momentanraten: Modell gegen die im Spielstand gespeicherten Raten (je Zyklus)");
say("Stand".padEnd(24), "Mitgl", "Respekt/Zyklus Modell", "Spielstand", "Abw %", "| Wanted/Zyklus Modell", "Spielstand", "Abw %");
let maxA = 0;
for (const { f, s } of snaps) {
  if (!s.gang || !s.members.length) continue;
  const g = { respect: s.gang.respect, wantedLevel: s.gang.wanted, territory: 1 / 7 };
  let r = 0, wd = 0;
  for (const m of s.members) { const t = F.TASKS[m.task] || F.TASKS["Unassigned"]; r += F.respectGain(g, m.lvl, t, 1); wd += F.wantedGain(g, m.lvl, t); }
  if (s.gang.respectGainRate > 0) maxA = Math.max(maxA, Math.abs(rel(r, s.gang.respectGainRate)), Math.abs(rel(wd, s.gang.wantedGainRate)));
  say(f.slice(0, 22).padEnd(24), String(s.members.length).padStart(5), fmt(r, 3).padStart(20), fmt(s.gang.respectGainRate, 3).padStart(10), fmt(rel(r, s.gang.respectGainRate), 3).padStart(7),
    "|", fmt(wd, 4).padStart(20), fmt(s.gang.wantedGainRate, 4).padStart(10), fmt(rel(wd, s.gang.wantedGainRate), 3).padStart(7));
}
say(`-> groesste Abweichung der Momentanrate: ${fmt(maxA, 3)} % (Rest = Erfahrungsschritt nach dem Gewinn, eine Stufe)`);

// ---------------------------------------------------------------------------
const memMax = (w, b) => {
  let dStr = 0, dAsc = 0, dEr = 0;
  for (const mb of b.members) {
    const mw = w.members.find((x) => x.name === mb.name);
    if (!mw) { dStr = Infinity; continue; }
    dStr = Math.max(dStr, Math.abs(mw.lvl.str - mb.lvl.str));
    dAsc = Math.max(dAsc, Math.abs(rel(mw.ascPoints.str, mb.ascPoints.str)) || 0);
    dEr = Math.max(dEr, Math.abs(rel(mw.earnedRespect, mb.earnedRespect)) || 0);
  }
  return { dStr, dAsc, dEr };
};

say("\n=== B. Stundenspruenge mit dem ECHTEN Regler (src/gang.js per data-URL); Anfangszustand = Spielstand, Ende verglichen");
say("Intervall".padEnd(16), "Dauer s", "Respekt Mod|echt|Abw%", "Rep Mod|echt|Abw%", "Wanted Mod|echt|Abw%", "Aufst Mod", "max dStr(Stufen)", "max dAsc%", "max dEarned%");
let maxB = 0;
for (let i = 0; i < snaps.length - 1; i++) {
  const a = snaps[i], b = snaps[i + 1];
  if (a.s.members.length < 3 || a.s.gang.respect < 2) continue;
  const inst = (b.s.slumSnakes.favor ?? 0) > (a.s.slumSnakes.favor ?? 0) + 1;
  if (inst) continue;
  const dt = (b.s.totalPlaytime - a.s.totalPlaytime) / 1000;
  const r = S.run(a.s, { impl: "real" }, { hours: dt / 3600, real, sample: 100 });
  const w = r.w;
  const mm = memMax(w, b.s);
  const lab = a.f.slice(a.f.indexOf("T") + 1, a.f.indexOf("T") + 6) + ">" + b.f.slice(b.f.indexOf("T") + 1, b.f.indexOf("T") + 6);
  const dr = rel(w.respect, b.s.gang.respect), dp = rel(w.rep, b.s.slumSnakes.playerReputation), dw = rel(w.wanted, b.s.gang.wanted);
  maxB = Math.max(maxB, Math.abs(dr), Math.abs(dp), Math.abs(dw));
  const wallA = a.f.includes("T") ? null : null;
  say(lab.padEnd(16), String(Math.round(dt)).padStart(7),
    `${fmt(w.respect / 1e6, 4)}|${fmt(b.s.gang.respect / 1e6, 4)}|${fmt(dr, 3)}`,
    `${fmt(w.rep / 1e3, 2)}|${fmt(b.s.slumSnakes.playerReputation / 1e3, 2)}|${fmt(dp, 3)}`,
    `${fmt(w.wanted / 1e3, 3)}|${fmt(b.s.gang.wanted / 1e3, 3)}|${fmt(dw, 3)}`,
    `${w.ascensions}`, fmt(mm.dStr, 0).padStart(6), fmt(mm.dAsc, 4).padStart(8), fmt(mm.dEr, 4).padStart(8));
}
if (logText) {
  const iv = [["03:17:32", "04:17:32"], ["04:17:32", "05:17:32"], ["05:17:32", "06:17:32"], ["06:17:32", "07:05:36"]];
  say("Aufstiege laut gang-log.txt je Intervall:", iv.map(([x, y]) => `${x.slice(0, 5)}-${y.slice(0, 5)}: ${ascInLog(x, y)}`).join(" | "));
}
say(`-> groesste Abweichung (Respekt, Rep, Wanted) in B: ${fmt(maxB, 3)} %`);

// ---------------------------------------------------------------------------
say("\n=== C. Einbau-Schritt: 07:05 pre-install -> Einbau (Favor, Aufstiegspunkte x0,95, Rufnullung) -> 07:17");
const pre = snaps.find((x) => x.f.includes("pre-install")), post = snaps.find((x) => x.f.includes("07-17_hourly"));
if (pre && post) {
  const dt = (post.s.totalPlaytime - pre.s.totalPlaytime) / 1000;
  // Einbau bei pt 3933032200 (erster Blick von bn4rep nach dem Einbau, data/einbau-uhr.json: 3933032200) minus ~1 s
  const instPt = 3933031000;
  const gH = (instPt - pre.s.totalPlaytime) / 3.6e6;
  const r = S.run(pre.s, { impl: "real" }, { hours: dt / 3600, real, sample: 100, gateH: [gH], noTor: true });
  const w = r.w;
  say("Favor Modell", fmt(w.favor, 4), "echt", fmt(post.s.slumSnakes.favor, 4), "Abw %", fmt(rel(w.favor, post.s.slumSnakes.favor), 4));
  say("Rep nach", fmt(dt, 0), "s: Modell", fmt(w.rep, 0), "echt", fmt(post.s.slumSnakes.playerReputation, 0), "Abw %", fmt(rel(w.rep, post.s.slumSnakes.playerReputation), 3));
  say("Respekt Modell", fmt(w.respect, 0), "echt", fmt(post.s.gang.respect, 0), "Abw %", fmt(rel(w.respect, post.s.gang.respect), 3));
  say("Wanted Modell", fmt(w.wanted, 0), "echt", fmt(post.s.gang.wanted, 0), "Abw %", fmt(rel(w.wanted, post.s.gang.wanted), 3), "| Aufstiege Modell", w.ascensions, "| Log", ascInLog("07:05:36", "07:17:33"));
  const mm = memMax(w, post.s);
  say("max Abw. Mitglieder: Stufe str", fmt(mm.dStr, 0), "| AscPunkte str %", fmt(mm.dAsc, 4), "| earnedRespect %", fmt(mm.dEr, 4));
}

// ---------------------------------------------------------------------------
say("\n=== D. Kette ohne Neuansatz: 03:17 -> (Einbau 07:05) -> Live; ein Lauf, der echte Regler, nichts nachgestellt");
const first = snaps.find((x) => x.f.includes("03-17")), last = snaps[snaps.length - 1];
if (first && last && last.f === "LIVE") {
  const dt = (last.s.totalPlaytime - first.s.totalPlaytime) / 1000;
  const gH = (3933031000 - first.s.totalPlaytime) / 3.6e6;
  const r = S.run(first.s, { impl: "real" }, { hours: dt / 3600, real, sample: 100, gateH: [gH], noTor: true });
  const w = r.w;
  say("Dauer h", fmt(dt / 3600, 3), "| Respekt Modell", fmt(w.respect, 0), "echt", fmt(last.s.gang.respect, 0), "Abw %", fmt(rel(w.respect, last.s.gang.respect), 3));
  say("Rep Modell", fmt(w.rep, 0), "echt", fmt(last.s.slumSnakes.playerReputation, 0), "Abw %", fmt(rel(w.rep, last.s.slumSnakes.playerReputation), 3),
    "| Favor Modell", fmt(w.favor, 3), "echt", fmt(last.s.slumSnakes.favor, 3));
  say("Wanted Modell", fmt(w.wanted, 0), "echt", fmt(last.s.gang.wanted, 0), "Abw %", fmt(rel(w.wanted, last.s.gang.wanted), 3));
  const mm = memMax(w, last.s);
  say("max Abw. Mitglieder: Stufe str", fmt(mm.dStr, 0), "| AscPunkte str %", fmt(mm.dAsc, 4), "| Aufstiege Modell", w.ascensions, "| Log (03:17:32..)", logText ? ascInLog("03:17:32", "23:59:59") : "-");
}

// ---------------------------------------------------------------------------
say("\n=== E. Orchestrator-Messpunkte (07:32:56 und 07:34:41, gang.json) und Wanduhr gegen Spielzeit");
if (post) {
  const pts = [{ lab: "07:32:56", pt: 3934679400, respect: 13310568, rep: 269539, wanted: 43282 }, { lab: "07:34:41", pt: 3934679400 + 98006, respect: 13714121, rep: 288477, wanted: null }];
  for (const p of pts) {
    const dt = (p.pt - post.s.totalPlaytime) / 1000;
    const r = S.run(post.s, { impl: "real" }, { hours: dt / 3600, real, sample: 100 });
    say(p.lab, "Modell Respekt", fmt(r.w.respect, 0), "Messung", fmt(p.respect, 0), "Abw %", fmt(rel(r.w.respect, p.respect), 3),
      "| Rep", fmt(r.w.rep, 0), fmt(p.rep, 0), fmt(rel(r.w.rep, p.rep), 3), "| Wanted", fmt(r.w.wanted, 0), p.wanted ? fmt(p.wanted, 0) : "-");
  }
  say("Hinweis: gang.json stammt aus der letzten Runde der Steuerung, also bis zu 2 s (ein Gang-Takt, ca. 8.200 Respekt) vor dem Zeitstempel -> die -0,06 % sind dieser Versatz.");
  say("Wanduhr gegen Spielzeit (gang.json ts / playtime): 1791091983859 / 3934679400 und 1791094015919 / 3936711400: Wanduhr", 1791094015919 - 1791091983859, "ms, Spielzeit", 3936711400 - 3934679400, "ms (Abw. 60 ms) -> keine Bonuszeit, Wanduhr = Spielzeit.");
}

// ---------------------------------------------------------------------------
say("\n=== F. Regler-Gleichheit: planLocal (workMode respect) gegen die ECHTE planTasks (src/gang.js)");
{
  let n = 0, bad = 0, vig = 0;
  const cfg = { ...S.BASE_CFG, impl: "local" };
  for (const { s } of snaps) {
    if (!s.members.length || s.gang.respect < 2) continue;
    const base = S.makeWorld(s, {});
    for (const wantedMul of [1, 50, 400, 3000]) {
      for (const respMul of [1, 0.2, 0.01]) {
        const w = S.clone ? { ...base, members: base.members.map((m) => ({ ...m, lvl: { ...m.lvl } })) } : base;
        w.wanted = Math.max(2, base.wanted * wantedMul); w.respect = Math.max(2, base.respect * respMul);
        const g = { ...S.gangView(w), wantedPenalty: w.respect / (w.respect + w.wanted) };
        for (const ascMask of [0, 1, 2]) {
          const mem = w.members.map((m, i) => ({ name: m.name, task: m.task, lvl: { ...m.lvl }, ascended: ascMask === 1 ? i % 3 === 0 : ascMask === 2 && i < 2 }));
          const a = real.planTasks(g, mem).assign, b = S.planLocal(w, cfg, g, mem);
          n++; if (Object.keys(a).some((k) => a[k] !== b[k])) bad++;
          if (Object.values(a).includes("Vigilante Justice")) vig++;
        }
      }
    }
  }
  say(`${n} Zustaende verglichen (davon ${vig} mit Vigilante-Zuweisung), ${bad} Abweichungen`);
  // Aufstiegs-Entscheidung: lokal gegen echt ueber alle Mitglieder aller Staende
  let na = 0, ba = 0;
  for (const { s } of snaps) for (const m of s.members) {
    const mem = { exp: m.exp, ascPoints: m.ascPoints, mult: m.mult, lvl: m.lvl };
    const res = F.ascensionResult(mem);
    const phase = real.phaseOf(m.lvl);
    for (const [at, aw] of [[1.3, 2]]) {
      const a = real.shouldAscend(phase, res);
      const fl = (() => { let ls = 0, ws = 0; for (const st of F.STATS) { const wgt = F.TASKS["Terrorism"].w[st]; if (!(wgt > 0)) continue; ls += wgt * Math.log(res[st]); ws += wgt; } return Math.exp(ls / ws); })();
      const b = fl >= (phase === "train" ? at : aw);
      na++; if (a !== b) ba++;
    }
  }
  say(`Aufstiegs-Entscheidung: ${na} Mitglieder-Zustaende, ${ba} Abweichungen (echte shouldAscend gegen lokale Schwellen 1,3/2)`);
}

// ---------------------------------------------------------------------------
say("\n=== G. NPC-Macht (AllGangs): Monte Carlo der Quellen-Dynamik seit der Gruendung (01:01:41) gegen den echten Stand");
if (live) {
  const real0 = live.allGangs;
  const topN = Object.entries(real0).filter(([n]) => n !== "Slum Snakes").sort((a, b) => b[1].power - a[1].power);
  const topP = topN[0][1].power, secP = topN[1][1].power, nReal = topN.filter(([, v]) => v.territory > 0).length;
  const NAMES = ["Slum Snakes", "Tetrads", "The Syndicate", "The Dark Army", "Speakers for the Dead", "NiteSec", "The Black Hand"];
  say("echt:", NAMES.map((n) => `${n.slice(0, 8)} P ${fmt(real0[n].power, 2)} T ${fmt(real0[n].territory, 4)}`).join(" | "));
  const dflt = { "Slum Snakes": { power: 1, territory: 1 / 7 } };
  const N = 400;
  const tops = [], seconds = [], n4 = [], terrShare = [];
  const ticks = Math.round((live.totalPlaytime - 3911196400) / 1000 / 20);
  say("Updates:", ticks, "(Gruendung 01:01:41 = pt ~3.911.196.400 aus Backup 01:17:31 minus 950 s)");
  for (let seed = 1; seed <= N; seed++) {
    const snap0 = { ...live, allGangs: Object.fromEntries(NAMES.map((n) => [n, { power: 1, territory: 1 / 7 }])), members: [], gang: { ...live.gang, storedTerritoryAndPowerCycles: 0, territoryWarfareEngaged: false, territoryClashChance: 0 } };
    const w = S.makeWorld(snap0, { seed, simTerritory: true });
    for (let k = 0; k < ticks * 10; k++) { w.tpCycles += 0; S.tick(w, null); }
    const ps = NAMES.filter((n) => n !== "Slum Snakes").map((n) => w.all[n].power).sort((a, b) => b - a);
    tops.push(ps[0]); seconds.push(ps[1]);
    n4.push(NAMES.filter((n) => n !== "Slum Snakes" && w.all[n].territory > 0).length);
    terrShare.push(w.all["Slum Snakes"].territory);
  }
  const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
  say(`Modell (N=${N}): groesste NPC-Macht P10/P50/P90 = ${fmt(q(tops, 0.1), 0)}/${fmt(q(tops, 0.5), 0)}/${fmt(q(tops, 0.9), 0)} (echt: ${fmt(topP, 1)}) | zweitgroesste = ${fmt(q(seconds, 0.1), 0)}/${fmt(q(seconds, 0.5), 0)}/${fmt(q(seconds, 0.9), 0)} (echt: ${fmt(secP, 1)})`);
  const cnt = {};
  for (const x of n4) cnt[x] = (cnt[x] || 0) + 1;
  say(`NPC-Gangs mit Territorium > 0 (echt: ${nReal}): Verteilung ${JSON.stringify(cnt)}; unser Territorium bleibt ${fmt(q(terrShare, 0.5), 6)} (echt 0,142857)`);
}
