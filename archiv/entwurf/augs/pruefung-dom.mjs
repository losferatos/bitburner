// Aufruf: node --experimental-vm-modules entwurf/augs/pruefung-dom.mjs
// Prueft die Oberflaechenteile von buyaugs.js gegen ein nachgebautes DOM.
// Das ist der Teil, den man im echten Spiel nicht proben kann, ohne 42 Mrd
// zu riskieren. Braucht kein laufendes Spiel.
import fs from "node:fs";
import vm from "node:vm";

const FILE = new URL("./buyaugs.js", import.meta.url);

// --------------------------------------------------------------- Mini-DOM
function matchOne(el, sel) {
  sel = sel.trim();
  if (sel.startsWith("[role=")) {
    const v = sel.slice(7, -2);
    return el.attrs.role === v;
  }
  const m = sel.match(/^([a-zA-Z][a-zA-Z0-9]*)?((?:\.[\w-]+)*)$/);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const classes = m[2] ? m[2].slice(1).split(".") : [];
  return classes.every((c) => el.classes.has(c));
}
class El {
  constructor(tag, o = {}) {
    this.tagName = tag.toUpperCase();
    this.classes = new Set(o.classes || []);
    this.attrs = o.attrs || {};
    this.children = [];
    this.parentElement = null;
    this.text = o.text || "";
    this.disabled = !!o.disabled;
    this.id = o.id || "";
    this._onclick = o.onclick || null;
    this.clicks = 0;
  }
  get classList() {
    return { contains: (c) => this.classes.has(c) };
  }
  append(...kids) {
    for (const k of kids) {
      k.parentElement = this;
      this.children.push(k);
    }
    return this;
  }
  get innerText() {
    return [this.text, ...this.children.map((c) => c.innerText)].filter(Boolean).join("\n");
  }
  get textContent() {
    return this.innerText;
  }
  all() {
    const out = [this];
    for (const c of this.children) out.push(...c.all());
    return out;
  }
  matches(sel) {
    // Unterstuetzt Kommalisten und einfache Nachfahren-Selektoren ("A B").
    return sel.split(",").some((part) => {
      const segs = part.trim().split(/\s+/).filter(Boolean);
      if (!matchOne(this, segs[segs.length - 1])) return false;
      let node = this.parentElement;
      for (let i = segs.length - 2; i >= 0; i--) {
        while (node && !matchOne(node, segs[i])) node = node.parentElement;
        if (!node) return false;
        node = node.parentElement;
      }
      return true;
    });
  }
  querySelectorAll(sel) {
    return this.all().slice(1).filter((e) => e.matches(sel));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  closest(sel) {
    let n = this;
    while (n) {
      if (n.matches(sel)) return n;
      n = n.parentElement;
    }
    return null;
  }
  click() {
    this.clicks++;
    if (this.disabled) return;
    if (this._onclick) this._onclick();
  }
}
class Doc extends El {
  constructor() {
    super("#document");
    this.body = new El("body");
    this.append(this.body);
    this.defaultView = { __nightshift: null, setTimeout: () => 0, clearTimeout: () => {} };
    this.events = [];
  }
  getElementById(id) {
    return this.all().find((e) => e.id === id) || null;
  }
  dispatchEvent(e) {
    this.events.push(e);
    return true;
  }
}
const FKEY = "__reactFiber$test";
function withFiber(el, props, parentFiber = null) {
  el[FKEY] = { memoizedProps: props, return: parentFiber };
  return el[FKEY];
}

// -------------------------------------------------- Modul laden (alles export)
let src = fs.readFileSync(FILE, "utf8").replace(/^(async function |function |const |class )/gm, "export $1");
const ctx = vm.createContext({
  console,
  Math,
  Number,
  Object,
  Set,
  Map,
  Array,
  JSON,
  String,
  Date,
  Infinity,
  NaN,
  isNaN,
  KeyboardEvent: class {
    constructor(t, o) {
      this.type = t;
      Object.assign(this, o);
    }
  },
});
const mod = new vm.SourceTextModule(src, { context: ctx, identifier: "buyaugs" });
await mod.link(() => {
  throw new Error("keine Importe");
});
await mod.evaluate();
const M = mod.namespace;

// ------------------------------------------------------ Seite nachbauen
/**
 * Baut eine Faktions-Augmentierungsseite so, wie AugmentationsPage.tsx sie
 * rendert: je Aug ein Paper mit Buy/Owned-Knopf, an dem die React-Props der
 * Komponente PurchasableAugmentation haengen.
 */
function buildAugPage(doc, factionName, rep, augs, queue = null) {
  doc.body.children.length = 0;
  const root = new El("div");
  doc.body.append(root);
  // Wenn ein Warteschlangenstand mitgegeben wird, baut der Test die
  // Augmentierungsseite gleich mit: den Knopf "Install Augmentations" und je
  // wartendem Eintrag ein ListItemText mit der Prop `primary`.
  if (queue) {
    root.append(new El("button", { text: "Install Augmentations" }));
    for (const entry of queue) {
      const li = new El("div", { classes: ["MuiListItemText-root"], text: entry });
      withFiber(li, { primary: entry });
      root.append(li);
    }
  }
  const parent = { rep, faction: { name: factionName, playerReputation: rep }, canPurchase: () => true };
  const made = [];
  for (const a of augs) {
    const paper = new El("div", { classes: ["MuiPaper-root"] });
    const title = new El("p", { text: a.name + (a.levelSuffix ? ` - Level ${a.levelSuffix}` : "") });
    const btn = new El("button", { text: a.owned ? "Owned" : "Buy", disabled: !!a.owned || !!a.disabled });
    // Fiber-Kette: Knopf -> ButtonBase -> Box -> PurchasableAugmentation
    const rowFiber = withFiber(new El("i"), { parent, augName: a.name, owned: !!a.owned });
    const boxFiber = { memoizedProps: {}, return: rowFiber };
    withFiber(btn, {}, boxFiber);
    paper.append(btn, title);
    root.append(paper);
    made.push({ aug: a, btn, paper });
  }
  return made;
}

/**
 * Ein kleines Spiel: Seitenleiste, Faktionsuebersicht, Faktionsseiten und die
 * Augmentierungsseite mit der Warteschlange. Klicks wechseln wirklich die
 * Seite — nur so laufen goToAugmentationsPage und openFactionAugPage im Test
 * durch dieselben Wege wie im Spiel.
 */
function makeGame(doc, cfg) {
  const state = { page: "terminal", faction: null, queue: cfg.queue || [], offers: cfg.offers, rep: cfg.rep };
  function sidebar(root) {
    const drawer = new El("div", { classes: ["MuiDrawer-root"] });
    for (const label of ["Terminal", "Factions", "Augmentations"]) {
      if (label === "Augmentations" && cfg.hideAugPage) continue;
      const item = new El("div", { classes: ["MuiListItem-root"] });
      const txt = new El("div", { classes: ["MuiListItemText-root"] }).append(new El("span", { text: label }));
      item.append(txt);
      item._onclick = () => {
        state.page = label.toLowerCase();
        state.faction = null;
        render();
      };
      drawer.append(item);
    }
    root.append(drawer);
  }
  function render() {
    doc.body.children.length = 0;
    const root = new El("div");
    doc.body.append(root);
    sidebar(root);
    if (state.page === "terminal") {
      root.append(new El("input", { id: "terminal-input" }));
    } else if (state.page === "augmentations") {
      root.append(new El("button", { text: "Install Augmentations" }));
      for (const entry of state.queue) {
        const li = new El("div", { classes: ["MuiListItemText-root"], text: entry });
        withFiber(li, { primary: entry });
        root.append(li);
      }
    } else if (state.page === "factions") {
      const joined = new El("span", { classes: ["factions-joined"] });
      for (const f of Object.keys(state.offers)) {
        const card = new El("div", { classes: ["MuiPaper-root"] });
        const btn = new El("button", { text: "Augments" });
        btn._onclick = () => {
          state.page = "faction";
          state.faction = f;
          render();
        };
        card.append(btn, new El("span", { text: f }));
        joined.append(card);
      }
      root.append(joined);
    } else if (state.page === "faction") {
      const f = state.faction;
      const parent = { rep: state.rep[f], faction: { name: f, playerReputation: state.rep[f] } };
      for (const a of state.offers[f]) {
        const paper = new El("div", { classes: ["MuiPaper-root"] });
        const label = a.name === "NeuroFlux Governor" ? `${a.name} - Level ${cfg.nfgShown}` : a.name;
        const btn = new El("button", { text: a.owned ? "Owned" : "Buy", disabled: !!a.owned });
        const rowFiber = withFiber(new El("i"), { parent, augName: a.name, owned: !!a.owned });
        withFiber(btn, {}, { memoizedProps: {}, return: rowFiber });
        paper.append(btn, new El("p", { text: label }));
        root.append(paper);
      }
    }
  }
  render();
  return state;
}

let failed = 0;
function check(name, cond, extra = "") {
  if (cond) console.log("  ok  " + name);
  else {
    console.log("  FEHLER " + name + (extra ? " — " + extra : ""));
    failed++;
  }
}

console.log("--- readAugPage ---");
const doc = new Doc();
buildAugPage(doc, "CyberSec", 29804, [
  { name: "NeuroFlux Governor", levelSuffix: 23 },
  { name: "BitWire" },
  { name: "Neurotrainer I", owned: true },
  { name: "Cranial Signal Processors - Gen II", owned: true },
]);
let page = M.readAugPage(doc);
check("vier Zeilen gefunden", page.rows.length === 4, "gefunden: " + page.rows.length);
check("Faktion erkannt", page.faction === "CyberSec");
check("Reputation exakt", page.rep === 29804);
check("NFG-Stufe = angezeigte minus 1", page.nfgLevel === 22, "gelesen: " + page.nfgLevel);
check("owned korrekt", page.rows.find((r) => r.name === "Neurotrainer I").owned === true);
check("BitWire nicht owned", page.rows.find((r) => r.name === "BitWire").owned === false);
check("currentAugPageFaction", M.currentAugPageFaction(doc) === "CyberSec");

console.log("--- ohne React-Props darf nichts gefunden werden ---");
const bare = new Doc();
bare.body.append(new El("button", { text: "Buy" }));
check("keine Zeilen ohne Fiber", M.readAugPage(bare).rows.length === 0);
check("keine Faktion ohne Fiber", M.currentAugPageFaction(bare) === null);

console.log("--- dismissDialogs ---");
{
  const d2 = new Doc();
  const closeBtn = new El("button", { classes: ["MuiIconButton-root"] });
  const alert = new El("div", { classes: ["MuiModal-root"], text: "You purchased BitWire." }).append(closeBtn);
  const confirmClose = new El("button", { classes: ["MuiIconButton-root"] });
  const confirm = new El("div", { classes: ["MuiModal-root"] }).append(
    confirmClose,
    new El("h4", { text: "BitWire" }),
    new El("button", { text: "Purchase" }),
  );
  // Bestaetigungsfenster einer ANDEREN Aug — das muss weg, sonst ist es
  // unschliessbar und legt einen Schleier ueber die Oberflaeche.
  const strayClose = new El("button", { classes: ["MuiIconButton-root"] });
  const stray = new El("div", { classes: ["MuiModal-root"] }).append(
    strayClose,
    new El("h4", { text: "Combat Rib I" }),
    new El("button", { text: "Purchase" }),
  );
  d2.body.append(alert, confirm, stray);
  const texts = M.dismissDialogs(d2, "BitWire");
  check("zwei Fenster geschlossen", texts.length === 2, "geschlossen: " + texts.length);
  check("Meldung wurde geschlossen", closeBtn.clicks === 1);
  check("eigenes Bestaetigungsfenster blieb stehen", confirmClose.clicks === 0);
  check("fremdes Bestaetigungsfenster wurde geschlossen", strayClose.clicks === 1);
  check("Meldungstext wurde mitgenommen", texts.some((t) => t.includes("You purchased BitWire")), texts.join(" | "));
}

console.log("--- buyOne: Erfolg (Nicht-NFG, mit Bestaetigungsfenster) ---");
{
  const d = new Doc();
  let money = 130e9;
  const rows = buildAugPage(d, "CyberSec", 29804, [{ name: "NeuroFlux Governor", levelSuffix: 23 }, { name: "BitWire" }]);
  const bw = rows.find((r) => r.aug.name === "BitWire");
  bw.btn._onclick = () => {
    // Spiel oeffnet das Bestaetigungsfenster
    const ok = new El("button", { text: "Purchase" });
    const modal = new El("div", { classes: ["MuiModal-root"] }).append(new El("h4", { text: "BitWire" }), ok);
    d.body.append(modal);
    ok._onclick = () => {
      money -= 42.053e9;
      bw.btn[FKEY].return.return.memoizedProps = { ...bw.btn[FKEY].return.return.memoizedProps, owned: true };
      modal.parentElement.children.splice(modal.parentElement.children.indexOf(modal), 1);
      // und die Erfolgsmeldung
      const c = new El("button", { classes: ["MuiIconButton-root"] });
      const alertEl = new El("div", { classes: ["MuiModal-root"], text: "You purchased BitWire." }).append(c);
      c._onclick = () => alertEl.parentElement.children.splice(alertEl.parentElement.children.indexOf(alertEl), 1);
      d.body.append(alertEl);
    };
  };
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "BitWire",
    expectedCost: 42.053e9,
    getMoney: async () => money,
    isNfg: false,
    nfgLevelBefore: 22,
  });
  check("Kauf gilt als geglueckt", res.ok, res.reason);
  check("Betrag stimmt", Math.abs(res.spent - 42.053e9) < 1, String(res.spent));
  check("Meldung wurde weggeraeumt", d.querySelectorAll(".MuiModal-root").length === 0);
}

