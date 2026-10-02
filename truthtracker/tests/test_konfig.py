from pathlib import Path

import pytest

from truthtracker import konfig, pfade


def test_mitgelieferte_config_ist_gueltig():
    k = konfig.lade(pfade.PROJEKT / "config.toml")
    assert k.konto.handle == "realDonaldTrump"
    assert k.zugriff.weg == "auto" and k.zugriff.browser == "auto"
    assert k.erfassung.backfill_wochen == 4
    assert k.erfassung.loeschpruefung_tage == 7
    assert k.erfassung.duplikat_fenster_tage == 14
    assert k.pausen.api_min_s <= k.pausen.api_max_s
    assert k.datenbank_pfad == pfade.PROJEKT / "daten" / "truthtracker.sqlite"


def test_fehlende_datei_ergibt_standard(tmp_path):
    k = konfig.lade(tmp_path / "gibtsnicht.toml")
    assert k.zugriff.seitengroesse == 40


def _schreibe(tmp_path: Path, text: str) -> Path:
    datei = tmp_path / "config.toml"
    datei.write_text(text, encoding="utf-8")
    return datei


def test_werte_und_relative_pfade(tmp_path):
    k = konfig.lade(_schreibe(tmp_path, '[erfassung]\nbackfill_wochen = 2\n[speicher]\ndatenbank = "x/y.sqlite"\n'))
    assert k.erfassung.backfill_wochen == 2.0
    assert k.datenbank_pfad == tmp_path / "x" / "y.sqlite"


@pytest.mark.parametrize(
    "inhalt",
    [
        '[zugriff]\nweg = "teleport"\n',
        '[pausen]\napi_min_s = 9\napi_max_s = 3\n',
        '[erfassung]\nbackfill_wochen = 0\n',
        '[erfassung]\nunbekannt = 1\n',
        '[konto]\nhandle = "@realDonaldTrump"\n',
        '[dashboard]\nzeitzone = "Asia/Tokyo"\n',
        '[zugriff]\nseitengroesse = "viele"\n',
        'kein toml [',
    ],
)
def test_fehlerhafte_konfiguration(tmp_path, inhalt):
    with pytest.raises(konfig.KonfigFehler):
        konfig.lade(_schreibe(tmp_path, inhalt))


def test_obergrenzen(tmp_path):
    with pytest.raises(konfig.KonfigFehler):
        konfig.lade(_schreibe(tmp_path, "[erfassung]\nduplikat_fenster_tage = 800000\n"))
