// Liest die Kennwerte des Bereichs NETZ (Coding Contracts, DarkNet,
// Infiltration) aus einem Spielstand (backups/*.json.gz). Nur lesen.
// Aufruf: node tools/audit/netz-save.mjs [muster]
// Ohne Muster: der juengste Stand. Muster ist ein Teilstring des Dateinamens.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function loadSave(file) {
  const raw = fs.readFileSync(file);
  const save = JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
  const player = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);
  return { save, player, servers };
}

export function pickFile(pattern) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz"));
  const hits = pattern ? files.filter((f) => f.includes(pattern)) : files;
  hits.sort();
  return hits.length ? path.join(dir, hits[hits.length - 1]) : null;
}

function mapEntries(m) {
  if (!m) return [];
  if (m.ctor === "JSONMap") return m.data;
  if (Array.isArray(m)) return m;
  return Object.entries(m);
}

export function netzState(file) {
  const { save, player: p, servers } = loadSave(file);
  // Vertraege im Netz zaehlen
  let contracts = 0;
  const contractHosts = [];
  for (const [name, s] of Object.entries(servers)) {
    const d = s.data || s;
    const n = (d.contracts || []).length;
    if (n) { contracts += n; contractHosts.push(name + ":" + n); }
  }
  const home = servers.home && (servers.home.data || servers.home);
  const programs = home ? home.programs : [];
  const ms = p.moneySourceA && (p.moneySourceA.data || p.moneySourceA);
  const msB = p.moneySourceB && (p.moneySourceB.data || p.moneySourceB);
  let dnet = null;
  try { dnet = save.data.DarknetSave ? JSON.parse(save.data.DarknetSave) : null; } catch { dnet = "unlesbar"; }
  let infil = null;
  try { infil = save.data.InfiltrationsSave ? JSON.parse(save.data.InfiltrationsSave) : null; } catch { infil = "unlesbar"; }
  const darknetServers = Object.entries(servers).filter(([, s]) => s.ctor === "DarknetServer").length;
  return {
    file: path.basename(file),
    bitNodeN: p.bitNodeN,
    hSinceAug: p.playtimeSinceLastAug / 3.6e6,
    hSinceNode: p.playtimeSinceLastBitnode / 3.6e6,
    totalPlaytimeH: p.totalPlaytime / 3.6e6,
    money: p.money,
    skills: p.skills,
    mults: { charisma: p.mults.charisma, charisma_exp: p.mults.charisma_exp, crime_money: p.mults.crime_money,
      crime_success: p.mults.crime_success, dnet_money: p.mults.dnet_money, faction_rep: p.mults.faction_rep },
    sourceFiles: mapEntries(p.sourceFiles),
    factions: p.factions,
    jobs: p.jobs,
    karma: p.karma,
    contractsOnNet: contracts,
    contractHosts,
    programs,
    hasTor: home ? (home.serversOnNetwork || []).includes("darkweb") : null,
    darknetServers,
    darknetSave: dnet && typeof dnet === "object" ? Object.keys(dnet.data || dnet) : dnet,
    infiltrationSave: infil,
    moneySourceA: ms ? { codingcontract: ms.codingcontract, darknet: ms.darknet, infiltration: ms.infiltration,
      hacking: ms.hacking, crime: ms.crime, total: ms.total } : null,
    moneySourceB: msB ? { codingcontract: msB.codingcontract, darknet: msB.darknet, infiltration: msB.infiltration,
      hacking: msB.hacking, crime: msB.crime, total: msB.total } : null,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = pickFile(process.argv[2]);
  if (!file) { console.error("kein Stand gefunden"); process.exit(1); }
  console.log(JSON.stringify(netzState(file), null, 1));
}
