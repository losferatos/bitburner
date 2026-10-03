# Gegenpruefung G02 - Hacknet-Augs im Kampfknoten (HASH-4, BN2-1, BN311-2)

Winkel: Substanz und Betrieb. Stand 2026-10-03 22:27 (Systemzeit). Streng
lesend: `src/` unveraendert, Spiel nicht angefasst, nichts committet.
Bot master `9b654e1`, Spielquelle 3.0.2. Neu gegenueber den Befundberichten:
die Spielstaende **nach dem Einbau 19:01** (19:17, 20:17, 21:17, 22:17).

Rechner (nur lesen):

| Datei | Was |
|---|---|
| `tools/audit/verify-g02-save.mjs` | je BN2L1-Stand ab 09:59: Warteschlange, Geld, moneySourceA/B, NFG, Hacknet-Server, Hash-Stufen, Mults, Netburners-Ruf |
| `tools/audit/verify-g02-calc.mjs` | Eichungen 1-4, Nachspielen der Kaufregel mit/ohne Hacknet-Augs (5), Nutzen je Knoten (6), Kompetenz (7) |
| `tools/audit/verify-g02-v2stats.mjs` | Zaehlschwellen Daedalus/Covenant/Illuminati gegen alle V2-Laeufe in `backups/` |

## Urteil

**TEILWEISE.** Der Defekt ist echt, live und kostet mehr als BN2-1 dachte -
aber jede der drei Zahlenreihen haelt so nicht, und der Fix-Vorschlag aus
BN311-2 ist falsch.

- **Haelt:** Mechanik an allen Fundstellen. `src/bn4rep.js:655-660`
  (`mitHashes` = SF9), `:672` Filter, `src/lib/hackaugs.js:346-350`;
  Augs wirken erst nach dem Einbau (gemessen: `hacknet_node_money` 19:01 mit
  vier wartenden Hacknet-Stuecken = 1,606946, unveraendert gegen 09:59), der
  Einbau loescht alle Hacknet-Server (`PlayerObjectGeneralMethods.ts:130-131`),
  der SF9.3-Server kommt nur beim Knotenwechsel (`Prestige.ts:327-339`, nicht in
  `prestigeAugmentation` `:55-200`), `src/hacknet.js:94-111` beendet sich
  ausserhalb BN9 (Live-Log 19:01:31 "nur BN9 kauft neu").
- **Haelt nicht (BN2-1):** Die "geeichten" 12,46 Mrd / 48 % / "1 statt 5 NFG"
  stammen aus einer **verworfenen Zeitlinie**. Alle Staende 17:16, 17:17, 18:04,
  18:39 tragen `lastSave` 08:32:54Z: der Tab hing (ERLEDIGT 18:43,
  maennerNoetig-Endlosschleife), nichts davon wurde gespeichert, das Spiel wurde
  vom Stand mit 5 wartenden neu geladen. Die Kaeufe ATI/NIC/NTII/ATII/CPU/Cache
  von 17:16/17:17 hat es nie gegeben. Gekauft und **eingebaut** wurde stattdessen
  (18:45, eine Runde): NTII, **Kernel**, ATI, CPU, Cache, NIC.
- **Haelt nicht (HASH-4):** Kostenschaetzung 1,35 Mrd unterstellt "billigste
  zuerst"; der Bot kauft absteigend (`src/bn4rep.js:1737`). Echt: 8,92 Mrd.
  Nutzen "+16 Mio $/h je NIC auf 0,18 H/s" unterstellt eine fertige
  netburn-Flotte; die gibt es ab dem 2. Zyklus systematisch nicht (siehe 4.).
- **Haelt nicht (BN311-2):** Der Nutzen (+0,142 / 0,036 / 0,014 Mrd/h) ist auf
  den Gratis-Server gerechnet, der die Augs **nie** erlebt (Augs wirken nach
  dem Einbau, der Server ist dann weg). Der Fix "nur wenn `rangAusHashes > 0`"
  greift genau im Fehlerfall nicht: In BN2.1 Zyklus 1 lief der Rangtausch
  (Stufe 5), die Augs waeren trotzdem gekauft worden. "Nur als letztes Stueck"
  hilft auch nicht: NIC war schon das letzte Stueck (q=10) und hat trotzdem die
  NFG-Schleife um 1,9 verteuert.
