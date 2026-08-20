/**
 * Lagebericht - alles, was man nach einem Wiedereinstieg als Erstes wissen will.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Am 20.08. lagen 37 solcher Abfrageskripte im Temp-Verzeichnis: Warteschlange
 * lesen, Favor pruefen, Faeden zaehlen, Depotwert rechnen. Sie sind mit der
 * Sitzung verloren, und mehrere davon habe ich an einem einzigen Tag zweimal
 * gebaut. Was man oefter als einmal braucht, gehoert ins Projekt.
 *
 * Der Spielstand ist die ehrlichste Quelle: Er enthaelt Faktionsreputation,
 * Favor, Augmentierungen, Multiplikatoren und Backdoors - alles Dinge, die
 * weder ns.getPlayer() noch die Telemetrie hergeben.
 *
 * Aufruf:
 *   node tools/lage.js              Gesamtuebersicht
 *   node tools/lage.js --procs      Prozesse und Faeden im ganzen Netz
 *   node tools/lage.js --augs       Warteschlange und installierte Augs
 *   node tools/lage.js --geld       Bar, Depot, Summe
 *   node tools/lage.js --arbeit     laeuft Faktionsarbeit? mit Fokus?
 *   node tools/lage.js --reprate    Reputationsrate ueber 60 Sekunden messen
 */

import zlib from "node:zlib";

const BASE = "http://localhost:8795";
const arg = process.argv[2] || "";

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return "$" + (Math.abs(n) < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

async function stand() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile");
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  const roh = Buffer.from(body.result.save, "latin1");
  return JSON.parse(zlib.gunzipSync(roh).toString("utf8"));
}

const spieler = (s) => JSON.parse(s.data.PlayerSave).data;
const faktionen = (s) => JSON.parse(s.data.FactionsSave);
const rechner = (s) => Object.values(JSON.parse(s.data.AllServersSave)).map((x) => x.data);

function repVon(f, name) {
  const d = f[name] && (f[name].data || f[name]);
  return (d && Number.isFinite(d.playerReputation)) ? d.playerReputation : 0;
}

// --- Einzelansichten --------------------------------------------------------

function zeigeProcs(s) {
  const zaehler = {};
  let ramMax = 0, ramUsed = 0;
  for (const sv of rechner(s)) {
    ramMax += sv.maxRam || 0;
    ramUsed += sv.ramUsed || 0;
    for (const rs of (sv.runningScripts || [])) {
      const d = rs.data || rs;
      zaehler[d.filename] = (zaehler[d.filename] || 0) + (d.threads || 0);
    }
  }
  console.log("  Speicher " + Math.round(ramMax / 1000) + " TB, belegt "
    + (100 * ramUsed / Math.max(1, ramMax)).toFixed(1) + " %");
  for (const [n, t] of Object.entries(zaehler).sort((a, b) => b[1] - a[1])) {
    console.log("    " + n.padEnd(22) + String(t).padStart(9) + " Faeden");
  }
  const sh = zaehler["share.js"] || 0;
  if (sh) console.log("  Share-Bonus: x" + (1 + Math.log(sh) / 25).toFixed(4));
}

function zeigeAugs(s) {
  const p = spieler(s);
  console.log("  Installiert (" + (p.augmentations || []).length + "):");
  for (const a of (p.augmentations || [])) {
    console.log("    " + a.name + (a.level > 1 ? "  x" + a.level : ""));
  }
  const q = p.queuedAugmentations || [];
  console.log("  Warteschlange (" + q.length + "): "
    + (q.map((a) => a.name + (a.level > 1 ? " x" + a.level : "")).join(", ") || "leer"));
  if (q.length) {
    // Jeder Eintrag verteuert den naechsten Kauf um Faktor 1,9
    // (AugmentationHelpers.ts:29-37). Nach dem Install faellt er auf 1 zurueck.
    console.log("  Preisfaktor fuer den naechsten Kauf: 1,9^" + q.length
      + " = " + Math.pow(1.9, q.length).toFixed(1) + "x");
  }
}

function zeigeGeld(s) {
  const p = spieler(s);
  let depot = 0, posten = 0;
  if (s.data.StockMarketSave) {
    const sm = JSON.parse(s.data.StockMarketSave);
    for (const k of Object.keys(sm)) {
      const a = sm[k] && (sm[k].data || sm[k]);
      if (!a || !a.playerShares) continue;
      depot += a.playerShares * (a.price || 0);
      posten++;
    }
  }
  console.log("  Bar:   " + geld(p.money));
  console.log("  Depot: " + geld(depot) + " in " + posten + " Papieren");
  console.log("  Summe: " + geld(p.money + depot));
  if (posten) console.log("  ACHTUNG: Offene Positionen sind beim Install ersatzlos weg.");
}