console.log("--- buyOne: Klick ohne Wirkung ---");
{
  const d = new Doc();
  buildAugPage(d, "CyberSec", 29804, [{ name: "BitWire" }]);
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "BitWire",
    expectedCost: 42e9,
    getMoney: async () => 130e9,
    isNfg: false,
    nfgLevelBefore: 22,
  });
  check("Fehlschlag erkannt", !res.ok && /keine Zustandsaenderung/.test(res.reason), res.reason);
}

console.log("--- buyOne: gesperrter Knopf wird nicht angeklickt ---");
{
  const d = new Doc();
  const rows = buildAugPage(d, "CyberSec", 29804, [{ name: "BitWire", disabled: true }]);
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "BitWire",
    expectedCost: 42e9,
    getMoney: async () => 130e9,
    isNfg: false,
    nfgLevelBefore: 22,
  });
  check("Fehlschlag mit Begruendung", !res.ok && /gesperrt/.test(res.reason), res.reason);
  check("nicht geklickt", rows[0].btn.clicks === 0);
}

console.log("--- buyOne: Zustand sagt gekauft, Geld sagt nein ---");
{
  const d = new Doc();
  const rows = buildAugPage(d, "CyberSec", 29804, [{ name: "BitWire" }]);
  let money = 130e9;
  rows[0].btn._onclick = () => {
    money -= 1e9; // viel zu wenig
    rows[0].btn[FKEY].return.return.memoizedProps = { ...rows[0].btn[FKEY].return.return.memoizedProps, owned: true };
  };
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "BitWire",
    expectedCost: 42e9,
    getMoney: async () => money,
    isNfg: false,
    nfgLevelBefore: 22,
  });
  check("Preismodell-Widerspruch erkannt", !res.ok && /Preismodell/.test(res.reason), res.reason);
}