- **Neu:** Die Hacknet-Stuecke haben ein **echtes Kampfstueck verdraengt**:
  Augmented Targeting II (dex x1,2) war verdient (Sector-12 14.262 >= 8.750),
  scheiterte in der Kaufrunde an der Vorbedingung ATI und kostete danach bei
  q=11 49,5 Mrd (`data/bn4rep.json` 19:01 `bedarf` 49.508.360.031). Ohne die vier
  Hacknet-Stuecke haette es bei q=7 3,80 Mrd gekostet und waere gekauft worden.

## 1. Eichung (Soll = Spielstand, Ist = eigene Formel)

| Groesse | Soll | Ist | |
|---|---|---|---|
| Aug-Summe in Warteschlangen-Reihenfolge 17:17 (verworfene Zeitlinie) | 28,4048 Mrd | 28,4048 Mrd | OK |
| Aug-Summe 19:01 (gueltige Zeitlinie, 11 Stueck) | 20,3985 Mrd | 20,3985 Mrd | OK |
| Kaufregel nachgespielt (`bn4rep.js:670-678,1737-1745`, Vorbedingung `FactionHelpers.tsx:56-57,88`) ab q=5 | NTII, Kernel, ATI, CPU, Cache, NIC; 10,7388 Mrd | identische Reihenfolge, 10,7388 Mrd | OK |
| NFG-Schleife beim Einbau (Geld 15,55 Mrd laut bn4rep-Log 19:00:30, L0=3, q=11) | NFG 6 - 3 = 3 Stufen (19:17) | 3 Stufen, 10,17 Mrd | OK |
| `hacknet_node_money` nach dem Einbau | 2,879799 | 1,606946 x 1,739375 x 1,0100026^3 = 2,879799 | OK |
| Hashrate netburn-Server L2 R2 C1 / L2 R1 C1 (`HacknetServers.ts:4-17`) | 0,00616277 / 0,00575960 | identisch | OK |

Grundpreise der fuenf Hacknet-Augs zusaetzlich per eigenem Regex direkt aus
`Augmentations.ts:853-905` gegen den Parser `aug-data.mjs` geprueft.

## 2. Korrigierter Schaden BN2.1 Zyklus 1 (`verify-g02-calc.mjs` Abschnitt 5)

| | mit Hacknet (Ist) | ohne Hacknet (Kaufregel nachgespielt) |
|---|---|---|
| Warteschlange beim Einbau | 11 (7 echte) | 8 (8 echte, **+ Augmented Targeting II** q=7 3,80 Mrd) |
| Aug-Ausgaben Zyklus | 20,40 Mrd | 15,60 Mrd |
| Geld beim Einbau / q | 15,55 Mrd / 11 | 20,67 Mrd / 8 |
| NFG-Stufen beim Einbau | 3 | **6** |

- Von den Hacknet-Stuecken verursacht: **8,92 Mrd = 43,7 % der Aug-Ausgaben
  des Zyklus** (83 % der Kaeufe nach dem Neuladen) = 8,28 Mrd Preis der vier
  Stuecke (Kernel allein 1,88 Mrd bei q=6) + 0,64 Mrd Treppe auf ATI (q7 statt q6).
- Daraus folgt fuer den naechsten Zyklus: **ATII fehlt, 3 NFG-Stufen fehlen.**
  Kompetenz mit Typhoon-Gewichten (`Action.ts:169-196`, `BlackOperations.ts`
  Typhoon 0,2 je Kampfwert, Zerfall 0,8) bei den Werten 22:17
  (262/262/319/263, hack 379, int 154): x1,060, davon ATII x1,0375 (bis zum
  naechsten Einbau, dann holt die Ist-Zeitlinie ATII nach) und NFG x1,0218
  (bis Knotenende). GERECHNET_UNGEEICHT (Gewichte aus dem Quellcode, Werte aus
  dem Spielstand, keine Chance-Eichung).
- In Zeit: Typhoon-Chance 0,1473 (19:17) -> 0,2237 -> 0,2683 -> 0,2839 (22:17),
  zuletzt ohne Bonuszeit (`storedCycles` 0 ab 21:17) ln-Zuwachs 0,0565/h;
  0,90 braucht noch 1,154. Vorsprung 0,0584 = **~1,0 h** beim heutigen Zuwachs,
  NFG-Anteil allein ~0,4 h; der Zuwachs faellt weiter, die Zahl ist eher
  Untergrenze. **GESCHAETZT.**
