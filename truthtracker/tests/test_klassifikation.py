"""Tests für klassifikation.py: Typ, Format, Medien, Fingerabdruck, Zähler, Quell-Konten, Robustheit.

Alle API-Objekte stammen aus tests/fabrik.py (synthetisch, Marker ``SYNTHETIK``).
"""

from __future__ import annotations

import copy
import dataclasses
import hashlib
from datetime import timedelta
from typing import Any

import pytest
from fabrik import BASIS, JETZT, MARKER, TRUMP_ID, bild_png, karte, konto, medium, retruth, status

from truthtracker import medien
from truthtracker.klassifikation import (
    beschreibe_anhang,
    bestimme_format,
    extrahiere,
    ist_werbung,
    zaehler_aus,
)
from truthtracker.modelle import (
    FORMAT_LEER,
    FORMAT_MEDIEN_TEXT,
    FORMAT_NUR_LINK,
    FORMAT_NUR_MEDIEN,
    FORMAT_NUR_TEXT,
    FORMAT_TEXT_LINK,
    FORMATE,
    HASH_FEHLER,
    HASH_OFFEN,
    HASH_OK,
    HASH_UEBERSPRUNGEN,
    MEDIUM_AUDIO,
    MEDIUM_BILD,
    MEDIUM_GIF,
    MEDIUM_SONSTIG,
    MEDIUM_VIDEO,
    REPLY_FREMD,
    REPLY_THREAD,
    ROLLE_QUOTE,
    ROLLE_REPLY,
    ROLLE_RETRUTH,
    TYP_EIGEN,
    TYP_RETRUTH,
    TYP_SELBST_RETRUTH,
    MedienDaten,
    PostDaten,
    QuellKonto,
    Zaehler,
)

FREMD_ID = "108000000000000555"
ANDERER_ID = "108000000000000777"
FREMD = konto(FREMD_ID, "jemand", "Jemand Fremdes", verifiziert=False, follower=1234)
ANDERER = konto(ANDERER_ID, "anderer", "Ein Anderer", verifiziert=True, follower=-1)
ARTIKEL = "https://www.example.com/artikel/zur/sache"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def link(url: str) -> str:
    return (
        f'<a href="{url}" rel="nofollow noopener noreferrer" target="_blank">'
        f'<span class="invisible">{url[:8]}</span><span class="ellipsis">{url[8:30]}</span>'
        f'<span class="invisible">{url[30:]}</span></a>'
    )


def erwaehnung(konto_id: str, handle: str) -> dict[str, Any]:
    return {"id": konto_id, "username": handle, "acct": handle, "url": f"{BASIS}/@{handle}"}


class FakeErfasser:
    """Hasht nichts wirklich: Der SHA-256 ergibt sich aus dem Dateinamen, Fehler nach Medien-ID."""

    def __init__(self, fehler_ids: tuple[str, ...] = ()) -> None:
        self.fehler_ids = set(fehler_ids)
        self.aufrufe: list[tuple[str | None, int]] = []

    def erfasse(self, anhang: dict, position: int) -> MedienDaten:
        daten = beschreibe_anhang(anhang, position)
        self.aufrufe.append((daten.medien_id, position))
        if daten.hash_status == HASH_UEBERSPRUNGEN:
            return daten
        if daten.medien_id in self.fehler_ids:
            daten.hash_status = HASH_FEHLER
            return daten
        quelle = anhang.get("url") if daten.art == MEDIUM_BILD else anhang.get("preview_url")
        daten.sha256 = sha(str(quelle).rsplit("/", 1)[-1])
        daten.phash = "0" * 16
        daten.hash_quelle = "original" if daten.art == MEDIUM_BILD else "vorschau"
        daten.hash_status = HASH_OK
        return daten


def ex(s: dict[str, Any], **optionen: Any) -> PostDaten:
    return extrahiere(s, trump_id=TRUMP_ID, **optionen)


# ---------------------------------------------------------------------------
# Typ


def test_eigener_post():
    s = status(JETZT)
    p = ex(s)
    assert p.typ == TYP_EIGEN and p.typ_detail == TYP_EIGEN
    assert p.id == s["id"] and p.inhalts_id == s["id"]
    assert p.url == s["url"]
    assert p.created_at == JETZT
    assert not p.ist_quote and not p.ist_reply and not p.ist_retruth
    assert p.original_id is None and p.original_created_at is None and p.retruth_latenz_s is None
    assert p.zaehler_original is None
    assert p.quellen == []
    assert p.sichtbarkeit == "public"


