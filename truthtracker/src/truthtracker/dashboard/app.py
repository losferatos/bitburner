"""Streamlit-Dashboard: Postingverhalten auf Truth Social, ausschließlich Metadaten.

Start über ``run_dashboard.bat`` oder ``python -m truthtracker dashboard``. Die Datenbank wird
nur lesend geöffnet; das Dashboard darf offen bleiben, während ein Crawl läuft. Eine andere
``config.toml`` lässt sich über die Umgebungsvariable ``TRUTHTRACKER_CONFIG`` wählen.

Alle Rechnungen stehen in ``truthtracker.auswertung``; hier wird nur gefiltert, angeordnet und
gezeichnet. Darstellungsregeln: Jede Kategorie (Post-Typ, Format, Duplikat-Art) hat einen
festen Platz in der Farbreihe, unabhängig von Filter und Rang; Mengen in der Heatmap als
einfarbige Blau-Rampe; nie zwei y-Achsen; Kennzahlen als Zahlenkacheln; zu jeder Grafik eine
Tabellenansicht. Hell- und Dunkelmodus haben je eigene, abgestimmte Farbstufen.
"""

from __future__ import annotations

import html
import os
import sqlite3
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# "streamlit run" nimmt nur den Ordner dieser Datei in den Suchpfad auf, nicht src/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from truthtracker import auswertung, db, konfig, zeit
from truthtracker.modelle import DUP_ARTEN, DUP_BESCHRIFTUNG, FORMAT_BESCHRIFTUNG, FORMATE, TYP_DETAIL_BESCHRIFTUNG

zahl = auswertung.zahl
prozent = auswertung.prozent

REITER = (
    "Überblick", "Tageszeiten", "Abstände & Serien", "Formate", "Engagement", "Retruth-Quellen",
    "Duplikate", "Löschungen & Edits", "Account", "Tabelle", "Läufe",
)

# Kategoriale Farbreihe in fester Reihenfolge (geprüft auf Farbfehlsichtigkeit für benachbarte
# Paare); der Dunkelmodus nutzt dieselben Farbtöne, auf die dunkle Fläche abgestimmt.
REIHE_HELL = ("#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948")
REIHE_DUNKEL = ("#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767")
BLAU_RAMPE = (
    "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
    "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
)
SCHRIFT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

# Farbe folgt der Kategorie, nie ihrem Rang: feste Plätze in der Reihe.
TYP_PLATZ = {t: i for i, t in enumerate(TYP_DETAIL_BESCHRIFTUNG)}
FORMAT_PLATZ = {f: i for i, f in enumerate(FORMATE)}
DUP_PLATZ = {a: i for i, a in enumerate(DUP_ARTEN)}
ZAEHLER_PLATZ = {auswertung.ZAEHLER_POST: 0, auswertung.ZAEHLER_ORIGINAL: 1}
FREQUENZ_NAMEN = {"D": "Tag", "W": "Woche", "M": "Monat"}

_PLOTLY_KONFIG = {"displaylogo": False, "modeBarButtonsToRemove": ["lasso2d", "select2d"]}


@dataclass(frozen=True)
class Stil:
    dunkel: bool
    flaeche: str
    text: str
    text_zweit: str
    gedaempft: str
    gitter: str
    achse: str
    reihe: tuple[str, ...]

    def farbe(self, platz: int | None) -> str:
        """Farbe eines festen Platzes; unbekannte Kategorien bekommen Grau statt einer neuen Farbe."""
        if platz is None or not 0 <= platz < len(self.reihe):
            return self.gedaempft
        return self.reihe[platz]

    @property
    def rampe(self) -> list[list[Any]]:
        stufen = BLAU_RAMPE[::-1] if self.dunkel else BLAU_RAMPE
        return [[i / (len(stufen) - 1), farbe] for i, farbe in enumerate(stufen)]


STIL_HELL = Stil(False, "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7", REIHE_HELL)
STIL_DUNKEL = Stil(True, "#1a1a19", "#ffffff", "#c3c2b7", "#898781", "#2c2c2a", "#383835", REIHE_DUNKEL)


@dataclass(frozen=True)
class Auswahl:
    zeitzone: str
    von: date
    bis: date
    typen: list[str]
    formate: list[str]
    geloeschte: bool
    schwelle_min: float
    alter_min_h: float
    alter_max_h: float
    mit_backfill: bool

    @property
    def zone_name(self) -> str:
        return zeit.ZEITZONEN_BESCHRIFTUNG.get(self.zeitzone, self.zeitzone)


def _stil() -> Stil:
    try:
        art = st.context.theme.type
    except AttributeError:
        art = None
    return STIL_DUNKEL if art == "dark" else STIL_HELL


# ---------------------------------------------------------------------------
# Daten


def _konfig_datei() -> Path | None:
    wert = os.environ.get("TRUTHTRACKER_CONFIG")
    return Path(wert) if wert else None


def _dateistand(pfad: Path) -> tuple[int, ...]:
    """Änderungsstand von Datenbank und WAL-Datei; neuer Stand = Cache verfällt sofort."""
    stand: list[int] = []
    for datei in (pfad, pfad.with_name(pfad.name + "-wal")):
        try:
            info = datei.stat()
        except OSError:
            stand += [0, 0]
        else:
            stand += [info.st_mtime_ns, info.st_size]
    return tuple(stand)


@st.cache_data(ttl=60, show_spinner="Lade Daten …")
def _lade(pfad: str, stand: tuple[int, ...]) -> auswertung.Daten:
    """``stand`` gehört nur zum Cache-Schlüssel."""
    con = db.oeffne(pfad, nur_lesen=True)
    try:
        return auswertung.lade_daten(con)
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Grafik-Bausteine


def _bargap(anzahl: int, breite_px: int = 1100) -> float:
    """Lücke zwischen Balken so, dass ein Balken höchstens etwa 22 px breit wird."""
    if anzahl <= 0:
        return 0.3
    platz = breite_px * 0.92 / anzahl
    return min(0.85, max(0.15, 1 - 22 / platz))


def _layout(
    fig: go.Figure,
    stil: Stil,
    *,
    hoehe: int = 320,
    x_titel: str = "",
    y_titel: str = "",
    legende: bool = False,
    horizontal: bool = False,
    x_datum: bool = False,
    y_prozent: bool = False,
    x_prozent: bool = False,
) -> go.Figure:
    fig.update_layout(
        template="none",
        height=hoehe,
        margin={"l": 8, "r": 16, "t": 36 if legende else 12, "b": 8},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": SCHRIFT, "size": 13, "color": stil.text_zweit},
        separators=",.",
        showlegend=legende,
        legend={
            "orientation": "h", "yanchor": "bottom", "y": 1.02, "xanchor": "left", "x": 0,
            "title_text": "", "font": {"color": stil.text_zweit}, "traceorder": "normal",
        },
        hoverlabel={"bgcolor": stil.flaeche, "bordercolor": stil.gitter, "font": {"color": stil.text, "family": SCHRIFT}},
        barcornerradius=4,
    )
    achse = {
        "gridcolor": stil.gitter, "gridwidth": 1, "linecolor": stil.achse, "linewidth": 1, "zeroline": False,
        "tickfont": {"color": stil.gedaempft}, "title_font": {"color": stil.text_zweit}, "automargin": True,
    }
    fig.update_xaxes(**achse, showgrid=horizontal, showline=not horizontal, title_text=x_titel)
    fig.update_yaxes(**achse, showgrid=not horizontal, showline=horizontal, title_text=y_titel)
    if x_datum:
        fig.update_xaxes(tickformat="%d.%m.", hoverformat="%d.%m.%Y")
    if y_prozent:
        fig.update_yaxes(tickformat=".0%", range=[0, 1.02])
    if x_prozent:
        fig.update_xaxes(tickformat=".0%")
    return fig


def _zaehlachse(fig: go.Figure, maximum: float, *, minimum: float = 0, x: bool = False, ab_null: bool = True) -> None:
    """Achse für Anzahlen: nur ganze Zahlen, bei kleiner Spanne jede Zahl beschriftet."""
    einstellung: dict[str, Any] = {"tickformat": ",d"}
    if ab_null:
        einstellung["rangemode"] = "tozero"
    if maximum - (0 if ab_null else minimum) <= 6:
        einstellung["dtick"] = 1
    (fig.update_xaxes if x else fig.update_yaxes)(**einstellung)


