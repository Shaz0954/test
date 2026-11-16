// Interactive simulators. Each mount(body) builds its UI and returns a cleanup function.
import { SIMS } from './data.js';
import { el, icon, markSim } from './game.js';
import { highlight, esc } from './md.js';

const fmtN = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)));
const fmtBytes = (b) => (b >= 1e12 ? (b / 1e12).toFixed(2) + ' TB' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB');
const slider = (id, label, min, max, value, step = 1) => `<label class="control"><span class="row">${label}<b data-val="${id}"></b></span><input type="range" data-id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
const kpi = (label, value, cls = '') => `<div class="kpi ${cls}"><span>${label}</span><b>${value}</b></div>`;

// ---------------------------------------------------------------------------
// 1. Orchestrator DAG
// ---------------------------------------------------------------------------
function dagSim(body) {
  const T = [
    ['extract_orders', 0, 0, []], ['extract_customers', 0, 1, []], ['extract_products', 0, 2, []],
    ['validate_raw', 1, 1, ['extract_orders', 'extract_customers', 'extract_products']],
    ['dim_customers', 2, 0, ['validate_raw']], ['dim_products', 2, 2, ['validate_raw']],
    ['fact_sales', 3, 1, ['dim_customers', 'dim_products']], ['dq_tests', 4, 1, ['fact_sales']],
    ['publish_dashboard', 5, 0, ['dq_tests']], ['export_ml_features', 5, 2, ['dq_tests']],
  ].map(([id, col, row, deps]) => ({ id, deps, x: 14 + col * 148, y: 18 + row * 66, mode: 'ok', st: 'idle', attempt: 0 }));
  const W = 132, H = 42, byId = Object.fromEntries(T.map((t) => [t.id, t]));
  let timer = null, tick = 0;

  body.innerHTML = `<p class="intro">A daily ELT pipeline. <b>Click a task</b> to cycle it between healthy → flaky (fails on its first attempt) → broken (always fails), then run the DAG.</p>
    <div class="controls"><button class="btn primary" data-run>${icon('play')} Run DAG</button><button class="btn" data-reset>Reset</button>
    <label class="control" style="min-width:90px"><span>Retries per task</span><select data-id="retries"><option>0</option><option selected>1</option><option>2</option></select></label>
    <label class="control" style="min-width:90px"><span>Max parallel tasks</span><select data-id="par"><option>1</option><option>2</option><option selected>3</option></select></label></div>
    <div class="dag-wrap"><svg viewBox="0 0 900 232"><g class="edges"></g><g class="nodes"></g></svg></div>
    <div class="legend">${[['queued', 'muted'], ['running', 'accent'], ['success', 'ok'], ['up for retry', 'warn'], ['failed', 'bad'], ['upstream failed', 'faint']].map(([n, c]) => `<span><i style="--c:var(--${c})"></i>${n}</span>`).join('')}</div>
    <div class="log" aria-live="polite"></div>
    <p class="sim-note"><b>Try this:</b> break <code>validate_raw</code> and watch everything downstream become <i>upstream failed</i>. Then make <code>fact_sales</code> flaky with 0 retries vs 1 retry.</p>`;
  const log = body.querySelector('.log'), edges = body.querySelector('.edges'), nodes = body.querySelector('.nodes');
  const say = (msg, cls = '') => { log.insertAdjacentHTML('beforeend', `<div class="${cls}">[t+${String(tick).padStart(2, '0')}s] ${msg}</div>`); log.scrollTop = log.scrollHeight; };

  edges.innerHTML = T.flatMap((t) => t.deps.map((d) => { const a = byId[d], x1 = a.x + W, y1 = a.y + H / 2, x2 = t.x, y2 = t.y + H / 2, mx = (x1 + x2) / 2; return `<path class="dag-edge" data-from="${d}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`; })).join('');
  nodes.innerHTML = T.map((t) => `<g class="dag-node" data-id="${t.id}" tabindex="0" role="button"><rect x="${t.x}" y="${t.y}" width="${W}" height="${H}" rx="9"/><text x="${t.x + W / 2}" y="${t.y + 18}" text-anchor="middle">${t.id}</text><text class="sub" x="${t.x + W / 2}" y="${t.y + 33}" text-anchor="middle"></text></g>`).join('');

  const paint = () => {
    for (const t of T) {
      const g = nodes.querySelector(`[data-id="${t.id}"]`);
      g.setAttribute('class', `dag-node ${t.st}`);
      const label = t.st === 'idle' ? (t.mode === 'ok' ? 'healthy' : t.mode) : t.st.replace(/_/g, ' ') + (t.attempt > 1 && t.st !== 'upstream_failed' ? ` · try ${t.attempt}` : '');
      g.querySelector('.sub').textContent = label;
    }
    edges.querySelectorAll('path').forEach((p) => p.classList.toggle('live', byId[p.dataset.from].st === 'success'));
  };
  const reset = () => { clearInterval(timer); timer = null; tick = 0; T.forEach((t) => { t.st = 'idle'; t.attempt = 0; }); log.innerHTML = ''; body.querySelector('[data-run]').disabled = false; paint(); };

  function step() {
    tick++;
    const retries = +body.querySelector('[data-id=retries]').value, par = +body.querySelector('[data-id=par]').value;
    for (const t of T) {
      if (t.st === 'running' && --t.left <= 0) {
        const fail = t.mode === 'broken' || (t.mode === 'flaky' && t.attempt === 1);
        if (!fail) { t.st = 'success'; say(`${t.id} succeeded`, 'ok'); }
        else if (t.attempt <= retries) { t.st = 'retry'; t.wait = 3; say(`${t.id} failed (attempt ${t.attempt}) — retrying after backoff`, 'warn'); }
        else { t.st = 'failed'; say(`${t.id} FAILED after ${t.attempt} attempt(s) — alert sent`, 'bad'); }
      } else if (t.st === 'retry' && --t.wait <= 0) t.st = 'queued';
    }
    for (const t of T) if ((t.st === 'idle' || t.st === 'queued') && t.deps.some((d) => ['failed', 'upstream_failed'].includes(byId[d].st))) { t.st = 'upstream_failed'; say(`${t.id} skipped: upstream failed`, 'warn'); }
    let running = T.filter((t) => t.st === 'running').length;
    for (const t of T) {
      if ((t.st !== 'idle' && t.st !== 'queued') || !t.deps.every((d) => byId[d].st === 'success')) continue;
      if (running < par) { t.st = 'running'; t.attempt++; t.left = 3 + Math.floor(Math.random() * 4); running++; say(`${t.id} started${t.attempt > 1 ? ` (attempt ${t.attempt})` : ''}`, 'info'); }
      else t.st = 'queued';
    }
    paint();
    if (T.every((t) => ['success', 'failed', 'upstream_failed'].includes(t.st))) {
      clearInterval(timer); timer = null;
      const ok = T.every((t) => t.st === 'success');
      say(ok ? `DAG run SUCCESS in ${tick}s — dashboard is fresh.` : `DAG run FAILED — ${T.filter((t) => t.st !== 'success').length} task(s) did not complete. Fix, then re-run (idempotent tasks make that safe).`, ok ? 'ok' : 'bad');
    }
  }
  body.querySelector('[data-run]').onclick = (e) => { reset(); e.currentTarget.disabled = true; say('Scheduler triggered daily_sales for 2025-06-01', 'info'); timer = setInterval(step, 420); step(); };
  body.querySelector('[data-reset]').onclick = reset;
  const cycle = (e) => {
    const g = e.target.closest('.dag-node');
    if (!g || timer || (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const t = byId[g.dataset.id];
    t.mode = { ok: 'flaky', flaky: 'broken', broken: 'ok' }[t.mode];
    T.forEach((x) => { x.st = 'idle'; x.attempt = 0; });
    body.querySelector('[data-run]').disabled = false;
    paint();
  };
  nodes.addEventListener('click', cycle); nodes.addEventListener('keydown', cycle);
  paint();
  return () => clearInterval(timer);
}

// ---------------------------------------------------------------------------
// 2. Kafka consumer lag
// ---------------------------------------------------------------------------
function kafkaSim(body) {
  const COLORS = ['#6c8cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#f97316', '#84cc16'];
  const S = { rate: 120, parts: 4, consumers: 2, speed: 50, hot: false };
  let P = [], acc = 0, rebalance = 0, history = [], consumedRate = 0, carry = [];
  const resetParts = () => { P = Array.from({ length: S.parts }, () => ({ end: 0, committed: 0 })); history = []; carry = []; };

  body.innerHTML = `<p class="intro">Producers append to a topic; a consumer group reads it. Each partition is read by exactly one consumer. Watch <b>lag</b> — the gap between what is written and what is processed.</p>
    <div class="controls">${slider('rate', 'Produce rate (msg/s)', 0, 400, S.rate, 10)}${slider('parts', 'Partitions', 1, 8, S.parts)}${slider('consumers', 'Consumers in group', 1, 8, S.consumers)}${slider('speed', 'Speed per consumer (msg/s)', 10, 150, S.speed, 10)}
    <label class="check"><input type="checkbox" data-id="hot"> Hot key (70% of traffic → P0)</label><button class="btn" data-reset>Reset offsets</button></div>
    <div class="kpis"></div><div class="parts"></div><div class="consumers"></div>
    <svg class="spark" viewBox="0 0 300 60" preserveAspectRatio="none"><polyline fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><p class="result-meta">Total consumer lag over time</p>
    <p class="sim-note"></p>`;
  const kpis = body.querySelector('.kpis'), parts = body.querySelector('.parts'), cons = body.querySelector('.consumers'), note = body.querySelector('.sim-note'), line = body.querySelector('polyline');
  const labels = () => Object.keys(S).forEach((k) => { const b = body.querySelector(`[data-val=${k}]`); if (b) b.textContent = S[k]; });
  body.addEventListener('input', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    S[id] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
    if (id === 'parts') resetParts();
    if (id === 'parts' || id === 'consumers') rebalance = 1.5;
    labels();
  });
  body.querySelector('[data-reset]').onclick = resetParts;
  resetParts(); labels();

  const dt = 0.1;
  const timer = setInterval(() => {
    acc += S.rate * dt;
    for (; acc >= 1; acc--) P[S.hot && Math.random() < 0.7 ? 0 : Math.floor(Math.random() * S.parts)].end++;
    let consumed = 0;
    if (rebalance > 0) rebalance -= dt;
    else {
      for (let c = 0; c < Math.min(S.consumers, S.parts); c++) {
        let budget = S.speed * dt + (carry[c] || 0);
        const mine = P.filter((_, i) => i % S.consumers === c).sort((a, b) => (b.end - b.committed) - (a.end - a.committed));
        for (const p of mine) { const n = Math.min(Math.floor(budget), p.end - p.committed); p.committed += n; budget -= n; consumed += n; }
        carry[c] = Math.min(budget, 1);
      }
    }
    consumedRate = consumedRate * 0.9 + (consumed / dt) * 0.1;
    const lags = P.map((p) => p.end - p.committed), total = lags.reduce((a, b) => a + b, 0), scale = Math.max(200, ...lags);
    history.push(total); if (history.length > 150) history.shift();
    const trend = history.length > 30 ? total - history[history.length - 30] : 0;
    const capacity = Math.min(S.consumers, S.parts) * S.speed;
    const state = rebalance > 0 ? ['Rebalancing…', 'warn'] : trend > 15 ? ['Falling behind', 'bad'] : total > 300 && trend < -15 ? ['Catching up', 'warn'] : ['Healthy', 'good'];
    kpis.innerHTML = kpi('Produced', S.rate + '/s') + kpi('Consumed', Math.round(consumedRate) + '/s') + kpi('Group capacity', capacity + '/s', capacity < S.rate ? 'bad' : '') + kpi('Total lag', fmtN(total), total > 500 ? 'bad' : '') + kpi('Status', state[0], state[1]);
    parts.innerHTML = P.map((p, i) => { const c = i % S.consumers; return `<div class="part" style="--c:${COLORS[c]}"><span>P${i}</span><div class="track"><i style="width:${Math.min(100, (lags[i] / scale) * 100)}%"></i></div><span class="lag">lag ${fmtN(lags[i])}</span><span class="who">consumer ${c + 1}</span></div>`; }).join('');
    cons.innerHTML = Array.from({ length: S.consumers }, (_, c) => c < S.parts ? `<span style="--c:${COLORS[c]}">consumer ${c + 1} → ${P.map((_, i) => i).filter((i) => i % S.consumers === c).map((i) => 'P' + i).join(', ')}</span>` : `<span class="idle">consumer ${c + 1} — idle (no partition left)</span>`).join('');
    const max = Math.max(100, ...history);
    line.setAttribute('points', history.map((v, i) => `${(i / 149) * 300},${58 - (v / max) * 54}`).join(' '));
    note.innerHTML = S.consumers > S.parts ? `<b>${S.consumers - S.parts} consumer(s) are idle.</b> A partition can only be read by one consumer in a group, so partitions cap parallelism. Add partitions to scale further.`
      : S.hot && lags[0] > 3 * (total / S.parts || 1) && total > 200 ? '<b>Hot partition.</b> P0 receives most traffic but still has only one reader. Adding consumers will not help — fix the key distribution or speed up processing.'
      : capacity < S.rate ? `<b>Under-provisioned.</b> The group can process ${capacity} msg/s but ${S.rate} msg/s arrive, so lag grows without bound. Add consumers or make each one faster.`
      : '<b>Stable.</b> Capacity exceeds the produce rate, so lag stays near zero. Raise the produce rate to see what happens.';
  }, dt * 1000);
  return () => clearInterval(timer);
}

// ---------------------------------------------------------------------------
// 3. Storage format & scan cost
// ---------------------------------------------------------------------------
function scanSim(body) {
  const ROWS_DAY = 50e6;
  const COLS = [['event_id', 20, 0.4], ['user_id', 12, 0.4], ['event_type', 10, 0.03], ['event_ts', 20, 0.25], ['url', 60, 0.3], ['user_agent', 120, 0.06], ['payload', 300, 0.35]].map(([name, raw, ratio]) => ({ name, raw, pq: raw * ratio }));
  const S = { fmt: 'parquet', partitioned: true, days: 7, cols: new Set(['user_id', 'event_type']) };
  body.innerHTML = `<p class="intro">An <code>events</code> table: one year of data, 50 million rows per day, 7 columns. Change how it is stored and what the query asks for, and see how much the engine must read.</p>
    <div class="controls"><div class="control"><span>File format</span><div class="seg"><button data-fmt="csv">CSV (row)</button><button data-fmt="parquet">Parquet (columnar)</button></div></div>
    <label class="check"><input type="checkbox" data-id="partitioned" checked> Partitioned by date</label>${slider('days', 'Query filter: last N days', 1, 365, S.days)}</div>
    <pre class="code sql-preview" data-lang="sql"><code></code></pre><div class="kpis"></div>
    <h4>Columns read</h4><div class="cols"></div><h4>Daily partitions scanned (365)</h4><div class="cal"></div><p class="sim-note"></p>`;
  const cols = body.querySelector('.cols'), cal = body.querySelector('.cal');
  cal.innerHTML = '<i></i>'.repeat(365);
  const paint = () => {
    const csv = S.fmt === 'csv', sel = COLS.filter((c) => S.cols.has(c.name));
    const daysScanned = S.partitioned ? S.days : 365;
    const perRow = csv ? COLS.reduce((a, c) => a + c.raw, 0) : sel.reduce((a, c) => a + c.pq, 0);
    const bytes = perRow * ROWS_DAY * daysScanned, worst = COLS.reduce((a, c) => a + c.raw, 0) * ROWS_DAY * 365;
    body.querySelectorAll('[data-fmt]').forEach((b) => b.classList.toggle('on', b.dataset.fmt === S.fmt));
    body.querySelector('[data-val=days]').textContent = S.days;
    body.querySelector('.sql-preview code').innerHTML = highlight(`SELECT ${sel.map((c) => c.name).join(', ') || '…'}\nFROM events\nWHERE event_date >= CURRENT_DATE - ${S.days};`, 'sql');
    body.querySelector('.kpis').innerHTML = kpi('Data scanned', fmtBytes(bytes), bytes > 1e12 ? 'bad' : bytes < 5e10 ? 'good' : 'warn') + kpi('Query cost', '$' + ((bytes / 1e12) * 5).toFixed(2)) + kpi('Est. scan time', (bytes / 20e9 < 90 ? (bytes / 20e9).toFixed(1) + ' s' : (bytes / 20e9 / 60).toFixed(1) + ' min')) + kpi('vs. worst case', (worst / bytes < 10 ? (worst / bytes).toFixed(1) : Math.round(worst / bytes).toLocaleString()) + '× less', worst / bytes > 50 ? 'good' : '');
    const maxSize = Math.max(...COLS.map((c) => c.raw));
    cols.innerHTML = COLS.map((c) => { const read = csv || S.cols.has(c.name), size = csv ? c.raw : c.pq; return `<div class="colrow ${read ? 'read' : ''}"><label class="check"><input type="checkbox" data-col="${c.name}" ${S.cols.has(c.name) ? 'checked' : ''}> <code>${c.name}</code></label><div class="track"><i style="width:${(size / maxSize) * 100}%"></i></div><span class="sz">${size.toFixed(1)} B/row</span></div>`; }).join('');
    [...cal.children].forEach((c, i) => c.classList.toggle('on', i >= 365 - daysScanned));
    body.querySelector('.sim-note').innerHTML = csv ? `<b>Row format:</b> every column of every row must be read and parsed, even though the query needs only ${sel.length}. Deselecting columns changes nothing.${S.partitioned ? '' : ' With no partitioning either, the whole year is scanned.'}`
      : !S.partitioned ? '<b>No partitioning:</b> Parquet reads only the selected columns, but the engine still opens every day of the year to find the last ' + S.days + '.'
      : '<b>Columnar + partitioned:</b> only the selected columns, in only the matching date folders, are read. Notice how repetitive columns like <code>event_type</code> compress to almost nothing.';
  };
  body.addEventListener('click', (e) => { const f = e.target.dataset.fmt; if (f) { S.fmt = f; paint(); } });
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.col) { t.checked ? S.cols.add(t.dataset.col) : S.cols.delete(t.dataset.col); }
    else if (t.dataset.id === 'partitioned') S.partitioned = t.checked;
    else if (t.dataset.id === 'days') S.days = +t.value;
    paint();
  });
  paint();
  return () => {};
}

