A pipeline that finishes "successfully" while producing wrong numbers is worse than one that crashes. Data quality checks turn silent corruption into loud, early failures.

## The dimensions of data quality

| Dimension | Question | Example check |
| --- | --- | --- |
| **Uniqueness** | Are there duplicates? | primary key is unique |
| **Completeness** | Is anything missing? | `email` is not NULL; row count ≥ yesterday × 0.8 |
| **Validity** | Do values obey the rules? | `status` in an accepted set; email matches a pattern |
| **Consistency** | Do datasets agree? | every `order.customer_id` exists in `customers` |
| **Freshness** | Is it up to date? | `MAX(loaded_at)` within the last 2 hours |
| **Accuracy** | Does it match reality? | totals reconcile with the finance system |

## Tests are just queries

The convention (used by dbt and others): a test is a query that returns the **rows that violate the rule**. Zero rows = pass.

```sql
-- uniqueness test
SELECT customer_id, COUNT(*) FROM customers GROUP BY customer_id HAVING COUNT(*) > 1;

-- not-null test
SELECT * FROM customers WHERE email IS NULL;

-- referential-integrity test
SELECT o.* FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id WHERE c.customer_id IS NULL;
```

## Where to put checks

- **At ingestion** — validate schema and types; quarantine bad records in a dead-letter table rather than dropping them.
- **After each transformation** — unique and not-null keys, accepted values, row counts.
- **Before publishing** — the *write–audit–publish* pattern: build into a staging table, test it, and only swap it into production if the tests pass.

:::callout tip
Decide the severity up front. A duplicated primary key in the revenue table should **block** the pipeline. A 2% rise in NULL phone numbers should **warn**. Alert fatigue kills data quality programmes.
:::

:::sql id=dq-1 title="Find duplicate keys"
Write a uniqueness test for `raw_customers`: return each `id` that appears more than once, with how many times it appears.
@starter
SELECT id, COUNT(*) AS copies
FROM raw_customers
@solution
SELECT id, COUNT(*) AS copies FROM raw_customers GROUP BY id HAVING COUNT(*) > 1;
@hint
`GROUP BY id HAVING COUNT(*) > 1`.
:::

:::sql id=dq-2 title="A quality report"
Return **one row** with three columns describing `raw_customers`:

1. number of rows with a NULL `email`
2. number of rows with a non-NULL `email` that does **not** match the pattern `%@%.%`
3. number of rows with a NULL `country`
@starter
SELECT SUM(email IS NULL) AS null_emails,
@solution
SELECT SUM(email IS NULL) AS null_emails,
       SUM(email IS NOT NULL AND email NOT LIKE '%@%.%') AS invalid_emails,
       SUM(country IS NULL) AS null_countries
FROM raw_customers;
@hint
In SQLite a boolean is 0 or 1, so `SUM(condition)` counts matching rows. Elsewhere use `COUNT(CASE WHEN … THEN 1 END)`.
:::

:::sql id=dq-3 title="Orphaned events"
Referential integrity test: find events whose `customer_id` does not exist in `customers`. Return each such `customer_id` and its number of events.
@starter
SELECT e.customer_id, COUNT(*) AS events
FROM events AS e
@solution
SELECT e.customer_id, COUNT(*) AS events FROM events e
LEFT JOIN customers c ON c.customer_id = e.customer_id
WHERE c.customer_id IS NULL GROUP BY e.customer_id;
@hint
Anti-join: `LEFT JOIN customers c … WHERE c.customer_id IS NULL`, then group.
:::

:::quiz
? By convention, a data test query passes when it returns…
- At least one row
+ Zero rows
- Exactly one row
- TRUE
! Tests select the violating rows. No violations, no rows, test passes.

? What is the write–audit–publish pattern?
- Write to production, then audit weekly
+ Build into a staging area, run checks, and only then expose it to consumers
- Publish first and fix issues after complaints
- Write audit logs for every query
! Consumers never see data that failed its checks — bad data is stopped before it spreads.

? Yesterday's load had 1,000,000 rows; today's has 12,000. Which quality dimension is violated?
- Uniqueness
- Validity
+ Completeness
- Accuracy
! A sudden drop in volume suggests missing data. Row-count anomaly checks catch this.

? What should a pipeline do with records that fail validation at ingestion?
- Silently drop them
- Crash on the first bad record, always
+ Route them to a quarantine / dead-letter table and alert
- Insert them with random values
! Quarantining keeps the pipeline flowing while preserving the evidence needed to fix the source.
:::
