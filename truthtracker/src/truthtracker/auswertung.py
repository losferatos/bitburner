"""Auswertungen für das Dashboard: reine pandas-Funktionen ohne Streamlit, einzeln getestet.

``lade_daten`` liest die (nur lesend geöffnete) Datenbank in DataFrames; alle anderen
Funktionen rechnen nur auf diesen Frames. Zeitpunkte sind pandas-Zeitstempel in UTC. Die
Anzeigezeitzone (New York oder Berlin, mit Sommerzeit über ``zoneinfo``) kommt entweder aus
der Spalte ``lokal``, die ``filtere`` anlegt, oder aus dem Parameter ``zeitzone``.

Festlegungen, die im Dashboard sichtbar sind:

* **Erfassung** = Zeit zwischen der Backfill-Grenze des ersten Laufs (``meta``
  ``backfill_grenze_utc``; ab dort ist die Timeline lückenlos geholt) und dem Ende des letzten
  Laufs. Ältere Posts (vor allem gepinnte, die der Crawler unabhängig vom Alter speichert, und
  der Rest der letzten Backfill-Seite) sind keine vollständige Stichprobe: Sie fehlen in allen
  Auswertungen (Spalte ``vor_erfassung``) und stehen nur in der Post-Tabelle.
* **Posts pro Tag** = Posts ÷ erfasste Tage. Randtage, die nur teilweise in der Erfassung
  liegen (Backfill-Grenze mitten am Tag, letzter Lauf mitten am Tag), zählen anteilig, Tage
  nach dem letzten Lauf gar nicht; Tage ohne Post in der Erfassung zählen voll.
* **Abstände** werden in echter vergangener Zeit (UTC-Differenz) gemessen, nicht als
  Differenz der Wanduhrzeiten; ein Sommerzeitwechsel verlängert oder verkürzt keine Pause.
  Ein Abstand gehört zum Post, mit dem er endet. Der Vorgänger kommt aus derselben Auswahl
  (Typ, Format, Gelöschte) ohne Zeitraum-Grenze, damit ein Tag dieselben Werte hat, egal wo
  der gewählte Zeitraum beginnt.
* **Serie** = mindestens zwei aufeinanderfolgende Posts, jeder weniger als X Minuten nach
  dem vorigen (strikt kleiner). Ein Abstand von genau X Minuten beendet die Serie. Eine Serie
  gehört zum Zeitraum, in dem sie beginnt, und zählt mit voller Länge.
* **Längste Pause eines Tages** = längster Abstand zwischen zwei aufeinanderfolgenden Posts,
  der an diesem Tag *endet* (der Post nach der Pause liegt an diesem Kalendertag der
  gewählten Zeitzone). Eine Pause über Mitternacht zählt damit in voller Länge zum Folgetag,
  typischerweise die Nachtpause vor dem ersten Post des Morgens. Tage ohne Post erscheinen
  nicht; die Pause über sie hinweg zählt zum nächsten Tag mit Post und ist länger als 24 h.
  Der erste Post der Erfassung hat keinen bekannten Vorgänger und damit keine Pause.
* **Engagement** nur für Posts mit einer Messung (Snapshot), deren Alter im gewählten Bereich
  liegt; je Post zählt die *späteste Messung im Bereich*, nicht der letzte Snapshot überhaupt.
  Bei mehreren Läufen am Tag hat ein Post mehrere Messungen unter 24 h, und „0–6 h“ vergleicht
  dann die frühe Messung. Backfill-Posts („Endstand nach X Tagen“) sind standardmäßig
  ausgeschlossen; werden sie einbezogen, gilt für sie ihr einziger Snapshot ohne Messalter-Filter
  (sie liegen nie im 24-h-Fenster). Die Zähler des Originals eines Retruths zählen nur, wenn auch
  das *Original* zum selben Messzeitpunkt ein Alter im gewählten Bereich hatte. Nach Format und
  Uhrzeit stehen Retruths nur in der Reihe „Original“: Die Zähler eines Retruths selbst sind fast
  immer 0 und würden den Median der eigenen Posts drücken. Posts ohne bekannten Zähler
  (API-Platzhalter ``-1`` oder Feld fehlt) fehlen im Vergleich und werden getrennt gezählt.
* **Wachstum** nur aus eigenen Posts mit mindestens zwei Messungen unter 24 h, jeder Post bezogen
  auf seine letzte Messung unter 24 h. Mit einem Lauf am Tag hat jeder Post nur eine Messung; ein
  Median über verschiedene Posts je Alter zeigte dann nur, zu welcher Tageszeit sie entstanden.
* **Medien-Metadaten** in der Tabelle: Abmessungen aller Medien und die Summe der Videodauern
  (nur, wenn jedes Video des Posts eine Dauer hat). Keine Medien-URLs.
* **Duplikat-Rate**: Nenner sind nur Posts, deren 14-Tage-Fenster vollständig in der
  Datenbank liegt (``dup_abdeckung_vollstaendig``); sonst wäre die Rate am Anfang der
  Aufzeichnung zu niedrig. Verteilungen nach Art und Abstand zählen dieselben Posts, damit
  sie sich zu „mit Duplikat“ summieren.
* **Zeit bis zur Löschung** ist ein Intervall: frühestens ``zuletzt gesehen − erstellt``,
  spätestens ``erstmals vermisst − erstellt``.
* **CSV**: IDs (18 Ziffern) stehen als Excel-Text ``="…"``, weil Excel Zahlen nur auf 15
  Stellen genau hält und die IDs sonst unumkehrbar verfälscht.

Die Datenbank enthält keine Inhalte; entsprechend gibt es hier keine Inhaltsanalyse.
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

import pandas as pd

from truthtracker import db, zeit
from truthtracker.modelle import (
    DUP_ARTEN,
    DUP_BESCHRIFTUNG,
    FORMAT_BESCHRIFTUNG,
    FORMATE,
    MEDIUM_VIDEO,
    REPLY_FREMD,
    REPLY_THREAD,
    ROLLE_QUOTE,
    ROLLE_REPLY,
    ROLLE_RETRUTH,
    TYP_DETAIL_BESCHRIFTUNG,
    TYP_RETRUTH,
    TYP_SELBST_RETRUTH,
)

TYP_DETAILS = tuple(TYP_DETAIL_BESCHRIFTUNG)
RETRUTH_TYPEN = (TYP_RETRUTH, TYP_SELBST_RETRUTH)
WOCHENTAGE = ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")
ZEITZONEN = ("America/New_York", "Europe/Berlin")
ZONE_KURZ = {"America/New_York": "New York", "Europe/Berlin": "Berlin"}
ROLLEN = (ROLLE_RETRUTH, ROLLE_QUOTE, ROLLE_REPLY)
QUELL_FELDER = ("konto_id", "handle", "anzeigename", "verifiziert", "follower", "ist_trump")

BASIS_KENNZAHLEN = ("likes", "retruths", "replies")
KENNZAHL_BESCHRIFTUNG = {
    "likes": "Likes",
    "retruths": "Retruths",
    "replies": "Replies",
    "upvotes_count": "Upvotes",
    "downvotes_count": "Downvotes",
    "quotes_count": "Quotes",
}
ZAEHLER_POST = "Post selbst"
ZAEHLER_EIGENE = "Eigene Posts"  # „Post selbst“ ohne Retruths (Engagement nach Format und Uhrzeit)
ZAEHLER_ORIGINAL = "Original (bei Retruths)"

FREQUENZEN = {"D": "Tag", "W": "Woche", "M": "Monat"}
REPLY_BESCHRIFTUNG = {REPLY_THREAD: "Thread", REPLY_FREMD: "an andere"}
EDIT_BESCHRIFTUNG = {
    "edited_at": "Zeitstempel edited_at geändert",
    "fingerabdruck": "Inhalts-Fingerabdruck geändert",
    "beides": "beides",
}
LAUF_STATUS_BESCHRIFTUNG = {
    "laeuft": "läuft",
    "ok": "ok",
    "abgebrochen": "abgebrochen",
    "fehler": "Fehler",
    "abgestuerzt": "abgestürzt",
}

# Klassen als (Untergrenze, Name); jede Klasse reicht bis zur nächsten Untergrenze (exklusiv).
ABSTAND_KLASSEN_MIN = (
    (0, "< 1 min"), (1, "1–5 min"), (5, "5–15 min"), (15, "15–30 min"), (30, "30–60 min"),
    (60, "1–2 h"), (120, "2–4 h"), (240, "4–8 h"), (480, "8–12 h"), (720, "12–24 h"), (1440, "≥ 24 h"),
)
LATENZ_KLASSEN_MIN = (
    (0, "< 5 min"), (5, "5–15 min"), (15, "15–60 min"), (60, "1–3 h"), (180, "3–6 h"),
    (360, "6–12 h"), (720, "12–24 h"), (1440, "1–3 Tage"), (4320, "3–7 Tage"), (10080, "≥ 7 Tage"),
)
DUP_ABSTAND_KLASSEN_H = (
    (0, "< 1 h"), (1, "1–6 h"), (6, "6–24 h"), (24, "1–3 Tage"), (72, "3–7 Tage"), (168, "7–14 Tage"),
)

_ZEIT_SPALTEN_ENDUNG = "_utc"
_POSTS_BOOL = ("backfill", "ist_quote", "ist_reply", "hat_karte", "medien_vollstaendig", "geloescht", "eingefroren")
_POSTS_BOOL_NULLBAR = ("gepinnt", "dup_abdeckung_vollstaendig")
_POSTS_INT = (
    "id_num", "erster_lauf_id", "letzter_lauf_id", "n_bilder", "n_videos", "n_gifs", "n_audio",
    "n_sonstige_medien", "zeichen", "zeichen_ohne_urls", "n_urls", "n_mentions", "n_hashtags", "edit_anzahl",
    "n_snapshots",
)
_ZAEHLER = ("replies", "retruths", "likes")

_POSTS_SQL = """
SELECT p.*,
       f.gemessen_utc AS gemessen_utc,
       f.alter_h AS messalter_h,
       f.replies, f.retruths, f.likes, f.weitere,
       f.orig_replies, f.orig_retruths, f.orig_likes, f.orig_weitere,
       (SELECT COUNT(*) FROM snapshots s WHERE s.post_id = p.id) AS n_snapshots
