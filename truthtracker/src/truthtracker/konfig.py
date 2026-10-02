"""Einlesen und Prüfen von ``config.toml``. Fehlende Werte fallen auf die Standards zurück."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

from truthtracker import pfade

STANDARD_DATEI = pfade.PROJEKT / "config.toml"


class KonfigFehler(ValueError):
    pass


@dataclass
class KontoKonfig:
    handle: str = "realDonaldTrump"


@dataclass
class ZugriffKonfig:
    weg: str = "auto"
    browser: str = "auto"
    impersonate: str = "chrome"
    warte_challenge_s: float = 300.0
    seitengroesse: int = 40
    replies_anderer: str = "auto"
    # Nur für Tests und Fehlersuche, nicht in config.toml dokumentiert:
    headless: bool = False
    browser_argumente: list = field(default_factory=list)


@dataclass
class PausenKonfig:
    api_min_s: float = 10.0
    api_max_s: float = 15.0
    medien_min_s: float = 1.0
    medien_max_s: float = 3.0


@dataclass
class ErfassungKonfig:
    backfill_wochen: float = 4
    loeschpruefung_tage: float = 7
    duplikat_fenster_tage: float = 14
    snapshot_grenze_h: float = 24
    max_seiten_pro_lauf: int = 120
    max_einzelabrufe_pro_lauf: int = 40


@dataclass
class DuplikatKonfig:
    phash_max_abstand: int = 6
    dauer_toleranz_s: float = 1.0
    seitenverhaeltnis_toleranz: float = 0.02


@dataclass
class SpeicherKonfig:
    datenbank: str = "daten/truthtracker.sqlite"
    exporte: str = "exporte"


@dataclass
class DashboardKonfig:
    zeitzone: str = "Europe/Berlin"
    serien_schwelle_min: float = 10


@dataclass
class Konfig:
    konto: KontoKonfig = field(default_factory=KontoKonfig)
    zugriff: ZugriffKonfig = field(default_factory=ZugriffKonfig)
    pausen: PausenKonfig = field(default_factory=PausenKonfig)
    erfassung: ErfassungKonfig = field(default_factory=ErfassungKonfig)
    duplikate: DuplikatKonfig = field(default_factory=DuplikatKonfig)
    speicher: SpeicherKonfig = field(default_factory=SpeicherKonfig)
    dashboard: DashboardKonfig = field(default_factory=DashboardKonfig)
    basis_url: str = "https://truthsocial.com"
    basisordner: Path = field(default=pfade.PROJEKT)

    def pfad(self, relativ: str) -> Path:
        p = Path(relativ)
        return p if p.is_absolute() else self.basisordner / p

    @property
    def datenbank_pfad(self) -> Path:
        return self.pfad(self.speicher.datenbank)

    @property
    def export_ordner(self) -> Path:
        return self.pfad(self.speicher.exporte)

    def pruefe(self) -> None:
        z, p, e, d = self.zugriff, self.pausen, self.erfassung, self.duplikate
        if z.weg not in ("auto", "curl", "browser"):
            raise KonfigFehler(f"[zugriff] weg muss auto, curl oder browser sein, nicht {z.weg!r}")
        if z.replies_anderer not in ("auto", "an", "aus"):
            raise KonfigFehler(f"[zugriff] replies_anderer muss auto, an oder aus sein, nicht {z.replies_anderer!r}")
        if not all(isinstance(a, str) for a in z.browser_argumente):
            raise KonfigFehler("[zugriff] browser_argumente muss eine Liste von Texten sein")
        if not 1 <= z.seitengroesse <= 80:
            raise KonfigFehler("[zugriff] seitengroesse muss zwischen 1 und 80 liegen")
        for name, a, b in (("api", p.api_min_s, p.api_max_s), ("medien", p.medien_min_s, p.medien_max_s)):
            if a < 0 or b < a:
                raise KonfigFehler(f"[pausen] {name}_min_s muss >= 0 und <= {name}_max_s sein")
        for name in ("backfill_wochen", "loeschpruefung_tage", "duplikat_fenster_tage", "snapshot_grenze_h"):
            if getattr(e, name) <= 0:
                raise KonfigFehler(f"[erfassung] {name} muss größer als 0 sein")
        if e.max_seiten_pro_lauf < 1 or e.max_einzelabrufe_pro_lauf < 0:
            raise KonfigFehler("[erfassung] max_seiten_pro_lauf >= 1 und max_einzelabrufe_pro_lauf >= 0")
        if not 0 <= d.phash_max_abstand <= 32:
            raise KonfigFehler("[duplikate] phash_max_abstand muss zwischen 0 und 32 liegen")
        if self.dashboard.zeitzone not in ("America/New_York", "Europe/Berlin"):
            raise KonfigFehler("[dashboard] zeitzone muss America/New_York oder Europe/Berlin sein")
        if not self.konto.handle or self.konto.handle.startswith("@"):
            raise KonfigFehler("[konto] handle ohne @ angeben")


def _fuelle(ziel: Any, werte: dict[str, Any], abschnitt: str) -> None:
    bekannte = {f.name: f for f in fields(ziel)}
    for schluessel, wert in werte.items():
        if schluessel not in bekannte:
            raise KonfigFehler(f"Unbekannter Schlüssel [{abschnitt}] {schluessel}")
        aktuell = getattr(ziel, schluessel)
        if is_dataclass(aktuell):
            if not isinstance(wert, dict):
                raise KonfigFehler(f"[{schluessel}] muss ein Abschnitt sein")
            _fuelle(aktuell, wert, schluessel)
            continue
        erwartet = type(aktuell)
        if erwartet is float and isinstance(wert, int) and not isinstance(wert, bool):
            wert = float(wert)
        elif erwartet is int and isinstance(wert, float) and wert.is_integer():
            wert = int(wert)
        if not isinstance(wert, erwartet) or isinstance(wert, bool) != isinstance(aktuell, bool):
            raise KonfigFehler(f"[{abschnitt}] {schluessel}: erwartet {erwartet.__name__}, bekommen {wert!r}")
        setattr(ziel, schluessel, wert)


def lade(datei: Path | None = None) -> Konfig:
    datei = datei or STANDARD_DATEI
    konfig = Konfig(basisordner=datei.parent if datei.exists() else pfade.PROJEKT)
    if datei.exists():
        try:
            with datei.open("rb") as f:
                roh = tomllib.load(f)
        except tomllib.TOMLDecodeError as fehler:
            raise KonfigFehler(f"{datei.name} ist kein gültiges TOML: {fehler}") from None
        _fuelle(konfig, {k: v for k, v in roh.items() if k not in ("basisordner",)}, "")
    konfig.pruefe()
    return konfig
