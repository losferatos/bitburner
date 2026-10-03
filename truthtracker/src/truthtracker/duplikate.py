"""Duplikat-Erkennung: Hat er in den Tagen vor einem Post dasselbe schon gepostet oder retruthed?

Grundlage sind ausschließlich Metadaten aus der DB: Original-IDs, Text-, Medien- und
Inhalts-Hashes, pHashes, Dauer und Abmessungen der Medien. Für jeden Post P zählt jeder
frühere Post Q mit ``P.t − Fenster ≤ Q.t`` (Fenster = ``[erfassung] duplikat_fenster_tage``;
bei gleicher Sekunde ist die kleinere ID früher). Gelöschte Posts zählen mit, er hat sie ja
gepostet. Paar-Kategorien, stärkste zuerst (siehe docs/architektur.md):

1. ``gleiches_original``: gleiche Inhalts-ID (Original-ID bei Retruths, sonst die eigene ID).
   Dazu gehört der Selbst-Retruth eines eigenen Posts aus dem Fenster.
2. ``exakt``: gleicher Fingerabdruck (Text, Medien und Quote-Ziel gleich).
3a. ``nur_text``: gleicher, nicht leerer Text, Medien verschieden. Sind die Medien desselben
   Paars wahrscheinlich gleich (Bedingung von Kategorie 4), stehen ``medien_aehnlich`` und der
   pHash-Abstand in den Details: Gleicher Text mit neu hochgeladenem Bild ist so von "gleicher
   Text, anderes Bild" zu unterscheiden. Sind Text und Medien gleich und nur das Quote-Ziel
   anders, gibt es für das Paar nur diese Zeile, mit ``quote_verschieden`` (und
   ``medien_gleich``, wenn es Medien gibt).
3b. ``nur_medien``: gleiche Medien, Text verschieden (auch leer gegen nicht leer); bei
   beiderseits leerem Text auch gleiche Medien mit anderem Quote-Ziel (``quote_verschieden``).
4. ``medien_aehnlich``: gleich viele Medien (mindestens eins), nicht exakt gleich, aber eine
   1:1-Zuordnung, in der jedes Paar dieselbe Art, einen kleinen pHash-Abstand und passende
   Dauer bzw. passendes Seitenverhältnis hat.

Ein Paar mit gleicher Inhalts-ID zählt nur für Kategorie 1: Zwei Retruths desselben Originals
sind kein zusätzliches "exaktes" Duplikat. Fehlen bei P Medien-Hashes, entfallen 2, 3b und 4;
3a gilt dann nur, wenn feststeht, dass sich die Medien unterscheiden (andere Medienzahl) oder
das Quote-Ziel verschieden ist. Je Kategorie wird der zeitlich nächste frühere Post
gespeichert, die stärkste gefundene Kategorie bekommt ``primaer = 1``.

Ein Anhang ohne Hash und ohne Medien-ID hat keinen eindeutigen Vergleichsschlüssel
(``art:ohne-hash:None`` wäre für alle solchen Anhänge gleich). Ein Post mit so einem Anhang
gilt hier als unvollständig gehasht, damit nicht zwei beliebige Anhänge als gleich zählen.

``dup_abdeckung_vollstaendig`` ist 1, wenn das Fenster vor P lückenlos abgerufen wurde und P
vollständige Medien-Hashes hat. Fehlende Hashes früherer Posts im Fenster zählen bewusst
nicht: Ein einziger dauerhaft gescheiterter Download nähme sonst alle Posts der folgenden
Tage aus dem Nenner der Duplikat-Rate.

Posts mit unlesbarer Erstellzeit (nicht in der Form ``YYYY-MM-DDTHH:MM:SSZ`` oder vor 1970)
werden nicht verglichen, aber als geprüft markiert (Flag 0) und nur mit ihrer ID gemeldet.
Sonst blieben sie bei jedem Lauf Auslöser und brächten die Prüfung jedes Mal zum Absturz.

Laufzeit: Die Posts werden einmal nach Zeit sortiert durchlaufen. Kandidaten kommen aus
Hash-Indizes und werden nur innerhalb des Fensters rückwärts durchsucht. Für Kategorie 4
teilt ein Schubfach-Index die 64 pHash-Bits in ``phash_max_abstand + 1`` Blöcke: Zwei Hashes
mit höchstens so vielen abweichenden Bits stimmen in mindestens einem Block exakt überein.
"""

