"""SQLite-Datenbank: Schema und alle Schreib- und Lesezugriffe des Crawlers.

Inhalte haben hier keinen Platz. Gespeichert werden IDs, Post-URLs, Zeitpunkte (UTC-Text),
Zahlen, Hashes, Link-Domains und Account-Metadaten. Die Prüfung ``truthtracker.pruefung``
durchsucht die Datei regelmäßig nach Inhaltsresten.

Zeitpunkte stehen als ``YYYY-MM-DDTHH:MM:SSZ`` in der DB (siehe ``zeit.utc_text``).
Post-IDs stehen als Text (Primärschlüssel, wie die API sie liefert) und zusätzlich als
Zahl in ``id_num`` für Bereichsvergleiche (Snowflake-IDs passen in 64 Bit).
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from truthtracker import zeit
from truthtracker.modelle import (
    TYP_EIGEN,
    PostDaten,
    Zaehler,
)

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    schluessel TEXT PRIMARY KEY,
    wert TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS laeufe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_utc TEXT NOT NULL,
    ende_utc TEXT,
    status TEXT NOT NULL CHECK (status IN ('laeuft', 'ok', 'abgebrochen', 'fehler', 'abgestuerzt')),
    zugriff TEXT,
    abbruch_grund TEXT,
    anfragen_api INTEGER NOT NULL DEFAULT 0,
    anfragen_medien INTEGER NOT NULL DEFAULT 0,
    seiten INTEGER NOT NULL DEFAULT 0,
    neue_posts INTEGER NOT NULL DEFAULT 0,
    aktualisierte_posts INTEGER NOT NULL DEFAULT 0,
    snapshots INTEGER NOT NULL DEFAULT 0,
    geloescht_erkannt INTEGER NOT NULL DEFAULT 0,
    edits_erkannt INTEGER NOT NULL DEFAULT 0,
    fehler INTEGER NOT NULL DEFAULT 0,
    cloudflare_challenges INTEGER NOT NULL DEFAULT 0,
    cloudflare_blocks INTEGER NOT NULL DEFAULT 0,
    backfill INTEGER NOT NULL DEFAULT 0,
    abgedeckt_von_utc TEXT,
    abgedeckt_bis_utc TEXT,
    meldungen TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS konto_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    konto_id TEXT NOT NULL,
    gemessen_utc TEXT NOT NULL,
    follower INTEGER,
    folgt INTEGER,
    posts_gesamt INTEGER,
    UNIQUE (lauf_id, konto_id)
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    id_num INTEGER NOT NULL,
    url TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    zuerst_gesehen_utc TEXT NOT NULL,
    zuletzt_gesehen_utc TEXT NOT NULL,
    erster_lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    letzter_lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    backfill INTEGER NOT NULL DEFAULT 0,
    typ TEXT NOT NULL,
    typ_detail TEXT NOT NULL,
    ist_quote INTEGER NOT NULL DEFAULT 0,
    ist_reply INTEGER NOT NULL DEFAULT 0,
    reply_art TEXT,
    in_reply_to_id TEXT,
    quote_id TEXT,
    original_id TEXT,
    original_created_at_utc TEXT,
    retruth_latenz_s INTEGER,
    gepinnt INTEGER,
    format TEXT NOT NULL,
    n_bilder INTEGER NOT NULL DEFAULT 0,
    n_videos INTEGER NOT NULL DEFAULT 0,
    n_gifs INTEGER NOT NULL DEFAULT 0,
    n_audio INTEGER NOT NULL DEFAULT 0,
    n_sonstige_medien INTEGER NOT NULL DEFAULT 0,
    zeichen INTEGER NOT NULL DEFAULT 0,
    zeichen_ohne_urls INTEGER NOT NULL DEFAULT 0,
    n_urls INTEGER NOT NULL DEFAULT 0,
    n_mentions INTEGER NOT NULL DEFAULT 0,
    n_hashtags INTEGER NOT NULL DEFAULT 0,
    link_domains TEXT NOT NULL DEFAULT '[]',
    hat_karte INTEGER NOT NULL DEFAULT 0,
    text_hash TEXT,
    medien_hash TEXT,
    medien_vollstaendig INTEGER NOT NULL DEFAULT 1,
    fingerabdruck TEXT,
    sichtbarkeit TEXT,
    edited_at_utc TEXT,
    edit_anzahl INTEGER NOT NULL DEFAULT 0,
    geloescht INTEGER NOT NULL DEFAULT 0,
    vermisst_seit_utc TEXT,
    loeschung_bestaetigt_utc TEXT,
    eingefroren INTEGER NOT NULL DEFAULT 0,
    dup_geprueft_utc TEXT,
    dup_abdeckung_vollstaendig INTEGER
);
CREATE INDEX IF NOT EXISTS posts_created ON posts(created_at_utc);
CREATE INDEX IF NOT EXISTS posts_id_num ON posts(id_num);
CREATE INDEX IF NOT EXISTS posts_original ON posts(original_id);
CREATE INDEX IF NOT EXISTS posts_text_hash ON posts(text_hash);
CREATE INDEX IF NOT EXISTS posts_medien_hash ON posts(medien_hash);

CREATE TABLE IF NOT EXISTS medien (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    medien_id TEXT,
    art TEXT NOT NULL,
    breite INTEGER,
    hoehe INTEGER,
    dauer_s REAL,
    sha256 TEXT,
    phash TEXT,
    hash_quelle TEXT,
    hash_status TEXT NOT NULL,
    PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS medien_cache (
    medien_id TEXT PRIMARY KEY,
    art TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    phash TEXT,
    hash_quelle TEXT NOT NULL,
    erstellt_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quellen (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    rolle TEXT NOT NULL CHECK (rolle IN ('retruth', 'quote', 'reply')),
    konto_id TEXT,
    handle TEXT,
    anzeigename TEXT,
    verifiziert INTEGER,
    follower INTEGER,
    ist_trump INTEGER NOT NULL DEFAULT 0,
    erfasst_utc TEXT NOT NULL,
    PRIMARY KEY (post_id, rolle)
);

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    gemessen_utc TEXT NOT NULL,
    alter_h REAL NOT NULL,
    replies INTEGER,
    retruths INTEGER,
    likes INTEGER,
    weitere TEXT NOT NULL DEFAULT '{}',
    orig_replies INTEGER,
    orig_retruths INTEGER,
    orig_likes INTEGER,
    orig_weitere TEXT,
    UNIQUE (post_id, lauf_id)
);
CREATE INDEX IF NOT EXISTS snapshots_post ON snapshots(post_id, gemessen_utc);

CREATE TABLE IF NOT EXISTS edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    erkannt_utc TEXT NOT NULL,
    edited_at_utc TEXT,
    art TEXT NOT NULL CHECK (art IN ('edited_at', 'fingerabdruck', 'beides'))
);

CREATE TABLE IF NOT EXISTS loeschpruefungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    lauf_id INTEGER NOT NULL REFERENCES laeufe(id),
    geprueft_utc TEXT NOT NULL,
    ergebnis TEXT NOT NULL CHECK (ergebnis IN ('geloescht', 'vorhanden', 'unklar')),
    antwort_art TEXT,
    http_status INTEGER
);

CREATE TABLE IF NOT EXISTS abdeckung (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    von_id_num INTEGER NOT NULL,
    bis_id_num INTEGER NOT NULL,
    anfang_erreicht INTEGER NOT NULL DEFAULT 0,
    CHECK (von_id_num <= bis_id_num)
);

CREATE TABLE IF NOT EXISTS duplikate (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    art TEXT NOT NULL,
    frueherer_post_id TEXT NOT NULL,
    abstand_s INTEGER NOT NULL,
    primaer INTEGER NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (post_id, art)
);

CREATE VIEW IF NOT EXISTS post_final AS
SELECT s.*
FROM snapshots s
WHERE s.id = (
    SELECT s2.id FROM snapshots s2
    WHERE s2.post_id = s.post_id
    ORDER BY s2.gemessen_utc DESC, s2.id DESC
    LIMIT 1
);
"""