def test_retruth():
    original = status(JETZT - timedelta(hours=2, milliseconds=600), autor=FREMD, zaehler=(1, 2, 3))
    r = retruth(JETZT, original, zaehler=(4, 5, 6))
    p = ex(r)
    assert p.typ == TYP_RETRUTH and p.typ_detail == TYP_RETRUTH and p.ist_retruth
    assert p.id == r["id"]
    assert p.original_id == original["id"] and p.inhalts_id == original["id"]
    assert p.original_created_at == JETZT - timedelta(hours=2, milliseconds=600)
    assert p.retruth_latenz_s == 7201
    assert p.url == original["url"]
    assert (p.zaehler.replies, p.zaehler.retruths, p.zaehler.likes) == (4, 5, 6)
    assert p.zaehler_original is not None
    assert (p.zaehler_original.replies, p.zaehler_original.retruths, p.zaehler_original.likes) == (1, 2, 3)
    assert p.quellen == [
        QuellKonto(
            rolle=ROLLE_RETRUTH, konto_id=FREMD_ID, handle="jemand", anzeigename="Jemand Fremdes",
            verifiziert=False, follower=1234, ist_trump=False,
        )
    ]


def test_selbst_retruth():
    original = status(JETZT - timedelta(days=3))
    p = ex(retruth(JETZT, original))
    assert p.typ == TYP_SELBST_RETRUTH and p.typ_detail == TYP_SELBST_RETRUTH
    assert p.retruth_latenz_s == 3 * 86400
    assert p.quellen[0].rolle == ROLLE_RETRUTH and p.quellen[0].ist_trump
    assert p.quellen[0].konto_id == TRUMP_ID and p.quellen[0].follower == 11_000_000


def test_retruth_latenz_negativ_wird_gespeichert():
    original = status(JETZT + timedelta(seconds=30), autor=FREMD)
    assert ex(retruth(JETZT, original)).retruth_latenz_s == -30


def test_retruth_ohne_original_zeit():
    original = status(JETZT - timedelta(hours=1), autor=FREMD)
    original["created_at"] = None
    p = ex(retruth(JETZT, original))
    assert p.typ == TYP_RETRUTH and p.original_created_at is None and p.retruth_latenz_s is None


def test_leeres_reblog_objekt_ist_kein_retruth():
    s = status(JETZT)
    s["reblog"] = {}
    assert ex(s).typ == TYP_EIGEN


def test_quote_mit_eingebettetem_original():
    zitiert = status(JETZT - timedelta(days=1), autor=FREMD)
    p = ex(status(JETZT, quote=zitiert))
    assert p.typ == TYP_EIGEN and p.ist_quote and p.typ_detail == "quote"
    assert p.quote_id == zitiert["id"]
    assert p.quellen == [
        QuellKonto(
            rolle=ROLLE_QUOTE, konto_id=FREMD_ID, handle="jemand", anzeigename="Jemand Fremdes",
            verifiziert=False, follower=1234, ist_trump=False,
        )
    ]


def test_quote_nur_mit_quote_id():
    s = status(JETZT)
    s["quote_id"] = "114000000000009999"
    p = ex(s)
    assert p.ist_quote and p.quote_id == "114000000000009999"
    assert p.quellen == [QuellKonto(rolle=ROLLE_QUOTE, konto_id=None)]


def test_quote_nur_eingebettet_ohne_quote_id():
    zitiert = status(JETZT - timedelta(days=1), autor=ANDERER)
    s = status(JETZT, quote=zitiert)
    s["quote_id"] = None
    p = ex(s)
    assert p.ist_quote and p.quote_id == zitiert["id"]
    assert p.quellen[0].konto_id == ANDERER_ID
    assert p.quellen[0].follower is None  # -1 ist ein Platzhalter


def test_reply_thread():
    p = ex(status(JETZT, antwort_auf=("114000000000000123", TRUMP_ID)))
    assert p.ist_reply and p.reply_art == REPLY_THREAD and p.typ_detail == "reply_thread"
    assert p.typ == TYP_EIGEN
    assert p.in_reply_to_id == "114000000000000123"
    assert p.quellen == [QuellKonto(rolle=ROLLE_REPLY, konto_id=TRUMP_ID, ist_trump=True)]


def test_reply_thread_mit_eingebettetem_ziel():
    ziel = status(JETZT - timedelta(minutes=5))
    p = ex(status(JETZT, antwort_auf_status=ziel))
    assert p.reply_art == REPLY_THREAD
    assert p.quellen[0].handle == "realDonaldTrump" and p.quellen[0].ist_trump
    assert p.quellen[0].follower == 11_000_000


def test_reply_fremd_mit_handle_aus_mentions():
    s = status(
        JETZT,
        antwort_auf=("114000000000000123", FREMD_ID),
        erwaehnungen=[erwaehnung("-99", "platzhalter"), erwaehnung(FREMD_ID, "jemand")],
    )
    p = ex(s)
    assert p.reply_art == REPLY_FREMD and p.typ_detail == "reply_fremd"
    assert p.quellen == [QuellKonto(rolle=ROLLE_REPLY, konto_id=FREMD_ID, handle="jemand", ist_trump=False)]


