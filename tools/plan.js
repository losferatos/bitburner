/**
 * Der Lagebericht mit Handlungsempfehlung.
 *
 * Alle anderen Werkzeuge zeigen ZUSTAND. Dieses hier zieht daraus den
 * SCHLUSS: was ist der naechste Schritt, und was blockiert ihn.
 *
 * Der Anlass ist der 20.08.2026. Der Bot stand nachts fuenf Stunden still und
 * hing danach stundenlang am selben Punkt fest - beides waere sofort sichtbar
 * gewesen, wenn irgendetwas den Fortschrittspfad geprueft haette statt nur
 * Guthaben und Speicher. Der Pfad in BitNode 1 ist immer derselbe:
 *
 *   Zugriff -> Faktion -> Reputation -> Augmentations -> Reset -> von vorn
 *
 * Jede Stufe hat genau eine Vorbedingung. Faellt eine aus, steht alles
 * dahinter - egal wie gut die Wirtschaft laeuft.
 *
 * Aufruf:  node tools/plan.js
 */

import zlib from "node:zlib";

const BASE = "http://localhost:8795";

// Repziel je Faktion: die hoechste Anforderung unter ihren Augmentations.
const REP_ZIEL = { CyberSec: 18750, NiteSec: 45000, "The Black Hand": 175000, BitRunners: 875000 };
// Welcher Backdoor oeffnet welche Faktion.
const OEFFNET = { CSEC: "CyberSec", "avmnite-02h": "NiteSec", "I.I.I.I": "The Black Hand", "run4theh111z": "BitRunners" };
const PORTKNACKER = [
  { name: "BruteSSH.exe", preis: 500e3 }, { name: "FTPCrack.exe", preis: 1.5e6 },
  { name: "relaySMTP.exe", preis: 5e6 }, { name: "HTTPWorm.exe", preis: 30e6 },
  { name: "SQLInject.exe", preis: 250e6 },
];

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return "$" + (Math.abs(n) < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

async function rpc(method, params = {}) {
  const q = new URLSearchParams({ method, ...params });
  const body = await (await fetch(BASE + "/api/rpc?" + q)).json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function main() {
  let save, state;
  try {
    const r = await rpc("getSaveFile");
    save = JSON.parse(zlib.gunzipSync(Buffer.from(r.save, "latin1")).toString("utf8"));
    state = await (await fetch(BASE + "/api/state")).json();
  } catch (e) {
    console.log("Nicht lesbar: " + e.message + "  (laeuft die Bruecke?)");
    process.exit(1);
  }

  const p = JSON.parse(save.data.PlayerSave).data;
  const factions = JSON.parse(save.data.FactionsSave);
  const alle = JSON.parse(save.data.AllServersSave);
  const t = state.telemetry || {};
  const wege = t.factionPaths || {};

  const server = {};
  for (const k of Object.keys(alle)) {
    const s = alle[k] && alle[k].data;
    if (s) server[s.hostname] = s;
  }
  const daheim = new Set((server.home && server.home.programs) || []);
  const schritte = [];

  // --- Wirtschaft -----------------------------------------------------------
  console.log("");
  console.log("  LAGE   Hacking " + p.skills.hacking + "   " + geld(p.money)
    + "   " + geld((t.income || {}).scriptIncome || 0) + "/s"
    + "   " + (state.rootedCount || 0) + "/" + (state.serverCount || 0) + " Rechner"
    + "   " + Math.round(((t.ram || {}).max || 0) / 1024) + " TB");

  const stillstand = t.t && Date.now() - t.t > 120000;
  if (stillstand) schritte.push(["!!", "Telemetrie ist " + Math.round((Date.now() - t.t) / 1000)
    + "s alt - der Autopilot haengt oder ist tot"]);

  // --- Stufe 1: Zugriff -----------------------------------------------------
  const fehlend = PORTKNACKER.filter((x) => !daheim.has(x.name));
  if (!daheim.size) {
    schritte.push(["!!", "KEIN einziges Programm auf home - selbst NUKE.exe fehlt"]);
  } else if (fehlend.length) {
    const naechst = fehlend[0];
    if (p.money >= naechst.preis) {
      schritte.push(["->", "Portknacker kaufbar: buy " + naechst.name + " (" + geld(naechst.preis) + ")"]);
    } else {
      schritte.push(["..", "Sammelt fuer " + naechst.name + ": " + geld(p.money) + " von " + geld(naechst.preis)]);
    }
  }

  // --- Stufe 2: Faktion -----------------------------------------------------
  console.log("");
  if (!p.factions.length) {
    console.log("  FAKTION   keine - hier steht der gesamte Fortschritt");
    // Welcher Backdoor fehlt, und ist er erreichbar?
    let gefunden = false;
    for (const [host, fak] of Object.entries(OEFFNET)) {
      const s = server[host];
      if (!s || s.backdoorInstalled) continue;
      const w = wege[host];
      if (p.skills.hacking < s.requiredHackingSkill) continue;
      if (!s.hasAdminRights) {
        schritte.push(["->", host + " noch nicht gerootet - Portknacker fehlen"]);
      } else if (w) {
        schritte.push(["->", "Backdoor auf " + host + " setzt " + fak + " frei:"]);
        schritte.push(["  ", "node tools/hand.js " + w.cmd.split("; ").map((x) => "'" + x + "'").join(" ") + " backdoor"]);
      } else {
        schritte.push(["->", "Backdoor auf " + host + " faellig, aber der Weg fehlt in der Telemetrie"]);
      }
      gefunden = true;
      break;
    }
    if (!gefunden) {
      const naechst = Object.entries(OEFFNET)
        .map(([h, f]) => ({ h, f, lvl: (server[h] || {}).requiredHackingSkill || 9999 }))
        .filter((x) => !(server[x.h] || {}).backdoorInstalled)
        .sort((a, b) => a.lvl - b.lvl)[0];
      if (naechst) schritte.push(["..", "Naechste Faktion " + naechst.f + " ab Hacking "
        + naechst.lvl + " (jetzt " + p.skills.hacking + ")"]);
    }
    if (p.factionInvitations.length) {
      schritte.push(["->", "Offene Einladung: " + p.factionInvitations.join(", ")
        + " - Beitritt braucht einen echten Mausklick auf Join!"]);
    }
  } else {
    for (const f of p.factions) {
      const d = (factions[f] || {}).data || {};
      const rep = Math.round(d.playerReputation || 0);
      const ziel = REP_ZIEL[f];
      const bar = ziel ? "  von " + ziel + "  (" + Math.round((rep / ziel) * 100) + "%)" : "";
      console.log("  FAKTION   " + f.padEnd(18) + rep + " rep" + bar);
      if (ziel && rep >= ziel) schritte.push(["->", f + " hat das Repziel erreicht - Augmentations kaufen"]);
    }
    const w = p.currentWork;
    if (!w) schritte.push(["!!", "KEINE Faktionsarbeit - die Reputation steht still"]);
  }

  // --- Stufe 3: Augmentations ----------------------------------------------
  const queue = (p.queuedAugmentations || []).length;
  const inst = (p.augmentations || []).length;
  console.log("");
  console.log("  AUGS   " + inst + " installiert, " + queue + " gekauft und wartend"
    + "   Multiplikator hacking " + (p.mults.hacking ?? 1).toFixed(2));
  if (queue >= 4) schritte.push(["->", queue + " Augmentations warten - ein Reset lohnt sich"]);

  // --- Ergebnis -------------------------------------------------------------
  console.log("");
  if (!schritte.length) {
    console.log("  Nichts zu tun - alles laeuft nach Plan.");
  } else {
    console.log("  NAECHSTE SCHRITTE");
    for (const [z, s] of schritte) console.log("  " + z + " " + s);
  }
  console.log("");
}

main().catch((e) => console.log("Fehler: " + e.message));
