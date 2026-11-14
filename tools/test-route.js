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
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
const { planeRoute } = await import(pathToFileURL(routeModul).href);
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

// 9. ABSCHLUSS (14.11.2026): Der letzte Lauf endet mit einem Sprung auf den
//    Landeplatz, nicht mit "fertig". Ohne Sprung wird w0r1d_d43m0n im
//    letzten Lauf nie zerstoert - und die Stufe dieses Laufs (SF8.3) nie
//    gutgeschrieben. Befund am 14.11.2026 10:47: BN8.3 mit Red Pill und
//    Hacking 4010, ausgang.js meldete "Route abgearbeitet" und blieb stehen.
const datei = JSON.parse(readFileSync(path.join(hier, "..", "src", "route.json"), "utf8"));
const landing = datei.finalLanding && datei.finalLanding.node;
pruefe(Number.isInteger(landing) && landing >= 1 && landing <= 15 && landing !== 12,
  "route.json braucht finalLanding.node (1-15, nicht 12), ist " + JSON.stringify(datei.finalLanding));
const opts = { finalLanding: landing };
// Spielstand 14.11.2026 10:24 (Sicherung BN8L3): alle Knoten 3, BN8 auf 2
const sfEnde = new Map([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3], [8, 2]]);
const abschluss = planeRoute(route, 8, sfEnde, () => true, opts);
pruefe(abschluss.lauf && abschluss.lauf.node === 8 && abschluss.lauf.level === 3,
  "Abschluss: dieser Lauf muss BN8 Stufe 3 sein, ist " + JSON.stringify(abschluss.lauf));
pruefe(abschluss.ziel && abschluss.ziel.node === landing && abschluss.ziel.landing === true && !abschluss.fertig,
  "Abschluss: Ziel muss der Landeplatz BN" + landing + " sein (landing: true, nicht fertig), ist "
  + JSON.stringify({ ziel: abschluss.ziel, fertig: abschluss.fertig, grund: abschluss.grund }));
pruefe(abschluss.ziel && [1, 2, 3].includes(abschluss.ziel.level) && ["V1", "V2", "V1b"].includes(abschluss.ziel.verfahren),
  "Abschluss: Landeziel braucht gueltige Stufe und Verfahren, ist " + JSON.stringify(abschluss.ziel));
// Nach dem Sprung: BN8 hat Stufe 3, der Bot steht auf dem Landeplatz - fertig, kein weiterer Sprung
const sfDanach = new Map(sfEnde); sfDanach.set(8, 3);
const danach = planeRoute(route, landing, sfDanach, () => true, opts);
pruefe(danach.fertig && !danach.ziel && !danach.lauf,
  "Nach dem Abschluss: fertig ohne Ziel und ohne Lauf, ist " + JSON.stringify({ ziel: danach.ziel, fertig: danach.fertig, lauf: danach.lauf }));
// Der Landeplatz greift NIE, solange ein Eintrag nur wegen eines fehlenden Gewerks offen ist
const sf15 = new Map([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 2]]);
const gesperrt = planeRoute(route, 15, sf15, (d) => d !== "boerse.js", opts);
pruefe(!gesperrt.ziel && !gesperrt.fertig && gesperrt.uebersprungen.length === 3,
  "Landeplatz darf bei fehlendem Gewerk nicht greifen, ist " + JSON.stringify({ ziel: gesperrt.ziel, fertig: gesperrt.fertig }));
// ... und nicht in einem fremden Knoten, der in der Route nicht offen ist
const fremd = planeRoute(route, 12, sfEnde, () => true, opts);
pruefe(fremd.ziel && fremd.ziel.node === 8 && !fremd.ziel.landing,
  "Fremder Knoten mit offenem BN8: Ziel muss BN8 sein (kein Landeplatz), ist " + JSON.stringify(fremd.ziel));