FROM posts p
LEFT JOIN post_final f ON f.post_id = p.id
ORDER BY p.created_at_utc, p.id_num
"""
_MEDIEN_SQL = "SELECT post_id, position, art, breite, hoehe, dauer_s FROM medien ORDER BY post_id, position"
_BENOETIGT = (
    "posts", "snapshots", "quellen", "duplikate", "edits", "laeufe", "konto_snapshots", "meta", "post_final", "medien",
)


# ---------------------------------------------------------------------------
# Laden


@dataclass
class Daten:
    """Alles, was das Dashboard braucht, als DataFrames (Zeiten tz-aware in UTC)."""

    posts: pd.DataFrame  # ein Post pro Zeile, mit finalem Snapshot, Quell-Konten und primärem Duplikat
    snapshots: pd.DataFrame
    konto: pd.DataFrame  # Konto-Snapshots von Trumps Account
    duplikate: pd.DataFrame
    edits: pd.DataFrame
    laeufe: pd.DataFrame
    quellen: pd.DataFrame
    weitere_kennzahlen: tuple[str, ...] = ()
    erfasst_ab: pd.Timestamp | None = None  # Backfill-Grenze; None in Datenbanken ohne diesen Eintrag
    erfasst_bis: pd.Timestamp | None = None  # Ende des letzten Laufs (oder letzter Post, falls später)

    @property
    def kennzahlen(self) -> tuple[str, ...]:
        """Engagement-Kennzahlen: Likes, Retruths, Replies und weitere Zähler, die die API lieferte."""
        return BASIS_KENNZAHLEN + self.weitere_kennzahlen


def lade_daten(con: sqlite3.Connection) -> Daten:
    """Liest die Datenbank. Eine Datei ohne Schema (leer, nie gecrawlt) ergibt leere Frames."""
    vorhanden = {z[0] for z in con.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")}
    if set(_BENOETIGT) <= vorhanden:
        return _lade(con)
    leer = sqlite3.connect(":memory:")
    try:
        leer.executescript(db.SCHEMA)
        return _lade(leer)
    finally:
        leer.close()


def _abfrage(con: sqlite3.Connection, sql: str, parameter: Sequence[object] = ()) -> pd.DataFrame:
    cur = con.execute(sql, parameter)
    spalten = [d[0] for d in cur.description]
    return pd.DataFrame([tuple(z) for z in cur.fetchall()], columns=spalten)


def _lade(con: sqlite3.Connection) -> Daten:
    posts = _abfrage(con, _POSTS_SQL)
    snapshots = _abfrage(con, "SELECT * FROM snapshots ORDER BY post_id, gemessen_utc, id")
    quellen = _abfrage(con, "SELECT * FROM quellen ORDER BY post_id, rolle")
    duplikate = _abfrage(
        con,
        "SELECT post_id, art, frueherer_post_id, abstand_s, primaer, details FROM duplikate ORDER BY post_id, art",
    )
    edits = _abfrage(con, "SELECT * FROM edits ORDER BY erkannt_utc, id")
    laeufe = _abfrage(con, "SELECT * FROM laeufe ORDER BY id")
    konto = _abfrage(con, "SELECT * FROM konto_snapshots ORDER BY gemessen_utc, id")
    zeile = con.execute("SELECT wert FROM meta WHERE schluessel = 'konto_id'").fetchone()
    if zeile is not None:
        konto = konto[konto["konto_id"] == zeile[0]].reset_index(drop=True)

    quellen = _zeiten(quellen)
    quellen["verifiziert"] = _als_boolean(quellen["verifiziert"])
    quellen["ist_trump"] = _als_boolean(quellen["ist_trump"])
    quellen["follower"] = _als_int(quellen["follower"])

    duplikate["abstand_s"] = _als_int(duplikate["abstand_s"])
    duplikate["primaer"] = duplikate["primaer"].astype(bool)

    posts = _zeiten(posts)
    posts = posts.join(_medien_je_post(_abfrage(con, _MEDIEN_SQL)), on="id")
    posts["abmessungen"] = posts["abmessungen"].fillna("").astype(object)
    posts["videodauer_s"] = posts["videodauer_s"].astype(float)
    for spalte in _POSTS_BOOL:
        posts[spalte] = posts[spalte].astype(bool)
    for spalte in _POSTS_BOOL_NULLBAR:
        posts[spalte] = _als_boolean(posts[spalte])
    for spalte in _POSTS_INT:
        posts[spalte] = posts[spalte].astype("int64")
    for spalte in ("retruth_latenz_s", *_ZAEHLER, *(f"orig_{z}" for z in _ZAEHLER)):
        posts[spalte] = _als_int(posts[spalte])
    posts["messalter_h"] = posts["messalter_h"].astype(float)
    posts["link_domains"] = posts["link_domains"].map(_domains_text)
    posts, eigene_weitere = _weitere_aufloesen(posts, "weitere", "")
    posts, orig_weitere = _weitere_aufloesen(posts, "orig_weitere", "orig_")
    weitere = tuple(sorted(set(eigene_weitere) | set(orig_weitere)))
    for kennzahl in weitere:
        for name in (kennzahl, f"orig_{kennzahl}"):
            if name not in posts.columns:
                posts[name] = pd.Series(pd.NA, index=posts.index, dtype="Int64")

    for rolle in ROLLEN:
        teil = quellen.loc[quellen["rolle"] == rolle].drop_duplicates("post_id").set_index("post_id")
        teil = teil[list(QUELL_FELDER)].add_prefix(f"{rolle}_quelle_")
        posts = posts.join(teil, on="id")
        posts[f"{rolle}_quelle_verifiziert"] = _als_boolean(posts[f"{rolle}_quelle_verifiziert"])
        posts[f"{rolle}_quelle_ist_trump"] = _als_boolean(posts[f"{rolle}_quelle_ist_trump"])
        posts[f"{rolle}_quelle_follower"] = _als_int(posts[f"{rolle}_quelle_follower"])

    primaer = duplikate.loc[duplikate["primaer"]].drop_duplicates("post_id").set_index("post_id")
    primaer = primaer[["art", "frueherer_post_id", "abstand_s"]]
    primaer.columns = ["dup_art", "dup_frueherer_post_id", "dup_abstand_s"]
    posts = posts.join(primaer, on="id")
    posts["dup_abstand_s"] = _als_int(posts["dup_abstand_s"])

    snapshots = _zeiten(snapshots)
    snapshots["alter_h"] = snapshots["alter_h"].astype(float)
    for spalte in (*_ZAEHLER, *(f"orig_{z}" for z in _ZAEHLER)):
        snapshots[spalte] = _als_int(snapshots[spalte])
    snapshots, _ = _weitere_aufloesen(snapshots, "weitere", "")
    snapshots, _ = _weitere_aufloesen(snapshots, "orig_weitere", "orig_")
    for kennzahl in weitere:
        if kennzahl not in snapshots.columns:
            snapshots[kennzahl] = pd.Series(pd.NA, index=snapshots.index, dtype="Int64")

    edits = _zeiten(edits)
    laeufe = _zeiten(laeufe)
    laeufe["meldungen"] = laeufe["meldungen"].map(_meldungen_text)
    laeufe["backfill"] = laeufe["backfill"].astype(bool)
    konto = _zeiten(konto)
    for spalte in ("follower", "folgt", "posts_gesamt"):
        konto[spalte] = _als_int(konto[spalte])

    erfasst_ab = _meta_zeit(con, "backfill_grenze_utc")
    posts["vor_erfassung"] = (
        (posts["created_at_utc"] < erfasst_ab).astype(bool) if erfasst_ab is not None
        else pd.Series(False, index=posts.index, dtype=bool)
    )
    enden = [
        laeufe["ende_utc"].fillna(laeufe["start_utc"]).max(),
        posts.loc[~posts["vor_erfassung"], "created_at_utc"].max(),
    ]
    enden = [t for t in enden if not pd.isna(t)]

    return Daten(
        posts=posts.reset_index(drop=True),
        snapshots=snapshots,
        konto=konto,
        duplikate=duplikate,
        edits=edits,
        laeufe=laeufe,
        quellen=quellen,
        weitere_kennzahlen=weitere,
        erfasst_ab=erfasst_ab,
        erfasst_bis=max(enden) if enden else None,
    )


def _medien_je_post(medien: pd.DataFrame) -> pd.DataFrame:
    """Abmessungen und Videodauer je Post aus der Tabelle ``medien`` (nur Metadaten, Index = Post-ID).

    ``abmessungen``: „Breite×Höhe“ aller Medien mit bekannten Abmessungen in der Reihenfolge des Posts,
    getrennt durch „, “ (wie die Link-Domains; ein „;“ müsste im CSV maskiert werden). ``videodauer_s``:
    Summe der Dauern aller Videos; unbekannt, wenn der Post kein Video hat oder einem Video die Dauer
    fehlt (eine Teilsumme sähe aus wie die ganze Länge).
    """
    zeilen = []
    for post_id, teil in medien.groupby("post_id", sort=False):
        masse = [
            f"{int(b)}×{int(h)}" for b, h in zip(teil["breite"], teil["hoehe"], strict=True)
            if not pd.isna(b) and not pd.isna(h)
        ]
        dauern = pd.to_numeric(teil.loc[teil["art"] == MEDIUM_VIDEO, "dauer_s"], errors="coerce").astype(float)
        dauer = float(dauern.sum()) if len(dauern) and dauern.notna().all() else float("nan")
        zeilen.append((post_id, ", ".join(masse), dauer))
    return pd.DataFrame(zeilen, columns=["post_id", "abmessungen", "videodauer_s"]).set_index("post_id")


def _meta_zeit(con: sqlite3.Connection, schluessel: str) -> pd.Timestamp | None:
    zeile = con.execute("SELECT wert FROM meta WHERE schluessel = ?", (schluessel,)).fetchone()
    wert = zeit.parse_utc(zeile[0]) if zeile is not None else None
    return pd.Timestamp(wert) if wert is not None else None


def _zeiten(df: pd.DataFrame) -> pd.DataFrame:
    for spalte in df.columns:
        if spalte.endswith(_ZEIT_SPALTEN_ENDUNG):
            df[spalte] = pd.to_datetime(df[spalte], utc=True, format="ISO8601")
    return df


def _als_boolean(werte: pd.Series) -> pd.Series:
    return pd.Series([None if pd.isna(w) else bool(w) for w in werte], index=werte.index, dtype="boolean")


def _als_int(werte: pd.Series) -> pd.Series:
    return pd.Series([None if pd.isna(w) else int(w) for w in werte], index=werte.index, dtype="Int64")


def _json_dict(text: object) -> dict[str, int]:
    if not isinstance(text, str) or not text:
        return {}
    try:
        roh = json.loads(text)
    except ValueError:
        return {}
    if not isinstance(roh, dict):
        return {}
    return {str(k): v for k, v in roh.items() if isinstance(v, int) and not isinstance(v, bool)}


def _weitere_aufloesen(df: pd.DataFrame, spalte: str, praefix: str) -> tuple[pd.DataFrame, list[str]]:
    """JSON-Spalte mit weiteren Zählern (z. B. ``upvotes_count``) in einzelne Int-Spalten aufteilen.

    Nur Schlüssel auf ``_count`` (so legt die Klassifikation sie an); andere Namen könnten mit
    Spalten wie ``lokal`` oder ``datum`` zusammenstoßen, die ``filtere`` später anlegt.
    """
    werte = [_json_dict(t) for t in df[spalte]]
    schluessel = sorted({
        k for d in werte for k in d if k.endswith("_count") and f"{praefix}{k}" not in df.columns
    })
    for k in schluessel:
        df[f"{praefix}{k}"] = pd.array([d.get(k) for d in werte], dtype="Int64")
    return df.drop(columns=[spalte]), schluessel


def _domains_text(text: object) -> str:
    if not isinstance(text, str) or not text:
        return ""
    try:
        liste = json.loads(text)
    except ValueError:
        return ""
    return ", ".join(str(d) for d in liste) if isinstance(liste, list) else ""


def _meldungen_text(text: object) -> str:
    if not isinstance(text, str) or not text:
        return ""
    try:
        liste = json.loads(text)
    except ValueError:
        return text
    return " | ".join(str(m) for m in liste) if isinstance(liste, list) else str(liste)


# ---------------------------------------------------------------------------
# Zeit, Zahlen, Beschriftungen


def zone(zeitzone: str) -> str:
    """IANA-Name der Anzeigezeitzone; akzeptiert auch ``ET`` und ``Berlin``."""
    name = zeit.ZEITZONEN.get(zeitzone, zeitzone)
    ZoneInfo(name)
    return name


def _lokal(df: pd.DataFrame, zeitzone: str | None = None) -> pd.Series:
    if zeitzone is not None:
        return df["created_at_utc"].dt.tz_convert(zone(zeitzone))
    if "lokal" in df.columns:
        return df["lokal"]
    raise ValueError("Zeitzone fehlt: erst filtere() aufrufen oder zeitzone angeben")


def _zone_von(df: pd.DataFrame, zeitzone: str | None) -> str:
    if zeitzone is not None:
        return zone(zeitzone)
    if "lokal" in df.columns:
        return str(df["lokal"].dt.tz)
    raise ValueError("Zeitzone fehlt: erst filtere() aufrufen oder zeitzone angeben")


def _sortiert(df: pd.DataFrame) -> pd.DataFrame:
    return df.sort_values(["created_at_utc", "id_num"], kind="stable")


def zahl(wert: float | int | None, stellen: int = 0) -> str:
    """Zahl in deutscher Schreibweise (Tausenderpunkt, Dezimalkomma, kaufmännisch gerundet).

    Fehlender Wert → Gedankenstrich.
    """
    if wert is None or pd.isna(wert):
        return "–"
    gerundet = Decimal(repr(float(wert))).quantize(Decimal(1).scaleb(-stellen), rounding=ROUND_HALF_UP)
    text = f"{gerundet:,.{stellen}f}"
    return text.translate(str.maketrans(",.", ".,"))


def prozent(anteil: float | None, stellen: int = 1) -> str:
    if anteil is None or pd.isna(anteil):
        return "–"
    return f"{zahl(anteil * 100, stellen)} %"


def dauer_text(minuten: float | None) -> str:
    """Dauer kurz und lesbar: ``45 min``, ``3 h 20 min``, ``2 Tage 5 h``."""
    if minuten is None or pd.isna(minuten):
        return "–"
    gesamt = int(round(float(minuten)))
    if gesamt < 60:
        return f"{gesamt} min"
    stunden, rest = divmod(gesamt, 60)
    if stunden < 48:
        return f"{stunden} h {rest} min" if rest else f"{stunden} h"
    tage, stunden = divmod(stunden, 24)
    return f"{tage} Tage {stunden} h" if stunden else f"{tage} Tage"


def messalter_text(alter_h: float | None, backfill: bool) -> str:
    """Beschriftung des finalen Messwerts: „gemessen nach 17,3 h“ bzw. „Endstand nach 12 Tagen“."""
    if alter_h is None or pd.isna(alter_h):
        return "keine Messung"
    if backfill:
        tage = max(1, math.floor(float(alter_h) / 24 + 0.5))
        return f"Endstand nach {tage} Tag" if tage == 1 else f"Endstand nach {tage} Tagen"
    return f"gemessen nach {zahl(alter_h, 1)} h"


def kennzahl_beschriftung(kennzahl: str) -> str:
    if kennzahl in KENNZAHL_BESCHRIFTUNG:
        return KENNZAHL_BESCHRIFTUNG[kennzahl]
    name = kennzahl.removesuffix("_count").replace("_", " ").capitalize()
    # Ein unbekanntes API-Feld wie likes_count darf nicht so heißen wie ein bekannter Zähler.
    if name in KENNZAHL_BESCHRIFTUNG.values():
        return f"{name} (API-Feld {kennzahl})"
    return name


def _reihenfolge(werte: Iterable[object], ordnung: Sequence[str]) -> list[str]:
    vorhanden = {str(w) for w in werte if not pd.isna(w)}
    return [w for w in ordnung if w in vorhanden] + sorted(vorhanden - set(ordnung))


def _klassiere(werte: pd.Series, klassen: Sequence[tuple[float, str]]) -> pd.DataFrame:
    """Häufigkeiten je Klasse, alle Klassen in fester Reihenfolge (auch leere)."""
    namen = [name for _, name in klassen]
    grenzen = [float(g) for g, _ in klassen] + [math.inf]
    zahlen = pd.to_numeric(werte, errors="coerce").dropna().astype(float)
    kategorien = pd.cut(zahlen, bins=grenzen, labels=namen, right=False)
    anzahl = kategorien.value_counts().reindex(namen, fill_value=0)
    return pd.DataFrame({"klasse": namen, "anzahl": anzahl.to_numpy(dtype="int64")})


def _tagesbereich(tage: pd.Series, von: date | None, bis: date | None) -> list[date]:
    start = von if von is not None else (min(tage) if len(tage) else None)
    ende = bis if bis is not None else (max(tage) if len(tage) else None)
    if start is None or ende is None or ende < start:
        return []
    return [start + timedelta(days=i) for i in range((ende - start).days + 1)]


def _periode(tag: date, frequenz: str) -> date:
    if frequenz == "D":
        return tag
    if frequenz == "W":
        return tag - timedelta(days=tag.weekday())
    if frequenz == "M":
        return tag.replace(day=1)
    raise ValueError(f"Unbekannte Frequenz {frequenz!r} (erlaubt: D, W, M)")


def _periodenbereich(start: date, ende: date, frequenz: str) -> list[date]:
    perioden = []
    aktuell = _periode(start, frequenz)
    while aktuell <= ende:
        perioden.append(aktuell)
        if frequenz == "D":
            aktuell += timedelta(days=1)
        elif frequenz == "W":
            aktuell += timedelta(days=7)
        else:
            aktuell = (aktuell.replace(day=28) + timedelta(days=4)).replace(day=1)
    return perioden


# ---------------------------------------------------------------------------
# Filter und Überblick


def datenbereich(daten: Daten, zeitzone: str, *, mit_vor_erfassung: bool = False) -> tuple[date, date] | None:
    """Erster und letzter Kalendertag der Erfassung in der Zeitzone.

    Beginn ist die Backfill-Grenze (ohne sie der erste Post), Ende der letzte Lauf bzw. Post.
    Posts vor der Erfassung (z. B. ein vor Jahren gepinnter Post) verschieben den Bereich nur mit
    ``mit_vor_erfassung``; das braucht das Dashboard für die Grenzen der Datumsauswahl.
    """
    name = zone(zeitzone)
    posts = daten.posts["created_at_utc"]
    if not mit_vor_erfassung and "vor_erfassung" in daten.posts.columns:
        posts = posts.loc[~daten.posts["vor_erfassung"].astype(bool)]
    teile = (posts, daten.laeufe["start_utc"], daten.konto["gemessen_utc"])
    kandidaten = [s.min() for s in teile] + [s.max() for s in teile] + [daten.erfasst_ab, daten.erfasst_bis]
    lokal = [pd.Timestamp(t).tz_convert(name) for t in kandidaten if t is not None and not pd.isna(t)]
    if not lokal:
        return None
    return min(lokal).date(), max(lokal).date()


def tagesabdeckung(
    tage: Iterable[date], zeitzone: str, erfasst_ab: pd.Timestamp | None, erfasst_bis: pd.Timestamp | None
) -> pd.Series:
    """Anteil jedes Kalendertags (0 bis 1), der in der Erfassung liegt.

    Ein Tag läuft von Mitternacht bis Mitternacht in der Zeitzone (23 oder 25 h an Tagen mit
    Zeitumstellung). Ohne bekannte Grenze gilt der Tag auf dieser Seite als ganz erfasst.
    """
    name = zone(zeitzone)
    liste = list(tage)
    anteile = []
    for tag in liste:
        beginn = pd.Timestamp(tag).tz_localize(name)
        ende = pd.Timestamp(tag + timedelta(days=1)).tz_localize(name)
        unten = beginn if erfasst_ab is None else max(beginn, erfasst_ab)
        oben = ende if erfasst_bis is None else min(ende, erfasst_bis)
        anteile.append(max(0.0, (oben - unten) / (ende - beginn)))
    return pd.Series(anteile, index=pd.Index(liste, name="datum", dtype=object), dtype=float)


def filtere(
    posts: pd.DataFrame,
    von: date | None,
    bis: date | None,
    zeitzone: str,
    typen: Iterable[str] | None = None,
    formate: Iterable[str] | None = None,
    *,
    geloeschte: bool = True,
    vor_erfassung: bool = False,
) -> pd.DataFrame:
    """Posts im Zeitraum [von, bis] (Kalendertage in der Zeitzone, beide inklusive).

    ``typen`` und ``formate`` sind Listen von ``typ_detail``- bzw. Format-Schlüsseln; ``None``
    heißt „alle“, eine leere Liste „keine“. Posts vor der Erfassung bleiben draußen, außer mit
    ``vor_erfassung=True`` (für die Post-Tabelle).

    Neue Spalten: ``lokal`` (Erstellzeit in der Zeitzone), ``datum``, ``stunde``, ``wochentag``
    (0 = Montag), ``vorher_utc`` und ``abstand_vorher_min``: Zeitpunkt des vorigen Posts derselben
    Auswahl und Abstand dazu, ermittelt *vor* dem Beschneiden auf den Zeitraum. So hat auch der
    erste Post im Zeitraum seinen echten Vorgänger.
    """
    df = posts.copy()
    df["lokal"] = df["created_at_utc"].dt.tz_convert(zone(zeitzone))
    df["datum"] = df["lokal"].dt.date
    df["stunde"] = df["lokal"].dt.hour.astype("int64")
    df["wochentag"] = df["lokal"].dt.dayofweek.astype("int64")
    maske = pd.Series(True, index=df.index)
    if typen is not None:
        maske &= df["typ_detail"].isin(list(typen))
    if formate is not None:
        maske &= df["format"].isin(list(formate))
    if not geloeschte:
        maske &= ~df["geloescht"]
    if not vor_erfassung and "vor_erfassung" in df.columns:
        maske &= ~df["vor_erfassung"].astype(bool)
    auswahl = _sortiert(df.loc[maske])
    auswahl["vorher_utc"] = auswahl["created_at_utc"].shift(1)
    auswahl["abstand_vorher_min"] = (
        (auswahl["created_at_utc"] - auswahl["vorher_utc"]).dt.total_seconds() / 60
    ).astype(float)
    zeitraum = pd.Series(True, index=auswahl.index)
    if von is not None:
        zeitraum &= auswahl["datum"].map(lambda d: d >= von).astype(bool)
    if bis is not None:
        zeitraum &= auswahl["datum"].map(lambda d: d <= bis).astype(bool)
    return auswahl.loc[zeitraum].reset_index(drop=True)


def im_zeitraum(zeitpunkte: pd.Series, von: date | None, bis: date | None, zeitzone: str) -> pd.Series:
    """Maske: liegt der UTC-Zeitpunkt an einem Kalendertag [von, bis] der Zeitzone?"""
    tage = zeitpunkte.dt.tz_convert(zone(zeitzone)).dt.date
    maske = pd.Series(True, index=zeitpunkte.index)
    if von is not None:
        maske &= tage.map(lambda d: not pd.isna(d) and d >= von).astype(bool)
    if bis is not None:
        maske &= tage.map(lambda d: not pd.isna(d) and d <= bis).astype(bool)
    return maske


@dataclass
class Ueberblick:
    posts: int
    tage: float  # erfasste Tage im Zeitraum (Randtage anteilig), Nenner von pro_tag
    kalendertage: int
    pro_tag: float | None
    eigene: int
    retruths: int
    selbst_retruths: int
    anteil_retruths: float | None
    geloescht: int
    mit_medien: int


def ueberblick(
    df: pd.DataFrame,
    von: date | None = None,
    bis: date | None = None,
    *,
    zeitzone: str | None = None,
    erfasst_ab: pd.Timestamp | None = None,
    erfasst_bis: pd.Timestamp | None = None,
) -> Ueberblick:
    """Kennzahlen der Auswahl. Posts pro Tag = Posts ÷ erfasste Tage im Zeitraum.

    Ohne Erfassungsgrenzen zählt jeder Kalendertag des Zeitraums voll (auch Tage ohne Post);
    mit ihnen nur der Teil des Tages zwischen ``erfasst_ab`` und ``erfasst_bis``.
    """
    tage_liste = _tagesbereich(df["datum"] if "datum" in df.columns else pd.Series(dtype=object), von, bis)
    if tage_liste and (erfasst_ab is not None or erfasst_bis is not None):
        tage = float(tagesabdeckung(tage_liste, _zone_von(df, zeitzone), erfasst_ab, erfasst_bis).sum())
    else:
        tage = float(len(tage_liste))
    n = len(df)
    retruths = int(df["typ"].isin(RETRUTH_TYPEN).sum())
    medien = df[["n_bilder", "n_videos", "n_gifs", "n_audio", "n_sonstige_medien"]].sum(axis=1)
    return Ueberblick(
        posts=n,
        tage=tage,
        kalendertage=len(tage_liste),
        pro_tag=n / tage if tage > 0 else None,
        eigene=n - retruths,
        retruths=retruths,
        selbst_retruths=int((df["typ"] == TYP_SELBST_RETRUTH).sum()),
        anteil_retruths=retruths / n if n else None,
        geloescht=int(df["geloescht"].sum()),
        mit_medien=int((medien > 0).sum()),
    )


# ---------------------------------------------------------------------------
# Zeitverlauf und Tageszeiten


def posts_pro_tag(
    df: pd.DataFrame, zeitzone: str | None = None, *, von: date | None = None, bis: date | None = None
) -> pd.DataFrame:
    """Posts je Kalendertag (Zeilen, lückenlos) und ``typ_detail`` (Spalten, feste Reihenfolge)."""
    tage = _lokal(df, zeitzone).dt.date
    spalten = _reihenfolge(df["typ_detail"], TYP_DETAILS)
    index = pd.Index(_tagesbereich(tage, von, bis), name="datum", dtype=object)
    if df.empty:
        return pd.DataFrame(0, index=index, columns=spalten, dtype="int64")
    tabelle = pd.crosstab(tage.to_numpy(), df["typ_detail"].to_numpy())
    tabelle = tabelle.reindex(index=index, columns=spalten, fill_value=0).astype("int64")
    tabelle.columns.name = None
    return tabelle


def anteil_retruths(df: pd.DataFrame, zeitzone: str | None = None, frequenz: str = "W") -> pd.DataFrame:
    """Retruths vs. eigene Posts (inkl. Quotes und Replies) je Tag, Woche (ab Montag) oder Monat."""
    tage = _lokal(df, zeitzone).dt.date
    spalten = ["posts", "retruths", "eigene", "anteil_retruths"]
    if df.empty:
        return pd.DataFrame(columns=spalten, index=pd.Index([], name="periode", dtype=object))
    perioden = tage.map(lambda t: _periode(t, frequenz))
    ist_retruth = df["typ"].isin(RETRUTH_TYPEN).to_numpy()
    gruppen = pd.DataFrame({"periode": perioden.to_numpy(), "rt": ist_retruth}).groupby("periode")["rt"]
    index = pd.Index(_periodenbereich(min(tage), max(tage), frequenz), name="periode", dtype=object)
    posts = gruppen.size().reindex(index, fill_value=0).astype("int64")
    retruths = gruppen.sum().reindex(index, fill_value=0).astype("int64")
    anteil = (retruths / posts.where(posts > 0)).astype(float)
    return pd.DataFrame({"posts": posts, "retruths": retruths, "eigene": posts - retruths, "anteil_retruths": anteil})


def heatmap_wochentag_stunde(df: pd.DataFrame, zeitzone: str | None = None) -> pd.DataFrame:
    """Posts je Wochentag (Zeilen Mo–So) und Stunde (Spalten 0–23) in der Zeitzone."""
    lokal = _lokal(df, zeitzone)
    tabelle = pd.DataFrame(0, index=range(7), columns=range(24), dtype="int64")
    if not df.empty:
        zaehlung = pd.crosstab(lokal.dt.dayofweek.to_numpy(), lokal.dt.hour.to_numpy())
        tabelle = zaehlung.reindex(index=range(7), columns=range(24), fill_value=0).astype("int64")
    tabelle.index = pd.Index(WOCHENTAGE, name="wochentag")
    tabelle.columns = pd.Index(range(24), name="stunde")
    return tabelle


def formatmix_zeitverlauf(
    df: pd.DataFrame, zeitzone: str | None = None, frequenz: str = "W", *, anteil: bool = True
) -> pd.DataFrame:
    """Formate je Periode (Zeilen) und Format (Spalten); ``anteil`` = Zeilenanteile statt Anzahlen."""
    tage = _lokal(df, zeitzone).dt.date
    spalten = _reihenfolge(df["format"], FORMATE)
    if df.empty:
        return pd.DataFrame(columns=spalten, index=pd.Index([], name="periode", dtype=object))
    perioden = tage.map(lambda t: _periode(t, frequenz))
    index = pd.Index(_periodenbereich(min(tage), max(tage), frequenz), name="periode", dtype=object)
    tabelle = pd.crosstab(perioden.to_numpy(), df["format"].to_numpy())
    tabelle = tabelle.reindex(index=index, columns=spalten, fill_value=0).astype("int64")
    tabelle.columns.name = None
    if anteil:
        summen = tabelle.sum(axis=1)
        return tabelle.div(summen.where(summen > 0), axis=0).astype(float)
    return tabelle


def zeichen_verteilung(df: pd.DataFrame, spalte: str = "zeichen", breite: int = 50) -> pd.DataFrame:
    """Häufigkeit der Zeichenzahl in Klassen: „0“ (kein Text), dann 1–50, 51–100, …"""
    if breite < 1:
        raise ValueError("breite muss mindestens 1 sein")
    werte = df[spalte].astype("int64")
    spalten = ["klasse", "von", "bis", "anzahl"]
    if werte.empty:
        return pd.DataFrame(columns=spalten)
    zeilen = [{"klasse": "0", "von": 0, "bis": 0, "anzahl": int((werte == 0).sum())}]
    oben = max(int(werte.max()), 1)
    for unten in range(1, oben + 1, breite):
        bis = unten + breite - 1
        zeilen.append({
            "klasse": f"{unten}–{bis}", "von": unten, "bis": bis,
            "anzahl": int(((werte >= unten) & (werte <= bis)).sum()),
        })
    return pd.DataFrame(zeilen, columns=spalten)


def medien_uebersicht(df: pd.DataFrame) -> pd.DataFrame:
    """Anzahl Medien je Art und Zahl der Posts, die solche Medien enthalten."""
    arten = (
        ("Bilder", "n_bilder"), ("Videos", "n_videos"), ("GIFs", "n_gifs"),
        ("Audio", "n_audio"), ("sonstige", "n_sonstige_medien"),
    )
    return pd.DataFrame(
        [{"art": name, "medien": int(df[s].sum()), "posts": int((df[s] > 0).sum())} for name, s in arten],
        columns=["art", "medien", "posts"],
    )


# ---------------------------------------------------------------------------
# Abstände, Serien, Pausen


def _vorgaenger(d: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Zeitpunkt des vorigen Posts (UTC) und Abstand in Minuten, für nach Zeit sortierte Posts.

    Aus ``filtere`` kommt der Vorgänger auch dann, wenn er vor dem Zeitraum liegt; sonst ist es
    der vorige Post im Frame.
    """
    if "vorher_utc" in d.columns:
        vorher = d["vorher_utc"]
    else:
        vorher = d["created_at_utc"].shift(1)
    return vorher, ((d["created_at_utc"] - vorher).dt.total_seconds() / 60).astype(float)


