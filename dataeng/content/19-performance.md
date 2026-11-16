Slow queries cost money and trust. Performance work follows one principle: **read less data**. Everything else is a detail.

## Read the plan first

Never guess. Ask the engine how it intends to run your query.

```sql
EXPLAIN QUERY PLAN            -- SQLite; elsewhere EXPLAIN / EXPLAIN ANALYZE
SELECT * FROM events WHERE customer_id = 7;
```

- `SCAN events` — reads **every row** (a full table scan).
- `SEARCH events USING INDEX …` — jumps straight to matching rows.

In a warehouse you look for the same things under different names: bytes scanned, partitions pruned, join strategy and any stage that produces far more rows than it consumes.

## Indexes (row stores)

An index is a sorted structure mapping column values to row locations — like the index of a book. Lookups go from O(n) to O(log n).

```sql
CREATE INDEX idx_events_customer ON events (customer_id);
```

Trade-offs: every index slows down writes and uses storage. Index the columns you filter and join on, not everything. For multi-column indexes, order matters: `(customer_id, event_ts)` helps `WHERE customer_id = ?` but not `WHERE event_ts = ?` alone.

## Warehouses: partitions and clustering instead of indexes

Columnar warehouses rarely have classic indexes. Their equivalents:

| Technique | Effect |
| --- | --- |
| **Partitioning** (usually by date) | skip whole partitions |
| **Clustering / sort keys** | co-locate similar values so min/max stats skip blocks |
| **Column pruning** | never `SELECT *` |
| **Materialised views / aggregates** | pre-compute expensive results |

A filter only prunes if it is applied **directly to the partition column**. `WHERE DATE(event_ts) = '2025-06-01'` on a table partitioned by `event_ts` may scan everything, because the function hides the column from the planner. Write `WHERE event_ts >= '2025-06-01' AND event_ts < '2025-06-02'`.

## The usual suspects

1. `SELECT *` on wide tables.
2. Missing partition filter — scanning years to answer a question about yesterday.
3. Join fan-out — exploding rows, then `DISTINCT` to hide it.
4. Functions on filtered columns, defeating indexes and pruning.
5. Joining before filtering/aggregating when you could reduce first.
6. Skewed joins (see the Spark lesson).

:::sql id=perf-1 title="Kill the full scan"
This query is run constantly: `SELECT * FROM events WHERE customer_id = 7`.

Run `EXPLAIN QUERY PLAN` on it and you will see a full `SCAN`. Create an index so that it becomes a `SEARCH`, then run the `EXPLAIN` again to confirm.
@starter
-- 1) look at the plan
EXPLAIN QUERY PLAN SELECT * FROM events WHERE customer_id = 7;

-- 2) create an index here, then re-run to compare
@solution
CREATE INDEX idx_events_customer ON events (customer_id);
EXPLAIN QUERY PLAN SELECT * FROM events WHERE customer_id = 7;
@check
SELECT COUNT(*) > 0 AS has_index FROM pragma_index_list('events') AS il JOIN pragma_index_info(il.name) AS ii WHERE ii.seqno = 0 AND ii.name = 'customer_id';
@hint
`CREATE INDEX idx_events_customer ON events (customer_id);` — put it *before* the EXPLAIN so the plan shows the index.
:::

:::quiz
? A query plan shows `SCAN orders`. What does it mean?
- The query used an index
+ Every row of the table is read
- The table is being repaired
- Only one partition is read
! A scan reads the whole table. That is fine for small tables or analytical aggregates, but wasteful for selective lookups.

? You have an index on `(customer_id, event_ts)`. Which filter can use it efficiently?
- WHERE event_ts = '2025-06-01'
+ WHERE customer_id = 7
- WHERE event_type = 'purchase'
- WHERE event_id > 100
! Composite indexes are sorted by their leading column first, so a filter must include the leftmost column(s).

? A table is partitioned by `event_date`. Which filter allows partition pruning?
- WHERE CAST(event_date AS STRING) LIKE '2025-06%'
- WHERE YEAR(event_date) = 2025
+ WHERE event_date BETWEEN '2025-06-01' AND '2025-06-30'
- WHERE user_id = 42
! A direct range predicate on the partition column lets the planner eliminate partitions. Wrapping the column in functions often prevents that.

? What is the downside of adding many indexes to a table?
- Queries return wrong results
+ Writes become slower and storage grows
- The table can no longer be joined
- SELECT * stops working
! Every insert, update and delete must also maintain each index.

? What single principle underlies most query optimisation?
- Use more joins
- Always add DISTINCT
+ Read less data
- Use larger clusters
! Pruning partitions, projecting fewer columns, filtering early and using indexes are all ways to touch fewer bytes.
:::
