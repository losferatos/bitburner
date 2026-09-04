/**
 * Die Vertragsgeneratoren des Spiels, nachgebaut.
 *
 * ===========================================================================
 * WARUM DAS NOETIG WURDE (Skeptiker Runde 4, R6 und R7, 04.09.2026)
 * ===========================================================================
 *
 * `tools/test-loeser-verify.js` hatte handgetippte Beispieleingaben. Ein
 * Pruefer hat nachgerechnet, was das wert ist:
 *
 *   - `Total Number of Primes`: die Gegenprobe hatte einen Kurzschluss
 *     `if (hi - lo > 60000) return true`. Das Spiel erzeugt Spannen von
 *     MINDESTENS 100.000 (`TotalPrimesInRange.ts:20-22`) - der Kurzschluss
 *     griff also bei hundert Prozent der echten Vertraege, und die Gegenprobe
 *     nahm sechs von sechs Muellantworten an. Die Testeingaben `[100,200]` und
 *     `[2,1000]` sind Spannen, die das Spiel NIE stellt.
 *
 *   - `Find All Valid Math Expressions`: derselbe Fehler bei
 *     `ziffern.length > 10`. Das Spiel erzeugt 4 bis 12 Ziffern; bei 11 und 12
 *     nahm die Probe sogar die leere Liste an. Getestet wurde mit drei Ziffern.
 *
 * Beide Male war die Probe formal gruen und praktisch blind. Die Ursache ist
 * dieselbe: **eine erfundene Eingabe prueft eine erfundene Welt.**
 *
 * ===========================================================================
 * WAS HIER STEHT
 * ===========================================================================
 *
 * Je Vertragstyp eine Funktion, die eine Eingabe erzeugt wie das Spiel - mit
 * denselben Spannen, denselben Wahrscheinlichkeiten, derselben Struktur. Die
 * Fundstelle steht als Kommentar dabei; wer eine Zahl aendert, muss sie dort
 * belegen.
 *
 * NICHT nachgebaut ist die Loesung. Wer hier auch die Antwort erzeugte, haette
 * wieder eine Tautologie - nur eine groessere.
 *
 * ===========================================================================
 * DER ZUFALL IST STEUERBAR
 * ===========================================================================
 *
 * `neuerZufall(saat)` liefert einen deterministischen Generator. Ein
 * fehlgeschlagener Testlauf laesst sich damit exakt wiederholen, und die Suite
 * bleibt reproduzierbar - ein Test, der bei jedem Lauf andere Faelle prueft,
 * ist ein Test, dessen Gruen nichts bedeutet.
 */

/** Deterministischer Zufall (mulberry32). Dieselbe Saat, dieselbe Folge. */
export function neuerZufall(saat = 1) {
  let a = saat >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `getRandomIntInclusive` des Spiels (`utils/helpers/getRandomIntInclusive.ts`). */
function ganz(r, min, max) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(r() * (hi - lo + 1)) + lo;
}

// ---------------------------------------------------------------------------
// Kompressionshelfer (Compression.ts:166-199)
// ---------------------------------------------------------------------------
function genChar(r) {
  const x = r();
  if (x < 0.4) return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(26 * r())];
  if (x < 0.8) return "abcdefghijklmnopqrstuvwxyz"[Math.floor(26 * r())];
  return "01234567689"[Math.floor(10 * r())];
}

function lzGenerate(r) {
  const laenge = 50 + Math.floor(25 * (r() + r()));
  let klar = "";
  let schutz = 0;
  while (klar.length < laenge && schutz++ < 10000) {
    if (r() < 0.8) {
      klar += genChar(r);
    } else {
      const n = 1 + Math.floor(9 * r());
      const abstand = 1 + Math.floor(9 * r());
      if (abstand > klar.length) continue;
      for (let i = 0; i < n; ++i) klar += klar[klar.length - abstand];
    }
  }
  return klar.substring(0, laenge);
}

