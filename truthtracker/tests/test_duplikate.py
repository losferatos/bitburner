"""Duplikat-Fälle 1–4 im 14-Tage-Fenster, nur mit synthetischen Metadaten (keine Inhalte)."""

from __future__ import annotations

import hashlib
import itertools
import json
import random
import time
from datetime import datetime, timedelta

import pytest

from fabrik import JETZT, MARKER, snowflake
from truthtracker import db, duplikate, zeit
from truthtracker.konfig import Konfig
from truthtracker.modelle import (
    DUP_ARTEN,
    DUP_EXAKT,
    DUP_GLEICHES_ORIGINAL,
    DUP_MEDIEN_AEHNLICH,
    DUP_NUR_MEDIEN,
    DUP_NUR_TEXT,
    HASH_FEHLER,
    HASH_OK,
    MEDIUM_BILD,
    MEDIUM_GIF,
    MEDIUM_VIDEO,
    TYP_EIGEN,
    TYP_RETRUTH,
    TYP_SELBST_RETRUTH,
    MedienDaten,
    PostDaten,
    TextMetriken,
)

PHASH = "f0e1d2c3b4a59687"
FREMDES_ORIGINAL = snowflake(JETZT - timedelta(days=30), 4711)

_folge = iter(range(1, 1_000_000))


def _sha(wert: str) -> str:
    return hashlib.sha256(wert.encode()).hexdigest()


def _text(wort: str) -> str:
    """Text-Hash eines erfundenen Texts (der Text selbst wird nirgends gespeichert)."""
    return _sha(f"{MARKER} {wort}")


def _phash_mit_abstand(abstand: int, basis: str = PHASH, start_bit: int = 0) -> str:
    maske = ((1 << abstand) - 1) << start_bit
    return f"{int(basis, 16) ^ maske:016x}"


def _bild(phash: str = PHASH, *, datei: str | None = None, breite: int = 1200, hoehe: int = 800) -> MedienDaten:
    """``datei`` bestimmt den SHA-256: gleiche Datei = byte-gleich, sonst neu kodiert."""
    return MedienDaten(
        position=0, medien_id=None, art=MEDIUM_BILD, breite=breite, hoehe=hoehe,
        sha256=_sha(datei or f"{phash}-{next(_folge)}"), phash=phash, hash_quelle="original", hash_status=HASH_OK,
    )


def _video(phash: str = PHASH, *, dauer: float | None, datei: str | None = None, art: str = MEDIUM_VIDEO,
           breite: int = 1280, hoehe: int = 720) -> MedienDaten:
    return MedienDaten(
        position=0, medien_id=None, art=art, breite=breite, hoehe=hoehe, dauer_s=dauer,
        sha256=_sha(datei or f"{phash}-{next(_folge)}"), phash=phash, hash_quelle="vorschau", hash_status=HASH_OK,
    )


def _fehlgeschlagen(art: str = MEDIUM_BILD) -> MedienDaten:
    return MedienDaten(position=0, medien_id=None, art=art, hash_status=HASH_FEHLER)


def _post(
    zeitpunkt: datetime,
    *,
    text: str | None = None,
    medien: list[MedienDaten] | None = None,
    typ: str = TYP_EIGEN,
    original_id: str | None = None,
    quote_id: str | None = None,
    post_id: str | None = None,
) -> PostDaten:
    """Ein Post wie aus ``klassifikation.extrahiere``: Hashes nach den Regeln aus docs/architektur.md."""
    medien = medien or []
    for position, m in enumerate(medien):
        m.position = position
        m.medien_id = m.medien_id or str(900_000 + next(_folge))
    schluessel = [m.exakt_schluessel for m in medien]
    vollstaendig = all(s is not None for s in schluessel)
    medien_hash = _sha("\n".join(sorted(s for s in schluessel if s))) if medien and vollstaendig else None
    text_hash = _text(text) if text else None
    fingerabdruck = None
    if vollstaendig and (text_hash or medien_hash):
        fingerabdruck = _sha(f"t={text_hash or ''}|m={medien_hash or ''}|q={quote_id or ''}")
    post_id = post_id or snowflake(zeitpunkt, next(_folge))
    return PostDaten(
        id=post_id,
        url=f"https://truthsocial.com/@realDonaldTrump/{post_id}",
        created_at=zeitpunkt,
        typ=typ,
        original_id=original_id,
        quote_id=quote_id,
        ist_quote=quote_id is not None,
        n_bilder=sum(m.art == MEDIUM_BILD for m in medien),
        n_videos=sum(m.art == MEDIUM_VIDEO for m in medien),
        n_gifs=sum(m.art == MEDIUM_GIF for m in medien),
        text=TextMetriken(zeichen=len(text or ""), text_hash=text_hash),
        medien_hash=medien_hash,
        medien_vollstaendig=vollstaendig,
        fingerabdruck=fingerabdruck,
        medien=medien,
    )


def _retruth(zeitpunkt: datetime, original_id: str, *, typ: str = TYP_RETRUTH, **kwargs) -> PostDaten:
    return _post(zeitpunkt, typ=typ, original_id=original_id, **kwargs)


@pytest.fixture()
def con(tmp_path):
    verbindung = db.oeffne(tmp_path / "t.sqlite")
    yield verbindung
    verbindung.close()


@pytest.fixture()
def lauf(con):
    return db.lauf_starten(con, JETZT, backfill=False)


def _speichere(con, lauf: int, *posts: PostDaten) -> None:
    for p in posts:
        db.post_speichern(con, p, lauf_id=lauf, gesehen=JETZT, backfill=False)


def _aktualisiere(con, betroffene=None, *, konfig: Konfig | None = None, jetzt: datetime = JETZT):
    return duplikate.aktualisiere_duplikate(con, konfig or Konfig(), betroffene_ids=betroffene, jetzt=jetzt)


def _dups(con, post: PostDaten) -> dict[str, dict]:
    zeilen = con.execute("SELECT * FROM duplikate WHERE post_id = ?", (post.id,)).fetchall()
    return {z["art"]: dict(z) for z in zeilen}


