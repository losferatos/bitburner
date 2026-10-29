/**
 * netburn.js entwertet die Hacknet-Knotenmarke, sobald Server da sind
 * (29.10.2026, BN13.1: 5 Server, Hashes am Deckel, hashes.js gesperrt).
 *
 * Aufruf: node tools/test-netburn-marker.js [pfad/zu/netburn.js]
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { knotenMarkeGilt } from "../src/lib/reg.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ziel = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HIER, "../src/netburn.js");
const { main } = await import(pathToFileURL(ziel).href);

let rot = 0;
const pruefe = (was, ok, z = "") => { console.log((ok ? "  ok    " : "  ROT   ") + was + (z ? "  (" + z + ")" : "")); if (!ok) rot++; };

function fake(startKnoten, host) {
  const files = { [host]: {}, home: { "data/keine-hacknet.txt": "13" } };
  const nodes = [];
  for (let i = 0; i < startKnoten; i++) nodes.push({ level: 21, ram: 2, cores: 1 });
  const ns = {
    disableLog() {}, tprint() {}, async sleep() {},
    getHostname: () => host,
    write: (f, t) => { files[host][f] = t; },
    scp: (f, to, from) => { files[to][f] = files[from][f]; return true; },
    getPlayer: () => ({ money: 1e9, factions: ["Netburners"] }),
    format: { number: (x) => String(x) },
    singularity: { checkFactionInvitations: () => [], joinFaction: () => true,
      getAugmentationsFromFaction: () => [], getOwnedAugmentations: () => [] },
    hacknet: {
      numNodes: () => nodes.length,
      purchaseNode: () => { nodes.push({ level: 1, ram: 1, cores: 1 }); return nodes.length - 1; },
      getNodeStats: (i) => nodes[i],
      upgradeLevel: (i) => { nodes[i].level++; return true; },
      upgradeRam: (i) => { nodes[i].ram++; return true; },
      upgradeCore: (i) => { nodes[i].cores++; return true; },
    },
  };
  return { ns, files };
}

for (const host of ["home", "foodnstuff"]) {
  const { ns, files } = fake(0, host);
  await main(ns);
  pruefe("Marke auf home entwertet (Lauf auf " + host + ")",
    !knotenMarkeGilt(files.home["data/keine-hacknet.txt"], 13), files.home["data/keine-hacknet.txt"]);
}
{
  const { ns, files } = fake(0, "home");
  ns.hacknet.purchaseNode = () => -1;
  await main(ns);
  pruefe("ohne Server bleibt die Marke", knotenMarkeGilt(files.home["data/keine-hacknet.txt"], 13));
}
console.log(rot ? "ROT: " + rot : "alles gruen");
process.exit(rot ? 1 : 0);
