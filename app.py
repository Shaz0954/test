import logging
import os
import re
import secrets
import threading
import time as _time
from datetime import datetime, date, time, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request

import config
from calendar_store import get_store

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
log = logging.getLogger("sgt")

TZ = ZoneInfo(config.BUSINESS["timezone"])
SERVICES = {s["id"]: s for s in config.SERVICES}
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

_store = None
_store_lock = threading.Lock()
_cache = {"at": 0.0, "key": None, "events": None}
_book_lock = threading.Lock()
_attempts = {}


def store():
    global _store
    with _store_lock:
        if _store is None:
            _store = get_store(config.BUSINESS["timezone"])
            log.info("Booking store: %s", _store.mode)
        return _store


def now():
    return datetime.now(TZ)


def _hm(value):
    h, m = value.split(":")
    return time(int(h), int(m))


def day_slots(day):
    """All slot start times for a date, ignoring bookings."""
    hours = config.HOURS.get(day.weekday())
    if not hours:
        return []
    start = datetime.combine(day, _hm(hours[0]), TZ)
    close = datetime.combine(day, _hm(hours[1]), TZ)
    step = timedelta(minutes=config.SLOT_MINUTES)
    out = []
    while start + step <= close:
        out.append(start)
        start += step
    return out


def slots_left(slot, events):
    end = slot + timedelta(minutes=config.SLOT_MINUTES)
    used = 0
    for ev in events:
        if ev["start"] < end and ev["end"] > slot:
            used += config.CAPACITY if ev["all_day"] else 1
    return max(0, config.CAPACITY - used)


def availability(day, events, current=None):
    earliest = (current or now()) + timedelta(minutes=config.LEAD_MINUTES)
    return [{"time": s.strftime("%H:%M"), "left": slots_left(s, events)}
            for s in day_slots(day) if s >= earliest]


def window():
    today = now().date()
    return today, today + timedelta(days=config.BOOKING_WINDOW_DAYS)


def load_events(fresh=False):
    first, last = window()
    key = first.isoformat()
    if not fresh and _cache["key"] == key and _time.time() - _cache["at"] < 30:
        return _cache["events"]
    events = store().events(datetime.combine(first, time.min, TZ),
                            datetime.combine(last + timedelta(days=1), time.min, TZ))
    _cache.update(at=_time.time(), key=key, events=events)
    return events


def hours_table():
    rows = []
    for i, name in enumerate(DAY_NAMES):
        h = config.HOURS.get(i)
        rows.append({"day": name, "open": h[0] if h else None, "close": h[1] if h else None})
    return rows


@app.route("/")
def home():
    b = config.BUSINESS
    return render_template(
        "index.html", b=b, services=config.SERVICES, faqs=config.FAQS, hours=hours_table(),
        year=now().year,
        site_data={"hours": hours_table(), "timezone": b["timezone"], "phone": b["phone_display"],
                   "capacity": config.CAPACITY},
    )


@app.route("/api/days")
def api_days():
    try:
        events = load_events()
    except Exception:
        log.exception("Calendar read failed")
        return jsonify(error="We couldn't load the diary. Please call us instead."), 503
    first, last = window()
    current = now()
    days, nxt = [], None
    d = first
    while d <= last:
        slots = availability(d, events, current)
        free = [s for s in slots if s["left"] > 0]
        if free and nxt is None:
            nxt = {"date": d.isoformat(), "time": free[0]["time"],
                   "label": d.strftime("%a %-d %b")}
        days.append({"date": d.isoformat(), "dow": d.strftime("%a"), "day": d.day,
                     "month": d.strftime("%b"), "open": bool(config.HOURS.get(d.weekday())),
                     "free": len(free)})
        d += timedelta(days=1)
    return jsonify(days=days, next=nxt)


@app.route("/api/availability")
def api_availability():
    try:
        day = date.fromisoformat(request.args.get("date", ""))
    except ValueError:
        return jsonify(error="Invalid date."), 400
    first, last = window()
    if not first <= day <= last:
        return jsonify(date=day.isoformat(), slots=[])
    try:
        events = load_events()
    except Exception:
        log.exception("Calendar read failed")
        return jsonify(error="We couldn't load the diary. Please call us instead."), 503
    return jsonify(date=day.isoformat(), slots=availability(day, events))


