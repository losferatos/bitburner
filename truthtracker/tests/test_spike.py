import json
from datetime import timedelta

import pytest

from conftest import browser_argumente_fuer_tests, chromium_pfad, finde_marker
from fabrik import JETZT, MARKER, karte, konto, medium, retruth, status
from fake_truthsocial import FakeTruthSocial, Zustand
from truthtracker import pfade, spike


def _zustand_mit_posts(anzahl: int = 100) -> Zustand:
    z = Zustand()
    fremd = konto("108000000000000001", "jemand", "Jemand Anders", verifiziert=False, follower=1234)
    posts = []
    for i in range(anzahl):
        zeit = JETZT - timedelta(hours=2 * i)
        if i % 5 == 1:
            posts.append(retruth(zeit, status(zeit - timedelta(hours=3), autor=fremd)))
        elif i % 7 == 2:
            posts.append(status(zeit, medien=[medium("image")]))
        elif i % 11 == 3:
            posts.append(status(zeit, karte_=karte()))
        else:
            posts.append(status(zeit))
    posts.append(status(JETZT - timedelta(days=60), gepinnt=True))
    z.setze_posts(posts)
    return z


def _einstellungen(url, **extra):
    werte = dict(basis_url=url, pause_min=0, pause_max=0, seiten=3, limit=40)
    werte.update(extra)
    return spike.Einstellungen(**werte)


def test_weg_a_funktioniert_und_bericht_ohne_inhalte(eigene_laufzeit):
    with FakeTruthSocial(_zustand_mit_posts()) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        anfragen = list(fake.zustand.anfragen)
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "funktioniert"
    assert daten["fazit"]["empfehlung"] == "a"
    # Client-Matrix (4) + lookup + 3 Seiten + gepinnt + einzelpost + Replies-Probe + 404-Probe + Vorschaubild
    assert a["anfragen"] == 13 == len(anfragen)
    assert [c["client"] for c in a["client_matrix"]] == [
        "python-urllib", "curl_cffi:chrome", "curl_cffi:safari", "curl_cffi:firefox"
    ]
    assert all(c["art"] == "ok" for c in a["client_matrix"])
    assert a["impersonate_gewaehlt"] == "chrome"
    assert a["probe_mit_replies"] == {"art": "login_noetig", "status": 401}
    timeline = [x for x in anfragen if x["pfad"].endswith("/statuses") and "max_id" not in x["params"]]
    assert timeline[0]["params"]["exclude_replies"] == "true"
    seiten = a["timeline"]
    # Seite 1 mit gepinntem Post oben; derselbe Post steht zusätzlich an seiner zeitlichen Stelle (Seite 3).
    assert [s["anzahl"] for s in seiten] == [41, 40, 21]
    assert seiten[0]["gepinnt_positionen"] == [0]
    assert seiten[2]["gepinnt_positionen"] == [20]
    assert seiten[1]["ueberlappung_mit_vorseite"] == 0
    assert seiten[0]["link_next_gleich_kleinster_id"] is True
    assert a["nicht_gefunden_probe"] == {
        "status": 404, "art": "nicht_gefunden", "json_schluessel": ["error"], "error_text": "Record not found"
    }
    assert a["medien_vorschau"]["art"] == "ok" and a["medien_vorschau"]["content_type"] == "image/png"
    # Geladen wird, was der Crawler für den Hash holt: bei Bildern das Original.
    assert a["medien_vorschau"]["hash_quelle"] == "original" and a["medien_vorschau"]["medienart"] == "bild"
    assert [x["pfad"] for x in anfragen if x["pfad"].startswith("/media/")] == [
        x["pfad"] for x in anfragen if x["pfad"].startswith("/media/original/")
    ]
    assert daten["fazit"]["anfragen_gesamt"] == 13
    assert a["gepinnt"] == {"anzahl": 1, "auch_in_timeline": 1}
    felder = daten["fazit"]["felder_vorhanden"]
    assert felder["reblog"] and felder["quote_id"] and felder["edited_at"]
    # Weder JSON- noch Markdown-Bericht enthalten Inhalte oder Medienpfade.
    ausgabe = pfade.docs_ordner() / "zugriff-messungen"
    assert finde_marker(ausgabe) == []
    for datei in ausgabe.iterdir():
        text = datei.read_text(encoding="utf-8")
        assert "/media/" not in text and "example.com" not in text
    assert len(list(ausgabe.glob("messung-*.md"))) == 1