from __future__ import annotations

import bisect
import json
import logging
import math
import sqlite3
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from truthtracker import db, zeit
from truthtracker.konfig import DuplikatKonfig, Konfig
from truthtracker.modelle import (
    DUP_ARTEN,
    DUP_EXAKT,
    DUP_GLEICHES_ORIGINAL,
    DUP_MEDIEN_AEHNLICH,
    DUP_NUR_MEDIEN,
    DUP_NUR_TEXT,
    HASH_OK,
    HASH_UEBERSPRUNGEN,
    MEDIUM_GIF,
    MEDIUM_VIDEO,
)

log = logging.getLogger(__name__)

PHASH_BITS = 64
# Gleitkomma-Reste (z. B. 1.53 / 1.5) sollen eine Grenze nicht knapp verfehlen lassen.
_EPS = 1e-9
# SQLite erlaubt nur begrenzt viele Parameter pro Anweisung.
_IN_STUECK = 500
_EPOCHE = datetime(1970, 1, 1, tzinfo=UTC)
_LETZTE_SEKUNDE = (datetime(9999, 12, 31, 23, 59, 59, tzinfo=UTC) - _EPOCHE) // timedelta(seconds=1)
# Medium ohne Hash und ohne Medien-ID: kein eindeutiger Vergleichsschlüssel (siehe Modulbeschreibung).
_OHNE_SCHLUESSEL = "m.hash_status = ? AND (m.medien_id IS NULL OR m.medien_id = '')"


@dataclass
class DupBericht:
    """Ergebnis einer Bewertung: geprüfte Posts, davon mit Duplikat, gespeicherte Treffer je Art."""

    geprueft: int
    mit_duplikat: int
    je_art: dict[str, int]


@dataclass(slots=True)
class _Medium:
    art: str
    phash: int
    breite: int | None
    hoehe: int | None
    dauer_s: float | None


@dataclass(slots=True)
class _Post:
    id: str
    id_num: int
    t: int  # created_at in Sekunden seit 1970 (UTC)
    inhalts_id: str
    text_hash: str | None
    medien_hash: str | None
    medien_vollstaendig: bool
    fingerabdruck: str | None
    quote_id: str | None
    n_medien: int
    # Nur gesetzt, wenn jedes Medium einen pHash hat (Voraussetzung für Kategorie 4).
    medien: list[_Medium] | None = None
    signatur: tuple[str, ...] | None = None  # sortierte Medienarten


@dataclass(slots=True)
class _Treffer:
    art: str
    frueher: _Post
    details: dict[str, Any]


# ---------------------------------------------------------------------------
# Öffentliche Funktionen


