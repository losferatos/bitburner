# Teil 1a - Zeitleiste aller Laeufe seit dem 19.08.2026

Stand: 12.11.2026 19:41Z (Systemzeit). Alle Zeiten UTC, falls nicht anders vermerkt. Quelldaten: `nodes/audit-lauf2/chronik.json` (dort je Lauf Quellen, Einbauzeitpunkte, Notizen).

**Kurzfassung:** 44 Laeufe (BN1.1 bis BN8.2) in 2.043 h Wanduhr (85,1 Tage seit Spielerstellung am 19.08.2026 16:35Z). Online-Zeit ist erst ab dem 03.09.2026 23:13Z messbar: dort 1.079 h online von 1.676 h Wanduhr (64 %, Spanne 1.041-1.117 h). Davor (366,6 h Wanduhr, 18 % der Gesamtzeit) ist die Online-Zeit unbekannt. 14 von 15 BitNodes stehen auf SF3, BN8 auf SF1 (Lauf BN8.2 laeuft).

## 1. Methode (wie gemessen wurde)

- **Beginn/Ende je Lauf** = `lastNodeReset` aus dem PlayerSave der Sicherungen (Zeitpunkt des Knotenwechsels, sekundengenau). Das Ende eines Laufs ist der `lastNodeReset` des naechsten Laufs. Fuer die fuenf Laeufe vor den Sicherungen (BN1.1 bis BN10.1): Ende = Achievement `SFx.1` mit `unlockedOn` im Spielstand `LIVE_..._BN8L2_...hourly` (SF-Erwerb = Knotenende), Beginn von BN1.1 = Spielerstellung (Rueckrechnung `ts - totalPlaytime`).
- **`lauf` in INDEX.tsv = das Source-File-Level, das der Lauf erarbeitet** (BN4 Lauf 2 = SF4 Stufe 2). `sfAtStart` aus der ersten erhaltenen Sicherung des Laufs.
- **Online-Zeit (ab 03.09.2026 23:13Z):** Wanduhr minus Offline. Eine Luecke > 70 min zwischen zwei aufeinanderfolgenden Zeilen in `backups/INDEX.tsv` gilt als Offline (die Bruecke sichert stuendlich nur bei verbundenem Spiel). Abgezogen wird die Luecke minus 30 min (die letzte hourly lag im Mittel eine halbe Stunde vor dem Abbruch); die Spanne min/max nimmt 0 bzw. 60 min. Das ist **nicht** die Methode von `tools/checkin.js` (die zieht nur `Spielverbindung getrennt`-Fenster aus `data/bridge.log` ab, siehe `tools/lib/v1kurve.js` offlineFenster/onlineStunden); die ist in der Spalte `onlineHBridgeLog` mitgefuehrt, ueberschaetzt aber die Online-Zeit, weil eine tote Bruecke oder ein ausgeschalteter Rechner kein `getrennt` schreibt (54 Fenster = 290 h gegen 635 h Luecken im Index, 34 Luecken ohne jedes Fenster).
- **Gegenprobe:** `data/dashboard-history.json` (5-Minuten-Takt, 29.10.-12.11.) zeigt 16 Luecken = 125,6 h Offline; INDEX-Methode im selben Fenster: 133,3 h roh, minus 16 x 0,5 h = 125,3 h. Die Mitte der Spanne trifft also auf 0,3 h.
- **`totalPlaytime` ist Wanduhr:** `ts - totalPlaytime` ist ueber alle 258 Sicherungen konstant (19.08.2026 16:35:00-16:36:04Z, Streuung 1,1 min). Das Spiel schreibt Offline-Zeit voll gut; die Differenz taugt nicht als Online-Zeit.
- **Einbauten** = unterscheidbare `lastAugReset`-Werte ungleich `lastNodeReset` in den Sicherungen des Laufs (jeder Einbau setzt ihn neu; jede pre-install-Sicherung traegt den Wert des Vorgaengers, die pre-jump-Sicherung den des letzten), plus 1, wenn nach der letzten pre-install-Sicherung kein neuer Wert mehr zu sehen ist. Das ist genauer als das Zaehlen der pre-install-Zeilen: Wiederholversuche (derselbe Wert zweimal) werden nicht doppelt gezaehlt (BN3.1: 2 Zeilen, 1 Einbau; BN12.1: 10 Zeilen, 9 Einbauten; BN15.3: 3 Zeilen, 2 Einbauten; BN5.3: 14 Zeilen, 13 Einbauten).