def test_weg_a_bricht_bei_challenge_sofort_ab(eigene_laufzeit):
    z = _zustand_mit_posts(10)
    z.challenge_ohne_cookie = True
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        assert len(fake.zustand.anfragen) == 4  # nur die Client-Matrix, danach keine Anfrage mehr
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "kein_client_kam_durch"
    assert {c["art"] for c in a["client_matrix"]} == {"challenge"}
    assert daten["fazit"]["empfehlung"] == "keiner"
    assert list((pfade.docs_ordner() / "zugriff-messungen").glob("*.json"))


def test_weg_a_bricht_bei_429_ab_und_behaelt_bisheriges(eigene_laufzeit):
    z = _zustand_mit_posts(100)
    z.ratelimit_ab = 7  # Matrix (4), Lookup, erste Seite gehen durch, die siebte Anfrage bekommt 429
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        assert len(fake.zustand.api_anfragen()) == 7
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "abgebrochen" and a["abbruch"]["art"] == "ratelimit"
    assert "status" in daten["feldkataloge"]  # erste Seite wurde erfasst
    assert daten["feldkataloge"]["status"]["objekte"] == 41


def test_weg_a_geoblock(eigene_laufzeit):
    z = _zustand_mit_posts(5)
    z.geoblock = True
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    a = daten["wege"]["a"]
    assert a["ergebnis"] == "kein_client_kam_durch"
    assert {c["art"] for c in a["client_matrix"]} == {"geoblock"}


def test_weg_a_netzwerkfehler(eigene_laufzeit):
    z = _zustand_mit_posts(5)
    z.abbruch_pfade = [r"/statuses$"]
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    assert daten["wege"]["a"]["abbruch"]["art"] == "netzwerkfehler"


def test_client_matrix_waehlt_funktionierendes_ziel(eigene_laufzeit):
    z = _zustand_mit_posts(30)
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",), impersonate="edge"))
    a = daten["wege"]["a"]
    assert a["impersonate_gewaehlt"] == "chrome"  # "edge" war nicht in der Matrix, also das erste erfolgreiche
    assert 'impersonate = "chrome"' in daten["fazit"]["begruendung"]


def test_garantiert_fehlende_id_liegt_vor_dem_start_von_truth_social():
    # Snowflake von 2020-01-01: kleiner als jede echte ID (die erste ist von 2022).
    assert int(spike.GARANTIERT_FEHLENDE_ID) < int("107780257626128497")


def test_pfad_vorlage_ersetzt_ids_und_entfernt_werte():
    assert spike.pfad_vorlage("https://x/api/v1/accounts/123/statuses?max_id=99&limit=40") == (
        "/api/v1/accounts/{id}/statuses?limit&max_id"
    )


def test_kopf_auszug_ohne_cookie_werte():
    auszug = spike.kopf_auszug({"set-cookie": "__cf_bm=GEHEIM; path=/, _cfuvid=AUCHGEHEIM; path=/", "cf-ray": "1"})
    assert auszug["set-cookie_namen"] == ["__cf_bm", "_cfuvid"]
    assert "GEHEIM" not in json.dumps(auszug)


