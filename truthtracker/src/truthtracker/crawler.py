"""Ein Crawl-Lauf: Konto-Snapshot → Posts holen → Snapshots → Duplikate → Löschungen → Protokoll.

Ablauf (Regeln in docs/architektur.md):

1. Konto nachschlagen, Follower/Following/Postzahl als Snapshot speichern.
2. Liste der gepinnten Posts holen. Gepinnte Posts werden gespeichert, zählen aber nicht für
   die Entscheidung, wie weit paginiert wird.
3. Timeline von oben nach unten paginieren, bis der zuletzt bekannte Bereich erreicht ist
   (Überlappung) *und* die letzten N Tage (Lösch-Fenster) abgedeckt sind; beim ersten Lauf
   bis zur Backfill-Grenze. Danach Lücken zwischen bekannten Bereichen füllen. Jede Seite
   wird sofort gespeichert, inklusive Engagement-Snapshot nach der 24h-Regel.
4. Posts mit fehlgeschlagenen Medien-Hashes im Duplikat-Fenster einzeln nachladen.
5. Duplikate für neue und geänderte Posts neu bewerten.
6. Bekannte Posts der letzten N Tage, die im lückenlos abgerufenen Bereich fehlen, einzeln
   prüfen; nur 404 mit JSON-Fehler gilt als gelöscht. Edits erkennt schon Schritt 3.
7. Laufprotokoll schreiben.

Bricht der Zugriff ab (Challenge, Block, 429), werden keine Anfragen mehr gestellt; was bis
dahin gespeichert ist, bleibt, und die lokalen Schritte (Duplikate, Einfrieren, Protokoll)
laufen trotzdem.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from truthtracker import cloudflare, db, duplikate, klassifikation, medien, temp, zeit
from truthtracker.db import Bereich, LaufZaehler
from truthtracker.konfig import Konfig
from truthtracker.modelle import TYP_EIGEN, REPLY_FREMD, PostDaten
from truthtracker.transport import Abbruch, Transport, TransportFehler, erstelle_transport

log = logging.getLogger(__name__)

TransportFabrik = Callable[[Konfig, LaufZaehler], Transport]

# Wie lange das Ergebnis "Replies an andere gehen ohne Login nicht" gilt, bevor erneut probiert wird.
REPLIES_PROBE_GUELTIG = timedelta(days=7)
_WIEDERHOLBAR = frozenset({cloudflare.NETZWERKFEHLER, cloudflare.SERVERFEHLER})


class LaufFehler(RuntimeError):
    """Der Lauf kann nicht sinnvoll weitergehen; die Meldung ist für Menschen gedacht."""


@dataclass
class LaufErgebnis:
    lauf_id: int
    status: str
    abbruch_grund: str | None
    zugriff: str | None
    zaehler: LaufZaehler
    meldungen: list[str]
    dauer_s: float
    duplikate: duplikate.DupBericht | None = None


def _zahl(wert: Any) -> int | None:
    if isinstance(wert, bool) or not isinstance(wert, int) or wert < 0:
        return None
    return wert


@dataclass
class _Lauf:
    konfig: Konfig
    con: sqlite3.Connection
    lauf_id: int
    start: datetime
    erster_lauf_start: datetime
    backfill_grenze: datetime
    zaehler: LaufZaehler
    meldungen: list[str]
    uhr: zeit.Uhr
    transport: Transport | None = None
    trump_id: str | None = None
    gepinnte_ids: set[str] | None = None
    gesehen: set[str] = field(default_factory=set)
    betroffene: set[str] = field(default_factory=set)
    bereiche: list[Bereich] = field(default_factory=list)
    einzelabrufe: int = 0
    werbung: int = 0
    exclude_replies: bool = True
    replies_ausgeschlossen: bool = False
    replies_probe_gemerkt: bool = False
    erfasser: medien.MedienErfasser | None = None
    dup_bericht: duplikate.DupBericht | None = None
    dup_erledigt: bool = False

    # -- Hilfen ---------------------------------------------------------------

    def meldung(self, text: str) -> None:
        self.meldungen.append(text)
        log.info(text)

    @property
    def _api(self) -> Transport:
        assert self.transport is not None
        return self.transport

    def _ist_gepinnt(self, status: dict) -> bool:
        sid = str(status.get("id", ""))
        return (self.gepinnte_ids is not None and sid in self.gepinnte_ids) or status.get("pinned") is True

    # -- Ablauf ---------------------------------------------------------------

    def ausfuehren(self) -> None:
        self._konto_snapshot()
        self._erfasser_einrichten()
        self._gepinnte_holen()
        self._paginiere_alles()
        self._medien_nachholen()
        self._duplikate()
        self._loeschpruefung()

    def _erfasser_einrichten(self) -> None:
        con, jetzt = self.con, self.start

        def cache_holen(medien_id: str) -> dict | None:
            zeile = db.medien_cache_holen(con, medien_id)
            return None if zeile is None else {
                "sha256": zeile["sha256"], "phash": zeile["phash"], "hash_quelle": zeile["hash_quelle"],
            }

        def cache_speichern(medien_id: str, art: str, sha256: str, phash: str | None, hash_quelle: str) -> None:
            db.medien_cache_speichern(con, medien_id, art, sha256, phash, hash_quelle, jetzt)

        self.erfasser = medien.MedienErfasser(
            self._api.hole_bytes, cache_holen=cache_holen, cache_speichern=cache_speichern
        )

    def _konto_snapshot(self) -> None:
        handle = self.konfig.konto.handle
        gespeichert = db.meta_lesen(self.con, "konto_id")
        bew = self._api.hole_json("/api/v1/accounts/lookup", {"acct": handle})
        daten = bew.daten if bew.ok and isinstance(bew.daten, dict) else None
        if daten and str(daten.get("id", "")).isdigit():
            self.trump_id = str(daten["id"])
            with self.con:
                db.meta_schreiben(self.con, "konto_id", self.trump_id)
            db.konto_snapshot_speichern(
                self.con, self.lauf_id, self.trump_id, self.uhr(),
                follower=_zahl(daten.get("followers_count")),
                folgt=_zahl(daten.get("following_count")),
                posts_gesamt=_zahl(daten.get("statuses_count")),
            )
            log.info("Konto-Snapshot gespeichert (Konto %s)", self.trump_id)
        elif gespeichert:
            self.trump_id = gespeichert
            self.zaehler.fehler += 1
            self.meldung(f"Konto-Abfrage fehlgeschlagen ({cloudflare.melde(bew)}); kein Konto-Snapshot in diesem Lauf.")
        else:
            raise LaufFehler(f"Das Konto @{handle} ließ sich nicht abrufen: {cloudflare.melde(bew)}")

    def _gepinnte_holen(self) -> None:
        bew = self._api.hole_json(f"/api/v1/accounts/{self.trump_id}/statuses", {"pinned": "true", "with_muted": "true"})
        if not bew.ok or not isinstance(bew.daten, list):
            self.zaehler.fehler += 1
            self.meldung(f"Gepinnte Posts nicht abrufbar ({cloudflare.melde(bew)}); Gepinnt-Status bleibt unverändert.")
            return
        posts = [p for p in bew.daten if isinstance(p, dict) and str(p.get("id", "")).isdigit()]
        self.gepinnte_ids = {str(p["id"]) for p in posts if not klassifikation.ist_werbung(p, self.trump_id)}
        db.gepinnt_setzen(self.con, self.gepinnte_ids)
        jetzt = self.uhr()
        for status in posts:
            self._verarbeite(status, jetzt)

    # -- Posts verarbeiten ----------------------------------------------------

    def _verarbeite(self, status: dict, gesehen_um: datetime) -> PostDaten | None:
        if klassifikation.ist_werbung(status, self.trump_id):
            self.werbung += 1
            return None
        try:
            post = klassifikation.extrahiere(
                status, trump_id=self.trump_id, medien=self.erfasser, gepinnte_ids=self.gepinnte_ids,
                basis_url=self.konfig.basis_url,
            )
        except ValueError as fehler:
            self.zaehler.fehler += 1
            self.meldung(f"Ein Post ließ sich nicht auswerten: {fehler}")
            return None
        grenze_h = self.konfig.erfassung.snapshot_grenze_h
        backfill = (
            post.created_at < self.erster_lauf_start
            and zeit.alter_in_stunden(post.created_at, gesehen_um) >= grenze_h
        )
        ergebnis = db.post_speichern(self.con, post, lauf_id=self.lauf_id, gesehen=gesehen_um, backfill=backfill)
        if ergebnis.neu:
            self.zaehler.neue_posts += 1
            self.betroffene.add(post.id)
        elif ergebnis.geaendert or ergebnis.edit_erkannt:
            if post.id not in self.gesehen:
                self.zaehler.aktualisierte_posts += 1
            self.betroffene.add(post.id)
        if ergebnis.edit_erkannt:
            self.zaehler.edits_erkannt += 1
            log.info("Edit erkannt: Post %s", post.id)
        if ergebnis.war_geloescht:
            self.meldung(f"Post {post.id} war als gelöscht markiert und ist wieder sichtbar.")
        if db.snapshot_speichern(self.con, post, lauf_id=self.lauf_id, gemessen=gesehen_um, grenze_h=grenze_h):
            self.zaehler.snapshots += 1
        self.gesehen.add(post.id)
        return post

    # -- Pagination -----------------------------------------------------------

    def _replies_modus_bestimmen(self) -> None:
        modus = self.konfig.zugriff.replies_anderer
        if modus == "aus":
            self.exclude_replies = True
        elif modus == "an":
            self.exclude_replies = False
        else:
            stand = db.meta_lesen(self.con, "replies_anderer_probe") or ""
            ergebnis, _, wann = stand.partition("|")
            zuletzt = zeit.parse_utc(wann)
            kuerzlich = zuletzt is not None and self.start - zuletzt < REPLIES_PROBE_GUELTIG
            self.exclude_replies = ergebnis == "0" and kuerzlich

    def _merke_replies_probe(self, verfuegbar: bool) -> None:
        with self.con:
            db.meta_schreiben(self.con, "replies_anderer_probe", f"{int(verfuegbar)}|{zeit.utc_text(self.uhr())}")

    def _hole_seite(self, max_id: int | None) -> tuple[list[dict] | None, cloudflare.Bewertung]:
        versuche = 0
        while True:
            params: dict[str, Any] = {
                "exclude_replies": "true" if self.exclude_replies else "false",
                "with_muted": "true",
                "limit": self.konfig.zugriff.seitengroesse,
            }
            if max_id is not None:
                params["max_id"] = str(max_id)
            bew = self._api.hole_json(f"/api/v1/accounts/{self.trump_id}/statuses", params)
            if bew.art == cloudflare.LOGIN_NOETIG and not self.exclude_replies:
                self.exclude_replies = True
                self._merke_replies_probe(False)
                self.meldung("Antworten an andere sind ohne Login nicht abrufbar; die Timeline läuft ohne sie.")
                continue
            if bew.art in _WIEDERHOLBAR and versuche == 0:
                versuche += 1
                continue
            if not bew.ok or not isinstance(bew.daten, list):
                return None, bew
            if not self.exclude_replies and not self.replies_probe_gemerkt:
                self._merke_replies_probe(True)
                self.replies_probe_gemerkt = True
            if self.exclude_replies:
                self.replies_ausgeschlossen = True
            return [p for p in bew.daten if isinstance(p, dict)], bew

    def _reihenfolge_posts(self, posts: list[dict], max_id: int | None) -> list[dict]:
        """Posts, die für die Stopp-Entscheidung zählen.

        Auf der ersten Seite (ohne ``max_id``) können gepinnte Posts außer der Reihe oben
        stehen; sie zählen dort nicht. Auf Folgeseiten hat der Server nach ``id < max_id``
        gefiltert, dort steht ein gepinnter Post an seiner zeitlichen Stelle und zählt mit.
        Werbung zählt nie.
        """
        kandidaten = [
            p for p in posts
            if str(p.get("id", "")).isdigit() and not klassifikation.ist_werbung(p, self.trump_id)
        ]
        if max_id is not None:
            return [p for p in kandidaten if int(p["id"]) < max_id]
        kandidaten = [p for p in kandidaten if not self._ist_gepinnt(p)]
        # Zusätzliche Sicherung, falls die Liste der gepinnten Posts fehlt: Auf Seite 1 zählt ein Post
        # nur, wenn seine ID größer ist als alle folgenden. Ein alter Post, der außer der Reihe oben
        # steht, fällt dadurch heraus.
        ergebnis: list[dict] = []
        groesste_folgende = -1
        for p in reversed(kandidaten):
            sid = int(p["id"])
            if sid > groesste_folgende:
                ergebnis.append(p)
            groesste_folgende = max(groesste_folgende, sid)
        ergebnis.reverse()
        return ergebnis

    def _segment(self, start_max_id: int | None, untergrenze: int) -> bool:
        """Paginiert ab ``start_max_id`` (``None`` = ganz oben) bis zur ID-Untergrenze.

        Die Abdeckung wird auch bei einem Abbruch mitten im Segment gespeichert, und zwar
        genau bis zur letzten vollständig verarbeiteten Seite. Gibt zurück, ob Abdeckung
        hinzugekommen ist.
        """
        oben = zeit.id_obergrenze(self.uhr()) if start_max_id is None else start_max_id - 1
        tiefste: int | None = None
        anfang_erreicht = False
        max_id = start_max_id
        try:
            while True:
                if self.zaehler.seiten >= self.konfig.erfassung.max_seiten_pro_lauf:
                    self.meldung("Höchstzahl an Seiten pro Lauf erreicht; der Rest folgt im nächsten Lauf.")
                    break
                gemessen = self.uhr()
                posts, bew = self._hole_seite(max_id)
                if posts is None:
                    self.zaehler.fehler += 1
                    self.meldung(f"Timeline-Seite nicht abrufbar ({cloudflare.melde(bew)}); die Abdeckung endet hier.")
                    break
                self.zaehler.seiten += 1
                if not posts:
                    anfang_erreicht = True
                    break
                normale = self._reihenfolge_posts(posts, max_id)
                for status in posts:
                    self._verarbeite(status, gemessen)
                if not normale:
                    self.zaehler.fehler += 1
                    self.meldung("Eine Timeline-Seite brachte keine älteren Posts; Pagination hier beendet.")
                    break
                seiten_min = min(int(p["id"]) for p in normale)
                tiefste = seiten_min
                if start_max_id is None and max_id is None:
                    # Geht die Uhr des PCs nach, liegen die neuesten IDs über der aus der Uhrzeit berechneten Grenze.
                    oben = max(oben, max(int(p["id"]) for p in normale))
                if seiten_min <= untergrenze:
                    break
                max_id = seiten_min
        finally:
            if anfang_erreicht or tiefste is not None:
                bereich = Bereich(0 if anfang_erreicht else tiefste, oben, anfang_erreicht)
                db.abdeckung_hinzufuegen(self.con, bereich)
                self.bereiche.append(bereich)
        return anfang_erreicht or tiefste is not None

    def _paginiere_alles(self) -> None:
        self._replies_modus_bestimmen()
        loesch_id = zeit.id_untergrenze(self.start - timedelta(days=self.konfig.erfassung.loeschpruefung_tage))
        backfill_id = zeit.id_untergrenze(self.backfill_grenze)
        bereiche = db.abdeckung_lesen(self.con)
        ziel = min(loesch_id, bereiche[0].bis) if bereiche else backfill_id
        self._segment(None, max(ziel, backfill_id))

        # Lücken zwischen bekannten Bereichen und bis zur Backfill-Grenze schließen.
        for _ in range(1000):
            luecke = _naechste_luecke(db.abdeckung_lesen(self.con), backfill_id)
            if luecke is None:
                break
            start_max_id, untergrenze = luecke
            log.info("Fülle Lücke unterhalb von ID %s", start_max_id)
            if not self._segment(start_max_id, untergrenze):
                break
        if self.replies_ausgeschlossen:
            log.info("Timeline ohne Antworten an andere abgerufen (exclude_replies=true)")

    # -- Einzelabrufe ---------------------------------------------------------

    def _budget(self) -> int:
        return max(0, self.konfig.erfassung.max_einzelabrufe_pro_lauf - self.einzelabrufe)

    def _medien_nachholen(self) -> None:
        seit = self.start - timedelta(days=self.konfig.erfassung.duplikat_fenster_tage)
        # Die Löschprüfung hat Vorrang; höchstens die Hälfte des Budgets für Medien.
        anteil = self._budget() // 2
        offene = [i for i in db.posts_ohne_vollstaendige_medien(self.con, seit, anteil + 50) if i not in self.gesehen]
        for post_id in offene[:anteil]:
            bew = self._api.hole_json(f"/api/v1/statuses/{post_id}")
            self.einzelabrufe += 1
            if bew.ok and isinstance(bew.daten, dict) and str(bew.daten.get("id")) == post_id:
                self._verarbeite(bew.daten, self.uhr())

    def _duplikate(self) -> None:
        if self.dup_erledigt:
            return
        self.dup_erledigt = True
        if not self.betroffene:
            return
        self.dup_bericht = duplikate.aktualisiere_duplikate(
            self.con, self.konfig, betroffene_ids=self.betroffene, jetzt=self.uhr()
        )

    def _loeschpruefung(self) -> None:
        if not self.bereiche:
            self.meldung("Kein lückenlos abgerufener Bereich; die Löschprüfung entfällt in diesem Lauf.")
            return
        seit = self.start - timedelta(days=self.konfig.erfassung.loeschpruefung_tage)
        kandidaten: list[str] = []
        for bereich in self.bereiche:
            for post_id in db.kandidaten_fuer_loeschpruefung(
                self.con, von_id=bereich.von, bis_id=bereich.bis, seit=seit, gesehen=self.gesehen
            ):
                if post_id not in kandidaten:
                    kandidaten.append(post_id)
        if self.replies_ausgeschlossen and kandidaten:
            # Antworten an andere fehlen bei exclude_replies=true immer; das ist kein Löschsignal.
            kandidaten = [k for k in kandidaten if not _ist_reply_an_andere(db.post_lesen(self.con, k))]
        budget = self._budget()
        if len(kandidaten) > budget:
            self.meldung(f"{len(kandidaten) - budget} Posts für die Löschprüfung auf den nächsten Lauf verschoben.")
            kandidaten = kandidaten[:budget]
        for post_id in kandidaten:
            jetzt = self.uhr()
            bew = self._api.hole_json(f"/api/v1/statuses/{post_id}")
            self.einzelabrufe += 1
            if bew.art == cloudflare.NICHT_GEFUNDEN:
                db.als_geloescht_markieren(self.con, post_id, jetzt)
                ergebnis = "geloescht"
                self.zaehler.geloescht_erkannt += 1
                log.info("Löschung bestätigt: Post %s", post_id)
            elif bew.ok and isinstance(bew.daten, dict) and str(bew.daten.get("id")) == post_id:
                self._verarbeite(bew.daten, jetzt)
                ergebnis = "vorhanden"
            else:
                db.als_vermisst_markieren(self.con, post_id, jetzt)
                ergebnis = "unklar"
            db.loeschpruefung_protokollieren(self.con, post_id, self.lauf_id, jetzt, ergebnis, bew.art, bew.status)

    # -- Nach dem Lauf (ohne Netz) -------------------------------------------

    def lokale_nacharbeit(self) -> None:
        try:
            self._duplikate()
        except Exception:  # noqa: BLE001 - das Protokoll muss trotzdem geschrieben werden
            self.zaehler.fehler += 1
            log.exception("Duplikat-Prüfung fehlgeschlagen")
            self.meldungen.append("Die Duplikat-Prüfung ist fehlgeschlagen (Details im Log).")
        db.friere_ein(self.con, self.uhr(), self.konfig.erfassung.snapshot_grenze_h)


def _ist_reply_an_andere(zeile: sqlite3.Row | None) -> bool:
    return zeile is not None and zeile["typ"] == TYP_EIGEN and bool(zeile["ist_reply"]) and zeile["reply_art"] == REPLY_FREMD


def _naechste_luecke(bereiche: list[Bereich], backfill_id: int) -> tuple[int, int] | None:
    """Oberste noch offene Lücke oberhalb der Backfill-Grenze als (max_id, Untergrenze)."""
    for oberer, unterer in zip(bereiche, bereiche[1:]):
        if oberer.von > backfill_id and oberer.von > unterer.bis + 1:
            return oberer.von, max(unterer.bis, backfill_id)
    if bereiche:
        unterster = bereiche[-1]
        if not unterster.anfang_erreicht and unterster.von > backfill_id:
            return unterster.von, backfill_id
    return None


def _abgedeckt(bereiche: list[Bereich]) -> tuple[datetime | None, datetime | None]:
    if not bereiche:
        return None, None
    von = min(b.von for b in bereiche)
    bis = max(b.bis for b in bereiche)
    return (zeit.zeit_aus_id(von) if von > 0 else None), zeit.zeit_aus_id(bis)


def fuehre_lauf_aus(
    konfig: Konfig,
    *,
    transport_fabrik: TransportFabrik | None = None,
    uhr: zeit.Uhr = zeit.systemuhr,
    melden: Callable[[str], None] = print,
) -> LaufErgebnis:
    t0 = time.monotonic()
    temp_reste = temp.raeume_temp_auf()
    con = db.oeffne(konfig.datenbank_pfad)
    try:
        start = uhr()
        abgestuerzt = db.markiere_abgestuerzte_laeufe(con, start)
        erster = zeit.parse_utc(db.meta_lesen(con, "erster_lauf_start_utc"))
        backfill_grenze = zeit.parse_utc(db.meta_lesen(con, "backfill_grenze_utc"))
        ist_erster = erster is None
        if erster is None or backfill_grenze is None:
            erster = start
            backfill_grenze = start - timedelta(weeks=konfig.erfassung.backfill_wochen)
            with con:
                db.meta_schreiben(con, "erster_lauf_start_utc", zeit.utc_text(erster))
                db.meta_schreiben(con, "backfill_grenze_utc", zeit.utc_text(backfill_grenze))
        lauf_id = db.lauf_starten(con, start, backfill=ist_erster)
        zaehler = LaufZaehler()
        meldungen: list[str] = []
        lauf = _Lauf(
            konfig=konfig, con=con, lauf_id=lauf_id, start=start, erster_lauf_start=erster,
            backfill_grenze=backfill_grenze, zaehler=zaehler, meldungen=meldungen, uhr=uhr,
        )
        if temp_reste:
            lauf.meldung(f"{len(temp_reste)} Reste im Temp-Ordner ließen sich nicht löschen.")
        if abgestuerzt:
            lauf.meldung(f"{abgestuerzt} früherer Lauf war nicht sauber beendet und ist als abgestürzt markiert.")
        if ist_erster:
            lauf.meldung(f"Erster Lauf: hole Posts bis {konfig.erfassung.backfill_wochen:g} Wochen zurück (Backfill).")
        log.info("Lauf %s gestartet", lauf_id)

        status, grund = "ok", None
        try:
            fabrik = transport_fabrik or (lambda k, z: erstelle_transport(k, z, melden=melden))
            lauf.transport = fabrik(konfig, zaehler)
            lauf.ausfuehren()
        except Abbruch as abbruch:
            status, grund = "abgebrochen", abbruch.bewertung.art
            lauf.meldung(f"Abbruch: {cloudflare.melde(abbruch.bewertung)} Bis dahin Gesammeltes ist gespeichert.")
        except (TransportFehler, LaufFehler) as fehler:
            status, grund = "fehler", type(fehler).__name__
            zaehler.fehler += 1
            lauf.meldung(str(fehler))
        except KeyboardInterrupt:
            status, grund = "abgebrochen", "unterbrochen"
            lauf.meldung("Von Hand abgebrochen. Bis dahin Gesammeltes ist gespeichert.")
        except Exception as fehler:  # noqa: BLE001 - jeder Fehler soll im Protokoll landen
            status, grund = "fehler", type(fehler).__name__
            zaehler.fehler += 1
            log.exception("Unerwarteter Fehler im Lauf")
            lauf.meldungen.append(f"Unerwarteter Fehler ({type(fehler).__name__}); Details im Log.")
        finally:
            zugriff = getattr(lauf.transport, "weg", None)
            if lauf.transport is not None:
                try:
                    lauf.transport.schliessen()
                except Exception:  # noqa: BLE001
                    log.exception("Fehler beim Schließen des Zugriffs")
            lauf.lokale_nacharbeit()
            if lauf.werbung:
                lauf.meldung(f"{lauf.werbung} Werbe-Einträge in der Timeline übersprungen.")
            von, bis = _abgedeckt(lauf.bereiche)
            db.lauf_beenden(
                con, lauf_id, ende=uhr(), status=status, zugriff=zugriff, abbruch_grund=grund, zaehler=zaehler,
                meldungen=meldungen, abgedeckt_von=von, abgedeckt_bis=bis,
            )
            log.info("Lauf %s beendet: %s", lauf_id, status)
        return LaufErgebnis(
            lauf_id=lauf_id, status=status, abbruch_grund=grund, zugriff=zugriff, zaehler=zaehler,
            meldungen=meldungen, dauer_s=time.monotonic() - t0, duplikate=lauf.dup_bericht,
        )
    finally:
        con.close()
        temp.raeume_temp_auf()


def zusammenfassung(ergebnis: LaufErgebnis) -> str:
    z = ergebnis.zaehler
    status = {"ok": "erfolgreich", "abgebrochen": "abgebrochen", "fehler": "mit Fehler beendet"}.get(
        ergebnis.status, ergebnis.status
    )
    zeilen = [
        f"Lauf {ergebnis.lauf_id} {status} (Zugriff: {ergebnis.zugriff or '–'}).",
        f"  Dauer: {ergebnis.dauer_s:.0f} s · Anfragen: {z.anfragen_api} API, {z.anfragen_medien} Medien · "
        f"Seiten: {z.seiten}",
        f"  Posts: {z.neue_posts} neu, {z.aktualisierte_posts} aktualisiert · Snapshots: {z.snapshots}",
        f"  Löschungen bestätigt: {z.geloescht_erkannt} · Edits erkannt: {z.edits_erkannt} · Fehler: {z.fehler}",
    ]
    if ergebnis.duplikate is not None:
        zeilen.append(f"  Duplikat-Prüfung: {ergebnis.duplikate.geprueft} Posts geprüft, "
                      f"{ergebnis.duplikate.mit_duplikat} mit Duplikat")
    if z.cloudflare_challenges or z.cloudflare_blocks:
        zeilen.append(f"  Cloudflare: {z.cloudflare_challenges} Prüfungen, {z.cloudflare_blocks} Sperren")
    for meldung in ergebnis.meldungen:
        zeilen.append(f"  - {meldung}")
    return "\n".join(zeilen)