console.log("--- buyOne: NeuroFlux ohne ablesbare Stufe wird nicht gekauft ---");
{
  const d = new Doc();
  const rows = buildAugPage(d, "CyberSec", 29804, [{ name: "NeuroFlux Governor" }]); // kein Level im Titel
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "NeuroFlux Governor",
    expectedCost: 56e9,
    getMoney: async () => 130e9,
    isNfg: true,
    nfgLevelBefore: null,
  });
  check("abgelehnt", !res.ok && /Stufe/.test(res.reason), res.reason);
  check("nicht geklickt", rows[0].btn.clicks === 0);
}

console.log("--- buyOne: NeuroFlux Erfolg ueber die Stufe ---");
{
  const d = new Doc();
  let money = 130e9;
  const rows = buildAugPage(d, "CyberSec", 29804, [{ name: "NeuroFlux Governor", levelSuffix: 23 }]);
  rows[0].btn._onclick = () => {
    money -= 56.333e9;
    rows[0].paper.children.find((c) => c.tagName === "P").text = "NeuroFlux Governor - Level 24";
  };
  const res = await M.buyOne({
    doc: d,
    sleep: () => Promise.resolve(),
    log: () => {},
    augName: "NeuroFlux Governor",
    expectedCost: 56.333e9,
    getMoney: async () => money,
    isNfg: true,
    nfgLevelBefore: 22,
  });
  check("Kauf erkannt", res.ok, res.reason);
}