def aktualisiere_duplikate(
    con: sqlite3.Connection,
    konfig: Konfig,
    *,
    betroffene_ids: Iterable[str] | None,
    jetzt: datetime,
) -> DupBericht:
    """Bewertet Duplikate neu und schreibt Tabelle ``duplikate`` sowie die ``dup_*``-Spalten.

    ``betroffene_ids=None`` bewertet alle Posts. Sonst werden die betroffenen Posts Q selbst
    neu bewertet und alle Posts P, in deren Fenster Q liegt (Q früher als P,
    ``P.t ≤ Q.t + Fenster``), weil sich deren Vergleichsmenge geändert hat. Posts, die noch
    nie bewertet wurden (``dup_geprueft_utc`` leer, etwa nach einem Absturz vor der
    Duplikat-Prüfung), gelten immer als betroffen. Bei bereits bewerteten Posts ohne
    vollständige Abdeckung wird nur das Abdeckungs-Flag nachgezogen, falls die Lücke
    inzwischen geschlossen ist.
    """
    fenster_tage = konfig.erfassung.duplikat_fenster_tage
    fenster_s = fenster_tage * 86400.0

    posts: list[_Post] = []
    zu_pruefen: set[int] = set()
    if betroffene_ids is None:
        posts, unlesbar = _lade_posts(con, None, None)
        zu_pruefen = set(range(len(posts)))
    else:
        ausloeser, unlesbar = _ausloeser(con, betroffene_ids)
        if ausloeser:
            zeiten = [t for t, _ in ausloeser.values()]
            von = _utc_text(math.floor(min(zeiten) - fenster_s))
            bis = _utc_text(math.ceil(max(zeiten) + fenster_s))
            posts, unlesbar_im_zeitraum = _lade_posts(con, von, bis)
            unlesbar |= unlesbar_im_zeitraum
            zu_pruefen = _im_einflussbereich(posts, ausloeser, fenster_s)
    for post_id in sorted(unlesbar):
        log.warning("Post %s: Erstellzeit nicht lesbar, Duplikat-Prüfung übersprungen", post_id)

    ergebnis = _Vergleich(posts, fenster_s, konfig.duplikate).bewerte(zu_pruefen)

    bereiche = db.abdeckung_lesen(con)
    jetzt_text = zeit.utc_text(jetzt)
    je_art = {art: 0 for art in DUP_ARTEN}
    dup_zeilen: list[tuple[str, str, str, int, int, str]] = []
    post_zeilen: list[tuple[str | None, int, str]] = []
    mit_duplikat = 0
    for i in sorted(ergebnis):
        p = posts[i]
        treffer = ergebnis[i]
        for rang, tr in enumerate(treffer):
            details = json.dumps(tr.details, sort_keys=True)
            dup_zeilen.append((p.id, tr.art, tr.frueher.id, p.t - tr.frueher.t, int(rang == 0), details))
            je_art[tr.art] += 1
        if treffer:
            mit_duplikat += 1
        vollstaendig = p.medien_vollstaendig and _abgedeckt(bereiche, p.t, fenster_tage, int(p.id))
        post_zeilen.append((jetzt_text, int(vollstaendig), p.id))
    post_zeilen += [(jetzt_text, 0, post_id) for post_id in sorted(unlesbar)]

    nachgetragen = _abdeckung_nachtragen(con, bereiche, fenster_tage, {z[2] for z in post_zeilen})

    with con:
        con.executemany("DELETE FROM duplikate WHERE post_id = ?", [(z[2],) for z in post_zeilen])
        con.executemany(
            """INSERT INTO duplikate (post_id, art, frueherer_post_id, abstand_s, primaer, details)
               VALUES (?, ?, ?, ?, ?, ?)""",
            dup_zeilen,
        )
        con.executemany(
            "UPDATE posts SET dup_geprueft_utc = ?, dup_abdeckung_vollstaendig = ? WHERE id = ?", post_zeilen
        )
        con.executemany("UPDATE posts SET dup_abdeckung_vollstaendig = 1 WHERE id = ?", [(i,) for i in nachgetragen])

    log.info(
        "Duplikat-Prüfung: %d Posts geprüft, %d mit Duplikat, Abdeckung bei %d Posts nachgetragen",
        len(ergebnis), mit_duplikat, len(nachgetragen),
    )
    return DupBericht(geprueft=len(ergebnis), mit_duplikat=mit_duplikat, je_art=je_art)