def _luecken(df: pd.DataFrame, zeitzone: str | None = None) -> pd.DataFrame:
    d = _sortiert(df)
    lokal = _lokal(d, zeitzone)
    vorher, abstand = _vorgaenger(d)
    return pd.DataFrame({
        "id": d["id"].to_numpy(),
        "von": pd.to_datetime(vorher, utc=True).dt.tz_convert(_zone_von(d, zeitzone)).to_numpy(),
        "bis": lokal.to_numpy(),
        "abstand_min": abstand.to_numpy(dtype=float),
    })


def abstaende_minuten(df: pd.DataFrame) -> pd.Series:
    """Abstände zu den jeweils vorigen Posts der Auswahl, in Minuten (je Post einer, außer ohne Vorgänger)."""
    if df.empty:
        return pd.Series(dtype=float, name="abstand_min")
    _, abstand = _vorgaenger(_sortiert(df))
    return abstand.dropna().reset_index(drop=True).rename("abstand_min")


def abstaende_verteilung(abstaende: pd.Series) -> pd.DataFrame:
    return _klassiere(abstaende, ABSTAND_KLASSEN_MIN)


_SERIEN_SPALTEN = [
    "nr", "start", "ende", "datum", "stunde", "anzahl", "dauer_min", "erster_post", "posts_im_zeitraum",
    "beginn_im_zeitraum",
]