def test_reply_fremd_platzhalter_wird_nie_konto():
    s = status(JETZT, antwort_auf=("114000000000000123", "-99"), erwaehnungen=[erwaehnung("-99", "platzhalter")])
    p = ex(s)
    assert p.ist_reply and p.reply_art == REPLY_FREMD
    assert p.quellen == [QuellKonto(rolle=ROLLE_REPLY, konto_id=None)]


def test_reply_fremd_mit_eingebettetem_ziel():
    ziel = status(JETZT - timedelta(hours=1), autor=FREMD)
    p = ex(status(JETZT, antwort_auf_status=ziel))
    assert p.reply_art == REPLY_FREMD
    assert p.quellen[0] == QuellKonto(
        rolle=ROLLE_REPLY, konto_id=FREMD_ID, handle="jemand", anzeigename="Jemand Fremdes",
        verifiziert=False, follower=1234, ist_trump=False,
    )


def test_reply_ohne_konto_id_ist_fremd():
    s = status(JETZT, antwort_auf=("114000000000000123", TRUMP_ID))
    s["in_reply_to_account_id"] = None
    p = ex(s)
    assert p.reply_art == REPLY_FREMD
    assert p.quellen == [QuellKonto(rolle=ROLLE_REPLY, konto_id=None)]


def test_retruth_eines_quotes():
    zitiert = status(JETZT - timedelta(days=2), autor=ANDERER)
    original = status(JETZT - timedelta(hours=1), autor=FREMD, quote=zitiert)
    p = ex(retruth(JETZT, original))
    assert p.typ == TYP_RETRUTH and p.typ_detail == TYP_RETRUTH
    assert p.ist_quote and p.quote_id == zitiert["id"]
    assert [(q.rolle, q.konto_id) for q in p.quellen] == [(ROLLE_RETRUTH, FREMD_ID), (ROLLE_QUOTE, ANDERER_ID)]


def test_typ_detail_vorrang_reply_vor_quote():
    zitiert = status(JETZT - timedelta(days=1), autor=FREMD)
    p = ex(status(JETZT, quote=zitiert, antwort_auf=("114000000000000123", TRUMP_ID)))
    assert p.ist_quote and p.ist_reply
    assert p.typ_detail == "reply_thread"
    assert [q.rolle for q in p.quellen] == [ROLLE_QUOTE, ROLLE_REPLY]


def test_typ_detail_vorrang_retruth_vor_reply():
    original = status(JETZT - timedelta(hours=1), autor=FREMD, antwort_auf=("114000000000000123", ANDERER_ID))
    p = ex(retruth(JETZT, original))
    assert p.ist_reply and p.reply_art == REPLY_FREMD
    assert p.typ_detail == TYP_RETRUTH
    assert [q.rolle for q in p.quellen] == [ROLLE_RETRUTH, ROLLE_REPLY]


# ---------------------------------------------------------------------------
# Format


@pytest.mark.parametrize(
    ("n_medien", "hat_text", "hat_text_ohne_urls", "hat_link", "erwartet"),
    [
        (1, True, True, False, FORMAT_MEDIEN_TEXT),
        (2, True, False, True, FORMAT_MEDIEN_TEXT),
        (1, False, False, False, FORMAT_NUR_MEDIEN),
        (3, False, False, True, FORMAT_NUR_MEDIEN),
        (0, True, False, True, FORMAT_NUR_LINK),
        (0, False, False, True, FORMAT_NUR_LINK),
        (0, True, True, True, FORMAT_TEXT_LINK),
        (0, True, True, False, FORMAT_NUR_TEXT),
        (0, False, False, False, FORMAT_LEER),
    ],
)
def test_bestimme_format(n_medien, hat_text, hat_text_ohne_urls, hat_link, erwartet):
    format_ = bestimme_format(
        n_medien=n_medien, hat_text=hat_text, hat_text_ohne_urls=hat_text_ohne_urls, hat_link=hat_link
    )
    assert format_ == erwartet and format_ in FORMATE


def test_format_nur_text():
    assert ex(status(JETZT)).format == FORMAT_NUR_TEXT


def test_format_nur_medien():
    p = ex(status(JETZT, text="", medien=[medium("image"), medium("video", dauer=4.0)]))
    assert p.format == FORMAT_NUR_MEDIEN
    assert (p.n_bilder, p.n_videos) == (1, 1)


def test_format_medien_text():
    assert ex(status(JETZT, medien=[medium("gifv")])).format == FORMAT_MEDIEN_TEXT


def test_format_medien_und_nur_url():
    assert ex(status(JETZT, text=link(ARTIKEL), medien=[medium("image")])).format == FORMAT_MEDIEN_TEXT


def test_format_nur_url_mit_karte():
    p = ex(status(JETZT, text=link(ARTIKEL), karte_=karte(ARTIKEL)))
    assert p.format == FORMAT_NUR_LINK
    assert p.hat_karte
    assert p.text.n_urls == 1 and p.text.link_domains == ["example.com"]
    assert p.text.zeichen == len(ARTIKEL) and p.text.zeichen_ohne_urls == 0


