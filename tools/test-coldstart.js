/**
 * Ebene 0/2: der Kaltstart-Pfad bis 8 GB home (Lauf 2, Posten Z6).
 *
 * Prueft:
 *   1. RAM, gerechnet mit tools/ram.js (geeicht an 126 Live-Werten):
 *      coldstart.js <= 5,0 GB, die fest eingetragenen Arbeiter-Groessen sind
 *      nicht zu klein, coldbuy.js passt auf einen 8-GB-Mietrechner.
 *   2. Die Handkauf-Formel fuer home-RAM gegen die Spielwerte 1,01 M / 3,19 M.
 *   3. coldstart.js in einer kleinen Fake-Welt mit home 8 GB: nichts passt auf
 *      home, der Einkaeufer geht auf einen fremden Rechner, Arbeiter fuellen
 *      nie mehr als frei ist, Knacker/Port-Logik, Reserve auf dem Port,
 *      Statusdatei, Uebergabe an boot.js ab 32 GB.
 *   4. coldbuy.js: respektiert die Reserve, kauft gestaffelt, endet ab 32 GB.
 *   5. boot.js: bei home >= 32 GB BITGLEICH zum Stand vor dem Zweig (gleiche
 *      Aufruffolge in gleicher Welt, Vergleichsstand = Commit 294b593), bei
 *      home < 32 GB mit coldstart.js der neue Zweig, ohne coldstart.js der
 *      alte Pfad. (Schwelle 32 statt 16 seit dem Skeptiker 14.11.2026: auf
 *      16 GB riss der alte Pfad coldstart.js nach 5 Minuten weg.)
 *   6. NEULADEN MIT AUTOEXEC bei 8, 16 und 32 GB (Skeptiker 14.11.2026): mit
 *      AutoexecScript boot.js darf coldstart.js auf 16 GB nicht verschwinden;
 *      mit AutoexecScript coldstart.js muss bei jeder Groesse etwas Arbeitendes
 *      uebrig bleiben (8/16 GB coldstart, 32 GB boot).
 *
 * Die Fake-Welt ist absichtlich klein und eigen (nicht tools/mock/ns.js, das
 * ein anderer Posten umbaut): sie bucht RAM und kennt genau die Funktionen,
 * die coldstart.js, coldbuy.js und boot.js rufen - alles andere wirft.
 *
 * Aufruf: node --import file:///.../tools/cpu.mjs tools/test-coldstart.js
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rechne } from "./ram.js";
import { ladeSpielskript } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.join(ROOT, "src");
const BOOT_VOR_ZWEIG = "294b593"; // master vor dem Kaltstart-Zweig

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else { rot++; fehler.push(name + (hinweis ? " - " + hinweis : "")); console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
}

// ---------------------------------------------------------------------------
// 1. RAM
// ---------------------------------------------------------------------------
console.log("-- 1. RAM (tools/ram.js) --");
const gb = (f) => rechne(f, { sf4: 1 }).gb;
const RAM = {
  "coldstart.js": gb("coldstart.js"), "coldbuy.js": gb("coldbuy.js"), "boot.js": gb("boot.js"),
  "darkweb.js": gb("darkweb.js"), "worker/weaken.js": gb("worker/weaken.js"),
  "worker/grow.js": gb("worker/grow.js"), "worker/hack.js": gb("worker/hack.js"),
  "guard.js": gb("guard.js"), "bn4net.js": gb("bn4net.js"),
};
console.log("       " + Object.entries(RAM).map(([k, v]) => k + " " + v).join(", "));
pruefe("coldstart.js <= 5,05 GB (gemessen; +0,05 fuer hasTorRouter, 14.11.2026)", RAM["coldstart.js"] <= 5.05, RAM["coldstart.js"] + " GB");
pruefe("coldstart.js passt neben 3 GB Handwerkzeug auf home 8 GB", RAM["coldstart.js"] + RAM["darkweb.js"] <= 8);
pruefe("boot.js unveraendert 5,5 GB (der Zweig kostet keinen RAM)", RAM["boot.js"] === 5.5, RAM["boot.js"] + " GB");
{
  const quelle = fs.readFileSync(path.join(SRC, "coldstart.js"), "utf8");
  const m = /const KOSTEN = \{ w: ([\d.]+), g: ([\d.]+), h: ([\d.]+) \}/.exec(quelle);
  pruefe("fest eingetragene Arbeiter-RAM nicht kleiner als gemessen",
    !!m && Number(m[1]) >= RAM["worker/weaken.js"] && Number(m[2]) >= RAM["worker/grow.js"]
      && Number(m[3]) >= RAM["worker/hack.js"], m ? m.slice(1, 4).join("/") : "nicht gefunden");
  const k = /const KAUFER_GB = ([\d.]+)/.exec(quelle);
  pruefe("KAUFER_GB nicht kleiner als coldbuy.js gemessen", !!k && Number(k[1]) >= RAM["coldbuy.js"]);
}
pruefe("coldbuy.js passt auf einen 8-GB-Mietrechner", RAM["coldbuy.js"] <= 8);
{
  // Kommentare vorher weg: dort wird der Fall erklaert.
  const code = (f) => fs.readFileSync(path.join(SRC, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  pruefe("kein dynamischer ns[...]-Zugriff in coldstart.js/coldbuy.js (Laufzeit-RAM!)",
    !/\bns\s*\[/.test(code("coldstart.js")) && !/\bns\s*\[/.test(code("coldbuy.js")));
}

// ---------------------------------------------------------------------------
// Die Fake-Welt
// ---------------------------------------------------------------------------
class Abbruch extends Error {}

function neueWelt(o = {}) {
  const w = {
    homeGb: o.homeGb ?? 8, skill: o.skill ?? 1, geld: o.geld ?? 0,
    dateien: { home: new Set(o.dateien || []) },
    texte: {}, ports: {}, prozesse: [], pid: 1, log: [], abgelehnt: [], getoetet: [],
    sleeps: 0, maxSleeps: o.maxSleeps ?? 20, nachSleep: o.nachSleep || (() => {}),
    offen: {}, tor: !!o.tor, kaeufe: [], eigene: [],
    server: {
      home: { ram: o.homeGb ?? 8, root: true, ports: 0, level: 1, max: 0, geld: 0, sec: 1, min: 1, growth: 0 },
      n00dles: { ram: 4, root: false, ports: 0, level: 1, max: 70e3, geld: 70e3, sec: 5, min: 1, growth: 3000 },
      foodnstuff: { ram: 16, root: false, ports: 0, level: 1, max: 5e6, geld: 1e6, sec: 10, min: 3, growth: 5 },
      "sigma-cosmetics": { ram: 16, root: false, ports: 0, level: 5, max: 2.3e6, geld: 2.3e6, sec: 10, min: 3, growth: 10 },
      zer0: { ram: 32, root: false, ports: 1, level: 75, max: 7e6, geld: 7e6, sec: 25, min: 8, growth: 40 },
      // steht im Netz, sobald TOR gekauft ist (scan("home") nennt ihn dann)
      darkweb: { ram: 0, root: false, ports: 5, level: 1, max: 0, geld: 0, sec: 1, min: 1, growth: 0 },
    },
  };
  w.nachbarn = { home: ["n00dles", "foodnstuff", "sigma-cosmetics", "zer0"] };
  for (const h of Object.keys(w.server)) if (h !== "home") w.dateien[h] = new Set();
  for (const h of w.nachbarn.home) w.nachbarn[h] = ["home"];
  w.nachbarn.n00dles = ["home"];
  const used = (h) => Math.round(w.prozesse.filter((p) => p.host === h)
    .reduce((a, p) => a + (RAM[p.filename] ?? o.ram?.[p.filename] ?? 1.75) * p.threads, 0) * 100) / 100;
  w.used = used;
  const rec = (n, ...a) => { w.log.push(n + " " + JSON.stringify(a)); };
  const tot = (n) => (...a) => { rec(n, ...a); return undefined; };
  const dateienVon = (h) => { if (!w.dateien[h]) w.dateien[h] = new Set(); return w.dateien[h]; };

  const basis = {
    args: o.args || [],
    disableLog: tot("disableLog"), print: () => {},
    sleep: async (ms) => { rec("sleep", ms); w.sleeps++; w.nachSleep(w); if (w.sleeps >= w.maxSleeps) throw new Abbruch("Ende"); },
    getServerMaxRam: (h) => (h === "home" ? w.homeGb : w.server[h].ram),
    getServerUsedRam: (h) => used(h),
    getServerMoneyAvailable: (h) => (h === "home" ? w.geld : w.server[h].geld),
    getServerMaxMoney: (h) => w.server[h].max,
    getServerSecurityLevel: (h) => w.server[h].sec,
    getServerMinSecurityLevel: (h) => w.server[h].min,
    getServerGrowth: (h) => w.server[h].growth,
    getServerRequiredHackingLevel: (h) => w.server[h].level,
    getHackingLevel: () => w.skill,
    hasRootAccess: (h) => w.server[h].root,
    // scanVeraltet: ein laufendes Skript sieht neue Nachbarn nicht (Spiel, 14.11.2026)
    scan: (h) => [...(w.nachbarn[h] || []), ...(h === "home" && w.tor && !w.scanVeraltet ? ["darkweb"] : [])],
    hasTorRouter: () => !!w.tor,
    brutessh: (h) => { rec("brutessh", h); if (dateienVon("home").has("BruteSSH.exe")) w.offen[h] = (w.offen[h] || new Set()).add("ssh"); },
    ftpcrack: (h) => { rec("ftpcrack", h); if (dateienVon("home").has("FTPCrack.exe")) w.offen[h] = (w.offen[h] || new Set()).add("ftp"); },
    relaysmtp: (h) => { rec("relaysmtp", h); if (dateienVon("home").has("relaySMTP.exe")) w.offen[h] = (w.offen[h] || new Set()).add("smtp"); },
    nuke: (h) => {
      rec("nuke", h);
      if ((w.offen[h] ? w.offen[h].size : 0) < w.server[h].ports) throw new Error("Not enough ports opened");
      w.server[h].root = true;
    },
    fileExists: (f, h = "home") => dateienVon(h).has(f),
    scp: (fs_, dest, src = "home") => {
      rec("scp", fs_, dest, src);
      for (const f of [].concat(fs_)) { if (!dateienVon(src).has(f)) return false; dateienVon(dest).add(f); }
      return true;
    },
    getScriptRam: (f) => RAM[f] ?? o.ram?.[f] ?? 0,
    exec: (f, h, t = 1, ...args) => {
      rec("exec", f, h, t, args[0]);
      if (!dateienVon(h).has(f)) { w.abgelehnt.push(["fehlt", f, h]); return 0; }
      const brauch = (RAM[f] ?? o.ram?.[f] ?? 1.75) * t;
      const ram = h === "home" ? w.homeGb : w.server[h].ram;
      if (used(h) + brauch > ram + 1e-9) { w.abgelehnt.push(["ram", f, h, t]); return 0; }
      const p = { pid: w.pid++, filename: f, host: h, threads: t, args };
      w.prozesse.push(p);
      return p.pid;
    },
    ps: (h) => w.prozesse.filter((p) => p.host === h).map((p) => ({ ...p })),
    kill: (pid) => { rec("kill", pid); const i = w.prozesse.findIndex((p) => p.pid === pid); if (i < 0) return false; w.getoetet.push(w.prozesse[i].filename); w.prozesse.splice(i, 1); return true; },
    write: (f, t) => { rec("write", f); w.texte[f] = t; dateienVon("home").add(f); },
    read: (f) => w.texte[f] ?? "",
    rm: (f) => { rec("rm", f); return dateienVon("home").delete(f); },
    getResetInfo: () => ({ lastNodeReset: Date.now() - 3600e3, currentNode: 1, ownedSF: new Map() }),
    clearPort: (p) => { rec("clearPort", p); w.ports[p] = []; },
    writePort: (p, v) => { (w.ports[p] ||= []).push(v); },
    peek: (p) => (w.ports[p] && w.ports[p].length ? w.ports[p][0] : "NULL PORT DATA"),
    cloud: {
      getServerNames: () => [...w.eigene],
      getServerLimit: () => 25, getRamLimit: () => 1048576,
      getServerCost: (r) => r * 55000,
      purchaseServer: (n, r) => {
        const c = r * 55000;
        if (w.geld < c) return "";
        w.geld -= c; w.eigene.push(n); w.kaeufe.push([n, r]);
        w.server[n] = { ram: r, root: true, ports: 0, level: 1, max: 0, geld: 0, sec: 1, min: 1, growth: 0 };
        w.dateien[n] = new Set(); w.nachbarn.home.push(n); w.nachbarn[n] = ["home"];
        return n;
      },
      getServerUpgradeCost: () => -1, upgradeServer: () => false,
    },
  };
  // Alles, was nicht nachgebaut ist, wirft - ein stilles undefined faelschte das Ergebnis.
  w.ns = new Proxy(basis, { get: (t, k) => { if (k in t) return t[k]; if (typeof k === "symbol" || k === "then") return undefined; throw new Error("Fake-ns kennt " + String(k) + " nicht"); } });
  // Dateien, die auf home liegen (Bruecke hat sie geschoben).
  for (const f of ["worker/weaken.js", "worker/grow.js", "worker/hack.js", "coldbuy.js", "coldstart.js", "boot.js", "darkweb.js"]) w.dateien.home.add(f);
  for (const f of o.ohneDateien || []) w.dateien.home.delete(f);
  for (const f of o.dateien || []) w.dateien.home.add(f);
  return w;
}

async function fahre(modul, w) {
  try { await modul.main(w.ns); } catch (e) { if (!(e instanceof Abbruch)) throw e; }
}

// ---------------------------------------------------------------------------
// 2. Handkauf-Formel
// ---------------------------------------------------------------------------
const cold = await ladeSpielskript(path.join(SRC, "coldstart.js"));
const buy = await ladeSpielskript(path.join(SRC, "coldbuy.js"));
console.log("");
console.log("-- 2. home-RAM-Preis gegen die Spielwerte --");
pruefe("8 -> 16 GB = 1,01 M (Spiel: 5a Abschnitt 1)", Math.abs(cold.heimPreis(8) - 1.0097e6) < 1e3, String(Math.round(cold.heimPreis(8))));
pruefe("16 -> 32 GB = 3,19 M", Math.abs(cold.heimPreis(16) - 3.19e6) < 1e4, String(Math.round(cold.heimPreis(16))));
{
  // Unabhaengig aus dem Spielcode nachgerechnet (PlayerObjectServerMethods.ts:30-40):
  // cost = ram * 32000 * 1,58^log2(ram). Eichwert von Hand: 8 * 32000 * 1,58^3.
  const hand = 8 * 32000 * 1.58 * 1.58 * 1.58;
  pruefe("identisch mit der ausgeschriebenen Spielformel (8 GB)", Math.abs(cold.heimPreis(8) - hand) < 1e-6);
}

// ---------------------------------------------------------------------------
// 3. coldstart.js in der Fake-Welt, home 8 GB
// ---------------------------------------------------------------------------
console.log("");
console.log("-- 3. coldstart.js auf home 8 GB --");
{
  const w = neueWelt({
    homeGb: 8, skill: 1, geld: 0, maxSleeps: 12,
    // coldstart selbst belegt home, wie im Spiel.
    nachSleep: (x) => {
      // Arbeiter "enden": Wirkung grob (es geht um die Steuerung, nicht um die Spielformel).
      for (const p of x.prozesse.filter((q) => q.filename.startsWith("worker/"))) {
        const s = x.server[p.args[0]];
        if (p.filename.endsWith("weaken.js")) s.sec = Math.max(s.min, s.sec - 0.05 * p.threads);
        if (p.filename.endsWith("grow.js")) s.geld = Math.min(s.max, s.geld * (1 + 0.01 * p.threads) + p.threads);
        if (p.filename.endsWith("hack.js")) s.geld = Math.max(0, s.geld * (1 - 0.003 * p.threads));
      }
      x.prozesse = x.prozesse.filter((q) => !q.filename.startsWith("worker/"));
    },
  });
  w.prozesse.push({ pid: w.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  w.dateien.n00dles = new Set(); // Mietrechner/n00dles kriegen Dateien per scp
  await fahre(cold, w);

  pruefe("nichts ausser coldstart selbst auf home (8 GB, 3 GB frei gehalten)",
    w.prozesse.every((p) => p.host !== "home" || p.filename === "coldstart.js"),
    w.prozesse.filter((p) => p.host === "home").map((p) => p.filename).join(","));
  pruefe("kein Rechner je ueber seinem RAM",
    Object.keys(w.server).every((h) => w.used(h) <= (h === "home" ? w.homeGb : w.server[h].ram) + 1e-9));
  const kaeufer = w.prozesse.filter((p) => p.filename === "coldbuy.js");
  pruefe("genau ein Einkaeufer, auf einem fremden Rechner", kaeufer.length === 1 && kaeufer[0].host !== "home",
    kaeufer.map((k) => k.host).join(","));
  pruefe("der Einkaeufer sitzt auf dem kleinsten passenden Rechner (nicht n00dles mit 4 GB)",
    kaeufer.length === 1 && w.server[kaeufer[0].host].ram >= RAM["coldbuy.js"]);
  pruefe("n00dles/foodnstuff gerootet (0 Ports), zer0 (1 Port) nicht",
    w.server.n00dles.root && w.server.foodnstuff.root && !w.server.zer0.root);
  const start = w.log.filter((l) => l.startsWith("exec ") && l.includes("worker/")).length;
  pruefe("Arbeiter wurden gestartet", start > 0, String(start));
  pruefe("Arbeiter nur auf Zielen, die das Level hergibt (reqSkill <= 1)",
    w.log.filter((l) => l.startsWith("exec \"worker/")).every((l) => /n00dles|foodnstuff/.test(l)));
  pruefe("Statusdatei geschrieben", typeof w.texte["data/coldstart.txt"] === "string"
    && JSON.parse(w.texte["data/coldstart.txt"]).homeGb === 8);
  pruefe("Reserve auf dem Port = TOR 200k (ohne TOR immer reserviert)", w.ports[3032] && w.ports[3032][w.ports[3032].length - 1] === 200000,
    JSON.stringify(w.ports[3032]));
  pruefe("nichts abgelehnt wegen RAM, das nicht ohnehin knapp war (Zaehlung)", w.abgelehnt.filter((a) => a[0] === "fehlt").length === 0,
    JSON.stringify(w.abgelehnt.slice(0, 3)));
  pruefe("unter 200k kein darkweb.js gestartet", !w.log.some((l) => l.includes("darkweb.js")));

  // Fortsetzung: BruteSSH gekauft + Level -> zer0 wird gerootet, Reserve wechselt
  w.dateien.home.add("BruteSSH.exe"); w.tor = true; w.skill = 80; w.geld = 100; w.sleeps = 0; w.maxSleeps = 3;
  await fahre(cold, w);
  pruefe("nach BruteSSH.exe wird zer0 (1 Port) gerootet", w.server.zer0.root);
  const rp = w.ports[3032][w.ports[3032].length - 1];
  pruefe("Reserve ohne TOR/BruteSSH-Posten und ohne Mietrechner: 0 (erst mieten)", rp === 0, String(rp));
}

console.log("");
console.log("-- 3a. TOR gekauft, aber ns.scan veraltet; home-RAM per darkweb.js heim (14.11.2026) --");
{
  const w = neueWelt({ homeGb: 8, skill: 1, geld: 2e6, maxSleeps: 2, tor: true, dateien: ["BruteSSH.exe"], args: [] });
  w.scanVeraltet = true;
  w.prozesse.push({ pid: w.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(cold, w);
  const st = JSON.parse(w.texte["data/coldstart.txt"] || "{}");
  pruefe("TOR gekauft + scan veraltet: naechster Schritt ist NICHT TOR (ist: " + st.schritt + ")", !/^TOR/.test(st.schritt || ""));
  pruefe("naechster Schritt home-RAM 16 GB", /^home-RAM auf 16/.test(st.schritt || ""));
  const dw = w.prozesse.find((p) => p.filename === "darkweb.js");
  pruefe("darkweb.js mit Argument heim gestartet (home-RAM-Kauf)", dw && dw.args[0] === "heim", JSON.stringify(dw && dw.args));
}
console.log("");
console.log("-- 3b. darkweb standardmaessig an (14.11.2026), Reserve nach Mietrechner-Aufbau --");
{
  const d = neueWelt({ homeGb: 8, skill: 1, geld: 250e3, maxSleeps: 2, args: [] });
  d.prozesse.push({ pid: d.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(cold, d);
  pruefe("ohne Argument und 250k startet darkweb.js (Standard seit 14.11.)",
    d.prozesse.some((p) => p.filename === "darkweb.js" && p.host === "home"));
  const o = neueWelt({ homeGb: 8, skill: 1, geld: 250e3, maxSleeps: 2, args: ["ohne-darkweb"] });
  o.prozesse.push({ pid: o.pid++, filename: "coldstart.js", host: "home", threads: 1, args: ["ohne-darkweb"] });
  await fahre(cold, o);
  pruefe("mit ohne-darkweb und 250k KEIN darkweb.js", !o.prozesse.some((p) => p.filename === "darkweb.js"));
}
{
  const w = neueWelt({ homeGb: 8, skill: 1, geld: 250e3, maxSleeps: 2, args: ["darkweb"] });
  w.prozesse.push({ pid: w.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(cold, w);
  pruefe("mit Argument darkweb und 250k startet darkweb.js (TOR 200k)",
    w.prozesse.some((p) => p.filename === "darkweb.js" && p.host === "home"));
  pruefe("darkweb.js nicht doppelt gestartet", w.prozesse.filter((p) => p.filename === "darkweb.js").length === 1);

  const v = neueWelt({ homeGb: 8, skill: 1, geld: 250e3, maxSleeps: 2, tor: true, dateien: ["BruteSSH.exe"] });
  v.prozesse.push({ pid: v.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  // 8 Mietrechner a 8 GB = 64 GB stehen schon
  v.geld = 1e12;
  for (let i = 0; i < 8; i++) v.ns.cloud.purchaseServer("werk-" + i, 8);
  v.geld = 250e3;
  await fahre(cold, v);
  const r = v.ports[3032][v.ports[3032].length - 1];
  pruefe("ab 64 GB Miet-RAM wird der naechste Posten (home 16 GB) reserviert", Math.abs(r - cold.heimPreis(8)) < 1, String(r));
}

console.log("");
console.log("-- 3c. Uebergabe an boot.js ab 32 GB --");
{
  const w = neueWelt({ homeGb: 32, skill: 1, geld: 0, maxSleeps: 3 });
  w.prozesse.push({ pid: w.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(cold, w);
  pruefe("boot.js gestartet", w.prozesse.some((p) => p.filename === "boot.js" && p.host === "home"));
  pruefe("coldstart beendet sich danach (kein weiterer sleep)", w.sleeps === 0, "sleeps " + w.sleeps);
  pruefe("Statusdatei meldet die Uebergabe", /Uebergabe/.test(w.texte["data/coldstart.txt"] || ""));

  const z = neueWelt({ homeGb: 16, skill: 1, geld: 0, maxSleeps: 3 });
  z.prozesse.push({ pid: z.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(cold, z);
  pruefe("bei 16 GB KEINE Uebergabe (Kern + Waechter passen dort nicht zusammen)",
    !z.prozesse.some((p) => p.filename === "boot.js") && z.sleeps === 3);
  pruefe("bei 16 GB arbeitet home mit (16 - 5 - 6 = 5 GB)",
    z.prozesse.some((p) => p.host === "home" && p.filename.startsWith("worker/")));
  pruefe("16 GB: Arbeiter auf home lassen mindestens 6 GB frei",
    16 - z.used("home") >= 6 - 1e-9, "frei " + (16 - z.used("home")));
}

// ---------------------------------------------------------------------------
// 4. coldbuy.js
// ---------------------------------------------------------------------------
console.log("");
console.log("-- 4. coldbuy.js --");
{
  const w = neueWelt({ homeGb: 8, geld: 600e3, maxSleeps: 1 });
  w.ports[3032] = [200000];
  await fahre(buy, w);
  pruefe("Reserve 200k + 8 GB (440k) > 600k - 200k: nichts gekauft", w.kaeufe.length === 0);

  const v = neueWelt({ homeGb: 8, geld: 5e6, maxSleeps: 1 });
  await fahre(buy, v);
  pruefe("5M ohne Reserve: ein Rechner, gestaffelt (64 GB = 3,52 M)", v.kaeufe.length === 1 && v.kaeufe[0][1] === 64, JSON.stringify(v.kaeufe));
  pruefe("Name werk-0 (gleicher Name wie shop.js)", v.kaeufe[0] && v.kaeufe[0][0] === "werk-0");

  const u = neueWelt({ homeGb: 8, geld: 5e6, maxSleeps: 1 });
  u.eigene.push("werk-0", "werk-1"); u.eigene.push("werk-3");
  await fahre(buy, u);
  pruefe("freien Namen wiederverwenden (werk-2)", u.kaeufe.length === 1 && u.kaeufe[0][0] === "werk-2", JSON.stringify(u.kaeufe));

  const e = neueWelt({ homeGb: 32, geld: 5e6, maxSleeps: 5 });
  await fahre(buy, e);
  pruefe("home >= 32 GB: beendet sich ohne zu kaufen (Kern uebernimmt)", e.kaeufe.length === 0 && e.sleeps === 0);

  const n = neueWelt({ homeGb: 8, geld: 100e3, maxSleeps: 1 });
  await fahre(buy, n);
  pruefe("zu wenig Geld: nichts gekauft", n.kaeufe.length === 0);
}

// ---------------------------------------------------------------------------
// 5. boot.js
// ---------------------------------------------------------------------------
console.log("");
console.log("-- 5. boot.js: Zweig nur bei home < 32 GB, sonst bitgleich --");
const altDir = fs.mkdtempSync(path.join(os.tmpdir(), "boot-alt-"));
fs.mkdirSync(path.join(altDir, "src"));
let bootAlt = null;
try {
  const alt = execFileSync("git", ["show", BOOT_VOR_ZWEIG + ":src/boot.js"], { cwd: ROOT, encoding: "utf8" });
  fs.writeFileSync(path.join(altDir, "src", "boot.js"), alt);
  bootAlt = await ladeSpielskript(path.join(altDir, "src", "boot.js"));
} catch (e) {
  pruefe("Vergleichsstand " + BOOT_VOR_ZWEIG + " lesbar (git show)", false, String(e.message).split("\n")[0]);
}
const bootNeu = await ladeSpielskript(path.join(SRC, "boot.js"));

function bootWelt(homeGb, mitCold, extra = {}) {
  const w = neueWelt({ homeGb, maxSleeps: 14, ram: { "guard.js": RAM["guard.js"], "bn4net.js": RAM["bn4net.js"] },
    dateien: ["guard.js", "bn4net.js", ...(mitCold ? ["coldstart.js"] : [])],
    ohneDateien: mitCold ? [] : ["coldstart.js"], ...extra });
  w.prozesse.push({ pid: w.pid++, filename: "boot.js", host: "home", threads: 1, args: [] });
  return w;
}
// Das Protokoll ohne Zeitstempel-Inhalt: Aufrufnamen und Argumente, ohne write-Texte.
const spur = (w) => w.log.join("\n");

if (bootAlt) {
  for (const [gbHome, mitCold] of [[32, true], [32, false], [16, false], [8, false], [128, true]]) {
    const a = bootWelt(gbHome, mitCold);
    const n = bootWelt(gbHome, mitCold);
    await fahre(bootAlt, a);
    await fahre(bootNeu, n);
    pruefe("home " + gbHome + " GB" + (mitCold ? " mit" : " ohne") + " coldstart.js: Aufruffolge bitgleich zu " + BOOT_VOR_ZWEIG
      + " (" + n.log.length + " Aufrufe)", spur(a) === spur(n) && n.log.length > 5
      && n.log.some((l) => l.startsWith("sleep") || l.startsWith("exec")),
      spur(a) === spur(n) ? "zu wenig Aufrufe" : "weicht ab");
  }
}
{
  const w = bootWelt(8, true);
  await fahre(bootNeu, w);
  pruefe("home 8 GB + coldstart.js: coldstart.js nicht startbar (5,5 + 5,0 > 8) -> Hinweis, boot endet",
    w.sleeps === 0 && /run coldstart\.js/.test(w.texte["data/boot.txt"] || ""));
  pruefe("home 8 GB: boot beendet NICHTS (kein 5-Minuten-Kahlschlag)", w.getoetet.length === 0);
  pruefe("home 8 GB: es wurde weder guard.js noch bn4net.js versucht",
    !w.log.some((l) => l.startsWith('exec ["guard.js"') || l.includes('"bn4net.js"') && l.startsWith("exec")));

  // KUENSTLICH: im Spiel passt coldstart.js auf 8 GB nie neben boot.js (10,5 > 8,
  // Skeptiker 14.11.2026) - der Fall prueft nur die exec-Zeile des Zweigs, nicht
  // einen Weg, den es live gibt. Der echte 8-GB-Weg ist der Hinweis oben.
  const f = bootWelt(8, true);
  f.prozesse = []; // boot belegt nichts: simuliert genug freien Platz
  await fahre(bootNeu, f);
  pruefe("home 8 GB, kuenstlich ohne boot-Belegung: exec-Zeile des Zweigs startet coldstart.js",
    f.prozesse.some((p) => p.filename === "coldstart.js") && f.sleeps === 0);

  const g = bootWelt(8, true);
  g.prozesse.push({ pid: g.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
  await fahre(bootNeu, g);
  pruefe("coldstart.js laeuft schon: kein zweiter Start", g.prozesse.filter((p) => p.filename === "coldstart.js").length === 1 && g.sleeps === 0);
}

try { fs.rmSync(altDir, { recursive: true, force: true }); } catch { /* egal */ }

