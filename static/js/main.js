(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const site = JSON.parse($('#site-data').textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav + mobile dock ---------- */
  const nav = $('#nav'), dock = $('#dock'), bookSection = $('#book');
  const onScroll = () => {
    nav.classList.toggle('is-stuck', scrollY > 20);
    const r = bookSection.getBoundingClientRect();
    const inBooking = r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4;
    dock.classList.toggle('is-on', scrollY > innerHeight * 0.5 && !inBooking);
    lightStatement();
  };

  /* ---------- Scroll reveals ---------- */
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        $$('[data-count]', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
  }

  function countUp(el) {
    const target = +el.dataset.count, t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Word-by-word statement ---------- */
  const statement = $('#statement');
  statement.innerHTML = statement.textContent.trim().split(/\s+/).map((w) => `<span>${w}</span>`).join(' ');
  const words = $$('span', statement);
  function lightStatement() {
    if (reduced) return;
    const r = statement.getBoundingClientRect();
    const p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.45);
    const n = Math.round(Math.max(0, Math.min(1, p)) * words.length);
    words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Card spotlight ---------- */
  $$('.card').forEach((card) => card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  /* ---------- Open now ---------- */
  (function openNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: site.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
    const mins = (+get('hour') % 24) * 60 + +get('minute');
    const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
    const today = site.hours[idx];
    const row = $(`#hours tr[data-day="${idx}"]`);
    if (row) row.classList.add('is-today');
    const dot = $('#openDot'), text = $('#openText');
    if (today.open && mins >= toMin(today.open) && mins < toMin(today.close)) {
      dot.classList.add('is-open');
      text.textContent = `Open now until ${today.close}`;
      return;
    }
    dot.classList.add('is-closed');
    if (today.open && mins < toMin(today.open)) { text.textContent = `Opens today at ${today.open}`; return; }
    for (let i = 1; i <= 7; i++) {
      const d = site.hours[(idx + i) % 7];
      if (d.open) { text.textContent = `Closed now. Opens ${i === 1 ? 'tomorrow' : d.day} at ${d.open}`; return; }
    }
  })();

  /* ---------- Booking ---------- */
  const state = { step: 1, service: null, serviceName: '', date: null, dateLabel: '', time: null, days: null, busy: false, ics: null };
  const panes = $$('.pane'), tabs = $$('.booker__tabs li');
  const nextBtn = $('#nextBtn'), backBtn = $('#backBtn'), bar = $('#bookerBar');
  const alertBox = $('#bookerAlert'), summary = $('#summary');
  const daysEl = $('#days'), slotsEl = $('#slots'), form = $('#detailsForm');

  const api = async (url, opts) => {
    const res = await fetch(url, opts);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || 'Something went wrong. Please call us.'), { body, status: res.status });
    return body;
  };
  const showAlert = (msg) => { alertBox.textContent = msg || ''; alertBox.hidden = !msg; };

  function render(focus) {
    panes.forEach((p) => p.classList.toggle('is-active', +p.dataset.pane === state.step));
    tabs.forEach((t) => {
      t.classList.toggle('is-active', +t.dataset.tab === state.step);
      t.classList.toggle('is-done', +t.dataset.tab < state.step);
    });
    bar.style.width = `${Math.min(100, (state.step / 3) * 100)}%`;
    backBtn.hidden = state.step === 1;
    $('#bookerFoot').hidden = state.step === 4;
    $('.booker__tabs').hidden = state.step === 4;
    nextBtn.textContent = state.busy ? 'Booking...' : state.step === 3 ? 'Confirm booking' : 'Continue';
    nextBtn.disabled = state.busy || (state.step === 1 && !state.service) || (state.step === 2 && !state.time);
    const bits = [];
    if (state.serviceName) bits.push(`<b>${state.serviceName}</b>`);
    if (state.date && state.time) bits.push(`<b>${state.dateLabel}, ${state.time}</b>`);
    summary.innerHTML = bits.join(' &middot; ');
    if (focus) {
      const h = $(`.pane[data-pane="${state.step}"] h3`);
      if (h) h.focus({ preventScroll: true });
      const top = $('#booker').getBoundingClientRect().top;
      if (top < 60 || top > innerHeight * 0.5) scrollTo({ top: scrollY + top - 84, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function selectService(id) {
    const input = $(`input[name="service"][value="${id}"]`);
    if (!input) return;
    input.checked = true;
    state.service = id;
    state.serviceName = input.nextElementSibling.textContent;
  }
  $$('input[name="service"]').forEach((i) => i.addEventListener('change', () => { selectService(i.value); render(); }));
  $$('[data-service]').forEach((c) => c.addEventListener('click', () => {
    selectService(c.dataset.service);
    if (state.step === 1) go(2); else render();
  }));

  async function loadDays(preferred) {
    try {
      const data = await api('/api/days');
      state.days = data.days;
      daysEl.innerHTML = '';
      data.days.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'day'; b.dataset.date = d.date;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        b.disabled = !d.free;
        b.innerHTML = `<small>${d.dow}</small><b>${d.day}</b><em>${!d.open ? 'Closed' : d.free ? d.month : 'Full'}</em>`;
        b.setAttribute('aria-label', `${d.dow} ${d.day} ${d.month}${!d.open ? ', closed' : d.free ? '' : ', fully booked'}`);
        b.addEventListener('click', () => pickDay(d.date));
        daysEl.appendChild(b);
      });
      const still = state.date && data.days.find((d) => d.date === state.date && d.free);
      const first = preferred || (still ? state.date : data.next && data.next.date);
      if (first) pickDay(first, true);
      else slotsEl.innerHTML = `<p class="slots__msg">We're fully booked online right now. Call ${site.phone} and we'll fit you in.</p>`;
      return data;
    } catch (err) {
      daysEl.innerHTML = '';
      slotsEl.innerHTML = `<p class="slots__msg">${err.message}</p>`;
    }
  }

  async function pickDay(date, keepTime) {
    const d = state.days.find((x) => x.date === date);
    if (!d) return;
    if (!(keepTime && state.date === date)) state.time = null;
    state.date = date;
    state.dateLabel = `${d.dow} ${d.day} ${d.month}`;
    $$('.day', daysEl).forEach((b) => {
      const on = b.dataset.date === date;
      b.setAttribute('aria-checked', on);
      if (on && state.step === 2) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    });
    render();
    try {
      const data = await api(`/api/availability?date=${date}`);
      if (state.date !== date) return;
      slotsEl.innerHTML = '';
      if (!data.slots.length) { slotsEl.innerHTML = '<p class="slots__msg">No times left on this day. Try another.</p>'; return; }
      if (!data.slots.some((s) => s.time === state.time && s.left)) state.time = null;
      data.slots.forEach((s, n) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.style.setProperty('--n', n);
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', s.time === state.time);
        b.disabled = !s.left;
        b.innerHTML = `${s.time}<small>${!s.left ? 'Booked' : s.left === 1 && site.capacity > 1 ? '1 space left' : 'Available'}</small>`;
        b.addEventListener('click', () => {
          state.time = s.time;
          $$('.slot', slotsEl).forEach((x) => x.setAttribute('aria-checked', x === b));
          render();
        });
        slotsEl.appendChild(b);
      });
      render();
    } catch (err) {
      slotsEl.innerHTML = `<p class="slots__msg">${err.message}</p>`;
    }
  }

  function go(step) {
    showAlert('');
    state.step = step;
    render(true);
  }

  function fieldErrors(errors) {
    $$('.field', form).forEach((f) => f.classList.remove('has-error'));
    $$('[data-err]', form).forEach((p) => { p.textContent = ''; });
    let first = null;
    Object.entries(errors || {}).forEach(([k, msg]) => {
      const p = $(`[data-err="${k}"]`, form);
      if (!p) return;
      p.textContent = msg;
      p.parentElement.classList.add('has-error');
      first = first || $('input,textarea', p.parentElement);
    });
    if (first) first.focus();
    return !first;
  }

  function validate() {
    const v = Object.fromEntries(new FormData(form));
    const e = {};
    if (v.name.trim().length < 2) e.name = 'Tell us your name.';
    const digits = v.phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) e.phone = 'Enter a phone number we can reach you on.';
    if (v.reg.replace(/[^a-z0-9]/gi, '').length < 2) e.reg = 'Enter your registration.';
    if (v.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) e.email = "That email doesn't look right.";
    return fieldErrors(e) ? v : null;
  }

  async function submit() {
    const v = validate();
    if (!v) return;
    state.busy = true; render();
    try {
      const res = await api('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, service: state.service, date: state.date, time: state.time }),
      });
      state.busy = false;
      $('#doneWhen').textContent = `${res.service}, ${res.when}`;
      $('#doneRef').textContent = res.ref;
      $('#doneGcal').href = res.gcal_url;
      state.ics = res.ics;
      go(4);
      $('#nextSlot').hidden = true;
    } catch (err) {
      state.busy = false;
      if (err.status === 409) {
        state.time = null;
        await loadDays(state.date);
        go(2);
        showAlert(err.message);
      } else if (err.body && err.body.fields && !fieldErrors(err.body.fields)) {
        render();
      } else {
        render();
        showAlert(err.message);
      }
    }
  }

  nextBtn.addEventListener('click', () => {
    if (state.step === 1) go(2);
    else if (state.step === 2) go(3);
    else if (state.step === 3) submit();
  });
  backBtn.addEventListener('click', () => go(state.step - 1));
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });

  $('#doneIcs').addEventListener('click', () => {
    const i = state.ics;
    if (!i) return;
    const esc = (s) => String(s).replace(/[\;,]/g, '\\$&').replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SGT Repair//Booking//EN', 'BEGIN:VEVENT',
      `UID:${i.uid}@sgt-repair`, `DTSTAMP:${i.start}`, `DTSTART:${i.start}`, `DTEND:${i.end}`,
      `SUMMARY:${esc(i.title)}`, `DESCRIPTION:${esc(i.details)}`, `LOCATION:${esc(i.location)}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `sgt-repair-${i.uid}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // Hero "next free slot" pill jumps straight to the time step with that slot selected.
  const nextSlot = $('#nextSlot');
  loadDays().then((data) => {
    if (!data || !data.next) return;
    $('#nextSlotText').textContent = `${data.next.label}, ${data.next.time}`;
    nextSlot.hidden = false;
    nextSlot.addEventListener('click', () => {
      state.time = data.next.time;
      pickDay(data.next.date, true);
      if (state.step < 4) go(state.service ? 2 : 1);
    });
  });
  render();
})();
