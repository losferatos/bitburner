#!/bin/sh
# Vergleich mit go.cheat: 4 Prozesse parallel (CPU-Deckel), je GO_MAX_SEK Sekunden.
# Aufruf: sh tools/goprobe/vergleich-cheat.sh '<json GO_CHEAT_OPT>' <go.js> [sekunden] [crime] [seed-label]
# Ausgabe: eine JSON-Zeile mit Siegquote, Schwarz-Punkten, Aktionen je Partie, Node Power je
# Aktion (Zeitmass: jede Aktion = eine Antwort des Gegners) samt Standardfehler.
O="$1"; F="$2"; T="${3:-240}"; export GO_CRIME="${4:-1.886}"
for k in 1 2 3 4; do
  GO_MAX_SEK=$T GO_CHEAT_OPT="$O" node --import ./tools/goprobe/register.mjs tools/goprobe/play-cheat.mjs 100000 "$F" 2>/dev/null &
done | node tools/goprobe/auswertung-cheat.mjs "$O" "$F"