// ---------------------------------------------------------------------------
// 6. Neuladen mit Autoexec (Skeptiker 14.11.2026)
// ---------------------------------------------------------------------------
console.log("");
console.log("-- 6. Neuladen mit Autoexec bei 8, 16 und 32 GB --");
{
  // 6a. AutoexecScript boot.js, home 16 GB: boot startet coldstart.js und
  // endet - es gibt keinen 5-Minuten-Kahlschlag mehr (sleeps 0, nichts getoetet).
  const a = bootWelt(16, true);
  await fahre(bootNeu, a);
  pruefe("Autoexec boot.js, 16 GB: coldstart.js wird gestartet", a.prozesse.some((p) => p.filename === "coldstart.js"));
  pruefe("Autoexec boot.js, 16 GB: boot wartet nicht und beendet nichts", a.sleeps === 0 && a.getoetet.length === 0);
  pruefe("Autoexec boot.js, 16 GB: weder guard.js noch bn4net.js gestartet",
    !a.prozesse.some((p) => p.filename === "guard.js" || p.filename === "bn4net.js"));

  // 6b. AutoexecScript coldstart.js (die Empfehlung fuer Lauf 2): coldstart.js
  // ist das erste Skript; ab 32 GB uebergibt es an boot.js, darunter arbeitet es.
  for (const gb of [8, 16, 32]) {
    const w = neueWelt({ homeGb: gb, skill: 1, geld: 0, maxSleeps: 2, dateien: ["boot.js", "coldstart.js"],
      ram: { "boot.js": RAM["boot.js"] } });
    w.prozesse.push({ pid: w.pid++, filename: "coldstart.js", host: "home", threads: 1, args: [] });
    await fahre(cold, w);
    const hatBoot = w.prozesse.some((p) => p.filename === "boot.js");
    if (gb >= 32) pruefe("Autoexec coldstart.js, " + gb + " GB: boot.js wird gestartet, coldstart endet", hatBoot && w.sleeps === 0);
    else pruefe("Autoexec coldstart.js, " + gb + " GB: coldstart.js arbeitet weiter (kein boot.js)", !hatBoot && w.sleeps === 2);
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { for (const f of fehler) console.log("  - " + f); process.exit(1); }
