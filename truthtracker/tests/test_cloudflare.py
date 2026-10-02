import json

from truthtracker import cloudflare as cf


def test_json_200_mit_challenge_woertern_im_inhalt_ist_ok():
    # Ein Post darf "Just a moment" enthalten, ohne dass das als Cloudflare zählt.
    body = json.dumps([{"content": "<p>Just a moment, checking your browser cdn-cgi/challenge-platform</p>"}])
    assert cf.bewerte(200, {"content-type": "application/json"}, body).art == cf.OK


def test_cf_mitigated_header_ist_challenge():
    assert cf.bewerte(403, {"cf-mitigated": "challenge"}, b"<html></html>").art == cf.CHALLENGE


def test_challenge_seite_ohne_header():
    html = b"<html><head><title>Just a moment...</title></head><script src='/cdn-cgi/challenge-platform/x'></script>"
    assert cf.bewerte(503, {}, html).art == cf.CHALLENGE


def test_404_mit_json_fehler_ist_eindeutig_nicht_gefunden():
    bew = cf.bewerte(404, {"content-type": "application/json"}, b'{"error":"Record not found"}')
    assert bew.art == cf.NICHT_GEFUNDEN


def test_404_als_html_ist_nicht_eindeutig():
    assert cf.bewerte(404, {}, b"<html>Not found</html>").art == cf.UNERWARTET


def test_404_json_ohne_error_feld_ist_nicht_eindeutig():
    assert cf.bewerte(404, {}, b"{}").art == cf.UNERWARTET


def test_429_ist_ratelimit_mit_retry_after():
    bew = cf.bewerte(429, {"Retry-After": "120"}, b'{"error":"Too many requests"}')
    assert bew.art == cf.RATELIMIT and bew.abbruch and bew.hinweis == "120"


def test_geoblock_als_html_und_als_json():
    assert cf.bewerte(403, {}, b"<html>Truth Social is unavailable in your area.</html>").art == cf.GEOBLOCK
    assert cf.bewerte(403, {}, b'{"error":"Truth Social is unavailable in your area."}').art == cf.GEOBLOCK


def test_cloudflare_block():
    html = b"<html><title>Attention Required! | Cloudflare</title>Sorry, you have been blocked</html>"
    assert cf.bewerte(403, {}, html).art == cf.BLOCKIERT


def test_403_json_ohne_merkmale_ist_verweigert():
    bew = cf.bewerte(403, {}, b'{"error":"This method requires an authenticated user"}')
    assert bew.art == cf.VERWEIGERT and bew.abbruch


def test_5xx_und_netzwerk():
    assert cf.bewerte(502, {}, b"<html>bad gateway</html>").art == cf.SERVERFEHLER
    assert cf.bewerte(None, {}, None).art == cf.NETZWERKFEHLER
    assert not cf.bewerte(502, {}, b"").abbruch


def test_kopfzeilen_mehrfachwerte():
    class Mehrfach:
        def multi_items(self):
            return [("Set-Cookie", "a=1"), ("set-cookie", "b=2"), ("X-Test", "y")]

    h = cf.kopfzeilen(Mehrfach())
    assert h["set-cookie"] == "a=1, b=2" and h["x-test"] == "y"


def test_melde_ist_deutsch_und_nennt_status():
    assert "429" in cf.melde(cf.Bewertung(cf.RATELIMIT, 429, hinweis="60"))


def test_401_ist_login_noetig_und_kein_abbruch():
    bew = cf.bewerte(401, {}, b'{"error":"This method requires an authenticated user"}')
    assert bew.art == cf.LOGIN_NOETIG and not bew.abbruch
    assert cf.bewerte(401, {}, b"<html>Unauthorized</html>").art == cf.LOGIN_NOETIG
