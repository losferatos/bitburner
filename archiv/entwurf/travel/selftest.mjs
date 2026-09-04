/**
 * entwurf/travel/selftest.mjs — Pruefstand fuer travel.js, ohne Spiel und ohne
 * Browser. Aufruf aus dem Projektwurzelverzeichnis:
 *
 *     node entwurf/travel/selftest.mjs
 *
 * Zwei Teile:
 *
 *  1. Trockenlaeufe gegen ein nachgebautes ns. Sie belegen nebenbei, dass
 *     `--dry` ohne `document` auskommt: in Node gibt es keines, und der Lauf
 *     geht trotzdem durch. Das ist der Beweis fuer die Zusage "der
 *     Trockenlauf fasst nichts an" — sie ist strukturell erzwungen, nicht
 *     versprochen.
 *
 *  2. Die Entscheidungsfunktionen gegen einen Mini-DOM. Der wichtigste Fall
 *     ist das Einladungsfenster von Sector-12: sein Text listet die Feinde
 *     auf, also auch "Chongqing"
 *     (Faction/ui/FactionInvitationManager.tsx:69-79). Ein
 *     `text.includes(factionName)` wie in entwurf/join/join.js:266 wuerde
 *     dort zuschlagen und beim Klick SECTOR-12 beitreten. Der Test zeigt
 *     beides: dass die Falle real ist und dass travel.js nicht hineintappt.
 */

const m = await import("./travel.js");

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    console.log("  FAIL " + name + (extra ? "  -> " + extra : ""));
  }
}

// ===========================================================================
// Teil 1: Trockenlaeufe gegen ein nachgebautes ns
// ===========================================================================

function makeNs(argv, player) {
  const files = {};
  return {
    _files: files,
    disableLog() {},
    getHostname: () => "joesguns",
    getPlayer: () => JSON.parse(JSON.stringify(player)),
    print: () => {},
    tprint: () => {},
    write: (f, c) => (files[f] = c),
    read: (f) => files[f] || "",
    scp: () => true,
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 1))),
    // Nachbau von ns.flags, so weit travel.js es benutzt.
    flags(spec) {
      const out = {};
      for (const [k, v] of spec) out[k] = v;
      for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith("--")) continue;
        const k = argv[i].slice(2);
        if (!(k in out)) continue;
        if (typeof out[k] === "boolean") out[k] = true;
        else out[k] = argv[++i];
      }
      return out;
    },
  };
}

const BASE = {
  city: "Sector-12",
  money: 4.1e10,
  factions: ["CyberSec", "NiteSec"],
  skills: { hacking: 900 },
};

async function dryRun(argv, player = BASE) {
  const ns = makeNs(argv, player);
  await m.main(ns);
  return ns._files["data/travel.txt"] || "";
}

const LAGER_B = ["--join", "Chongqing,TianDiHui,NewTokyo,Ishima", "--forbid", "Sector-12,Aevum,Volhaven", "--dry"];

console.log("\n1 Trockenlauf");

const r1 = await dryRun(LAGER_B);
check("Lager B geht durch", r1.includes("Ziel erreicht: JA"));
check(
  "Route fasst Chongqing und Tian Di Hui in EINE Fahrt",
  r1.includes("Chongqing [Chongqing + Tian Di Hui] -> New Tokyo [New Tokyo] -> Ishima [Ishima]"),
);
check("drei Fahrten, $600.000", r1.includes("Das sind 3 Reise(n) fuer $6.000e+5"));
check("Trockenlauf sagt ausdruecklich, dass er nichts angefasst hat", r1.includes("Es wurde nichts angefasst"));

const r2 = await dryRun(["--join", "Chongqing", "--dry"]);
check("ohne --forbid wird abgebrochen", r2.includes("ABBRUCH: --forbid fehlt"));

const r3 = await dryRun(["--join", "Chonqing", "--forbid", "Sector-12,Aevum,Volhaven", "--dry"]);
check("Tippfehler im Faktionsnamen bricht ab, statt zu raten", r3.includes("ist kein bekannter Faktionsname"));

