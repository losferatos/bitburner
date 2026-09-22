// ARCHIVIERT AM 22.09.2026 (BAUSTELLEN Zeile 1672). Das Werkzeug rechnete
// rohe Kosten ohne die BitNode-Multiplikatoren (AugmentationRepCost,
// AugmentationMoneyCost) und ohne den Warteschlangenfaktor 1,9^k, und es
// bewertete Bladeburner-Augs mit 0,00. Kein Skript und kein Skill rief es
// auf; die Spielskripte fragen Preise in der API ab (kampfaugs.js,
// bn4rep.js). Liegen gelassen, zeigte es nur falsche Zahlen.
/**
 * Was fehlt uns zu 30 Augmentierungen - und was kostet es?
 *
 * WARUM DIESE DATEI
 *
 * Der Ausgang aus BitNode 1 fuehrt ueber Daedalus, und Daedalus verlangt
 * 30 installierte Augmentierungen, 100 Mrd $ und Hacking 2500
 * (Faction/FactionInfo.tsx:138-145). Geld ist laengst kein Engpass mehr, die
 * Zahl der Augmentierungen dagegen schon - und welche davon in Reichweite
 * sind, haengt an der Reputation bei genau der Faktion, die sie anbietet.
 *
 * Diese Zuordnung steht nirgends im Spiel abrufbar: ns.singularity.* braucht
 * Source-File 4, das wir nicht haben. Sie steht aber im Quelltext, und der
 * liegt unter reference/. Diese Datei liest ihn und gleicht ihn mit dem
 * Spielstand ab.
 *
 * ACHTUNG bei der Zaehlung: Daedalus prueft p.augmentations.length
 * (Faction/FactionJoinCondition.ts:130). Der NeuroFlux Governor steht dort als
 * EIN Eintrag, egal auf welcher Stufe - seine 28 Stufen zaehlen als eins.
 * Stapeln bringt fuer diese Schwelle nichts, nur verschiedene Augmentierungen.
 *
 * Aufruf:  node tools/augplan.js            nur Faktionen, in denen wir sind
 *          node tools/augplan.js --alle     auch die uebrigen Faktionen
 */

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8795";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const QUELLE = path.join(HIER, "..", "reference", "bitburner-src", "src", "Augmentation");
const ALLE = process.argv.includes("--alle");

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  let x = n;
  while (Math.abs(x) >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return "$" + (Math.abs(x) < 10 ? x.toFixed(1) : x.toFixed(0)) + u[i];
};

const zahl = (n) => {
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
};

/**
 * Namen der Aufzaehlungen aufloesen. Der Datenblock benutzt durchgehend
 * Symbole (AugmentationName.BitWire, FactionName.NiteSec), die Klartextnamen
 * stehen getrennt davon in den Enums. Ohne diese Tabelle koennte man den
 * Spielstand nicht dagegenhalten - dort stehen die Klartextnamen.
 */
function enumTabelle(datei) {
  const roh = fs.readFileSync(datei, "utf8");
  const t = {};
  for (const m of roh.matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"/gm)) t[m[1]] = m[2];
  return t;
}

/**
 * Den Datenblock zerlegen. Bewusst zeilenweise und ohne Anspruch, TypeScript
 * zu verstehen: Die Eintraege sind streng gleichfoermig aufgebaut, und ein
 * halber Parser waere mehr Fehlerquelle als Hilfe. Was nicht erkannt wird,
 * faellt weg statt falsch zu werden - deshalb zaehlt die Datei am Ende
 * mit, wie viele Eintraege sie gefunden hat.
 */
function liesAugs(augName, facName) {
  const roh = fs.readFileSync(path.join(QUELLE, "Augmentations.ts"), "utf8");
  const bloecke = roh.split(/\[AugmentationName\.(\w+)\]:\s*\{/).slice(1);
  const augs = [];
  for (let i = 0; i < bloecke.length; i += 2) {
    const symbol = bloecke[i];
    const body = bloecke[i + 1] || "";
    const name = augName[symbol] || symbol;
    const rep = Number((body.match(/repCost:\s*([0-9.e+-]+)/) || [])[1]);
    const money = Number((body.match(/moneyCost:\s*([0-9.e+-]+)/) || [])[1]);
    const facRoh = (body.match(/factions:\s*\[([^\]]*)\]/s) || [])[1] || "";
    const factions = [...facRoh.matchAll(/FactionName\.(\w+)/g)]
      .map((m) => facName[m[1]] || m[1]);
    // Multiplikatoren. Sie stehen NICHT an einer festen Stelle im Eintrag -
    // mal vor `info`, mal dahinter (vgl. ClarkeIncorporated gegen
    // NeuroreceptorManager). Der erste Anlauf schnitt den Eintrag bei `info`
    // ab und fand deshalb bei keiner einzigen Augmentierung einen Wert.
    // Darum der ganze Eintrag, und stattdessen die Nicht-Multiplikatoren
    // ausdruecklich ausgeschlossen. Die Textfelder koennen nicht
    // dazwischenrutschen, weil das Muster eine Zahl verlangt.
    const KEIN_MULT = ["repCost", "moneyCost", "level", "startingMoney", "programs"];
    const mults = {};
    for (const m of body.matchAll(/^\s*(\w+):\s*([0-9.]+),\s*$/gm)) {
      if (KEIN_MULT.includes(m[1])) continue;
      mults[m[1]] = Number(m[2]);
    }
    const prereqs = [...(body.match(/prereqs:\s*\[([^\]]*)\]/s) || ["", ""])[1]
      .matchAll(/AugmentationName\.(\w+)/g)].map((m) => augName[m[1]] || m[1]);
    augs.push({ symbol, name, rep, money, factions, mults, prereqs });
  }
  return augs;
}

