/**
 * Verlauf fuer das Dashboard (29.10.2026).
 *
 * Die Bruecke haelt alle SAMPLE_MS eine kleine Probe der Lage fest - Rang,
 * Chance, Geld, Hacking, Knoten und Lauf - und schreibt sie in eine Datei
 * unter data/. Das Dashboard zeichnet daraus den Rangverlauf gegen den
 * Vorlauf (doku/rangkurve-bnN.json).
 *
 * Warum hier und nicht im Spiel: Im Spiel kostet jede Datei RAM-Zeit und
 * Werkbankplatz, und die Bruecke liest bn4net.json ohnehin alle 2 s. Warum
 * nicht im Dashboard (localStorage): dann gaebe es nur Verlauf, solange
 * jemand die Seite offen hat.
 *
 * Bewusst ohne Abhaengigkeit von bridge.js: `request` wird hereingereicht,
 * damit tools/test-history.js das Modul ohne Spiel pruefen kann.
 *
 * Keine Probe, wenn das Spiel nicht antwortet. Luecken im Verlauf sind
 * ehrlich - eine fortgeschriebene Zahl waere es nicht.
 *
 * DIE UHR IST DIE MOTORUHR (Skeptiker 29.10.2026). `totalPlaytime` (pt)
 * bekommt die Offline-Zeit beim Laden voll gutgeschrieben; eine Achse in pt
 * verschiebt nach einer Nacht alles um die Nachtlaenge. `motor`
 * (bn4net.motorTimeMs, src/lib/motorzeit.js) zaehlt nur Takte, in denen der
 * Bot wirklich lief - dieselbe Groessenordnung wie die bereinigte Spielzeit
 * der Referenzkurve. pt bleibt in der Probe, damit Offline-Gutschriften
 * erkennbar sind (Delta pt minus Delta motor).
 *
 * VERALTETE DATEIEN ZAEHLEN NICHT. data/blade.json und data/ausgang.json
 * ueberleben den Knotenwechsel; im Hackingknoten schreibt blade.js nie. Eine
 * Probe nimmt blade.json nur, wenn sie zum selben Knotenlauf gehoert
 * (nodeReset) und frisch ist - sonst stuende der Endrang des Vorknotens im
 * neuen Lauf.
 */
import { readFile, writeFile, rename, open } from "node:fs/promises";

export const SAMPLE_MS = 5 * 60000;
// 4.000 Proben zu 5 min = knapp 14 Tage. Eine Probe sind rund 280 Byte,
// die Datei bleibt also bei gut 1 MB.
export const MAX_SAMPLES = 4000;
// So alt darf eine Telemetriedatei sein, damit sie in die Probe kommt.
export const FRESH_MS = 10 * 60000;

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const fresh = (o, wall, key = "zeit") => !!o && Number.isFinite(o[key]) && Math.abs(wall - o[key]) <= FRESH_MS;

/**
 * Baut aus den drei Telemetriedateien eine Probe. Rein, ohne Ein- und
 * Ausgabe - damit ist sie testbar.
 *
 * @returns {object|null} null, wenn nichts Verwertbares da ist
 */
export function buildSample(wall, blade, exit, net) {
  // Ohne frische bn4net.json fehlt die Uhr und der Knotenlauf - keine Probe.
  if (!fresh(net, wall)) return null;
  const nodeReset = num(net.nodeReset);
  // Geschrieben NACH dem Knotenstart - sonst ist es die Datei des Vorlaufs
  // (beim Wechsel 13.2 -> 13.3 stimmt die Knotennummer trotzdem).
  const afterReset = (o) => nodeReset === null || num(o.zeit) >= nodeReset;
  const bladeOk = fresh(blade, wall) && !blade.wartend && afterReset(blade)
    && nodeReset !== null && num(blade.nodeReset) === nodeReset;
  const exitOk = fresh(exit, wall) && afterReset(exit) && exit.lauf && num(exit.lauf.node) === num(net.knoten);
  const run = exitOk ? exit.lauf : null;
  const sample = {
    t: wall,
    pt: num(net.playtime),
    motor: num(net.motorTimeMs),
    nodeReset,
    node: num(run && run.node) ?? num(net.knoten),
    level: num(run && run.level),
    method: (run && run.verfahren) || null,
    rank: bladeOk ? num(blade.rang) : null,
    chance: bladeOk ? num(blade.chance) : null,
    action: bladeOk ? (blade.aktion || null) : null,
    money: num(net.geld),
    hacking: num(net.hacking),
  };
  if (sample.rank === null && sample.money === null && sample.hacking === null) return null;
  return sample;
}

