/**
 * Die Nachtsteuerung.
 *
 * WAS SIE TUT
 *
 * Sie haelt die Faktionsarbeit auf der Faktion, bei der die naechste noch
 * fehlende Augmentierung am fruehesten faellt, und laesst kaufen, sobald welche
 * in Reichweite kommt. Das ist alles - und genau das fehlt fuer einen
 * Nachtlauf. Reputation sammelt der Bot von allein; was er nicht kann, ist
 * merken, dass eine Faktion erschoepft ist.
 *
 * WARUM AUF DER NODE-SEITE
 *
 * Reputation und Augmentierungsbesitz sind aus einem Skript im Spiel nicht
 * lesbar - dafuer braeuchte es ns.singularity.*, also Source-File 4. Von hier
 * aus geht es: Die Bruecke liefert den vollstaendigen Spielstand. Und der Weg
 * zurueck ins Spiel fuehrt ueber den Auftragslaeufer des Autopiloten, der
 * Skripte per ns.exec startet. Kein Browserzugriff, keine Freigabeabfragen.
 *
 * WAS SIE AUSDRUECKLICH NICHT TUT
 *
 * Keinen Reset. Der Ablauf hat sieben Schritte, musste am 20.08. dreimal
 * mitten in der Durchfuehrung repariert werden, und das Aktiendepot muss vorher
 * liquidiert werden, sonst ist es ersatzlos weg. Das gehoert in eine Sitzung,
 * die mitdenken kann. Die Nacht liefert die Vorarbeit - die ist der lange Teil.
 *
 * DIE LEHRE AUS DEM ALTEN NACHTDIENST
 *
 * Der lief bis zum 19.08. und "verbrannte nebenher Milliarden in NeuroFlux"
 * (src/autopilot.js:449-452), weshalb er stillgelegt wurde. Der Grund steckt im
 * Preisfaktor: Jeder Posten in der Kaufwarteschlange verteuert den naechsten um
 * 1,9 (AugmentationHelpers.ts:29-37). Bei den 25 NeuroFlux-Stufen, die
 * buyaugs.js von Haus aus betrachtet, waere der Faktor 1,9^25 - also gut vier
 * Millionen. Danach ist keine einzige richtige Augmentierung mehr bezahlbar.
 * Diese Steuerung ruft buyaugs.js deshalb immer mit --nfgdepth 0 auf.
 * NeuroFlux wird zuletzt gekauft, unmittelbar vor dem Install, von Hand.
 *
 * Aufruf:  node tools/nightshift.js            laeuft bis Strg+C
 *          node tools/nightshift.js --once     ein Durchgang, dann Schluss
 *          node tools/nightshift.js --dry      entscheidet, beauftragt aber nicht
 */

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8795";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const QUELLE = path.join(HIER, "..", "reference", "bitburner-src", "src", "Augmentation");
const LOGDIR = path.join(HIER, "..", "nightshift", "log");

const ARGS = process.argv.slice(2);
const EINMAL = ARGS.includes("--once");
const DRY = ARGS.includes("--dry");

// Eine festgenagelte Arbeitsfaktion. Die Zielfunktion dieser Steuerung kennt
// nur Augmentierungen - sie wuerde eine Faktion mit leerem Katalog nie
// waehlen, selbst wenn dort das Wertvollste ueberhaupt zu holen ist.
//
// Genau dieser Fall ist am 21.08. eingetreten: Tian Di Hui bietet uns keine
// Augmentierung mehr, steht aber bei Favor 124. Ab Favor 150 darf man spenden,
// und Spenden kauft Reputation zum 36,7-fachen der Arbeitsrate
// (Faction/formulas/donation.ts). Das ist der eine Hebel, der Geld - wovon wir
// zu viel haben - dauerhaft in Reputation verwandelt, den eigentlichen
// Engpass. Keine Augmentierung wiegt das auf.
//
// Aufruf:  node tools/nightshift.js --fix "Tian Di Hui"
const fixIndex = ARGS.indexOf("--fix");
const FIX = fixIndex >= 0 ? (ARGS[fixIndex + 1] || "").trim() : "";

