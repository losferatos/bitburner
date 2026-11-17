/**
 * Den BitNode OHNE SF4 verlassen, ueber die Oberflaeche (17.11.2026, BN1.1 Lauf 2).
 *
 * exit.js springt ueber ns.singularity.destroyW0r1dD43m0n - und das wirft ohne
 * Source-File 4 ("requires Source-File 4", NetscriptHelpers.tsx:388-396). In
 * BN1.1 von Lauf 2 gibt es kein SF4, also endete exit.js jedes Mal ohne Sprung.
 * Dieses Skript geht den Weg, den das Spiel dem Menschen anbietet:
 *   1. Terminal: connect-Kette zu w0r1d_d43m0n, dann `backdoor`
 *      (Terminal/commands/backdoor.ts:61 schickt danach auf den BitVerse).
 *   2. BitVerse: den Ziel-BitNode anklicken (oeffnet PortalModal) und im Fenster
 *      "Enter BN<n>.<stufe>" bestaetigen (PortalModal.tsx:117-131).
 *   3. enterBitNode beendet JEDES Skript, auch dieses. Ein Seiten-Timer
 *      speichert danach, prueft in IndexedDB, dass der Stand im neuen Knoten
 *      steht (bitNodeN == Ziel), und laedt erst dann neu (Autoexec coldstart.js
 *      -> boot.js). Gleiches Muster wie installreload.js; Reload ohne
 *      Speichern wuerde den Sprung verwerfen.
 *
 * Gilt NUR ohne SF4 und ausserhalb von BitNode 4; sonst ist exit.js zustaendig.
 * installBackdoor wird nicht benutzt (tools/test-kein-wd-backdoor.js).
 *
 * Aufruf:  node tools/task.js exitdom.js 4 --pruefen   nur Bedingungen pruefen
 *          node tools/task.js exitdom.js 4             springen
 * Bericht: data/exitdom.txt, danach localStorage "exitdom".
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const win = doc.defaultView;
  const ziel = Number(ns.args[0]);
  const nurPruefen = ns.args.map(String).includes("--pruefen");
  const WD = "w0r1d_d43m0n";
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/exitdom.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/exitdom.txt", "home", ns.getHostname());
  };
  if (!Number.isFinite(ziel) || ziel < 1) return sag("ABBRUCH: kein Ziel-BitNode angegeben.");

  // --- Zustaendigkeit: nur ohne SF4 ----------------------------------------
  const ri = ns.getResetInfo();
  const sf4 = ri.ownedSF && typeof ri.ownedSF.get === "function" ? Number(ri.ownedSF.get(4) || 0) : 0;
  if (Number(ri.currentNode) === 4 || sf4 > 0) {
    return sag("ABBRUCH: SF4 vorhanden oder BitNode 4 - dort springt exit.js ueber die Schnittstelle.");
  }

  // --- Bedingungen (wie exit.js) -------------------------------------------
  if (!ns.serverExists(WD)) return sag("ABBRUCH: " + WD + " haengt nicht am Netz (Red Pill nicht eingebaut).");
  const s = ns.getServer(WD);
  const level = ns.getPlayer().skills.hacking;
  sag("Hacking " + level + " von " + s.requiredHackingSkill + ", Root: " + (s.hasAdminRights ? "ja" : "nein")
    + ", Backdoor: " + (s.backdoorInstalled ? "ja" : "nein"));
  if (level < s.requiredHackingSkill) return sag("ABBRUCH: Level reicht nicht.");
  if (!s.hasAdminRights) return sag("ABBRUCH: kein Root auf " + WD + " (erst exit.js laufen lassen: es holt Root).");

  // Weg suchen (Breitensuche ab home).
  const vorgaenger = new Map([["home", null]]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (vorgaenger.has(nachbar)) continue;
      vorgaenger.set(nachbar, hier);
      schlange.push(nachbar);
    }
  }
  if (!vorgaenger.has(WD)) return sag("ABBRUCH: kein Weg zu " + WD + " im Netz.");
  const kette = [];
  for (let h = WD; h && h !== "home"; h = vorgaenger.get(h)) kette.unshift(h);
  sag("Weg: home -> " + kette.join(" -> "));

  if (!ns.fileExists("boot.js", "home")) return sag("ABBRUCH: boot.js liegt nicht auf home.");
  if (nurPruefen) return sag("PRUEFLAUF: alle Bedingungen erfuellt. Ohne --pruefen wird jetzt BitNode " + ziel + " betreten.");

  // --- Teil 3 vorbereiten: Seiten-Timer, ueberlebt das Skriptende ----------
  const melde = (t) => {
    try { win.localStorage.setItem("exitdom", new Date().toISOString() + " " + t); } catch { /* egal */ }
  };
  const lies = () => new Promise((res, rej) => {
    const q = win.indexedDB.open("bitburnerSave");
    q.onerror = () => rej(q.error);
    q.onsuccess = () => {
      try {
        const t = q.result.transaction("savestring", "readonly").objectStore("savestring").get("save");
        t.onerror = () => rej(t.error);
        t.onsuccess = () => res(t.result);
      } catch (e) { rej(e); }
    };
  });
  const knoten = async () => {
    const v = await lies();
    let roh = v;
    if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
      const st = new win.Blob([v]).stream().pipeThrough(new win.DecompressionStream("gzip"));
      roh = await new win.Response(st).text();
    }
    let j = JSON.parse(roh);
    if (typeof j === "string") j = JSON.parse(j);
    return Number(JSON.parse(j.data.PlayerSave).data.bitNodeN);
  };
  const teil3 = async (versuch) => {
    try {
      const k = doc.querySelector('[aria-label="save game"]');
      if (k) k.click();
      await new Promise((r) => win.setTimeout(r, 3000));
      const n = await knoten();
      if (n === ziel) {
        melde("ok: gespeichert in BitNode " + n + ", lade neu");
        win.onbeforeunload = null;
        win.location.reload();
        return;
      }
      melde("Versuch " + versuch + ": Stand zeigt BitNode " + n + ", erwartet " + ziel);
    } catch (e) {
      melde("Versuch " + versuch + ": Fehler " + String(e));
    }
    if (versuch < 6) win.setTimeout(() => teil3(versuch + 1), 5000);
    else melde("AUFGEGEBEN: nicht neu geladen - Seite von Hand neu laden nach Pruefung");
  };

  // --- 1. Terminal: connect-Kette und backdoor ------------------------------
  const terminal = (befehl) => {
    const el = doc.getElementById("terminal-input");
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
    setter.call(el, befehl);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    return true;
  };
  const raus = [...doc.querySelectorAll("button")]
    .find((b) => (b.innerText || "").trim() === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1200); }
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await ns.sleep(900);
  if (!doc.getElementById("terminal-input")) return sag("ABBRUCH: Terminal nicht erreichbar.");
  if (!terminal("home")) return sag("ABBRUCH: Terminal nahm den ersten Befehl nicht an.");
  await ns.sleep(700);
  for (const hop of kette) {
    if (!terminal("connect " + hop)) return sag("ABBRUCH: Terminal nahm 'connect " + hop + "' nicht an.");
    await ns.sleep(700);
  }
  terminal("backdoor");
  sag("backdoor abgesetzt, warte auf den BitVerse-Bildschirm.");

  // --- 2. BitVerse: Ziel anklicken, im Fenster bestaetigen -------------------
  const imVerse = () => /Enter a new BitNode|BitVerse|Bitverse/i.test(doc.body.innerText || "")
    && [...doc.querySelectorAll("button, [role='button']")].length > 0;
  let da = false;
  for (let i = 0; i < 120; i++) {   // 6 Minuten, Backdoor-Dauer haengt vom Hacking-Level ab
    await ns.sleep(3000);
    if (/BitNode-?\s*\d+/i.test(doc.body.innerText || "") && /Bitverse|BitVerse|Enter a new/i.test(doc.body.innerText || "")) { da = true; break; }
  }
  if (!da) return sag("ABBRUCH: BitVerse-Bildschirm nach 6 Minuten nicht erschienen. Backdoor: "
    + (ns.getServer(WD).backdoorInstalled ? "ja" : "nein"));
  sag("BitVerse-Bildschirm ist da.");
  await ns.sleep(1500);

  const blatt = [...doc.querySelectorAll("button, [role='button'], a, span, div")]
    .filter((e) => e.children.length === 0 && /BitNode-?\s*\d+/i.test(e.textContent || ""));
  const treffer = blatt.find((e) => {
    const m = (e.textContent || "").match(/BitNode-?\s*(\d+)/i);
    return m && Number(m[1]) === ziel;
  });
  if (!treffer) return sag("ABBRUCH: BitNode " + ziel + " nicht auf der Seite gefunden (" + blatt.length + " Beschriftungen).");
  let el = treffer;
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    if (el.tagName === "BUTTON" || el.getAttribute?.("role") === "button" || el.onclick) break;
  }
  (el || treffer).click();
  sag("BitNode " + ziel + " angeklickt, suche den Enter-Knopf.");

  let enter = null;
  for (let i = 0; i < 20 && !enter; i++) {
    await ns.sleep(500);
    enter = [...doc.querySelectorAll("button")]
      .find((b) => new RegExp("^Enter BN" + ziel + "\\.\\d+").test((b.innerText || "").trim()));
  }
  if (!enter) return sag("ABBRUCH: Knopf 'Enter BN" + ziel + ".x' nicht erschienen.");

  sag("Betrete BitNode " + ziel + ": " + (enter.innerText || "").trim() + ". Ab jetzt sterben alle Skripte; ein Seiten-Timer speichert und laedt neu.");
  melde("Sprung ausgeloest");
  win.setTimeout(() => teil3(1), 4000);
  enter.click();
  await ns.sleep(3000);
}