// Der echte Stand vom 20.08.: CyberSec, NeuroFlux installiert auf Stufe 9,
// dreizehn Stufen in der Warteschlange, vier verschiedene Augs installiert.
const CYBERSEC_AUGS = [
  { name: "NeuroFlux Governor" },
  { name: "BitWire" },
  { name: "Neurotrainer I", owned: true },
  { name: "Synaptic Enhancement Implant", owned: true },
  { name: "Cranial Signal Processors - Gen I", owned: true },
  { name: "Cranial Signal Processors - Gen II", owned: true },
];
const INSTALLED = new Map([
  ["Neurotrainer I", 1],
  ["Synaptic Enhancement Implant", 1],
  ["Cranial Signal Processors - Gen I", 1],
  ["Cranial Signal Processors - Gen II", 1],
  ["NeuroFlux Governor", 9],
]);
const noop = { sleep: () => Promise.resolve(), log: () => {} };

console.log("--- collectState: q kommt aus der Warteschlange ---");
{
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: CYBERSEC_AUGS },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22"],
    nfgShown: 23,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec"], installedAugs: INSTALLED });
  check("q = 13", st.q === 13, "q=" + st.q + " probleme=" + st.problems.join("|"));
  check("13 wartende NeuroFlux", st.queuedNfg === 13);
  check("keine anderen wartenden", st.queuedNonNfg.length === 0);
  check("NeuroFlux-Stufe 22", st.nfgLevel === 22);
  check("Reputation exakt uebernommen", st.rep.get("CyberSec") === 29804);
  check("keine Probleme", st.problems.length === 0, st.problems.join("|"));
  check("vertrauenswuerdig", st.trustworthy === true);

  const cand = M.buildCandidates({
    rows: st.rows,
    rep: st.rep,
    installed: new Set(INSTALLED.keys()),
    nfgLevel: st.nfgLevel,
    distinctBonus: 0.15,
    nfgDepth: 25,
  });
  const plan = M.planPurchases(cand.candidates, 130e9, Math.pow(1.9, st.q), 6);
  check(
    "Plan bei $130 Mrd: genau BitWire fuer 42.05 Mrd",
    plan.seq.length === 1 && plan.seq[0].name === "BitWire" && Math.abs(plan.total - 42.053e9) < 1e7,
    plan.seq.map((s) => s.name).join(",") + " $" + (plan.total / 1e9).toFixed(2),
  );
  const plan2 = M.planPurchases(cand.candidates, 151e9, Math.pow(1.9, st.q), 6);
  check(
    "Plan bei $151 Mrd: NeuroFlux ZUERST, dann BitWire (teuerste zuerst)",
    plan2.seq.length === 2 && plan2.seq[0].isNfg && plan2.seq[1].name === "BitWire",
    plan2.seq.map((s) => s.name).join(" -> "),
  );
}