const r4 = await dryRun(["--join", "Chongqing", "--forbid", "Sector-12", "--dry"]);
check(
  "unvollstaendige Sperrliste bricht ab und nennt die fehlenden Namen",
  r4.includes("der Plan sperrt Aevum, Volhaven"),
);

const r5 = await dryRun(LAGER_B, { ...BASE, money: 21e6 });
check("zu wenig Geld fuer Ishima wird VOR der Fahrt erkannt", r5.includes("Ishima") && r5.includes("REICHT NICHT"));

const r6 = await dryRun(["--join", "Chongqing", "--forbid", "Sector-12,Aevum,Volhaven", "--dry"], {
  ...BASE,
  factions: ["Sector-12"],
});
check(
  "bestehende Mitgliedschaft bei einem Feind wird erkannt",
  r6.includes('durch die bestehende Mitgliedschaft bei "Sector-12" gesperrt'),
);

const r7 = await dryRun(["--to", "chongqing", "--forbid", "Sector-12", "--dry"]);
check("nur reisen, ohne Beitritt", r7.includes("Plan ab Sector-12: Chongqing") && r7.includes("--join   : (nichts)"));

const r8 = await dryRun(["--join", "tian-di-hui", "--forbid", "Sector-12", "--dry"], {
  ...BASE,
  skills: { hacking: 20 },
});
check("Schreibweise egal: tian-di-hui findet Tian Di Hui", r8.includes("--join   : Tian Di Hui"));
check("zu niedriges Hacking wird erkannt", r8.includes("Hacking REICHT NICHT"));

// ===========================================================================
// Teil 2: Entscheidungsfunktionen am Mini-DOM
// ===========================================================================

