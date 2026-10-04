// Gegenpruefung G03: ereignisdiskrete Nachbildung der drei Regelkreise
// (Kern bn4net.js Runde ~10 s, shop.js Takt 30 s, Werkzeugstarter) mit den
// Regeln aus dem Quellcode, um (1) die gemessene Zykluszeit von ~630,5 s zu
// reproduzieren (Eichung Soll/Ist) und (2) die Zykluszeit der Fix-Varianten
// zu bestimmen, statt sie anzunehmen (der Bericht rechnet mit 40 s).
//
// Quellen (alles src/):
//  bn4net.js:240-272  beauftrage/auftragOffen (600 s Haltefrist, Ergebnis-id-Abgleich)
//  bn4net.js:1274-1280 parkLage() liest preise.json -> Sicht des Kerns, kaufMoeglich = !auftragOffen()
//  bn4net.js:1451-1519 kleinster Rechner der SICHT wird verdoppelt (ein Auftrag je Runde)
//  bn4net.js:3841-3925 shopNoetig/fehlend -> shop.js wird in derselben Runde gestartet
//  shop.js:143-323     Runde: preise.json schreiben (park VOR Ausfuehrung), Auftrag, Herzschlag,
//                      Ende wenn kein Auftrag offen UND runden >= 2; sonst sleep 30 s
//  shop.js:250-265     getServerUpgradeCost = -1 (Cloud.ts:94-103) -> kosten > 0 falsch -> "warte auf Geld"
//
// Varianten:
//  V0  Ist-Zustand
//  F1  shop: kosten <= 0 -> erledigt + Ergebnis (erfolg:false)           (Fix-Vorschlag a)
//  F2  shop: preise.json NACH der Ausfuehrung erneut schreiben (vor dem Ergebnis)
//  F3  Kern: Ausbau in auftragOffen() nachfuehren, ABER die Sicht (parkRam, :1276) ist davor gebaut -> wirkungslos (Falle)
//  F3b Kern: Sicht erst NACH auftragOffen() mit dem Nachtrag zusammenfuehren (richtige Reihenfolge)
//  F4  Kern bestellt in der Ergebnisrunde nichts (dritte Alternative des Berichts HACK-2) - Test, ob "jeder Punkt allein loest es" stimmt
//  F12 F1 + F2
// Aufruf: node tools/audit/verify-g03-sim.mjs
const KERN_P = 10.005;     // rundenTaktMs 10005 (Telemetrie bn4net.json)
const SHOP_P = 30.0;       // TAKT_MS 30000
const HOLD = 600;          // auftragOffen: 600000 ms

