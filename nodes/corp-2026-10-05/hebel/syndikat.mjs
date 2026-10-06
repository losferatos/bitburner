// H2-light (06.10.2026): Wann waere The Syndicate in Zyklus 1 eines V2-Knotens
// beigetreten - und woran ist es bisher gescheitert? Nur lesen: die
// Spielstands-Sicherungen unter %USERPROFILE%\bitburner-backups (gzip-JSON).
//
// Aufruf: node nodes/corp-2026-10-05/hebel/syndikat.mjs [muster ...]
//   Standard: BN2L3 und BN3L1 (die beiden letzten V2-Laeufe mit Zyklus 1).
//
// GERECHNET, nicht geschaetzt:
//  1. Bedingungen exakt nach FactionInfo.tsx:601-612 (Aevum/Sector-12, nicht
//     CIA/NSA, 10 Mio, Hacking 200, alle Kampfwerte 200, Karma <= -90).
//  2. Karma-Buchung geeicht: im Zyklus 1 gilt
//        karma = karma(erste Sicherung) - (Toetungs-Erfolge seit dann)
//     (Bladeburner.ts:966-972: -1 je erfolgreichem Vertrag/Op mit isKill,
//     gleich ob Spieler oder Sleeve; Black Op -15, :1050). Der Rest muss 0 sein,
//     sonst gibt es eine Karmaquelle, die das Modell nicht kennt.
//  3. Sleeve-Verbrechen als Alternative: Crime.successRate (Crime.ts:120-136)
//     mit den echten Sleeve-Werten, Karma je Erfolg crime.karma x sync/100
//     (SleeveCrimeWork.ts:47), Homicide 3 s, Karma 3 (Crimes.ts:139-160).
import zlib from "node:zlib"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const DIR = path.join(os.homedir(), "bitburner-backups");
const muster = process.argv.slice(2).length ? process.argv.slice(2) : ["BN2L3", "BN3L1"];
const g = (o) => (o && o.data) || o || {};
const KILL = ["Bounty Hunter", "Retirement", "Raid", "Stealth Retirement Operation", "Assassination"];
const KAMPF = ["strength", "defense", "dexterity", "agility"];

// Crime.ts:120-136, Homicide aus Crimes.ts:139-160, Konstanten aus Constants.ts.
const HOMICIDE = { zeitS: 3, karma: 3, w: { strength: 2, defense: 2, dexterity: 0.5, agility: 0.5 } };
function crimeChance(sk, mults) {
  let c = 0;
  for (const [k, w] of Object.entries(HOMICIDE.w)) c += w * (sk[k] || 0);
  c += 0.025 * (sk.intelligence || 0);          // IntelligenceCrimeWeight
  c /= 975;                                       // MaxSkillLevel
  c /= 1;                                         // difficulty Homicide
  c *= (mults && mults.crime_success) || 1;
  c *= 1;                                         // CrimeSuccessRate BN2/BN3 = 1
  c *= 1 + Math.pow(sk.intelligence || 0, 0.8) / 600;
  return Math.min(c, 1);
}

function zeile(datei) {
  const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, datei))).toString("utf8"));
  const p = JSON.parse(s.data.PlayerSave).data;
  const bb = g(p.bladeburner);
  let kills = 0;
  for (const grp of ["contracts", "operations"]) {
    const o = g(bb[grp]);
    for (const k of KILL) if (o[k]) kills += g(o[k]).successes || 0;
  }
  const jobs = Object.keys(p.jobs || {});
  const k = p.skills;
  const bed = {
    stadt: ["Aevum", "Sector-12"].includes(p.city),
    job: !jobs.includes("Central Intelligence Agency") && !jobs.includes("National Security Agency"),
    geld: p.money >= 10e6,
    hack: k.hacking >= 200,
    kampf: KAMPF.every((x) => k[x] >= 200),
    karma: p.karma <= -90,
  };
  // Sleeve-Homicide: Karma je Stunde, wenn ALLE Sleeves Homicide fahren.
  let sleeveKarmaH = 0;
  for (const sl of p.sleeves || []) {
    const d = g(sl);
    sleeveKarmaH += (3600 / HOMICIDE.zeitS) * crimeChance(d.skills || {}, d.mults) * HOMICIDE.karma * (d.sync || 0) / 100;
  }
  return {
    datei, kn: p.playtimeSinceLastBitnode / 3.6e6, ab: p.playtimeSinceLastAug / 3.6e6, stadt: p.city,
    karma: p.karma, kills, bo: bb.numBlackOpsComplete || 0, kampfMin: Math.min(...KAMPF.map((x) => k[x])),
    hack: k.hacking, geld: p.money, syn: p.factions.includes("The Syndicate"), bed, sleeveKarmaH,
    nSleeves: (p.sleeves || []).length,
  };
}

