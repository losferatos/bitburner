/**
 * Der Einbauplan fuer BitNode 8 (src/lib/bn8plan.js) und seine Verdrahtung in
 * bn4rep.js. Die Zahlen des Plans (300 Mrd, 1 Bio, 30 h je Stufe) stammen aus
 * tools/audit/bn8-route.mjs, das dieselben Funktionen benutzt.
 *
 * Aufruf: node tools/test-bn8plan.js [srcVerzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2] || path.join(HIER, "..", "src"));
let gruen = 0, rot = 0;
const pruefe = (name, ok, hinweis = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
};
console.log("\n=== BN8-Einbauplan ===\n    " + SRC);
const libPfad = path.join(SRC, "lib", "bn8plan.js");
pruefe("lib/bn8plan.js existiert", fs.existsSync(libPfad));
if (!fs.existsSync(libPfad)) { console.log("\n=== " + gruen + " gruen, " + rot + " rot ==="); process.exit(1); }
const P = await import(pathToFileURL(libPfad).href);

console.log("\n-- Formeln gegen den Spielquellcode --");
{
  pruefe("Preisfaktor mit SF11.3 ist 1,9 * 0,93", Math.abs(P.preisFaktor(3) - 1.767) < 1e-9);
  pruefe("ohne SF11 ist er 1,9", P.preisFaktor(0) === 1.9 && P.preisFaktor(undefined) === 1.9);
  // ServerPurchases.ts:169-185: R -> 2R kostet R*32000*1,58^log2(R); 128 -> 256: 1,01e8
  pruefe("home 128 -> 256 GB kostet 101 Mio", Math.abs(P.homeKosten(128, 256) - 128 * 32000 * Math.pow(1.58, 7)) < 1 && Math.round(P.homeKosten(128, 256) / 1e6) === 101);
  pruefe("home 128 -> 32768 GB kostet rund 463 Mrd", Math.abs(P.homeKosten(128, 32768) / 1e9 - 463) < 3, (P.homeKosten(128, 32768) / 1e9).toFixed(1));
  pruefe("schon gross genug: 0", P.homeKosten(32768, 32768) === 0 && P.homeKosten(65536, 32768) === 0);
}

const A = (name, preis, ruf, faktionen, extra = {}) => ({ name, preis, ruf, faktionen, vor: [], hack: 1, exp: 1, speed: 1, frep: 1, ...extra });

console.log("\n-- Kaufreihenfolge --");
{
  const l = [A("billig", 10, 0, ["X"]), A("teuer", 100, 0, ["X"]), A("mittel", 50, 0, ["X"])];
  pruefe("teuerstes zuerst", P.reihenfolge(l).map((a) => a.name).join(",") === "teuer,mittel,billig");
  const v = [A("Gen2", 100, 0, ["X"], { vor: ["Gen1"] }), A("Gen1", 10, 0, ["X"]), A("anderes", 50, 0, ["X"])];
  const r = P.reihenfolge(v).map((a) => a.name);
  pruefe("Vorbedingung vor ihrem Nachfolger, auch wenn sie billiger ist", r.indexOf("Gen1") < r.indexOf("Gen2"), r.join(","));
  pruefe("... der Rest bleibt nach Preis", r[0] === "anderes" || r[0] === "Gen1");
  pruefe("unerfuellbare Vorbedingung: null", P.reihenfolge([A("Gen2", 100, 0, ["X"], { vor: ["fehlt"] })]) === null);
}

console.log("\n-- Kosten: Aufschlag je Position und Spenden --");
{
  const ctx = { q: 2, repMult: 2, rufHaben: {}, aufschlag: 1 };
  const k = P.kosten([A("a", 100, 0, ["X"]), A("b", 10, 0, ["X"])], ctx);
  pruefe("Preis: 100 + 10 * q", k.geld === 120);
  const s = P.kosten([A("a", 0, 1000, ["X"]), A("b", 0, 400, ["X"])], ctx);
  pruefe("Spende deckt nur die HOECHSTE Huerde je Faktion (Ruf ist kumulativ)", s.spenden.X === 1000 * 1e6 / 2, String(s.spenden.X));
  const h = P.kosten([A("a", 0, 1000, ["X"])], { ...ctx, rufHaben: { X: 600 } });
  pruefe("vorhandener Ruf wird abgezogen", h.spenden.X === 400 * 1e6 / 2);
  const z = P.kosten([A("a", 0, 1000, ["X", "Y"])], { ...ctx, rufHaben: { Y: 900 } });
  pruefe("das Stueck geht an die Faktion mit dem wenigsten fehlenden Ruf", z.zuordnung.a === "Y" && z.spenden.Y === 100 * 1e6 / 2);
  pruefe("genug Ruf: keine Spende", Object.keys(P.kosten([A("a", 5, 100, ["X"])], { ...ctx, rufHaben: { X: 100 } }).spenden).length === 0);
  pruefe("Stueck ohne Faktion: null", P.kosten([A("a", 5, 100, [])], ctx) === null);
  pruefe("Standardaufschlag 2 % auf die Spende", Math.abs(P.kosten([A("a", 0, 100, ["X"])], { q: 2, repMult: 1, rufHaben: {} }).spenden.X - 100e6 * 1.02) < 1);
}

console.log("\n-- Die Runde planen --");
{
  const kand = [
    A("Hack gross", 1e9, 0, ["X"], { hack: 1.3 }),
    A("Hack klein", 1e9, 0, ["X"], { hack: 1.05 }),
    A("Fueller", 1e6, 0, ["X"]),
    A("Ruf", 1e8, 0, ["X"], { frep: 1.15 }),
    A("Gen2", 5e8, 0, ["X"], { hack: 1.2, vor: ["Gen1"] }),
    A("Gen1", 1e8, 0, ["X"], { hack: 1.01 }),
  ];
  const p = P.planeRunde({ kandidaten: kand, budget: 1.2e9, q: 1.767, repMult: 1, rufHaben: {} });
  pruefe("im Budget", p && p.kosten <= 1.2e9, p && String(p.kosten));
  // Gen1 (Vorbedingung) muss zuerst gekauft werden, Gen2 kostet dann 5e8 * 1,767:
  // zusammen 9,8e8 fuer ln(1,2*1,01) - "Hack gross" bringt je Dollar mehr.
  pruefe("das beste Hacking-Stueck je Dollar zuerst", p.kaeufe.some((k) => k.name === "Hack gross") && !p.kaeufe.some((k) => k.name === "Gen2"), p.kaeufe.map((k) => k.name).join(","));
  const reich = P.planeRunde({ kandidaten: kand, budget: 1e12, q: 1.767, repMult: 1, rufHaben: {} });
  const r = reich.kaeufe.map((k) => k.name);
  pruefe("Vorbedingung steht in der Kaufliste vor dem Nachfolger", r.indexOf("Gen1") >= 0 && r.indexOf("Gen1") < r.indexOf("Gen2"), r.join(","));
  pruefe("jeder Kauf nennt seine Faktion", reich.kaeufe.every((k) => k.faktion === "X"));
  pruefe("mit viel Geld alles", reich.stueck === 6 && Math.abs(reich.hack - 1.3 * 1.05 * 1.2 * 1.01) < 1e-9);
  pruefe("Ruf-Mult des Plans wird ausgewiesen", Math.abs(reich.frep - 1.15) < 1e-9);
  pruefe("leeres Budget: leerer Plan, nicht null", P.planeRunde({ kandidaten: kand, budget: 0, q: 1.767, repMult: 1 }).stueck === 0);
  const pille = [...kand, A("The Red Pill", 0, 2.5e6, ["Daedalus"])];
  const p3 = P.planeRunde({ kandidaten: pille, budget: 2.5e12 * 1.02 + 2e9, q: 1.767, repMult: 1, rufHaben: {}, pflicht: ["The Red Pill"] });
  pruefe("Pflichtstueck ist drin, Spende an Daedalus 2,5 Mio Ruf", p3 && p3.kaeufe.some((k) => k.name === "The Red Pill")
    && p3.spenden.some((x) => x.faktion === "Daedalus" && x.rufZiel === 2.5e6));
  pruefe("Pflicht passt nicht ins Budget: null", P.planeRunde({ kandidaten: pille, budget: 1e12, q: 1.767, repMult: 1, pflicht: ["The Red Pill"] }) === null);
  pruefe("Pflicht nicht im Angebot: null", P.planeRunde({ kandidaten: kand, budget: 1e15, q: 1.767, repMult: 1, pflicht: ["The Red Pill"] }) === null);
  pruefe("hoeherer Ruf-Mult verbilligt die Spende", P.planeRunde({ kandidaten: pille, budget: 1.3e12, q: 1.767, repMult: 2, pflicht: ["The Red Pill"] }) !== null);
  const fern = [A("Nachfolger", 10, 0, ["X"], { hack: 1.5, vor: ["nicht im Angebot"] })];
  pruefe("Stueck mit unerreichbarer Vorbedingung bleibt draussen", P.planeRunde({ kandidaten: fern, budget: 1e9, q: 2, repMult: 1 }).stueck === 0);
}

console.log("\n-- Welche Runde, und wann einbauen --");
{
  pruefe("Start: Runde 1", P.runde({ distinkt: 1, pilleInstalliert: false }) === 1);
  pruefe("nach Runde 1 (18 Stueck): Runde 2", P.runde({ distinkt: 18, pilleInstalliert: false }) === 2);
  pruefe("30 Stueck: Runde 3", P.runde({ distinkt: 30, pilleInstalliert: false }) === 3);
  pruefe("Red Pill installiert: Runde 4", P.runde({ distinkt: 35, pilleInstalliert: true }) === 4);
  const plan = (n, mitPille) => ({ stueck: n, kaeufe: mitPille ? [{ name: "The Red Pill" }] : [] });
  pruefe("Runde 1 unter 300 Mrd: nein", !P.einbauFaellig({ runde: 1, vermoegen: 299e9, plan: plan(15), distinkt: 1 }).ja);
  pruefe("Runde 1 ab 300 Mrd mit 8 Stueck: ja", P.einbauFaellig({ runde: 1, vermoegen: 300e9, plan: plan(8), distinkt: 1 }).ja);
  pruefe("wartende Stuecke zaehlen mit", P.einbauFaellig({ runde: 1, vermoegen: 300e9, plan: plan(6), distinkt: 1, wartend: 2 }).ja);
  pruefe("Runde 1 mit zu duennem Plan wartet", !P.einbauFaellig({ runde: 1, vermoegen: 400e9, plan: plan(4), distinkt: 1 }).ja);
  pruefe("... aber nicht ewig (Rueckfall ab 900 Mrd)", P.einbauFaellig({ runde: 1, vermoegen: 900e9, plan: plan(4), distinkt: 1 }).ja);
  pruefe("ohne Plan nie", !P.einbauFaellig({ runde: 1, vermoegen: 1e13, plan: null, distinkt: 1 }).ja);
  pruefe("Runde 2 unter 1 Bio: nein", !P.einbauFaellig({ runde: 2, vermoegen: 0.9e12, plan: plan(15), distinkt: 18 }).ja);
  pruefe("Runde 2 ab 1 Bio und 30 erreicht: ja", P.einbauFaellig({ runde: 2, vermoegen: 1e12, plan: plan(12), distinkt: 18 }).ja);
  pruefe("Runde 2: 30 nicht erreichbar, wartet", !P.einbauFaellig({ runde: 2, vermoegen: 1.5e12, plan: plan(5), distinkt: 18 }).ja);
  pruefe("... Rueckfall ab 2 Bio", P.einbauFaellig({ runde: 2, vermoegen: 2e12, plan: plan(5), distinkt: 18 }).ja);
  pruefe("Runde 3 ohne Red Pill im Plan: nein, egal wieviel Geld", !P.einbauFaellig({ runde: 3, vermoegen: 1e14, plan: plan(9, false), distinkt: 31 }).ja);
  pruefe("Runde 3 mit Red Pill im Plan: ja", P.einbauFaellig({ runde: 3, vermoegen: 1.5e12, plan: plan(3, true), distinkt: 31 }).ja);
  pruefe("Runde 4: nie", !P.einbauFaellig({ runde: 4, vermoegen: 1e14, plan: plan(9, true), distinkt: 40 }).ja);
  pruefe("jede Antwort nennt einen Grund", [1, 2, 3, 4].every((r) => P.einbauFaellig({ runde: r, vermoegen: 1, plan: null, distinkt: 0 }).grund.length > 10));
}

console.log("\n-- Verdrahtung in bn4rep.js --");
{
  const rep = fs.readFileSync(path.join(SRC, "bn4rep.js"), "utf8");
  pruefe("der Plan gilt, wenn die Boerse traegt", rep.includes("const bn8Modus = boerse.traegt;"));
  pruefe("im Lauf kein Kauf (Kaufschleife leer)", rep.includes("gangHold || daedalusHalt || bn8Halt) ? []"));
  pruefe("im Lauf keine Spende", rep.includes("if (bn8Halt) verfuegbar = 0;"));
  pruefe("kein Einbau, solange der Plan nein sagt", rep.includes("if (bn8Halt && !bn8Faellig.ja) gesperrt = true;"));
  pruefe("der Ausloeser haengt in BN8 allein am Plan", /&& \(bn8Modus\s*\? \(bn8Faellig\.ja \|\| redPillWartet\)/.test(rep));
  pruefe("kein 36-h-Uebergangsriegel mehr", !rep.includes("36 * 3600000"));
  const iPlan = rep.indexOf("const bn8Modus = boerse.traegt;");
  pruefe("der Plan wird nach den Kandidaten gerechnet", iPlan > rep.indexOf("const kandidaten = [];") && iPlan < rep.indexOf("const bn8Halt = (bn8Modus"));
  pruefe("Runde 3 verlangt The Red Pill als Pflicht", rep.includes("const pflicht = bn8Runde === 3 && nach.has(EXIT_KEY) ? [EXIT_KEY] : [];"));
  const iRunde = rep.indexOf("BN8-EINBAURUNDE (lib/bn8plan.js)");
  pruefe("die Einbaurunde rechnet mit dem echten Bargeld neu", iRunde > rep.indexOf("boersePauseAnlegen(") && rep.includes("plan2 = bn8PlaneMitHome(bar0);"));
  pruefe("... bricht ab, wenn es nach dem Verkauf nicht reicht, und hebt die Pause auf", rep.includes("BN8-EINBAURUNDE ABGEBROCHEN") && rep.includes('schreibNachHome(BOERSE_PAUSE_FILE, "")'));
  pruefe("... spendet vor dem Kauf", rep.indexOf("for (const sp of plan2.spenden)") < rep.indexOf("for (const k of plan2.kaeufe)") && rep.indexOf("for (const sp of plan2.spenden)") > 0);
  pruefe("... baut in Runde 3 nicht ohne The Red Pill ein", rep.includes("if (bn8Runde === 3 && !ns.singularity.getOwnedAugmentations(true).includes(EXIT_KEY))"));
  pruefe("... kauft home-RAM vor NeuroFlux", rep.indexOf("ns.singularity.upgradeHomeRam()") > iRunde && rep.indexOf("ns.singularity.upgradeHomeRam()") < rep.indexOf("NEUROFLUX ZULETZT"));
  pruefe("die Telemetrie nennt Runde und Wartegrund", rep.includes("runde: bn8Runde, faellig: bn8Faellig.ja, grund: bn8Faellig.grund,"));
  const reg = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
  const eintraege = Array.isArray(reg) ? reg : (reg.tools || reg.scripts || Object.values(reg).find(Array.isArray) || []);
  const e = eintraege.find((x) => x && x.name === "bn4rep.js");
  pruefe("bn4rep.js bekommt lib/bn8plan.js kopiert", !!e && (e.needsLibs || []).includes("lib/bn8plan.js"));
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