// Mitten in der Route aendert der Landeplatz nichts
const mitOpts = planeRoute(route, 10, new Map([[1, 1], [4, 1], [5, 1], [6, 1], [10, 1]]), () => true, opts);
pruefe(JSON.stringify(mitOpts) === JSON.stringify(p0), "Landeplatz veraendert einen Lauf mitten in der Route");
// zielErlaubt: der Landeplatz ist erlaubt, alles andere nicht
const { zielErlaubt } = await import(pathToFileURL(routeModul).href);
const zOk = zielErlaubt(route, 8, sfEnde, landing, () => true, opts);
pruefe(zOk.ok, "zielErlaubt muss den Landeplatz BN" + landing + " erlauben: " + zOk.grund);
const zFalsch = zielErlaubt(route, 8, sfEnde, landing === 13 ? 14 : 13, () => true, opts);
pruefe(!zFalsch.ok, "zielErlaubt darf ausser dem Landeplatz nichts erlauben");
// 10. LANDEPLATZ ABSCHLIESSEN (14.11.2026, Eric: "schliesse den aktuellen BN
//     ab", danach Lauf 2): auf dem Landeplatz geht es zum zweiten Landeplatz,
//     dort ist Schluss. Spielstand 14.11. 11:00: BN1, alle Stufen 3.
// Eric 14.11.2026 11:25: "stop wir sind BN Level 3!" - BN1 nicht noch einmal abschliessen.
// route.json traegt deshalb KEIN afterLanding; die Logik bleibt geprueft (fester Wert).
pruefe(!datei.afterLanding, "route.json darf kein afterLanding tragen (Eric 14.11.: kein Abschluss von BN1)");
const nach = 5;
const opts2 = { finalLanding: landing, afterLanding: nach };
const sfAlle = new Map(sfEnde); sfAlle.set(8, 3);
const aufLanding = planeRoute(route, landing, sfAlle, () => true, opts2);
pruefe(aufLanding.ziel && aufLanding.ziel.node === nach && aufLanding.ziel.landing && !aufLanding.fertig,
  "Auf dem Landeplatz: Ziel muss BN" + nach + " sein, ist " + JSON.stringify({ ziel: aufLanding.ziel, fertig: aufLanding.fertig }));
const aufNach = planeRoute(route, nach, sfAlle, () => true, opts2);
pruefe(aufNach.fertig && !aufNach.ziel, "Auf dem zweiten Landeplatz: fertig, kein Sprung - ist " + JSON.stringify(aufNach.ziel));
pruefe(zielErlaubt(route, landing, sfAlle, nach, () => true, opts2).ok, "zielErlaubt muss den zweiten Landeplatz erlauben");
// BN8.3 springt weiter auf den ERSTEN Landeplatz, nicht auf den zweiten
const bn83 = planeRoute(route, 8, sfEnde, () => true, opts2);
pruefe(bn83.ziel && bn83.ziel.node === landing, "BN8.3 mit afterLanding: Ziel muss weiter BN" + landing + " sein");
// Fremder Knoten bei voller Route: kein Sprung
const fremdVoll = planeRoute(route, 13, sfAlle, () => true, opts2);
pruefe(fremdVoll.fertig && !fremdVoll.ziel, "Fremder Knoten bei voller Route darf nicht springen");
// Ungueltige zweite Landeplaetze: kein Sprung (insbesondere = Landeplatz -> Endlosschleife)
for (const schlecht of [landing, 12, 0, 16, "5", null]) {
  const p = planeRoute(route, landing, sfAlle, () => true, { finalLanding: landing, afterLanding: schlecht });
  pruefe(!p.ziel && p.fertig, "afterLanding " + JSON.stringify(schlecht) + " muss ignoriert werden");
}
for (const f of ["ausgang.js", "exit.js"]) {
  const quelle = readFileSync(path.join(hier, "..", "src", f), "utf8");
  pruefe(/routeDatei\.afterLanding/.test(quelle), f + " reicht afterLanding nicht durch");
}
// Frischer Spielstand in BN1 (keine Source-Files): normaler Routenanfang, kein Landesprung
const frisch = planeRoute(route, 1, new Map(), () => true, opts2);
pruefe(frisch.ziel && frisch.ziel.node === route[0].node && !frisch.ziel.landing,
  "Frischer Stand BN1: Ziel muss der erste Routeneintrag sein, ist " + JSON.stringify(frisch.ziel));