def serien(
    df: pd.DataFrame, schwelle_min: float, zeitzone: str | None = None, *, umfeld: pd.DataFrame | None = None
) -> pd.DataFrame:
    """Posting-Serien: mindestens zwei Posts, jeder weniger als ``schwelle_min`` nach dem vorigen.

    ``umfeld`` ist dieselbe Auswahl ohne Zeitraum-Grenzen (``filtere(posts, None, None, …)``).
    Damit zählen Serien, die über den Rand des Zeitraums reichen, mit voller Länge. Geliefert
    werden alle Serien mit mindestens einem Post in ``df``; zum Zeitraum gehört eine Serie, wenn
    sie darin beginnt (``beginn_im_zeitraum``). Serien, die vorher beginnen, stehen nur dabei,
    damit ``posts_im_zeitraum`` den Anteil der Posts in Serien vollständig erfasst.

    Spalten: ``start``/``ende`` (lokal), ``datum`` und ``stunde`` des Starts, ``anzahl`` (Länge in
    Posts), ``dauer_min`` (erster bis letzter Post), ``erster_post`` (ID), ``posts_im_zeitraum``,
    ``beginn_im_zeitraum``.
    """
    if schwelle_min <= 0:
        raise ValueError("Die Serien-Schwelle muss größer als 0 Minuten sein")
    basis = df if umfeld is None else umfeld
    if len(basis) < 2 or df.empty:
        return pd.DataFrame(columns=_SERIEN_SPALTEN)
    d = _sortiert(basis)
    lokal = d["created_at_utc"].dt.tz_convert(_zone_von(df, zeitzone))
    abstand = (d["created_at_utc"] - d["created_at_utc"].shift(1)).dt.total_seconds() / 60
    gruppe = (~(abstand < schwelle_min)).cumsum()
    teile = pd.DataFrame({
        "gruppe": gruppe.to_numpy(), "lokal": lokal.to_numpy(), "id": d["id"].to_numpy(),
        "im": d["id"].isin(set(df["id"])).to_numpy(),
    })
    agg = teile.groupby("gruppe").agg(
        start=("lokal", "min"), ende=("lokal", "max"), anzahl=("id", "size"), erster_post=("id", "first"),
        posts_im_zeitraum=("im", "sum"), beginn_im_zeitraum=("im", "first"),
    )
    agg = agg.loc[(agg["anzahl"] >= 2) & (agg["posts_im_zeitraum"] > 0)].reset_index(drop=True)
    if agg.empty:
        return pd.DataFrame(columns=_SERIEN_SPALTEN)
    agg["dauer_min"] = (agg["ende"] - agg["start"]).dt.total_seconds() / 60
    agg["datum"] = agg["start"].dt.date
    agg["stunde"] = agg["start"].dt.hour.astype("int64")
    agg["anzahl"] = agg["anzahl"].astype("int64")
    agg["posts_im_zeitraum"] = agg["posts_im_zeitraum"].astype("int64")
    agg["beginn_im_zeitraum"] = agg["beginn_im_zeitraum"].astype(bool)
    agg["nr"] = range(1, len(agg) + 1)
    return agg[_SERIEN_SPALTEN]


