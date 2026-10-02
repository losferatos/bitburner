"""Feldkatalog: welche Felder liefert die API, ohne dass ein einziger Inhalt mitgeschrieben wird.

Für jedes JSON-Objekt werden nur Pfade (``reblog.account.followers_count``), Typen und
Häufigkeiten gezählt. Werte werden ausschließlich in drei eng begrenzten Fällen
festgehalten, weil sie selbst keine Inhalte sind:

* Aufzählungswerte an fest benannten Stellen (``visibility``, ``media_attachments[].type``,
  ``card.type``), und nur, wenn sie wie ein Kennwort aussehen (``[a-z_]``, max. 20 Zeichen).
* Die *Form* von Zeitstempeln (Ziffern durch ``D`` ersetzt), damit klar wird, ob
  Millisekunden und Zeitzone mitkommen.
* Die Ziffernzahl rein numerischer IDs.

Schlüssel, die nicht wie Feldnamen aussehen (Leerzeichen, Sonderzeichen, Zahlen am
Anfang), werden durch ``{schluessel}`` ersetzt; Objekte mit sehr vielen Schlüsseln gelten
als Wörterbuch und werden zu ``{*}`` zusammengefasst. So kann auch ein Inhalt, der als
Schlüssel daherkommt, nicht in den Bericht geraten.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

_SCHLUESSEL_OK = re.compile(r"^[A-Za-z_][A-Za-z0-9_\-]{0,63}$")
_ZEITSTEMPEL = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$")
_KENNWORT = re.compile(r"^[a-z][a-z_]{0,19}$")
_MAX_SCHLUESSEL = 80

_ENUM_FELDER = {"visibility"}
_ENUM_ELTERN_FUER_TYPE = {"media_attachments[]", "card"}


def _typname(wert: Any) -> str:
    if wert is None:
        return "null"
    if isinstance(wert, bool):
        return "bool"
    if isinstance(wert, int):
        return "int"
    if isinstance(wert, float):
        return "float"
    if isinstance(wert, str):
        return "str"
    if isinstance(wert, list):
        return "list"
    if isinstance(wert, dict):
        return "object"
    return "anderes"


def _ist_enum_pfad(pfad: str) -> bool:
    teile = pfad.split(".")
    if teile[-1] in _ENUM_FELDER:
        return True
    return teile[-1] == "type" and len(teile) >= 2 and teile[-2] in _ENUM_ELTERN_FUER_TYPE


def _ist_id_pfad(pfad: str) -> bool:
    letzter = pfad.split(".")[-1]
    return letzter == "id" or letzter.endswith("_id")


class Feldkatalog:
    def __init__(self) -> None:
        self.objekte = 0
        self._felder: dict[str, dict[str, Any]] = {}

    def aufnehmen(self, objekt: Any) -> None:
        self.objekte += 1
        self._gehe(objekt, "")

    def aufnehmen_alle(self, objekte: list[Any]) -> None:
        for objekt in objekte:
            self.aufnehmen(objekt)

    def pfade(self) -> set[str]:
        return set(self._felder)

    def _eintrag(self, pfad: str) -> dict[str, Any]:
        return self._felder.setdefault(
            pfad, {"n": 0, "typen": Counter(), "werte": Counter(), "muster": Counter(), "max_laenge": 0}
        )

    def _notiere(self, pfad: str, wert: Any) -> None:
        eintrag = self._eintrag(pfad)
        eintrag["n"] += 1
        eintrag["typen"][_typname(wert)] += 1
        if isinstance(wert, list):
            eintrag["max_laenge"] = max(eintrag["max_laenge"], len(wert))
        elif isinstance(wert, str):
            if _ist_enum_pfad(pfad) and _KENNWORT.match(wert):
                eintrag["werte"][wert] += 1
            elif _ZEITSTEMPEL.match(wert):
                eintrag["muster"][re.sub(r"\d", "D", wert)] += 1
            elif _ist_id_pfad(pfad) and wert.isdigit():
                eintrag["muster"][f"{len(wert)} Ziffern"] += 1

    def _gehe(self, wert: Any, pfad: str) -> None:
        if isinstance(wert, dict):
            if len(wert) > _MAX_SCHLUESSEL:
                self._notiere(f"{pfad}.{{*}}" if pfad else "{*}", {})
                return
            for schluessel, kind in wert.items():
                name = schluessel if isinstance(schluessel, str) and _SCHLUESSEL_OK.match(schluessel) else "{schluessel}"
                kindpfad = f"{pfad}.{name}" if pfad else name
                self._notiere(kindpfad, kind)
                self._gehe(kind, kindpfad)
        elif isinstance(wert, list):
            elementpfad = f"{pfad}[]"
            for element in wert:
                if isinstance(element, (dict, list)):
                    self._gehe(element, elementpfad)
                else:
                    self._notiere(elementpfad, element)

    def als_dict(self) -> dict[str, Any]:
        felder = {}
        for pfad in sorted(self._felder):
            e = self._felder[pfad]
            eintrag: dict[str, Any] = {"vorkommen": e["n"], "typen": dict(sorted(e["typen"].items()))}
            if e["werte"]:
                eintrag["werte"] = dict(sorted(e["werte"].items()))
            if e["muster"]:
                eintrag["muster"] = dict(sorted(e["muster"].items()))
            if e["max_laenge"]:
                eintrag["max_laenge"] = e["max_laenge"]
            felder[pfad] = eintrag
        return {"objekte": self.objekte, "felder": felder}
