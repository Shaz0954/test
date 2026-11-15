"""Booking storage.

GoogleCalendarStore reads and writes a real Google Calendar using a service account.
LocalStore is a JSON-file fallback so the site works before Google is configured.
"""
import base64
import json
import os
import threading
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
API = "https://www.googleapis.com/calendar/v3"


def _parse(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class LocalStore:
    mode = "local"

    def __init__(self, path):
        self.path = path
        self._lock = threading.Lock()

    def _read(self):
        try:
            with open(self.path, encoding="utf-8") as fh:
                return json.load(fh)
        except (FileNotFoundError, ValueError):
            return []

    def events(self, start, end):
        out = []
        for row in self._read():
            s, e = _parse(row["start"]), _parse(row["end"])
            if s < end and e > start:
                out.append({"start": s, "end": e, "all_day": False})
        return out

    def create(self, start, end, summary, description, location):
        with self._lock:
            rows = self._read()
            rows.append({"start": start.isoformat(), "end": end.isoformat(),
                         "summary": summary, "description": description})
            os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(rows, fh, indent=2)
            os.replace(tmp, self.path)


class GoogleCalendarStore:
    mode = "google"

    def __init__(self, credentials_info, calendar_id, tz):
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_info(
            credentials_info, scopes=SCOPES)
        self.session = AuthorizedSession(creds)
        self.calendar_id = calendar_id
        self.tz = ZoneInfo(tz)
        self.tz_name = tz

    def _url(self):
        from urllib.parse import quote
        return f"{API}/calendars/{quote(self.calendar_id, safe='')}/events"

    def events(self, start, end):
        out, token = [], None
        while True:
            params = {"timeMin": start.isoformat(), "timeMax": end.isoformat(),
                      "singleEvents": "true", "maxResults": 2500}
            if token:
                params["pageToken"] = token
            resp = self.session.get(self._url(), params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("items", []):
                if item.get("status") == "cancelled" or item.get("transparency") == "transparent":
                    continue
                s, e = item.get("start", {}), item.get("end", {})
                if "dateTime" in s:
                    out.append({"start": _parse(s["dateTime"]), "end": _parse(e["dateTime"]),
                                "all_day": False})
                elif "date" in s:
                    # An all-day event (e.g. "Closed" or "Holiday") blocks the whole workshop.
                    sd = datetime.fromisoformat(s["date"]).date()
                    ed = datetime.fromisoformat(e["date"]).date()
                    out.append({"start": datetime.combine(sd, time.min, self.tz),
                                "end": datetime.combine(ed, time.min, self.tz),
                                "all_day": True})
            token = data.get("nextPageToken")
            if not token:
                return out

    def create(self, start, end, summary, description, location):
        body = {
            "summary": summary,
            "description": description,
            "location": location,
            "start": {"dateTime": start.isoformat(), "timeZone": self.tz_name},
            "end": {"dateTime": end.isoformat(), "timeZone": self.tz_name},
            "reminders": {"useDefault": True},
        }
        resp = self.session.post(self._url(), json=body, timeout=15)
        resp.raise_for_status()


def _load_credentials():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if raw:
        if not raw.startswith("{"):
            raw = base64.b64decode(raw).decode("utf-8")
        return json.loads(raw)
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return None


def get_store(tz):
    calendar_id = os.environ.get("GOOGLE_CALENDAR_ID", "").strip()
    info = _load_credentials()
    if calendar_id and info:
        return GoogleCalendarStore(info, calendar_id, tz)
    default = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "bookings.json")
    return LocalStore(os.environ.get("BOOKINGS_FILE", default))