const WOERTER = ["ARRAY", "CACHE", "CLOUD", "DEBUG", "EMAIL", "ENTER", "FLASH",
  "FRAME", "INBOX", "LINUX", "LOGIC", "LOGIN", "MACRO", "MEDIA", "MODEM",
  "MOUSE", "PASTE", "POPUP", "PRINT", "QUEUE", "SHELL", "SHIFT", "TABLE",
  "TRASH", "VIRUS"];

const SCHLUESSEL = ["ALGORITHM", "BANDWIDTH", "BLOGGER", "BOOKMARK", "BROADBAND",
  "BROWSER", "CAPTCHA", "CLIPBOARD", "COMPUTING", "COMMAND", "COMPILE",
  "COMPRESS", "COMPUTER", "CONFIGURE", "DASHBOARD", "DATABASE", "DESKTOP",
  "DIGITAL", "DOCUMENT", "DOWNLOAD", "DYNAMIC"];

/**
 * `HammingEncodeProperly` aus HammingCode.ts:154-216 - der Kodierer, mit dem
 * das Spiel die Eingaben fuer "Encoded Binary to Integer" erzeugt.
 *
 * Er ist NICHT derselbe wie der Loeser fuer "Integer to Encoded Binary": die
 * Blocklaenge ist hier immer eine Zweierpotenz `n = 2^m`, und die Datenbits
 * werden von hinten gefuellt. Dadurch stehen fuehrende Nullen im Datenteil,
 * und genau die sind der interessante Fall.
 */
function hammingProperly(data) {
  let m = 1;
  while (2 ** (2 ** m - m - 1) - 1 < data) m++;
  const n = 2 ** m;
  const k = 2 ** m - m - 1;
  const enc = [0];
  const bits = String(data).length && Number.isSafeInteger(data)
    ? data.toString(2).split("").reverse().map(Number)
    : [];
  for (let i = 1, j = k; i < n; i++) {
    if ((i & (i - 1)) !== 0) enc[i] = bits[--j] ? bits[j] : 0;
  }
  let p = 0;
  for (let i = 0; i < n; i++) if (enc[i]) p ^= i;
  const pArr = p.toString(2).split("").reverse().map(Number);
  for (let i = 0; i < m; i++) enc[2 ** i] = pArr[i] ? 1 : 0;
  p = 0;
  for (let i = 0; i < n; i++) if (enc[i]) p++;
  enc[0] = p % 2 === 0 ? 0 : 1;
  return enc.join("");
}

function fuenfWoerter(r) {
  const kopie = [...WOERTER].sort(() => r() - 0.5);
  return kopie.slice(0, 5).join(" ");
}

// ---------------------------------------------------------------------------
// Die Generatoren. Schluessel exakt wie in CodingContract/Enums.ts.
// ---------------------------------------------------------------------------
/**
 * Der Typ mit dem Akzentzeichen im Namen - aus dem Enum des Spiels, nicht
 * getippt. `Enums.ts:28` schreibt ihn mit Accent grave.
 */
export const NAME_VIGENERE = "Encryption II: Vigenère Cipher";