def _primaer(con, post: PostDaten) -> str | None:
    zeile = con.execute("SELECT art FROM duplikate WHERE post_id = ? AND primaer = 1", (post.id,)).fetchall()
    assert len(zeile) <= 1
    return zeile[0]["art"] if zeile else None


# ---------------------------------------------------------------------------
# Fall 1: gleiches Original


def test_fall1_zweimal_dasselbe_original_retruthed(con, lauf):
    erst = _retruth(JETZT - timedelta(days=2), FREMDES_ORIGINAL, text="Original", medien=[_bild(datei="o.png")])
    zweit = _retruth(JETZT - timedelta(hours=5), FREMDES_ORIGINAL, text="Original", medien=[_bild(datei="o.png")])
    _speichere(con, lauf, erst, zweit)

    bericht = _aktualisiere(con)

    d = _dups(con, zweit)
    # Gleiche Inhalts-ID zählt nur als Fall 1, nicht zusätzlich als exakt, nur Text oder nur Medien.
    assert set(d) == {DUP_GLEICHES_ORIGINAL}
    assert d[DUP_GLEICHES_ORIGINAL]["frueherer_post_id"] == erst.id
    assert d[DUP_GLEICHES_ORIGINAL]["abstand_s"] == 43 * 3600
    assert d[DUP_GLEICHES_ORIGINAL]["primaer"] == 1
    assert _dups(con, erst) == {}
    assert bericht.geprueft == 2 and bericht.mit_duplikat == 1
    assert bericht.je_art[DUP_GLEICHES_ORIGINAL] == 1


def test_fall1_naechster_frueherer_retruth(con, lauf):
    a = _retruth(JETZT - timedelta(days=5), FREMDES_ORIGINAL, text="Original")
    b = _retruth(JETZT - timedelta(days=3), FREMDES_ORIGINAL, text="Original")
    c = _retruth(JETZT - timedelta(days=1), FREMDES_ORIGINAL, text="Original")
    _speichere(con, lauf, a, b, c)
    _aktualisiere(con)
    assert _dups(con, c)[DUP_GLEICHES_ORIGINAL]["frueherer_post_id"] == b.id
    assert _dups(con, b)[DUP_GLEICHES_ORIGINAL]["frueherer_post_id"] == a.id


def test_fall1_selbst_retruth_eines_eigenen_posts(con, lauf):
    eigen = _post(JETZT - timedelta(days=3), text="Eigener Beitrag", medien=[_bild(datei="e.png")])
    selbst = _retruth(
        JETZT - timedelta(hours=1), eigen.id, typ=TYP_SELBST_RETRUTH, text="Eigener Beitrag",
        medien=[_bild(datei="e.png")],
    )
    _speichere(con, lauf, eigen, selbst)
    _aktualisiere(con)
    d = _dups(con, selbst)
    assert set(d) == {DUP_GLEICHES_ORIGINAL}
    assert d[DUP_GLEICHES_ORIGINAL]["frueherer_post_id"] == eigen.id
    assert d[DUP_GLEICHES_ORIGINAL]["abstand_s"] == 71 * 3600


def test_fall1_selbst_retruth_ausserhalb_des_fensters(con, lauf):
    eigen = _post(JETZT - timedelta(days=20), text="Alter Beitrag")
    selbst = _retruth(JETZT - timedelta(hours=1), eigen.id, typ=TYP_SELBST_RETRUTH, text="Alter Beitrag")
    _speichere(con, lauf, eigen, selbst)
    _aktualisiere(con)
    assert _dups(con, selbst) == {}


def test_fall1_plus_exakt_mit_anderem_frueheren_post(con, lauf):
    eigen = _post(JETZT - timedelta(days=4), text="Gleicher Satz")
    rt1 = _retruth(JETZT - timedelta(days=3), FREMDES_ORIGINAL, text="Gleicher Satz")
    rt2 = _retruth(JETZT - timedelta(days=1), FREMDES_ORIGINAL, text="Gleicher Satz")
    _speichere(con, lauf, eigen, rt1, rt2)
    _aktualisiere(con)
    d = _dups(con, rt2)
    assert d[DUP_GLEICHES_ORIGINAL]["frueherer_post_id"] == rt1.id
    # rt1 hat dieselbe Inhalts-ID, deshalb ist der nächste "exakte" Vorgänger der eigene Post.
    assert d[DUP_EXAKT]["frueherer_post_id"] == eigen.id
    assert _primaer(con, rt2) == DUP_GLEICHES_ORIGINAL


# ---------------------------------------------------------------------------
# Fall 2: exakt


def test_fall2_exakt_eigener_post_und_retruth(con, lauf):
    eigen = _post(JETZT - timedelta(days=2), text="Gleicher Satz", medien=[_bild(datei="x.png")])
    rt = _retruth(JETZT - timedelta(days=1), FREMDES_ORIGINAL, text="Gleicher Satz", medien=[_bild(datei="x.png")])
    nochmal = _post(JETZT - timedelta(hours=3), text="Gleicher Satz", medien=[_bild(datei="x.png")])
    _speichere(con, lauf, eigen, rt, nochmal)

    _aktualisiere(con)

    assert set(_dups(con, rt)) == {DUP_EXAKT}
    assert _dups(con, rt)[DUP_EXAKT]["frueherer_post_id"] == eigen.id
    d = _dups(con, nochmal)
    assert set(d) == {DUP_EXAKT}
    assert d[DUP_EXAKT]["frueherer_post_id"] == rt.id
    assert d[DUP_EXAKT]["abstand_s"] == 21 * 3600
    assert d[DUP_EXAKT]["primaer"] == 1


