SQL transforms data *inside* a database. Python is the glue *around* it: calling APIs, parsing files, orchestrating jobs and expressing logic SQL cannot. You do not need to be a software architect — but you must be fluent with the basics.

:::callout info
Python challenges run in your browser using Pyodide (real CPython compiled to WebAssembly). The runtime (~10 MB) downloads the first time you press **Run** and needs an internet connection.
:::

## Records are dictionaries, datasets are lists

```python
orders = [
    {"order_id": 1, "country": "US", "amount": 120.0},
    {"order_id": 2, "country": "DE", "amount": 80.5},
    {"order_id": 3, "country": "US", "amount": 42.0},
]

us_orders = [o for o in orders if o["country"] == "US"]     # filter
amounts   = [o["amount"] for o in orders]                    # project
total     = sum(amounts)                                     # aggregate
```

That is `WHERE`, `SELECT` and `SUM` — the same ideas in a different language.

## Defensive access

Real data is messy. Keys are missing, values are `None`, strings carry stray spaces.

```python
country = (rec.get("country") or "UNKNOWN").strip().upper()
```

`rec.get("country")` returns `None` instead of raising `KeyError`; `or "UNKNOWN"` replaces both `None` and `""`.

## Reading files

```python
import csv, io, json

rows = list(csv.DictReader(io.StringIO(text)))   # CSV text -> list of dicts
event = json.loads('{"type": "click", "ts": 1717200000}')
```

Everything read from CSV is a **string**. Convert types explicitly — `float(row["amount"])` — and decide deliberately what happens on bad input.

## Grouping

```python
from collections import defaultdict

totals = defaultdict(float)
for o in orders:
    totals[o["country"]] += o["amount"]
```

At scale you would use pandas, Polars, DuckDB or Spark — but they all implement exactly this loop for you.

:::python id=py-1 title="Clean a record"
Write `clean_record(rec)` that returns a **new** dict with:

- `name`: whitespace stripped
- `email`: lower-cased, or `None` if missing/empty
- `country`: upper-cased, or `"UNKNOWN"` if missing/empty
@starter
def clean_record(rec):
    # rec looks like {"name": " Ada ", "email": "ADA@X.COM", "country": "uk"}
    return {}
@solution
def clean_record(rec):
    email = rec.get("email")
    return {
        "name": (rec.get("name") or "").strip(),
        "email": email.strip().lower() if email else None,
        "country": (rec.get("country") or "UNKNOWN").strip().upper(),
    }
@test
r = clean_record({"name": " Ada Lovelace ", "email": "ADA@Example.com", "country": "uk"})
assert r == {"name": "Ada Lovelace", "email": "ada@example.com", "country": "UK"}, f"Got {r}"
r = clean_record({"name": "Alan", "email": None})
assert r == {"name": "Alan", "email": None, "country": "UNKNOWN"}, f"Missing values not handled: {r}"
assert clean_record({"name": "X", "email": "", "country": ""})["country"] == "UNKNOWN", "Empty country should become UNKNOWN"
@hint
Use `rec.get(key)` so missing keys return `None`, and the `value or default` idiom for fallbacks.
:::

:::python id=py-2 title="Parse CSV"
Write `parse_orders(text)` that parses CSV text with the header `order_id,country,amount` into a list of dicts, converting `order_id` to `int` and `amount` to `float`. Skip rows whose amount is not a valid number.
@starter
import csv, io

def parse_orders(text):
    rows = []
    return rows
@solution
import csv, io

def parse_orders(text):
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            rows.append({"order_id": int(row["order_id"]), "country": row["country"], "amount": float(row["amount"])})
        except ValueError:
            continue
    return rows
@test
out = parse_orders("order_id,country,amount\n1,US,120.0\n2,DE,oops\n3,US,42\n")
assert out == [{"order_id": 1, "country": "US", "amount": 120.0}, {"order_id": 3, "country": "US", "amount": 42.0}], f"Got {out}"
assert parse_orders("order_id,country,amount\n") == [], "Header-only input should give an empty list"
@hint
Loop over `csv.DictReader(io.StringIO(text))` and wrap the conversions in `try / except ValueError`.
:::

:::python id=py-3 title="Group and sum"
Write `total_by(rows, key, value)` returning a dict that maps each distinct `row[key]` to the sum of `row[value]` — a hand-written `GROUP BY`.
@starter
def total_by(rows, key, value):
    totals = {}
    return totals
@solution
def total_by(rows, key, value):
    totals = {}
    for row in rows:
        totals[row[key]] = totals.get(row[key], 0) + row[value]
    return totals
@test
rows = [{"c": "US", "a": 10}, {"c": "DE", "a": 5}, {"c": "US", "a": 2.5}]
assert total_by(rows, "c", "a") == {"US": 12.5, "DE": 5}, f"Got {total_by(rows, 'c', 'a')}"
assert total_by([], "c", "a") == {}, "Empty input should give an empty dict"
@hint
`totals[k] = totals.get(k, 0) + v` inside a loop.
:::

:::quiz
? What does `rec.get("country")` return when the key is missing?
- It raises KeyError
- An empty string
+ None
- False
! `dict.get` returns `None` (or a default you pass) instead of raising, which makes it ideal for messy records.

? You read `amount` from a CSV file with `csv.DictReader`. What type is it?
- float
- int
- Decimal
+ str
! CSV has no types — everything arrives as a string and must be converted explicitly.

? Which expression is the Python equivalent of `SELECT amount FROM orders WHERE country = 'US'`?
- `[o for o in orders]`
+ `[o["amount"] for o in orders if o["country"] == "US"]`
- `sum(o["amount"] for o in orders)`
- `orders["amount"]["US"]`
! A list comprehension projects (`o["amount"]`) and filters (`if …`) in one expression.

? Why should a pipeline function return a new record rather than mutate its input?
- Mutation is slower
- Python does not allow mutating dicts
+ Pure functions are easier to test, retry and reason about
- It uses less memory
! Functions without side effects can be re-run safely and tested in isolation — the same property that makes pipelines reliable.
:::
