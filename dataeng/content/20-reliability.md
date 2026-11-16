Anyone can build a pipeline that works on a good day. Senior data engineers build platforms that people **trust** — which means knowing about problems before the consumers do.

## Define "working": SLIs, SLOs, SLAs

- **SLI** (indicator) — a measurement: *the orders table was updated at 06:42*.
- **SLO** (objective) — your internal target: *fresh by 07:00 on 99% of days*.
- **SLA** (agreement) — the promise to consumers, with consequences.

Without an SLO, every delay is an argument. With one, you know when to page someone and when to go back to sleep.

## The five pillars of data observability

| Pillar | Question | Signal |
| --- | --- | --- |
| **Freshness** | Did it arrive on time? | `MAX(loaded_at)` vs now |
| **Volume** | Is it the right amount? | row count vs trailing average |
| **Schema** | Did the structure change? | columns added/removed/retyped |
| **Distribution** | Do the values look normal? | NULL rate, min/max, distinct counts |
| **Lineage** | What is upstream and downstream? | dependency graph |

Most incidents show up as freshness or volume anomalies first. Start there.

## Designing for failure

- **Retries with exponential backoff** for transient errors.
- **Idempotent tasks**, so retries and reruns are harmless.
- **Dead-letter queues**, so one poison record does not stop the stream.
- **Timeouts**, so a hung job fails loudly instead of blocking forever.
- **Circuit breakers** — stop publishing when checks fail (write–audit–publish).
- **Backpressure** — slow intake rather than fall over when downstream is saturated.

## Data contracts

Most data incidents start upstream: a developer renames a column and forty dashboards break. A **data contract** is an explicit, versioned agreement — schema, semantics, freshness, owner — enforced in the producer's CI so breaking changes are caught *before* deployment.

## When it breaks anyway

1. **Detect** — ideally an alert, not a stakeholder.
2. **Communicate** — tell consumers early which datasets are affected.
3. **Mitigate** — stop the bleeding: pause publishing, roll back.
4. **Fix and backfill** — repair the cause, re-run the affected intervals.
5. **Blameless post-mortem** — what failed, why was it not caught, what check prevents a repeat?

:::callout tip
Alert on **symptoms consumers feel** (stale or wrong tables), not on every failed task attempt. A task that fails once and succeeds on retry is the system working as designed.
:::

:::sql id=obs-1 title="Pipeline scorecard" ordered
`pipeline_runs` logs every run. For each `pipeline` return:

1. `pipeline`
2. success rate as a percentage, rounded to 1 decimal
3. average duration in minutes of **successful** runs, rounded to 1 decimal

Sort by pipeline name. (Minutes between two timestamps: `(julianday(finished_at) - julianday(started_at)) * 1440`.)
@setup
CREATE TABLE pipeline_runs (run_id INTEGER PRIMARY KEY, pipeline TEXT, status TEXT, started_at TEXT, finished_at TEXT, rows_loaded INTEGER);
INSERT INTO pipeline_runs VALUES
 (1,'orders_daily','success','2025-06-01 06:00:00','2025-06-01 06:12:00',10250),
 (2,'orders_daily','success','2025-06-02 06:00:00','2025-06-02 06:14:00',9980),
 (3,'orders_daily','failed','2025-06-03 06:00:00','2025-06-03 06:02:00',0),
 (4,'orders_daily','success','2025-06-03 07:30:00','2025-06-03 07:41:00',10410),
 (5,'orders_daily','success','2025-06-04 06:00:00','2025-06-04 06:13:00',3120),
 (6,'events_hourly','success','2025-06-04 05:00:00','2025-06-04 05:04:00',48000),
 (7,'events_hourly','success','2025-06-04 06:00:00','2025-06-04 06:05:00',51200),
 (8,'events_hourly','success','2025-06-04 07:00:00','2025-06-04 07:04:00',49500),
 (9,'events_hourly','failed','2025-06-04 08:00:00','2025-06-04 08:30:00',0),
 (10,'events_hourly','success','2025-06-04 09:00:00','2025-06-04 09:03:00',12100),
 (11,'crm_sync','success','2025-06-03 02:00:00','2025-06-03 02:40:00',2200),
 (12,'crm_sync','success','2025-06-04 02:00:00','2025-06-04 02:44:00',2260);
@starter
SELECT pipeline,
       ROUND(100.0 * SUM(status = 'success') / COUNT(*), 1) AS success_pct,
