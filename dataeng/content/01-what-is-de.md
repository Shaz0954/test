Every dashboard, recommendation and ML model depends on data arriving **on time, correct and in a usable shape**. Making that happen — reliably, at scale, every day — is data engineering.

## What a data engineer actually does

A data engineer builds and operates the systems that move data from where it is *created* to where it is *used*.

| Role | Main question | Typical tools |
| --- | --- | --- |
| **Data engineer** | "Is the data there, correct and fast to query?" | SQL, Python, Spark, Airflow, Kafka, dbt |
| Data analyst | "What happened and why?" | SQL, BI tools |
| Data scientist / ML engineer | "What will happen? Can we automate the decision?" | Python, notebooks, ML frameworks |
| Analytics engineer | "Is the business logic modelled cleanly?" | SQL, dbt |

## The data engineering lifecycle

Almost every system you will ever build follows the same five stages:

1. **Generation** — apps, databases, devices and third-party APIs produce data.
2. **Ingestion** — move it out of the source, in *batches* (every hour) or as a *stream* (continuously).
3. **Storage** — land it somewhere durable and cheap: a data lake, warehouse or lakehouse.
4. **Transformation** — clean, join and model raw data into trustworthy tables.
5. **Serving** — expose it to dashboards, ML models, reverse-ETL and other teams.

Running underneath all five are the *undercurrents*: orchestration, data quality, security, cost management and observability. Beginners focus on the stages; professionals are distinguished by the undercurrents.

## OLTP vs OLAP

The application database and the analytics warehouse solve opposite problems.

| | OLTP (app database) | OLAP (warehouse) |
| --- | --- | --- |
| Workload | Many tiny reads/writes | Few huge reads |
| Example query | "Get order 1042" | "Revenue by country for the last 3 years" |
| Storage layout | Row-oriented | Column-oriented |
| Examples | PostgreSQL, MySQL | Snowflake, BigQuery, Redshift, DuckDB |

A large part of the job is moving data from OLTP systems into OLAP systems without hurting production and without losing or duplicating anything.

:::callout tip
**How this course works.** Every lesson mixes short explanations with hands-on work: real SQL running in your browser, Python exercises, simulators and a quiz. Finish the challenges and pass the quiz (70%+) to complete a lesson and earn XP. Press **Ctrl/⌘ + K** anywhere to search.
:::

## Batch vs streaming

- **Batch**: process a bounded chunk on a schedule. Simple, cheap, easy to re-run. Latency of minutes to hours.
- **Streaming**: process events continuously as they arrive. Seconds of latency, but harder to operate and reason about.

Most companies are 90% batch. Reach for streaming when the *business* needs low latency (fraud detection, live inventory), not because it sounds impressive.

:::quiz
? Which stage of the data engineering lifecycle turns raw data into clean, modelled tables?
- Ingestion
- Serving
+ Transformation
- Generation
! Transformation is where cleaning, joining and modelling happen. Ingestion only moves data; serving exposes the finished product.

? A query that computes total revenue per country over three years of orders is a typical…
- OLTP workload
+ OLAP workload
- Streaming workload
- Transactional workload
! Scanning and aggregating huge numbers of rows is analytical (OLAP). OLTP is about many small, fast, single-row operations.

? Your team wants yesterday's sales in a dashboard every morning at 8am. What is the most sensible ingestion approach?
- A Kafka streaming pipeline with sub-second latency
+ A scheduled daily batch job
- Manual CSV exports
- Querying the production database directly from the dashboard
! The requirement is daily freshness, so a daily batch is simplest and cheapest. Streaming adds operational cost with no business benefit here, and querying production directly risks hurting the app.

? Which of these is an "undercurrent" that runs across every lifecycle stage?
- Ingestion
- Storage
- Serving
+ Data quality
! Quality, orchestration, security, cost and observability cut across every stage rather than being a stage themselves.
:::