def duplikat_uebersicht(con: sqlite3.Connection) -> list[dict[str, Any]]:
    """Je bewertetem Post (zeitlich sortiert) die stärkste Duplikat-Art und alle gefundenen Arten.

    Nur Metadaten: IDs, Zeit, Typ, Art, Abstand und ob das Fenster vollständig vorlag.
    """
    arten: dict[str, list[str]] = defaultdict(list)
    for z in con.execute("SELECT post_id, art FROM duplikate"):
        arten[z["post_id"]].append(z["art"])
    rang = {art: i for i, art in enumerate(DUP_ARTEN)}
    zeilen = con.execute(
        """SELECT p.id, p.created_at_utc, p.typ, p.typ_detail, p.dup_abdeckung_vollstaendig,
                  d.art, d.frueherer_post_id, d.abstand_s, d.details
           FROM posts p LEFT JOIN duplikate d ON d.post_id = p.id AND d.primaer = 1
           WHERE p.dup_geprueft_utc IS NOT NULL
           ORDER BY p.created_at_utc, p.id_num"""
    ).fetchall()
    return [
        {
            "post_id": z["id"],
            "created_at_utc": z["created_at_utc"],
            "typ": z["typ"],
            "typ_detail": z["typ_detail"],
            "duplikat": z["art"] is not None,
            "art": z["art"],
            "arten": sorted(arten.get(z["id"], []), key=lambda a: rang.get(a, len(rang))),
            "frueherer_post_id": z["frueherer_post_id"],
            "abstand_s": z["abstand_s"],
            "details": json.loads(z["details"]) if z["details"] else {},
            "abdeckung_vollstaendig": None if z["dup_abdeckung_vollstaendig"] is None
            else bool(z["dup_abdeckung_vollstaendig"]),
        }
        for z in zeilen
    ]


# ---------------------------------------------------------------------------
# Laden


_POST_SPALTEN = """id, id_num, created_at_utc, original_id, text_hash, medien_hash, medien_vollstaendig,
    fingerabdruck, quote_id, n_bilder + n_videos + n_gifs + n_audio + n_sonstige_medien AS n_medien"""


def _sekunden(utc_text: object) -> int | None:
    """Sekunden seit 1970; ``None``, wenn der Text kein kanonischer UTC-Zeitpunkt ab 1970 ist.

    Nur die kanonische Form sortiert als Text wie die Zeit selbst; darauf beruhen die
    Zeitfilter und die Sortierung in SQL.
    """
    try:
        dt = zeit.parse_utc(utc_text)
    except (OverflowError, ValueError):
        return None
    if dt is None or dt < _EPOCHE or zeit.utc_text(dt) != utc_text:
        return None
    return (dt - _EPOCHE) // timedelta(seconds=1)


def _zeitpunkt(sekunden: int) -> datetime:
    """Über ``timedelta`` statt ``datetime.fromtimestamp``: Das wirft unter Windows bei negativen Werten."""
    return _EPOCHE + timedelta(seconds=min(max(sekunden, 0), _LETZTE_SEKUNDE))


def _utc_text(sekunden: int) -> str:
    """UTC-Text für Zeitfilter, begrenzt auf 1970 bis Ende 9999 (früher liegt kein lesbarer Post)."""
    return cast(str, zeit.utc_text(_zeitpunkt(sekunden)))


def _zeitfilter(spalte: str, von: str | None, bis: str | None) -> tuple[str, list[str]]:
    teile, parameter = [], []
    if von is not None:
        teile.append(f"{spalte} >= ?")
        parameter.append(von)
    if bis is not None:
        teile.append(f"{spalte} <= ?")
        parameter.append(bis)
    return ("WHERE " + " AND ".join(teile)) if teile else "", parameter


def _phash_int(wert: object) -> int | None:
    if not isinstance(wert, str) or len(wert) != PHASH_BITS // 4:
        return None
    try:
        return int(wert, 16)
    except ValueError:
        return None