def _stundenachse(fig: go.Figure, schritt: int = 3) -> go.Figure:
    """Stundenachse 0–23 waagrecht beschriftet; in schmalen Grafiken nur jede dritte Stunde."""
    fig.update_xaxes(tickangle=0, tickmode="array", tickvals=[str(h) for h in range(0, 24, schritt)])
    return fig


def _zeige(fig: go.Figure, schluessel: str) -> None:
    st.plotly_chart(fig, width="stretch", theme=None, key=schluessel, config=_PLOTLY_KONFIG)


def _anzeige(df: pd.DataFrame) -> pd.DataFrame:
    """Leere Textzellen leer anzeigen statt „None“."""
    aus = df.copy()
    for spalte in aus.columns:
        if aus[spalte].dtype == object or isinstance(aus[spalte].dtype, pd.StringDtype):
            aus[spalte] = aus[spalte].astype(object).where(aus[spalte].notna(), "")
    return aus


def _tabelle(df: pd.DataFrame, titel: str = "Als Tabelle", **kwargs: Any) -> None:
    with st.expander(titel):
        st.dataframe(_anzeige(df), hide_index=True, **kwargs)


def _sicher(text: object) -> str:
    """Fremde Namen (Anzeigenamen, Handles) als reinen Text in Plotly-Beschriftungen."""
    return html.escape("" if text is None or pd.isna(text) else str(text))


def _gestapelt(
    tabelle: pd.DataFrame,
    plaetze: dict[str, int],
    beschriftung: dict[str, str],
    stil: Stil,
    *,
    y_titel: str,
    x_datum: bool = True,
    prozent_werte: bool = False,
    hoehe: int = 340,
    abdeckung: Sequence[float] | None = None,
) -> go.Figure:
    """Gestapelte Säulen: Zeilen = x, Spalten = Kategorien (feste Farbe je Kategorie).

    ``abdeckung`` (Anteil 0–1 je Zeile): nur teilweise erfasste Tage erscheinen blass und nennen
    den Anteil im Tooltip; die Farbe bleibt die der Kategorie.
    """
    fig = go.Figure()
    x = list(tabelle.index)
    format_ = "%{y:.1%}" if prozent_werte else "%{y:,.0f}"
    deckkraft: list[float] | float = 1.0
    hinweis: list[str] | None = None
    if abdeckung is not None:
        deckkraft = [1.0 if a >= 1 else 0.45 for a in abdeckung]
        hinweis = ["" if a >= 1 else f"<br><i>Tag nur zu {zahl(a * 100)} % erfasst</i>" for a in abdeckung]
    for i, spalte in enumerate(tabelle.columns):
        name = beschriftung.get(spalte, str(spalte))
        zusatz = "%{customdata}" if hinweis is not None and i == len(tabelle.columns) - 1 else ""
        fig.add_bar(
            x=x, y=tabelle[spalte].tolist(), name=name, customdata=hinweis,
            marker={"color": stil.farbe(plaetze.get(spalte)), "line": {"color": stil.flaeche, "width": 2},
                    "opacity": deckkraft},
            hovertemplate=f"{_sicher(name)}: <b>{format_}</b>{zusatz}<extra></extra>",
        )
    fig.update_layout(barmode="stack", hovermode="x unified", bargap=_bargap(len(x)))
    _layout(fig, stil, hoehe=hoehe, y_titel=y_titel, legende=len(tabelle.columns) >= 2, x_datum=x_datum,
            y_prozent=prozent_werte)
    if not prozent_werte:
        _zaehlachse(fig, float(tabelle.sum(axis=1).max()) if len(tabelle) else 0)
    return fig


def _saeulen(
    x: Sequence[Any],
    y: Sequence[float],
    stil: Stil,
    *,
    y_titel: str,
    x_titel: str = "",
    hover: str,
    breite_px: int = 1100,
    x_datum: bool = False,
    hoehe: int = 300,
    ganzzahlig: bool = True,
) -> go.Figure:
    """Eine Reihe senkrechter Säulen (Farbe Platz 1). ``hover`` nutzt %{x} und %{y}."""
    fig = go.Figure(go.Bar(
        x=list(x), y=list(y), marker={"color": stil.farbe(0), "line": {"width": 0}},
        hovertemplate=hover + "<extra></extra>",
    ))
    fig.update_layout(bargap=_bargap(len(x), breite_px), hovermode="closest")
    if not x_datum:
        fig.update_xaxes(type="category")
    _layout(fig, stil, hoehe=hoehe, x_titel=x_titel, y_titel=y_titel, x_datum=x_datum)
    if ganzzahlig:
        _zaehlachse(fig, max((float(w) for w in y), default=0))
    return fig


def _balken(
    namen: Sequence[str],
    werte: Sequence[float],
    stil: Stil,
    *,
    x_titel: str,
    hover: str,
    customdata: Sequence[Sequence[Any]] | None = None,
) -> go.Figure:
    """Eine Reihe waagrechter Balken, erste Kategorie oben."""
    fig = go.Figure(go.Bar(
        y=[_sicher(n) for n in namen], x=list(werte), orientation="h",
        marker={"color": stil.farbe(0), "line": {"width": 0}},
        customdata=customdata, hovertemplate=hover + "<extra></extra>",
    ))
    fig.update_layout(bargap=0.35, hovermode="closest")
    fig.update_yaxes(autorange="reversed", type="category")
    _layout(fig, stil, hoehe=60 + 34 * max(len(namen), 1), x_titel=x_titel, horizontal=True)
    _zaehlachse(fig, max((float(w) for w in werte), default=0), x=True)
    return fig


def _linie(x: Sequence[Any], y: Sequence[float], stil: Stil, *, name: str, y_titel: str, format_: str,
           x_datum: bool = True, y_prozent: bool = False, x_titel: str = "", hoehe: int = 300) -> go.Figure:
    fig = go.Figure(go.Scatter(
        x=list(x), y=list(y), mode="lines+markers", name=name, connectgaps=False,
        line={"color": stil.farbe(0), "width": 2, "shape": "linear"},
        marker={"color": stil.farbe(0), "size": 8, "line": {"color": stil.flaeche, "width": 2}},
        hovertemplate=f"{_sicher(name)}: <b>%{{y:{format_}}}</b><extra></extra>",
    ))
    fig.update_layout(hovermode="x unified")
    fig.update_xaxes(showspikes=True, spikemode="across", spikethickness=1, spikecolor=stil.achse, spikedash="solid")
    return _layout(fig, stil, hoehe=hoehe, x_titel=x_titel, y_titel=y_titel, x_datum=x_datum, y_prozent=y_prozent)


def _gruppiert(
    lang: pd.DataFrame,
    beschriftung: dict[Any, str],
    stil: Stil,
    *,
    wert_titel: str,
    horizontal: bool,
    alle_gruppen: Sequence[Any] | None = None,
) -> go.Figure:
    """Engagement-Gruppen: je Zähler-Reihe (Post selbst / Original) eine Balkenreihe, Wert = Median."""
    fig = go.Figure()
    reihen = [z for z in ZAEHLER_PLATZ if z in set(lang["zaehler"])]
    gruppen = list(alle_gruppen) if alle_gruppen is not None else list(dict.fromkeys(lang["gruppe"]))
    namen = [_sicher(beschriftung.get(g, g)) for g in gruppen]
    for reihe in reihen:
        teil = lang.loc[lang["zaehler"] == reihe].set_index("gruppe").reindex(gruppen)
        werte = teil["median"].tolist()
        extra = list(zip(teil["mittel"].tolist(), teil["anzahl"].fillna(0).astype(int).tolist(),
                         teil["alter_median_h"].tolist(), strict=True))
        wessen = "des Originals" if reihe == auswertung.ZAEHLER_ORIGINAL else "des Posts"
        hover = (f"{reihe}<br>Median: <b>%{{{'x' if horizontal else 'y'}:,.1f}}</b>"
                 "<br>Mittel: %{customdata[0]:,.1f}<br>Posts: %{customdata[1]}"
                 f"<br>Alter {wessen} beim Messen (Median): %{{customdata[2]:,.1f}} h<extra></extra>")
        fig.add_bar(
            x=werte if horizontal else namen, y=namen if horizontal else werte,
            orientation="h" if horizontal else "v", name=reihe, customdata=extra, hovertemplate=hover,
            marker={"color": stil.farbe(ZAEHLER_PLATZ[reihe]), "line": {"width": 0}},
        )
    fig.update_layout(barmode="group", bargroupgap=0.12, hovermode="closest")
    if horizontal:
        fig.update_yaxes(autorange="reversed", type="category")
        hoehe = 70 + len(gruppen) * (24 * len(reihen) + 16)
        fig.update_layout(bargap=16 / (24 * len(reihen) + 16))
        return _layout(fig, stil, hoehe=hoehe, x_titel=wert_titel, legende=len(reihen) >= 2, horizontal=True)
    fig.update_xaxes(type="category")
    fig.update_layout(bargap=_bargap(len(gruppen) * len(reihen)))
    return _layout(fig, stil, hoehe=320, y_titel=wert_titel, x_titel="Stunde des Posts", legende=len(reihen) >= 2)


