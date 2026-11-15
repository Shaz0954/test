# SGT Repairs website

Single-page site for SGT Repairs (79-81 Cobbold Road, Leytonstone, London E11 3NS) with
online booking that reads and writes a Google Calendar.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python app.py          # http://localhost:8000
.venv/bin/pip install pytest && .venv/bin/python -m pytest tests
```

In production: `gunicorn app:app`.

## Connect Google Calendar

Until this is done, bookings are saved to `instance/bookings.json` so the site still works.

1. In Google Calendar create a calendar called e.g. "SGT Bookings". Under
   *Settings > Integrate calendar* copy its **Calendar ID**.
2. In [Google Cloud Console](https://console.cloud.google.com) create a project, enable the
   **Google Calendar API**, create a **service account** and download a JSON key for it.
3. Back in Google Calendar, *Settings > Share with specific people*: add the service
   account's email with **Make changes to events**.
4. Set two environment variables on the host (see `.env.example`):
   - `GOOGLE_CALENDAR_ID` - the ID from step 1
   - `GOOGLE_SERVICE_ACCOUNT_JSON` - the contents of the JSON key (raw or base64)
5. Restart. `/healthz` should report `"store": "google"`.

## How bookings behave

- Slots are one hour, inside the opening hours in `config.py`.
- Two cars can be booked per slot (one per mechanic). Change `CAPACITY` in `config.py`.
- Any event on the calendar uses up one space for the time it covers, so the mechanics can
  block time out by adding their own events.
- An all-day event (e.g. "Closed") closes the whole day for online booking.
- Each booking appears on the calendar as `Brakes - Sam Jones (AB12CDE)` with the phone
  number, reference and notes in the description.

## Editing content

Phone number, address, opening hours, services and FAQs all live in `config.py`.