// ---------------------------------------------------------------------------
// 4. Slowly changing dimensions
// ---------------------------------------------------------------------------
function scdSim(body) {
  const OPEN = '9999-12-31', month = (m) => `2025-${String(m).padStart(2, '0')}-01`;
  const VALUES = { city: ['Berlin', 'Lisbon', 'Toronto', 'Osaka', 'Austin'], tier: ['bronze', 'silver', 'gold'] };
  let rows, sk, now, asof, mode = 2;
  const init = () => {
    rows = [[1, 'Ava Nguyen', 'Berlin', 'silver'], [2, 'Noah Garcia', 'Austin', 'bronze'], [3, 'Mia Tanaka', 'Osaka', 'gold']].map(([id, name, city, tier], i) => ({ sk: 100 + i, id, name, city, tier, from: month(1), to: OPEN, cur: 1, flag: '' }));
    sk = 103; now = 1; asof = 1;
  };
  body.innerHTML = `<p class="intro">A customer dimension. Each change you apply happens one month later than the last. Compare what <b>Type 1</b> (overwrite) and <b>Type 2</b> (new version) do to the table.</p>
    <div class="controls"><label class="control"><span>Customer</span><select data-id="cust"><option value="1">1 · Ava Nguyen</option><option value="2">2 · Noah Garcia</option><option value="3">3 · Mia Tanaka</option></select></label>
    <label class="control"><span>Attribute</span><select data-id="attr"><option>city</option><option>tier</option></select></label><label class="control"><span>New value</span><select data-id="val"></select></label>
    <div class="control"><span>Strategy</span><div class="seg"><button data-mode="1">Type 1</button><button data-mode="2">Type 2</button></div></div>
    <button class="btn primary" data-apply>Apply change</button><button class="btn" data-reset>Reset</button></div>
    <div class="out"></div><div class="controls" style="margin:16px 0 0">${slider('asof', 'Time travel: view the dimension as of', 1, 12, 1)}</div><p class="sim-note"></p>`;
  const out = body.querySelector('.out'), q = (id) => body.querySelector(`[data-id=${id}]`);
  const fillValues = () => { q('val').innerHTML = VALUES[q('attr').value].map((v) => `<option>${v}</option>`).join(''); };
  const paint = (msg) => {
    body.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', +b.dataset.mode === mode));
    const d = month(asof);
    q('asof').max = Math.max(now, 2); body.querySelector('[data-val=asof]').textContent = d;
    out.innerHTML = `<div class="result"><table><thead><tr>${['customer_sk', 'customer_id', 'name', 'city', 'tier', 'valid_from', 'valid_to', 'is_current'].map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice().sort((a, b) => a.id - b.id || a.from.localeCompare(b.from)).map((r) => `<tr class="${r.flag} ${d >= r.from && d < r.to ? 'asof' : 'dim'}"><td class="num">${r.sk}</td><td class="num">${r.id}</td><td>${r.name}</td><td>${r.city}</td><td>${r.tier}</td><td>${r.from}</td><td>${r.to}</td><td class="num">${r.cur}</td></tr>`).join('')}</tbody></table></div><p class="result-meta">${rows.length} rows · highlighted rows are the versions valid on ${d} · next change will be dated ${month(Math.min(now + 1, 12))}</p>`;
    body.querySelector('.sim-note').innerHTML = msg || '<b>Tip:</b> apply the same change both ways. With Type 1 the old value is gone forever; with Type 2 you can drag the slider back and still see it.';
  };
  body.querySelector('[data-apply]').onclick = () => {
    const id = +q('cust').value, attr = q('attr').value, val = q('val').value, cur = rows.find((r) => r.id === id && r.cur);
    rows.forEach((r) => (r.flag = ''));
    if (cur[attr] === val) return paint(`<b>No change:</b> customer ${id}'s ${attr} is already <code>${val}</code>. A good pipeline detects this and writes nothing.`);
    if (now >= 12) return paint('<b>End of the simulated year.</b> Press Reset to start again.');
    now++; asof = now; q('asof').value = now;
    const old = cur[attr];
    if (mode === 1) { cur[attr] = val; cur.flag = 'changed'; paint(`<b>Type 1:</b> overwrote ${attr} <code>${old}</code> → <code>${val}</code> in place. Row count unchanged; every historical report now shows <code>${val}</code>.`); }
    else { cur.to = month(now); cur.cur = 0; cur.flag = 'changed'; rows.push({ ...cur, sk: sk++, [attr]: val, from: month(now), to: OPEN, cur: 1, flag: 'new' }); paint(`<b>Type 2:</b> closed version <code>${cur.sk}</code> (valid_to = ${month(now)}) and inserted a new version <code>${sk - 1}</code>. Facts recorded earlier keep pointing at <code>${cur.sk}</code>, so history is preserved.`); }
  };
  body.addEventListener('click', (e) => { if (e.target.dataset.mode) { mode = +e.target.dataset.mode; paint(); } });
  body.addEventListener('input', (e) => { if (e.target.dataset.id === 'attr') fillValues(); if (e.target.dataset.id === 'asof') { asof = +e.target.value; paint(); } });
  body.querySelector('[data-reset]').onclick = () => { init(); q('asof').value = 1; paint(); };
  init(); fillValues(); paint();
  return () => {};
}

