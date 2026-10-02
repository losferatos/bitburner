"""Dashboard-Tests mit ``streamlit.testing.v1.AppTest``: die echte App gegen eine synthetische
Datenbank, eine leere Datenbank und ohne Datenbank. Kein Browser, kein Netzwerk."""

from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from pathlib import Path

import pytest
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.testing.v1 import AppTest

from fabrik import MARKER, TRUMP_ID
from test_auswertung import (
    BEISPIEL_ALT_GEPINNT,
    INHALT_VERBOTEN,
    _t,
    baue_beispiel_db,
    baue_inhalts_db,
    post,
    speichere,
)
from truthtracker import db
from truthtracker.db import LaufZaehler

APP = Path(__file__).resolve().parents[1] / "src" / "truthtracker" / "dashboard" / "app.py"


def _konfig(tmp_path: Path, datenbank: Path, zeitzone: str = "Europe/Berlin") -> Path:
    datei = tmp_path / "config.toml"
    datei.write_text(
        f"[speicher]\ndatenbank = '{datenbank.as_posix()}'\n\n"
        f"[dashboard]\nzeitzone = '{zeitzone}'\nserien_schwelle_min = 10\n",
        encoding="utf-8",
    )
    return datei


@pytest.fixture
def app(tmp_path, monkeypatch):
    def starten(datenbank: Path, zeitzone: str = "Europe/Berlin") -> AppTest:
        monkeypatch.setenv("TRUTHTRACKER_CONFIG", str(_konfig(tmp_path, datenbank, zeitzone)))
        return AppTest.from_file(str(APP), default_timeout=120).run()

    return starten


@pytest.fixture
def downloads(monkeypatch) -> list[bytes]:
    """Bytes, die die App an ``st.download_button`` übergibt (AppTest legt sie im Speicher ab)."""
    gesammelt: list[bytes] = []
    original = MemoryMediaFileStorage.load_and_get_id

    def mitschreiben(self, path_or_data, mimetype, kind, filename=None):
        if isinstance(path_or_data, bytes) and mimetype == "text/csv":
            gesammelt.append(path_or_data)
        return original(self, path_or_data, mimetype, kind, filename)

    monkeypatch.setattr(MemoryMediaFileStorage, "load_and_get_id", mitschreiben)
    return gesammelt


def _texte(at: AppTest) -> str:
    teile = [e.value for e in (*at.info, *at.warning, *at.error, *at.caption, *at.markdown)]
    teile += [e.value for e in at.subheader] + [e.value for e in at.title]
    return "\n".join(str(t) for t in teile)


def _alles(at: AppTest) -> str:
    """Jeder sichtbare Text: Elemente, Kacheln samt Tooltips, Tabellen und Grafik-Daten."""
    teile = [_texte(at)]
    teile += [f"{m.label} {m.value} {m.proto.delta} {m.proto.help}" for m in at.metric]
    teile += [d.value.to_csv() for d in at.dataframe]
    teile += [c.proto.spec for c in at.get("plotly_chart")]
    return "\n".join(teile)


def _ohne_fehler(at: AppTest) -> None:
    assert not at.exception, [e.value for e in at.exception]
    assert not at.error, [e.value for e in at.error]


def _metriken(at: AppTest) -> dict[str, str]:
    return {m.label: m.value for m in at.metric}


def _kopfzeile(at: AppTest) -> str:
    return next(c.value for c in at.caption if c.value.startswith("Nur Metadaten"))


def test_fehlende_datenbank_zeigt_hinweis(app, tmp_path):
    at = app(tmp_path / "gibt-es-nicht.sqlite")
    _ohne_fehler(at)
    assert any("run_crawl.bat" in i.value for i in at.info)
    assert len(at.tabs) == 0


def test_leere_datenbank_alle_reiter_ohne_fehler(app, tmp_path):
    pfad = tmp_path / "leer.sqlite"
    db.oeffne(pfad).close()
    at = app(pfad)
    _ohne_fehler(at)
    assert len(at.tabs) == 11
    assert any("noch keine Posts" in i.value for i in at.info)
    assert sum("Keine Posts in der aktuellen Auswahl" in i.value for i in at.info) >= 8