@pytest.mark.browser
@pytest.mark.parametrize("mit_challenge", [False, True])
def test_weg_b_mit_echtem_chromium(eigene_laufzeit, mit_challenge):
    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    z = _zustand_mit_posts(60)
    z.challenge_ohne_cookie = mit_challenge
    z.challenge_verzoegerung_ms = 4000  # lange genug, dass die Prüfung sichtbar ist
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(
            _einstellungen(
                fake.url, wege=("b",), browser=str(exe), headless=True,
                browser_argumente=tuple(browser_argumente_fuer_tests()), warte_challenge_s=30, warte_webapp_s=20,
            )
        )
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "funktioniert", json.dumps(b, indent=1)
    assert b["b1_passiv"] == "funktioniert"
    assert b["challenge"]["gesehen"] is mit_challenge
    if mit_challenge:
        assert b["challenge"]["geloest"] is True
    assert "/api/v1/accounts/{id}/statuses?exclude_replies&with_muted" in b["webapp_endpunkte"]
    assert b["b2_nicht_gefunden_probe"]["art"] == "nicht_gefunden"
    assert b["html_time_elemente"] >= 1
    assert "status_webapp" in daten["feldkataloge"]
    # Profil: nur noch Cookies und Einstellungen, kein Cache, und der Cache-Ordner ist weg.
    profil = pfade.profil_ordner()
    uebrig = sorted(p.relative_to(profil).as_posix() for p in profil.rglob("*") if p.is_file())
    erlaubt = {"Cookies", "Cookies-journal", "Local State", "Preferences", "Secure Preferences", "First Run",
               "Last Version", "Last Browser"}
    assert all(p.split("/")[-1] in erlaubt for p in uebrig), uebrig
    assert daten["aufraeumen"]["browser_cache_ordner_geloescht"] is True
    assert not any(pfade.temp_ordner().glob("browser-cache-*"))
    assert finde_marker(pfade.laufzeit(), pfade.docs_ordner()) == []
    if mit_challenge:
        # Die gelöste Prüfung bleibt als Cookie im Profil erhalten.
        assert any(p.endswith("Cookies") for p in uebrig)
    # Startseite ist die Konto-Abfrage; die Web-App stellt drei eigene API-Anfragen, gezählt im Bericht.
    assert b["webapp_anfragen"]["api"] == 3 and b["eigene_anfragen"] == 6
    from truthtracker import pruefung
    from truthtracker.konfig import Konfig

    bericht = pruefung.pruefe(Konfig(basisordner=eigene_laufzeit))
    assert bericht.ok, bericht.funde


def test_main_rueckgabecode(eigene_laufzeit):
    z = _zustand_mit_posts(10)
    z.challenge_ohne_cookie = True
    with FakeTruthSocial(z) as fake:
        code = spike.main(["--basis-url", fake.url, "--nur", "a", "--pause-min", "0", "--pause-max", "0"])
    assert code == 2


def test_marker_ist_in_fixtures():
    assert MARKER in status(JETZT)["content"]


# ---------------------------------------------------------------------------
# Weg a: Medienprobe lädt nur, was der Crawler für den Hash laden würde


def _zustand_mit_medien(*medien_listen: list[dict]) -> Zustand:
    """Je ein Post mit den angegebenen Anhängen (neueste zuerst), danach Posts ohne Medien."""
    z = Zustand()
    posts = [status(JETZT - timedelta(hours=i), medien=liste) for i, liste in enumerate(medien_listen)]
    posts += [status(JETZT - timedelta(hours=len(medien_listen) + i)) for i in range(10)]
    z.setze_posts(posts)
    return z


def _video_mit_datei_als_vorschau() -> dict:
    video = medium("video", dauer=5.0, datei="clip.mp4")
    video["preview_url"] = video["url"]  # .../media/original/clip.mp4: die Videodatei selbst
    return video


def test_weg_a_laedt_nie_die_videodatei_sondern_das_naechste_bild(eigene_laufzeit):
    bild = medium("image", datei="foto.png")
    with FakeTruthSocial(_zustand_mit_medien([_video_mit_datei_als_vorschau()], [bild])) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        medien_pfade = [x["pfad"] for x in fake.zustand.medien_anfragen()]
    vorschau = daten["wege"]["a"]["medien_vorschau"]
    assert not any(p.endswith(".mp4") for p in medien_pfade)
    assert medien_pfade == ["/media/original/foto.png"]
    assert vorschau["art"] == "ok" and vorschau["medienart"] == "bild" and vorschau["hash_quelle"] == "original"


def test_weg_a_ohne_ladbares_medium_keine_medienanfrage(eigene_laufzeit):
    with FakeTruthSocial(_zustand_mit_medien([_video_mit_datei_als_vorschau()])) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        assert fake.zustand.medien_anfragen() == []
    a = daten["wege"]["a"]
    assert a["medien_vorschau"] == {"art": "kein_medium_in_stichprobe"}
    assert a["anfragen"] == 11  # Matrix (4), Konto, 2 Seiten (die zweite leer), gepinnt, Einzelpost, 2 Proben


