"""Prüfskript: sucht in Datenbank, Logs, Temp-Ordner, Browserprofil, Exporten und Spike-Berichten
nach Inhaltsresten.

Erlaubt sind nur Metadaten: IDs, Post-URLs, Zeitpunkte, Zahlen, Hashes, Link-Domains und
Account-Metadaten. Als Inhaltsrest gilt alles, was nach Post-Inhalt aussieht: HTML, Medien-URLs,
URLs außer Post-, Profil- und API-Adressen von Truth Social, lange Freitexte und auf Wunsch
eigene Stichproben (ein Satz aus einem echten Post, der nirgends vorkommen darf).

* **Datenbank:** jede Tabelle, jede Spalte, jede Zeile gegen eine Positivliste von Mustern je
  Spalte. Dazu die Rohdateien (auch ``-wal``, ``-shm``, ``-journal``) byteweise, denn gelöschte
  Zeilen können in freien Seiten oder alten WAL-Rahmen liegen bleiben. Die Datenbank wird nur
  lesend geöffnet; ohne ``-wal``-Datei als ``immutable``, damit SQLite keine Dateien anlegt.
* **Lange Freitexte** in Logs, Exporten, Berichten und Laufmeldungen: mehr als acht Wörter, die in
  keinem Meldungstext des Trackers vorkommen. Meldungstexte sind die String-Literale in Log-,
  Melde- und Ausgabeaufrufen, in ``raise``-Anweisungen, in ``cloudflare.melde`` und im
  Spike-Modul, nicht aber Bezeichner, Docstrings oder SQL. Eigene Meldungen bestehen aus diesen
  Wörtern plus IDs und Zahlen; ein mitgeschriebener Post-Text fällt dadurch auf, auch wenn er nur
  aus häufigen englischen Wörtern besteht, ohne dass irgendein Text inhaltlich ausgewertet wird.
* **Positivlisten** in der Datenbank zählen Wörter auch über Listen, ``|``-Verkettungen,
  JSON-Schlüssel und ``_``-verbundene Kennwörter hinweg: Eine Schlagwortliste geht nicht als
  harmloser Wert durch. Exporte prüfen bekannte Spalten (Link-Domains, Anzeigename, Handle) mit
  denselben Regeln wie die Datenbank.
* **Browserprofil:** nur Dateien der Positivliste (``browser.im_profil_erlaubt``); Cache-, Verlaufs-
  und alle anderen Dateien sind Funde. Die erlaubten Einstellungsdateien (``Preferences``,
  ``Local State`` …) werden Wert für Wert auf HTML und lange Freitexte geprüft, auch JSON, das als
  Zeichenkette in einem Wert steht. Keine Freitexte sind Werte ohne Leerraum (Base64, Hashes, Pfade)
  und die Manifeste eingebauter Erweiterungen (``extensions.…manifest``), die den Browser selbst
  beschreiben. Medien-URLs zählen dort nur von Truth Social: Der Browser legt eigene Bild-URLs ab.
* **Bericht:** nennt Ort, Art und höchstens Länge, Anzahl oder Musternamen, nie den Fund selbst.
  Sonst trüge die Prüfung die Inhalte auf die Konsole und in umgeleitete Ausgaben. Die geprüften
  Pfade stehen im Bericht, damit eine falsche Konfiguration auffällt.

Aufruf: ``python -m truthtracker.pruefung`` oder ``python -m truthtracker pruefen``. Mit
``--abfragen`` liest die Prüfung Stichproben bis zum Ende der Eingabe (Strg+Z und Eingabe unter
Windows, sonst Strg+D), nicht nur bis zur ersten Leerzeile: Ein eingefügter Post mit Absätzen bliebe
sonst teilweise im Eingabepuffer, und ``cmd.exe`` führte ihn nach dem Skript als Befehle aus.
Exit-Code: 0 = sauber, 1 = Funde, 2 = Prüfung nicht möglich (Konfiguration, Stichproben).
"""

from __future__ import annotations

import argparse
import ast
import csv
import html
import io
import json
import os
import re
import sqlite3
import sys
import urllib.request
from collections import Counter
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any, BinaryIO

from truthtracker import browser, logbuch, pfade
from truthtracker.konfig import Konfig, KonfigFehler, lade

STANDARD_BASIS_URL = "https://truthsocial.com"
FREITEXT_SCHWELLE = 8  # mehr Wörter als das gelten als Freitext
MAX_ANZEIGENAME = 100  # Zeichen; wie klassifikation._MAX_ANZEIGENAME
MARKER_MIN_LAENGE = 4
MAX_FUNDE_JE_STELLE = 25

ART_HTML = "html"
ART_MEDIEN_URL = "medien_url"
ART_FREMDE_URL = "fremde_url"
ART_FREITEXT = "freitext"
ART_UNERWARTET = "unerwarteter_wert"
ART_BINAER = "binaerdaten"
ART_MARKER = "marker"
ART_TEMP = "temp_rest"
ART_CACHE = "browser_cache"
ART_PROFILDATEI = "browser_datei"
ART_NICHT_PRUEFBAR = "nicht_pruefbar"
ART_WEITERE = "weitere_funde"

ART_BESCHRIFTUNG = {
    ART_MARKER: "Stichproben gefunden",
    ART_HTML: "HTML",
    ART_MEDIEN_URL: "Medien-URLs",
    ART_FREMDE_URL: "Fremde URLs",
    ART_FREITEXT: "Lange Freitexte",
    ART_UNERWARTET: "Werte außerhalb der Positivliste",
    ART_BINAER: "Binärdaten in der Datenbank",
    ART_TEMP: "Reste im Temp-Ordner",
    ART_CACHE: "Browser-Cache",
    ART_PROFILDATEI: "Browserprofil: nicht erlaubte Dateien",
    ART_NICHT_PRUEFBAR: "Nicht prüfbar",
    ART_WEITERE: "Weitere Funde (gekürzt)",
}

# Reihenfolge der Kennzahlen in ``Pruefbericht.geprueft`` und in der Übersicht des Berichts.
_UEBERSICHT = (
    ("Datenbank", (("db_tabellen", "Tabelle", "Tabellen"), ("db_werte", "Textwert", "Textwerte"),
                   ("db_rohdateien", "Rohdatei", "Rohdateien"))),
    ("Logs", (("log_dateien", "Datei", "Dateien"), ("log_zeilen", "Zeile", "Zeilen"))),
    ("Temp-Ordner", (("temp_dateien", "Datei", "Dateien"),)),
    ("Browserprofil", (("profil_dateien", "Datei", "Dateien"),
                       ("profil_textdateien", "Einstellungsdatei gelesen", "Einstellungsdateien gelesen"))),
    ("Exporte", (("export_dateien", "CSV-Datei", "CSV-Dateien"), ("export_zeilen", "Zeile", "Zeilen"))),
    ("Spike-Berichte", (("spike_dateien", "Datei", "Dateien"), ("spike_zeilen", "Zeile", "Zeilen"))),
    ("Stichproben", (("marker", "Zeichenkette", "Zeichenketten"),)),
)
_KENNZAHLEN = ("db_vorhanden", *(teil[0] for _, teile in _UEBERSICHT for teil in teile))


def _anzahl(n: int, einzahl: str, mehrzahl: str) -> str:
    return f"{n} {einzahl if n == 1 else mehrzahl}"


@dataclass
class Fund:
    ort: str  # relativer Pfad (mit ":Zeile") oder Tabelle.Spalte[rowid]
    art: str
    hinweis: str  # nie der Fund selbst: nur Länge, Anzahl, Musternamen


@dataclass
class Pruefbericht:
    funde: list[Fund] = field(default_factory=list)
    geprueft: dict[str, int] = field(default_factory=dict)
    orte: dict[str, str] = field(default_factory=dict)  # Bereich -> geprüfter Pfad

    @property
    def ok(self) -> bool:
        return not self.funde


# ---------------------------------------------------------------------------
# Muster