def test_format_nur_karte_ohne_text():
    assert ex(status(JETZT, text="", karte_=karte())).format == FORMAT_NUR_LINK


def test_format_text_und_link():
    assert ex(status(JETZT, text=f"{MARKER} {link(ARTIKEL)}")).format == FORMAT_TEXT_LINK


def test_format_karte_ohne_url_im_text():
    p = ex(status(JETZT, karte_=karte()))
    assert p.text.n_urls == 0 and p.hat_karte
    assert p.format == FORMAT_TEXT_LINK


def test_format_leere_karte_zaehlt_nicht():
    p = ex(status(JETZT, karte_={}))
    assert not p.hat_karte and p.format == FORMAT_NUR_TEXT


def test_format_leeres_quote():
    zitiert = status(JETZT - timedelta(days=1), autor=FREMD)
    p = ex(status(JETZT, text="", quote=zitiert))
    assert p.format == FORMAT_LEER
    assert p.fingerabdruck is None


def test_format_umfrage_ohne_text():
    s = status(JETZT, text="")
    s["poll"] = {"id": "1", "options": [{"title": f"{MARKER} Option"}]}
    assert ex(s).format == FORMAT_LEER


@pytest.mark.parametrize("leer", [" ", "&nbsp;", "&nbsp; &nbsp;", " <br> ", "\u3000"])
def test_format_nur_leerraum_ist_leer(leer):
    p = ex(status(JETZT, text=leer))
    assert p.format == FORMAT_LEER
    assert p.text.zeichen == 0 and p.text.text_hash is None


def test_format_quote_fallback_link_zaehlt_nicht():
    zitiert = status(JETZT - timedelta(days=1), autor=FREMD)
    s = status(JETZT, quote=zitiert)
    s["content"] = (
        f'<p>{MARKER} Kommentar</p><p class="quote-inline">RE: <a href="{zitiert["url"]}">{zitiert["url"]}</a></p>'
    )
    p = ex(s)
    assert p.format == FORMAT_NUR_TEXT
    assert p.text.n_urls == 0 and p.text.zeichen == len(f"{MARKER} Kommentar")


def test_format_link_auf_zitiertes_original_ohne_fallback_klasse():
    zitiert = status(JETZT - timedelta(days=1), autor=FREMD)
    s = status(JETZT, quote=zitiert)
    s["content"] = f'<p>{MARKER} <a href="{zitiert["url"]}">{zitiert["url"]}</a></p>'
    p = ex(s)
    assert p.format == FORMAT_NUR_TEXT and p.text.n_urls == 0
    s["content"] = f'<p><a href="{zitiert["uri"]}">{zitiert["uri"]}</a></p>'
    assert ex(s).format == FORMAT_LEER


def test_format_bei_retruth_aus_dem_original():
    original = status(JETZT - timedelta(hours=1), autor=FREMD, text="", medien=[medium("image")])
    p = ex(retruth(JETZT, original))
    assert p.format == FORMAT_NUR_MEDIEN and p.n_bilder == 1


def test_mentions_und_hashtags_aus_dem_original():
    original = status(
        JETZT - timedelta(hours=1),
        autor=FREMD,
        erwaehnungen=[erwaehnung(ANDERER_ID, "anderer")],
        hashtags=["Eins", "Zwei"],
    )
    p = ex(retruth(JETZT, original))
    assert p.text.n_mentions == 1 and p.text.n_hashtags == 2


# ---------------------------------------------------------------------------
# Medien: Beschreibung ohne Download


@pytest.mark.parametrize(
    ("api_typ", "art"),
    [
        ("image", MEDIUM_BILD),
        ("IMAGE", MEDIUM_BILD),
        ("video", MEDIUM_VIDEO),
        ("tv", MEDIUM_VIDEO),
        ("gifv", MEDIUM_GIF),
        ("audio", MEDIUM_AUDIO),
        ("unknown", MEDIUM_SONSTIG),
        (None, MEDIUM_SONSTIG),
        (7, MEDIUM_SONSTIG),
    ],
)
def test_beschreibe_anhang_art(api_typ, art):
    anhang = medium()
    anhang["type"] = api_typ
    assert beschreibe_anhang(anhang, 0).art == art


def test_beschreibe_anhang_masse_und_dauer():
    video = beschreibe_anhang(medium("video", medien_id="114000000000000042", breite=1920, hoehe=1080, dauer=12.5), 3)
    assert (video.position, video.medien_id, video.breite, video.hoehe, video.dauer_s) == (
        3, "114000000000000042", 1920, 1080, 12.5,
    )
    assert video.hash_status == HASH_OFFEN
    assert video.sha256 is None and video.phash is None and video.hash_quelle is None
    bild = beschreibe_anhang(medium("image", breite=800, hoehe=600), 0)
    assert (bild.breite, bild.hoehe, bild.dauer_s) == (800, 600, None)


