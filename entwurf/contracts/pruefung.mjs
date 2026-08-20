/**
 * Pruefung der Vertragsloeser - offline, ohne Spiel.
 *
 *     node --experimental-vm-modules entwurf/contracts/pruefung.mjs
 *     node --experimental-vm-modules entwurf/contracts/pruefung.mjs --runden 500
 *
 * Was hier passiert und warum es mehr wert ist als ein Beispieltest:
 *
 * Geprueft wird nicht gegen meine Lesart der Aufgabenstellung, sondern gegen
 * den ECHTEN Quelltext des Spiels (reference/v301). Fuer jeden Typ wird die
 * Aufgabe mit `generate()` des Spiels erzeugt, meine Antwort berechnet und
 * dann exakt der Weg nachgestellt, den ns.codingcontract.attempt geht:
 *
 *     convertAnswer  ->  validateAnswer  ->  solver
 *     (Contract.ts:106-140, NetscriptFunctions/CodingContract.ts:31-38)
 *
 * Besteht eine Antwort diesen Weg, wuerde sie im Spiel angenommen. Das ist
 * die einzige Zusage, auf die es ankommt - ein verbrauchter Versuch ist
 * unwiederbringlich.
 *
 * Zusaetzlich laufen die woertlichen Beispiele aus den Aufgabentexten und
 * Gegenproben mit absichtlich falschen Antworten (sonst koennte ein `verify`,
 * das immer `true` sagt, unbemerkt durchgehen).
 */

import { SOLVERS } from "./contracts.js";
import { ladeSpielVertraege } from "./gameload.mjs";

const args = process.argv.slice(2);
const wert = (name, vorgabe) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? Number(args[i + 1]) : vorgabe;
};
const RUNDEN = wert("--runden", 150);

// Manche Typen sind teuer (exponentielle Suche, Siebe ueber Millionen Zahlen).
// Weniger Runden, dafuer laeuft die Pruefung in unter einer Minute durch.
const RUNDEN_JE_TYP = {
  "Find All Valid Math Expressions": 12,
  "Sanitize Parentheses in Expression": 25,
  "Total Number of Primes": 8,
  "Compression III: LZ Compression": 30,
  "Compression II: LZ Decompression": 60,
  "Square Root": 40,
  "Total Ways to Sum II": 60,
};

/**
 * Der Weg, den das Spiel mit einer eingereichten Antwort geht.
 * Contract.isValid + Contract.isSolution, ohne Umwege.
 */
function wieImSpiel(def, state, antwort) {
  let a = antwort;
  if (typeof a === "string") {
    try {
      a = def.convertAnswer(a);
    } catch (e) {
      return { ok: false, grund: "convertAnswer warf: " + e.message };
    }
  }
  if (!def.validateAnswer(a)) {
    return { ok: false, grund: "validateAnswer lehnt ab: " + JSON.stringify(a) };
  }
  if (!def.solver(state, a)) {
    return { ok: false, grund: "solver sagt falsch" };
  }
  return { ok: true };
}

