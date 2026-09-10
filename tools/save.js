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

  // --json: derselbe Spielstand, aber maschinenlesbar (10.09.2026).
  //
  // WARUM DAS HIER STEHT UND NICHT IM SPIEL
  //
  // `tools/tor.js` brauchte Kampfwerte, Kampf-Erfahrung und die Frage "schon
  // in der Division?" und holte sie aus `data/bblage.json`. Diese Datei
  // schreibt `src/bblage.js`, und das steht in keiner Registry - es laeuft
  // also nur, wenn ein Mensch es von Hand startet. Am 10.09. war die Datei
  // 48 h alt und stammte aus dem VORIGEN Lauf: sie meldete `inBladeburner:
  // true` und Rang 5837, waehrend die Kampfwerte im frischen Knoten auf 1
  // standen. tor.js brach daraufhin mit "Bereits in der Division - dieses
  // Werkzeug ist hier fertig" ab, und zwar genau in der Phase, fuer die es
  // gebaut wurde.
  //
  // Der Spielstand kennt all das ohne ein einziges Byte Skript-RAM im Spiel,
  // und dieses Werkzeug liest ihn ohnehin schon. Damit haengt tor.js an einer
  // Quelle, die nicht veralten KANN - sie wird bei jedem Aufruf frisch aus
  // IndexedDB geholt.
  //
  // `bladeburner` ist im Spielstand `null`, solange man nicht beigetreten ist
  // (geprueft am 10.09. im frischen BitNode 4: `bladeburner: None`), und ein
  // Objekt danach. Das ist das verlaessliche Kennzeichen.
  //
  // Die Uhr ist `playtimeSinceLastBitnode`, NICHT die Wanduhr: Erfahrung
  // waechst in Spielzeit. Ein ausgeschalteter Rechner laesst die Wanduhr
  // laufen und die Erfahrung stehen - eine daraus gerechnete Rate ist kein
  // Fortschritt, sondern eine Pause.
  if (arg === "--json") {
    const s = p.skills, e = p.exp;
    console.log(JSON.stringify({
      wall: Date.now(),
      spielzeitMs: p.playtimeSinceLastBitnode,
      // Die Uhr SEIT DEM LETZTEN EINBAU. Ein Augmentierungs-Einbau nullt die
      // Kampf-Erfahrung, laesst `playtimeSinceLastBitnode` aber weiterlaufen.
      // Wer eine Erfahrungsrate ueber ein Fenster misst, das einen Einbau
      // enthaelt, teilt den Zuwachs NACH dem Einbau durch die Zeit VOR ihm.
      spielzeitSeitAugMs: p.playtimeSinceLastAug,
      knoten: p.bitNodeN,
      stadt: p.city,
      geld: Math.round(p.money),
      inBladeburner: p.bladeburner !== null && p.bladeburner !== undefined,
      kampf: { str: s.strength, def: s.defense, dex: s.dexterity, agi: s.agility },
      kampfExp: {
        str: Math.round(e.strength), def: Math.round(e.defense),
        dex: Math.round(e.dexterity), agi: Math.round(e.agility),
      },
      tiefstand: Math.min(s.strength, s.defense, s.dexterity, s.agility),
      // Der Erfahrungs-Multiplikator, den tor.js fuer die Gym-Rate braucht.
      // `strength_exp` ist der richtige - `strength` geht in den BEDARF, nicht
      // in die Rate (Verwechslung vom 30.08., dort Punkt 3).
      expMult: {
        str: p.mults.strength_exp, def: p.mults.defense_exp,
        dex: p.mults.dexterity_exp, agi: p.mults.agility_exp,
      },
      // Und der LEVEL-Multiplikator, der in die Skill-Formel geht. Das ist
      // ein ANDERES Feld, auch wenn beide oft gleich aussehen: `strength`
      // bestimmt, wie viel Erfahrung ein Level kostet, `strength_exp`, wie
      // schnell Erfahrung anfaellt. Am 30.08. wurde genau das verwechselt.
      levelMult: {
        str: p.mults.strength, def: p.mults.defense,
        dex: p.mults.dexterity, agi: p.mults.agility,
      },
    }));
    return;
  }

  console.log("");
  console.log("  Hacking   " + p.skills.hacking + "      Geld " + geld(p.money)
    + "      Stadt " + p.city);
  const mults = p.mults || {};
  console.log("  Multiplikatoren  hacking " + (mults.hacking ?? 1).toFixed(2)
    + "  exp " + (mults.hacking_exp ?? 1).toFixed(2)
    + "  speed " + (mults.hacking_speed ?? 1).toFixed(2)
    + "  money " + (mults.hacking_money ?? 1).toFixed(2));
  // KAMPFWERTE DAZU (27.08.2026, 14:49). In BitNode 6 und 7 traegt die
  // Bladeburner-Division den Knoten, und ihr Engpass sind die Kampfwerte -
  // dort wirkt der Multiplikator direkt auf das Level
  // (`lvl = mult * (32*ln(exp+534,6) - 200)`). Ohne diese Zeile liess sich
  // nach einem Augmentierungs-Einbau nicht ablesen, ob der Kampfterm in
  // `bn4rep.js` getragen hat.
  console.log("  Kampf-Mult       str " + (mults.strength ?? 1).toFixed(3)
    + "  def " + (mults.defense ?? 1).toFixed(3)
    + "  dex " + (mults.dexterity ?? 1).toFixed(3)
    + "  agi " + (mults.agility ?? 1).toFixed(3)
    + "  |  Erfahrung str " + (mults.strength_exp ?? 1).toFixed(3)
    + "  def " + (mults.defense_exp ?? 1).toFixed(3)
    + "  dex " + (mults.dexterity_exp ?? 1).toFixed(3)
    + "  agi " + (mults.agility_exp ?? 1).toFixed(3));
  console.log("  Bladeburner-Mult chance "
    + (mults.bladeburner_success_chance ?? 1).toFixed(3)
    + "  ausdauer " + (mults.bladeburner_max_stamina ?? 1).toFixed(3)
    + "  regen " + (mults.bladeburner_stamina_gain ?? 1).toFixed(3)
    + "  analyse " + (mults.bladeburner_analysis ?? 1).toFixed(3));

  console.log("");
  console.log("  Faktionen");
  if (!p.factions.length) {
    console.log("    KEINE - ohne Mitgliedschaft laeuft keine Reputation!");
  } else {
    for (const f of p.factions) {
      const d = factions[f] && (factions[f].data || factions[f]);
      // `playerReputation` FEHLT im Spielstand, wenn es 0 ist (30.08.2026, 09:35).
      // Das Spiel laesst Default-Werte beim Serialisieren weg. Bladeburners
      // stand deshalb nach dem Einbau mit "NaN rep" da - ausgerechnet die
      // Fraktion, deren Rep ab jetzt die zweitwichtigste Zahl des Knotens ist.
      console.log("    " + f.padEnd(22) + (d ? Math.round(d.playerReputation || 0) + " rep, "
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

// FEHLER GEHEN AUF stderr UND SETZEN DEN EXIT-CODE (10.09.2026).
//
// Vorher: `console.log(...)` und Exit 0. Ein Aufrufer, der die Ausgabe
// weiterverarbeitet, bekam damit den Fehlertext als vermeintliches Ergebnis
// und einen Erfolg gemeldet. `tools/tor.js` faengt das seit heute ueber
// `JSON.parse` ab - jeder andere Aufrufer nicht.
main().catch((e) => {
  console.error("Fehler: " + (e && e.message ? e.message : e));
  process.exit(1);
});