// Takt. Drei Minuten reichen: Die Reputation waechst mit rund 8 pro Sekunde,
// eine Kaufschwelle wird also nie um mehr als ein paar hundert Reputation
// verpasst - und jeder Durchgang liest den kompletten Spielstand, das soll
// nicht im Sekundentakt passieren.
//
// Nach unten begrenzt auf 70 Sekunden: Die Ratenmessung verlangt mehr als 60
// Sekunden Abstand zwischen zwei Durchgaengen (siehe unten), sonst misst sie
// nie und der Dienst bliebe fuer immer im "Rate noch nicht gemessen" haengen.
const taktArg = Number((ARGS[ARGS.indexOf("--takt") + 1] || ""));
const TAKT_MS = ARGS.includes("--takt") && Number.isFinite(taktArg) && taktArg > 0
  ? Math.max(70000, taktArg * 60 * 1000)
  : 3 * 60 * 1000;

// Wie stark muss die Konkurrenz besser sein, damit gewechselt wird? Ein
// Wechsel kostet keine Reputation - die bleibt stehen -, aber er wirft den
// Vorsprung bei der bisherigen Faktion fuer die naechste Zeit weg. Er lohnt
// erst, wenn die andere die naechste Augmentierung deutlich frueher liefert.
const WECHSEL_VORTEIL = 1.6;

// Glaettung der Ratenmessung. Ein Messfenster von einer Minute schwankt stark
// (im Versuch am 20.08.: 8,6 und 18,3 Rep/s, waehrend die ehrliche
// 20-Minuten-Messung 10,7 sagte). Ungeglaettet wuerde eine Ausreisser-Messung
// eine Faktion doppelt so attraktiv aussehen lassen, wie sie ist.
const GLAETTUNG = 0.25;

// Mindestabstand zwischen zwei Kaufauftraegen. buyaugs.js navigiert durch alle
// Faktionsseiten, das dauert; oefter als alle zehn Minuten hat es keinen Sinn.
const KAUF_ABSTAND_MS = 10 * 60 * 1000;

// Ab wann gilt ein Oberflaechenskript als haengend? Ein vollstaendiger
// Kauflauf ueber fuenf Faktionsseiten braucht bis zu sieben Minuten - alles
// darueber hinaus ist keine Arbeit mehr, sondern eine Leiche.
const HAENGER_S = 10 * 60;

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  let x = n;
  while (Math.abs(x) >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return "$" + (Math.abs(x) < 10 ? x.toFixed(2) : x.toFixed(1)) + u[i];
};

const zahl = (n) => {
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
};

const uhr = () => new Date().toTimeString().slice(0, 8);

let logDatei = null;
function log(text) {
  const zeile = uhr() + "  " + text;
  console.log(zeile);
  try {
    if (!logDatei) {
      fs.mkdirSync(LOGDIR, { recursive: true });
      logDatei = path.join(LOGDIR, new Date().toISOString().slice(0, 10) + "-nightshift.log");
    }
    fs.appendFileSync(logDatei, new Date().toISOString() + "\t" + text + "\n", "utf8");
  } catch { /* ein fehlendes Protokoll darf den Lauf nicht anhalten */ }
}

// --- Zugriff ---------------------------------------------------------------

async function rpc(method, params = {}) {
  const body = await (await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, instance: "LIVE", ...params }))).json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function stand() {
  const r = await rpc("getSaveFile");
  return JSON.parse(zlib.gunzipSync(Buffer.from(r.save, "latin1")).toString("utf8"));
}

/** Dateien eines Servers aus dem Spielstand. Sie liegen als JSONMap vor. */
function dateien(sv) {
  const tf = sv.textFiles;
  const paare = (tf && tf.data) || [];
  const m = new Map();
  for (const [name, f] of paare) m.set(name, (f.data || f).text || "");
  return m;
}

// --- Aug-Katalog aus dem Quelltext -----------------------------------------

