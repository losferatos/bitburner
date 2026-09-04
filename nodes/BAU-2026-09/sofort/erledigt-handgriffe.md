### Autoexec und Autostart: beide Handgriffe erledigt

Der Punkt fuehrte zwei offene Handgriffe von Eric. Beide sind erledigt, geprueft
am 04.09.2026 01:37 bis 01:49:

- **Autoexec im Spiel**: `SettingsSave.AutoexecScript` steht auf `"boot.js"`,
  gelesen ueber `getSaveFile`.
- **Windows-Autostart**: der Ordner enthaelt nur noch `desktop.ini`, mtime
  02.09.2026 19:07:46. Zusaetzlich geprueft wurden der Maschinen-Autostart und
  `HKCU\...\CurrentVersion\Run` mit zwoelf Eintraegen - kein Bitburner darunter.

Warum der Irrtum ueberlebt hat: `aufsicht.log` meldete bis 02.09. 19:05 alle zehn
Minuten "Autoexec ist leer" und bricht dann ab. Der Handgriff erfolgte um 19:07.
Die Logdatei friert damit ihren letzten Irrtum ein, und wer sie liest, haelt ihn
fuer den aktuellen Stand.

Das ist genau der Fall aus den Regeln: der Zustand ist der Zeuge, nicht der
Terminaltext. Geprueft wurde deshalb der Spielstand selbst und das Dateisystem,
nicht das Protokoll.