// ===========================================================================
// Woertliche Beispiele aus den Aufgabentexten des Spiels.
// `data` ist die Eingabe, `erwartet` (falls gesetzt) die im Text genannte
// Antwort. Wo der Text mehrere gleichwertige Antworten zulaesst, steht statt
// `erwartet` nur eine `pruefe`-Funktion.
// ===========================================================================
const BEISPIELE = {
  "Total Ways to Sum": [{ data: 4, erwartet: 4 }],
  "Spiralize Matrix": [
    {
      data: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      erwartet: [1, 2, 3, 6, 9, 8, 7, 4, 5],
    },
    {
      data: [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ],
      erwartet: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7],
    },
  ],
  "Merge Overlapping Intervals": [
    {
      data: [
        [1, 3],
        [8, 10],
        [2, 6],
        [10, 16],
      ],
      erwartet: [
        [1, 6],
        [8, 16],
      ],
    },
  ],
  "Generate IP Addresses": [
    { data: "25525511135", erwarteteMenge: ["255.255.11.135", "255.255.111.35"] },
    { data: "1938718066", erwarteteMenge: ["193.87.180.66"] },
  ],
  "Minimum Path Sum in a Triangle": [
    { data: [[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]], erwartet: 11 },
  ],
  "Shortest Path in a Grid": [
    {
      data: [
        [0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0],
      ],
      pruefe: (a) => a.length === "DRRURRD".length,
    },
    {
      data: [
        [0, 1],
        [1, 0],
      ],
      erwartet: "",
    },
  ],
  // Bei diesen drei Typen prueft das Spiel mit `includes` bzw. einem Set
  // (SanitizeParenthesesInExpression.ts:117, GenerateIPAddresses.ts:82,
  // FindAllValidMathExpressions.ts:112) - die Reihenfolge ist also egal und
  // darf hier nicht eingefordert werden.
  "Sanitize Parentheses in Expression": [
    { data: "()())()", erwarteteMenge: ["()()()", "(())()"] },
    { data: "(a)())()", erwarteteMenge: ["(a)()()", "(a())()"] },
    { data: ")(", erwarteteMenge: [""] },
  ],
  "Find All Valid Math Expressions": [
    { data: ["123", 6], erwarteteMenge: ["1+2+3", "1*2*3"] },
    { data: ["105", 5], erwarteteMenge: ["1*0+5", "10-5"] },
  ],
  "HammingCodes: Integer to Encoded Binary": [
    { data: 8, erwartet: "11110000" },
    { data: 21, erwartet: "1001101011" },
  ],
  "HammingCodes: Encoded Binary to Integer": [
    { data: "11110000", erwartet: 8 },
    { data: "1001101010", erwartet: 21 },
  ],
  "Proper 2-Coloring of a Graph": [
    {
      data: [
        4,
        [
          [0, 2],
          [0, 3],
          [1, 2],
          [1, 3],
        ],
      ],
      pruefe: (a) => a.length === 4,
    },
    {
      data: [
        3,
        [
          [0, 1],
          [0, 2],
          [1, 2],
        ],
      ],
      erwartet: [],
    },
  ],
  "Compression I: RLE Compression": [
    { data: "aaaaabccc", erwartet: "5a1b3c" },
    { data: "aAaAaA", erwartet: "1a1A1a1A1a1A" },
    { data: "111112333", erwartet: "511233" },
    { data: "zzzzzzzzzzzzzzzzzzz", pruefe: (a) => a.length === 6 },
  ],
  "Compression II: LZ Decompression": [
    { data: "5aaabb450723abb", erwartet: "aaabbaaababababaabb" },
  ],
  "Compression III: LZ Compression": [
    { data: "abracadabra", pruefe: (a) => a.length === "7abracad47".length },
    { data: "mississippi", pruefe: (a) => a.length === "4miss433ppi".length },
    { data: "aAAaAAaAaAA", pruefe: (a) => a.length === "3aAA53035".length },
    { data: "2718281828", pruefe: (a) => a.length === "627182844".length },
    { data: "abcdefghijk", pruefe: (a) => a.length === "9abcdefghi02jk".length },
    { data: "aaaaaaaaaaaa", pruefe: (a) => a.length === "3aaa91".length },
    { data: "aaaaaaaaaaaaa", pruefe: (a) => a.length === "1a91031".length },
    { data: "aaaaaaaaaaaaaa", pruefe: (a) => a.length === "1a91041".length },
  ],
  // Aus dem Aufgabentext: DASHBOARD mit LINUX ergibt als ersten Buchstaben O.
  "Encryption II: Vigenère Cipher": [{ data: ["DASHBOARD", "LINUX"], pruefe: (a) => a[0] === "O" }],
  "Total Number of Primes": [{ data: [0, 20], erwartet: 8 }],
  "Largest Rectangle in a Matrix": [
    {
      data: [
        [1, 0, 0],
        [0, 0, 0],
      ],
      pruefe: (a) => flaeche(a) === 4,
    },
    {
      data: [
        [0, 0, 0, 1],
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
      pruefe: (a) => flaeche(a) === 8,
    },
  ],
};