console.log("--- collectState: DarkNet-Aug in der Warteschlange, auf keiner Faktionsseite ---");
{
  // Genau der Fall, an dem eine Herleitung aus den Faktionsseiten scheitert:
  // "The B1ade of Solomonoff" hat factions: [] und kommt aus dem DarkNet-Irrgarten.
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: CYBERSEC_AUGS },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22", "The B1ade of Solomonoff"],
    nfgShown: 23,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec"], installedAugs: INSTALLED });
  check("q = 14, nicht 13", st.q === 14, "q=" + st.q);
  check("The B1ade of Solomonoff als wartend erkannt", st.queuedNonNfg.includes("The B1ade of Solomonoff"), st.queuedNonNfg.join(","));
  check("vertrauenswuerdig", st.trustworthy === true, st.problems.join("|"));
}

console.log("--- collectState: Faktionsseite sagt gekauft, Warteschlange kennt es nicht ---");
{
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: [{ name: "NeuroFlux Governor" }, { name: "BitWire", owned: true }] },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22"],
    nfgShown: 23,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec"], installedAugs: INSTALLED });
  check("Widerspruch erkannt", st.contradiction === true);
  check("nicht vertrauenswuerdig", st.trustworthy === false);
  check("Grund genannt", st.problems.some((p) => /BitWire/.test(p)), st.problems.join("|"));
}