_ZEITSTEMPEL = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
_ZAHL = re.compile(r"-?\d{1,30}(?:\.\d{1,30})?")
_ID = re.compile(r"\d{1,30}")
_HEX64 = re.compile(r"[0-9a-fA-F]{64}")
_HEX16 = re.compile(r"[0-9a-fA-F]{16}")
_HEX = re.compile(r"[0-9a-fA-F]{16}|[0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64}")
_KENNWORT = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,63}")
_KENNWORTE = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,63}(?:\+[A-Za-z][A-Za-z0-9_]{0,63}){0,3}")  # z. B. "curl+browser"
_HANDLE = re.compile(r"[A-Za-z0-9_]{0,64}(?:@[A-Za-z0-9.-]{1,253})?")
# Mindestens ein Punkt: text.py speichert nur Hosts mit Top-Level-Domain oder IPv4-Adressen.
_DOMAIN = re.compile(r"(?:[\w-]{1,63}\.){1,126}[\w-]{1,63}")
_ZAEHLER_SCHLUESSEL = re.compile(r"[a-z][a-z0-9_]{0,58}_count")  # wie klassifikation._WEITERER_ZAEHLER
# DevTools-Adressen des lokalen Browsers (Fehlermeldungen von Playwright, Quelltext von browser.py).
_LOOPBACK_URL = r"http://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?(?:/|/json(?:/[a-z]+)?/?|/devtools/[\w/.-]*)?"

_HTML_TAGS = (
    "a|abbr|article|audio|b|blockquote|body|br|button|cite|code|del|div|em|embed|figcaption|figure|footer|form|"
    "h[1-6]|head|header|hr|html|i|iframe|img|input|ins|label|li|link|main|mark|meta|nav|noscript|object|ol|p|"
    "picture|pre|q|s|script|section|small|source|span|strong|style|sub|sup|svg|table|td|th|time|tr|u|ul|video"
)
_HTML_TEXT = (
    ("HTML-Tag", re.compile(rf"<\s*/?\s*(?:{_HTML_TAGS})(?=[\s/>])[^<>]{{0,500}}>", re.IGNORECASE)),
    ("HTML-Attribut", re.compile(r"\b(?:class|href|src|rel|target)\s*=\s*[\"']", re.IGNORECASE)),
    (
        "HTML-Entity",
        re.compile(r"&(?:#\d{1,7}|#x[0-9a-f]{1,6}|amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|[lr][sd]quo);", re.I),
    ),
)

_MEDIEN_ENDUNGEN = (
    r"jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?|mp4|m4v|mov|webm|mkv|m3u8|mpd|mp3|m4a|aac|ogg|oga|opus|wav|flac"
)
# Der Host allein ist eine Domain (der Spike-Bericht nennt ihn); eine Medien-URL hat einen Pfad dahinter.
_STATIC_ASSETS_PFAD = re.compile(r"static-assets[\w.-]*(?::\d+)?/[^\s\"'<>`|\\,*]", re.IGNORECASE)
_MEDIA_ATTACHMENTS = re.compile(r"/media_attachments/", re.IGNORECASE)
_MEDIEN_TEXT = (
    ("static-assets", _STATIC_ASSETS_PFAD),
    ("media_attachments", _MEDIA_ATTACHMENTS),
    ("Medien-Dateiendung", re.compile(rf"/[^\s/\"'<>`|\\]+\.(?:{_MEDIEN_ENDUNGEN})(?![A-Za-z0-9])", re.IGNORECASE)),
)
# Browser-Einstellungen enthalten eigene Bild-URLs (Designs, Kacheln); dort zählen nur Truth-Social-Medien.
_PROFIL_MEDIEN = (
    ("static-assets", _STATIC_ASSETS_PFAD),
    ("media_attachments", _MEDIA_ATTACHMENTS),
    (
        "Medien-Dateiendung",
        re.compile(rf"truthsocial\.com[^\s\"'<>]*?\.(?:{_MEDIEN_ENDUNGEN})(?![A-Za-z0-9])", re.IGNORECASE),
    ),
)
_MEDIEN_HOST = re.compile(r"static-assets", re.IGNORECASE)

_URL = re.compile(r"https?://[^\s\"'`<>|\\\[\]{}()]+", re.IGNORECASE)
_TRACEBACK_RAHMEN = re.compile(r'\s+File "')
# Feste Zeilen der Python-Tracebacks; sie stammen nicht aus Daten.
_TRACEBACK_ZEILEN = frozenset({
    "Traceback (most recent call last):",
    "During handling of the above exception, another exception occurred:",
    "The above exception was the direct cause of the following exception:",
})
# Kopf jeder Logzeile (logbuch.FORMAT): Zeitpunkt, Stufe, Loggername.
_LOG_KOPF = re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} [A-Z]+ +[\w.]+: ")
# Dateipfade in Fehlermeldungen sind Orte auf dem eigenen Rechner, kein Text.
_PFAD = re.compile(r"[A-Za-z]:(?:\\{1,2}[^\s\\\"'<>|*?]+)+|(?<![\w.])(?:/[\w.~-]+){2,}")

# Rohdateien: Zeichen, die in einer URL ohne Maskierung vorkommen. Anführungszeichen und Klammern
# fehlen absichtlich, sonst liefe ein Treffer in die nächste Spalte (z. B. die JSON-Domainliste).
_ROH_URLZEICHEN = rb"[A-Za-z0-9\-._~:/?#@!$&*+,;=%]"
_ROH_HTML = (
    ("HTML-Tag p", re.compile(rb"</?p>", re.IGNORECASE)),
    ("HTML-Tag br", re.compile(rb"<br\s*/?>", re.IGNORECASE)),
    ("HTML-Tag a", re.compile(rb"<a\s+href|</a>", re.IGNORECASE)),
    ("HTML-Tag span", re.compile(rb"</?span[\s>]", re.IGNORECASE)),
    ("HTML-Attribut class", re.compile(rb'class="')),
    ("HTML-Attribut href", re.compile(rb'href="')),
    ("HTML-Entity", re.compile(rb"&(?:#\d{1,7}|#x[0-9a-fA-F]{1,6}|amp|lt|gt|quot|apos|nbsp);")),
)
_ROH_MEDIEN = (
    ("static-assets", re.compile(rb"static-assets", re.IGNORECASE)),
    ("media_attachments", re.compile(rb"/media_attachments/", re.IGNORECASE)),
    (
        "Medien-Dateiendung",
        re.compile(
            rb"https?://" + _ROH_URLZEICHEN + rb"{1,2000}?\.(?:" + _MEDIEN_ENDUNGEN.encode() + rb")(?![A-Za-z])",
            re.IGNORECASE,
        ),
    ),
)
_ROH_URL = re.compile(rb"https?://" + _ROH_URLZEICHEN + rb"{1,2000}", re.IGNORECASE)
_BLOCK = 4 * 1024 * 1024
_UEBERLAPPUNG = 4096
_KONTEXT = 6

_COOKIE_DATEIEN = frozenset({"Cookies", "Cookies-journal"})
_CACHE_ORDNER = frozenset(
    name.casefold()
    for name in (
        "Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache", "DawnWebGPUCache", "GrShaderCache",
        "GraphiteDawnCache", "ShaderCache", "Media Cache", "Application Cache", "Service Worker", "IndexedDB",
        "Local Storage", "Session Storage", "Sessions", "blob_storage", "File System", "WebStorage", "databases",
        "Shared Dictionary", "Storage", "Download Service", "VideoDecodeStats", "Platform Notifications",
    )
)
_VERLAUF_DATEIEN = frozenset(
    name.casefold()
    for name in (
        "History", "History-journal", "Visited Links", "Top Sites", "Top Sites-journal", "Favicons",
        "Favicons-journal", "Web Data", "Web Data-journal", "Current Session", "Current Tabs", "Last Session",
        "Last Tabs", "Shortcuts", "Shortcuts-journal", "Network Action Predictor",
    )
)

_KENNWORT_SPALTEN = frozenset({
    "typ", "typ_detail", "reply_art", "format", "sichtbarkeit", "status", "zugriff", "abbruch_grund", "art",
    "rolle", "hash_quelle", "hash_status", "ergebnis", "antwort_art", "schluessel",
})
_HASH_SPALTEN = frozenset({"text_hash", "medien_hash", "fingerabdruck", "sha256"})
_ZAEHLER_JSON_SPALTEN = frozenset({"weitere", "orig_weitere"})
# auswertung.csv_export stellt Texten, die Excel als Formel läse, ein Apostroph voran.
_FORMEL_ZEICHEN = ("=", "+", "-", "@", "\t", "\r")


