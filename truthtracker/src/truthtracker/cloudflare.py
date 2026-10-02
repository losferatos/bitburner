"""Einordnung einer HTTP-Antwort: Daten, Cloudflare-Hürde, Sperre oder eindeutig "nicht gefunden".

Grundsatz: Eine Antwort, die sich als JSON parsen lässt, wird nie anhand ihres Texts als
Challenge eingestuft. Ein Post kann die Wörter "Just a moment" enthalten; das ist dann
Inhalt, kein Cloudflare. Die Textmarker gelten nur für Antworten, die kein JSON sind.

"Nicht gefunden" ist nur dann eindeutig, wenn der Server mit 404 *und* einem JSON-Körper
mit ``error``-Feld antwortet (so meldet Mastodon gelöschte Posts). Ein 404 als HTML-Seite
kann vom CDN, einem Wartungsmodus oder einer Sperre stammen und zählt nicht.

HTTP 401 heißt bei Truth Social "für diese Abfrage ist ein Login nötig" (z. B. Timeline ohne
``exclude_replies=true`` oder Einzelabruf eines Replies). Das betrifft nur die einzelne
Abfrage und ist kein Grund, den ganzen Lauf abzubrechen; der Aufrufer entscheidet.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

OK = "ok"
CHALLENGE = "challenge"
BLOCKIERT = "blockiert"
GEOBLOCK = "geoblock"
RATELIMIT = "ratelimit"
NICHT_GEFUNDEN = "nicht_gefunden"
VERWEIGERT = "verweigert"
LOGIN_NOETIG = "login_noetig"
SERVERFEHLER = "serverfehler"
KEIN_JSON = "kein_json"
NETZWERKFEHLER = "netzwerkfehler"
UNERWARTET = "unerwartet"

# Bei diesen Befunden wird nicht weiter angefragt: Ein Mensch muss etwas tun oder warten.
ABBRUCH_ARTEN = frozenset({CHALLENGE, BLOCKIERT, GEOBLOCK, RATELIMIT, VERWEIGERT})

_CHALLENGE_MARKER = (
    "just a moment",
    "cdn-cgi/challenge-platform",
    "cf-chl-",
    "_cf_chl_opt",
    "challenges.cloudflare.com",
    "enable javascript and cookies to continue",
    "checking your browser",
    "checking if the site connection is secure",
)
_BLOCK_MARKER = (
    "you have been blocked",
    "attention required! | cloudflare",
    "error code: 1020",
    "error 1020",
    "error 1015",
    "error code: 1015",
)
_GEO_MARKER = ("unavailable in your area",)


@dataclass(frozen=True)
class Bewertung:
    art: str
    status: int | None
    daten: Any = field(default=None, repr=False, compare=False)
    hinweis: str = ""

    @property
    def ok(self) -> bool:
        return self.art == OK

    @property
    def abbruch(self) -> bool:
        return self.art in ABBRUCH_ARTEN


def kopfzeilen(headers: Any) -> dict[str, str]:
    """Kopfzeilen als dict mit kleingeschriebenen Namen; mehrfache Werte mit ', ' verbunden."""
    paare: Iterable[tuple[str, str]]
    if hasattr(headers, "multi_items"):
        paare = headers.multi_items()
    elif isinstance(headers, Mapping):
        paare = headers.items()
    else:
        paare = list(headers or [])
    ergebnis: dict[str, str] = {}
    for name, wert in paare:
        name = str(name).lower()
        wert = str(wert)
        ergebnis[name] = f"{ergebnis[name]}, {wert}" if name in ergebnis else wert
    return ergebnis


def bewerte(status: int | None, headers: Any, body: bytes | str | None) -> Bewertung:
    if status is None:
        return Bewertung(NETZWERKFEHLER, None)
    h = kopfzeilen(headers)
    if h.get("cf-mitigated", "").strip().lower() == "challenge":
        return Bewertung(CHALLENGE, status, hinweis="cf-mitigated: challenge")

    if isinstance(body, str):
        roh = body.encode("utf-8", "replace")
    else:
        roh = body or b""

    daten: Any = None
    ist_json = False
    if roh:
        try:
            daten = json.loads(roh.decode("utf-8"))
            ist_json = True
        except (UnicodeDecodeError, ValueError):
            ist_json = False

    if status == 429:
        return Bewertung(RATELIMIT, status, hinweis=h.get("retry-after", ""))

    if ist_json:
        if 200 <= status < 300:
            return Bewertung(OK, status, daten)
        if status == 404 and isinstance(daten, dict) and "error" in daten:
            return Bewertung(NICHT_GEFUNDEN, status, daten)
        if status in (401, 403):
            # Die Regionssperre kommt je nach Endpunkt auch als JSON-Fehler.
            if any(m in roh[:5000].decode("utf-8", "replace").lower() for m in _GEO_MARKER):
                return Bewertung(GEOBLOCK, status)
            if status == 401:
                return Bewertung(LOGIN_NOETIG, status, daten)
            return Bewertung(VERWEIGERT, status, daten)
        if status >= 500:
            return Bewertung(SERVERFEHLER, status)
        return Bewertung(UNERWARTET, status, daten)

    text = roh[:200_000].decode("utf-8", "replace").lower()
    if any(m in text for m in _GEO_MARKER):
        return Bewertung(GEOBLOCK, status)
    if any(m in text for m in _BLOCK_MARKER):
        return Bewertung(BLOCKIERT, status)
    if any(m in text for m in _CHALLENGE_MARKER):
        return Bewertung(CHALLENGE, status)
    if status == 403:
        return Bewertung(BLOCKIERT if "cloudflare" in text else VERWEIGERT, status)
    if status == 401:
        return Bewertung(LOGIN_NOETIG, status)
    if status == 404:
        return Bewertung(UNERWARTET, status, hinweis="404 ohne JSON-Fehlerkoerper")
    if status >= 500:
        return Bewertung(SERVERFEHLER, status)
    if 200 <= status < 300 and not roh:
        return Bewertung(KEIN_JSON, status, hinweis="leerer Koerper")
    return Bewertung(KEIN_JSON, status)


def melde(bewertung: Bewertung) -> str:
    """Kurzer deutscher Satz für Konsole und Laufprotokoll."""
    texte = {
        CHALLENGE: "Cloudflare verlangt eine Browser-Prüfung (Challenge).",
        BLOCKIERT: "Cloudflare hat die Anfrage blockiert.",
        GEOBLOCK: "Truth Social meldet: in deiner Region nicht verfügbar.",
        RATELIMIT: "Zu viele Anfragen (HTTP 429).",
        VERWEIGERT: "Zugriff verweigert (HTTP 403 ohne Cloudflare-Merkmale).",
        LOGIN_NOETIG: "Für diese Abfrage verlangt Truth Social einen Login (HTTP 401).",
        NICHT_GEFUNDEN: "Eindeutig nicht gefunden (404 mit JSON-Fehler).",
        SERVERFEHLER: "Serverfehler (5xx).",
        KEIN_JSON: "Antwort war kein JSON.",
        NETZWERKFEHLER: "Netzwerkfehler, keine Antwort erhalten.",
        UNERWARTET: "Unerwartete Antwort.",
        OK: "OK.",
    }
    satz = texte.get(bewertung.art, bewertung.art)
    if bewertung.status is not None:
        satz = f"{satz} (HTTP {bewertung.status})"
    if bewertung.art == RATELIMIT and bewertung.hinweis:
        satz = f"{satz} Retry-After: {bewertung.hinweis}"
    return satz
