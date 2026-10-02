"""Ganze Läufe gegen den lokalen API-Nachbau, mit simulierter Uhr.

Abgedeckt: Backfill beim ersten Lauf, Idempotenz, 24h-Snapshots und Einfrieren, Nachholen von
Lücken (auch nach abgebrochenem Lauf), Löschungen ohne falsche Treffer, gepinnte Posts,
Werbung, Replies-Modus, Edits, erneuter Medienversuch, keine Inhalte in der DB.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import timedelta

import pytest

from conftest import browser_argumente_fuer_tests, chromium_pfad, finde_marker
from fabrik import JETZT, MARKER, karte, konto, medium, retruth, status
from fake_truthsocial import FakeTruthSocial, Zustand
from truthtracker import crawler, db, zeit
from truthtracker.konfig import Konfig, PausenKonfig

FREMD = konto("108000000000000001", "jemand", "Jemand Anders", verifiziert=False, follower=1234)


class Uhr:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


def _konfig(url: str, tmp_path, **erfassung) -> Konfig:
    k = Konfig()
    k.basis_url = url
    k.basisordner = tmp_path
    k.speicher.datenbank = str(tmp_path / "daten" / "tracker.sqlite")
    k.speicher.exporte = str(tmp_path / "exporte")
    k.pausen = PausenKonfig(0, 0, 0, 0)
    k.zugriff.weg = "curl"
    k.zugriff.replies_anderer = "aus"  # eigene Tests decken "auto" und "an" ab
    for name, wert in erfassung.items():
        setattr(k.erfassung, name, wert)
    k.pruefe()
    return k


def _lauf(k: Konfig, uhr: Uhr) -> crawler.LaufErgebnis:
    return crawler.fuehre_lauf_aus(k, uhr=uhr, melden=lambda _text: None)


def _con(k: Konfig) -> sqlite3.Connection:
    return db.oeffne(k.datenbank_pfad)


def _ids(k: Konfig, bedingung: str = "1=1") -> set[str]:
    con = _con(k)
    try:
        return {z[0] for z in con.execute(f"SELECT id FROM posts WHERE {bedingung}")}
    finally:
        con.close()


def _zeitreihe(anzahl: int, abstand: timedelta, start=JETZT, **extra) -> list[dict]:
    return [status(start - abstand * i, **extra) for i in range(anzahl)]


def _anfragen(fake: FakeTruthSocial, muster: str = "") -> list[dict]:
    return [a for a in fake.zustand.api_anfragen() if muster in a["pfad"]]


# ---------------------------------------------------------------------------
# Erster Lauf, Idempotenz


def test_erster_lauf_holt_vier_wochen_und_markiert_backfill(tmp_path):
    z = Zustand()
    posts = _zeitreihe(8 * 7 * 6, timedelta(hours=4))  # sechs Wochen, alle 4 Stunden
    z.setze_posts(posts)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(minutes=5)))
        anfragen = _anfragen(fake)
    assert ergebnis.status == "ok", ergebnis.meldungen
    grenze = JETZT - timedelta(weeks=4)
    erwartet = {p["id"] for p in posts if zeit.parse_utc(p["created_at"]) >= grenze}
    gespeichert = _ids(k)
    assert erwartet <= gespeichert
    # Höchstens eine Seite (40 Posts) über die Grenze hinaus
    assert len(gespeichert - erwartet) < 40
    con = _con(k)
    try:
        jung = con.execute("SELECT backfill, eingefroren FROM posts WHERE created_at_utc >= ?",
                           (zeit.utc_text(JETZT - timedelta(hours=20)),)).fetchall()
        alt = con.execute("SELECT backfill, eingefroren FROM posts WHERE created_at_utc <= ?",
                          (zeit.utc_text(JETZT - timedelta(days=2)),)).fetchall()
        assert jung and all(r["backfill"] == 0 and r["eingefroren"] == 0 for r in jung)
        assert alt and all(r["backfill"] == 1 and r["eingefroren"] == 1 for r in alt)
        # Jeder Post genau ein Snapshot mit passendem Alter
        assert con.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0] == len(gespeichert)
        s = con.execute("SELECT alter_h FROM snapshots s JOIN posts p ON p.id = s.post_id WHERE p.id = ?",
                        (posts[0]["id"],)).fetchone()
        assert s["alter_h"] == pytest.approx(5 / 60, abs=0.01)
        konto_snap = con.execute("SELECT * FROM konto_snapshots").fetchall()
        assert len(konto_snap) == 1 and konto_snap[0]["follower"] == 11_000_000
        lauf = con.execute("SELECT * FROM laeufe").fetchone()
        assert lauf["status"] == "ok" and lauf["backfill"] == 1
        assert lauf["anfragen_api"] == len(anfragen)
        assert lauf["neue_posts"] == len(gespeichert)
        bereiche = db.abdeckung_lesen(con)
        assert len(bereiche) == 1 and bereiche[0].von <= zeit.id_untergrenze(grenze)
    finally:
        con.close()
    # Timeline wurde mit exclude_replies=true bzw. Probe abgefragt, nie parallel (Server zählt sequenziell)
    assert all(a["params"].get("limit") == "40" for a in anfragen if a["pfad"].endswith("/statuses")
               and "pinned" not in a["params"])


def test_zwei_laeufe_hintereinander_sind_idempotent(tmp_path):
    z = Zustand()
    posts = _zeitreihe(60, timedelta(hours=2))
    z.setze_posts(posts)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT + timedelta(minutes=1)))
        con = _con(k)
        vorher_posts = db.zaehle(con, "posts")
        vorher_snaps = db.zaehle(con, "snapshots")
        con.close()
        zweiter = _lauf(k, Uhr(JETZT + timedelta(minutes=3)))
    assert zweiter.status == "ok"
    assert zweiter.zaehler.neue_posts == 0
    con = _con(k)
    try:
        assert db.zaehle(con, "posts") == vorher_posts
        jung = sum(1 for p in posts if zeit.parse_utc(p["created_at"]) > JETZT + timedelta(minutes=3) - timedelta(hours=24))
        assert db.zaehle(con, "snapshots") == vorher_snaps + jung
        doppelt = con.execute("SELECT post_id, lauf_id, COUNT(*) c FROM snapshots GROUP BY 1, 2 HAVING c > 1").fetchall()
        assert doppelt == []
    finally:
        con.close()


# ---------------------------------------------------------------------------
# 24h-Logik


def test_snapshots_bis_24h_dann_eingefroren(tmp_path):
    z = Zustand()
    juenger = status(JETZT - timedelta(hours=1), zaehler=(1, 2, 3))
    z.setze_posts([juenger, *(_zeitreihe(5, timedelta(days=1), start=JETZT - timedelta(days=1)))])
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.posts[juenger["id"]].update(replies_count=10, reblogs_count=20, favourites_count=30)
        _lauf(k, Uhr(JETZT + timedelta(hours=10)))
        z.posts[juenger["id"]].update(replies_count=99, reblogs_count=99, favourites_count=99)
        _lauf(k, Uhr(JETZT + timedelta(hours=30)))
    con = _con(k)
    try:
        snaps = con.execute("SELECT alter_h, likes FROM snapshots WHERE post_id = ? ORDER BY gemessen_utc",
                            (juenger["id"],)).fetchall()
        assert [round(s["alter_h"], 1) for s in snaps] == [1.0, 11.0]
        assert [s["likes"] for s in snaps] == [3, 30]
        final = con.execute("SELECT alter_h, likes FROM post_final WHERE post_id = ?", (juenger["id"],)).fetchone()
        assert final["likes"] == 30 and round(final["alter_h"], 1) == 11.0
        assert con.execute("SELECT eingefroren FROM posts WHERE id = ?", (juenger["id"],)).fetchone()[0] == 1
    finally:
        con.close()


def test_erstmals_gesehen_nach_24h_genau_ein_snapshot(tmp_path):
    z = Zustand()
    z.setze_posts(_zeitreihe(3, timedelta(hours=6)))
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        spaet = status(JETZT + timedelta(hours=1))
        z.posts[spaet["id"]] = spaet
        # Drei Tage nicht gecrawlt: der Post ist beim ersten Sehen 50 h alt.
        _lauf(k, Uhr(JETZT + timedelta(hours=51)))
        _lauf(k, Uhr(JETZT + timedelta(hours=52)))
    con = _con(k)
    try:
        snaps = con.execute("SELECT alter_h FROM snapshots WHERE post_id = ?", (spaet["id"],)).fetchall()
        assert [round(s[0]) for s in snaps] == [50]
        zeile = db.post_lesen(con, spaet["id"])
        assert zeile["backfill"] == 0 and zeile["eingefroren"] == 1
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Lücken


def test_mehrtaegige_luecke_wird_nachgeholt(tmp_path):
    z = Zustand()
    z.setze_posts(_zeitreihe(30, timedelta(hours=3)))
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        neue = [status(JETZT + timedelta(hours=1 + 2 * i)) for i in range(60)]  # fünf Tage
        for p in neue:
            z.posts[p["id"]] = p
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(days=5, hours=2)))
    assert ergebnis.status == "ok"
    assert {p["id"] for p in neue} <= _ids(k)
    assert ergebnis.zaehler.neue_posts == 60
    con = _con(k)
    try:
        assert len(db.abdeckung_lesen(con)) == 1
    finally:
        con.close()


def test_abgebrochener_backfill_wird_im_naechsten_lauf_fertig(tmp_path):
    z = Zustand()
    posts = _zeitreihe(6 * 7 * 5, timedelta(hours=4))  # fünf Wochen
    z.setze_posts(posts)
    z.ratelimit_ab = 4  # Lookup, Pinned, Seite 1, dann 429
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        erster = _lauf(k, Uhr(JETZT))
        assert erster.status == "abgebrochen" and erster.abbruch_grund == "ratelimit"
        assert len(_anfragen(fake)) == 4  # nach dem 429 keine weitere Anfrage
        assert len(_ids(k)) == 40
        z.ratelimit_ab = None
        zweiter = _lauf(k, Uhr(JETZT + timedelta(hours=1)))
    assert zweiter.status == "ok"
    grenze = JETZT - timedelta(weeks=4)
    erwartet = {p["id"] for p in posts if zeit.parse_utc(p["created_at"]) >= grenze}
    assert erwartet <= _ids(k)
    con = _con(k)
    try:
        assert len(db.abdeckung_lesen(con)) == 1
        lauf1 = con.execute("SELECT * FROM laeufe WHERE id = 1").fetchone()
        assert lauf1["status"] == "abgebrochen" and lauf1["abbruch_grund"] == "ratelimit"
        assert "Abbruch" in lauf1["meldungen"]
    finally:
        con.close()


def test_luecke_in_der_mitte_nach_abgebrochenem_lauf(tmp_path):
    z = Zustand()
    z.setze_posts(_zeitreihe(40, timedelta(hours=4)))
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        neue = [status(JETZT + timedelta(hours=1, minutes=30 * i)) for i in range(200)]  # gut vier Tage
        for p in neue:
            z.posts[p["id"]] = p
        z.ratelimit_ab = len(z.api_anfragen()) + 4  # Lookup, Pinned, Seite 1, dann 429
        abbruch = _lauf(k, Uhr(JETZT + timedelta(days=4, hours=6)))
        assert abbruch.status == "abgebrochen"
        con = _con(k)
        assert len(db.abdeckung_lesen(con)) == 2  # oben 40 neue, darunter die Lücke, dann der alte Bereich
        con.close()
        z.ratelimit_ab = None
        _lauf(k, Uhr(JETZT + timedelta(days=4, hours=7)))
    assert {p["id"] for p in neue} <= _ids(k)
    con = _con(k)
    try:
        assert len(db.abdeckung_lesen(con)) == 1
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Löschungen


def _basis_mit_posts(z: Zustand, tage: int = 12) -> list[dict]:
    posts = _zeitreihe(tage * 4, timedelta(hours=6))
    z.setze_posts(posts)
    return posts


def _post_im_alter(posts: list[dict], stunden: float) -> dict:
    return min(posts, key=lambda p: abs((JETZT - zeit.parse_utc(p["created_at"])).total_seconds() / 3600 - stunden))


def test_geloeschter_post_wird_erkannt(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 48)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=3)))
    assert ergebnis.zaehler.geloescht_erkannt == 1
    con = _con(k)
    try:
        zeile = db.post_lesen(con, opfer["id"])
        assert zeile["geloescht"] == 1
        assert zeile["vermisst_seit_utc"] == zeit.utc_text(JETZT + timedelta(hours=3))
        assert zeile["zuletzt_gesehen_utc"] == zeit.utc_text(JETZT)
        pruef = con.execute("SELECT ergebnis, http_status FROM loeschpruefungen").fetchall()
        assert [(p["ergebnis"], p["http_status"]) for p in pruef] == [("geloescht", 404)]
        assert db.zaehle(con, "posts") == len(_ids(k))
        assert con.execute("SELECT COUNT(*) FROM posts WHERE geloescht = 1").fetchone()[0] == 1
    finally:
        con.close()


def test_keine_loeschpruefung_ausserhalb_des_fensters(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    alt = _post_im_alter(posts, 24 * 10)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(alt["id"])
        vorher = len(z.api_anfragen())
        _lauf(k, Uhr(JETZT + timedelta(hours=3)))
        einzel = [a for a in z.api_anfragen()[vorher:] if "/api/v1/statuses/" in a["pfad"]]
    assert einzel == []
    assert db.post_lesen(_con(k), alt["id"])["geloescht"] == 0


def test_abgebrochene_pagination_erzeugt_keine_loeschung(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 24 * 5)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        k.zugriff.seitengroesse = 10  # eine Seite reicht 2,5 Tage zurück
        z.ratelimit_ab = len(z.api_anfragen()) + 4  # Lookup, Pinned, Seite 1, dann 429
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=1)))
    assert ergebnis.status == "abgebrochen"
    zeile = db.post_lesen(_con(k), opfer["id"])
    assert zeile["geloescht"] == 0 and zeile["vermisst_seit_utc"] is None


def test_seitengrenze_erzeugt_keine_loeschung(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 24 * 5)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        k.zugriff.seitengroesse = 10
        k.erfassung.max_seiten_pro_lauf = 1  # Notbremse greift nach einer Seite
        _lauf(k, Uhr(JETZT + timedelta(hours=1)))
    zeile = db.post_lesen(_con(k), opfer["id"])
    assert zeile["geloescht"] == 0 and zeile["vermisst_seit_utc"] is None


def test_netzwerkfehler_bei_einzelpruefung_ist_unklar_und_wird_spaeter_bestaetigt(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 30)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        z.abbruch_pfade = [r"^/api/v1/statuses/\d+$"]
        zweiter = _lauf(k, Uhr(JETZT + timedelta(hours=2)))
        zeile = db.post_lesen(_con(k), opfer["id"])
        assert zweiter.zaehler.geloescht_erkannt == 0
        assert zeile["geloescht"] == 0 and zeile["vermisst_seit_utc"] == zeit.utc_text(JETZT + timedelta(hours=2))
        z.abbruch_pfade = []
        _lauf(k, Uhr(JETZT + timedelta(hours=5)))
    zeile = db.post_lesen(_con(k), opfer["id"])
    assert zeile["geloescht"] == 1
    assert zeile["vermisst_seit_utc"] == zeit.utc_text(JETZT + timedelta(hours=2))
    assert zeile["loeschung_bestaetigt_utc"] == zeit.utc_text(JETZT + timedelta(hours=5))


def test_404_ohne_json_und_serverfehler_sind_keine_loeschung(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 30)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        z.fehler_pfade = {r"^/api/v1/statuses/\d+$": 404}  # HTML-404, z. B. vom CDN
        _lauf(k, Uhr(JETZT + timedelta(hours=1)))
        z.fehler_pfade = {r"^/api/v1/statuses/\d+$": 502}
        _lauf(k, Uhr(JETZT + timedelta(hours=2)))
    con = _con(k)
    try:
        assert db.post_lesen(con, opfer["id"])["geloescht"] == 0
        ergebnisse = [r[0] for r in con.execute("SELECT ergebnis FROM loeschpruefungen")]
        assert ergebnisse == ["unklar", "unklar"]
    finally:
        con.close()


def test_challenge_bei_loeschpruefung_bricht_ab_ohne_weitere_anfragen(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = [_post_im_alter(posts, 30), _post_im_alter(posts, 60)]
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.update(p["id"] for p in opfer)
        z.challenge_pfade = [r"^/api/v1/statuses/\d+$"]
        vorher = len(z.anfragen)
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=1)))
        danach = z.anfragen[vorher:]
    assert ergebnis.status == "abgebrochen" and ergebnis.abbruch_grund == "challenge"
    assert "/api/v1/statuses/" in danach[-1]["pfad"]
    assert sum(1 for a in danach if "/api/v1/statuses/" in a["pfad"]) == 1
    con = _con(k)
    try:
        assert con.execute("SELECT COUNT(*) FROM posts WHERE geloescht = 1").fetchone()[0] == 0
        lauf = con.execute("SELECT * FROM laeufe ORDER BY id DESC").fetchone()
        assert lauf["cloudflare_challenges"] == 1 and lauf["status"] == "abgebrochen"
    finally:
        con.close()


def test_geloeschter_thread_reply_ist_unklar_weil_einzelabruf_login_braucht(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    eltern = _post_im_alter(posts, 40)
    thread = status(JETZT - timedelta(hours=39), antwort_auf_status=eltern)
    z.posts[thread["id"]] = thread
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        assert thread["id"] in _ids(k)
        z.geloescht.add(thread["id"])
        _lauf(k, Uhr(JETZT + timedelta(hours=1)))
    zeile = db.post_lesen(_con(k), thread["id"])
    assert zeile["reply_art"] == "thread"
    assert zeile["geloescht"] == 0 and zeile["vermisst_seit_utc"] is not None


def test_wieder_aufgetauchter_post_ist_nicht_mehr_geloescht(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    opfer = _post_im_alter(posts, 30)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.geloescht.add(opfer["id"])
        _lauf(k, Uhr(JETZT + timedelta(hours=1)))
        assert db.post_lesen(_con(k), opfer["id"])["geloescht"] == 1
        z.geloescht.discard(opfer["id"])
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=2)))
    zeile = db.post_lesen(_con(k), opfer["id"])
    assert zeile["geloescht"] == 0 and zeile["vermisst_seit_utc"] is None
    assert any("wieder sichtbar" in m for m in ergebnis.meldungen)


def test_replies_an_andere_sind_keine_loeschkandidaten_wenn_ausgeschlossen(tmp_path):
    z = Zustand()
    posts = _basis_mit_posts(z)
    fremd_post = status(JETZT - timedelta(days=3), autor=FREMD)
    z.posts[fremd_post["id"]] = fremd_post
    antwort = status(JETZT - timedelta(hours=30), antwort_auf_status=fremd_post)
    z.posts[antwort["id"]] = antwort
    z.login_regeln = False  # erster Lauf: Server liefert Replies (wie bei hemmendinger beobachtet)
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        k.zugriff.replies_anderer = "an"
        _lauf(k, Uhr(JETZT))
        assert antwort["id"] in _ids(k)
        z.login_regeln = True  # jetzt nur noch mit exclude_replies=true
        vorher = len(z.anfragen)
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=1)))
        einzel = [a for a in z.anfragen[vorher:] if "/api/v1/statuses/" in a["pfad"]]
    assert ergebnis.status == "ok"
    assert einzel == []
    assert db.post_lesen(_con(k), antwort["id"])["vermisst_seit_utc"] is None
    assert any("ohne Login" in m for m in ergebnis.meldungen)


# ---------------------------------------------------------------------------
# Gepinnt, Werbung, Replies-Modus


def test_alter_gepinnter_post_stoert_die_erkennung_neuer_posts_nicht(tmp_path):
    z = Zustand()
    posts = _zeitreihe(30, timedelta(hours=5))
    gepinnt = status(JETZT - timedelta(days=200), gepinnt=True)
    z.setze_posts([*posts, gepinnt])
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        neu = [status(JETZT + timedelta(hours=1 + i)) for i in range(5)]
        for p in neu:
            z.posts[p["id"]] = p
        k.zugriff.seitengroesse = 10
        zweiter = _lauf(k, Uhr(JETZT + timedelta(hours=7)))
    assert zweiter.status == "ok"
    assert {p["id"] for p in neu} <= _ids(k)
    con = _con(k)
    try:
        assert db.post_lesen(con, gepinnt["id"])["gepinnt"] == 1
        assert db.post_lesen(con, posts[0]["id"])["gepinnt"] == 0
        # Zählte der 200 Tage alte gepinnte Post oben auf Seite 1 mit, endete die Pagination nach
        # einer Seite. Richtig: weiter bis zur Untergrenze des Lösch-Fensters (35 Posts / 10 pro Seite).
        lauf2 = con.execute("SELECT seiten, abgedeckt_von_utc FROM laeufe WHERE id = 2").fetchone()
        assert lauf2["seiten"] >= 4
        assert zeit.parse_utc(lauf2["abgedeckt_von_utc"]) <= JETZT + timedelta(hours=7) - timedelta(days=7)
    finally:
        con.close()


def test_werbung_in_der_timeline_wird_uebersprungen(tmp_path):
    z = Zustand()
    posts = _zeitreihe(10, timedelta(hours=5))
    werbung = status(JETZT + timedelta(days=30), autor=FREMD)  # fremde, "neuere" ID mitten in Seite 1
    werbung["sponsored"] = True
    z.setze_posts(posts)
    z.werbung = [werbung]
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        ergebnis = _lauf(k, Uhr(JETZT))
    assert ergebnis.status == "ok"
    assert werbung["id"] not in _ids(k)
    assert {p["id"] for p in posts} <= _ids(k)
    assert any("Werbe" in m for m in ergebnis.meldungen)


def test_replies_modus_auto_merkt_sich_die_sperre(tmp_path):
    z = Zustand()
    z.setze_posts(_zeitreihe(10, timedelta(hours=5)))
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        k.zugriff.replies_anderer = "auto"
        erster = _lauf(k, Uhr(JETZT))
        timeline1 = [a for a in _anfragen(fake, "/statuses") if "pinned" not in a["params"]]
        assert timeline1[0]["params"]["exclude_replies"] == "false"
        assert timeline1[1]["params"]["exclude_replies"] == "true"
        vorher = len(z.anfragen)
        _lauf(k, Uhr(JETZT + timedelta(days=1)))
        timeline2 = [a for a in z.anfragen[vorher:] if a["pfad"].endswith("/statuses") and "pinned" not in a["params"]]
    assert erster.status == "ok"
    assert all(a["params"]["exclude_replies"] == "true" for a in timeline2)
    meta = db.meta_lesen(_con(k), "replies_anderer_probe")
    assert meta.startswith("0|")


# ---------------------------------------------------------------------------
# Edits, Medien, Duplikate, Datenschutz


def test_edit_wird_erkannt_und_gezaehlt(tmp_path):
    z = Zustand()
    posts = _zeitreihe(5, timedelta(hours=5))
    z.setze_posts(posts)
    ziel = posts[1]
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        z.posts[ziel["id"]] = dict(ziel, content=f"<p>{MARKER} geänderter Text</p>",
                                   edited_at=zeit.utc_text(JETZT + timedelta(minutes=30)))
        ergebnis = _lauf(k, Uhr(JETZT + timedelta(hours=1)))
        _lauf(k, Uhr(JETZT + timedelta(hours=2)))  # unverändert: kein weiterer Edit
    assert ergebnis.zaehler.edits_erkannt == 1
    con = _con(k)
    try:
        zeile = db.post_lesen(con, ziel["id"])
        assert zeile["edit_anzahl"] == 1
        edits = con.execute("SELECT art, edited_at_utc FROM edits").fetchall()
        assert [(e["art"], e["edited_at_utc"]) for e in edits] == [
            ("beides", zeit.utc_text(JETZT + timedelta(minutes=30)))
        ]
    finally:
        con.close()


def test_medien_werden_gehasht_und_bei_fehler_spaeter_nachgeholt(tmp_path):
    z = Zustand()
    posts = _zeitreihe(240, timedelta(hours=2))  # 20 Tage; Lauf 2 paginiert nur die letzten 7 Tage
    mit_bild = status(JETZT - timedelta(days=12, hours=1), medien=[medium("image", datei="bild-a.png")])
    z.setze_posts([*posts, mit_bild])
    z.fehler_pfade = {r"^/media/": 503}
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        _lauf(k, Uhr(JETZT))
        zeile = db.post_lesen(_con(k), mit_bild["id"])
        assert zeile["medien_vollstaendig"] == 0 and zeile["medien_hash"] is None
        z.fehler_pfade = {}
        vorher = len(z.anfragen)
        _lauf(k, Uhr(JETZT + timedelta(hours=2)))
        einzel = [a for a in z.anfragen[vorher:] if a["pfad"] == f"/api/v1/statuses/{mit_bild['id']}"]
    assert len(einzel) == 1  # zwölf Tage alt: außerhalb des Lösch-Fensters, aber im Duplikat-Fenster
    con = _con(k)
    try:
        zeile = db.post_lesen(con, mit_bild["id"])
        assert zeile["medien_vollstaendig"] == 1 and zeile["medien_hash"]
        medium_zeile = con.execute("SELECT * FROM medien WHERE post_id = ?", (mit_bild["id"],)).fetchone()
        assert medium_zeile["hash_status"] == "ok" and len(medium_zeile["phash"]) == 16
    finally:
        con.close()


def test_duplikate_im_lauf(tmp_path):
    z = Zustand()
    original = status(JETZT - timedelta(days=3), autor=FREMD, medien=[medium("image", datei="gleich.png")])
    erst = retruth(JETZT - timedelta(days=2), original)
    zweit = retruth(JETZT - timedelta(hours=5), original)
    text_a = status(JETZT - timedelta(days=1), text=f"{MARKER} gleicher Satz", medien=[medium("image", datei="x.png")])
    text_b = status(JETZT - timedelta(hours=3), text=f"{MARKER} gleicher Satz", medien=[medium("image", datei="x.png")])
    z.setze_posts([erst, zweit, text_a, text_b, *_zeitreihe(5, timedelta(hours=7), start=JETZT - timedelta(hours=1))])
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        ergebnis = _lauf(k, Uhr(JETZT))
    assert ergebnis.duplikate is not None and ergebnis.duplikate.mit_duplikat >= 2
    con = _con(k)
    try:
        d = {(r["post_id"], r["art"]): r for r in con.execute("SELECT * FROM duplikate")}
        assert (zweit["id"], "gleiches_original") in d
        assert d[(zweit["id"], "gleiches_original")]["frueherer_post_id"] == erst["id"]
        assert (text_b["id"], "exakt") in d
        assert d[(text_b["id"], "exakt")]["abstand_s"] == 21 * 3600
    finally:
        con.close()


def test_keine_inhalte_in_der_datenbank(tmp_path, eigene_laufzeit):
    z = Zustand()
    fremd_post = status(JETZT - timedelta(days=2), autor=FREMD, medien=[medium("video", dauer=12.0)])
    z.setze_posts([
        status(JETZT - timedelta(hours=1), karte_=karte(), hashtags=["SYNTHETIKTAG"],
               text=f'{MARKER} Text mit <a href="https://example.com/{MARKER}-pfad">Link</a>'),
        status(JETZT - timedelta(hours=2), medien=[medium("image"), medium("gifv", dauer=3.0)]),
        retruth(JETZT - timedelta(hours=3), fremd_post),
        status(JETZT - timedelta(hours=4), quote=fremd_post, text=f"{MARKER} Quote-Text"),
        status(JETZT - timedelta(hours=5), antwort_auf_status=status(JETZT - timedelta(hours=6))),
    ])
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        ergebnis = _lauf(k, Uhr(JETZT))
    assert ergebnis.status == "ok", ergebnis.meldungen
    pfad = k.datenbank_pfad
    assert finde_marker(pfad.parent, eigene_laufzeit / "laufzeit") == []
    roh = b"".join(p.read_bytes() for p in pfad.parent.iterdir() if p.is_file())
    for verboten in (b"/media/", b"<p>", b"static-assets", b"avatars", b"Kartentitel", b"Alternativtext", b"-pfad"):
        assert verboten not in roh, verboten
    con = _con(k)
    try:
        domains = {r[0] for r in con.execute("SELECT link_domains FROM posts")}
        assert '["example.com"]' in domains
        quellen = con.execute("SELECT rolle, handle, follower, ist_trump FROM quellen ORDER BY rolle").fetchall()
        assert {(q["rolle"], q["handle"]) for q in quellen} >= {("retruth", "jemand"), ("quote", "jemand")}
    finally:
        con.close()


@pytest.mark.browser
def test_auto_wechselt_bei_challenge_in_den_browser(tmp_path, eigene_laufzeit):
    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    z = Zustand()
    z.setze_posts(_zeitreihe(20, timedelta(hours=3)))
    z.challenge_ohne_cookie = True
    z.challenge_verzoegerung_ms = 1500
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        k.zugriff.weg = "auto"
        k.zugriff.browser = str(exe)
        k.zugriff.headless = True
        k.zugriff.browser_argumente = browser_argumente_fuer_tests()
        k.zugriff.warte_challenge_s = 30
        ergebnis = _lauf(k, Uhr(JETZT))
    assert ergebnis.status == "ok", ergebnis.meldungen
    assert ergebnis.zugriff == "curl+browser"
    assert ergebnis.zaehler.cloudflare_challenges >= 2  # einmal bei curl, einmal im Browser gesehen
    assert len(_ids(k)) == 20
    profil = eigene_laufzeit / "laufzeit" / "browser-profil"
    erlaubt = {"Cookies", "Cookies-journal", "Local State", "Preferences", "Secure Preferences", "First Run",
               "Last Version", "Last Browser"}
    uebrig = [p for p in profil.rglob("*") if p.is_file()]
    assert all(p.name in erlaubt for p in uebrig), uebrig
    assert not any((eigene_laufzeit / "laufzeit" / "tmp").glob("*"))


def test_konfig_fehlerhaftes_lookup_ohne_gespeicherte_id_ist_fehler(tmp_path):
    z = Zustand()
    z.konten = {}
    with FakeTruthSocial(z) as fake:
        k = _konfig(fake.url, tmp_path)
        ergebnis = _lauf(k, Uhr(JETZT))
    assert ergebnis.status == "fehler"
    assert any("ließ sich nicht abrufen" in m for m in ergebnis.meldungen)
    lauf = _con(k).execute("SELECT status, meldungen FROM laeufe").fetchone()
    assert lauf["status"] == "fehler" and json.loads(lauf["meldungen"])
