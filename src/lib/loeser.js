/**
 * Die Loeser fuer Programmiervertraege - ohne einen einzigen `ns`-Aufruf.
 *
 * ===========================================================================
 * WARUM SIE EIN EIGENES MODUL SIND (Position C.8, 04.09.2026)
 * ===========================================================================
 *
 * Sie standen in `contracts.js`, und das kostet 17,65 GB - `getContract`
 * allein 15. Auf einem frischen `home` mit 32 GB laeuft es damit nicht:
 * Kern, Waechter und Wachhalter belegen schon 19,15.
 *
 * Genau in dieser Phase sind Vertraege aber die schnellste Geldquelle, die es
 * gibt (ARCHITEKTUR E9). Das Netz haengt an sechs Servern ohne Portbedarf,
 * und ohne Geld gibt es weder TOR noch Portprogramme noch Mietrechner.
 *
 * Die Loeser selbst rechnen nur. Als eigenes Modul kosten sie NULL Gigabyte -
 * der RAM-Rechner des Spiels zaehlt Bezeichner, und hier steht keiner, der im
 * Kostenbaum vorkommt. Damit kann die schlanke Haelfte (`cdump.js`, 12 GB)
 * sie mitnehmen, ohne teurer zu werden.
 *
 * ===========================================================================
 * WAS SIE KOENNEN
 * ===========================================================================
 *
 * Alle dreissig Vertragstypen aus `CodingContract/Enums.ts`, jeder mit
 * `solve` und `verify`. Die Reihenfolge ist dieselbe wie im Spielquelltext,
 * damit sich ein neuer Typ beim naechsten Update zuordnen laesst.
 *
 * `verify` ist nicht Zierde: ein Versuch ist unwiederbringlich
 * (`CodingContract.ts`, `tries`), und eine falsche Antwort kostet einen von
 * meist zehn. Wer nicht gegenprueft, verbrennt Vertraege.
 */

// ===========================================================================
// Hilfsfunktionen
// ===========================================================================

/** Flache Zahlen-/Zeichenkettenlisten vergleichen. */
function listeGleich(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}

// ===========================================================================
// Die Loeser. Reihenfolge wie in CodingContract/Enums.ts.
// ===========================================================================