function zeigeArbeit(s) {
  const p = spieler(s);
  const w = p.currentWork;
  if (!w) {
    console.log("  Arbeit: KEINE - ohne Arbeit laeuft keine Reputation.");
    return;
  }
  const d = w.data || w;
  console.log("  Arbeit: " + (d.factionName || d.companyName || d.type)
    + "  Art: " + (d.factionWorkType || "-")
    + "  Fokus: " + (p.focus ? "JA" : "NEIN (Faktor 0,8)"));
}

async function zeigeReprate() {
  const lies = async () => {
    const s = await stand();
    const f = faktionen(s);
    const o = {};
    for (const k of Object.keys(f)) o[k] = repVon(f, k);
    return { rep: o, t: Date.now() };
  };
  console.log("  Messe 60 Sekunden...");
  const a = await lies();
  await new Promise((r) => setTimeout(r, 60000));
  const b = await lies();
  const dt = (b.t - a.t) / 1000;
  for (const k of Object.keys(b.rep)) {
    const delta = (b.rep[k] || 0) - (a.rep[k] || 0);
    if (delta <= 0.01) continue;
    const rate = delta / dt;
    console.log("    " + k.padEnd(20) + Math.round(b.rep[k]).toString().padStart(9)
      + "   " + rate.toFixed(3) + " Rep/s");
  }
}

// --- Gesamtuebersicht -------------------------------------------------------

function zeigeAlles(s) {
  const p = spieler(s);
  const f = faktionen(s);
  console.log("");
  console.log("  Hacking " + p.skills.hacking + "   " + geld(p.money) + "   Stadt " + p.city);
  const m = p.mults || {};
  console.log("  hacking " + (m.hacking || 1).toFixed(3)
    + "  faction_rep " + (m.faction_rep || 1).toFixed(3)
    + "  hacking_money " + (m.hacking_money || 1).toFixed(3)
    + "  chance " + (m.hacking_chance || 1).toFixed(3));
  console.log("");
  const mitglied = p.factions || [];
  if (!mitglied.length) {
    console.log("  Faktionen: KEINE - ohne Mitgliedschaft laeuft keine Reputation!");
  } else {
    console.log("  Faktionen:");
    for (const k of mitglied) {
      const d = f[k] && (f[k].data || f[k]);
      // Nicht d.favor direkt: Der Spielstand fuehrt manche Faktionen ohne
      // dieses Feld, und ein undefined bringt toFixed() weiter unten zu Fall.
      const favor = (d && Number.isFinite(d.favor)) ? d.favor : 0;
      // Der Weg zu Favor 150: ab dort darf man spenden, und Spenden kauft
      // Reputation zum 36,7-fachen der Arbeitsrate (Constants.ts:31).
      const bisSpende = favor >= 150 ? "SPENDEN OFFEN"
        : (100 * favor / 150).toFixed(0) + " % bis Favor 150";
      console.log("    " + k.padEnd(18) + Math.round(repVon(f, k)).toString().padStart(9)
        + " Rep  " + favor.toFixed(1).padStart(6) + " Favor   " + bisSpende);
    }
  }
  const offen = Object.keys(f).filter((k) => {
    const d = f[k].data || f[k];
    return d && d.alreadyInvited && !mitglied.includes(k);
  });
  if (offen.length) console.log("  Offene Einladungen: " + offen.join(", "));
  console.log("");
  console.log("  Augmentierungen: " + (p.augmentations || []).length + " installiert, "
    + (p.queuedAugmentations || []).length + " in der Warteschlange");
  console.log("  Exploits: " + ((p.exploits || []).join(", ") || "keine"));
  console.log("  Boerse: " + (p.has4SDataTixApi ? "voll (getForecast verfuegbar)"
    : p.hasWseAccount ? "teilweise" : "kein Zugang"));
  const home = rechner(s).find((x) => x.hostname === "home");
  if (home) console.log("  home: " + home.maxRam + " GB / " + home.cpuCores + " Kerne");
  console.log("");
  zeigeArbeit(s);
  zeigeGeld(s);
  console.log("");
}

async function main() {
  if (arg === "--reprate") {
    await zeigeReprate();
    return;
  }
  let s;
  try {
    s = await stand();
  } catch (e) {
    console.log("Spielstand nicht lesbar: " + e.message);
    console.log("Laeuft die Bruecke? (node sync/bridge.js)");
    process.exit(1);
  }
  if (arg === "--procs") return zeigeProcs(s);
  if (arg === "--augs") return zeigeAugs(s);
  if (arg === "--geld") return zeigeGeld(s);
  if (arg === "--arbeit") return zeigeArbeit(s);
  zeigeAlles(s);
}

main().catch((e) => console.log("Fehler: " + e.message));