def test_fall2_exakt_nur_text_ohne_medien(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Kurz")
    b = _post(JETZT - timedelta(days=1), text="Kurz")
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert set(_dups(con, b)) == {DUP_EXAKT}


# ---------------------------------------------------------------------------
# Fall 3a und 3b


def test_fall3a_nur_text(con, lauf):
    mit_bild = _post(JETZT - timedelta(days=3), text="Gleicher Satz", medien=[_bild(PHASH)])
    anderes_bild = _post(
        JETZT - timedelta(days=2), text="Gleicher Satz", medien=[_bild(_phash_mit_abstand(30))]
    )
    ohne_medien = _post(JETZT - timedelta(days=1), text="Gleicher Satz")
    _speichere(con, lauf, mit_bild, anderes_bild, ohne_medien)

    _aktualisiere(con)

    assert set(_dups(con, anderes_bild)) == {DUP_NUR_TEXT}
    assert _dups(con, anderes_bild)[DUP_NUR_TEXT]["frueherer_post_id"] == mit_bild.id
    d = _dups(con, ohne_medien)
    assert set(d) == {DUP_NUR_TEXT}
    assert d[DUP_NUR_TEXT]["frueherer_post_id"] == anderes_bild.id
    assert json.loads(d[DUP_NUR_TEXT]["details"]) == {}


def test_fall3a_gleicher_text_anderes_quote_ziel(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Stimmt", quote_id="111")
    b = _post(JETZT - timedelta(days=1), text="Stimmt", quote_id="222")
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    d = _dups(con, b)
    assert set(d) == {DUP_NUR_TEXT}
    assert json.loads(d[DUP_NUR_TEXT]["details"]) == {"quote_verschieden": True}


def test_fall3b_nur_medien(con, lauf):
    a = _post(JETZT - timedelta(days=3), text="Erster Satz", medien=[_bild(datei="gleich.png")])
    b = _post(JETZT - timedelta(days=2), text="Anderer Satz", medien=[_bild(datei="gleich.png")])
    ohne_text = _post(JETZT - timedelta(days=1), medien=[_bild(datei="gleich.png")])
    _speichere(con, lauf, a, b, ohne_text)

    _aktualisiere(con)

    assert set(_dups(con, b)) == {DUP_NUR_MEDIEN}
    assert _dups(con, b)[DUP_NUR_MEDIEN]["frueherer_post_id"] == a.id
    # Leerer Text gegen vorhandenen Text ist "Text verschieden".
    d = _dups(con, ohne_text)
    assert set(d) == {DUP_NUR_MEDIEN}
    assert d[DUP_NUR_MEDIEN]["frueherer_post_id"] == b.id


def test_nur_medien_ohne_text_beide_ist_exakt(con, lauf):
    a = _post(JETZT - timedelta(days=2), medien=[_bild(datei="g.png")])
    b = _post(JETZT - timedelta(days=1), medien=[_bild(datei="g.png")])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert set(_dups(con, b)) == {DUP_EXAKT}


def test_leerer_text_ist_kein_text_duplikat(con, lauf):
    a = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH)])
    b = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(40))])
    leer1 = _post(JETZT - timedelta(hours=10))
    leer2 = _post(JETZT - timedelta(hours=5))
    _speichere(con, lauf, a, b, leer1, leer2)
    _aktualisiere(con)
    assert _dups(con, b) == {}
    assert _dups(con, leer2) == {}


# ---------------------------------------------------------------------------
# Fall 4: Medien wahrscheinlich gleich


def test_fall4_phash_abstand_3_ja(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Eins", medien=[_bild(PHASH)])
    b = _post(JETZT - timedelta(days=1), text="Zwei", medien=[_bild(_phash_mit_abstand(3))])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    d = _dups(con, b)
    assert set(d) == {DUP_MEDIEN_AEHNLICH}
    assert d[DUP_MEDIEN_AEHNLICH]["frueherer_post_id"] == a.id
    assert json.loads(d[DUP_MEDIEN_AEHNLICH]["details"]) == {"phash_abstand_max": 3}


def test_fall4_phash_abstand_20_nein(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Eins", medien=[_bild(PHASH)])
    b = _post(JETZT - timedelta(days=1), text="Zwei", medien=[_bild(_phash_mit_abstand(20))])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert _dups(con, b) == {}


def test_fall4_grenze_des_phash_abstands(con, lauf):
    a = _post(JETZT - timedelta(days=3), medien=[_bild(PHASH)])
    sechs = _post(JETZT - timedelta(days=2), medien=[_bild(_phash_mit_abstand(6, start_bit=20))])
    sieben = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(7, start_bit=40))])
    _speichere(con, lauf, a, sechs, sieben)
    _aktualisiere(con)
    assert _dups(con, sechs)[DUP_MEDIEN_AEHNLICH]["frueherer_post_id"] == a.id
    # Abstand zu a ist 7, zu "sechs" 13: beides zu weit.
    assert _dups(con, sieben) == {}


def test_fall4_video_dauer(con, lauf):
    zehn = _post(JETZT - timedelta(days=3), medien=[_video(PHASH, dauer=10.0)])
    dreissig = _post(JETZT - timedelta(days=2), medien=[_video(_phash_mit_abstand(2), dauer=30.0)])
    _speichere(con, lauf, zehn, dreissig)
    _aktualisiere(con)
    assert DUP_MEDIEN_AEHNLICH not in _dups(con, dreissig)

    knapp = _post(JETZT - timedelta(days=1), medien=[_video(_phash_mit_abstand(1), dauer=10.8)])
    unbekannt = _post(JETZT - timedelta(hours=5), medien=[_video(_phash_mit_abstand(4), dauer=None)])
    _speichere(con, lauf, knapp, unbekannt)
    _aktualisiere(con)
    assert _dups(con, knapp)[DUP_MEDIEN_AEHNLICH]["frueherer_post_id"] == zehn.id
    # Ohne bekannte Dauer entscheidet nur der pHash; der nächste frühere passende ist "knapp".
    assert _dups(con, unbekannt)[DUP_MEDIEN_AEHNLICH]["frueherer_post_id"] == knapp.id


def test_fall4_gif_dauer_und_art(con, lauf):
    gif = _post(JETZT - timedelta(days=2), medien=[_video(PHASH, dauer=3.0, art=MEDIUM_GIF)])
    video = _post(JETZT - timedelta(days=1), medien=[_video(PHASH, dauer=3.0)])
    gif_lang = _post(JETZT - timedelta(hours=5), medien=[_video(PHASH, dauer=9.0, art=MEDIUM_GIF)])
    _speichere(con, lauf, gif, video, gif_lang)
    _aktualisiere(con)
    # Andere Medienart zählt nie als ähnlich.
    assert _dups(con, video) == {}
    assert _dups(con, gif_lang) == {}