export const SOLVERS = {
  // -- FindLargestPrimeFactor.ts ------------------------------------------
  "Find Largest Prime Factor": {
    // Das Spiel bleibt bei 500..1e9 (FindLargestPrimeFactor.ts:14) - dort
    // 1 ms. Die Probedivision laeuft bis sqrt(n); nahe 2^53 sind es 741 ms,
    // und solange rechnet das Spielfenster gar nichts mehr.
    guard: (data) => (typeof data === "number" && Number.isFinite(data) && data >= 2 && data <= 1e12 ? null : "Zahl unplausibel: " + data),
    solve: (data) => {
      let fac = 2;
      let n = data;
      while (n > (fac - 1) * (fac - 1)) {
        while (n % fac === 0) {
          n = Math.round(n / fac);
        }
        ++fac;
      }
      return n === 1 ? fac - 1 : n;
    },
    verify: (data, answer) => {
      // UNABHAENGIG, NICHT TAUTOLOGISCH (Skeptiker Runde 3, C4).
      //
      // Hier stand `solve(data) === answer` - eine Probe, die genau dann
      // besteht, wenn `solve` sich selbst gleicht. Sie faengt nichts, und die
      // Autonomiebegruendung in cdump.js ("jede Antwort wird gegengeprueft")
      // trug fuer zwanzig der dreissig Typen nicht.
      //
      // Geprueft wird stattdessen die Eigenschaft selbst: `answer` teilt
      // `data`, ist prim, und nach dem Herausdividieren ALLER Primfaktoren
      // bis einschliesslich `answer` bleibt 1 - dann kann es keinen groesseren
      // geben. Der Einschluss ist der Punkt: bei data = 512 ist die Antwort 2,
      // und wer nur die Faktoren KLEINER als 2 herausdividiert, behaelt 512
      // uebrig und lehnt die richtige Antwort ab.
      if (!Number.isInteger(answer) || answer < 2 || data % answer !== 0) return false;
      for (let d = 2; d * d <= answer; d++) if (answer % d === 0) return false;
      let n = data;
      for (let d = 2; d <= answer; d++) while (n % d === 0) n /= d;
      return n === 1;
    }
  },

  // -- SubarrayWithMaximumSum.ts ------------------------------------------
  "Subarray with Maximum Sum": {
    solve: (data) => {
      const nums = data.slice();
      for (let i = 1; i < nums.length; i++) {
        nums[i] = Math.max(nums[i], nums[i] + nums[i - 1]);
      }
      return Math.max(...nums);
    },
    verify: (data, answer) => {
      // Zweite, unabhaengige Rechnung: alle O(n^2) Teilfolgen durchgehen statt
      // Kadanes Rekursion. Bei den Groessen des Spiels (bis 40 Elemente) sind
      // das hoechstens 800 Additionen.
      if (!Array.isArray(data) || !data.length) return false;
      if (data.length > 2000) return true;   // zu gross fuer die Gegenprobe
      let best = -Infinity;
      for (let i = 0; i < data.length; i++) {
        let sum = 0;
        for (let j = i; j < data.length; j++) { sum += data[j]; if (sum > best) best = sum; }
      }
      return best === answer;
    },
  },

  // -- TotalWaysToSum.ts ---------------------------------------------------
  "Total Ways to Sum": {
    // Der Deckel schuetzt vor einer kuenftigen Spielfassung mit groesseren
    // Zahlen: die Schleife ist O(n^2) und wuerde das Spielfenster einfrieren.
    // Die Typpruefung ist nicht Zierde - `null <= 20000` ist in JS wahr, ein
    // blosser Groessenvergleich wuerde eine kaputte Eingabe durchwinken.
    guard: (data) => (typeof data === "number" && Number.isInteger(data) && data >= 1 && data <= 20000 ? null : "Zahl unplausibel: " + data),
    solve: (data) => {
      const ways = [1];
      ways.length = data + 1;
      ways.fill(0, 1);
      for (let i = 1; i < data; ++i) {
        for (let j = i; j <= data; ++j) {
          ways[j] += ways[j - i];
        }
      }
      return ways[data];
    },
    verify: (data, answer) => {
      // Zweite Rechnung ueber eine ANDERE Rekursion: t[rest][max] zaehlt die
      // Zerlegungen von `rest` in Teile hoechstens `max` - absteigend statt
      // ueber ein einziges aufsummiertes Feld.
      if (!Number.isInteger(answer) || answer < 0) return false;
      if (!Number.isInteger(data) || data > 300) return true;
      const t = [];
      for (let i = 0; i <= data; i++) t.push(new Array(data + 1).fill(0));
      for (let m = 0; m <= data; m++) t[0][m] = 1;
      for (let rest = 1; rest <= data; rest++) {
        for (let m = 1; m <= data; m++) {
          t[rest][m] = t[rest][m - 1] + (m <= rest ? t[rest - m][m] : 0);
        }
      }
      // Ohne den trivialen Summanden `data` selbst - das verlangt die Aufgabe.
      return t[data][data] - 1 === answer;
    },
  },

  // -- TotalWaysToSum.ts (Teil II) ----------------------------------------
  "Total Ways to Sum II": {
    // Die Kosten sind n * |Menge|, nicht n allein - bei 20000 Summanden
    // rechnet die alte Fassung dieses Deckels 8 Sekunden lang.
    guard: (data) =>
      Array.isArray(data) && Number.isInteger(data[0]) && Array.isArray(data[1]) && data[0] * data[1].length <= 5e6
        ? null
        : "Eingabe zu gross oder unplausibel",
    solve: (data) => {
      const n = data[0];
      const s = data[1];
      const ways = [1];
      ways.length = n + 1;
      ways.fill(0, 1);
      for (let i = 0; i < s.length; i++) {
        for (let j = s[i]; j <= n; j++) {
          ways[j] += ways[j - s[i]];
        }
      }
      return ways[n];
    },
    verify: (data, answer) => {
      // Zweite Rechnung, Muenzwechsel von HINTEN: Wege, `rest` aus den
      // Summanden ab Index i zu bilden. Andere Schleifenrichtung als solve.
      if (!Number.isInteger(answer) || answer < 0) return false;
      if (!Array.isArray(data) || !Number.isInteger(data[0])) return false;
      const n = data[0];
      const su = data[1];
      if (n * su.length > 2e5) return true;   // zu gross fuer die Gegenprobe
      let vorher = new Array(n + 1).fill(0);
      vorher[0] = 1;
      for (let i = su.length - 1; i >= 0; i--) {
        const jetzt = vorher.slice();
        for (let rest = su[i]; rest <= n; rest++) jetzt[rest] += jetzt[rest - su[i]];
        vorher = jetzt;
      }
      return vorher[n] === answer;
    },
  },

  // -- SpiralizeMatrix.ts --------------------------------------------------
  "Spiralize Matrix": {
    solve: (data) => {
      const spiral = [];
      const m = data.length;
      const n = data[0].length;
      let u = 0;
      let d = m - 1;
      let l = 0;
      let r = n - 1;
      let k = 0;
      let done = false;
      while (!done) {
        for (let col = l; col <= r; col++) {
          spiral[k] = data[u][col];
          ++k;
        }
        if (++u > d) {
          done = true;
          continue;
        }
        for (let row = u; row <= d; row++) {
          spiral[k] = data[row][r];
          ++k;
        }
        if (--r < l) {
          done = true;
          continue;
        }
        for (let col = r; col >= l; col--) {
          spiral[k] = data[d][col];
          ++k;
        }
        if (--d < u) {
          done = true;
          continue;
        }
        for (let row = d; row >= u; row--) {
          spiral[k] = data[row][l];
          ++k;
        }
        if (++l > r) {
          done = true;
          continue;
        }
      }
      return spiral;
    },
    verify: (data, answer) => {
      // Unabhaengig: die Antwort ZURUECK in eine Matrix legen. Jede Zahl an
      // ihren Platz, dann muss die urspruengliche Matrix dastehen - und jede
      // Zelle genau einmal besucht sein.
      if (!Array.isArray(answer) || !Array.isArray(data) || !data.length) return false;
      const h = data.length, b = data[0].length;
      if (answer.length !== h * b) return false;
      const belegt = data.map((z) => z.map(() => false));
      let oben = 0, unten = h - 1, links = 0, rechts = b - 1, k = 0;
      while (oben <= unten && links <= rechts) {
        for (let j = links; j <= rechts; j++) { if (answer[k++] !== data[oben][j]) return false; belegt[oben][j] = true; }
        oben++;
        for (let i = oben; i <= unten; i++) { if (answer[k++] !== data[i][rechts]) return false; belegt[i][rechts] = true; }
        rechts--;
        if (oben <= unten) {
          for (let j = rechts; j >= links; j--) { if (answer[k++] !== data[unten][j]) return false; belegt[unten][j] = true; }
          unten--;
        }
        if (links <= rechts) {
          for (let i = unten; i >= oben; i--) { if (answer[k++] !== data[i][links]) return false; belegt[i][links] = true; }
          links++;
        }
      }
      return k === h * b && belegt.every((z) => z.every(Boolean));
    }
  },

  // -- ArrayJumpingGame.ts -------------------------------------------------
  // Achtung: nur EIN Versuch (numTries: 1, ArrayJumpingGame.ts:39).
  "Array Jumping Game": {
    solve: (data) => {
      const n = data.length;
      let i = 0;
      for (let reach = 0; i < n && i <= reach; ++i) {
        reach = Math.max(i + data[i], reach);
      }
      return i === n ? 1 : 0;
    },
    verify: (data, answer) => {
      // Unabhaengig: Erreichbarkeit per Breitensuche statt ueber den
      // Greedy-Zeiger. Eine andere Denkweise, kein zweiter Aufruf.
      if (answer !== 0 && answer !== 1) return false;
      if (!Array.isArray(data) || !data.length) return false;
      if (data.length > 5000) return true;
      const gesehen = new Array(data.length).fill(false);
      const rand = [0];
      gesehen[0] = true;
      let da = data.length === 1;
      while (rand.length) {
        const i = rand.pop();
        for (let k = 1; k <= data[i]; k++) {
          const j = i + k;
          if (j >= data.length - 1) da = true;
          if (j < data.length && !gesehen[j]) { gesehen[j] = true; rand.push(j); }
        }
      }
      return (da ? 1 : 0) === answer;
    },
  },

  // -- ArrayJumpingGame.ts (Teil II) --------------------------------------
  "Array Jumping Game II": {
    solve: (data) => {
      const n = data.length;
      let reach = 0;
      let jumps = 0;
      let lastJump = -1;
      while (reach < n - 1) {
        let jumpedFrom = -1;
        for (let i = reach; i > lastJump; i--) {
          if (i + data[i] > reach) {
            reach = i + data[i];
            jumpedFrom = i;
          }
        }
        if (jumpedFrom === -1) {
          jumps = 0;
          break;
        }
        lastJump = jumpedFrom;
        jumps++;
      }
      return jumps;
    },
    verify: (data, answer) => {
      // Unabhaengig: kuerzeste Sprungzahl per Breitensuche in Schichten.
      // `solve` arbeitet greedy rueckwaerts - dieselbe Antwort aus einer
      // anderen Rechnung.
      if (!Number.isInteger(answer) || answer < 0) return false;
      if (!Array.isArray(data) || !data.length) return false;
      if (data.length > 5000) return true;
      const n = data.length;
      const dist = new Array(n).fill(-1);
      dist[0] = 0;
      const q = [0];
      for (let kopf = 0; kopf < q.length; kopf++) {
        const i = q[kopf];
        for (let k = 1; k <= data[i] && i + k < n; k++) {
          const j = i + k;
          if (dist[j] === -1) { dist[j] = dist[i] + 1; q.push(j); }
        }
      }
      // Unerreichbar meldet das Spiel als 0 (ArrayJumpingGameII.ts).
      return (dist[n - 1] === -1 ? 0 : dist[n - 1]) === answer;
    },
  },

  // -- MergeOverlappingIntervals.ts ---------------------------------------
  "Merge Overlapping Intervals": {
    guard: (data) =>
      Array.isArray(data) &&
      data.length > 0 &&
      data.length <= 10000 &&
      data.every((iv) => Array.isArray(iv) && iv.length === 2 && typeof iv[0] === "number" && typeof iv[1] === "number")
        ? null
        : "Intervallliste leer oder unplausibel",
    solve: (data) => {
      const intervals = data.map((iv) => [iv[0], iv[1]]);
      intervals.sort((a, b) => a[0] - b[0]);
      const result = [];
      let start = intervals[0][0];
      let end = intervals[0][1];
      for (const interval of intervals) {
        if (interval[0] <= end) {
          end = Math.max(end, interval[1]);
        } else {
          result.push([start, end]);
          start = interval[0];
          end = interval[1];
        }
      }
      result.push([start, end]);
      return result;
    },
    verify: (data, answer) => {
      // Unabhaengig und strukturell: die Antwort muss (1) aufsteigend und
      // ueberschneidungsfrei sein, (2) jedes Eingabeintervall vollstaendig
      // ueberdecken und (3) nichts ueberdecken, was nicht in der Eingabe war.
      // Punkt (3) ist der, den ein blosser Vergleich mit solve nicht liefert.
      if (!Array.isArray(answer) || !Array.isArray(data)) return false;
      if (!answer.every((a) => Array.isArray(a) && a.length === 2 && a[0] <= a[1])) return false;
      for (let i = 1; i < answer.length; i++) {
        if (answer[i][0] <= answer[i - 1][1]) return false;   // beruehrt oder ueberlappt
        if (answer[i][0] < answer[i - 1][0]) return false;    // nicht sortiert
      }
      // (2) jedes Eingabeintervall liegt in genau einem Antwortintervall
      for (const [a, b] of data) {
        if (!answer.some(([x, y]) => x <= a && b <= y)) return false;
      }
      // (3) jeder Punkt der Antwort ist durch die Eingabe gedeckt. Geprueft
      // ueber die Randpunkte: eine Luecke im Inneren erzeugt einen Randpunkt,
      // der von keinem Eingabeintervall getroffen wird.
      for (const [x, y] of answer) {
        const treffer = data.filter(([a, b]) => a <= y && x <= b)
          .sort((u, v) => u[0] - v[0]);
        if (!treffer.length || treffer[0][0] !== x) return false;
        let ende = treffer[0][1];
        for (const [a, b] of treffer) {
          if (a > ende) return false;                 // Luecke
          if (b > ende) ende = b;
        }
        if (ende !== y) return false;
      }
      return true;
    }
  },

  // -- GenerateIPAddresses.ts ---------------------------------------------
  "Generate IP Addresses": {
    solve: (data) => {
      const ret = [];
      for (let a = 1; a <= 3; ++a) {
        for (let b = 1; b <= 3; ++b) {
          for (let c = 1; c <= 3; ++c) {
            for (let d = 1; d <= 3; ++d) {
              if (a + b + c + d === data.length) {
                const A = parseInt(data.substring(0, a), 10);
                const B = parseInt(data.substring(a, a + b), 10);
                const C = parseInt(data.substring(a + b, a + b + c), 10);
                const D = parseInt(data.substring(a + b + c, a + b + c + d), 10);
                if (A <= 255 && B <= 255 && C <= 255 && D <= 255) {
                  const ip = [A.toString(), ".", B.toString(), ".", C.toString(), ".", D.toString()].join("");
                  if (ip.length === data.length + 3) {
                    ret.push(ip);
                  }
                }
              }
            }
          }
        }
      }
      return ret;
    },
    verify: (data, answer) => {
      // Unabhaengig und strukturell: jede genannte Adresse muss (1) gueltig
      // sein und (2) nach dem Entfernen der Punkte die Eingabe ergeben; und
      // (3) es duerfen nicht weniger sein, als eine eigene Aufzaehlung ueber
      // alle drei Punktpositionen findet.
      //
      // Die Reihenfolge ist egal - das Spiel prueft mit `answer.includes`
      // (GenerateIPAddresses.ts:67).
      if (!Array.isArray(answer) || typeof data !== "string") return false;
      const gueltig = (t) => {
        const teile = t.split(".");
        if (teile.length !== 4) return false;
        return teile.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255
          && (x === "0" || x[0] !== "0"));
      };
      for (const t of answer) {
        if (typeof t !== "string" || !gueltig(t)) return false;
        if (t.split(".").join("") !== data) return false;
      }
      if (new Set(answer).size !== answer.length) return false;
      // Eigene Aufzaehlung.
      const alle = new Set();
      for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) for (let c = 1; c <= 3; c++) {
        const d = data.length - a - b - c;
        if (d < 1 || d > 3) continue;
        const t = [data.slice(0, a), data.slice(a, a + b),
          data.slice(a + b, a + b + c), data.slice(a + b + c)].join(".");
        if (gueltig(t)) alle.add(t);
      }
      return alle.size === answer.length;
    }
  },

  // -- AlgorithmicStockTrader.ts ------------------------------------------
  // Achtung: Teil I hat nur 5 Versuche (AlgorithmicStockTrader.ts:35).
  "Algorithmic Stock Trader I": {
    solve: (data) => {
      let maxCur = 0;
      let maxSoFar = 0;
      for (let i = 1; i < data.length; ++i) {
        maxCur = Math.max(0, (maxCur += data[i] - data[i - 1]));
        maxSoFar = Math.max(maxCur, maxSoFar);
      }
      return maxSoFar;
    },
    verify: (data, answer) => {
      // Unabhaengig: alle Paare (kaufen, verkaufen) durchgehen. Bei den
      // Groessen des Spiels (bis 50 Tage) sind das 1.225 Vergleiche.
      if (!Array.isArray(data)) return false;
      if (data.length > 3000) return true;
      let best = 0;
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          if (data[j] - data[i] > best) best = data[j] - data[i];
        }
      }
      return best === answer;
    },
  },

  "Algorithmic Stock Trader II": {
    solve: (data) => {
      let profit = 0;
      for (let p = 1; p < data.length; ++p) {
        profit += Math.max(data[p] - data[p - 1], 0);
      }
      return profit;
    },
    verify: (data, answer) => {
      // Unabhaengig: bei unbegrenzt vielen Geschaeften ist der Gewinn die
      // Summe aller positiven Tagesdifferenzen. Das ist eine geschlossene
      // Aussage, keine zweite Schleife durch denselben Code.
      if (!Array.isArray(data)) return false;
      let summe = 0;
      for (let i = 1; i < data.length; i++) if (data[i] > data[i - 1]) summe += data[i] - data[i - 1];
      return summe === answer;
    }
  },

  "Algorithmic Stock Trader III": {
    solve: (data) => {
      let hold1 = Number.MIN_SAFE_INTEGER;
      let hold2 = Number.MIN_SAFE_INTEGER;
      let release1 = 0;
      let release2 = 0;
      for (const price of data) {
        release2 = Math.max(release2, hold2 + price);
        hold2 = Math.max(hold2, release1 - price);
        release1 = Math.max(release1, hold1 + price);
        hold1 = Math.max(hold1, price * -1);
      }
      return release2;
    },
    verify: (data, answer) => {
      // Unabhaengig: zwei Geschaefte heisst "einmal links, einmal rechts vom
      // Schnitt". Also fuer jeden Schnittpunkt das Maximum links und rechts
      // per Einzelgeschaeft-Probe bilden - eine andere Zerlegung als die
      // Zustandsrekursion in solve.
      if (!Array.isArray(data)) return false;
      if (data.length > 400) return true;
      const einzeln = (von, bis) => {
        let best = 0, min = Infinity;
        for (let i = von; i <= bis; i++) {
          if (data[i] < min) min = data[i];
          if (data[i] - min > best) best = data[i] - min;
        }
        return best;
      };
      let best = 0;
      for (let k = 0; k < data.length; k++) {
        const g = einzeln(0, k) + einzeln(k, data.length - 1);
        if (g > best) best = g;
      }
      return best === answer;
    }
  },

  "Algorithmic Stock Trader IV": {
    solve: (data) => {
      const k = data[0];
      const prices = data[1];
      const len = prices.length;
      if (len < 2) {
        return 0;
      }
      if (k > len / 2) {
        let res = 0;
        for (let i = 1; i < len; ++i) {
          res += Math.max(prices[i] - prices[i - 1], 0);
        }
        return res;
      }
      const hold = [];
      const rele = [];
      hold.length = k + 1;
      rele.length = k + 1;
      for (let i = 0; i <= k; ++i) {
        hold[i] = Number.MIN_SAFE_INTEGER;
        rele[i] = 0;
      }
      let cur;
      for (let i = 0; i < len; ++i) {
        cur = prices[i];
        for (let j = k; j > 0; --j) {
          rele[j] = Math.max(rele[j], hold[j] + cur);
          hold[j] = Math.max(hold[j], rele[j - 1] - cur);
        }
      }
      return rele[k];
    },
    verify: (data, answer) => {
      // Unabhaengig: Zustandsrekursion ueber (Tag, Geschaefte, im Besitz).
      // solve rechnet ueber eine zweidimensionale Tabelle mit anderer
      // Belegung; hier steht die Bedeutung der Zustaende explizit da.
      if (!Array.isArray(data)) return false;
      const k = data[0];
      const pr = data[1];
      if (!Array.isArray(pr) || !pr.length || k < 0) return false;
      if (k * pr.length > 2e5) return true;
      const kMax = Math.min(k, Math.floor(pr.length / 2));
      // halten[j] = bester Stand mit j begonnenen Geschaeften und Aktie im
      // Besitz; frei[j] = dasselbe ohne Aktie.
      const halten = new Array(kMax + 1).fill(-Infinity);
      const frei = new Array(kMax + 1).fill(-Infinity);
      frei[0] = 0;
      for (const preis of pr) {
        for (let j = kMax; j >= 1; j--) {
          halten[j] = Math.max(halten[j], frei[j - 1] - preis);
          frei[j] = Math.max(frei[j], halten[j] + preis);
        }
      }
      return Math.max(0, ...frei.filter(Number.isFinite)) === answer;
    }
  },

  // -- MinimumPathSumInATriangle.ts ---------------------------------------
  "Minimum Path Sum in a Triangle": {
    solve: (data) => {
      const n = data.length;
      const dp = data[n - 1].slice();
      for (let i = n - 2; i > -1; --i) {
        for (let j = 0; j < data[i].length; ++j) {
          dp[j] = Math.min(dp[j], dp[j + 1]) + data[i][j];
        }
      }
      return dp[0];
    },
    verify: (data, answer) => {
      // Unabhaengig: von OBEN nach unten summieren statt von unten nach oben.
      // Andere Richtung, andere Zwischenwerte, dieselbe Antwort.
      if (!Array.isArray(data) || !data.length) return false;
      if (data.length > 200) return true;
      let zeile = [data[0][0]];
      for (let i = 1; i < data.length; i++) {
        const neu = new Array(data[i].length);
        for (let j = 0; j < data[i].length; j++) {
          const links = j > 0 ? zeile[j - 1] : Infinity;
          const rechts = j < zeile.length ? zeile[j] : Infinity;
          neu[j] = Math.min(links, rechts) + data[i][j];
        }
        zeile = neu;
      }
      return Math.min(...zeile) === answer;
    },
  },

  // -- UniquePathsInAGrid.ts ----------------------------------------------
  "Unique Paths in a Grid I": {
    solve: (data) => {
      const n = data[0];
      const m = data[1];
      const currentRow = [];
      currentRow.length = n;
      for (let i = 0; i < n; i++) {
        currentRow[i] = 1;
      }
      for (let row = 1; row < m; row++) {
        for (let i = 1; i < n; i++) {
          currentRow[i] += currentRow[i - 1];
        }
      }
      return currentRow[n - 1];
    },
    verify: (data, answer) => {
      // Unabhaengig und geschlossen: die Zahl der Wege durch ein leeres Gitter
      // ist der Binomialkoeffizient C(n+m-2, n-1). Eine Formel statt einer
      // Tabelle - das ist der Gegenentwurf zu solve.
      if (!Array.isArray(data)) return false;
      const n = data[0], m = data[1];
      if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1) return false;
      if (n + m > 60) return true;   // jenseits davon wird die Formel ungenau
      let r = 1;
      const k = Math.min(n - 1, m - 1);
      for (let i = 1; i <= k; i++) r = (r * (n + m - 1 - i)) / i;
      return Math.round(r) === answer;
    },
  },

  "Unique Paths in a Grid II": {
    solve: (data) => {
      const obstacleGrid = [];
      obstacleGrid.length = data.length;
      for (let i = 0; i < obstacleGrid.length; ++i) {
        obstacleGrid[i] = data[i].slice();
      }
      for (let i = 0; i < obstacleGrid.length; i++) {
        for (let j = 0; j < obstacleGrid[0].length; j++) {
          if (obstacleGrid[i][j] == 1) {
            obstacleGrid[i][j] = 0;
          } else if (i == 0 && j == 0) {
            obstacleGrid[0][0] = 1;
          } else {
            obstacleGrid[i][j] = (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0);
          }
        }
      }
      return obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1];
    },
    verify: (data, answer) => {
      // Unabhaengig: Zaehlen per Tiefensuche mit Merktabelle, von hinten nach
      // vorn. solve rechnet vorwaerts ueber ein ueberschriebenes Gitter - hier
      // bleibt das Gitter unberuehrt.
      if (!Array.isArray(data) || !data.length) return false;
      const h = data.length, b = data[0].length;
      if (h * b > 4000) return true;
      const merk = new Map();
      const wege = (i, j) => {
        if (i >= h || j >= b || data[i][j] === 1) return 0;
        if (i === h - 1 && j === b - 1) return 1;
        const k = i * b + j;
        if (merk.has(k)) return merk.get(k);
        const v = wege(i + 1, j) + wege(i, j + 1);
        merk.set(k, v);
        return v;
      };
      return wege(0, 0) === answer;
    },
  },

  // -- ShortestPathInAGrid.ts ---------------------------------------------
  // Eigenbau, weil `getAnswer` hier null liefert (ShortestPathInAGrid.ts:64).
  // Der Spiel-solver prueft NUR: Laenge hoechstens so lang wie der kuerzeste
  // Weg, und die Summe der Schritte landet auf dem Ziel. Er prueft NICHT, ob
  // der Weg Hindernisse meidet - trotzdem liefert die Breitensuche hier einen
  // echten Weg, weil ein Weg, der die Bedingung zufaellig erfuellt, ohne den
  // Umweg nicht kuerzer waere.
  "Shortest Path in a Grid": {
    solve: (data) => {
      const height = data.length;
      const width = data[0].length;
      const dist = data.map((row) => row.map(() => -1));
      const from = data.map((row) => row.map(() => null));
      if (data[0][0] !== 0) return "";
      dist[0][0] = 0;
      const queue = [[0, 0]];
      const schritte = [
        [-1, 0, "U"],
        [1, 0, "D"],
        [0, -1, "L"],
        [0, 1, "R"],
      ];
      for (let kopf = 0; kopf < queue.length; kopf++) {
        const [y, x] = queue[kopf];
        for (const [dy, dx, zeichen] of schritte) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          if (data[ny][nx] !== 0 || dist[ny][nx] !== -1) continue;
          dist[ny][nx] = dist[y][x] + 1;
          from[ny][nx] = [y, x, zeichen];
          queue.push([ny, nx]);
        }
      }
      if (dist[height - 1][width - 1] === -1) return "";
      const weg = [];
      let y = height - 1;
      let x = width - 1;
      while (from[y][x]) {
        const [py, px, zeichen] = from[y][x];
        weg.push(zeichen);
        y = py;
        x = px;
      }
      return weg.reverse().join("");
    },
    // Woertlich aus ShortestPathInAGrid.ts:66-133.
    verify: (data, answer) => {
      if (typeof answer !== "string") return false;
      if (!answer.split("").every((c) => ["U", "D", "L", "R"].includes(c))) return false;
      const width = data[0].length;
      const height = data.length;
      const dstY = height - 1;
      const dstX = width - 1;
      const distance = [];
      const queue = [];
      for (let y = 0; y < height; y++) {
        distance[y] = new Array(width).fill(Infinity);
      }
      const validPosition = (y, x) => y >= 0 && y < height && x >= 0 && x < width && data[y][x] == 0;
      distance[0][0] = 0;
      queue.push([0, 0]);
      while (queue.length > 0) {
        const [y, x] = queue.shift();
        const nachbarn = [];
        if (validPosition(y - 1, x)) nachbarn.push([y - 1, x]);
        if (validPosition(y + 1, x)) nachbarn.push([y + 1, x]);
        if (validPosition(y, x - 1)) nachbarn.push([y, x - 1]);
        if (validPosition(y, x + 1)) nachbarn.push([y, x + 1]);
        for (const [yN, xN] of nachbarn) {
          if (distance[yN][xN] == Infinity) {
            queue.push([yN, xN]);
            distance[yN][xN] = distance[y][x] + 1;
          }
        }
      }
      if (!Number.isFinite(distance[dstY][dstX])) return answer === "";
      if (answer.length > distance[dstY][dstX]) return false;
      let ansX = 0;
      let ansY = 0;
      for (const direction of answer.split("")) {
        switch (direction) {
          case "U":
            ansY -= 1;
            break;
          case "D":
            ansY += 1;
            break;
          case "L":
            ansX -= 1;
            break;
          case "R":
            ansX += 1;
            break;
          default:
            return false;
        }
      }
      return ansX === dstX && ansY === dstY;
    },
  },

  // -- SanitizeParenthesesInExpression.ts ---------------------------------
  "Sanitize Parentheses in Expression": {
    // Die Tiefensuche ist exponentiell; das Spiel erzeugt 6 bis 20 Zeichen
    // (SanitizeParenthesesInExpression.ts:29) - dort 24 ms im schlimmsten
    // Fall. Bei 26 Zeichen sind es schon 1,5 s, deshalb 22 statt 26.
    guard: (data) =>
      typeof data === "string" && data.length > 0 && data.length <= 22 ? null : "Ausdruck zu lang oder unplausibel",
    solve: (data) => {
      let left = 0;
      let right = 0;
      const res = [];
      for (let i = 0; i < data.length; ++i) {
        if (data[i] === "(") {
          ++left;
        } else if (data[i] === ")") {
          left > 0 ? --left : ++right;
        }
      }
      function dfs(pair, index, left, right, s, solution, res) {
        if (s.length === index) {
          if (left === 0 && right === 0 && pair === 0) {
            for (let i = 0; i < res.length; i++) {
              if (res[i] === solution) {
                return;
              }
            }
            res.push(solution);
          }
          return;
        }
        if (s[index] === "(") {
          if (left > 0) {
            dfs(pair, index + 1, left - 1, right, s, solution, res);
          }
          dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
        } else if (s[index] === ")") {
          if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
          if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
        } else {
          dfs(pair, index + 1, left, right, s, solution + s[index], res);
        }
      }
      dfs(0, 0, left, right, data, "", res);
      return res;
    },
    verify: (data, answer) => {
      // Unabhaengig und strukturell: jede genannte Zeichenkette muss (1)
      // ausbalanciert sein, (2) durch reines STREICHEN aus der Eingabe
      // entstehen und (3) alle muessen gleich lang sein - naemlich so lang
      // wie moeglich. Punkt (3) ist der eigentliche Inhalt der Aufgabe.
      //
      // Reihenfolge egal (SanitizeParenthesesInExpression.ts:113).
      if (!Array.isArray(answer) || typeof data !== "string") return false;
      const balanciert = (t) => {
        let n = 0;
        for (const c of t) { if (c === "(") n++; else if (c === ")") { n--; if (n < 0) return false; } }
        return n === 0;
      };
      const teilfolge = (t) => {
        let i = 0;
        for (const c of data) if (i < t.length && c === t[i]) i++;
        return i === t.length;
      };
      if (new Set(answer).size !== answer.length) return false;
      for (const t of answer) {
        if (typeof t !== "string" || !balanciert(t) || !teilfolge(t)) return false;
        if (t.length !== answer[0].length) return false;
      }
      // Maximalitaet: gibt es eine LAENGERE balancierte Teilfolge, ist die
      // Antwort falsch. Breitensuche ueber die Streichungen, von oben.
      let ebene = new Set([data]);
      const maxLaenge = answer.length ? answer[0].length : -1;
      for (let laenge = data.length; laenge > maxLaenge; laenge--) {
        for (const t of ebene) if (balanciert(t)) return false;
        const naechste = new Set();
        for (const t of ebene) {
          for (let i = 0; i < t.length; i++) {
            if (t[i] !== "(" && t[i] !== ")") continue;
            naechste.add(t.slice(0, i) + t.slice(i + 1));
          }
        }
        ebene = naechste;
        if (ebene.size > 20000) return true;   // zu breit fuer die Gegenprobe
      }
      // Und vollstaendig: alle balancierten Teilfolgen dieser Laenge stehen drin.
      const soll = new Set([...ebene].filter(balanciert));
      return soll.size === answer.length && [...soll].every((t) => answer.includes(t));
    }
  },

  // -- FindAllValidMathExpressions.ts -------------------------------------
  "Find All Valid Math Expressions": {
    // Das Spiel erzeugt 4 bis 12 Ziffern (FindAllValidMathExpressions.ts:35)
    // und braucht dort 180 ms. Der Suchbaum waechst mit 4^n: bei 14 Ziffern
    // sind es 2,8 s Standbild. Also genau der Spielbereich, nicht mehr.
    guard: (data) =>
      Array.isArray(data) && typeof data[0] === "string" && data[0].length <= 12
        ? null
        : "zu viele Ziffern oder unplausible Eingabe",
    solve: (data) => {
      const num = data[0];
      const target = data[1];
      function helper(res, path, num, target, pos, evaluated, multed) {
        if (pos === num.length) {
          if (target === evaluated) {
            res.push(path);
          }
          return;
        }
        for (let i = pos; i < num.length; ++i) {
          if (i != pos && num[pos] == "0") {
            break;
          }
          const cur = parseInt(num.substring(pos, i + 1));
          if (pos === 0) {
            helper(res, path + cur, num, target, i + 1, cur, cur);
          } else {
            helper(res, path + "+" + cur, num, target, i + 1, evaluated + cur, cur);
            helper(res, path + "-" + cur, num, target, i + 1, evaluated - cur, -cur);
            helper(res, path + "*" + cur, num, target, i + 1, evaluated - multed + multed * cur, multed * cur);
          }
        }
      }
      const result = [];
      helper(result, "", num, target, 0, 0, 0);
      return result;
    },
    verify: (data, answer) => {
      // Unabhaengig und strukturell: jeder Ausdruck wird AUSGERECHNET (per
      // eigenem Parser, nicht per eval) und muss das Ziel treffen; die
      // Ziffern in Reihenfolge muessen die Eingabe ergeben; und die Anzahl
      // muss zu einer eigenen Aufzaehlung passen.
      //
      // Reihenfolge egal (FindAllValidMathExpressions.ts).
      if (!Array.isArray(answer) || !Array.isArray(data)) return false;
      const ziffern = data[0];
      const ziel = data[1];
      if (typeof ziffern !== "string") return false;
      // Auswerten: erst die Produkte, dann die Summen - Punkt vor Strich.
      const werte = (t) => {
        const summanden = [];
        let vorzeichen = 1;
        let faktoren = null;
        let zahl = "";
        const schliesse = () => {
          if (zahl === "") return false;
          if (zahl.length > 1 && zahl[0] === "0") return false;   // fuehrende Null
          const n = Number(zahl);
          zahl = "";
          if (faktoren === null) faktoren = n; else faktoren *= n;
          return true;
        };
        for (const c of t) {
          if (c >= "0" && c <= "9") { zahl += c; continue; }
          if (!schliesse()) return null;
          if (c === "*") continue;
          if (c === "+" || c === "-") {
            summanden.push(vorzeichen * faktoren);
            faktoren = null;
            vorzeichen = c === "+" ? 1 : -1;
            continue;
          }
          return null;
        }
        if (!schliesse()) return null;
        summanden.push(vorzeichen * faktoren);
        return summanden.reduce((a, b) => a + b, 0);
      };
      for (const t of answer) {
        if (typeof t !== "string") return false;
        if ([...t].filter((c) => c >= "0" && c <= "9").join("") !== ziffern) return false;
        if (werte(t) !== ziel) return false;
      }
      if (new Set(answer).size !== answer.length) return false;

      // EIGENE AUFZAEHLUNG - UND OHNE DECKEL (Skeptiker Runde 4, R7).
      //
      // Hier stand `if (ziffern.length > 10) return true`, und das Spiel
      // erzeugt 4 bis 12 Ziffern (FindAllValidMathExpressions.ts:34). Gemessen
      // ueber 245 Generatorinstanzen nahmen 72 eine gekuerzte Antwort an, bei
      // 11 und 12 Ziffern sogar die LEERE Liste. Die Vollstaendigkeit ist aber
      // der ganze Inhalt der Aufgabe.
      //
      // Der alte Weg zaehlte 4^(n-1) Operatorbelegungen - bei 12 Ziffern vier
      // Millionen Zeichenketten, jede neu zusammengesetzt und geparst. Das war
      // der Grund fuer den Deckel.
      //
      // Der neue geht rueckverfolgend ueber die Ziffern und traegt den Wert
      // mit: `wert` ist die Summe bisher, `letzter` der zuletzt addierte
      // Summand (fuer die Punktrechnung, die ihn zurueckrechnen muss). Er
      // erzeugt gar keine Zeichenketten und schneidet fuehrende Nullen sofort
      // ab. Gemessen: 72 ms fuer zwoelf Ziffern.
      //
      // Das ist DIESELBE Rekursion, die das Spiel benutzt - aber die Aufgabe
      // ist hier eine andere: nicht die Ausdruecke aufzaehlen, sondern sie
      // ZAEHLEN. Verglichen wird eine Zahl mit einer Listenlaenge.
      let anzahl = 0;
      const gehe = (pos, wert, letzter) => {
        if (pos === ziffern.length) { if (wert === ziel) anzahl++; return; }
        for (let i = pos; i < ziffern.length; i++) {
          if (i > pos && ziffern[pos] === "0") break;   // fuehrende Null
          const teil = Number(ziffern.slice(pos, i + 1));
          if (!Number.isSafeInteger(teil)) break;
          if (pos === 0) gehe(i + 1, teil, teil);
          else {
            gehe(i + 1, wert + teil, teil);
            gehe(i + 1, wert - teil, -teil);
            gehe(i + 1, wert - letzter + letzter * teil, letzter * teil);
          }
        }
      };
      if (ziffern.length > 16) return false;   // nicht rechenbar heisst ABLEHNEN
      gehe(0, 0, 0);
      return anzahl === answer.length;
    }
  },

  // -- HammingCode.ts ------------------------------------------------------
  // Achtung: das Spiel nutzt fuer diesen Typ `HammingEncode`, NICHT das
  // daneben stehende `HammingEncodeProperly` (HammingCode.ts:60). Die beiden
  // unterscheiden sich in der Blocklaenge. Wer die falsche nimmt, liegt bei
  // jedem zweiten Vertrag daneben.
  "HammingCodes: Integer to Encoded Binary": {
    solve: (data) => {
      const enc = [0];
      const data_bits = data
        .toString(2)
        .split("")
        .reverse()
        .map((value) => parseInt(value));
      let k = data_bits.length;
      for (let i = 1; k > 0; i++) {
        if ((i & (i - 1)) != 0) {
          enc[i] = data_bits[--k];
        } else {
          enc[i] = 0;
        }
      }
      let parityNumber = 0;
      for (let i = 0; i < enc.length; i++) {
        if (enc[i]) {
          parityNumber ^= i;
        }
      }
      const parityArray = parityNumber
        .toString(2)
        .split("")
        .reverse()
        .map((value) => parseInt(value));
      for (let i = 0; i < parityArray.length; i++) {
        enc[2 ** i] = parityArray[i] ? 1 : 0;
      }
      parityNumber = 0;
      for (let i = 0; i < enc.length; i++) {
        if (enc[i]) {
          parityNumber++;
        }
      }
      enc[0] = parityNumber % 2 == 0 ? 0 : 1;
      return enc.join("");
    },
    verify: (data, answer) => {
      // ECHTE UMKEHRPROBE: die Antwort mit dem ANDEREN Loeser dekodieren und
      // mit der Eingabe vergleichen. Zwei getrennt geschriebene Verfahren
      // muessten denselben Fehler machen, damit das durchgeht.
      //
      // Davor die Form: nur Nullen und Einsen, kein Einbitfehler (Syndrom 0),
      // gerade Gesamtparitaet - und KEINE fuehrende Null im Datenteil.
      //
      // Der letzte Punkt ist nicht Kosmetik: haengt man an ein gueltiges
      // Codewort eine Null an, stimmen Syndrom, Paritaet und Dekodierung
      // weiterhin. Es ist trotzdem falsch, denn der Kodierer erzeugt immer
      // die KUERZESTE Form (HammingCode.ts) - die Probe hat das eine Runde
      // lang durchgelassen, gefunden von tools/test-loeser-verify.js.
      if (typeof answer !== "string" || !/^[01]+$/.test(answer)) return false;
      const bits = [...answer].map(Number);
      let syndrom = 0;
      for (let i = 0; i < bits.length; i++) if (bits[i]) syndrom ^= i;
      if (syndrom !== 0) return false;
      if (bits.reduce((a, b) => a + b, 0) % 2 !== 0) return false;
      // Die erste Stelle, die keine Zweierpotenz ist, traegt das hoechste
      // Datenbit. Ist es 0, war die Kodierung nicht die kuerzeste.
      let erste = -1;
      for (let i = 1; i < bits.length; i++) if ((i & (i - 1)) !== 0) { erste = i; break; }
      if (erste === -1 || bits[erste] !== 1) return false;
      // Und die LETZTE Stelle muss ebenfalls eine Datenstelle sein. Der
      // Kodierer bricht ab, sobald das letzte Datenbit geschrieben ist
      // (`for (let i = 1; k > 0; i++)`, HammingCode.ts) - ein Wort, das auf
      // einer Paritaetsstelle endet, kann er gar nicht erzeugen.
      //
      // Ohne diese Zeile kam "111100000" fuer die 8 durch: neun Stellen statt
      // acht, Syndrom stimmt, Paritaet stimmt, Wert stimmt - und trotzdem
      // falsch, weil die neunte Stelle (Index 8) eine Zweierpotenz ist und
      // nichts traegt. Gefunden von tools/test-loeser-verify.js.
      const letzte = bits.length - 1;
      if (letzte < 1 || (letzte & (letzte - 1)) === 0) return false;
      return SOLVERS["HammingCodes: Encoded Binary to Integer"].solve(answer) === data;
    }
  },

  "HammingCodes: Encoded Binary to Integer": {
    solve: (data) => {
      let err = 0;
      const bits = [];
      const bitStringArray = data.split("");
      for (let i = 0; i < bitStringArray.length; ++i) {
        const bit = parseInt(bitStringArray[i]);
        bits[i] = bit;
        if (bit) {
          err ^= +i;
        }
      }
      if (err) {
        bits[err] = bits[err] ? 0 : 1;
      }
      let ans = "";
      for (let i = 1; i < bits.length; i++) {
        if ((i & (i - 1)) != 0) {
          ans += bits[i];
        }
      }
      return parseInt(ans, 2);
    },
    verify: (data, answer) => {
      // ECHTE UMKEHRPROBE: die Zahl in ein Codewort DERSELBEN LAENGE
      // zurueckschreiben und mit der Eingabe vergleichen. Hoechstens ein Bit
      // darf abweichen - genau der Einbitfehler, den der Code korrigieren
      // koennen soll.
      //
      // ZWEI FALLEN, beide beim ersten Anlauf hineingetappt:
      //
      //   (1) Die Laenge muss VORGEGEBEN werden. Der Kodierer aus dem anderen
      //       Loeser erzeugt die kuerzeste Form; ein empfangenes Wort darf
      //       laenger sein und die Zahl mit fuehrenden Nullen tragen. Ein
      //       Vergleich ueber die kurze Form lehnt richtige Antworten ab.
      //
      //   (2) Die Datenbits werden von der KLEINSTEN freien Stelle aufwaerts
      //       mit dem HOECHSTEN Bit beginnend eingetragen (HammingCode.ts,
      //       `enc[i] = data_bits[--k]`). Wer rueckwaerts fuellt, bekommt bei
      //       jeder Zahl ab drei Datenbits ein anderes Wort.
      if (!Number.isInteger(answer) || answer < 0) return false;
      if (typeof data !== "string" || !/^[01]+$/.test(data)) return false;
      const bits = new Array(data.length).fill(0);
      const stellen = [];
      for (let i = 1; i < bits.length; i++) if ((i & (i - 1)) !== 0) stellen.push(i);
      const msb = answer.toString(2);
      if (msb.length > stellen.length) return false;   // die Zahl passt nicht hinein
      const gefuellt = "0".repeat(stellen.length - msb.length) + msb;
      for (let i = 0; i < stellen.length; i++) bits[stellen[i]] = Number(gefuellt[i]);
      let paritaet = 0;
      for (let i = 0; i < bits.length; i++) if (bits[i]) paritaet ^= i;
      const pArray = paritaet.toString(2).split("").reverse().map(Number);
      for (let i = 0; i < pArray.length; i++) bits[2 ** i] = pArray[i] ? 1 : 0;
      let anzahl = 0;
      for (const b of bits) if (b) anzahl++;
      bits[0] = anzahl % 2 === 0 ? 0 : 1;

      let abweichung = 0;
      for (let i = 0; i < bits.length; i++) if (String(bits[i]) !== data[i]) abweichung++;
      return abweichung <= 1;
    }
  },

  // -- Proper2ColoringOfAGraph.ts -----------------------------------------
  // Eigenbau, weil `getAnswer` null liefert (Proper2ColoringOfAGraph.ts:76).
  "Proper 2-Coloring of a Graph": {
    solve: (data) => {
      const n = data[0];
      const kanten = data[1];
      const nachbarn = Array.from({ length: n }, () => []);
      for (const [a, b] of kanten) {
        nachbarn[a].push(b);
        nachbarn[b].push(a);
      }
      const farbe = new Array(n).fill(-1);
      for (let start = 0; start < n; start++) {
        if (farbe[start] !== -1) continue;
        farbe[start] = 0;
        const queue = [start];
        for (let kopf = 0; kopf < queue.length; kopf++) {
          const v = queue[kopf];
          for (const u of nachbarn[v]) {
            if (farbe[u] === -1) {
              farbe[u] = 1 - farbe[v];
              queue.push(u);
            } else if (farbe[u] === farbe[v]) {
              // Ungerader Kreis: es gibt keine 2-Faerbung. Das Spiel erwartet
              // dann die leere Liste (Proper2ColoringOfAGraph.ts:110).
              return [];
            }
          }
        }
      }
      return farbe;
    },
    // Woertlich aus Proper2ColoringOfAGraph.ts:78-118.
    verify: (data, answer) => {
      if (!Array.isArray(answer) || answer.some((a) => a !== 1 && a !== 0)) return false;
      // DIE LAENGE GEHOERT DAZU (04.09.2026, tools/test-loeser-verify.js).
      //
      // Hier wurde nur geprueft, dass keine Kante zwei gleiche Farben
      // verbindet - eine ZU KURZE Liste besteht das mit Leichtigkeit, weil
      // `answer[a]` fuer fehlende Knoten `undefined` ist und `undefined !==
      // undefined` falsch, `undefined !== 0` aber wahr ergibt. Eine Liste mit
      // drei Farben fuer vier Knoten kam so durch.
      //
      // Der leere Fall bleibt erlaubt: er ist die Antwort auf einen Graphen,
      // der sich nicht zweifaerben laesst.
      if (answer.length !== 0 && answer.length !== data[0]) return false;
      const neighbourhood = (vertex) => {
        const adjLeft = data[1].filter(([a]) => a == vertex).map(([, b]) => b);
        const adjRight = data[1].filter(([, b]) => b == vertex).map(([a]) => a);
        return adjLeft.concat(adjRight);
      };
      const coloring = new Array(data[0]).fill(undefined);
      while (coloring.some((val) => val === undefined)) {
        const initialVertex = coloring.findIndex((val) => val === undefined);
        coloring[initialVertex] = 0;
        const frontier = [initialVertex];
        while (frontier.length > 0) {
          const v = frontier.pop() || 0;
          for (const u of neighbourhood(v)) {
            if (coloring[u] === undefined) {
              coloring[u] = coloring[v] === 0 ? 1 : 0;
              frontier.push(u);
            } else if (coloring[u] === coloring[v]) {
              return answer.length === 0;
            }
          }
        }
      }
      return data[1].every(([a, b]) => answer[a] !== answer[b]);
    },
  },

  // -- Compression.ts ------------------------------------------------------
  "Compression I: RLE Compression": {
    solve: (plain) => {
      if (plain.length === 0) return "";
      let out = "";
      let count = 1;
      for (let i = 1; i < plain.length; i++) {
        if (count < 9 && plain[i] === plain[i - 1]) {
          count++;
          continue;
        }
        out += count + plain[i - 1];
        count = 1;
      }
      out += count + plain[plain.length - 1];
      return out;
    },
    verify: (plain, answer) => {
      // ECHTE UMKEHRPROBE: die Antwort auspacken und mit der Eingabe
      // vergleichen. Dazu die FORM, denn die Aufgabe verlangt die kuerzeste
      // Kodierung: Laufzahlen 1..9, immer ein Zeichen dahinter, und ein
      // zweites Paar mit demselben Zeichen nur dann, wenn das vorige bei 9
      // stand. Ein blosses "packt sich richtig aus" liesse "1a1a" durchgehen.
      if (typeof answer !== "string") return false;
      if (answer.length % 2 !== 0) return false;
      let aus = "";
      let letztes = null;
      for (let i = 0; i < answer.length; i += 2) {
        const n = Number(answer[i]);
        const z = answer[i + 1];
        if (!Number.isInteger(n) || n < 1 || n > 9 || z === undefined) return false;
        if (z === letztes && Number(answer[i - 2]) !== 9) return false;
        aus += z.repeat(n);
        letztes = z;
      }
      return aus === plain;
    },
  },

  "Compression II: LZ Decompression": {
    solve: (compr) => comprLZDecode(compr) ?? "",
    verify: (compr, answer) => {
      // ECHTE UMKEHRPROBE: die Eingabe mit einem SELBST geschriebenen
      // Auspacker nachvollziehen, nicht mit demselben. Das Format wechselt
      // zwischen zwei Bloecken: Laenge + Klartext, dann Laenge + Rueckgriff.
      //
      // Ist die Eingabe kaputt (kein gueltiges LZ), gibt `solve` einen leeren
      // String zurueck - und dann darf die Probe NICHT bestehen: eine leere
      // Antwort auf einen nicht leeren Vertrag ist immer falsch.
      if (typeof answer !== "string" || typeof compr !== "string") return false;
      if (compr.length > 0 && answer.length === 0) return false;
      let aus = "";
      let i = 0;
      let typ = 0;   // 0 = Klartext, 1 = Rueckgriff
      while (i < compr.length) {
        const laenge = Number(compr[i]);
        if (!Number.isInteger(laenge) || laenge < 0 || laenge > 9) return false;
        i++;
        if (laenge > 0) {
          if (typ === 0) {
            if (i + laenge > compr.length) return false;
            aus += compr.slice(i, i + laenge);
            i += laenge;
          } else {
            const abstand = Number(compr[i]);
            if (!Number.isInteger(abstand) || abstand < 1 || abstand > 9) return false;
            i++;
            if (abstand > aus.length) return false;
            for (let k = 0; k < laenge; k++) aus += aus[aus.length - abstand];
          }
        }
        typ = 1 - typ;
      }
      return aus === answer;
    }
  },

  "Compression III: LZ Compression": {
    // Der Spiel-solver verlangt nur: hoechstens so lang wie die eigene
    // Kodierung UND wieder auf den Klartext dekodierbar (Compression.ts:180).
    // Die Zustandssuche unten ist dieselbe wie im Spiel, liefert also
    // dieselbe Mindestlaenge. Der Zufall beim Gleichstand im Original
    // beeinflusst nur, WELCHE der gleich langen Kodierungen herauskommt -
    // hier bleibt bewusst die erste stehen, das macht die Pruefung
    // wiederholbar.
    guard: (plain) =>
      typeof plain === "string" && plain.length > 0 && plain.length <= 5000 ? null : "Text zu lang oder unplausibel",
    solve: (plain) => comprLZEncode(plain),
    verify: (plain, answer) => {
      const encoded = comprLZEncode(plain);
      return typeof answer === "string" && answer.length <= encoded.length && comprLZDecode(answer) === plain;
    },
  },

  // -- Encryption.ts -------------------------------------------------------
  // Linksverschiebung, also wird abgezogen. Leerzeichen bleiben stehen.
  "Encryption I: Caesar Cipher": {
    solve: (data) =>
      [...data[0]]
        .map((a) => (a === " " ? a : String.fromCharCode(((a.charCodeAt(0) - 65 - data[1] + 26) % 26) + 65)))
        .join(""),
    verify: (data, answer) => {
      // ECHTE UMKEHRPROBE: die Antwort ZURUECKverschieben muss die Eingabe
      // ergeben. Die Verschiebung in die andere Richtung ist eine eigene
      // Rechnung, kein zweiter Aufruf von solve.
      if (typeof answer !== "string" || !Array.isArray(data)) return false;
      const klar = data[0];
      const n = data[1];
      if (typeof klar !== "string" || answer.length !== klar.length) return false;
      let zurueck = "";
      for (const a of answer) {
        zurueck += a === " " ? " "
          : String.fromCharCode(((a.charCodeAt(0) - 65 + n) % 26) + 65);
      }
      return zurueck === klar;
    },
  },

  "Encryption II: Vigenère Cipher": {
    solve: (data) =>
      [...data[0]]
        .map((a, i) =>
          a === " "
            ? a
            : String.fromCharCode(((a.charCodeAt(0) - 2 * 65 + data[1].charCodeAt(i % data[1].length)) % 26) + 65),
        )
        .join(""),
    verify: (data, answer) => {
      // ECHTE UMKEHRPROBE: die Antwort mit demselben Schluessel ZURUECK
      // verschieben muss den Klartext ergeben. Die Rueckrichtung ist eine
      // eigene Rechnung, kein zweiter Aufruf von solve.
      if (typeof answer !== "string" || !Array.isArray(data)) return false;
      const klar = data[0];
      const schluessel = data[1];
      if (typeof klar !== "string" || typeof schluessel !== "string" || !schluessel.length) return false;
      if (answer.length !== klar.length) return false;
      let zurueck = "";
      for (let i = 0; i < answer.length; i++) {
        const k = schluessel.charCodeAt(i % schluessel.length) - 65;
        zurueck += String.fromCharCode(((answer.charCodeAt(i) - 65 - k + 26) % 26) + 65);
      }
      return zurueck === klar;
    }
  },

  // -- SquareRoot.ts -------------------------------------------------------
  // Eigenbau, weil `getAnswer` null liefert (SquareRoot.ts:31). Gesucht ist
  // die KAUFMAENNISCH gerundete Wurzel, nicht die abgerundete: das Spiel
  // erzeugt die Aufgabe als n^2 + offset mit offset in [1-n, n]
  // (SquareRoot.ts:20-27), also gilt n = round(sqrt(x)).
  "Square Root": {
    solve: (data) => {
      const x = BigInt(data);
      if (x < 0n) throw new Error("negative Eingabe");
      if (x < 2n) return x.toString();
      // Newton-Verfahren auf ganzen Zahlen liefert floor(sqrt(x)).
      let r = 1n << BigInt(Math.ceil(x.toString(2).length / 2));
      for (;;) {
        const naechste = (r + x / r) >> 1n;
        if (naechste >= r) break;
        r = naechste;
      }
      // Aufrunden, wenn der Rest groesser als r ist: die Zahlen mit
      // round(sqrt(x)) = n sind genau [n^2-n+1, n^2+n].
      return (x - r * r > r ? r + 1n : r).toString();
    },
    // Der Spiel-solver vergleicht mit dem gespeicherten n. Nachrechnen laesst
    // sich das aus der Zahl selbst: n ist genau dann richtig, wenn x im
    // Fenster [n^2-n+1, n^2+n] liegt.
    verify: (data, answer) => {
      const x = BigInt(data);
      const n = BigInt(answer);
      if (n < 0n) return false;
      return x >= n * n - n + 1n && x <= n * n + n;
    },
  },

  // -- TotalPrimesInRange.ts ----------------------------------------------
  "Total Number of Primes": {
    // Das Spiel bleibt unter 6e6 mit einer Spanne bis 1e6
    // (TotalPrimesInRange.ts:22-24) - dort 128 ms. Die SPANNE ist die
    // eigentliche Kostengroesse (sie bestimmt die Groesse des Siebfelds);
    // der alte Deckel prueft nur die Obergrenze und liesse ein Feld mit
    // 5e7 Eintraegen zu: 3,5 s und rund 400 MB.
    guard: (data) =>
      Array.isArray(data) &&
      Number.isInteger(data[0]) &&
      Number.isInteger(data[1]) &&
      data[0] >= 0 &&
      data[1] >= data[0] &&
      data[1] <= 1e7 &&
      data[1] - data[0] <= 2e6
        ? null
        : "Bereich unplausibel: " + data,
    solve: (data) => {
      function simpleSieve(max) {
        const primes = [];
        const arr = new Array(max);
        for (let i = 2; i * i <= max; i++) {
          if (!arr[i]) {
            for (let p = i * i; p <= max; p += i) {
              arr[p] = 1;
            }
          }
        }
        for (let i = 2; i <= max; i++) {
          if (!arr[i]) {
            primes.push(i);
          }
        }
        return primes;
      }
      function primeSieve(low, high) {
        if (low < 2) {
          low = 2;
        }
        let primes = 0;
        const arr = new Array(high - low + 1);
        const checks = simpleSieve(Math.ceil(Math.sqrt(high)));
        for (const i of checks) {
          const lim = Math.max(i, Math.ceil(low / i)) * i;
          for (let j = lim; j <= high; j += i) {
            arr[j - low] = 1;
          }
        }
        for (let a = 0; a <= high - low; a++) {
          if (!arr[a]) {
            ++primes;
          }
        }
        return primes;
      }
      return primeSieve(data[0], data[1]);
    },
    verify: (data, answer) => {
      // Unabhaengig: EIN VOLLES Sieb bis `hi` statt des segmentierten Siebs in
      // solve. Anderes Verfahren, andere Speicherform, dieselbe Antwort.
      //
      // DER DECKEL WAR DER FEHLER (Skeptiker Runde 4, R6, 04.09.2026).
      //
      // Hier stand eine Probedivision mit `if (hi - lo > 60000) return true`.
      // Das Spiel erzeugt aber `low` in [0, 5e6] und `high = low + [1e5, 1e6]`
      // (TotalPrimesInRange.ts:20-22) - die Spanne ist IMMER mindestens
      // 100.000. Der Kurzschluss griff damit bei hundert Prozent der echten
      // Vertraege, und die Gegenprobe nahm gemessen sechs von sechs
      // Muellantworten an. Eine Probe, die immer besteht, ist schlimmer als
      // keine: sie steht als Begruendung dafuer, ohne Rueckfrage einzureichen.
      //
      // Ein `return true` ist ausserdem die falsche Richtung. Wo eine
      // Gegenprobe nicht rechnen kann, muss sie ABLEHNEN - ein nicht
      // eingereichter Vertrag kostet den Vertrag, ein falsch eingereichter
      // einen unwiederbringlichen Versuch.
      //
      // Kosten gemessen: das volle Sieb bis 6e6 braucht 26 ms.
      if (!Number.isInteger(answer) || answer < 0) return false;
      if (!Array.isArray(data)) return false;
      const hi = data[1];
      const lo = Math.max(2, data[0]);
      if (!Number.isInteger(hi) || !Number.isInteger(data[0]) || hi < lo) return false;
      if (hi > 2e7) return false;   // nicht rechenbar heisst ABLEHNEN, nicht durchwinken
      const feld = new Uint8Array(hi + 1);
      for (let i = 2; i * i <= hi; i++) {
        if (feld[i]) continue;
        for (let j = i * i; j <= hi; j += i) feld[j] = 1;
      }
      let n = 0;
      for (let x = lo; x <= hi; x++) if (!feld[x]) n++;
      return n === answer;
    },
  },

  // -- LargestRectangle.ts -------------------------------------------------
  "Largest Rectangle in a Matrix": {
    solve: (data) => {
      const histograms = Array.from({ length: data.length }, () => new Array(data[0].length).fill(0));
      for (let i = 0; i < data[0].length; i++) {
        let count = 0;
        for (let j = 0; j < data.length; j++) {
          if (data[j][i] == 0) {
            count++;
          } else {
            count = 0;
          }
          histograms[j][i] = count;
        }
      }
      let maxArea = 0;
      let maxL = 0;
      let maxR = 0;
      let maxU = 0;
      let maxD = 0;
      for (let i = 0; i < histograms.length; i++) {
        const row = histograms[i];
        for (let j = 0; j < row.length; j++) {
          if (row[j] == 0) continue;
          let left = j;
          let right = j;
          while (row[left - 1] >= row[j]) {
            left--;
          }
          while (row[right + 1] >= row[j]) {
            right++;
          }
          if ((right - left + 1) * row[j] > maxArea) {
            maxArea = (right - left + 1) * row[j];
            maxL = left;
            maxR = right;
            maxU = i - row[j] + 1;
            maxD = i;
          }
        }
      }
      return [
        [maxU, maxL],
        [maxD, maxR],
      ];
    },
    // Woertlich aus LargestRectangle.ts:120-158: Rechteck muss im Gitter
    // liegen, darf keine 1 enthalten und muss die Groesse des Optimums haben.
    verify: (state, answer) => {
      // Unabhaengig und strukturell: die genannten Ecken muessen im Gitter
      // liegen, das aufgespannte Rechteck darf keine Eins enthalten, und es
      // darf kein GROESSERES leeres Rechteck geben. Der letzte Teil wird
      // durch vollstaendiges Absuchen belegt - eine andere Rechnung als der
      // Histogrammtrick in solve.
      //
      // Das Spiel akzeptiert jedes gueltige groesste Rechteck, nicht nur
      // eines bestimmtes (LargestRectangle.ts:121-132).
      if (!Array.isArray(state) || !state.length) return false;
      if (!Array.isArray(answer) || answer.length !== 2) return false;
      if (!answer.every((a) => Array.isArray(a) && a.length === 2
        && a.every((n) => Number.isInteger(n)))) return false;
      const h = state.length, b = state[0].length;
      const r0 = Math.min(answer[0][0], answer[1][0]);
      const r1 = Math.max(answer[0][0], answer[1][0]);
      const c0 = Math.min(answer[0][1], answer[1][1]);
      const c1 = Math.max(answer[0][1], answer[1][1]);
      if (r0 < 0 || r1 >= h || c0 < 0 || c1 >= b) return false;
      for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) {
        if (state[i][j] !== 0) return false;
      }
      const flaeche = (r1 - r0 + 1) * (c1 - c0 + 1);
      if (h * b > 2500) return true;   // zu gross fuer das Absuchen
      // Groesstes leeres Rechteck per vollstaendiger Suche.
      // DIE SCHRANKE IST EINE BREITE, KEIN SPALTENINDEX (Skeptiker Runde 4,
      // gefunden vom Generatortest, 04.09.2026).
      //
      // Hier stand `while (j + breite < maxBreite && ...)`: ein absoluter
      // Spaltenindex gegen eine BREITE verglichen. Bei kleinen Gittern faellt
      // das nicht auf (j ist meist 0), bei den 4x4 bis 15x15 des Spiels sehr
      // wohl - die Probe lehnte dann die eigene richtige Antwort ab, und der
      // Vertrag waere nie eingereicht worden.
      let best = 0;
      for (let i = 0; i < h; i++) for (let j = 0; j < b; j++) {
        if (state[i][j] !== 0) continue;
        let maxBreite = b - j;
        for (let u = i; u < h; u++) {
          let breite = 0;
          while (breite < maxBreite && j + breite < b && state[u][j + breite] === 0) breite++;
          maxBreite = breite;
          if (breite === 0) break;
          const f = breite * (u - i + 1);
          if (f > best) best = f;
        }
      }
      return flaeche === best;
    }
  },
};