def test_beispiel_datenbank_alle_reiter_rendern(app, tmp_path):
    pfad = baue_beispiel_db(tmp_path / "beispiel.sqlite")
    at = app(pfad)
    _ohne_fehler(at)
    assert [t.label for t in at.tabs] == [
        "Überblick", "Tageszeiten", "Abstände & Serien", "Formate", "Engagement", "Retruth-Quellen",
        "Duplikate", "Löschungen & Edits", "Account", "Tabelle", "Läufe",
    ]
    # Vorgabe-Zeitraum: die Erfassung (Backfill-Grenze bis letzter Lauf); der 2025 gepinnte Post
    # verschiebt ihn nicht.
    assert "Zeitraum 04.08.2026–11.09.2026, 21 Posts" in _kopfzeile(at)
    metriken = _metriken(at)
    assert metriken["Posts"] == "21"
    # 21 Posts ÷ 37,75 erfasste Tage (04.08. ab 14:00 und 11.09. bis 08:05 Berliner Zeit anteilig)
    assert metriken["Posts pro Tag"] == "0,6"
    assert metriken["Retruths"] == "8"
    assert metriken["Selbst-Retruths"] == "3"
    assert metriken["Gelöscht"] == "1"
    assert metriken["Mit Duplikat"] == "2"
    assert metriken["Edits gesamt"] == "1"
    assert metriken["Follower"] == "11.070.000"
    assert metriken["Läufe"] == "3"
    texte = _texte(at)
    for erwartet in ("Posts pro Tag nach Typ", "Wochentag × Stunde", "Längste Pause pro Tag",
                     "Formatmix im Zeitverlauf", "nach Post-Typ (Median)", "Meistgeteilte Accounts",
                     "Zeit bis zur Löschung", "API-Anfragen pro Lauf", "Blasse Säulen"):
        assert erwartet in texte, erwartet
    assert "Backfill-Posts" in texte  # Engagement nennt ausgeschlossene Backfill-Posts
    assert MARKER not in texte
    assert len(at.get("plotly_chart")) >= 15
    assert len(at.get("download_button")) == 1


def test_filter_aendern_ohne_fehler(app, tmp_path):
    pfad = baue_beispiel_db(tmp_path / "beispiel.sqlite")
    at = app(pfad)
    _ohne_fehler(at)

    at.sidebar.radio(key="zeitzone").set_value("America/New_York").run()
    _ohne_fehler(at)
    assert "US-Ostküste (New York)" in _texte(at)

    at.sidebar.checkbox(key="backfill").check().run()
    _ohne_fehler(at)
    assert any("Backfill-Posts sind einbezogen" in w.value for w in at.warning)

    at.toggle(key="engagement_pro_stunde").set_value(True).run()
    _ohne_fehler(at)
    assert "Likes pro Stunde seit Post nach Post-Typ (Median)" in _texte(at)

    at.selectbox(key="engagement_kennzahl").set_value("upvotes_count").run()
    _ohne_fehler(at)

    at.sidebar.number_input(key="schwelle").set_value(2).run()
    _ohne_fehler(at)

    at.sidebar.multiselect(key="typen").set_value(["retruth", "selbst_retruth"]).run()
    _ohne_fehler(at)
    assert _metriken(at)["Posts"] == "8"

    at.sidebar.checkbox(key="geloeschte").uncheck().run()
    _ohne_fehler(at)

    at.sidebar.multiselect(key="typen").set_value([]).run()
    _ohne_fehler(at)
    assert any("Kein Post-Typ" in w.value for w in at.warning)

    at.sidebar.multiselect(key="typen").set_value(["eigen"]).run()
    at.sidebar.date_input(key="zeitraum").set_value((date(2026, 9, 20), date(2026, 9, 21))).run()
    _ohne_fehler(at)
    assert any("keine Posts" in i.value for i in at.info)


def test_backfill_warnung_nennt_eingestellten_messalter_bereich(app, tmp_path):
    at = app(baue_beispiel_db(tmp_path / "beispiel.sqlite"))
    at.sidebar.slider(key="alter").set_value((10, 30)).run()
    at.sidebar.checkbox(key="backfill").check().run()
    _ohne_fehler(at)
    warnung = next(w.value for w in at.warning if "Backfill-Posts sind einbezogen" in w.value)
    assert "nach 10,0–30,0 h nicht vergleichbar" in warnung and "18–24" not in warnung
    texte = _texte(at)
    # Posts im Messalter-Bereich und Backfill-Posts werden getrennt gezählt.
    assert "Messung 10,0–30,0 h nach dem Post lag: 7 Posts, dazu 10 Backfill-Posts" in texte
    assert "Reihe „Original“" in texte