- BN2-1 "1 statt 5 NFG" rechnete ohne das verdraengte Stueck. Mit derselben
  Annahme (ATII nicht gekauft) waeren es 3 statt 7.

## 3. Nutzen der Hacknet-Augs nach dem Einbau (Abschnitt 6)

Nach dem Einbau gibt es ausserhalb BN9 nur die netburn-Flotte. Gemessen
19:17-22:17: 5 Server L2, **0,0304 H/s**, alle Hash-Stufen 0, Speicher
28 -> 138 -> 247 von 320 (hashes.js wartet, hacknet.js hat sich beendet) - die
Hashes werden erst beim Ueberlauf automatisch verkauft
(`HacknetHelpers.tsx:419-429`).

| | Ertrag der 4 Stuecke (x1,739) |
|---|---|
| BN2.1 gemessen | **+11,6 Mio $/h**, erst ab vollem Speicher (0,2-0,3 % des BN2-Einkommens 4,2-6,4 Mrd/h) |
| Obergrenze fertige netburn-Flotte (5 x L21), BN2 / BN15 | +124 Mio $/h |
| dito BN13 / BN3, BN14 / BN6, BN7 / BN11 / BN8 | +50 / +31 / +25 / +12 / 0 Mio $/h |

Die Obergrenze tritt nicht ein: `src/bn4life.js:164,228-240` startet netburn
einmal je Einbau ab 5 Mio $ (Geld nach dem Einbau 1.262 $,
`PlayerObjectGeneralMethods.ts:102`), netburn kauft die Server und bricht dann
ab - Live `data/netburn.txt`: "Keine Aufruestung mehr moeglich ... Level 10/100
... Geld danach 48.667 ... Netburners: keine Einladung erhalten". Netburners
wird also praktisch nur im **ersten Zyklus jedes Knotens** erreicht (der
Gratis-Server traegt Level 100 und Kerne 10), genau dort werden die Augs
gekauft, und sie wirken danach auf Stummel.

Absolut gegen die beste Alternative (Geld in NFG/Kampfstuecke): 8,92 Mrd
einmalig gegen <= 0,012 Mrd/h Rueckfluss. Selbst bei der nie erreichten
Obergrenze waeren es 2,5 Mrd in 20 h Restknoten - und Geld bindet in BN2 nicht
(BN2-3: Ruf ist der Engpass), der Rueckfluss landet in derselben NFG-Schleife.

## 4. Gibt es einen V2-Fall, in dem die Hacknet-Augs zaehlen?

| Fall | Ergebnis | Beleg |
|---|---|---|
| BN9 | **ja** - hacknet.js kauft nach dem Einbau neu, hashes.js tauscht in Rang | `src/hacknet.js:94-111,154`; BN9 liegt nicht mehr auf der Restroute |
| Daedalus-Zaehler | nein. Braucht zusaetzlich 100 Mrd und Hacking 2.500 ODER alle Kampfwerte 1.500 | `FactionInfo.tsx:138-149`; bester V2-Lauf in `backups/`: min. Kampfwert **517** (BN4L3), Hacking max. 651 (`verify-g02-v2stats.mjs`, liest die Werte - koennte den Fall zeigen) |
| Covenant (20 Augs, Hack 850, Kampf 850) / Illuminati (30, 1.500, 1.200) | nein, dieselbe Messung | dito |
| Rangtausch HASH-1 | nein. Der Tausch laeuft nur im 1. Zyklus mit dem Gratis-Server, der die Augs nie sieht. Danach 0,03 H/s: selbst mit HASH-1/HASH-3 Stufe 0 (250 H) alle 2,3 h = 100 Rang, die Augs machen daraus ~+18 Rang/h gegen gemessene 435-1.038 Rang/h | Abschnitt 4 und 6 |
| BN15 (H8 ignoriert BladeburnerRank 0,2, Hash-Rang 5x wertvoller) | nein, solange nach dem Einbau keine Flotte gebaut wird | wie oben |
| Mindestwarteschlange 3 (`src/bn4rep.js:603,1259,1372`) | nur als Fuellstueck: es ermoeglicht Einbauten mit 1-2 echten Stuecken - genau das, was die Regel vom 28.08. verhindern soll. Kein Wert | `:1234-1256` |
| V1 (BN8) | Filter gar nicht aktiv (`nurKampfStuecke` false), Kauf fuer Daedalus richtig | `src/bn4rep.js:661-666` |

