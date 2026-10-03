"""Regeln der Datenbankschicht: 24h-Snapshots, Einfrieren, Edits, Abdeckung, Löschmarker, Idempotenz."""

import sqlite3
from datetime import UTC, datetime, timedelta

import pytest

from truthtracker import db, zeit
from truthtracker.modelle import (
    FORMAT_NUR_TEXT,
    TYP_EIGEN,
    TYP_RETRUTH,
    MedienDaten,
    PostDaten,
    QuellKonto,
    TextMetriken,
    Zaehler,
)

T0 = datetime(2026, 10, 2, 12, 0, tzinfo=UTC)


def _id(dt: datetime, n: int = 1) -> str:
    return str(zeit.id_untergrenze(dt) + n)


def _post(dt: datetime, **extra) -> PostDaten:
    werte = dict(
        id=_id(dt), url=f"https://truthsocial.com/@realDonaldTrump/{_id(dt)}", created_at=dt, typ=TYP_EIGEN,
        format=FORMAT_NUR_TEXT, text=TextMetriken(zeichen=10, zeichen_ohne_urls=10, text_hash="a" * 64),
        fingerabdruck="f" * 64, zaehler=Zaehler(1, 2, 3, {"upvotes_count": 3}),
    )
    werte.update(extra)
    return PostDaten(**werte)


@pytest.fixture
def con(tmp_path):
    verbindung = db.oeffne(tmp_path / "t.sqlite")
    yield verbindung
    verbindung.close()


def _lauf(con, t: datetime) -> int:
    return db.lauf_starten(con, t, backfill=False)


def test_schema_und_pragmas(con):
    assert con.execute("PRAGMA secure_delete").fetchone()[0] == 1
    assert con.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert db.meta_lesen(con, "schema_version") == str(db.SCHEMA_VERSION)


def test_snapshot_regel_unter_24h_jeder_lauf_danach_eingefroren(con):
    post = _post(T0)
    for stunden, erwartet in ((1, True), (5, True), (23.9, True), (24.1, False), (48, False)):
        lauf = _lauf(con, T0 + timedelta(hours=stunden))
        db.post_speichern(con, post, lauf_id=lauf, gesehen=T0 + timedelta(hours=stunden), backfill=False)
        assert db.snapshot_speichern(
            con, post, lauf_id=lauf, gemessen=T0 + timedelta(hours=stunden), grenze_h=24
        ) is erwartet, stunden
    alter = [r[0] for r in con.execute("SELECT alter_h FROM snapshots ORDER BY gemessen_utc")]
    assert alter == pytest.approx([1, 5, 23.9])
    final = con.execute("SELECT alter_h, likes FROM post_final WHERE post_id = ?", (post.id,)).fetchone()
    assert final["alter_h"] == pytest.approx(23.9) and final["likes"] == 3
    db.friere_ein(con, T0 + timedelta(hours=48), 24)
    assert db.post_lesen(con, post.id)["eingefroren"] == 1


def test_erstmals_nach_24h_genau_ein_snapshot(con):
    post = _post(T0 - timedelta(days=3))
    for stunden in (0, 1, 30):
        lauf = _lauf(con, T0 + timedelta(hours=stunden))
        db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=True)
        db.snapshot_speichern(con, post, lauf_id=lauf, gemessen=T0 + timedelta(hours=stunden), grenze_h=24)
    zeilen = con.execute("SELECT alter_h FROM snapshots").fetchall()
    assert len(zeilen) == 1 and zeilen[0][0] == pytest.approx(72)
    assert db.post_lesen(con, post.id)["eingefroren"] == 1


def test_ein_snapshot_pro_lauf(con):
    post = _post(T0)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    assert db.snapshot_speichern(con, post, lauf_id=lauf, gemessen=T0 + timedelta(hours=1), grenze_h=24)
    assert not db.snapshot_speichern(con, post, lauf_id=lauf, gemessen=T0 + timedelta(hours=2), grenze_h=24)


def test_retruth_zaehler_getrennt(con):
    post = _post(T0, typ=TYP_RETRUTH, original_id=_id(T0 - timedelta(hours=5)),
                 zaehler=Zaehler(0, 0, 2), zaehler_original=Zaehler(10, 20, 30, {"quotes_count": 4}))
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    db.snapshot_speichern(con, post, lauf_id=lauf, gemessen=T0, grenze_h=24)
    s = con.execute("SELECT * FROM snapshots").fetchone()
    assert (s["replies"], s["retruths"], s["likes"]) == (0, 0, 2)
    assert (s["orig_replies"], s["orig_retruths"], s["orig_likes"]) == (10, 20, 30)
    assert s["orig_weitere"] == '{"quotes_count": 4}'