def test_alte_posts_nur_in_der_tabelle(app, tmp_path, downloads):
    at = app(baue_beispiel_db(tmp_path / "beispiel.sqlite"))
    assert "vor Beginn der Erfassung" not in _kopfzeile(at)
    # Selbst gewählter Zeitraum bis ins Jahr 2025: der alte gepinnte Post zählt in keiner Auswertung …
    at.sidebar.date_input(key="zeitraum").set_value((date(2025, 1, 20), date(2026, 9, 11))).run()
    _ohne_fehler(at)
    kopf = _kopfzeile(at)
    assert "21 Posts in der Auswahl" in kopf and "Dazu 1 Post vor Beginn der Erfassung" in kopf
    assert _metriken(at)["Posts"] == "21"
    # … steht aber in Tabelle und Export.
    zeilen = list(csv.reader(io.StringIO(downloads[-1].decode("utf-8-sig")), delimiter=";"))
    assert len(zeilen) == 1 + 22
    spalte = zeilen[0].index("Vor Beginn der Erfassung")
    erstellt = zeilen[0].index("Erstellt (UTC)")
    alte = [z for z in zeilen[1:] if z[spalte] == "ja"]
    assert len(alte) == 1 and alte[0][erstellt] == "2025-01-20 17:00:00"
    assert BEISPIEL_ALT_GEPINNT.startswith("2025-01-20T17:00")


def _kleine_db(pfad: Path, *, follower: tuple[int, int] = (11_000_000, 11_000_000)) -> Path:
    """Drei Posts und zwei Läufe; der erste Post (02:00 UTC) liegt in New York noch am Vortag."""
    con = db.oeffne(pfad)
    try:
        with con:
            db.meta_schreiben(con, "konto_id", TRUMP_ID)
        lauf1 = db.lauf_starten(con, _t("2026-09-02T12:00:00Z"), backfill=False)
        db.konto_snapshot_speichern(con, lauf1, TRUMP_ID, _t("2026-09-02T12:00:00Z"), follower=follower[0],
                                    folgt=70, posts_gesamt=30_000)
        for i, zeitpunkt in enumerate(("2026-09-01T02:00:00Z", "2026-09-01T12:00:00Z", "2026-09-02T09:00:00Z")):
            speichere(con, post(zeitpunkt, folge=i), lauf1, 20)
        db.lauf_beenden(con, lauf1, ende=_t("2026-09-02T12:05:00Z"), status="ok", zugriff="curl",
                        abbruch_grund=None, zaehler=LaufZaehler(), meldungen=[], abgedeckt_von=None, abgedeckt_bis=None)
        lauf2 = db.lauf_starten(con, _t("2026-09-03T12:00:00Z"), backfill=False)
        db.konto_snapshot_speichern(con, lauf2, TRUMP_ID, _t("2026-09-03T12:00:00Z"), follower=follower[1],
                                    folgt=70, posts_gesamt=30_010)
        db.lauf_beenden(con, lauf2, ende=_t("2026-09-03T12:05:00Z"), status="ok", zugriff="curl",
                        abbruch_grund=None, zaehler=LaufZaehler(), meldungen=[], abgedeckt_von=None, abgedeckt_bis=None)
    finally:
        con.close()
    return pfad


def test_konto_rueckgang_zeigt_pfeil_nach_unten(app, tmp_path):
    at = app(_kleine_db(tmp_path / "konto.sqlite", follower=(11_000_000, 10_950_000)))
    _ohne_fehler(at)
    kacheln = {m.label: m for m in at.metric}
    follower = kacheln["Follower"].proto
    assert follower.delta == "-50.000 seit 02.09.2026"
    assert follower.direction == MetricProto.MetricDirection.DOWN
    assert follower.color == MetricProto.MetricColor.RED
    posts = kacheln["Posts gesamt"].proto
    assert posts.delta == "+10 seit 02.09.2026" and posts.direction == MetricProto.MetricDirection.UP
    # Unverändert: kein Pfeil, der eine Zunahme vortäuscht.
    folgt = kacheln["Folgt"].proto
    assert folgt.delta == "" and folgt.direction == MetricProto.MetricDirection.NONE
    assert "Unverändert seit 02.09.2026" in folgt.help