function simulate(variant, seed, hours = 3, startRam = 64, nHosts = 25, maxRam = 1024) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const park = Array(nHosts).fill(startRam);              // Wahrheit
  let preise = { ts: -1e9, park: park.slice() };          // Datei
  let auftragFile = null;                                 // {id, host, gb, ts}
  let ergebnisFile = null;                                // {id, erfolg, ergebnis, ts}
  let offen = null;                                       // Kern: offenerAuftrag
  const carry = new Map();                                // F3
  let shop = null;                                        // {runden, next, erledigt:Set}
  let idc = 0;
  const upgrades = [];                                    // Zeitpunkte ausgefuehrter Ausbauten
  const orders = [];
  const f1 = variant === "F1" || variant === "F12";
  const f2 = variant === "F2" || variant === "F12";
  const f3 = variant === "F3" || variant === "F3b";
  const f3b = variant === "F3b";
  const f4 = variant === "F4";
  let sawResult = false;
  let kernNext = rnd() * KERN_P;
  const end = hours * 3600;

  const shopStart = (t) => {
    shop = { runden: 0, next: t + 0.2, erledigt: new Set() };
    if (ergebnisFile && ergebnisFile.erfolg) shop.erledigt.add(ergebnisFile.id);   // shop.js:121-134
  };
  const shopRound = (t) => {
    shop.runden++;
    preise = { ts: t, park: park.slice() };                                        // :165
    let wartet = false;
    const a = auftragFile;
    if (a && !shop.erledigt.has(a.id)) {
      const cur = park[a.host];
      if (a.gb <= cur) {                                                           // kosten = -1
        if (f1) { shop.erledigt.add(a.id); ergebnisFile = { id: a.id, erfolg: false, ergebnis: "ziel_nicht_groesser", ts: t }; }
        else wartet = true;
      } else {
        park[a.host] = a.gb;                                                       // :254 upgradeServer
        upgrades.push(t);
        shop.erledigt.add(a.id);
        if (f2) preise = { ts: t, park: park.slice() };
        ergebnisFile = { id: a.id, erfolg: true, ergebnis: "werk-" + a.host, ts: t };
      }
    }
    const nochZuTun = auftragFile && !shop.erledigt.has(auftragFile.id);
    if (!nochZuTun && shop.runden >= 2) { shop = null; return; }                    // :310-323
    shop.next = t + SHOP_P;
  };
  const auftragOffen = (t) => {                                                    // bn4net.js:254-272
    if (!offen) return false;
    if (!ergebnisFile) return t - offen.ts < HOLD;
    if (ergebnisFile.id === offen.id) {
      if (f3 && ergebnisFile.erfolg) carry.set(offen.host, offen.gb);
      sawResult = true;
      offen = null; return false;
    }
    return t - offen.ts < HOLD;
  };
  const kernRound = (t) => {
    let view = preise.park.slice();
    if (f3 && !f3b) view = view.map((r, i) => Math.max(r, carry.get(i) || 0));   // wie parkRam :1276 VOR auftragOffen
    sawResult = false;
    let kaufMoeglich = !auftragOffen(t);
    if (f4 && sawResult) kaufMoeglich = false;
    if (f3b) view = view.map((r, i) => Math.max(r, carry.get(i) || 0));
    if (kaufMoeglich) {
      let si = -1, sg = Infinity;
      view.forEach((g, i) => { if (g < sg) { sg = g; si = i; } });                 // sort() ist stabil: erster kleinster
      if (si >= 0 && sg < maxRam) {
        const id = "a" + (idc++);
        auftragFile = { id, host: si, gb: sg * 2, ts: t };
        offen = auftragFile;
        orders.push({ t, host: si, gb: sg * 2 });
      }
    }
    const shopNoetig = !!(offen && auftragOffen(t));
    if (shopNoetig && !shop) shopStart(t);
  };

  let t = 0;
  shopStart(0);
  while (t < end) {
    const tk = kernNext, ts = shop ? shop.next : Infinity;
    if (ts < tk) { t = ts; shopRound(t); } else { t = tk; kernRound(t); kernNext += KERN_P; }
  }
  return { upgrades, orders, park };
}

function stats(a) {
  a = a.slice().sort((x, y) => x - y);
  return { n: a.length, min: a[0], med: a[a.length >> 1], max: a[a.length - 1], mean: a.reduce((x, y) => x + y, 0) / a.length };
}

// Eichung: gemessene Abstaende (verify-g03-gaps.mjs): BN2.2 630,4-631,0 s; BN2.1 03.10. min 621 / Median 631 / max 939
console.log("Variante  n_Ausbauten(3 h)  Abstand zwischen ausgefuehrten Ausbauten (s): min / Median / Mittel / max   Doppelbestellungen");
for (const v of ["V0", "F1", "F2", "F3", "F3b", "F4", "F12"]) {
  const gaps = [];
  let nUp = 0, nOrd = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = simulate(v, seed * 7919);
    nUp += r.upgrades.length; nOrd += r.orders.length;
    for (let i = 1; i < r.upgrades.length; i++) gaps.push(r.upgrades[i] - r.upgrades[i - 1]);
  }
  const g = stats(gaps);
  console.log(v.padEnd(4), String(Math.round(nUp / 40)).padStart(6), "        ",
    g.min.toFixed(1).padStart(7), "/", g.med.toFixed(1).padStart(7), "/", g.mean.toFixed(1).padStart(7), "/", g.max.toFixed(1).padStart(7),
    "        Bestellungen je Ausbau:", (nOrd / nUp).toFixed(2));
}
