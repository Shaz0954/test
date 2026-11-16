"Design a data pipeline for X" is both the classic senior interview question and what you actually do at work. There is no single right answer — only trade-offs you can justify. Use a framework so you never freeze.

## A six-step framework

**1. Clarify requirements.** Do not design anything yet. Ask:

- Who consumes the data, and for what decision?
- **Freshness** — seconds, minutes, hours, daily?
- **Volume** — events per second, GB per day, growth?
- **Correctness** — is approximate acceptable, or is this financial reporting?
- Retention, compliance, PII?

**2. Identify sources.** Databases (CDC or batch extract?), event streams, third-party APIs (rate limits!), files. Who owns them, and how do they change?

**3. Choose ingestion.** Batch or streaming — driven by the freshness requirement, not by fashion.

**4. Choose storage and model.** Raw landing zone → cleaned layer → marts. Pick the format, partitioning, and the grain of the core fact tables.

**5. Choose processing.** SQL in the warehouse (dbt)? Spark for volume? Flink for low-latency stateful logic? Prefer the simplest engine that meets the requirement.

**6. Address the undercurrents.** Orchestration, idempotency and backfills, data quality checks, monitoring and SLOs, security, cost. *This is where senior candidates stand out.*

## Reference architecture

```text
 App DBs ──CDC──▶ Kafka ──▶ Stream processor ──▶ Real-time serving
                    │
 Event SDKs ───────┘ └────▶ Object storage (bronze, Parquet/Iceberg)
 SaaS APIs ──batch──────────────▶ │
                                  ▼
                       Warehouse / lakehouse
                   staging ─▶ facts & dims ─▶ marts
                                  │
                 BI dashboards · ML features · reverse ETL

   Orchestration · Data quality · Catalogue & lineage · Access control · Cost
```

You almost never need all of it. A startup with 5 GB of data needs a managed ELT tool, a warehouse and dbt — nothing else.

## Trade-offs to say out loud

| Decision | Leaning one way | Leaning the other |
| --- | --- | --- |
| Batch vs streaming | simple, cheap, easy to backfill | low latency, complex operations |
| Warehouse vs lakehouse | simplicity, SQL-first | openness, ML, extreme scale |
| Normalised vs denormalised | integrity, storage | query speed and simplicity |
| Full refresh vs incremental | trivially correct | scalable, but harder to get right |
| Build vs buy | control, no licence fees | speed, less to maintain |

## Lambda and Kappa

- **Lambda** — a batch layer (complete, slow) plus a speed layer (fast, approximate), merged at query time. Two codebases to keep consistent.
- **Kappa** — streaming only; reprocess by replaying the log. One codebase, but everything must work as a stream.

Lakehouse table formats blur the line by letting batch and streaming jobs write to the same tables.

:::callout tip
In an interview, state your assumptions, start with the simplest design that works, and then evolve it as the interviewer adds scale or latency constraints. Jumping straight to Kafka + Flink for a daily report is a red flag.
:::

:::quiz
? You are asked to "design a pipeline for clickstream analytics". What should you do first?
- Draw Kafka and Spark
- Choose a cloud provider
+ Ask about consumers, freshness, volume and correctness requirements
- Start writing the schema
! Requirements drive every later choice. Designing before clarifying is the most common mistake.

? Finance needs revenue reports each morning, accurate to the cent, from a PostgreSQL database with 20 GB of data. Best fit?
- Kafka + Flink exactly-once streaming into a real-time OLAP store
+ Daily batch (or CDC) ELT into a warehouse, modelled with dbt and tested
- A Spark cluster with 200 executors
- Analysts query production directly
! Daily freshness and modest volume call for a simple, well-tested batch ELT. Correctness comes from tests and reconciliation, not from streaming.

? A fraud model must score card payments within 200 ms. Which ingestion style is required?
- Nightly batch
- Hourly micro-batch
+ Event streaming
- Weekly snapshots
! A hard sub-second latency requirement is exactly what justifies streaming's extra complexity.

? What is the main drawback of the Lambda architecture?
- It cannot handle large volumes
+ The same logic must be implemented and kept consistent in two separate pipelines
- It has no batch layer
- It does not support SQL
! Maintaining parallel batch and streaming codebases that must agree is costly and error-prone.

? A startup has 5 GB of data and two analysts. Which stack is most appropriate?
- Self-hosted Kafka, Flink, Spark and Iceberg
+ A managed ingestion tool, a cloud warehouse and dbt
- A custom-built distributed query engine
- Hadoop on bare metal
! Match complexity to need. Small teams should buy simplicity and spend their time on the data, not the plumbing.

? A third-party API you ingest from allows 100 requests per minute. Your design should include…
- Unlimited parallel requests to finish faster
+ Rate limiting, retries with backoff and incremental extraction with checkpoints
- A full re-download every run
- Ignoring failed requests
! Respecting limits, resuming from checkpoints and backing off on errors make API ingestion reliable.

? Which part of a design answer most distinguishes senior engineers?
- Naming the most tools
- Using the newest technology
+ Covering failure handling, idempotency, data quality, monitoring and cost
- Drawing the largest diagram
! Anyone can draw boxes and arrows. Explaining how it fails, recovers and is operated shows real experience.
:::