class El {
  constructor(tag, text = "", children = [], cls = "") {
    this.tagName = tag.toUpperCase();
    this._own = text;
    this.children = children;
    this.className = cls;
    for (const c of children) c.parent = this;
    this.parent = null;
  }
  get textContent() {
    return this._own + this.children.map((c) => c.textContent).join("");
  }
  get innerText() {
    return this._own + this.children.map((c) => c.innerText).join("\n");
  }
  get parentElement() {
    return this.parent;
  }
  all() {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  // Nur so viel Selektorsprache, wie travel.js benutzt: "tag", ".klasse" und
  // "tag.klasse" (z.B. "span.factions-invites").
  matches(sel) {
    const [tag, ...classes] = sel.split(".");
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    const own = this.className.split(/\s+/);
    return classes.every((c) => own.includes(c));
  }
  querySelectorAll(sel) {
    const sels = sel.split(",").map((s) => s.trim());
    return this.all().filter((e) => sels.some((s) => e.matches(s)));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  closest(sel) {
    const sels = sel.split(",").map((s) => s.trim());
    let n = this;
    while (n) {
      if (sels.some((s) => n.matches(s))) return n;
      n = n.parent;
    }
    return null;
  }
  click() {
    this.clicked = (this.clicked || 0) + 1;
  }
}
const doc = (root) => ({
  querySelectorAll: (s) => root.querySelectorAll(s),
  querySelector: (s) => root.querySelector(s),
});

console.log("\n2 Einladungsfenster von Sector-12 (Feindliste enthaelt Chongqing)");

const s12Modal = new El(
  "div",
  "",
  [
    new El("h4", "You received a faction invitation."),
    new El("p", "Would you like to join "),
    new El("b", "Sector-12"),
    new El("p", "Sector-12 is enemies with:"),
    new El("p", "Chongqing"),
    new El("p", "New Tokyo"),
    new El("p", "Ishima"),
    new El("p", "Volhaven"),
    new El("button", "Join"),
    new El("button", "Decide later"),
  ],
  "MuiModal-root",
);
const d1 = doc(new El("div", "", [s12Modal]));

check("die Falle ist real: der naive includes-Test wuerde hier zuschlagen", (s12Modal.innerText || "").includes("Chongqing"));
const read = m.readInvitationModal(d1);
check('readInvitationModal liefert "Sector-12", nicht "Chongqing"', read.faction === "Sector-12", read.faction);

console.log("\n3 Bestaetigungsfenster der Reise");

function confirmModal(city) {
  return new El(
    "div",
    "",
    [
      new El("p", `Would you like to travel to ${city}? The trip will cost $200.000k.`),
      new El("button", "Travel"),
      new El("button", "Cancel"),
    ],
    "MuiModal-root",
  );
}
const dOk = doc(new El("div", "", [confirmModal("Chongqing")]));
const okRes = m.findTravelConfirmButton(dOk, "Chongqing");
check("richtige Stadt -> Knopf gefunden", !!okRes.btn && !okRes.reason);
const wrongRes = m.findTravelConfirmButton(dOk, "Ishima");
check("falsche Stadt -> kein Knopf, mit Grund", !wrongRes.btn && !!wrongRes.reason, wrongRes.reason);
const noneRes = m.findTravelConfirmButton(doc(new El("div", "", [])), "Chongqing");
check("kein Fenster -> kein Knopf, kein Grund", !noneRes.btn && !noneRes.reason);

console.log("\n4 Join!-Knopf auf der Faktionsseite");

function card(name) {
  return new El("div", "", [new El("button", "Join!"), new El("span", name)], "MuiPaper-root");
}
const invites = new El("span", "", [card("Sector-12"), card("Chongqing")], "factions-invites");
const d3 = doc(new El("div", "", [invites]));
const hitC = m.findPageJoinButton(d3, "Chongqing");
check(
  "Chongqing findet genau seinen Knopf, nicht den von Sector-12",
  !!hitC.btn && hitC.btn.parent.querySelector("span").textContent === "Chongqing",
);
check("eine nicht eingeladene Faktion findet nichts", !m.findPageJoinButton(d3, "Aevum").btn);
check("kein Teilstring-Ersatzweg: die Suche nach 'Sector' findet nichts", !m.findPageJoinButton(d3, "Sector").btn);

console.log("\n5 Weltkarte");

const FIBER_KEY = "__reactFiber$abc123";
function citySpan(city, current, inModal = false) {
  const span = new El("span", city[0]);
  span[FIBER_KEY] = {
    memoizedProps: {},
    return: { memoizedProps: { city, currentCity: current, onTravel() {} } },
  };
  if (inModal) return { span, wrap: new El("div", "", [span], "MuiModal-root") };
  return { span, wrap: span };
}
const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];
const mapNodes = CITIES.map((c) => citySpan(c, "Sector-12"));
const mapScope = new El("div", "", [new El("h4", "Travel Agency"), ...mapNodes.map((n) => n.wrap)]);
const t = m.findCityTarget(mapScope, "Chongqing");
check("Chongqing auf der Karte gefunden — ueber das city-Prop, nicht den Buchstaben", !!t.el && t.how === "Weltkarte", t.note);
check("die aktuelle Stadt wird nicht angeklickt", !m.findCityTarget(mapScope, "Sector-12").el);

const sleeveNode = citySpan("Ishima", "Aevum", true);
const modalScope = new El("div", "", [new El("h4", "Travel Agency"), sleeveNode.wrap]);
check("ein Kartenknoten in einem MuiModal-root wird verworfen (Sleeve/Bladeburner)", !m.findCityTarget(modalScope, "Ishima").el);

const listScope = new El("div", "", [
  new El("h4", "Travel Agency"),
  new El("button", "Travel to Chongqing"),
  new El("button", "Travel to Ishima"),
]);
const tl = m.findCityTarget(listScope, "Ishima");
check("Listendarstellung wird bedient", !!tl.el && tl.how === "Liste");
const sleeveList = new El("div", "", [new El("h4", "Travel Agency"), new El("button", "Ishima")]);
check("ein Knopf mit nacktem Stadtnamen greift nicht (so heissen die Sleeve-Knoepfe)", !m.findCityTarget(sleeveList, "Ishima").el);

console.log(`\n${pass} bestanden, ${fail} gescheitert`);
process.exit(fail ? 1 : 0);
