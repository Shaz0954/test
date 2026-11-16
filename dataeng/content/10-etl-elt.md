A pipeline moves data from A to B and reshapes it on the way. The hard part is not making it work once — it is making it **safe to run again**, because it *will* fail halfway through at 3am.

## ETL vs ELT

| | ETL | ELT |
| --- | --- | --- |
| Order | Extract → **Transform** → Load | Extract → Load → **Transform** |
| Transform runs in | a separate engine (Python, Spark) | the warehouse, in SQL |
| Raw data kept? | often not | yes |
| Typical era | on-premise warehouses | cloud warehouses |

Cheap storage and elastic compute made **ELT** the default: land raw data first, then transform it with SQL (often dbt). You keep the raw data, so you can always re-transform.

## Full refresh vs incremental

- **Full refresh**: drop and rebuild the whole table each run. Trivially correct, but slow and expensive as data grows.
- **Incremental**: process only what is new or changed since last run, usually tracked by a *high-watermark* such as `updated_at`.

```sql
SELECT * FROM source_orders
WHERE updated_at > (SELECT MAX(updated_at) FROM target_orders);
```

## Idempotency — the most important word in this course

A pipeline is **idempotent** if running it twice leaves the target in the same state as running it once. Retries, backfills and overlapping schedules all depend on it.

`INSERT INTO target SELECT …` is **not** idempotent: a retry inserts everything again. These patterns are:

1. **Delete-then-insert** a well-defined slice (e.g. one day) in a transaction.
2. **Overwrite a partition** (`INSERT OVERWRITE … PARTITION (date='2025-06-01')`).
3. **Upsert / MERGE** on a unique key.

```sql
INSERT INTO daily_revenue (day, revenue)
SELECT order_date, SUM(amount) FROM orders WHERE order_date = '2025-06-01' GROUP BY order_date
ON CONFLICT (day) DO UPDATE SET revenue = excluded.revenue;
```

Most warehouses spell this `MERGE INTO target USING source ON … WHEN MATCHED THEN UPDATE … WHEN NOT MATCHED THEN INSERT …`.

:::callout tip
Parameterise every job by the **data interval it processes** (e.g. `ds = 2025-06-01`), never by "now". Then re-running last Tuesday's job reproduces last Tuesday's output.
:::

:::sql id=etl-1 title="Staging: clean and deduplicate"
`raw_customers` is messy: duplicate ids, stray spaces, inconsistent casing. Create `stg_customers` with **one row per `id`** — the row with the latest `updated_at` — and columns:

- `id`
- `name` (trimmed)
- `email` (lower-cased)
- `country` (upper-cased)
@starter
CREATE TABLE stg_customers AS
WITH ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
  FROM raw_customers
)
SELECT id
FROM ranked
@solution
CREATE TABLE stg_customers AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn FROM raw_customers
)
SELECT id, TRIM(name) AS name, LOWER(email) AS email, UPPER(country) AS country FROM ranked WHERE rn = 1;
@check
SELECT id, name, email, country FROM stg_customers ORDER BY id;
@hint
Keep `rn = 1` and apply `TRIM(name)`, `LOWER(email)`, `UPPER(country)`.
:::

:::sql id=etl-2 title="An idempotent load" twice
`daily_revenue(day PRIMARY KEY, revenue)` already contains some **stale** rows. Load revenue per day for **June 2025** from completed orders so that re-running the statement never creates duplicates and always leaves correct values.

Your SQL will be executed **twice** before it is checked.
@setup
CREATE TABLE daily_revenue (day TEXT PRIMARY KEY, revenue REAL);
INSERT INTO daily_revenue VALUES ('2025-06-02', 1.0), ('2025-06-10', 99999.0), ('2025-05-31', 420.0);
@starter
INSERT INTO daily_revenue (day, revenue)
SELECT o.order_date, SUM(oi.quantity * oi.unit_price)
FROM orders AS o
JOIN order_items AS oi ON oi.order_id = o.order_id
WHERE o.status = 'completed'
  AND o.order_date BETWEEN '2025-06-01' AND '2025-06-30'
GROUP BY o.order_date
@solution
INSERT INTO daily_revenue (day, revenue)
SELECT o.order_date, SUM(oi.quantity * oi.unit_price)
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status = 'completed' AND o.order_date BETWEEN '2025-06-01' AND '2025-06-30'
GROUP BY o.order_date
ON CONFLICT (day) DO UPDATE SET revenue = excluded.revenue;
@check
SELECT day, ROUND(revenue, 2) FROM daily_revenue ORDER BY day;
@hint
Either add `ON CONFLICT (day) DO UPDATE SET revenue = excluded.revenue`, or first `DELETE FROM daily_revenue WHERE day BETWEEN …` and then insert.
:::

:::quiz
? What does it mean for a pipeline to be idempotent?
- It runs exactly once
- It never fails
+ Running it multiple times produces the same result as running it once
- It processes data in order
! Idempotency makes retries and backfills safe — the foundation of reliable pipelines.

? A job does `INSERT INTO sales SELECT * FROM staging_sales` and is retried after a timeout. What is the likely outcome?
- Nothing — inserts are idempotent
+ Duplicate rows in `sales`
- The second run fails
- Rows are updated in place
! A plain append is not idempotent. Use delete-then-insert, partition overwrite or MERGE.

? Why did ELT overtake ETL in cloud warehouses?
- SQL cannot express transformations
+ Cheap storage and scalable compute make it practical to load raw data first and transform in-warehouse
- ETL tools are illegal in the cloud
- ELT needs no transformations
! Keeping raw data and transforming with warehouse SQL is simpler, more flexible and replayable.

? An incremental job filters on `updated_at > last_max`. Which rows can it silently miss?
- Rows inserted today
+ Rows hard-deleted in the source, and late rows arriving with older timestamps
- Rows with the largest updated_at
- None
! Deleted rows leave no trace to pick up, and late-arriving rows fall behind the watermark. Mitigate with lookback windows, soft deletes or CDC.
:::