def _heatmap(tabelle: pd.DataFrame, stil: Stil) -> go.Figure:
    fig = go.Figure(go.Heatmap(
        z=tabelle.to_numpy(), x=[str(h) for h in tabelle.columns], y=list(tabelle.index),
        colorscale=stil.rampe, xgap=2, ygap=2, zmin=0,
        colorbar={"title": {"text": "Posts", "font": {"color": stil.text_zweit}}, "thickness": 12,
                  "outlinewidth": 0, "tickfont": {"color": stil.gedaempft}, "tickformat": ",d"},
        hovertemplate="%{y}, %{x}:00–%{x}:59 Uhr: <b>%{z}</b> Posts<extra></extra>",
    ))
    fig.update_yaxes(autorange="reversed", type="category")
    fig.update_xaxes(type="category")
    _layout(fig, stil, hoehe=300, x_titel="Stunde")
    fig.update_xaxes(showgrid=False, showline=False)
    fig.update_yaxes(showgrid=False, showline=False)
    return fig


def _intervalle(loeschungen: pd.DataFrame, stil: Stil) -> go.Figure:
    """Zeit bis zur Löschung je Post als Spanne von „frühestens“ bis „spätestens“."""
    namen = [
        f"{e:%d.%m. %H:%M} · {TYP_DETAIL_BESCHRIFTUNG.get(t, t)}"
        for e, t in zip(loeschungen["erstellt"], loeschungen["typ_detail"], strict=True)
    ]
    x: list[Any] = []
    y: list[Any] = []
    daten: list[Any] = []
    for name, lo, hi in zip(namen, loeschungen["min_h"], loeschungen["max_h"], strict=True):
        x += [lo, hi, None]
        y += [name, name, None]
        daten += [[lo, hi], [lo, hi], [None, None]]
    fig = go.Figure(go.Scatter(
        x=x, y=y, mode="lines+markers", customdata=daten, connectgaps=False,
        line={"color": stil.farbe(0), "width": 2},
        marker={"color": stil.farbe(0), "size": 8, "line": {"color": stil.flaeche, "width": 2}},
        hovertemplate="%{y}<br>gelöscht zwischen <b>%{customdata[0]:,.1f} h</b> und "
                      "<b>%{customdata[1]:,.1f} h</b> nach dem Post<extra></extra>",
    ))
    fig.update_yaxes(autorange="reversed", type="category")
    fig.update_xaxes(rangemode="tozero")
    return _layout(fig, stil, hoehe=max(150, 80 + 30 * len(namen)), x_titel="Stunden nach dem Post",
                   horizontal=True)


def _leer(text: str = "Keine Posts in der aktuellen Auswahl.") -> None:
    st.info(text)


def _posts(anzahl: int) -> str:
    return f"{zahl(anzahl)} Post" if anzahl == 1 else f"{zahl(anzahl)} Posts"


def _datumsspalte(werte: Sequence[date]) -> list[str]:
    return [f"{d:%d.%m.%Y}" for d in werte]


# ---------------------------------------------------------------------------
# Seitenleiste


def _zeitraum_vorgabe(daten: auswertung.Daten, zeitzone: str) -> tuple[date, date]:
    """Vorgabe für den Zeitraum: die Erfassung in der gewählten Zeitzone.

    Solange der Nutzer den Zeitraum nicht selbst gewählt hat, zieht er mit der Vorgabe mit: beim
    Wechsel der Zeitzone (sonst fielen Posts am Rand heraus) und wenn ein Crawl bei offenem
    Dashboard neue Tage gebracht hat. Ein selbst gewählter Zeitraum bleibt stehen, bis der Nutzer
    wieder genau die Vorgabe wählt. Endet am letzten Lauf, nicht heute: Tage danach sind nicht erfasst.
    """
    heute = pd.Timestamp.now(tz=zeitzone).date()
    vorgabe = auswertung.datenbereich(daten, zeitzone) or (heute, heute)
    zustand = st.session_state
    if not zustand.get("zeitraum_eigen") or "zeitraum" not in zustand:
        zustand["zeitraum"] = vorgabe
    zustand["zeitraum_vorgabe"] = vorgabe
    return vorgabe


def _zeitraum_gewaehlt() -> None:
    """Callback der Datumsauswahl: merkt, ob der Nutzer etwas anderes als die Vorgabe gewählt hat."""
    zustand = st.session_state
    wert = zustand.get("zeitraum")
    wert = tuple(wert) if isinstance(wert, (list, tuple)) else wert
    zustand["zeitraum_eigen"] = wert != zustand.get("zeitraum_vorgabe")


def _zeitraum_grenzen(daten: auswertung.Daten, vorgabe: tuple[date, date]) -> tuple[date, date]:
    """Erlaubter Bereich der Datumsauswahl: alle Posts (auch vor der Erfassung) in beiden
    Zeitzonen und heute, je einen Tag Puffer. So bleibt ein gewählter Zeitraum beim Wechsel der
    Zeitzone gültig."""
    tage = [*vorgabe, pd.Timestamp.now(tz="UTC").date()]
    for zeitzone in auswertung.ZEITZONEN:
        bereich = auswertung.datenbereich(daten, zeitzone, mit_vor_erfassung=True)
        if bereich:
            tage += list(bereich)
    return min(tage) - timedelta(days=1), max(tage) + timedelta(days=1)


def _seitenleiste(daten: auswertung.Daten, einstellungen: konfig.Konfig, pfad: Path) -> Auswahl:
    sb = st.sidebar
    sb.header("Filter")
    zonen = list(auswertung.ZEITZONEN)
    standard = einstellungen.dashboard.zeitzone
    zeitzone = sb.radio(
        "Zeitzone", zonen, index=zonen.index(standard) if standard in zonen else 0,
        format_func=lambda z: zeit.ZEITZONEN_BESCHRIFTUNG.get(z, z), key="zeitzone",
        help="Alle Uhrzeiten, Tage und Wochentage in dieser Zeitzone, mit Sommerzeit.",
    )
    erster, letzter = _zeitraum_vorgabe(daten, zeitzone)
    kleinste, groesste = _zeitraum_grenzen(daten, (erster, letzter))
    zeitraum = sb.date_input(
        "Zeitraum", min_value=kleinste, max_value=groesste, format="DD.MM.YYYY", key="zeitraum",
        on_change=_zeitraum_gewaehlt,
        help="Vorgabe: die ganze Erfassung, von der Backfill-Grenze des ersten Laufs bis zum letzten Lauf.",
    )
    if isinstance(zeitraum, (tuple, list)) and len(zeitraum) == 2:
        von, bis = zeitraum
    elif isinstance(zeitraum, (tuple, list)) and len(zeitraum) == 1:
        von = bis = zeitraum[0]
    elif isinstance(zeitraum, date):
        von = bis = zeitraum
    else:
        von, bis = erster, letzter
    typen = sb.multiselect(
        "Post-Typ", list(TYP_DETAIL_BESCHRIFTUNG), default=list(TYP_DETAIL_BESCHRIFTUNG),
        format_func=lambda t: TYP_DETAIL_BESCHRIFTUNG.get(t, t), key="typen",
    )
    formate = sb.multiselect(
        "Format", list(FORMATE), default=list(FORMATE), format_func=lambda f: FORMAT_BESCHRIFTUNG.get(f, f),
        key="formate", help="Bei Retruths bezogen auf den retruthed Inhalt.",
    )
    geloeschte = sb.checkbox("Gelöschte Posts einbeziehen", value=True, key="geloeschte")
    sb.subheader("Serien")
    schwelle = sb.number_input(
        "Serien-Schwelle (Minuten)", min_value=1, max_value=240, step=1, format="%d",
        value=min(max(round(einstellungen.dashboard.serien_schwelle_min), 1), 240), key="schwelle",
        help="Aufeinanderfolgende Posts mit weniger als so vielen Minuten Abstand bilden eine Serie.",
    )
    sb.subheader("Engagement")
    alter = sb.slider(
        "Messalter (Stunden)", min_value=0, max_value=48, value=(18, 24), step=1, format="%d h", key="alter",
        help="Nur Posts, deren letzte Messung so viele Stunden nach dem Post lag, werden verglichen. Bei "
             "Retruths zählen die Zähler des Originals nur, wenn auch das Original so alt war.",
    )
    mit_backfill = sb.checkbox(
        "Backfill-Posts einbeziehen", value=False, key="backfill",
        help="Posts aus dem ersten Lauf wurden erst nach Tagen gemessen (Endstand) und sind mit "
             "24-h-Werten nicht vergleichbar.",
    )
    sb.divider()
    sb.caption(f"Datenbank (nur lesend): {pfad}")
    return Auswahl(
        zeitzone=zeitzone, von=von, bis=bis, typen=list(typen), formate=list(formate), geloeschte=geloeschte,
        schwelle_min=float(schwelle), alter_min_h=float(alter[0]), alter_max_h=float(alter[1]),
        mit_backfill=mit_backfill,
    )