def oeffne(pfad: Path | str, *, nur_lesen: bool = False) -> sqlite3.Connection:
    pfad = Path(pfad)
    if nur_lesen:
        con = sqlite3.connect(f"file:{pfad.as_posix()}?mode=ro", uri=True, timeout=30)
    else:
        pfad.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(pfad, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    # Gelöschte Daten werden mit Nullen überschrieben statt in freien Seiten liegen zu bleiben.
    con.execute("PRAGMA secure_delete = ON")
    if not nur_lesen:
        con.execute("PRAGMA journal_mode = WAL")
        con.execute("PRAGMA synchronous = NORMAL")
        richte_ein(con)
    return con


def richte_ein(con: sqlite3.Connection) -> None:
    with con:
        con.executescript(SCHEMA)
        con.execute(
            "INSERT INTO meta (schluessel, wert) VALUES ('schema_version', ?) "
            "ON CONFLICT(schluessel) DO NOTHING",
            (str(SCHEMA_VERSION),),
        )
    version = int(meta_lesen(con, "schema_version") or SCHEMA_VERSION)
    if version > SCHEMA_VERSION:
        raise RuntimeError(
            f"Die Datenbank stammt von einer neueren Programmversion (Schema {version} > {SCHEMA_VERSION})."
        )


@contextmanager
def transaktion(con: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    with con:
        yield con


# ---------------------------------------------------------------------------
# meta


def meta_lesen(con: sqlite3.Connection, schluessel: str) -> str | None:
    zeile = con.execute("SELECT wert FROM meta WHERE schluessel = ?", (schluessel,)).fetchone()
    return zeile["wert"] if zeile else None


def meta_schreiben(con: sqlite3.Connection, schluessel: str, wert: str) -> None:
    con.execute(
        "INSERT INTO meta (schluessel, wert) VALUES (?, ?) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
        (schluessel, wert),
    )


# ---------------------------------------------------------------------------
# Läufe


@dataclass
class LaufZaehler:
    anfragen_api: int = 0
    anfragen_medien: int = 0
    seiten: int = 0
    neue_posts: int = 0
    aktualisierte_posts: int = 0
    snapshots: int = 0
    geloescht_erkannt: int = 0
    edits_erkannt: int = 0
    fehler: int = 0
    cloudflare_challenges: int = 0
    cloudflare_blocks: int = 0


def markiere_abgestuerzte_laeufe(con: sqlite3.Connection, jetzt: datetime) -> int:
    """Läufe, die noch auf 'laeuft' stehen, sind beim letzten Mal abgestürzt."""
    with con:
        cur = con.execute(
            "UPDATE laeufe SET status = 'abgestuerzt', ende_utc = COALESCE(ende_utc, ?) WHERE status = 'laeuft'",
            (zeit.utc_text(jetzt),),
        )
    return cur.rowcount


def lauf_starten(con: sqlite3.Connection, start: datetime, *, backfill: bool) -> int:
    with con:
        cur = con.execute(
            "INSERT INTO laeufe (start_utc, status, backfill) VALUES (?, 'laeuft', ?)",
            (zeit.utc_text(start), int(backfill)),
        )
    return int(cur.lastrowid)


def lauf_beenden(
    con: sqlite3.Connection,
    lauf_id: int,
    *,
    ende: datetime,
    status: str,
    zugriff: str | None,
    abbruch_grund: str | None,
    zaehler: LaufZaehler,
    meldungen: list[str],
    abgedeckt_von: datetime | None,
    abgedeckt_bis: datetime | None,
) -> None:
    with con:
        con.execute(
            """UPDATE laeufe SET ende_utc = ?, status = ?, zugriff = ?, abbruch_grund = ?,
                   anfragen_api = ?, anfragen_medien = ?, seiten = ?, neue_posts = ?, aktualisierte_posts = ?,
                   snapshots = ?, geloescht_erkannt = ?, edits_erkannt = ?, fehler = ?,
                   cloudflare_challenges = ?, cloudflare_blocks = ?, meldungen = ?,
                   abgedeckt_von_utc = ?, abgedeckt_bis_utc = ?
               WHERE id = ?""",
            (
                zeit.utc_text(ende), status, zugriff, abbruch_grund,
                zaehler.anfragen_api, zaehler.anfragen_medien, zaehler.seiten, zaehler.neue_posts,
                zaehler.aktualisierte_posts, zaehler.snapshots, zaehler.geloescht_erkannt, zaehler.edits_erkannt,
                zaehler.fehler, zaehler.cloudflare_challenges, zaehler.cloudflare_blocks,
                json.dumps(meldungen, ensure_ascii=False),
                zeit.utc_text(abgedeckt_von), zeit.utc_text(abgedeckt_bis), lauf_id,
            ),
        )


def anzahl_laeufe(con: sqlite3.Connection) -> int:
    return int(con.execute("SELECT COUNT(*) FROM laeufe").fetchone()[0])


# ---------------------------------------------------------------------------
# Konto


def konto_snapshot_speichern(
    con: sqlite3.Connection,
    lauf_id: int,
    konto_id: str,
    gemessen: datetime,
    *,
    follower: int | None,
    folgt: int | None,
    posts_gesamt: int | None,
) -> None:
    with con:
        con.execute(
            """INSERT INTO konto_snapshots (lauf_id, konto_id, gemessen_utc, follower, folgt, posts_gesamt)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(lauf_id, konto_id) DO UPDATE SET gemessen_utc = excluded.gemessen_utc,
                   follower = excluded.follower, folgt = excluded.folgt, posts_gesamt = excluded.posts_gesamt""",
            (lauf_id, konto_id, zeit.utc_text(gemessen), follower, folgt, posts_gesamt),
        )


# ---------------------------------------------------------------------------
# Posts


@dataclass
class Speicherergebnis:
    neu: bool
    geaendert: bool  # bei bekannten Posts: hat sich an den Metadaten etwas geändert?
    edit_erkannt: bool
    war_geloescht: bool  # war als gelöscht markiert und ist wieder aufgetaucht


def _bool(wert: bool | None) -> int | None:
    return None if wert is None else int(bool(wert))


def _zaehler_json(z: Zaehler | None) -> str | None:
    return None if z is None else json.dumps(z.weitere, sort_keys=True)


_POST_SPALTEN = (
    "url", "created_at_utc", "typ", "typ_detail", "ist_quote", "ist_reply", "reply_art", "in_reply_to_id",
    "quote_id", "original_id", "original_created_at_utc", "retruth_latenz_s", "gepinnt", "format",
    "n_bilder", "n_videos", "n_gifs", "n_audio", "n_sonstige_medien", "zeichen", "zeichen_ohne_urls",
    "n_urls", "n_mentions", "n_hashtags", "link_domains", "hat_karte", "text_hash", "medien_hash",
    "medien_vollstaendig", "fingerabdruck", "sichtbarkeit", "edited_at_utc",
)


def _post_werte(post: PostDaten) -> dict[str, Any]:
    return {
        "url": post.url,
        "created_at_utc": zeit.utc_text(post.created_at),
        "typ": post.typ,
        "typ_detail": post.typ_detail,
        "ist_quote": int(post.ist_quote),
        "ist_reply": int(post.ist_reply),
        "reply_art": post.reply_art,
        "in_reply_to_id": post.in_reply_to_id,
        "quote_id": post.quote_id,
        "original_id": post.original_id,
        "original_created_at_utc": zeit.utc_text(post.original_created_at),
        "retruth_latenz_s": post.retruth_latenz_s,
        "gepinnt": _bool(post.gepinnt),
        "format": post.format,
        "n_bilder": post.n_bilder,
        "n_videos": post.n_videos,
        "n_gifs": post.n_gifs,
        "n_audio": post.n_audio,
        "n_sonstige_medien": post.n_sonstige_medien,
        "zeichen": post.text.zeichen,
        "zeichen_ohne_urls": post.text.zeichen_ohne_urls,
        "n_urls": post.text.n_urls,
        "n_mentions": post.text.n_mentions,
        "n_hashtags": post.text.n_hashtags,
        "link_domains": json.dumps(sorted(set(post.text.link_domains))),
        "hat_karte": int(post.hat_karte),
        "text_hash": post.text.text_hash,
        "medien_hash": post.medien_hash,
        "medien_vollstaendig": int(post.medien_vollstaendig),
        "fingerabdruck": post.fingerabdruck,
        "sichtbarkeit": post.sichtbarkeit,
        "edited_at_utc": zeit.utc_text(post.edited_at),
    }


def post_lesen(con: sqlite3.Connection, post_id: str) -> sqlite3.Row | None:
    return con.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()


def _edit_art(alt: sqlite3.Row, neu: dict[str, Any], post: PostDaten) -> str | None:
    """Wurde der Post seit der letzten Beobachtung bearbeitet? Nur eigene Posts (keine Retruths).

    ``edited_at`` ändert sich → Edit. Ohne ``edited_at``-Änderung zählt ein geänderter
    Text-Hash oder (wenn beide Seiten vollständig gehasht sind) ein geänderter Medien-Hash
    bzw. eine geänderte Medienzahl. Das bloße Nachreichen fehlender Medien-Hashes ist kein Edit.
    """
    if post.ist_retruth:
        return None
    zeit_neu = neu["edited_at_utc"] is not None and neu["edited_at_utc"] != alt["edited_at_utc"]
    text_neu = alt["text_hash"] != neu["text_hash"]
    medien_anzahl_alt = alt["n_bilder"] + alt["n_videos"] + alt["n_gifs"] + alt["n_audio"] + alt["n_sonstige_medien"]
    medien_anzahl_neu = post.n_bilder + post.n_videos + post.n_gifs + post.n_audio + post.n_sonstige_medien
    medien_neu = medien_anzahl_alt != medien_anzahl_neu or (
        bool(alt["medien_vollstaendig"]) and post.medien_vollstaendig and alt["medien_hash"] != neu["medien_hash"]
    )
    inhalt_neu = text_neu or medien_neu
    if zeit_neu and inhalt_neu:
        return "beides"
    if zeit_neu:
        return "edited_at"
    if inhalt_neu:
        return "fingerabdruck"
    return None


def post_speichern(
    con: sqlite3.Connection,
    post: PostDaten,
    *,
    lauf_id: int,
    gesehen: datetime,
    backfill: bool,
) -> Speicherergebnis:
    """Legt einen Post an oder aktualisiert ihn (idempotent). Erkennt Edits und Wiederauftauchen."""
    neu = _post_werte(post)
    gesehen_text = zeit.utc_text(gesehen)
    alt = post_lesen(con, post.id)
    with con:
        if alt is None:
            vorab_editiert = not post.ist_retruth and neu["edited_at_utc"] is not None
            edits = _edits_aus_revision(post)
            if vorab_editiert:
                edits = max(edits, 1)
            spalten = ["id", "id_num", "zuerst_gesehen_utc", "zuletzt_gesehen_utc", "erster_lauf_id",
                       "letzter_lauf_id", "backfill", "edit_anzahl", *_POST_SPALTEN]
            werte = [post.id, int(post.id), gesehen_text, gesehen_text, lauf_id, lauf_id, int(backfill), edits]
            werte += [neu[s] for s in _POST_SPALTEN]
            con.execute(
                f"INSERT INTO posts ({', '.join(spalten)}) VALUES ({', '.join('?' * len(spalten))})", werte
            )
            if vorab_editiert:
                # Schon beim ersten Sehen bearbeitet: Zeitpunkt aus edited_at, erkannt jetzt.
                con.execute(
                    "INSERT INTO edits (post_id, lauf_id, erkannt_utc, edited_at_utc, art) VALUES (?, ?, ?, ?, ?)",
                    (post.id, lauf_id, gesehen_text, neu["edited_at_utc"], "edited_at"),
                )
            _medien_und_quellen_speichern(con, post, gesehen_text)
            return Speicherergebnis(neu=True, geaendert=True, edit_erkannt=False, war_geloescht=False)

        edit = _edit_art(alt, neu, post)
        geaendert = any(alt[s] != neu[s] for s in _POST_SPALTEN)
        # Vorhandene Hashes nicht durch "unbekannt" überschreiben, wenn diesmal Medien-Downloads ausfielen.
        if not post.medien_vollstaendig and alt["medien_vollstaendig"] and (
            alt["n_bilder"] + alt["n_videos"] + alt["n_gifs"] == post.n_bilder + post.n_videos + post.n_gifs
        ):
            for spalte in ("medien_hash", "medien_vollstaendig", "fingerabdruck"):
                neu[spalte] = alt[spalte]
        zuweisungen = ", ".join(f"{s} = ?" for s in _POST_SPALTEN)
        edits = max(alt["edit_anzahl"] + (1 if edit else 0), _edits_aus_revision(post))
        con.execute(
            f"""UPDATE posts SET {zuweisungen}, zuletzt_gesehen_utc = ?, letzter_lauf_id = ?,
                    geloescht = 0, vermisst_seit_utc = NULL, loeschung_bestaetigt_utc = NULL,
                    edit_anzahl = ?
                WHERE id = ?""",
            [*(neu[s] for s in _POST_SPALTEN), gesehen_text, lauf_id, edits, post.id],
        )
        if edit:
            con.execute(
                "INSERT INTO edits (post_id, lauf_id, erkannt_utc, edited_at_utc, art) VALUES (?, ?, ?, ?, ?)",
                (post.id, lauf_id, gesehen_text, neu["edited_at_utc"], edit),
            )
        if geaendert or edit or not post.medien_vollstaendig:
            _medien_und_quellen_speichern(con, post, gesehen_text)
        else:
            _quellen_speichern(con, post, gesehen_text)
    return Speicherergebnis(
        neu=False, geaendert=geaendert, edit_erkannt=edit is not None, war_geloescht=bool(alt["geloescht"])
    )


def _edits_aus_revision(post: PostDaten) -> int:
    """Truth Social zählt Revisionen im Feld ``version``; Edits = Revision − 1 (nur eigene Posts)."""
    if post.ist_retruth or post.revision is None or post.revision < 1:
        return 0
    return post.revision - 1


def _medien_und_quellen_speichern(con: sqlite3.Connection, post: PostDaten, gesehen_text: str) -> None:
    vorhandene = {
        z["position"]: z for z in con.execute("SELECT * FROM medien WHERE post_id = ?", (post.id,)).fetchall()
    }
    gueltige = set()
    for m in post.medien:
        gueltige.add(m.position)
        alt = vorhandene.get(m.position)
        # Bekannte Hashes behalten, wenn der neue Versuch fehlschlug und es dasselbe Medium ist.
        if alt is not None and m.sha256 is None and alt["sha256"] and alt["medien_id"] == m.medien_id:
            continue
        con.execute(
            """INSERT INTO medien (post_id, position, medien_id, art, breite, hoehe, dauer_s, sha256, phash,
                                   hash_quelle, hash_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(post_id, position) DO UPDATE SET medien_id = excluded.medien_id, art = excluded.art,
                   breite = excluded.breite, hoehe = excluded.hoehe, dauer_s = excluded.dauer_s,
                   sha256 = excluded.sha256, phash = excluded.phash, hash_quelle = excluded.hash_quelle,
                   hash_status = excluded.hash_status""",
            (post.id, m.position, m.medien_id, m.art, m.breite, m.hoehe, m.dauer_s, m.sha256, m.phash,
             m.hash_quelle, m.hash_status),
        )
    for position in set(vorhandene) - gueltige:
        con.execute("DELETE FROM medien WHERE post_id = ? AND position = ?", (post.id, position))
    _quellen_speichern(con, post, gesehen_text)


def _quellen_speichern(con: sqlite3.Connection, post: PostDaten, gesehen_text: str) -> None:
    """Quell-Accounts: Stand der ersten Erfassung bleibt; fehlende Werte werden später ergänzt."""
    for q in post.quellen:
        con.execute(
            """INSERT INTO quellen (post_id, rolle, konto_id, handle, anzeigename, verifiziert, follower,
                                    ist_trump, erfasst_utc)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(post_id, rolle) DO UPDATE SET
                   konto_id = COALESCE(quellen.konto_id, excluded.konto_id),
                   handle = COALESCE(quellen.handle, excluded.handle),
                   anzeigename = COALESCE(quellen.anzeigename, excluded.anzeigename),
                   verifiziert = COALESCE(quellen.verifiziert, excluded.verifiziert),
                   follower = COALESCE(quellen.follower, excluded.follower)""",
            (post.id, q.rolle, q.konto_id, q.handle, q.anzeigename, _bool(q.verifiziert), q.follower,
             int(q.ist_trump), gesehen_text),
        )


def posts_ohne_vollstaendige_medien(con: sqlite3.Connection, seit: datetime, grenze: int) -> list[str]:
    """Posts mit fehlgeschlagenen Medien-Hashes, die noch im Duplikat-Fenster liegen."""
    zeilen = con.execute(
        """SELECT id FROM posts WHERE medien_vollstaendig = 0 AND geloescht = 0 AND created_at_utc >= ?
           ORDER BY id_num DESC LIMIT ?""",
        (zeit.utc_text(seit), grenze),
    ).fetchall()
    return [z["id"] for z in zeilen]


def gepinnt_setzen(con: sqlite3.Connection, gepinnte_ids: Iterable[str]) -> None:
    """Gepinnt-Status aller bekannten Posts nach der aktuellen Liste der gepinnten Posts."""
    ids = list(gepinnte_ids)
    with con:
        con.execute("UPDATE posts SET gepinnt = 0 WHERE gepinnt IS NOT 0")
        if ids:
            con.execute(
                f"UPDATE posts SET gepinnt = 1 WHERE id IN ({', '.join('?' * len(ids))})", ids
            )


# ---------------------------------------------------------------------------
# Medien-Cache


def medien_cache_holen(con: sqlite3.Connection, medien_id: str) -> sqlite3.Row | None:
    return con.execute("SELECT * FROM medien_cache WHERE medien_id = ?", (medien_id,)).fetchone()


def medien_cache_speichern(
    con: sqlite3.Connection, medien_id: str, art: str, sha256: str, phash: str | None, hash_quelle: str, jetzt: datetime
) -> None:
    with con:
        con.execute(
            """INSERT INTO medien_cache (medien_id, art, sha256, phash, hash_quelle, erstellt_utc)
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(medien_id) DO NOTHING""",
            (medien_id, art, sha256, phash, hash_quelle, zeit.utc_text(jetzt)),
        )


# ---------------------------------------------------------------------------
# Snapshots


def hat_snapshot(con: sqlite3.Connection, post_id: str) -> bool:
    return con.execute("SELECT 1 FROM snapshots WHERE post_id = ? LIMIT 1", (post_id,)).fetchone() is not None


def snapshot_noetig(con: sqlite3.Connection, post_id: str, alter_h: float, grenze_h: float) -> bool:
    """Jünger als die Grenze: bei jedem Lauf. Älter: nur, wenn es noch gar keinen Snapshot gibt."""
    if alter_h < grenze_h:
        return True
    return not hat_snapshot(con, post_id)


def snapshot_speichern(
    con: sqlite3.Connection,
    post: PostDaten,
    *,
    lauf_id: int,
    gemessen: datetime,
    grenze_h: float,
) -> bool:
    """Speichert einen Engagement-Snapshot, sofern die 24h-Regel ihn verlangt. Gibt zurück, ob gespeichert."""
    alter_h = zeit.alter_in_stunden(post.created_at, gemessen)
    if not snapshot_noetig(con, post.id, alter_h, grenze_h):
        return False
    z, o = post.zaehler, post.zaehler_original
    with con:
        cur = con.execute(
            """INSERT INTO snapshots (post_id, lauf_id, gemessen_utc, alter_h, replies, retruths, likes, weitere,
                                      orig_replies, orig_retruths, orig_likes, orig_weitere)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(post_id, lauf_id) DO NOTHING""",
            (
                post.id, lauf_id, zeit.utc_text(gemessen), round(max(alter_h, 0.0), 4),
                z.replies, z.retruths, z.likes, _zaehler_json(z) or "{}",
                o.replies if o else None, o.retruths if o else None, o.likes if o else None, _zaehler_json(o),
            ),
        )
        if alter_h >= grenze_h:
            con.execute("UPDATE posts SET eingefroren = 1 WHERE id = ?", (post.id,))
    return cur.rowcount > 0


def friere_ein(con: sqlite3.Connection, jetzt: datetime, grenze_h: float) -> None:
    """Markiert alle Posts mit mindestens einem Snapshot, die älter als die Grenze sind."""
    grenze = zeit.utc_text(jetzt - timedelta(hours=grenze_h))
    with con:
        con.execute(
            """UPDATE posts SET eingefroren = 1
               WHERE eingefroren = 0 AND created_at_utc <= ?
                 AND EXISTS (SELECT 1 FROM snapshots s WHERE s.post_id = posts.id)""",
            (grenze,),
        )


# ---------------------------------------------------------------------------
# Abdeckung (welche ID-Bereiche der Timeline lückenlos abgerufen wurden)


@dataclass(frozen=True)
class Bereich:
    von: int  # älteste abgedeckte ID (inklusive)
    bis: int  # neueste abgedeckte ID (inklusive)
    anfang_erreicht: bool = False


def abdeckung_lesen(con: sqlite3.Connection) -> list[Bereich]:
    """Abgedeckte Bereiche, absteigend nach ``bis`` (neueste zuerst), bereits verschmolzen."""
    zeilen = con.execute("SELECT von_id_num, bis_id_num, anfang_erreicht FROM abdeckung").fetchall()
    return _verschmelze([Bereich(z[0], z[1], bool(z[2])) for z in zeilen])


def _verschmelze(bereiche: list[Bereich]) -> list[Bereich]:
    sortiert = sorted(bereiche, key=lambda b: b.von)
    ergebnis: list[Bereich] = []
    for b in sortiert:
        if ergebnis and b.von <= ergebnis[-1].bis + 1:
            letzter = ergebnis[-1]
            ergebnis[-1] = Bereich(letzter.von, max(letzter.bis, b.bis), letzter.anfang_erreicht or b.anfang_erreicht)
        else:
            ergebnis.append(b)
    return sorted(ergebnis, key=lambda b: b.bis, reverse=True)


def abdeckung_hinzufuegen(con: sqlite3.Connection, bereich: Bereich) -> None:
    alle = _verschmelze([*abdeckung_lesen(con), bereich])
    with con:
        con.execute("DELETE FROM abdeckung")
        con.executemany(
            "INSERT INTO abdeckung (von_id_num, bis_id_num, anfang_erreicht) VALUES (?, ?, ?)",
            [(b.von, b.bis, int(b.anfang_erreicht)) for b in alle],
        )


def abdeckung_vollstaendig(con: sqlite3.Connection, von: datetime, bis: datetime) -> bool:
    """Ist der Zeitraum [von, bis] lückenlos von einem abgedeckten Bereich umfasst?"""
    unten, oben = zeit.id_untergrenze(von), zeit.id_obergrenze(bis)
    for b in abdeckung_lesen(con):
        b_von = 0 if b.anfang_erreicht else b.von
        if b_von <= unten and b.bis >= oben:
            return True
    return False


# ---------------------------------------------------------------------------
# Löschungen


def kandidaten_fuer_loeschpruefung(
    con: sqlite3.Connection, *, von_id: int, bis_id: int, seit: datetime, gesehen: set[str]
) -> list[str]:
    """Bekannte, nicht gelöschte Posts im abgedeckten ID-Bereich der Tage seit ``seit``, die fehlen."""
    zeilen = con.execute(
        """SELECT id FROM posts
           WHERE geloescht = 0 AND id_num BETWEEN ? AND ? AND created_at_utc >= ?
           ORDER BY id_num DESC""",
        (von_id, bis_id, zeit.utc_text(seit)),
    ).fetchall()
    return [z["id"] for z in zeilen if z["id"] not in gesehen]


def loeschpruefung_protokollieren(
    con: sqlite3.Connection, post_id: str, lauf_id: int, jetzt: datetime, ergebnis: str,
    antwort_art: str | None, http_status: int | None,
) -> None:
    with con:
        con.execute(
            """INSERT INTO loeschpruefungen (post_id, lauf_id, geprueft_utc, ergebnis, antwort_art, http_status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (post_id, lauf_id, zeit.utc_text(jetzt), ergebnis, antwort_art, http_status),
        )


def als_vermisst_markieren(con: sqlite3.Connection, post_id: str, jetzt: datetime) -> None:
    """Fehlt in der Timeline, Prüfung aber unklar: nur den Zeitpunkt des ersten Fehlens merken."""
    with con:
        con.execute(
            "UPDATE posts SET vermisst_seit_utc = COALESCE(vermisst_seit_utc, ?) WHERE id = ? AND geloescht = 0",
            (zeit.utc_text(jetzt), post_id),
        )


def als_geloescht_markieren(con: sqlite3.Connection, post_id: str, jetzt: datetime) -> None:
    with con:
        con.execute(
            """UPDATE posts SET geloescht = 1, vermisst_seit_utc = COALESCE(vermisst_seit_utc, ?),
                   loeschung_bestaetigt_utc = ?
               WHERE id = ?""",
            (zeit.utc_text(jetzt), zeit.utc_text(jetzt), post_id),
        )


def als_vorhanden_bestaetigen(con: sqlite3.Connection, post_id: str, jetzt: datetime) -> None:
    """Einzelabruf fand den Post: nicht gelöscht, zuletzt gesehen jetzt."""
    with con:
        con.execute(
            """UPDATE posts SET geloescht = 0, vermisst_seit_utc = NULL, loeschung_bestaetigt_utc = NULL,
                   zuletzt_gesehen_utc = ?
               WHERE id = ?""",
            (zeit.utc_text(jetzt), post_id),
        )


# ---------------------------------------------------------------------------
# Lesen für Auswertungen


def ist_eigener_post(typ: str) -> bool:
    return typ == TYP_EIGEN


def zaehle(con: sqlite3.Connection, tabelle: str) -> int:
    if tabelle not in {"posts", "snapshots", "laeufe", "medien", "quellen", "duplikate", "edits", "konto_snapshots"}:
        raise ValueError(tabelle)
    return int(con.execute(f"SELECT COUNT(*) FROM {tabelle}").fetchone()[0])
