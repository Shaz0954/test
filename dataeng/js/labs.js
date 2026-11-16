// Code editor, SQL/Python runners, challenge widgets and the free-form labs.
import { freshDB, runSQL, schemaOf, evalChallenge, checkChallenge } from './db.js';
import { highlight, renderMD, esc } from './md.js';
import { state, save } from './state.js';
import { el, icon, solveChallenge, countQuery, toast } from './game.js';

// ---- editor ---------------------------------------------------------------
export function editor({ lang, value = '', onRun, storeKey, minLines = 4 }) {
  const node = el('<div class="editor"><pre aria-hidden="true"><code></code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Code editor"></textarea></div>');
  const ta = node.querySelector('textarea'), pre = node.querySelector('pre'), code = pre.querySelector('code');
  const indent = lang === 'python' ? '    ' : '  ';
  const sync = () => {
    code.innerHTML = highlight(ta.value, lang) + '\n';
    node.style.height = Math.min(Math.max(ta.value.split('\n').length, minLines), 24) * 21 + 28 + 'px';
  };
  const insert = (text) => { if (!document.execCommand('insertText', false, text)) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } };
  ta.addEventListener('input', () => { sync(); if (storeKey) { state.code[storeKey] = ta.value; save(true); } });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); insert(indent); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun?.(); }
    else if (e.key === 'Enter') {
      const before = ta.value.slice(0, ta.selectionStart), line = before.slice(before.lastIndexOf('\n') + 1);
      const lead = line.match(/^\s*/)[0] + (lang === 'python' && /:\s*$/.test(line) ? indent : '');
      if (lead) { e.preventDefault(); insert('\n' + lead); }
    }
  });
  ta.value = (storeKey && state.code[storeKey]) ?? value;
  sync();
  return { node, get: () => ta.value, set: (v) => { ta.value = v; ta.dispatchEvent(new Event('input')); }, focus: () => ta.focus() };
}

// ---- result rendering -----------------------------------------------------
export function resultTable(res, max = 200) {
  const rows = res.values.slice(0, max);
  const cell = (v) => (v === null ? '<td class="null">NULL</td>' : typeof v === 'number' ? `<td class="num">${Number.isInteger(v) ? v : Math.round(v * 10000) / 10000}</td>` : `<td>${esc(v)}</td>`);
  return `<div class="result"><table><thead><tr>${res.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div><p class="result-meta">${res.values.length} row${res.values.length === 1 ? '' : 's'}${res.values.length > max ? ` (showing first ${max})` : ''}</p>`;
}
const feedback = (kind, html, ic) => `<div class="feedback ${kind}">${icon(ic || (kind === 'ok' ? 'check' : kind === 'bad' ? 'x' : 'bulb'))}<div>${html}</div></div>`;
const sqlError = (e) => feedback('bad', `<b>SQL error</b><pre>${esc(String(e.message || e))}</pre>`, 'alert');

let baseSchema;
function schemaHTML() {
  if (!baseSchema) { const db = freshDB(); baseSchema = schemaOf(db); db.close(); }
  return `<details class="schema"><summary>Database schema</summary><div class="schema-grid">${baseSchema.map((t) => `<div class="schema-table"><b>${t.name}<small>${t.count} rows</small></b>${t.cols.map((c) => `<div>${c.name}<span>${c.pk ? 'PK ' : ''}${c.type.toLowerCase()}</span></div>`).join('')}</div>`).join('')}</div></details>`;
}

