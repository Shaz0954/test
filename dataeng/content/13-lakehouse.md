Where should analytical data live? For twenty years the answer was "a data warehouse". Then came data lakes, and now the lakehouse. Understanding the trade-offs is core architecture knowledge.

## Data warehouse

A managed analytical database: you load data, it handles storage layout, statistics and query execution.

- **Examples**: Snowflake, BigQuery, Redshift, ClickHouse.
- **Strengths**: fast SQL, ACID transactions, governance, little to operate.
- **Weaknesses**: data is locked in a proprietary format; costly at extreme scale; awkward for ML and unstructured data.

Modern warehouses **separate storage from compute**: data sits in cheap object storage and you spin compute clusters up and down independently, paying for what you use.

## Data lake

Files in object storage (S3, GCS, ADLS) in open formats, queried by whichever engine you like (Spark, Trino, DuckDB).

- **Strengths**: very cheap, any data type, no lock-in, great for ML.
- **Weaknesses**: on its own a lake has no transactions, no schema enforcement and no safe updates or deletes. Neglected lakes become *data swamps*.

## Lakehouse

A lakehouse adds a **table format** — Apache Iceberg, Delta Lake or Hudi — on top of Parquet files in a lake. The table format is a metadata layer that tracks exactly which files make up each version of a table.

That one idea provides:

| Feature | How |
| --- | --- |
| ACID transactions | a commit atomically swaps the table's metadata pointer |
| Updates, deletes, MERGE | rewrite affected files and commit a new snapshot |
| Time travel | old snapshots remain queryable |
| Schema evolution | columns tracked by ID, so renames and adds are safe |
| Fast planning | file-level statistics allow skipping without listing folders |

```sql
-- Iceberg / Delta style
MERGE INTO lake.orders t USING staging.orders s ON t.order_id = s.order_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;

SELECT * FROM lake.orders TIMESTAMP AS OF '2025-06-01 00:00:00';   -- time travel
```

## Keeping a lakehouse healthy

- **Compaction** — streaming and frequent writes create many small files; periodically merge them.
- **Snapshot expiry** — old snapshots keep old files alive; expire them to control storage cost.
- **Clustering / sorting** — sort data by commonly filtered columns so min/max statistics can skip more.

## Which should you choose?

| Situation | Sensible default |
| --- | --- |
| Small team, mostly SQL and BI | Warehouse |
| Heavy ML, huge volumes, many engines | Lakehouse |
| Raw landing zone for anything | Lake (object storage) feeding either |

Many companies run both: a lake for raw and ML data, and a warehouse or lakehouse for curated tables.

:::quiz
? What does a table format such as Iceberg or Delta Lake add on top of Parquet files?
- Faster disks
+ A metadata layer providing ACID transactions, schema evolution and time travel
- A proprietary storage engine
- Automatic dashboards
! The table format tracks which files belong to each table snapshot, enabling atomic commits and safe changes on plain object storage.

? What does "separation of storage and compute" allow?
- Storing data without paying for it
+ Scaling and paying for query power independently of data volume
- Running queries without any storage
- Avoiding the need for SQL
! You can keep petabytes cheaply and only pay for compute while queries run, sizing each independently.

? A streaming job writes a tiny Parquet file every 10 seconds. What maintenance does the table need?
- Vacuuming indexes
- Re-partitioning by user_id
+ Compaction of small files into larger ones
- Converting to CSV
! Thousands of small files make planning and reading slow. Compaction rewrites them into fewer large files.

? A plain data lake without a table format struggles most with…
- Storing images
- Storing large volumes cheaply
+ Reliable updates, deletes and concurrent writes
- Using open file formats
! Object storage has no transactions. Without a table format, concurrent or failed writes can leave tables inconsistent.
:::
