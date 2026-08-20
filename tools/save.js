/**
 * Spielstand lesen - ohne Browser.
 *
 * Der Remote-API-Befehl `getSaveFile` liefert den vollstaendigen, frisch
 * erzeugten Spielstand ueber die Bruecke. Das ist aus zwei Gruenden wichtig:
 *
 *  - Es sind Dinge darin, die keine Telemetrie kennt: Faktionsmitgliedschaft
 *    und -reputation, gekaufte und installierte Augmentations, offene
 *    Einladungen, Multiplikatoren, gesetzte Backdoors.
 *  - Es braucht keinen Zugriff auf den Browser. Jede CDP-Verbindung loest in
 *    Opera eine Freigabeabfrage aus, die den Nutzer bei der Arbeit stoert -
 *    dieser Weg nicht.
 *
 * Der Stand kommt gzip-komprimiert als Bytefolge. `binary: true` heisst, dass
 * die Bruecke die Bytes als latin1-String durchreicht.
 *
 * Aufruf:
 *   node tools/save.js            Kurzfassung
 *   node tools/save.js --backdoor Backdoors der Faktionsserver
 *   node tools/save.js --augs     Augmentations im Detail
 */

import zlib from "node:zlib";

const BASE = "http://localhost:8795";
const ZIELSERVER = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "The-Cave", "fulcrumassets", "w0r1d_d43m0n"];

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return "$" + (Math.abs(n) < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

async function hole() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile");
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  const roh = Buffer.from(body.result.save, "latin1");
  const text = zlib.gunzipSync(roh).toString("utf8");
  return JSON.parse(text);
}

async function main() {
  let save;
  try {
    save = await hole();
  } catch (e) {
    console.log("Spielstand nicht lesbar: " + e.message);
    console.log("Laeuft die Bruecke? (node sync/bridge.js)");
    process.exit(1);
  }

  const p = JSON.parse(save.data.PlayerSave).data;
  const factions = JSON.parse(save.data.FactionsSave);

  const arg = process.argv[2];

  console.log("");
  console.log("  Hacking   " + p.skills.hacking + "      Geld " + geld(p.money)
    + "      Stadt " + p.city);
  const mults = p.mults || {};
  console.log("  Multiplikatoren  hacking " + (mults.hacking ?? 1).toFixed(2)
    + "  exp " + (mults.hacking_exp ?? 1).toFixed(2)
    + "  speed " + (mults.hacking_speed ?? 1).toFixed(2)
    + "  money " + (mults.hacking_money ?? 1).toFixed(2));

  console.log("");
  console.log("  Faktionen");
  if (!p.factions.length) {
    console.log("    KEINE - ohne Mitgliedschaft laeuft keine Reputation!");
  } else {
    for (const f of p.factions) {
      const d = factions[f] && factions[f].data;
      console.log("    " + f.padEnd(22) + (d ? Math.round(d.playerReputation) + " rep, "
        + (d.favor || 0).toFixed(1) + " favor" : "?"));
    }
  }
  if (p.factionInvitations && p.factionInvitations.length) {
    console.log("  Offene Einladungen: " + p.factionInvitations.join(", "));
  }

  const inst = (p.augmentations || []).map((a) => a.name || a);
  const queue = (p.queuedAugmentations || []).map((a) => a.name || a);
  console.log("");
  console.log("  Augmentations   installiert " + inst.length + ", gekauft und wartend " + queue.length);
  if (arg === "--augs") {
    for (const a of inst) console.log("    [installiert] " + a);
    for (const a of queue) console.log("    [wartet]      " + a);
  } else if (queue.length) {
    console.log("    wartend: " + queue.join(", "));
  }

  if (arg === "--backdoor" || arg === undefined) {
    const alle = JSON.parse(save.data.AllServersSave);
    const zeilen = [];
    for (const k of Object.keys(alle)) {
      const s = alle[k] && alle[k].data;
      if (!s || !ZIELSERVER.includes(s.hostname)) continue;
      zeilen.push("    " + s.hostname.padEnd(16)
        + (s.backdoorInstalled ? "Backdoor JA " : "Backdoor -- ")
        + (s.hasAdminRights ? "root " : "     ")
        + "ab Level " + s.requiredHackingSkill);
    }
    if (zeilen.length) {
      console.log("");
      console.log("  Faktionsserver");
      zeilen.sort().forEach((z) => console.log(z));
    }
  }
  console.log("");
}

main().catch((e) => console.log("Fehler: " + e.message));