## 5. Die richtige Regel

`mitHashes` muss heissen: **"in diesem Knoten kauft der Bot nach einem
Einbau Hacknet-Server"** - nicht "SF9 vorhanden". Das ist heute genau BN9
(`src/hacknet.js:94-111,154`). Auf der Restroute ist es damit in jedem
V2-Knoten false.

Verworfen: BN311-2 "`rangAusHashes > 0` in diesem Zyklus" (misst den
falschen Zyklus), "nur als letztes Stueck" (verteuert trotzdem die
NFG-Schleife, `src/bn4rep.js:1660-1685`), "SF9-Stufe" (das ist die heutige
Fehlregel).

## 6. Fehlermodi im unbeaufsichtigten Betrieb

1. **Weniger Fuellstuecke -> spaeterer Einbau in armen Knoten.** Ohne die
   Hacknet-Stuecke erreicht `wartend >= 3` in BN3/BN11 (Kaufkraft 1,8-7 % von
   BN2) spaeter. Kein Verklemmer: Ruf und Geld wachsen weiter, das dritte
   Stueck wird kaufbar. Es ist das Verhalten, das die 28.08.-Regel will - der
   Skeptiker soll aber pruefen, ob dort Einbauten mit 2 echten Stuecken bisher
   unbemerkt von den Fuellstuecken lebten.
2. **Einbaugruende verschieben sich.** Hacknet-Kandidaten mit kleiner Luecke
   (19:01: Core DNI, fehlt 1.918) halten heute `kleinsteLuecke` klein und
   blockieren `nichtsMehrOffen` (`src/bn4rep.js:814-868`). Ohne sie feuern diese
   Gruende frueher - neutral bis gut, im Test sichtbar machen.
3. **Zwei Bedingungen, die auseinanderlaufen.** Baut jemand HASH-2/HASH-3
   (Flotte nach dem Einbau ausserhalb BN9), muss der Filter mitgehen. Deshalb
   EIN Praedikat fuer `hacknet.js` und `bn4rep.js`.
4. **Bereits gekaufte Stuecke:** keine. Warteschlange 22:17 leer, die vier sind
   eingebaut, Netburners ist im laufenden Zyklus kein Mitglied (netburn
   gescheitert) - in BN2.1 droht nur noch Core DNI, und auch nur, falls
   Netburners spaeter beitritt. Volles Risiko wieder in **BN2.2 Zyklus 1**.
   Der Fix muss vor dem Sprung drin sein.
5. **Test schuetzt nicht:** `tools/test-kampfaugs.js:45-46` prueft nur
   `kampfknotenNuetzlich(...,true/false)`; die Fehlregel sitzt in der
   Berechnung von `mitHashes` in `bn4rep.js`. Ein Test dort fehlt.
6. **RAM:** keine Aenderung (`getResetInfo` bleibt, nur der `ownedSF`-Blick
   entfaellt).

## 7. Bauvorgabe

1. `src/lib/hackaugs.js`: reine Funktion exportieren
   `export function hacknetNachEinbau(knoten) { return knoten === 9; }`
   mit Kommentar (SF9.3-Server nur bis zum ersten Einbau,
   `Prestige.ts:327-339` / `PlayerObjectGeneralMethods.ts:130-131`; neu
   gekauft wird nur in `src/hacknet.js:154`). Kommentar `:328-330`
   ("hashes.js tauscht ... in jedem V2-Knoten") berichtigen.
2. `src/bn4rep.js:654-660` ersetzen durch
   `const mitHashes = hacknetNachEinbau(kaufKnoten);` (Import ergaenzen).
3. `src/hacknet.js:94` und `:154` auf dasselbe Praedikat umstellen (kein
   Verhaltenswechsel, nur Gleichlauf).