function enumTabelle(datei) {
  const roh = fs.readFileSync(datei, "utf8");
  const t = {};
  for (const m of roh.matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"/gm)) t[m[1]] = m[2];
  return t;
}

function liesAugs() {
  const augName = enumTabelle(path.join(QUELLE, "Enums.ts"));
  const facName = enumTabelle(path.join(QUELLE, "..", "Faction", "Enums.ts"));
  const roh = fs.readFileSync(path.join(QUELLE, "Augmentations.ts"), "utf8");
  const bloecke = roh.split(/\[AugmentationName\.(\w+)\]:\s*\{/).slice(1);
  const augs = [];
  for (let i = 0; i < bloecke.length; i += 2) {
    const body = bloecke[i + 1] || "";
    const name = augName[bloecke[i]] || bloecke[i];
    const rep = Number((body.match(/repCost:\s*([0-9.e+-]+)/) || [])[1]);
    const money = Number((body.match(/moneyCost:\s*([0-9.e+-]+)/) || [])[1]);
    const facRoh = (body.match(/factions:\s*\[([^\]]*)\]/s) || [])[1] || "";
    const factions = [...facRoh.matchAll(/FactionName\.(\w+)/g)].map((m) => facName[m[1]] || m[1]);
    const prereqs = [...(body.match(/prereqs:\s*\[([^\]]*)\]/s) || ["", ""])[1]
      .matchAll(/AugmentationName\.(\w+)/g)].map((m) => augName[m[1]] || m[1]);
    if (!Number.isFinite(rep) || !factions.length) continue;
    augs.push({ name, rep, money, factions, prereqs });
  }
  return augs;
}

const KATALOG = liesAugs();
const NFG = "NeuroFlux Governor";

// --- Bewertung -------------------------------------------------------------

/**
 * Wie lange dauert es bei dieser Faktion bis zur naechsten neuen
 * Augmentierung? Kleiner ist besser.
 *
 * WARUM NICHT "wie viele in vier Stunden"
 *
 * Genau so stand es im ersten Entwurf, und der Trockenlauf am 20.08. hat es
 * widerlegt: Er wollte nach zwei Takten von NiteSec (8.100 Reputation) zu
 * The Black Hand (1.600) wechseln, nur weil dort mehr Augmentierungen im
 * Katalog stehen. Der Vorsprung von 6.500 Reputation waere weggeworfen worden,
 * und die naechste Augmentierung haette sich dadurch nach HINTEN verschoben.
 *
 * Die Zahl der Kandidaten sagt nichts darueber, wann der naechste tatsaechlich
 * faellt - und nur das entscheidet, wo die naechste Stunde am besten aufgehoben
 * ist. Reputation geht bei einem Wechsel nicht verloren, die Faktion laesst
 * sich also spaeter jederzeit nachholen.
 *
 * Die Rate haengt am Favor der Faktion: favorMult = 1 + favor/100
 * (PersonObjects/formulas/reputation.ts:9). basisRate ist deshalb auf Favor 0
 * normiert, sonst waere der Vergleich zweier Faktionen schief.
 */
function bewerte(fac, rep, favor, basisRate, habe, imKorb) {
  const rate = basisRate * (1 + favor / 100);
  const offen = KATALOG.filter((a) => a.name !== NFG
    && a.factions.includes(fac)
    && !habe.has(a.name) && !imKorb.has(a.name));
  const jetzt = offen.filter((a) => a.rep <= rep);
  const naechste = offen.filter((a) => a.rep > rep).sort((x, y) => x.rep - y.rep)[0] || null;
  // Gemessen wird die Zeit bis zur naechsten NOCH NICHT erreichbaren
  // Augmentierung - was schon erreichbar ist, zaehlt hier ausdruecklich nicht.
  //
  // Der erste Entwurf setzte die Wartezeit auf null, sobald irgendwo etwas
  // kaufbar war, und wollte deshalb dorthin wechseln. Das ist falsch: Ein Kauf
  // braucht nur die Reputation, nicht die Arbeit. Was gekauft werden kann,
  // wird gekauft, egal wo gerade gearbeitet wird - fuer die Frage, wo die
  // naechste Stunde am besten aufgehoben ist, zaehlt allein, wo der naechste
  // noch fehlende Posten frueher faellt.
  //
  // Ist gar nichts mehr offen, ist die Faktion erschoepft: unendlich.
  const wartet = naechste ? (naechste.rep - rep) / rate : Infinity;
  return { fac, rep, favor, rate, jetzt, naechste, offen: offen.length, wartet };
}