// ---- challenge shell shared by SQL and Python -----------------------------
function challengeShell(block, lang, label, chipClass) {
  const solved = () => !!state.solved[block.id];
  const node = el(`<section class="challenge" id="ch-${block.id}">
    <header><span class="chip ${chipClass}">${label}</span><h3>${esc(block.title)}</h3><span class="status"></span></header>
    <div class="body"><div class="prose">${renderMD(block.prompt)}</div><div class="slot"></div>
    <div class="actions"><button class="btn" data-run>${icon('play')} Run</button><button class="btn primary" data-check>${icon('check')} Check answer</button><span class="spacer"></span>
    <button class="btn subtle" data-hint>Hint</button><button class="btn subtle" data-solution>Solution</button><button class="btn subtle" data-reset>Reset</button></div>
    <div class="fb"></div><div class="output"></div></div></section>`);
  const fb = node.querySelector('.fb'), out = node.querySelector('.output');
  const paint = () => { node.classList.toggle('solved', solved()); node.querySelector('.status').innerHTML = solved() ? '<span class="chip ok">Solved</span>' : '<span class="chip muted">+20 XP</span>'; };
  const ed = editor({ lang, value: block.starter || '', storeKey: block.id, onRun: () => node.querySelector('[data-run]').click() });
  node.querySelector('.slot').appendChild(ed.node);
  node.querySelector('[data-hint]').onclick = () => { fb.innerHTML = feedback('hint', `<div class="prose">${renderMD(block.hint)}</div>`); };
  node.querySelector('[data-solution]').onclick = () => {
    fb.innerHTML = feedback('hint', `<b>Reference solution</b> — try to understand it, then type it yourself.<pre class="code" style="margin:8px 0 0"><code>${highlight(block.solution, lang)}</code></pre>`);
  };
  node.querySelector('[data-reset]').onclick = () => { ed.set(block.starter || ''); fb.innerHTML = out.innerHTML = ''; };
  paint();
  return { node, ed, fb, out, paint, ok: (msg) => { fb.innerHTML = feedback('ok', `<b>${msg}</b>`); solveChallenge(block.id); paint(); } };
}

export function sqlChallenge(block) {
  const s = challengeShell(block, 'sql', 'SQL', '');
  s.node.querySelector('.prose').insertAdjacentHTML('afterend', schemaHTML());
  const show = (res) => { s.out.innerHTML = res ? resultTable(res) : '<p class="result-meta">Statement executed. No rows returned.</p>'; };
  s.node.querySelector('[data-run]').onclick = () => {
    s.fb.innerHTML = '';
    try { show(evalChallenge(block, s.ed.get()).own); countQuery(); } catch (e) { s.out.innerHTML = ''; s.fb.innerHTML = sqlError(e); }
  };
  s.node.querySelector('[data-check]').onclick = () => {
    try {
      const r = checkChallenge(block, s.ed.get());
      countQuery();
      show(r.shown);
      if (r.ok) s.ok('Correct! Your result matches the expected output.');
      else s.fb.innerHTML = feedback('bad', `<b>Not yet.</b> ${esc(r.msg)}`);
    } catch (e) { s.out.innerHTML = ''; s.fb.innerHTML = sqlError(e); }
  };
  return s.node;
}

// ---- Python (Pyodide, loaded on demand) -----------------------------------
const PY_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
let pyReady = null;
export function loadPython() {
  if (!pyReady) {
    pyReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PY_CDN + 'pyodide.js';
      s.onload = () => window.loadPyodide({ indexURL: PY_CDN }).then(resolve, reject);
      s.onerror = () => reject(new Error('Could not download the Python runtime. Check your internet connection (it loads from cdn.jsdelivr.net) and try again.'));
      document.head.appendChild(s);
    });
    pyReady.catch(() => { pyReady = null; });
  }
  return pyReady;
}

export async function runPython(code) {
  const py = await loadPython();
  let out = '';
  py.setStdout({ batched: (s) => (out += s + '\n') });
  py.setStderr({ batched: (s) => (out += s + '\n') });
  const globals = py.globals.get('dict')();
  try {
    await py.runPythonAsync(code, { globals });
    return { ok: true, out };
  } catch (e) {
    const lines = String(e.message || e).trimEnd().split('\n');
    const at = lines.findIndex((l) => l.includes('File "<exec>"'));
    return { ok: false, out, err: (at >= 0 ? ['Traceback (most recent call last):', ...lines.slice(at)] : lines).join('\n'), last: lines[lines.length - 1] };
  } finally { globals.destroy(); }
}

