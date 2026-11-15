import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("BOOKINGS_FILE", str(tmp_path / "bookings.json"))
    monkeypatch.delenv("GOOGLE_CALENDAR_ID", raising=False)
    import app as site
    site._store = None
    site._cache.update(at=0.0, key=None, events=None)
    site._attempts.clear()
    # Freeze "now" to Monday 16 Nov 2026, 08:00 London time.
    monkeypatch.setattr(site, "now", lambda: datetime(2026, 11, 16, 8, 0, tzinfo=site.TZ))
    return site.app.test_client()


def booking(**over):
    data = {"service": "brakes", "date": "2026-11-17", "time": "10:00", "name": "Sam Jones",
            "phone": "07700 900123", "reg": "ab12 cde"}
    data.update(over)
    return data


def test_slots_follow_opening_hours(client):
    weekday = client.get("/api/availability?date=2026-11-17").get_json()["slots"]
    assert [s["time"] for s in weekday] == [f"{h}:00" for h in range(10, 18)]
    saturday = client.get("/api/availability?date=2026-11-21").get_json()["slots"]
    assert saturday[-1]["time"] == "16:00"
    assert client.get("/api/availability?date=2026-11-22").get_json()["slots"] == []


def test_lead_time_hides_slots_that_are_too_soon(client, monkeypatch):
    import app as site
    monkeypatch.setattr(site, "now", lambda: datetime(2026, 11, 16, 12, 30, tzinfo=site.TZ))
    slots = client.get("/api/availability?date=2026-11-16").get_json()["slots"]
    assert slots[0]["time"] == "15:00"


def test_two_bookings_fill_a_slot_then_third_is_refused(client):
    assert client.post("/api/bookings", json=booking()).status_code == 201
    slots = client.get("/api/availability?date=2026-11-17").get_json()["slots"]
    assert slots[0] == {"time": "10:00", "left": 1}
    assert client.post("/api/bookings", json=booking(name="Second")).status_code == 201
    third = client.post("/api/bookings", json=booking(name="Third"))
    assert third.status_code == 409
    assert third.get_json()["code"] == "slot_taken"


def test_validation_and_closed_days(client):
    bad = client.post("/api/bookings", json=booking(name="", phone="12"))
    assert bad.status_code == 400
    assert set(bad.get_json()["fields"]) == {"name", "phone"}
    assert client.post("/api/bookings", json=booking(date="2026-11-22")).status_code == 409
    assert client.post("/api/bookings", json=booking(time="10:30")).status_code == 409


def test_all_day_calendar_event_closes_the_day(client, monkeypatch):
    import app as site
    day = datetime(2026, 11, 17, tzinfo=site.TZ)
    monkeypatch.setattr(site.store(), "events", lambda s, e: [
        {"start": day, "end": day + timedelta(days=1), "all_day": True}])
    slots = client.get("/api/availability?date=2026-11-17").get_json()["slots"]
    assert all(s["left"] == 0 for s in slots)


def test_home_page_and_days(client):
    page = client.get("/")
    assert page.status_code == 200 and b"SGT" in page.data
    data = client.get("/api/days").get_json()
    assert data["next"] == {"date": "2026-11-16", "time": "10:00", "label": "Mon 16 Nov"}
    assert len(data["days"]) == 29
