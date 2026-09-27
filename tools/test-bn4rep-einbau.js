/**
 * Ebene 0: `lib/einbau.js` - die Entscheidungsfunktionen hinter Paket A
 * (Audit "perfekter Bot", 26.09.2026, A1-A7) und der Skeptiker-Nacharbeit
 * (nodes/audit-2026-09-26/skeptiker-A.md, Einwaende 1-13).
 *
 * ===========================================================================
 * WAS SICH GEGENUEBER DER ERSTEN FASSUNG GEAENDERT HAT (Einwand 7)
 * ===========================================================================
 *
 * Die erste Fassung verglich an fuenf Stellen eine lokale Attrappe mit sich
 * selbst (`const alt = () => false; pruefe(..., alt() === false)`) - gruen
 * war das immer, gleich was im Code stand. Die uebrigen Pruefungen trafen
 * Einzeiler mit ausgedachten Zahlen. Ungeprueft blieb genau das, was
 * entschied: der Einkommensschaetzer, der Spendenmerker, das Wertmass mit
 * echten Namen, die Vorbedingungen des Fuellstuecks, das NMI.
 *
 * Jetzt:
 *   - jede Pruefung ruft die ECHTE Funktion aus `src/lib/einbau.js` mit
 *     Zahlen aus den echten Spielstaenden (audit-input/backups, dekodiert am
 *     26.09.2026: `scriptProdSinceLastAug / playtimeSinceLastAug`, Guthaben
 *     aus dem bn4rep-Log im Moment des Fehl-Einbaus) oder mit den echten
 *     Augmentierungsnamen aus `src/lib/hackaugs.js`;
 *   - fehlt eine Funktion, ist das ein ROT, kein Absturz - so laesst sich
 *     dieselbe Datei gegen den Stand VOR der Nacharbeit fahren
 *     (`BN4REP_SRC=<alter src-Ordner> node tools/test-bn4rep-einbau.js`) und
 *     zeigt dort ROT, was hier GRUEN ist;
 *   - der Hauptlauf selbst (Handschlag, Tore vor dem NFG-Kauf, Fuellstueck im
 *     Kampfknoten, Fokus) wird in `tools/test-bn4rep-ebene2.js` gegen einen
 *     nachgebauten Spielzustand gefahren.
 *
 * Aufruf: node tools/test-bn4rep-einbau.js
 *         BN4REP_SRC=/pfad/zu/src node tools/test-bn4rep-einbau.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = process.env.BN4REP_SRC ? path.resolve(process.env.BN4REP_SRC) : path.join(ROOT, "src");

function finde(rel) {
  const k = [path.join(SRC, rel), path.resolve(ROOT, "..", "bitburner-bau", "src", rel)];
  const t = k.find((p) => fs.existsSync(p));
  if (!t) {
    console.log("\n  " + rel + " nicht gefunden unter " + SRC);
    process.exit(1);
  }
  return t;
}

const M = await import(pathToFileURL(finde("lib/einbau.js")).href);
// Die Werte-Tabelle kommt IMMER aus dem aktuellen Baum: sie ist Eingabe,
// nicht Pruefling (hackaugs.js hat keinen Import, laesst sich direkt laden).
const { HACK_AUGS, combatNutzen } = await import(
  pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

/**
 * Ruft eine Funktion aus lib/einbau.js; fehlt sie oder wirft sie, ist das
 * Ergebnis ein eigener Marker - damit die Pruefung ROT wird statt die Datei
 * abstuerzen zu lassen (Gegenprobe gegen den alten Stand).
 */
const FEHLT = Symbol("fehlt");
function ruf(name, ...args) {
  if (typeof M[name] !== "function") return FEHLT;
  try { return M[name](...args); } catch (e) { return { geworfen: String(e && e.message) }; }
}