/**
 * Haengt eine Probe an und kuerzt auf `max`. Rein.
 *
 * Laeuft die Spielzeit im selben Knotenlauf rueckwaerts (Sicherung
 * zurueckgespielt), fallen die Proben aus der verworfenen Zukunft weg -
 * sonst stuenden sie rechts vom Jetzt im Diagramm.
 */
export function appendSample(list, sample, max = MAX_SAMPLES) {
  let out = Array.isArray(list) ? list.slice() : [];
  if (Number.isFinite(sample.pt) && sample.nodeReset !== null) {
    out = out.filter((s) => s.nodeReset !== sample.nodeReset || !(Number.isFinite(s.pt) && s.pt > sample.pt));
  }
  out.push(sample);
  return out.length > max ? out.slice(out.length - max) : out;
}

export function createHistory({ file, request, getNet = null, log = () => {}, now = () => Date.now(), sampleMs = SAMPLE_MS, max = MAX_SAMPLES }) {
  let lastSample = 0;
  let busy = false;

  /**
   * Liest die Proben. NUR eine fehlende Datei heisst "leer anfangen". Eine
   * kaputte Datei wird beiseitegelegt (nicht ueberschrieben), jeder andere
   * Fehler (gesperrt, Virenscanner) wirft - dann faellt diese Probe aus,
   * statt den Verlauf mit einer einzigen neuen Probe zu ersetzen.
   */
  async function readList() {
    let raw;
    try {
      raw = await readFile(file, "utf8");
    } catch (e) {
      if (e && e.code === "ENOENT") return [];
      throw e;
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data.samples) ? data.samples : [];
    } catch {
      const aside = file + ".corrupt-" + now();
      try { await rename(file, aside); } catch { /* dann eben liegen lassen */ }
      log("Verlauf unlesbar - beiseitegelegt als " + aside + ", neu begonnen");
      return [];
    }
  }

  async function getJson(name) {
    try {
      const raw = await request("getFile", { filename: name, server: "home" });
      return typeof raw === "string" && raw.trim() ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Nimmt eine Probe, wenn die letzte mindestens `sampleMs` her ist.
   * Nebenlaeufige Aufrufe (der Takt laeuft alle 30 s) werden verworfen.
   */
  async function maybeSample() {
    const wall = now();
    // Steht die eigene Uhr VOR der letzten Probe (Systemzeit zurueckgestellt),
    // gilt die Probe als faellig - sonst gaebe es bis zum Aufholen keine.
    if (busy || (wall - lastSample < sampleMs && wall >= lastSample)) return false;
    busy = true;
    // Vor dem Lesen weiterruecken: wirft readList (Datei gesperrt), kommt der
    // naechste Versuch erst im naechsten Takt, nicht alle 30 s mit Logzeile.
    lastSample = wall;
    try {
      // Nach einem Neustart der Bruecke zaehlt die juengste Probe aus der
      // Datei, sonst gaebe jeder Neustart eine Extraprobe.
      const list = await readList();
      const last = list.length ? list[list.length - 1] : null;
      if (last && Number.isFinite(last.t) && wall - last.t < sampleMs && wall >= last.t) {
        lastSample = last.t;
        return false;
      }
      const cached = typeof getNet === "function" ? getNet() : null;
      const [blade, exit, net] = await Promise.all([
        getJson("data/blade.json"), getJson("data/ausgang.json"),
        cached ? Promise.resolve(cached) : getJson("data/bn4net.json"),
      ]);
      const sample = buildSample(wall, blade, exit, net);
      if (!sample) return false;
      const next = appendSample(list, sample, max);
      const tmp = file + ".tmp";
      const fh = await open(tmp, "w");
      try {
        await fh.writeFile(JSON.stringify({ version: 2, sampleMs, samples: next }));
        await fh.sync();
      } finally {
        await fh.close();
      }
      await rename(tmp, file);
      return true;
    } finally {
      busy = false;
    }
  }

  return { maybeSample, readList };
}
