import json
from datetime import timedelta

from fabrik import JETZT, MARKER, karte, medium, retruth, status
from truthtracker.feldkatalog import Feldkatalog


def test_katalog_enthaelt_pfade_aber_keine_werte():
    posts = [
        status(JETZT, medien=[medium("video", dauer=12.5)], karte_=karte()),
        retruth(JETZT - timedelta(hours=1), status(JETZT - timedelta(hours=3))),
    ]
    k = Feldkatalog()
    k.aufnehmen_alle(posts)
    daten = k.als_dict()
    text = json.dumps(daten)
    assert MARKER not in text
    assert "example.com" not in text
    assert "/media/" not in text
    felder = daten["felder"]
    assert "media_attachments[].meta.original.duration" in felder
    assert "reblog.account.followers_count" in felder
    assert felder["media_attachments[].type"]["werte"] == {"video": 1}
    assert felder["visibility"]["werte"] == {"public": 2}
    assert felder["created_at"]["muster"] == {"DDDD-DD-DDTDD:DD:DD.DDDZ": 2}
    assert felder["id"]["muster"] == {"18 Ziffern": 2}
    assert daten["objekte"] == 2


def test_enum_werte_nur_an_erlaubten_stellen_und_nur_als_kennwort():
    k = Feldkatalog()
    k.aufnehmen({"type": "geheim", "card": {"type": "link"}, "visibility": "Hallo Welt"})
    felder = k.als_dict()["felder"]
    assert "werte" not in felder["type"]  # oberste Ebene: kein erlaubter Ort
    assert felder["card.type"]["werte"] == {"link": 1}
    assert "werte" not in felder["visibility"]  # kein Kennwort-Format


def test_seltsame_schluessel_werden_ersetzt():
    k = Feldkatalog()
    k.aufnehmen({"Das ist ein Satz": 1, "ok_feld": {"9abc": 2}})
    pfade = k.pfade()
    assert "{schluessel}" in pfade and "ok_feld.{schluessel}" in pfade
    assert not any("Satz" in p for p in pfade)


def test_grosse_woerterbuecher_werden_zusammengefasst():
    k = Feldkatalog()
    k.aufnehmen({"karte": {f"k{i}": i for i in range(200)}})
    assert k.pfade() == {"karte", "karte.{*}"}


def test_listen_von_skalaren_und_max_laenge():
    k = Feldkatalog()
    k.aufnehmen({"liste": [1, 2, 3], "leer": []})
    felder = k.als_dict()["felder"]
    assert felder["liste"]["max_laenge"] == 3
    assert felder["liste[]"]["typen"] == {"int": 3}
    assert "leer[]" not in felder
