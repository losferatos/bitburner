# Wiederherstellungsprobe — 2026-09-04T14:02:46.628Z

Erzeugt von `tools/wiederherstellung.js`. Die Probe fuehrt den Ladeweg des
Spiels (v3.0.1, `utils/SaveDataUtils.ts` und `SaveObject.ts`) auf einer
echten Sicherung aus - jede Zusicherung ist eine Bedingung aus dem
Quelltext, keine Vermutung.

**Ergebnis: 28 gruen, 0 rot.**

Geprueft: `LIVE_197f4d61481686_BN10L2_2026-09-04T15-18_hourly.json.gz`

## Was diese Probe NICHT zeigt

Den Klick auf `importGame` in einem laufenden Spiel. Er geht nur im Spiel,
er ist unwiderruflich, und auf der LIVE-Instanz ist er verboten (Erics
Bedingung). Alles, was `loadGame` VOR dem ersten Schreiben prueft, ist hier
geprueft; der Klick bleibt eine Messluecke der Ebene 3 und gilt nicht als
bestanden.

## Zusicherungen

### LIVE_197f4d61481686_BN10L2_2026-09-04T15-18_hourly.json.gz
- ok — die Datei ist lesbar und nicht leer
- ok — sie traegt die gzip-Kennung (Binaerformat, .json.gz)
- ok — sie entpackt sich zu gueltigem UTF-8 (decodeSaveData)
- ok — sie beginnt mit {"ctor":"BitburnerSaveObject"
- ok — sie parst als JSON
- ok — ctor ist BitburnerSaveObject
- ok — data ist ein Objekt
- ok — Pflichtschluessel PlayerSave ist eine Zeichenkette
- ok — Pflichtschluessel AllServersSave ist eine Zeichenkette
- ok — Pflichtschluessel CompaniesSave ist eine Zeichenkette
- ok — Pflichtschluessel FactionsSave ist eine Zeichenkette
- ok — Pflichtschluessel AliasesSave ist eine Zeichenkette
- ok — Pflichtschluessel GlobalAliasesSave ist eine Zeichenkette
- ok — Wahlschluessel StaneksGiftSave ist eine Zeichenkette
- ok — Wahlschluessel StockMarketSave ist eine Zeichenkette
- ok — Wahlschluessel SettingsSave ist eine Zeichenkette
- ok — Wahlschluessel LastExportBonus ist eine Zeichenkette
- ok — Wahlschluessel AllGangsSave ist eine Zeichenkette
- ok — Wahlschluessel VersionSave ist eine Zeichenkette
- ok — alle 14 Teilstaende parsen einzeln
- ok — PlayerSave traegt einen Spieler
- ok —   bitNodeN ist eine Zahl
- ok —   totalPlaytime ist eine Zahl > 0
- ok —   der Bladeburner-Rang steht im PlayerSave (M.8)
- ok —   kein eigener Schluessel BladeburnerSave
- ok — SettingsSave traegt den RFA-Port (der Fingerabdruck der Instanz)
- ok — Rundlauf gzip: der Text kommt unveraendert zurueck
- ok — Rundlauf base64 (Ersatzweg ohne Compression Streams)