export const GENERATOREN = {
  // FindLargestPrimeFactor.ts:13
  "Find Largest Prime Factor": (r) => ganz(r, 500, 1e9),

  // SubarrayWithMaximumSum.ts:16
  "Subarray with Maximum Sum": (r) => {
    const n = ganz(r, 5, 40);
    return Array.from({ length: n }, () => ganz(r, -10, 10));
  },

  // TotalWaysToSum.ts:22
  "Total Ways to Sum": (r) => ganz(r, 8, 100),

  // TotalWaysToSum.ts:56
  "Total Ways to Sum II": (r) => {
    const n = ganz(r, 12, 200);
    const maxLen = ganz(r, 8, 12);
    const s = [];
    for (let i = 1; i <= n; i++) {
      if (s.length === maxLen) break;
      if (r() < 0.6 || n - i < maxLen - s.length) s.push(i);
    }
    return [n, s];
  },

  // SpiralizeMatrix.ts:41
  "Spiralize Matrix": (r) => {
    const m = ganz(r, 1, 15);
    const n = ganz(r, 1, 15);
    return Array.from({ length: m }, () =>
      Array.from({ length: n }, () => ganz(r, 1, 50)));
  },

  // ArrayJumpingGame.ts:25 - 20 % Nullen
  "Array Jumping Game": (r) => {
    const n = ganz(r, 3, 25);
    return Array.from({ length: n }, () => (r() < 0.2 ? 0 : ganz(r, 0, 10)));
  },

  // ArrayJumpingGame.ts:75 - andere Verteilung als I
  "Array Jumping Game II": (r) => {
    const n = ganz(r, 3, 25);
    const arr = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 10; j++) {
        if (r() <= j / 10 + 0.1) { arr[i] = j; break; }
      }
    }
    return arr;
  },

  // MergeOverlappingIntervals.ts:22
  "Merge Overlapping Intervals": (r) => {
    const n = ganz(r, 3, 20);
    return Array.from({ length: n }, () => {
      const start = ganz(r, 1, 25);
      return [start, start + ganz(r, 1, 10)];
    });
  },

  // GenerateIPAddresses.ts:22 - vier Zahlen 0..255, aneinandergehaengt
  "Generate IP Addresses": (r) => {
    let s = "";
    for (let i = 0; i < 4; ++i) s += String(ganz(r, 0, 255));
    return s;
  },

  // AlgorithmicStockTrader.ts:25 / :66 / :105 - dieselbe Form
  "Algorithmic Stock Trader I": (r) =>
    Array.from({ length: ganz(r, 3, 50) }, () => ganz(r, 1, 200)),
  "Algorithmic Stock Trader II": (r) =>
    Array.from({ length: ganz(r, 3, 50) }, () => ganz(r, 1, 200)),
  "Algorithmic Stock Trader III": (r) =>
    Array.from({ length: ganz(r, 3, 50) }, () => ganz(r, 1, 200)),

  // AlgorithmicStockTrader.ts:154
  "Algorithmic Stock Trader IV": (r) => {
    const k = ganz(r, 2, 10);
    const n = ganz(r, 3, 50);
    return [k, Array.from({ length: n }, () => ganz(r, 1, 200))];
  },

  // MinimumPathSumInATriangle.ts:44
  "Minimum Path Sum in a Triangle": (r) => {
    const stufen = ganz(r, 3, 12);
    return Array.from({ length: stufen }, (_, zeile) =>
      Array.from({ length: zeile + 1 }, () => ganz(r, 1, 9)));
  },

  // UniquePathsInAGrid.ts:26
  "Unique Paths in a Grid I": (r) => [ganz(r, 2, 14), ganz(r, 2, 14)],

  // UniquePathsInAGrid.ts:73 - 15 % Hindernisse, Start und Ziel frei
  "Unique Paths in a Grid II": (r) => {
    const h = ganz(r, 2, 12);
    const b = ganz(r, 2, 12);
    const g = Array.from({ length: h }, () => new Array(b).fill(0));
    for (let i = 0; i < h; ++i) {
      for (let j = 0; j < b; ++j) {
        if (i === 0 && j === 0) continue;
        if (i === h - 1 && j === b - 1) continue;
        if (r() < 0.15) g[i][j] = 1;
      }
    }
    return g;
  },

  // ShortestPathInAGrid.ts:31 - Hindernisdichte waechst zur Mitte hin
  "Shortest Path in a Grid": (r) => {
    const h = ganz(r, 6, 12);
    const b = ganz(r, 6, 12);
    const zy = h - 1;
    const zx = b - 1;
    const minLaenge = zy + zx;
    const g = Array.from({ length: h }, () => new Array(b).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < b; x++) {
        if (y === 0 && x === 0) continue;
        if (y === zy && x === zx) continue;
        const faktor = (Math.min(y + x, zy - y + zx - x) / minLaenge) * 0.8;
        if (r() < Math.max(0.15, faktor)) g[y][x] = 1;
      }
    }
    return g;
  },

  // SanitizeParenthesesInExpression.ts:28
  "Sanitize Parentheses in Expression": (r) => {
    const n = ganz(r, 6, 20);
    const z = new Array(n);
    z[0] = r() < 0.8 ? "(" : ")";
    for (let i = 1; i < n; ++i) {
      const w = r();
      z[i] = w < 0.4 ? "(" : (w < 0.8 ? ")" : "a");
    }
    return z.join("");
  },

  // FindAllValidMathExpressions.ts:33 - VIER BIS ZWOELF Ziffern
  "Find All Valid Math Expressions": (r) => {
    const n = ganz(r, 4, 12);
    let s = String(ganz(r, 1, 9));
    for (let i = 1; i < n; ++i) s += String(ganz(r, 0, 9));
    return [s, ganz(r, -100, 100)];
  },

  // HammingCode.ts:34 - 2^4 bis 2^(1..57)
  "HammingCodes: Integer to Encoded Binary": (r) => {
    const x = 2 ** 4;
    const y = 2 ** ganz(r, 1, 57);
    return ganz(r, Math.min(x, y), Math.max(x, y));
  },

  // HammingCode.ts:76 - kodieren, dann in der Haelfte der Faelle ein Bit kippen.
  //
  // DAS SPIEL BENUTZT HIER EINEN ANDEREN KODIERER (Skeptiker Runde 4,
  // Substanz-Befund 3, 04.09.2026). `HammingEncodeProperly` (HammingCode.ts:154)
  // waehlt die Blocklaenge als Zweierpotenz `n = 2^m` und fuellt die Datenbits
  // von hinten - `HammingEncode` (der Loeser fuer den anderen Typ) nimmt die
  // kuerzeste Laenge und fuellt vorwaerts.
  //
  // Gemessen ueber je 3.000 Instanzen: das Spiel erzeugt Wortlaengen 8, 16, 32
  // und 64, mit einer fuehrenden Null im Datenteil in 91,8 % der Faelle. Der
  // erste Anlauf dieses Generators erzeugte 56 verschiedene Laengen und die
  // fuehrende Null in 2,3 %. Genau dieser Fall ist es aber, fuer den die
  // Gegenprobe eigens geschrieben wurde - sie wurde also in einem
  // Vierzigstel der Faelle geprueft, in denen sie zaehlt.
  "HammingCodes: Encoded Binary to Integer": (r) => {
    const x = 2 ** 4;
    const y = 2 ** ganz(r, 1, 57);
    const zahl = ganz(r, Math.min(x, y), Math.max(x, y));
    const wort = hammingProperly(zahl).split("");
    if (Math.round(r())) {
      const i = ganz(r, 0, wort.length - 1);
      wort[i] = wort[i] === "0" ? "1" : "0";
    }
    return wort.join("");
  },

  // Proper2ColoringOfAGraph.ts:31 - bipartit, plus eine Zufallskante
  "Proper 2-Coloring of a Graph": (r) => {
    const n = Math.floor(r() * 5) + 3;
    const m = Math.floor(r() * 5) + 3;
    const kanten = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) if (r() > 0.5) kanten.push([i, n + j]);
    }
    let a = Math.floor(r() * (n + m));
    let b = Math.floor(r() * (n + m));
    if (a > b) [a, b] = [b, a];
    if (a !== b) kanten.push([a, b]);
    const misch = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    };
    const tausch = Array.from(Array(n + m).keys());
    misch(tausch);
    for (let i = 0; i < kanten.length; i++) {
      kanten[i] = [tausch[kanten[i][0]], tausch[kanten[i][1]]];
      if (kanten[i][0] > kanten[i][1]) {
        [kanten[i][0], kanten[i][1]] = [kanten[i][1], kanten[i][0]];
      }
    }
    misch(kanten);
    return [n + m, kanten];
  },

  // Compression.ts:29 - Laeufe von 1 bis 15 gleicher Zeichen
  "Compression I: RLE Compression": (r) => {
    const laenge = 50 + Math.floor(25 * (r() + r()));
    let klar = "";
    while (klar.length < laenge) {
      const x = r();
      let n = 1;
      if (x < 0.3) n = 1;
      else if (x < 0.6) n = 2;
      else if (x < 0.9) n = Math.floor(10 * r());
      else n = 10 + Math.floor(5 * r());
      klar += genChar(r).repeat(n);
    }
    return klar.substring(0, laenge);
  },

  // Compression.ts:101 - der PACKER des Loesers erzeugt die Eingabe.
  "Compression II: LZ Decompression": (r, SOLVERS) =>
    SOLVERS["Compression III: LZ Compression"].solve(lzGenerate(r)),

  // Compression.ts:142
  "Compression III: LZ Compression": (r) => lzGenerate(r),

  // Encryption.ts:23 - fuenf Woerter, Verschiebung 1..25
  "Encryption I: Caesar Cipher": (r) => [fuenfWoerter(r), Math.floor(r() * 25 + 1)],

  // Encryption.ts:103
  //
  // DER NAME WIRD NICHT GETIPPT (Skeptiker Runde 4, Substanz-Befund 2).
  // Er enthaelt ein Akzentzeichen, und beim ersten Anlauf stand er hier ohne -
  // der Typ wurde dann in der Pruefschleife still uebersprungen
  // (`if (!l) continue`). Auffallen konnte das nur an der Arithmetik: 348
  // Instanzen sind 29 x 12, nicht 30 x 12. Genau die Falle, vor der der
  // Kommentar im Test warnt.
  [NAME_VIGENERE]: (r) =>
    [fuenfWoerter(r), SCHLUESSEL[Math.floor(r() * SCHLUESSEL.length)]],

  // TotalPrimesInRange.ts:17 - DIE SPANNE IST IMMER >= 100.000
  "Total Number of Primes": (r) => {
    const lo = ganz(r, 0, 5e6);
    return [lo, lo + ganz(r, 1e5, 1e6)];
  },

  // SquareRoot.ts:16 - 200 bis 201 Stellen, BigInt
  "Square Root": (r) => {
    const haelfte = 2n ** 332n;
    let bits = 0n;
    for (let i = 0; i < 332; i++) bits = (bits << 1n) | (r() < 0.5 ? 0n : 1n);
    const wurzel = bits + haelfte;
    let versatz;
    if (r() >= 0.5) versatz = r() >= 0.5 ? wurzel : 1n - wurzel;
    else {
      let v = 0n;
      const spanne = wurzel + wurzel;
      for (let i = 0; i < 334; i++) v = (v << 1n) | (r() < 0.5 ? 0n : 1n);
      versatz = (v % spanne) + 1n - wurzel;
    }
    return wurzel * wurzel + versatz;
  },

  // LargestRectangle.ts:43 - 15 % Hindernisse, nie alles Einsen
  "Largest Rectangle in a Matrix": (r) => {
    const h = ganz(r, 4, 15);
    const b = ganz(r, 4, 15);
    let g;
    let allesEins;
    let schutz = 0;
    do {
      allesEins = true;
      g = Array.from({ length: h }, () => new Array(b).fill(0));
      for (let i = 0; i < h; ++i) {
        for (let j = 0; j < b; ++j) {
          if (r() < 0.15) g[i][j] = 1; else allesEins = false;
        }
      }
    } while (allesEins && schutz++ < 100);
    return g;
  },
};

/**
 * Eine Reihe von Instanzen je Typ.
 *
 * @param {object} SOLVERS die Loesertabelle (zwei Generatoren brauchen sie,
 *   um ihre EINGABE zu bauen - nicht ihre Antwort)
 * @param {number} anzahl Instanzen je Typ
 * @param {number} saat fuer die Wiederholbarkeit
 */
export function erzeuge(SOLVERS, anzahl = 20, saat = 20260904) {
  const r = neuerZufall(saat);
  const raus = {};
  for (const [name, f] of Object.entries(GENERATOREN)) {
    raus[name] = [];
    for (let i = 0; i < anzahl; i++) {
      try { raus[name].push(f(r, SOLVERS)); }
      catch (e) { raus[name].push({ generatorFehler: String(e && e.message) }); }
    }
  }
  return raus;
}
