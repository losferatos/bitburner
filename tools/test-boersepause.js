// Test BN8-1: Depot wird VOR den letzten Kaeufen des Einbaus verkauft.
// Aufruf: node tools/test-boersepause.js [srcVerzeichnis]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2] || path.join(HIER, "..", "src"));
let gruen = 0, rot = 0;
const pruefe = (name, ok) => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name); } };

const libPfad = path.join(SRC, "lib", "boersepause.js");
pruefe("lib/boersepause.js existiert", fs.existsSync(libPfad));
if (fs.existsSync(libPfad)) {
  const L = await import(pathToFileURL(libPfad).href);
  const t0 = 1_000_000_000;
  const roh = L.pauseAnlegen(t0);
  const p = L.pauseLesen(roh, t0 + 1000);
  pruefe("frische Pause ist aktiv", p.aktiv && typeof p.id === "string");
  pruefe("abgelaufene Pause ist inaktiv", !L.pauseLesen(roh, t0 + L.PAUSE_MS + 1).aktiv);
  pruefe("kaputte Pausendatei = keine Pause", !L.pauseLesen("{kaputt", t0).aktiv && !L.pauseLesen("", t0).aktiv);
  const tel = (o) => JSON.stringify({ ts: t0 + 500, state: "work", posten: 7, depotWert: 3.7e8, ...o });
  pruefe("Quittung fuer diese id -> quittiert", L.freigabe(tel({ verkauftFuer: p.id }), p.id, t0 + 6000, t0) === "quittiert");
  pruefe("Quittung fuer alte id -> warten", L.freigabe(tel({ verkauftFuer: "p1" }), p.id, t0 + 6000, t0) === "warten");
  pruefe("keine Telemetrie -> keinhandel", L.freigabe(null, p.id, t0 + 6000, t0) === "keinhandel");
  pruefe("veraltete Telemetrie -> keinhandel", L.freigabe(tel({ ts: t0 - L.TEL_FRISCH_MS - 10 }), p.id, t0 + 6000, t0) === "keinhandel");
  pruefe("boerse beendet -> keinhandel", L.freigabe(tel({ state: "done" }), p.id, t0 + 6000, t0) === "keinhandel");
  pruefe("leeres Depot NACH der Anfrage -> keinhandel", L.freigabe(tel({ ts: t0 + 3000, posten: 0, depotWert: 0 }), p.id, t0 + 6000, t0) === "keinhandel");
  pruefe("leeres Depot VOR der Anfrage -> warten (Kauf koennte dazwischen liegen)", L.freigabe(tel({ ts: t0 - 3000, posten: 0, depotWert: 0 }), p.id, t0 + 6000, t0) === "warten");
  pruefe("Frist vorbei -> zeitueber", L.freigabe(tel(), p.id, t0 + L.WARTE_MAX_MS, t0) === "zeitueber");
}

const rep = fs.readFileSync(path.join(SRC, "bn4rep.js"), "utf8");
const iPause = rep.indexOf("boersePauseAnlegen(");
const iNfg = rep.indexOf("NEUROFLUX ZULETZT");
const iFuell = rep.indexOf("einbauLandetEinsUnterSchwelle(installiertJetzt");
const iInstall = rep.indexOf('ns.singularity.installAugmentations("boot.js")');
pruefe("bn4rep legt die Pause an", iPause > 0);
pruefe("... vor dem Fuellstueck-Kauf", iPause > 0 && iPause < iFuell);
pruefe("... vor der NeuroFlux-Schleife", iPause > 0 && iPause < iNfg);
pruefe("... vor installAugmentations", iPause > 0 && iPause < iInstall);
pruefe("... nach dem Handschlag", iPause > rep.indexOf('handschlag(ns, "install"'));

const boe = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
const iP = boe.indexOf("pauseLesen(");
pruefe("boerse.js liest die Pause", iP > 0);
pruefe("... mit ns als erstem Argument (hostdatei-Signatur)", boe.includes("liesVonHome(ns, PAUSE_FILE)"));
pruefe("bn4rep verwendet eine laufende Pause wieder", rep.includes("boersePauseLesen(liesVonHome(BOERSE_PAUSE_FILE), seit).restMs > 3 * 60000"));
pruefe("... und prueft sie vor dem Kaufen", iP > 0 && iP < boe.indexOf("ns.stock.buyStock("));
pruefe("... und quittiert mit verkauftFuer", /verkauftFuer:\s*pause\.id/.test(boe));

const boot = fs.readFileSync(path.join(SRC, "boot.js"), "utf8");
pruefe("boot.js raeumt die Pause nach dem Einbau weg", boot.includes('"data/boerse-pause.txt"'));

const reg = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
const eintraege = Array.isArray(reg) ? reg : (reg.tools || reg.scripts || Object.values(reg).find(Array.isArray) || []);
for (const n of ["bn4rep.js", "boerse.js"]) {
  const e = eintraege.find((x) => x && x.name === n);
  pruefe(n + " bekommt lib/boersepause.js kopiert", !!e && (e.needsLibs || []).includes("lib/boersepause.js"));
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