def test_weg_a_video_mit_bildvorschau_laedt_nur_die_vorschau(eigene_laufzeit):
    video = medium("video", dauer=5.0, datei="clip.mp4")
    video["preview_url"] = video["preview_url"].replace("clip.mp4", "clip.png")
    with FakeTruthSocial(_zustand_mit_medien([video])) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
        medien_pfade = [x["pfad"] for x in fake.zustand.medien_anfragen()]
    assert medien_pfade == ["/media/small/clip.png"]
    vorschau = daten["wege"]["a"]["medien_vorschau"]
    assert vorschau["art"] == "ok" and vorschau["medienart"] == "video" and vorschau["hash_quelle"] == "vorschau"


@pytest.mark.parametrize(
    ("adresse", "erwartet"),
    [
        # Kündigt 30 MB an: schon an der Kopfzeile abgelehnt, der Körper wird nicht gelesen.
        ("https://truthsocial.com/media/riesig.png", "zu_gross"),
        # Als Bild gemeldet, der Server liefert aber video/mp4: geschlossen, ohne zu lesen.
        ("https://truthsocial.com/media/original/falsch.mp4", "kein_bild"),
    ],
)
def test_weg_a_medienprobe_prueft_kopfzeilen_vor_dem_lesen(eigene_laufzeit, adresse, erwartet):
    bild = medium("image")
    bild["url"] = adresse
    with FakeTruthSocial(_zustand_mit_medien([bild])) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    vorschau = daten["wege"]["a"]["medien_vorschau"]
    assert vorschau["art"] == erwartet and vorschau["bytes"] == 0
    assert "abbruch" not in daten["wege"]["a"]  # ein abgelehntes Bild stoppt den Weg nicht


# ---------------------------------------------------------------------------
# 429 in Weg a, Laufsperre, Aufräumen


def test_nach_429_in_weg_a_startet_weg_b_nicht(eigene_laufzeit, monkeypatch, capsys):
    from truthtracker import pruefung
    from truthtracker.konfig import Konfig

    z = _zustand_mit_posts(100)
    z.ratelimit_ab = 7  # Matrix (4), Konto, erste Seite gehen durch, die zweite Seite bekommt 429
    gestartet = []
    monkeypatch.setattr(spike, "weg_b", lambda *args: gestartet.append(args))
    with FakeTruthSocial(z) as fake:
        code = spike.main(["--basis-url", fake.url, "--pause-min", "0", "--pause-max", "0", "--seiten", "3"])
        anfragen = list(fake.zustand.anfragen)
    assert code == 2
    assert gestartet == []
    # Nach dem ersten 429 erreicht nichts mehr den Server: keine Profilseite, keine weitere API-Anfrage.
    assert len(anfragen) == 7
    assert not any(a["pfad"].startswith("/@") for a in anfragen)
    daten = json.loads(next((pfade.docs_ordner() / "zugriff-messungen").glob("*.json")).read_text(encoding="utf-8"))
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "uebersprungen_ratelimit" and b["anfragen"] == 0 and "--nur b" in b["grund"]
    assert daten["fazit"]["empfehlung"] == "keiner"
    assert "429" in daten["fazit"]["begruendung"] and "run_spike.bat --nur b" in daten["fazit"]["begruendung"]
    assert "run_spike.bat --nur b" in capsys.readouterr().out
    # Der Bericht mit den neuen Texten besteht die Inhaltsprüfung.
    bericht = pruefung.pruefe(Konfig(basisordner=eigene_laufzeit))
    assert bericht.ok, bericht.funde


def test_fazit_nennt_ratelimit_auch_ohne_weg_b(eigene_laufzeit):
    z = _zustand_mit_posts(100)
    z.ratelimit_ab = 7
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_einstellungen(fake.url, wege=("a",)))
    assert "Rate-Limit (HTTP 429) bei Weg a" in daten["fazit"]["begruendung"]
    assert "b" not in daten["wege"]


