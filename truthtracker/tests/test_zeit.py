from datetime import UTC, datetime, timedelta, timezone

import pytest

from truthtracker import zeit


def test_parse_utc_varianten():
    assert zeit.parse_utc("2026-10-02T16:01:00.123Z") == datetime(2026, 10, 2, 16, 1, 0, 123000, tzinfo=UTC)
    assert zeit.parse_utc("2026-10-02T18:01:00+02:00") == datetime(2026, 10, 2, 16, 1, tzinfo=UTC)
    assert zeit.parse_utc("2026-10-02T16:01:00") == datetime(2026, 10, 2, 16, 1, tzinfo=UTC)  # ohne Zone = UTC
    # Nanosekunden (manche Felder kommen so) werden auf Mikrosekunden gekürzt, nicht verworfen.
    assert zeit.parse_utc("2026-10-02T16:01:00.123456789Z").microsecond == 123456
    for kaputt in (None, "", "gestern", 12, "2026-13-01T00:00:00Z"):
        assert zeit.parse_utc(kaputt) is None


def test_utc_text_ist_sekundengenau_und_utc():
    dt = datetime(2026, 10, 2, 18, 1, 2, 987654, tzinfo=timezone(timedelta(hours=2)))
    assert zeit.utc_text(dt) == "2026-10-02T16:01:02Z"
    assert zeit.utc_text(None) is None
    with pytest.raises(ValueError):
        zeit.utc_text(datetime(2026, 10, 2))


@pytest.mark.parametrize(
    ("utc", "zone", "erwartet", "abkuerzung"),
    [
        # Europa: Umstellung auf Sommerzeit am 29.03.2026 um 01:00 UTC
        ("2026-03-29T00:30:00Z", "Europe/Berlin", "2026-03-29 01:30", "CET"),
        ("2026-03-29T01:30:00Z", "Europe/Berlin", "2026-03-29 03:30", "CEST"),
        # Europa: zurück am 25.10.2026 um 01:00 UTC (02:00–03:00 gibt es zweimal)
        ("2026-10-25T00:30:00Z", "Europe/Berlin", "2026-10-25 02:30", "CEST"),
        ("2026-10-25T01:30:00Z", "Europe/Berlin", "2026-10-25 02:30", "CET"),
        # USA: Sommerzeit ab 08.03.2026 um 07:00 UTC
        ("2026-03-08T06:30:00Z", "America/New_York", "2026-03-08 01:30", "EST"),
        ("2026-03-08T07:30:00Z", "America/New_York", "2026-03-08 03:30", "EDT"),
        # USA: zurück am 01.11.2026 um 06:00 UTC
        ("2026-11-01T05:30:00Z", "America/New_York", "2026-11-01 01:30", "EDT"),
        ("2026-11-01T06:30:00Z", "America/New_York", "2026-11-01 01:30", "EST"),
        # Zwischen den Umstellungen: drei Wochen im März/April mit nur 5 h Abstand ET–Berlin
        ("2026-03-20T12:00:00Z", "America/New_York", "2026-03-20 08:00", "EDT"),
        ("2026-03-20T12:00:00Z", "Europe/Berlin", "2026-03-20 13:00", "CET"),
    ],
)
def test_sommerzeit_wechsel(utc, zone, erwartet, abkuerzung):
    lokal = zeit.in_zone(zeit.parse_utc(utc), zone)
    assert lokal.strftime("%Y-%m-%d %H:%M") == erwartet
    assert lokal.tzname() == abkuerzung


def test_kurznamen_der_zonen():
    dt = zeit.parse_utc("2026-07-01T12:00:00Z")
    assert zeit.in_zone(dt, "ET").hour == 8
    assert zeit.in_zone(dt, "Berlin").hour == 14


def test_alter_in_stunden():
    a = zeit.parse_utc("2026-10-01T00:00:00Z")
    assert zeit.alter_in_stunden(a, a + timedelta(hours=17, minutes=18)) == pytest.approx(17.3)


def test_snowflake_grenzen_und_rueckrechnung():
    dt = datetime(2026, 10, 2, 12, 0, tzinfo=UTC)
    unten, oben = zeit.id_untergrenze(dt), zeit.id_obergrenze(dt)
    assert oben - unten == 0xFFFF
    assert zeit.zeit_aus_id(unten) == dt
    assert zeit.zeit_aus_id(str(oben)) == dt
    # Bekannte Konto-ID von @realDonaldTrump: angelegt im Februar 2022
    assert zeit.zeit_aus_id("107780257626128497").strftime("%Y-%m") == "2022-02"


def test_utc_text_vierstelliges_jahr_und_extreme_werte():
    assert zeit.utc_text(datetime(999, 1, 2, 3, 4, 5, tzinfo=UTC)) == "0999-01-02T03:04:05Z"
    assert zeit.parse_utc("0001-01-01T00:00:00+01:00") is None