4. `tools/test-kampfaugs.js`: `hacknetNachEinbau(2|3|11|15) === false`,
   `(9) === true`; Quellprobe, dass `bn4rep.js` `mitHashes` aus
   `hacknetNachEinbau` bildet und nicht mehr aus `ownedSF`/`sf.get(9)`.
5. Pflicht-Skeptiker (laeuft unbeaufsichtigt), Commit mit `[skeptiker]`,
   vor dem Sprung nach BN2.2 einspielen.
6. Nachmessung BN2.2 Zyklus 1: keine "Hacknet Node" in
   `queuedAugmentations`; `moneySourceA.augmentations` gegen die Formel
   (`verify-g02-calc.mjs` Abschnitt 2 auf den neuen Stand zeigen).

Nicht Teil dieses Fixes (eigene Punkte, P3):

- **N1 Netburners-Beitritt im V2 verduennt den Vertragsruf.** Netburners
  verkauft nur die fuenf Hacknet-Augs (`Augmentations.ts:853-905`), bietet aber
  Hacking-Arbeit an (`FactionInfo.tsx:677`). Vertragsruf geht an eine
  zufaellige bzw. zu gleichen Teilen an alle Hacking-Faktionen
  (`PlayerObjectGeneralMethods.ts:514-536`): bei 8 Hacking-Faktionen bekommt
  jede andere ohne Netburners 8/7 = +14 %. In BN2.1 Zyklus 1 floss Netburners
  1.379 -> 10.582 Ruf zu. netburn/joinrun sollten Netburners im V2 nur bei
  `hacknetNachEinbau` holen (V1 unveraendert). Wert in Rang: nicht gerechnet.
  Gehoert zu FAKT-1 (Beitrittspolitik).
- **N2 Vorbedingung im Kaufblock.** `src/bn4rep.js:1737-1744` sortiert nur nach
  Preis; ATII (42,5 Mio) kommt vor ATI (15 Mio) dran, scheitert an der
  Vorbedingung und ist in der naechsten Runde 1,9^k teurer. Ohne
  Hacknet-Stuecke kostet das nur q7 statt q6 (+1,8 Mrd), mit ihnen das ganze
  Stueck. Fix: gescheiterte Vorbedingungs-Stuecke in derselben Runde nach
  jedem erfolgreichen Kauf erneut versuchen.
- **N3 Zaehlplatz im V2** (`src/bn4rep.js:2014,2077`, `src/lib/einbau.js:94-96`):
  nur Anzeige (`ziel`/`rangliste`); einziger Leser mit Wirkung ist
  `src/sleeve.js:404-409`, und der laeuft nur im Hackingweg
  (`teileHackingwegZu`). Kosmetik, mitnehmen oder lassen.

## 8. Rechnungen (gekuerzt, `node tools/audit/verify-g02-calc.mjs`)

    === 1. Zeitlinien ===  17-16/17-17/18-04/18-39 lastSave 08:32:54Z (q 7/11/5/5);
      18-45 lastSave 16:44:18Z q 11; 19-01 q 11 augA 20,3985; 19-17 q 0 NFG 6
    === 2. ===  17-17 Soll 28,4048 / Ist 28,4048 OK;  19-01 Soll 20,3985 / Ist 20,3985 OK
    === 3. ===  Geld 15,55 Mrd L0=3 q=11: Ist 3 Stufen | Soll 3  OK
    === 4. ===  hnMult Ist 2,879799 / Soll 2,879799 OK; Server Soll 0,00616277 / Ist 0,00616277 OK
    === 5. ===  mit: NTII q5, [ATII Vorbedingung], Kernel q6, ATI q7, CPU q8, Cache q9, NIC q10
                Reihenfolge OK, Ausgabe Soll 10,7388 / Ist 10,7388 OK
                ohne: NTII q5, ATI q6, ATII q7 (3,7990 Mrd)
                verursacht 8,9189 Mrd (43,7 %), NFG mit 3 | ohne 6 (Variante ohne ATII: 7)
    === 6. ===  BN2.1 +11,6 Mio $/h; Obergrenze BN2/BN15 +123,8, BN11 +12,4 Mio $/h
    === 7. ===  Elastizitaet dex 0,202, Kampf 0,721; Kompetenz x1,0601;
                ln-Zuwachs 0,0565/h -> ~1,03 h
