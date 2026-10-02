"""Tests für medien.py: Medienarten, Metadaten, SHA-256, pHash und den Erfasser.

Alle Bilder entstehen im Test mit Pillow; geladen wird nichts aus dem Netz.
"""

from __future__ import annotations

import dataclasses
import io
import logging
import tempfile

import numpy as np
import pytest
from PIL import Image, PngImagePlugin

from conftest import finde_marker
from fabrik import BASIS, JETZT, MARKER, bild_png, medium
from truthtracker import db, medien
from truthtracker.medien import (
    MedienErfasser,
    MedienFehler,
    beschreibe,
    hamming,
    medien_art,
    phash_hex,
    sha256_hex,
)
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

# ---------------------------------------------------------------------------
# Hilfen


def _bild(daten: bytes) -> Image.Image:
    with Image.open(io.BytesIO(daten)) as bild:
        bild.load()
        return bild.copy()


def _kodiere(bild: Image.Image, format_: str, **optionen) -> bytes:
    puffer = io.BytesIO()
    bild.save(puffer, format=format_, **optionen)
    return puffer.getvalue()


def _jpeg(daten: bytes, qualitaet: int = 70, faktor: float = 1.0) -> bytes:
    bild = _bild(daten).convert("RGB")
    if faktor != 1.0:
        bild = bild.resize((round(bild.width * faktor), round(bild.height * faktor)), Image.Resampling.LANCZOS)
    return _kodiere(bild, "JPEG", quality=qualitaet)


def _verkleinert(daten: bytes, faktor: float = 0.5) -> bytes:
    bild = _bild(daten)
    groesse = (round(bild.width * faktor), round(bild.height * faktor))
    return _kodiere(bild.resize(groesse, Image.Resampling.LANCZOS), "PNG")


def _fotoaehnlich(saat: int, groesse: tuple[int, int] = (400, 300)) -> bytes:
    """Weiche Farbflächen wie in einem Foto: grobes Zufallsraster, glatt vergrößert."""
    raster = np.random.default_rng(saat).integers(0, 256, (6, 8, 3), dtype=np.uint8)
    return _kodiere(Image.fromarray(raster).resize(groesse, Image.Resampling.BICUBIC), "PNG")


def _png_mit_marker(saat: int) -> bytes:
    info = PngImagePlugin.PngInfo()
    info.add_text("Comment", f"{MARKER} Bildbeschreibung")
    return _kodiere(_bild(bild_png(saat)), "PNG", pnginfo=info)


def _referenz_phash(png: bytes) -> str:
    """Unabhängige Nachrechnung des dokumentierten Verfahrens mit der DCT-II-Summenformel."""
    pixel = np.asarray(_bild(png).convert("L").resize((32, 32), Image.Resampling.LANCZOS), dtype=np.float64)
    n = np.arange(32)
    koeffizienten = np.empty((8, 8))
    for u in range(8):
        for v in range(8):
            basis = np.outer(np.cos(np.pi * u * (2 * n + 1) / 64), np.cos(np.pi * v * (2 * n + 1) / 64))
            koeffizienten[u, v] = float((pixel * basis).sum())
    koeffizienten = np.round(koeffizienten, 6)
    median = np.median(koeffizienten)
    bits = "".join("1" if k > median else "0" for k in koeffizienten.flatten())
    return f"{int(bits, 2):016x}"


class Laden:
    """Protokollierender Ersatz für ``transport.hole_bytes``: URL → Bytes oder Ausnahme."""

    def __init__(self, antworten: dict[str, bytes | BaseException] | None = None, standard: bytes | None = None):
        self.antworten = antworten or {}
        self.standard = standard
        self.aufrufe: list[str] = []

    def __call__(self, url: str) -> bytes:
        self.aufrufe.append(url)
        antwort = self.antworten.get(url, self.standard)
        if isinstance(antwort, BaseException):
            raise antwort
        if antwort is None:
            raise AssertionError("Download einer URL, die der Test nicht vorgesehen hat")
        return antwort