// ---------------------------------------------------------------------------
// 5. Spark shuffle & skew
// ---------------------------------------------------------------------------
function skewSim(body) {
  const ROWS = 100e6, KEYS = 1000, SALT = 16;
  const S = { skew: 0.6, parts: 16, salt: false };
  const hash = (n) => (Math.imul(n + 1, 2654435761) >>> 0);
  body.innerHTML = `<p class="intro">A <code>groupBy(customer_id)</code> over 100 million rows and 1,000 keys. The shuffle sends each key to <code>hash(key) % partitions</code>. The stage finishes only when its <b>slowest</b> task does.</p>
    <div class="controls">${slider('skew', 'Key skew', 0, 1.5, S.skew, 0.1)}${slider('parts', 'Shuffle partitions', 4, 48, S.parts, 4)}<label class="check"><input type="checkbox" data-id="salt"> Salt keys (×${SALT})</label></div>
    <div class="kpis"></div><div class="bars"></div><p class="result-meta">Rows per shuffle partition — one bar is one task</p><p class="sim-note"></p>`;
  const paint = () => {
    const w = Array.from({ length: KEYS }, (_, k) => 1 / Math.pow(k + 1, S.skew)), sum = w.reduce((a, b) => a + b, 0);
    const parts = new Array(S.parts).fill(0);
    w.forEach((x, k) => {
      const rows = (x / sum) * ROWS;
      if (S.salt) for (let j = 0; j < SALT; j++) parts[hash(k * 131 + j * 7919) % S.parts] += rows / SALT;
      else parts[hash(k) % S.parts] += rows;
    });
    const avg = ROWS / S.parts, max = Math.max(...parts), limit = avg * 3, top = Math.max(max, limit) * 1.08;
    const oom = parts.filter((p) => p > limit).length, ratio = max / avg, secs = max / 1.5e6, ideal = avg / 1.5e6;
    body.querySelector('[data-val=skew]').textContent = S.skew === 0 ? 'none' : S.skew < 0.7 ? 'mild' : S.skew < 1.1 ? 'heavy' : 'extreme';
    body.querySelector('[data-val=parts]').textContent = S.parts;
    body.querySelector('.kpis').innerHTML = kpi('Largest key', ((w[0] / sum) * 100).toFixed(1) + '% of rows') + kpi('Largest partition', fmtN(max) + ' rows', ratio > 3 ? 'bad' : '') + kpi('Skew ratio (max ÷ avg)', ratio.toFixed(1) + '×', ratio > 3 ? 'bad' : ratio > 1.6 ? 'warn' : 'good') + kpi('Stage time', secs.toFixed(0) + ' s', secs > ideal * 3 ? 'bad' : '') + kpi('Tasks over memory', String(oom), oom ? 'bad' : 'good');
    body.querySelector('.bars').innerHTML = parts.map((p) => `<i class="${p > limit ? 'oom' : p > avg * 1.6 ? 'hot' : ''}" style="height:${(p / top) * 100}%" title="${fmtN(p)} rows"></i>`).join('') + `<div class="line" style="bottom:${(limit / top) * 100}%"><span>executor memory limit</span></div>`;
    body.querySelector('.sim-note').innerHTML = oom && !S.salt ? `<b>Skewed.</b> One key holds ${((w[0] / sum) * 100).toFixed(0)}% of all rows and they all hash to the same partition. That task takes ${secs.toFixed(0)}s (a balanced one would take ${ideal.toFixed(0)}s) and may run out of memory. Adding partitions does not split a single key — try salting.`
      : S.salt ? `<b>Salted.</b> Each key is split into ${SALT} sub-keys (<code>key || '_' || rand(${SALT})</code>), so the hot key spreads over many partitions. You aggregate once on the salted key and once more to combine. Spark 3's AQE can do a similar split automatically.`
      : ratio > 1.6 ? '<b>Uneven, but manageable.</b> Some tasks do noticeably more work. Increase the skew to see it become a real problem.'
      : '<b>Balanced.</b> With evenly distributed keys every task does similar work, so the cluster is used efficiently.';
  };
  body.addEventListener('input', (e) => { const id = e.target.dataset.id; if (!id) return; S[id] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value; paint(); });
  paint();
  return () => {};
}

const MOUNT = { dag: dagSim, kafka: kafkaSim, scan: scanSim, scd: scdSim, skew: skewSim };

export function mountSim(name, root) {
  const meta = SIMS.find((s) => s.id === name);
  if (!meta || !MOUNT[name]) return () => {};
  const node = el(`<section class="sim" id="sim-${name}"><header><span class="chip simc">Simulator</span><h3>${esc(meta.name)}</h3></header><div class="body"></div></section>`);
  root.appendChild(node);
  const used = () => markSim(name);
  node.addEventListener('click', used, { once: true });
  node.addEventListener('input', used, { once: true });
  return MOUNT[name](node.querySelector('.body'));
}