function interpol(reihe, feld, ziel, abwaerts) {
  for (let i = 1; i < reihe.length; i++) {
    const a = reihe[i - 1], b = reihe[i];
    const getroffen = abwaerts ? b[feld] <= ziel : b[feld] >= ziel;
    const vorher = abwaerts ? a[feld] <= ziel : a[feld] >= ziel;
    if (getroffen && !vorher) return a.kn + (b.kn - a.kn) * (ziel - a[feld]) / (b[feld] - a[feld]);
  }
  return null;
}

for (const m of muster) {
  const dateien = fs.readdirSync(DIR).filter((f) => f.includes("_" + m + "_") && f.endsWith(".json.gz")).sort();
  const alle = dateien.map(zeile);
  // Zyklus 1 = bis zur ersten Sicherung, deren "seit Einbau" kleiner ist als "seit Knoten".
  const z1 = [];
  for (const r of alle) { if (Math.abs(r.ab - r.kn) > 0.01) break; z1.push(r); }
  if (!z1.length) { console.log(m + ": keine Zyklus-1-Sicherung"); continue; }
  console.log(`\n=== ${m} Zyklus 1: ${z1.length} Sicherungen, ${z1[0].kn.toFixed(2)}-${z1.at(-1).kn.toFixed(2)} h ===`);
  console.log("  kn h  Stadt      Karma  Kills  Rest  KampfMin Hack  Syn | fehlt               | Sleeve-Homicide Karma/h");
  const k0 = z1[0].karma + z1[0].kills + 15 * z1[0].bo;
  let maxRest = 0;
  for (const r of z1) {
    // Eichung der Karma-Buchung: k0 - kills - 15*bo muss das Karma treffen.
    // Nur Black Ops mit isKill zaehlen -15; in Zyklus 1 lief bisher keine.
    const rest = r.karma - (k0 - r.kills - 15 * r.bo);
    maxRest = Math.max(maxRest, Math.abs(rest));
    const fehlt = Object.entries(r.bed).filter(([, v]) => !v).map(([n]) => n).join(",") || "-";
    console.log(`  ${r.kn.toFixed(2).padStart(5)} ${r.stadt.padEnd(10)} ${r.karma.toFixed(1).padStart(7)} ${String(r.kills).padStart(5)} ${rest.toFixed(1).padStart(5)} ${String(r.kampfMin).padStart(8)} ${String(r.hack).padStart(4)}  ${r.syn ? "ja " : "nein"} | ${fehlt.padEnd(19)} | ${r.sleeveKarmaH.toFixed(1)} (${r.nSleeves} Sleeves)`);
  }
  const tKarma = interpol(z1, "karma", -90, true);
  const tKampf = interpol(z1, "kampfMin", 200, false);
  const tHack = interpol(z1, "hack", 200, false);
  const ohneStadt = z1.filter((r) => Object.entries(r.bed).every(([n, v]) => n === "stadt" || v));
  const bereit = ohneStadt.length ? ohneStadt[0].kn : null;
  console.log(`  Eichung Karma-Buchung: groesster Rest ${maxRest.toFixed(2)} (0 = keine fremde Karmaquelle)`);
  console.log(`  Karma -90 bei ${tKarma ? tKarma.toFixed(2) + " h" : "nie in Zyklus 1"}, Kampf 200 bei ${tKampf ? tKampf.toFixed(2) + " h" : "nie"}, Hacking 200 bei ${tHack ? tHack.toFixed(2) + " h" : "vor der ersten Sicherung"}`);
  if (bereit !== null) {
    const falsch = ohneStadt.filter((r) => !r.bed.stadt && !r.syn);
    console.log(`  Alles ausser der Stadt erfuellt ab Sicherung ${bereit.toFixed(2)} h; davon ${falsch.length} von ${ohneStadt.length} Sicherungen in der falschen Stadt (${[...new Set(falsch.map((r) => r.stadt))].join(",")}), Einbau bei ${z1.at(-1).kn.toFixed(2)} h, Syndicate am Einbau: ${z1.at(-1).syn ? "ja" : "NEIN"}`);
  } else {
    console.log("  Die Bedingungen ausser der Stadt waren in Zyklus 1 nie zugleich erfuellt.");
  }
}