def _lade_posts(con: sqlite3.Connection, von: str | None, bis: str | None) -> tuple[list[_Post], set[str]]:
    """Posts im Zeitraum (Grenzen als UTC-Text, inklusive), sortiert nach Zeit und ID.

    Dazu die IDs der Posts im Zeitraum, deren Erstellzeit nicht lesbar ist.
    """
    filter_posts, parameter = _zeitfilter("created_at_utc", von, bis)
    posts: list[_Post] = []
    unlesbar: set[str] = set()
    for z in con.execute(
        f"SELECT {_POST_SPALTEN} FROM posts {filter_posts} ORDER BY created_at_utc, id_num", parameter
    ):
        t = _sekunden(z["created_at_utc"])
        if t is None:
            unlesbar.add(z["id"])
            continue
        posts.append(_Post(
            id=z["id"],
            id_num=int(z["id_num"]),
            t=t,
            inhalts_id=z["original_id"] or z["id"],
            text_hash=z["text_hash"],
            medien_hash=z["medien_hash"],
            medien_vollstaendig=bool(z["medien_vollstaendig"]),
            fingerabdruck=z["fingerabdruck"],
            quote_id=z["quote_id"],
            n_medien=int(z["n_medien"]),
        ))
    filter_medien, parameter = _zeitfilter("p.created_at_utc", von, bis)
    medien_je_post: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for z in con.execute(
        f"""SELECT m.post_id, m.medien_id, m.art, m.phash, m.breite, m.hoehe, m.dauer_s, m.hash_status
            FROM medien m JOIN posts p ON p.id = m.post_id {filter_medien}
            ORDER BY m.post_id, m.position""",
        parameter,
    ):
        medien_je_post[z["post_id"]].append(z)
    for p in posts:
        zeilen = medien_je_post.get(p.id)
        if zeilen and any(z["hash_status"] == HASH_UEBERSPRUNGEN and not z["medien_id"] for z in zeilen):
            p.medien_hash = p.fingerabdruck = None
            p.medien_vollstaendig = False
            continue
        if not zeilen or not p.medien_vollstaendig or len(zeilen) != p.n_medien:
            continue
        medien = []
        for z in zeilen:
            phash = _phash_int(z["phash"]) if z["hash_status"] == HASH_OK else None
            if phash is None:
                break
            medien.append(_Medium(z["art"], phash, z["breite"], z["hoehe"], z["dauer_s"]))
        else:
            p.medien = medien
            p.signatur = tuple(sorted(m.art for m in medien))
    return posts, unlesbar


def _ausloeser(
    con: sqlite3.Connection, betroffene_ids: Iterable[str]
) -> tuple[dict[str, tuple[int, int]], set[str]]:
    """Betroffene und noch nie bewertete Posts: ID → (Zeit in Sekunden, numerische ID).

    Dazu die IDs dieser Posts, deren Erstellzeit nicht lesbar ist.
    """
    ids = sorted({str(i) for i in betroffene_ids})
    zeilen: list[sqlite3.Row] = []
    for start in range(0, len(ids), _IN_STUECK):
        stueck = ids[start:start + _IN_STUECK]
        zeilen += con.execute(
            f"SELECT id, id_num, created_at_utc FROM posts WHERE id IN ({', '.join('?' * len(stueck))})", stueck
        ).fetchall()
    zeilen += con.execute("SELECT id, id_num, created_at_utc FROM posts WHERE dup_geprueft_utc IS NULL").fetchall()
    ausloeser: dict[str, tuple[int, int]] = {}
    unlesbar: set[str] = set()
    for z in zeilen:
        t = _sekunden(z["created_at_utc"])
        if t is None:
            unlesbar.add(z["id"])
        else:
            ausloeser[z["id"]] = (t, int(z["id_num"]))
    return ausloeser, unlesbar


def _im_einflussbereich(posts: list[_Post], ausloeser: dict[str, tuple[int, int]], fenster_s: float) -> set[int]:
    """Indizes der Posts, die selbst Auslöser sind oder einen Auslöser in ihrem Fenster haben."""
    schluessel = sorted(ausloeser.values())
    ergebnis = set()
    for i, p in enumerate(posts):
        if p.id in ausloeser:
            ergebnis.add(i)
            continue
        # Der späteste Auslöser, der noch vor P liegt, ist der mit dem kleinsten Abstand.
        k = bisect.bisect_left(schluessel, (p.t, p.id_num))
        if k and p.t - schluessel[k - 1][0] <= fenster_s:
            ergebnis.add(i)
    return ergebnis


# ---------------------------------------------------------------------------
# Abdeckung


