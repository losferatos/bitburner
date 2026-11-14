/**
 * B07 (14.11.2026): checkin.js zeigt "Einbau faellig / steht" samt Sperrgrund.
 *
 * Zwei Teile, beide ohne Spiel und ohne echte Bruecke:
 *
 *  1. Ebene 0: tools/lib/einbauzeile.js - Sperre lesen (gleiche Lesart wie
 *     bn4rep.js), Zustaende KEIN / FAELLIG / GESPERRT / STEHT / UNBEKANNT.
 *  2. Ebene 1: checkin.js als Prozess gegen eine MOCK-Bruecke (http, freier
 *     Loopback-Port, liefert Fixture-Dateien wie /api/rpc?method=getFile).
 *     Geprueft wird der Vertrag mit Bruecke/Dashboard: `--json --kein-stand`
 *     liefert gueltiges JSON, alle alten Felder bleiben, `einbau` kommt nur DAZU,
 *     die URTEIL-Zeile bleibt die letzte, die Einbau-Zeile steht davor.
 *
 * Es wird NIE Port 8795 oder 12525 angesprochen (checkin.js lehnt beide fuer
 * BB_CHECKIN_BRIDGE ab) und nichts in data/ geschrieben (--kein-stand).
 *
 * Aufruf: node tools/test-checkin.js
 */
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok, detail) => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (detail ? "\n          " + detail : "")); }
};

const lib = await import(pathToFileURL(path.join(HIER, "lib", "einbauzeile.js")).href);
const { sperreLesen, einbauLage, bn8Zeile, STEHT_NACH_MS } = lib;

const T0 = 1_800_000_000_000;
const MIN = 60000;

// =============================================================================
console.log("\n=== 1. einbauzeile.js ===\n");

// --- Sperre lesen (Spiegel von bn4rep.js ~1460-1480) -------------------------
pruefe("keine Datei -> null", sperreLesen(null, T0) === null && sperreLesen("  ", T0) === null);
{
  const s = sperreLesen(JSON.stringify({ ts: T0 - MIN, reason: "handschlag", bis: T0 + 30 * MIN, text: "Keine Sicherung" }), T0);
  pruefe("JSON mit bis in der Zukunft gilt, Grund = reason: text",
    s && s.gilt === true && s.bis === T0 + 30 * MIN && s.grund === "handschlag: Keine Sicherung", JSON.stringify(s));
}
{
  const s = sperreLesen(JSON.stringify({ ts: T0 - 2 * MIN, reason: "hotswap" }), T0);
  pruefe("JSON nur mit ts gilt 5 min ab ts", s && s.gilt === true && s.bis === T0 + 3 * MIN, JSON.stringify(s));
  const s2 = sperreLesen(JSON.stringify({ ts: T0 - 6 * MIN }), T0);
  pruefe("JSON mit ts vor 6 min ist abgelaufen", s2 && s2.gilt === false);
}
{
  const s = sperreLesen("FIRMENPHASE Tobacco|" + (T0 - MIN), T0);
  pruefe("TAG|ms: 5 min ab Stempel, Grund = TAG", s && s.gilt === true && s.grund === "FIRMENPHASE Tobacco" && s.bis === T0 + 4 * MIN, JSON.stringify(s));
  const s2 = sperreLesen("FIRMENPHASE Tobacco|" + (T0 - 10 * MIN), T0);
  pruefe("TAG|ms nach 10 min abgelaufen", s2 && s2.gilt === false);
}
{
  const s = sperreLesen("bitte nicht einbauen", T0);
  pruefe("Freitext ohne Stempel gilt NICHT (bn4rep raeumt ihn weg)", s && s.gilt === false && /unlesbar/.test(s.grund), JSON.stringify(s));
  const s2 = sperreLesen("{kaputt", T0);
  pruefe("kaputtes JSON gilt nicht", s2 && s2.gilt === false);
}

// --- Zustaende --------------------------------------------------------------
const tele = (extra = {}) => ({ zeit: T0 - 20000, knoten: 8, wartend: 4, state: "work", ...extra });
const lage = (e) => einbauLage({ jetztMs: T0, knoten: 8, punkte: [], ...e });

