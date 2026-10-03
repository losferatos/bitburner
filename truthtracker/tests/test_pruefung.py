"""Prüfskript: findet Inhaltsreste in DB-Spalten, Rohdateien, Logs, Temp-Ordner, Browserprofil,
Exporten und Spike-Berichten, meldet saubere Ablagen als sauber, verändert nichts und gibt die
gefundenen Inhalte nie aus. Alle Daten sind synthetisch (Marker ``SYNTHETIK``)."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import random
import sqlite3
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from fabrik import JETZT, MARKER, TRUMP_ID, snowflake
from truthtracker import cloudflare, db, pfade, pruefung, zeit
from truthtracker.konfig import Konfig, PausenKonfig
from truthtracker.modelle import (
    FORMAT_MEDIEN_TEXT,
    FORMAT_NUR_TEXT,
    HASH_OK,
    MEDIUM_BILD,
    REPLY_THREAD,
    ROLLE_REPLY,
    ROLLE_RETRUTH,
    TYP_EIGEN,
    TYP_RETRUTH,
    MedienDaten,
    PostDaten,
    QuellKonto,
    TextMetriken,
    Zaehler,
)
from truthtracker.pruefung import (
    ART_BINAER,
    ART_CACHE,
    ART_FREITEXT,
    ART_FREMDE_URL,
    ART_HTML,
    ART_MARKER,
    ART_MEDIEN_URL,
    ART_NICHT_PRUEFBAR,
    ART_PROFILDATEI,
    ART_TEMP,
    ART_UNERWARTET,
)

HTML_REST = f"<p>{MARKER} geschmuggelter Beitrag</p>"
MEDIEN_URL = (
    "https://static-assets-1.truthsocial.com/tmtg:prime-ts-assets/media_attachments/files/115/000/001/original/"
    "synthetik123.jpg"
)
FREITEXT = f"{MARKER} lorem ipsum dolor sit amet consectetur adipiscing elit sed eiusmod tempor"
# Erfundener Satz nur aus englischen Allerweltswörtern: Er darf nicht unter der Schwelle bleiben, nur
# weil solche Wörter auch irgendwo im Quelltext stehen.
ALLTAGSSATZ = f"{MARKER} This is not the time to stop, we have to keep going and get it done for all of you"
WORTLISTE = [MARKER, "eins", "zwei", "drei", "vier", "fuenf", "sechs", "sieben", "acht", "neun"]
FREMDE_URL = f"https://example.com/{MARKER}-artikel"
# Bruchstücke des Geschmuggelten, die in keinem Bericht auftauchen dürfen (Musternamen wie
# "static-assets" sind erlaubt, der konkrete Host mit Pfad nicht).
VERBOTEN_IM_BERICHT = (
    MARKER, "geschmuggelter", "static-assets-1.truthsocial.com", "synthetik123", "lorem", "example.com", "going",
    "fuenf",
)


def _hex(saat: str, laenge: int = 64) -> str:
    return hashlib.sha256(saat.encode()).hexdigest()[:laenge]


@pytest.fixture
def k(tmp_path) -> Konfig:
    return Konfig(basisordner=tmp_path)


def _saubere_db(k: Konfig) -> dict[str, str]:
    """Eine Datenbank, wie der Crawler sie füllt: alle Tabellen, nur Metadaten."""
    t_eigen, t_retruth, t_reply = JETZT - timedelta(hours=2), JETZT - timedelta(hours=3), JETZT - timedelta(hours=1)
    eigen_id, retruth_id, reply_id = snowflake(t_eigen, 1), snowflake(t_retruth, 2), snowflake(t_reply, 3)
    original_id = snowflake(t_retruth - timedelta(hours=1), 4)
    medium = MedienDaten(
        position=0, medien_id="114000000000000001", art=MEDIUM_BILD, breite=1200, hoehe=800,
        sha256=_hex("bild"), phash=_hex("phash", 16), hash_quelle="original", hash_status=HASH_OK,
    )
    eigen = PostDaten(
        id=eigen_id, url=f"https://truthsocial.com/@realDonaldTrump/{eigen_id}", created_at=t_eigen, typ=TYP_EIGEN,
        format=FORMAT_MEDIEN_TEXT, n_bilder=1, hat_karte=True, sichtbarkeit="public", revision=1,
        text=TextMetriken(zeichen=120, zeichen_ohne_urls=97, n_urls=1, n_mentions=1,
                          link_domains=["example.org", "nachrichten.example.net"], text_hash=_hex("text")),
        medien_hash=_hex("medien"), fingerabdruck=_hex("fingerabdruck"),
        zaehler=Zaehler(10, 20, 30, weitere={"upvotes_count": 30, "downvotes_count": 0}), medien=[medium],
    )
    retruth = PostDaten(
        id=retruth_id, url=f"https://truthsocial.com/@jemand/{original_id}", created_at=t_retruth, typ=TYP_RETRUTH,
        original_id=original_id, original_created_at=t_retruth - timedelta(hours=1), retruth_latenz_s=3600,
        format=FORMAT_NUR_TEXT, text=TextMetriken(zeichen=40, zeichen_ohne_urls=40, text_hash=_hex("retruth")),
        fingerabdruck=_hex("fp-retruth"), zaehler=Zaehler(0, 0, 0),
        zaehler_original=Zaehler(5, 6, 7, weitere={"quotes_count": 2}),
        quellen=[QuellKonto(ROLLE_RETRUTH, "108000000000000001", "jemand", "Jemand Anders 🇺🇸", False, 1234)],
    )
    reply = PostDaten(
        id=reply_id, url=f"https://truthsocial.com/@realDonaldTrump/{reply_id}", created_at=t_reply, typ=TYP_EIGEN,
        ist_reply=True, reply_art=REPLY_THREAD, in_reply_to_id=eigen_id, format=FORMAT_NUR_TEXT,
        text=TextMetriken(zeichen=12, zeichen_ohne_urls=12, text_hash=_hex("reply")), fingerabdruck=_hex("fp-reply"),
        quellen=[QuellKonto(ROLLE_REPLY, TRUMP_ID, "realDonaldTrump", "Donald J. Trump", True, 11_000_000, True)],
    )
    con = db.oeffne(k.datenbank_pfad)
    try:
        lauf = db.lauf_starten(con, JETZT, backfill=True)
        db.konto_snapshot_speichern(con, lauf, TRUMP_ID, JETZT, follower=11_000_000, folgt=70, posts_gesamt=30_000)
        for post in (eigen, retruth, reply):
            db.post_speichern(con, post, lauf_id=lauf, gesehen=JETZT, backfill=False)
            db.snapshot_speichern(con, post, lauf_id=lauf, gemessen=JETZT, grenze_h=24)
        bearbeitet = PostDaten(**{**eigen.__dict__, "edited_at": JETZT, "revision": 2,
                                  "text": TextMetriken(zeichen=121, text_hash=_hex("text-neu"))})
        db.post_speichern(con, bearbeitet, lauf_id=lauf, gesehen=JETZT + timedelta(minutes=1), backfill=False)
        db.medien_cache_speichern(
            con, "114000000000000001", MEDIUM_BILD, _hex("bild"), _hex("phash", 16), "original", JETZT
        )
        db.loeschpruefung_protokollieren(con, reply_id, lauf, JETZT, "unklar", cloudflare.LOGIN_NOETIG, 401)
        db.als_vermisst_markieren(con, reply_id, JETZT)
        db.abdeckung_hinzufuegen(con, db.Bereich(int(retruth_id), int(reply_id)))
        with con:
            con.execute(
                "INSERT INTO duplikate (post_id, art, frueherer_post_id, abstand_s, primaer, details) "
                "VALUES (?, 'medien_aehnlich', ?, 3600, 1, ?)",
                (reply_id, eigen_id, json.dumps({"phash_abstand_max": 3})),
            )
            db.meta_schreiben(con, "konto_id", TRUMP_ID)
            db.meta_schreiben(con, "replies_anderer_probe", f"0|{zeit.utc_text(JETZT)}")
        ratelimit = cloudflare.Bewertung(cloudflare.RATELIMIT, 429, hinweis="120")
        db.lauf_beenden(
            con, lauf, ende=JETZT + timedelta(minutes=5), status="ok", zugriff="curl+browser", abbruch_grund=None,
            zaehler=db.LaufZaehler(anfragen_api=7, seiten=2, neue_posts=3),
            abgedeckt_von=t_retruth, abgedeckt_bis=t_reply,
            meldungen=[
                f"Gepinnte Posts nicht abrufbar ({cloudflare.melde(ratelimit)}); Gepinnt-Status bleibt unverändert.",
                "Die Duplikat-Prüfung ist fehlgeschlagen (Details im Log).",
            ],
        )
    finally:
        con.close()
    return {"eigen": eigen_id, "retruth": retruth_id, "reply": reply_id}


def _schmuggle(k: Konfig, sql: str, parameter: tuple = ()) -> None:
    con = sqlite3.connect(k.datenbank_pfad)
    try:
        with con:
            con.execute(sql, parameter)
    finally:
        con.close()


def _schreibe(pfad: Path, text: str) -> Path:
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_text(text, encoding="utf-8")
    return pfad


def _log(wurzel: Path, *zeilen: str) -> Path:
    return _schreibe(wurzel / "laufzeit" / "logs" / "crawl-2026-10-02.log", "\n".join(zeilen) + "\n")


def _ohne_inhalt(bericht: pruefung.Pruefbericht, text: str = "") -> None:
    gesamt = text + "".join(f"{f.ort} {f.hinweis}" for f in bericht.funde)
    for verboten in VERBOTEN_IM_BERICHT:
        assert verboten not in gesamt, verboten


def _hat(bericht: pruefung.Pruefbericht, art: str, ort_anfang: str) -> bool:
    return any(f.art == art and f.ort.startswith(ort_anfang) for f in bericht.funde)


SAUBERES_LOG = (
    "2026-10-02 12:00:00,001 INFO    truthtracker.crawler: Lauf 3 gestartet",
    f"2026-10-02 12:00:05,002 INFO    truthtracker.crawler: Konto-Snapshot gespeichert (Konto {TRUMP_ID})",
    "2026-10-02 12:00:09,003 INFO    truthtracker.crawler: Timeline-Seite nicht abrufbar "
    f"({cloudflare.melde(cloudflare.Bewertung(cloudflare.RATELIMIT, 429, hinweis='120'))}); die Abdeckung endet hier.",
    f"2026-10-02 12:00:09,004 INFO    truthtracker.transport: https://truthsocial.com/api/v1/accounts/{TRUMP_ID}"
    "/statuses?exclude_replies=true&with_muted=true&limit=40",
    "2026-10-02 12:00:10,005 INFO    truthtracker.crawler: Löschung bestätigt: Post 115312345678901234 "
    "(https://truthsocial.com/@realDonaldTrump/115312345678901234)",
    "2026-10-02 12:00:10,006 INFO    truthtracker.transport: Browser gestartet: Opera 120.0.5543.61",
    "2026-10-02 12:00:11,007 ERROR   truthtracker.crawler: Duplikat-Prüfung fehlgeschlagen",
    "Traceback (most recent call last):",
    '  File "C:\\Tracker\\src\\truthtracker\\crawler.py", line 420, in _duplikate',
    "    lauf.dup_bericht = duplikate.aktualisiere_duplikate(con, konfig, betroffene_ids=ids, jetzt=jetzt)",
    '  File "C:\\Python312\\Lib\\sqlite3\\dbapi2.py", line 99, in execute',
    "    return self.connection.cursor().execute(statement, parameters or (), timeout=configured_timeout_value)",
    "sqlite3.OperationalError: database is locked",
)


# ---------------------------------------------------------------------------
# Datenbank


def test_saubere_datenbank_ist_sauber(k):
    _saubere_db(k)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["db_vorhanden"] == 1
    assert bericht.geprueft["db_tabellen"] == 12
    assert bericht.geprueft["db_werte"] > 60
    assert bericht.geprueft["db_rohdateien"] == 1  # nach dem Schließen ohne -wal/-shm


def test_html_in_einer_spalte_wird_gefunden(k):
    _saubere_db(k)
    _schmuggle(k, "UPDATE quellen SET anzeigename = ? WHERE rolle = 'retruth'", (HTML_REST,))
    bericht = pruefung.pruefe(k)
    assert _hat(bericht, ART_HTML, "quellen.anzeigename[")
    assert _hat(bericht, ART_HTML, "daten/truthtracker.sqlite")  # auch in der Rohdatei
    _ohne_inhalt(bericht)


def test_medien_url_in_einer_spalte_wird_gefunden(k):
    _saubere_db(k)
    _schmuggle(k, "UPDATE posts SET link_domains = ?", (json.dumps([MEDIEN_URL]),))
    bericht = pruefung.pruefe(k)
    assert _hat(bericht, ART_MEDIEN_URL, "posts.link_domains[")
    assert _hat(bericht, ART_MEDIEN_URL, "daten/truthtracker.sqlite")
    _ohne_inhalt(bericht)


@pytest.mark.parametrize(
    ("sql", "wert", "art", "ort"),
    [
        ("UPDATE posts SET sichtbarkeit = ?", FREITEXT, ART_FREITEXT, "posts.sichtbarkeit["),
        ("UPDATE posts SET format = ?", f"{MARKER} kurz", ART_UNERWARTET, "posts.format["),
        ("UPDATE posts SET typ_detail = ?", "Don&#39;t", ART_HTML, "posts.typ_detail["),
        ("UPDATE posts SET url = ?", "https://example.com/@realDonaldTrump/1", ART_FREMDE_URL, "posts.url["),
        ("UPDATE posts SET text_hash = ?", "kein-hash", ART_UNERWARTET, "posts.text_hash["),
        ("UPDATE laeufe SET meldungen = ?", json.dumps([f"Siehe {FREMDE_URL}"]), ART_FREMDE_URL, "laeufe.meldungen["),
        ("UPDATE laeufe SET meldungen = ?", json.dumps([FREITEXT]), ART_FREITEXT, "laeufe.meldungen["),
        ("UPDATE laeufe SET meldungen = ?", json.dumps([ALLTAGSSATZ]), ART_FREITEXT, "laeufe.meldungen["),
        ("UPDATE snapshots SET weitere = ?", json.dumps({"titel": "lorem"}), ART_UNERWARTET, "snapshots.weitere["),
        ("UPDATE meta SET wert = ? WHERE schluessel = 'konto_id'", "lorem ipsum", ART_UNERWARTET, "meta.wert["),
        ("UPDATE quellen SET anzeigename = ?", b"\x00\x01SYNTHETIK", ART_BINAER, "quellen.anzeigename["),
        ("UPDATE quellen SET anzeigename = ?", ALLTAGSSATZ, ART_FREITEXT, "quellen.anzeigename["),
        # Schlagwortlisten, als harmlose Einzelwerte verkleidet
        ("UPDATE posts SET link_domains = ?", json.dumps(WORTLISTE), ART_FREITEXT, "posts.link_domains["),
        ("UPDATE posts SET link_domains = ?", json.dumps(["synthetik", "kurz"]), ART_UNERWARTET, "posts.link_domains["),
        ("UPDATE meta SET wert = ? WHERE schluessel = 'konto_id'", json.dumps(WORTLISTE), ART_FREITEXT, "meta.wert["),
        ("UPDATE meta SET wert = ? WHERE schluessel = 'konto_id'", "|".join(WORTLISTE), ART_FREITEXT, "meta.wert["),
        ("UPDATE meta SET wert = ? WHERE schluessel = 'konto_id'", json.dumps({w: 1 for w in WORTLISTE}),
         ART_FREITEXT, "meta.wert["),
        ("UPDATE snapshots SET weitere = ?", json.dumps({w: 1 for w in WORTLISTE}), ART_FREITEXT, "snapshots.weitere["),
        ("UPDATE snapshots SET weitere = ?", json.dumps({"synthetik": 1}), ART_UNERWARTET, "snapshots.weitere["),
        ("UPDATE duplikate SET details = ?", json.dumps({w.lower(): 1 for w in WORTLISTE}), ART_FREITEXT,
         "duplikate.details["),
        ("UPDATE posts SET sichtbarkeit = ?", "_".join(WORTLISTE[:9]), ART_FREITEXT, "posts.sichtbarkeit["),
    ],
)
def test_werte_ausserhalb_der_positivliste_werden_gefunden(k, sql, wert, art, ort):
    _saubere_db(k)
    _schmuggle(k, sql, (wert,))
    bericht = pruefung.pruefe(k)
    assert _hat(bericht, art, ort), bericht.funde
    _ohne_inhalt(bericht)


def test_schlagwortliste_in_einer_neuen_spalte_wird_gefunden(k):
    _saubere_db(k)
    _schmuggle(k, "ALTER TABLE posts ADD COLUMN hashtags TEXT")
    _schmuggle(k, "UPDATE posts SET hashtags = ?", (json.dumps(["SYNTHETIKTAG", "eins"]),))
    assert pruefung.pruefe(k).ok  # zwei Wörter sind kein Freitext
    _schmuggle(k, "UPDATE posts SET hashtags = ?", (json.dumps(WORTLISTE),))
    bericht = pruefung.pruefe(k)
    assert {(f.ort.split("[")[0], f.art) for f in bericht.funde} == {("posts.hashtags", ART_FREITEXT)}
    _ohne_inhalt(bericht)


def test_erlaubte_metadaten_mit_vielen_teilen_bleiben_sauber(k):
    """Viele Link-Domains, Zähler und ein Anzeigename mit acht Wörtern sind Metadaten, keine Wortlisten."""
    _saubere_db(k)
    domains = sorted(f"{name}.example.org" for name in WORTLISTE[1:])
    _schmuggle(k, "UPDATE posts SET link_domains = ?", (json.dumps(domains + ["10.0.0.1", "xn--bcher-kva.example"]),))
    zaehler = {f"{name}_count": 1 for name in ("upvotes", "downvotes", "quotes", "reactions", "group_reblogs")}
    _schmuggle(k, "UPDATE snapshots SET weitere = ?", (json.dumps(zaehler),))
    _schmuggle(k, "UPDATE quellen SET anzeigename = ?", ("Eins Zwei Drei Vier Fünf Sechs Sieben Acht 🇺🇸",))
    _schmuggle(k, "UPDATE meta SET wert = ? WHERE schluessel = 'konto_id'", ("0|2026-10-02T12:00:00Z|curl_cffi",))
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde


def test_rest_in_freier_seite_und_wal_wird_in_der_rohdatei_gefunden(k):
    _saubere_db(k)
    con = sqlite3.connect(k.datenbank_pfad)
    con.execute("PRAGMA secure_delete = OFF")
    try:
        with con:
            con.execute("INSERT INTO meta (schluessel, wert) VALUES ('rest', ?)", (HTML_REST + " lorem" * 200,))
        with con:
            con.execute("DELETE FROM meta WHERE schluessel = 'rest'")
        bei_offener_db = pruefung.pruefe(k)
    finally:
        con.close()  # letzte Verbindung: Checkpoint schreibt die Seite samt Rest in die Hauptdatei
    danach = pruefung.pruefe(k)
    assert _hat(bei_offener_db, ART_HTML, "daten/truthtracker.sqlite-wal")
    assert any(f.art == ART_HTML and f.ort == "daten/truthtracker.sqlite" for f in danach.funde)
    assert not any(f.ort.startswith("meta.") for f in bei_offener_db.funde + danach.funde)
    _ohne_inhalt(danach)


def test_loeschen_mit_secure_delete_hinterlaesst_keinen_rest(k):
    _saubere_db(k)
    con = db.oeffne(k.datenbank_pfad)
    try:
        with con:
            con.execute("INSERT INTO meta (schluessel, wert) VALUES ('rest', ?)", (HTML_REST + " lorem" * 200,))
        with con:
            con.execute("DELETE FROM meta WHERE schluessel = 'rest'")
    finally:
        con.close()
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde


def test_ohne_datenbank_wird_der_rest_trotzdem_geprueft(k, eigene_laufzeit):
    _log(eigene_laufzeit, HTML_REST)
    bericht = pruefung.pruefe(k)
    assert bericht.geprueft["db_vorhanden"] == 0
    assert _hat(bericht, ART_HTML, "logs/")
    assert "keine Datenbankdatei gefunden" in pruefung.bericht_text(bericht)


# ---------------------------------------------------------------------------
# Logs, Temp, Profil, Exporte, Spike-Berichte


def test_typisches_log_ist_sauber(k, eigene_laufzeit):
    _log(eigene_laufzeit, *SAUBERES_LOG)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["log_dateien"] == 1
    assert bericht.geprueft["log_zeilen"] == len(SAUBERES_LOG)


@pytest.mark.parametrize(
    ("zeile", "art"),
    [
        (f"Post 1153: {HTML_REST}", ART_HTML),
        (f"Medium geladen: {MEDIEN_URL}", ART_MEDIEN_URL),
        ("Medium geladen: https://truthsocial.com/media/original/synthetik123.png", ART_MEDIEN_URL),
        (f"Link: {FREMDE_URL}", ART_FREMDE_URL),
        (f"Link: http://127.0.0.1:8080/{MARKER}-artikel", ART_FREMDE_URL),
        (f"Text: {FREITEXT}", ART_FREITEXT),
        (f"Post 115312345678901234: {ALLTAGSSATZ}", ART_FREITEXT),
    ],
)
def test_log_mit_inhaltsrest_wird_gefunden(k, eigene_laufzeit, zeile, art):
    _log(eigene_laufzeit, SAUBERES_LOG[0], f"2026-10-02 12:00:01,000 INFO    truthtracker.crawler: {zeile}")
    bericht = pruefung.pruefe(k)
    assert [(f.ort, f.art) for f in bericht.funde] == [("logs/crawl-2026-10-02.log:2", art)]
    _ohne_inhalt(bericht)


def test_wortschatz_besteht_aus_meldungen_nicht_aus_bezeichnern():
    """Englische Allerweltswörter kommen in Bezeichnern, SQL und Cloudflare-Markern vor, aber kaum in Meldungen."""
    wortschatz = pruefung._wortschatz()
    allerwelt = (
        "the be to of and in that have it for not on with he as you do at this but his by from they we say her "
        "she or an will my one all would there their what so up out if about who get which go me when make can "
        "like time no just him know take people into year your good some could them see other than then now look"
    ).split()
    assert sum(w in wortschatz for w in allerwelt) <= 15, sorted(w for w in allerwelt if w in wortschatz)
    for eigenes in ("lauf", "gestartet", "abgebrochen", "löschung".casefold(), "cloudflare", "retry"):
        assert eigenes in wortschatz, eigenes
    assert pruefung._unbekannte_woerter(ALLTAGSSATZ) > pruefung.FREITEXT_SCHWELLE


def test_tracebacks_pfade_und_devtools_adressen_im_log_sind_sauber(k, eigene_laufzeit):
    """Ein abgebrochener Browser-Lauf: Playwright nennt die lokale DevTools-Adresse, Python verkettete Fehler."""
    zeilen = (
        "2026-10-02 12:00:11,007 ERROR   truthtracker.crawler: Unerwarteter Fehler im Lauf",
        "Traceback (most recent call last):",
        '  File "C:\\Tracker\\src\\truthtracker\\browser.py", line 324, in starte_browser',
        '    info = _hole_lokal(f"http://127.0.0.1:{port}/json/version")',
        "PermissionError: [Errno 13] Permission denied: "
        "'C:\\\\Users\\\\Nutzer\\\\Documents\\\\Tracker\\\\laufzeit\\\\browser-profil\\\\Default\\\\Cookies'",
        "",
        "During handling of the above exception, another exception occurred:",
        "",
        "Traceback (most recent call last):",
        '  File "C:\\Tracker\\src\\truthtracker\\transport.py", line 270, in _starte',
        "    self._browser = pw.chromium.connect_over_cdp(self._lauf.cdp_url)",
        "playwright._impl._errors.Error: BrowserType.connect_over_cdp: connect ECONNREFUSED 127.0.0.1:9222",
        "Call log:",
        "  - <ws preparing> retrieving websocket url from http://127.0.0.1:9222",
        "  - <ws connecting> ws://127.0.0.1:9222/devtools/browser/5f1c2a9e-0000-4000-8000-000000000000",
        "",
        "The above exception was the direct cause of the following exception:",
        "",
        "OSError: [Errno 2] No such file or directory: '/home/nutzer/tracker/laufzeit/tmp/lauf-3/bild.bin'",
    )
    _log(eigene_laufzeit, *zeilen)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde


def _sperre_ordner(monkeypatch: pytest.MonkeyPatch, gesperrt: Path) -> None:
    """``os.scandir`` (und damit ``os.walk``) scheitert für einen Ordner wie bei fehlenden Rechten."""
    echt = os.scandir

    def scandir(pfad="."):
        if Path(pfad) == gesperrt:
            raise PermissionError(13, "Zugriff verweigert", str(pfad))
        return echt(pfad)

    monkeypatch.setattr(os, "scandir", scandir)


@pytest.mark.parametrize(
    ("ordner", "ort"),
    [
        ("logs", "logs"),
        ("tmp/lauf-1", "tmp/lauf-1"),
        ("browser-profil/Default", "browser-profil/Default"),
        ("browser-profil/Default/Cache/Cache_Data", "browser-profil/Default/Cache/Cache_Data"),
        ("exporte", "exporte"),
    ],
)
def test_ordner_der_sich_nicht_auflisten_laesst_ist_nicht_pruefbar(k, eigene_laufzeit, monkeypatch, ordner, ort):
    _log(eigene_laufzeit, *SAUBERES_LOG)
    profil = _profil(eigene_laufzeit)
    _schreibe(profil / "Default" / "Cache" / "Cache_Data" / "f_000001", f"{MARKER} Bilddaten")
    (eigene_laufzeit / "laufzeit" / "tmp" / "lauf-1").mkdir(parents=True)
    _export(k, "1;https://truthsocial.com/@realDonaldTrump/1;2026-10-02 12:00:00;Retruth;;;1")
    wurzel = k.export_ordner.parent if ordner == "exporte" else eigene_laufzeit / "laufzeit"
    _sperre_ordner(monkeypatch, wurzel / ordner)
    bericht = pruefung.pruefe(k)
    assert (ort, ART_NICHT_PRUEFBAR) in {(f.ort, f.art) for f in bericht.funde}, bericht.funde
    assert not bericht.ok
    if ordner.endswith("Cache_Data"):
        # Der Cache-Ordner zählt nicht als leer, nur weil sich sein Inhalt nicht auflisten ließ.
        assert not any(f.art == ART_CACHE for f in bericht.funde)
    _ohne_inhalt(bericht)


def test_unlesbare_dateien_sind_nicht_pruefbar(k, eigene_laufzeit, monkeypatch):
    _saubere_db(k)
    _log(eigene_laufzeit, *SAUBERES_LOG)
    _profil(eigene_laufzeit)
    pruefung._wortschatz()  # liest den Quelltext; vor dem Sperren füllen
    temp = eigene_laufzeit / "laufzeit" / "tmp"
    echt_lesen, echt_ist_datei, echt_ist_ordner = Path.read_text, Path.is_file, Path.is_dir

    def read_text(self, *args, **kwargs):
        if self.name in ("crawl-2026-10-02.log", "Preferences"):
            raise PermissionError(13, "Zugriff verweigert", str(self))
        return echt_lesen(self, *args, **kwargs)

    def is_file(self):
        if self.name == "truthtracker.sqlite-wal":
            raise PermissionError(13, "Zugriff verweigert", str(self))
        return echt_ist_datei(self)

    def is_dir(self):
        if self == temp:  # schon das Nachsehen scheitert, nicht erst das Auflisten
            raise PermissionError(13, "Zugriff verweigert", str(self))
        return echt_ist_ordner(self)

    monkeypatch.setattr(Path, "read_text", read_text)
    monkeypatch.setattr(Path, "is_file", is_file)
    monkeypatch.setattr(Path, "is_dir", is_dir)
    bericht = pruefung.pruefe(k)
    assert {(f.ort, f.art) for f in bericht.funde} == {
        ("logs/crawl-2026-10-02.log", ART_NICHT_PRUEFBAR),
        ("browser-profil/Default/Preferences", ART_NICHT_PRUEFBAR),
        ("daten/truthtracker.sqlite-wal", ART_NICHT_PRUEFBAR),
        ("tmp", ART_NICHT_PRUEFBAR),
    }
    assert "Nicht prüfbar (4)" in pruefung.bericht_text(bericht)


def test_datei_im_temp_ordner_wird_gefunden_leere_ordner_nicht(k, eigene_laufzeit):
    temp = eigene_laufzeit / "laufzeit" / "tmp"
    (temp / "lauf-1" / "leer").mkdir(parents=True)
    assert pruefung.pruefe(k).ok
    (temp / "lauf-2").mkdir()
    (temp / "lauf-2" / "rest.bin").write_bytes(b"\x89PNG" + MARKER.encode())
    bericht = pruefung.pruefe(k)
    assert [(f.ort, f.art) for f in bericht.funde] == [("tmp/lauf-2/rest.bin", ART_TEMP)]


def _profil(wurzel: Path) -> Path:
    profil = wurzel / "laufzeit" / "browser-profil"
    cookies = profil / "Default" / "Network" / "Cookies"
    cookies.parent.mkdir(parents=True)
    cookies.write_bytes(b"SQLite format 3\x00" + MARKER.encode())  # Cookies werden nicht inhaltlich geprüft
    _schreibe(profil / "Local State", json.dumps({"os_crypt": {"encrypted_key": "c3ludGhldGlzY2g="}}))
    einstellungen = {
        "profile": {"exit_type": "Normal", "content_settings": {"exceptions": {"site_engagement": {
            "https://static-assets-1.truthsocial.com:443,*": {}, "https://truthsocial.com:443,*": {},
        }}}},
    }
    _schreibe(profil / "Default" / "Preferences", json.dumps(einstellungen))
    (profil / "Default" / "Code Cache").mkdir()  # leerer Cache-Ordner hält nichts
    return profil


def test_profil_nur_mit_cookies_und_einstellungen_ist_sauber(k, eigene_laufzeit):
    _profil(eigene_laufzeit)
    bericht = pruefung.pruefe(k, marker=[MARKER])
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["profil_dateien"] == 3
    assert bericht.geprueft["profil_textdateien"] == 2


def test_profil_mit_cache_verlauf_oder_medien_url_wird_gefunden(k, eigene_laufzeit):
    profil = _profil(eigene_laufzeit)
    _schreibe(profil / "Default" / "Cache" / "Cache_Data" / "f_000001", f"{MARKER} Bilddaten")
    _schreibe(profil / "Default" / "Cache" / "Cache_Data" / "index", "")
    (profil / "Default" / "History").write_bytes(b"SQLite format 3\x00")
    _schreibe(profil / "Default" / "Secure Preferences", json.dumps({"zuletzt": MEDIEN_URL}))
    bericht = pruefung.pruefe(k)
    funde = {(f.ort, f.art) for f in bericht.funde}
    assert funde == {
        ("browser-profil/Default/Cache", ART_CACHE),
        ("browser-profil/Default/History", ART_PROFILDATEI),
        ("browser-profil/Default/Secure Preferences", ART_MEDIEN_URL),
    }
    cache = next(f for f in bericht.funde if f.art == ART_CACHE)
    assert "2 Dateien" in cache.hinweis
    _ohne_inhalt(bericht)


ERWEITERUNG = "ahfgeienlihckogmohjhadlkjgocpleb"


def _b64(zufall: random.Random, laenge: int) -> str:
    return base64.b64encode(zufall.randbytes(laenge)).decode()


def _einstellungen() -> dict:
    """``Preferences`` eines Chromium-Profils (Opera, Chrome, Edge) nach ein paar Läufen.

    Struktur echt, Werte erfunden."""
    zufall = random.Random(1)
    t = "13370000000000000"
    druckvorschau = {
        "version": 2, "isHeaderFooterEnabled": False, "isCssBackgroundEnabled": True,
        "recentDestinations": [{"id": "Save as PDF", "origin": "local", "account": "", "displayName": "Save as PDF",
                                "extensionId": "", "extensionName": "", "icon": "cr:insert-drive-file"}],
        "mediaSize": {"height_microns": 297000, "width_microns": 210000, "name": "ISO_A4", "custom_display_name": "A4"},
    }
    vorschlaege = ["", ["wetter morgen", "bundesliga tabelle", "bahn streik aktuell"], ["", "", ""], [],
                   {"google:clientdata": {"bpc": False, "tlw": False}, "google:suggesttype": ["QUERY"] * 3,
                    "google:verbatimrelevance": 851}]
    return {
        "accessibility": {"captions": {"headless_caption_enabled": False}},
        "browser": {
            "has_seen_welcome_page": True,
            "window_placement": {"bottom": 1040, "left": 10, "maximized": False, "right": 1290, "top": 10,
                                 "work_area_bottom": 1040, "work_area_left": 0, "work_area_right": 1920},
            "theme": {"color_scheme2": 2, "user_color2": -1},
        },
        "default_search_provider_data": {"template_url_data": {
            "keyword": "google.com", "short_name": "Google",
            "url": "{google:baseURL}search?q={searchTerms}&{google:RLZ}{google:originalQueryForSuggestion}"
                   "ie={inputEncoding}",
            "favicon_url": "https://www.google.com/images/branding/product/ico/googleg_lodp.ico",
        }},
        "devtools": {
            "adb_key": _b64(zufall, 1200),
            "preferences": {
                "currentDockState": '"right"', "panel-selectedTab": '"network"',
                "console-history": json.dumps(["document.title", "fetch('/api/v1/instance').then(r => r.json())"]),
                "InspectorView.splitViewState": json.dumps({"vertical": {"size": 0}}),
            },
        },
        "dns_prefetching": {
            "host_referral_list": [2, ["https://truthsocial.com/", ["https://static-assets-1.truthsocial.com/", 2.0]]],
            "startup_list": [1, "https://truthsocial.com/"],
        },
        "download": {"default_directory": "C:\\Users\\Max Mustermann\\Downloads", "directory_upgrade": True},
        "extensions": {
            "alerts": {"initialized": True}, "chrome_url_overrides": {}, "last_chrome_version": "120.0.5543.61",
            "settings": {ERWEITERUNG: {
                "active_permissions": {"api": ["management", "webstorePrivate"], "explicit_host": ["<all_urls>"],
                                       "manifest_permissions": [], "scriptable_host": []},
                "creation_flags": 1, "first_install_time": t, "location": 5,
                "manifest": {
                    "app": {"launch": {"web_url": "https://addons.example.org/"},
                            "urls": ["https://addons.example.org/"]},
                    # Ein ganzer Satz, aber vom Browser selbst: kein Inhaltsrest
                    "description": "Find useful apps, games, add-ons and colorful themes for this browser "
                                   "in one place.",
                    "content_security_policy": "script-src 'self' blob: filesystem:; object-src 'self'",
                    "icons": {"128": "store_icon_128.png", "16": "store_icon_16.png"},
                    "key": _b64(zufall, 294), "name": "Add-ons", "permissions": ["webstorePrivate", "management"],
                },
                "path": "C:\\Program Files\\Opera\\120.0.5543.61\\resources\\addons", "state": 1,
                "was_installed_by_default": False,
            }, "mhjfbmdgcfjbbpaeojofohoefgiehjai": {
                "location": 5,
                "manifest": {
                    "content_security_policy": "script-src 'self' 'wasm-eval' blob: filesystem: chrome://resources "
                                               "chrome://webui-test; object-src * blob: externalfile: file: "
                                               "filesystem: data:",
                    "description": "", "name": "PDF Viewer", "offline_enabled": True,
                },
                "path": "C:\\Program Files\\Opera\\120.0.5543.61\\resources\\pdf", "state": 1,
            }},
        },
        "gaia_cookie": {"changed_time": 1.7e9, "hash": "2jmj7l5rSw0yVb/vlWAYkK/YBwk=",
                        "last_list_accounts_data": '["gaia.l.a.r",[]]'},
        "intl": {"accept_languages": "de-DE,de,en-US,en", "selected_languages": "de-DE,de,en-US,en"},
        "media": {"device_id_salt": _hex("salz", 32), "engagement": {"schema_version": 5}},
        "net": {"network_prediction_options": 2},
        "ntp": {
            "custom_background_dict": {
                "attribution_line_1": "Foto von Jane Beispiel", "attribution_line_2": "Bergsee im Herbst",
                "background_url": "https://lh3.googleusercontent.com/bergsee=w3840-h2160-p-k-no-nd-mv",
                "collection_id": "landscapes",
            },
            "num_personal_suggestions": 2,
        },
        "opera": {
            "startpage": {"url": "opera://startpage/"},
            "sidebar": {"items": ["opera://bookmarks", "opera://history"]},
            "wallpaper": {"image": "https://wallpapers.example.org/bergsee-2560.jpg"},
        },
        "printing": {"print_preview_sticky_settings": {"appState": json.dumps(druckvorschau)}},
        "profile": {
            "avatar_index": 26, "created_by_version": "120.0.5543.61", "creation_time": t, "exit_type": "Normal",
            "managed_user_id": "", "name": "Person 1", "using_default_name": True,
            "content_settings": {"pref_version": 1, "exceptions": {
                "cookies": {"https://truthsocial.com:443,*": {"last_modified": t, "setting": 1}},
                "site_engagement": {"https://truthsocial.com:443,*": {"last_modified": t, "setting": {
                    "lastEngagementTime": 1.337e16, "pointsAddedToday": 3.0, "rawScore": 3.0}}},
                "app_banner": {"https://truthsocial.com:443,*": {"setting": {"https://truthsocial.com/": {
                    "couldShowBannerEvents": 1.337e16}}}},
            }},
        },
        "session": {"restore_on_startup": 4, "startup_urls": ["chrome://newtab/", "edge://settings/"]},
        "sessions": {"event_log": [{"crashed": False, "time": t, "type": 0},
                                   {"tab_count": 1, "time": t, "type": 2, "window_count": 1}],
                     "session_data_status": 3},
        "spellcheck": {"dictionaries": ["de-DE"], "dictionary": ""},
        "sync": {"requested": False, "encryption_bootstrap_token": _b64(zufall, 96)},
        "translate_site_blocklist_with_time": {},
        "zerosuggest": {"cachedresults": ")]}'\n" + json.dumps(vorschlaege)},
    }


def _local_state() -> dict:
    zufall = random.Random(2)
    return {
        "browser": {"enabled_labs_experiments": ["enable-parallel-downloading@1"], "last_redirect_origin": ""},
        "hardware_acceleration_mode_previous": True,
        "legacy": {"profile": {"name": {"migrated": True}}},
        "os_crypt": {"encrypted_key": _b64(zufall, 240)},
        "profile": {
            "info_cache": {"Default": {"active_time": 1.7e9, "avatar_icon": "chrome://theme/IDR_PROFILE_AVATAR_26",
                                       "gaia_name": "", "is_using_default_name": True, "name": "Person 1",
                                       "user_name": ""}},
            "last_used": "Default", "profiles_order": ["Default"],
        },
        "uninstall_metrics": {"installation_date2": "1760000000"},
        "updateclientdata": {"apps": {"oimompecagnajdejgnnjijobebaeigek": {
            "cohort": "1:1:", "cohortname": "Auto", "dlrc": 6550, "pf": "8c1d2e3f-0000-4000-8000-000000000000"}}},
        "user_experience_metrics": {"low_entropy_source3": 1234, "stability": {
            "exited_cleanly": True, "stats_version": "120.0.5543.61-64"}},
        # Zehntausende Base64-Zeichen: Zufällige Buchstabenfolgen darin sind keine Wörter eines Freitexts.
        "variations_compressed_seed": _b64(zufall, 24_000),
        "variations_country": "de",
        "variations_permanent_consistency_country": ["120.0.5543.61", "de"],
        "variations_seed_signature": _b64(zufall, 72),
    }


def _chromium_json(daten: dict) -> str:
    """Wie der JSON-Schreiber von Chromium: ``<`` maskiert, Umlaute nicht."""
    return json.dumps(daten, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003C")


def _realistisches_profil(wurzel: Path, einstellungen: dict | None = None, local_state: dict | None = None) -> Path:
    profil = wurzel / "laufzeit" / "browser-profil"
    cookies = profil / "Default" / "Network" / "Cookies"
    cookies.parent.mkdir(parents=True)
    cookies.write_bytes(b"SQLite format 3\x00")
    _schreibe(profil / "Local State", _chromium_json(local_state or _local_state()))
    _schreibe(profil / "Default" / "Preferences", _chromium_json(einstellungen or _einstellungen()))
    sicher = {"extensions": {"settings": {ERWEITERUNG: {"location": 5, "state": 1}}},
              "protection": {"macs": {"homepage": _hex("mac1"), "session": {"startup_urls": _hex("mac2")}},
                             "super_mac": _hex("super")}}
    _schreibe(profil / "Default" / "Secure Preferences", _chromium_json(sicher))
    _schreibe(profil / "First Run", "")
    _schreibe(profil / "Last Version", "120.0.5543.61")
    (profil / "Last Browser").write_bytes("C:\\Program Files\\Opera\\launcher.exe".encode("utf-16-le"))
    return profil


def _setze(daten: dict, pfad: tuple[str, ...], wert: object) -> dict:
    ziel = daten
    for teil in pfad[:-1]:
        ziel = ziel.setdefault(teil, {})
    ziel[pfad[-1]] = wert
    return daten


def test_realistische_einstellungsdateien_sind_sauber(k, eigene_laufzeit):
    """Sätze in Erweiterungs-Manifesten, Base64, JSON in Zeichenketten, eigene Bild-URLs: alles vom Browser."""
    _realistisches_profil(eigene_laufzeit)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["profil_dateien"] == 7
    assert bericht.geprueft["profil_textdateien"] == 6  # alles außer Cookies


@pytest.mark.parametrize(
    ("datei", "pfad", "wert", "art", "stelle"),
    [
        ("Preferences", ("profile", "name"), HTML_REST, ART_HTML, "profile.name"),
        ("Preferences", ("ntp", "custom_background_dict", "attribution_line_1"), "Don&#39;t", ART_HTML,
         "ntp.custom_background_dict.attribution_line_1"),
        ("Preferences", ("session", "startup_urls"), ["chrome://newtab/", ALLTAGSSATZ], ART_FREITEXT,
         "session.startup_urls[1]"),
        # JSON in einer Zeichenkette (DevTools): der Satz darin zählt, die Feldnamen nicht
        ("Preferences", ("devtools", "preferences", "console-history"), json.dumps(["document.title", FREITEXT]),
         ART_FREITEXT, "devtools.preferences.console-history[1]"),
        # Bei Erweiterungen ist nur das Manifest ausgenommen
        ("Preferences", ("extensions", "settings", ERWEITERUNG, "preferences", "zuletzt"), FREITEXT, ART_FREITEXT,
         f"extensions.settings.{ERWEITERUNG}.preferences.zuletzt"),
        ("Preferences", ("extensions", "settings", ERWEITERUNG, "manifest", "description"), HTML_REST, ART_HTML,
         f"extensions.settings.{ERWEITERUNG}.manifest.description"),
        # Ein Satz als Schlüssel: Im Bericht steht dafür nur „*“
        ("Preferences", ("history_clusters", "all_cache", "all_keywords"), {FREITEXT: {"score": 1.0}}, ART_FREITEXT,
         "history_clusters.all_cache.all_keywords.*"),
        ("Local State", ("profile", "info_cache", "Default", "name"), HTML_REST, ART_HTML,
         "profile.info_cache.Default.name"),
        ("Local State", ("browser", "zuletzt"), FREITEXT, ART_FREITEXT, "browser.zuletzt"),
    ],
)
def test_html_und_freitext_in_einstellungsdateien_werden_gefunden(k, eigene_laufzeit, datei, pfad, wert, art, stelle):
    if datei == "Preferences":
        profil = _realistisches_profil(eigene_laufzeit, einstellungen=_setze(_einstellungen(), pfad, wert))
        ort = "browser-profil/Default/Preferences"
    else:
        profil = _realistisches_profil(eigene_laufzeit, local_state=_setze(_local_state(), pfad, wert))
        ort = "browser-profil/Local State"
    assert "<" not in (profil / ort.removeprefix("browser-profil/")).read_text(encoding="utf-8")  # als \u003C
    bericht = pruefung.pruefe(k)
    assert [(f.ort, f.art) for f in bericht.funde] == [(f"{ort}:{stelle}", art)], bericht.funde
    assert "Länge" in bericht.funde[0].hinweis
    _ohne_inhalt(bericht, pruefung.bericht_text(bericht))


def test_einstellungsdatei_ohne_json_und_kaputtes_json(k, eigene_laufzeit):
    profil = _realistisches_profil(eigene_laufzeit)
    _schreibe(profil / "First Run", f"\n{FREITEXT}\n")
    _schreibe(profil / "Default" / "Secure Preferences", '{"protection":{"macs":{"homepage":"')
    bericht = pruefung.pruefe(k)
    assert {(f.ort, f.art) for f in bericht.funde} == {
        ("browser-profil/First Run:2", ART_FREITEXT),
        ("browser-profil/Default/Secure Preferences", ART_NICHT_PRUEFBAR),
    }
    _ohne_inhalt(bericht, pruefung.bericht_text(bericht))


def test_stichprobe_wird_auch_in_maskierten_einstellungen_gefunden(k, eigene_laufzeit):
    stichprobe = f"Grüße <3 an alle {MARKER}-Leser"  # Chromium schreibt "<" als \u003C
    _realistisches_profil(eigene_laufzeit, einstellungen=_setze(_einstellungen(), ("profile", "name"), stichprobe))
    assert pruefung.pruefe(k).ok
    bericht = pruefung.pruefe(k, marker=[stichprobe])
    assert [(f.ort, f.art) for f in bericht.funde] == [("browser-profil/Default/Preferences", ART_MARKER)]
    _ohne_inhalt(bericht, pruefung.bericht_text(bericht))


def test_sperrdatei_eines_laufenden_crawls_ist_kein_fund(k, eigene_laufzeit):
    from truthtracker import laufsperre

    _saubere_db(k)
    _log(eigene_laufzeit, *SAUBERES_LOG)
    _profil(eigene_laufzeit)
    with laufsperre.gehalten() as frei:
        assert frei
        assert laufsperre.pfad().parent == eigene_laufzeit / "laufzeit"
        assert laufsperre.pfad().stat().st_size == 0
        bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde


def _export(k: Konfig, *zeilen: str) -> Path:
    kopf = "Post-ID;Link;Erstellt (UTC);Typ;Link-Domains;Retruth-Quelle: Anzeigename;Zeichen"
    return _schreibe(k.export_ordner / "posts-20261002-120000.csv", "\ufeff" + "\r\n".join((kopf, *zeilen)) + "\r\n")


def test_export_csv_sauber_und_mit_url(k):
    sauber = "115312345678901234;https://truthsocial.com/@realDonaldTrump/115312345678901234;2026-10-02 12:00:00;" \
             'Retruth;example.org, nachrichten.example.net;"Jemand; Anders 🇺🇸";120'
    _export(k, sauber)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["export_dateien"] == 1 and bericht.geprueft["export_zeilen"] == 2
    _export(k, sauber, sauber.replace("example.org, nachrichten.example.net", FREMDE_URL))
    bericht = pruefung.pruefe(k)
    assert [(f.ort, f.art) for f in bericht.funde] == [("exporte/posts-20261002-120000.csv:3", ART_FREMDE_URL)]
    _ohne_inhalt(bericht)


def test_export_prueft_bekannte_spalten_wie_die_datenbank(k):
    """Link-Domains und Anzeigenamen sind erlaubte Metadaten, auch wenn ihre Teile wie Wörter aussehen."""
    domains = ", ".join(f"{name}.example.org" for name in WORTLISTE[1:])
    zeile = "1;https://truthsocial.com/@realDonaldTrump/1;2026-10-02 12:00:00;Retruth;{};{};1"
    _export(k, zeile.format(domains, "'=Eins Zwei Drei Vier Fünf Sechs Sieben Acht 🇺🇸"))
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    _export(
        k,
        zeile.format(domains, "Jemand Anders"),
        zeile.format("eins, zwei", "Jemand Anders"),
        zeile.format(" ".join(WORTLISTE), "Jemand Anders"),
        zeile.format("", ALLTAGSSATZ),
        f"1;https://truthsocial.com/@realDonaldTrump/1;2026-10-02 12:00:00;{ALLTAGSSATZ};;;1",
    )
    bericht = pruefung.pruefe(k)
    ort = "exporte/posts-20261002-120000.csv"
    assert [(f.ort, f.art) for f in bericht.funde] == [
        (f"{ort}:3", ART_UNERWARTET), (f"{ort}:4", ART_FREITEXT), (f"{ort}:5", ART_FREITEXT),
        (f"{ort}:6", ART_FREITEXT),
    ]
    _ohne_inhalt(bericht)


def test_echter_export_mit_vielen_domains_und_langem_anzeigenamen_ist_sauber(k):
    from truthtracker import auswertung

    _saubere_db(k)
    domains = sorted(f"{name}.example.org" for name in WORTLISTE[1:])
    _schmuggle(k, "UPDATE posts SET link_domains = ?", (json.dumps(domains),))
    _schmuggle(k, "UPDATE quellen SET anzeigename = ?", ("-Eins Zwei Drei Vier Fünf Sechs Sieben Acht-",))
    con = db.oeffne(k.datenbank_pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    k.export_ordner.mkdir(parents=True)
    (k.export_ordner / "posts.csv").write_bytes(auswertung.csv_export(auswertung.posts_tabelle(daten.posts)))
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["export_zeilen"] == 4  # Kopfzeile und drei Posts


def test_spike_bericht_mit_medienhost_ist_sauber_mit_medien_url_nicht(k, eigene_laufzeit):
    daten = {
        "einstellungen": {"basis_url": "https://truthsocial.com", "konto": "realDonaldTrump"},
        "wege": {"a": {"medien_vorschau": {"host": "static-assets-1.truthsocial.com", "status": 200,
                                           "content_type": "image/webp"}}},
        "fazit": {"begruendung": "Die JSON-API antwortet direkt per curl_cffi; kein Browser nötig."},
    }
    ordner = eigene_laufzeit / "docs" / "zugriff-messungen"
    _schreibe(ordner / "messung-20261002T120000.json", json.dumps(daten, ensure_ascii=False, indent=2))
    _schreibe(ordner / "messung-20261002T120000.md", "# Zugriffs-Spike – Messung\n\n- Weg a (curl_cffi): **ok**\n")
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["spike_dateien"] == 2
    daten["wege"]["a"]["medien_vorschau"]["beispiel"] = MEDIEN_URL
    _schreibe(ordner / "messung-20261002T120000.json", json.dumps(daten, ensure_ascii=False, indent=2))
    bericht = pruefung.pruefe(k)
    assert _hat(bericht, ART_MEDIEN_URL, "zugriff-messungen/messung-20261002T120000.json:")
    _ohne_inhalt(bericht)


def test_echter_spike_bericht_ist_sauber(k, eigene_laufzeit):
    from fabrik import karte, konto, medium, retruth, status
    from truthtracker import feldkatalog, spike

    fremd = konto("108000000000000001", "jemand", "Jemand Anders", verifiziert=False)
    posts = [
        status(JETZT - timedelta(hours=1), karte_=karte(), hashtags=["SYNTHETIKTAG"]),
        status(JETZT - timedelta(hours=2), medien=[medium("image"), medium("video", dauer=12.0)]),
        retruth(JETZT - timedelta(hours=3), status(JETZT - timedelta(days=1), autor=fremd)),
        status(JETZT - timedelta(hours=4), antwort_auf_status=status(JETZT - timedelta(hours=5))),
    ]
    katalog = feldkatalog.Feldkatalog()
    katalog.aufnehmen_alle(posts)
    kopf = {
        "Content-Type": "application/json; charset=utf-8", "Server": "cloudflare", "CF-Cache-Status": "DYNAMIC",
        "Cache-Control": "private, no-store", "Vary": "Accept-Encoding, Origin", "cf-ray": "8c1d2e3f4a5b6c7d-FRA",
        "Link": '<https://truthsocial.com/api/v1/accounts/1/statuses?max_id=2>; rel="next"',
        "Set-Cookie": "__cf_bm=geheim; path=/; HttpOnly, _cfuvid=geheim; path=/",
    }
    url = f"https://truthsocial.com/api/v1/accounts/{TRUMP_ID}/statuses?exclude_replies=true&limit=40"
    daten = {
        "start": "2026-10-02T12:00:00Z",
        "dauer_s": 81.4,
        "fazit": {"weg_a": "funktioniert", "weg_b": "nicht_geprueft", "empfehlung": "a",
                  "begruendung": "Die JSON-API antwortet direkt per curl_cffi; kein Browser nötig.",
                  "felder_vorhanden": {"created_at": True, "quotes_count": False}},
        "umgebung": spike.umgebung(),
        "wege": {"a": {
            "name": "JSON-API per curl_cffi", "ergebnis": "funktioniert", "anfragen": 7, "dauer_s": 80.1,
            "schritte": [{"schritt": "timeline_seite_1", "pfad": spike.pfad_vorlage(url), "status": 200, "art": "ok",
                          "dauer_s": 0.4, "kopfzeilen": spike.kopf_auszug(kopf)}],
            "timeline": [spike.analysiere_seite(posts, set(), kopf, JETZT)],
            "nicht_gefunden_probe": {"status": 404, "art": "nicht_gefunden", "error_text": "Record not found"},
            "medien_vorschau": {"host": "static-assets-1.truthsocial.com", "status": 200, "content_type": "image/png"},
        }},
        "feldkataloge": {"status": katalog.als_dict()},
        "aufraeumen": {"browser_cache_ordner_geloescht": True},
    }
    spike.schreibe(daten, None)
    bericht = pruefung.pruefe(k)
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["spike_dateien"] == 2 and bericht.geprueft["spike_zeilen"] > 100


# ---------------------------------------------------------------------------
# Stichproben (Marker)


def test_stichprobe_wird_in_db_rohdatei_log_und_bericht_gefunden(k, eigene_laufzeit):
    stichprobe = f"Grüße an alle {MARKER}-Leser"  # sieht aus wie ein Anzeigename: nur die Stichprobe findet ihn
    _saubere_db(k)
    _schmuggle(k, "UPDATE quellen SET anzeigename = ? WHERE rolle = 'retruth'", (stichprobe,))
    _log(eigene_laufzeit, f"2026-10-02 12:00:00,001 INFO    truthtracker.crawler: {stichprobe}")
    _schreibe(eigene_laufzeit / "docs" / "zugriff-messungen" / "messung.json", json.dumps({"x": stichprobe}))
    assert pruefung.pruefe(k).ok

    bericht = pruefung.pruefe(k, marker=[f"  {stichprobe}  ", stichprobe])
    assert bericht.geprueft["marker"] == 1
    assert {f.art for f in bericht.funde} == {ART_MARKER}
    assert _hat(bericht, ART_MARKER, "quellen.anzeigename[")
    assert _hat(bericht, ART_MARKER, "daten/truthtracker.sqlite")
    assert _hat(bericht, ART_MARKER, "logs/crawl-2026-10-02.log:1")
    assert _hat(bericht, ART_MARKER, "zugriff-messungen/messung.json:1")  # als \u00fc maskiert
    text = pruefung.bericht_text(bericht)
    assert stichprobe not in text and "Grüße" not in text
    _ohne_inhalt(bericht, text)


def test_zu_kurze_stichprobe_wird_abgelehnt(k):
    with pytest.raises(ValueError):
        pruefung.pruefe(k, marker=["ab"])


# ---------------------------------------------------------------------------
# Kommandozeile und Bericht


def _config(tmp_path: Path) -> Path:
    return _schreibe(tmp_path / "config.toml", "")


def test_main_meldet_sauber_mit_exit_0(tmp_path, capsys):
    cfg = _config(tmp_path)
    _saubere_db(Konfig(basisordner=tmp_path))
    assert pruefung.main(["--config", str(cfg)]) == 0
    ausgabe = capsys.readouterr().out
    assert "Ergebnis: sauber" in ausgabe
    assert "12 Tabellen" in ausgabe
    # Die geprüften Orte stehen im Bericht: Eine falsche Konfiguration fällt so auf.
    assert "Geprüfte Orte:" in ausgabe
    assert str(tmp_path / "daten" / "truthtracker.sqlite") in ausgabe and str(tmp_path / "exporte") in ausgabe
    assert str(tmp_path / "laufzeit" / "logs") in ausgabe


def test_main_meldet_funde_mit_exit_1_ohne_den_inhalt_auszugeben(tmp_path, eigene_laufzeit, capsys):
    cfg = _config(tmp_path)
    k = Konfig(basisordner=tmp_path)
    _saubere_db(k)
    _schmuggle(k, "UPDATE quellen SET anzeigename = ?", (HTML_REST,))
    _schmuggle(k, "UPDATE posts SET link_domains = ?", (json.dumps([MEDIEN_URL]),))
    _schmuggle(k, "UPDATE posts SET sichtbarkeit = ?", (FREITEXT,))
    zeile = f"2026-10-02 12:00:12,000 INFO    truthtracker.crawler: {HTML_REST} {MEDIEN_URL}"
    _log(eigene_laufzeit, *SAUBERES_LOG, zeile)
    _schreibe(eigene_laufzeit / "laufzeit" / "tmp" / "lauf-9" / "rest.txt", FREITEXT)
    _export(k, f"1;{FREMDE_URL};2026-10-02 12:00:00;Retruth;;;1")
    assert pruefung.main(["--config", str(cfg)]) == 1
    ausgabe = capsys.readouterr().out
    for ueberschrift in ("HTML", "Medien-URLs", "Fremde URLs", "Lange Freitexte", "Reste im Temp-Ordner"):
        assert f"\n{ueberschrift} (" in ausgabe
    assert "posts.link_domains[" in ausgabe and "logs/crawl-2026-10-02.log:" in ausgabe
    for verboten in VERBOTEN_IM_BERICHT:
        assert verboten not in ausgabe, verboten


def test_main_mit_stichproben_aus_datei_und_abfrage(tmp_path, eigene_laufzeit, capsys, monkeypatch):
    cfg = _config(tmp_path)
    _log(eigene_laufzeit, f"{MARKER} Stichprobe eins", f"{MARKER} Stichprobe zwei", f"{MARKER} Absatz drei")
    datei = _schreibe(tmp_path / "stichproben.txt", f"{MARKER} Stichprobe eins\n\n")
    # Ein eingefügter Post mit Absätzen: Die Leerzeilen beenden die Eingabe nicht, erst ihr Ende.
    monkeypatch.setattr(sys, "stdin", io.StringIO(f"{MARKER} Stichprobe zwei\n\n\n{MARKER} Absatz drei\n"))
    assert pruefung.main(["--config", str(cfg), "--marker-datei", str(datei), "--abfragen"]) == 1
    ausgabe = capsys.readouterr().out
    for nr in (1, 2, 3):
        assert f"logs/crawl-2026-10-02.log:{nr}: Stichprobe {nr} gefunden" in ausgabe
    assert "2 Stichproben übernommen" in ausgabe and "3 Zeichenketten" in ausgabe
    assert MARKER not in ausgabe


def test_abfrage_liest_bis_zum_ende_der_eingabe_und_leert_danach_den_konsolenpuffer(monkeypatch, capsys):
    geleert = []
    monkeypatch.setattr(pruefung, "_konsolenpuffer_leeren", lambda: geleert.append(True))
    eingabe = io.StringIO(
        f"{MARKER} erster Absatz des Posts\r\n"
        "\r\n"
        "   \n"
        "DJT\n"  # zu kurz für eine Stichprobe: übersprungen statt Abbruch mit Exit-Code 2
        f"  {MARKER} zweiter Absatz  \n"
        "\n"
        f"{MARKER} letzter Absatz\x1a\n"  # Strg+Z am Zeilenende (Windows): Die Eingabe endet hier.
        "echo nicht-ausfuehren\n"
    )
    monkeypatch.setattr(sys, "stdin", eingabe)
    assert pruefung._frage_marker() == [
        f"{MARKER} erster Absatz des Posts", f"{MARKER} zweiter Absatz", f"{MARKER} letzter Absatz",
    ]
    assert geleert == [True]
    assert eingabe.read() == "echo nicht-ausfuehren\n"  # nicht mehr gelesen; unter Windows verworfen
    ausgabe = capsys.readouterr().out
    assert "Strg+D" in ausgabe
    assert "1 Zeile mit weniger als 4 Zeichen übersprungen" in ausgabe and "3 Stichproben übernommen" in ausgabe
    assert MARKER not in ausgabe and "DJT" not in ausgabe


def test_abfrage_leert_den_konsolenpuffer_auch_bei_abbruch(monkeypatch):
    geleert = []
    monkeypatch.setattr(pruefung, "_konsolenpuffer_leeren", lambda: geleert.append(True))

    def abbruch(_aufforderung=""):
        raise KeyboardInterrupt

    monkeypatch.setattr("builtins.input", abbruch)
    with pytest.raises(KeyboardInterrupt):
        pruefung._frage_marker()
    assert geleert == [True]


def test_konsolenpuffer_wird_nur_unter_windows_geleert(monkeypatch, capsys):
    import ctypes

    aufrufe = []

    class Funktion:
        def __init__(self, name: str, ergebnis: int):
            self.name, self.ergebnis, self.restype, self.argtypes = name, ergebnis, None, None

        def __call__(self, *argumente):
            aufrufe.append((self.name, argumente))
            return self.ergebnis

    def kernel32(name, use_last_error=False):
        assert name == "kernel32"
        dll = type("Kernel32", (), {})()
        dll.GetStdHandle = Funktion("GetStdHandle", 77)
        dll.FlushConsoleInputBuffer = Funktion("FlushConsoleInputBuffer", 1)
        return dll

    monkeypatch.setattr(ctypes, "WinDLL", kernel32, raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    pruefung._konsolenpuffer_leeren()
    assert aufrufe == []
    monkeypatch.setattr(sys, "platform", "win32")
    pruefung._konsolenpuffer_leeren()
    assert aufrufe == [("GetStdHandle", (-10,)), ("FlushConsoleInputBuffer", (77,))]

    def ohne_kernel32(name, use_last_error=False):
        raise OSError("nicht gefunden")

    monkeypatch.setattr(ctypes, "WinDLL", ohne_kernel32, raising=False)
    pruefung._konsolenpuffer_leeren()  # still: dann gibt es auch keinen Puffer, der an cmd.exe ginge
    assert capsys.readouterr().out == ""


def test_main_mit_ungueltiger_stichprobe_oder_konfiguration_gibt_2(tmp_path, capsys):
    cfg = _config(tmp_path)
    assert pruefung.main(["--config", str(cfg), "--marker", "ab"]) == 2
    kaputt = _schreibe(tmp_path / "kaputt.toml", "[zugriff]\nweg = 'zauberei'\n")
    assert pruefung.main(["--config", str(kaputt)]) == 2
    assert "Fehler in der Konfiguration" in capsys.readouterr().out


def test_main_mit_fehlender_konfigurationsdatei_gibt_2_statt_woanders_zu_pruefen(tmp_path, capsys):
    """Ein Tippfehler in --config darf nicht still den Projektordner prüfen und „sauber“ melden."""
    assert pruefung.main(["--config", str(tmp_path / "gibt-es-nicht.toml")]) == 2
    ausgabe = capsys.readouterr().out
    assert "gibt es nicht" in ausgabe and "Ergebnis" not in ausgabe
    assert pruefung.main(["--config", str(tmp_path)]) == 2  # ein Ordner ist keine Konfigurationsdatei


def test_aufruf_als_modul_und_ueber_truthtracker_pruefen(tmp_path):
    from truthtracker import __main__ as kommandozeile

    cfg = _config(tmp_path)
    assert kommandozeile.main(["pruefen", "--config", str(cfg)]) == 0
    umgebung = dict(os.environ, PYTHONPATH=str(pfade.PROJEKT / "src"), PYTHONIOENCODING="utf-8")
    ergebnis = subprocess.run(
        [sys.executable, "-m", "truthtracker.pruefung", "--config", str(cfg)],
        capture_output=True, text=True, encoding="utf-8", env=umgebung, timeout=120, check=False,
    )
    assert ergebnis.returncode == 0, ergebnis.stdout + ergebnis.stderr
    assert "Ergebnis: sauber" in ergebnis.stdout


def _abbild(wurzel: Path) -> dict[str, tuple]:
    return {
        p.relative_to(wurzel).as_posix(): (p.stat().st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest())
        if p.is_file() else ("ordner",)
        for p in sorted(wurzel.rglob("*"))
    }


def test_pruefung_veraendert_nichts(k, eigene_laufzeit):
    _saubere_db(k)
    _schmuggle(k, "UPDATE quellen SET anzeigename = ?", (HTML_REST,))
    _log(eigene_laufzeit, *SAUBERES_LOG)
    _profil(eigene_laufzeit)
    _schreibe(eigene_laufzeit / "laufzeit" / "tmp" / "lauf-1" / "rest.bin", "x")
    _export(k, "1;https://truthsocial.com/@realDonaldTrump/1;2026-10-02 12:00:00;Retruth;;;1")
    vorher = _abbild(eigene_laufzeit)
    bericht = pruefung.pruefe(k, marker=[f"{MARKER} Stichprobe"])
    assert not bericht.ok
    assert _abbild(eigene_laufzeit) == vorher  # auch keine neuen -wal/-shm-Dateien


# ---------------------------------------------------------------------------
# Echter Lauf gegen den API-Nachbau


def _logs_abmelden(stufe: int) -> None:
    wurzel = logging.getLogger()
    for handler in list(wurzel.handlers):
        if getattr(handler, "_truthtracker", False):
            wurzel.removeHandler(handler)
            handler.close()
    wurzel.setLevel(stufe)


@pytest.mark.parametrize(
    ("zustand", "status_erwartet"),
    [({}, "ok"), ({"ratelimit_ab": 4}, "abgebrochen"), ({"fehler_pfade": {r"/statuses$": 502}}, "ok")],
    ids=["normal", "abbruch_429", "serverfehler"],
)
def test_echter_lauf_gegen_den_nachbau_hinterlaesst_keine_inhaltsreste(
    tmp_path, eigene_laufzeit, zustand, status_erwartet
):
    from fabrik import karte, konto, medium, retruth, status
    from fake_truthsocial import FakeTruthSocial, Zustand
    from truthtracker import crawler, logbuch

    fremd = konto("108000000000000001", "jemand", "Jemand Anders", verifiziert=False, follower=1234)
    fremd_post = status(JETZT - timedelta(days=2), autor=fremd, medien=[medium("video", dauer=12.0)])
    z = Zustand(**zustand)
    z.setze_posts([
        status(JETZT - timedelta(hours=1), karte_=karte(), hashtags=["SYNTHETIKTAG"],
               text=f'{MARKER} Text mit <a href="https://example.com/{MARKER}-pfad">Link</a> und mehr Worten hier'),
        status(JETZT - timedelta(hours=2), medien=[medium("image"), medium("gifv", dauer=3.0)]),
        retruth(JETZT - timedelta(hours=3), fremd_post),
        status(JETZT - timedelta(hours=4), quote=fremd_post, text=f"{MARKER} Quote-Text"),
        status(JETZT - timedelta(hours=5), antwort_auf_status=status(JETZT - timedelta(hours=6))),
    ])
    stufe = logging.getLogger().level
    logbuch.richte_ein("crawl", konsole=False)
    try:
        with FakeTruthSocial(z) as fake:
            k = Konfig(basisordner=tmp_path, basis_url=fake.url, pausen=PausenKonfig(0, 0, 0, 0))
            k.zugriff.weg = "curl"
            k.zugriff.replies_anderer = "aus"
            ergebnis = crawler.fuehre_lauf_aus(k, uhr=lambda: JETZT, melden=lambda _text: None)
    finally:
        _logs_abmelden(stufe)
    assert ergebnis.status == status_erwartet, ergebnis.meldungen
    bericht = pruefung.pruefe(k, marker=[f"{MARKER} Quote-Text", f"{MARKER}-pfad"])
    assert bericht.ok, bericht.funde
    assert bericht.geprueft["db_werte"] > 10
    assert bericht.geprueft["log_zeilen"] > 0
