/**
 * Knotenmarken sperren nur im eigenen Knoten (05.10.2026).
 *
 * Befund: checkin.js meldete "FEHLT: hacknet.js seit 93 min". hacknet.js
 * beendet sich ausserhalb BN9 ohne Hash-Kapazitaet gewollt und legt
 * data/keine-hacknet.txt; der Kern liess es per Sonderregel weg, die Registry
 * kannte die Sperre nicht - der Waechter fuehrte es als fehlend. Jetzt traegt
 * hacknet.js forbidsFile wie hashes.js, und dateiDa (Kern, Waechter) prueft
 * die Knotennummer in der Marke (Skeptiker: eine liegengebliebene Marke "10"
 * darf hacknet.js in BN9 nicht still sperren).
 *
 * Gegen den alten Stand ROT.
 * Aufruf: node tools/test-knotenmarke.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};
console.log("\n=== Knotenmarken knotengenau ===\n");

const reg = await import(pathToFileURL(path.join(ROOT, "src", "lib", "reg.js")).href);
pruefe("knotenMarkeGilt exportiert", typeof reg.knotenMarkeGilt === "function");
pruefe("KNOTEN_MARKEN enthaelt keine-hacknet und keine-sleeves",
  !!reg.KNOTEN_MARKEN && reg.KNOTEN_MARKEN.has("data/keine-hacknet.txt") && reg.KNOTEN_MARKEN.has("data/keine-sleeves.txt"));
if (typeof reg.knotenMarkeGilt === "function") {
  pruefe("Marke '2' gilt in Knoten 2", reg.knotenMarkeGilt("2", 2));
  pruefe("Marke '2\n' gilt in Knoten 2", reg.knotenMarkeGilt("2\n", 2));
  pruefe("Marke '10' gilt NICHT in Knoten 9", !reg.knotenMarkeGilt("10", 9));
  pruefe("leere Marke gilt nicht", !reg.knotenMarkeGilt("", 9));
  pruefe("Unsinn gilt nicht", !reg.knotenMarkeGilt("ja", 9));
}

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
const liste = registry.eintraege || registry;
const hn = liste.find((e) => e.name === "hacknet.js");
pruefe("hacknet.js sperrt per forbidsFile data/keine-hacknet.txt",
  !!hn && hn.precondition && hn.precondition.forbidsFile === "data/keine-hacknet.txt");

// Ueber gilt(): Marke im eigenen Knoten sperrt, fremde nicht.
if (hn && typeof reg.gilt === "function" && typeof reg.knotenMarkeGilt === "function") {
  const lage = (knoten, inhalt) => ({
    node: knoten, verfahren: "V2", phase: "normal", features: reg.merkmaleAusReset
      ? reg.merkmaleAusReset({ currentNode: knoten, ownedSF: new Map() }) : {},
    dateiDa: (d) => (d === "data/keine-hacknet.txt"
      ? inhalt !== null && reg.knotenMarkeGilt(inhalt, knoten) : true),
  });
  pruefe("Knoten 2, Marke '2': hacknet.js gilt nicht (kein Fehlalarm mehr)", !reg.gilt(hn, lage(2, "2")).gilt);
  pruefe("Knoten 9, alte Marke '10': hacknet.js gilt", reg.gilt(hn, lage(9, "10")).gilt, JSON.stringify(reg.gilt(hn, lage(9, "10"))));
}

const guard = fs.readFileSync(path.join(ROOT, "src", "guard.js"), "utf8");
const kern = fs.readFileSync(path.join(ROOT, "src", "bn4net.js"), "utf8");
pruefe("Waechter-dateiDa prueft Knotenmarken", guard.includes("knotenMarkeGilt(ns.read(d), ri.currentNode)"));
pruefe("Kern-dateiDa prueft Knotenmarken", kern.includes("knotenMarkeGilt(ns.read(d), ns.getResetInfo().currentNode)"));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
