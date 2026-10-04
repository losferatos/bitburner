// VERSION-KONSTLISTE (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Zieht aus src/*.js und src/lib/*.js ALLE Konstanten der Form  const NAME = <Zahlenausdruck>  und
// Objekt-/Array-Literale aus reinen Zahlen/Strings auf Modulebene heraus (acorn-Parse, keine Regex-Raterei)
// und schreibt sie als TSV. Zweck: Triage "welche davon sind SPIELkonstanten?" - die Spielkonstanten werden
// dann gegen reference/v301 und reference/bitburner-src geprueft (version-konst.mjs).
//
// Eichung: die Zahl der gefundenen Deklarationen wird gegen eine unabhaengige Regex-Zaehlung
// (Zeilen "^(export )?const [A-Za-z_0-9]+ = <Zahl>") verglichen; Abweichung > 5 % -> Fehler.
//
// Aufruf: node tools/audit/version-konstliste.mjs [ausgabe.tsv]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const SRC = path.join(ROOT, "src");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

const dateien = [];
for (const d of ["", "lib"]) {
  for (const f of fs.readdirSync(path.join(SRC, d))) if (f.endsWith(".js")) dateien.push(d ? d + "/" + f : f);
}

function reinZahl(n) {
  if (!n) return false;
  switch (n.type) {
    case "Literal": return typeof n.value === "number";
    case "UnaryExpression": return (n.operator === "-" || n.operator === "+") && reinZahl(n.argument);
    case "BinaryExpression": return reinZahl(n.left) && reinZahl(n.right);
    case "ParenthesizedExpression": return reinZahl(n.expression);
    default: return false;
  }
}
function reinLiteral(n, tiefe = 0) {
  if (!n || tiefe > 4) return false;
  if (reinZahl(n)) return true;
  if (n.type === "Literal") return true;
  if (n.type === "ArrayExpression") return n.elements.length > 0 && n.elements.every((e) => e && reinLiteral(e, tiefe + 1));
  if (n.type === "ObjectExpression") return n.properties.length > 0 && n.properties.every((p) => p.type === "Property" && !p.computed && reinLiteral(p.value, tiefe + 1));
  if (n.type === "TemplateLiteral") return n.expressions.length === 0;
  return false;
}

const zeilen = [];
let regexZahl = 0;
for (const f of dateien) {
  const code = fs.readFileSync(path.join(SRC, f), "utf8");
  const lines = code.split("\n");
  for (const l of lines) {
    const m = /^(?:export )?const [A-Za-z_$][A-Za-z_0-9$]* = ([^;]*?);/.exec(l);
    if (m && /^[-+0-9.eE_*\/() ]+$/.test(m[1]) && /[0-9]/.test(m[1])) regexZahl++;
  }
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
  } catch (e) { console.error("PARSE-FEHLER " + f + ": " + e.message); continue; }
  for (const st of ast.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (!decl || decl.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || !d.init || !reinLiteral(d.init)) continue;
      const roh = code.slice(d.init.start, d.init.end).replace(/\s+/g, " ");
      // vorangehender Kommentar (bis 2 Zeilen darueber oder Zeilenende)
      const ln = d.loc.start.line;
      let komm = "";
      const ende = lines[ln - 1].indexOf("//");
      if (ende >= 0 && ende > lines[ln - 1].indexOf("=")) komm = lines[ln - 1].slice(ende + 2).trim();
      if (!komm) {
        for (let k = ln - 2; k >= Math.max(0, ln - 4); k--) {
          const t = lines[k].trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) komm = t.replace(/^(\/\/|\*+\/?|\/\*+)\s*/, "") + (komm ? " " + komm : "");
          else break;
        }
      }
      zeilen.push([f, ln, d.id.name, roh.length > 90 ? roh.slice(0, 87) + "..." : roh, komm.slice(0, 160)]);
    }
  }
}
const out = process.argv[2];
const text = "datei\tzeile\tname\twert\tkommentar\n" + zeilen.map((z) => z.join("\t")).join("\n") + "\n";
if (out) fs.writeFileSync(out, text);
else process.stdout.write(text);
const zahlOnly = zeilen.filter((z) => /^[-+0-9(.eE_*/ )]+$/.test(z[3])).length;
console.error(`Dateien ${dateien.length}, Literal-Konstanten ${zeilen.length} (davon reine Zahl ${zahlOnly}); Regex-Zaehlung reine Zahl-Deklarationen: ${regexZahl}`);
const diff = Math.abs(zahlOnly - regexZahl) / Math.max(1, regexZahl);
console.error("EICHUNG acorn gegen Regex: Abweichung " + (diff * 100).toFixed(1) + " % " + (diff <= 0.05 ? "OK" : "FEHLER"));
if (diff > 0.05) process.exit(2);