def test_spike_startet_nicht_bei_belegter_laufsperre(eigene_laufzeit, capsys):
    from truthtracker import laufsperre

    rest = pfade.temp_ordner() / "anderer-lauf"
    rest.mkdir(parents=True)
    (rest / "arbeitsdatei").write_bytes(b"x")
    profil_datei = pfade.profil_ordner() / "Default" / "Cache" / "data_0"
    profil_datei.parent.mkdir(parents=True)
    profil_datei.write_bytes(b"x")
    sperre = laufsperre.Laufsperre()
    assert sperre.nehmen()
    try:
        with FakeTruthSocial(_zustand_mit_posts(5)) as fake:
            code = spike.main(["--basis-url", fake.url, "--pause-min", "0", "--pause-max", "0"])
            assert fake.zustand.anfragen == []
    finally:
        sperre.freigeben()
    assert code == spike.CODE_LAUFSPERRE == 3  # wie beim Crawl
    assert laufsperre.MELDUNG_BELEGT in capsys.readouterr().out
    # Temp-Ordner und Browserprofil des anderen Laufs bleiben unberührt, es entsteht kein Bericht.
    assert (rest / "arbeitsdatei").exists() and profil_datei.exists()
    assert not (pfade.docs_ordner() / "zugriff-messungen").exists()
    # Ist die Sperre frei, läuft der Spike und gibt sie danach wieder frei.
    with FakeTruthSocial(_zustand_mit_posts(5)) as fake:
        assert spike.fuehre_aus(_einstellungen(fake.url, wege=("a",))) is not None
    assert laufsperre.Laufsperre().nehmen()


def _unechter_browser(monkeypatch, ordner, freigabe) -> dict:
    """Ersetzt Start und Warten des Browsers; der "Browser" legt Cache-Reste in Profil und Cache-Ordner."""
    from truthtracker import browser

    exe = ordner / "browser.exe"
    exe.write_bytes(b"")
    gestartet: dict = {"exe": exe}

    class Prozess:
        def poll(self):
            return None

    def starte(fund, profil, cache, **optionen):
        gestartet.update(cache=cache, start_url=optionen.get("start_url"))
        (profil / "Default" / "Cache").mkdir(parents=True)
        (profil / "Default" / "Cache" / "data_0").write_text(MARKER, encoding="utf-8")
        (profil / "Default" / "Network").mkdir(parents=True)
        (profil / "Default" / "Network" / "Cookies").write_bytes(b"keks")
        cache.mkdir(parents=True)
        (cache / "f_000001").write_text(MARKER, encoding="utf-8")
        return browser.LaufenderBrowser(fund=fund, prozess=Prozess(), port=9, profil=profil)

    def prozesspruefung(*_args):
        raise AssertionError("der Spike darf die Prozessprüfung nicht selbst aufrufen")

    monkeypatch.setattr(browser, "starte_browser", starte)
    monkeypatch.setattr(browser, "warte_auf_freigabe", lambda *_a, **_k: freigabe)
    monkeypatch.setattr(browser, "_pid_lebt", prozesspruefung)
    return gestartet


def _nur_cookies_uebrig(daten: dict, gestartet: dict) -> None:
    profil = pfade.profil_ordner()
    uebrig = sorted(p.relative_to(profil).as_posix() for p in profil.rglob("*") if p.is_file())
    assert uebrig == ["Default/Network/Cookies"]
    assert daten["aufraeumen"]["browser_cache_ordner_geloescht"] is True and not gestartet["cache"].exists()
    assert finde_marker(pfade.laufzeit()) == []


def test_weg_b_raeumt_profil_und_cache_auf_auch_wenn_beenden_scheitert(eigene_laufzeit, monkeypatch):
    from truthtracker import browser

    freigabe = browser.Freigabe(geloest=False, challenge_gesehen=True, sperrseite=False, wartezeit_s=1.0)
    gestartet = _unechter_browser(monkeypatch, eigene_laufzeit, freigabe)

    def beende(*_args, **_optionen):
        # So scheiterte es unter deutschem Windows an der Ausgabe von tasklist.
        raise UnicodeDecodeError("utf-8", b"\x81", 0, 1, "invalid start byte")

    monkeypatch.setattr(browser, "beende_browser", beende)
    daten = spike.fuehre_aus(_einstellungen("http://127.0.0.1:9", wege=("b",), browser=str(gestartet["exe"])))
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "abgebrochen" and b["abbruch"]["schritt"] == "startseite"
    assert daten["aufraeumen"]["browser_beenden_fehler"] == ["UnicodeDecodeError"]
    _nur_cookies_uebrig(daten, gestartet)
    # Wie beim Crawler startet der Browser mit der Konto-Abfrage, nicht mit der Profilseite.
    assert gestartet["start_url"] == "http://127.0.0.1:9/api/v1/accounts/lookup?acct=realDonaldTrump"