def _abgedeckt(bereiche: list[db.Bereich], t: int, fenster_tage: float, post_id: int | None = None) -> bool:
    """Wie ``db.abdeckung_vollstaendig(con, P.t − Fenster, P.t)``, aber mit einmal gelesenen Bereichen.

    Mit ``post_id`` endet das Fenster spätestens beim Post selbst: Frühere Posts haben kleinere IDs,
    und die Abdeckung reicht oben nur bis zur größten gesehenen ID (nicht bis zur Uhrzeit des Laufs).
    """
    bis = _zeitpunkt(t)
    von = bis - timedelta(days=fenster_tage)
    unten, oben = zeit.id_untergrenze(von), zeit.id_obergrenze(bis)
    if post_id is not None:
        oben = min(oben, post_id)
    return any((0 if b.anfang_erreicht else b.von) <= unten and b.bis >= oben for b in bereiche)


def _abdeckung_nachtragen(
    con: sqlite3.Connection, bereiche: list[db.Bereich], fenster_tage: float, ausgenommen: set[str]
) -> list[str]:
    """Bewertete, vollständig gehashte Posts mit Flag 0, deren Fenster inzwischen lückenlos abgerufen ist.

    Hat ein Lauf eine Lücke ohne neue Posts geschlossen, ändern sich keine Duplikate, nur
    die Aussage, ob das Fenster vollständig war. Das Flag kann deshalb ohne Neubewertung
    nachgezogen werden.
    """
    if not bereiche:
        return []
    ergebnis = []
    for z in con.execute(
        f"""SELECT id, created_at_utc FROM posts
            WHERE dup_abdeckung_vollstaendig = 0 AND dup_geprueft_utc IS NOT NULL AND medien_vollstaendig = 1
              AND NOT EXISTS (SELECT 1 FROM medien m WHERE m.post_id = posts.id AND {_OHNE_SCHLUESSEL})""",
        (HASH_UEBERSPRUNGEN,),
    ).fetchall():
        if z["id"] in ausgenommen:
            continue
        t = _sekunden(z["created_at_utc"])
        if t is not None and _abgedeckt(bereiche, t, fenster_tage, int(z["id"])):
            ergebnis.append(z["id"])
    return ergebnis


# ---------------------------------------------------------------------------
# Vergleich


def _bloecke(max_abstand: int) -> list[tuple[int, int]]:
    """(Verschiebung, Maske) der ``max_abstand + 1`` Blöcke, die zusammen alle 64 Bit abdecken."""
    anzahl = min(max_abstand + 1, PHASH_BITS)
    basis, rest = divmod(PHASH_BITS, anzahl)
    bloecke, verschiebung = [], 0
    for k in range(anzahl):
        breite = basis + (1 if k < rest else 0)
        bloecke.append((verschiebung, (1 << breite) - 1))
        verschiebung += breite
    return bloecke


def _medien_passen(a: _Medium, b: _Medium, dk: DuplikatKonfig) -> bool:
    """Dauer (Video/GIF) und Seitenverhältnis, jeweils nur, wenn beide Seiten bekannt sind."""
    if a.art in (MEDIUM_VIDEO, MEDIUM_GIF) and a.dauer_s is not None and b.dauer_s is not None:
        if abs(a.dauer_s - b.dauer_s) > dk.dauer_toleranz_s + _EPS:
            return False
    if a.breite and a.hoehe and b.breite and b.hoehe and min(a.breite, a.hoehe, b.breite, b.hoehe) > 0:
        ra, rb = a.breite / a.hoehe, b.breite / b.hoehe
        if max(ra, rb) / min(ra, rb) - 1.0 > dk.seitenverhaeltnis_toleranz + _EPS:
            return False
    return True


def _zuordnung_moeglich(kanten: list[list[tuple[int, int]]], schwelle: int) -> bool:
    """Gibt es eine 1:1-Zuordnung, die nur Kanten mit Abstand ≤ Schwelle nutzt? (Augmentierende Pfade)"""
    partner: dict[int, int] = {}  # Medium von Q → Medium von P

    def versuche(i: int, besucht: set[int]) -> bool:
        for abstand, j in kanten[i]:
            if abstand > schwelle or j in besucht:
                continue
            besucht.add(j)
            if j not in partner or versuche(partner[j], besucht):
                partner[j] = i
                return True
        return False

    return all(versuche(i, set()) for i in range(len(kanten)))