def test_zeitzonenwechsel_verschiebt_vorgabe_aber_nicht_eigene_wahl(app, tmp_path):
    at = app(_kleine_db(tmp_path / "zonen.sqlite"))
    assert "Zeitraum 01.09.2026–03.09.2026, 3 Posts" in _kopfzeile(at)
    at.sidebar.radio(key="zeitzone").set_value("America/New_York").run()
    _ohne_fehler(at)
    # Der erste Post ist in New York 22:00 am 31.08.; die Vorgabe zieht mit, kein Post fällt heraus.
    assert "Zeitraum 31.08.2026–03.09.2026, 3 Posts" in _kopfzeile(at)
    assert _metriken(at)["Posts"] == "3"

    at.sidebar.date_input(key="zeitraum").set_value((date(2026, 9, 1), date(2026, 9, 3))).run()
    at.sidebar.radio(key="zeitzone").set_value("Europe/Berlin").run()
    at.sidebar.radio(key="zeitzone").set_value("America/New_York").run()
    _ohne_fehler(at)
    assert "Zeitraum 01.09.2026–03.09.2026, 2 Posts" in _kopfzeile(at)  # selbst gewählt: bleibt stehen


def test_neuer_lauf_bei_offenem_dashboard_erweitert_den_zeitraum(app, tmp_path):
    pfad = _kleine_db(tmp_path / "offen.sqlite")
    at = app(pfad)
    assert "Zeitraum 01.09.2026–03.09.2026, 3 Posts" in _kopfzeile(at)
    con = db.oeffne(pfad)
    try:
        start = _t("2026-09-05T12:00:00Z")
        lauf_id = db.lauf_starten(con, start, backfill=False)
        speichere(con, post("2026-09-05T10:00:00Z", folge=7), lauf_id, 2)
        db.lauf_beenden(con, lauf_id, ende=start + timedelta(minutes=3), status="ok", zugriff="curl",
                        abbruch_grund=None, zaehler=LaufZaehler(), meldungen=[], abgedeckt_von=None,
                        abgedeckt_bis=None)
    finally:
        con.close()
    at.run()
    _ohne_fehler(at)
    assert "Zeitraum 01.09.2026–05.09.2026, 4 Posts" in _kopfzeile(at)


def test_csv_download_enthaelt_nur_metadaten(app, tmp_path, downloads):
    pfad = baue_beispiel_db(tmp_path / "beispiel.sqlite")
    at = app(pfad)
    _ohne_fehler(at)
    assert downloads, "Die App hat keine CSV an den Download-Knopf übergeben."
    text = downloads[-1].decode("utf-8-sig")
    assert MARKER not in text
    assert "/media/" not in text and "<p>" not in text
    zeilen = list(csv.reader(io.StringIO(text), delimiter=";"))
    assert len(zeilen) == 1 + 21
    assert all(z[0].startswith('="') and z[0].endswith('"') for z in zeilen[1:])  # IDs als Excel-Text


def test_ende_zu_ende_keine_inhalte_im_dashboard(app, tmp_path, downloads):
    # Posts mit Text, Link, Medien-URLs, Alt-Texten und Vorschaukarte, gespeichert über die echte Klassifikation.
    at = app(baue_inhalts_db(tmp_path / "inhalt.sqlite"))
    _ohne_fehler(at)
    assert _metriken(at)["Posts"] == "5"
    alles = _alles(at)
    assert "jemand" in alles  # Quell-Konto erscheint (erlaubte Metadaten); die Prüfung sieht also Inhalte
    for verboten in INHALT_VERBOTEN:
        assert verboten not in alles, verboten
    assert downloads
    csv_text = downloads[-1].decode("utf-8-sig")
    for verboten in INHALT_VERBOTEN:
        assert verboten not in csv_text, verboten
    assert "2026-09-20 11:00:00" in csv_text  # Erstellzeit des ersten Posts: die Datei ist nicht leer