async function stand() {
  const body = await (await fetch(BASE + "/api/rpc?method=getSaveFile")).json();
  if (body.error) throw new Error(body.error);
  return JSON.parse(zlib.gunzipSync(Buffer.from(body.result.save, "latin1")).toString("utf8"));
}

// Wie stark hilft eine Augmentierung beim eigentlichen Engpass? Hacking-Level
// und Reputationsrate sind das, woran der Fortschritt haengt - Firmen- und
// Verbrechenswerte sind in diesem Lauf Beiwerk.
const GEWICHT = {
  hacking: 3, hacking_exp: 2, faction_rep: 3,
  hacking_money: 1, hacking_speed: 1, hacking_chance: 0.5, hacking_grow: 0.5,
};
const nutzen = (mults) => {
  let s = 0;
  for (const [k, v] of Object.entries(mults)) s += (GEWICHT[k] || 0) * (v - 1);
  return s;
};

async function main() {
  let s;
  try {
    s = await stand();
  } catch (e) {
    console.log("KEIN ZUGRIFF: " + e.message + "\nLaeuft die Bruecke? bitburner\\start.cmd");
    process.exit(1);
  }
  const p = JSON.parse(s.data.PlayerSave).data;
  const f = JSON.parse(s.data.FactionsSave);

  const augName = enumTabelle(path.join(QUELLE, "Enums.ts"));
  const facName = enumTabelle(path.join(QUELLE, "..", "Faction", "Enums.ts"));
  const augs = liesAugs(augName, facName);

  const habe = new Set((p.augmentations || []).map((a) => a.name));
  const inQueue = new Set((p.queuedAugmentations || []).map((a) => a.name));
  const mitglied = new Set(p.factions || []);

  console.log("");
  console.log("  " + augs.length + " Augmentierungen im Katalog, " + habe.size
    + " installiert, " + inQueue.size + " in der Warteschlange.");
  console.log("  Daedalus verlangt 30 verschiedene - es fehlen "
    + Math.max(0, 30 - habe.size) + ".");
  console.log("");

  // Nach Faktion gruppieren, damit man sieht, wo sich Arbeit lohnt.
  const proFaktion = {};
  for (const a of augs) {
    if (habe.has(a.name) || inQueue.has(a.name)) continue;
    if (a.name === "NeuroFlux Governor") continue;  // zaehlt nur einmal
    for (const fac of a.factions) {
      (proFaktion[fac] ||= []).push(a);
    }
  }

  const zeilen = [];
  for (const [fac, liste] of Object.entries(proFaktion)) {
    const drin = mitglied.has(fac);
    if (!drin && !ALLE) continue;
    const d = (f[fac] && (f[fac].data || f[fac])) || {};
    const rep = Number.isFinite(d.playerReputation) ? d.playerReputation : 0;
    // Erreichbar heisst: Reputation reicht schon. Diese Zahl ist der
    // eigentliche Befund - alles andere kostet erst noch Arbeitszeit.
    const jetzt = liste.filter((a) => a.rep <= rep);
    const bezahlbar = jetzt.filter((a) => a.money <= p.money);
    zeilen.push({ fac, drin, rep, liste, jetzt, bezahlbar });
  }
  zeilen.sort((a, b) => b.bezahlbar.length - a.bezahlbar.length || b.jetzt.length - a.jetzt.length);

  let sofort = 0;
  for (const z of zeilen) {
    const kopf = "  " + z.fac + (z.drin ? "" : "  (kein Mitglied)")
      + "   " + zahl(z.rep) + " Rep";
    console.log(kopf);
    console.log("  " + "-".repeat(Math.max(20, kopf.length - 2)));
    // Aufsteigend nach Rep-Kosten: so sieht man sofort, wie weit die naechste
    // Schwelle noch weg ist.
    for (const a of z.liste.sort((x, y) => x.rep - y.rep).slice(0, 12)) {
      const reichtRep = a.rep <= z.rep;
      const reichtGeld = a.money <= p.money;
      const fehlt = a.prereqs.filter((q) => !habe.has(q) && !inQueue.has(q));
      const marke = fehlt.length ? "braucht " + fehlt.join(", ")
        : reichtRep && reichtGeld ? "KAUFBAR"
          : reichtRep ? "Geld fehlt"
            : "noch " + zahl(a.rep - z.rep) + " Rep";
      if (reichtRep && reichtGeld && !fehlt.length) sofort++;
      console.log("    " + a.name.slice(0, 42).padEnd(42)
        + zahl(a.rep).padStart(8) + " Rep  "
        + geld(a.money).padStart(8) + "   "
        + nutzen(a.mults).toFixed(2).padStart(5) + "  " + marke);
    }
    if (z.liste.length > 12) console.log("    ... und " + (z.liste.length - 12) + " weitere");
    console.log("");
  }

  console.log("  Sofort kaufbar (Rep und Geld reichen, Vorbedingungen erfuellt): " + sofort);
  console.log("  Die Spalte vor dem Vermerk ist der Nutzen fuer Hacking und Reputation;");
  console.log("  0.00 heisst: zaehlt nur als Kopf fuer die 30er-Schwelle.");
  console.log("");
}

main().catch((e) => console.log("Fehler: " + e.message));
