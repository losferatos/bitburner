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
    verify: (data, answer) => SOLVERS["Find Largest Prime Factor"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Subarray with Maximum Sum"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Total Ways to Sum"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Total Ways to Sum II"].solve(data) === answer,
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
      const spiral = SOLVERS["Spiralize Matrix"].solve(data);
      return spiral.length === answer.length && spiral.every((n, i) => n === answer[i]);
    },
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
    verify: (data, answer) => SOLVERS["Array Jumping Game"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Array Jumping Game II"].solve(data) === answer,
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
      const result = SOLVERS["Merge Overlapping Intervals"].solve(data);
      return (
        Array.isArray(answer) &&
        result.length === answer.length &&
        result.every((a, i) => Array.isArray(answer[i]) && a[0] === answer[i][0] && a[1] === answer[i][1])
      );
    },
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
      const ret = SOLVERS["Generate IP Addresses"].solve(data);
      return Array.isArray(answer) && ret.length === answer.length && ret.every((ip) => answer.includes(ip));
    },
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
    verify: (data, answer) => SOLVERS["Algorithmic Stock Trader I"].solve(data) === answer,
  },

  "Algorithmic Stock Trader II": {
    solve: (data) => {
      let profit = 0;
      for (let p = 1; p < data.length; ++p) {
        profit += Math.max(data[p] - data[p - 1], 0);
      }
      return profit;
    },
    verify: (data, answer) => SOLVERS["Algorithmic Stock Trader II"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Algorithmic Stock Trader III"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Algorithmic Stock Trader IV"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Minimum Path Sum in a Triangle"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Unique Paths in a Grid I"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Unique Paths in a Grid II"].solve(data) === answer,
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
      const res = SOLVERS["Sanitize Parentheses in Expression"].solve(data);
      if (!Array.isArray(answer) || res.length !== answer.length) return false;
      return res.every((sol) => answer.includes(sol));
    },
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
      const result = SOLVERS["Find All Valid Math Expressions"].solve(data);
      if (!Array.isArray(answer) || result.length !== answer.length) return false;
      const solutions = new Set(answer);
      return result.every((sol) => solutions.has(sol));
    },
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
    verify: (data, answer) => SOLVERS["HammingCodes: Integer to Encoded Binary"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["HammingCodes: Encoded Binary to Integer"].solve(data) === answer,
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
    verify: (plain, answer) => SOLVERS["Compression I: RLE Compression"].solve(plain) === answer,
  },

  "Compression II: LZ Decompression": {
    solve: (compr) => comprLZDecode(compr) ?? "",
    verify: (compr, answer) => SOLVERS["Compression II: LZ Decompression"].solve(compr) === answer,
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
    verify: (data, answer) => SOLVERS["Encryption I: Caesar Cipher"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Encryption II: Vigenère Cipher"].solve(data) === answer,
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
    verify: (data, answer) => SOLVERS["Total Number of Primes"].solve(data) === answer,
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
      if (
        !Array.isArray(answer) ||
        answer.length !== 2 ||
        !answer.every((a) => Array.isArray(a) && a.length === 2 && a.every((n) => typeof n === "number"))
      ) {
        return false;
      }
      if (
        answer[0][0] < 0 ||
        answer[0][0] > state.length - 1 ||
        answer[0][1] < 0 ||
        answer[0][1] > state[0].length - 1 ||
        answer[1][0] < 0 ||
        answer[1][0] > state.length - 1 ||
        answer[1][1] < 0 ||
        answer[1][1] > state[0].length - 1
      ) {
        return false;
      }
      const minR = Math.min(answer[0][0], answer[1][0]);
      const maxR = Math.max(answer[0][0], answer[1][0]);
      const minC = Math.min(answer[0][1], answer[1][1]);
      const maxC = Math.max(answer[0][1], answer[1][1]);
      for (let i = minR; i <= maxR; i++) {
        if (state[i].slice(minC, maxC + 1).includes(1)) {
          return false;
        }
      }
      const solution = SOLVERS["Largest Rectangle in a Matrix"].solve(state);
      const userArea = (maxR - minR + 1) * (maxC - minC + 1);
      return userArea === (solution[1][0] - solution[0][0] + 1) * (solution[1][1] - solution[0][1] + 1);
    },
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