def test_fall4_anderes_seitenverhaeltnis_nein(con, lauf):
    quer = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH, breite=1200, hoehe=800)])
    hoch = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(1), breite=800, hoehe=1200)])
    skaliert = _post(JETZT - timedelta(hours=5), medien=[_bild(_phash_mit_abstand(2), breite=600, hoehe=400)])
    leicht = _post(JETZT - timedelta(hours=2), medien=[_bild(_phash_mit_abstand(2), breite=1200, hoehe=760)])
    _speichere(con, lauf, quer, hoch, skaliert, leicht)
    _aktualisiere(con)
    assert _dups(con, hoch) == {}
    # Neu skaliert mit gleichem Seitenverhältnis bleibt ähnlich.
    assert _dups(con, skaliert)[DUP_MEDIEN_AEHNLICH]["frueherer_post_id"] == quer.id
    # 1200x760 weicht um gut 5 % vom Seitenverhältnis 1,5 ab.
    assert _dups(con, leicht) == {}


def test_fall4_unbekannte_abmessungen_entscheiden_nicht(con, lauf):
    a = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH, breite=1200, hoehe=800)])
    b = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(2), breite=None, hoehe=None)])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert DUP_MEDIEN_AEHNLICH in _dups(con, b)


def test_fall4_nicht_bei_exakt_gleichen_medien(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Eins", medien=[_bild(datei="same.png")])
    b = _post(JETZT - timedelta(days=1), text="Zwei", medien=[_bild(datei="same.png")])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert set(_dups(con, b)) == {DUP_NUR_MEDIEN}


def test_fall4_zuordnung_ist_nicht_nur_gierig(con, lauf):
    # Abstände: a1-b1 = 1, a1-b2 = 5, a2-b1 = 5, a2-b2 = 11. Gierig (a1-b1 zuerst) bliebe a2-b2 = 11 übrig;
    # die gültige Zuordnung ist a1-b2 und a2-b1 mit größtem Abstand 5.
    a1 = 0
    b1 = 1
    b2 = 0b111110
    a2 = b1 ^ (0b11111 << 10)
    q = _post(JETZT - timedelta(days=2), medien=[_bild(f"{b1:016x}"), _bild(f"{b2:016x}")])
    p = _post(JETZT - timedelta(days=1), medien=[_bild(f"{a1:016x}"), _bild(f"{a2:016x}")])
    _speichere(con, lauf, q, p)
    _aktualisiere(con)
    d = _dups(con, p)
    assert set(d) == {DUP_MEDIEN_AEHNLICH}
    assert json.loads(d[DUP_MEDIEN_AEHNLICH]["details"]) == {"phash_abstand_max": 5}


def test_fall4_jedes_medium_hoechstens_einmal(con, lauf):
    q = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH), _bild(_phash_mit_abstand(40))])
    p = _post(
        JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(1)), _bild(_phash_mit_abstand(2, start_bit=8))]
    )
    _speichere(con, lauf, q, p)
    _aktualisiere(con)
    assert _dups(con, p) == {}


def test_fall4_verschiedene_medienzahl_nein(con, lauf):
    q = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH)])
    p = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(1)), _bild(_phash_mit_abstand(1))])
    _speichere(con, lauf, q, p)
    _aktualisiere(con)
    assert _dups(con, p) == {}


def test_fall4_konfigurierter_abstand(con, lauf):
    a = _post(JETZT - timedelta(days=2), medien=[_bild(PHASH)])
    b = _post(JETZT - timedelta(days=1), medien=[_bild(_phash_mit_abstand(10))])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert _dups(con, b) == {}
    konfig = Konfig()
    konfig.duplikate.phash_max_abstand = 12
    _aktualisiere(con, konfig=konfig)
    assert json.loads(_dups(con, b)[DUP_MEDIEN_AEHNLICH]["details"]) == {"phash_abstand_max": 10}


# ---------------------------------------------------------------------------
# Fenster, Reihenfolge, Stärke


@pytest.mark.parametrize(("tage", "erwartet"), [(13.99, True), (14.0, True), (14.01, False)])
def test_grenze_14_tage(con, lauf, tage, erwartet):
    frueh = _post(JETZT - timedelta(days=tage), text="Wiederholt")
    spaet = _post(JETZT, text="Wiederholt")
    _speichere(con, lauf, frueh, spaet)
    _aktualisiere(con)
    assert (DUP_EXAKT in _dups(con, spaet)) is erwartet


def test_spaeterer_post_ist_nie_vorgaenger(con, lauf):
    frueh = _post(JETZT - timedelta(days=2), text="Wiederholt", medien=[_bild(datei="w.png")])
    spaet = _post(JETZT - timedelta(days=1), text="Wiederholt", medien=[_bild(datei="w.png")])
    _speichere(con, lauf, spaet, frueh)  # Reihenfolge des Speicherns spielt keine Rolle
    _aktualisiere(con)
    assert _dups(con, frueh) == {}
    assert _dups(con, spaet)[DUP_EXAKT]["frueherer_post_id"] == frueh.id


def test_gleiche_sekunde_kleinere_id_ist_frueher(con, lauf):
    zeitpunkt = JETZT - timedelta(hours=3)
    klein = _post(zeitpunkt, text="Doppelt", post_id=snowflake(zeitpunkt, 1))
    gross = _post(zeitpunkt, text="Doppelt", post_id=snowflake(zeitpunkt, 2))
    _speichere(con, lauf, gross, klein)
    _aktualisiere(con)
    assert _dups(con, klein) == {}
    d = _dups(con, gross)
    assert d[DUP_EXAKT]["frueherer_post_id"] == klein.id and d[DUP_EXAKT]["abstand_s"] == 0