def test_post_speichern_idempotent_und_aenderungen(con):
    post = _post(T0)
    lauf = _lauf(con, T0)
    erst = db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    zweit = db.post_speichern(con, post, lauf_id=lauf, gesehen=T0 + timedelta(minutes=1), backfill=False)
    assert erst.neu and not zweit.neu and not zweit.geaendert and not zweit.edit_erkannt
    assert db.zaehle(con, "posts") == 1
    assert db.post_lesen(con, post.id)["zuerst_gesehen_utc"] == zeit.utc_text(T0)


def test_edit_ueber_edited_at_und_fingerabdruck(con):
    post = _post(T0)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    geaendert = _post(T0, text=TextMetriken(zeichen=12, text_hash="b" * 64))
    erg = db.post_speichern(con, geaendert, lauf_id=lauf, gesehen=T0 + timedelta(hours=1), backfill=False)
    assert erg.edit_erkannt
    mit_zeit = _post(T0, text=TextMetriken(zeichen=12, text_hash="b" * 64), edited_at=T0 + timedelta(hours=2))
    erg = db.post_speichern(con, mit_zeit, lauf_id=lauf, gesehen=T0 + timedelta(hours=3), backfill=False)
    assert erg.edit_erkannt
    arten = [r[0] for r in con.execute("SELECT art FROM edits ORDER BY id")]
    assert arten == ["fingerabdruck", "edited_at"]
    assert db.post_lesen(con, post.id)["edit_anzahl"] == 2


def test_edit_anzahl_aus_version(con):
    post = _post(T0, edited_at=T0 + timedelta(minutes=7), revision=3)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0 + timedelta(hours=1), backfill=False)
    zeile = db.post_lesen(con, post.id)
    assert zeile["edit_anzahl"] == 2
    assert [r["art"] for r in con.execute("SELECT art FROM edits")] == ["edited_at"]


def test_nachgereichte_medien_hashes_sind_kein_edit(con):
    offen = MedienDaten(position=0, medien_id="m1", art="bild", hash_status="fehler")
    post = _post(T0, medien=[offen], n_bilder=1, medien_vollstaendig=False, medien_hash=None, fingerabdruck=None)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    fertig = MedienDaten(position=0, medien_id="m1", art="bild", sha256="c" * 64, phash="0" * 16, hash_status="ok")
    nachher = _post(T0, medien=[fertig], n_bilder=1, medien_vollstaendig=True, medien_hash="d" * 64)
    erg = db.post_speichern(con, nachher, lauf_id=lauf, gesehen=T0 + timedelta(hours=1), backfill=False)
    assert not erg.edit_erkannt and erg.geaendert
    assert db.post_lesen(con, post.id)["medien_vollstaendig"] == 1
    # Ein späterer Fehlschlag überschreibt vorhandene Hashes nicht.
    erg = db.post_speichern(con, post, lauf_id=lauf, gesehen=T0 + timedelta(hours=2), backfill=False)
    zeile = db.post_lesen(con, post.id)
    assert zeile["medien_hash"] == "d" * 64 and zeile["medien_vollstaendig"] == 1
    assert con.execute("SELECT sha256 FROM medien").fetchone()[0] == "c" * 64


def test_retruth_aenderung_ist_kein_edit(con):
    post = _post(T0, typ=TYP_RETRUTH, original_id="1")
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    anders = _post(T0, typ=TYP_RETRUTH, original_id="1", text=TextMetriken(text_hash="e" * 64))
    assert not db.post_speichern(con, anders, lauf_id=lauf, gesehen=T0, backfill=False).edit_erkannt


def test_quellen_erste_erfassung_bleibt_luecken_werden_gefuellt(con):
    post = _post(T0, quellen=[QuellKonto("retruth", "5", "jemand", "Jemand", None, 100, False)])
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    spaeter = _post(T0, quellen=[QuellKonto("retruth", "5", "jemand", "Jemand", True, 999, False)], zaehler=Zaehler(9))
    db.post_speichern(con, spaeter, lauf_id=lauf, gesehen=T0, backfill=False)
    q = con.execute("SELECT * FROM quellen").fetchone()
    assert q["follower"] == 100 and q["verifiziert"] == 1