def test_beschreibe_anhang_size_als_ersatz():
    anhang = medium("image")
    anhang["meta"]["original"] = {"size": "640x480"}
    assert (beschreibe_anhang(anhang, 0).breite, beschreibe_anhang(anhang, 0).hoehe) == (640, 480)


@pytest.mark.parametrize(
    "meta",
    [None, "x", {}, {"original": None}, {"original": {"width": True, "height": "abc", "duration": -1}},
     {"original": {"width": 0, "height": -5, "duration": float("nan")}}, {"original": {"size": "axb"}}],
)
def test_beschreibe_anhang_unbrauchbare_metadaten(meta):
    anhang = medium("video")
    anhang["meta"] = meta
    daten = beschreibe_anhang(anhang, 0)
    assert (daten.breite, daten.hoehe, daten.dauer_s) == (None, None, None)


def test_beschreibe_anhang_hash_status():
    assert beschreibe_anhang(medium("audio"), 0).hash_status == HASH_UEBERSPRUNGEN
    video = medium("video")
    video["preview_url"] = None
    assert beschreibe_anhang(video, 0).hash_status == HASH_UEBERSPRUNGEN
    bild_nur_vorschau = medium("image")
    bild_nur_vorschau["url"] = None
    assert beschreibe_anhang(bild_nur_vorschau, 0).hash_status == HASH_OFFEN
    bild_ohne_quelle = medium("image")
    bild_ohne_quelle["url"] = bild_ohne_quelle["preview_url"] = ""
    assert beschreibe_anhang(bild_ohne_quelle, 0).hash_status == HASH_UEBERSPRUNGEN
    kaputt = beschreibe_anhang("kein Objekt", 2)
    assert (kaputt.art, kaputt.medien_id, kaputt.hash_status, kaputt.position) == (
        MEDIUM_SONSTIG, None, HASH_UEBERSPRUNGEN, 2,
    )


# ---------------------------------------------------------------------------
# Medien-Hash und Fingerabdruck


def test_ohne_erfasser_sind_medien_offen_und_unvollstaendig():
    p = ex(status(JETZT, medien=[medium("image"), medium("audio")]))
    assert [m.hash_status for m in p.medien] == [HASH_OFFEN, HASH_UEBERSPRUNGEN]
    assert not p.medien_vollstaendig
    assert p.medien_hash is None and p.fingerabdruck is None
    assert p.text.text_hash is not None


def test_ohne_erfasser_nur_uebersprungene_medien_sind_vollstaendig():
    anhang = medium("audio", medien_id="114000000000000077")
    p = ex(status(JETZT, medien=[anhang]))
    assert p.medien_vollstaendig and p.n_audio == 1
    assert p.medien_hash == sha("audio:ohne-hash:114000000000000077")
    assert p.fingerabdruck == sha(f"t={p.text.text_hash}|m={p.medien_hash}|q=")


def test_ohne_medien():
    p = ex(status(JETZT))
    assert p.medien == [] and p.medien_vollstaendig and p.medien_hash is None
    assert p.fingerabdruck == sha(f"t={p.text.text_hash}|m=|q=")


def test_leerer_text_ohne_medien_hat_keinen_fingerabdruck():
    p = ex(status(JETZT, text=""))
    assert p.text.text_hash is None and p.fingerabdruck is None and p.medien_vollstaendig


def test_erfasser_wird_je_anhang_mit_position_aufgerufen():
    erfasser = FakeErfasser()
    anhaenge = [medium("image", medien_id="114000000000000001"), medium("video", medien_id="114000000000000002",
                                                                        dauer=3.0)]
    s = status(JETZT, medien=[*anhaenge, "kein Objekt"])
    p = ex(s, medien=erfasser)
    assert erfasser.aufrufe == [("114000000000000001", 0), ("114000000000000002", 1)]
    assert [m.position for m in p.medien] == [0, 1]
    assert p.medien_vollstaendig
    assert p.medien_hash == sha("\n".join(sorted(m.exakt_schluessel for m in p.medien)))
    assert p.fingerabdruck == sha(f"t={p.text.text_hash}|m={p.medien_hash}|q=")


def test_medien_hash_unabhaengig_von_reihenfolge_und_medien_id():
    a = [medium("image", datei="a.png"), medium("image", datei="b.png")]
    b = [medium("image", datei="b.png"), medium("image", datei="a.png")]
    text = f"{MARKER} gleich"
    p1 = ex(status(JETZT, text=text, medien=a), medien=FakeErfasser())
    p2 = ex(status(JETZT, text=text, medien=b), medien=FakeErfasser())
    assert p1.medien_hash == p2.medien_hash is not None
    assert p1.fingerabdruck == p2.fingerabdruck is not None
    p3 = ex(status(JETZT, text=f"{MARKER} anders", medien=a), medien=FakeErfasser())
    assert p3.medien_hash == p1.medien_hash and p3.fingerabdruck != p1.fingerabdruck