class AbbruchImTest(Exception):
    """Steht für ``transport.Abbruch``: darf vom Erfasser nicht geschluckt werden."""


class Cache:
    def __init__(self) -> None:
        self.eintraege: dict[str, dict] = {}
        self.gespeichert: list[tuple] = []

    def holen(self, medien_id: str) -> dict | None:
        return self.eintraege.get(medien_id)

    def speichern(self, medien_id: str, art: str, sha256: str, phash: str | None, hash_quelle: str) -> None:
        self.gespeichert.append((medien_id, art, sha256, phash, hash_quelle))
        self.eintraege.setdefault(medien_id, {"sha256": sha256, "phash": phash, "hash_quelle": hash_quelle})


_VERBOTEN = ("http", "truthsocial", "/media/", ".png", ".mp4", ".jpg", MARKER)


def _texte(daten: MedienDaten) -> list[str]:
    return [str(wert) for wert in dataclasses.asdict(daten).values()] + [repr(daten)]


def _video(dauer: float = 12.5) -> dict:
    anhang = medium("video", breite=1280, hoehe=720, dauer=dauer)
    anhang["url"] = f"{BASIS}/media/original/clip-{anhang['id']}.mp4"
    return anhang


# ---------------------------------------------------------------------------
# SHA-256 und Hamming