{
  const r = lage({ tele: null });
  pruefe("UNBEKANNT ohne bn4rep.json", r.zustand === "UNBEKANNT" && /fehlt/.test(r.grund) && r.zeilen.length === 1);
  const r2 = lage({ tele: tele({ zeit: T0 - 3 * 3600000 }) });
  pruefe("UNBEKANNT bei alter Telemetrie (3 h)", r2.zustand === "UNBEKANNT" && /alt/.test(r2.grund), r2.grund);
  const r3 = lage({ tele: tele({ knoten: 10 }) });
  pruefe("UNBEKANNT bei fremdem Knoten", r3.zustand === "UNBEKANNT" && /BitNode 10/.test(r3.grund), r3.grund);
}
{
  const r = lage({ tele: tele() });
  pruefe("KEIN: nichts faellig, Warteschlange genannt", r.zustand === "KEIN" && /4 Augmentierung/.test(r.zeilen[0]), r.zeilen[0]);
}
{
  const r = lage({ tele: tele({ state: "wait", blockedReason: "locked", warteGrund: "ein Graft laeuft (Neuroflux)" }) });
  pruefe("STEHT: ausgesetzt mit Grund aus der Telemetrie",
    r.zustand === "STEHT" && /ein Graft laeuft/.test(r.zeilen[0]) && /^EINBAU STEHT/.test(r.zeilen[0]), r.zeilen[0]);
}
{
  const r = lage({ tele: tele({ state: "wait", blockedReason: "locked", warteGrund: "kein erarbeitbares Ziel", offenOhneArbeit: ["Bladeburners"] }) });
  pruefe("'kein erarbeitbares Ziel' ist KEIN Einbau-Stau (Gegenprobe)", r.zustand === "KEIN", r.zustand);
}
{
  const sp = JSON.stringify({ ts: T0 - MIN, reason: "firmenphase", bis: T0 + 20 * MIN, text: "Firmenphase laeuft" });
  const r = lage({ tele: tele(), sperreRoh: sp });
  pruefe("GESPERRT: gueltige Sperre haelt wartende Augs, Grund und Restzeit stehen da",
    r.zustand === "GESPERRT" && /Firmenphase laeuft/.test(r.zeilen[0]) && /20 min/.test(r.zeilen[0]), r.zeilen[0]);
  const r2 = lage({ tele: tele({ wartend: 0 }), sperreRoh: sp });
  pruefe("keine wartenden Augs + Sperre -> KEIN (die Sperre haelt nichts auf)", r2.zustand === "KEIN" && /gilt noch/.test(r2.zeilen[0]), r2.zeilen[0]);
}
{
  const bn8 = { runde: 2, faellig: true, grund: "Vermoegen 310 Mrd >= Plan 300 Mrd" };
  const r = lage({ tele: tele({ bn8 }) });
  pruefe("FAELLIG: BN8-Plan sagt faellig, nichts haelt ihn auf", r.zustand === "FAELLIG" && /Runde 2/.test(r.zeilen[0]), r.zeilen[0]);
  const sp = JSON.stringify({ ts: T0, reason: "firmenphase", bis: T0 + 20 * MIN });
  const r2 = lage({ tele: tele({ bn8 }), sperreRoh: sp });
  pruefe("STEHT: BN8-Plan faellig UND Sperre gilt", r2.zustand === "STEHT" && /Einbausperre/.test(r2.zeilen[0]), r2.zeilen[0]);
  const alt = [{ ts: T0 - 4 * 3600000, knoten: 8, einbau: "FAELLIG" }, { ts: T0 - 2 * 3600000, knoten: 8, einbau: "FAELLIG" }];
  const r3 = lage({ tele: tele({ bn8 }), punkte: alt });
  pruefe("STEHT: faellig seit Stunden laut Check-in-Staenden, kein Einbau",
    r3.zustand === "STEHT" && r3.faelligSeitMs === T0 - 4 * 3600000 && /seit mindestens 4\.0 h online/.test(r3.zeilen[0]), r3.zeilen[0]);
  // Welche Uhr: eine Offline-Nacht zaehlt nicht als "es passiert nichts".
  const offlineNacht = [[T0 - 3.5 * 3600000, T0 - 20 * MIN]];
  const r3b = lage({ tele: tele({ bn8 }), punkte: alt, offline: offlineNacht });
  pruefe("Offline-Fenster (3 h 10 min von 4 h) wird abgezogen -> 50 min online -> noch FAELLIG, nicht STEHT",
    r3b.zustand === "FAELLIG", r3b.zustand + " | " + r3b.zeilen[0]);
  const r3c = lage({ tele: tele({ bn8 }), punkte: alt, offline: [] });
  pruefe("ohne Offline-Zeit bleibt es bei STEHT (Gegenprobe zur Online-Rechnung)", r3c.zustand === "STEHT", r3c.zustand);
  const kurz = [{ ts: T0 - 20 * MIN, knoten: 8, einbau: "FAELLIG" }];
  const r4 = lage({ tele: tele({ bn8 }), punkte: kurz });
  pruefe("kurz faellig (20 min < Schwelle) bleibt FAELLIG", r4.zustand === "FAELLIG" && STEHT_NACH_MS > 20 * MIN, r4.zustand);
  const unterbrochen = [{ ts: T0 - 5 * 3600000, knoten: 8, einbau: "FAELLIG" }, { ts: T0 - 4 * 3600000, knoten: 8, einbau: "KEIN" }, { ts: T0 - 30 * MIN, knoten: 8, einbau: "FAELLIG" }];
  const r5 = lage({ tele: tele({ bn8 }), punkte: unterbrochen });
  pruefe("ein Besuch dazwischen mit KEIN setzt die Dauer zurueck", r5.zustand === "FAELLIG" && r5.faelligSeitMs === T0 - 30 * MIN, r5.zustand);
  const anderer = [{ ts: T0 - 5 * 3600000, knoten: 4, einbau: "FAELLIG" }];
  const r6 = lage({ tele: tele({ bn8 }), punkte: anderer });
  pruefe("Staende aus einem anderen Knoten zaehlen nicht", r6.zustand === "FAELLIG" && r6.faelligSeitMs === null);
}
{
  const r = lage({ tele: tele(), repModusRoh: "Daedalus|" + (T0 - 5 * MIN) });
  pruefe("rep-modus.txt erscheint als Info", /Reputationsarbeit: Daedalus/.test(r.zeilen[0]), r.zeilen[0]);
}
{
  const z = bn8Zeile({ gesamt: 12.5e9, depotWert: 10e9, bar: 2.5e9, hat4S: true, posten: 7, state: "work" },
    { phase: "idle", winnings: 10.05e9 });
  pruefe("BN8-Zeile: Boerse gesamt, 4S, Casino-Phase", /Boerse gesamt 12\.50 Mrd/.test(z) && /4S ja/.test(z) && /Casino idle, Gewinn 10\.05 Mrd/.test(z), z);
  const z2 = bn8Zeile(null, null);
  pruefe("BN8-Zeile ohne Telemetrie meldet es, statt zu schweigen", /Boerse: keine Telemetrie/.test(z2) && /Casino: keine Telemetrie/.test(z2), z2);
}