console.log("--- collectState: leere Warteschlange -> q = 0 ---");
{
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: [{ name: "NeuroFlux Governor" }, { name: "BitWire" }] },
    rep: { CyberSec: 29804 },
    queue: [],
    nfgShown: 10,
  });
  const st = await M.collectState({
    doc: d,
    ...noop,
    factions: ["CyberSec"],
    installedAugs: new Map([["NeuroFlux Governor", 9]]),
  });
  check("q = 0", st.q === 0, "q=" + st.q + " " + st.problems.join("|"));
  check("NeuroFlux steht bei 9", st.nfgLevel === 9);
  check("vertrauenswuerdig", st.trustworthy === true, st.problems.join("|"));
}

console.log("--- collectState: Augmentierungsseite unerreichbar -> kein Kauf ---");
{
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: CYBERSEC_AUGS },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22"],
    nfgShown: 23,
    hideAugPage: true,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec"], installedAugs: INSTALLED });
  check("q unbestimmt", st.q === null, "q=" + st.q);
  check("nicht vertrauenswuerdig", st.trustworthy === false);
  check("Grund genannt", st.problems.some((p) => /Augmentations/.test(p)), st.problems.join("|"));
}

console.log("--- collectState: eine von zwei Faktionen unlesbar -> Warnung, kein Abbruch ---");
{
  // Seit q direkt gelesen wird, verfaelscht eine ungelesene Faktion keinen
  // Preis mehr — sie kostet nur Kandidaten. Also weiterkaufen duerfen.
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: CYBERSEC_AUGS },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22"],
    nfgShown: 23,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec", "NiteSec"], installedAugs: INSTALLED });
  check("q trotzdem 13", st.q === 13, "q=" + st.q);
  check("NiteSec als ungelesen gemeldet", st.unread.includes("NiteSec"), st.unread.join(","));
  check("trotzdem vertrauenswuerdig", st.trustworthy === true, st.problems.join("|"));
}

console.log("--- collectState: unbekannter Warteschlangeneintrag wird gemeldet ---");
{
  const d = new Doc();
  makeGame(d, {
    offers: { CyberSec: CYBERSEC_AUGS },
    rep: { CyberSec: 29804 },
    queue: ["NeuroFlux Governor - Level 22", "Voellig Neue Aug 9000"],
    nfgShown: 23,
  });
  const st = await M.collectState({ doc: d, ...noop, factions: ["CyberSec"], installedAugs: INSTALLED });
  check("Eintrag gemeldet", st.problems.some((p) => /Voellig Neue Aug 9000/.test(p)), st.problems.join("|"));
}

console.log(failed ? `\n${failed} FEHLER` : "\nalle Proben bestanden");
process.exitCode = failed ? 1 : 0;