def test_sha256_stabil():
    assert sha256_hex(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    png = bild_png(1)
    assert sha256_hex(png) == sha256_hex(bytes(png))
    assert sha256_hex(png) != sha256_hex(bild_png(2))


def test_hamming():
    assert hamming("0000000000000000", "0000000000000000") == 0
    assert hamming("ffffffffffffffff", "0000000000000000") == 64
    assert hamming("8000000000000001", "0000000000000000") == 2
    assert hamming("ABCDEF0123456789", "abcdef0123456789") == 0
    with pytest.raises(ValueError):
        hamming("00", "0000")


# ---------------------------------------------------------------------------
# pHash


def test_phash_format_und_gleiches_bild_abstand_null():
    png = bild_png(3)
    wert = phash_hex(png)
    assert len(wert) == 16 and set(wert) <= set("0123456789abcdef")
    assert phash_hex(png) == wert
    # Dieselben Pixel, nur anders komprimiert: identischer Hash.
    assert hamming(phash_hex(_kodiere(_bild(png), "PNG", compress_level=1)), wert) == 0


def test_phash_entspricht_dokumentiertem_verfahren():
    for png in (bild_png(0), bild_png(4), _fotoaehnlich(2)):
        assert phash_hex(png) == _referenz_phash(png)


def test_phash_einfarbig_ist_rechnerunabhaengig():
    # Alle Wechselanteile sind 0; nur der Gleichanteil liegt über dem Median. Ohne Runden
    # entschiede hier Gleitkomma-Rauschen über die Bits.
    for farbe in ((120, 120, 120), (255, 255, 255), (10, 200, 30)):
        assert phash_hex(_kodiere(Image.new("RGB", (50, 30), farbe), "PNG")) == "8000000000000000"
    assert phash_hex(_kodiere(Image.new("RGB", (50, 30), (0, 0, 0)), "PNG")) == "0000000000000000"


@pytest.mark.parametrize("saat", range(5))
def test_phash_jpeg_qualitaet_70_bleibt_nah(saat):
    png = bild_png(saat)
    assert hamming(phash_hex(png), phash_hex(_jpeg(png, 70))) <= 6


@pytest.mark.parametrize("saat", range(5))
def test_phash_halbe_groesse_bleibt_nah(saat):
    png = bild_png(saat)
    assert hamming(phash_hex(png), phash_hex(_verkleinert(png, 0.5))) <= 6


@pytest.mark.parametrize("saat", range(3))
def test_phash_fotoaehnlich_neu_kodiert_und_verkleinert(saat):
    png = _fotoaehnlich(saat)
    assert hamming(phash_hex(png), phash_hex(_jpeg(png, 70, faktor=0.5))) <= 6


def test_phash_voellig_anderes_bild_weit_weg():
    assert hamming(phash_hex(bild_png(0)), phash_hex(_fotoaehnlich(1))) > 10
    assert hamming(phash_hex(bild_png(0)), phash_hex(bild_png(3))) > 10
    assert hamming(phash_hex(_fotoaehnlich(0)), phash_hex(_fotoaehnlich(1))) > 10


def test_phash_png_mit_alpha():
    rgb = _bild(bild_png(2))
    deckend = rgb.copy()
    deckend.putalpha(255)
    assert phash_hex(_kodiere(deckend, "PNG")) == phash_hex(_kodiere(rgb, "PNG"))

    # Linke Hälfte durchsichtig. Was "unter" der Transparenz steht, darf keine Rolle spielen.
    alpha = Image.new("L", rgb.size, 255)
    alpha.paste(0, (0, 0, rgb.width // 2, rgb.height))
    a = rgb.copy()
    a.putalpha(alpha)
    b = rgb.copy()
    b.paste((0, 0, 0), (0, 0, rgb.width // 2, rgb.height))
    b.putalpha(alpha)
    assert phash_hex(_kodiere(a, "PNG")) == phash_hex(_kodiere(b, "PNG"))
    # Transparenz liegt auf Weiß: wie dasselbe Bild mit weißer linker Hälfte.
    weiss = rgb.copy()
    weiss.paste((255, 255, 255), (0, 0, rgb.width // 2, rgb.height))
    assert phash_hex(_kodiere(a, "PNG")) == phash_hex(_kodiere(weiss, "PNG"))


def test_phash_graustufen():
    rgb = _bild(bild_png(1))
    grau = rgb.convert("L")
    assert phash_hex(_kodiere(grau, "PNG")) == phash_hex(_kodiere(rgb, "PNG"))
    assert phash_hex(_kodiere(grau.convert("LA"), "PNG")) == phash_hex(_kodiere(rgb, "PNG"))
    # 16-Bit-Graustufen: dieselben Helligkeiten, nur feiner aufgelöst.
    tief = np.asarray(grau, dtype=np.uint16) * 257
    sechzehn_bit = _kodiere(Image.fromarray(tief), "PNG")
    assert _bild(sechzehn_bit).mode.startswith("I")
    assert phash_hex(sechzehn_bit) == phash_hex(_kodiere(grau, "PNG"))


def test_phash_animiertes_gif_nimmt_erstes_bild():
    erstes = _bild(bild_png(0))
    zweites = _bild(_fotoaehnlich(1, erstes.size))
    gif = _kodiere(erstes, "GIF", save_all=True, append_images=[zweites], duration=100, loop=0)
    with Image.open(io.BytesIO(gif)) as pruefung:
        assert pruefung.n_frames == 2
    wert = phash_hex(gif)
    assert hamming(wert, phash_hex(bild_png(0))) <= 6
    assert hamming(wert, phash_hex(_kodiere(zweites, "PNG"))) > 10


def test_phash_wendet_exif_orientierung_an():
    aufrecht = _bild(bild_png(1))
    # Orientierung 6: gespeichert um 90° gegen den Uhrzeigersinn gedreht, Anzeige dreht zurück.
    gespeichert = aufrecht.transpose(Image.Transpose.ROTATE_90)
    exif = Image.Exif()
    exif[0x0112] = 6
    mit_exif = _kodiere(gespeichert, "JPEG", quality=95, exif=exif)
    ohne_exif = _kodiere(gespeichert, "JPEG", quality=95)
    referenz = phash_hex(bild_png(1))
    assert hamming(phash_hex(mit_exif), referenz) <= 6
    assert hamming(phash_hex(ohne_exif), referenz) > 10


@pytest.mark.parametrize(
    "daten",
    [
        b"",
        b"kein Bild " + MARKER.encode(),
        bild_png(1)[:60],
        bytes(range(256)) * 4,
        b"<!DOCTYPE html><html><body>" + MARKER.encode() + b"</body></html>",
        b"%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n" + MARKER.encode(),
    ],
    ids=["leer", "text", "abgeschnitten", "zufall", "html", "eps"],
)
def test_phash_kaputte_daten_ergeben_medienfehler(daten):
    with pytest.raises(MedienFehler) as info:
        phash_hex(daten)
    assert MARKER not in str(info.value)
    assert info.value.__cause__ is None and info.value.__suppress_context__


@pytest.mark.parametrize(("format_", "optionen"), [("WEBP", {"lossless": True}), ("BMP", {}), ("MPO", {})])
def test_phash_gaengige_bildformate(format_, optionen):
    rgb = _bild(bild_png(1)).convert("RGB")
    assert hamming(phash_hex(_kodiere(rgb, format_, **optionen)), phash_hex(bild_png(1))) <= 6


@pytest.mark.parametrize("format_", ["PPM", "TIFF"])
def test_phash_oeffnet_nur_erlaubte_bildformate(format_):
    daten = _kodiere(_bild(bild_png(1)), format_)
    assert _bild(daten).size == (64, 48)  # Pillow selbst könnte es öffnen
    with pytest.raises(MedienFehler):
        phash_hex(daten)


def test_phash_zu_viele_pixel(monkeypatch):
    monkeypatch.setattr(medien, "MAX_PIXEL", 100)
    with pytest.raises(MedienFehler):
        phash_hex(bild_png(1))


# ---------------------------------------------------------------------------
# Medienart und Metadaten


@pytest.mark.parametrize(
    ("api_typ", "art"),
    [
        ("image", MEDIUM_BILD),
        ("video", MEDIUM_VIDEO),
        ("tv", MEDIUM_VIDEO),
        ("gifv", MEDIUM_GIF),
        ("audio", MEDIUM_AUDIO),
        ("IMAGE", MEDIUM_BILD),
        ("unknown", MEDIUM_SONSTIG),
        ("", MEDIUM_SONSTIG),
        (None, MEDIUM_SONSTIG),
        (5, MEDIUM_SONSTIG),
    ],
)
def test_medien_art(api_typ, art):
    assert medien_art(api_typ) == art


def test_beschreibe_bild():
    daten = beschreibe(medium("image", medien_id="114000000000000001", breite=1200, hoehe=800), 2)
    assert daten == MedienDaten(
        position=2, medien_id="114000000000000001", art=MEDIUM_BILD, breite=1200, hoehe=800, hash_status=HASH_OFFEN
    )


def test_beschreibe_video_mit_dauer():
    daten = beschreibe(_video(dauer=12.5), 0)
    assert (daten.art, daten.breite, daten.hoehe, daten.dauer_s) == (MEDIUM_VIDEO, 1280, 720, 12.5)
    assert daten.hash_status == HASH_OFFEN and daten.sha256 is None and daten.hash_quelle is None


def test_beschreibe_medien_id_nur_echte_ids():
    anhang = medium("image")
    anhang["id"] = 114000000000000777
    assert beschreibe(anhang, 0).medien_id == "114000000000000777"
    for kein_id in (None, "", True, f"{BASIS}/media/original/x.png", "a" * 65, 3.5):
        anhang["id"] = kein_id
        assert beschreibe(anhang, 0).medien_id is None


@pytest.mark.parametrize(
    ("original", "erwartet"),
    [
        ({"width": "1200", "height": "800", "duration": "3.5"}, (1200, 800, 3.5)),
        ({"width": 1199.6, "height": 800.2}, (1200, 800, None)),
        ({"width": "abc", "height": 800}, (None, None, None)),
        ({"width": -5, "height": 800}, (None, None, None)),
        ({"width": True, "height": 800}, (None, None, None)),
        ({"width": 0, "height": 0, "size": "640x360"}, (640, 360, None)),
        ({"size": "640x"}, (None, None, None)),
        ({"duration": "nan"}, (None, None, None)),
        ({"duration": float("inf")}, (None, None, None)),
        ({"duration": -1}, (None, None, None)),
        ({"duration": None, "length": "0:01:02.50"}, (None, None, 62.5)),
        ({"length": "01:02"}, (None, None, 62.0)),
        ({"length": "kaputt"}, (None, None, None)),
        ({"width": 10**12, "height": 800}, (None, None, None)),
    ],
)
def test_beschreibe_robust_gegen_kaputte_metadaten(original, erwartet):
    anhang = medium("video")
    anhang["meta"] = {"original": original}
    daten = beschreibe(anhang, 0)
    assert (daten.breite, daten.hoehe, daten.dauer_s) == erwartet


@pytest.mark.parametrize("meta", [None, {}, {"original": None}, {"original": "1200x800"}, "kaputt"])
def test_beschreibe_ohne_meta(meta):
    anhang = medium("image")
    anhang["meta"] = meta
    daten = beschreibe(anhang, 0)
    assert (daten.breite, daten.hoehe, daten.dauer_s) == (None, None, None)
    assert daten.hash_status == HASH_OFFEN


def test_beschreibe_audio_und_medien_ohne_quelle_uebersprungen():
    assert beschreibe(medium("audio"), 0).hash_status == HASH_UEBERSPRUNGEN

    video = _video()
    video["preview_url"] = None
    assert beschreibe(video, 0).hash_status == HASH_UEBERSPRUNGEN

    bild = medium("image")
    bild["url"] = "data:image/png;base64,AAAA"
    bild["preview_url"] = "ftp://example.com/a.png"
    assert beschreibe(bild, 0).hash_status == HASH_UEBERSPRUNGEN

    kaputt = beschreibe(None, 3)  # type: ignore[arg-type]
    assert (kaputt.position, kaputt.art, kaputt.hash_status) == (3, MEDIUM_SONSTIG, HASH_UEBERSPRUNGEN)


# ---------------------------------------------------------------------------
# Erfasser


def test_bild_nutzt_original_url():
    anhang = medium("image")
    png = bild_png(5)
    laden = Laden({anhang["url"]: png})
    erfasser = MedienErfasser(laden)
    daten = erfasser.erfasse(anhang, 0)
    assert laden.aufrufe == [anhang["url"]]
    assert (daten.sha256, daten.phash) == (sha256_hex(png), phash_hex(png))
    assert (daten.hash_quelle, daten.hash_status) == ("original", HASH_OK)
    assert (erfasser.downloads, erfasser.cache_treffer, erfasser.fehler) == (1, 0, 0)


@pytest.mark.parametrize("url", [None, "", "data:image/png;base64,AAAA", "/media/relativ.png"])
def test_bild_ohne_original_nutzt_vorschau(url):
    anhang = medium("image")
    anhang["url"] = url
    laden = Laden({anhang["preview_url"]: bild_png(6)})
    daten = MedienErfasser(laden).erfasse(anhang, 0)
    assert laden.aufrufe == [anhang["preview_url"]]
    assert (daten.hash_quelle, daten.hash_status) == ("vorschau", HASH_OK)


@pytest.mark.parametrize("api_typ", ["video", "tv", "gifv", "unknown"])
def test_video_gif_sonstig_laden_nur_das_vorschaubild(api_typ):
    anhang = _video()
    anhang["type"] = api_typ
    png = bild_png(7)
    laden = Laden({anhang["preview_url"]: png, anhang["url"]: AssertionError("Videodatei geladen")})
    daten = MedienErfasser(laden).erfasse(anhang, 1)
    assert laden.aufrufe == [anhang["preview_url"]]
    assert anhang["url"] not in laden.aufrufe
    assert (daten.sha256, daten.phash, daten.hash_quelle) == (sha256_hex(png), phash_hex(png), "vorschau")
    assert daten.hash_status == HASH_OK


@pytest.mark.parametrize("vorschau", [None, "same", f"{BASIS}/media/small/clip.mp4", f"{BASIS}/media/small/x.webm?v=1"])
def test_video_ohne_brauchbares_vorschaubild_ohne_download(vorschau):
    anhang = _video()
    anhang["preview_url"] = anhang["url"] if vorschau == "same" else vorschau
    laden = Laden()
    erfasser = MedienErfasser(laden)
    daten = erfasser.erfasse(anhang, 0)
    assert laden.aufrufe == []
    assert daten.hash_status == HASH_UEBERSPRUNGEN and daten.sha256 is None
    assert (erfasser.downloads, erfasser.fehler) == (0, 0)
    assert (daten.breite, daten.hoehe, daten.dauer_s) == (1280, 720, 12.5)


def test_audio_ohne_download():
    laden = Laden()
    erfasser = MedienErfasser(laden)
    daten = erfasser.erfasse(medium("audio", dauer=30.0), 0)
    assert laden.aufrufe == []
    assert (daten.art, daten.hash_status, daten.sha256, daten.dauer_s) == (MEDIUM_AUDIO, HASH_UEBERSPRUNGEN, None, 30.0)
    assert erfasser.downloads == 0


def test_cache_treffer_ohne_download():
    anhang = medium("image")
    cache = Cache()
    cache.eintraege[anhang["id"]] = {"sha256": "a" * 64, "phash": "0123456789abcdef", "hash_quelle": "original"}
    laden = Laden()
    erfasser = MedienErfasser(laden, cache_holen=cache.holen, cache_speichern=cache.speichern)
    daten = erfasser.erfasse(anhang, 0)
    assert laden.aufrufe == []
    assert (daten.sha256, daten.phash, daten.hash_quelle, daten.hash_status) == (
        "a" * 64, "0123456789abcdef", "original", HASH_OK
    )
    assert (erfasser.downloads, erfasser.cache_treffer) == (0, 1)
    assert cache.gespeichert == []


def test_cache_eintrag_wird_normalisiert():
    anhang = medium("image")
    cache = Cache()
    cache.eintraege[anhang["id"]] = {"sha256": "A" * 64, "phash": "kaputt", "hash_quelle": None}
    daten = MedienErfasser(Laden(), cache_holen=cache.holen).erfasse(anhang, 0)
    assert (daten.sha256, daten.phash, daten.hash_quelle) == ("a" * 64, None, "original")


def test_cache_eintrag_ohne_gueltigen_sha256_wird_neu_geladen():
    anhang = medium("image")
    cache = Cache()
    cache.eintraege[anhang["id"]] = {"sha256": "0x" + "a" * 62, "phash": None, "hash_quelle": "original"}
    laden = Laden({anhang["url"]: bild_png(1)})
    daten = MedienErfasser(laden, cache_holen=cache.holen).erfasse(anhang, 0)
    assert laden.aufrufe == [anhang["url"]]
    assert daten.sha256 == sha256_hex(bild_png(1))


def test_ergebnis_landet_im_cache_und_wird_wiederverwendet():
    anhang = medium("image")
    png = bild_png(2)
    cache = Cache()
    laden = Laden({anhang["url"]: png})
    erfasser = MedienErfasser(laden, cache_holen=cache.holen, cache_speichern=cache.speichern)
    erfasser.erfasse(anhang, 0)
    assert cache.gespeichert == [(anhang["id"], MEDIUM_BILD, sha256_hex(png), phash_hex(png), "original")]

    zweiter = MedienErfasser(Laden(), cache_holen=cache.holen, cache_speichern=cache.speichern)
    daten = zweiter.erfasse(anhang, 0)
    assert (daten.sha256, daten.hash_status, zweiter.cache_treffer, zweiter.downloads) == (
        sha256_hex(png), HASH_OK, 1, 0
    )


def test_cache_ueber_die_datenbank(tmp_path):
    con = db.oeffne(tmp_path / "medien.sqlite")
    try:
        anhang = medium("image")
        png = bild_png(4)

        def speichern(medien_id, art, sha256, phash, hash_quelle):
            db.medien_cache_speichern(con, medien_id, art, sha256, phash, hash_quelle, JETZT)

        erster = MedienErfasser(
            Laden({anhang["url"]: png}), cache_holen=lambda m: db.medien_cache_holen(con, m), cache_speichern=speichern
        )
        assert erster.erfasse(anhang, 0).hash_status == HASH_OK
        zweiter = MedienErfasser(Laden(), cache_holen=lambda m: db.medien_cache_holen(con, m))
        daten = zweiter.erfasse(anhang, 0)
        assert (daten.sha256, daten.phash, daten.hash_quelle) == (sha256_hex(png), phash_hex(png), "original")
        assert (zweiter.downloads, zweiter.cache_treffer) == (0, 1)
    finally:
        con.close()


def test_gleiches_medium_im_lauf_nur_einmal_geladen():
    anhang = medium("image")
    laden = Laden({anhang["url"]: bild_png(3)})
    erfasser = MedienErfasser(laden)
    erstes = erfasser.erfasse(anhang, 0)
    zweites = erfasser.erfasse(dict(anhang), 1)
    assert laden.aufrufe == [anhang["url"]]
    assert (erstes.sha256, erstes.phash) == (zweites.sha256, zweites.phash)
    assert (zweites.position, erfasser.downloads, erfasser.cache_treffer) == (1, 1, 1)


def test_downloadfehler_ergibt_fehler_und_lauf_geht_weiter():
    kaputt, gut = medium("image"), medium("image")
    cache = Cache()
    laden = Laden({kaputt["url"]: MedienFehler("Medien-Download gescheitert (HTTP 500)."), gut["url"]: bild_png(4)})
    erfasser = MedienErfasser(laden, cache_holen=cache.holen, cache_speichern=cache.speichern)
    daten = erfasser.erfasse(kaputt, 0)
    assert (daten.hash_status, daten.sha256, daten.phash, daten.hash_quelle) == (HASH_FEHLER, None, None, None)
    assert erfasser.erfasse(gut, 1).hash_status == HASH_OK
    assert (erfasser.downloads, erfasser.fehler) == (2, 1)
    assert [g[0] for g in cache.gespeichert] == [gut["id"]]


def test_fremde_ausnahme_wird_durchgereicht():
    anhang = medium("image")
    cache = Cache()
    erfasser = MedienErfasser(
        Laden({anhang["url"]: AbbruchImTest("Cloudflare")}), cache_holen=cache.holen, cache_speichern=cache.speichern
    )
    with pytest.raises(AbbruchImTest):
        erfasser.erfasse(anhang, 0)
    assert (erfasser.downloads, erfasser.fehler, cache.gespeichert) == (1, 0, [])


def test_zu_grosse_antwort_ergibt_fehler():
    anhang = medium("image")
    png = bild_png(1)
    cache = Cache()
    erfasser = MedienErfasser(
        Laden({anhang["url"]: png}), cache_holen=cache.holen, cache_speichern=cache.speichern, max_bytes=len(png) - 1
    )
    daten = erfasser.erfasse(anhang, 0)
    assert (daten.hash_status, daten.sha256, erfasser.fehler, cache.gespeichert) == (HASH_FEHLER, None, 1, [])

    passend = MedienErfasser(Laden({anhang["url"]: png}), max_bytes=len(png))
    assert passend.erfasse(anhang, 0).hash_status == HASH_OK


@pytest.mark.parametrize(
    "antwort",
    [
        b"",
        b"\n  <!DOCTYPE html><title>Just a moment...</title>",
        b'{"error": "Record not found"}',
        b"\xef\xbb\xbf<html>",
    ],
    ids=["leer", "html", "json", "bom-html"],
)
def test_leere_oder_text_antwort_ergibt_fehler(antwort):
    anhang = medium("image")
    erfasser = MedienErfasser(Laden({anhang["url"]: antwort}))
    daten = erfasser.erfasse(anhang, 0)
    assert (daten.hash_status, daten.sha256, erfasser.fehler) == (HASH_FEHLER, None, 1)


def test_nicht_dekodierbares_bild_behaelt_sha256_ohne_phash():
    anhang = medium("image")
    roh = bytes(range(256)) * 8
    cache = Cache()
    erfasser = MedienErfasser(Laden({anhang["url"]: roh}), cache_holen=cache.holen, cache_speichern=cache.speichern)
    daten = erfasser.erfasse(anhang, 0)
    assert (daten.hash_status, daten.sha256, daten.phash) == (HASH_OK, sha256_hex(roh), None)
    assert erfasser.fehler == 0
    assert cache.gespeichert == [(anhang["id"], MEDIUM_BILD, sha256_hex(roh), None, "original")]


def test_bytearray_wird_akzeptiert_anderer_typ_ist_programmierfehler():
    anhang = medium("image")
    png = bild_png(1)
    assert MedienErfasser(Laden({anhang["url"]: bytearray(png)})).erfasse(anhang, 0).sha256 == sha256_hex(png)
    with pytest.raises(TypeError) as info:
        MedienErfasser(lambda url: url).erfasse(anhang, 0)  # type: ignore[arg-type, return-value]
    assert "http" not in str(info.value)


def test_max_bytes_muss_positiv_sein():
    with pytest.raises(ValueError):
        MedienErfasser(Laden(), max_bytes=0)


def test_keine_url_und_kein_inhalt_in_rueckgabe_logs_und_ausgabe(caplog, capsys):
    caplog.set_level(logging.DEBUG)
    bild, video, audio, kaputt, gross = medium("image"), _video(), medium("audio"), medium("image"), medium("image")
    pngs = [_png_mit_marker(1), _png_mit_marker(2)]
    grenze = max(len(p) for p in pngs)
    laden = Laden(
        {
            bild["url"]: pngs[0],
            video["preview_url"]: pngs[1],
            kaputt["url"]: MedienFehler("Medien-Download gescheitert."),
            gross["url"]: b"\x89PNG" + b"\x00" * grenze,
        }
    )
    erfasser = MedienErfasser(laden, max_bytes=grenze)
    ergebnisse = [erfasser.erfasse(a, i) for i, a in enumerate((bild, video, audio, kaputt, gross))]
    assert [e.hash_status for e in ergebnisse] == [HASH_OK, HASH_OK, HASH_UEBERSPRUNGEN, HASH_FEHLER, HASH_FEHLER]
    for daten in ergebnisse:
        for text in _texte(daten):
            assert not any(verboten in text for verboten in _VERBOTEN), text
    ausgabe = capsys.readouterr()
    protokoll = caplog.text + ausgabe.out + ausgabe.err
    assert not any(verboten in protokoll for verboten in _VERBOTEN)


def test_schreibt_keine_dateien_und_haelt_keine_bytes(tmp_path, monkeypatch):
    arbeit = tmp_path / "arbeit"
    temp = tmp_path / "temp"
    arbeit.mkdir()
    temp.mkdir()
    monkeypatch.chdir(arbeit)
    monkeypatch.setattr(tempfile, "tempdir", str(temp))
    anhaenge = [medium("image"), _video(), medium("gifv")]
    quellen = [a["url"] if a["type"] == "image" else a["preview_url"] for a in anhaenge]
    laden = Laden({url: _png_mit_marker(i) for i, url in enumerate(quellen)})
    erfasser = MedienErfasser(laden)
    for i, anhang in enumerate(anhaenge):
        assert erfasser.erfasse(anhang, i).hash_status == HASH_OK
    assert list(arbeit.iterdir()) == [] and list(temp.iterdir()) == []
    assert finde_marker(tmp_path) == []
    assert not any(isinstance(wert, (bytes, bytearray, memoryview)) for wert in vars(erfasser).values())
    for gemerkt in vars(erfasser)["_gemerkt"].values():
        assert all(wert is None or isinstance(wert, str) for wert in gemerkt)
