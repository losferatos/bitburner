# Audit "ungenutzte Mechaniken" - Synthese (07.11.2026)

Ausloeser: go.js lief per Registry nur in BN13/14 und fehlte in BN15.1
komplett. Eric: "Wir kennen den Source Code und koennen daher zu jeder Zeit
die perfekte Entscheidung treffen - nutze das!"

Drei Pruefer (sonnet, nur lesend): BN15 (`bn15-bericht.md`), BN8
(`bn8-bericht.md`), Knoten-/SF-Sperren quer (`gating-bericht.md`). Danach zwei
Skeptiker-Runden zum Grafting. Verbleibende Route: BN15.2 (laeuft), BN15.3,
BN8.1-8.3.

## Erledigt am 07.11.

| Befund | Stand |
|---|---|
| go.js in BN15 aus (Registry [14,13]) | gebaut 5309b8a, laeuft seit 17:53. Nach 25 min 35/35 Siege, +32,5 % Kampfwerte; Black Op 10,1 % -> 12,5 %, Retirement 59 % -> 72 % |
| Grafting seit 04.09. nie gezuendet (graftplan.json zurueckgehalten) | gezuendet 18:32 (16cb398). Rechnung `graftplan-rechnung.txt`: ganzer Plan ~415 Mrd, ~31 h, Kampf grob x69 vor Entropie (0,98 je Graft) |
| Bladeburner stand bei jedem Graft still (Figur Prio 10 > 20) | 0d1b866: mit Simulacrum laeuft blade.js als `mit` neben dem Graft |
| Graft-Kette: Fehlversuch legt still, Sperre am unbezahlbaren Eintrag, Doppelstart, Fokus | 16cb398 (Skeptiker-Auflagen, NMI vorn, ohne Fokus, Dauer x1,25 bis NMI) |
| events.json: Flut aus figwatch warf jump/install hinaus | b70bccf (figwatch, graftauto, popups ueber lib/events.js) |

## BN8-Block: gebaut am 10.11.2026 (BN8 lief da schon seit dem 09.11.)

| Punkt | Stand |
|---|---|
| BN8-1 Depot vor dem Einbau | e9a0d6b: bn4rep legt data/boerse-pause.txt, boerse.js verkauft und quittiert; Einbaurunde kauft danach alles Verdiente (1277d5b). Kein Einbau ohne Quittung bei bekanntem Depot. |
| BN8-2 Bargeld | 1277d5b: Bargeld auf Abruf (data/boerse-abruf.txt), Daedalus-100-Mrd wird abgerufen und geschuetzt; mit 4S bleiben 2 % bar fuer Rechner/RAM. |
| BN8-3 4S nach Vermoegen | 1277d5b: Kauf ab 45 Mrd Vermoegen (gerechnet: 26 Mrd waere 1-2 h langsamer). Vor 4S kein Einbau. |
| BN8-4 Handelsregel | 1277d5b: lib/handel.js, Rang (2f-1)*mv, hoechstens 50 % je Titel. Gerechnet (60 Seeds): 250 Mio -> 1 Bio 14,4 h statt 21,2 h; Tiefpunkt 0,76 statt 0,90 des Startwerts. |

Nachpruefung 6d0b3e6. Rechnungen: `tools/audit/boerse-regel.mjs`,
`tools/audit/boerse-ruin.mjs`; Test `tools/test-handel.js` (boerse.js gegen
Mock + Marktmodell).

**Offen in BN8 (nicht gebaut, bewusst):**
- Einbau-Takt in BN8 ist nicht durchgerechnet. bn4rep nutzt die Ruf-Regeln
  der anderen Knoten, nur die Ruf-Luecke misst sich jetzt an der
  Wiederaufbauzeit (log2(W/250 Mio) x 40 min). Ein Einbau kostet hier Stunden.
- `fehl4S`/`sperre4SBis` leben nur im Speicher von boerse.js.
- Historie ohne 4S geht bei einem Neustart von boerse.js verloren (2 min blind).

## Urspruengliche Befunde (Stand 07.11., zur Herkunft)

Aus dem Audit vom 03.10. (`nodes/audit-2026-10-03/bn-bn15-8.md`), am 07.11.
bestaetigt:

1. **BN8-1: Einbau mit vollem Depot.** In BN8 setzt jeder Einbau das Geld auf
   250 Mio und loescht das Depot ohne Auszahlung (`Prestige.ts:158-171`,
   `StockMarket.ts:187-209`). bn4rep kennt kein Depot. Geschaetzt +70-100 h je
   Lauf. Vor jedem Einbau verkaufen.
2. **BN8-2: Daedalus verlangt 100 Mrd BARGELD** (`FactionJoinCondition.ts:134-145`),
   boerse.js haelt ~0 bar.
3. **BN8-3: 4S-Kauf nach Vermoegen statt Bargeld** (7,1 h zu spaet).
4. **BN8-4: Handelsregel** (heute nachgerechnet: Phase 1 12,7 h -> 9,2 h).

## Offen - pruefen/bauen, nach Ertrag

- **Grafting in BN8 fuer die 30 Pflicht-Augs der Daedalus-Einladung**
  (gegraftete zaehlen, `FactionJoinCondition.ts:123-130`; ~12 Mrd statt
  Einbauleiter). graftauto ist "verfahren V2". Sicherheit niedrig, -15 bis
  -40 h je Stufe moeglich.
- **Go-Gegner je Knoten**: BN8 gegen Daedalus (faction_rep, +33-48 %),
  nach Red Pill gegen w0r1d_d43m0n (hacking). go.js kennt nur Tetrads 7x7.
- **Darknet promoteStock in BN8** (Volatilitaet bis x4, `Darknet.ts:581-606`):
  grob -8 bis -12 h je Stufe, Aufwand hoch (Code auf Darknet-Server).
- **BN15: Gym parallel zu Bladeburner** (Simulacrum erlaubt Arbeit daneben;
  heute laeuft dort Faktionsarbeit fuer Rep). Nutzen unklar, erst rechnen.
- **BN15: Sleeves verbrennen Retirement-Vorrat** (13 Versuche, 0 Erfolge,
  Chance ~12 %). Klein.
- **Kosmetik:** `lib/reg.js:274` liest ownedSF[4] auf einer Map (nur KPI-Feld).

## Geprueft, lohnt nicht

Stanek (BN15 Groesse -2, BN8 < 0), Gang (Karma -54.000 ausserhalb BN2; BN8
Softcap 0), Corp (BN15 Bewertung x0,2 - nach Grafting neu bewerten; BN8 tot),
Hashes/Hacknet in BN8 (HacknetNodeMoney 0), Overclock, Spende in BN15
(Favor 150), Darknet-Nebengewerk BN15 (02.11. entschieden).

## Bekannter Rest

checkin.js zeigt bis zum naechsten Sprung weiter "1 gekaufte Augs beim Sprung
verfallen": der Sprung-Eintrag ist durch die alte Flut weg, der Wert stammt
aus der Zeit davor. Seit b70bccf zaehlt der Fall als bewusst gehalten.
