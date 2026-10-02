"""Tests der Dashboard-Auswertungen auf einer synthetisch gefüllten Datenbank.

Die Posts entstehen direkt als ``PostDaten`` (ohne Klassifikation) und werden über die
normalen ``db``-Funktionen gespeichert. Zeitzonen-Tests decken die Sommerzeitwechsel 2026
ab: USA 8. März und 1. November, EU 29. März und 25. Oktober.
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest

from fabrik import BASIS, MARKER, TRUMP_ID, karte, konto, medium, retruth, snowflake, status
from truthtracker import auswertung, db, klassifikation, zeit
from truthtracker.db import LaufZaehler
from truthtracker.modelle import (
    DUP_EXAKT,
    DUP_GLEICHES_ORIGINAL,
    DUP_NUR_TEXT,
    FORMAT_MEDIEN_TEXT,
    FORMAT_NUR_LINK,
    FORMAT_NUR_MEDIEN,
    FORMAT_NUR_TEXT,
    FORMAT_TEXT_LINK,
    REPLY_THREAD,
    ROLLE_RETRUTH,
    TYP_EIGEN,
    TYP_RETRUTH,
    TYP_SELBST_RETRUTH,
    PostDaten,
    QuellKonto,
    TextMetriken,
    Zaehler,
)

BERLIN = "Europe/Berlin"
NEW_YORK = "America/New_York"


# ---------------------------------------------------------------------------
# Synthetische Daten


def _t(text: str) -> datetime:
    wert = zeit.parse_utc(text)
    assert wert is not None
    return wert


def _hash(*teile: object) -> str:
    return hashlib.sha256("|".join(map(str, teile)).encode()).hexdigest()


def quelle(konto_id: str = "222", handle: str = "beispiel_konto", anzeigename: str = "Beispiel Konto",
           verifiziert: bool = True, follower: int = 1000) -> QuellKonto:
    return QuellKonto(
        rolle=ROLLE_RETRUTH, konto_id=konto_id, handle=handle, anzeigename=anzeigename,
        verifiziert=verifiziert, follower=follower, ist_trump=konto_id == TRUMP_ID,
    )


def post(
    zeitpunkt: str | datetime,
    *,
    typ: str = TYP_EIGEN,
    folge: int = 0,
    format_: str = FORMAT_NUR_TEXT,
    zeichen: int = 80,
    likes: int = 30,
    weitere: dict[str, int] | None = None,
    original_vor: timedelta = timedelta(hours=2),
    quell_konto: QuellKonto | None = None,
    orig_likes: int = 500,
    reply_art: str | None = None,
    quote: bool = False,
    bilder: int = 0,
) -> PostDaten:
    erstellt = _t(zeitpunkt) if isinstance(zeitpunkt, str) else zeitpunkt
    pid = snowflake(erstellt, folge)
    p = PostDaten(id=pid, url=f"{BASIS}/@realDonaldTrump/{pid}", created_at=erstellt, typ=typ, format=format_)
    p.text = TextMetriken(zeichen=zeichen, zeichen_ohne_urls=zeichen, n_urls=0, text_hash=_hash("text", pid))
    p.n_bilder = bilder
    p.zaehler = Zaehler(replies=1, retruths=2, likes=likes, weitere=dict(weitere or {}))
    p.sichtbarkeit = "public"
    if typ in (TYP_RETRUTH, TYP_SELBST_RETRUTH):
        original_zeit = erstellt - original_vor
        p.original_id = snowflake(original_zeit, folge + 1)
        p.original_created_at = original_zeit
        p.retruth_latenz_s = int(original_vor.total_seconds())
        p.url = f"{BASIS}/@quelle/{p.original_id}"
        p.zaehler = Zaehler(replies=0, retruths=0, likes=0, weitere={"upvotes_count": 0})
        p.zaehler_original = Zaehler(replies=5, retruths=50, likes=orig_likes, weitere={"upvotes_count": 7})
        if typ == TYP_SELBST_RETRUTH:
            konto = quelle(TRUMP_ID, "realDonaldTrump", "Donald J. Trump", True, 11_000_000)
        else:
            konto = quell_konto or quelle()
        p.quellen = [konto]
    if reply_art:
        p.ist_reply = True
        p.reply_art = reply_art
        p.in_reply_to_id = snowflake(erstellt - timedelta(minutes=5), folge + 2)
    if quote:
        p.ist_quote = True
        p.quote_id = snowflake(erstellt - timedelta(days=1), folge + 3)
    return p


def speichere(
    con: sqlite3.Connection, p: PostDaten, lauf_id: int, alter_h: float, *, backfill: bool = False
) -> datetime:
    """Post sehen und messen, ``alter_h`` Stunden nach dem Erstellen."""
    gemessen = p.created_at + timedelta(hours=alter_h)
    db.post_speichern(con, p, lauf_id=lauf_id, gesehen=gemessen, backfill=backfill)
    db.snapshot_speichern(con, p, lauf_id=lauf_id, gemessen=gemessen, grenze_h=24)
    return gemessen


@pytest.fixture
def con(tmp_path):
    verbindung = db.oeffne(tmp_path / "test.sqlite")
    yield verbindung
    verbindung.close()


@pytest.fixture
def lauf(con) -> int:
    return db.lauf_starten(con, _t("2026-01-01T00:00:00Z"), backfill=False)


def _gefiltert(con: sqlite3.Connection, zeitzone: str = BERLIN, **kw) -> pd.DataFrame:
    return auswertung.filtere(auswertung.lade_daten(con).posts, None, None, zeitzone, **kw)


BEISPIEL_ERFASST_AB = "2026-08-04T12:00:00Z"
BEISPIEL_ALT_GEPINNT = "2025-01-20T17:00:00Z"


def baue_beispiel_db(pfad: Path) -> Path:
    """Kleine, aber vollständige Datenbank für Dashboard-Tests: drei Läufe, Backfill, Serien,
    Retruths, Selbst-Retruths, Quote, Thread, Löschung, Edit, Duplikate, Konto-Werte und ein
    gepinnter Post von weit vor der Backfill-Grenze (wie ihn der Crawler über die Pinned-Liste holt)."""
    con = db.oeffne(pfad)
    try:
        start = _t("2026-09-01T12:00:00Z")
        with con:
            db.meta_schreiben(con, "konto_id", TRUMP_ID)
            db.meta_schreiben(con, "erster_lauf_start_utc", zeit.utc_text(start))
            db.meta_schreiben(con, "backfill_grenze_utc", BEISPIEL_ERFASST_AB)
        lauf1 = db.lauf_starten(con, start, backfill=True)
        db.konto_snapshot_speichern(con, lauf1, TRUMP_ID, start, follower=11_000_000, folgt=70, posts_gesamt=30_000)
        formate = (FORMAT_NUR_TEXT, FORMAT_NUR_MEDIEN, FORMAT_MEDIEN_TEXT, FORMAT_NUR_LINK, FORMAT_TEXT_LINK)
        for i in range(10):
            erstellt = _t("2026-08-12T13:00:00Z") + timedelta(days=2 * i, hours=i)
            typ = (TYP_EIGEN, TYP_RETRUTH, TYP_EIGEN, TYP_SELBST_RETRUTH)[i % 4]
            p = post(erstellt, typ=typ, folge=i, format_=formate[i % 5], zeichen=40 * i, likes=1000 + i,
                     bilder=1 if formate[i % 5] in (FORMAT_NUR_MEDIEN, FORMAT_MEDIEN_TEXT) else 0,
                     weitere={"upvotes_count": 900 + i})
            speichere(con, p, lauf1, (start - erstellt).total_seconds() / 3600, backfill=True)
        alt = post(BEISPIEL_ALT_GEPINNT, folge=99, likes=123_456)
        alt.gepinnt = True
        speichere(con, alt, lauf1, (start - alt.created_at).total_seconds() / 3600, backfill=True)
        db.lauf_beenden(
            con, lauf1, ende=start + timedelta(minutes=4), status="ok", zugriff="curl", abbruch_grund=None,
            zaehler=LaufZaehler(anfragen_api=9, seiten=7, neue_posts=10, snapshots=10), meldungen=["Erster Lauf"],
            abgedeckt_von=_t("2026-08-04T12:00:00Z"), abgedeckt_bis=start,
        )

        lauf2_start = _t("2026-09-10T12:00:00Z")
        lauf2 = db.lauf_starten(con, lauf2_start, backfill=False)
        db.konto_snapshot_speichern(con, lauf2, TRUMP_ID, lauf2_start, follower=11_050_000, folgt=71,
                                    posts_gesamt=30_210)
        neue: list[PostDaten] = []
        serie_start = _t("2026-09-09T23:50:00Z")
        for i in range(4):
            neue.append(post(serie_start + timedelta(minutes=3 * i), folge=20 + i, likes=200 + 10 * i,
                             weitere={"upvotes_count": 150 + i}))
        neue.append(post("2026-09-10T02:00:00Z", typ=TYP_RETRUTH, folge=30,
                         quell_konto=quelle("333", "zweites_konto", "Zweites Konto", False, 50_000)))
        neue.append(post("2026-09-10T02:05:00Z", typ=TYP_RETRUTH, folge=31, original_vor=timedelta(days=2)))
        neue.append(post("2026-09-10T03:00:00Z", typ=TYP_SELBST_RETRUTH, folge=32, original_vor=timedelta(hours=30)))
        neue.append(post("2026-09-10T06:00:00Z", folge=33, quote=True, format_=FORMAT_TEXT_LINK, likes=80))
        neue.append(post("2026-09-10T06:30:00Z", folge=34, reply_art=REPLY_THREAD, likes=60))
        neue.append(post("2026-09-10T09:00:00Z", folge=35, format_=FORMAT_MEDIEN_TEXT, bilder=2, likes=400))
        for p in neue:
            speichere(con, p, lauf2, (lauf2_start - p.created_at).total_seconds() / 3600)
        db.lauf_beenden(
            con, lauf2, ende=lauf2_start + timedelta(minutes=3), status="ok", zugriff="curl", abbruch_grund=None,
            zaehler=LaufZaehler(anfragen_api=6, seiten=3, neue_posts=len(neue), snapshots=len(neue)), meldungen=[],
            abgedeckt_von=_t("2026-09-03T12:00:00Z"), abgedeckt_bis=lauf2_start,
        )

        lauf3_start = _t("2026-09-11T06:00:00Z")
        lauf3 = db.lauf_starten(con, lauf3_start, backfill=False)
        db.konto_snapshot_speichern(con, lauf3, TRUMP_ID, lauf3_start, follower=11_070_000, folgt=71,
                                    posts_gesamt=30_232)
        for p in neue:
            p.zaehler.likes = (p.zaehler.likes or 0) + 25
            if p is neue[-1]:
                p.text.text_hash = _hash("bearbeitet", p.id)
            speichere(con, p, lauf3, (lauf3_start - p.created_at).total_seconds() / 3600)
        spaet = post("2026-09-11T05:00:00Z", folge=40, likes=90)
        speichere(con, spaet, lauf3, 1.0)
        geloescht = neue[7]
        db.als_vermisst_markieren(con, geloescht.id, lauf3_start)
        db.als_geloescht_markieren(con, geloescht.id, lauf3_start)
        db.lauf_beenden(
            con, lauf3, ende=lauf3_start + timedelta(minutes=5), status="abgebrochen", zugriff="browser",
            abbruch_grund="ratelimit",
            zaehler=LaufZaehler(anfragen_api=5, seiten=2, neue_posts=1, snapshots=8, geloescht_erkannt=1,
                                edits_erkannt=1, cloudflare_challenges=1),
            meldungen=["Zu viele Anfragen (HTTP 429)."], abgedeckt_von=lauf3_start - timedelta(days=7),
            abgedeckt_bis=lauf3_start,
        )
        with con:
            con.execute(
                "UPDATE posts SET dup_geprueft_utc = ?, dup_abdeckung_vollstaendig = 1 WHERE backfill = 0",
                (zeit.utc_text(lauf3_start),),
            )
            con.executemany(
                "INSERT INTO duplikate (post_id, art, frueherer_post_id, abstand_s, primaer) VALUES (?, ?, ?, ?, ?)",
                [
                    (neue[1].id, DUP_EXAKT, neue[0].id, 180, 1),
                    (neue[1].id, DUP_NUR_TEXT, neue[0].id, 180, 0),
                    (neue[5].id, DUP_GLEICHES_ORIGINAL, neue[4].id, 300, 1),
                ],
            )
    finally:
        con.close()
    return pfad


INHALT_VERBOTEN = (MARKER, "/media/", "<p>", "<a ", "Kartentitel", "Alternativtext", "-pfad", "static-assets",
                   "avatars", "example.com/")


def baue_inhalts_db(pfad: Path, *, marker_im_protokoll: bool = False) -> Path:
    """Datenbank aus synthetischen API-Objekten *mit* Inhalten (Text mit Marker, Link, Medien-URLs,
    Alt-Texte, Vorschaukarte, Profiltext), gespeichert über die echte Klassifikation. Mit
    ``marker_im_protokoll`` steht der Marker zusätzlich in ``laeufe.meldungen``, einem Feld, das
    weder Tabelle noch CSV enthalten: So ist sicher, dass ein Test den Marker überhaupt finden könnte."""
    jetzt = _t("2026-09-20T12:00:00Z")
    fremd = konto("222222222222222222", "jemand", "Jemand Anderes", verifiziert=False, follower=1234)
    fremd_post = status(jetzt - timedelta(days=2), autor=fremd, medien=[medium("video", dauer=12.0)])
    statusse = [
        status(jetzt - timedelta(hours=1), karte_=karte(), hashtags=[f"{MARKER}TAG"],
               text=f'{MARKER} Text mit <a href="https://example.com/{MARKER}-pfad">Link</a>'),
        status(jetzt - timedelta(hours=2), medien=[medium("image"), medium("gifv", dauer=3.0)]),
        retruth(jetzt - timedelta(hours=3), fremd_post),
        status(jetzt - timedelta(hours=4), quote=fremd_post, text=f"{MARKER} Quote-Text"),
        status(jetzt - timedelta(hours=5), antwort_auf_status=status(jetzt - timedelta(hours=6))),
    ]
    con = db.oeffne(pfad)
    try:
        with con:
            db.meta_schreiben(con, "konto_id", TRUMP_ID)
        lauf_id = db.lauf_starten(con, jetzt, backfill=False)
        db.konto_snapshot_speichern(con, lauf_id, TRUMP_ID, jetzt, follower=11_000_000, folgt=70, posts_gesamt=30_000)
        for s in statusse:
            p = klassifikation.extrahiere(s, trump_id=TRUMP_ID, basis_url=BASIS)
            db.post_speichern(con, p, lauf_id=lauf_id, gesehen=jetzt, backfill=False)
            db.snapshot_speichern(con, p, lauf_id=lauf_id, gemessen=jetzt, grenze_h=24)
        db.lauf_beenden(
            con, lauf_id, ende=jetzt + timedelta(minutes=2), status="ok", zugriff="curl", abbruch_grund=None,
            zaehler=LaufZaehler(anfragen_api=3, neue_posts=len(statusse), snapshots=len(statusse)),
            meldungen=[f"{MARKER} nur im Laufprotokoll"] if marker_im_protokoll else [],
            abgedeckt_von=jetzt - timedelta(days=7), abgedeckt_bis=jetzt,
        )
    finally:
        con.close()
    return pfad


# ---------------------------------------------------------------------------
# Laden


def test_lade_daten_typen_zeiten_und_zusatzspalten(con, lauf):
    eigen = post("2026-05-01T10:00:00Z", weitere={"upvotes_count": 31, "quotes_count": 4})
    rt = post("2026-05-01T11:00:00Z", typ=TYP_RETRUTH, folge=1)
    speichere(con, eigen, lauf, 20)
    speichere(con, rt, lauf, 21)
    with con:
        db.meta_schreiben(con, "konto_id", TRUMP_ID)
    db.konto_snapshot_speichern(con, lauf, TRUMP_ID, _t("2026-05-02T08:00:00Z"), follower=10, folgt=2, posts_gesamt=3)
    db.konto_snapshot_speichern(con, lauf, "999", _t("2026-05-02T08:00:00Z"), follower=1, folgt=1, posts_gesamt=1)

    daten = auswertung.lade_daten(con)
    posts = daten.posts.set_index("id")
    assert str(daten.posts["created_at_utc"].dt.tz) == "UTC"
    assert posts.loc[eigen.id, "created_at_utc"] == pd.Timestamp("2026-05-01T10:00:00Z")
    assert posts.loc[eigen.id, "messalter_h"] == pytest.approx(20)
    assert posts.loc[eigen.id, "upvotes_count"] == 31
    assert posts.loc[eigen.id, "quotes_count"] == 4
    assert daten.kennzahlen == ("likes", "retruths", "replies", "quotes_count", "upvotes_count")
    assert posts.loc[rt.id, "orig_likes"] == 500
    assert posts.loc[rt.id, "orig_upvotes_count"] == 7
    assert posts.loc[rt.id, "retruth_quelle_handle"] == "beispiel_konto"
    assert bool(posts.loc[rt.id, "retruth_quelle_verifiziert"]) is True
    assert pd.isna(posts.loc[eigen.id, "retruth_quelle_handle"])
    assert posts["n_snapshots"].tolist() == [1, 1]
    assert daten.konto["konto_id"].tolist() == [TRUMP_ID]
    assert str(daten.snapshots["gemessen_utc"].dt.tz) == "UTC"


def test_lade_daten_final_ist_letzter_snapshot(con):
    p = post("2026-05-01T10:00:00Z", likes=10)
    lauf1 = db.lauf_starten(con, _t("2026-05-01T12:00:00Z"), backfill=False)
    lauf2 = db.lauf_starten(con, _t("2026-05-02T06:00:00Z"), backfill=False)
    speichere(con, p, lauf1, 2)
    p.zaehler.likes = 99
    speichere(con, p, lauf2, 20)
    daten = auswertung.lade_daten(con)
    zeile = daten.posts.iloc[0]
    assert zeile["likes"] == 99
    assert zeile["messalter_h"] == pytest.approx(20)
    assert zeile["n_snapshots"] == 2
    assert len(daten.snapshots) == 2


def test_leere_datenbankdatei_ergibt_leere_auswertungen(tmp_path):
    pfad = tmp_path / "leer.sqlite"
    pfad.touch()
    con = db.oeffne(pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    assert daten.posts.empty and "created_at_utc" in daten.posts.columns
    df = auswertung.filtere(daten.posts, None, None, BERLIN)
    assert auswertung.heatmap_wochentag_stunde(df).to_numpy().sum() == 0
    assert auswertung.posts_pro_tag(df).empty
    assert auswertung.serien(df, 10).empty
    assert auswertung.laengste_pause_pro_tag(df).empty
    assert auswertung.engagement(df, 18, 24).basis.empty
    assert auswertung.retruth_quellen(df).anzahl == 0
    assert auswertung.duplikat_auswertung(df, daten.duplikate).rate is None
    assert auswertung.loeschungen_edits(df, daten.edits).geloescht == 0
    assert auswertung.datenbereich(daten, BERLIN) is None
    assert auswertung.csv_export(auswertung.posts_tabelle(df)).startswith("﻿Post-ID;".encode())


# ---------------------------------------------------------------------------
# Zeitzonen und Sommerzeit


def test_sommerzeitbeginn_berlin_stunden_und_heatmap(con, lauf):
    # 29.03.2026: um 01:00 UTC springt Berlin von MEZ (+1) auf MESZ (+2).
    vorher = post("2026-03-29T00:30:00Z", folge=1)
    nachher = post("2026-03-29T01:30:00Z", folge=2)
    for p in (vorher, nachher):
        speichere(con, p, lauf, 1)
    df = _gefiltert(con, BERLIN)
    assert [t.strftime("%H:%M %z") for t in df["lokal"]] == ["01:30 +0100", "03:30 +0200"]
    assert df["stunde"].tolist() == [1, 3]
    heat = auswertung.heatmap_wochentag_stunde(df)
    assert heat.loc["So", 1] == 1 and heat.loc["So", 2] == 0 and heat.loc["So", 3] == 1
    assert heat.to_numpy().sum() == 2
    # Echte vergangene Zeit, nicht Wanduhr-Differenz (die wäre 2 h).
    assert auswertung.abstaende_minuten(df).tolist() == [60.0]
    pausen = auswertung.laengste_pause_pro_tag(df)
    assert pausen.loc[pausen["datum"] == date(2026, 3, 29), "pause_h"].item() == pytest.approx(1.0)


def test_sommerzeitende_berlin_doppelte_stunde(con, lauf):
    # 25.10.2026: um 01:00 UTC springt Berlin von MESZ zurück auf MEZ; 02:30 gibt es zweimal.
    for i, zeitpunkt in enumerate(("2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z")):
        speichere(con, post(zeitpunkt, folge=i), lauf, 1)
    df = _gefiltert(con, BERLIN)
    assert [t.strftime("%H:%M %z") for t in df["lokal"]] == ["02:30 +0200", "02:30 +0100"]
    heat = auswertung.heatmap_wochentag_stunde(df)
    assert heat.loc["So", 2] == 2
    assert auswertung.posts_pro_tag(df).loc[date(2026, 10, 25)].sum() == 2


def test_sommerzeitwechsel_new_york_maerz_und_november(con, lauf):
    zeiten = (
        "2026-03-08T06:30:00Z",  # 01:30 EST (-5)
        "2026-03-08T07:30:00Z",  # 03:30 EDT (-4), 02:xx fällt aus
        "2026-11-01T05:30:00Z",  # 01:30 EDT
        "2026-11-01T06:30:00Z",  # 01:30 EST, dieselbe Wanduhrzeit noch einmal
    )
    for i, zeitpunkt in enumerate(zeiten):
        speichere(con, post(zeitpunkt, folge=i), lauf, 1)
    df = _gefiltert(con, NEW_YORK)
    assert [t.strftime("%m-%d %H:%M %z") for t in df["lokal"]] == [
        "03-08 01:30 -0500", "03-08 03:30 -0400", "11-01 01:30 -0400", "11-01 01:30 -0500",
    ]
    heat = auswertung.heatmap_wochentag_stunde(df)
    assert heat.loc["So", 1] == 3 and heat.loc["So", 2] == 0 and heat.loc["So", 3] == 1
    # Dieselben Zeitpunkte in Berlin (an beiden Tagen MEZ, +1): 07:30, 08:30, 06:30, 07:30
    heat_berlin = auswertung.heatmap_wochentag_stunde(df, BERLIN)
    assert heat_berlin.loc["So", 6] == 1 and heat_berlin.loc["So", 7] == 2 and heat_berlin.loc["So", 8] == 1
    assert heat_berlin.to_numpy().sum() == 4


def test_tagesgrenzen_haengen_von_der_zeitzone_ab(con, lauf):
    # 28.03. 23:30 UTC: in Berlin (noch MEZ) schon der 29.03., in New York (schon EDT) der 28.03. abends.
    p = post("2026-03-28T23:30:00Z")
    speichere(con, p, lauf, 1)
    posts = auswertung.lade_daten(con).posts
    berlin = auswertung.filtere(posts, date(2026, 3, 29), date(2026, 3, 29), BERLIN)
    new_york = auswertung.filtere(posts, date(2026, 3, 29), date(2026, 3, 29), NEW_YORK)
    assert len(berlin) == 1 and len(new_york) == 0
    assert berlin["lokal"].iloc[0].strftime("%d.%m. %H:%M") == "29.03. 00:30"
    assert auswertung.filtere(posts, date(2026, 3, 28), date(2026, 3, 28), NEW_YORK)["stunde"].tolist() == [19]
    assert auswertung.posts_pro_tag(berlin).index.tolist() == [date(2026, 3, 29)]
    assert auswertung.posts_pro_tag(berlin, NEW_YORK).index.tolist() == [date(2026, 3, 28)]
    assert auswertung.heatmap_wochentag_stunde(berlin).loc["So", 0] == 1
    assert auswertung.heatmap_wochentag_stunde(berlin, NEW_YORK).loc["Sa", 19] == 1


def test_zeitzone_kurzname_und_unbekannte_zone():
    assert auswertung.zone("ET") == NEW_YORK
    assert auswertung.zone("Berlin") == BERLIN
    with pytest.raises(Exception):
        auswertung.zone("Mars/Olympus")


# ---------------------------------------------------------------------------
# Erfassungsbereich


def test_alter_gepinnter_post_verfaelscht_keine_frequenz(con):
    # Backfill über eine Woche, alle 6 h ein Post; dazu ein gepinnter Post von 2025, den der
    # Crawler über die Pinned-Liste unabhängig vom Alter speichert.
    start = _t("2026-09-08T12:00:00Z")
    grenze = start - timedelta(days=7)
    with con:
        db.meta_schreiben(con, "erster_lauf_start_utc", zeit.utc_text(start))
        db.meta_schreiben(con, "backfill_grenze_utc", zeit.utc_text(grenze))
    lauf_id = db.lauf_starten(con, start, backfill=True)
    for i in range(28):
        erstellt = grenze + timedelta(hours=6 * i + 1)
        speichere(con, post(erstellt, folge=i), lauf_id, (start - erstellt).total_seconds() / 3600, backfill=True)
    alt = post("2025-01-20T17:00:00Z", folge=500)
    alt.gepinnt = True
    speichere(con, alt, lauf_id, (start - alt.created_at).total_seconds() / 3600, backfill=True)
    db.lauf_beenden(con, lauf_id, ende=start + timedelta(minutes=6), status="ok", zugriff="curl", abbruch_grund=None,
                    zaehler=LaufZaehler(), meldungen=[], abgedeckt_von=grenze, abgedeckt_bis=start)

    daten = auswertung.lade_daten(con)
    assert daten.erfasst_ab == pd.Timestamp(grenze)
    assert daten.erfasst_bis == pd.Timestamp(start + timedelta(minutes=6))
    assert daten.posts.loc[daten.posts["vor_erfassung"], "id"].tolist() == [alt.id]
    von, bis = auswertung.datenbereich(daten, BERLIN)
    assert (von, bis) == (date(2026, 9, 1), date(2026, 9, 8))

    df = auswertung.filtere(daten.posts, von, bis, BERLIN)
    assert len(df) == 28 and alt.id not in set(df["id"])
    u = auswertung.ueberblick(df, von, bis, erfasst_ab=daten.erfasst_ab, erfasst_bis=daten.erfasst_bis)
    assert u.kalendertage == 8
    # Randtage anteilig: 01.09. ab 14:00, 08.09. bis 14:06 Berliner Zeit, zusammen 7 Tage und 6 Minuten.
    assert u.tage == pytest.approx(7 + 6 / (24 * 60))
    assert u.pro_tag == pytest.approx(4, rel=1e-3)
    assert len(auswertung.posts_pro_tag(df, von=von, bis=bis)) == 8
    assert auswertung.anteil_retruths(df, frequenz="W").index.tolist() == [date(2026, 8, 31), date(2026, 9, 7)]
    assert auswertung.abstaende_minuten(df).max() == pytest.approx(360)
    assert auswertung.laengste_pause_pro_tag(df)["pause_h"].max() == pytest.approx(6)
    # Auch ohne Zeitraum-Grenzen bleibt der alte Post draußen und wird nie zum Vorgänger.
    alle = auswertung.filtere(daten.posts, None, None, BERLIN)
    assert len(alle) == 28 and pd.isna(alle["abstand_vorher_min"].iloc[0])

    mit_alten = auswertung.filtere(daten.posts, None, None, BERLIN, vor_erfassung=True)
    tabelle = auswertung.posts_tabelle(mit_alten).set_index("Post-ID")
    assert len(tabelle) == 29
    assert bool(tabelle.loc[alt.id, "Vor Beginn der Erfassung"]) is True
    assert tabelle["Vor Beginn der Erfassung"].sum() == 1


def test_ohne_backfill_grenze_zaehlt_alles_zur_erfassung(con, lauf):
    speichere(con, post("2026-06-01T10:00:00Z"), lauf, 20)
    daten = auswertung.lade_daten(con)
    assert daten.erfasst_ab is None
    assert daten.erfasst_bis == pd.Timestamp("2026-06-01T10:00:00Z")  # kein beendeter Lauf: letzter Post
    assert not daten.posts["vor_erfassung"].any()
    assert auswertung.datenbereich(daten, BERLIN) == (date(2026, 1, 1), date(2026, 6, 1))


def test_tagesabdeckung_randtage_und_sommerzeit():
    ab = pd.Timestamp("2026-03-29T10:00:00Z")  # Berlin 12:00 MESZ, an einem Tag mit nur 23 Stunden
    bis = pd.Timestamp("2026-03-31T06:00:00Z")  # Berlin 08:00 MESZ
    tage = [date(2026, 3, 28), date(2026, 3, 29), date(2026, 3, 30), date(2026, 3, 31), date(2026, 4, 1)]
    anteil = auswertung.tagesabdeckung(tage, BERLIN, ab, bis)
    assert anteil.index.tolist() == tage
    assert anteil.tolist() == pytest.approx([0, 12 / 23, 1, 8 / 24, 0])
    assert auswertung.tagesabdeckung(tage[:2], BERLIN, None, None).tolist() == [1.0, 1.0]
    # New York ist am 29.03. schon in der Sommerzeit: 10:00 UTC = 06:00 EDT, der Tag hat 24 h.
    assert auswertung.tagesabdeckung([date(2026, 3, 29)], NEW_YORK, ab, None).iloc[0] == pytest.approx(18 / 24)


# ---------------------------------------------------------------------------
# Filter, Zeitverlauf, Formate


def test_filtere_nach_typ_format_und_loeschung(con, lauf):
    a = post("2026-06-01T10:00:00Z", folge=1)
    b = post("2026-06-01T11:00:00Z", folge=2, typ=TYP_RETRUTH, format_=FORMAT_NUR_MEDIEN)
    c = post("2026-06-01T12:00:00Z", folge=3, reply_art=REPLY_THREAD)
    for p in (a, b, c):
        speichere(con, p, lauf, 1)
    db.als_geloescht_markieren(con, c.id, _t("2026-06-02T00:00:00Z"))
    posts = auswertung.lade_daten(con).posts
    assert len(auswertung.filtere(posts, None, None, BERLIN)) == 3
    assert auswertung.filtere(posts, None, None, BERLIN, typen=[TYP_RETRUTH])["id"].tolist() == [b.id]
    assert auswertung.filtere(posts, None, None, BERLIN, typen=["reply_thread"])["id"].tolist() == [c.id]
    assert auswertung.filtere(posts, None, None, BERLIN, formate=[FORMAT_NUR_TEXT])["id"].tolist() == [a.id, c.id]
    assert auswertung.filtere(posts, None, None, BERLIN, typen=[]).empty
    assert auswertung.filtere(posts, None, None, BERLIN, geloeschte=False)["id"].tolist() == [a.id, b.id]


def test_posts_pro_tag_lueckenlos_gestapelt_nach_typ(con, lauf):
    for i, (zeitpunkt, typ) in enumerate((
        ("2026-06-01T10:00:00Z", TYP_EIGEN), ("2026-06-01T11:00:00Z", TYP_RETRUTH),
        ("2026-06-01T12:00:00Z", TYP_EIGEN), ("2026-06-03T10:00:00Z", TYP_SELBST_RETRUTH),
    )):
        speichere(con, post(zeitpunkt, folge=i, typ=typ), lauf, 1)
    df = _gefiltert(con)
    tab = auswertung.posts_pro_tag(df, von=date(2026, 5, 31), bis=date(2026, 6, 4))
    assert tab.index.tolist() == [date(2026, 5, 31) + timedelta(days=i) for i in range(5)]
    assert tab.columns.tolist() == [TYP_EIGEN, TYP_RETRUTH, TYP_SELBST_RETRUTH]
    assert tab.loc[date(2026, 6, 1)].tolist() == [2, 1, 0]
    assert tab.loc[date(2026, 6, 2)].sum() == 0
    assert tab.to_numpy().sum() == 4


def test_anteil_retruths_pro_woche_und_tag(con, lauf):
    # 01.06.2026 ist ein Montag; 08.06. beginnt die nächste Woche.
    zeiten = [("2026-06-01T10:00:00Z", TYP_EIGEN), ("2026-06-02T10:00:00Z", TYP_RETRUTH),
              ("2026-06-07T10:00:00Z", TYP_RETRUTH), ("2026-06-08T10:00:00Z", TYP_EIGEN),
              ("2026-06-22T10:00:00Z", TYP_SELBST_RETRUTH)]
    for i, (zeitpunkt, typ) in enumerate(zeiten):
        speichere(con, post(zeitpunkt, folge=i, typ=typ), lauf, 1)
    df = _gefiltert(con)
    woche = auswertung.anteil_retruths(df, frequenz="W")
    assert woche.index.tolist() == [date(2026, 6, 1), date(2026, 6, 8), date(2026, 6, 15), date(2026, 6, 22)]
    assert woche["posts"].tolist() == [3, 1, 0, 1]
    assert woche["retruths"].tolist() == [2, 0, 0, 1]
    assert woche["eigene"].tolist() == [1, 1, 0, 0]
    assert woche["anteil_retruths"].iloc[0] == pytest.approx(2 / 3)
    assert pd.isna(woche["anteil_retruths"].iloc[2])
    tag = auswertung.anteil_retruths(df, frequenz="D")
    assert len(tag) == 22 and tag["posts"].sum() == 5
    monat = auswertung.anteil_retruths(df, frequenz="M")
    assert monat.index.tolist() == [date(2026, 6, 1)]
    with pytest.raises(ValueError):
        auswertung.anteil_retruths(df, frequenz="Q")


def test_formatmix_und_zeichenverteilung(con, lauf):
    daten = [(FORMAT_NUR_TEXT, 30), (FORMAT_NUR_TEXT, 120), (FORMAT_NUR_MEDIEN, 0), (FORMAT_TEXT_LINK, 51)]
    for i, (fmt, zeichen) in enumerate(daten):
        speichere(con, post(f"2026-06-0{i + 1}T10:00:00Z", folge=i, format_=fmt, zeichen=zeichen), lauf, 1)
    df = _gefiltert(con)
    mix = auswertung.formatmix_zeitverlauf(df, frequenz="W")
    assert mix.columns.tolist() == [FORMAT_NUR_TEXT, FORMAT_NUR_MEDIEN, FORMAT_TEXT_LINK]
    assert mix.iloc[0].tolist() == pytest.approx([0.5, 0.25, 0.25])
    anzahl = auswertung.formatmix_zeitverlauf(df, frequenz="W", anteil=False)
    assert anzahl.iloc[0].tolist() == [2, 1, 1]
    verteilung = auswertung.zeichen_verteilung(df, breite=50)
    assert verteilung["klasse"].tolist() == ["0", "1–50", "51–100", "101–150"]
    assert verteilung["anzahl"].tolist() == [1, 1, 1, 1]


def test_ueberblick_und_medien(con, lauf):
    speichere(con, post("2026-06-01T10:00:00Z", folge=1, bilder=2, format_=FORMAT_NUR_MEDIEN), lauf, 1)
    speichere(con, post("2026-06-02T10:00:00Z", folge=2, typ=TYP_RETRUTH), lauf, 1)
    speichere(con, post("2026-06-02T11:00:00Z", folge=3, typ=TYP_SELBST_RETRUTH), lauf, 1)
    df = _gefiltert(con)
    u = auswertung.ueberblick(df, date(2026, 6, 1), date(2026, 6, 10))
    assert (u.posts, u.tage, u.eigene, u.retruths, u.selbst_retruths, u.mit_medien) == (3, 10, 1, 2, 1, 1)
    assert u.pro_tag == pytest.approx(0.3)
    assert u.anteil_retruths == pytest.approx(2 / 3)
    medien = auswertung.medien_uebersicht(df).set_index("art")
    assert medien.loc["Bilder", "medien"] == 2 and medien.loc["Bilder", "posts"] == 1


# ---------------------------------------------------------------------------
# Abstände, Serien, Pausen


def test_serien_schwelle_ist_strikt(con, lauf):
    basis = _t("2026-07-01T12:00:00Z")
    minuten = [0, 5, 9, 19, 40, 45]  # Abstände 5, 4, 10, 21, 5
    for i, m in enumerate(minuten):
        speichere(con, post(basis + timedelta(minutes=m), folge=i), lauf, 1)
    df = _gefiltert(con)
    s = auswertung.serien(df, 10)
    assert s["anzahl"].tolist() == [3, 2]
    assert s["dauer_min"].tolist() == [9.0, 5.0]
    assert s["start"].iloc[0].strftime("%H:%M") == "14:00"  # Berlin, Sommerzeit
    assert s["stunde"].tolist() == [14, 14]
    # Ein Abstand von genau 10 min beendet die Serie, mit 10,5 min Schwelle gehört Minute 19 dazu.
    assert auswertung.serien(df, 10.5)["anzahl"].tolist() == [4, 2]
    assert auswertung.serien(df, 4)["anzahl"].tolist() == []
    k = auswertung.serien_kennzahlen(s, len(df))
    assert (k.anzahl, k.posts_in_serien, k.laengste) == (2, 5, 3)
    assert k.anteil_posts == pytest.approx(5 / 6)
    assert k.mittlere_laenge == pytest.approx(2.5)
    assert k.median_dauer_min == pytest.approx(7.0)
    assert auswertung.serien_nach_laenge(s).to_dict("list") == {"laenge": [2, 3], "anzahl": [1, 1]}
    nach_stunde = auswertung.serien_nach_stunde(s)
    assert len(nach_stunde) == 24 and nach_stunde.loc[14, "anzahl"] == 2
    assert auswertung.serien(df, 10, NEW_YORK)["stunde"].tolist() == [8, 8]
    with pytest.raises(ValueError):
        auswertung.serien(df, 0)


def test_abstaende_und_verteilung(con, lauf):
    basis = _t("2026-07-01T12:00:00Z")
    for i, m in enumerate([0, 0.5, 3, 63, 1563]):
        speichere(con, post(basis + timedelta(minutes=m), folge=i), lauf, 1)
    df = _gefiltert(con)
    abst = auswertung.abstaende_minuten(df)
    assert abst.tolist() == [0.5, 2.5, 60.0, 1500.0]
    verteilung = auswertung.abstaende_verteilung(abst).set_index("klasse")["anzahl"]
    assert verteilung["< 1 min"] == 1 and verteilung["1–5 min"] == 1
    assert verteilung["1–2 h"] == 1 and verteilung["≥ 24 h"] == 1
    assert verteilung.sum() == 4 and len(verteilung) == len(auswertung.ABSTAND_KLASSEN_MIN)


def test_laengste_pause_zaehlt_zum_tag_an_dem_sie_endet(con, lauf):
    # Berlin im Juli (MESZ, UTC+2): Tag 1 um 08:00, 12:00, 22:00; Tag 2 um 07:00, 09:00; Tag 4 um 10:00.
    lokal = ["2026-07-01T06:00:00Z", "2026-07-01T10:00:00Z", "2026-07-01T20:00:00Z",
             "2026-07-02T05:00:00Z", "2026-07-02T07:00:00Z", "2026-07-04T08:00:00Z"]
    for i, zeitpunkt in enumerate(lokal):
        speichere(con, post(zeitpunkt, folge=i), lauf, 1)
    pausen = auswertung.laengste_pause_pro_tag(_gefiltert(con)).set_index("datum")
    assert pausen.index.tolist() == [date(2026, 7, 1), date(2026, 7, 2), date(2026, 7, 4)]
    assert pausen.loc[date(2026, 7, 1), "pause_h"] == pytest.approx(10)  # 12→22 Uhr
    assert pausen.loc[date(2026, 7, 2), "pause_h"] == pytest.approx(9)  # Nachtpause 22→07 Uhr
    assert pausen.loc[date(2026, 7, 2), "von"].strftime("%d.%m. %H:%M") == "01.07. 22:00"
    assert pausen.loc[date(2026, 7, 4), "pause_h"] == pytest.approx(49)  # über den postfreien 3. Juli
    assert pausen["posts"].tolist() == [3, 2, 1]
    # In New York liegt die Nachtpause anders: 07-01 16:00 → 07-02 01:00 EDT zählt zum 2. Juli.
    ny = auswertung.laengste_pause_pro_tag(_gefiltert(con, NEW_YORK)).set_index("datum")
    assert ny.loc[date(2026, 7, 2), "pause_h"] == pytest.approx(9)
    assert ny.loc[date(2026, 7, 2), "bis"].strftime("%H:%M") == "01:00"


def test_laengste_pause_erster_post_ohne_vorgaenger(con, lauf):
    speichere(con, post("2026-07-01T06:00:00Z"), lauf, 1)
    pausen = auswertung.laengste_pause_pro_tag(_gefiltert(con))
    assert pausen["posts"].tolist() == [1]
    assert pd.isna(pausen["pause_h"].iloc[0])


def test_vorgaenger_vor_dem_zeitraum_zaehlt_mit(con, lauf):
    # Berlin (MESZ): 09.09. 22:00, 10.09. 07:00 und 08:00. Die Nachtpause gehört zum 10.09., egal
    # ob der Zeitraum am 09. oder am 10. beginnt.
    for i, zeitpunkt in enumerate(("2026-09-09T20:00:00Z", "2026-09-10T05:00:00Z", "2026-09-10T06:00:00Z")):
        speichere(con, post(zeitpunkt, folge=i), lauf, 20)
    posts = auswertung.lade_daten(con).posts
    for von in (date(2026, 9, 9), date(2026, 9, 10)):
        df = auswertung.filtere(posts, von, date(2026, 9, 10), BERLIN)
        pausen = auswertung.laengste_pause_pro_tag(df).set_index("datum")
        assert pausen.loc[date(2026, 9, 10), "pause_h"] == pytest.approx(9), von
        assert pausen.loc[date(2026, 9, 10), "von"].strftime("%d.%m. %H:%M") == "09.09. 22:00"
        assert pausen.loc[date(2026, 9, 10), "posts"] == 2
    nur_zehnter = auswertung.filtere(posts, date(2026, 9, 10), date(2026, 9, 10), BERLIN)
    assert auswertung.abstaende_minuten(nur_zehnter).tolist() == [540.0, 60.0]
    # Der Vorgänger kommt aus derselben Auswahl: ohne Retruths im Filter gibt es keinen.
    nur_retruths = auswertung.filtere(posts, date(2026, 9, 10), date(2026, 9, 10), BERLIN, typen=[TYP_RETRUTH])
    assert auswertung.abstaende_minuten(nur_retruths).empty


def test_serien_ueber_die_zeitraumgrenze(con, lauf):
    # Berlin (MESZ): 09.09. 23:50 und 23:55, 10.09. 00:02, 00:05 und 12:00.
    zeiten = ("2026-09-09T21:50:00Z", "2026-09-09T21:55:00Z", "2026-09-09T22:02:00Z", "2026-09-09T22:05:00Z",
              "2026-09-10T10:00:00Z")
    for i, zeitpunkt in enumerate(zeiten):
        speichere(con, post(zeitpunkt, folge=i), lauf, 20)
    posts = auswertung.lade_daten(con).posts
    umfeld = auswertung.filtere(posts, None, None, BERLIN)

    zehnter = auswertung.filtere(posts, date(2026, 9, 10), date(2026, 9, 10), BERLIN)
    s = auswertung.serien(zehnter, 10, umfeld=umfeld)
    assert s["anzahl"].tolist() == [4] and s["posts_im_zeitraum"].tolist() == [2]
    assert s["beginn_im_zeitraum"].tolist() == [False]  # begann am Vortag, zählt dort
    assert auswertung.serien_im_zeitraum(s).empty
    k = auswertung.serien_kennzahlen(s, len(zehnter))
    assert (k.anzahl, k.posts_in_serien, k.laengste) == (0, 2, 0)
    assert k.anteil_posts == pytest.approx(2 / 3)
    assert auswertung.serien_nach_laenge(s).empty
    assert auswertung.serien_nach_stunde(s)["anzahl"].sum() == 0

    neunter = auswertung.filtere(posts, date(2026, 9, 9), date(2026, 9, 9), BERLIN)
    s9 = auswertung.serien(neunter, 10, umfeld=umfeld)
    assert s9["anzahl"].tolist() == [4] and s9["beginn_im_zeitraum"].tolist() == [True]
    assert s9["dauer_min"].tolist() == [15.0] and s9["stunde"].tolist() == [23]
    k9 = auswertung.serien_kennzahlen(s9, len(neunter))
    assert (k9.anzahl, k9.laengste, k9.posts_in_serien) == (1, 4, 2)
    assert auswertung.serien(neunter, 10)["anzahl"].tolist() == [2]  # ohne Umfeld nur der Teil im Zeitraum


# ---------------------------------------------------------------------------
# Engagement und Messalter


def test_messalter_text():
    assert auswertung.messalter_text(17.3, False) == "gemessen nach 17,3 h"
    assert auswertung.messalter_text(17.25, False) == "gemessen nach 17,3 h"  # kaufmännisch, nicht 17,2
    assert auswertung.messalter_text(50.2, False) == "gemessen nach 50,2 h"
    assert auswertung.messalter_text(1234.5, False) == "gemessen nach 1.234,5 h"
    assert auswertung.messalter_text(12 * 24 + 3, True) == "Endstand nach 12 Tagen"
    assert auswertung.messalter_text(30, True) == "Endstand nach 1 Tag"
    assert auswertung.messalter_text(60, True) == "Endstand nach 3 Tagen"  # 2,5 Tage, kaufmännisch gerundet
    assert auswertung.messalter_text(None, False) == "keine Messung"
    assert auswertung.messalter_text(float("nan"), True) == "keine Messung"


def test_engagement_filtert_nach_messalter_und_schliesst_backfill_aus(con, lauf):
    im_fenster = post("2026-06-01T10:00:00Z", folge=1, likes=100)
    zu_jung = post("2026-06-01T11:00:00Z", folge=2, likes=10)
    spaet_gesehen = post("2026-06-01T12:00:00Z", folge=3, likes=999)
    backfill = post("2026-05-01T12:00:00Z", folge=4, likes=5000)
    ohne_messung = post("2026-06-01T13:00:00Z", folge=5, likes=1)
    speichere(con, im_fenster, lauf, 20)
    speichere(con, zu_jung, lauf, 5)
    speichere(con, spaet_gesehen, lauf, 50.2)
    speichere(con, backfill, lauf, 300, backfill=True)
    db.post_speichern(con, ohne_messung, lauf_id=lauf, gesehen=_t("2026-06-01T14:00:00Z"), backfill=False)
    df = _gefiltert(con)

    e = auswertung.engagement(df, 18, 24)
    assert e.basis["id"].tolist() == [im_fenster.id]
    assert e.basis["wert"].tolist() == [100.0]
    assert (e.ohne_messung, e.ausserhalb_alter, e.backfill_ausgeschlossen, e.backfill_einbezogen) == (1, 2, 1, 0)
    assert e.wert_beschriftung == "Likes"

    mit = auswertung.engagement(df, 18, 24, mit_backfill=True)
    assert set(mit.basis["id"]) == {im_fenster.id, backfill.id}
    assert (mit.backfill_ausgeschlossen, mit.backfill_einbezogen) == (0, 1)

    breit = auswertung.engagement(df, 0, 72)
    assert set(breit.basis["id"]) == {im_fenster.id, zu_jung.id, spaet_gesehen.id}

    norm = auswertung.engagement(df, 18, 24, pro_stunde=True)
    assert norm.basis["wert"].tolist() == [pytest.approx(5.0)]
    assert norm.wert_beschriftung == "Likes pro Stunde seit Post"


def test_engagement_original_zaehler_bei_retruths_getrennt(con, lauf):
    eigen = post("2026-06-01T08:00:00Z", folge=1, likes=100, weitere={"upvotes_count": 90})
    rt = post("2026-06-01T09:00:00Z", folge=2, typ=TYP_RETRUTH, orig_likes=600, original_vor=timedelta(hours=4))
    srt = post("2026-06-01T10:00:00Z", folge=3, typ=TYP_SELBST_RETRUTH, orig_likes=900)
    for p in (eigen, rt, srt):
        speichere(con, p, lauf, 20)
    df = _gefiltert(con)
    e = auswertung.engagement(df, 18, 24)
    typ = e.nach_typ.set_index(["gruppe", "zaehler"])
    assert typ.loc[(TYP_EIGEN, auswertung.ZAEHLER_POST), "median"] == 100
    assert (TYP_EIGEN, auswertung.ZAEHLER_ORIGINAL) not in typ.index
    assert typ.loc[(TYP_RETRUTH, auswertung.ZAEHLER_POST), "median"] == 0
    assert typ.loc[(TYP_RETRUTH, auswertung.ZAEHLER_ORIGINAL), "median"] == 600
    assert typ.loc[(TYP_SELBST_RETRUTH, auswertung.ZAEHLER_ORIGINAL), "median"] == 900
    assert e.nach_typ["gruppe"].tolist()[0] == TYP_EIGEN
    stunde = e.nach_stunde.set_index(["gruppe", "zaehler"])
    assert stunde.loc[(10, auswertung.ZAEHLER_POST), "anzahl"] == 1  # 08:00 UTC = 10 Uhr Berlin
    fmt = e.nach_format.set_index(["gruppe", "zaehler"])
    assert fmt.loc[(FORMAT_NUR_TEXT, auswertung.ZAEHLER_POST), "anzahl"] == 3

    # Normiert: Original durch das eigene Alter des Originals (20 h + 4 h) teilen.
    norm = auswertung.engagement(df, 18, 24, pro_stunde=True)
    zeile = norm.basis.set_index("id").loc[rt.id]
    assert zeile["orig_wert"] == pytest.approx(600 / 24)
    weitere = auswertung.engagement(df, 18, 24, kennzahl="upvotes_count")
    assert weitere.basis.set_index("id").loc[eigen.id, "wert"] == 90
    assert weitere.basis.set_index("id").loc[rt.id, "orig_wert"] == 7
    assert weitere.wert_beschriftung == "Upvotes"


def test_engagement_original_nur_bei_passendem_alter_des_originals(con, lauf):
    # Beide Retruths sind beim Messen 20 h alt; ihre Originale aber gut 20 h bzw. 500 h.
    jung = post("2026-06-08T10:00:00Z", folge=1, typ=TYP_RETRUTH, orig_likes=1000, original_vor=timedelta(minutes=10))
    alt = post("2026-06-08T11:00:00Z", folge=2, typ=TYP_RETRUTH, orig_likes=90_000, original_vor=timedelta(days=20))
    bf = post("2026-05-01T11:00:00Z", folge=3, typ=TYP_RETRUTH, orig_likes=5, original_vor=timedelta(days=3))
    speichere(con, jung, lauf, 20)
    speichere(con, alt, lauf, 20)
    speichere(con, bf, lauf, 300, backfill=True)
    df = _gefiltert(con)

    e = auswertung.engagement(df, 18, 24)
    b = e.basis.set_index("id")
    assert b.loc[jung.id, "orig_alter_h"] == pytest.approx(20 + 10 / 60)
    assert b.loc[alt.id, "orig_alter_h"] == pytest.approx(500)
    assert b.loc[jung.id, "orig_wert"] == 1000 and pd.isna(b.loc[alt.id, "orig_wert"])
    assert b.loc[alt.id, "wert"] == 0  # die eigenen Zähler des Retruths bleiben im Vergleich
    assert e.original_ausserhalb_alter == 1
    typ = e.nach_typ.set_index(["gruppe", "zaehler"])
    original = typ.loc[(TYP_RETRUTH, auswertung.ZAEHLER_ORIGINAL)]
    assert (original["anzahl"], original["median"]) == (1, 1000)
    assert original["alter_median_h"] == pytest.approx(20 + 10 / 60)
    selbst = typ.loc[(TYP_RETRUTH, auswertung.ZAEHLER_POST)]
    assert selbst["anzahl"] == 2 and selbst["alter_median_h"] == pytest.approx(20)

    assert auswertung.engagement(df, 0, 600).original_ausserhalb_alter == 0
    mit = auswertung.engagement(df, 18, 24, mit_backfill=True)
    assert mit.basis.set_index("id").loc[bf.id, "orig_wert"] == 5  # für Backfill gilt der Alter-Filter nicht
    assert (mit.im_messalter, mit.backfill_einbezogen) == (2, 1)


def test_wachstum_aus_allen_snapshots(con):
    p = post("2026-06-01T10:00:00Z", likes=10)
    bf = post("2026-05-01T10:00:00Z", folge=1, likes=5000)
    for i, (alter, likes) in enumerate([(2.5, 10), (8.2, 40), (20.0, 90)]):
        lauf_id = db.lauf_starten(con, p.created_at + timedelta(hours=alter), backfill=False)
        p.zaehler.likes = likes
        speichere(con, p, lauf_id, alter)
        if i == 0:
            speichere(con, bf, lauf_id, 2.5, backfill=True)
    daten = auswertung.lade_daten(con)
    df = auswertung.filtere(daten.posts, None, None, BERLIN)
    w = auswertung.wachstum(daten.snapshots, df, "likes").set_index("alter_stunde")
    assert len(w) == 24
    assert w.loc[2, "median"] == 10 and w.loc[8, "median"] == 40 and w.loc[20, "median"] == 90
    assert w["messungen"].sum() == 3
    assert pd.isna(w.loc[5, "median"])
    mit = auswertung.wachstum(daten.snapshots, df, "likes", mit_backfill=True).set_index("alter_stunde")
    assert mit.loc[2, "messungen"] == 2
    norm = auswertung.wachstum(daten.snapshots, df, "likes", pro_stunde=True).set_index("alter_stunde")
    assert norm.loc[20, "median"] == pytest.approx(4.5)


# ---------------------------------------------------------------------------
# Retruth-Quellen, Duplikate, Löschungen, Konto


def test_retruth_quellen_top_konten_selbstanteil_latenz(con, lauf):
    a = quelle("201", "konto_a", "Konto A", True, 5000)
    b = quelle("202", "konto_b", "Konto B", False, 300)
    eintraege = [
        post("2026-06-01T10:00:00Z", folge=1, typ=TYP_RETRUTH, quell_konto=a, original_vor=timedelta(minutes=3)),
        post("2026-06-01T11:00:00Z", folge=2, typ=TYP_RETRUTH, quell_konto=a, original_vor=timedelta(hours=2)),
        post("2026-06-01T12:00:00Z", folge=3, typ=TYP_RETRUTH, quell_konto=b, original_vor=timedelta(days=2)),
        post("2026-06-01T13:00:00Z", folge=4, typ=TYP_SELBST_RETRUTH, original_vor=timedelta(days=10)),
        post("2026-06-01T14:00:00Z", folge=5),
    ]
    for p in eintraege:
        speichere(con, p, lauf, 1)
    r = auswertung.retruth_quellen(_gefiltert(con))
    assert (r.anzahl, r.selbst) == (4, 1)
    assert r.anteil_selbst == pytest.approx(0.25)
    assert r.top["handle"].tolist() == ["konto_a", "konto_b", "realDonaldTrump"]
    assert r.top["anzahl"].tolist() == [2, 1, 1]
    assert r.top["anteil"].tolist() == pytest.approx([0.5, 0.25, 0.25])
    assert r.top["ist_trump"].tolist() == [False, False, True]
    assert r.top.loc[0, "follower"] == 5000 and bool(r.top.loc[1, "verifiziert"]) is False
    verteilung = r.latenz_verteilung.set_index("klasse")["anzahl"]
    assert verteilung["< 5 min"] == 1 and verteilung["1–3 h"] == 1
    assert verteilung["1–3 Tage"] == 1 and verteilung["≥ 7 Tage"] == 1
    assert r.latenz_median_min == pytest.approx((120 + 2880) / 2)


def test_retruth_ohne_quellkonto_heisst_unbekanntes_konto(con, lauf):
    ohne = post("2026-06-01T10:00:00Z", folge=1, typ=TYP_RETRUTH)
    ohne.quellen = []
    nur_id = post("2026-06-01T11:00:00Z", folge=2, typ=TYP_RETRUTH)
    nur_id.quellen = [QuellKonto(rolle=ROLLE_RETRUTH, konto_id="444")]
    for p in (ohne, nur_id):
        speichere(con, p, lauf, 1)
    r = auswertung.retruth_quellen(_gefiltert(con))
    assert sorted(r.top["beschriftung"]) == ["Konto 444", "unbekanntes Konto"]
    assert not any("None" in b or "nan" in b for b in r.top["beschriftung"])
    assert auswertung.konto_beschriftung("jemand", "1") == "@jemand"
    assert auswertung.konto_beschriftung(None, float("nan")) == "unbekanntes Konto"


def test_duplikat_rate_nur_mit_vollstaendiger_abdeckung(con, lauf):
    posts = [post(f"2026-06-0{i + 1}T10:00:00Z", folge=i) for i in range(5)]
    for p in posts:
        speichere(con, p, lauf, 1)
    with con:
        jetzt = "2026-06-10T00:00:00Z"
        con.executemany(
            "UPDATE posts SET dup_geprueft_utc = ?, dup_abdeckung_vollstaendig = ? WHERE id = ?",
            [(jetzt, 0, posts[0].id), (jetzt, 1, posts[1].id), (jetzt, 1, posts[2].id),
             (jetzt, 1, posts[3].id), (jetzt, 1, posts[4].id)],
        )
        con.executemany(
            "INSERT INTO duplikate (post_id, art, frueherer_post_id, abstand_s, primaer) VALUES (?, ?, ?, ?, ?)",
            [
                (posts[0].id, DUP_EXAKT, "1", 600, 1),  # Fenster unvollständig: zählt nicht zur Rate
                (posts[2].id, DUP_EXAKT, posts[1].id, 86400, 1),
                (posts[2].id, DUP_NUR_TEXT, posts[1].id, 86400, 0),
                (posts[4].id, DUP_NUR_TEXT, posts[3].id, 2 * 3600, 1),
            ],
        )
    daten = auswertung.lade_daten(con)
    df = auswertung.filtere(daten.posts, None, None, BERLIN)
    d = auswertung.duplikat_auswertung(df, daten.duplikate)
    assert (d.gepruefte, d.mit_duplikat, d.ohne_abdeckung) == (4, 2, 1)
    assert d.rate == pytest.approx(0.5)
    art = d.nach_art.set_index("art")
    # Verteilungen zählen dieselben Posts wie die Rate; der Treffer ohne volles Fenster steht getrennt.
    assert art.loc[DUP_EXAKT, "primaer"] == 1 and art.loc[DUP_EXAKT, "alle"] == 1
    assert art.loc[DUP_EXAKT, "primaer_ohne_abdeckung"] == 1
    assert art.loc[DUP_NUR_TEXT, "primaer"] == 1 and art.loc[DUP_NUR_TEXT, "alle"] == 2
    assert art.loc[DUP_EXAKT, "anteil_gepruefte"] == pytest.approx(0.25)
    assert art.loc[DUP_EXAKT, "beschriftung"] == "exakt gleich (Text + Medien)"
    assert d.mit_duplikat_ohne_abdeckung == 1
    assert art["primaer"].sum() == d.mit_duplikat
    assert d.abstand_verteilung.to_numpy().sum() == d.mit_duplikat
    assert d.abstand_verteilung.loc["< 1 h", DUP_EXAKT] == 0
    assert d.abstand_verteilung.loc["1–3 Tage", DUP_EXAKT] == 1
    assert d.abstand_verteilung.loc["1–6 h", DUP_NUR_TEXT] == 1
    assert len(d.liste) == 4 and d.liste["geprueft"].tolist().count(False) == 1
    posts_df = daten.posts.set_index("id")
    assert posts_df.loc[posts[2].id, "dup_art"] == DUP_EXAKT
    assert posts_df.loc[posts[2].id, "dup_abstand_s"] == 86400


def test_loeschungen_als_intervall_und_edits(con, lauf):
    p = post("2026-06-01T10:00:00Z", folge=1)
    unklar = post("2026-06-01T11:00:00Z", folge=2)
    editiert = post("2026-06-01T12:00:00Z", folge=3)
    speichere(con, p, lauf, 5)  # zuletzt gesehen 15:00 UTC
    speichere(con, unklar, lauf, 1)
    speichere(con, editiert, lauf, 1)
    lauf2 = db.lauf_starten(con, _t("2026-06-02T10:00:00Z"), backfill=False)
    editiert.text.text_hash = _hash("neu")
    speichere(con, editiert, lauf2, 22)
    db.als_vermisst_markieren(con, p.id, _t("2026-06-02T10:00:00Z"))
    db.als_geloescht_markieren(con, p.id, _t("2026-06-03T10:00:00Z"))
    db.als_vermisst_markieren(con, unklar.id, _t("2026-06-02T10:00:00Z"))
    daten = auswertung.lade_daten(con)
    df = auswertung.filtere(daten.posts, None, None, BERLIN)
    le = auswertung.loeschungen_edits(df, daten.edits)
    assert (le.geloescht, le.vermisst, le.posts_mit_edits, le.edits_gesamt) == (1, 1, 1, 1)
    zeile = le.loeschungen.iloc[0]
    assert zeile["min_h"] == pytest.approx(5)
    assert zeile["max_h"] == pytest.approx(24)  # erstmals vermisst, nicht erst bestätigt
    assert str(zeile["erstellt"].tz) == BERLIN
    assert le.edits["art"].tolist() == ["fingerabdruck"]
    assert le.edits["nach_h"].iloc[0] == pytest.approx(22)
    assert le.edits_nach_art.set_index("art").loc["fingerabdruck", "anzahl"] == 1
    ohne_geloeschte = auswertung.filtere(daten.posts, None, None, BERLIN, geloeschte=False)
    assert auswertung.loeschungen_edits(ohne_geloeschte, daten.edits).geloescht == 0


def test_konto_zeitreihe_und_laeufe(tmp_path):
    pfad = baue_beispiel_db(tmp_path / "beispiel.sqlite")
    con = db.oeffne(pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    reihe = auswertung.konto_zeitreihe(daten.konto, BERLIN)
    assert reihe["follower"].tolist() == [11_000_000, 11_050_000, 11_070_000]
    assert str(reihe["gemessen"].dt.tz) == BERLIN
    assert pd.isna(reihe["posts_pro_tag"].iloc[0])
    assert reihe["posts_pro_tag"].iloc[1] == pytest.approx(210 / 9)
    tabelle = auswertung.laeufe_tabelle(daten.laeufe, NEW_YORK)
    assert tabelle["Lauf"].tolist() == [3, 2, 1]
    assert tabelle["Status"].tolist() == ["abgebrochen", "ok", "ok"]
    assert tabelle["Dauer (min)"].tolist() == [5.0, 3.0, 4.0]
    assert "Start (New York)" in tabelle.columns
    assert tabelle["Meldungen"].iloc[0] == "Zu viele Anfragen (HTTP 429)."
    # Beginn ist die Backfill-Grenze, nicht der gepinnte Post von 2025.
    assert auswertung.datenbereich(daten, BERLIN) == (date(2026, 8, 4), date(2026, 9, 11))
    assert auswertung.datenbereich(daten, BERLIN, mit_vor_erfassung=True) == (date(2025, 1, 20), date(2026, 9, 11))


def test_beispiel_db_alle_auswertungen_laufen(tmp_path):
    pfad = baue_beispiel_db(tmp_path / "beispiel.sqlite")
    con = db.oeffne(pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    df = auswertung.filtere(daten.posts, None, None, NEW_YORK)
    assert len(df) == 21  # ohne den alten gepinnten Post
    assert len(auswertung.filtere(daten.posts, None, None, NEW_YORK, vor_erfassung=True)) == 22
    assert df["backfill"].sum() == 10
    e = auswertung.engagement(df, 18, 24)
    assert not e.basis["backfill"].any()
    assert e.backfill_ausgeschlossen == 10
    assert auswertung.serien(df, 10)["anzahl"].max() == 4
    assert auswertung.retruth_quellen(df).selbst == 3
    assert auswertung.duplikat_auswertung(df, daten.duplikate).mit_duplikat == 2
    assert auswertung.loeschungen_edits(df, daten.edits).geloescht == 1
    assert auswertung.loeschungen_edits(df, daten.edits).posts_mit_edits == 1


# ---------------------------------------------------------------------------
# Tabelle und CSV


_VERBOTENE_WOERTER = {
    "content", "html", "inhalt", "inhalte", "media", "preview", "alt", "alttext", "beschreibung", "description",
    "kartentitel", "titel", "kommentar", "kommentare", "url", "medienurl",
}


def _spalte_erlaubt(spalte: str) -> bool:
    woerter = set(re.findall(r"[a-zäöüß]+", spalte.lower()))
    if woerter & _VERBOTENE_WOERTER:
        return False
    return "text" not in woerter or "hash" in woerter


def test_posts_tabelle_und_csv_ohne_inhalte(con, lauf):
    rt = post("2026-06-01T10:00:00Z", folge=1, typ=TYP_RETRUTH,
              quell_konto=quelle("777", "formel_konto", "=HYPERLINK(1)", True, 10))
    eigen = post("2026-06-01T11:00:00Z", folge=2, likes=42, weitere={"upvotes_count": 41})
    speichere(con, rt, lauf, 17.25)
    speichere(con, eigen, lauf, 20.5)
    df = _gefiltert(con)
    tabelle = auswertung.posts_tabelle(df)
    assert tabelle["Post-ID"].tolist() == [eigen.id, rt.id]  # neueste zuerst
    assert tabelle["Link"].tolist()[1] == rt.url
    assert tabelle["Erstellt (Berlin)"].iloc[0] == pd.Timestamp("2026-06-01 13:00:00")
    assert tabelle["Typ"].tolist() == ["eigener Post", "Retruth"]
    assert tabelle["Messung"].tolist() == ["gemessen nach 20,5 h", "gemessen nach 17,3 h"]
    assert tabelle["Upvotes"].tolist() == [41, 0]
    assert tabelle["Original: Likes"].iloc[1] == 500
    assert all(_spalte_erlaubt(s) for s in tabelle.columns), [s for s in tabelle.columns if not _spalte_erlaubt(s)]
    assert not _spalte_erlaubt("Kartentitel") and not _spalte_erlaubt("Text") and _spalte_erlaubt("Text-Hash")

    roh = auswertung.csv_export(tabelle)
    assert roh.startswith(b"\xef\xbb\xbf")
    text = roh.decode("utf-8-sig")
    zeilen = text.split("\r\n")
    kopf = zeilen[0].split(";")
    assert kopf[:3] == ["Post-ID", "Link", "Erstellt (UTC)"]
    assert len(zeilen) == 4 and zeilen[-1] == ""
    assert MARKER not in text
    assert "<" not in text and "/media/" not in text
    werte = dict(zip(kopf, zeilen[2].split(";"), strict=True))
    assert werte["Messalter (h)"] == "17,25"
    assert werte["Retruth-Quelle: Anzeigename"] == "'=HYPERLINK(1)"
    assert werte["Retruth-Quelle: verifiziert"] == "ja"
    assert werte["Gelöscht"] == "nein"
    assert werte["Erstellt (UTC)"] == "2026-06-01 10:00:00"
    assert werte["Retruth-Latenz (min)"] == "120,0"
    punkt = auswertung.csv_export(tabelle, dezimalkomma=False).decode("utf-8-sig")
    assert ";17.25;" in punkt


def test_posts_tabelle_ohne_lokale_zeit_fuer_export(con, lauf):
    speichere(con, post("2026-06-01T10:00:00Z"), lauf, 20)
    posts = auswertung.lade_daten(con).posts
    ohne = auswertung.posts_tabelle(posts)
    assert not any(s.startswith("Erstellt (") and s != "Erstellt (UTC)" for s in ohne.columns)
    mit = auswertung.posts_tabelle(posts, "ET")
    assert mit["Erstellt (New York)"].iloc[0] == pd.Timestamp("2026-06-01 06:00:00")


def test_weitere_zaehler_ueberschreiben_keine_basisspalten(con, lauf):
    # Ein API-Feld likes_count hieße naiv auch „Likes“; "lokal" würde mit filtere() kollidieren.
    eigen = post("2026-06-01T10:00:00Z", folge=1, likes=3, weitere={"likes_count": 7, "lokal": 5})
    rt = post("2026-06-01T11:00:00Z", folge=2, typ=TYP_RETRUTH)
    speichere(con, eigen, lauf, 20)
    speichere(con, rt, lauf, 20)
    daten = auswertung.lade_daten(con)
    assert daten.kennzahlen == ("likes", "retruths", "replies", "likes_count", "upvotes_count")
    beschriftungen = [auswertung.kennzahl_beschriftung(k) for k in daten.kennzahlen]
    assert len(set(beschriftungen)) == len(beschriftungen)
    assert auswertung.kennzahl_beschriftung("likes_count") == "Likes (API-Feld likes_count)"
    df = auswertung.filtere(daten.posts, None, None, BERLIN)
    assert str(df["lokal"].dt.tz) == BERLIN
    tabelle = auswertung.posts_tabelle(df)
    assert tabelle.columns.is_unique
    t = tabelle.set_index("Post-ID")
    assert t.loc[eigen.id, "Likes"] == 3 and t.loc[rt.id, "Likes"] == 0
    assert t.loc[eigen.id, "Likes (API-Feld likes_count)"] == 7
    assert "Original: Likes (API-Feld likes_count)" in t.columns


def test_csv_ids_bleiben_in_excel_ganz(con, lauf):
    rt = post("2026-06-01T10:00:00Z", folge=1, typ=TYP_RETRUTH, quell_konto=quelle("123456789012345678", "konto_x"))
    speichere(con, rt, lauf, 20)
    roh = auswertung.csv_export(auswertung.posts_tabelle(_gefiltert(con))).decode("utf-8-sig")
    kopf, zeile = list(csv.reader(io.StringIO(roh), delimiter=";"))[:2]
    werte = dict(zip(kopf, zeile, strict=True))
    assert len(rt.id) == 18
    # Als Zahl behielte Excel nur 15 Stellen; ="…" bleibt Text mit allen Ziffern.
    assert werte["Post-ID"] == f'="{rt.id}"'
    assert werte["Original-Post-ID"] == f'="{rt.original_id}"'
    assert werte["Retruth-Quelle: Konto-ID"] == '="123456789012345678"'
    assert werte["Antwort auf Post-ID"] == "" and werte["Quote-Quelle: Konto-ID"] == ""
    assert werte["Link"] == rt.url
    assert werte["Likes"] == "0" and werte["Text-Hash"] == rt.text.text_hash
    assert sum(1 for s in kopf if re.search(r"\bID\b", s)) == 8


def test_ende_zu_ende_keine_inhalte_in_tabelle_und_csv(tmp_path):
    pfad = baue_inhalts_db(tmp_path / "inhalt.sqlite", marker_im_protokoll=True)
    con = db.oeffne(pfad, nur_lesen=True)
    try:
        daten = auswertung.lade_daten(con)
    finally:
        con.close()
    # Gegenprobe: Der Marker ist in der Datenbank und über das Laufprotokoll auffindbar …
    assert MARKER in auswertung.laeufe_tabelle(daten.laeufe, BERLIN).to_csv()
    df = auswertung.filtere(daten.posts, None, None, BERLIN, vor_erfassung=True)
    assert len(df) == 5 and set(df["typ_detail"]) == {"eigen", "retruth", "quote", "reply_thread"}
    tabelle = auswertung.posts_tabelle(df)
    text = auswertung.csv_export(tabelle).decode("utf-8-sig")
    # … aber weder in der Post-Tabelle noch im Export, und auch keine URLs oder Alt-Texte.
    for verboten in INHALT_VERBOTEN:
        assert verboten not in text, verboten
        assert verboten not in tabelle.to_csv(), verboten
    assert "example.com" in text  # die Link-Domain ist erlaubt
    assert "jemand" in text  # Handle des Quell-Kontos ist erlaubt


def test_zahlen_deutsch():
    assert auswertung.zahl(1234567.891, 2) == "1.234.567,89"
    assert auswertung.zahl(None) == "–"
    assert auswertung.prozent(0.1234) == "12,3 %"
    assert auswertung.prozent(None) == "–"
    assert auswertung.dauer_text(45) == "45 min"
    assert auswertung.dauer_text(200) == "3 h 20 min"
    assert auswertung.dauer_text(120) == "2 h"
    assert auswertung.dauer_text(3 * 24 * 60 + 300) == "3 Tage 5 h"
    assert auswertung.kennzahl_beschriftung("quotes_count") == "Quotes"
    assert auswertung.kennzahl_beschriftung("reactions_count") == "Reactions"


def test_im_zeitraum_maske():
    zeiten = pd.Series(pd.to_datetime(["2026-03-28T23:30:00Z", "2026-03-30T12:00:00Z", None], utc=True))
    maske = auswertung.im_zeitraum(zeiten, date(2026, 3, 29), date(2026, 3, 29), BERLIN)
    assert maske.tolist() == [True, False, False]
    assert auswertung.im_zeitraum(zeiten, None, None, BERLIN).tolist() == [True, True, True]


def test_utc_zeitpunkte_bleiben_beim_laden_utc(con, lauf):
    erstellt = datetime(2026, 3, 29, 1, 30, tzinfo=UTC)
    speichere(con, post(erstellt), lauf, 1)
    wert = auswertung.lade_daten(con).posts["created_at_utc"].iloc[0]
    assert wert.to_pydatetime() == erstellt
