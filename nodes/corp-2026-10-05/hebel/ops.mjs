// Hebel-Vorlage: Bladeburner-Vorraete (Op-Zaehler, Gemeinden, Chaos) eines Spielstands. Nur lesen.
import { load, state } from "./chance.mjs";
const g = (o) => (o && o.data) || o || {};
const asObj = (m) => { const d = g(m); return Array.isArray(d) ? Object.fromEntries(d) : d; };
const s = load(process.argv[2]); const bb = state(s).bb;
console.log(Object.keys(bb).join(" "));
for (const k of ["contracts", "operations"]) for (const [n, a] of Object.entries(asObj(bb[k]))) { const d = g(a); console.log(k, n, "count", Math.round(d.count), "level", d.level, "max", d.maxLevel, "succ", d.successes); }
for (const [n, c] of Object.entries(asObj(bb.cities))) { const d = g(c); console.log(n, "pop", d.pop?.toExponential(2), "comms", d.comms, "chaos", d.chaos?.toFixed(1)); }
