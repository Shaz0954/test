The file format you choose decides how much you pay, how fast queries run and how painful schema changes are. It is one of the highest-leverage decisions a data engineer makes.

## Row-oriented vs column-oriented

Take a table with columns `id, country, amount`.

```text
Row-oriented (CSV, JSON, Avro)        Column-oriented (Parquet, ORC)
1,US,120.0                            id:      1, 2, 3
2,DE,80.5                             country: US, DE, US
3,US,42.0                             amount:  120.0, 80.5, 42.0
```

- **Row formats** keep each record together: great for writing one event at a time and reading whole records (OLTP, message queues).
- **Columnar formats** keep each column together: great for analytics, because a query touching 3 of 50 columns reads ~6% of the data, and similar values next to each other compress extremely well.

## The formats you will meet

| Format | Layout | Schema | Human-readable | Use it for |
| --- | --- | --- | --- | --- |
| CSV | row | none | yes | exports, small interchange files |
| JSON / JSONL | row | none (self-describing) | yes | APIs, logs, semi-structured data |
| Avro | row | embedded, evolvable | no | Kafka messages, row-wise ingestion |
| **Parquet** | **column** | embedded, typed | no | **analytics — the lake default** |
| ORC | column | embedded, typed | no | Hive-era ecosystems |

## Why Parquet is fast

1. **Column projection** — read only the columns in your `SELECT`.
2. **Compression & encoding** — dictionary and run-length encoding shrink repetitive columns 5–20×.
3. **Predicate pushdown** — each chunk stores min/max statistics, so the reader skips chunks that cannot match the `WHERE` clause.

## Partitioning

Lakes organise files into folders by a low-cardinality column, usually the date:

```text
s3://lake/events/date=2025-06-01/part-000.parquet
s3://lake/events/date=2025-06-02/part-000.parquet
```

A query with `WHERE date = '2025-06-02'` opens one folder and ignores the rest. This is **partition pruning**, and it often matters more than anything else you can do.

:::callout warn
Do not over-partition. Partitioning by `user_id` creates millions of tiny files, and listing and opening them costs more than it saves. Aim for partitions of at least hundreds of megabytes and files of roughly 128 MB–1 GB.
:::

## Try it

Play with the simulator: switch format, toggle partitioning, select fewer columns and shrink the date range. Watch how much data the engine has to scan.

:::sim scan
:::

:::quiz
? A query selects 2 columns out of 40 from a 1 TB dataset. Which format lets the engine avoid reading most of the data?
- CSV
- JSON Lines
+ Parquet
- Avro
! Parquet is columnar, so the engine reads only the two requested columns. Row formats must read every full row.

? What is partition pruning?
- Deleting old partitions to save space
+ Skipping partitions that a query's filter rules out
- Compressing each partition separately
- Splitting a large file into smaller files
! If data is laid out by date and the query filters on date, the engine never opens the irrelevant folders.

? Why is partitioning a large events table by `user_id` usually a bad idea?
- user_id is not a valid partition type
+ It creates huge numbers of tiny files, and file overhead dominates
- Queries can never filter on user_id
- Parquet cannot store IDs
! High-cardinality partition keys produce the "small files problem". Partition by something coarse like date.

? Which format is the usual choice for Kafka messages because of its compact rows and strong schema evolution?
- CSV
- Parquet
+ Avro
- ORC
! Avro is row-oriented (one message = one record), compact, and designed for schemas that evolve over time.
:::
