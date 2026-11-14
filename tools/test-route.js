/**
 * Prueft die Routenlogik von src/lib/route.js ueber BEIDE Routen und die
 * Epochenwahl (Lauf 1 = route.json, Lauf 2 = route-lauf2.json).
 *
 * Aufruf:  node tools/test-route.js
 *
 * Simuliert ab dem Startstand jeden Sprung: Ziel waehlen, Stufe des
 * verlassenen Knotens um eins erhoehen, weiter. Erwartet wird genau die
 * Reihenfolge aus der Datei, nie ein Sprung, der einen Lauf verschenkt
 * (Stufe > 3 oder Stufe, die schon vorhanden ist), und am Ende "fertig".
 * Eintragszahlen werden aus der Datei abgeleitet (45 minus die Stufen, die
 * die Route als "schon da" voraussetzt), nicht als Zahl behauptet.
 *
 * Wichtigste Pruefung (K01): LAUF 1 BLEIBT WIE HEUTE. route.json ist gegen
 * einen festen Fingerabdruck gepinnt, und die Lauf-1-Lage (BN8.x) liefert
 * ueber die Epochenwahl dasselbe Ziel wie planeRoute direkt auf route.json.
 * Exit-Code 1 bei jeder Abweichung.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const hier = path.dirname(fileURLToPath(import.meta.url));

// planeRoute liegt seit Position C.3 in src/lib/route.js. ausgang.js
// re-exportiert sie weiter, laesst sich aus Node aber nicht mehr laden: seine
// Importe stehen im Bitburner-Stil ("lib/x.js", absolut ab home), den Node
// nicht aufloest. Der Test greift deshalb direkt auf das Modul zu - und sucht
// es dort, wo es liegt: im Worktree, solange die Position nicht live ist.
const routeModul = [
  path.resolve(hier, "..", "..", "bitburner-bau", "src", "lib", "route.js"),
  path.resolve(hier, "..", "src", "lib", "route.js"),
].find((p) => existsSync(p));
if (!routeModul) {
  console.log("src/lib/route.js nicht gefunden - weder im Worktree noch live.");
  process.exit(1);
}
const R = await import(pathToFileURL(routeModul).href);
const { planeRoute, zielErlaubt, leseEpoche, routeDatei, ladeRoute } = R;
const srcDir = path.join(hier, "..", "src");
const text1 = readFileSync(path.join(srcDir, "route.json"), "utf8");
const text2 = readFileSync(path.join(srcDir, "route-lauf2.json"), "utf8");
const doc1 = JSON.parse(text1);
const doc2 = JSON.parse(text2);
const route = doc1.route;   // Lauf 1 (Abschnitte 0-8 unten)
const route2 = doc2.route;  // Lauf 2

let fehler = 0;
const pruefe = (bedingung, text) => { if (!bedingung) { fehler++; console.log("FEHLER: " + text); } };

// Aus der Route abgeleitet: Stufe, die vor dem ersten Eintrag eines Knotens
// schon da sein muss (erster Eintrag Stufe m -> SF m-1), und die Zahl der
// Eintraege, die eine vollstaendige Route von dort hat.
function voraussetzung(r) {
  const klein = {};
  for (const e of r) if (!(e.node in klein) || e.level < klein[e.node]) klein[e.node] = e.level;
  const sf = new Map();
  for (const [n, m] of Object.entries(klein)) if (m > 1) sf.set(Number(n), m - 1);
  const erwartet = Object.keys(klein).length * 3 - [...sf.values()].reduce((a, b) => a + b, 0);
  return { sf, erwartet, knoten: Object.keys(klein).map(Number) };
}

// Strukturpruefung einer Route; strenge = Lauf 2 beginnt bei Stufe 1.
function pruefeStruktur(name, r, strenge) {
  const v = voraussetzung(r);
  pruefe(r.length === v.erwartet, name + ": Route hat " + r.length + " Eintraege, abgeleitet erwartet " + v.erwartet);
  const stufeJeKnoten = {};
  for (const e of r) {
    pruefe(Number.isInteger(e.node) && e.node >= 1 && e.node <= 15, name + ": Knoten ungueltig: " + JSON.stringify(e));
    pruefe([1, 2, 3].includes(e.level), name + ": Stufe ungueltig: " + JSON.stringify(e));
    pruefe(["V1", "V2", "V1b"].includes(e.verfahren), name + ": Verfahren ungueltig: " + JSON.stringify(e));
    const vorher = stufeJeKnoten[e.node] || 0;
    const ok = strenge
      ? e.level === vorher + 1
      : (e.level === vorher + 1 || (vorher === 0 && e.level === 2));
    pruefe(ok, name + ": Stufen je Knoten nicht aufsteigend: " + JSON.stringify(e));
    stufeJeKnoten[e.node] = e.level;
  }
  return v;
}

// Alle Spruenge durchspielen. beiLauf(cur, plan, sf) darf zusaetzlich pruefen.
function spiele(name, r, cur0, sf0, beiLauf) {
  const sf = new Map(sf0);
  let cur = cur0;
  const folge = [];
  for (let schritt = 0; schritt < 80; schritt++) {
    const plan = planeRoute(r, cur, sf);
    if (plan.fertig) break;
    pruefe(plan.ziel, name + " Schritt " + schritt + ": kein Ziel, Grund: " + plan.grund);
    if (!plan.ziel) break;
    pruefe(plan.lauf, name + " Schritt " + schritt + ": aktueller Knoten " + cur + " nicht in der Route offen");
    if (beiLauf) beiLauf(cur, plan, sf);
    const neu = (sf.get(cur) || 0) + 1;
    pruefe(neu <= 3, name + " Schritt " + schritt + ": Knoten " + cur + " wuerde Stufe " + neu + " bekommen");
    sf.set(cur, neu);
    const zielStufe = sf.get(plan.ziel.node) || 0;
    pruefe(plan.ziel.level === zielStufe + 1,
      name + " Schritt " + schritt + ": Ziel BN" + plan.ziel.node + " Stufe " + plan.ziel.level + ", hat aber " + zielStufe);
    folge.push(cur + "->" + plan.ziel.node);
    cur = plan.ziel.node;
  }
  return { folge, sf, cur, ende: planeRoute(r, cur, sf) };
}

// ===========================================================================
// LAUF 1 (route.json) - unveraendert wie vor K01
// ===========================================================================

// 0. Fingerabdruck: route.json ist Lauf 1 und bleibt es. Gepinnt ist die
//    geparste Route (nicht die Bytes: Zeilenenden wechseln je Checkout).
//    Wert gegen "git show master:src/route.json" geeicht (14.11.2026).
//    Wer die Lauf-1-Route absichtlich aendert, tauscht den Wert hier mit
//    ausdruecklichem Commit - sonst ist dieser Test die Bremse.
const ROUTE1_SHA256 = "36c4adc6b225c6b396246c03bca2187b2d1772b6c0cd1430c791e1eaa7f6ed19";
const ist1 = createHash("sha256").update(JSON.stringify(route)).digest("hex");
pruefe(ist1 === ROUTE1_SHA256, "route.json (Lauf 1) wurde veraendert: Fingerabdruck " + ist1);
pruefe(doc1.epoche === undefined, "route.json darf kein Feld 'epoche' tragen (gilt als lauf1)");

// 1. Route selbst
const v1 = pruefeStruktur("Lauf 1", route, false);
pruefe(route.length === 40, "Lauf 1: Route hat " + route.length + " Eintraege, erwartet 40 (Stand heute)");

// 2. Der Live-Zustand vom 02.09.2026, 17:23 (ns.getResetInfo im Spiel)
const sf = new Map([[1, 1], [4, 1], [5, 1], [6, 1], [10, 1]]);
pruefe(JSON.stringify([...v1.sf].sort()) === JSON.stringify([...sf].sort()),
  "Lauf 1: abgeleitete Voraussetzung " + JSON.stringify([...v1.sf]) + " weicht vom Live-Stand ab");
const cur = 10;
const p0 = planeRoute(route, cur, sf);
pruefe(p0.lauf && p0.lauf.node === 10 && p0.lauf.level === 2 && p0.lauf.verfahren === "V2",
  "Live: dieser Lauf muss BN10 Stufe 2 V2 sein, ist " + JSON.stringify(p0.lauf));
pruefe(p0.ziel && p0.ziel.node === 10 && p0.ziel.level === 3,
  "Live: Ziel muss BN10 Stufe 3 sein, ist " + JSON.stringify(p0.ziel));

// 3. Alle Spruenge durchspielen
const sim1 = spiele("Lauf 1", route, cur, sf);
const folge = sim1.folge;
const erwartet = route.slice(1).map((e, i) => route[i].node + "->" + e.node);
// 40 Eintraege = 39 Spruenge; der letzte Lauf (BN8 Stufe 3) endet mit "fertig",
// nicht mit einem Sprung.
pruefe(folge.length === route.length - 1, "Lauf 1: Erwartet " + (route.length - 1) + " Spruenge, simuliert " + folge.length);
pruefe(JSON.stringify(folge) === JSON.stringify(erwartet),
  "Sprungfolge weicht ab:\n  ist      " + folge.join(" ") + "\n  erwartet " + erwartet.join(" "));
for (const n of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]) {
  pruefe((sim1.sf.get(n) || 0) === 3, "Lauf 1: Knoten " + n + " endet mit Stufe " + (sim1.sf.get(n) || 0));
}
// Der letzte Lauf ist noch offen: BN8 hat Stufe 2, Lauf 3 laeuft, kein Ziel mehr.
pruefe(sim1.cur === 8 && (sim1.sf.get(8) || 0) === 2 && sim1.ende.fertig && sim1.ende.lauf && sim1.ende.lauf.level === 3,
  "Lauf 1 Ende: erwartet BN8 Stufe 2 mit offenem Lauf 3, ist cur=" + sim1.cur + " sf8=" + sim1.sf.get(8) + " lauf=" + JSON.stringify(sim1.ende.lauf));

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

// ===========================================================================
// LAUF 1 UEBER DIE EPOCHENWAHL - muss dasselbe liefern wie heute (K01)
// ===========================================================================

// 9. Fehlende Epoche = lauf1 = route.json, Eintrag fuer Eintrag gleich
for (const leer of [undefined, null, "", "  \n", "{}", '{"epoche":""}', "﻿"]) {
  pruefe(leseEpoche(leer) === "lauf1", "leseEpoche(" + JSON.stringify(leer) + ") muss lauf1 sein, ist " + leseEpoche(leer));
}
pruefe(routeDatei("lauf1") === "route.json" && routeDatei("lauf2") === "route-lauf2.json",
  "routeDatei: lauf1 -> route.json, lauf2 -> route-lauf2.json");
pruefe(routeDatei("constructor") === null && routeDatei(null) === null && routeDatei("lauf3") === null,
  "routeDatei: unbekannte Epoche -> null (auch 'constructor')");
{
  // Die Lage von heute: BN8, Stufe 0/1/2 im Besitz (Lauf 8.1 / 8.2 / 8.3 laeuft).
  const alleSf = (s8) => new Map([[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,s8],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3]]);
  for (const s8 of [0, 1, 2]) {
    const L = ladeRoute(text1, leseEpoche(undefined), 8, alleSf(s8));
    pruefe(L.ok && L.epoche === "lauf1" && L.datei === "route.json", "Lauf-1-Lage BN8 sf8=" + s8 + ": ladeRoute muss ok sein, ist " + JSON.stringify(L));
    pruefe(JSON.stringify(L.route) === JSON.stringify(route), "Lauf-1-Lage: Route ueber Epochenwahl weicht von route.json ab");
    const direkt = planeRoute(route, 8, alleSf(s8), () => true);
    const ueber = planeRoute(L.route, 8, alleSf(s8), () => true);
    pruefe(JSON.stringify(direkt) === JSON.stringify(ueber), "Lauf-1-Lage BN8 sf8=" + s8 + ": Plan ueber Epochenwahl weicht ab");
    // Literal: sf8=1 -> Lauf BN8 L2, Ziel BN8 L3; sf8=2 -> Lauf L3, kein Ziel, fertig
    if (s8 === 1) {
      pruefe(ueber.lauf && ueber.lauf.node === 8 && ueber.lauf.level === 2 && ueber.ziel && ueber.ziel.node === 8 && ueber.ziel.level === 3,
        "BN8 mit SF8=1: Lauf 8.2, Ziel 8.3 erwartet, ist " + JSON.stringify({ l: ueber.lauf, z: ueber.ziel }));
      const z = zielErlaubt(L.route, 8, alleSf(1), 8, () => true);
      pruefe(z.ok && z.erwartet === 8, "BN8 SF8=1: Sprung nach 8 muss erlaubt sein, ist " + JSON.stringify(z.grund));
    }
    if (s8 === 2) pruefe(ueber.fertig && !ueber.ziel && ueber.lauf && ueber.lauf.level === 3, "BN8 mit SF8=2: fertig, Lauf 8.3 offen");
  }
  // Mitte von Lauf 1 (Live-Stand 02.09.): BN10 L2 -> Ziel BN10 L3, wie heute
  const L = ladeRoute(text1, "lauf1", 10, sf);
  pruefe(L.ok, "Lauf 1, Stand 02.09.: ladeRoute muss ok sein: " + L.grund);
}

// ===========================================================================
// LAUF 2 (route-lauf2.json)
// ===========================================================================

pruefe(doc2.epoche === "lauf2", "route-lauf2.json muss epoche 'lauf2' tragen");
const v2 = pruefeStruktur("Lauf 2", route2, true);
pruefe(v2.sf.size === 0, "Lauf 2 darf nichts voraussetzen (frischer Spielstand), setzt aber " + JSON.stringify([...v2.sf]));
pruefe(v2.knoten.length === 15, "Lauf 2: alle 15 Knoten muessen vorkommen, es sind " + v2.knoten.length);
// R1 und SPEC K01 als Literal: Anfang BN1.1, BN4.1-4.3 (alle V1), danach BN1.2
const anfang2 = route2.slice(0, 5).map((e) => e.node + "." + e.level + e.verfahren).join(" ");
pruefe(anfang2 === "1.1V1 4.1V1 4.2V1 4.3V1 1.2V1", "Lauf 2: Anfang muss 1.1 4.1 4.2 4.3 1.2 (alle V1) sein, ist " + anfang2);
// Verfahren je Knoten: V1 nur in 1, 4, 5, 12, 8 (R8), V2 sonst; nirgends V1b (R7)
for (const e of route2) {
  const soll = [1, 4, 5, 8, 12].includes(e.node) ? "V1" : "V2";
  pruefe(e.verfahren === soll, "Lauf 2: BN" + e.node + "." + e.level + " muss " + soll + " sein, ist " + e.verfahren);
}
// BN8 zuletzt (R4), BN10 vor BN9 vor BN12 (R5)
pruefe(route2.slice(-3).every((e) => e.node === 8), "Lauf 2: BN8 muss ganz am Ende stehen (R4)");
pruefe(route2.findIndex((e) => e.node === 10) < route2.findIndex((e) => e.node === 9)
  && route2.findIndex((e) => e.node === 9) < route2.findIndex((e) => e.node === 12), "Lauf 2: Reihenfolge 10 vor 9 vor 12 (R5)");
// Stufen am Stueck (R3): jeder Knoten steht in einem zusammenhaengenden Block -
// Ausnahmen laut Reihenfolge: BN1 (1.1 vor den 4.x) und BN6 (6.1 oeffnet V2, 6.2/6.3 spaeter)
{
  const bloecke = {};
  route2.forEach((e, i) => { (bloecke[e.node] = bloecke[e.node] || []).push(i); });
  const zerrissen = Object.entries(bloecke).filter(([, is]) => is[is.length - 1] - is[0] + 1 !== is.length).map(([n]) => Number(n));
  pruefe(JSON.stringify(zerrissen) === JSON.stringify([1, 6]), "Lauf 2: zerrissene Knoten muessen genau [1,6] sein, sind " + JSON.stringify(zerrissen));
}
// Vor dem ersten BN4-Eintrag steht nur BN1.1: ohne SF4 wirft jeder Singularity-Aufruf ausserhalb BN4 (R2)
pruefe(route2.findIndex((e) => e.node === 4) === 1 && route2[0].node === 1 && route2[0].level === 1,
  "Lauf 2: BN4.1 muss direkt auf BN1.1 folgen (R2)");

// Alle Spruenge ab frischem Spielstand; V2 erst mit SF6/SF7 oder in BN6/BN7 selbst
const sim2 = spiele("Lauf 2", route2, 1, new Map(), (c, plan, s) => {
  if (plan.lauf && plan.lauf.verfahren === "V2") {
    pruefe((s.get(6) || 0) >= 1 || (s.get(7) || 0) >= 1 || c === 6 || c === 7,
      "Lauf 2: V2 in BN" + c + " ohne SF6/SF7 (Bladeburner wirft)");
  }
  if (plan.lauf && plan.lauf.node === 4) {
    // BN4.x in V1: kein Bladeburner ohne SF6/7 (A15)
    pruefe(plan.lauf.verfahren === "V1", "Lauf 2: BN4 muss V1 sein");
  }
});
const erwartet2 = route2.slice(1).map((e, i) => route2[i].node + "->" + e.node);
pruefe(sim2.folge.length === route2.length - 1, "Lauf 2: Erwartet " + (route2.length - 1) + " Spruenge, simuliert " + sim2.folge.length);
pruefe(JSON.stringify(sim2.folge) === JSON.stringify(erwartet2), "Lauf 2: Sprungfolge weicht ab:\n  ist      " + sim2.folge.join(" ") + "\n  erwartet " + erwartet2.join(" "));
pruefe(sim2.folge.slice(0, 10).join(" ") === "1->4 4->4 4->4 4->1 1->1 1->5 5->5 5->5 5->6 6->10",
  "Lauf 2: die ersten zehn Spruenge (Literal) sind " + sim2.folge.slice(0, 10).join(" "));
for (const n of v2.knoten.filter((x) => x !== 8)) {
  pruefe((sim2.sf.get(n) || 0) === 3, "Lauf 2: Knoten " + n + " endet mit Stufe " + (sim2.sf.get(n) || 0));
}
pruefe(sim2.cur === 8 && (sim2.sf.get(8) || 0) === 2 && sim2.ende.fertig && sim2.ende.lauf && sim2.ende.lauf.level === 3,
  "Lauf 2 Ende: erwartet BN8 Stufe 2 mit offenem Lauf 3, ist cur=" + sim2.cur);

// Die Lauf-2-Lage: BN1.1, keine SF -> Ziel BN4.1 (V1); alles andere wird abgelehnt
{
  const L = ladeRoute(text2, leseEpoche('{"epoche":"lauf2"}'), 1, new Map());
  pruefe(L.ok && L.epoche === "lauf2" && L.datei === "route-lauf2.json", "Lauf-2-Lage: ladeRoute muss ok sein: " + L.grund);
  const p = planeRoute(L.route, 1, new Map(), () => true);
  pruefe(p.lauf && p.lauf.node === 1 && p.lauf.level === 1 && p.lauf.verfahren === "V1", "BN1.1 ohne SF: Lauf muss BN1 L1 V1 sein, ist " + JSON.stringify(p.lauf));
  pruefe(p.ziel && p.ziel.node === 4 && p.ziel.level === 1 && p.ziel.verfahren === "V1", "BN1.1 ohne SF: Ziel muss BN4.1 (V1) sein, ist " + JSON.stringify(p.ziel));
  pruefe(zielErlaubt(L.route, 1, {}, 4, () => true).ok, "BN1.1 -> BN4: Sprung muss erlaubt sein");
  pruefe(!zielErlaubt(L.route, 1, {}, 10, () => true).ok, "BN1.1 -> BN10: Sprung muss abgelehnt werden");
  // BN4.1 in V1 mit SF4=0: Lauf BN4 L1 V1, Ziel BN4 L2
  const q = planeRoute(L.route, 4, { 1: 1 }, () => true);
  pruefe(q.lauf && q.lauf.node === 4 && q.lauf.level === 1 && q.lauf.verfahren === "V1" && q.ziel && q.ziel.node === 4 && q.ziel.level === 2,
    "BN4.1: Lauf BN4 L1 V1, Ziel BN4 L2 erwartet, ist " + JSON.stringify({ l: q.lauf, z: q.ziel }));
  // Dieselbe Lage mit leerem Objekt statt Map
  pruefe(ladeRoute(text2, "lauf2", 1, {}).ok, "Lauf 2 mit leerem Objekt als ownedSF muss ok sein");
}

// ===========================================================================
// DIE LEINEN: falsche oder fehlende Epoche darf nie springen lassen
// ===========================================================================

// leseEpoche: Namen, JSON, Gross/Klein, Muell
pruefe(leseEpoche("lauf2") === "lauf2" && leseEpoche(" Lauf2\n") === "lauf2", "leseEpoche: Text 'lauf2' (auch mit Leerraum/Grossbuchstaben)");
pruefe(leseEpoche('{"epoche":"lauf2","identifier":"x"}') === "lauf2" && leseEpoche({ epoche: "lauf2" }) === "lauf2", "leseEpoche: JSON-Text und Objekt");
pruefe(leseEpoche("﻿" + '{"epoche":"lauf1"}') === "lauf1", "leseEpoche: BOM vor JSON");
for (const muell of ["lauf3", "lauf", "2", '{"epoche":"lauf3"}', '{"epoche":2}', '{"epoche":["lauf2"]}', "{kaputt", "[]", 5, true, ["lauf2"]]) {
  pruefe(leseEpoche(muell) === null, "leseEpoche(" + JSON.stringify(muell) + ") muss null sein (unbekannt != lauf1), ist " + leseEpoche(muell));
}
// null/unbekannte Epoche -> leere Route -> kein Sprung (undefined waere "fehlt" -> aber ladeRoute kennt nur Namen)
for (const e of [null, "lauf3", undefined]) {
  const L = ladeRoute(text1, e, 8, {});
  pruefe(!L.ok && L.route.length === 0, "ladeRoute mit Epoche " + JSON.stringify(e) + " muss leer sein");
  pruefe(!zielErlaubt(L.route, 8, {}, 8, () => true).ok, "leere Route aus Epoche " + JSON.stringify(e) + " darf keinen Sprung erlauben");
}
// Datei gehoert zu einer anderen Epoche
{
  const a = ladeRoute(text1, "lauf2", 1, {});
  const b = ladeRoute(text2, "lauf1", 8, new Map([[1,3],[4,3],[5,3],[6,3],[10,3]]));
  pruefe(!a.ok && /Epoche/.test(a.grund) && a.route.length === 0, "route.json bei Epoche lauf2 muss abgelehnt werden: " + a.grund);
  pruefe(!b.ok && /Epoche/.test(b.grund) && b.route.length === 0, "route-lauf2.json bei Epoche lauf1 muss abgelehnt werden: " + b.grund);
}
// Kaputte Dateien
for (const kaputtText of ["", "{", "[]", '{"route":[]}', '{"route":"x"}', "null"]) {
  const L = ladeRoute(kaputtText, "lauf1", 8, {});
  pruefe(!L.ok && L.route.length === 0, "ladeRoute mit Dateiinhalt " + JSON.stringify(kaputtText) + " muss leer sein");
}
// Frisches Spiel (BN1.1, keine SF) mit vergessener Epochendatei: ohne die zweite Leine
// kaeme "Ziel BN10" heraus - das ist der Fehlsprung, den K01 verhindern soll.
{
  const roh = planeRoute(route, 1, new Map(), () => true);
  pruefe(roh.ziel && roh.ziel.node === 10, "Gegenprobe: planeRoute(Lauf-1-Route, BN1.1, keine SF) waere Ziel BN10 (der Fehlsprung), ist " + JSON.stringify(roh.ziel));
  const L = ladeRoute(text1, leseEpoche(undefined), 1, new Map());
  pruefe(!L.ok && L.route.length === 0 && /Spielstand passt nicht/.test(L.grund), "Frisches Spiel + fehlende Epochendatei muss abgelehnt werden: " + L.grund);
  pruefe(!zielErlaubt(L.route, 1, new Map(), 10, () => true).ok, "Frisches Spiel + fehlende Epochendatei: Sprung nach BN10 darf nicht erlaubt sein");
  // Teilstand: nur SF1 vorhanden -> Lauf-1-Route passt immer noch nicht (SF4/5/6/10 fehlen)
  const T = ladeRoute(text1, "lauf1", 4, { 1: 1 });
  pruefe(!T.ok && /SF4/.test(T.grund), "Teilstand nur SF1: Lauf-1-Route muss abgelehnt werden: " + T.grund);
  // Voller Lauf-1-Stand als Map und als Objekt
  pruefe(ladeRoute(text1, "lauf1", 10, { 1: 1, 4: 1, 5: 1, 6: 1, 10: 1 }).ok, "Lauf-1-Stand als Objekt muss ok sein");
  pruefe(ladeRoute(text1, "lauf1", 10, sf).ok, "Lauf-1-Stand als Map muss ok sein");
}

console.log(fehler ? fehler + " Fehler." :
  "OK: Lauf 1 " + route.length + " Eintraege / " + folge.length + " Spruenge (unveraendert, Fingerabdruck stimmt), Lauf 2 " + route2.length + " Eintraege / " + sim2.folge.length + " Spruenge (BN1.1 -> BN4.1 ...), Epochen-Leinen halten.");
console.log("Folge Lauf 1: " + folge.join(" "));
console.log("Folge Lauf 2: " + sim2.folge.join(" "));
process.exit(fehler ? 1 : 0);
