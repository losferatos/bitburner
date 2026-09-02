/**
 * Prueft die Routenlogik von src/ausgang.js ueber die gesamte Route.
 *
 * Aufruf:  node tools/test-route.js
 *
 * Simuliert ab dem heutigen Source-File-Stand jeden Sprung: Ziel waehlen,
 * Stufe des verlassenen Knotens um eins erhoehen, weiter. Erwartet wird
 * genau die Reihenfolge aus route.json, nie ein Sprung, der einen Lauf
 * verschenkt (Stufe > 3 oder Stufe, die schon vorhanden ist), und am Ende
 * "fertig". Exit-Code 1 bei jeder Abweichung.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { planeRoute } from "../src/ausgang.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const { route } = JSON.parse(readFileSync(path.join(hier, "..", "src", "route.json"), "utf8"));

let fehler = 0;
const pruefe = (bedingung, text) => { if (!bedingung) { fehler++; console.log("FEHLER: " + text); } };

// 1. Route selbst
pruefe(route.length === 40, "Route hat " + route.length + " Eintraege, erwartet 40");
const stufeJeKnoten = {};
for (const e of route) {
  pruefe(Number.isInteger(e.node) && e.node >= 1 && e.node <= 15, "Knoten ungueltig: " + JSON.stringify(e));
  pruefe([1, 2, 3].includes(e.level), "Stufe ungueltig: " + JSON.stringify(e));
  pruefe(["V1", "V2", "V1b"].includes(e.verfahren), "Verfahren ungueltig: " + JSON.stringify(e));
  const vorher = stufeJeKnoten[e.node] || 0;
  pruefe(e.level === vorher + 1 || (vorher === 0 && e.level === 2), "Stufen je Knoten nicht aufsteigend: " + JSON.stringify(e));
  stufeJeKnoten[e.node] = e.level;
}

// 2. Der Live-Zustand vom 02.09.2026, 17:23 (ns.getResetInfo im Spiel)
const sf = new Map([[1, 1], [4, 1], [5, 1], [6, 1], [10, 1]]);
let cur = 10;
const p0 = planeRoute(route, cur, sf);
pruefe(p0.lauf && p0.lauf.node === 10 && p0.lauf.level === 2 && p0.lauf.verfahren === "V2",
  "Live: dieser Lauf muss BN10 Stufe 2 V2 sein, ist " + JSON.stringify(p0.lauf));
pruefe(p0.ziel && p0.ziel.node === 10 && p0.ziel.level === 3,
  "Live: Ziel muss BN10 Stufe 3 sein, ist " + JSON.stringify(p0.ziel));

// 3. Alle Spruenge durchspielen
const folge = [];
for (let schritt = 0; schritt < 60; schritt++) {
  const plan = planeRoute(route, cur, sf);
  if (plan.fertig) break;
  pruefe(plan.ziel, "Schritt " + schritt + ": kein Ziel, Grund: " + plan.grund);
  if (!plan.ziel) break;
  pruefe(plan.lauf, "Schritt " + schritt + ": aktueller Knoten " + cur + " nicht in der Route offen");
  // Sprung: der verlassene Knoten bekommt seine Stufe
  const neu = (sf.get(cur) || 0) + 1;
  pruefe(neu <= 3, "Schritt " + schritt + ": Knoten " + cur + " wuerde Stufe " + neu + " bekommen");
  sf.set(cur, neu);
  // Das Ziel darf nur ein Knoten sein, dem genau die naechste Stufe fehlt
  const zielStufe = sf.get(plan.ziel.node) || 0;
  pruefe(plan.ziel.level === zielStufe + 1,
    "Schritt " + schritt + ": Ziel BN" + plan.ziel.node + " Stufe " + plan.ziel.level + ", hat aber " + zielStufe);
  folge.push(cur + "->" + plan.ziel.node);
  cur = plan.ziel.node;
}
const erwartet = route.slice(1).map((e, i) => route[i].node + "->" + e.node);
// 40 Eintraege = 39 Spruenge; der letzte Lauf (BN8 Stufe 3) endet mit "fertig",
// nicht mit einem Sprung.
pruefe(folge.length === 39, "Erwartet 39 Spruenge, simuliert " + folge.length);
pruefe(JSON.stringify(folge) === JSON.stringify(erwartet),
  "Sprungfolge weicht ab:\n  ist      " + folge.join(" ") + "\n  erwartet " + erwartet.join(" "));
const ende = planeRoute(route, cur, sf);
pruefe(ende.fertig, "Am Ende nicht fertig: " + JSON.stringify(ende));
for (const n of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]) {
  pruefe((sf.get(n) || 0) === 3, "Knoten " + n + " endet mit Stufe " + (sf.get(n) || 0));
}
// Der letzte Lauf ist noch offen: BN8 hat Stufe 2, Lauf 3 laeuft, kein Ziel mehr.
pruefe(cur === 8 && (sf.get(8) || 0) === 2 && ende.lauf && ende.lauf.level === 3,
  "Ende: erwartet BN8 Stufe 2 mit offenem Lauf 3, ist cur=" + cur + " sf8=" + sf.get(8) + " lauf=" + JSON.stringify(ende.lauf));

// 3b. Die ersten fuenf Spruenge als Literal (nicht aus der Datei abgeleitet)
pruefe(folge.slice(0, 5).join(" ") === "10->10 10->4 4->4 4->9 9->9",
  "Die ersten fuenf Spruenge muessen 10->10 10->4 4->4 4->9 9->9 sein, sind " + folge.slice(0, 5).join(" "));

// 4. Randfaelle
const r1 = planeRoute(route, 7, new Map([[1, 1], [4, 1], [5, 1], [6, 1], [10, 1]]));
pruefe(r1.lauf && r1.lauf.node === 7 && r1.lauf.level === 1, "Ausser der Reihe in BN7: Lauf muss BN7 Stufe 1 sein");
pruefe(r1.ziel && r1.ziel.node === 10 && r1.ziel.level === 2, "Ausser der Reihe in BN7: Ziel muss BN10 Stufe 2 sein, ist " + JSON.stringify(r1.ziel));
const r2 = planeRoute(route, 9, new Map([[9, 3]]));
pruefe(!r2.lauf && r2.grund.includes("nicht offen"), "BN9 mit Stufe 3: kein offener Lauf, Grund muss das sagen");
const r3 = planeRoute([], 10, new Map());
pruefe(r3.fertig && !r3.ziel, "Leere Route: fertig");
const r4 = planeRoute(route, 10, { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 });
pruefe(r4.ziel && r4.ziel.node === 10 && r4.ziel.level === 3, "Objekt statt Map muss dasselbe liefern");
pruefe(r2.verfahren === "V2", "BN9 mit Stufe 3: Verfahren-Rueckfall muss V2 sein (letzter Eintrag des Knotens), ist " + r2.verfahren);

// 5. braucht: fehlendes Gewerk wird uebersprungen, nicht abgewartet
const sfEndeBn4 = new Map([[1, 1], [4, 2], [5, 1], [6, 1], [10, 3]]);
const ohne = planeRoute(route, 4, sfEndeBn4, (d) => d !== "hashes.js");
pruefe(ohne.ziel && ohne.ziel.node === 1 && ohne.ziel.level === 2,
  "Ohne hashes.js muss nach BN4 L3 das Ziel BN1 L2 sein, ist " + JSON.stringify(ohne.ziel));
pruefe(ohne.uebersprungen.length === 3 && ohne.uebersprungen.every((e) => e.node === 9),
  "Ohne hashes.js muessen genau die drei BN9-Eintraege uebersprungen sein");
const mit = planeRoute(route, 4, sfEndeBn4, () => true);
pruefe(mit.ziel && mit.ziel.node === 9 && mit.ziel.level === 1,
  "Mit hashes.js muss das Ziel BN9 L1 sein, ist " + JSON.stringify(mit.ziel));
const nurBn8 = planeRoute(route, 15, new Map([[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,2]]), (d) => d !== "boerse.js");
pruefe(!nurBn8.ziel && !nurBn8.fertig && nurBn8.uebersprungen.length === 3,
  "Nur BN8 offen ohne boerse.js: kein Ziel, nicht fertig, drei uebersprungen - ist " + JSON.stringify({ ziel: nurBn8.ziel, fertig: nurBn8.fertig, n: nurBn8.uebersprungen.length }));

// 6. Startstand hoeher als der erste Routeneintrag des Knotens
const hoch = planeRoute(route, 4, new Map([[1, 1], [4, 2], [5, 1], [6, 1], [10, 3]]));
pruefe(hoch.lauf && hoch.lauf.level === 3 && hoch.ziel && hoch.ziel.node === 9,
  "SF4=2 in BN4: Lauf muss Stufe 3 sein und Ziel BN9, ist " + JSON.stringify({ lauf: hoch.lauf, ziel: hoch.ziel }));

// 7. Kaputte Eintraege werden gemeldet, nicht still uebersprungen
const kaputt = planeRoute([{ node: 10, level: 2, verfahren: "V2" }, { node: 4, verfahren: "V2" }], 10, new Map([[10, 1]]));
pruefe(!kaputt.ziel && /ungueltig/.test(kaputt.grund), "Eintrag ohne level muss als ungueltig gemeldet werden, Grund: " + kaputt.grund);
const tipp = planeRoute([{ node: 10, level: 2, verfahren: "v2" }], 10, new Map([[10, 1]]));
pruefe(!tipp.ziel && /ungueltig/.test(tipp.grund), "Verfahren 'v2' muss als ungueltig gemeldet werden");

// 8. Format-Vertrag von data/verfahren.txt gegen die Leser (bn4net.js, bn4rep.js)
const zeile = "V2 10 2";
const teile = zeile.trim().split(/\s+/);
pruefe(teile[0] === "V2" && Number(teile[1]) === 10 && Number(teile[2]) === 2,
  "verfahren.txt-Format: '" + zeile + "' muss zu [V2, 10, 2] parsen");

console.log(fehler ? fehler + " Fehler." : "OK: 39 Spruenge, Folge stimmt, alle Knoten enden auf Stufe 3 (BN8 Lauf 3 als letzter offen).");
console.log("Folge: " + folge.join(" "));
process.exit(fehler ? 1 : 0);
