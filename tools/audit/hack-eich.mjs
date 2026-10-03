// Audit 03.10.2026, Bereich HACK: Einzeleichungen gegen den BN2-Spielstand.
// Aufruf: node tools/audit/hack-eich.mjs
import { loadSave, textFile } from "./hack-save.mjs";
const B = "backups/LIVE_197f4d61481686_BN2L1_2026-10-03T";
const a = loadSave(B + "08-33_hourly.json.gz"), b = loadSave(B + "09-19_pre-hotswap.json.gz"), c = loadSave(B + "09-59_pre-hotswap.json.gz");

// 1. Level aus Erfahrung (PersonObjects/formulas/skill.ts:7-15): floor(mult*(32*ln(exp+534.6)-200)),
//    mult = mults.hacking * HackingLevelMultiplier (BN2 0,8, BitNode.tsx:571)
const lvl = Math.floor(c.p.mults.hacking * 0.8 * (32 * Math.log(c.p.exp.hacking + 534.6) - 200));
console.log("Level: Soll", c.p.skills.hacking, "Ist", lvl);

// 2. home-Kern 1 -> 2 (PlayerObjectServerMethods.ts:42-44): 1e9 * 7.5^Kerne
const kern = 1e9 * Math.pow(7.5, a.servers.home.cpuCores);
const delta = a.p.moneySourceA.data.servers - b.p.moneySourceA.data.servers;
console.log("home-Kern: Formel", (kern / 1e9).toFixed(3), "Mrd; moneySourceA.servers 08:33->09:19", (delta / 1e9).toFixed(3),
  "Mrd (Rest = Parkausbau); Kerne", a.servers.home.cpuCores, "->", b.servers.home.cpuCores);

// 3. Mietrechner-Preis BN2 (ServerPurchases.ts:22-40, CloudServerSoftcap 1,3 BitNode.tsx:577)
const preis = (gb) => gb * 55000 * Math.pow(1.3, Math.max(0, Math.log2(gb) - 6));
console.log("Ausbau 128->256: Formel", ((preis(256) - preis(128)) / 1e6).toFixed(2), "Mio; Bot-Log '14.6m'");
console.log("Ausbau 64->128:  Formel", ((preis(128) - preis(64)) / 1e6).toFixed(2), "Mio; Bot-Log '5.6m'");

// 4. home-RAM 1024 -> 2048 (PlayerObjectServerMethods.ts:30-40), HomeComputerRamCost BN2 = 1
const ram = c.servers.home.maxRam;
console.log("home-RAM", ram, "->", 2 * ram, ":", (ram * 32000 * Math.pow(1.58, Math.log2(ram)) / 1e9).toFixed(3), "Mrd");

// 5. share-Faeden und Kernbonus auf home (Share.ts:21-24)
const intB2 = 1 + 2 * Math.pow(c.p.skills.intelligence, 0.8) / 600;
console.log("share: intBonus(int,2) =", intB2.toFixed(4), "; home-Kernbonus", (1 + (c.servers.home.cpuCores - 1) / 16).toFixed(4));

// 6. rep-modus.txt gegen bn4rep-Log im selben Stand
console.log("rep-modus.txt:", textFile(c.servers.home, "data/rep-modus.txt"), "| lastUpdate", c.p.lastUpdate,
  "| currentWork", c.p.currentWork);