def serien_im_zeitraum(serien_df: pd.DataFrame) -> pd.DataFrame:
    """Nur die Serien, die im Zeitraum beginnen."""
    if serien_df.empty or "beginn_im_zeitraum" not in serien_df.columns:
        return serien_df
    return serien_df.loc[serien_df["beginn_im_zeitraum"].astype(bool)].reset_index(drop=True)


@dataclass
class SerienKennzahlen:
    anzahl: int
    posts_in_serien: int
    anteil_posts: float | None
    mittlere_laenge: float | None
    laengste: int
    median_dauer_min: float | None


def serien_kennzahlen(serien_df: pd.DataFrame, anzahl_posts: int) -> SerienKennzahlen:
    """Anzahl, Länge und Dauer der im Zeitraum beginnenden Serien; Anteil der Posts im Zeitraum,
    die zu irgendeiner Serie gehören (auch zu einer, die vorher begann)."""
    if "posts_im_zeitraum" in serien_df.columns:
        in_serien = int(serien_df["posts_im_zeitraum"].sum())
    else:
        in_serien = int(serien_df["anzahl"].sum()) if not serien_df.empty else 0
    anteil = in_serien / anzahl_posts if anzahl_posts else None
    eigene = serien_im_zeitraum(serien_df)
    if eigene.empty:
        return SerienKennzahlen(0, in_serien, anteil, None, 0, None)
    return SerienKennzahlen(
        anzahl=len(eigene),
        posts_in_serien=in_serien,
        anteil_posts=anteil,
        mittlere_laenge=float(eigene["anzahl"].mean()),
        laengste=int(eigene["anzahl"].max()),
        median_dauer_min=float(eigene["dauer_min"].median()),
    )


def serien_nach_laenge(serien_df: pd.DataFrame) -> pd.DataFrame:
    """Anzahl der im Zeitraum beginnenden Serien je Länge (2 bis längste Serie, lückenlos)."""
    eigene = serien_im_zeitraum(serien_df)
    if eigene.empty:
        return pd.DataFrame(columns=["laenge", "anzahl"])
    zaehlung = eigene["anzahl"].value_counts()
    laengen = range(2, int(eigene["anzahl"].max()) + 1)
    return pd.DataFrame({"laenge": list(laengen), "anzahl": [int(zaehlung.get(n, 0)) for n in laengen]})


def serien_nach_stunde(serien_df: pd.DataFrame) -> pd.DataFrame:
    """Anzahl der im Zeitraum beginnenden Serien je Startstunde 0–23 (Ortszeit der Zeitzone)."""
    eigene = serien_im_zeitraum(serien_df)
    zaehlung = eigene["stunde"].value_counts() if not eigene.empty else pd.Series(dtype="int64")
    return pd.DataFrame({"stunde": list(range(24)), "anzahl": [int(zaehlung.get(h, 0)) for h in range(24)]})


def laengste_pause_pro_tag(df: pd.DataFrame, zeitzone: str | None = None) -> pd.DataFrame:
    """Längste Pause je Kalendertag; eine Pause zählt zu dem Tag, an dem sie endet.

    Spalten: ``datum``, ``posts`` (an diesem Tag), ``pause_h``, ``von`` und ``bis`` (lokal; ``von``
    kann am Vortag und, bei Frames aus ``filtere``, auch vor dem gewählten Zeitraum liegen). Ohne
    bekannten Vorgänger (erster Post der Erfassung) ist ``pause_h`` leer.
    """
    spalten = ["datum", "posts", "pause_h", "von", "bis"]
    if df.empty:
        return pd.DataFrame(columns=spalten)
    luecken = _luecken(df, zeitzone)
    luecken["datum"] = pd.to_datetime(luecken["bis"]).map(lambda t: t.date())
    luecken["pause_h"] = luecken["abstand_min"] / 60
    posts = luecken.groupby("datum").size().rename("posts")
    bekannt = luecken.dropna(subset=["pause_h"])
    groesste = bekannt.loc[bekannt.groupby("datum")["pause_h"].idxmax()].set_index("datum")[["pause_h", "von", "bis"]]
    ergebnis = posts.to_frame().join(groesste).reset_index()
    ergebnis["posts"] = ergebnis["posts"].astype("int64")
    return ergebnis[spalten]


# ---------------------------------------------------------------------------
# Engagement


@dataclass
class Engagement:
    """Engagement-Vergleich mit Messalter-Filter. Gruppen im Langformat (Spalten siehe ``_gruppiere``)."""

    kennzahl: str
    pro_stunde: bool
    basis: pd.DataFrame  # je verglichenem Post eine Zeile (nur Posts mit bekanntem Zähler)
    nach_typ: pd.DataFrame
    nach_format: pd.DataFrame
    nach_stunde: pd.DataFrame
    ohne_messung: int
    ausserhalb_alter: int  # gemessen, aber keine Messung im Bereich (ohne Backfill-Posts)
    backfill_ausgeschlossen: int
    backfill_einbezogen: int
    original_ausserhalb_alter: int = 0  # Retruths im Vergleich, deren Original beim Messen anders alt war
    zaehler_unbekannt: int = 0  # Messung passt, aber weder eigener noch Original-Zähler ist bekannt

    @property
    def wert_beschriftung(self) -> str:
        name = kennzahl_beschriftung(self.kennzahl)
        return f"{name} pro Stunde seit Post" if self.pro_stunde else name

    @property
    def im_messalter(self) -> int:
        """Posts im Vergleich (mit bekanntem Zähler), deren Messung im gewählten Bereich liegt, ohne Backfill-Posts."""
        return len(self.basis) - self.backfill_einbezogen


def _als_float(df: pd.DataFrame, spalte: str) -> pd.Series:
    if spalte not in df.columns:
        return pd.Series(float("nan"), index=df.index)
    return pd.to_numeric(df[spalte], errors="coerce").astype(float)


def _spaeteste_messung(snapshots: pd.DataFrame, alter_min_h: float, alter_max_h: float) -> pd.DataFrame:
    """Je Post die späteste Messung (Snapshot) mit Alter in [alter_min_h, alter_max_h], Index = Post-ID.

    „Späteste“ wie beim finalen Wert (View ``post_final``): nach Messzeitpunkt, bei Gleichstand nach ID.
    """
    im_bereich = snapshots.loc[snapshots["alter_h"].between(alter_min_h, alter_max_h)]
    spaeteste = im_bereich.sort_values(["gemessen_utc", "id"], kind="stable").groupby("post_id").tail(1)
    return spaeteste.set_index("post_id")


def engagement(
    df: pd.DataFrame,
    alter_min_h: float,
    alter_max_h: float,
    mit_backfill: bool = False,
    pro_stunde: bool = False,
    *,
    snapshots: pd.DataFrame,
    kennzahl: str = "likes",
    zeitzone: str | None = None,
) -> Engagement:
    """Engagement-Werte für Posts mit einer Messung im Messalter [alter_min_h, alter_max_h].

    ``snapshots`` sind alle Messungen (``Daten.snapshots``). Je Post zählt die späteste Messung im
    Bereich, nicht der letzte Snapshot überhaupt: Bei mehreren Läufen am Tag hat ein Post mehrere
    Messungen unter 24 h, und „0–6 h“ soll die frühe Messung vergleichen, auch wenn später noch eine
    kam. Zähler, Original-Zähler, Messalter und Messzeitpunkt stammen alle aus dieser einen Messung.
    Reicht der Bereich bis 24 h oder darüber, ist das immer der letzte Snapshot (danach wird nicht
    mehr gemessen). Backfill-Posts (nur mit ``mit_backfill``) gehen mit ihrem einzigen, finalen
    Snapshot ein, ohne Messalter-Filter.

    Gruppiert nach ``typ_detail``, Format und Stunde (Ortszeit). Zähler-Reihen: nach Typ „Post
    selbst“ (bei Retruths die Zähler des Retruths), nach Format und Stunde „Eigene Posts“ (ohne
    Retruths, siehe ``_gruppiere``), dazu „Original“ (nur Retruths: Zähler des retruthed Posts).
    Für die Original-Reihe muss auch das Original beim Messen ein Alter im Bereich haben
    (``orig_alter_h``); sonst stünden Zähler eines 20 h alten neben denen eines 3 Wochen alten
    Originals. ``pro_stunde``: Wert geteilt durch das Messalter; beim Original durch dessen
    eigenes Alter zum Messzeitpunkt. Posts, bei denen weder der eigene noch der Original-Zähler
    bekannt ist (API-Platzhalter ``-1`` oder Feld fehlt), fehlen in ``basis`` und stehen in
    ``zaehler_unbekannt``.
    """
    gemessen = df["messalter_h"].notna()
    backfill = df["backfill"].astype(bool)
    messung = _spaeteste_messung(snapshots, alter_min_h, alter_max_h)
    im_alter = df["id"].isin(messung.index) & ~backfill
    maske = (im_alter | (gemessen & backfill)) if mit_backfill else im_alter
    teil = df.loc[maske]
    ist_bf = teil["backfill"].astype(bool)
    # Messung im Bereich je Zeile von teil; Backfill-Posts nehmen stattdessen ihren finalen Snapshot.
    aus_bereich = messung.reindex(teil["id"].to_numpy()).set_axis(teil.index)
    messalter = aus_bereich["alter_h"].astype(float).where(~ist_bf, teil["messalter_h"])
    gemessen_um = aus_bereich["gemessen_utc"].where(~ist_bf, teil["gemessen_utc"])
    wert = _als_float(aus_bereich, kennzahl).where(~ist_bf, _als_float(teil, kennzahl))
    original = _als_float(aus_bereich, f"orig_{kennzahl}").where(~ist_bf, _als_float(teil, f"orig_{kennzahl}"))

    lokal = _lokal(teil, zeitzone)
    ist_retruth = teil["typ"].isin(RETRUTH_TYPEN)
    alter_original = (
        (gemessen_um - teil["original_created_at_utc"]).dt.total_seconds() / 3600
    ).astype(float).where(ist_retruth)
    original_gilt = alter_original.between(alter_min_h, alter_max_h) | ist_bf
    original = original.where(ist_retruth & original_gilt)
    mit_wert = wert.notna() | original.notna()
    if pro_stunde:
        wert = wert / messalter.where(messalter > 0)
        original = original / alter_original.where(alter_original > 0)
    basis = pd.DataFrame({
        "id": teil["id"],
        "url": teil["url"],
        "lokal": lokal,
        "typ_detail": teil["typ_detail"],
        "ist_retruth": ist_retruth.astype(bool),
        "format": teil["format"],
        "stunde": lokal.dt.hour.astype("int64"),
        "messalter_h": messalter,
        "orig_alter_h": alter_original,
        "backfill": ist_bf,
        "wert": wert,
        "orig_wert": original,
    }).loc[mit_wert].reset_index(drop=True)
    return Engagement(
        kennzahl=kennzahl,
        pro_stunde=pro_stunde,
        basis=basis,
        nach_typ=_gruppiere(basis, "typ_detail", TYP_DETAILS),
        nach_format=_gruppiere(basis, "format", FORMATE, post_nur_eigene=True),
        nach_stunde=_gruppiere(basis, "stunde", None, post_nur_eigene=True),
        ohne_messung=int((~gemessen).sum()),
        ausserhalb_alter=int((gemessen & ~backfill & ~im_alter).sum()),
        backfill_ausgeschlossen=0 if mit_backfill else int((gemessen & backfill).sum()),
        backfill_einbezogen=int(basis["backfill"].sum()),
        original_ausserhalb_alter=int((ist_retruth & ~original_gilt & mit_wert).sum()),
        zaehler_unbekannt=int((~mit_wert).sum()),
    )