def test_abdeckung_verschmelzen_und_vollstaendigkeit(con):
    a = db.Bereich(100, 200)
    db.abdeckung_hinzufuegen(con, a)
    db.abdeckung_hinzufuegen(con, db.Bereich(300, 400))
    assert db.abdeckung_lesen(con) == [db.Bereich(300, 400), db.Bereich(100, 200)]
    db.abdeckung_hinzufuegen(con, db.Bereich(201, 299))  # angrenzend: alles wird eins
    assert db.abdeckung_lesen(con) == [db.Bereich(100, 400)]
    db.abdeckung_hinzufuegen(con, db.Bereich(0, 150, anfang_erreicht=True))
    assert db.abdeckung_lesen(con) == [db.Bereich(0, 400, True)]
    # zeitlich
    db.abdeckung_hinzufuegen(con, db.Bereich(zeit.id_untergrenze(T0 - timedelta(days=20)), zeit.id_obergrenze(T0)))
    assert db.abdeckung_vollstaendig(con, T0 - timedelta(days=14), T0)
    assert not db.abdeckung_vollstaendig(con, T0 - timedelta(days=30), T0)


def test_loeschmarker_und_wiederauftauchen(con):
    post = _post(T0)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    db.als_vermisst_markieren(con, post.id, T0 + timedelta(hours=1))
    db.als_vermisst_markieren(con, post.id, T0 + timedelta(hours=2))  # erster Zeitpunkt bleibt
    db.als_geloescht_markieren(con, post.id, T0 + timedelta(hours=3))
    z = db.post_lesen(con, post.id)
    assert z["geloescht"] == 1
    assert z["vermisst_seit_utc"] == zeit.utc_text(T0 + timedelta(hours=1))
    assert z["loeschung_bestaetigt_utc"] == zeit.utc_text(T0 + timedelta(hours=3))
    erg = db.post_speichern(con, post, lauf_id=lauf, gesehen=T0 + timedelta(hours=4), backfill=False)
    assert erg.war_geloescht
    z = db.post_lesen(con, post.id)
    assert z["geloescht"] == 0 and z["vermisst_seit_utc"] is None


def test_kandidaten_nur_im_bereich_und_fenster(con):
    lauf = _lauf(con, T0)
    posts = [_post(T0 - timedelta(days=d)) for d in (1, 3, 10)]
    for p in posts:
        db.post_speichern(con, p, lauf_id=lauf, gesehen=T0, backfill=False)
    kandidaten = db.kandidaten_fuer_loeschpruefung(
        con, von_id=int(posts[1].id), bis_id=int(posts[0].id), seit=T0 - timedelta(days=7), gesehen={posts[0].id}
    )
    assert kandidaten == [posts[1].id]


def test_abgestuerzte_laeufe_werden_markiert(con):
    lauf = _lauf(con, T0)
    assert db.markiere_abgestuerzte_laeufe(con) == 1
    z = con.execute("SELECT status, ende_utc FROM laeufe WHERE id = ?", (lauf,)).fetchone()
    # Ohne Zwischenstand bleibt das Ende leer; es ist nicht der Start des nächsten Laufs.
    assert z["status"] == "abgestuerzt" and z["ende_utc"] is None


def test_abgestuerzter_lauf_behaelt_letzten_zwischenstand(con):
    lauf = _lauf(con, T0)
    zaehler = db.LaufZaehler(anfragen_api=7, seiten=3, neue_posts=55)
    db.lauf_zwischenstand(con, lauf, zaehler=zaehler, jetzt=T0 + timedelta(minutes=4))
    assert db.markiere_abgestuerzte_laeufe(con) == 1
    z = con.execute("SELECT * FROM laeufe WHERE id = ?", (lauf,)).fetchone()
    assert z["status"] == "abgestuerzt"
    assert z["ende_utc"] == zeit.utc_text(T0 + timedelta(minutes=4))
    assert (z["anfragen_api"], z["seiten"], z["neue_posts"]) == (7, 3, 55)