function flaeche(a) {
  return (Math.abs(a[1][0] - a[0][0]) + 1) * (Math.abs(a[1][1] - a[0][1]) + 1);
}

/** Gleiche Elemente, Reihenfolge egal - so prueft das Spiel bei Listen. */
function mengeGleich(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const rest = [...b];
  for (const x of a) {
    const i = rest.findIndex((y) => tiefGleich(x, y));
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  return true;
}

function tiefGleich(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => tiefGleich(x, b[i]));
  }
  return a === b;
}

// ===========================================================================
// Absichtlich falsche Antworten. Ein `verify`, das sie durchwinkt, taugt
// nichts - und genau darauf ruht die Zusage "kein Rateversuch".
//
// Fuer die fuenf Typen, bei denen das Spiel eine ganze FAMILIE von Antworten
// akzeptiert, taugt die allgemeine Verstuemmelung unten nichts: sie erzeugt
// entweder etwas, das schon an der Formpruefung scheitert (Largest Rectangle,
// Array Jumping Game), oder etwas, das zufaellig auch richtig ist (bei
// Proper 2-Coloring in 62 % der Faelle, weil der weggelassene Knoten oft gar
// keine Kante hat). Getestet wuerde dann gar nichts. Deshalb hier gezielte
// BEINAH-Antworten: knapp daneben, aber formal gueltig.
// ===========================================================================
const BEINAH = {
  // Gueltiges, aber zu kleines Rechteck - die Formpruefung passiert es,
  // die Flaechenpruefung darf es nicht.
  "Largest Rectangle in a Matrix": (a) =>
    a[0][0] === a[1][0] && a[0][1] === a[1][1] ? null : [[a[0][0], a[0][1]], [a[0][0], a[0][1]]],
  // Eine Farbe kippen: bei einem zusammenhaengenden Graphen bricht das
  // garantiert eine Kante.
  "Proper 2-Coloring of a Graph": (a) => (a.length ? [1 - a[0], ...a.slice(1)] : null),
  "Array Jumping Game": (a) => (a === 1 ? 0 : 1),
  // Ein Umweg ist laenger als der kuerzeste Weg und muss auffallen.
  "Shortest Path in a Grid": (a) => (a === "" ? null : "UD" + a),
  // Eine abgeschnittene Kodierung dekodiert nicht mehr zum Klartext.
  "Compression III: LZ Compression": (a) => (a.length > 2 ? a.slice(0, -1) : null),
};

function falscheAntwort(typ, richtig) {
  if (BEINAH[typ]) return BEINAH[typ](richtig);
  return allgemeinFalsch(typ, richtig);
}

function allgemeinFalsch(typ, richtig) {
  if (typeof richtig === "number") return richtig + 1;
  if (typeof richtig === "string") {
    if (typ === "Shortest Path in a Grid") return richtig + "U";
    if (richtig.length === 0) return "X";
    // Erste zwei Zeichen tauschen, falls sie sich unterscheiden.
    for (let i = 1; i < richtig.length; i++) {
      if (richtig[i] !== richtig[0]) {
        return richtig[i] + richtig.slice(1, i) + richtig[0] + richtig.slice(i + 1);
      }
    }
    return richtig + richtig[0];
  }
  if (Array.isArray(richtig)) {
    if (richtig.length === 0) return [0];
    return richtig.slice(0, -1);
  }
  return null;
}

// ===========================================================================
// Lauf
// ===========================================================================
const spiel = await ladeSpielVertraege();
const alleTypen = Object.keys(spiel).sort();

let fehler = 0;
let gesamtFaelle = 0;
const zeilen = [];

