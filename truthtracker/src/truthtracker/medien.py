"""Medien: Metadaten der Anhänge, Download in den Speicher, SHA-256 und perzeptueller Hash.

Datenschutz: Medienbytes existieren nur kurz im Speicher. ``MedienErfasser`` lädt ein Bild
bzw. bei Videos, GIFs und sonstigen Medien nur das Vorschaubild, berechnet SHA-256 und pHash
und verwirft die Bytes sofort. Es wird nichts auf die Platte geschrieben und nichts
protokolliert. URLs stehen weder in den Rückgabeobjekten noch in Fehlermeldungen.
Videodateien und Audio werden nie geladen.

Perzeptueller Hash (``phash_hex``), 64 Bit als 16 Hex-Zeichen:

1. Bild dekodieren (nur die Formate aus ``_BILDFORMATE``); bei animierten Bildern zählt das
   erste Bild. Die EXIF-Orientierung wird angewendet, damit ein gedreht gespeichertes Foto
   denselben Hash bekommt wie das aufrecht gespeicherte.
2. Graustufen. Transparente Bereiche werden vorher auf Weiß gelegt, weil die Farbwerte
   vollständig transparenter Pixel undefiniert sind und je nach Encoder variieren.
   16-Bit-Graustufen werden auf 8 Bit abgebildet (Wert / 257).
3. Auf 32 × 32 Pixel verkleinern (LANCZOS).
4. 2D-DCT-II per Matrixmultiplikation: ``K = C · X · Cᵀ`` mit
   ``C[k, n] = cos(π · k · (2n + 1) / 64)`` (ohne Normierung; ein gemeinsamer Faktor ändert
   den Vergleich mit dem Median nicht).
5. Die oberen linken 8 × 8 Koeffizienten (niedrigste Frequenzen, inklusive Gleichanteil)
   nehmen und auf 6 Nachkommastellen runden. Das Runden beseitigt Rundungsrauschen der
   Gleitkommarechnung, sodass z. B. einfarbige Flächen auf jedem Rechner gleich hashen.
6. Bit = Koeffizient > Median dieser 64 Werte. Reihenfolge zeilenweise, das erste Bit
   (Zeile 0, Spalte 0) ist das höchstwertige.

Ähnliche Bilder (neu kodiert, verkleinert) haben einen kleinen Hamming-Abstand; die
Duplikat-Erkennung (Fall 4) wertet Abstände bis ``[duplikate] phash_max_abstand`` als
"wahrscheinlich gleich".
"""

from __future__ import annotations

import hashlib
import io
import math
import re
import string
from collections.abc import Callable, Mapping
from functools import cache
from typing import Any
from urllib.parse import urlsplit

import numpy as np
from PIL import Image, ImageOps

from truthtracker.modelle import (
    HASH_FEHLER,
    HASH_OFFEN,
    HASH_OK,
    HASH_UEBERSPRUNGEN,
    MEDIUM_AUDIO,
    MEDIUM_BILD,
    MEDIUM_GIF,
    MEDIUM_SONSTIG,
    MEDIUM_VIDEO,
    MedienDaten,
)

QUELLE_ORIGINAL = "original"  # Hash über die Bilddatei selbst
QUELLE_VORSCHAU = "vorschau"  # Hash über das Vorschaubild

MAX_BYTES_STANDARD = 20_000_000
# Schutz vor Bildern, die klein komprimiert sind, aber beim Dekodieren riesig werden.
MAX_PIXEL = 40_000_000
# Pillow kann viel mehr öffnen, manche Formate (z. B. EPS) über externe Programme und
# Temp-Dateien. Mastodon-Server liefern Bilder nur in diesen Formaten aus. Handyfotos im
# MPO-Format öffnet Pillow über "JPEG".
_BILDFORMATE = ("JPEG", "PNG", "GIF", "WEBP", "AVIF", "BMP")
_HOHE_BITTIEFE = frozenset({"I", "I;16", "I;16B", "I;16L", "I;16N"})
# Endungen von Video- und Audiodateien: eine solche "Vorschau" wird nie geladen.
_STROM_ENDUNGEN = (
    ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".ogv", ".ogg", ".mp3", ".m4a", ".wav",
    ".flac", ".opus", ".aac", ".m3u8", ".mpd",
)
_MAX_KANTE_PX = 100_000
_HEXZIFFERN = frozenset(string.hexdigits)
_MEDIEN_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")

_PHASH_KANTE = 32
_PHASH_BLOCK = 8
_DCT_MATRIX = np.cos(
    np.pi * np.outer(np.arange(_PHASH_KANTE), 2 * np.arange(_PHASH_KANTE) + 1) / (2 * _PHASH_KANTE)
)