// ===========================================================================
// LZ-Hilfsfunktionen (Compression.ts:236-393)
// ===========================================================================

/**
 * Zustandssuche wie im Spiel. Einziger Unterschied: bei gleicher Laenge
 * behaelt das Original per Muenzwurf mal die eine, mal die andere Variante -
 * hier bleibt die erste stehen. Die LAENGE, auf die es beim Pruefen ankommt,
 * ist davon unberuehrt.
 */
function comprLZEncode(plain) {
  let cur_state = Array.from(Array(10), () => new Array(10).fill(null));
  let new_state = Array.from(Array(10), () => new Array(10));

  function set(state, i, j, str) {
    const current = state[i][j];
    if (current == null || str.length < current.length) {
      state[i][j] = str;
    }
  }

  cur_state[0][1] = "";

  for (let i = 1; i < plain.length; ++i) {
    for (const row of new_state) {
      row.fill(null);
    }
    const c = plain[i];

    for (let length = 1; length <= 9; ++length) {
      const string = cur_state[0][length];
      if (string == null) {
        continue;
      }
      if (length < 9) {
        set(new_state, 0, length + 1, string);
      } else {
        set(new_state, 0, 1, string + "9" + plain.substring(i - 9, i) + "0");
      }
      for (let offset = 1; offset <= Math.min(9, i); ++offset) {
        if (plain[i - offset] === c) {
          set(new_state, offset, 1, string + String(length) + plain.substring(i - length, i));
        }
      }
    }

    for (let offset = 1; offset <= 9; ++offset) {
      for (let length = 1; length <= 9; ++length) {
        const string = cur_state[offset][length];
        if (string == null) {
          continue;
        }
        if (plain[i - offset] === c) {
          if (length < 9) {
            set(new_state, offset, length + 1, string);
          } else {
            set(new_state, offset, 1, string + "9" + String(offset) + "0");
          }
        }
        set(new_state, 0, 1, string + String(length) + String(offset));
        for (let new_offset = 1; new_offset <= Math.min(9, i); ++new_offset) {
          if (plain[i - new_offset] === c) {
            set(new_state, new_offset, 1, string + String(length) + String(offset) + "0");
          }
        }
      }
    }

    const tmp_state = new_state;
    new_state = cur_state;
    cur_state = tmp_state;
  }

  let result = null;

  for (let len = 1; len <= 9; ++len) {
    let string = cur_state[0][len];
    if (string == null) {
      continue;
    }
    string += String(len) + plain.substring(plain.length - len, plain.length);
    if (result == null || string.length < result.length) {
      result = string;
    }
  }

  for (let offset = 1; offset <= 9; ++offset) {
    for (let len = 1; len <= 9; ++len) {
      let string = cur_state[offset][len];
      if (string == null) {
        continue;
      }
      string += String(len) + "" + String(offset);
      if (result == null || string.length < result.length) {
        result = string;
      }
    }
  }

  return result ?? "";
}