def test_weg_b_fenster_vom_nutzer_geschlossen(eigene_laufzeit, monkeypatch):
    from truthtracker import browser

    freigabe = browser.Freigabe(
        geloest=False, challenge_gesehen=True, sperrseite=False, wartezeit_s=1.0, browser_beendet=True
    )
    gestartet = _unechter_browser(monkeypatch, eigene_laufzeit, freigabe)
    beendet = []
    monkeypatch.setattr(browser, "beende_browser", lambda lauf, pw_browser, **_: beendet.append(pw_browser) or True)
    daten = spike.fuehre_aus(_einstellungen("http://127.0.0.1:9", wege=("b",), browser=str(gestartet["exe"])))
    b = daten["wege"]["b"]
    # Keine angebliche Challenge, kein Anhängen von Playwright; aufgeräumt wird trotzdem.
    assert b["ergebnis"] == "browser_geschlossen" and "abbruch" not in b
    assert b["challenge"]["browser_beendet"] is True
    assert beendet == [None]
    _nur_cookies_uebrig(daten, gestartet)


# ---------------------------------------------------------------------------
# Weg b mit echtem Chromium: Medien, Sperrwörter in Posts, Abbruch nach der Profilseite


def _browser_einstellungen(url, **extra):
    exe = chromium_pfad()
    if exe is None:
        pytest.skip("kein Chromium vorhanden")
    werte = dict(
        wege=("b",), browser=str(exe), headless=True, browser_argumente=tuple(browser_argumente_fuer_tests()),
        warte_challenge_s=30, warte_webapp_s=20,
    )
    werte.update(extra)
    return _einstellungen(url, **werte)


@pytest.mark.browser
def test_weg_b_laedt_keine_medien_und_zaehlt_webapp_anfragen(eigene_laufzeit):
    from truthtracker import pruefung
    from truthtracker.konfig import Konfig

    z = Zustand()
    posts = []
    for i in range(12):
        zeit = JETZT - timedelta(hours=i)
        if i % 3 == 0:
            posts.append(status(zeit, medien=[medium("image"), medium("video", dauer=4.0, datei=f"clip{i}.mp4")]))
        elif i % 3 == 1:
            posts.append(status(zeit, medien=[medium("gifv", dauer=2.0, datei=f"schleife{i}.mp4")]))
        else:
            posts.append(status(zeit))
    z.setze_posts(posts)
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_browser_einstellungen(fake.url))
        anfragen = list(fake.zustand.anfragen)
        medien_anfragen = fake.zustand.medien_anfragen()
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "funktioniert", json.dumps(b, indent=1)
    # Die Web-App hat Bilder und Videos eingebaut, aber keine Anfrage danach erreichte den Server.
    assert medien_anfragen == []
    assert b["medien_gesperrt"] >= 12  # 4 Bilder, 4 Videos, 4 GIFs, dazu die Vorschaubilder
    # Der Browser startet mit der Konto-Abfrage, die Profilseite folgt erst nach dem Anhängen.
    assert anfragen[0]["pfad"] == "/api/v1/accounts/lookup"
    # Ehrlich gezählt: Startseite, Profilseite, 4 fetch-Aufrufe plus Konto, Timeline, Gepinnte der Web-App.
    assert b["eigene_anfragen"] == 6
    assert b["webapp_anfragen"] == {"api": 3, "sonstige": 0, "andere_hosts": 0}
    assert b["anfragen"] == 9 == daten["fazit"]["anfragen_gesamt"]
    # Alles, was den Server erreichte, ist gezählt, außer dem Favicon, das der Browser selbst holt.
    assert b["anfragen"] == len([a for a in anfragen if a["pfad"] != "/favicon.ico"])
    assert "favicon" in b["hinweis_anfragen"]
    assert finde_marker(pfade.laufzeit(), pfade.docs_ordner()) == []
    bericht = pruefung.pruefe(Konfig(basisordner=eigene_laufzeit))
    assert bericht.ok, bericht.funde