_ARTEN = {
    "image": MEDIUM_BILD,
    "video": MEDIUM_VIDEO,
    "tv": MEDIUM_VIDEO,
    "gifv": MEDIUM_GIF,
    "audio": MEDIUM_AUDIO,
}

Laden = Callable[[str], bytes]
CacheHolen = Callable[[str], Mapping[str, Any] | None]
CacheSpeichern = Callable[[str, str, str, str | None, str], None]


class MedienFehler(Exception):
    """Download oder Dekodierung eines Mediums gescheitert. Die Meldung enthält nie eine URL."""


def medien_art(api_typ: str | None) -> str:
    """API-Feld ``type`` → Medienart (``bild``, ``video``, ``gif``, ``audio``, ``sonstig``)."""
    if not isinstance(api_typ, str):
        return MEDIUM_SONSTIG
    return _ARTEN.get(api_typ.strip().lower(), MEDIUM_SONSTIG)


def beschreibe(anhang: dict, position: int) -> MedienDaten:
    """Metadaten eines Anhangs ohne Download: ID, Art, Abmessungen, Dauer.

    ``hash_status`` ist ``uebersprungen`` für Audio und für Medien ohne ladbare Quelle
    (siehe ``MedienErfasser``), sonst ``offen``.
    """
    if not isinstance(anhang, Mapping):
        return MedienDaten(position=position, medien_id=None, art=MEDIUM_SONSTIG, hash_status=HASH_UEBERSPRUNGEN)
    art = medien_art(anhang.get("type"))
    original = _original_meta(anhang)
    breite = _kantenlaenge(original.get("width"))
    hoehe = _kantenlaenge(original.get("height"))
    if breite is None or hoehe is None:
        breite, hoehe = _masse_aus_groesse(original.get("size"))
    dauer = _dauer(original.get("duration"))
    if dauer is None:
        dauer = _dauer_aus_laenge(original.get("length"))
    return MedienDaten(
        position=position,
        medien_id=_medien_id(anhang.get("id")),
        art=art,
        breite=breite,
        hoehe=hoehe,
        dauer_s=dauer,
        hash_status=HASH_OFFEN if _quelle(anhang, art) is not None else HASH_UEBERSPRUNGEN,
    )


def sha256_hex(daten: bytes) -> str:
    return hashlib.sha256(daten).hexdigest()


def phash_hex(bild: bytes) -> str:
    """64-Bit-DCT-pHash der Bilddaten als 16 Hex-Zeichen (Verfahren im Moduldocstring).

    Wirft ``MedienFehler``, wenn sich die Daten nicht als Bild dekodieren lassen.
    """
    pixel = _graustufen_32(bild)
    koeffizienten = _DCT_MATRIX @ pixel @ _DCT_MATRIX.T
    tief = np.round(koeffizienten[:_PHASH_BLOCK, :_PHASH_BLOCK], 6)
    bits = (tief > np.median(tief)).flatten()
    return np.packbits(bits).tobytes().hex()


def hamming(a: str, b: str) -> int:
    """Anzahl unterschiedlicher Bits zweier gleich langer Hex-Hashes."""
    if len(a) != len(b):
        raise ValueError("Hashes unterschiedlicher Länge lassen sich nicht vergleichen.")
    return (int(a, 16) ^ int(b, 16)).bit_count()