/**
 * Notfallwahl, wenn gar keine Arbeit laeuft und auch keine Wunschfaktion
 * hinterlegt ist. Ohne Ratenmessung laesst sich nicht rechnen, deshalb die
 * schlichte Regel: die Faktion mit der niedrigsten noch offenen Schwelle,
 * gemessen am Abstand zur eigenen Reputation.
 */
function bevorzugteFaktion(mitglied, f, habe, korb) {
  let beste = null;
  let bestAbstand = Infinity;
  for (const k of mitglied) {
    const d = (f[k] && (f[k].data || f[k])) || {};
    const rep = Number.isFinite(d.playerReputation) ? d.playerReputation : 0;
    for (const a of KATALOG) {
      if (a.name === NFG || !a.factions.includes(k)) continue;
      if (habe.has(a.name) || korb.has(a.name)) continue;
      const abstand = Math.max(0, a.rep - rep);
      if (abstand < bestAbstand) { bestAbstand = abstand; beste = k; }
    }
  }
  return beste;
}

const dauer = (s) => {
  if (!Number.isFinite(s)) return "nie";
  const h = s / 3600;
  return h < 1 ? (s / 60).toFixed(0) + " min" : h.toFixed(1) + " h";
};

// --- Ein Durchgang ---------------------------------------------------------

let letzterKauf = 0;
let letzterWechsel = 0;
let letzteFaktion = null;
let basisRate = null;      // Rep/s, normiert auf die Faktion, wo gemessen wurde
let messungRep = null;     // { fac, rep, t }

let rundeZuletzt = null;    // Rundenzaehler beim vorigen Durchgang
let rundeZeit = null;