@pytest.mark.browser
def test_weg_b_sperrwoerter_in_posts_sind_keine_sperre(eigene_laufzeit):
    texte = [
        f"{MARKER} Sorry, you have been blocked",
        f"{MARKER} Truth Social is unavailable in your area.",
        f"{MARKER} Attention Required! | Cloudflare, error code: 1020",
        f"{MARKER} You are being rate limited",
    ]
    z = Zustand()
    posts = [status(JETZT - timedelta(minutes=i), text=t) for i, t in enumerate(texte)]
    posts += [status(JETZT - timedelta(hours=1 + i)) for i in range(10)]
    z.setze_posts(posts)
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_browser_einstellungen(fake.url))
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "funktioniert", json.dumps(b, indent=1)
    assert "abbruch" not in b
    assert b["html_time_elemente"] >= len(texte)  # die Web-App hat die Posts samt Text gerendert
    assert finde_marker(pfade.laufzeit(), pfade.docs_ordner()) == []


@pytest.mark.browser
@pytest.mark.parametrize("stoerung", ["ratelimit_webapp", "challenge_profilseite", "freigabe_abgelaufen"])
def test_weg_b_bricht_nach_profilseite_ab_ohne_eigene_anfragen(eigene_laufzeit, monkeypatch, stoerung):
    from truthtracker import browser

    z = _zustand_mit_posts(30)
    if stoerung == "ratelimit_webapp":
        z.ratelimit_ab = 3  # Startseite und Konto-Abfrage der Web-App gehen durch, ihre Timeline bekommt 429
    elif stoerung == "challenge_profilseite":
        z.challenge_pfade = [r"^/@"]
        z.challenge_verzoegerung_ms = 60_000
    else:
        z.challenge_ohne_cookie = True  # Prüfung auf der Startseite, die sich nach 0,8 s selbst löst
        anhaengen = browser.ermittle_browser_pid

        def freigabe_laeuft_ab(pw_browser):
            # Direkt nach dem Anhängen verfällt die Freigabe: ab der Profilseite wieder eine Prüfung.
            z.challenge_verzoegerung_ms = 60_000
            z.neue_freigabe_noetig()
            return anhaengen(pw_browser)

        monkeypatch.setattr(browser, "ermittle_browser_pid", freigabe_laeuft_ab)
    with FakeTruthSocial(z) as fake:
        daten = spike.fuehre_aus(_browser_einstellungen(fake.url))
        anfragen = list(fake.zustand.anfragen)
    b = daten["wege"]["b"]
    assert b["ergebnis"] == "abgebrochen", json.dumps(b, indent=1)
    assert b["abbruch"]["schritt"].startswith("profilseite")
    assert not b.get("b2_schritte")
    profilseite = next(i for i, a in enumerate(anfragen) if a["pfad"].startswith("/@"))
    danach = [a for a in anfragen[profilseite + 1:] if a["pfad"].startswith("/api/")]
    if stoerung == "ratelimit_webapp":
        assert b["abbruch"]["schritt"] == "profilseite_webapp" and b["abbruch"]["art"] == "ratelimit"
        assert "429" in b["webapp_endpunkte"]["/api/v1/accounts/{id}/statuses?exclude_replies&with_muted"]["status"]
        # Nur die Abrufe der Web-App selbst (Konto, Timeline, gepinnte Posts), keiner des Spikes.
        assert len(danach) <= 3
        assert all("limit" not in a["params"] for a in danach)
        assert not any(a["pfad"].startswith("/api/v1/statuses/") for a in danach)
        assert "Rate-Limit (HTTP 429) bei Weg b" in daten["fazit"]["begruendung"]
    else:
        assert b["abbruch"]["schritt"] == "profilseite" and b["abbruch"]["art"] == "challenge"
        assert b["profilseite_status"] == 403 and b["challenge"]["profilseite"] is True
        assert danach == []
    assert daten["aufraeumen"]["browser_cache_ordner_geloescht"] is True