# ---------------------------------------------------------------------------
# Reiter


def _erfassung_text(daten: auswertung.Daten, a: Auswahl) -> str:
    teile = []
    if daten.erfasst_ab is not None:
        teile.append(f"Beginn der Erfassung {daten.erfasst_ab.tz_convert(a.zeitzone):%d.%m.%Y %H:%M}")
    if daten.erfasst_bis is not None:
        teile.append(f"letzter Lauf {daten.erfasst_bis.tz_convert(a.zeitzone):%d.%m.%Y %H:%M}")
    return ", ".join(teile)


def _reiter_ueberblick(df: pd.DataFrame, daten: auswertung.Daten, a: Auswahl, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    u = auswertung.ueberblick(df, a.von, a.bis, erfasst_ab=daten.erfasst_ab, erfasst_bis=daten.erfasst_bis)
    erfassung = _erfassung_text(daten, a)
    k = st.columns(6)
    k[0].metric("Posts", zahl(u.posts))
    k[1].metric(
        "Posts pro Tag", zahl(u.pro_tag, 1),
        help=f"Posts geteilt durch die erfassten Tage im Zeitraum ({zahl(u.tage, 1)} von {u.kalendertage} "
             "Kalendertagen). Tage ohne Post zählen voll; Randtage, die nur teilweise erfasst sind, anteilig; "
             "Tage nach dem letzten Lauf gar nicht." + (f" {erfassung}." if erfassung else ""),
    )
    k[2].metric("Eigene Posts", zahl(u.eigene), help="Inklusive Quotes und Replies.")
    k[3].metric("Retruths", zahl(u.retruths), help=f"Davon Selbst-Retruths: {zahl(u.selbst_retruths)}")
    k[4].metric("Anteil Retruths", prozent(u.anteil_retruths))
    k[5].metric("Gelöscht", zahl(u.geloescht))

    st.subheader("Posts pro Tag nach Typ")
    pro_tag = auswertung.posts_pro_tag(df, von=a.von, bis=a.bis)
    abdeckung = auswertung.tagesabdeckung(pro_tag.index, a.zeitzone, daten.erfasst_ab, daten.erfasst_bis)
    if (abdeckung < 1).any():
        st.caption(f"Blasse Säulen: Tag nur teilweise erfasst ({erfassung}); dort fehlen Posts vor Beginn der "
                   "Erfassung bzw. nach dem letzten Lauf.")
    _zeige(_gestapelt(pro_tag, TYP_PLATZ, TYP_DETAIL_BESCHRIFTUNG, stil, y_titel="Posts", abdeckung=abdeckung.tolist()),
           "ueberblick_pro_tag")
    tabelle = pro_tag.rename(columns=TYP_DETAIL_BESCHRIFTUNG)
    tabelle.insert(0, "Erfasst", abdeckung.map(lambda w: prozent(w, 0)).to_numpy())
    tabelle.insert(0, "Summe", pro_tag.sum(axis=1))
    tabelle.insert(0, "Datum", _datumsspalte(pro_tag.index))
    _tabelle(tabelle)

    st.subheader("Anteil Retruths im Zeitverlauf")
    frequenz = st.radio("Zeitraster", list(FREQUENZ_NAMEN), index=1, horizontal=True,
                        format_func=FREQUENZ_NAMEN.get, key="ueberblick_frequenz")
    anteil = auswertung.anteil_retruths(df, frequenz=frequenz)
    st.caption("Retruths und Selbst-Retruths geteilt durch alle Posts der Periode. Wochen beginnen montags.")
    _zeige(_linie(anteil.index, anteil["anteil_retruths"], stil, name="Anteil Retruths", y_titel="Anteil",
                  format_=".1%", y_prozent=True), "ueberblick_anteil")
    _tabelle(pd.DataFrame({
        "Beginn": _datumsspalte(anteil.index), "Posts": anteil["posts"], "Retruths": anteil["retruths"],
        "Eigene Posts": anteil["eigene"], "Anteil Retruths": anteil["anteil_retruths"].map(prozent),
    }))


def _reiter_tageszeiten(df: pd.DataFrame, a: Auswahl, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    heat = auswertung.heatmap_wochentag_stunde(df)
    st.subheader("Wochentag × Stunde")
    st.caption(f"Anzahl Posts je Stunde, Ortszeit {a.zone_name}. Sommerzeitwechsel sind berücksichtigt.")
    _zeige(_heatmap(heat, stil), "tageszeiten_heatmap")
    tabelle = heat.copy()
    tabelle.columns = [f"{h} Uhr" for h in heat.columns]
    tabelle.insert(0, "Wochentag", list(heat.index))
    _tabelle(tabelle)

    links, rechts = st.columns(2)
    with links:
        st.subheader("Posts nach Stunde")
        stunden = heat.sum(axis=0)
        _zeige(_stundenachse(_saeulen([str(h) for h in stunden.index], stunden.tolist(), stil, y_titel="Posts",
                                      x_titel="Stunde", hover="%{x} Uhr: <b>%{y}</b> Posts", breite_px=540)),
               "tageszeiten_stunde")
        _tabelle(pd.DataFrame({"Stunde": stunden.index, "Posts": stunden.to_numpy()}))
    with rechts:
        st.subheader("Posts nach Wochentag")
        tage = heat.sum(axis=1)
        _zeige(_saeulen(list(tage.index), tage.tolist(), stil, y_titel="Posts", hover="%{x}: <b>%{y}</b> Posts",
                        breite_px=540), "tageszeiten_wochentag")
        _tabelle(pd.DataFrame({"Wochentag": tage.index, "Posts": tage.to_numpy()}))


def _reiter_abstaende(df: pd.DataFrame, umfeld: pd.DataFrame, a: Auswahl, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    st.caption("Ein Abstand zählt zu dem Post, mit dem er endet; der Vorgänger des ersten Posts im Zeitraum darf "
               "davor liegen. So hat ein Tag dieselben Werte, egal wo der gewählte Zeitraum beginnt.")
    abstaende = auswertung.abstaende_minuten(df)
    alle_serien = auswertung.serien(df, a.schwelle_min, umfeld=umfeld)
    serien = auswertung.serien_im_zeitraum(alle_serien)
    k = auswertung.serien_kennzahlen(alle_serien, len(df))
    spalten = st.columns(5)
    spalten[0].metric("Median-Abstand", auswertung.dauer_text(abstaende.median() if len(abstaende) else None))
    spalten[1].metric("Serien", zahl(k.anzahl), help=f"Mindestens zwei Posts, jeweils weniger als "
                                                     f"{zahl(a.schwelle_min)} Minuten nacheinander.")
    spalten[2].metric("Posts in Serien", prozent(k.anteil_posts),
                      help="Anteil der Posts im Zeitraum, die zu einer Serie gehören, auch zu einer, die vorher "
                           "begann. Serien selbst zählen im Zeitraum ihres Beginns, mit voller Länge.")
    spalten[3].metric("Längste Serie", f"{k.laengste} Posts" if k.anzahl else "–")
    spalten[4].metric("Mittlere Serienlänge", zahl(k.mittlere_laenge, 1))

    st.subheader("Abstände zwischen aufeinanderfolgenden Posts")
    if abstaende.empty:
        _leer("Für Abstände braucht es mindestens zwei Posts.")
    else:
        verteilung = auswertung.abstaende_verteilung(abstaende)
        _zeige(_saeulen(verteilung["klasse"], verteilung["anzahl"], stil, y_titel="Abstände", x_titel="Abstand",
                        hover="%{x}: <b>%{y}</b> Abstände"), "abstaende_verteilung")
        _tabelle(verteilung.rename(columns={"klasse": "Abstand", "anzahl": "Anzahl"}))

    st.subheader(f"Posting-Serien (Abstand unter {zahl(a.schwelle_min)} min)")
    if serien.empty:
        _leer("Keine Serien mit dieser Schwelle.")
    else:
        links, rechts = st.columns(2)
        with links:
            st.markdown("**Länge (Posts je Serie)**")
            laengen = auswertung.serien_nach_laenge(serien)
            _zeige(_saeulen([str(n) for n in laengen["laenge"]], laengen["anzahl"], stil, y_titel="Serien",
                            x_titel="Posts in der Serie", hover="%{x} Posts: <b>%{y}</b> Serien", breite_px=540),
                   "serien_laenge")
        with rechts:
            st.markdown(f"**Uhrzeit des Serienbeginns ({a.zone_name})**")
            stunden = auswertung.serien_nach_stunde(serien)
            _zeige(_stundenachse(_saeulen([str(h) for h in stunden["stunde"]], stunden["anzahl"], stil,
                                          y_titel="Serien", x_titel="Stunde", hover="%{x} Uhr: <b>%{y}</b> Serien",
                                          breite_px=540)), "serien_stunde")
        _tabelle(pd.DataFrame({
            "Nr.": range(1, len(serien) + 1), "Beginn": [f"{t:%d.%m.%Y %H:%M}" for t in serien["start"]],
            "Ende": [f"{t:%d.%m.%Y %H:%M}" for t in serien["ende"]], "Posts": serien["anzahl"],
            "davon im Zeitraum": serien["posts_im_zeitraum"],
            "Dauer (min)": serien["dauer_min"].round(1), "Erster Post": serien["erster_post"],
        }), titel="Alle Serien als Tabelle")

    st.subheader("Längste Pause pro Tag")
    st.caption("Längster Abstand zwischen zwei Posts, der an diesem Tag endet: Eine Pause über Mitternacht "
               "zählt in voller Länge zum Folgetag (meist die Nachtpause bis zum ersten Post). Gemessen in "
               "echter Zeit, auch über Sommerzeitwechsel. Der erste Post der Erfassung hat keinen bekannten "
               "Vorgänger.")
    pausen = auswertung.laengste_pause_pro_tag(df).dropna(subset=["pause_h"])
    if pausen.empty:
        _leer("Für Pausen braucht es mindestens zwei Posts.")
        return
    _zeige(_saeulen(pausen["datum"], pausen["pause_h"], stil, y_titel="Stunden", x_datum=True, ganzzahlig=False,
                    hover="%{x|%d.%m.%Y}: <b>%{y:,.1f} h</b>"), "pausen")
    _tabelle(pd.DataFrame({
        "Datum": _datumsspalte(pausen["datum"]), "Pause (h)": pausen["pause_h"].round(2),
        "Von": [f"{t:%d.%m. %H:%M}" for t in pausen["von"]], "Bis": [f"{t:%d.%m. %H:%M}" for t in pausen["bis"]],
        "Posts am Tag": pausen["posts"],
    }))


def _reiter_formate(df: pd.DataFrame, a: Auswahl, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    medien = auswertung.medien_uebersicht(df).set_index("art")
    k = st.columns(5)
    k[0].metric("Bilder", zahl(medien.loc["Bilder", "medien"]), help=f"in {zahl(medien.loc['Bilder', 'posts'])} Posts")
    k[1].metric("Videos", zahl(medien.loc["Videos", "medien"]), help=f"in {zahl(medien.loc['Videos', 'posts'])} Posts")
    k[2].metric("GIFs", zahl(medien.loc["GIFs", "medien"]), help=f"in {zahl(medien.loc['GIFs', 'posts'])} Posts")
    k[3].metric("Posts mit Links", zahl((df["n_urls"] > 0).sum()))
    k[4].metric("Posts mit Vorschaukarte", zahl(df["hat_karte"].sum()))

    st.subheader("Formatmix im Zeitverlauf")
    frequenz = st.radio("Zeitraster", list(FREQUENZ_NAMEN), index=1, horizontal=True,
                        format_func=FREQUENZ_NAMEN.get, key="formate_frequenz")
    mix = auswertung.formatmix_zeitverlauf(df, frequenz=frequenz)
    anzahl = auswertung.formatmix_zeitverlauf(df, frequenz=frequenz, anteil=False)
    st.caption("Anteil der Formate an allen Posts der Periode; bei Retruths zählt das Format des Originals.")
    _zeige(_gestapelt(mix, FORMAT_PLATZ, FORMAT_BESCHRIFTUNG, stil, y_titel="Anteil", prozent_werte=True),
           "formate_mix")
    tabelle = anzahl.rename(columns=FORMAT_BESCHRIFTUNG)
    tabelle.insert(0, "Beginn", _datumsspalte(anzahl.index))
    _tabelle(tabelle, titel="Als Tabelle (Anzahl Posts)")

    st.subheader("Verteilung der Zeichenanzahl")
    spalte = st.radio("Zählung", ["zeichen", "zeichen_ohne_urls"], horizontal=True, key="formate_zeichen",
                      format_func={"zeichen": "sichtbarer Text", "zeichen_ohne_urls": "ohne URLs"}.get)
    verteilung = auswertung.zeichen_verteilung(df, spalte)
    st.caption("Zeichen = Graphem-Cluster des sichtbaren Texts. Klasse „0“ = Post ohne Text.")
    _zeige(_saeulen(verteilung["klasse"], verteilung["anzahl"], stil, y_titel="Posts", x_titel="Zeichen",
                    hover="%{x} Zeichen: <b>%{y}</b> Posts"), "formate_zeichen_verteilung")
    _tabelle(verteilung[["klasse", "anzahl"]].rename(columns={"klasse": "Zeichen", "anzahl": "Posts"}))
    _tabelle(medien.reset_index().rename(columns={"art": "Medienart", "medien": "Anzahl", "posts": "Posts damit"}),
             titel="Medien je Art als Tabelle")


def _engagement_tabelle(lang: pd.DataFrame, beschriftung: dict[Any, str], name: str) -> pd.DataFrame:
    return pd.DataFrame({
        name: [beschriftung.get(g, g) for g in lang["gruppe"]],
        "Zähler": lang["zaehler"],
        "Posts": lang["anzahl"],
        "Median": lang["median"].round(2),
        "Mittel": lang["mittel"].round(2),
        "Alter beim Messen, Median (h)": lang["alter_median_h"].round(1),
    })


def _reiter_engagement(df: pd.DataFrame, daten: auswertung.Daten, a: Auswahl, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    links, rechts = st.columns([2, 3])
    kennzahl = links.selectbox("Kennzahl", list(daten.kennzahlen), format_func=auswertung.kennzahl_beschriftung,
                               key="engagement_kennzahl")
    pro_stunde = rechts.toggle("pro Stunde seit Post", value=False, key="engagement_pro_stunde",
                               help="Wert geteilt durch das Alter des Posts beim Messen.")
    e = auswertung.engagement(df, a.alter_min_h, a.alter_max_h, a.mit_backfill, pro_stunde, kennzahl=kennzahl)
    titel = e.wert_beschriftung
    bereich = f"{zahl(a.alter_min_h, 1)}–{zahl(a.alter_max_h, 1)} h"
    dazu = f", dazu {zahl(e.backfill_einbezogen)} Backfill-Posts (Endstand, Messalter beliebig)" if (
        e.backfill_einbezogen) else ""
    nicht_dabei = [f"{zahl(e.ohne_messung)} ohne Messung", f"{zahl(e.ausserhalb_alter)} mit anderem Messalter"]
    if not a.mit_backfill:
        nicht_dabei.append(f"{zahl(e.backfill_ausgeschlossen)} Backfill-Posts")
    st.caption(
        f"Verglichen werden Posts, deren letzte Messung {bereich} nach dem Post lag: {zahl(e.im_messalter)} Posts"
        f"{dazu}. Nicht dabei: {', '.join(nicht_dabei)}."
    )
    st.caption(
        f"Reihe „Original“ (nur Retruths): Zähler des retruthed Posts, nur wenn auch das Original beim Messen "
        f"{bereich} alt war; {zahl(e.original_ausserhalb_alter)} Retruths mit älterem oder jüngerem Original "
        "fehlen in dieser Reihe."
    )
    if pro_stunde:
        st.caption("„pro Stunde seit Post“ = Zähler ÷ Alter des Posts beim Messen in Stunden; bei der Reihe "
                   "„Original“ ÷ Alter des Originals zum selben Zeitpunkt.")
    if e.backfill_einbezogen:
        st.warning(f"{zahl(e.backfill_einbezogen)} Backfill-Posts sind einbezogen. Ihr Wert ist ein Endstand nach "
                   f"mehreren Tagen und mit Messungen nach {bereich} nicht vergleichbar.")
    if e.basis.empty:
        _leer("Keine Posts mit passendem Messalter. Den Messalter-Bereich in der Seitenleiste anpassen.")
        return
    eigene = e.basis.loc[~e.basis["typ_detail"].isin(auswertung.RETRUTH_TYPEN), "wert"]
    k = st.columns(3)
    k[0].metric("Posts im Vergleich", zahl(len(e.basis)))
    k[1].metric(f"Median {titel}, eigene Posts", zahl(eigene.median() if len(eigene) else None, 1))
    original = e.basis["orig_wert"].dropna()
    k[2].metric(f"Median {titel}, Originale der Retruths", zahl(original.median() if len(original) else None, 1))

    st.subheader(f"{titel} nach Post-Typ (Median)")
    st.caption("„Post selbst“ sind die Zähler des Posts; bei Retruths sind das die Zähler des Retruths. "
               "„Original“ sind die Zähler des retruthed Posts.")
    _zeige(_gruppiert(e.nach_typ, TYP_DETAIL_BESCHRIFTUNG, stil, wert_titel=titel, horizontal=True), "eng_typ")
    _tabelle(_engagement_tabelle(e.nach_typ, TYP_DETAIL_BESCHRIFTUNG, "Typ"))

    st.subheader(f"{titel} nach Format (Median)")
    _zeige(_gruppiert(e.nach_format, FORMAT_BESCHRIFTUNG, stil, wert_titel=titel, horizontal=True), "eng_format")
    _tabelle(_engagement_tabelle(e.nach_format, FORMAT_BESCHRIFTUNG, "Format"))

    st.subheader(f"{titel} nach Uhrzeit des Posts (Median, {a.zone_name})")
    stunden = {h: str(h) for h in range(24)}
    _zeige(_stundenachse(_gruppiert(e.nach_stunde, stunden, stil, wert_titel=titel, horizontal=False,
                                    alle_gruppen=range(24)), schritt=1), "eng_stunde")
    _tabelle(_engagement_tabelle(e.nach_stunde, stunden, "Stunde"))

    st.subheader(f"Wachstum: {titel} nach Alter des Posts")
    st.caption("Alle Messungen der ausgewählten Posts, unabhängig vom Messalter-Filter: Median je voller Stunde "
               "nach dem Post. Posts mit mehreren Messungen ergeben so eine typische Wachstumskurve.")
    w = auswertung.wachstum(daten.snapshots, df, kennzahl, mit_backfill=a.mit_backfill, pro_stunde=pro_stunde)
    if w["messungen"].sum() == 0:
        _leer("Keine Messungen unter 24 h in der Auswahl.")
    else:
        _zeige(_linie(w["alter_stunde"], w["median"], stil, name=f"Median {titel}", y_titel=titel, format_=",.1f",
                      x_datum=False, x_titel="Alter des Posts beim Messen (Stunden)"), "eng_wachstum")
        _tabelle(w.rename(columns={"alter_stunde": "Alter (volle Stunden)", "messungen": "Messungen",
                                   "posts": "Posts", "median": "Median"}))
    _tabelle(pd.DataFrame({
        "Post-ID": e.basis["id"], "Link": e.basis["url"],
        "Erstellt": [f"{t:%d.%m.%Y %H:%M}" for t in e.basis["lokal"]],
        "Typ": e.basis["typ_detail"].map(lambda t: TYP_DETAIL_BESCHRIFTUNG.get(t, t)),
        "Format": e.basis["format"].map(lambda f: FORMAT_BESCHRIFTUNG.get(f, f)),
        "Messung": [auswertung.messalter_text(h, b) for h, b in zip(e.basis["messalter_h"], e.basis["backfill"],
                                                                     strict=True)],
        titel: e.basis["wert"].round(2),
        "Original: Alter beim Messen (h)": e.basis["orig_alter_h"].round(1),
        f"Original: {titel}": e.basis["orig_wert"].round(2),
    }), titel="Alle verglichenen Posts", column_config={"Link": st.column_config.LinkColumn(display_text="öffnen")})


def _reiter_retruths(df: pd.DataFrame, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    r = auswertung.retruth_quellen(df)
    if r.anzahl == 0:
        _leer("Keine Retruths in der Auswahl.")
        return
    k = st.columns(4)
    k[0].metric("Retruths", zahl(r.anzahl))
    k[1].metric("Selbst-Retruths", zahl(r.selbst))
    k[2].metric("Anteil Selbst-Retruths", prozent(r.anteil_selbst))
    k[3].metric("Median-Latenz", auswertung.dauer_text(r.latenz_median_min),
                help="Zeit zwischen dem Original und dem Retruth.")

    st.subheader("Meistgeteilte Accounts")
    top = r.top
    namen = top["beschriftung"].tolist()
    extra = [
        [_sicher(n), "ja" if v is True else ("nein" if v is False else "unbekannt"), zahl(f), prozent(t)]
        for n, v, f, t in zip(top["anzeigename"], top["verifiziert"].astype(object), top["follower"], top["anteil"],
                              strict=True)
    ]
    _zeige(_balken(namen, top["anzahl"].tolist(), stil, x_titel="Retruths", customdata=extra,
                   hover="%{y} (%{customdata[0]})<br><b>%{x}</b> Retruths (%{customdata[3]})"
                         "<br>verifiziert: %{customdata[1]} · Follower: %{customdata[2]}"), "retruth_top")
    _tabelle(pd.DataFrame({
        "Konto": top["beschriftung"], "Konto-ID": top["konto_id"], "Anzeigename": top["anzeigename"],
        "verifiziert": top["verifiziert"],
        "Follower (bei Erfassung)": top["follower"], "Trump selbst": top["ist_trump"], "Retruths": top["anzahl"],
        "Anteil": top["anteil"].map(prozent),
    }))

    st.subheader("Retruth-Latenz")
    st.caption("Wie lange nach dem Original er es retruthed hat.")
    _zeige(_saeulen(r.latenz_verteilung["klasse"], r.latenz_verteilung["anzahl"], stil, y_titel="Retruths",
                    hover="%{x}: <b>%{y}</b> Retruths"), "retruth_latenz")
    _tabelle(r.latenz_verteilung.rename(columns={"klasse": "Latenz", "anzahl": "Retruths"}))


def _reiter_duplikate(df: pd.DataFrame, daten: auswertung.Daten, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    d = auswertung.duplikat_auswertung(df, daten.duplikate)
    k = st.columns(4)
    k[0].metric("Geprüfte Posts", zahl(d.gepruefte), help="Posts, deren 14 Tage davor vollständig erfasst sind.")
    k[1].metric("Mit Duplikat", zahl(d.mit_duplikat), help="Geprüfte Posts mit mindestens einem Duplikat.")
    k[2].metric("Duplikat-Rate", prozent(d.rate))
    k[3].metric("Ohne vollständiges Fenster", zahl(d.ohne_abdeckung),
                help="Für diese Posts fehlen Daten aus den 14 Tagen davor; sie zählen nicht zur Rate.")
    st.caption("Duplikat = in den 14 Tagen davor dasselbe schon gepostet oder retruthed. Rate und Grafiken "
               "beziehen sich nur auf Posts, deren 14-Tage-Fenster vollständig in der Datenbank liegt; die "
               "Säulen summieren sich daher zu „Mit Duplikat“.")
    if d.mit_duplikat_ohne_abdeckung:
        st.caption(f"Dazu {zahl(d.mit_duplikat_ohne_abdeckung)} Posts ohne vollständiges Fenster, bei denen trotzdem "
                   "ein Duplikat gefunden wurde. Sie stehen nur in der Tabelle „Alle Duplikat-Treffer“.")
    if d.liste.empty:
        _leer("Keine Duplikate in der Auswahl.")
        return
    st.subheader("Duplikate nach Art")
    st.caption("Je Post zählt die stärkste Art (gleiches Original vor exakt vor nur Text/Medien vor ähnlich).")
    arten = d.nach_art.loc[d.nach_art["primaer"] > 0]
    if arten.empty:
        _leer("Keine Duplikate bei geprüften Posts.")
    else:
        _zeige(_balken(arten["beschriftung"].tolist(), arten["primaer"].tolist(), stil, x_titel="Posts",
                       hover="%{y}: <b>%{x}</b> Posts"), "dup_art")
    _tabelle(pd.DataFrame({
        "Art": d.nach_art["beschriftung"], "Geprüfte Posts (stärkste Art)": d.nach_art["primaer"],
        "Geprüfte Posts (alle Treffer)": d.nach_art["alle"],
        "Anteil an geprüften Posts": d.nach_art["anteil_gepruefte"].map(prozent),
        "Ohne vollständiges Fenster (stärkste Art)": d.nach_art["primaer_ohne_abdeckung"],
    }))

    st.subheader("Zeitlicher Abstand zum früheren Post")
    verteilung = d.abstand_verteilung
    if verteilung.empty or len(verteilung.columns) == 0:
        _leer("Keine Duplikate bei geprüften Posts.")
    else:
        _zeige(_gestapelt(verteilung, DUP_PLATZ, DUP_BESCHRIFTUNG, stil, y_titel="Posts", x_datum=False),
               "dup_abstand")
        tabelle = verteilung.rename(columns=DUP_BESCHRIFTUNG).reset_index().rename(columns={"klasse": "Abstand"})
        _tabelle(tabelle)
    _tabelle(pd.DataFrame({
        "Post-ID": d.liste["post_id"], "Art": d.liste["art"].map(lambda x: DUP_BESCHRIFTUNG.get(x, x)),
        "stärkste Art": d.liste["primaer"], "Fenster vollständig": d.liste["geprueft"],
        "Früherer Post-ID": d.liste["frueherer_post_id"], "Abstand (h)": d.liste["abstand_h"].round(2),
    }), titel="Alle Duplikat-Treffer")


def _reiter_loeschungen(df: pd.DataFrame, daten: auswertung.Daten, stil: Stil) -> None:
    if df.empty:
        _leer()
        return
    le = auswertung.loeschungen_edits(df, daten.edits)
    k = st.columns(4)
    k[0].metric("Gelöscht", zahl(le.geloescht), help="Einzelabruf ergab eindeutig „nicht gefunden“ (404).")
    k[1].metric("Vermisst, unklar", zahl(le.vermisst),
                help="Fehlte in der Timeline, der Einzelabruf war aber nicht eindeutig. Zählt nicht als gelöscht.")
    k[2].metric("Posts mit Edits", zahl(le.posts_mit_edits))
    k[3].metric("Edits gesamt", zahl(le.edits_gesamt))

    st.subheader("Zeit bis zur Löschung")
    if le.loeschungen.empty:
        _leer("Keine gelöschten Posts in der Auswahl.")
    else:
        st.caption("Jede Linie reicht von „zuletzt gesehen“ (so lange war der Post mindestens online) bis "
                   "„erstmals vermisst“ (spätestens dann war er weg), jeweils in Stunden nach dem Post.")
        neueste = le.loeschungen.sort_values("erstellt", ascending=False).head(40)
        if len(le.loeschungen) > len(neueste):
            st.caption(f"Grafik zeigt die {len(neueste)} neuesten Löschungen; alle stehen in der Tabelle.")
        _zeige(_intervalle(neueste, stil), "loeschungen_intervalle")
        alle = le.loeschungen
        _tabelle(pd.DataFrame({
            "Post-ID": alle["id"], "Link": alle["url"], "Erstellt": [f"{t:%d.%m.%Y %H:%M}" for t in alle["erstellt"]],
            "Typ": alle["typ_detail"].map(lambda t: TYP_DETAIL_BESCHRIFTUNG.get(t, t)),
            "Format": alle["format"].map(lambda f: FORMAT_BESCHRIFTUNG.get(f, f)),
            "Zuletzt gesehen": [f"{t:%d.%m.%Y %H:%M}" for t in alle["zuletzt_gesehen"]],
            "Erstmals vermisst": [f"{t:%d.%m.%Y %H:%M}" if pd.notna(t) else "" for t in alle["vermisst_seit"]],
            "frühestens (h)": alle["min_h"].round(1), "spätestens (h)": alle["max_h"].round(1),
        }), column_config={"Link": st.column_config.LinkColumn(display_text="öffnen")})

    st.subheader("Edits")
    st.caption("Nur eigene Posts. Erkannt am geänderten Zeitstempel „edited_at“ oder am geänderten "
               "Inhalts-Fingerabdruck; mehrere Edits zwischen zwei Läufen zählen als einer.")
    if le.edits.empty:
        _leer("Keine Edits in der Auswahl.")
        return
    _zeige(_balken(le.edits_nach_art["beschriftung"].tolist(), le.edits_nach_art["anzahl"].tolist(), stil,
                   x_titel="Edits", hover="%{y}: <b>%{x}</b>"), "edits_art")
    _tabelle(pd.DataFrame({
        "Post-ID": le.edits["post_id"], "Erkannt": [f"{t:%d.%m.%Y %H:%M}" for t in le.edits["erkannt"]],
        "Art": le.edits["art"].map(lambda x: auswertung.EDIT_BESCHRIFTUNG.get(x, x)),
        "Stunden nach dem Post": le.edits["nach_h"].round(1),
    }))


def _konto_delta(reihe: pd.DataFrame, feld: str, seit: str) -> dict[str, Any]:
    """Veränderung seit der ersten Messung im Zeitraum für ``st.metric``.

    Streamlit erkennt einen Rückgang nur an einem führenden ASCII-Minus (nicht am typografischen
    „−“) und „keine Änderung“ nur am Text „0“; sonst zeigte ein Rückgang einen grünen Pfeil nach
    oben. Ohne Änderung daher kein Pfeil, nur der Hinweis im Tooltip.
    """
    erste, letzte = reihe[feld].iloc[0], reihe[feld].iloc[-1]
    if len(reihe) < 2 or pd.isna(erste) or pd.isna(letzte):
        return {}
    wert = int(letzte) - int(erste)
    if wert == 0:
        return {"help": f"Unverändert {seit}."}
    return {
        "delta": f"{'+' if wert > 0 else '-'}{zahl(abs(wert))} {seit}",
        "delta_color": "normal" if feld == "follower" else "off",
    }


def _reiter_account(daten: auswertung.Daten, a: Auswahl, stil: Stil) -> None:
    konto = daten.konto.loc[auswertung.im_zeitraum(daten.konto["gemessen_utc"], a.von, a.bis, a.zeitzone)]
    reihe = auswertung.konto_zeitreihe(konto, a.zeitzone)
    st.caption("Ein Konto-Snapshot pro Lauf. Es gilt nur der Zeitraum-Filter.")
    if reihe.empty:
        _leer("Keine Konto-Werte im gewählten Zeitraum.")
        return
    erste, letzte = reihe.iloc[0], reihe.iloc[-1]
    seit = f"seit {erste['gemessen']:%d.%m.%Y}"
    k = st.columns(3)
    for spalte, (feld, name) in zip(k, (("follower", "Follower"), ("folgt", "Folgt"),
                                        ("posts_gesamt", "Posts gesamt")), strict=True):
        spalte.metric(name, zahl(letzte[feld]), **_konto_delta(reihe, feld, seit))
    links, mitte, rechts = st.columns(3)
    for ort, (feld, name) in zip((links, mitte, rechts), (("follower", "Follower"), ("folgt", "Folgt"),
                                                         ("posts_gesamt", "Posts gesamt")), strict=True):
        with ort:
            st.markdown(f"**{name}**")
            werte = pd.to_numeric(reihe[feld], errors="coerce").astype(float)
            fig = _linie(reihe["gemessen"].dt.tz_localize(None), werte, stil, name=name, y_titel="", format_=",.0f",
                         hoehe=260)
            fig.update_xaxes(tickformat="%d.%m.", hoverformat="%d.%m.%Y %H:%M")
            if werte.notna().any():
                _zaehlachse(fig, float(werte.max()), minimum=float(werte.min()), ab_null=False)
            _zeige(fig, f"konto_{feld}")
    _tabelle(pd.DataFrame({
        "Gemessen": [f"{t:%d.%m.%Y %H:%M}" for t in reihe["gemessen"]], "Follower": reihe["follower"],
        "Folgt": reihe["folgt"], "Posts gesamt": reihe["posts_gesamt"],
        "Posts pro Tag (laut Zähler)": reihe["posts_pro_tag"].round(1),
    }))


def _reiter_tabelle(df: pd.DataFrame, a: Auswahl) -> None:
    if df.empty:
        _leer()
        return
    tabelle = auswertung.posts_tabelle(df)
    st.caption(f"{zahl(len(tabelle))} Posts, nur Metadaten. Der Link führt zum Post auf Truth Social, bei "
               "Retruths zum Original. Zeiten in UTC und in der gewählten Zeitzone. Anders als die Auswertungen "
               "enthält die Tabelle auch Posts vor Beginn der Erfassung (Spalte „Vor Beginn der Erfassung“).")
    st.dataframe(_anzeige(tabelle), hide_index=True, height=520,
                 column_config={"Link": st.column_config.LinkColumn(display_text="öffnen")})
    st.download_button(
        "CSV herunterladen", data=auswertung.csv_export(tabelle), mime="text/csv", key="csv_export",
        file_name=f"truthtracker-posts-{a.von:%Y%m%d}-{a.bis:%Y%m%d}.csv",
    )
    st.caption("Für deutsches Excel: Semikolon-getrennt, UTF-8 mit BOM, Dezimalkomma. IDs stehen als Excel-Text "
               "(=\"…\"), damit Excel die 18-stelligen Zahlen nicht auf 15 Stellen rundet; andere Programme "
               "zeigen sie mit diesem Zusatz.")


def _reiter_laeufe(daten: auswertung.Daten, a: Auswahl, stil: Stil) -> None:
    laeufe = daten.laeufe.loc[auswertung.im_zeitraum(daten.laeufe["start_utc"], a.von, a.bis, a.zeitzone)]
    st.caption("Laufprotokoll des Crawlers. Es gilt nur der Zeitraum-Filter.")
    if laeufe.empty:
        _leer("Keine Läufe im gewählten Zeitraum.")
        return
    letzter = laeufe.sort_values("id").iloc[-1]
    k = st.columns(5)
    k[0].metric("Läufe", zahl(len(laeufe)))
    start = letzter["start_utc"].tz_convert(a.zeitzone)
    status = auswertung.LAUF_STATUS_BESCHRIFTUNG.get(letzter["status"], letzter["status"])
    k[1].metric("Letzter Lauf", f"{start:%d.%m.}", help=f"Start {start:%d.%m.%Y %H:%M}, Status: {status}")
    k[2].metric("API-Anfragen", zahl(laeufe["anfragen_api"].sum()))
    k[3].metric("Cloudflare-Challenges", zahl(laeufe["cloudflare_challenges"].sum()))
    k[4].metric("Abgebrochen oder Fehler", zahl(laeufe["status"].isin(["abgebrochen", "fehler", "abgestuerzt"]).sum()))
    st.subheader("API-Anfragen pro Lauf")
    namen = [f"#{i} · {t.tz_convert(a.zeitzone):%d.%m. %H:%M}" for i, t in zip(laeufe["id"], laeufe["start_utc"],
                                                                               strict=True)]
    _zeige(_saeulen(namen, laeufe["anfragen_api"].tolist(), stil, y_titel="Anfragen",
                    hover="Lauf %{x}: <b>%{y}</b> API-Anfragen"), "laeufe_anfragen")
    _tabelle(auswertung.laeufe_tabelle(laeufe, a.zeitzone), titel="Laufprotokoll", height=400)


# ---------------------------------------------------------------------------
# Seite


def main() -> None:
    st.set_page_config(page_title="Truth-Social-Tracker", page_icon=":material/monitoring:", layout="wide")
    stil = _stil()
    try:
        einstellungen = konfig.lade(_konfig_datei())
    except konfig.KonfigFehler as fehler:
        st.title("Truth-Social-Tracker")
        st.error(f"Die Konfiguration ist fehlerhaft: {fehler}")
        return
    st.title(f"Postingverhalten von @{einstellungen.konto.handle}")
    pfad = einstellungen.datenbank_pfad
    if not pfad.is_file():
        st.info(f"Noch keine Datenbank gefunden ({pfad}). Bitte zuerst einen Lauf mit run_crawl.bat starten; "
                "danach erscheinen hier die Auswertungen.")
        return
    try:
        daten = _lade(str(pfad), _dateistand(pfad))
    except sqlite3.Error as fehler:
        st.error(f"Die Datenbank ließ sich nicht lesen ({fehler}). Läuft gerade ein Crawl, kurz warten und die "
                 "Seite neu laden.")
        return

    auswahl = _seitenleiste(daten, einstellungen, pfad)
    def posts_der_auswahl(von: date | None, bis: date | None, *, vor_erfassung: bool = False) -> pd.DataFrame:
        return auswertung.filtere(daten.posts, von, bis, auswahl.zeitzone, auswahl.typen, auswahl.formate,
                                  geloeschte=auswahl.geloeschte, vor_erfassung=vor_erfassung)

    df = posts_der_auswahl(auswahl.von, auswahl.bis)
    # Dieselbe Auswahl ohne Zeitraum-Grenzen: Serien am Rand des Zeitraums zählen mit voller Länge.
    umfeld = posts_der_auswahl(None, None)
    mit_alten = posts_der_auswahl(auswahl.von, auswahl.bis, vor_erfassung=True)
    zusatz = ""
    if len(mit_alten) > len(df):
        zusatz = (f" Dazu {_posts(len(mit_alten) - len(df))} vor Beginn der Erfassung (z. B. alte gepinnte "
                  "Posts): nur in der Tabelle, nicht in den Auswertungen.")
    st.caption(f"Nur Metadaten – keine Texte, Medien oder Kommentare. Zeiten: {auswahl.zone_name}. "
               f"Zeitraum {auswahl.von:%d.%m.%Y}–{auswahl.bis:%d.%m.%Y}, {_posts(len(df))} in der Auswahl."
               + zusatz)
    if daten.posts.empty:
        st.info("Die Datenbank enthält noch keine Posts. Sobald ein Lauf mit run_crawl.bat Posts gespeichert hat, "
                "erscheinen hier die Auswertungen.")
    elif not auswahl.typen or not auswahl.formate:
        st.warning("Kein Post-Typ oder kein Format ausgewählt. Bitte in der Seitenleiste mindestens eines wählen.")
    elif df.empty:
        st.info("Im gewählten Zeitraum gibt es keine Posts, die zu den Filtern passen.")

    reiter = st.tabs(list(REITER))
    with reiter[0]:
        _reiter_ueberblick(df, daten, auswahl, stil)
    with reiter[1]:
        _reiter_tageszeiten(df, auswahl, stil)
    with reiter[2]:
        _reiter_abstaende(df, umfeld, auswahl, stil)
    with reiter[3]:
        _reiter_formate(df, auswahl, stil)
    with reiter[4]:
        _reiter_engagement(df, daten, auswahl, stil)
    with reiter[5]:
        _reiter_retruths(df, stil)
    with reiter[6]:
        _reiter_duplikate(df, daten, stil)
    with reiter[7]:
        _reiter_loeschungen(df, daten, stil)
    with reiter[8]:
        _reiter_account(daten, auswahl, stil)
    with reiter[9]:
        _reiter_tabelle(mit_alten, auswahl)
    with reiter[10]:
        _reiter_laeufe(daten, auswahl, stil)


if __name__ == "__main__":
    main()