async function withPython(btns, target, fn) {
  btns.forEach((b) => (b.disabled = true));
  if (!pyReady) target.innerHTML = feedback('', 'Loading the Python runtime (about 10 MB, first run only)…', 'info');
  try { await fn(); } catch (e) { target.innerHTML = feedback('bad', `<b>Python is unavailable.</b> ${esc(e.message || e)}`, 'alert'); }
  btns.forEach((b) => (b.disabled = false));
}

export function pyChallenge(block) {
  const s = challengeShell(block, 'python', 'Python', 'py');
  const run = s.node.querySelector('[data-run]'), check = s.node.querySelector('[data-check]');
  const stdout = (r) => { s.out.innerHTML = r.out || r.err ? `<pre class="stdout">${esc(r.out + (r.err || ''))}</pre>` : '<p class="result-meta">Ran successfully with no output. Use print() to inspect values.</p>'; };
  run.onclick = () => withPython([run, check], s.fb, async () => { const r = await runPython(s.ed.get()); s.fb.innerHTML = ''; stdout(r); });
  check.onclick = () => withPython([run, check], s.fb, async () => {
    const r = await runPython(`${s.ed.get()}\n\n${block.test}\n`);
    if (r.ok) { s.out.innerHTML = r.out ? `<pre class="stdout">${esc(r.out)}</pre>` : ''; s.ok('Correct! All tests passed.'); return; }
    const assertion = r.last.startsWith('AssertionError');
    s.fb.innerHTML = feedback('bad', assertion ? `<b>A test failed.</b> ${esc(r.last.replace(/^AssertionError:?\s*/, '') || 'The result is not what was expected.')}` : `<b>Your code raised an error.</b><pre>${esc(r.err)}</pre>`);
    s.out.innerHTML = r.out ? `<pre class="stdout">${esc(r.out)}</pre>` : '';
  });
  return s.node;
}

// ---- SQL Lab --------------------------------------------------------------
const SQL_EXAMPLES = [
  ['Preview orders', 'SELECT * FROM orders LIMIT 10;'],
  ['Revenue by category', "SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue\nFROM order_items AS oi\nJOIN orders AS o ON o.order_id = oi.order_id\nJOIN products AS p ON p.product_id = oi.product_id\nWHERE o.status = 'completed'\nGROUP BY p.category\nORDER BY revenue DESC;"],
  ['Window function', 'SELECT category, name, price,\n       RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_rank\nFROM products;'],
  ['Dedupe staging', 'WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn\n  FROM raw_customers\n)\nSELECT id, TRIM(name) AS name, LOWER(email) AS email\nFROM ranked\nWHERE rn = 1;'],
  ['Query plan', 'EXPLAIN QUERY PLAN\nSELECT * FROM events WHERE customer_id = 7;'],
  ['Create a table', "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT);\nINSERT INTO notes (body) VALUES ('tables you create live until you reset the database');\nSELECT * FROM notes;"],
];

