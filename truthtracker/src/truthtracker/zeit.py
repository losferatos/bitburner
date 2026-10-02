"""Zeit: gespeichert wird immer UTC, angezeigt wird in New York oder Berlin.

In der Datenbank stehen Zeitpunkte als Text ``YYYY-MM-DDTHH:MM:SSZ`` (sekundengenau,
UTC). Diese Form sortiert lexikographisch richtig und ist in SQLite und pandas eindeutig.
Die Umrechnung in die Anzeigezeitzone läuft über ``zoneinfo``; unter Windows liefert das
Paket ``tzdata`` die Zeitzonendaten, damit Sommerzeitwechsel stimmen.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

ZEITZONEN = {
    "ET": "America/New_York",
    "Berlin": "Europe/Berlin",
}
ZEITZONEN_BESCHRIFTUNG = {
    "America/New_York": "US-Ostküste (New York)",
    "Europe/Berlin": "Berlin",
}

Uhr = Callable[[], datetime]


def systemuhr() -> datetime:
    return datetime.now(UTC)


def parse_utc(wert: object) -> datetime | None:
    """ISO-Zeitstempel (mit ``Z`` oder Offset) als UTC-``datetime``. Ohne Zone gilt UTC."""
    if wert is None:
        return None
    if isinstance(wert, datetime):
        dt = wert
    elif isinstance(wert, str) and wert.strip():
        text = wert.strip()
        if text.endswith(("Z", "z")):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    try:
        return dt.astimezone(UTC)
    except (OverflowError, ValueError):
        return None


def utc_text(dt: datetime | None) -> str | None:
    """Sekundengenauer UTC-Text für die Datenbank (Sekundenbruchteile werden abgeschnitten)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        raise ValueError("Zeitpunkt ohne Zeitzone")
    utc = dt.astimezone(UTC)
    # Jahr ausdrücklich vierstellig: strftime("%Y") lässt unter Linux führende Nullen weg,
    # dann stimmte die Textsortierung in der DB nicht mehr.
    return f"{utc.year:04d}" + utc.strftime("-%m-%dT%H:%M:%SZ")


def alter_in_stunden(erstellt: datetime, gemessen: datetime) -> float:
    return (gemessen - erstellt).total_seconds() / 3600.0


def in_zone(dt: datetime, zone: str) -> datetime:
    """UTC-Zeitpunkt in die Anzeigezeitzone; ``zone`` ist ein IANA-Name oder ``ET``/``Berlin``."""
    return dt.astimezone(ZoneInfo(ZEITZONEN.get(zone, zone)))


# Mastodon-IDs sind "Snowflakes": Millisekunden seit 1970, um 16 Bit nach links geschoben,
# plus eine Folgenummer. Damit lassen sich Zeitpunkte und ID-Grenzen ineinander umrechnen.


def id_untergrenze(dt: datetime) -> int:
    """Kleinste ID, die ein zu diesem Zeitpunkt erstellter Post haben kann."""
    return int(dt.astimezone(UTC).timestamp() * 1000) << 16


def id_obergrenze(dt: datetime) -> int:
    """Größte ID, die ein bis zu diesem Zeitpunkt (Millisekunde) erstellter Post haben kann."""
    return (int(dt.astimezone(UTC).timestamp() * 1000) << 16) | 0xFFFF


def zeit_aus_id(post_id: str | int) -> datetime:
    return datetime.fromtimestamp((int(post_id) >> 16) / 1000, tz=UTC)
