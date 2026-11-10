/**
 * BN8: Tian Di Hui ohne Gym, Sector-12-Rueckreise, kein Pingpong mit Aevum
 * (10.11.2026). Prueft src/bn4life.js (bn8TripPlan + Reiseblock + joinrun-Sperre).
 *
 * Der Mock hat keine Einladungslogik: der Test haengt checkFactionInvitations/
 * joinFaction selbst ein und bildet die Spielregel nach (FactionInfo.tsx):
 * Einladung, wenn Stadt + Geld + Hacking stimmen - einmal ausgesprochen bleibt
 * sie bestehen.
 *
 * Aufruf: node tools/test-bn8-tdh.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else { rot++; console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}

const W0 = 1_700_000_000_000;
const TDH = ["Chongqing", "New Tokyo", "Ishima"];

/**
 * Fahrt `runden` Schleifendurchlaeufe von bn4life.js. Jede Runde springt die
 * Wanduhr um `schritt` ms (Standard 31 s -> Reise- und Faktionsblick laufen
 * wie im Spiel, nur schneller). `geldFolge(runde)` setzt das Guthaben je Runde.
 */
async function fahre(o) {
  const m = neuerMock({
    host: "home", knoten: o.knoten ?? 8, wall: W0, playtime: 60000,
    nodeReset: W0 - 60000, augReset: W0 - 60000, geld: o.geld ?? 0,
    faktionen: o.faktionen ?? [],
    server: { home: { ram: 512, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
    dateien: { home: { "joinrun.js": "//", "netburn.js": "//", "bn4net.js": "//",
      ...(o.reserve != null ? { "data/geldbedarf.txt": String(o.reserve) } : {}) } },
    maxSchlaf: o.runden ?? 1,
    beiSchlaf: (ms, z, vor) => {
      z.wall += o.schritt ?? 31000;
      if (o.geldFolge) z.spieler.money = o.geldFolge(z.schlafZeiten.length);
      einladen(z);
    },
  });
  const z = m.zustand;
  z.spieler.city = o.stadt ?? "Sector-12";
  z.spieler.skills = { hacking: o.hack ?? 100, strength: 10, defense: 10, dexterity: 10, agility: 10 };
  const reisen = [];
  const eingeladen = new Set();
  // Spielregel nach: Einladung ab Stadt+Geld+Hacking, danach dauerhaft.
  function einladen(zz) {
    const money = zz.spieler.money;
    const stadt = zz.spieler.city;
    if (TDH.includes(stadt) && money >= 1e6 && zz.spieler.skills.hacking >= 50) eingeladen.add("Tian Di Hui");
    if (stadt === "Sector-12" && money >= 15e6) eingeladen.add("Sector-12");
    if (stadt === "Aevum" && money >= 40e6) eingeladen.add("Aevum");
  }
  m.ns.heart = { break: () => 0 };
  m.ns.singularity.checkFactionInvitations = () => { einladen(z); return [...eingeladen].filter((f) => !z.faktionen.includes(f)); };
  m.ns.singularity.joinFaction = (f) => { if (!eingeladen.has(f)) return false; z.faktionen.push(f); return true; };
  m.ns.singularity.travelToCity = (c) => {
    if (z.spieler.money < 200e3) return false;
    z.spieler.money -= 200e3; reisen.push(c); z.spieler.city = c; z.stadt = c; return true;
  };
  einladen(z);
  const { modul } = await ladeAusBeiden(ROOT, "bn4life.js");
  const zurueck = m.uhrStellen();
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  finally { zurueck(); }
  return { m, reisen, z, gestartet: z.gestartet.map((g) => g.datei) };
}

console.log("");
console.log("=== bn4life.js BN8: Tian Di Hui ohne Gym ===");

{
  const r = await fahre({ geld: 3e6, hack: 80, runden: 6, geldFolge: () => 3e6 });
  pruefe("BN8, Hacking 80, 3 Mio: Reise nach Chongqing", r.reisen[0] === "Chongqing", JSON.stringify(r.reisen));
  pruefe("und Tian Di Hui beigetreten", r.z.faktionen.includes("Tian Di Hui"), r.z.faktionen.join(","));
  pruefe("joinrun.js wird in BN8 nicht gestartet", !r.gestartet.includes("joinrun.js"), r.gestartet.join(","));
}
{
  const r = await fahre({ geld: 3e6, hack: 49, runden: 4, geldFolge: () => 3e6 });
  pruefe("Hacking 49: keine Reise", r.reisen.length === 0, JSON.stringify(r.reisen));
}
{
  const r = await fahre({ geld: 1.3e6, hack: 80, runden: 4, geldFolge: () => 1.3e6 });
  pruefe("1,3 Mio (< 1,2 Mio + Reise): keine Reise", r.reisen.length === 0, JSON.stringify(r.reisen));
}
{
  const r = await fahre({ geld: 3e6, hack: 80, runden: 4, reserve: 2e6, geldFolge: () => 3e6 });
  pruefe("Reserve geldbedarf 2 Mio von 3 Mio: keine Reise", r.reisen.length === 0, JSON.stringify(r.reisen));
}
{
  const r = await fahre({ geld: 3.5e6, hack: 80, runden: 6, reserve: 2e6, geldFolge: () => 3.5e6 });
  pruefe("3,5 Mio minus Reserve 2 Mio reicht: Reise + Beitritt",
    r.reisen[0] === "Chongqing" && r.z.faktionen.includes("Tian Di Hui"), JSON.stringify(r.reisen));
}
{
  const r = await fahre({ geld: 3e6, hack: 80, runden: 6, stadt: "Ishima", geldFolge: () => 3e6 });
  pruefe("schon in Ishima: keine Reise, Beitritt trotzdem",
    r.reisen.length === 0 && r.z.faktionen.includes("Tian Di Hui"), JSON.stringify(r.reisen));
}
{
  const r = await fahre({ geld: 3e6, hack: 80, runden: 6, faktionen: ["Tian Di Hui"], geldFolge: () => 3e6 });
  pruefe("schon Mitglied: keine Reise", r.reisen.length === 0, JSON.stringify(r.reisen));
}

console.log("");
console.log("-- Reihenfolge, kein Pingpong mit Sector-12 und Aevum --");
{
  // Realistischer Ablauf nach einem Einbau: erst 3 Mio (TDH), dann 100 Mio.
  const r = await fahre({ geld: 3e6, hack: 100, runden: 40, geldFolge: (n) => (n < 4 ? 3e6 : 100e6) });
  const f = r.z.faktionen;
  pruefe("alle drei beigetreten (Tian Di Hui, Sector-12, Aevum)",
    ["Tian Di Hui", "Sector-12", "Aevum"].every((x) => f.includes(x)), f.join(",") + " | " + r.reisen.join(">"));
  pruefe("Reihenfolge Chongqing > Sector-12 > Aevum, genau drei Reisen",
    r.reisen.join(">") === "Chongqing>Sector-12>Aevum", r.reisen.join(">"));
  // Reich ab Runde 1: Sector-12 tritt noch vor der Reise bei, danach TDH, dann Aevum.
  const r2 = await fahre({ geld: 100e6, hack: 100, runden: 40, geldFolge: () => 100e6 });
  pruefe("reich von Anfang an: Chongqing > Aevum, alle drei Mitglied",
    r2.reisen.join(">") === "Chongqing>Aevum"
    && ["Tian Di Hui", "Sector-12", "Aevum"].every((x) => r2.z.faktionen.includes(x)), r2.reisen.join(">") + " | " + r2.z.faktionen.join(","));
}
{
  // Einladungen fallen aus (Geld springt nur zur Reisezeit hoch): die Reisen
  // sind je Ziel gedeckelt, 40 Runden duerfen nicht 40 Reisen heissen.
  const r = await fahre({ geld: 100e6, hack: 100, runden: 60, schritt: 61000,
    geldFolge: (n) => (n % 2 ? 100e6 : 0.5e6) });
  pruefe("wechselndes Geld: hoechstens 2 Reisen je Ziel (kein Dauerpendeln)",
    r.reisen.length <= 2 * 3, r.reisen.join(">"));
}
{
  // Reserve haelt Tian Di Hui zurueck, Aevum darf trotzdem wie bisher.
  const r = await fahre({ geld: 100e6, hack: 100, runden: 12, reserve: 99.9e6, geldFolge: () => 100e6 });
  pruefe("Reserve sperrt Tian Di Hui, Aevum-Reise bleibt moeglich",
    !r.reisen.includes("Chongqing") && r.reisen.includes("Aevum"), r.reisen.join(">"));
}

console.log("");
console.log("-- anderer Knoten: unveraendert --");
{
  const r = await fahre({ knoten: 1, geld: 100e6, hack: 100, runden: 12, geldFolge: () => 100e6 });
  pruefe("BN1: nur die Aevum-Reise wie bisher", r.reisen.join(">") === "Aevum", r.reisen.join(">"));
  pruefe("BN1: Tian Di Hui nicht durch Reise", !r.reisen.includes("Chongqing"));
}
{
  const r = await fahre({ knoten: 1, geld: 6e6, hack: 100, runden: 1, geldFolge: () => 6e6 });
  pruefe("BN1 mit 6 Mio: joinrun.js startet wie bisher", r.gestartet.includes("joinrun.js"), r.gestartet.join(","));
}
{
  const r = await fahre({ knoten: 8, geld: 6e6, hack: 100, runden: 1, geldFolge: () => 6e6 });
  pruefe("BN8 mit 6 Mio: joinrun.js startet NICHT", !r.gestartet.includes("joinrun.js"), r.gestartet.join(","));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
