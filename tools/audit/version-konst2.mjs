// VERSION-KONST2 (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Zweiter, DATENGETRIEBENER Teil der Konstantenpruefung (Teil 1: version-konst.mjs, ~30 Einzelzahlen). Hier werden
// TABELLEN geprueft, die der Bot aus dem Spielquelltext abgeschrieben hat - aus dem Bot per acorn gelesen (keine
// Regex-Raterei), aus dem Spiel per TypeScript-AST gelesen, in BEIDEN Fassungen:
//   LIVE = reference/v301/src (3.0.1, laeuft), DEV = reference/bitburner-src/src ("3.0.2").
//
// Tabellen:
//   T1  blade.js BLACKOP_EINSATZ (rankGain, rankLoss), BLACKOP_DATEN (baseDifficulty, isKill, isStealth, weights,
//       decays), chance.js AKTION, lib/blackops.json (rang, weights, decays)      <-> Bladeburner/data/BlackOperations.ts
//   T2  blade.js SKILL_WIRKUNG, CHANCE_SKILLS; chance.js SKILL_MULTS               <-> Bladeburner/data/Skills.ts
//   T3  travel.js ENEMIES, INVITE_REQS, CITIES                                     <-> Faction/FactionInfo.tsx, Locations/Enums.ts
//   T4  gang.js COMBAT_FACTIONS, MAX_MEMBERS, Aufgabennamen                        <-> Gang/data/Constants.ts, tasks.ts
//   T5  contracts.js SOLVERS-Schluessel                                            <-> CodingContract/Enums.ts
//   T6  lib/calc.js WORKER_RAM                                                     <-> Netscript/RamCostGenerator.ts
//   T7  stockaccess.js POSTEN, boerse.js TAKT_MS/KOMMISSION                        <-> StockMarket/data/Constants.ts
//   T8  hashes.js Kaufnamen/Preise                                                 <-> Hacknet/data/HashUpgradesMetadata.tsx
//
// SELBSTPROBE: die Auswertung wird auf eine absichtlich verfaelschte Kopie der Bot-Tabelle angewandt (BLACKOP_EINSATZ
// Vindictus rankLoss 20000 -> 20001); sie MUSS genau eine Abweichung melden, sonst ist die Pruefung blind.
//
// Aufruf: node tools/audit/version-konst2.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, "reference", "v301", "node_modules", "typescript"));
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);
const TREES = { live: path.join(ROOT, "reference", "v301", "src"), dev: path.join(ROOT, "reference", "bitburner-src", "src") };

let rot = 0;
const meldung = [];
function ok(titel, cond, detail) {
  if (!cond) rot++;
  meldung.push((cond ? "  OK   " : "  ROT  ") + titel + (detail ? "  " + detail : ""));
}

// ---------------------------------------------------------------- Bot-Seite
function botDatei(rel) { return fs.readFileSync(path.join(ROOT, "src", rel), "utf8"); }
function botLiteral(code, name) {
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  let gefunden = null;
  (function walk(n) {
    if (!n || typeof n.type !== "string" || gefunden) return;
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.id.name === name && n.init) { gefunden = n.init; return; }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === "string") walk(v);
    }
  })(ast);
  if (!gefunden) throw new Error("Bot-Konstante nicht gefunden: " + name);
  const ev = (n) => {
    switch (n.type) {
      case "Literal": return n.value;
      case "Identifier": if (n.name === "Infinity") return Infinity; if (n.name === "undefined") return undefined; throw new Error("Bezeichner " + n.name);
      case "UnaryExpression": return n.operator === "-" ? -ev(n.argument) : +ev(n.argument);
      case "BinaryExpression": { const a = ev(n.left), b = ev(n.right); return { "*": a * b, "/": a / b, "+": a + b, "-": a - b }[n.operator]; }
      case "ArrayExpression": return n.elements.map(ev);
      case "ObjectExpression": return Object.fromEntries(n.properties.filter((p) => p.type === "Property").map((p) => [p.key.type === "Identifier" ? p.key.name : p.key.value, ev(p.value)]));
      default: throw new Error("Knoten " + n.type);
    }
  };
  return ev(gefunden);
}