async function durchgang() {
  const s = await stand();
  // Die Telemetrie liegt NICHT im Spielstand - sie kommt getrennt von der
  // Bruecke. Ohne diese Zeile lief die Drosselungserkennung weiter unten in
  // ein "tele is not defined" und riss den ganzen Durchgang mit; das Protokoll
  // meldete es brav, aber die Steuerung tat drei Takte lang nichts.
  const tele = await (await fetch(BASE + "/api/state")).json();
  const p = JSON.parse(s.data.PlayerSave).data;
  const f = JSON.parse(s.data.FactionsSave);
  const server = Object.values(JSON.parse(s.data.AllServersSave)).map((x) => x.data);
  const home = server.find((x) => x.hostname === "home");
  const homeDateien = dateien(home);

  const habe = new Set((p.augmentations || []).map((a) => a.name));
  const korb = new Set((p.queuedAugmentations || []).map((a) => a.name));
  const mitglied = p.factions || [];
  const w = p.currentWork && (p.currentWork.data || p.currentWork);
  const arbeitAn = w && w.factionName ? w.factionName : null;

  const repVon = (k) => {
    const d = (f[k] && (f[k].data || f[k])) || {};
    return Number.isFinite(d.playerReputation) ? d.playerReputation : 0;
  };
  const favorVon = (k) => {
    const d = (f[k] && (f[k].data || f[k])) || {};
    return Number.isFinite(d.favor) ? d.favor : 0;
  };

  // --- Rate messen. Ohne eigene Messung waere jede Vorhersage geraten. ------
  //
  // Gespeichert wird die auf Favor 0 NORMIERTE Rate. Gemessen werden kann sie
  // immer nur bei der Faktion, an der gerade gearbeitet wird, und deren Favor
  // geht als Faktor 1 + favor/100 ein. Ohne die Normierung waere eine bei
  // Tian Di Hui (Favor 89) gemessene Rate bei NiteSec (Favor 15) um zwei
  // Drittel zu hoch angesetzt.
  if (arbeitAn) {
    const jetztRep = repVon(arbeitAn);
    const favorHier = favorVon(arbeitAn);
    if (messungRep && messungRep.fac === arbeitAn) {
      const dt = (Date.now() - messungRep.t) / 1000;
      const dr = jetztRep - messungRep.rep;
      if (dt > 60 && dr > 0) {
        const roh = (dr / dt) / (1 + favorHier / 100);
        // Glaetten statt ersetzen - siehe GLAETTUNG. Beim allerersten Wert gibt
        // es nichts zu glaetten, der wird uebernommen.
        basisRate = basisRate === null ? roh : GLAETTUNG * roh + (1 - GLAETTUNG) * basisRate;
        messungRep = { fac: arbeitAn, rep: jetztRep, t: Date.now() };
      }
    } else {
      // Nach einem Wechsel neu ansetzen: Eine Messung ueber zwei Faktionen
      // hinweg waere ein Mischwert aus zwei Favor-Faktoren.
      messungRep = { fac: arbeitAn, rep: jetztRep, t: Date.now() };
    }
  }

  // --- Laeuft ueberhaupt Arbeit? ------------------------------------------
  //
  // Wenn nicht, ist das der teuerste aller Zustaende: Der Bot verdient Geld,
  // das er nicht braucht, und sammelt keine einzige Reputation. Es muss sofort
  // etwas angesetzt werden - und zwar VOR jeder Ratenmessung, denn ohne Arbeit
  // gibt es nichts zu messen, und der Dienst wuerde die ganze Nacht auf eine
  // Rate warten, die nie kommt. (Genau diese Sackgasse stand im ersten
  // Entwurf.)
  if (!arbeitAn) {
    // Nur Faktionen, in denen wir MITGLIED sind. data/workfaction.txt
    // ueberlebt den Reset, die Mitgliedschaften nicht - unmittelbar nach dem
    // Install stand dort noch "BitRunners", und die Steuerung setzte
    // prompt work.js darauf an. Das scheitert an der Faktionsseite, kostet
    // aber einen Auftragsplatz und blockiert die Oberflaeche fuer nichts.
    const gemerkt = (homeDateien.get("data/workfaction.txt") || "").trim();
    const wunsch = (mitglied.includes(gemerkt) ? gemerkt : null)
      || bevorzugteFaktion(mitglied, f, habe, korb)
      || mitglied[0];
    if (!wunsch) {
      log("KEINE Faktionsarbeit und keine Mitgliedschaft - nach einem Reset ist"
        + " das normal: Der Autopilot muss erst Backdoors setzen und Einladungen"
        + " annehmen.");
      return;
    }
    const platzFrei0 = (homeDateien.get("data/task.txt") || "").trim() === "";
    log("KEINE Faktionsarbeit - ohne sie laeuft keine Reputation. Setze " + wunsch + " an.");
    if (!DRY && platzFrei0) {
      await rpc("pushFile", {
        filename: "data/task.txt",
        content: JSON.stringify(["work.js", wunsch]),
        server: "home",
      });
    }
    messungRep = null;
    return;
  }

  if (!basisRate) {
    log("Rate noch nicht gemessen (braucht zwei Durchgaenge auf derselben Faktion) - warte.");
    return;
  }

  // --- Faktionen bewerten --------------------------------------------------
  const bewertet = mitglied
    .map((k) => bewerte(k, repVon(k), favorVon(k), basisRate, habe, korb))
    .sort((a, b) => a.wartet - b.wartet || b.offen - a.offen);

  const zeile = bewertet.filter((b) => b.offen).map((b) => b.fac + " "
    + (b.jetzt.length ? b.jetzt.length + " sofort" : dauer(b.wartet))).join(", ");
  const rateHier = basisRate * (1 + (arbeitAn ? favorVon(arbeitAn) : 0) / 100);
  log("Lage: " + habe.size + " Augs installiert, " + korb.size + " im Korb, "
    + rateHier.toFixed(1) + " Rep/s bei " + (arbeitAn || "-")
    + ". Naechste Augmentierung: " + (zeile || "nirgends"));

  // --- Laeuft das Spiel ueberhaupt normal? --------------------------------
  // Der Rundenzaehler des Autopiloten ist der ehrlichste Taktgeber, den wir
  // von aussen haben. Bleibt er stehen, laeuft das Spiel gedrosselt - und dann
  // sind lange Skriptlaufzeiten normal statt verdaechtig.
  const rundeJetzt = Number((tele.telemetry || {}).cycle);
  let rundenRate = null;
  if (rundeZuletzt !== null && rundeZeit) {
    const min = (Date.now() - rundeZeit) / 60000;
    if (min > 0.5) rundenRate = (rundeJetzt - rundeZuletzt) / min;
  }
  if (rundeZuletzt === null || rundenRate !== null) {
    rundeZuletzt = rundeJetzt;
    rundeZeit = Date.now();
  }
  // Unter 10 Runden je Minute gilt als gedrosselt (normal sind rund 16).
  // Solange nichts gemessen ist, wird NICHT von Drosselung ausgegangen - aber
  // auch nicht gekillt, weil die Laufzeitschwelle ohnehin erst greift.
  const gedrosselt = rundenRate !== null && rundenRate < 10;

  // --- Ist der Auftragsplatz frei? ----------------------------------------
  // data/task.txt ist EIN Platz. Der Autopilot leert ihn, sobald er den
  // Auftrag gestartet hat (autopilot.js:835). Steht dort etwas, wartet noch
  // ein Auftrag - dann darf hier nichts geschrieben werden, sonst geht der
  // andere verloren.
  const platzFrei = (homeDateien.get("data/task.txt") || "").trim() === "";
  if (!platzFrei) {
    log("Auftragsplatz belegt - dieser Durchgang laesst ihn in Ruhe.");
    return;
  }

  // --- Laeuft schon ein Oberflaechenskript? -------------------------------
  //
  // Ein freier Auftragsplatz heisst nur, dass kein Auftrag WARTET - nicht,
  // dass keiner LAEUFT. Und zwei Skripte, die gleichzeitig navigieren, reissen
  // einander die Seite weg. Genau das ist am 20.08. passiert: buyaugs.js hatte
  // zwei von fuenf Faktionsseiten gelesen, als work.js dazwischenfuhr; der
  // Kauflauf brach mittendrin ab und kaufte nichts.
  //
  // buyaugs.js braucht mehrere Minuten, weil es jede Faktionsseite einzeln
  // ansteuert. In der Zeit darf hier gar nichts passieren.
  const OBERFLAECHE = /^(buyaugs|work|joinfac|darkweb|travel|homeram|buyone|stockaccess)\.js$/;
  const laufend = [];
  for (const sv of server) {
    for (const rs of (sv.runningScripts || [])) {
      const d = rs.data || rs;
      if (OBERFLAECHE.test(d.filename || "")) {
        const sekunden = Math.round(Number(d.onlineRunningTime) || 0);
        laufend.push({ sekunden, text: d.filename + " auf " + sv.hostname + " seit " + sekunden + "s" });
      }
    }
  }
  if (laufend.length) {
    // ...es sei denn, es haengt. Ein Oberflaechenskript, das nicht mehr
    // weiterkommt, legt den ganzen Betrieb stil: Autopilot und Nachtsteuerung
    // warten beide korrekt, und niemand raeumt die Leiche weg. In der Nacht
    // zum 21.08. stand buyaugs.js dreizehn Minuten bei "Runde 1: Zustand
    // lesen" - der Augmentierungskauf ruhte so lange vollstaendig.
    //
    // Zehn Minuten sind grosszuegig: Ein vollstaendiger Kauflauf ueber fuenf
    // Faktionsseiten mit mehreren Kaufrunden braucht bis zu sieben.
    // ...aber nur, wenn das Spiel ueberhaupt normal laeuft. Steht der
    // Bitburner-Tab im Hintergrund, drosselt der Browser seine Timer: in der
    // Nacht zum 21.08. gemessen als EINE Spielrunde pro Minute statt sechzehn.
    // Skripte kriechen dann, und ein voellig gesunder Kauflauf braucht statt
    // fuenf Minuten ueber eine Stunde. Wer in diesem Zustand aufraeumt, killt
    // genau die Arbeit, die er schuetzen soll - und zwar immer wieder, denn
    // der naechste Lauf ist genauso langsam.
    const langlaeufer = gedrosselt ? [] : laufend.filter((x) => x.sekunden > HAENGER_S);
    if (gedrosselt && laufend.some((x) => x.sekunden > HAENGER_S)) {
      log("Langlaeufer vorhanden, aber das Spiel ist gedrosselt ("
        + rundenRate.toFixed(1) + " Runden/min statt ~16) - das ist Langsamkeit,"
        + " kein Haenger. Es wird nichts beendet.");
    }
    if (langlaeufer.length) {
      log("HAENGER: " + langlaeufer.map((x) => x.text).join(", ")
        + " - wird beendet, sonst ruht der Betrieb bis zum Morgen.");
      if (!DRY) {
        await rpc("pushFile", {
          filename: "data/task.txt",
          content: JSON.stringify(["killui.js"]),
          server: "home",
        });
      }
      return;
    }
    log("Oberflaechenskript laeuft (" + laufend.map((x) => x.text).join(", ")
      + ") - nichts beauftragen, sonst reissen sie einander die Seite weg.");
    return;
  }

  const beauftrage = async (teile, warum) => {
    log("-> " + warum + "   " + JSON.stringify(teile));
    if (DRY) return;
    await rpc("pushFile", {
      filename: "data/task.txt",
      content: JSON.stringify(teile),
      server: "home",
    });
  };

  // --- 1. Kaufen, wenn etwas erreichbar ist -------------------------------
  // Vor dem Wechsel: Was hier erreichbar ist, soll erst eingesammelt werden.
  const hier = bewertet.find((b) => b.fac === arbeitAn);
  const sofort = bewertet.flatMap((b) => b.jetzt);
  if (sofort.length && Date.now() - letzterKauf > KAUF_ABSTAND_MS) {
    letzterKauf = Date.now();
    // --nfgdepth 0: siehe Kopf. NeuroFlux wuerde die Warteschlange fluten und
    // ueber den Preisfaktor 1,9 je Posten alles andere unbezahlbar machen.
    await beauftrage(["buyaugs.js", "--nfgdepth", "0", "--max", "8"],
      sofort.length + " Augmentierung(en) erreichbar: "
      + sofort.slice(0, 4).map((a) => a.name).join(", ")
      + (sofort.length > 4 ? " ..." : ""));
    return;
  }

  // --- 2. Faktion wechseln, wenn die naechste woanders deutlich frueher faellt
  if (FIX) {
    if (arbeitAn !== FIX) {
      if (!mitglied.includes(FIX)) {
        log("Festgelegte Faktion \"" + FIX + "\" - wir sind dort kein Mitglied.");
        return;
      }
      await rpc("pushFile", { filename: "data/workfaction.txt", content: FIX, server: "home" });
      await beauftrage(["work.js", FIX], "Festgelegte Faktion: zurueck zu " + FIX);
      messungRep = null;
      return;
    }
    log("Bleibt bei " + FIX + " (festgelegt). Kein Wechsel, egal was anderswo faellig waere.");
    return;
  }

  const beste = bewertet[0];
  if (!beste || !Number.isFinite(beste.wartet)) {
    log("Bei keiner Mitgliedsfaktion ist noch eine Augmentierung offen."
      + "  Das ist der Punkt, an dem ein Reset faellig ist - der wird von Hand"
      + " ausgeloest, nicht hier.");
    return;
  }
  const wartetHier = hier ? hier.wartet : Infinity;
  const lohntWechsel = beste.fac !== arbeitAn
    // Erschoepft: dann sofort weg, egal wie gut die Alternative ist.
    && (!Number.isFinite(wartetHier)
      || beste.wartet * WECHSEL_VORTEIL < wartetHier);

  if (lohntWechsel) {
    // Flattern verhindern: nicht zweimal hintereinander dieselbe Faktion
    // ansteuern, wenn wir gerade erst von dort kamen.
    if (letzteFaktion === arbeitAn && Date.now() - letzterWechsel < KAUF_ABSTAND_MS) {
      log("Wechsel nach " + beste.fac + " zurueckgestellt - der letzte liegt keine"
        + " zehn Minuten zurueck.");
      return;
    }
    letzteFaktion = arbeitAn;
    letzterWechsel = Date.now();
    // Auch DAS ist ein Eingriff ins Spiel und gehoert hinter die
    // Trockenlauf-Sperre. Im ersten Entwurf stand es davor - der "Trockenlauf"
    // am 20.08. hat die Arbeitsfaktion daraufhin tatsaechlich auf The Black
    // Hand umgestellt, weil der Autopilot data/workfaction.txt naechste Runde
    // gelesen hat. Ein Trockenlauf, der irgendetwas schreibt, ist keiner.
    if (!DRY) {
      await rpc("pushFile", { filename: "data/workfaction.txt", content: beste.fac, server: "home" });
    }
    await beauftrage(["work.js", beste.fac],
      "Wechsel " + (arbeitAn || "-") + " -> " + beste.fac
      + " (naechste Augmentierung dort in " + dauer(beste.wartet)
      + " statt " + dauer(wartetHier) + " hier)");
    // Die Messung gehoert zur alten Faktion und ist nach dem Wechsel wertlos.
    messungRep = null;
    return;
  }

  if (hier && hier.naechste) {
    log("Bleibt bei " + arbeitAn + ". Naechstes Ziel " + hier.naechste.name
      + " in " + dauer(hier.wartet) + " (" + zahl(hier.naechste.rep - hier.rep) + " Rep).");
  } else {
    log("Bleibt bei " + (arbeitAn || "-") + " - nichts zu tun.");
  }
}

