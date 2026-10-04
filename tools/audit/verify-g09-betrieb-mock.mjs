// G09-Betrieb, Teil F: Luecke im ns-Mock. Der Mock bildet "Infiltrate Synthoids" NICHT als Aufgabe vom Typ INFILTRATE ab
// (tools/mock/ns.js:731-760), das Spiel schon (SleeveInfiltrateWork.APICopy, Work.ts:49). Folge: der Schutz gegen das
// Neusetzen (src/sleeve.js:749-751, Fehler vom 30.08.) ist im Test unsichtbar, ein rot/gruen-Test fuer Klebrigkeit und
// Diplomacy-Neusetzen ist mit dem heutigen Mock nicht schreibbar.
// Aufruf: node tools/audit/verify-g09-betrieb-mock.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "../mock/ns.js";
import { ladeAusBeiden } from "../mock/lader.js";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const W0 = 1_700_000_000_000;
const kampf = { strength: 200, defense: 200, dexterity: 200, agility: 200 };
const m = neuerMock({
  host: "home", knoten: 2, wall: W0, playtime: 100 * 3600000, nodeReset: W0 - 24 * 3600000, augReset: W0 - 24 * 3600000, geld: 1e12,
  koerper: [{ skills: kampf }, { skills: kampf }],
  blade: { drin: true, aktionen: {
    "Contracts/Tracking": { vorrat: 100, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Bounty Hunter": { vorrat: 100, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Contracts/Retirement": { vorrat: 100, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 },
    "Operations/Raid": { vorrat: 20, stufe: 1, maxStufe: 10, chance: 0.9, dauer: 30000 } } },
  server: { home: { ram: 128, used: 0, root: true, geld: 1e9, cores: 1, ports: 0, hackLevel: 1 } },
  dateien: { home: { "data/verfahren.txt": "V2 2 2", "data/blade.json": JSON.stringify({ zeit: W0, istAktion: "Operations/Raid" }) } },
  maxSchlaf: 4,
  beiSchlaf: (ms, z, vorRuecken) => vorRuecken(1),
});
const aufrufe = [];
const orig = m.ns.sleeve.setToBladeburnerAction;
m.ns.sleeve.setToBladeburnerAction = (...a) => { aufrufe.push(a.join("|")); return orig(...a); };
const { modul } = await ladeAusBeiden(ROOT, "sleeve.js");
const zurueck = m.uhrStellen();
try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) throw e; } finally { zurueck(); }
const proSleeve = (i) => aufrufe.filter((a) => a.startsWith(i + "|Infiltrate")).length;
console.log("4 Runden, Raid knapp (20), beide Sleeves Kampf 200 -> setToBladeburnerAction-Aufrufe:", aufrufe.length);
console.log("Infiltrate-Setzungen Sleeve 0:", proSleeve(0), " Sleeve 1:", proSleeve(1), " (Spiel: je 1, danach laeuft die Aufgabe als Typ INFILTRATE weiter)");
console.log("Aufgabe im Mock:", JSON.stringify(m.zustand.koerper[0].aufgabe));
console.log(proSleeve(0) > 1 ? "BEFUND: Mock bildet Infiltrate falsch ab - Neusetzen in jeder Runde (im Spiel kaeme es nicht vor)" : "Mock bildet Infiltrate korrekt ab");
