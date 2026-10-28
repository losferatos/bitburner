// Prueft die Kandidatenfassung von feinWahl gegen die Lage aus dem Spielstand (06:15) - ohne Spiel.
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/blade.js", "utf8").replace(/\r\n/g, "\n");
const m = src.match(/  const feinWahl = \(hier, liste, minComms\) => \{[\s\S]*?\n  \};\n/);
if (!m) throw new Error("feinWahl nicht gefunden");
const FEIN_VORSPRUNG = 1.15, RAID_VORRAT_MIN = 3;
const feinWahl = eval("(function(FEIN_VORSPRUNG, RAID_VORRAT_MIN){" + m[0] + "; return feinWahl; })")(FEIN_VORSPRUNG, RAID_VORRAT_MIN);
const alt = eval("(function(FEIN_VORSPRUNG){" + fs.readFileSync(__dirname + "/../../src/blade.js", "utf8").replace(/\r\n/g, "\n").match(/  const feinWahl = \(hier, liste, minComms\) => \{[\s\S]*?\n  \};\n/)[0] + "; return feinWahl; })")(FEIN_VORSPRUNG);
const s = require("C:/Users/erche/AppData/Local/Temp/claude/C--Users-erche-Desktop-claude-projecto/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/save6.json");
const c = s.PlayerSave.data.bladeburner.data.cities;
const eint = (n) => ({ stadt: n, pop: c[n].data.pop, chaos: c[n].data.chaos, comms: c[n].data.comms, sicher: true });
const names = Object.keys(c); let ok = true;
const t = (label, got, want) => { const pass = got === want; ok = ok && pass; console.log((pass ? "ok   " : "FEHL ") + label + " -> " + got); };
const hier = eint("New Tokyo"), rest = names.filter((n) => n !== "New Tokyo").map(eint);
t("alt (min 55) in NT: bleibt", alt(hier, rest, 55), null);
t("neu (min 12) in NT: Volhaven", feinWahl(hier, rest, 12), "Volhaven");
// Volhaven hier: keine Aufforderung zum Wechsel, solange keiner 15 % besser ist
const vh = eint("Volhaven"); t("neu in Volhaven (1,25 Mrd): bleibt", feinWahl(vh, names.filter((n) => n !== "Volhaven").map(eint), 12), null);
// Volhaven nach 40 Raids ausgeraeumt (comms 2): sofort weg zum besten Ziel mit >= 12 Gemeinden
const leer = { ...vh, comms: 2, pop: 0.9e9 }; t("neu in leerer Stadt: geht nach Ishima", feinWahl(leer, names.filter((n) => n !== "Volhaven").map(eint), 12), "Ishima");
// Ziel unter 12 Gemeinden wird nicht gewaehlt
const klein = names.filter((n) => n !== "New Tokyo").map(eint).map((x) => x.stadt === "Volhaven" ? { ...x, comms: 5 } : x); t("Ziel mit 5 Gemeinden ausgeschlossen -> Ishima", feinWahl(hier, klein, 12), "Ishima");
// Unsichere Bevoelkerung wird nie gewaehlt
const unsicher = rest.map((x) => ({ ...x, sicher: false })); t("unsicheres r: null", feinWahl(hier, unsicher, 12), null);
console.log(ok ? "ALLES GRUEN" : "ROT"); process.exit(ok ? 0 : 1);