def test_staerkste_kategorie_ist_primaer(con, lauf):
    aehnlich = _post(JETZT - timedelta(days=5), text="Anders", medien=[_bild(_phash_mit_abstand(2))])
    nur_text = _post(JETZT - timedelta(days=4), text="Satz", medien=[_bild(_phash_mit_abstand(50))])
    exakt = _post(JETZT - timedelta(days=3), text="Satz", medien=[_bild(PHASH, datei="p.png")])
    nur_medien = _post(JETZT - timedelta(days=2), text="Noch anders", medien=[_bild(PHASH, datei="p.png")])
    p = _post(JETZT - timedelta(days=1), text="Satz", medien=[_bild(PHASH, datei="p.png")])
    _speichere(con, lauf, aehnlich, nur_text, exakt, nur_medien, p)

    bericht = _aktualisiere(con)

    d = _dups(con, p)
    assert {art: z["frueherer_post_id"] for art, z in d.items()} == {
        DUP_EXAKT: exakt.id,
        DUP_NUR_TEXT: nur_text.id,
        DUP_NUR_MEDIEN: nur_medien.id,
        DUP_MEDIEN_AEHNLICH: aehnlich.id,
    }
    assert {art for art, z in d.items() if z["primaer"]} == {DUP_EXAKT}
    assert _primaer(con, p) == DUP_EXAKT
    assert d[DUP_NUR_TEXT]["abstand_s"] == 3 * 86400
    assert set(bericht.je_art) == set(DUP_ARTEN)


def test_geloeschte_posts_zaehlen_mit(con, lauf):
    frueh = _post(JETZT - timedelta(days=2), text="Weg")
    spaet = _post(JETZT - timedelta(days=1), text="Weg")
    _speichere(con, lauf, frueh, spaet)
    db.als_geloescht_markieren(con, frueh.id, JETZT)
    _aktualisiere(con)
    assert DUP_EXAKT in _dups(con, spaet)


# ---------------------------------------------------------------------------
# Neuberechnung


def _geprueft(con, post: PostDaten) -> str | None:
    return db.post_lesen(con, post.id)["dup_geprueft_utc"]


def test_betroffene_ids_nachtraeglich_eingefuegter_frueherer_post(con, lauf):
    spaet = _post(JETZT - timedelta(days=1), text="Nachgeholt", medien=[_bild(datei="n.png")])
    weit_spaeter = _post(JETZT, text="Etwas anderes")
    _speichere(con, lauf, spaet, weit_spaeter)
    _aktualisiere(con, jetzt=JETZT - timedelta(minutes=10))
    assert _dups(con, spaet) == {}

    # Eine Lücke wird gefüllt: Ein früherer, gleicher Post kommt dazu.
    frueh = _post(JETZT - timedelta(days=16), text="Nachgeholt", medien=[_bild(datei="n.png")])
    _speichere(con, lauf, frueh)
    ausserhalb = _post(JETZT - timedelta(days=40), text="Uralt")
    _speichere(con, lauf, ausserhalb)
    _aktualisiere(con, jetzt=JETZT - timedelta(minutes=9))
    stand_ausserhalb = _geprueft(con, ausserhalb)

    mitte = _post(JETZT - timedelta(days=10), text="Nachgeholt", medien=[_bild(datei="n.png")])
    _speichere(con, lauf, mitte)
    bericht = _aktualisiere(con, [mitte.id])

    assert _dups(con, spaet)[DUP_EXAKT]["frueherer_post_id"] == mitte.id
    assert _dups(con, mitte)[DUP_EXAKT]["frueherer_post_id"] == frueh.id
    # Neu bewertet: mitte selbst und alle Posts bis 14 Tage danach (spaet, weit_spaeter).
    assert bericht.geprueft == 3
    assert _geprueft(con, weit_spaeter) == "2026-10-02T12:00:00Z"
    assert _geprueft(con, frueh) != "2026-10-02T12:00:00Z"
    assert _geprueft(con, ausserhalb) == stand_ausserhalb


def test_neuberechnung_entfernt_veraltete_zeilen(con, lauf):
    frueh = _post(JETZT - timedelta(days=2), text="Vorher")
    spaet = _post(JETZT - timedelta(days=1), text="Vorher")
    _speichere(con, lauf, frueh, spaet)
    _aktualisiere(con)
    assert DUP_EXAKT in _dups(con, spaet)

    # Der frühere Post wurde bearbeitet; sein Text-Hash ändert sich.
    bearbeitet = _post(JETZT - timedelta(days=2), text="Nachher", post_id=frueh.id)
    _speichere(con, lauf, bearbeitet)
    bericht = _aktualisiere(con, {frueh.id})
    assert _dups(con, spaet) == {}
    assert bericht.geprueft == 2 and bericht.mit_duplikat == 0
    assert db.zaehle(con, "duplikate") == 0


def test_noch_nie_gepruefte_posts_werden_immer_bewertet(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="Absturz")
    b = _post(JETZT - timedelta(days=1), text="Absturz")
    _speichere(con, lauf, a, b)
    bericht = _aktualisiere(con, [])
    assert bericht.geprueft == 2
    assert DUP_EXAKT in _dups(con, b)
    assert _aktualisiere(con, []).geprueft == 0


def test_unbekannte_ids_werden_ignoriert(con, lauf):
    _speichere(con, lauf, _post(JETZT, text="Allein"))
    _aktualisiere(con)
    assert _aktualisiere(con, ["123", "kein-post"]).geprueft == 0


def test_neuberechnung_ist_idempotent(con, lauf):
    posts = [
        _post(JETZT - timedelta(days=3), text="A", medien=[_bild(PHASH)]),
        _post(JETZT - timedelta(days=2), text="A", medien=[_bild(_phash_mit_abstand(3))]),
        _retruth(JETZT - timedelta(days=1), FREMDES_ORIGINAL, text="B"),
        _retruth(JETZT - timedelta(hours=1), FREMDES_ORIGINAL, text="B"),
    ]
    _speichere(con, lauf, *posts)
    _aktualisiere(con)
    vorher = [dict(z) for z in con.execute("SELECT * FROM duplikate ORDER BY post_id, art")]
    _aktualisiere(con, [p.id for p in posts])
    _aktualisiere(con)
    nachher = [dict(z) for z in con.execute("SELECT * FROM duplikate ORDER BY post_id, art")]
    assert vorher == nachher and len(vorher) == 3


