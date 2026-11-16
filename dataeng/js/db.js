// In-browser SQLite (sql.js) wrapper + deterministic practice dataset.
// Pure JS so the same module powers the app and the Node validator.

let SQL = null;
let SEED = null;

export async function initSQL(initSqlJs, locateFile) {
  if (!SQL) SQL = await initSqlJs({ locateFile });
  return SQL;
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const day = (y, n) => new Date(Date.UTC(y, 0, 1 + n)).toISOString().slice(0, 10);
const q = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

export function seedSQL() {
  if (SEED) return SEED;
  const r = rng(42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const weighted = (pairs) => { let x = r(); for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[0][0]; };
  const out = [];
  const ins = (t, rows) => { for (let i = 0; i < rows.length; i += 50) out.push(`INSERT INTO ${t} VALUES ${rows.slice(i, i + 50).map((x) => `(${x.map(q).join(',')})`).join(',')};`); };

  out.push(`
CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, country TEXT, signup_date TEXT, tier TEXT);
CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT, price REAL);
CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id), order_date TEXT, status TEXT);
CREATE TABLE order_items (order_id INTEGER REFERENCES orders(order_id), product_id INTEGER REFERENCES products(product_id), quantity INTEGER, unit_price REAL);
CREATE TABLE events (event_id INTEGER PRIMARY KEY, customer_id INTEGER, event_type TEXT, event_ts TEXT);
CREATE TABLE raw_customers (id INTEGER, name TEXT, email TEXT, country TEXT, updated_at TEXT);`);

  const first = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Isla', 'Lucas', 'Aria', 'Mateo', 'Nora', 'Kai', 'Lena', 'Omar', 'Yuki'];
  const last = ['Nguyen', 'Garcia', 'Smith', 'Kowalski', 'Tanaka', 'Okafor', 'Silva', 'Dubois', 'Patel', 'Larsen'];
  const countries = ['US', 'US', 'US', 'UK', 'UK', 'DE', 'FR', 'IN', 'IN', 'BR', 'JP', 'CA'];
  const customers = [];
  for (let i = 1; i <= 30; i++) {
    const name = `${first[(i * 7) % first.length]} ${last[(i * 3) % last.length]}`;
    customers.push([i, name, `${name.toLowerCase().replace(' ', '.')}${i}@example.com`, pick(countries), day(2024, Math.floor(r() * 360)), weighted([['bronze', 0.5], ['silver', 0.3], ['gold', 0.2]])]);
  }
  ins('customers', customers);

  const products = [
    [1, 'Laptop Pro 14', 'Electronics', 1299.0], [2, 'Wireless Mouse', 'Electronics', 29.99], [3, 'Mechanical Keyboard', 'Electronics', 89.5],
    [4, '4K Monitor', 'Electronics', 399.0], [5, 'USB-C Hub', 'Electronics', 49.0], [6, 'Noise-Cancelling Headphones', 'Electronics', 249.0],
    [7, 'Standing Desk', 'Furniture', 549.0], [8, 'Ergonomic Chair', 'Furniture', 329.0], [9, 'Desk Lamp', 'Furniture', 39.5],
    [10, 'Bookshelf', 'Furniture', 119.0], [11, 'Notebook Set', 'Stationery', 12.5], [12, 'Fountain Pen', 'Stationery', 34.0],
    [13, 'Whiteboard', 'Stationery', 64.0], [14, 'Data Engineering Handbook', 'Books', 54.99], [15, 'SQL Pocket Guide', 'Books', 24.99],
  ];
  ins('products', products);

  const orders = [], items = [];
  for (let i = 1; i <= 160; i++) {
    const cust = 1 + Math.floor(Math.pow(r(), 1.4) * 26); // customers 27-30 never order
    orders.push([1000 + i, cust, day(2025, Math.floor(r() * 181)), weighted([['completed', 0.7], ['shipped', 0.12], ['cancelled', 0.1], ['returned', 0.08]])]);
    const n = 1 + Math.floor(r() * 3), seen = new Set();
    for (let k = 0; k < n; k++) {
      const p = pick(products);
      if (seen.has(p[0])) continue;
      seen.add(p[0]);
      items.push([1000 + i, p[0], 1 + Math.floor(r() * 3), r() < 0.15 ? Math.round(p[3] * 90) / 100 : p[3]]);
    }
  }
  ins('orders', orders);
  ins('order_items', items);

  const events = [];
  const pad = (n) => String(n).padStart(2, '0');
  for (let i = 1; i <= 300; i++) {
    const d = 1 + Math.floor(r() * 7);
    events.push([i, 1 + Math.floor(r() * 30), weighted([['page_view', 0.55], ['add_to_cart', 0.22], ['checkout', 0.13], ['purchase', 0.1]]),
      `2025-06-${pad(d)} ${pad(Math.floor(r() * 24))}:${pad(Math.floor(r() * 60))}:${pad(Math.floor(r() * 60))}`]);
  }
  events.push([301, 999, 'page_view', '2025-06-03 10:15:00'], [302, 999, 'add_to_cart', '2025-06-03 10:17:30'], [303, 998, 'page_view', '2025-06-05 21:02:11']);
  ins('events', events);

  ins('raw_customers', [
    [1, 'Ada Lovelace', 'ada@example.com', 'UK', '2025-01-01'], [1, 'Ada Lovelace', 'ADA@EXAMPLE.COM', 'UK', '2025-03-01'],
    [2, ' Grace Hopper ', 'grace@example.com', 'US', '2025-01-05'], [3, 'Alan Turing', null, 'UK', '2025-01-07'],
    [4, 'Edgar Codd', 'edgar@example.com', 'uk', '2025-02-01'], [4, 'Edgar F. Codd', 'edgar@example.com', 'UK', '2025-04-10'],
    [5, 'Margaret Hamilton', 'margaret@example.com', 'US', '2025-02-11'], [6, 'Linus Torvalds', 'linus@example', 'FI', '2025-02-15'],
    [7, 'Barbara Liskov', null, 'US', '2025-03-02'], [8, 'Jim Gray', 'jim@example.com', 'US', '2025-03-09'],
    [8, 'Jim Gray', 'jim@example.com', 'US', '2025-03-09'], [9, 'Michael Stonebraker', 'mike@example.com', null, '2025-03-20'],
  ]);
  return (SEED = out.join('\n'));
}

export function freshDB() {
  const db = new SQL.Database();
  db.run(seedSQL());
  return db;
}

/** Run SQL, returning every result set. Throws on SQL errors. */
export function runSQL(db, sql) {
  const t = performance.now();
  const results = db.exec(sql);
  return { results, ms: performance.now() - t, changes: db.getRowsModified() };
}

export function schemaOf(db) {
  const tables = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
  if (!tables.length) return [];
  return tables[0].values.map(([name, type]) => {
    const info = db.exec(`PRAGMA table_info(${JSON.stringify(name)})`);
    const count = db.exec(`SELECT COUNT(*) FROM ${JSON.stringify(name)}`)[0].values[0][0];
    return { name, type, count, cols: info.length ? info[0].values.map((c) => ({ name: c[1], type: c[2] || '', pk: !!c[5] })) : [] };
  });
}

const norm = (v) => (v === null ? '∅' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));

export function compareResults(user, expected, ordered) {
  if (!expected) return { ok: false, msg: 'Internal error: the reference solution produced no rows.' };
  if (!user) return { ok: false, msg: 'Your SQL ran, but returned no rows. The expected answer has ' + expected.values.length + ' row(s).' };
  if (user.columns.length !== expected.columns.length)
    return { ok: false, msg: `Expected ${expected.columns.length} column(s) (${expected.columns.join(', ')}), but got ${user.columns.length}.` };
  if (user.values.length !== expected.values.length)
    return { ok: false, msg: `Expected ${expected.values.length} row(s), but got ${user.values.length}.` };
  const key = (rows) => { const k = rows.map((row) => row.map(norm).join('␟')); return ordered ? k : k.sort(); };
  const a = key(user.values), b = key(expected.values);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const sortedA = [...a].sort(), sortedB = [...b].sort();
      if (ordered && sortedA.every((x, j) => x === sortedB[j])) return { ok: false, msg: 'Right rows, wrong order — check your ORDER BY.' };
      return { ok: false, msg: 'Row count and shape are right, but some values differ. Re-read the requirements carefully.' };
    }
  }
  return { ok: true, msg: 'Correct!' };
}

/** Execute a challenge attempt on a pristine database. */
export function evalChallenge(ch, sql) {
  const db = freshDB();
  try {
    if (ch.setup) db.run(ch.setup);
    const res = db.exec(sql);
    if (ch.twice) db.exec(sql); // idempotency: a second run must not change the outcome
    const own = res.length ? res[res.length - 1] : null;
    let graded = own;
    if (ch.check) { const c = db.exec(ch.check); graded = c.length ? c[c.length - 1] : null; }
    return { own, graded };
  } finally { db.close(); }
}

export function checkChallenge(ch, sql) {
  const user = evalChallenge(ch, sql);
  const ref = evalChallenge(ch, ch.solution);
  return { ...compareResults(user.graded, ref.graded, ch.ordered), shown: user.own || user.graded };
}
