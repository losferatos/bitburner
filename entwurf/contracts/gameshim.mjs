/**
 * Ersatzteile fuer den Spielquelltext, damit sich die Vertragsdateien aus
 * reference/v301/src/CodingContract/contracts/*.ts in Node laden lassen.
 *
 * Warum ueberhaupt: die Pruefung soll nicht gegen meine Nacherzaehlung der
 * Regeln testen, sondern gegen den echten `solver` des Spiels. Der entscheidet
 * im Spiel ueber Erfolg oder verbrannten Versuch. Dafuer muessen die
 * Originaldateien laufen - und die importieren fuenf Kleinigkeiten, die
 * ausserhalb des Vertragsordners liegen. Genau die stehen hier, wortgleich
 * aus dem Quelltext uebernommen.
 *
 * Quellen:
 *   utils/helpers/getRandomIntInclusive.ts
 *   utils/helpers/randomBigIntExclusive.ts
 *   CodingContract/Enums.ts
 *   CodingContract/ContractTypes.ts (parseArrayString, convert2DArrayToString)
 */

// Aus CodingContract/Enums.ts. Als Objekt statt als TypeScript-enum, weil
// Nodes Typenschnitt (--experimental-strip-types) enums ausdruecklich nicht
// uebersetzen kann - er entfernt nur Typen, und ein enum erzeugt Laufzeitcode.
export const CodingContractName = {
  FindLargestPrimeFactor: "Find Largest Prime Factor",
  SubarrayWithMaximumSum: "Subarray with Maximum Sum",
  TotalWaysToSum: "Total Ways to Sum",
  TotalWaysToSumII: "Total Ways to Sum II",
  SpiralizeMatrix: "Spiralize Matrix",
  ArrayJumpingGame: "Array Jumping Game",
  ArrayJumpingGameII: "Array Jumping Game II",
  MergeOverlappingIntervals: "Merge Overlapping Intervals",
  GenerateIPAddresses: "Generate IP Addresses",
  AlgorithmicStockTraderI: "Algorithmic Stock Trader I",
  AlgorithmicStockTraderII: "Algorithmic Stock Trader II",
  AlgorithmicStockTraderIII: "Algorithmic Stock Trader III",
  AlgorithmicStockTraderIV: "Algorithmic Stock Trader IV",
  MinimumPathSumInATriangle: "Minimum Path Sum in a Triangle",
  UniquePathsInAGridI: "Unique Paths in a Grid I",
  UniquePathsInAGridII: "Unique Paths in a Grid II",
  ShortestPathInAGrid: "Shortest Path in a Grid",
  SanitizeParenthesesInExpression: "Sanitize Parentheses in Expression",
  FindAllValidMathExpressions: "Find All Valid Math Expressions",
  HammingCodesIntegerToEncodedBinary: "HammingCodes: Integer to Encoded Binary",
  HammingCodesEncodedBinaryToInteger: "HammingCodes: Encoded Binary to Integer",
  Proper2ColoringOfAGraph: "Proper 2-Coloring of a Graph",
  CompressionIRLECompression: "Compression I: RLE Compression",
  CompressionIILZDecompression: "Compression II: LZ Decompression",
  CompressionIIILZCompression: "Compression III: LZ Compression",
  EncryptionICaesarCipher: "Encryption I: Caesar Cipher",
  EncryptionIIVigenereCipher: "Encryption II: Vigenère Cipher",
  SquareRoot: "Square Root",
  TotalPrimesInRange: "Total Number of Primes",
  LargestRectangleInAMatrix: "Largest Rectangle in a Matrix",
};

// Reiner Typ im Original ("Pick<CodingContractTypes, ...>"). Einige Dateien
// importieren ihn ohne das Schluesselwort `type`, weshalb Nodes Typenschnitt
// den Import stehen laesst und ein Laufzeit-Export existieren muss.
export const CodingContractTypes = {};

// utils/helpers/getRandomIntInclusive.ts
export function getRandomIntInclusive(min, max) {
  if (!Number.isInteger(min)) throw new Error(`Min is not an integer. Min: ${min}.`);
  if (!Number.isInteger(max)) throw new Error(`Max is not an integer. Max: ${max}.`);
  if (min > max) throw new Error(`Min is greater than max. Min: ${min}. Max: ${max}.`);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// utils/helpers/randomBigIntExclusive.ts
export function randomBigIntExclusive(size) {
  const bits = size.toString(16);
  if (bits.length <= 12) {
    return BigInt(Math.floor(Math.random() * Number(size)));
  }
  const highpart = parseInt(bits.slice(0, 12), 16) + 1;
  let result;
  do {
    let str = "0x" + Math.floor(Math.random() * highpart).toString(16);
    let i = 12;
    for (; i + 12 < bits.length; i += 12) {
      str += Math.floor(Math.random() * 2 ** 48).toString(16);
    }
    const halfmul = 1 << (2 * (bits.length - i));
    str += Math.floor(Math.random() * halfmul * halfmul).toString(16);
    result = BigInt(str);
  } while (result >= size);
  return result;
}

// utils/helpers/exceptionAlert.ts - im Spiel ein Fehlerdialog. Hier muss er
// laut werden: ruft ein solver ihn auf, ist die Eingabe kaputt und das
// Ergebnis der Pruefung waere sonst stillschweigend "falsch".
export function exceptionAlert(error) {
  throw error instanceof Error ? error : new Error(String(error));
}

// CodingContract/ContractTypes.ts
export function removeBracketsFromArrayString(str) {
  let strCpy = str;
  if (strCpy.startsWith("[")) strCpy = strCpy.slice(1);
  if (strCpy.endsWith("]")) strCpy = strCpy.slice(0, -1);
  return strCpy;
}

export function parseArrayString(answer, isArrayOfArray = false) {
  let modifiedAnswer = answer.trim();
  if (isArrayOfArray && modifiedAnswer === "[]") return [];
  if (!modifiedAnswer.startsWith("[")) {
    modifiedAnswer = `[${modifiedAnswer}]`;
  } else if (isArrayOfArray && !modifiedAnswer.startsWith("[[")) {
    modifiedAnswer = `[${modifiedAnswer}]`;
  }
  try {
    return JSON.parse(modifiedAnswer);
  } catch (error) {
    return null;
  }
}

export function removeQuotesFromString(str) {
  let strCpy = str;
  if (strCpy.startsWith('"') || strCpy.startsWith("'")) strCpy = strCpy.slice(1);
  if (strCpy.endsWith('"') || strCpy.endsWith("'")) strCpy = strCpy.slice(0, -1);
  return strCpy;
}

export function convert2DArrayToString(arr) {
  const components = [];
  for (const e of arr) {
    let s = String(e);
    s = ["[", s, "]"].join("");
    components.push(s);
  }
  return components.join(",").replace(/\s/g, "");
}