# ---------------------------------------------------------------------------
# Unvollständige Medien und Abdeckung


def test_unvollstaendige_medien(con, lauf):
    q = _post(JETZT - timedelta(days=3), text="Satz", medien=[_bild(datei="u.png")])
    nur_text = _post(JETZT - timedelta(days=2), text="Satz")
    p = _post(JETZT - timedelta(days=1), text="Satz", medien=[_fehlgeschlagen()])
    assert not p.medien_vollstaendig and p.medien_hash is None and p.fingerabdruck is None
    _speichere(con, lauf, q, nur_text, p)

    _aktualisiere(con)

    # Ob p dieselben Medien wie q hat, ist offen; ohne Medien ist "nur_text" dagegen sicher.
    d = _dups(con, p)
    assert set(d) == {DUP_NUR_TEXT}
    assert d[DUP_NUR_TEXT]["frueherer_post_id"] == nur_text.id
    assert db.post_lesen(con, p.id)["dup_abdeckung_vollstaendig"] == 0


def test_unvollstaendige_medien_gleiche_zahl_kein_nur_text(con, lauf):
    q = _post(JETZT - timedelta(days=3), text="Satz", medien=[_bild(datei="u.png")])
    p = _post(JETZT - timedelta(days=1), text="Satz", medien=[_fehlgeschlagen()])
    _speichere(con, lauf, q, p)
    _aktualisiere(con)
    assert _dups(con, p) == {}


def test_unvollstaendige_medien_kein_fall_2_3b_4(con, lauf):
    q = _post(JETZT - timedelta(days=2), text="Eins", medien=[_bild(PHASH)])
    p = _post(JETZT - timedelta(days=1), text="Zwei", medien=[_bild(_phash_mit_abstand(1)), _fehlgeschlagen()])
    q2 = _post(JETZT - timedelta(days=2), text="Eins", medien=[_bild(PHASH), _bild(_phash_mit_abstand(9))])
    _speichere(con, lauf, q, q2, p)
    _aktualisiere(con)
    assert _dups(con, p) == {}


def test_unvollstaendige_medien_fall1_bleibt(con, lauf):
    a = _retruth(JETZT - timedelta(days=2), FREMDES_ORIGINAL, medien=[_bild(datei="r.png")])
    b = _retruth(JETZT - timedelta(days=1), FREMDES_ORIGINAL, medien=[_fehlgeschlagen()])
    _speichere(con, lauf, a, b)
    _aktualisiere(con)
    assert set(_dups(con, b)) == {DUP_GLEICHES_ORIGINAL}


def _abdecken(con, von: datetime, bis: datetime, *, anfang: bool = False) -> None:
    db.abdeckung_hinzufuegen(con, db.Bereich(zeit.id_untergrenze(von), zeit.id_obergrenze(bis), anfang))


def _flag(con, post: PostDaten) -> int | None:
    return db.post_lesen(con, post.id)["dup_abdeckung_vollstaendig"]


def test_abdeckung_flag(con, lauf):
    p = _post(JETZT - timedelta(hours=1), text="Flag")
    _speichere(con, lauf, p)
    _aktualisiere(con)
    assert _flag(con, p) == 0

    _abdecken(con, JETZT - timedelta(days=13), JETZT)
    _aktualisiere(con, [p.id])
    assert _flag(con, p) == 0

    _abdecken(con, JETZT - timedelta(days=15), JETZT - timedelta(days=12))
    _aktualisiere(con, [p.id])
    assert _flag(con, p) == 1


def test_abdeckung_flag_anfang_der_timeline(con, lauf):
    p = _post(JETZT - timedelta(hours=1), text="Anfang")
    _speichere(con, lauf, p)
    _abdecken(con, JETZT - timedelta(days=2), JETZT, anfang=True)
    _aktualisiere(con)
    assert _flag(con, p) == 1


def test_abdeckung_flag_unvollstaendige_medien_im_fenster(con, lauf):
    _abdecken(con, JETZT - timedelta(days=40), JETZT)
    kaputt = _post(JETZT - timedelta(days=5), medien=[_fehlgeschlagen()])
    davor = _post(JETZT - timedelta(days=20), text="Davor")
    p = _post(JETZT - timedelta(hours=1), text="Danach")
    _speichere(con, lauf, kaputt, davor, p)
    _aktualisiere(con)
    assert _flag(con, kaputt) == 0
    assert _flag(con, p) == 0
    assert _flag(con, davor) == 1

    # Medien werden nachgeholt: kaputt ist betroffen, p wird mit neu bewertet.
    repariert = _post(JETZT - timedelta(days=5), medien=[_bild(PHASH)], post_id=kaputt.id)
    _speichere(con, lauf, repariert)
    _aktualisiere(con, [kaputt.id])
    assert _flag(con, kaputt) == 1
    assert _flag(con, p) == 1


def test_abdeckung_wird_ohne_neubewertung_nachgetragen(con, lauf):
    p = _post(JETZT - timedelta(hours=1), text="Später abgedeckt")
    _speichere(con, lauf, p)
    _aktualisiere(con, jetzt=JETZT - timedelta(minutes=30))
    assert _flag(con, p) == 0

    # Ein späterer Lauf schließt die Lücke, ohne dass neue Posts auftauchen.
    _abdecken(con, JETZT - timedelta(days=20), JETZT)
    bericht = _aktualisiere(con, [])
    assert bericht.geprueft == 0
    assert _flag(con, p) == 1
    assert _geprueft(con, p) == "2026-10-02T11:30:00Z"


def test_abdeckung_entspricht_db_funktion(con):
    _abdecken(con, JETZT - timedelta(days=10), JETZT)
    _abdecken(con, JETZT - timedelta(days=40), JETZT - timedelta(days=25), anfang=True)
    bereiche = db.abdeckung_lesen(con)
    for stunden in range(0, 24 * 45, 7):
        t = JETZT - timedelta(hours=stunden)
        for tage in (14, 3.5, 30):
            erwartet = db.abdeckung_vollstaendig(con, t - timedelta(days=tage), t)
            assert duplikate._abgedeckt(bereiche, int(t.timestamp()), tage) is erwartet