def _gruppiere(
    basis: pd.DataFrame, spalte: str, ordnung: Sequence[str] | None, *, post_nur_eigene: bool = False
) -> pd.DataFrame:
    """Langformat: ``gruppe``, ``zaehler`` (Name der Reihe), ``anzahl``, ``median``, ``mittel`` und
    ``alter_median_h`` (Median des Alters beim Messen: des Posts bzw. des Originals).

    Reihen: „Post selbst“ (alle Posts, bei Retruths die Zähler des Retruths) und „Original“ (nur
    Retruths, Zähler des retruthed Posts). Mit ``post_nur_eigene`` heißt die erste Reihe „Eigene
    Posts“ und enthält keine Retruths; Retruths kommen dann nur über „Original“ vor. Sonst drückten
    die Zähler der Retruths selbst (fast immer 0) den Median einer Format- oder Stundengruppe, in
    der eigene Posts und Retruths gemischt sind.
    """
    if post_nur_eigene:
        erste = (ZAEHLER_EIGENE, basis.loc[~basis["ist_retruth"].astype(bool)])
    else:
        erste = (ZAEHLER_POST, basis)
    zeilen = []
    for (zaehler, quelle), wertspalte, alterspalte in (
        (erste, "wert", "messalter_h"), ((ZAEHLER_ORIGINAL, basis), "orig_wert", "orig_alter_h"),
    ):
        teil = quelle.dropna(subset=[wertspalte])
        if teil.empty:
            continue
        for gruppe, gruppenteil in teil.groupby(spalte):
            werte = gruppenteil[wertspalte]
            zeilen.append({
                "gruppe": gruppe, "zaehler": zaehler, "anzahl": int(werte.size),
                "median": float(werte.median()), "mittel": float(werte.mean()),
                "alter_median_h": float(gruppenteil[alterspalte].median()),
            })
    ergebnis = pd.DataFrame(zeilen, columns=["gruppe", "zaehler", "anzahl", "median", "mittel", "alter_median_h"])
    if ergebnis.empty:
        return ergebnis
    if ordnung is not None:
        rang = {g: i for i, g in enumerate(ordnung)}
        ergebnis["_rang"] = ergebnis["gruppe"].map(lambda g: rang.get(g, len(rang)))
    else:
        ergebnis["_rang"] = ergebnis["gruppe"]
    ergebnis["_z"] = (ergebnis["zaehler"] == ZAEHLER_ORIGINAL).astype(int)
    return ergebnis.sort_values(["_rang", "_z"]).drop(columns=["_rang", "_z"]).reset_index(drop=True)


@dataclass
class Wachstum:
    """Typische Wachstumskurve eines Zählers, nur aus Posts mit mehreren Messungen."""

    kurve: pd.DataFrame  # alter_stunde, messungen, posts, median (Anteil an der letzten Messung, 1 = 100 %)
    posts: int  # Posts in der Kurve
    eigene: int  # eigene Posts der Auswahl ohne Backfill (Kandidaten)
    zu_wenige_messungen: int  # davon mit weniger als zwei Messungen (bekannter Wert) unter max_h
    ohne_bezugswert: int  # davon mit mehreren Messungen, aber letztem Wert 0
    retruths: int  # Retruths der Auswahl ohne Backfill, nie in der Kurve


def wachstum(snapshots: pd.DataFrame, df: pd.DataFrame, kennzahl: str = "likes", *, max_h: float = 24) -> Wachstum:
    """Wie ein Zähler innerhalb der ersten ``max_h`` Stunden eines Posts wächst.

    Nur Posts mit mindestens zwei Messungen (bekannter Wert) unter ``max_h``. Mit einem Lauf am Tag
    hat jeder Post genau eine Messung, und ein Median verschiedener Posts je Alter zeigte nur, zu
    welcher Tageszeit sie entstanden (beim Lauf um 12 Uhr ist ein Post von 9 Uhr 3 h alt, einer von
    23 Uhr am Vortag 13 h). Deshalb wird jeder Post auf seine letzte Messung unter ``max_h``
    bezogen (Anteil, letzte Messung = 1); je voller Stunde Alter zählt der Median dieser Anteile über
    die Posts (fallen zwei Messungen eines Posts in dieselbe Stunde, gilt die spätere). Posts mit
    letztem Wert 0 haben keinen Bezugswert und fehlen.

    Nur eigene Posts (inkl. Quotes und Replies): Die Zähler eines Retruths selbst sind fast immer 0
    und gehören nicht in denselben Median. Backfill-Posts („Endstand nach X Tagen“) zählen nicht.
    """
    ist_retruth = df["typ"].isin(RETRUTH_TYPEN)
    backfill = df["backfill"].astype(bool)
    eigene = df.loc[~ist_retruth & ~backfill, "id"]
    teil = snapshots.loc[snapshots["post_id"].isin(set(eigene)) & (snapshots["alter_h"] < max_h)]
    teil = teil.sort_values(["post_id", "gemessen_utc", "id"], kind="stable")
    rahmen = pd.DataFrame({
        "post_id": teil["post_id"].to_numpy(),
        "alter_h": teil["alter_h"].to_numpy(dtype=float),
        "wert": _als_float(teil, kennzahl).to_numpy(dtype=float),
    }).dropna(subset=["wert"])
    je_post = rahmen.groupby("post_id", sort=False)["wert"]
    anzahl = je_post.transform("size")
    bezug = je_post.transform("last")
    kurventeil = rahmen.loc[(anzahl >= 2) & (bezug > 0)].copy()
    kurventeil["anteil"] = kurventeil["wert"] / bezug.loc[kurventeil.index]
    kurventeil["alter_stunde"] = kurventeil["alter_h"].map(math.floor).astype("int64")

    stunden = range(int(math.ceil(max_h)))
    gruppen = kurventeil.groupby("alter_stunde")
    anteil_je_post = kurventeil.groupby(["alter_stunde", "post_id"], sort=False)["anteil"].last()
    kurve = pd.DataFrame({
        "alter_stunde": list(stunden),
        "messungen": gruppen.size().reindex(stunden, fill_value=0).to_numpy(dtype="int64"),
        "posts": gruppen["post_id"].nunique().reindex(stunden, fill_value=0).to_numpy(dtype="int64"),
        "median": anteil_je_post.groupby(level="alter_stunde").median().reindex(stunden).to_numpy(dtype=float),
    })
    messungen_je_post = rahmen.groupby("post_id").size()
    mehrere = int((messungen_je_post >= 2).sum())
    in_kurve = int(kurventeil["post_id"].nunique())
    return Wachstum(
        kurve=kurve,
        posts=in_kurve,
        eigene=len(eigene),
        zu_wenige_messungen=len(eigene) - mehrere,
        ohne_bezugswert=mehrere - in_kurve,
        retruths=int((ist_retruth & ~backfill).sum()),
    )


# ---------------------------------------------------------------------------
# Retruth-Quellen


@dataclass
class RetruthQuellen:
    anzahl: int
    selbst: int
    anteil_selbst: float | None
    top: pd.DataFrame  # beschriftung, konto_id, handle, anzeigename, verifiziert, follower, ist_trump, anzahl, anteil
    latenz_min: pd.Series
    latenz_verteilung: pd.DataFrame
    latenz_median_min: float | None


def konto_beschriftung(handle: object, konto_id: object) -> str:
    """„@handle“, ersatzweise „Konto 123“; ohne beides (API lieferte kein Konto) „unbekanntes Konto“."""
    if isinstance(handle, str) and handle:
        return f"@{handle}"
    if konto_id is not None and not pd.isna(konto_id) and str(konto_id):
        return f"Konto {konto_id}"
    return "unbekanntes Konto"


def retruth_quellen(df: pd.DataFrame, top_n: int = 15) -> RetruthQuellen:
    """Wessen Posts retruthed er, wie oft sich selbst, und wie lange nach dem Original."""
    rt = df.loc[df["typ"].isin(RETRUTH_TYPEN)]
    n = len(rt)
    selbst = int((rt["typ"] == TYP_SELBST_RETRUTH).sum())
    spalten = [
        "beschriftung", "konto_id", "handle", "anzeigename", "verifiziert", "follower", "ist_trump", "anzahl", "anteil",
    ]
    if n:
        schluessel = rt["retruth_quelle_konto_id"].fillna(rt["retruth_quelle_handle"]).fillna("unbekannt")
        konten = pd.DataFrame({
            "schluessel": schluessel.to_numpy(),
            "konto_id": rt["retruth_quelle_konto_id"].to_numpy(),
            "handle": rt["retruth_quelle_handle"].to_numpy(),
            "anzeigename": rt["retruth_quelle_anzeigename"].to_numpy(),
            "verifiziert": rt["retruth_quelle_verifiziert"].astype(object).to_numpy(),
            "follower": rt["retruth_quelle_follower"].astype("Float64").to_numpy(),
            "ist_trump": (rt["retruth_quelle_ist_trump"].fillna(False).astype(bool)
                          | (rt["typ"] == TYP_SELBST_RETRUTH)).to_numpy(),
        })
        top = konten.groupby("schluessel", sort=False).agg(
            konto_id=("konto_id", "last"), handle=("handle", "last"), anzeigename=("anzeigename", "last"),
            verifiziert=("verifiziert", "last"), follower=("follower", "max"), ist_trump=("ist_trump", "any"),
            anzahl=("schluessel", "size"),
        )
        top["anteil"] = top["anzahl"] / n
        top["beschriftung"] = [konto_beschriftung(h, k) for h, k in zip(top["handle"], top["konto_id"], strict=True)]
        top = top.sort_values(["anzahl", "handle"], ascending=[False, True], kind="stable").head(top_n)
        top = top.reset_index(drop=True)[spalten]
        top["follower"] = _als_int(top["follower"])
        top["verifiziert"] = _als_boolean(top["verifiziert"])
    else:
        top = pd.DataFrame(columns=spalten)
    latenz = (pd.to_numeric(rt["retruth_latenz_s"], errors="coerce").dropna().astype(float) / 60).clip(lower=0)
    latenz = latenz.reset_index(drop=True).rename("latenz_min")
    return RetruthQuellen(
        anzahl=n,
        selbst=selbst,
        anteil_selbst=selbst / n if n else None,
        top=top,
        latenz_min=latenz,
        latenz_verteilung=_klassiere(latenz, LATENZ_KLASSEN_MIN),
        latenz_median_min=float(latenz.median()) if len(latenz) else None,
    )