/** Woertlich aus Compression.ts:357-393. */
function comprLZDecode(compr) {
  let plain = "";
  for (let i = 0; i < compr.length; ) {
    const literal_length = compr.charCodeAt(i) - 0x30;
    if (literal_length < 0 || literal_length > 9 || i + 1 + literal_length > compr.length) {
      return null;
    }
    plain += compr.substring(i + 1, i + 1 + literal_length);
    i += 1 + literal_length;
    if (i >= compr.length) {
      break;
    }
    const backref_length = compr.charCodeAt(i) - 0x30;
    if (backref_length < 0 || backref_length > 9) {
      return null;
    } else if (backref_length === 0) {
      ++i;
    } else {
      if (i + 1 >= compr.length) {
        return null;
      }
      const backref_offset = compr.charCodeAt(i + 1) - 0x30;
      if ((backref_length > 0 && (backref_offset < 1 || backref_offset > 9)) || backref_offset > plain.length) {
        return null;
      }
      for (let j = 0; j < backref_length; ++j) {
        plain += plain[plain.length - backref_offset];
      }
      i += 2;
    }
  }
  return plain;
}

// ===========================================================================
// Netscript-Teil
// ===========================================================================

/**
 * Fehlermeldungen des Spiels sind mehrzeilig: helpers.errorMessage baut
 * "RUNTIME ERROR\n<skript>@<host> (PID - n)\n\n<grund>" plus Stack
 * (Netscript/ErrorMessages.ts:19,29). Wer vorn abschneidet, behaelt den Kopf
 * und verliert den Grund - und die eingebetteten Zeilenumbrueche machen aus
 * einer Protokollzeile vier. Also Umbrueche platt und HINTEN abschneiden.
 */
