"""Medien: Metadaten der Anhänge, Download in den Speicher, SHA-256 und perzeptueller Hash.

Datenschutz: Medienbytes existieren nur kurz im Speicher. ``MedienErfasser`` lädt ein Bild
bzw. bei Videos, GIFs und sonstigen Medien nur das Vorschaubild, berechnet SHA-256 und pHash
und verwirft die Bytes sofort. Es wird nichts auf die Platte geschrieben und nichts
protokolliert. URLs stehen weder in den Rückgabeobjekten noch in Fehlermeldungen.
Audio wird nie geladen. Bei Videos, GIFs und sonstigen Medien wird keine Adresse angefragt,
die (vereinheitlicht verglichen) die der Mediendatei selbst ist oder auf eine Video- oder
Audiodatei endet. Ob eine andere Vorschauadresse wirklich ein Bild liefert, sieht erst der
Transport an den Kopfzeilen der Antwort.

Perzeptueller Hash (``phash_hex``), 64 Bit als 16 Hex-Zeichen:

1. Bild dekodieren (nur die Formate aus ``_BILDFORMATE``); bei animierten Bildern zählt das
   erste Bild. Die EXIF-Orientierung wird angewendet, damit ein gedreht gespeichertes Foto
   denselben Hash bekommt wie das aufrecht gespeicherte.
2. Graustufen. Transparente Bereiche werden vorher auf Weiß gelegt, weil die Farbwerte
   vollständig transparenter Pixel undefiniert sind und je nach Encoder variieren.
   16-Bit-Graustufen werden auf 8 Bit abgebildet (Wert / 257, gerundet). Beide Umrechnungen
   laufen streifenweise, damit große Bilder nicht mehrfach vollständig im Speicher liegen;
   die EXIF-Drehung wird erst auf das Graustufenbild angewendet. Am Ergebnis ändert beides
   nichts, weil die Umrechnung pixelweise ist.
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
import posixpath
import re
import string
from collections.abc import Callable, Mapping
from functools import cache
from typing import Any
from urllib.parse import unquote, urlsplit

import numpy as np
from PIL import ExifTags, Image

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
# Schutz vor Bildern, die klein komprimiert sind, aber beim Dekodieren riesig werden. Neben dem
# dekodierten Bild (bis 4 Byte je Pixel) entstehen nur ein bis zwei Graustufenbilder mit 1 Byte
# je Pixel, an der Grenze also rund 250 MB Spitze. Niedriger nicht, weil unbekannt ist, wie groß
# Truth Social Originale ausliefert; ohne pHash fiele das Medium aus Duplikat-Fall 4 heraus.
MAX_PIXEL = 40_000_000
# Höchstens so viele Pixel je Streifen bei der Umrechnung in Graustufen.
_STREIFEN_PIXEL = 1_000_000
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
# Felder mit Adressen der Mediendatei selbst (Mastodon: lokale Datei, Datei auf dem Herkunftsserver,
# Kurzlink, der auf die Datei weiterleitet). Keine davon darf als Vorschau eines Videos dienen.
_DATEI_FELDER = ("url", "remote_url", "text_url")
_DREHUNGEN = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_270,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_90,
}
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
    if not _ist_http(vorschau) or _ist_stromdatei(vorschau):
        return None
    if any(_gleiche_datei(vorschau, anhang.get(feld)) for feld in _DATEI_FELDER):
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


def _adresskern(url: str) -> tuple[str, str] | None:
    """Host und Pfad in Vergleichsform; ``None``, wenn sich die Adresse nicht zerlegen lässt.

    Schema, Port, Zugangsdaten, Query und Fragment zählen nicht, ebenso wenig Groß- und
    Kleinschreibung, Prozentkodierung, doppelte Schrägstriche, Punktsegmente und ein
    abschließender Schrägstrich. Lieber eine Vorschau zu viel verwerfen als eine Videodatei laden.
    """
    try:
        teile = urlsplit(url.strip())
        host = (teile.hostname or "").rstrip(".")
    except ValueError:
        return None
    pfad = re.sub(r"/{2,}", "/", "/" + unquote(teile.path))
    return host, posixpath.normpath(pfad).lower()


def _gleiche_datei(vorschau: str, andere: object) -> bool:
    if not isinstance(andere, str) or not andere.strip():
        return False
    a, b = _adresskern(vorschau), _adresskern(andere)
    if a is None or b is None:
        return False
    # Eine relative Adresse ohne Host meint denselben Server.
    return a[1] == b[1] and (a[0] == b[0] or not a[0] or not b[0])


def _ist_stromdatei(url: str) -> bool:
    kern = _adresskern(url)
    return kern is not None and kern[1].endswith(_STROM_ENDUNGEN)


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
            bild.load()
            grau = _graustufen(bild)
            drehung = _exif_drehung(bild)
            if drehung is not None:
                grau = grau.transpose(drehung)
            klein = grau.resize((_PHASH_KANTE, _PHASH_KANTE), Image.Resampling.LANCZOS)
            return np.asarray(klein, dtype=np.float64)
    except MedienFehler:
        raise
    except Exception:
        # Pillow wirft je nach Format und Defekt sehr verschiedene Ausnahmen. Die Ursache wird
        # nicht angehängt, damit nichts aus den Daten in Meldungen oder Tracebacks landet.
        raise MedienFehler("Bilddaten ließen sich nicht dekodieren.") from None


def _exif_drehung(bild: Image.Image) -> Image.Transpose | None:
    """Drehung bzw. Spiegelung laut EXIF-Orientierung (wie ``ImageOps.exif_transpose``)."""
    try:
        orientierung = bild.getexif().get(ExifTags.Base.Orientation)
    except Exception:
        # Kaputte EXIF-Daten: dann eben ungedreht, das Bild selbst kann trotzdem gültig sein.
        return None
    return _DREHUNGEN.get(orientierung) if isinstance(orientierung, int) else None


def _graustufen(bild: Image.Image) -> Image.Image:
    if bild.mode in _HOHE_BITTIEFE:
        return _streifenweise(bild, _sechzehn_bit_auf_l)
    if bild.has_transparency_data:
        return _streifenweise(bild, _auf_weiss_als_l)
    return bild.convert("L")


def _streifenweise(bild: Image.Image, umrechnen: Callable[[Image.Image], Image.Image]) -> Image.Image:
    """Rechnet ein Bild in waagrechten Streifen nach ``L`` um, damit Zwischenbilder klein bleiben."""
    breite, hoehe = bild.size
    zeilen = max(1, _STREIFEN_PIXEL // max(1, breite))
    if zeilen >= hoehe:
        return umrechnen(bild)
    grau = Image.new("L", bild.size)
    for oben in range(0, hoehe, zeilen):
        grau.paste(umrechnen(bild.crop((0, oben, breite, min(oben + zeilen, hoehe)))), (0, oben))
    return grau


def _sechzehn_bit_auf_l(bild: Image.Image) -> Image.Image:
    # Pillow schneidet beim Umwandeln nach "L" alles über 255 ab, statt zu skalieren. Ganzzahlig
    # gerechnet ist (x + 128) // 257 gleich round(x / 257), weil x / 257 nie auf ,5 endet.
    werte = np.asarray(bild).astype(np.int32)
    np.clip(werte, 0, 65535, out=werte)
    werte += 128
    werte //= 257
    return Image.fromarray(werte.astype(np.uint8))


def _auf_weiss_als_l(bild: Image.Image) -> Image.Image:
    rgba = bild.convert("RGBA")
    weiss = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(weiss, rgba).convert("L")