# ---------------------------------------------------------------------------
# Duplikate


@dataclass
class DuplikatAuswertung:
    gepruefte: int  # Posts mit vollständig abgedecktem 14-Tage-Fenster (Nenner der Rate)
    mit_duplikat: int  # davon mit mindestens einem Duplikat
    rate: float | None
    ohne_abdeckung: int  # Posts der Auswahl, deren Fenster nicht vollständig in der DB liegt
    mit_duplikat_ohne_abdeckung: int  # davon trotzdem mit gefundenem Duplikat (nicht in Rate und Verteilungen)
    nach_art: pd.DataFrame  # art, beschriftung, primaer, alle, anteil_gepruefte, primaer_ohne_abdeckung
    liste: pd.DataFrame  # je Duplikat-Zeile: post_id, art, primaer, frueherer_post_id, abstand_h, geprueft, zusatz
    abstand_verteilung: pd.DataFrame  # Zeilen Abstandsklasse, Spalten Art (stärkste Art, nur geprüfte Posts)


def dup_zusatz(details: object) -> str:
    """Kurzer deutscher Zusatz aus der Spalte ``details`` einer Duplikat-Zeile (nur Metadaten).

    Wichtig vor allem bei „nur Text gleich“: Hat der Server dasselbe Bild neu kodiert, sind die
    Medien nicht byte-gleich, aber wahrscheinlich gleich; das steht dann hier.
    """
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except ValueError:
            return ""
    if not isinstance(details, dict):
        return ""
    teile = []
    if details.get("medien_gleich"):
        teile.append("Medien gleich")
    if details.get("medien_aehnlich"):
        abstand = details.get("phash_abstand_max")
        teile.append("Medien wahrscheinlich gleich" + (f" (pHash-Abstand {abstand})" if abstand is not None else ""))
    elif details.get("phash_abstand_max") is not None:
        teile.append(f"pHash-Abstand {details['phash_abstand_max']}")
    if details.get("quote_verschieden"):
        teile.append("anderes Quote-Ziel")
    return ", ".join(teile)


def duplikat_auswertung(df: pd.DataFrame, duplikate: pd.DataFrame) -> DuplikatAuswertung:
    """Duplikat-Rate, Verteilung nach Art (primär = stärkste Art je Post) und zeitlicher Abstand.

    Rate, Verteilung nach Art und Abstand zählen dieselben Posts: die mit vollständigem
    14-Tage-Fenster. ``primaer`` summiert sich so über alle Arten zu ``mit_duplikat``. Treffer bei
    Posts ohne vollständiges Fenster stehen getrennt (``primaer_ohne_abdeckung``) und in ``liste``.
    """
    ids = set(df["id"])
    dups = duplikate.loc[duplikate["post_id"].isin(ids)].copy()
    abgedeckt = df["dup_abdeckung_vollstaendig"].fillna(False).astype(bool) & df["dup_geprueft_utc"].notna()
    gepruefte_ids = set(df.loc[abgedeckt, "id"])
    dups["geprueft"] = dups["post_id"].isin(gepruefte_ids).astype(bool)
    mit = len(gepruefte_ids & set(dups["post_id"]))
    geprueft = dups.loc[dups["geprueft"]]
    primaer = geprueft.loc[geprueft["primaer"]]
    primaer_offen = dups.loc[dups["primaer"] & ~dups["geprueft"]]
    arten = _reihenfolge(dups["art"], DUP_ARTEN) if not dups.empty else []
    nach_art = pd.DataFrame(
        [{
            "art": art,
            "beschriftung": DUP_BESCHRIFTUNG.get(art, art),
            "primaer": int((primaer["art"] == art).sum()),
            "alle": int((geprueft["art"] == art).sum()),
            "anteil_gepruefte": int((primaer["art"] == art).sum()) / len(gepruefte_ids) if gepruefte_ids else None,
            "primaer_ohne_abdeckung": int((primaer_offen["art"] == art).sum()),
        } for art in arten],
        columns=["art", "beschriftung", "primaer", "alle", "anteil_gepruefte", "primaer_ohne_abdeckung"],
    )
    dups["abstand_h"] = pd.to_numeric(dups["abstand_s"], errors="coerce").astype(float) / 3600
    dups["zusatz"] = (dups["details"] if "details" in dups else pd.Series("", index=dups.index)).map(dup_zusatz)
    liste = dups[["post_id", "art", "primaer", "frueherer_post_id", "abstand_h", "geprueft", "zusatz"]].reset_index(
        drop=True
    )
    namen = [name for _, name in DUP_ABSTAND_KLASSEN_H]
    verteilung = pd.DataFrame(index=pd.Index(namen, name="klasse"))
    for art in _reihenfolge(primaer["art"], DUP_ARTEN):
        werte = liste.loc[liste["primaer"] & liste["geprueft"] & (liste["art"] == art), "abstand_h"]
        verteilung[art] = _klassiere(werte, DUP_ABSTAND_KLASSEN_H)["anzahl"].to_numpy()
    return DuplikatAuswertung(
        gepruefte=len(gepruefte_ids),
        mit_duplikat=mit,
        rate=mit / len(gepruefte_ids) if gepruefte_ids else None,
        ohne_abdeckung=int((~abgedeckt).sum()),
        mit_duplikat_ohne_abdeckung=len(set(dups.loc[~dups["geprueft"], "post_id"])),
        nach_art=nach_art,
        liste=liste,
        abstand_verteilung=verteilung,
    )


# ---------------------------------------------------------------------------
# Löschungen und Edits


@dataclass
class LoeschungenEdits:
    geloescht: int
    vermisst: int  # fehlt in der Timeline, Einzelprüfung unklar (nicht als gelöscht gezählt)
    loeschungen: pd.DataFrame  # je gelöschtem Post: Zeitfenster und Zeit bis zur Löschung (min_h, max_h)
    posts_mit_edits: int
    edits_gesamt: int
    edits: pd.DataFrame  # erkannte Edits der ausgewählten Posts
    edits_nach_art: pd.DataFrame


def loeschungen_edits(df: pd.DataFrame, edits: pd.DataFrame, zeitzone: str | None = None) -> LoeschungenEdits:
    """Gelöschte Posts mit Zeit bis zur Löschung als Intervall und erkannte Edits.

    ``min_h`` = zuletzt gesehen − erstellt (so lange war er mindestens online), ``max_h`` =
    erstmals vermisst − erstellt (spätestens dann war er weg).
    """
    name = _zone_von(df, zeitzone)
    geloescht = df.loc[df["geloescht"]]
    vermisst_seit = geloescht["vermisst_seit_utc"].fillna(geloescht["loeschung_bestaetigt_utc"])
    loeschungen = pd.DataFrame({
        "id": geloescht["id"],
        "url": geloescht["url"],
        "erstellt": geloescht["created_at_utc"].dt.tz_convert(name),
        "typ_detail": geloescht["typ_detail"],
        "format": geloescht["format"],
        "zuletzt_gesehen": geloescht["zuletzt_gesehen_utc"].dt.tz_convert(name),
        "vermisst_seit": vermisst_seit.dt.tz_convert(name),
        "bestaetigt": geloescht["loeschung_bestaetigt_utc"].dt.tz_convert(name),
        "min_h": (geloescht["zuletzt_gesehen_utc"] - geloescht["created_at_utc"]).dt.total_seconds() / 3600,
        "max_h": (vermisst_seit - geloescht["created_at_utc"]).dt.total_seconds() / 3600,
    }).reset_index(drop=True)
    vermisst = int((~df["geloescht"] & df["vermisst_seit_utc"].notna()).sum())

    eigene_edits = edits.merge(
        df[["id", "created_at_utc"]].rename(columns={"id": "post_id"}), on="post_id", how="inner"
    )
    bezug = eigene_edits["edited_at_utc"].fillna(eigene_edits["erkannt_utc"])
    eigene_edits["erkannt"] = eigene_edits["erkannt_utc"].dt.tz_convert(name)
    eigene_edits["nach_h"] = (bezug - eigene_edits["created_at_utc"]).dt.total_seconds() / 3600
    eigene_edits = eigene_edits[["post_id", "erkannt", "art", "nach_h"]].reset_index(drop=True)
    arten = _reihenfolge(eigene_edits["art"], tuple(EDIT_BESCHRIFTUNG))
    nach_art = pd.DataFrame(
        [{"art": a, "beschriftung": EDIT_BESCHRIFTUNG.get(a, a), "anzahl": int((eigene_edits["art"] == a).sum())}
         for a in arten],
        columns=["art", "beschriftung", "anzahl"],
    )
    return LoeschungenEdits(
        geloescht=len(geloescht),
        vermisst=vermisst,
        loeschungen=loeschungen,
        posts_mit_edits=int((df["edit_anzahl"] > 0).sum()),
        edits_gesamt=int(df["edit_anzahl"].sum()),
        edits=eigene_edits,
        edits_nach_art=nach_art,
    )


# ---------------------------------------------------------------------------
# Konto und Läufe


def konto_zeitreihe(konto: pd.DataFrame, zeitzone: str) -> pd.DataFrame:
    """Follower, Following und Gesamtzahl Posts je Lauf, dazu Posts pro Tag laut Konto-Zähler."""
    reihe = konto.sort_values("gemessen_utc", kind="stable")
    tage = reihe["gemessen_utc"].diff().dt.total_seconds() / 86400
    zuwachs = pd.to_numeric(reihe["posts_gesamt"], errors="coerce").astype(float).diff()
    return pd.DataFrame({
        "gemessen": reihe["gemessen_utc"].dt.tz_convert(zone(zeitzone)),
        "follower": reihe["follower"],
        "folgt": reihe["folgt"],
        "posts_gesamt": reihe["posts_gesamt"],
        "posts_pro_tag": (zuwachs / tage.where(tage > 0)).astype(float),
    }).reset_index(drop=True)