## 2. Tabelle aller Laeufe

Online: Mitte der Spanne (min-max in `chronik.json`). `?` = nicht messbar. Einbauten: `n` exakt, `>=n` Untergrenze (Einbauten vor der ersten pre-install-Sicherung koennen fehlen; kein pre-jump). Verfahren: V1 Hacking (Red Pill + w0r1d_d43m0n), V2 Bladeburner (21 Black Ops).

| Lauf | Beginn (UTC) | Ende (UTC) | Wanduhr h | online h | offline % | Einbauten | Verf. | Beleg Ausgang | SF-Summe beim Eintritt |
|---|---|---|---:|---:|---:|---:|---|---|---:|
| BN1.1 | 08-19 16:35 | 08-21 14:43 | 46,1 | ? | ? | >=4 | V1 | Daedalus beigetreten 21.08. 10:20Z (Achievement) | 0 |
| BN4.1 | 08-21 14:43 | 08-23 15:18 | 48,6 | ? | ? | ? | V1 | V1 laut ROADMAP Abschnitt 6/ROUTE.md | 1 |
| BN5.1 | 08-23 15:18 | 08-24 19:21 | 28,1 | ? | ? | ? | V1 | V1 laut ROADMAP Abschnitt 6/ROUTE.md | 2 |
| BN6.1 | 08-24 19:21 | 08-28 15:05 | 91,7 | ? | ? | >=1 | V2 | 21 Black Ops (ROUTE.md 28.08.) | 3 |
| BN10.1 | 08-28 15:05 | 09-01 13:59 | 94,9 | ? | ? | ? | V2 | V2 laut nodes/KURS.md | 4 |
| BN10.2 | 09-01 13:59 | 09-06 10:31 | 116,5 | >=57,2 (Teil) | ? | >=5 | V2 | letzte Sicherung Rang 250.309 (06.09. 01:55 MESZ | 5 |
| BN10.3 | 09-06 10:31 | 09-10 11:51 | 97,3 | 48,0 | 51 | >=4 | V2 | letzte Sicherung Rang 371.679, keine pre-jump-Si | 6 |
| BN4.2 | 09-10 11:51 | 09-12 11:02 | 47,2 | 33,6 | 29 | >=7 | V2 | letzte Sicherung Rang 415.317, keine pre-jump-Si | 7 |
| BN4.3 | 09-12 11:02 | 09-14 15:02 | 52,0 | 34,2 | 34 | >=9 | V2 | V2 laut route.json; keine pre-jump-Sicherung, Ra | 8 |
| BN9.1 | 09-14 15:02 | 09-18 23:08 | 104,1 | 34,1 | 67 | >=4 | V2 | letzte Sicherung Rang 465.920, keine pre-jump-Si | 9 |
| BN9.2 | 09-18 23:08 | 09-22 08:51 | 81,7 | 49,8 | 39 | >=5 | V2 | Rang 1.174.378 (>=400.000) | 10 |
| BN9.3 | 09-22 08:51 | 09-24 14:25 | 53,6 | 46,6 | 13 | 4 | V2 | Rang 623.300 | 11 |
| BN1.2 | 09-24 14:25 | 09-25 09:58 | 19,5 | 11,8 | 40 | 11 | V1 | The Red Pill installiert (pre-jump-Sicherung), H | 12 |
| BN1.3 | 09-25 09:58 | 09-25 22:39 | 12,7 | 12,7 | 0 | 11 | V1 | The Red Pill installiert, Hacking 4966 | 13 |
| BN5.2 | 09-25 22:39 | 09-26 18:35 | 19,9 | 19,9 | 0 | >=13 | V1 | V1 laut route.json; keine pre-jump-Sicherung (En | 14 |
| BN5.3 | 09-26 18:35 | 09-28 17:21 | 46,8 | 19,3 | 59 | 13 | V1 | The Red Pill installiert, Hacking 6224 | 15 |
| BN12.1 | 09-28 17:21 | 09-30 18:10 | 48,8 | 12,0 | 75 | 9 | V1 | The Red Pill, Hacking 6071 | 16 |
| BN12.2 | 09-30 18:10 | 10-01 18:24 | 24,2 | 12,3 | 49 | 11 | V1 | The Red Pill, Hacking 8498 | 17 |
| BN12.3 | 10-01 18:24 | 10-03 02:42 | 32,3 | 13,7 | 58 | 9 | V1 | The Red Pill, Hacking 7102 | 18 |
| BN2.1 | 10-03 02:42 | 10-04 08:38 | 29,9 | 23,1 | 23 | 2 | V2 | Rang 488.516 | 19 |
| BN2.2 | 10-04 08:38 | 10-05 05:04 | 20,4 | 15,4 | 25 | 1 | V2 | Rang 550.010 | 20 |
| BN2.3 | 10-05 05:04 | 10-05 19:34 | 14,5 | 14,5 | 0 | 1 | V2 | Rang 458.657 | 21 |
| BN3.1 | 10-05 19:34 | 10-06 17:18 | 21,7 | 7,4 | 66 | 1 | V2 | Rang 460.147 | 22 |
| BN3.2 | 10-06 17:18 | 10-07 16:02 | 22,7 | 12,9 | 43 | 2 | V2 | Rang 503.572 | 23 |
| BN3.3 | 10-07 16:02 | 10-09 03:57 | 35,9 | 18,9 | 47 | 2 | V2 | Rang 505.498 | 24 |
| BN11.1 | 10-09 03:57 | 10-10 08:28 | 28,5 | 18,3 | 36 | 0 | V2 | Rang 454.620 | 25 |
| BN11.2 | 10-10 08:28 | 10-11 08:00 | 23,5 | 23,5 | 0 | 1 | V2 | Rang 452.560 | 26 |
| BN11.3 | 10-11 08:00 | 10-12 16:14 | 32,2 | 22,5 | 30 | 2 | V2 | Rang 488.406 | 27 |
| BN6.2 | 10-12 16:14 | 10-14 03:44 | 35,5 | 9,1 | 74 | 2 | V2 | Rang 466.026 | 28 |
| BN6.3 | 10-14 03:44 | 10-15 13:52 | 34,1 | 13,9 | 59 | >=1 | V2 | V2 laut route.json (nur eine Sicherung, Rang 1.9 | 29 |
| BN7.1 | 10-15 13:52 | 10-18 16:55 | 75,1 | 52,8 | 30 | 4 | V2 | Rang 473.776 | 30 |
| BN7.2 | 10-18 16:55 | 10-21 07:16 | 62,3 | 47,2 | 24 | 4 | V2 | Rang 483.108 | 31 |
| BN7.3 | 10-21 07:16 | 10-24 02:43 | 67,5 | 67,5 | 0 | 4 | V2 | Rang 453.883 | 32 |
| BN14.1 | 10-24 02:43 | 10-25 16:08 | 37,4 | 31,3 | 16 | 2 | V2 | Rang 438.728 | 33 |
| BN14.2 | 10-25 16:08 | 10-26 19:41 | 27,6 | 20,7 | 25 | 2 | V2 | Rang 443.225 | 34 |
| BN14.3 | 10-26 19:41 | 10-27 17:59 | 22,3 | 22,3 | 0 | 1 | V2 | Rang 436.041 | 35 |
| BN13.1 | 10-27 17:59 | 10-29 18:59 | 49,0 | 41,3 | 16 | 3 | V2 | Rang 432.176 | 36 |
| BN13.2 | 10-29 18:59 | 11-01 07:58 | 61,0 | 36,6 | 40 | 3 | V2 | Rang 451.141 | 37 |
| BN13.3 | 11-01 07:58 | 11-02 13:24 | 29,4 | 29,4 | 0 | 2 | V2 | Rang 439.858 | 38 |
| BN15.1 | 11-02 13:24 | 11-06 17:59 | 100,6 | 35,5 | 65 | 6 | V2 | Rang 419.561 | 39 |
| BN15.2 | 11-06 17:59 | 11-08 12:15 | 42,3 | 36,0 | 15 | 3 | V2 | Rang 444.647 | 40 |
| BN15.3 | 11-08 12:15 | 11-09 21:57 | 33,7 | 33,7 | 0 | 2 | V2 | Rang 437.409 | 41 |
| BN8.1 | 11-09 21:57 | 11-12 11:02 | 61,1 | 31,6 | 48 | 3 | V1 | The Red Pill, Hacking 3721 | 42 |
| BN8.2 | 11-12 11:02 | laufend | 8,7 | 8,7 | 0 | 0 | V1 |  | 43 |

Zeilen BN1 L1 bis BN10 L1 (vor 03.09.2026): Online unbekannt; Einbauten nicht belegt ausser BN1 L1 mit mindestens 4 (Commit 1f682bd) und BN6 L1 mit mindestens 1. BN10 L2: Wanduhr 57,2 h vor dem Indexbeginn ohne Messung, online nur fuer die abgedeckten 59,3 h bestimmt. BN8 L2 laeuft (Wanduhr bis 12.11. 19:41Z).

## 3. Summen

**Gesamt:** Wanduhr 2.043,1 h (davon 366,6 h vor Indexbeginn). Online ab 03.09. 23:13Z: 1.079,4 h von 1.676,5 h Wanduhr (Spanne 1.041-1.117 h), Offline 597,1 h (35,6 %). Einbauten ab BN10 L2 (39 Laeufe): 169 (Untergrenze fuer die frueh gestarteten Laeufe).

| BitNode | Laeufe | Wanduhr h | online h (nur abgedeckter Teil) | davon abgedeckte Wanduhr h | Einbauten (Summe) |
|---|---:|---:|---:|---:|---:|
| BN1 | 3 | 78,4 | 24,5 | 32,2 | >=26 |
| BN2 | 3 | 64,9 | 53,1 | 64,9 | 4 |
| BN3 | 3 | 80,4 | 39,2 | 80,4 | 5 |
| BN4 | 3 | 147,8 | 67,8 | 99,2 | >=16 |
| BN5 | 3 | 94,8 | 39,2 | 66,7 | >=26 |
| BN6 | 3 | 161,3 | 23,0 | 69,6 | >=4 |
| BN7 | 3 | 204,9 | 167,5 | 204,9 | 12 |
| BN8 | 2 | 69,7 | 40,2 | 69,7 | 3 |
| BN9 | 3 | 239,4 | 130,5 | 239,4 | >=13 |
| BN10 | 3 | 308,8 | 105,3 | 156,6 | >=9 |
| BN11 | 3 | 84,3 | 64,3 | 84,3 | 3 |
| BN12 | 3 | 105,3 | 37,9 | 105,3 | 29 |
| BN13 | 3 | 139,4 | 107,4 | 139,4 | 8 |
| BN14 | 3 | 87,3 | 74,3 | 87,3 | 5 |
| BN15 | 3 | 176,6 | 105,1 | 176,6 | 11 |

Hinweis zur Spalte online: Bei BN1, BN4, BN5, BN6, BN10 fehlt jeweils der Lauf L1 (vor dem Index), bei BN10 L2 ein Teil. Wanduhr und online beziehen sich dort auf verschiedene Laeufe; Vergleiche nur ueber die Spalte 'abgedeckte Wanduhr'.

## 4. Ausgangslage am 19.08.2026

- Der Spielstand wurde **am 19.08.2026 um 16:35:12Z neu angelegt** (totalPlaytime-Rueckrechnung, konstant ueber alle Sicherungen). Erste Skriptausfuehrung (Achievement `NS2`) 16:42:17Z, erster Einbau (`INSTALL_1`) 22:10:16Z, erster Commit des Bots 19.08. 19:53 MESZ (17:53Z).
- **Source-Files: keine.** BitNode 1, kein SF besessen. Belege: README im ersten Commit 7ebf2a4 ('BitNode 1', 'Ohne Source File 4 gibt es keine Singularity-API'); `SF1.1` wird erst am 21.08.2026 14:43:13Z freigeschaltet, `SF4.1` am 23.08. 15:18:32Z usw. (Achievements im Spielstand); die aelteste erhaltene Sicherung (`save-2026-08-28-0740-vor-exploits.json.gz`, BN6 L1) zeigt `{1:1,4:1,5:1}`. 'Source-File -1' bezeichnet in den Notizen die Exploits (BAUSTELLEN.md Zeile 2842), nicht ein Eintrag in `sourceFiles`; am 29.08. waren 7 von 11 Exploits eingesammelt, im aktuellen Spielstand alle 11.
- Die Source-File-Stufen entstanden dann in dieser Reihenfolge (Achievement-Zeitstempel, jeweils Stufe 1; Stufen 2/3 ergeben sich aus den Laeufen): SF1 21.08., SF4 23.08., SF5 24.08., SF6 28.08., SF10 01.09., SF9 18.09., SF12 30.09., SF2 04.10., SF3 06.10., SF11 10.10., SF7 18.10., SF14 25.10., SF13 29.10., SF15 06.11., SF8 12.11.

## 5. Soll-Ist-Reihenfolge

**Plan-Versionen** (alle im Repo belegt):

| Datum | Quelle | Reihenfolge |
|---|---|---|
| 22.08. | `nodes/ROADMAP.md` Abschnitt 6 (Commits 3a8a88d, 19475e6; 'nach drei Skeptikerrunden neu gegruendet') | je Knoten einmal (SF Stufe 1): BN4 (V1 erzwungen), BN6, BN10, BN5, BN2, BN3, BN11, BN12, BN9, BN7, BN14, BN13, BN15, BN8 |
| 23.08. | `nodes/ROADMAP-KORREKTUR.md` (Entwurf) | BN5 weit nach vorn, BN11 frueh, BN1 erneut, BN2 frueh, BN13/14 ans Ende, BN9 nach SF1.3/SF5.3; Ziel jetzt 'Stufe 3 in allen 15 Knoten' |
| 24.08. 21:11 MESZ | `nodes/ROUTE.md` (Commit 7c68802, 'beschlossen') | 44 Laeufe: BN5 L1 (lief), BN6 L1, BN10 L1-3, BN4 L2-3, BN9 L1-3, BN1 L2-3, BN5 L2-3, BN12 L1-3, BN2 L1-3, BN3 L1-3, BN11 L1-3, BN6 L2-3, BN7 L1-3, BN14 L1-3, BN13 L1-3, BN15 L1-3, BN8 L1-3 |
| 02.09. | `src/route.json` (Commit 9160c75; Stand 2026-09-02, 'die Reihenfolge steht fest') | ab BN10 L2 identisch zu ROUTE.md, 40 Eintraege |
| 07.10. | `nodes/AUDIT-ROADMAP-PRUEFUNG-2026-10.md` (Commit 278be75) | 'Route bleibt'; einziger Umstellungskandidat (BN6.2/6.3 + BN7 vor BN11) nach Skeptikerrunde verworfen; BN15 V1b (Labyrinth) 07.10. als nicht bauen entschieden |

**Ist** (Reihenfolge der Knotenwechsel aus Spielstaenden/Achievements): BN1 L1 -> BN4 L1 -> BN5 L1 -> BN6 L1 -> BN10 L1 -> BN10 L2 -> BN10 L3 -> BN4 L2 -> BN4 L3 -> BN9 L1-3 -> BN1 L2 -> BN1 L3 -> BN5 L2 -> BN5 L3 -> BN12 L1-3 -> BN2 L1-3 -> BN3 L1-3 -> BN11 L1-3 -> BN6 L2 -> BN6 L3 -> BN7 L1-3 -> BN14 L1-3 -> BN13 L1-3 -> BN15 L1-3 -> BN8 L1 -> BN8 L2 (laeuft; BN8 L3 geplant).

**Pruefung:** Die 39 Laeufe ab BN10 L2 stehen in exakt der Reihenfolge von `src/route.json` (Programmvergleich: 0 Abweichungen; naechster Eintrag der Route ist BN8 L3). Auch gegenueber `ROUTE.md` gibt es keine Abweichung. Die Abweichungen betreffen also den Weg dorthin und die Plan-Versionen untereinander:

| Abweichung | Wann | Grund (Beleg) |
|---|---|---|
| Spiel begann in BN1; BN1 L1 stand in keinem Plan (ROADMAP Abschnitt 6 beginnt bei BN4) | 19.-21.08. | Ausgangslage: neues Spiel in BN1; SF1 war der erste erreichbare Ausgang. Kein Planbruch, aber 46 h Wanduhr, die in keiner Roadmap-Rechnung stehen |
| BN5 L1 als dritter Lauf, **vor** BN6 und BN10 (ROADMAP Abschnitt 6: BN4, BN6, BN10, BN5) | Entscheidung 23.08. (Eintritt BN5 am 23.08. 15:18Z); ROUTE.md fuehrt es am 24.08. als 'Platz 1' | `ROADMAP-KORREKTUR.md`: 'BN5 weit nach vorn: WorldDaemonDifficulty 1,5, NFG-Bedarf null, also Stunden', SF5 +8 % auf hacking und hacking_exp, Intelligence, formulas.exe gratis; Uebergangsblock BN4 -> BN5 vom 23.08. 16:55 |
| BN9 L1-3 und BN1/BN5 L2-3 und BN12 **vor** BN2/BN3/BN11 (ROADMAP: BN2, BN3, BN11, BN12, BN9) | 24.08. (ROUTE.md) | Sortierregel 'Beschleuniger zuerst, reine Pflichtlaeufe zuletzt'; SF9.2: 128 GB statt 32 GB home je Knotenstart, SF9.3 Gratis-Hacknet-Server; SF1: x1,28 auf alle Multiplikatoren (ROUTE.md Abschnitt 1 und 3) |
| BN4 L2/L3 und BN10 L2/L3 sofort statt einmal je Knoten | 24.08. (ROUTE.md) | Ziel gewechselt von 'jeden Knoten einmal' auf 'Stufe 3 in allen 15 = 45 Laeufe'; SF4.2/4.3 teilen Singularity-RAM durch 4/16, SF10.x je ein Sleeve |
| BN6 L2/L3 erst nach BN11 (ROADMAP: BN6 einmal an Platz 2) | 24.08. (ROUTE.md) | SF6.2/6.3 bringen nur +4/+2 % Kampf, 'reine Pflicht, also dann, wenn Laeufe am billigsten sind' |
| BN7 vor BN14/13/15 | 24.08. (ROUTE.md) | SF7.3 schenkt Blades Simulacrum (Bladeburner-Aktion und Arbeit gleichzeitig), beschleunigt die teuren Spaetlaeufe |
| BN8 ganz am Ende, alternativlos V1 | 22.08./24.08. | kein Bladeburner, keine Gang, keine Corp; braucht Boersen-Bot (`boerse.js`) |
| BN5 L2: Spiel blieb auf der BitVerse-Auswahl stehen statt Bot-Sprung | 26.09. | `bn4door` backdoorte `w0r1d_d43m0n`; Commits f89a5b1/d4439a7; 31 min Stillstand zwischen letzter Sicherung (18:04Z) und BN5.3-Beginn (18:35Z) |

**Geplante gegen tatsaechliche Dauer je Stufe 1** (ROADMAP Abschnitt 6, Spalte Zeit; die Uhr der Planzahl ist dort nicht definiert, sie stammt aus einer Simulation und ist vermutlich Spiel-/Online-Zeit):

| BN | Plan h | Ist L1 Wanduhr | Ist L1 online | Ist L2 Wanduhr/online | Ist L3 Wanduhr/online |
|---|---|---:|---:|---|---|
| BN4 | 60-120 | 48,6 | ? | 47,2 / 33,6 | 52,0 / 34,2 |
| BN6 | 48-84 | 91,7 | ? | 35,5 / 9,1 | 34,1 / 13,9 |
| BN10 | 35-57 | 94,9 | ? | 116,5 / >=57,2 | 97,3 / 48,0 |
| BN5 | 29 | 28,1 | ? | 19,9 / 19,9 | 46,8 / 19,3 |
| BN2 | 29 | 29,9 | 23,1 | 20,4 / 15,4 | 14,5 / 14,5 |
| BN3 | 29 | 21,7 | 7,4 | 22,7 / 12,9 | 35,9 / 18,9 |
| BN11 | 29 | 28,5 | 18,3 | 23,5 / 23,5 | 32,2 / 22,5 |
| BN12 | 30 | 48,8 | 12,0 | 24,2 / 12,3 | 32,3 / 13,7 |
| BN9 | 32 | 104,1 | 34,1 | 81,7 / 49,8 | 53,6 / 46,6 |
| BN7 | 44 | 75,1 | 52,8 | 62,3 / 47,2 | 67,5 / 67,5 |
| BN14 | 44 | 37,4 | 31,3 | 27,6 / 20,7 | 22,3 / 22,3 |
| BN13 | 54 | 49,0 | 41,3 | 61,0 / 36,6 | 29,4 / 29,4 |
| BN15 | 94 | 100,6 | 35,5 | 42,3 / 36,0 | 33,7 / 33,7 |
| BN8 | 30-70 | 61,1 | 31,6 | 8,7 / 8,7 (laeuft) | - |
| BN1 | - | 46,1 | ? | 19,5 / 11,8 | 12,7 / 12,7 |

Gesamt: `ROUTE.md` Abschnitt 3 schaetzte 'rund 41 Restlaeufe, 1.100 bis 1.900 Stunden'. Tatsaechlich sind seit Beginn von BN6 L1 (24.08.) 41 Laeufe angefangen (40 fertig, BN8 L2 laeuft) und 1.920 h Wanduhr verbraucht; BN8 L3 fehlt noch. Online ist dieser Teil nur ab 03.09. messbar (1.079 h plus unbekannte Anteile von BN6 L1/BN10 L1/BN10 L2).

## 6. Auffaelligkeiten

**Laengste Laeufe nach Wanduhr:** BN10 L2 116,5 h, BN9 L1 104,1 h, BN15 L1 100,6 h, BN10 L3 97,3 h, BN10 L1 94,9 h (danach BN6 L1 91,7 h, BN9 L2 81,7 h, BN7 L1 75,1 h). **Nach Online-Zeit (nur gemessene Laeufe):** BN7 L3 67,5 h, BN7 L1 52,8 h, BN9 L2 49,8 h, BN10 L3 48,0 h, BN7 L2 47,2 h, BN9 L3 46,6 h, BN13 L1 41,3 h.

1. **Stufe 1 ist meist die teuerste Stufe eines Knotens** (Lernkosten, Fehler im Erstlauf): BN15 100,6 -> 42,3 -> 33,7 h; BN9 104,1 -> 81,7 -> 53,6 h; BN6 91,7 -> 35,5 -> 34,1 h; BN12 48,8 -> 24,2 -> 32,3 h; BN14 37,4 -> 27,6 -> 22,3 h; BN2 29,9 -> 20,4 -> 14,5 h. Ausnahmen: BN3 (21,7 / 22,7 / 35,9 h) und BN13 (49,0 / 61,0 / 29,4 h).
2. **Kaltstart-Stillstaende in BN10 L2 und L3:** In BN10 L2 kam der erste Einbau erst 47 h nach Laufbeginn (03.09. 13:22Z; BAUSTELLEN.md Zeile 871: `bn4rep.js` (847 GB) passte auf keinen Rechner, der Mietrechner kostet in BN10 das Fuenffache; Commits 14d1bee, 9d425dc). In BN10 L3 stand der Lauf am 07.09. nach 10,5 h Spielzeit bei identischem Geld (Commit d9c60c9), der erste beobachtete Einbau folgte erst 55 h nach Laufbeginn. BN9 L1: 26,5 h bis zum ersten beobachteten Einbau, dazu drei Brueckentode (Commits 362f332, 90e5ea2, de8757b) und 'Aug-Runde kostet einen Tag Anlauf' (8cb51f0). Zeit bis zum ersten Einbau steht je Lauf in `chronik.json` (`firstInstallAfterH`).
3. **Grosse Offline-Anteile** (nur Laeufe mit Messung): BN12 L1 75 %, BN6 L2 74 %, BN9 L1 67 %, BN3 L1 66 %, BN15 L1 65 %, BN6 L3 59 %, BN5 L3 59 %, BN12 L3 58 %. Im Schnitt 36 % der Wanduhr seit 03.09. Das sind Naechte und Arbeitstage des Rechners, keine Bot-Stillstaende; die Wanduhr wird dadurch fast doppelt so lang wie die Spielzeit der V2-Knoten (z. B. BN6 L2: 35,5 h Wanduhr, 9,1 h online).
4. **Ungewoehnlich viele Einbauten** haben die V1-Knoten (jeder Einbau wirft das Hacking-Level zurueck): BN5 L2 13, BN5 L3 13, BN1 L2 11, BN1 L3 11, BN12 L1-L3 9/11/9; V2-Knoten brauchen 0-4 (BN11 L1: 0, BN2 L2/L3 und BN14 L3: 1) mit Ausnahme von BN4 L3 (9), BN15 L1 (6), BN13/BN9 (3-5) und BN10 (4-5). BN8 L1 hatte nur 3 Einbauten (Einbauplan `lib/bn8plan.js`, 10.11.).
5. **Schnellste Laeufe:** BN1 L3 12,7 h (durchgehend online), BN2 L3 14,5 h, BN1 L2 19,5 h, BN5 L2 19,9 h. **Laengste online-Zeit pro Stufe:** BN7 (53/47/67 h online gegen Plan 44 h fuer L1), BN13 L1/L2 (41/37 h gegen Plan 54 h).
6. **Sprung klemmte in BN9 L2** (22.09.): pre-jump-Sicherung 08:08-08:12Z mehrfach abgelehnt wegen 2 wartender Augmentierungen, Rang 1,17 Mio beim Sprung (statt 400.000).
7. **Pause zwischen Laeufen:** meist < 1 h Wanduhr (Sprung -> naechster Lauf); in BN11 L1 lag der Rechner nach dem Sprung (03:57Z) 10,7 h offline bis zur ersten Sicherung (14:40Z).

## 7. Unsicherheiten (schwach belegte Zahlen)

1. **Online-Zeit vor 03.09.2026 23:13Z fehlt** (BN1 L1 bis BN10 L1 und der erste Teil von BN10 L2; zusammen 366,6 h Wanduhr). Weiche Indizien nur fuer BN10 L1: data/verlauf-strategie.json (5 Luecken > 70 min, 56,9 h) und data/aufsicht.log (3 Luecken, 40,3 h) deuten auf grob 38-55 h online von 94,9 h; nicht verwertbar fuer die anderen Laeufe. Die 08-28-Sicherung zeigt `totalPlaytime` = Wanduhr und hilft nicht.
2. **Online-Methode ist ein Modell:** Luecken > 70 min im Index heissen 'kein Backup', nicht zwingend 'Spiel aus' (eine tote Bruecke bei laufendem Spiel zaehlt hier als offline). Unsicherheit je Luecke +-30 min; Gesamt 1.041-1.117 h. Gegenprobe am Dashboard 29.10.-12.11.: 0,3 h Abweichung auf 14 Tage. `onlineHBridgeLog` (Methode von checkin.js) liegt systematisch zu hoch (z. B. BN10 L3: 79,4 h gegen 48,0 h; BN15 L1: 67,3 h gegen 35,5 h).
3. **Einbauten bei frueh gestarteten Laeufen sind Untergrenzen:** In BN10 L2, BN10 L3, BN4 L2, BN4 L3, BN9 L1, BN9 L2 (ohne pre-jump bzw. mit erstem Einbau vor der ersten pre-install-Sicherung; das Handschlag-Log beginnt erst am 05.09.) koennen Einbauten fehlen; in BN5 L2 und BN6 L3 fehlt die pre-jump-Sicherung, der letzte Einbau ist abgeleitet. BN10 L2: mindestens 5 (davon der erste am 03.09. 13:22Z), tatsaechlich eher mehr.
4. **Einbauten vor dem 03.09.** (BN1 L1, BN4 L1, BN5 L1, BN6 L1, BN10 L1): nicht belegt. Nur: BN1 L1 mindestens 4 ('vierter Reset', Commit 1f682bd, 21.08. vormittags), BN6 L1 mindestens 1. Die Sicherung vom 28.08. (05:40Z) zeigt lastAugReset 03:32Z, also mindestens einen Einbau in BN6 L1.
5. **Verfahren (V1/V2) belegt** durch Red Pill im Spielstand (7 Laeufe: BN1 L2/L3, BN5 L3, BN12 L1-L3, BN8 L1) oder Rang >= 400.000 in der pre-jump-Sicherung (24 V2-Laeufe). **Nur aus dem Plan** abgeleitet: BN4 L1, BN5 L1, BN6 L1 und BN10 L1 (Dokumente), BN4 L3 und BN6 L3 (route.json), BN5 L2 (route.json); BN10 L2/L3, BN4 L2, BN9 L1 aus dem Rangverlauf der letzten erhaltenen Sicherung.
6. **Ausgangslage:** 'keine Source-Files' ist aus dem ersten Commit (README) und den Achievement-Zeitstempeln erschlossen; es gibt keine Sicherung aus den ersten 9 Tagen. Der Spielstand hat vor dem Bot nie bestanden: Beginn 16:35Z liegt 1,3 h vor dem ersten Commit.
7. **Ende von BN8 L2** ist offen; BN8 L2 zaehlt mit 8,65 h bis 12.11. 19:41Z.
8. **Planzahlen in ROADMAP/ROUTE** haben keine definierte Uhr; der Vergleich Plan gegen Ist (Abschnitt 5) ist deshalb nur grob (Plan vermutlich Online-/Spielzeit, Wanduhr ist mit 36 % Offline durchschnittlich 1,5-mal laenger).
9. **Wanduhr-Ende = Knotenwechsel**, nicht 'Ziel erreicht': Zwischen dem Rang 400.000 und dem Sprung liegen teils Stunden (BN9 L2: Rang 1,17 Mio). Die Zeit bis zum Rang-Meilenstein steht in `data/dashboard-history.json` / `doku/rangkurve-*.json` und ist nicht Teil dieser Zeitleiste.