// =============================================================================
console.log("\n=== 2. checkin.js gegen Mock-Bruecke ===\n");

function mockBruecke(dateien) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const name = u.searchParams.get("filename");
    const inhalt = Object.prototype.hasOwnProperty.call(dateien, name) ? dateien[name] : null;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ result: inhalt === null ? "" : (typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt)) }));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

function fahreCheckin(port) {
  return new Promise((fertig) => {
    const p = spawn(process.execPath, [path.join(HIER, "checkin.js"), "--json", "--kein-stand"], {
      cwd: ROOT, env: { ...process.env, BB_CHECKIN_BRIDGE: "http://127.0.0.1:" + port },
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => p.kill("SIGKILL"), 60000);
    p.on("close", (rc) => { clearTimeout(t); fertig({ rc, out, err }); });
  });
}

// Grundlage: BLOCKIERT-Pfad (frueher Rueckgabepfad ueber ausgeben): ausgang.js
// meldet "offen", exit.js lehnt ab.
const jetzt = Date.now();
const grund = () => ({
  "data/ausgang.json": {
    zeit: jetzt, knoten: 8, verfahren: "V1", lauf: { level: 1 }, ziel: { node: 10, level: 2 },
    offen: true, exit_abgelehnt: 3, exit_ablehnung_grund: "Test: Ziel nicht in der Route", status: "offen", letzterStart: 0,
  },
  "data/verfahren.txt": "V1 8",
});
const teleJetzt = (extra = {}) => ({ zeit: jetzt - 10000, knoten: 8, wartend: 5, state: "work", ...extra });

async function lauf(dateien) {
  const srv = await mockBruecke(dateien);
  try {
    const r = await fahreCheckin(srv.address().port);
    let j = null;
    try { j = JSON.parse(r.out); } catch { /* bleibt null */ }
    return { ...r, j };
  } finally { srv.close(); }
}

const ALTE_FELDER = ["zeit", "knoten", "telemetrieAlterMin", "verfahren", "ausgang", "urteil", "zeilen"];

const A = await lauf({
  ...grund(),
  "data/bn4rep.json": teleJetzt({ state: "wait", blockedReason: "locked", warteGrund: "Einbausperre (install-sperre.txt)" }),
  "data/install-sperre.txt": JSON.stringify({ ts: jetzt, reason: "firmenphase", bis: jetzt + 25 * MIN, text: "Firmenphase laeuft" }),
  "data/rep-modus.txt": "Daedalus|" + (jetzt - 2 * MIN),
  "data/boerse.json": { gesamt: 11e9, depotWert: 9e9, bar: 2e9, hat4S: true, posten: 6, state: "work" },
  "data/casino.json": { phase: "idle", winnings: 10.1e9, state: "wait" },
});
pruefe("A: checkin.js liefert gueltiges JSON", A.j !== null, (A.err || A.out).slice(0, 300));
if (A.j) {
  const alt = A.j.zeilen;
  pruefe("A: Urteil unveraendert (BLOCKIERT, Exit 1 wie bisher)", A.j.urteil === "BLOCKIERT" && A.rc === 1, "urteil=" + A.j.urteil + " rc=" + A.rc);
  pruefe("A: alle alten JSON-Felder da", ALTE_FELDER.every((k) => k in A.j), ALTE_FELDER.filter((k) => !(k in A.j)).join(","));
  pruefe("A: neues Feld einbau = STEHT mit Sperre und Grund", A.j.einbau && A.j.einbau.zustand === "STEHT" && A.j.einbau.sperre && A.j.einbau.sperre.gilt === true
    && /firmenphase/.test(A.j.einbau.sperre.grund) && A.j.einbau.wartend === 5, JSON.stringify(A.j.einbau));
  const iE = alt.findIndex((z) => /^EINBAU STEHT/.test(z));
  const iU = alt.map((z) => z.startsWith("URTEIL:")).lastIndexOf(true);
  const iF = alt.findIndex((z) => z.startsWith("FERTIG VORAUSSICHTLICH"));
  pruefe("A: Einbau-Zeile steht VOR 'FERTIG VORAUSSICHTLICH' und der URTEIL-Zeile; URTEIL bleibt letzte Zeile",
    iE >= 0 && iF > iE && iU > iF && iU === alt.length - 1, JSON.stringify({ iE, iF, iU, n: alt.length }));
  pruefe("A: Sperrgrund und Restzeit in der Zeile", /Firmenphase laeuft/.test(alt[iE] || "") && /25 min|24 min/.test(alt[iE] || ""), alt[iE]);
  pruefe("A: BN8-Zeile mit Boerse und Casino", alt.some((z) => /^BN8: Boerse gesamt 11\.00 Mrd.*Casino idle/.test(z)), alt.filter((z) => /BN8/.test(z)).join(" | "));
}

const B = await lauf({ ...grund() });
pruefe("B: ohne bn4rep.json weiter gueltiges JSON, einbau UNBEKANNT", B.j && B.j.einbau && B.j.einbau.zustand === "UNBEKANNT", (B.err || B.out).slice(0, 200));
if (B.j && A.j) {
  const ohneEinbau = (zl) => zl.filter((z) => !/^(EINBAU|BN8:)/.test(z));
  pruefe("B: abgesehen von EINBAU-/BN8-Zeilen identischer Bericht wie A (nichts anderes veraendert)",
    JSON.stringify(ohneEinbau(B.j.zeilen)) === JSON.stringify(ohneEinbau(A.j.zeilen)),
    JSON.stringify(ohneEinbau(B.j.zeilen)).slice(0, 200) + " VS " + JSON.stringify(ohneEinbau(A.j.zeilen)).slice(0, 200));
  pruefe("B: gleiche Urteile und Exit-Code", B.j.urteil === A.j.urteil && B.rc === A.rc);
}

const C = await lauf({ ...grund(), "data/bn4rep.json": teleJetzt() });
pruefe("C: Normalfall -> einbau KEIN", C.j && C.j.einbau && C.j.einbau.zustand === "KEIN" && C.j.zeilen.some((z) => /^EINBAU: nichts faellig/.test(z)),
  C.j ? JSON.stringify(C.j.einbau) : C.err.slice(0, 200));

const D = await lauf({});
pruefe("D: ohne jede Telemetrie weiter BLIND und KEIN einbau-Feld (alter Pfad)", D.j && D.j.urteil === "BLIND" && !("einbau" in D.j), (D.err || D.out).slice(0, 200));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