# ---------------------------------------------------------------------------
# Wörter (für die Freitext-Erkennung, ohne jede inhaltliche Auswertung)

_TOKEN = re.compile(r"[\w'’-]+")
_WORTTRENNER = re.compile(r"['’-]+")
_BUCHSTABENFOLGE = re.compile(r"[^\W\d_]{2,}")
_KENNWORT_TRENNER = re.compile(r"[_+|]+")


def _woerter(text: str) -> list[str]:
    """Token nur aus Buchstaben; Bindestrich und Apostroph trennen.

    Token mit Ziffern oder Unterstrich (IDs, Hashes, Zeitstempel, Feldnamen) sind keine Wörter.
    """
    woerter: list[str] = []
    for token in _TOKEN.findall(text):
        if any(z.isdigit() or z == "_" for z in token):
            continue
        woerter.extend(teil.casefold() for teil in _WORTTRENNER.split(token) if len(teil) >= 2)
    return woerter


def _kennwort_woerter(werte: Iterable[str]) -> int:
    """Wörter in Kennwörtern, Listen und JSON-Schlüsseln, zusammengezählt.

    Hier trennen auch ``_``, ``+`` und ``|``: Eine Schlagwortliste soll weder als Liste vieler kurzer
    Werte noch als ein langes Kennwort durchgehen. Hashes, Zahlen und Zeitstempel haben keine Wörter.
    """
    return sum(len(_woerter(_KENNWORT_TRENNER.sub(" ", w))) for w in werte if not _HEX.fullmatch(w))


# Stellen im Quelltext, deren Texte in Logs, Laufmeldungen, Fehlermeldungen oder auf der Konsole landen.
_LOGGER = frozenset({"log", "logger", "logging"})
_LOG_METHODEN = frozenset({"debug", "info", "warning", "error", "exception", "critical", "log"})
_AUSGABE_FUNKTIONEN = frozenset({"print", "melden", "_melden", "meldung"})
_MELDUNGS_FUNKTIONEN = frozenset({"melde"})  # cloudflare.melde: Sätze für Logs und Laufmeldungen
_BERICHT_MODULE = frozenset({"spike.py"})  # schreibt die Spike-Berichte: jeder Text des Moduls zählt


def _name(knoten: ast.expr) -> str | None:
    if isinstance(knoten, ast.Name):
        return knoten.id
    if isinstance(knoten, ast.Attribute):
        return knoten.attr
    return None