export function sqlLab(root) {
  let db = freshDB();
  root.innerHTML = `<div class="page-head"><span class="eyebrow">Playground</span><h1>SQL Lab</h1><p>A real SQLite database running in your browser. Query it, create tables, break things — then reset. Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run.</p></div>
    <div class="lab"><aside class="card lab-side"><h4>Schema</h4><div class="tree"></div></aside>
    <div class="lab-main"><div class="card panel"><div class="examples">${SQL_EXAMPLES.map((e, i) => `<button data-ex="${i}">${e[0]}</button>`).join('')}</div><div class="slot"></div>
    <div class="actions"><button class="btn primary" data-run>${icon('play')} Run</button><span class="spacer"></span><button class="btn subtle" data-resetdb>Reset database</button></div><div class="fb"></div><div class="output"></div></div></div></div>`;
  const tree = root.querySelector('.tree'), fb = root.querySelector('.fb'), out = root.querySelector('.output');
  const ed = editor({ lang: 'sql', value: SQL_EXAMPLES[1][1], storeKey: 'lab:sql', minLines: 9, onRun: () => run() });
  root.querySelector('.slot').appendChild(ed.node);

  const paintTree = () => {
    tree.innerHTML = schemaOf(db).map((t) => `<details><summary>${esc(t.name)}<small>${t.type === 'view' ? 'view' : t.count}</small></summary>${t.cols.map((c) => `<div class="col">${esc(c.name)}<span>${c.pk ? 'PK ' : ''}${esc(c.type.toLowerCase())}</span></div>`).join('')}<a class="peek" href="#" data-peek="${esc(t.name)}">Preview rows →</a></details>`).join('');
  };
  function run(sql = ed.get()) {
    fb.innerHTML = '';
    try {
      const r = runSQL(db, sql);
      countQuery();
      out.innerHTML = r.results.length ? r.results.map((x) => resultTable(x, 500)).join('') : `<p class="result-meta">Statement executed. ${r.changes} row(s) affected.</p>`;
      out.insertAdjacentHTML('beforeend', `<p class="result-meta">Finished in ${r.ms.toFixed(1)} ms</p>`);
      paintTree();
    } catch (e) { out.innerHTML = ''; fb.innerHTML = sqlError(e); }
  }
  root.querySelector('[data-run]').onclick = () => run();
  root.querySelector('[data-resetdb]').onclick = () => { db.close(); db = freshDB(); paintTree(); out.innerHTML = ''; fb.innerHTML = ''; toast('Database reset', 'Back to the original dataset.'); };
  root.querySelector('.examples').onclick = (e) => { const i = e.target.dataset.ex; if (i !== undefined) { ed.set(SQL_EXAMPLES[i][1]); run(); } };
  tree.onclick = (e) => { const t = e.target.dataset.peek; if (t) { e.preventDefault(); const q = `SELECT * FROM ${t} LIMIT 20;`; ed.set(q); run(q); } };
  paintTree();
  return () => db.close();
}

// ---- Python Lab -----------------------------------------------------------
const PY_SAMPLE = `# A tiny ETL job: extract -> transform -> load
import csv, io, json
from collections import defaultdict

RAW = """order_id,country,amount
1,US,120.00
2,de,80.50
3,US,not_a_number
4,uk,42.00
5,DE,19.50
"""

def extract(text):
    return list(csv.DictReader(io.StringIO(text)))

def transform(rows):
    clean, rejected = [], []
    for row in rows:
        try:
            clean.append({"order_id": int(row["order_id"]),
                          "country": row["country"].upper(),
                          "amount": float(row["amount"])})
        except ValueError:
            rejected.append(row)          # dead-letter, never silently drop
    return clean, rejected

def load(rows):
    totals = defaultdict(float)
    for r in rows:
        totals[r["country"]] += r["amount"]
    return dict(totals)

clean, rejected = transform(extract(RAW))
print("revenue by country:", json.dumps(load(clean), indent=2))
print("rejected rows:", rejected)
`;

export function pyLab(root) {
  root.innerHTML = `<div class="page-head"><span class="eyebrow">Playground</span><h1>Python Lab</h1><p>Real CPython in your browser (Pyodide). The standard library is available: <code>csv</code>, <code>json</code>, <code>datetime</code>, <code>collections</code>, <code>sqlite3</code> and more. Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run.</p></div>
    <div class="card" style="padding:16px"><div class="slot"></div><div class="actions"><button class="btn primary" data-run>${icon('play')} Run</button><span class="spacer"></span><button class="btn subtle" data-reset>Load example</button></div><div class="fb"></div><div class="output"></div></div>`;
  const fb = root.querySelector('.fb'), out = root.querySelector('.output'), btn = root.querySelector('[data-run]');
  const ed = editor({ lang: 'python', value: PY_SAMPLE, storeKey: 'lab:py', minLines: 14, onRun: () => btn.click() });
  root.querySelector('.slot').appendChild(ed.node);
  btn.onclick = () => withPython([btn], fb, async () => {
    const r = await runPython(ed.get());
    fb.innerHTML = '';
    out.innerHTML = `<pre class="stdout">${esc(r.out + (r.err || '')) || '<span class="muted">No output. Use print() to see values.</span>'}</pre>`;
  });
  root.querySelector('[data-reset]').onclick = () => ed.set(PY_SAMPLE);
}