for (const typ of alleTypen) {
  const def = spiel[typ];
  const loeser = SOLVERS[typ];
  if (!loeser) {
    zeilen.push(["FEHLT", typ, "kein Loeser vorhanden"]);
    fehler++;
    continue;
  }

  const meldungen = [];
  let faelle = 0;
  let echteGegenproben = 0;
  let formfehler = 0;

  // --- 1. Beispiele aus den Aufgabentexten -------------------------------
  for (const beispiel of BEISPIELE[typ] ?? []) {
    faelle++;
    try {
      const antwort = loeser.solve(beispiel.data);
      if ("erwartet" in beispiel && !tiefGleich(antwort, beispiel.erwartet)) {
        meldungen.push(
          `Beispiel ${JSON.stringify(beispiel.data)}: erwartet ${JSON.stringify(beispiel.erwartet)}, bekam ${JSON.stringify(antwort)}`,
        );
      }
      if ("erwarteteMenge" in beispiel && !mengeGleich(antwort, beispiel.erwarteteMenge)) {
        meldungen.push(
          `Beispiel ${JSON.stringify(beispiel.data)}: erwartet (Reihenfolge egal) ${JSON.stringify(beispiel.erwarteteMenge)}, bekam ${JSON.stringify(antwort)}`,
        );
      }
      if (beispiel.pruefe && !beispiel.pruefe(antwort)) {
        meldungen.push(`Beispiel ${JSON.stringify(beispiel.data)}: Antwort ${JSON.stringify(antwort)} passt nicht`);
      }
      if (loeser.verify(beispiel.data, antwort) !== true) {
        meldungen.push(`Beispiel ${JSON.stringify(beispiel.data)}: eigene Gegenprobe lehnt die eigene Antwort ab`);
      }
    } catch (e) {
      meldungen.push(`Beispiel ${JSON.stringify(beispiel.data)} warf: ${e.message}`);
    }
  }

  // --- 2. Zufallsfaelle gegen den echten Spiel-solver ---------------------
  const runden = RUNDEN_JE_TYP[typ] ?? RUNDEN;
  for (let i = 0; i < runden && meldungen.length < 5; i++) {
    faelle++;
    let state;
    try {
      state = def.generate();
    } catch (e) {
      meldungen.push("generate() des Spiels warf: " + e.message);
      break;
    }
    const data = def.getData ? def.getData(state) : state;

    let antwort;
    try {
      antwort = loeser.solve(data);
    } catch (e) {
      meldungen.push(`solve warf bei ${JSON.stringify(data, ersatz).slice(0, 200)}: ${e.message}`);
      continue;
    }

    const ergebnis = wieImSpiel(def, state, antwort);
    if (!ergebnis.ok) {
      meldungen.push(
        `Spiel lehnt ab (${ergebnis.grund}) bei ${JSON.stringify(data, ersatz).slice(0, 200)} -> ${JSON.stringify(antwort, ersatz).slice(0, 200)}`,
      );
      continue;
    }

    // Die eigene Gegenprobe muss dasselbe sagen wie das Spiel.
    if (loeser.verify(data, antwort) !== true) {
      meldungen.push(`eigene Gegenprobe lehnt eine vom Spiel akzeptierte Antwort ab: ${JSON.stringify(data, ersatz).slice(0, 200)}`);
      continue;
    }

    // ... und eine kaputte Antwort ablehnen.
    const falsch = falscheAntwort(typ, antwort);
    if (falsch !== null && falsch !== undefined) {
      let eigen;
      try {
        eigen = loeser.verify(data, falsch) === true;
      } catch (e) {
        eigen = false;
      }
      const spielSagt = wieImSpiel(def, state, falsch);
      if (!spielSagt.ok) {
        // Nur wenn das Spiel die Antwort wirklich ablehnt, ist die Probe
        // aussagekraeftig. Und nur dann darf sie mitgezaehlt werden.
        if (spielSagt.grund !== "solver sagt falsch") formfehler++;
        else echteGegenproben++;
        if (eigen) {
          meldungen.push(
            `Gegenprobe winkt eine falsche Antwort durch: ${JSON.stringify(data, ersatz).slice(0, 150)} -> ${JSON.stringify(falsch, ersatz).slice(0, 150)}`,
          );
        }
      }
    }
  }

  // Eine Gegenprobe, die das Spiel selbst nie ablehnt, prueft nichts. Das
  // muss sichtbar sein, sonst sieht eine wirkungslose Pruefung gruen aus.
  if (echteGegenproben === 0 && faelle > 3) {
    meldungen.push(
      `Gegenprobe wirkungslos: keine einzige Probe wurde vom SOLVER des Spiels abgelehnt (${formfehler}x nur am Format gescheitert)`,
    );
  }

  gesamtFaelle += faelle;
  if (meldungen.length) {
    fehler++;
    zeilen.push(["ROT", typ, faelle + " Faelle | " + meldungen.slice(0, 3).join(" | ")]);
  } else {
    zeilen.push(["gruen", typ, faelle + " Faelle, " + echteGegenproben + " echte Gegenproben"]);
  }
}

