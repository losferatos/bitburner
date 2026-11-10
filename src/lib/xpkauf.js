/**
 * Kaufregel im reinen Erfahrungsmodus (BitNode 8, 10.11.2026).
 *
 * WARUM ES DIESE REGEL GIBT
 *
 * In BitNode 8 bringt Hacken kein Geld (BitNode.tsx case 8: ScriptHackMoneyGain
 * 0). Die Amortisationsrechnung des Kerns (bn4net.js, Abschnitt 1a2) teilt
 * Kosten durch einen Geldertrag je GB - und der ist dort null. Sie kauft also
 * nie, oder, mit der 5-%-Sperre, nur wenn Geldziele Speicher aufnehmen, die es
 * im Erfahrungsmodus gar nicht mehr gibt. Das Bargeld ueber data/geldbedarf.txt
 * ist in diesem Knoten Betriebsgeld (boerse.js haelt 2 % des Vermoegens bar)
 * und sonst nutzlos; Speicher dagegen wird linear zu Erfahrung, denn der Ofen
 * (worker/expfarm.js) belegt jedes freie GB.
 *
 * Statt Amortisation also ein Budget: die Option mit den niedrigsten
 * EFFEKTIVEN Kosten je zusaetzlichem GB, wenn sie bezahlbar ist.
 *
 * DIE DREI OPTIONEN UND IHRE PREISE
 *
 *   neuer Rechner  ram * 55000 * 4^max(0, log2(ram) - 6)
 *                  (ServerPurchases.ts getCloudServerCost, CloudServerSoftcap 4
 *                  in BN8). Der Preis kommt aus der Tabelle, die shop.js beim
 *                  Spiel erfragt (data/preise.json) - NICHT aus dieser Formel;
 *                  die Formel steht nur im Test, als Eichung.
 *   Aufruestung    Differenz zweier Tabellenpreise (ServerPurchases.ts), wie
 *                  bn4net.js es schon rechnet. Immer der KLEINSTE Rechner: der
 *                  Preis je GB waechst mit der Groesse, der kleinste ist
 *                  damit stets die billigste Aufruestung.
 *   home R -> 2R   R * 32000 * 1,58^log2(R) (PlayerObjectServerMethods.ts
 *                  getUpgradeHomeRamCost, HomeComputerRamCost in BN8 nicht
 *                  gesetzt, also 1). Hier muss gerechnet werden: die
 *                  Singularity-Abfrage gibt es nur in homegrow.js, und die
 *                  Kosten dort sind dieselbe Formel. Weicht das Spiel je ab,
 *                  schadet es nicht: homegrow.js kauft nur, wenn der WIRKLICHE
 *                  Preis bezahlbar ist.
 *
 * HOME ZAEHLT MIT EINEM DRITTEL. Gekaufte Rechner loescht jede Einbaurunde
 * (Prestige.ts:73), home-RAM bleibt (install.js). Ein GB auf home arbeitet also
 * ueber mehrere Runden, ein GB auf einem Rechner nur bis zur naechsten.
 * "Ein Drittel" ist ein Ansatz, keine Messung: er entspricht grob drei
 * Einbaurunden Nutzungsdauer.
 *
 * Reine Funktionen, kein ns - damit Kern und Test dieselbe Stelle rufen.
 */

/** Anteil des home-Preises, der als effektive Kosten zaehlt. */
export const HOME_GEWICHT = 1 / 3;

/** Kleinste Groesse, die als NEUER Rechner infrage kommt. Bis 64 GB ist der
 *  Preis je GB flach (kein Softcap, ServerPurchases.ts: log2(ram) - 6 <= 0);
 *  darunter verbrauchte ein Rechner nur einen der 25 Plaetze. */
export const MIN_NEU_GB = 64;