// ---------------------------------------------------------------- Spiel-Seite
const cache = new Map();
function sf(tree, rel) {
  const k = tree + ":" + rel;
  if (!cache.has(k)) {
    let p = path.join(TREES[tree], rel);
    if (!fs.existsSync(p) && fs.existsSync(p + "x")) p += "x";
    const code = fs.readFileSync(p, "utf8");
    cache.set(k, ts.createSourceFile(p, code, ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  }
  return cache.get(k);
}
function enumMap(tree, rel, enumName) {
  const m = {};
  const s = sf(tree, rel);
  s.forEachChild((n) => {
    if (ts.isEnumDeclaration(n) && n.name.text === enumName) {
      for (const mem of n.members) m[mem.name.getText(s)] = mem.initializer && ts.isStringLiteral(mem.initializer) ? mem.initializer.text : undefined;
    }
  });
  if (!Object.keys(m).length) throw new Error("Enum nicht gefunden: " + enumName + " in " + rel + " (" + tree + ")");
  return m;
}
function evalTs(n, s, enums) {
  if (ts.isNumericLiteral(n)) return Number(n.text.replace(/_/g, ""));
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) return -evalTs(n.operand, s, enums);
  if (ts.isParenthesizedExpression(n)) return evalTs(n.expression, s, enums);
  if (ts.isBinaryExpression(n)) {
    const a = evalTs(n.left, s, enums), b = evalTs(n.right, s, enums);
    const op = n.operatorToken.getText(s);
    return { "*": a * b, "/": a / b, "+": a + b, "-": a - b }[op];
  }
  if (ts.isAsExpression(n)) return evalTs(n.expression, s, enums);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map((e) => evalTs(e, s, enums));
  if (ts.isPropertyAccessExpression(n)) {
    const t = n.expression.getText(s), mem = n.name.text;
    if (enums[t] && mem in enums[t]) return enums[t][mem];
    return { $ref: n.getText(s) };
  }
  if (ts.isObjectLiteralExpression(n)) {
    const o = {};
    for (const p of n.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      let key;
      if (ts.isComputedPropertyName(p.name)) key = evalTs(p.name.expression, s, enums);
      else key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : p.name.getText(s);
      o[key] = evalTs(p.initializer, s, enums);
    }
    return o;
  }
  return { $ref: n.getText(s).slice(0, 60) };
}
const ENUMS = (tree) => ({
  BladeburnerBlackOpName: enumMap(tree, "Bladeburner/Enums.ts", "BladeburnerBlackOpName"),
  BladeburnerMultName: enumMap(tree, "Bladeburner/Enums.ts", "BladeburnerMultName"),
  BladeburnerSkillName: enumMap(tree, "Bladeburner/Enums.ts", "BladeburnerSkillName"),
  FactionName: enumMap(tree, "Faction/Enums.ts", "FactionName"),
  CityName: enumMap(tree, "Locations/Enums.ts", "CityName"),
  CodingContractName: enumMap(tree, "CodingContract/Enums.ts", "CodingContractName"),
});

function schwarzeOps(tree, E) {
  const s = sf(tree, "Bladeburner/data/BlackOperations.ts");
  const out = {};
  (function walk(n) {
    if (ts.isNewExpression(n) && n.expression.getText(s) === "BlackOperation" && n.arguments && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
      const o = evalTs(n.arguments[0], s, E);
      out[o.name] = o;
    }
    ts.forEachChild(n, walk);
  })(s);
  return out;
}
function skills(tree, E) {
  const s = sf(tree, "Bladeburner/data/Skills.ts");
  const out = {};
  (function walk(n) {
    if (ts.isNewExpression(n) && n.expression.getText(s) === "Skill" && n.arguments && n.arguments[0] && ts.isObjectLiteralExpression(n.arguments[0])) {
      const o = evalTs(n.arguments[0], s, E);
      out[o.name] = o;
    }
    ts.forEachChild(n, walk);
  })(s);
  return out;
}

// ---------------------------------------------------------------- Pruefungen
const STATS = ["hacking", "strength", "defense", "dexterity", "agility", "charisma", "intelligence"];
function vergleicheOp(titel, botOp, spiel, nurNichtNull = true) {
  const f = [];
  for (const k of ["baseDifficulty", "rankGain", "rankLoss", "isKill", "isStealth"]) {
    if (botOp[k] === undefined) continue;
    const sp = spiel[k] === undefined && typeof botOp[k] === "boolean" ? false : spiel[k];
    if (botOp[k] !== sp) f.push(k + " bot=" + botOp[k] + " spiel=" + sp);
  }
  if (botOp.weights) for (const st of STATS) {
    const b = botOp.weights[st] ?? 0, g = spiel.weights[st] ?? 0;
    if (b !== g) f.push("weights." + st + " bot=" + b + " spiel=" + g);
    if (nurNichtNull && g === 0 && b === 0) continue;
    if (botOp.decays && botOp.decays[st] !== undefined && g !== 0 && botOp.decays[st] !== spiel.decays[st]) f.push("decays." + st + " bot=" + botOp.decays[st] + " spiel=" + spiel.decays[st]);
  }
  return f;
}
function pruefeT1(einsatz) {
  const botEinsatz = einsatz ?? botLiteral(botDatei("blade.js"), "BLACKOP_EINSATZ");
  const botDaten = botLiteral(botDatei("blade.js"), "BLACKOP_DATEN");
  return { botEinsatz, botDaten };
}
// chance.js: AKTION = { "Operation Typhoon": {...} }[name] -> Literal ist das Member-Objekt; separat holen
function chanceAktion() {
  const code = botDatei("chance.js");
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  let obj = null;
  (function walk(n) {
    if (!n || typeof n.type !== "string" || obj) return;
    if (n.type === "VariableDeclarator" && n.id.name === "AKTION" && n.init && n.init.type === "MemberExpression") obj = n.init.object;
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === "string") walk(v); }
  })(ast);
  const ev = (n) => n.type === "Literal" ? n.value : n.type === "UnaryExpression" ? -ev(n.argument) : n.type === "ArrayExpression" ? n.elements.map(ev)
    : Object.fromEntries(n.properties.map((p) => [p.key.type === "Identifier" ? p.key.name : p.key.value, ev(p.value)]));
  return ev(obj);
}