def test_video_schluessel_enthaelt_dauer():
    kurz = ex(status(JETZT, text="", medien=[medium("video", datei="v.png", dauer=3.0)]), medien=FakeErfasser())
    lang = ex(status(JETZT, text="", medien=[medium("video", datei="v.png", dauer=9.0)]), medien=FakeErfasser())
    assert kurz.medien_hash != lang.medien_hash


def test_gescheitertes_medium_macht_unvollstaendig():
    anhaenge = [medium("image", medien_id="114000000000000011"), medium("image", medien_id="114000000000000012")]
    p = ex(status(JETZT, medien=anhaenge), medien=FakeErfasser(fehler_ids=("114000000000000012",)))
    assert [m.hash_status for m in p.medien] == [HASH_OK, HASH_FEHLER]
    assert not p.medien_vollstaendig and p.medien_hash is None and p.fingerabdruck is None


def test_ok_ohne_sha256_gilt_als_unvollstaendig():
    class Kaputt:
        def erfasse(self, anhang: dict, position: int) -> MedienDaten:
            return MedienDaten(position=position, medien_id=None, art=MEDIUM_BILD, hash_status=HASH_OK)

    p = ex(status(JETZT, medien=[medium()]), medien=Kaputt())
    assert not p.medien_vollstaendig and p.medien_hash is None


def test_uebersprungen_und_ok_gemischt():
    anhaenge = [medium("image", datei="x.png"), medium("audio", medien_id="114000000000000099")]
    p = ex(status(JETZT, medien=anhaenge), medien=FakeErfasser())
    assert p.medien_vollstaendig
    erwartet = sorted([f"bild:{sha('x.png')}", "audio:ohne-hash:114000000000000099"])
    assert p.medien_hash == sha("\n".join(erwartet))


def test_quote_id_geht_in_den_fingerabdruck():
    text = f"{MARKER} gleich"
    ohne = ex(status(JETZT, text=text))
    mit = ex(status(JETZT, text=text, quote=status(JETZT - timedelta(days=1), autor=FREMD)))
    assert ohne.text.text_hash == mit.text.text_hash
    assert mit.fingerabdruck == sha(f"t={mit.text.text_hash}|m=|q={mit.quote_id}")
    assert ohne.fingerabdruck != mit.fingerabdruck


def test_mit_echtem_medienerfasser():
    erfasser = medien.MedienErfasser(lambda url: bild_png(3))
    p = ex(status(JETZT, medien=[medium("image"), medium("gifv", dauer=2.0)]), medien=erfasser)
    assert [m.hash_status for m in p.medien] == [HASH_OK, HASH_OK]
    assert p.medien_vollstaendig and p.medien_hash is not None and p.fingerabdruck is not None
    assert "/media/" not in repr(dataclasses.asdict(p))


# ---------------------------------------------------------------------------
# Zähler


def test_zaehler_standard_und_weitere():
    s = status(JETZT, zaehler=(1, 2, 3))
    s.update(quotes_count=4, upvotes_count=5, downvotes_count=0, reactions_count=-1, flag_count=True,
             gross_count=1.5, text_count="7", Gross_count=8)
    z = zaehler_aus(s)
    assert (z.replies, z.retruths, z.likes) == (1, 2, 3)
    assert z.weitere == {"downvotes_count": 0, "quotes_count": 4, "upvotes_count": 5}


def test_zaehler_negativ_und_fehlend():
    s = status(JETZT, zaehler=(-1, -1, 7))
    del s["upvotes_count"]
    s["downvotes_count"] = -1
    assert zaehler_aus(s) == Zaehler(replies=None, retruths=None, likes=7, weitere={})
    assert zaehler_aus({}) == Zaehler()
    assert zaehler_aus(None) == Zaehler()
    assert zaehler_aus({"replies_count": True, "reblogs_count": "3", "favourites_count": 2.0}) == Zaehler()


def test_zaehler_eingebetteter_objekte_zaehlen_nicht():
    ziel = status(JETZT - timedelta(minutes=1))
    s = status(JETZT, antwort_auf_status=ziel, zaehler=(1, 1, 1))
    assert set(zaehler_aus(s).weitere) == {"upvotes_count", "downvotes_count"}


# ---------------------------------------------------------------------------
# Werbung, Gepinnt, URL, Zeiten, Sichtbarkeit


