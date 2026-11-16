The most valuable data in a company usually sits in its application databases. **Change Data Capture (CDC)** gets it out continuously, without hammering production with big queries.

## Ways to copy a database

| Approach | How | Problems |
| --- | --- | --- |
| Full snapshot | `SELECT *` every night | heavy on the source; no intermediate changes |
| Query-based incremental | `WHERE updated_at > last_run` | misses hard deletes; needs a reliable `updated_at`; polls the source |
| **Log-based CDC** | read the database's transaction log | more moving parts — but complete and low impact |

## Log-based CDC

Every database already writes each change to a log for crash recovery and replication (the *WAL* in PostgreSQL, the *binlog* in MySQL). A CDC tool such as **Debezium** reads that log and publishes each change as an event, typically to Kafka:

```json
{
  "op": "u",
  "before": {"customer_id": 7, "tier": "silver"},
  "after":  {"customer_id": 7, "tier": "gold"},
  "source": {"table": "customers", "lsn": 48213377},
  "ts_ms": 1751328000000
}
```

`op` is `c` (create), `u` (update), `d` (delete) or `r` (snapshot read). You see **every** change, including deletes, in commit order, within seconds, with negligible load on the source.

## Applying changes downstream

Events land in a raw changelog table. To materialise the current state:

1. For each primary key keep only the **latest** event (highest log sequence number).
2. Upsert rows whose latest op is create/update.
3. Delete (or soft-delete) rows whose latest op is delete.

Because Kafka delivers at-least-once, the apply step must be **idempotent** — processing the same batch twice must give the same table.

## Things that bite in production

- **Initial snapshot** — the connector first copies existing rows, then switches to the log. Handle the hand-over without gaps.
- **Schema changes** — a new column upstream arrives as a new field. Use a schema registry and decide how changes propagate.
- **Ordering** — key events by primary key so all changes to a row stay in one partition, in order.
- **Log retention** — if the connector is down longer than the database keeps its log, you must re-snapshot.

:::sql id=cdc-1 title="Apply a changelog" twice
`replica` is a copy of a source table. `cdc_log` holds change events (`op` is `I`, `U` or `D`; higher `seq` = later). Bring `replica` up to date:

- the **latest** event per `customer_id` wins
- `I`/`U` → upsert `name` and `tier`
- `D` → remove the row

Your SQL runs **twice** — it must be idempotent.
@setup
CREATE TABLE replica (customer_id INTEGER PRIMARY KEY, name TEXT, tier TEXT);
INSERT INTO replica VALUES (1,'Ava','bronze'),(2,'Noah','silver'),(3,'Mia','gold'),(4,'Liam','bronze');
CREATE TABLE cdc_log (seq INTEGER, op TEXT, customer_id INTEGER, name TEXT, tier TEXT);
INSERT INTO cdc_log VALUES
 (101,'U',1,'Ava','silver'),(102,'I',5,'Zoe','bronze'),(103,'D',2,NULL,NULL),
 (104,'U',1,'Ava','gold'),(105,'U',5,'Zoe','silver'),(106,'I',6,'Kai','bronze'),
 (107,'D',6,NULL,NULL),(108,'U',4,'Liam B.','bronze');
@starter
WITH latest AS (
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY seq DESC) AS rn
    FROM cdc_log
  ) WHERE rn = 1
)
INSERT INTO replica (customer_id, name, tier)
SELECT customer_id, name, tier FROM latest WHERE op <> 'D'
-- make this an upsert...
;

-- ...then handle the deletes
@solution
WITH latest AS (
  SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY seq DESC) AS rn FROM cdc_log) WHERE rn = 1
)
INSERT INTO replica (customer_id, name, tier)
SELECT customer_id, name, tier FROM latest WHERE op <> 'D'
ON CONFLICT (customer_id) DO UPDATE SET name = excluded.name, tier = excluded.tier;

DELETE FROM replica WHERE customer_id IN (
  SELECT customer_id FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY seq DESC) AS rn FROM cdc_log)
  WHERE rn = 1 AND op = 'D'
);
@check
SELECT * FROM replica ORDER BY customer_id;
@hint
Add `ON CONFLICT (customer_id) DO UPDATE SET name = excluded.name, tier = excluded.tier` to the insert. Then `DELETE FROM replica WHERE customer_id IN (…keys whose latest op is 'D'…)`.
:::

:::quiz
? What is the main advantage of log-based CDC over polling with `updated_at`?
- It needs no infrastructure
+ It captures every change, including deletes, with minimal load on the source
- It works without a primary key
- It makes the source database faster
! The transaction log already records every insert, update and delete in order; reading it avoids repeated heavy queries.

? Why can query-based incremental extraction miss data?
- It reads too fast
+ Hard-deleted rows disappear, and several updates between polls collapse into one
- It cannot read integers
- It reads the transaction log
! A deleted row cannot be selected, and polling only sees the latest state — intermediate changes are lost.

? Why should CDC events be keyed by the row's primary key in Kafka?
- To compress better
- To encrypt them
+ So all changes to a row go to one partition and stay in order
- To reduce retention
! Applying an update before the insert it follows (or after a delete) corrupts the replica. Per-key ordering prevents that.

? The CDC connector was offline for longer than the source database retains its log. What must you do?
- Nothing; it resumes automatically
- Increase Kafka partitions
+ Take a new snapshot of the affected tables
- Delete the replica's primary keys
! The changes needed to catch up no longer exist, so the only way to regain consistency is to re-snapshot.
:::