# ---------------------------------------------------------------------------
# Bericht, Übersicht, Datenschutz, Laufzeit


def test_bericht_und_uebersicht(con, lauf):
    a = _post(JETZT - timedelta(days=2), text="X", medien=[_bild(datei="b.png")])
    b = _post(JETZT - timedelta(days=1), text="X", medien=[_bild(datei="b.png")])
    c = _post(JETZT - timedelta(hours=2), text="Y", medien=[_bild(datei="b.png")])
    _speichere(con, lauf, a, b, c)

    bericht = _aktualisiere(con)

    assert bericht.geprueft == 3 and bericht.mit_duplikat == 2
    assert bericht.je_art == {
        DUP_GLEICHES_ORIGINAL: 0, DUP_EXAKT: 1, DUP_NUR_TEXT: 0, DUP_NUR_MEDIEN: 1, DUP_MEDIEN_AEHNLICH: 0,
    }
    uebersicht = {z["post_id"]: z for z in duplikate.duplikat_uebersicht(con)}
    assert list(uebersicht) == [a.id, b.id, c.id]
    assert uebersicht[a.id]["duplikat"] is False and uebersicht[a.id]["art"] is None
    assert uebersicht[b.id]["art"] == DUP_EXAKT and uebersicht[b.id]["abstand_s"] == 86400
    assert uebersicht[c.id]["arten"] == [DUP_NUR_MEDIEN]
    assert uebersicht[c.id]["frueherer_post_id"] == b.id
    assert uebersicht[c.id]["abdeckung_vollstaendig"] is False


def test_keine_inhalte_in_details(con, lauf):
    posts = [
        _post(JETZT - timedelta(days=2), text="Q", quote_id="1", medien=[_bild(PHASH)]),
        _post(JETZT - timedelta(days=1), text="Q", quote_id="2", medien=[_bild(_phash_mit_abstand(2))]),
    ]
    _speichere(con, lauf, *posts)
    _aktualisiere(con)
    for z in con.execute("SELECT * FROM duplikate"):
        details = json.loads(z["details"])
        assert set(details) <= {"phash_abstand_max", "quote_verschieden"}
        assert all(isinstance(w, (bool, int)) for w in details.values())
        assert MARKER not in json.dumps(dict(z))


def test_laufzeit_5000_posts(con, lauf):
    zufall = random.Random(7)
    posts = []
    for i in range(5000):
        zeitpunkt = JETZT - timedelta(minutes=9 * i)  # rund 2.200 Posts je 14-Tage-Fenster
        art = zufall.random()
        if art < 0.25:
            original = 1_000 + zufall.randrange(400)
            posts.append(_retruth(zeitpunkt, str(original), text=f"o{original}"))
            continue
        text = f"t{zufall.randrange(600)}" if zufall.random() < 0.8 else None
        medien = []
        for _ in range(zufall.choice((0, 0, 1, 1, 1, 2))):
            if zufall.random() < 0.1:
                medien.append(_bild(datei=f"pool{zufall.randrange(50)}"))
            else:
                medien.append(_bild(f"{zufall.getrandbits(64):016x}"))
        posts.append(_post(zeitpunkt, text=text, medien=medien))
    _speichere(con, lauf, *posts)

    start = time.perf_counter()
    bericht = _aktualisiere(con)
    dauer = time.perf_counter() - start

    assert bericht.geprueft == 5000
    assert bericht.mit_duplikat > 1000
    assert dauer < 5.0, f"Duplikat-Prüfung dauerte {dauer:.2f} s"

    start = time.perf_counter()
    teil = _aktualisiere(con, [posts[0].id, posts[2500].id])
    assert time.perf_counter() - start < 2.0
    assert 0 < teil.geprueft < 5000


# ---------------------------------------------------------------------------
# Abgleich mit einer naiven Referenz (alle Paare, alle Zuordnungen)


