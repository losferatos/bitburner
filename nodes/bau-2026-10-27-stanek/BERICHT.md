# Stanek's Gift fuer BN13 unter V2 - Bericht 27.10.2026

**Urteil: lohnt nicht. Nichts gebaut, `src/` unberuehrt.** Zeitgewinn im Modell 0,6-3,8 % (Mittel 1-2 %) der Zeit bis Rang 400k, bei geschaetzt -25 bis -35 % Hackeinkommen durch Genesis. Quelle ueberall `reference/v301/src` (= laufende Fassung; der dev-Zweig weicht in Stanek.ts ab).

## 1. Mechanik (v301)
- **Annahme:** `ns.stanek.acceptGift` (NetscriptFunctions/Stanek.ts:120-139) -> `canAcceptStaneksGift` (CotMG/Helper.tsx:59-73): BN13 oder SF13>0 (PlayerObjectGeneralMethods.ts:603), und keine installierte oder gequeueute Aug ausser NFG. Skript 3,6 GB (1,6 + acceptGift 2, RamCostGenerator.ts:73). In BN13.1 selbst schon moeglich, SF13 ist nicht noetig.
- **Reihenfolge:** `startBladeburner` schenkt bei SF7.3 sofort Simulacrum (PlayerObjectBladeburnerMethods.ts:14-19, Aufruf Bladeburner.ts:362); die API warnt nicht, nur der UI-Dialog (SpecialLocation.tsx:77-96). Heute hat der Bot kein acceptGift; bn4rep kauft Augs (queued zaehlt), bbtrain.js:352 tritt bei.
- **Gitter** (StaneksGift.ts:22-31, BN13 Extra +1, Power 2: BitNode.tsx:1037-1038): SF13 0/1/2/3 = 6x5 / 6x6 / 7x6 / 7x7 = 30/36/42/49 Zellen. Die 5 V2-Fragmente (20 Zellen) passen schon in 30; die Stufe bringt nur Booster.
- **Strafe:** Genesis (Augmentations.ts:1592) x0,9 auf hacking*, hacking_chance/speed/money/grow, alle vier Kampfwerte + exp, Rep, Crime, work_money; **nicht** auf bladeburner_*. Awakening (:1630, 1e6 Kirchenruf) auf 0,95, Serenity (:1668, 1e8) auf 1,0. Ruf nur durch Laden (charge, StaneksGift.ts:33-44).
- **V2-Fragmente:** Strength T, Defense L, Dexterity L, Agility S (Power je 2), Bladeburner S (0,4: max Ausdauer, Ausdauerrate, Analyse, Erfolgschance), Booster x1,1 je angrenzendem Booster.
- **Laden:** Wirkung = 1 + ln(H+1)/60 * ((n+1)/5)^0,07 * Power * Boost * 2 (formulas/effect.ts:3-12). H = Faeden x Kernbonus **je Aufruf** (nicht Summe), n ~ Zahl der Aufrufe, ein Aufruf je 1000 ms (Stanek.ts:50). 2,0 GB je Faden; 5 Fragmente = 10*H GB. Logarithmisch: 16x RAM bringen nur +0,15. Jeder Einbau loescht die Ladung (StaneksGift.ts:229).
- **Netto nach Genesis** (layouts.mjs, Annealing, n=300): Kampfwerte H16 x1,13 (160 GB), H64 x1,23-1,27 (640 GB), H256 x1,39 (2,6 TB), H1024 x1,45-1,5; Erfolgschance bb x1,05/1,07/1,11/1,12.

## 2. Eichung
- `eich.mjs` laedt den **echten** StaneksGift per Typstripping (probe/loader.mjs, Muster goprobe) und vergleicht `stanekmodell.mjs`: 20 Gitterfaelle, 96 Form x Drehung, 60 Zufallslayouts mit Zufallsladung (effect, calculateMults, charge-Zustand, Kirchenruf): **bitgleich, max. Abweichung 0**. Mutation (Exponent 0,08) -> rot, 871 Abweichungen.
- Rangmodell: `kalib.mjs` ketten das Modell (tools/bbrank) auf gemessene Kampfwert-Kurven der Sicherungen. Zeit bis Rang 400k, Modell/gemessen: 0,93-1,08 in **8 von 11** Laeufen (4.2, 9.2, 11.3, 7.1, 7.2, 14.1-14.3). Ausreisser 7.3 (1,90), 3.3 (0,72), 9.3 (1,47): nicht verwendet.

## 3. Rechnung (zeit2.mjs, 8 geeichte Laeufe, Stanek-Layouts netto)
| Zeit bis Rang 400k | Genesis allein | H16 | H64 | H256 |
|---|---|---|---|---|
| Rangmult des Knotens | +0,4 % | -0,6 % | -1,0 % | -1,3 % |
| Rangmult 0,45 (BN13) | +0,5 % | -0,8 % | -1,2 % | -1,8 % (max. -3,8 %, 11.3) |
Bei 40-54 h je BN13-Lauf: **0,3-1 h**. Grund: Die Chance ist gesaettigt, der Rang hinge an Erfolgszahl und Aktionszeit. BN14.3 (regime2.mjs): ab h9 Chance der Rang-Ops > 1, Assassination L29 mit 4 Fehlern auf 481 Versuche (h21,2), Reserve u bis Faktor 215 (h22,2); Black-Op-Rueckstand am Ende <= 0,2 h. Selbst 70 % schwaechere Kampfwerte kosten im Modell nur ~+7 %. Ausdauer-Anteil des Modells ~100 % (Stamina-Bonus daher ohne Wirkung).

## 4. Kosten
- Genesis: Hackeinkommen (24,7 von 27 Mrd in BN14.3) x0,9 auf Geld, Chance, Tempo, Level -> **GESCHAETZT -25 bis -35 %**, nicht geeicht. Krankenhaus-Ersparnis neutral (Kosten ~ Schaden, HP-Pool waechst mit Defense). RAM H64 = 640 GB von ~2,4 TB Park.
- Risiken: Reihenfolgefalle zu bn4rep/bbtrain; mit CotMG-Mitgliedschaft nimmt bn4rep.js:917 Awakening/Serenity als Kandidaten auf, hackaugs.js:261 wertet sie absolut statt relativ (AUG-7).

## 5. Empfehlung
- **Nicht bauen.** BN13.1 laeuft schon ohne Gabe (Fenster = bis zum ersten Aug-Kauf oder Beitritt). Roadmap-Zeile 94 "Stanek nur hier mitnehmen", STGO-2/3 und L44 als **geprueft, verworfen** schliessen. BN15 (Power 0,7, Groesse -2) waere noch schwaecher.
- Wiederaufnahme nur, wenn BN13.1 den Rang vor h12 unter ~2.000 laesst (BN14.3: 12.200) **und** `regime2.mjs` auf dem BN13-Backup Chancen < 0,5 zeigt - dann `kalib.mjs` auf BN13 eichen, `zeit2.mjs` neu laufen lassen.
- Nebenbefund (Modell, nicht gemessen): Kampfwerte sind in V2 kaum der Engpass fuer die Rangzeit.

Aufruf: `node nodes/bau-2026-10-27-stanek/{kalib,zeit2,regime2,layouts}.mjs`; Eichung: `node --import ./nodes/bau-2026-10-27-stanek/probe/register.mjs nodes/bau-2026-10-27-stanek/eich.mjs`.