/**
 * Die zweitbeste Option darf gekauft werden, wenn die beste nicht bezahlbar
 * ist, aber nur bis zu diesem Vielfachen ihrer effektiven Kosten. Ohne diese
 * Grenze wartete der Kauf auf eine home-Verdopplung von mehreren zehn
 * Milliarden, waehrend das Betriebsgeld (2 % des Vermoegens) sie vielleicht nie
 * erreicht - und mit ihr nichts kauft. Mit der Grenze fliesst das Geld, ohne
 * dass je eine mehr als doppelt so teure Option den Vorzug bekommt.
 */
export const TOLERANZ = 2;

/** home-Preis fuer R -> 2R (siehe Kopf). */
export function homeKosten(ram, mult = 1) {
  if (!(ram >= 1)) return Infinity;
  return ram * 32000 * Math.pow(1.58, Math.log2(ram)) * mult;
}

/**
 * @param {object} o
 * @param {number} o.geldFrei     Bargeld MINUS data/geldbedarf.txt
 * @param {number} o.homeRam      aktuelle home-RAM (GB)
 * @param {number} [o.homeMax]    Obergrenze home (Vorgabe 2^30)
 * @param {Array<{host:string, ram:number}>} o.park  gekaufte Rechner
 * @param {number} o.limitAnzahl  CloudServerLimit (0 = keine Rechner kaufbar)
 * @param {number} o.limitRam     groesster Rechner
 * @param {object} o.preise       {gb: Preis} aus data/preise.json
 * @returns {{beste:object|null, kauf:object|null, optionen:object[]}}
 *   beste = billigste Option; kauf = was JETZT gekauft werden soll (oder null).
 *   Option: {art:"home"|"kauf"|"upgrade", gb (Zielgroesse), host, kosten,
 *   zusatzGb, eff (effektive Kosten je GB)}
 */
export function waehleKauf(o) {
  const optionen = [];
  const preise = o.preise || {};
  const park = Array.isArray(o.park) ? o.park : [];
  const homeMax = Number.isFinite(o.homeMax) ? o.homeMax : 2 ** 30;

  if (o.homeRam >= 1 && o.homeRam * 2 <= homeMax) {
    const kosten = homeKosten(o.homeRam);
    optionen.push({ art: "home", gb: o.homeRam * 2, host: "home", kosten,
      zusatzGb: o.homeRam, eff: (kosten / o.homeRam) * HOME_GEWICHT });
  }

  if (park.length < (o.limitAnzahl || 0)) {
    for (const k of Object.keys(preise)) {
      const gb = Number(k);
      const preis = Number(preise[k]);
      if (!(gb >= MIN_NEU_GB) || gb > o.limitRam || !(preis > 0)) continue;
      optionen.push({ art: "kauf", gb, host: null, kosten: preis,
        zusatzGb: gb, eff: preis / gb });
    }
  }

  // Aufruestung des KLEINSTEN Rechners - auch bei freien Plaetzen: sie ist je
  // GB teurer als ein neuer 64er, aber billiger als ein neuer 128er, und sonst
  // bliebe ein 64er auf 64, solange irgendwo ein Platz frei ist.
  if (park.length > 0) {
    const klein = park.reduce((a, b) => (b.ram < a.ram ? b : a));
    const ziel = klein.ram * 2;
    const alt = Number(preise[klein.ram]);
    const neu = Number(preise[ziel]);
    if (klein.ram > 0 && ziel <= o.limitRam && alt > 0 && neu > alt) {
      const kosten = neu - alt;
      optionen.push({ art: "upgrade", gb: ziel, host: klein.host, kosten,
        zusatzGb: klein.ram, eff: kosten / klein.ram });
    }
  }

  optionen.sort((a, b) => a.eff - b.eff || a.kosten - b.kosten);
  const beste = optionen.length ? optionen[0] : null;
  if (!beste) return { beste: null, kauf: null, optionen };
  let kauf = null;
  if (beste.kosten <= o.geldFrei) kauf = beste;
  else {
    kauf = optionen.find((x) => x.kosten <= o.geldFrei && x.eff <= beste.eff * TOLERANZ) || null;
  }
  return { beste, kauf, optionen };
}