console.log("");
console.log("=== lib/einbau.js: Paket A + Skeptiker-Nacharbeit (" + SRC + ") ===");

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 1: Einkommen aus getTotalScriptIncome, nicht aus Rundendifferenzen --");
{
  // BN5.2 19:03 (Spielstand 19-03 pre-install): scriptProdSinceLastAug
  // 435.401.136.284 $ in 418,6 s -> 1.040.136.494 $/s. Das Spiel gibt
  // [laufend, seitEinbau] zurueck; die Hack-Arbeiter sind Einmalskripte, der
  // erste Wert ist deshalb nahe 0.
  const r = ruf("einkommenAusScriptIncome", [0, 1040136493.75]);
  pruefe("seitEinbau-Wert wird genommen (19:03: 1,04 Mrd/s), nicht der laufende",
    r === 1040136493.75, "erhalten " + String(r));
  pruefe("unlesbares Ergebnis -> 0 (dann gilt die alte 4x-Regel allein)",
    ruf("einkommenAusScriptIncome", undefined) === 0
      && ruf("einkommenAusScriptIncome", [0, NaN]) === 0
      && ruf("einkommenAusScriptIncome", [5, -3]) === 0);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwaende 1 und 6: Horizontregel nie strenger als die alte 4x-Regel --");

// Echte Zahlen. Preise: Basis x AugmentationMoneyCost (BN5: 2, BN1: 1) x 1,9^q
// (kein SF11 im Bestand, AugmentationHelpers.ts:29-37).
const q3 = Math.pow(1.9, 3);
const VORFAELLE = [
  // Fehl-Einbauten laut Log - hier darf die Regel NICHT feuern.
  { name: "BN5.2 16:57:10 Neuralstimulator", preis: 3e9 * 2 * q3, geld: 2598e6, inc: 353915611.37 },
  { name: "BN5.2 19:03:08 PCMatrix", preis: 2e9 * 2 * q3, geld: 13808e6, inc: 1040136493.75 },
  { name: "BN1.3 00:23:13 PCMatrix", preis: 2e9 * 1 * q3, geld: 1502e6, inc: 750334343.82 },
];
for (const f of VORFAELLE) {
  const neu = ruf("unbezahlbarInHorizont", {
    preis: f.preis, geld: f.geld, einkommenProSek: f.inc, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe(f.name + ": mit echtem Einkommen still", neu === false, "erhalten " + String(neu));
  // DIE ERSTE RUNDE NACH EINEM NEUSTART: die erste Fassung hatte dort
  // einkommenProSek = 0 (Schaetzer ohne Vorrunde). Mit getTotalScriptIncome
  // ist das Einkommen sofort da - dieselben Zahlen, dieselbe Antwort.
  const ersteRunde = ruf("unbezahlbarInHorizont", {
    preis: f.preis, geld: f.geld,
    einkommenProSek: ruf("einkommenAusScriptIncome", [0, f.inc]),
    horizontSek: 600, spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe(f.name + ": auch in Runde 1 nach Neustart still", ersteRunde === false,
    "erhalten " + String(ersteRunde));
}
{
  // 19:03 ist der Fall, in dem die ALTE Regel still war (27,44 < 4 x 13,81)
  // und die erste Fassung mit einkommenProSek = 0 feuerte.
  const f = VORFAELLE[1];
  const alt = f.preis > 4 * f.geld;
  const ohneEinkommen = ruf("unbezahlbarInHorizont", {
    preis: f.preis, geld: f.geld, einkommenProSek: 0, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("19:03 ohne Einkommen: so still wie die alte Regel (alt feuert: " + alt + ")",
    alt === false && ohneEinkommen === false, "erhalten " + String(ohneEinkommen));
}
{
  // BN5.2 15:12 (Spielstand 15-12 pre-install): Konto 41,12 Mrd, Einkommen
  // 96,8 Mio/s. Alte Schwelle 4 x 41,12 = 164,5 Mrd, reine Horizontregel
  // 41,12 + 600 x 0,0968 = 99,2 Mrd. Ein Stueck zu 120 Mrd liegt dazwischen:
  // die alte Regel wartet (hoechstens 21 min), die erste Fassung baute ein.
  const neu = ruf("unbezahlbarInHorizont", {
    preis: 120e9, geld: 41124111424, einkommenProSek: 96819793.35, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("BN5.2 15:12, 120 Mrd bei 41 Mrd Konto: still wie die alte Regel", neu === false,
    "erhalten " + String(neu));
  const drueber = ruf("unbezahlbarInHorizont", {
    preis: 170e9, geld: 41124111424, einkommenProSek: 96819793.35, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("BN5.2 15:12, 170 Mrd: ueber beiden Schwellen -> feuert weiter", drueber === true,
    "erhalten " + String(drueber));
}
{
  // Frueh im Zyklus (Spielstand 19-04 hourly, eine Minute nach dem Einbau):
  // Konto 1,09 Mio, Einkommen 6.738 $/s. PCMatrix zum Grundpreis 4 Mrd -
  // beide Regeln feuern, das Stueck ist wirklich unbezahlbar. Die neue
  // Fassung darf hier nicht haengenbleiben (kein Stillstand).
  const neu = ruf("unbezahlbarInHorizont", {
    preis: 4e9, geld: 1088872, einkommenProSek: 6737.63, horizontSek: 600,
    spendetGeradeAnSchwellenfaktion: false,
  });
  pruefe("frueher Zyklus (19:04): wirklich unbezahlbar feuert weiter", neu === true,
    "erhalten " + String(neu));
}
{
  // Eigenschaft ueber ein Gitter: wo die alte Regel still ist, ist die neue
  // still (fuer jedes Einkommen, auch 0).
  let verstoss = null;
  for (const geld of [0, 1e6, 1e9, 4.1e10, 1e12]) {
    for (const preis of [1e6, 5e8, 3e9, 2.7e10, 1.2e11, 5e12]) {
      for (const inc of [0, 1e3, 1e6, 1e8, 1e9]) {
        const alt = preis > 4 * geld;
        const neu = ruf("unbezahlbarInHorizont", {
          preis, geld, einkommenProSek: inc, horizontSek: 600, spendetGeradeAnSchwellenfaktion: false,
        });
        if (!alt && neu !== false) verstoss = { geld, preis, inc, neu };
      }
    }
  }
  pruefe("nie strenger als alt (150 Gitterpunkte)", verstoss === null, JSON.stringify(verstoss));
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 9: Spendenpause in Wandzeit statt in Runden --");
{
  // Log BN5.2: Spende 19:02:50, Einbaupruefung 19:03:08 = 18 s spaeter, aber
  // drei Runden (stille Folgerunde, Kaufrunde, Pruefrunde). "< 2 Runden" war
  // dort schon vorbei.
  const spende = Date.parse("2026-09-26T19:02:50");
  const pruef = Date.parse("2026-09-26T19:03:08");
  pruefe("19:02:50 -> 19:03:08 (18 s, 3 Runden): Pause greift",
    ruf("spendePausiert", spende, pruef) === true);
  pruefe("nach 60 s ist die Pause vorbei",
    ruf("spendePausiert", spende, spende + 60000) === false);
  pruefe("ohne jede Spende: keine Pause",
    ruf("spendePausiert", null, pruef) === false);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 2: Wertmass mit echten Namen aus lib/hackaugs.js --");
{
  const wert = (aug, kampf = false) => ruf("istEinbauWertvoll", {
    aug, stats: HACK_AUGS[aug], exitKey: "The Red Pill",
    kampfNutzen: kampf ? combatNutzen(aug) : 0,
  });
  pruefe("Magnetism Amplifier (nur company_rep) ist NICHT wertvoll",
    wert("Magnetism Amplifier") === false, "erhalten " + String(wert("Magnetism Amplifier")));
  pruefe("ENM Direct Memory Access (hacking_money 1,4) IST wertvoll",
    wert("Embedded Netburner Module Direct Memory Access Upgrade") === true);
  pruefe("LuminCloaking-V1 im Hackingknoten ist NICHT wertvoll",
    wert("LuminCloaking-V1 Skin Implant") === false);
  pruefe("PCMatrix (faction_rep) und Neuralstimulator sind wertvoll",
    wert("PCMatrix") === true && wert("Neuralstimulator") === true);
  pruefe("The Red Pill ist immer wertvoll", wert("The Red Pill") === true);
  pruefe("Synfibril Muscle: im Hackingknoten nein, im Kampfknoten ja",
    wert("Synfibril Muscle") === false && wert("Synfibril Muscle", true) === true);
  pruefe("Stanek's Gift - Genesis (Faktoren 0,9) ist NICHT wertvoll",
    wert("Stanek's Gift - Genesis") === false);

  // Die Auswahl selbst: Stand 19:03 (Daedalus 836k Rep, Aevum 21k).
  const K = [
    { aug: "The Red Pill", rep: 836243, repReq: 2.5e6, preis: 0 },
    { aug: "Embedded Netburner Module Core V3 Upgrade", rep: 836243, repReq: 1.75e6, preis: 7.5e9 * 2 * q3 },
    { aug: "Embedded Netburner Module Direct Memory Access Upgrade", rep: 836243, repReq: 1e6, preis: 7e9 * 2 * q3 },
    { aug: "PCMatrix", rep: 21024, repReq: 1e5, preis: 2e9 * 2 * q3 },
    { aug: "Magnetism Amplifier", rep: 21024, repReq: 25000, preis: 2.5e8 * 2 * q3 },
  ];
  const istW = (k) => M.istEinbauWertvoll({ aug: k.aug, stats: HACK_AUGS[k.aug], exitKey: "The Red Pill" });
  const r = typeof M.waehleEinbauGeldziele === "function" && typeof M.istEinbauWertvoll === "function"
    ? M.waehleEinbauGeldziele(K, istW) : FEHLT;
  pruefe("naechstes wertvolles Stueck ist PCMatrix, nicht das nahe Magnetism",
    r !== FEHLT && r.naechstes && r.naechstes.aug === "PCMatrix",
    r === FEHLT ? "Funktion fehlt" : "erhalten " + (r.naechstes && r.naechstes.aug));
  const K2 = K.map((k) => (k.aug === "Magnetism Amplifier" ? { ...k, rep: 30000 } : k));
  const r2 = r === FEHLT ? FEHLT : M.waehleEinbauGeldziele(K2, istW);
  pruefe("ein verdientes, wertloses Stueck zaehlt nicht als teuerstes Verdientes",
    r2 !== FEHLT && r2.teuerstesVerdienteWertvoll === 0,
    r2 === FEHLT ? "Funktion fehlt" : "erhalten " + r2.teuerstesVerdienteWertvoll);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 3: Fuellstueck nur unter den Einbau-Vorbedingungen --");
{
  const basis = { spendenrechtFaellig: true, wartend: 0, ausgangSteht: false, kampfKnoten: false, gesperrt: false };
  pruefe("Hackingknoten, faellig, leer -> kaufen",
    ruf("sollFuellstueckSofortKaufen", basis) === true);
  pruefe("Kampfknoten -> NICHT kaufen (spendenAusnahme verlangt dort 3 Stueck)",
    ruf("sollFuellstueckSofortKaufen", { ...basis, kampfKnoten: true }) === false);
  pruefe("Red Pill eingebaut -> NICHT kaufen (nie wieder ein Einbau)",
    ruf("sollFuellstueckSofortKaufen", { ...basis, ausgangSteht: true }) === false);
  pruefe("Einbausperre -> NICHT kaufen",
    ruf("sollFuellstueckSofortKaufen", { ...basis, gesperrt: true }) === false);
  pruefe("schon 1 Stueck wartend -> nicht noetig",
    ruf("sollFuellstueckSofortKaufen", { ...basis, wartend: 1 }) === false);
  pruefe("vergessene Vorbedingung gilt als sperrend",
    ruf("sollFuellstueckSofortKaufen", { spendenrechtFaellig: true, wartend: 0 }) === false);
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwaende 4 und 8: Fokus - NMI nur eingebaut, Karenz fuer die UI-Skripte --");
{
  const t0 = 1_790_442_000_000;
  const f = (o) => ruf("fokusEntscheidung", {
    arbeitetSchon: true, istFokussiert: false, nmiEingebaut: false,
    unfokussiertSeit: null, jetzt: t0, ...o,
  });
  const a = f({});
  pruefe("erste Beobachtung ohne Fokus: noch NICHT holen (darkweb.js braucht bis ~16 s)",
    a !== FEHLT && a.holen === false && a.unfokussiertSeit === t0, JSON.stringify(a));
  const b = f({ unfokussiertSeit: t0, jetzt: t0 + 16000 });
  pruefe("16 s spaeter: noch nicht", b !== FEHLT && b.holen === false, JSON.stringify(b));
  const c = f({ unfokussiertSeit: t0, jetzt: t0 + 31000 });
  pruefe("31 s spaeter: holen, Merker zurueck", c !== FEHLT && c.holen === true && c.unfokussiertSeit === null,
    JSON.stringify(c));
  const d = f({ unfokussiertSeit: t0, jetzt: t0 + 60000, nmiEingebaut: true });
  pruefe("NMI EINGEBAUT: nie holen (Strafe existiert nicht)", d !== FEHLT && d.holen === false);
  pruefe("wieder fokussiert: Merker zurueck",
    (() => { const e = f({ unfokussiertSeit: t0, istFokussiert: true, jetzt: t0 + 5000 });
      return e !== FEHLT && e.holen === false && e.unfokussiertSeit === null; })());
  pruefe("keine eigene Faktionsarbeit: nichts zu holen",
    (() => { const e = f({ arbeitetSchon: false, unfokussiertSeit: t0, jetzt: t0 + 60000 });
      return e !== FEHLT && e.holen === false; })());
  // Die Unterscheidung GEKAUFT/EINGEBAUT liegt beim Aufrufer (eingebauteAugs
  // statt besitz) - das prueft tools/test-bn4rep-ebene2.js im Hauptlauf.
}

// ---------------------------------------------------------------------------
console.log("\n-- Einwand 11: Einbaugrund aus der wahren Bedingung --");
{
  const g = ruf("einbauGrundText", {
    spendenrechtFaellig: true, spendenFaktion: "BitRunners", kleinsteLuecke: null,
  });
  pruefe("Spendenrecht nennt sich selbst, nicht 'naechste Huerde erst in 0'",
    typeof g === "string" && g.includes("Spendenrecht bei BitRunners") && !g.includes("Huerde"),
    String(g));
  const h = ruf("einbauGrundText", {
    geldWegZu: true, teuerstesVerdienteWertvoll: 96026e6, geld: 13808e6,
    einkommenProSek: 1e9, horizontSek: 600,
  });
  pruefe("geldWegZu nennt den gefilterten Preis", typeof h === "string" && h.includes("96026m"), String(h));
}

// ---------------------------------------------------------------------------
console.log("\n-- A2/A3/A6/A7 (unveraendert, echte Funktionen) --");
{
  const TAB = { 2: 0.5, 4: 0.75, 13: 0.6, 14: 0.2 };
  // BitNode.tsx case 12: FactionWorkRepGain = 1/1,02^lvl, lvl = SF12-Stufe + 1.
  pruefe("BN12.2 (lvl 2): FactionWorkRepGain live 0,9612 statt Tabellen-Rueckfall 1",
    Math.abs(M.donationRepGainFaktor({ FactionWorkRepGain: 1 / Math.pow(1.02, 2) }, 12, TAB) - 0.9612) < 1e-3);
  pruefe("Rueckfall ohne SF5: BN4 0,75", M.donationRepGainFaktor(null, 4, TAB) === 0.75);
  pruefe("Daedalus BN12 live 31, BN6 Tabelle 35, sonst 30",
    M.daedalusSchwelle({ DaedalusAugsRequirement: 31 }, 12, { 6: 35 }) === 31
      && M.daedalusSchwelle(null, 6, { 6: 35 }) === 35 && M.daedalusSchwelle(null, 4, { 6: 35 }) === 30);
  // BN5.2 15:12: 25 installiert, getOwnedAugmentations(true) = 35 (7 NFG-Stufen
  // + 3 Stuecke). Zaehlplatz richtet sich nach den 25.
  pruefe("Zaehlplatz aus den installierten 25 (nicht den 35 inkl. Warteschlange)",
    M.zaehlplatzWert(25, 30) === 1 && M.zaehlplatzWert(30, 30) === 0);
  pruefe("Red Pill gekauft, nicht eingebaut -> Zwang; eingebaut -> nicht",
    M.redPillWartetAufEinbau(["The Red Pill"], [], "The Red Pill") === true
      && M.redPillWartetAufEinbau(["The Red Pill"], ["The Red Pill"], "The Red Pill") === false);
  // Echte Faelle: BitRunners Favor 165,1 (16:57), Daedalus 150,6 (19:03).
  pruefe("Favor 165,1 / 150,6 ueber der Schwelle zaehlen nicht",
    M.favorZaehltFuerFaktion({ favorJetzt: 165.1, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: true }) === false
      && M.favorZaehltFuerFaktion({ favorJetzt: 150.6, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: true }) === false);
  pruefe("leerer Katalog (The Black Hand 17:19) zaehlt nicht",
    M.favorZaehltFuerFaktion({ favorJetzt: 46.5, spendenSchwelle: 150, hatUnbesessenesWertvollesStueck: false }) === false);
}

// ---------------------------------------------------------------------------
console.log("\n-- H2: Einbau-Ausloeser darf nicht bei schwelle-1 haengen bleiben (BN12) --");
{
  // 29 installiert, 1 wartend (nicht NFG), Schwelle 31 (BN12): distinkt
  // nach dem Einbau waere 30 = 31-1 - der Fall aus dem Audit-Bericht.
  pruefe("29 installiert + 1 wartend, Schwelle 31: Gate greift",
    ruf("einbauLandetEinsUnterSchwelle", 29, 30, 31) === true);
  // 30 installiert, 1 wartend, Schwelle 31: distinkt nach dem Einbau 31 -
  // trifft die Schwelle genau, kein Grund, den Einbau aufzuhalten.
  pruefe("30 installiert + 1 wartend, Schwelle 31: kein Gate (trifft die Schwelle genau)",
    ruf("einbauLandetEinsUnterSchwelle", 30, 31, 31) === false);
  // Schwelle schon erreicht (>=): egal was die Warteschlange sagt, kein Gate.
  pruefe("installiert >= Schwelle: kein Gate",
    ruf("einbauLandetEinsUnterSchwelle", 31, 32, 31) === false
      && ruf("einbauLandetEinsUnterSchwelle", 35, 36, 31) === false);
  // BN5 (Schwelle 30) mit demselben Muster wie BN12: das Gate ist
  // schwellenunabhaengig, nicht an eine Rundzahl gebunden.
  pruefe("dasselbe Muster bei Schwelle 30 (BN5) greift genauso",
    ruf("einbauLandetEinsUnterSchwelle", 28, 29, 30) === true);
  // Weit unter der Schwelle: kein Sonderfall.
  pruefe("weit unter der Schwelle: kein Gate (10 von 31)",
    ruf("einbauLandetEinsUnterSchwelle", 10, 10, 31) === false);

  // Auswahl: billigstes kaufbares Stueck vor NFG, NFG nur als Fallback.
  const K = [
    { aug: "Teuer", preis: 5e9, rep: 1e6, repReq: 1e5 },
    { aug: "Billig", preis: 1e6, rep: 1e6, repReq: 1e5 },
    { aug: "RepFehlt", preis: 1, rep: 100, repReq: 1e5 },
  ];
  const w1 = ruf("waehleDaedalusFuellstueck", K, false);
  pruefe("mit kaufbaren Kandidaten: das billigste, nicht NFG",
    w1 !== FEHLT && w1.typ === "stueck" && w1.aug === "Billig", JSON.stringify(w1));
  const w2 = ruf("waehleDaedalusFuellstueck", [K[2]], false);
  pruefe("nur Rep-fehlende Kandidaten, NFG noch nicht vorhanden: NFG-Fallback",
    w2 !== FEHLT && w2.typ === "nfg", JSON.stringify(w2));
  const w3 = ruf("waehleDaedalusFuellstueck", [K[2]], true);
  pruefe("nichts kaufbar UND NFG schon vorhanden: nichts zu tun (Einbau geht trotzdem weiter)",
    w3 === null, JSON.stringify(w3));
  const w4 = ruf("waehleDaedalusFuellstueck", [], true);
  pruefe("leere Kandidatenliste, NFG vorhanden: nichts zu tun", w4 === null, JSON.stringify(w4));
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