def _clean(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _rate_limited(ip):
    cutoff = _time.time() - 3600
    hits = [t for t in _attempts.get(ip, []) if t > cutoff]
    limited = len(hits) >= 6
    if not limited:
        hits.append(_time.time())
    _attempts[ip] = hits
    return limited


@app.route("/api/bookings", methods=["POST"])
def api_book():
    data = request.get_json(silent=True) or {}
    if data.get("website"):  # honeypot field, real visitors never fill it
        return jsonify(ok=True), 201

    name = _clean(data.get("name"), 80)
    phone = re.sub(r"[^\d+]", "", str(data.get("phone") or ""))[:16]
    email = _clean(data.get("email"), 120)
    reg = re.sub(r"[^A-Za-z0-9]", "", str(data.get("reg") or "")).upper()[:8]
    vehicle = _clean(data.get("vehicle"), 60)
    notes = str(data.get("notes") or "").strip()[:600]
    service = SERVICES.get(data.get("service"))

    errors = {}
    if not service:
        errors["service"] = "Choose the work you need."
    if len(name) < 2:
        errors["name"] = "Tell us your name."
    if not 10 <= len(re.sub(r"\D", "", phone)) <= 13:
        errors["phone"] = "Enter a phone number we can reach you on."
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        errors["email"] = "That email doesn't look right."
    if len(reg) < 2:
        errors["reg"] = "Enter your registration."
    try:
        day = date.fromisoformat(str(data.get("date")))
        slot = datetime.combine(day, _hm(str(data.get("time"))), TZ)
    except (ValueError, TypeError):
        day = slot = None
        errors["time"] = "Choose a time."
    if errors:
        return jsonify(error="Please check the details below.", fields=errors), 400

    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    if _rate_limited(ip):
        return jsonify(error=f"Too many bookings from this device. Please call "
                             f"{config.BUSINESS['phone_display']}."), 429

    b = config.BUSINESS
    address = f"{b['name']}, {b['street']}, {b['city']} {b['postcode']}"
    end = slot + timedelta(minutes=config.SLOT_MINUTES)
    ref = "SGT-" + secrets.token_hex(3).upper()

    with _book_lock:
        try:
            events = load_events(fresh=True)
            first, last = window()
            valid = first <= day <= last and any(
                s["time"] == slot.strftime("%H:%M") and s["left"] > 0
                for s in availability(day, events))
            if not valid:
                return jsonify(error="Sorry, that slot has just gone. Please pick another.",
                               code="slot_taken"), 409
            description = "\n".join(filter(None, [
                f"Booking ref: {ref}", f"Work: {service['name']}", f"Customer: {name}",
                f"Phone: {phone}", f"Email: {email}" if email else "",
                f"Reg: {reg}", f"Vehicle: {vehicle}" if vehicle else "",
                f"Notes: {notes}" if notes else "", "", "Booked online via the website."]))
            store().create(slot, end, f"{service['name']} - {name} ({reg})", description, address)
            _cache["at"] = 0.0
        except Exception:
            log.exception("Booking failed")
            return jsonify(error=f"We couldn't save your booking. Please call "
                                 f"{b['phone_display']}."), 503

    fmt = "%Y%m%dT%H%M%SZ"
    utc = ZoneInfo("UTC")
    stamps = f"{slot.astimezone(utc).strftime(fmt)}/{end.astimezone(utc).strftime(fmt)}"
    title = f"{service['name']} at {b['name']}"
    details = f"Booking ref {ref}. Reg {reg}. Need to change it? Call {b['phone_display']}."
    gcal = "https://calendar.google.com/calendar/render?" + urlencode({
        "action": "TEMPLATE", "text": title, "dates": stamps, "details": details,
        "location": address})
    return jsonify(ok=True, ref=ref, service=service["name"],
                   when=slot.strftime("%A %-d %B at %H:%M"), gcal_url=gcal,
                   ics={"title": title, "start": stamps.split("/")[0], "end": stamps.split("/")[1],
                        "details": details, "location": address, "uid": ref}), 201


@app.route("/healthz")
def healthz():
    return jsonify(ok=True, store=store().mode)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
