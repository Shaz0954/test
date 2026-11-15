/* Demo preview only: answers the booking API in the browser so the page works without a server.
   Nothing typed here is sent or saved anywhere. */
(() => {
  const site = JSON.parse(document.getElementById('site-data').textContent);
  const CAPACITY = site.capacity, LEAD = 120, WINDOW = 28;
  const booked = {};
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const hoursFor = (d) => site.hours[(d.getDay() + 6) % 7];

  function slots(d) {
    const h = hoursFor(d), out = [];
    if (!h.open) return out;
    const earliest = Date.now() + LEAD * 60000;
    for (let hr = +h.open.slice(0, 2); hr < +h.close.slice(0, 2); hr++) {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hr);
      if (start.getTime() < earliest) continue;
      const time = `${pad(hr)}:00`;
      out.push({ time, left: Math.max(0, CAPACITY - (booked[`${iso(d)} ${time}`] || 0)) });
    }
    return out;
  }
  function days() {
    const list = []; let next = null;
    const today = new Date();
    for (let i = 0; i <= WINDOW; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const free = slots(d).filter((s) => s.left);
      if (free.length && !next) next = { date: iso(d), time: free[0].time, label: `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` };
      list.push({ date: iso(d), dow: DOW[d.getDay()], day: d.getDate(), month: MON[d.getMonth()], open: !!hoursFor(d).open, free: free.length });
    }
    return { days: list, next };
  }
  function book(b) {
    const d = parse(b.date);
    const slot = slots(d).find((s) => s.time === b.time);
    if (!slot || !slot.left) return [409, { error: 'Sorry, that slot has just gone. Please pick another.', code: 'slot_taken' }];
    booked[`${b.date} ${b.time}`] = (booked[`${b.date} ${b.time}`] || 0) + 1;
    const name = document.querySelector(`input[name="service"][value="${b.service}"]`).nextElementSibling.textContent;
    const ref = 'SGT-' + Math.random().toString(16).slice(2, 8).toUpperCase();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +b.time.slice(0, 2));
    const stamp = (x) => x.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `${name} at SGT Repair`, dates: `${stamp(start)}/${stamp(new Date(start.getTime() + 3600000))}`, details: `Booking ref ${ref} (demo).`, location: site.address });
    return [201, { ok: true, ref, service: name, when: `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} at ${b.time}`, gcal_url: `https://calendar.google.com/calendar/render?${q}`, ics: null }];
  }
  window.fetch = async (url, opts) => {
    await new Promise((r) => setTimeout(r, 350));
    let status = 200, body;
    if (url.startsWith('/api/days')) body = days();
    else if (url.startsWith('/api/availability')) { const date = url.split('date=')[1]; body = { date, slots: slots(parse(date)) }; }
    else [status, body] = book(JSON.parse(opts.body));
    return { ok: status < 300, status, json: async () => body };
  };
})();