// --- Hauptschleife ---------------------------------------------------------

/**
 * Doppelstartschutz ueber eine Herzschlagdatei.
 *
 * Zwei Nachtsteuerungen wuerden sich um denselben Auftragsplatz streiten -
 * `data/task.txt` ist ein einzelner Platz, und wer als Zweiter schreibt,
 * loescht den Auftrag des Ersten. Der Fall ist heute Abend real: Eine
 * Instanz laeuft aus meiner Sitzung, eine zweite startet Eric per nacht.cmd,
 * bevor er schlafen geht.
 *
 * Die Datei traegt einen Zeitstempel, der bei jedem Durchgang erneuert wird.
 * Ist sie juenger als zwei Takte, laeuft nachweislich noch jemand - dann
 * beendet sich der Neuankoemmling. Ist sie aelter, war es eine Leiche (Fenster
 * geschlossen, Rechner neu gestartet), und der Platz ist frei. Ein PID-Vergleich
 * waere hier untauglich: Nach einem Neustart kann dieselbe Nummer laengst
 * einem fremden Programm gehoeren.
 */
const HERZSCHLAG = path.join(HIER, "..", "data", "nightshift-heartbeat");

function schonUnterwegs() {
  try {
    const alter = Date.now() - Number(fs.readFileSync(HERZSCHLAG, "utf8").trim());
    if (Number.isFinite(alter) && alter < TAKT_MS * 2) return Math.round(alter / 1000);
  } catch { /* keine Datei = niemand da, das ist der Normalfall */ }
  return 0;
}