class MedienErfasser:
    """Hasht Medienanhänge: Cache prüfen, sonst Quelle in den Speicher laden und hashen.

    Quelle: Bilder über ``url`` (``hash_quelle = "original"``), ersatzweise ``preview_url``
    (``"vorschau"``); Videos, GIFs und sonstige Medien nur über ``preview_url``, nie über
    ``url``; Audio gar nicht. Nur http(s)-URLs.

    ``laden`` liefert die Bytes einer URL. Wirft es ``MedienFehler``, gilt das Medium als
    gescheitert (``hash_status = "fehler"``) und der Lauf geht weiter. Jede andere Ausnahme
    (z. B. ``transport.Abbruch`` bei Cloudflare) wird unverändert durchgereicht.

    Zähler: ``downloads`` (Aufrufe von ``laden``, auch gescheiterte), ``cache_treffer``
    (Medien ohne Download dank Cache) und ``fehler`` (gescheiterte Downloads).
    """

    def __init__(
        self,
        laden: Laden,
        *,
        cache_holen: CacheHolen | None = None,
        cache_speichern: CacheSpeichern | None = None,
        max_bytes: int = MAX_BYTES_STANDARD,
    ) -> None:
        if max_bytes <= 0:
            raise ValueError("max_bytes muss größer als 0 sein.")
        self._laden = laden
        self._cache_holen = cache_holen
        self._cache_speichern = cache_speichern
        self._max_bytes = max_bytes
        # Hashes dieses Laufs: dasselbe Medium wird auch ohne Datenbank-Cache nur einmal geladen.
        self._gemerkt: dict[str, tuple[str, str | None, str]] = {}
        self.downloads = 0
        self.cache_treffer = 0
        self.fehler = 0

    def erfasse(self, anhang: dict, position: int) -> MedienDaten:
        daten = beschreibe(anhang, position)
        if daten.hash_status == HASH_UEBERSPRUNGEN:
            return daten
        url, hash_quelle = _quelle(anhang, daten.art)

        bekannt = self._aus_cache(daten.medien_id, hash_quelle)
        if bekannt is not None:
            self.cache_treffer += 1
            daten.sha256, daten.phash, daten.hash_quelle = bekannt
            daten.hash_status = HASH_OK
            return daten

        try:
            sha256, phash = self._lade_und_hashe(url)
        except MedienFehler:
            self.fehler += 1
            daten.hash_status = HASH_FEHLER
            return daten

        daten.sha256, daten.phash, daten.hash_quelle = sha256, phash, hash_quelle
        daten.hash_status = HASH_OK
        if daten.medien_id is not None:
            self._gemerkt[daten.medien_id] = (sha256, phash, hash_quelle)
            if self._cache_speichern is not None:
                self._cache_speichern(daten.medien_id, daten.art, sha256, phash, hash_quelle)
        return daten

    def _aus_cache(self, medien_id: str | None, hash_quelle: str) -> tuple[str, str | None, str] | None:
        if medien_id is None:
            return None
        if medien_id in self._gemerkt:
            return self._gemerkt[medien_id]
        if self._cache_holen is None:
            return None
        eintrag = self._cache_holen(medien_id)
        if eintrag is None:
            return None
        werte = dict(eintrag)
        sha256 = werte.get("sha256")
        if not _ist_hex(sha256, 64):
            return None
        phash = werte.get("phash")
        quelle = werte.get("hash_quelle")
        ergebnis = (
            sha256.lower(),
            phash.lower() if _ist_hex(phash, 16) else None,
            quelle if quelle in (QUELLE_ORIGINAL, QUELLE_VORSCHAU) else hash_quelle,
        )
        self._gemerkt[medien_id] = ergebnis
        return ergebnis

    def _lade_und_hashe(self, url: str) -> tuple[str, str | None]:
        self.downloads += 1
        roh = self._laden(url)
        try:
            if isinstance(roh, (bytearray, memoryview)):
                roh = bytes(roh)
            elif not isinstance(roh, bytes):
                raise TypeError(f"laden lieferte {type(roh).__name__} statt bytes.")
            if not roh:
                raise MedienFehler("Leere Antwort beim Medien-Download.")
            if len(roh) > self._max_bytes:
                raise MedienFehler(f"Medium größer als {self._max_bytes} Bytes, nicht gehasht.")
            if _ist_textantwort(roh):
                # Eine Fehler- oder Challenge-Seite hätte bei allen Medien denselben SHA-256 und
                # würde lauter falsche Duplikate erzeugen.
                raise MedienFehler("Antwort ist kein Bild, sondern Text oder HTML.")
            sha256 = sha256_hex(roh)
            try:
                phash = phash_hex(roh)
            except MedienFehler:
                phash = None
            return sha256, phash
        finally:
            # Tracebacks halten Frame-Variablen fest; die Bytes sollen auch im Fehlerfall sofort weg.
            del roh


def _quelle(anhang: Mapping[str, Any], art: str) -> tuple[str, str] | None:
    """Welche URL für den Hash geladen wird und als was sie zählt; ``None`` = nichts laden."""
    if art == MEDIUM_AUDIO:
        return None
    url = anhang.get("url")
    vorschau = anhang.get("preview_url")
    if art == MEDIUM_BILD:
        if _ist_http(url):
            return url.strip(), QUELLE_ORIGINAL
        if _ist_http(vorschau):
            return vorschau.strip(), QUELLE_VORSCHAU
        return None
    if not _ist_http(vorschau) or vorschau == url or _ist_stromdatei(vorschau):
        return None
    return vorschau.strip(), QUELLE_VORSCHAU


def _ist_http(url: object) -> bool:
    if not isinstance(url, str) or not url.strip():
        return False
    try:
        teile = urlsplit(url.strip())
    except ValueError:
        return False
    return teile.scheme.lower() in ("http", "https") and bool(teile.netloc)


def _ist_stromdatei(url: str) -> bool:
    return urlsplit(url.strip()).path.lower().endswith(_STROM_ENDUNGEN)