def _ist_ausgabe(knoten: ast.AST) -> bool:
    if isinstance(knoten, ast.Raise):
        return True
    if isinstance(knoten, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return knoten.name in _MELDUNGS_FUNKTIONEN
    if not isinstance(knoten, ast.Call):
        return False
    name = _name(knoten.func)
    if isinstance(knoten.func, ast.Attribute):
        besitzer = _name(knoten.func.value)
        if (name in _LOG_METHODEN and besitzer in _LOGGER) or (name == "append" and besitzer == "meldungen"):
            return True
    return name in _AUSGABE_FUNKTIONEN


def _docstrings(baum: ast.AST) -> set[int]:
    ids: set[int] = set()
    for knoten in ast.walk(baum):
        if isinstance(knoten, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and knoten.body:
            erster = knoten.body[0]
            if isinstance(erster, ast.Expr) and isinstance(erster.value, ast.Constant):
                ids.add(id(erster.value))
    return ids


def _meldungstexte(quelltext: str, *, alle: bool) -> set[str]:
    """String-Literale (auch Teile von f-Strings) an Ausgabestellen bzw. im ganzen Modul, ohne Docstrings."""
    baum = ast.parse(quelltext)
    docstrings = _docstrings(baum)
    wurzeln = [baum] if alle else [k for k in ast.walk(baum) if _ist_ausgabe(k)]
    return {
        k.value
        for wurzel in wurzeln
        for k in ast.walk(wurzel)
        if isinstance(k, ast.Constant) and isinstance(k.value, str) and id(k) not in docstrings
    }


@cache
def _wortschatz() -> frozenset[str]:
    """Wörter der Texte, die der Tracker selbst schreibt (siehe Modulbeschreibung).

    Bezeichner, Docstrings, SQL und dieses Modul bleiben draußen: Sie brächten englische Allerweltswörter
    mit, und ein mitgeschriebener Post aus solchen Wörtern bliebe unter der Schwelle.
    """
    woerter: set[str] = set()
    eigene = Path(__file__).resolve()
    for datei in sorted(eigene.parent.rglob("*.py")):
        if datei == eigene:
            continue
        try:
            texte = _meldungstexte(datei.read_text(encoding="utf-8"), alle=datei.name in _BERICHT_MODULE)
        except (OSError, UnicodeDecodeError, SyntaxError, ValueError):
            continue
        for text in texte:
            woerter.update(w.casefold() for w in _BUCHSTABENFOLGE.findall(text))
    return frozenset(woerter)


def _unbekannte_woerter(text: str) -> int:
    """Wörter außerhalb des Wortschatzes; URLs und Dateipfade zählen nicht mit."""
    bekannt = _wortschatz()
    return sum(1 for w in _woerter(_PFAD.sub(" ", _URL.sub(" ", text))) if w not in bekannt)


# ---------------------------------------------------------------------------
# Werteprüfungen für Datenbankspalten

_KEIN_JSON = object()


def _json(wert: str) -> Any:
    try:
        return json.loads(wert)
    except (ValueError, RecursionError):
        return _KEIN_JSON


def _einfacher_wert(wert: str) -> bool:
    return not wert or any(m.fullmatch(wert) for m in (_ZAHL, _ZEITSTEMPEL, _HEX, _KENNWORT))


def _einfache_teile(daten: Any, tiefe: int = 0) -> list[str] | None:
    """Alle Texte (Werte und Schlüssel) aus JSON, das nur einfache Werte enthält; sonst ``None``."""
    if tiefe > 5:
        return None
    if daten is None or isinstance(daten, (bool, int, float)):
        return []
    if isinstance(daten, str):
        return [daten] if _einfacher_wert(daten) else None
    if isinstance(daten, (list, dict)) and len(daten) <= 1000:
        paare = daten.items() if isinstance(daten, dict) else ((None, x) for x in daten)
        teile: list[str] = []
        for schluessel, kind in paare:
            unter = _einfache_teile(kind, tiefe + 1)
            if unter is None:
                return None
            if schluessel is not None:
                if not (isinstance(schluessel, str) and _KENNWORT.fullmatch(schluessel)):
                    return None
                teile.append(schluessel)
            teile.extend(unter)
        return teile
    return None


def _ist_harmlos(wert: str) -> bool:
    """Zahl, Zeitstempel, Hash, Kennwort, mit ``|`` verbundene solche Werte oder JSON daraus, zusammen
    höchstens ``FREITEXT_SCHWELLE`` Wörter."""
    teile: list[str] | None = None
    if _einfacher_wert(wert):
        teile = [wert]
    elif "|" in wert and all(_einfacher_wert(teil) for teil in wert.split("|")):
        teile = wert.split("|")
    elif wert[:1] in ("[", "{") and (daten := _json(wert)) is not _KEIN_JSON:
        teile = _einfache_teile(daten)
    return teile is not None and _kennwort_woerter(teile) <= FREITEXT_SCHWELLE


def _ist_kennwort(wert: str) -> bool:
    return bool(_KENNWORTE.fullmatch(wert)) and _kennwort_woerter([wert]) <= FREITEXT_SCHWELLE


def _ist_domain(wert: str) -> bool:
    return len(wert) <= 253 and bool(_DOMAIN.fullmatch(wert))


def _ist_domainliste(wert: str) -> bool:
    daten = _json(wert)
    return isinstance(daten, list) and len(daten) <= 100 and all(isinstance(d, str) and _ist_domain(d) for d in daten)


def _ist_domaintext(wert: str) -> bool:
    """Link-Domains im Export: mit Komma verbunden (auswertung._domains_text)."""
    domains = [d.strip() for d in wert.split(",")]
    return len(domains) <= 100 and all(_ist_domain(d) for d in domains)


def _ist_zahl(wert: Any) -> bool:
    return wert is None or isinstance(wert, (bool, int, float))


def _ist_zaehler_json(wert: str) -> bool:
    """Weitere Zähler: nur Schlüssel ``*_count`` (wie die Klassifikation sie übernimmt) mit Zahlen."""
    daten = _json(wert)
    return isinstance(daten, dict) and all(
        isinstance(k, str) and _ZAEHLER_SCHLUESSEL.fullmatch(k) and _ist_zahl(v) for k, v in daten.items()
    )


def _ist_zahlen_json(wert: str) -> bool:
    """Kennwörter mit Zahlen; jeder Schlüssel zählt als ein Wort."""
    daten = _json(wert)
    return isinstance(daten, dict) and len(daten) <= FREITEXT_SCHWELLE and all(
        isinstance(k, str) and _KENNWORT.fullmatch(k) and _ist_zahl(v) for k, v in daten.items()
    )


def _ist_meldungsliste(wert: str) -> bool:
    daten = _json(wert)
    return isinstance(daten, list) and all(
        isinstance(m, str) and len(m) <= 300 and _unbekannte_woerter(m) <= FREITEXT_SCHWELLE for m in daten
    )


def _ist_anzeigename(wert: str) -> bool:
    """Account-Metadaten sind erlaubt, ein ganzer Satz nicht: höchstens ``FREITEXT_SCHWELLE`` Wörter."""
    return len(wert) <= MAX_ANZEIGENAME and "\n" not in wert and len(_woerter(wert)) <= FREITEXT_SCHWELLE


def _ohne_formelschutz(wert: str) -> str:
    return wert[1:] if wert.startswith("'") and wert[1:2] in _FORMEL_ZEICHEN else wert


def _abweichung(beschreibung: str, wert: str) -> list[tuple[str, str]]:
    """Fund für einen Wert außerhalb der Positivliste: langer Freitext oder unerwarteter Wert."""
    woerter = _kennwort_woerter([wert])
    if woerter > FREITEXT_SCHWELLE:
        return [(ART_FREITEXT, f"Freitext mit {woerter} Wörtern")]
    return [(ART_UNERWARTET, f"passt nicht zum erlaubten Muster „{beschreibung}“")]


def _csv_regel(spaltenname: str) -> tuple[str, Callable[[str], object]] | None:
    """Positivliste für Spalten des Post-Exports (auswertung.posts_tabelle), die Metadaten mit Wörtern tragen."""
    name = spaltenname.strip()
    if name.endswith("Link-Domains"):
        return "Liste von Domains", _ist_domaintext
    if name.endswith("Anzeigename"):
        return "Anzeigename", _ist_anzeigename
    if name.endswith("Handle"):
        return "Handle", _HANDLE.fullmatch
    return None


# ---------------------------------------------------------------------------
# Hilfen für Dateien


def _medien_muster(text: str, muster: tuple[tuple[str, re.Pattern[str]], ...]) -> str | None:
    for name, regex in muster:
        if regex.search(text):
            return name
    return None


def _dateien(wurzel: Path, bei_fehler: Callable[[OSError], None]) -> Iterator[Path]:
    """Alle Dateien unter ``wurzel``, sortiert. Verknüpfungen werden gemeldet, nicht verfolgt.

    Ordner, die sich nicht auflisten lassen, gehen an ``bei_fehler``: Ungeprüft ist nicht sauber.
    """
    try:
        if not wurzel.is_dir():
            return
    except OSError as fehler:
        bei_fehler(fehler)
        return
    for ordner, unterordner, dateien in os.walk(wurzel, onerror=bei_fehler):
        unterordner.sort()
        o = Path(ordner)
        for name in sorted(dateien):
            yield o / name
        for name in unterordner:
            if (o / name).is_symlink():
                yield o / name


def _ort(wurzel: Path, pfad: Path) -> str:
    return f"{wurzel.name}/{pfad.relative_to(wurzel).as_posix()}"


def _spike_ordner() -> Path:
    return pfade.docs_ordner() / "zugriff-messungen"


def _groesse(pfad: Path) -> int:
    try:
        return pfad.lstat().st_size
    except OSError:
        return 0


def _ordnerinhalt(ordner: Path, bei_fehler: Callable[[OSError], None]) -> tuple[int, int]:
    anzahl = groesse = 0
    for datei in _dateien(ordner, bei_fehler):
        anzahl += 1
        groesse += _groesse(datei)
    return anzahl, groesse


def _bloecke(datei: BinaryIO) -> Iterator[tuple[int, bytes, int]]:
    """(Dateiposition, Puffer, Grenze). Treffer, die vor der Grenze beginnen, gehören zu diesem Block;
    der Rest wird im nächsten Block noch einmal (vollständig) gesehen."""
    basis, rest = 0, b""
    while True:
        neu = datei.read(_BLOCK)
        puffer = rest + neu
        if not neu:
            if puffer:
                yield basis, puffer, len(puffer)
            return
        grenze = max(len(puffer) - _UEBERLAPPUNG, 0)
        yield basis, puffer, grenze
        rest = puffer[grenze:]
        basis += grenze


def _lesbar(stueck: bytes, *, rand_vorne: bool) -> bool:
    """Druckbarer UTF-8-Text von mindestens ``_KONTEXT`` Bytes; am fernen Rand darf ein Zeichen angeschnitten sein."""
    for schnitt in range(4):
        teil = stueck[schnitt:] if rand_vorne else stueck[: len(stueck) - schnitt]
        if len(teil) < _KONTEXT:
            return False
        try:
            text = teil.decode("utf-8")
        except UnicodeDecodeError:
            continue
        return all(z.isprintable() or z in "\t\r\n" for z in text)
    return False


def _kontext_lesbar(puffer: bytes, start: int, ende: int) -> bool:
    # Kurze Muster wie "<p>" stecken zufällig auch in Zahlen und Seitenköpfen; echte HTML-Reste stehen in Text.
    davor = puffer[max(start - _KONTEXT - 3, 0) : start]
    danach = puffer[ende : ende + _KONTEXT + 3]
    return _lesbar(davor, rand_vorne=True) or _lesbar(danach, rand_vorne=False)


def _oeffne_lesend(pfad: Path) -> sqlite3.Connection:
    """Nur lesend. Ohne ``-wal`` als ``immutable``: Dann legt SQLite auch keine ``-wal``/``-shm`` an."""
    wal = pfad.with_name(pfad.name + "-wal")
    url = "file:" + urllib.request.pathname2url(str(pfad.resolve()))
    url += "?mode=ro" if wal.exists() else "?immutable=1"
    con = sqlite3.connect(url, uri=True, timeout=30)
    con.text_factory = lambda roh: roh.decode("utf-8", "replace")
    con.execute("PRAGMA query_only = ON")
    return con


def _bezeichner(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _marker_formen(marker: str) -> set[str]:
    """Die Stichprobe selbst und wie sie in HTML- oder JSON-Resten maskiert aussähe."""
    maskiert = html.escape(marker, quote=True)
    return {marker, maskiert, maskiert.replace("&#x27;", "&#39;"), json.dumps(marker)[1:-1]}


def _bereinige_marker(marker: list[str] | None) -> list[str]:
    ergebnis: list[str] = []
    for roh in marker or []:
        eintrag = roh.strip()
        if not eintrag or eintrag in ergebnis:
            continue
        if len(eintrag) < MARKER_MIN_LAENGE:
            raise ValueError(f"Eine Stichprobe muss mindestens {MARKER_MIN_LAENGE} Zeichen lang sein.")
        ergebnis.append(eintrag)
    return ergebnis


# ---------------------------------------------------------------------------
# Prüfung


class _Sammler:
    """Sammelt Funde ohne Dubletten; je Stelle (Datei, Spalte) höchstens ``MAX_FUNDE_JE_STELLE`` einzeln."""

    def __init__(self) -> None:
        self.bericht = Pruefbericht(geprueft=dict.fromkeys(_KENNZAHLEN, 0))
        self._gesehen: set[tuple[str, str, str]] = set()
        self._je_stelle: Counter[str] = Counter()
        self._gekuerzt: Counter[str] = Counter()

    def melde(self, ort: str, art: str, hinweis: str, *, stelle: str | None = None) -> None:
        schluessel = (ort, art, hinweis)
        if schluessel in self._gesehen:
            return
        self._gesehen.add(schluessel)
        stelle = stelle or ort
        self._je_stelle[stelle] += 1
        if self._je_stelle[stelle] > MAX_FUNDE_JE_STELLE:
            self._gekuerzt[stelle] += 1
            return
        self.bericht.funde.append(Fund(ort, art, hinweis))

    def zaehle(self, schluessel: str, anzahl: int = 1) -> None:
        self.bericht.geprueft[schluessel] = self.bericht.geprueft.get(schluessel, 0) + anzahl

    def abschliessen(self) -> Pruefbericht:
        for stelle, anzahl in self._gekuerzt.items():
            self.bericht.funde.append(
                Fund(stelle, ART_WEITERE, f"{anzahl} weitere Funde an dieser Stelle, nicht einzeln aufgeführt")
            )
        return self.bericht


Treffer = tuple[str, str]  # (Art, Hinweis)


def _freitext_treffer(text: str) -> Treffer | None:
    anzahl = _unbekannte_woerter(text)
    if anzahl <= FREITEXT_SCHWELLE:
        return None
    return ART_FREITEXT, f"langer Freitext ({anzahl} Wörter, die in keiner Meldung des Trackers vorkommen)"


# ---------------------------------------------------------------------------
# Einstellungsdateien des Browsers (Preferences, Secure Preferences, Local State, First Run …)

JsonPfad = tuple[str | int, ...]

# Zwischengespeicherte Suchvorschläge legt der Browser samt Schutzpräfix als Zeichenkette ab.
_XSSI_PRAEFIX = ")]}'"
# Im Bericht erscheinen nur Einstellungsnamen, Erweiterungs-IDs und Listenpositionen; andere Schlüssel
# (Adressen, Hosts, beliebige Texte) als „*“.
_JSON_SCHLUESSEL = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}")
_LEERRAUM = re.compile(r"\s")


def _eingebettetes_json(wert: str) -> Any:
    """JSON als Zeichenkette in einem Wert (DevTools, Druckvorschau, Suchvorschläge); sonst ``_KEIN_JSON``."""
    kern = wert.strip()
    if kern.startswith(_XSSI_PRAEFIX):
        kern = kern[len(_XSSI_PRAEFIX) :].lstrip()
    return _json(kern) if kern[:1] in ("[", "{") else _KEIN_JSON


def _json_texte(daten: Any) -> Iterator[tuple[JsonPfad, str]]:
    """Jeder Schlüssel und jede Zeichenkette mit ihrem Pfad, in Dateireihenfolge.

    JSON in einer Zeichenkette wird aufgefaltet; sonst zählten seine Feldnamen als Wörter eines Freitexts.
    Ohne Rekursion, damit tief verschachtelte Dateien die Prüfung nicht abbrechen.
    """
    stapel: list[tuple[JsonPfad, Any, bool]] = [((), daten, False)]  # (Pfad, Wert, ist Schlüssel)
    while stapel:
        pfad, wert, ist_schluessel = stapel.pop()
        if isinstance(wert, str):
            eingebettet = _KEIN_JSON if ist_schluessel else _eingebettetes_json(wert)
            if eingebettet is _KEIN_JSON:
                yield pfad, wert
            else:
                stapel.append((pfad, eingebettet, False))
        elif isinstance(wert, dict):
            for schluessel, kind in reversed(wert.items()):
                stapel.append((pfad + (schluessel,), kind, False))
                stapel.append((pfad + (schluessel,), schluessel, True))
        elif isinstance(wert, list):
            stapel.extend((pfad + (nr,), kind, False) for nr, kind in reversed(list(enumerate(wert))))


def _json_stelle(pfad: JsonPfad) -> str:
    """Pfad für den Bericht, z. B. ``profile.content_settings.exceptions.*.setting`` oder ``liste[2]``."""
    stelle = ""
    for teil in pfad:
        if isinstance(teil, int):
            stelle += f"[{teil}]"
        else:
            stelle += ("." if stelle else "") + (teil if _JSON_SCHLUESSEL.fullmatch(teil) else "*")
    return stelle


def _erweiterungs_manifest(pfad: JsonPfad) -> bool:
    """Manifeste eingebauter Erweiterungen (``extensions.settings.<ID>.manifest``) beschreiben den Browser
    selbst, mit ganzen Sätzen in der Beschreibung. Sie sind kein Freitext aus einem Post."""
    return pfad[:1] == ("extensions",) and "manifest" in pfad[1:]


def _einstellungs_treffer(wert: str, *, freitext: bool) -> list[Treffer]:
    """HTML und lange Freitexte in einem Wert einer Einstellungsdatei.

    Werte ohne Leerraum (Base64, Hashes, Pfade, Sprachlisten) sind kein Freitext: In den langen
    Base64-Blöcken des Browsers (z. B. ``variations_compressed_seed``) ergäben zufällige
    Buchstabenfolgen sonst viele „Wörter“.
    """
    treffer: list[Treffer] = []
    html_name = _medien_muster(wert, _HTML_TEXT)
    if html_name:
        treffer.append((ART_HTML, html_name))
    if freitext and _LEERRAUM.search(wert.strip()) and (frei := _freitext_treffer(wert)):
        treffer.append(frei)
    return treffer


class _Pruefung:
    def __init__(self, konfig: Konfig, marker: list[str]) -> None:
        self.konfig = konfig
        self.sammler = _Sammler()
        self.sammler.zaehle("marker", len(marker))
        basen = "|".join(sorted({re.escape(STANDARD_BASIS_URL), re.escape(konfig.basis_url.rstrip("/"))}))
        self._post_url = re.compile(rf"(?:{basen})/@[A-Za-z0-9_]+/\d+")
        self._post_url_roh = re.compile(self._post_url.pattern.encode())
        # Erlaubt in Logs und Berichten: Startseite, Profil- und Post-URLs, API-Pfade, lokale DevTools-Adressen.
        self._erlaubte_url = re.compile(
            rf"(?:{basen})(?:/?|/@[A-Za-z0-9_]+/?|/@[A-Za-z0-9_]+/\d+/?|/api/[\w/.?&=%,:+~-]*)|{_LOOPBACK_URL}"
        )
        self._marker = [(nr, form) for nr, m in enumerate(marker, start=1) for form in sorted(_marker_formen(m))]
        self._marker_roh = [(nr, re.compile(re.escape(form.encode("utf-8")))) for nr, form in self._marker]
        self.sammler.bericht.orte = {
            "Datenbank": str(konfig.datenbank_pfad),
            "Logs": str(logbuch.log_ordner()),
            "Temp-Ordner": str(pfade.temp_ordner()),
            "Browserprofil": str(pfade.profil_ordner()),
            "Exporte": str(konfig.export_ordner),
            "Spike-Berichte": str(_spike_ordner()),
        }

    # -- gemeinsame Textprüfung ------------------------------------------------

    def _marker_nummern(self, text: str) -> list[int]:
        return sorted({nr for nr, form in self._marker if form in text})

    def _text_treffer(
        self, text: str, *, url_regel: re.Pattern[str] | None, medien_host: bool, freitext: bool
    ) -> list[Treffer]:
        treffer: list[Treffer] = [(ART_MARKER, f"Stichprobe {nr} gefunden") for nr in self._marker_nummern(text)]
        html_name = _medien_muster(text, _HTML_TEXT)
        if html_name:
            treffer.append((ART_HTML, html_name))
        medien = _medien_muster(text, _MEDIEN_TEXT)
        if medien is None and medien_host and _MEDIEN_HOST.search(text):
            medien = "static-assets"
        if medien:
            treffer.append((ART_MEDIEN_URL, f"Medien-URL, Muster {medien}"))
        fremde = [
            url
            for url in (u.rstrip(".,;:!?") for u in _URL.findall(text))
            if not (url_regel and url_regel.fullmatch(url)) and _medien_muster(url, _MEDIEN_TEXT) is None
        ]
        if fremde:
            laengen = ", ".join(str(len(u)) for u in fremde[:5])
            beschreibung = _anzahl(len(fremde), "URL", "URLs")
            treffer.append((ART_FREMDE_URL, f"{beschreibung} außerhalb der erlaubten Muster (Länge {laengen})"))
        if freitext and (frei := _freitext_treffer(text)):
            treffer.append(frei)
        return treffer

    def _nicht_pruefbar(self, ort: str, fehler: BaseException) -> None:
        self.sammler.melde(ort, ART_NICHT_PRUEFBAR, f"nicht lesbar ({type(fehler).__name__})")

    def _vorhanden(self, pfad: Path, ort: str, *, ordner: bool) -> bool:
        """``is_dir`` bzw. ``is_file``; scheitert schon das Nachsehen, ist der Ort nicht prüfbar."""
        try:
            return pfad.is_dir() if ordner else pfad.is_file()
        except OSError as fehler:
            self._nicht_pruefbar(ort, fehler)
            return False

    def _ordnerfehler(self, wurzel: Path) -> Callable[[OSError], None]:
        """Ein Ordner, der sich nicht auflisten lässt, ist ungeprüft und wird gemeldet statt übergangen."""

        def melden(fehler: OSError) -> None:
            pfad = Path(fehler.filename) if fehler.filename else wurzel
            ort = _ort(wurzel, pfad) if pfad != wurzel and pfad.is_relative_to(wurzel) else wurzel.name
            self._nicht_pruefbar(ort, fehler)

        return melden

    def _dateien(self, wurzel: Path) -> Iterator[Path]:
        return _dateien(wurzel, self._ordnerfehler(wurzel))

    # -- Datenbank ---------------------------------------------------------------

    def datenbank(self) -> None:
        pfad = self.konfig.datenbank_pfad
        ort = f"{pfad.parent.name}/{pfad.name}"
        vorhanden = self._vorhanden(pfad, ort, ordner=False)
        if vorhanden:
            self._rohdatei(pfad, ort)
        for endung in ("-wal", "-shm", "-journal"):
            datei = pfad.with_name(pfad.name + endung)
            if self._vorhanden(datei, ort + endung, ordner=False):
                self._rohdatei(datei, ort + endung)
        if not vorhanden:
            return
        self.sammler.zaehle("db_vorhanden")
        try:
            con = _oeffne_lesend(pfad)
        except sqlite3.Error as fehler:
            self._nicht_pruefbar(ort, fehler)
            return
        try:
            tabellen = [
                z[0]
                for z in con.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite!_%' ESCAPE '!' "
                    "ORDER BY name"
                )
            ]
            for tabelle in tabellen:
                self.sammler.zaehle("db_tabellen")
                for spalte in [z[1] for z in con.execute(f"PRAGMA table_info({_bezeichner(tabelle)})")]:
                    self._spalte(con, tabelle, spalte)
        except sqlite3.Error as fehler:
            self._nicht_pruefbar(ort, fehler)
        finally:
            con.close()

    def _spalte(self, con: sqlite3.Connection, tabelle: str, spalte: str) -> None:
        t, s = _bezeichner(tabelle), _bezeichner(spalte)
        bedingung = f"WHERE typeof({s}) IN ('text', 'blob')"
        try:
            zeilen = con.execute(f"SELECT rowid, {s} FROM {t} {bedingung}")
        except sqlite3.OperationalError:  # Tabelle ohne rowid
            zeilen = con.execute(f"SELECT NULL, {s} FROM {t} {bedingung}")
        stelle = f"{tabelle}.{spalte}"
        for zeilen_id, wert in zeilen:
            self.sammler.zaehle("db_werte")
            ort = stelle if zeilen_id is None else f"{stelle}[{zeilen_id}]"
            if isinstance(wert, bytes):
                self.sammler.melde(ort, ART_BINAER, f"Binärwert in einer Textspalte ({len(wert)} Bytes)", stelle=stelle)
            elif wert:
                for art, hinweis in self._db_wert(spalte, wert):
                    self.sammler.melde(ort, art, f"{hinweis}, Länge {len(wert)}", stelle=stelle)

    def _db_wert(self, spalte: str, wert: str) -> list[Treffer]:
        url_regel = self._post_url if spalte == "url" else None
        treffer = self._text_treffer(wert, url_regel=url_regel, medien_host=True, freitext=False)
        if treffer:
            return treffer
        beschreibung, passt = self._regel(spalte)
        return [] if passt(wert) else _abweichung(beschreibung, wert)

    def _regel(self, spalte: str) -> tuple[str, Callable[[str], object]]:
        """Positivliste je Spaltenname; unbekannte Spalten dürfen nur harmlose Einzelwerte enthalten."""
        if spalte == "url":
            return "Post-URL", self._post_url.fullmatch
        if spalte == "link_domains":
            return "JSON-Liste von Domains", _ist_domainliste
        if spalte == "meldungen":
            return "JSON-Liste kurzer Meldungen", _ist_meldungsliste
        if spalte in _ZAEHLER_JSON_SPALTEN:
            return "JSON mit Zählern (*_count)", _ist_zaehler_json
        if spalte == "details":
            return "JSON mit Zahlen", _ist_zahlen_json
        if spalte == "anzeigename":
            return "Anzeigename", _ist_anzeigename
        if spalte == "handle":
            return "Handle", _HANDLE.fullmatch
        if spalte in _HASH_SPALTEN:
            return "SHA-256 (64 Hex-Zeichen)", _HEX64.fullmatch
        if spalte == "phash":
            return "pHash (16 Hex-Zeichen)", _HEX16.fullmatch
        if spalte.endswith("_utc"):
            return "Zeitstempel", _ZEITSTEMPEL.fullmatch
        if spalte == "id" or spalte.endswith("_id"):
            return "numerische ID", _ID.fullmatch
        if spalte in _KENNWORT_SPALTEN:
            return "Kennwort", _ist_kennwort
        return "Zahl, Zeitstempel, Hash oder Kennwort", _ist_harmlos

    def _rohdatei(self, datei: Path, ort: str) -> None:
        self.sammler.zaehle("db_rohdateien")
        treffer: dict[str, Counter[str]] = {}  # Art -> Treffer je Muster
        erste: dict[str, int] = {}  # Art -> erste Position in der Datei

        def notiere(art: str, name: str, position: int) -> None:
            treffer.setdefault(art, Counter())[name] += 1
            erste[art] = min(erste.get(art, position), position)

        try:
            with datei.open("rb") as f:
                for basis, puffer, grenze in _bloecke(f):
                    for name, regex in _ROH_HTML:
                        for m in regex.finditer(puffer):
                            if m.start() < grenze and _kontext_lesbar(puffer, m.start(), m.end()):
                                notiere(ART_HTML, name, basis + m.start())
                    for name, regex in _ROH_MEDIEN:
                        for m in regex.finditer(puffer):
                            if m.start() < grenze:
                                notiere(ART_MEDIEN_URL, name, basis + m.start())
                    for m in _ROH_URL.finditer(puffer):
                        url = m.group()
                        # Werte stehen ohne Trenner hintereinander: erlaubt ist, was mit einer Post-URL beginnt.
                        if m.start() >= grenze or self._post_url_roh.match(url):
                            continue
                        if not any(regex.search(url) for _, regex in _ROH_MEDIEN):
                            notiere(ART_FREMDE_URL, "URL", basis + m.start())
                    for nr, regex in self._marker_roh:
                        for m in regex.finditer(puffer):
                            if m.start() < grenze:
                                notiere(ART_MARKER, f"Stichprobe {nr}", basis + m.start())
        except OSError as fehler:
            self._nicht_pruefbar(ort, fehler)
            return
        for art in sorted(treffer, key=erste.__getitem__):
            muster = ", ".join(f"{name} ({anzahl}×)" for name, anzahl in sorted(treffer[art].items()))
            self.sammler.melde(ort, art, f"in der Rohdatei: {muster}; erster Treffer bei Byte {erste[art]}")

    # -- Text- und CSV-Dateien -----------------------------------------------------

    def _textdatei(self, pfad: Path, ort: str, zeilen_schluessel: str) -> None:
        try:
            text = pfad.read_text(encoding="utf-8-sig", errors="replace")
        except OSError as fehler:
            self._nicht_pruefbar(ort, fehler)
            return
        rahmen_davor = False
        for nr, zeile in enumerate(text.splitlines(), start=1):
            self.sammler.zaehle(zeilen_schluessel)
            zeile = _LOG_KOPF.sub("", zeile, count=1)
            rahmen = bool(_TRACEBACK_RAHMEN.match(zeile))
            # Traceback-Rahmen und die Quelltextzeile darunter stammen aus Programmdateien, nicht aus Daten.
            freitext = not (rahmen or (rahmen_davor and zeile.startswith("    ")) or zeile in _TRACEBACK_ZEILEN)
            rahmen_davor = rahmen
            for art, hinweis in self._text_treffer(
                zeile, url_regel=self._erlaubte_url, medien_host=False, freitext=freitext
            ):
                self.sammler.melde(f"{ort}:{nr}", art, hinweis, stelle=ort)

    def _csv_zelle(self, zelle: str, regel: tuple[str, Callable[[str], object]] | None) -> list[Treffer]:
        """Bekannte Spalten wie die zugehörige Datenbankspalte prüfen, alle anderen wie eine Logzeile."""
        treffer = self._text_treffer(zelle, url_regel=self._erlaubte_url, medien_host=False, freitext=regel is None)
        if treffer or regel is None or not zelle:
            return treffer
        beschreibung, passt = regel
        wert = _ohne_formelschutz(zelle)
        return [] if passt(wert) else _abweichung(beschreibung, wert)

    def _csv_datei(self, pfad: Path, ort: str) -> None:
        try:
            text = pfad.read_text(encoding="utf-8-sig", errors="replace")
        except OSError as fehler:
            self._nicht_pruefbar(ort, fehler)
            return
        kopf = text.split("\n", 1)[0]
        leser = csv.reader(io.StringIO(text, newline=""), delimiter=";" if kopf.count(";") >= kopf.count(",") else ",")
        regeln: list[tuple[str, Callable[[str], object]] | None] = []
        try:
            for zeilen_nr, zellen in enumerate(leser):
                self.sammler.zaehle("export_zeilen")
                for spalte, zelle in enumerate(zellen):
                    regel = regeln[spalte] if spalte < len(regeln) else None
                    for art, hinweis in self._csv_zelle(zelle, regel):
                        self.sammler.melde(f"{ort}:{leser.line_num}", art, hinweis, stelle=ort)
                if zeilen_nr == 0:
                    regeln = [_csv_regel(name) for name in zellen]
        except csv.Error:
            self._textdatei(pfad, ort, "export_zeilen")

    # -- Bereiche --------------------------------------------------------------------

    def logs(self) -> None:
        wurzel = logbuch.log_ordner()
        for pfad in self._dateien(wurzel):
            self.sammler.zaehle("log_dateien")
            self._textdatei(pfad, _ort(wurzel, pfad), "log_zeilen")

    def temp(self) -> None:
        wurzel = pfade.temp_ordner()
        for pfad in self._dateien(wurzel):
            self.sammler.zaehle("temp_dateien")
            erster = wurzel / pfad.relative_to(wurzel).parts[0]
            hinweis = f"Datei im Temp-Ordner ({_groesse(pfad)} Bytes)"
            self.sammler.melde(_ort(wurzel, pfad), ART_TEMP, hinweis, stelle=_ort(wurzel, erster))

    def profil(self) -> None:
        wurzel = pfade.profil_ordner()
        if not self._vorhanden(wurzel, wurzel.name, ordner=True):
            return
        ordnerfehler = self._ordnerfehler(wurzel)
        for ordner, unterordner, dateien in os.walk(wurzel, onerror=ordnerfehler):
            o = Path(ordner)
            weiter = []
            for name in sorted(unterordner):
                pfad = o / name
                if name.casefold() in _CACHE_ORDNER:
                    anzahl, groesse = _ordnerinhalt(pfad, ordnerfehler)
                    if anzahl:
                        self.sammler.melde(
                            _ort(wurzel, pfad),
                            ART_CACHE,
                            f"Cache- bzw. Speicherordner mit {_anzahl(anzahl, 'Datei', 'Dateien')} ({groesse} Bytes)",
                            stelle=self._profil_stelle(wurzel, pfad),
                        )
                elif pfad.is_symlink():
                    self._profil_datei(wurzel, pfad)
                else:
                    weiter.append(name)
            unterordner[:] = weiter
            for name in sorted(dateien):
                self._profil_datei(wurzel, o / name)

    @staticmethod
    def _profil_stelle(wurzel: Path, pfad: Path) -> str:
        return _ort(wurzel, wurzel / pfad.relative_to(wurzel).parts[0])

    def _profil_datei(self, wurzel: Path, pfad: Path) -> None:
        self.sammler.zaehle("profil_dateien")
        ort = _ort(wurzel, pfad)
        if not browser.im_profil_erlaubt(pfad.relative_to(wurzel)):
            if pfad.name.casefold() in _VERLAUF_DATEIEN:
                beschreibung = "Verlauf oder Sitzungsdaten"
            else:
                beschreibung = "Datei außerhalb der Positivliste (nur Cookies und Einstellungen erlaubt)"
            hinweis = f"{beschreibung}, {_groesse(pfad)} Bytes"
            self.sammler.melde(ort, ART_PROFILDATEI, hinweis, stelle=self._profil_stelle(wurzel, pfad))
            return
        if pfad.name in _COOKIE_DATEIEN:
            return  # Cookies sind erlaubt und werden nicht inhaltlich geprüft.
        try:
            text = pfad.read_text(encoding="utf-8", errors="replace")
        except OSError as fehler:
            self._nicht_pruefbar(ort, fehler)
            return
        self.sammler.zaehle("profil_textdateien")
        name = _medien_muster(text, _PROFIL_MEDIEN)
        if name:
            self.sammler.melde(ort, ART_MEDIEN_URL, f"Medien-URL, Muster {name}")
        marker = set(self._marker_nummern(text))
        for stelle, wert, freitext in self._einstellungswerte(text, ort):
            marker.update(self._marker_nummern(wert))
            for art, hinweis in _einstellungs_treffer(wert, freitext=freitext):
                self.sammler.melde(stelle, art, f"{hinweis}, Länge {len(wert)}", stelle=ort)
        for nr in sorted(marker):
            self.sammler.melde(ort, ART_MARKER, f"Stichprobe {nr} gefunden")

    def _einstellungswerte(self, text: str, ort: str) -> Iterator[tuple[str, str, bool]]:
        """(Ort, Wert, Freitext prüfen) für jede Zeichenkette einer JSON-Datei, sonst für jede Zeile.

        Geprüft werden die eingelesenen Werte, nicht der Dateitext: Der Browser schreibt ``<`` als
        ``\\u003C``, und die Feldnamen der Einstellungen zählten sonst als Wörter eines Freitexts.
        """
        kern = text.lstrip("\ufeff").strip()
        if kern[:1] not in ("{", "["):  # First Run, Last Version, Last Browser
            for nr, zeile in enumerate(text.splitlines(), start=1):
                yield f"{ort}:{nr}", zeile, True
            return
        try:
            daten = json.loads(kern)
        except (ValueError, RecursionError) as fehler:
            self._nicht_pruefbar(ort, fehler)  # ohne lesbare Werte ist die Datei ungeprüft
            return
        for pfad, wert in _json_texte(daten):
            stelle = _json_stelle(pfad)
            yield (f"{ort}:{stelle}" if stelle else ort), wert, not _erweiterungs_manifest(pfad)

    def exporte(self) -> None:
        wurzel = self.konfig.export_ordner
        for pfad in self._dateien(wurzel):
            if pfad.suffix.lower() == ".csv":
                self.sammler.zaehle("export_dateien")
                self._csv_datei(pfad, _ort(wurzel, pfad))

    def spike_berichte(self) -> None:
        wurzel = _spike_ordner()
        for pfad in self._dateien(wurzel):
            self.sammler.zaehle("spike_dateien")
            self._textdatei(pfad, _ort(wurzel, pfad), "spike_zeilen")


def pruefe(konfig: Konfig, *, marker: list[str] | None = None) -> Pruefbericht:
    """Durchsucht alle Ablageorte nach Inhaltsresten. Verändert keine der geprüften Dateien.

    ``marker``: exakte Zeichenketten (mindestens vier Zeichen), die nirgends vorkommen dürfen,
    etwa ein Satz aus einem echten Post. Leerraum am Anfang und Ende wird ignoriert.
    """
    pruefung = _Pruefung(konfig, _bereinige_marker(marker))
    pruefung.datenbank()
    pruefung.logs()
    pruefung.temp()
    pruefung.profil()
    pruefung.exporte()
    pruefung.spike_berichte()
    return pruefung.sammler.abschliessen()


# ---------------------------------------------------------------------------
# Bericht und Kommandozeile


def bericht_text(bericht: Pruefbericht) -> str:
    """Deutscher Bericht für die Konsole: was geprüft wurde und wo etwas gefunden wurde (ohne Inhalte)."""
    zeilen = ["Prüfung auf Inhaltsreste", ""]
    for bereich, teile in _UEBERSICHT:
        if bereich == "Datenbank" and not bericht.geprueft.get("db_vorhanden"):
            rohdateien = _anzahl(bericht.geprueft.get("db_rohdateien", 0), "Rohdatei", "Rohdateien")
            werte = f"keine Datenbankdatei gefunden, {rohdateien}"
        else:
            werte = ", ".join(_anzahl(bericht.geprueft.get(schluessel, 0), *namen) for schluessel, *namen in teile)
        zeilen.append(f"  {bereich + ':':<16}{werte}")
    if bericht.orte:
        zeilen += ["", "Geprüfte Orte:"]
        zeilen.extend(f"  {bereich + ':':<16}{pfad}" for bereich, pfad in bericht.orte.items())
    zeilen.append("")
    if bericht.ok:
        zeilen.append("Ergebnis: sauber, keine Inhaltsreste gefunden.")
        return "\n".join(zeilen)
    anzahl = len(bericht.funde)
    zeilen.append(f"Ergebnis: {anzahl} {'Fund' if anzahl == 1 else 'Funde'}")
    reihenfolge = list(ART_BESCHRIFTUNG)
    for art in sorted({f.art for f in bericht.funde}, key=lambda a: reihenfolge.index(a) if a in reihenfolge else 99):
        funde = [f for f in bericht.funde if f.art == art]
        zeilen.append("")
        zeilen.append(f"{ART_BESCHRIFTUNG.get(art, art)} ({len(funde)}):")
        zeilen.extend(f"  - {f.ort}: {f.hinweis}" for f in funde)
    zeilen.append("")
    zeilen.append("Der Bericht nennt nur Ort und Art der Funde, nie den Inhalt. Bitte die Stellen selbst ansehen.")
    return "\n".join(zeilen)


_STD_INPUT_HANDLE = -10  # (DWORD)-10 in der Windows-API
_STRG_Z = "\x1a"  # Windows liefert Strg+Z mitten in einer Zeile als Zeichen statt als Ende der Eingabe


def _konsolenpuffer_leeren() -> None:
    """Windows: verwirft, was nach dem Ende der Eingabe noch im Eingabepuffer der Konsole steht.

    Sonst bekäme ``cmd.exe`` übrig gebliebene Zeilen einer eingefügten Stichprobe nach dem Skript als
    Befehle (``pause`` in ``run_pruefung.bat`` verbraucht nur eine Taste).
    """
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetStdHandle.restype = ctypes.c_void_p
        kernel32.FlushConsoleInputBuffer.argtypes = (ctypes.c_void_p,)
        kernel32.FlushConsoleInputBuffer(kernel32.GetStdHandle(_STD_INPUT_HANDLE))
    except Exception:  # noqa: BLE001 - ohne Konsole (umgeleitete Eingabe) gibt es keinen Puffer zu leeren
        pass


def _frage_marker() -> list[str]:
    """Liest Stichproben zeilenweise bis zum Ende der Eingabe; Leerzeilen trennen nur Absätze."""
    ende = "Strg+Z und dann Eingabe" if sys.platform == "win32" else "Strg+D in einer leeren Zeile"
    print("Stichproben eingeben oder einfügen, z. B. den Text eines echten Posts, gern mit mehreren Absätzen.")
    print(f"Jede Zeile ist eine eigene Stichprobe; Leerzeilen und Zeilen unter {MARKER_MIN_LAENGE} Zeichen "
          "werden übersprungen.")
    print(f"Zum Abschluss {ende} drücken:")
    marker: list[str] = []
    zu_kurz = 0
    try:
        while True:
            try:
                zeile = input()
            except EOFError:
                break
            zeile, strg_z, _ = zeile.partition(_STRG_Z)
            eintrag = zeile.strip()
            if len(eintrag) >= MARKER_MIN_LAENGE:
                marker.append(eintrag)
            elif eintrag:
                zu_kurz += 1
            if strg_z:
                break
    finally:
        _konsolenpuffer_leeren()
    if zu_kurz:
        print(f"{_anzahl(zu_kurz, 'Zeile', 'Zeilen')} mit weniger als {MARKER_MIN_LAENGE} Zeichen übersprungen.")
    print(f"{_anzahl(len(marker), 'Stichprobe', 'Stichproben')} übernommen.")
    return marker


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="truthtracker pruefen",
        description="Sucht in Datenbank, Logs, Temp-Ordner, Browserprofil, Exporten und Spike-Berichten "
        "nach Inhaltsresten. Exit-Code 0 = sauber, 1 = Funde, 2 = Prüfung nicht möglich.",
    )
    parser.add_argument("--config", type=Path, help="Pfad zur config.toml (Standard: im Projektordner)")
    parser.add_argument(
        "--marker",
        action="append",
        default=[],
        metavar="TEXT",
        help="Zeichenkette, die nirgends vorkommen darf (mehrfach möglich). Landet im Befehlsverlauf; "
        "besser --abfragen oder --marker-datei.",
    )
    parser.add_argument(
        "--marker-datei", type=Path, metavar="DATEI", help="Textdatei (UTF-8) mit einer Stichprobe je Zeile"
    )
    parser.add_argument(
        "--abfragen",
        action="store_true",
        help="Stichproben eintippen oder einfügen (je Zeile eine, Absätze erlaubt); Ende mit Strg+Z und Eingabe "
        "(Windows) bzw. Strg+D",
    )
    args = parser.parse_args(argv)
    # Ohne Datei nähme konfig.lade still den Projektordner; die Prüfung sähe dann woanders nach als gewollt.
    if args.config is not None and not args.config.is_file():
        print(f"Die Konfigurationsdatei {args.config} gibt es nicht. Ohne --config gilt config.toml im Projektordner.")
        return 2
    try:
        einstellungen = lade(args.config)
    except KonfigFehler as fehler:
        print(f"Fehler in der Konfiguration: {fehler}")
        return 2
    except OSError as fehler:
        print(f"Die Konfigurationsdatei ließ sich nicht lesen ({type(fehler).__name__}).")
        return 2
    marker = list(args.marker)
    if args.marker_datei:
        try:
            marker.extend(args.marker_datei.read_text(encoding="utf-8-sig").splitlines())
        except (OSError, UnicodeDecodeError) as fehler:
            print(f"Die Stichproben-Datei ließ sich nicht lesen ({type(fehler).__name__}).")
            return 2
    if args.abfragen:
        marker.extend(_frage_marker())
    try:
        bericht = pruefe(einstellungen, marker=marker)
    except ValueError as fehler:
        print(fehler)
        return 2
    print(bericht_text(bericht))
    return 0 if bericht.ok else 1


if __name__ == "__main__":
    sys.exit(main())