def _medien_zuordnung(p_medien: list[_Medium], q_medien: list[_Medium], dk: DuplikatKonfig) -> int | None:
    """Kleinstmöglicher größter pHash-Abstand einer gültigen 1:1-Zuordnung; ``None``, wenn es keine gibt."""
    if len(p_medien) != len(q_medien) or not p_medien:
        return None
    kanten: list[list[tuple[int, int]]] = []
    for a in p_medien:
        moegliche = []
        for j, b in enumerate(q_medien):
            if a.art != b.art:
                continue
            abstand = (a.phash ^ b.phash).bit_count()
            if abstand <= dk.phash_max_abstand and _medien_passen(a, b, dk):
                moegliche.append((abstand, j))
        if not moegliche:
            return None
        moegliche.sort()
        kanten.append(moegliche)
    untergrenze = max(m[0][0] for m in kanten)
    for schwelle in sorted({abstand for m in kanten for abstand, _ in m if abstand >= untergrenze}):
        if _zuordnung_moeglich(kanten, schwelle):
            return schwelle
    return None


_Pruefung = Callable[[_Post, _Post], dict[str, Any] | None]
_Fund = tuple[_Post, dict[str, Any]]


def _exakt(p: _Post, q: _Post) -> dict[str, Any] | None:
    return {} if q.inhalts_id != p.inhalts_id else None


def _nur_text(p: _Post, q: _Post) -> dict[str, Any] | None:
    if q.inhalts_id == p.inhalts_id:
        return None
    if p.medien_vollstaendig and q.medien_vollstaendig:
        medien_verschieden: bool | None = p.medien_hash != q.medien_hash
    elif p.n_medien != q.n_medien:
        medien_verschieden = True
    else:
        medien_verschieden = None  # Hashes fehlen, gleiche Zahl: ob die Medien gleich sind, ist offen
    if medien_verschieden:
        return {}
    if p.quote_id == q.quote_id:
        return None
    if medien_verschieden is False and p.medien_hash is not None:
        return {"quote_verschieden": True, "medien_gleich": True}
    return {"quote_verschieden": True}


def _nur_medien(p: _Post, q: _Post) -> dict[str, Any] | None:
    if q.inhalts_id == p.inhalts_id or not q.medien_vollstaendig:
        return None
    if p.text_hash != q.text_hash:
        return {}
    # Gleicher nicht leerer Text mit gleichen Medien gehört zu nur_text ("medien_gleich").
    if p.text_hash is None and p.quote_id != q.quote_id:
        return {"quote_verschieden": True}
    return None