def test_ist_werbung():
    assert not ist_werbung(status(JETZT), TRUMP_ID)
    gesponsert = status(JETZT)
    gesponsert["sponsored"] = True
    assert ist_werbung(gesponsert, TRUMP_ID)
    assert ist_werbung(status(JETZT, autor=FREMD), TRUMP_ID)
    ohne_konto = status(JETZT)
    ohne_konto["account"] = None
    assert ist_werbung(ohne_konto, TRUMP_ID)
    assert ist_werbung("kein Objekt", TRUMP_ID)
    assert not ist_werbung(retruth(JETZT, status(JETZT, autor=FREMD)), TRUMP_ID)
    numerisch = status(JETZT)
    numerisch["account"]["id"] = int(TRUMP_ID)
    assert not ist_werbung(numerisch, int(TRUMP_ID))  # type: ignore[arg-type]


def test_gepinnt():
    s = status(JETZT, gepinnt=True)
    assert ex(s, gepinnte_ids={s["id"]}).gepinnt is True
    assert ex(s, gepinnte_ids=set()).gepinnt is False
    assert ex(s).gepinnt is True
    assert ex(status(JETZT)).gepinnt is False
    s["pinned"] = "ja"
    assert ex(s).gepinnt is None


def test_url_ersatz_aus_handle_und_id():
    s = status(JETZT)
    s["url"] = None
    assert ex(s).url == f"{BASIS}/@realDonaldTrump/{s['id']}"
    s["url"] = "javascript:alert(1)"
    assert ex(s).url == f"{BASIS}/@realDonaldTrump/{s['id']}"
    assert ex(s, basis_url="https://truthsocial.com/").url == f"{BASIS}/@realDonaldTrump/{s['id']}"


def test_url_ersatz_ohne_handle():
    s = status(JETZT)
    s["url"] = None
    s["account"] = {"id": TRUMP_ID}
    assert ex(s).url == s["uri"]
    s["uri"] = None
    assert ex(s).url == f"{BASIS}/statuses/{s['id']}"


def test_url_bei_retruth_ohne_original_url():
    original = status(JETZT - timedelta(hours=1), autor=FREMD)
    original["url"] = None
    assert ex(retruth(JETZT, original)).url == f"{BASIS}/@jemand/{original['id']}"


def test_fremde_post_url_wird_durch_eigene_ersetzt():
    fern = konto("108000000000000999", "jemand@fern.example", "Fern")
    original = status(JETZT - timedelta(hours=1), autor=fern)
    original["url"] = f"https://fern.example/notes/{MARKER.lower()}-titel"
    original["uri"] = "https://fern.example/users/jemand/statuses/1"
    p = ex(retruth(JETZT, original))
    assert p.url == f"{BASIS}/@jemand@fern.example/{original['id']}"


def test_url_auf_testserver_mit_eigener_basis():
    s = status(JETZT)
    s["url"] = f"http://127.0.0.1:8123/@realDonaldTrump/{s['id']}"
    assert ex(s, basis_url="http://127.0.0.1:8123").url == s["url"]
    assert ex(s).url == f"{BASIS}/@realDonaldTrump/{s['id']}"


def test_zeiten_und_edited_at():
    s = status(JETZT, editiert=JETZT + timedelta(minutes=3))
    s["created_at"] = "2026-10-02T14:00:00.250+02:00"
    p = ex(s)
    assert p.created_at == JETZT + timedelta(milliseconds=250)
    assert p.edited_at == JETZT + timedelta(minutes=3)
    s["edited_at"] = "kaputt"
    assert ex(s).edited_at is None


def test_sichtbarkeit_nur_als_kennwort():
    s = status(JETZT)
    s["visibility"] = f"{MARKER} frei"
    assert ex(s).sichtbarkeit is None
    s["visibility"] = "unlisted"
    assert ex(s).sichtbarkeit == "unlisted"


def test_ids_als_zahl():
    s = status(JETZT)
    s["id"] = int(s["id"])
    assert ex(s).id == str(s["id"])


# ---------------------------------------------------------------------------
# Fehler und Robustheit


@pytest.mark.parametrize(
    "aendern",
    [
        lambda s: s.pop("id"),
        lambda s: s.update(id=None),
        lambda s: s.update(id=f"{MARKER}"),
        lambda s: s.update(id=-5),
        lambda s: s.update(id=True),
        lambda s: s.pop("created_at"),
        lambda s: s.update(created_at=None),
        lambda s: s.update(created_at=f"{MARKER} gestern"),
        lambda s: s.update(created_at=12345),
    ],
)
def test_ohne_id_oder_created_at_valueerror_ohne_inhalt(aendern):
    s = status(JETZT)
    aendern(s)
    with pytest.raises(ValueError) as fehler:
        ex(s)
    assert MARKER not in str(fehler.value)
    assert fehler.value.__cause__ is None and fehler.value.__context__ is None


@pytest.mark.parametrize("wert", [None, [], "status", 5, [status(JETZT)]])
def test_kein_objekt_valueerror(wert):
    with pytest.raises(ValueError):
        ex(wert)