function herzschlag() {
  try {
    fs.mkdirSync(path.dirname(HERZSCHLAG), { recursive: true });
    fs.writeFileSync(HERZSCHLAG, String(Date.now()), "utf8");
  } catch { /* darf den Lauf nicht anhalten */ }
}

async function main() {
  const laeuftSchon = schonUnterwegs();
  if (laeuftSchon) {
    log("Es laeuft bereits eine Nachtsteuerung (Herzschlag vor " + laeuftSchon
      + " s). Diese hier beendet sich - zwei wuerden einander die Auftraege"
      + " ueberschreiben.");
    return;
  }
  herzschlag();

  log("Nachtsteuerung gestartet." + (DRY ? "  TROCKENLAUF - es wird nichts beauftragt." : "")
    + "  Takt " + (TAKT_MS / 60000) + " min, Wechsel ab Faktor " + WECHSEL_VORTEIL + ".");
  log("Sie loest KEINEN Reset aus und kauft KEIN NeuroFlux - beides von Hand.");

  for (;;) {
    herzschlag();
    try {
      await durchgang();
    } catch (e) {
      // Ein einzelner Fehlschlag darf die Nacht nicht beenden. Die Bruecke
      // kann kurz weg sein, ohne dass etwas kaputt ist.
      log("FEHLER im Durchgang: " + e.message);
    }
    if (EINMAL) return;
    await new Promise((ok) => setTimeout(ok, TAKT_MS));
  }
}

main().catch((e) => log("ABGESTUERZT: " + e.message));