def laeufe_tabelle(laeufe: pd.DataFrame, zeitzone: str) -> pd.DataFrame:
    """Laufprotokoll mit deutschen Spaltennamen, neueste Läufe zuerst."""
    name = zone(zeitzone)
    kurz = ZONE_KURZ.get(name, name)
    lauf = laeufe.sort_values("id", ascending=False, kind="stable")
    dauer = (lauf["ende_utc"] - lauf["start_utc"]).dt.total_seconds() / 60
    return pd.DataFrame({
        "Lauf": lauf["id"].astype("int64"),
        f"Start ({kurz})": _ohne_zone(lauf["start_utc"], name),
        f"Ende ({kurz})": _ohne_zone(lauf["ende_utc"], name),
        "Dauer (min)": dauer.round(1),
        "Status": lauf["status"].map(lambda s: LAUF_STATUS_BESCHRIFTUNG.get(s, s)),
        "Zugriff": lauf["zugriff"],
        "Abbruchgrund": lauf["abbruch_grund"],
        "API-Anfragen": lauf["anfragen_api"],
        "Medien-Anfragen": lauf["anfragen_medien"],
        "Seiten": lauf["seiten"],
        "Neue Posts": lauf["neue_posts"],
        "Aktualisierte Posts": lauf["aktualisierte_posts"],
        "Snapshots": lauf["snapshots"],
        "Löschungen erkannt": lauf["geloescht_erkannt"],
        "Edits erkannt": lauf["edits_erkannt"],
        "Fehler": lauf["fehler"],
        "Cloudflare-Challenges": lauf["cloudflare_challenges"],
        "Cloudflare-Blocks": lauf["cloudflare_blocks"],
        "Backfill": lauf["backfill"],
        "Meldungen": lauf["meldungen"],
    }).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Tabelle und CSV


def _ohne_zone(zeitpunkte: pd.Series, name: str = "UTC") -> pd.Series:
    """Zeitpunkte als Wanduhrzeit der Zone ohne Zonenangabe (die Zone steht im Spaltennamen)."""
    return zeitpunkte.dt.tz_convert(name).dt.tz_localize(None)


def _beschrifte(werte: pd.Series, beschriftung: dict[str, str]) -> pd.Series:
    return werte.map(lambda w: None if pd.isna(w) else beschriftung.get(w, w))


def posts_tabelle(df: pd.DataFrame, zeitzone: str | None = None) -> pd.DataFrame:
    """Alle Metadaten je Post mit deutschen Spaltennamen, neueste zuerst. Keine Inhalte.

    Mit ``zeitzone`` (oder der Spalte ``lokal`` aus ``filtere``) kommt die Erstellzeit in Ortszeit dazu.
    Medien: Anzahl je Art, „Abmessungen“ (Breite×Höhe je Medium, mit „, “ getrennt) und „Videodauer (s)“
    (Summe aller Videos, leer ohne Video oder wenn einem Video die Dauer fehlt); keine Medien-URLs.
    """
    d = df.sort_values(["created_at_utc", "id_num"], ascending=False, kind="stable")
    t = pd.DataFrame(index=d.index)
    t["Post-ID"] = d["id"]
    t["Link"] = d["url"]
    t["Erstellt (UTC)"] = _ohne_zone(d["created_at_utc"])
    if zeitzone is not None or "lokal" in d.columns:
        name = _zone_von(d, zeitzone)
        t[f"Erstellt ({ZONE_KURZ.get(name, name)})"] = _ohne_zone(d["created_at_utc"], name)
    t["Typ"] = _beschrifte(d["typ_detail"], TYP_DETAIL_BESCHRIFTUNG)
    t["Quote"] = d["ist_quote"]
    t["Reply"] = d["ist_reply"]
    t["Reply-Art"] = _beschrifte(d["reply_art"], REPLY_BESCHRIFTUNG)
    t["Antwort auf Post-ID"] = d["in_reply_to_id"]
    t["Zitierte Post-ID"] = d["quote_id"]
    t["Original-Post-ID"] = d["original_id"]
    t["Original erstellt (UTC)"] = _ohne_zone(d["original_created_at_utc"])
    t["Retruth-Latenz (min)"] = (pd.to_numeric(d["retruth_latenz_s"], errors="coerce") / 60).round(1)
    quell_titel = ((ROLLE_RETRUTH, "Retruth-Quelle"), (ROLLE_QUOTE, "Quote-Quelle"), (ROLLE_REPLY, "Reply-Quelle"))
    for rolle, titel in quell_titel:
        t[f"{titel}: Konto-ID"] = d[f"{rolle}_quelle_konto_id"]
        t[f"{titel}: Handle"] = d[f"{rolle}_quelle_handle"]
        t[f"{titel}: Anzeigename"] = d[f"{rolle}_quelle_anzeigename"]
        t[f"{titel}: verifiziert"] = d[f"{rolle}_quelle_verifiziert"]
        t[f"{titel}: Follower"] = d[f"{rolle}_quelle_follower"]
        t[f"{titel}: Trump selbst"] = d[f"{rolle}_quelle_ist_trump"]
    t["Gepinnt"] = d["gepinnt"]
    t["Format"] = _beschrifte(d["format"], FORMAT_BESCHRIFTUNG)
    t["Bilder"] = d["n_bilder"]
    t["Videos"] = d["n_videos"]
    t["GIFs"] = d["n_gifs"]
    t["Audio"] = d["n_audio"]
    t["Sonstige Medien"] = d["n_sonstige_medien"]
    t["Abmessungen"] = d["abmessungen"]
    t["Videodauer (s)"] = d["videodauer_s"].round(1)
    t["Medien-Hashes vollständig"] = d["medien_vollstaendig"]
    t["Zeichen"] = d["zeichen"]
    t["Zeichen ohne URLs"] = d["zeichen_ohne_urls"]
    t["URLs"] = d["n_urls"]
    t["Link-Domains"] = d["link_domains"]
    t["Mentions"] = d["n_mentions"]
    t["Hashtags"] = d["n_hashtags"]
    t["Vorschaukarte"] = d["hat_karte"]
    t["Sichtbarkeit"] = d["sichtbarkeit"]
    t["Bearbeitet (UTC)"] = _ohne_zone(d["edited_at_utc"])
    t["Edits"] = d["edit_anzahl"]
    t["Gelöscht"] = d["geloescht"]
    t["Vermisst seit (UTC)"] = _ohne_zone(d["vermisst_seit_utc"])
    t["Löschung bestätigt (UTC)"] = _ohne_zone(d["loeschung_bestaetigt_utc"])
    t["Backfill"] = d["backfill"]
    if "vor_erfassung" in d.columns:
        t["Vor Beginn der Erfassung"] = d["vor_erfassung"].astype(bool)
    t["Zuerst gesehen (UTC)"] = _ohne_zone(d["zuerst_gesehen_utc"])
    t["Zuletzt gesehen (UTC)"] = _ohne_zone(d["zuletzt_gesehen_utc"])
    t["Messung"] = [messalter_text(a, b) for a, b in zip(d["messalter_h"], d["backfill"], strict=True)]
    t["Messalter (h)"] = d["messalter_h"].round(2)
    t["Gemessen (UTC)"] = _ohne_zone(d["gemessen_utc"])
    t["Snapshots"] = d["n_snapshots"]
    t["Eingefroren"] = d["eingefroren"]
    kennzahlen = list(BASIS_KENNZAHLEN) + sorted(
        k for k in d.columns
        if k.endswith("_count") and not k.startswith("orig_") and f"orig_{k}" in d.columns
    )
    for praefix, quelle in (("", ""), ("Original: ", "orig_")):
        for k in kennzahlen:
            name = f"{praefix}{kennzahl_beschriftung(k)}"
            # Eine schon vergebene Spalte würde sonst still mit einem anderen Zähler überschrieben.
            t[name if name not in t.columns else f"{name} ({k})"] = d[f"{quelle}{k}"]
    t["Duplikat (stärkste Art)"] = _beschrifte(d["dup_art"], DUP_BESCHRIFTUNG)
    t["Duplikat: früherer Post-ID"] = d["dup_frueherer_post_id"]
    t["Duplikat: Abstand (h)"] = (pd.to_numeric(d["dup_abstand_s"], errors="coerce") / 3600).round(2)
    t["Duplikat: 14-Tage-Fenster vollständig"] = d["dup_abdeckung_vollstaendig"]
    t["Text-Hash"] = d["text_hash"]
    t["Medien-Hash"] = d["medien_hash"]
    t["Fingerabdruck"] = d["fingerabdruck"]
    return t.reset_index(drop=True)


_FORMEL_ZEICHEN = ("=", "+", "-", "@", "\t", "\r")
_ID_SPALTE = re.compile(r"\bID\b")
_NUR_ZIFFERN = re.compile(r"[0-9]+")


def _csv_text(wert: object) -> object:
    # Anzeigenamen fremder Konten könnten mit "=" beginnen; Excel würde sie sonst als Formel ausführen.
    if isinstance(wert, str) and wert.startswith(_FORMEL_ZEICHEN):
        return "'" + wert
    return wert


def _csv_id(wert: object) -> object:
    # Excel hält Zahlen auf 15 Stellen; aus 116674265088000001 würde 116674265088000000. ="…" bleibt Text.
    # Unbedenklich, weil nur reine Ziffernfolgen so geschrieben werden.
    if isinstance(wert, str) and _NUR_ZIFFERN.fullmatch(wert):
        return f'="{wert}"'
    return _csv_text(wert)


def csv_export(tabelle: pd.DataFrame, *, dezimalkomma: bool = True) -> bytes:
    """CSV für deutsches Excel: UTF-8 mit BOM, Semikolon, Dezimalkomma (abschaltbar), Zeilenende CRLF.

    Wahrheitswerte als „ja“/„nein“, Zeitpunkte als ``JJJJ-MM-TT HH:MM:SS`` (Zone im Spaltennamen).
    IDs (Spalten mit „ID“ im Namen, Wert nur aus Ziffern) als Excel-Text ``="…"``, damit Excel
    die 18-stelligen Snowflake-IDs nicht auf 15 Stellen rundet. Texte, die Excel als Formel lesen
    würde, bekommen ein führendes Apostroph.
    """
    aus = pd.DataFrame(index=tabelle.index)
    for spalte in tabelle.columns:
        werte = tabelle[spalte]
        if pd.api.types.is_bool_dtype(werte):
            aus[spalte] = werte.map(lambda w: "" if pd.isna(w) else ("ja" if w else "nein")).astype(object)
        elif pd.api.types.is_datetime64_any_dtype(werte):
            aus[spalte] = werte.dt.strftime("%Y-%m-%d %H:%M:%S").astype(object).where(werte.notna(), "")
        elif pd.api.types.is_numeric_dtype(werte):
            aus[spalte] = werte
        elif _ID_SPALTE.search(str(spalte)):
            aus[spalte] = werte.map(_csv_id).astype(object)
        else:
            aus[spalte] = werte.map(_csv_text).astype(object)
    text = aus.to_csv(sep=";", index=False, decimal="," if dezimalkomma else ".", lineterminator="\r\n")
    return ("﻿" + text).encode("utf-8")


__all__ = [
    "Daten", "DuplikatAuswertung", "Engagement", "LoeschungenEdits", "RetruthQuellen", "SerienKennzahlen",
    "Ueberblick", "Wachstum", "abstaende_minuten", "abstaende_verteilung", "anteil_retruths", "csv_export", "datenbereich",
    "dauer_text", "duplikat_auswertung", "engagement", "filtere", "formatmix_zeitverlauf",
    "heatmap_wochentag_stunde", "im_zeitraum", "kennzahl_beschriftung", "konto_beschriftung", "konto_zeitreihe",
    "laengste_pause_pro_tag", "laeufe_tabelle", "lade_daten", "loeschungen_edits", "medien_uebersicht",
    "messalter_text", "posts_pro_tag", "posts_tabelle", "prozent", "retruth_quellen", "serien", "serien_im_zeitraum",
    "serien_kennzahlen", "serien_nach_laenge", "serien_nach_stunde", "tagesabdeckung", "ueberblick", "wachstum",
    "zahl", "zeichen_verteilung", "zone",
]