class _Vergleich:
    """Ein Durchlauf in Zeitreihenfolge; die Indizes enthalten immer nur frühere Posts."""

    def __init__(self, posts: list[_Post], fenster_s: float, dk: DuplikatKonfig) -> None:
        self.posts = posts
        self.fenster_s = fenster_s
        self.dk = dk
        self.bloecke = _bloecke(dk.phash_max_abstand)
        self.nach_inhalt: dict[str, int] = {}
        self.nach_fingerabdruck: dict[str, list[int]] = defaultdict(list)
        self.nach_text: dict[str, list[int]] = defaultdict(list)
        self.nach_medien: dict[str, list[int]] = defaultdict(list)
        self.schubfaecher: dict[tuple[tuple[str, ...], int, int], list[int]] = defaultdict(list)

    def bewerte(self, zu_pruefen: set[int]) -> dict[int, list[_Treffer]]:
        ergebnis = {}
        for i, p in enumerate(self.posts):
            if i in zu_pruefen:
                ergebnis[i] = self._suche(p)
            self._einordnen(i, p)
        return ergebnis

    def _einordnen(self, i: int, p: _Post) -> None:
        self.nach_inhalt[p.inhalts_id] = i
        if p.fingerabdruck:
            self.nach_fingerabdruck[p.fingerabdruck].append(i)
        if p.text_hash:
            self.nach_text[p.text_hash].append(i)
        if p.medien_hash and p.medien_vollstaendig:
            self.nach_medien[p.medien_hash].append(i)
        if p.signatur and p.medien:
            faecher = {
                (p.signatur, k, (m.phash >> verschiebung) & maske)
                for m in p.medien
                for k, (verschiebung, maske) in enumerate(self.bloecke)
            }
            for fach in faecher:
                self.schubfaecher[fach].append(i)

    def _im_fenster(self, p: _Post, q: _Post) -> bool:
        return p.t - q.t <= self.fenster_s

    def _naechster(self, kandidaten: list[int] | None, p: _Post, pruefung: _Pruefung) -> _Fund | None:
        if not kandidaten:
            return None
        for j in reversed(kandidaten):
            q = self.posts[j]
            if not self._im_fenster(p, q):
                return None
            details = pruefung(p, q)
            if details is not None:
                return q, details
        return None

    def _suche(self, p: _Post) -> list[_Treffer]:
        """Treffer je Kategorie, stärkste zuerst."""
        funde: list[tuple[str, _Fund | None]] = []
        j = self.nach_inhalt.get(p.inhalts_id)
        if j is not None and self._im_fenster(p, self.posts[j]):
            funde.append((DUP_GLEICHES_ORIGINAL, (self.posts[j], {})))
        if p.medien_vollstaendig and p.fingerabdruck:
            funde.append((DUP_EXAKT, self._naechster(self.nach_fingerabdruck.get(p.fingerabdruck), p, _exakt)))
        if p.text_hash:
            fund = self._naechster(self.nach_text.get(p.text_hash), p, _nur_text)
            funde.append((DUP_NUR_TEXT, self._mit_aehnlichkeit(p, fund) if fund else None))
        if p.medien_vollstaendig and p.medien_hash:
            funde.append((DUP_NUR_MEDIEN, self._naechster(self.nach_medien.get(p.medien_hash), p, _nur_medien)))
        if p.medien_vollstaendig and p.signatur and p.medien:
            funde.append((DUP_MEDIEN_AEHNLICH, self._aehnlichste(p, p.medien, p.signatur)))
        return [_Treffer(art, *fund) for art, fund in funde if fund is not None]

    def _mit_aehnlichkeit(self, p: _Post, fund: _Fund) -> _Fund:
        """Text-Treffer: Sind die Medien desselben Paars wahrscheinlich gleich (Fall 4), steht das in den Details."""
        q, details = fund
        if p.medien is None or q.medien is None or p.medien_hash == q.medien_hash:
            return fund
        abstand = _medien_zuordnung(p.medien, q.medien, self.dk)
        if abstand is None:
            return fund
        return q, {**details, "medien_aehnlich": True, "phash_abstand_max": abstand}

    def _aehnlichste(self, p: _Post, medien: list[_Medium], signatur: tuple[str, ...]) -> _Fund | None:
        erstes = medien[0]
        kandidaten: set[int] = set()
        # Das Gegenstück des ersten Mediums stimmt in mindestens einem Block überein.
        for k, (verschiebung, maske) in enumerate(self.bloecke):
            fach = self.schubfaecher.get((signatur, k, (erstes.phash >> verschiebung) & maske))
            if not fach:
                continue
            for j in reversed(fach):
                if not self._im_fenster(p, self.posts[j]):
                    break
                kandidaten.add(j)
        for j in sorted(kandidaten, reverse=True):
            q = self.posts[j]
            if q.inhalts_id == p.inhalts_id or q.medien is None:
                continue
            if p.medien_hash is not None and p.medien_hash == q.medien_hash:
                continue
            abstand = _medien_zuordnung(medien, q.medien, self.dk)
            if abstand is not None:
                return q, {"phash_abstand_max": abstand}
        return None