function selbstprobe() {
  const einsatz = botLiteral(botDatei("blade.js"), "BLACKOP_EINSATZ");
  const kopie = JSON.parse(JSON.stringify(einsatz));
  kopie["Operation Vindictus"].rankLoss = 20001;
  const E = ENUMS("live");
  const sp = schwarzeOps("live", E);
  let abw = 0;
  for (const [name, v] of Object.entries(kopie)) {
    const g = sp[name];
    if (!g) { abw++; continue; }
    if (v.rankGain !== g.rankGain || v.rankLoss !== g.rankLoss) abw++;
  }
  return abw;
}
const probe = selbstprobe();
console.log("SELBSTPROBE (verfaelschter Eintrag Vindictus rankLoss): " + probe + " Abweichung(en) gemeldet " + (probe === 1 ? "-> OK" : "-> ROT, Pruefung blind"));
if (probe !== 1) process.exit(2);

const T1 = pruefeT1();
const typhoonChance = chanceAktion();
const blackopsJson = JSON.parse(botDatei("lib/blackops.json"));
for (const tree of ["live", "dev"]) {
  const E = ENUMS(tree);
  const sp = schwarzeOps(tree, E);
  const namen = Object.keys(sp);
  ok(tree + ": 21 Black Ops im Spiel", namen.length === 21, "(" + namen.length + ")");
  // BLACKOP_EINSATZ
  const f1 = [];
  for (const [name, v] of Object.entries(T1.botEinsatz)) {
    const g = sp[name];
    if (!g) { f1.push(name + " fehlt im Spiel"); continue; }
    if (v.rankGain !== g.rankGain || v.rankLoss !== g.rankLoss) f1.push(name + " bot=" + v.rankGain + "/" + v.rankLoss + " spiel=" + g.rankGain + "/" + g.rankLoss);
  }
  ok(tree + ": blade.js BLACKOP_EINSATZ (" + Object.keys(T1.botEinsatz).length + " Ops, rankGain/rankLoss)", f1.length === 0, f1.join("; "));
  // BLACKOP_DATEN
  const f2 = [];
  for (const [name, v] of Object.entries(T1.botDaten)) {
    const g = sp[name];
    if (!g) { f2.push(name + " fehlt im Spiel"); continue; }
    for (const x of vergleicheOp(name, v, g)) f2.push(name + ": " + x);
  }
  ok(tree + ": blade.js BLACKOP_DATEN (" + Object.keys(T1.botDaten).length + " Ops, Schwierigkeit/Gewichte/Verfall/Art)", f2.length === 0, f2.join("; "));
  // chance.js AKTION
  const g = sp["Operation Typhoon"];
  const f3 = vergleicheOp("Typhoon", typhoonChance, g);
  ok(tree + ": chance.js AKTION Typhoon", f3.length === 0, f3.join("; "));
  // blackops.json
  const f4 = [];
  for (const op of blackopsJson.ops) {
    const gg = Object.values(sp).find((x) => x.name.replace(/\s/g, "").toLowerCase() === op.name.toLowerCase());
    if (!gg) { f4.push(op.name + " fehlt"); continue; }
    if (op.rang !== gg.reqdRank) f4.push(op.name + " rang " + op.rang + "/" + gg.reqdRank);
    for (const st of STATS) {
      if ((op.weights[st] ?? 0) !== (gg.weights[st] ?? 0)) f4.push(op.name + " weights." + st);
      if ((op.decays[st] ?? 0) !== (gg.decays[st] ?? 0)) f4.push(op.name + " decays." + st);
    }
  }
  ok(tree + ": lib/blackops.json (" + blackopsJson.ops.length + " Ops, Rang/Gewichte/Verfall)", f4.length === 0, f4.join("; "));

  // T2 Skills
  const sk = skills(tree, E);
  const wirk = { ...botLiteral(botDatei("blade.js"), "SKILL_WIRKUNG"), ...botLiteral(botDatei("chance.js"), "SKILL_MULTS") };
  const f5 = [];
  for (const [name, w] of Object.entries(wirk)) {
    const g2 = sk[name];
    if (!g2) { f5.push(name + " fehlt im Spiel"); continue; }
    for (const [kurz, wert] of Object.entries(w)) {
      const voll = E.BladeburnerMultName[kurz];
      const sw = g2.mults[voll];
      if (sw !== wert) f5.push(name + "." + kurz + " bot=" + wert + " spiel=" + sw);
    }
  }
  ok(tree + ": SKILL_WIRKUNG/SKILL_MULTS (" + Object.keys(wirk).length + " Faehigkeiten)", f5.length === 0, f5.join("; "));
  const cs = botLiteral(botDatei("blade.js"), "CHANCE_SKILLS");
  const mapKurz = { "Blade's Intuition": "SuccessChanceAll", "Short-Circuit": "SuccessChanceKill", "Digital Observer": "SuccessChanceOperation", "Cloak": "SuccessChanceStealth", "Tracer": "SuccessChanceContract" };
  const f6 = [];
  for (const [name, v] of Object.entries(cs)) {
    const g2 = sk[name];
    if (!g2) { f6.push(name + " fehlt"); continue; }
    const sw = g2.mults[E.BladeburnerMultName[mapKurz[name]]];
    if (sw !== v.proz) f6.push(name + " proz bot=" + v.proz + " spiel=" + sw);
  }
  ok(tree + ": CHANCE_SKILLS proz", f6.length === 0, f6.join("; "));
  // SKILL_PLAN Namen existieren
  const plan = botLiteral(botDatei("blade.js"), "SKILL_PLAN").map((x) => x[0]);
  ok(tree + ": SKILL_PLAN-Namen (" + plan.length + ") existieren", plan.every((n) => sk[n]), plan.filter((n) => !sk[n]).join(","));

  // T3 travel.js
  const s3 = sf(tree, "Faction/FactionInfo.tsx");
  const feinde = {}, einl = {};
  (function walk(n) {
    if (ts.isPropertyAssignment(n) && ts.isComputedPropertyName(n.name) && ts.isNewExpression(n.initializer) && n.initializer.expression.getText(s3) === "FactionInfo") {
      const fn = evalTs(n.name.expression, s3, E);
      const arg = n.initializer.arguments[0];
      for (const p of arg.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const key = p.name.getText(s3);
        if (key === "enemies") feinde[fn] = evalTs(p.initializer, s3, E);
        if (key === "inviteReqs" && ts.isArrayLiteralExpression(p.initializer)) {
          const r = { cities: [], money: 0, hacking: 0, sonst: [] };
          for (const c of p.initializer.elements) {
            if (!ts.isCallExpression(c)) { r.sonst.push(c.getText(s3)); continue; }
            const nm = c.expression.getText(s3), a = c.arguments.map((x) => evalTs(x, s3, E));
            if (nm === "locatedInCity") r.cities = [a[0]];
            else if (nm === "locatedInSomeCity") r.cities = a;
            else if (nm === "haveMoney") r.money = a[0];
            else if (nm === "haveSkill" && a[0] === "hacking") r.hacking = a[1];
            else r.sonst.push(nm);
          }
          einl[fn] = r;
        }
      }
    }
    ts.forEachChild(n, walk);
  })(s3);
  const en = botLiteral(botDatei("travel.js"), "ENEMIES");
  const f7 = [];
  for (const [fak, liste] of Object.entries(en)) {
    const g3 = (feinde[fak] || []).slice().sort();
    if (JSON.stringify(g3) !== JSON.stringify(liste.slice().sort())) f7.push(fak + " bot=" + liste.join("|") + " spiel=" + g3.join("|"));
  }
  const nurSpiel = Object.keys(feinde).filter((k) => !en[k]);
  if (nurSpiel.length) f7.push("im Spiel zusaetzlich: " + nurSpiel.join(","));
  ok(tree + ": travel.js ENEMIES (" + Object.keys(en).length + " Faktionen)", f7.length === 0, f7.join("; "));
  const ir = botLiteral(botDatei("travel.js"), "INVITE_REQS");
  const f8 = [];
  for (const [fak, r] of Object.entries(ir)) {
    const g3 = einl[fak];
    if (!g3) { f8.push(fak + " fehlt"); continue; }
    if (JSON.stringify(g3.cities.slice().sort()) !== JSON.stringify(r.cities.slice().sort()) || g3.money !== r.money || g3.hacking !== r.hacking) f8.push(fak + " bot=" + JSON.stringify(r) + " spiel=" + JSON.stringify({ c: g3.cities, m: g3.money, h: g3.hacking }));
  }
  ok(tree + ": travel.js INVITE_REQS (" + Object.keys(ir).length + " Faktionen)", f8.length === 0, f8.join("; "));
  const cit = botLiteral(botDatei("travel.js"), "CITIES");
  ok(tree + ": travel.js CITIES", JSON.stringify(cit.slice().sort()) === JSON.stringify(Object.values(E.CityName).sort()), "");

  // T4 gang.js
  const gcs = sf(tree, "Gang/data/Constants.ts");
  let namenG = null, maxG = null;
  (function walk(n) {
    if (ts.isPropertyAssignment(n) && n.name.getText(gcs) === "Names") namenG = evalTs(n.initializer, gcs, E);
    if (ts.isPropertyAssignment(n) && n.name.getText(gcs) === "MaximumGangMembers") maxG = evalTs(n.initializer, gcs, E);
    ts.forEachChild(n, walk);
  })(gcs);
  const cf = botLiteral(botDatei("gang.js"), "COMBAT_FACTIONS");
  const erwartet = namenG.filter((x) => !["NiteSec", "The Black Hand"].includes(x));
  ok(tree + ": gang.js COMBAT_FACTIONS = Gang-Namen ohne die zwei Hacking-Gangs", JSON.stringify(cf.slice().sort()) === JSON.stringify(erwartet.slice().sort()), "bot=" + cf.join("|") + " spiel=" + erwartet.join("|"));
  ok(tree + ": gang.js MAX_MEMBERS", botLiteral(botDatei("gang.js"), "MAX_MEMBERS") === maxG, "(" + maxG + ")");
  const tasks = sf(tree, "Gang/data/tasks.ts");
  const taskText = tasks.getFullText();
  const tn = ["TASK_TRAIN", "TASK_WORK", "TASK_JUSTICE", "TASK_MONEY"].map((k) => botLiteral(botDatei("gang.js"), k));
  const spielTask = tree === "live" ? [...taskText.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]) : null;
  if (tree === "live") ok(tree + ": gang.js Aufgabennamen " + tn.join("|") + " existieren in tasks.ts", tn.every((x) => spielTask.includes(x)), "");
  else {
    const ge = sf("dev", "Gang/Enums.ts").getFullText();
    ok(tree + ": gang.js Aufgabennamen existieren in Gang/Enums.ts", tn.every((x) => ge.includes('"' + x + '"')), "");
  }

  // T5 contracts.js
  const solvers = (() => {
    const code = botDatei("lib/loeser.js");
    const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
    let keys = [];
    (function walk(n) {
      if (!n || typeof n.type !== "string") return;
      if (n.type === "VariableDeclarator" && n.id.name === "SOLVERS" && n.init && n.init.type === "ObjectExpression") keys = n.init.properties.map((p) => p.key.type === "Identifier" ? p.key.name : p.key.value);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === "string") walk(v); }
    })(ast);
    return keys;
  })();
  const spielTypen = Object.values(E.CodingContractName);
  ok(tree + ": lib/loeser.js SOLVERS (" + solvers.length + ") = Vertragstypen (" + spielTypen.length + ")", JSON.stringify(solvers.slice().sort()) === JSON.stringify(spielTypen.slice().sort()),
    "fehlt im Bot: " + spielTypen.filter((x) => !solvers.includes(x)).join(",") + " | zuviel: " + solvers.filter((x) => !spielTypen.includes(x)).join(","));

  // T6 calc.js WORKER_RAM
  const ramText = sf(tree, "Netscript/RamCostGenerator.ts").getFullText();
  const base = Number(/Base: ([0-9.]+)/.exec(ramText)[1]);
  const kosten = (fn) => Number(new RegExp("\\b" + fn[0].toUpperCase() + fn.slice(1) + ": ([0-9.]+),").exec(ramText)[1]);
  // hack/grow/weaken stehen als Zahl in RamCosts; Base steht in RamCostConstants
  const wr = botLiteral(botDatei("lib/calc.js"), "WORKER_RAM");
  const hk = kosten("hack"), gr = kosten("grow"), wk = kosten("weaken");
  ok(tree + ": calc.js WORKER_RAM hackT/growT/weakenT = Base " + base + " + " + hk + "/" + gr + "/" + wk, Math.abs(wr.hackT - (base + hk)) < 1e-9 && Math.abs(wr.growT - (base + gr)) < 1e-9 && Math.abs(wr.weakenT - (base + wk)) < 1e-9, "bot " + wr.hackT + "/" + wr.growT + "/" + wr.weakenT);

  // T7 Boerse
  const sc = sf(tree, "StockMarket/data/Constants.ts").getFullText();
  const zahlSC = (k) => Number(new RegExp(k + ": ([0-9.e]+)").exec(sc)[1].replace(/e(\d+)$/, "e$1"));
  const sa = botDatei("stockaccess.js");
  const preise = [...sa.matchAll(/\[\/\^[^\]]*\/i, "([^"]+)", ([0-9e]+)\]/g)].map((m) => [m[1], Number(m[2])]);
  const erw = { "WSE Account": zahlSC("WseAccountCost"), "TIX API": zahlSC("TixApiCost"), "4S Market Data": zahlSC("MarketData4SCost"), "4S TIX API": zahlSC("MarketDataTixApi4SCost") };
  ok(tree + ": stockaccess.js POSTEN-Preise (" + preise.length + ")", preise.length === 4 && preise.every(([n, p]) => erw[n] === p), preise.map(([n, p]) => n + " bot=" + p + " spiel=" + erw[n]).join("; "));
  ok(tree + ": boerse.js TAKT_MS/KOMMISSION", botLiteral(botDatei("boerse.js"), "TAKT_MS") === zahlSC("msPerStockUpdate") && botLiteral(botDatei("boerse.js"), "KOMMISSION") === zahlSC("StockMarketCommission"), "");

  // T8 Hashes
  const hs = sf(tree, "Hacknet/data/HashUpgradesMetadata.tsx");
  const HE = enumMap(tree, "Hacknet/Enums.ts", "HashUpgradeEnum");
  const hu = {};
  (function walk(n) {
    if (ts.isObjectLiteralExpression(n)) {
      const nm = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(hs) === "name");
      const cp = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(hs) === "costPerLevel");
      const va = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(hs) === "value");
      if (nm && cp) {
        const nmv = nm.initializer.getText(hs).replace("HashUpgradeEnum.", "");
        hu[HE[nmv] || nmv] = { cost: evalTs(cp.initializer, hs, {}), value: va ? evalTs(va.initializer, hs, {}) : undefined };
      }
    }
    ts.forEachChild(n, walk);
  })(hs);
  const hb = botDatei("hashes.js");
  const hbConst = (k) => { const m = new RegExp("const " + k + " = ([0-9e.]+);").exec(hb); return m ? Number(m[1]) : NaN; };
  const hName = (k) => { const m = new RegExp("const " + k + " = \"([^\"]+)\";").exec(hb); return m ? m[1] : null; };
  const rang = hu[hName("RANG")], gym = hu[hName("GYM")], verk = hu[hName("VERKAUF")];
  ok(tree + ": hashes.js Namen und Preise (Rang " + hbConst("RANG_PREIS_JE_STUFE") + "/" + hbConst("RANG_JE_STUFE") + ", Gym " + hbConst("GYM_PREIS_JE_STUFE") + ")",
    !!rang && !!gym && !!verk && rang.cost === hbConst("RANG_PREIS_JE_STUFE") && rang.value === hbConst("RANG_JE_STUFE") && gym.cost === hbConst("GYM_PREIS_JE_STUFE"),
    "Spiel: Rang " + JSON.stringify(rang) + ", Gym " + JSON.stringify(gym) + ", Verkauf " + JSON.stringify(verk));
}
console.log(meldung.join("\n"));
console.log("\nrote Zeilen: " + rot);
process.exit(rot ? 1 : 0);