// Landeplatz mit offenem Lauf (SF1 = 1): normale Route, kein zweiter Landeplatz
const offen1 = planeRoute(route, 1, new Map([...sfAlle, [1, 1]]), () => true, opts2);
pruefe(offen1.ziel && !(offen1.ziel.landing && offen1.ziel.node === nach), "Landeplatz mit offenem Lauf darf nicht zum zweiten Landeplatz springen");
// Landeplatz bei fehlendem Gewerk: kein Sprung
const sfLuecke = new Map(sfAlle); sfLuecke.set(8, 2);
const luecke = planeRoute(route, landing, sfLuecke, (d) => d !== "boerse.js", opts2);
pruefe(!luecke.ziel && !luecke.fertig, "Landeplatz bei fehlendem Gewerk darf nicht springen");
// zielErlaubt auf dem Landeplatz mit falschem Ziel
pruefe(!zielErlaubt(route, landing, sfAlle, nach === 13 ? 14 : 13, () => true, opts2).ok, "zielErlaubt muss ein falsches Ziel auf dem Landeplatz ablehnen");

// Ungueltige Landeplaetze fuehren zum alten Vertrag (fertig, kein Sprung)
for (const schlecht of [0, 16, 12, null, undefined, "1", true, 1.5, NaN]) {
  const p = planeRoute(route, 8, sfEnde, () => true, { finalLanding: schlecht });
  pruefe(!p.ziel && p.fertig, "Landeplatz " + JSON.stringify(schlecht) + " muss ignoriert werden, ist " + JSON.stringify(p.ziel));
}
// Ohne opts: alter Vertrag
const ohneOpts = planeRoute(route, 8, sfEnde);
pruefe(!ohneOpts.ziel && ohneOpts.fertig, "Ohne opts muss der letzte Lauf 'fertig' bleiben");
// Landeplatz == aktueller Knoten (letzter Eintrag waere BN1): Sprung BN1 -> BN1, danach fertig
const kurz = [{ node: 1, level: 1, verfahren: "V1" }];
const selbst = planeRoute(kurz, 1, new Map(), () => true, { finalLanding: 1 });
pruefe(selbst.ziel && selbst.ziel.node === 1 && selbst.ziel.landing && selbst.ziel.level === 2,
  "Landeplatz = aktueller Knoten: Ziel BN1 Stufe 2 erwartet, ist " + JSON.stringify(selbst.ziel));
const selbstDanach = planeRoute(kurz, 1, new Map([[1, 1]]), () => true, { finalLanding: 1 });
pruefe(selbstDanach.fertig && !selbstDanach.ziel, "Nach Landung im selben Knoten: fertig, kein zweiter Sprung");
// Beide Aufrufer reichen den Landeplatz durch - sonst lehnt exit.js ab, was ausgang.js plant -
// und beide schalten ihn bei Source-File-Overrides ab.
for (const f of ["ausgang.js", "exit.js"]) {
  const quelle = readFileSync(path.join(hier, "..", "src", f), "utf8");
  pruefe(/routeDatei\.finalLanding/.test(quelle) && /finalLanding\.node/.test(quelle),
    f + " reicht finalLanding.node aus route.json nicht an die Routenlogik durch");
  pruefe(/sourceFileOverrides/.test(quelle) && /finalLanding: null|!overrides/.test(quelle),
    f + " schaltet den Landeplatz bei Source-File-Overrides nicht ab");
}

// 8. Format-Vertrag von data/verfahren.txt gegen die Leser (bn4net.js, bn4rep.js)
const zeile = "V2 10 2";
const teile = zeile.trim().split(/\s+/);
pruefe(teile[0] === "V2" && Number(teile[1]) === 10 && Number(teile[2]) === 2,
  "verfahren.txt-Format: '" + zeile + "' muss zu [V2, 10, 2] parsen");

console.log(fehler ? fehler + " Fehler." : "OK: 39 Spruenge, Folge stimmt, alle Knoten enden auf Stufe 3; BN8 Lauf 3 schliesst mit dem Landesprung ab.");
console.log("Folge: " + folge.join(" "));
process.exit(fehler ? 1 : 0);