def _referenz(con, konfig: Konfig) -> set[tuple]:
    """Erwartete Zeilen der Tabelle ``duplikate``, direkt aus den Regeln abgeleitet (O(n²))."""
    dk = konfig.duplikate
    fenster_s = konfig.erfassung.duplikat_fenster_tage * 86400
    medien: dict[str, list] = {}
    for z in con.execute("SELECT * FROM medien ORDER BY post_id, position"):
        medien.setdefault(z["post_id"], []).append(z)
    posts = []
    for z in con.execute("SELECT * FROM posts"):
        n = z["n_bilder"] + z["n_videos"] + z["n_gifs"] + z["n_audio"] + z["n_sonstige_medien"]
        liste = medien.get(z["id"], [])
        phashbar = bool(z["medien_vollstaendig"]) and n >= 1 and len(liste) == n and all(
            m["hash_status"] == HASH_OK and m["phash"] for m in liste
        )
        posts.append({
            "id": z["id"], "schluessel": (zeit.parse_utc(z["created_at_utc"]), z["id_num"]),
            "t": int(zeit.parse_utc(z["created_at_utc"]).timestamp()), "inhalt": z["original_id"] or z["id"],
            "text": z["text_hash"], "mh": z["medien_hash"], "voll": bool(z["medien_vollstaendig"]),
            "fp": z["fingerabdruck"], "quote": z["quote_id"], "n": n, "medien": liste if phashbar else None,
        })

    def passt(a, b) -> bool:
        if a["art"] != b["art"]:
            return False
        if a["art"] in (MEDIUM_VIDEO, MEDIUM_GIF) and a["dauer_s"] is not None and b["dauer_s"] is not None:
            if abs(a["dauer_s"] - b["dauer_s"]) > dk.dauer_toleranz_s + 1e-9:
                return False
        if a["breite"] and a["hoehe"] and b["breite"] and b["hoehe"]:
            ra, rb = a["breite"] / a["hoehe"], b["breite"] / b["hoehe"]
            if max(ra, rb) / min(ra, rb) - 1 > dk.seitenverhaeltnis_toleranz + 1e-9:
                return False
        return True

    def aehnlich(p, q) -> int | None:
        if p["medien"] is None or q["medien"] is None or len(p["medien"]) != len(q["medien"]):
            return None
        if p["mh"] is not None and p["mh"] == q["mh"]:
            return None
        bester = None
        for reihenfolge in itertools.permutations(q["medien"]):
            abstaende = []
            for a, b in zip(p["medien"], reihenfolge):
                d = (int(a["phash"], 16) ^ int(b["phash"], 16)).bit_count()
                if d > dk.phash_max_abstand or not passt(a, b):
                    break
                abstaende.append(d)
            else:
                bester = max(abstaende) if bester is None else min(bester, max(abstaende))
        return bester

    erwartet = set()
    for p in posts:
        naechste: dict[str, tuple] = {}
        for q in posts:
            if not (q["schluessel"] < p["schluessel"] and p["t"] - q["t"] <= fenster_s):
                continue
            funde: dict[str, dict] = {}
            if p["inhalt"] == q["inhalt"]:
                funde[DUP_GLEICHES_ORIGINAL] = {}
            else:
                if p["voll"] and p["fp"] and p["fp"] == q["fp"]:
                    funde[DUP_EXAKT] = {}
                if p["text"] and p["text"] == q["text"]:
                    if p["voll"] and q["voll"]:
                        medien_verschieden = p["mh"] != q["mh"]
                    else:
                        medien_verschieden = p["n"] != q["n"]
                    if medien_verschieden:
                        funde[DUP_NUR_TEXT] = {}
                    elif p["quote"] != q["quote"]:
                        funde[DUP_NUR_TEXT] = {"quote_verschieden": True}
                if p["voll"] and q["voll"] and p["mh"] and p["mh"] == q["mh"]:
                    if p["text"] != q["text"]:
                        funde[DUP_NUR_MEDIEN] = {}
                    elif p["quote"] != q["quote"]:
                        funde[DUP_NUR_MEDIEN] = {"quote_verschieden": True}
                if p["voll"] and q["voll"]:
                    abstand = aehnlich(p, q)
                    if abstand is not None:
                        funde[DUP_MEDIEN_AEHNLICH] = {"phash_abstand_max": abstand}
            for art, details in funde.items():
                if art not in naechste or q["schluessel"] > naechste[art][0]["schluessel"]:
                    naechste[art] = (q, details)
        staerkste = min(naechste, key=DUP_ARTEN.index, default=None)
        for art, (q, details) in naechste.items():
            zeile = (p["id"], art, q["id"], p["t"] - q["t"], int(art == staerkste), json.dumps(details, sort_keys=True))
            erwartet.add(zeile)
    return erwartet


def _tabelle(con) -> set[tuple]:
    return {
        (z["post_id"], z["art"], z["frueherer_post_id"], z["abstand_s"], z["primaer"], z["details"])
        for z in con.execute("SELECT * FROM duplikate")
    }


def _zufallsposts(zufall: random.Random, anzahl: int, ende: datetime) -> list[PostDaten]:
    """Kollisionsreiche Posts: kleine Pools für Texte, Dateien, pHashes, Dauern, Größen und Originale."""
    basis = [zufall.getrandbits(64) for _ in range(6)]
    groessen = [(1200, 800), (600, 400), (800, 1200), (1200, 790), (None, None)]
    posts = []
    zeitpunkt = ende
    for _ in range(anzahl):
        zeitpunkt -= timedelta(seconds=zufall.choice((0, 0, 1, 600, 3600, 4 * 3600, 20 * 3600)))
        medien = []
        for _ in range(zufall.choice((0, 0, 1, 1, 1, 2, 3))):
            art = zufall.choice((MEDIUM_BILD, MEDIUM_BILD, MEDIUM_VIDEO, MEDIUM_GIF))
            if zufall.random() < 0.07:
                medien.append(_fehlgeschlagen(art))
                continue
            phash = basis[zufall.randrange(len(basis))] ^ (1 << zufall.randrange(64)) * zufall.choice((0, 1))
            phash ^= ((1 << zufall.choice((0, 2, 5, 7))) - 1) << zufall.randrange(57)
            breite, hoehe = zufall.choice(groessen)
            datei = f"f{zufall.randrange(5)}" if zufall.random() < 0.5 else None
            if art == MEDIUM_BILD:
                medien.append(_bild(f"{phash:016x}", datei=datei, breite=breite, hoehe=hoehe))
            else:
                dauer = zufall.choice((None, 10.0, 10.5, 12.0, 30.0))
                medien.append(_video(f"{phash:016x}", dauer=dauer, datei=datei, art=art, breite=breite, hoehe=hoehe))
        text = zufall.choice((None, "a", "b", "c", "d"))
        quote = zufall.choice((None, None, "1", "2"))
        wurf = zufall.random()
        if wurf < 0.2:
            posts.append(_retruth(zeitpunkt, str(zufall.randrange(5)), text=text, medien=medien, quote_id=quote))
        elif wurf < 0.27 and posts:
            ziel = zufall.choice(posts)
            posts.append(_retruth(zeitpunkt, ziel.id, typ=TYP_SELBST_RETRUTH, text=text, medien=medien))
        else:
            posts.append(_post(zeitpunkt, text=text, medien=medien, quote_id=quote))
    return posts


@pytest.mark.parametrize("saat", [1, 2, 3, 4])
def test_abgleich_mit_naiver_referenz(con, lauf, saat):
    zufall = random.Random(saat)
    konfig = Konfig()
    konfig.erfassung.duplikat_fenster_tage = 2
    posts = _zufallsposts(zufall, 260, JETZT)
    zufall.shuffle(posts)
    alt, neu = posts[:200], posts[200:]
    _speichere(con, lauf, *alt)
    _aktualisiere(con, konfig=konfig)
    assert _tabelle(con) == _referenz(con, konfig)

    # Nachträglich eingefügte Posts quer über den Zeitraum: Teil-Neuberechnung = Vollberechnung.
    _speichere(con, lauf, *neu)
    _aktualisiere(con, [p.id for p in neu], konfig=konfig)
    erwartet = _referenz(con, konfig)
    assert _tabelle(con) == erwartet
    assert len(erwartet) > 100
    assert {z[1] for z in erwartet} == set(DUP_ARTEN)