function ersatz(schluessel, wert) {
  return typeof wert === "bigint" ? String(wert) : wert;
}

// ===========================================================================
// Die Waechter. Sie loesen bei v3.0.1 nie aus - genau deshalb fasst die
// Zufallspruefung oben sie nie an, und sie waeren ungetesteter Code an
// der Stelle, an der er im Ernstfall gebraucht wird. Zwei Forderungen:
// (1) kein Waechter darf bei entarteter Eingabe WERFEN statt abzulehnen,
// (2) kein Waechter darf eine entartete Eingabe durchwinken.
// ===========================================================================
// Werte, die bei KEINEM Typ eine gueltige Aufgabe sein koennen - falsche
// Form oder so gross, dass das Spielfenster stehenbliebe. Ein kleiner Wert
// der RICHTIGEN Form (etwa "x" bei einem Zeichenketten-Typ) steht bewusst
// nicht darin: den darf ein Waechter durchlassen, er ist ungefaehrlich.
const ENTARTET = [
  undefined,
  null,
  NaN,
  true,
  {},
  [],
  [null],
  1e15,
  // Keine mittelgrossen Zeichenketten hier: 400 Zeichen sind fuer einen
  // Zeichenketten-Typ die RICHTIGE Form und harmlos (Compression III
  // braucht dafuer 14 ms). Nur das, was wirklich stehenbliebe.
  "a".repeat(200000),
  [1e12, 1e12],
  [1e9, Array.from({ length: 40000 }, (_, i) => i + 1)],
];

let waechterFehler = 0;
for (const [typ, loeser] of Object.entries(SOLVERS)) {
  if (!loeser.guard) continue;
  for (const eingabe of ENTARTET) {
    let ergebnis;
    try {
      ergebnis = loeser.guard(eingabe);
    } catch (e) {
      console.log(` FEHL  ${typ}  Waechter WIRFT bei ${JSON.stringify(eingabe) ?? String(eingabe)}: ${e.message}`);
      waechterFehler++;
      continue;
    }
    if (ergebnis === null) {
      console.log(` FEHL  ${typ}  Waechter winkt ${JSON.stringify(eingabe) ?? String(eingabe)} durch`);
      waechterFehler++;
    }
  }
}
if (waechterFehler) fehler += waechterFehler;

// --- Ausgabe --------------------------------------------------------------
const breite = Math.max(...alleTypen.map((t) => t.length));
for (const [zustand, typ, text] of zeilen) {
  console.log(`${zustand === "gruen" ? "  ok  " : " FEHL "} ${typ.padEnd(breite)}  ${text}`);
}

// Loeser, fuer die es im Spiel gar keinen Typ (mehr) gibt - Hinweis auf eine
// veraltete Uebertragung.
for (const typ of Object.keys(SOLVERS)) {
  if (!spiel[typ]) {
    console.log(` FEHL  ${typ.padEnd(breite)}  Loeser vorhanden, aber das Spiel kennt diesen Typ nicht`);
    fehler++;
  }
}

console.log("");
console.log(
  `${alleTypen.length} Typen, ${gesamtFaelle} Faelle, ${fehler} mit Befund` +
    (fehler === 0 ? " - alles gruen." : " - NICHT scharf schalten."),
);
process.exit(fehler === 0 ? 0 : 1);