def _pfade(objekt: Any, praefix: tuple = (), tiefe: int = 4):
    if tiefe == 0:
        return
    if isinstance(objekt, dict):
        for schluessel, wert in objekt.items():
            yield (*praefix, schluessel)
            yield from _pfade(wert, (*praefix, schluessel), tiefe - 1)
    elif isinstance(objekt, list):
        for index, wert in enumerate(objekt):
            yield (*praefix, index)
            yield from _pfade(wert, (*praefix, index), tiefe - 1)


_ERSATZWERTE = [None, "", f"{MARKER} x", 0, -1, True, 1.5, [], {}, [None], [{}], {"x": None}]
_LOESCHEN = object()


def _volles_status_objekt() -> dict[str, Any]:
    zitiert = status(JETZT - timedelta(days=1), autor=ANDERER, medien=[medium("image")])
    ziel = status(JETZT - timedelta(hours=3), autor=ANDERER)
    original = status(
        JETZT - timedelta(hours=2),
        text=f"{MARKER} {link(ARTIKEL)}",
        autor=FREMD,
        medien=[medium("image"), medium("video", dauer=5.0), medium("audio")],
        quote=zitiert,
        antwort_auf_status=ziel,
        karte_=karte(ARTIKEL),
        erwaehnungen=[erwaehnung(ANDERER_ID, "anderer"), erwaehnung("-99", "platzhalter")],
        hashtags=["Eins"],
        editiert=JETZT - timedelta(hours=1),
    )
    return retruth(JETZT, original)


@pytest.mark.parametrize("erfasser", [None, FakeErfasser()], ids=["ohne_medien", "mit_medien"])
def test_unerwartete_typen_an_jeder_stelle(erfasser):
    """Jedes Feld bis Tiefe 4 wird gelöscht oder durch einen fremden Typ ersetzt: nie eine andere Ausnahme."""
    basis = _volles_status_objekt()
    pflicht = {("id",), ("created_at",)}
    faelle = 0
    for pfad in _pfade(basis):
        for ersatz in [_LOESCHEN, *_ERSATZWERTE]:
            s = copy.deepcopy(basis)
            eltern = s
            for teil in pfad[:-1]:
                eltern = eltern[teil]
            if ersatz is _LOESCHEN:
                if not isinstance(eltern, dict):
                    continue
                del eltern[pfad[-1]]
            else:
                eltern[pfad[-1]] = copy.deepcopy(ersatz)
            faelle += 1
            try:
                p = ex(s, medien=erfasser)
            except ValueError as fehler:
                assert pfad in pflicht, (pfad, ersatz)
                assert MARKER not in str(fehler)
                continue
            assert isinstance(p, PostDaten)
            assert p.format in FORMATE
            # Der Anzeigename ist erlaubte Account-Metadatum und darf daher jeden Wert tragen.
            if pfad[-1] != "display_name":
                assert MARKER not in repr(dataclasses.asdict(p)), pfad
    assert faelle > 1000


# ---------------------------------------------------------------------------
# Datenschutz


def _alle_zeichenketten(wert: Any):
    if isinstance(wert, str):
        yield wert
    elif isinstance(wert, dict):
        for schluessel, kind in wert.items():
            yield from _alle_zeichenketten(schluessel)
            yield from _alle_zeichenketten(kind)
    elif isinstance(wert, (list, tuple, set)):
        for kind in wert:
            yield from _alle_zeichenketten(kind)


@pytest.mark.parametrize("erfasser", [None, FakeErfasser()], ids=["ohne_medien", "mit_medien"])
def test_postdaten_enthalten_keine_inhalte(erfasser):
    s = _volles_status_objekt()
    original = s["reblog"]
    original["content"] = (
        f"<p>{MARKER} Haupttext {link(ARTIKEL)}</p>"
        f'<p class="quote-inline">RE: <a href="{original["quote"]["url"]}">{MARKER}</a></p>'
    )
    p = ex(s, medien=erfasser)
    texte = list(_alle_zeichenketten(dataclasses.asdict(p)))
    verboten = [MARKER, "/media/", "Kartentitel", "Alternativtext", "Haupttext", "<", "artikel/zur/sache"]
    for text in texte:
        for wort in verboten:
            assert wort not in text, (wort, text)
    medien_urls = {a[k] for a in original["media_attachments"] for k in ("url", "preview_url")}
    assert not medien_urls & set(texte)
    # Was erlaubt ist, ist auch da: Domain, Hashes, Account-Metadaten, Post-URL.
    assert p.text.link_domains == ["example.com"]
    assert p.url == original["url"]
    assert {q.handle for q in p.quellen} == {"jemand", "anderer"}


def test_postdaten_haben_keine_inhaltsfelder():
    felder = {f.name for f in dataclasses.fields(PostDaten)}
    assert not felder & {"content", "html", "inhalt", "medien_urls", "titel", "beschreibung", "alt_text"}