def test_zwischenstand_aendert_beendete_laeufe_nicht(con):
    lauf = _lauf(con, T0)
    db.lauf_beenden(
        con, lauf, ende=T0 + timedelta(minutes=9), status="ok", zugriff="curl", abbruch_grund=None,
        zaehler=db.LaufZaehler(anfragen_api=12), meldungen=[], abgedeckt_von=None, abgedeckt_bis=None,
    )
    db.lauf_zwischenstand(con, lauf, zaehler=db.LaufZaehler(anfragen_api=1), jetzt=T0 + timedelta(hours=2))
    z = con.execute("SELECT * FROM laeufe WHERE id = ?", (lauf,)).fetchone()
    assert (z["anfragen_api"], z["ende_utc"]) == (12, zeit.utc_text(T0 + timedelta(minutes=9)))


@pytest.mark.parametrize("ordner", ["C# Projekte", "mit 50%25 Rabatt", "Daten%41b", "Max Mustermann"])
def test_nur_lesen_mit_sonderzeichen_im_pfad(tmp_path, ordner):
    pfad = tmp_path / ordner / "tracker.sqlite3"
    schreibend = db.oeffne(pfad)
    with schreibend:
        db.meta_schreiben(schreibend, "probe", "1")
    schreibend.close()
    vorher = sorted(p.name for p in tmp_path.rglob("*"))

    lesend = db.oeffne(pfad, nur_lesen=True)
    try:
        assert db.meta_lesen(lesend, "probe") == "1"
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            lesend.execute("INSERT INTO meta (schluessel, wert) VALUES ('x', 'y')")
    finally:
        lesend.close()
    nachher = sorted(p.name for p in tmp_path.rglob("*") if not p.name.endswith(("-wal", "-shm")))
    assert nachher == [n for n in vorher if not n.endswith(("-wal", "-shm"))]


def test_gepinnt_setzen(con):
    lauf = _lauf(con, T0)
    a, b = _post(T0), _post(T0 - timedelta(hours=1))
    for p in (a, b):
        db.post_speichern(con, p, lauf_id=lauf, gesehen=T0, backfill=False)
    db.gepinnt_setzen(con, [b.id])
    assert (db.post_lesen(con, a.id)["gepinnt"], db.post_lesen(con, b.id)["gepinnt"]) == (0, 1)
    db.gepinnt_setzen(con, [])
    assert db.post_lesen(con, b.id)["gepinnt"] == 0


def test_nur_lesen_kann_nicht_schreiben(tmp_path):
    pfad = tmp_path / "t.sqlite"
    db.oeffne(pfad).close()
    lesend = db.oeffne(pfad, nur_lesen=True)
    with pytest.raises(Exception):
        lesend.execute("INSERT INTO meta VALUES ('x', 'y')")
    lesend.close()


def test_unbekannter_gepinnt_status_ueberschreibt_nicht(con):
    post = _post(T0, gepinnt=True)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    erg = db.post_speichern(con, _post(T0, gepinnt=None), lauf_id=lauf, gesehen=T0, backfill=False)
    assert db.post_lesen(con, post.id)["gepinnt"] == 1 and not erg.geaendert


def test_relevante_aenderung_setzt_duplikat_pruefung_zurueck(con):
    post = _post(T0)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    con.execute("UPDATE posts SET dup_geprueft_utc = ?", (zeit.utc_text(T0),))
    db.post_speichern(con, _post(T0, zaehler=Zaehler(99)), lauf_id=lauf, gesehen=T0, backfill=False)
    assert db.post_lesen(con, post.id)["dup_geprueft_utc"] == zeit.utc_text(T0)  # Zähler sind egal
    db.post_speichern(con, _post(T0, text=TextMetriken(text_hash="9" * 64)), lauf_id=lauf, gesehen=T0, backfill=False)
    assert db.post_lesen(con, post.id)["dup_geprueft_utc"] is None


def test_fehlgeschlagener_medienabruf_ist_keine_aenderung(con):
    fertig = MedienDaten(position=0, medien_id="1", art="bild", sha256="c" * 64, phash="0" * 16, hash_status="ok")
    post = _post(T0, medien=[fertig], n_bilder=1, medien_hash="d" * 64)
    lauf = _lauf(con, T0)
    db.post_speichern(con, post, lauf_id=lauf, gesehen=T0, backfill=False)
    kaputt = MedienDaten(position=0, medien_id="1", art="bild", hash_status="fehler")
    erg = db.post_speichern(con, _post(T0, medien=[kaputt], n_bilder=1, medien_hash=None, medien_vollstaendig=False,
                                       fingerabdruck=None), lauf_id=lauf, gesehen=T0, backfill=False)
    assert not erg.geaendert and not erg.edit_erkannt