def _ist_textantwort(roh: bytes) -> bool:
    anfang = roh[:256].lstrip(b" \t\r\n\f\v")
    if anfang.startswith(b"\xef\xbb\xbf"):
        anfang = anfang[3:].lstrip(b" \t\r\n\f\v")
    return anfang[:1] in (b"<", b"{", b"[")


def _ist_hex(wert: object, laenge: int) -> bool:
    return isinstance(wert, str) and len(wert) == laenge and set(wert) <= _HEXZIFFERN


def _original_meta(anhang: Mapping[str, Any]) -> Mapping[str, Any]:
    meta = anhang.get("meta")
    if not isinstance(meta, Mapping):
        return {}
    original = meta.get("original")
    return original if isinstance(original, Mapping) else {}


def _zahl(wert: object) -> float | None:
    if isinstance(wert, bool):
        return None
    if isinstance(wert, (int, float)):
        zahl = float(wert)
    elif isinstance(wert, str):
        try:
            zahl = float(wert.strip())
        except ValueError:
            return None
    else:
        return None
    return zahl if math.isfinite(zahl) else None


def _kantenlaenge(wert: object) -> int | None:
    zahl = _zahl(wert)
    if zahl is None or not 0 < zahl <= _MAX_KANTE_PX:
        return None
    return max(1, round(zahl))


def _masse_aus_groesse(wert: object) -> tuple[int | None, int | None]:
    """``size`` im Format ``"1200x800"``; beide Werte oder keiner."""
    if not isinstance(wert, str) or wert.lower().count("x") != 1:
        return None, None
    breite, hoehe = (_kantenlaenge(teil) for teil in wert.lower().split("x"))
    if breite is None or hoehe is None:
        return None, None
    return breite, hoehe


def _dauer(wert: object) -> float | None:
    zahl = _zahl(wert)
    return zahl if zahl is not None and zahl >= 0 else None


def _dauer_aus_laenge(wert: object) -> float | None:
    """``length`` im Format ``"0:01:02.50"`` bzw. ``"01:02.50"`` in Sekunden."""
    if not isinstance(wert, str):
        return None
    teile = wert.strip().split(":")
    if not 1 <= len(teile) <= 3:
        return None
    sekunden = 0.0
    for teil in teile:
        zahl = _zahl(teil)
        if zahl is None or zahl < 0:
            return None
        sekunden = sekunden * 60 + zahl
    return sekunden


def _medien_id(wert: object) -> str | None:
    """Nur echte IDs; alles andere könnte Inhalt sein und landet nicht in DB und Cache."""
    if isinstance(wert, bool) or not isinstance(wert, (str, int)):
        return None
    text = str(wert).strip()
    return text if _MEDIEN_ID.fullmatch(text) else None


@cache
def _verfuegbare_formate() -> tuple[str, ...]:
    Image.init()
    return tuple(f for f in _BILDFORMATE if f in Image.OPEN)


def _graustufen_32(daten: bytes) -> np.ndarray:
    """Dekodiert das (erste) Bild und liefert es als 32 × 32 Graustufen-Matrix (float64)."""
    try:
        with Image.open(io.BytesIO(daten), formats=_verfuegbare_formate()) as bild:
            breite, hoehe = bild.size
            if breite * hoehe > MAX_PIXEL:
                raise MedienFehler("Bild hat zu viele Pixel zum Dekodieren.")
            try:
                aufrecht = ImageOps.exif_transpose(bild)
            except Exception:
                # Kaputte EXIF-Daten: dann eben ungedreht, das Bild selbst kann trotzdem gültig sein.
                aufrecht = bild
            klein = _graustufen(aufrecht).resize((_PHASH_KANTE, _PHASH_KANTE), Image.Resampling.LANCZOS)
            return np.asarray(klein, dtype=np.float64)
    except MedienFehler:
        raise
    except Exception:
        # Pillow wirft je nach Format und Defekt sehr verschiedene Ausnahmen. Die Ursache wird
        # nicht angehängt, damit nichts aus den Daten in Meldungen oder Tracebacks landet.
        raise MedienFehler("Bilddaten ließen sich nicht dekodieren.") from None


def _graustufen(bild: Image.Image) -> Image.Image:
    if bild.mode in _HOHE_BITTIEFE:
        # Pillow schneidet beim Umwandeln nach "L" alles über 255 ab, statt zu skalieren.
        werte = np.asarray(bild.convert("F"), dtype=np.float64) / 257.0
        return Image.fromarray(np.clip(np.round(werte), 0, 255).astype(np.uint8))
    if bild.has_transparency_data:
        rgba = bild.convert("RGBA")
        weiss = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        return Image.alpha_composite(weiss, rgba).convert("L")
    return bild.convert("L")