FROM pipeline_runs
@solution
SELECT pipeline,
       ROUND(100.0 * SUM(status = 'success') / COUNT(*), 1) AS success_pct,
       ROUND(AVG(CASE WHEN status = 'success' THEN (julianday(finished_at) - julianday(started_at)) * 1440 END), 1) AS avg_minutes
FROM pipeline_runs GROUP BY pipeline ORDER BY pipeline;
@hint
`AVG(CASE WHEN status = 'success' THEN <minutes> END)` averages successful runs only — AVG ignores the NULLs the CASE produces for failures.
:::

:::sql id=obs-2 title="Volume anomaly detection"
Find **successful** runs that loaded fewer than **half** of their pipeline's average `rows_loaded` (average over that pipeline's successful runs). Return `run_id`, `pipeline` and `rows_loaded`.
@setup
CREATE TABLE pipeline_runs (run_id INTEGER PRIMARY KEY, pipeline TEXT, status TEXT, started_at TEXT, finished_at TEXT, rows_loaded INTEGER);
INSERT INTO pipeline_runs VALUES
 (1,'orders_daily','success','2025-06-01 06:00:00','2025-06-01 06:12:00',10250),
 (2,'orders_daily','success','2025-06-02 06:00:00','2025-06-02 06:14:00',9980),
 (3,'orders_daily','failed','2025-06-03 06:00:00','2025-06-03 06:02:00',0),
 (4,'orders_daily','success','2025-06-03 07:30:00','2025-06-03 07:41:00',10410),
 (5,'orders_daily','success','2025-06-04 06:00:00','2025-06-04 06:13:00',3120),
 (6,'events_hourly','success','2025-06-04 05:00:00','2025-06-04 05:04:00',48000),
 (7,'events_hourly','success','2025-06-04 06:00:00','2025-06-04 06:05:00',51200),
 (8,'events_hourly','success','2025-06-04 07:00:00','2025-06-04 07:04:00',49500),
 (9,'events_hourly','failed','2025-06-04 08:00:00','2025-06-04 08:30:00',0),
 (10,'events_hourly','success','2025-06-04 09:00:00','2025-06-04 09:03:00',12100),
 (11,'crm_sync','success','2025-06-03 02:00:00','2025-06-03 02:40:00',2200),
 (12,'crm_sync','success','2025-06-04 02:00:00','2025-06-04 02:44:00',2260);
@starter
WITH scored AS (
  SELECT *,
         AVG(rows_loaded) OVER (PARTITION BY pipeline) AS avg_rows
  FROM pipeline_runs
  WHERE status = 'success'
)
SELECT run_id, pipeline, rows_loaded
FROM scored
@solution
WITH scored AS (
  SELECT *, AVG(rows_loaded) OVER (PARTITION BY pipeline) AS avg_rows FROM pipeline_runs WHERE status = 'success'
)
SELECT run_id, pipeline, rows_loaded FROM scored WHERE rows_loaded < 0.5 * avg_rows;
@hint
Compare each run with its window average: `WHERE rows_loaded < 0.5 * avg_rows`.
:::

:::quiz
? "The orders table is fresh by 07:00 on 99% of days" is an example of…
- An SLI
+ An SLO
- A data contract
- A watermark
! An SLO is a target for an indicator. The SLI is the measured freshness itself.

? Which two observability pillars catch most incidents first?
- Schema and lineage
+ Freshness and volume
- Distribution and lineage
- Lineage and cost
! Late data and unexpected row counts are the earliest and cheapest signals to monitor.

? What is the purpose of a dead-letter queue?
- To archive old data
+ To set aside records that cannot be processed so the pipeline keeps running
- To delete duplicates
- To speed up consumers
! One malformed record should not halt a stream. Park it, alert, and continue.

? A producer team wants to rename a column that your pipeline reads. What mechanism catches this before it ships?
- Retries
- A larger cluster
+ A data contract enforced in the producer's CI
- Partition pruning
! Contracts make the schema an explicit, tested interface, so breaking changes fail the producer's build.

? What makes a post-mortem "blameless"?
- Nobody is told about the incident
+ It focuses on fixing systems and processes rather than punishing individuals
- It skips root-cause analysis
- Only managers attend
! People report problems honestly when they are not punished for them — which is how systems actually improve.
:::
