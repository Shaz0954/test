One script on a cron job is fine. Fifty jobs that depend on each other, fail independently and need re-running for last Tuesday are not. That is what an **orchestrator** is for.

## Pipelines are DAGs

A pipeline is a **Directed Acyclic Graph**: tasks are nodes, dependencies are edges, and there are no cycles — so there is always a valid order to run things in.

```python
# Airflow-style DAG definition
with DAG("daily_sales", schedule="0 6 * * *", catchup=False) as dag:
    extract   = PythonOperator(task_id="extract_orders", python_callable=extract_orders, retries=2)
    transform = SQLOperator(task_id="build_fact_sales", sql="sql/fact_sales.sql")
    test      = SQLCheckOperator(task_id="dq_tests", sql="sql/tests.sql")

    extract >> transform >> test
```

## What an orchestrator gives you

| Capability | Why it matters |
| --- | --- |
| **Scheduling** | Run at 06:00 daily, or when upstream data lands |
| **Dependencies** | Never build the fact table before its inputs are ready |
| **Retries** | Networks blip; a retry with backoff fixes most failures |
| **Backfills** | Re-run a range of past dates after a fix |
| **Observability** | One place to see what ran, what failed and why |
| **Alerting** | Tell a human when retries are exhausted or an SLA is missed |

Popular choices: **Airflow** (the incumbent), **Dagster** (asset-oriented), **Prefect**, and managed services such as MWAA and Cloud Composer.

## Task states

A task moves through `queued → running → success`. On error it becomes `up_for_retry` and is tried again; when retries run out it is `failed`, and everything downstream becomes `upstream_failed` and does not run.

## Designing good tasks

- **Idempotent** — retries and backfills must be safe (previous lesson!).
- **Atomic** — a task either fully succeeds or leaves nothing half-written.
- **Parameterised by data interval** — use the run's logical date, not `now()`.
- **Small** — when one step fails, retry that step, not the whole pipeline.
- **Orchestrate, do not compute** — the orchestrator should trigger Spark or the warehouse, not crunch gigabytes itself.

## Run a DAG

Click a task to make it **flaky** (fails once) or **broken** (always fails). Change the retry count and parallelism, press **Run**, and watch how failure propagates.

:::sim dag
:::

:::python id=py-topo title="Write a scheduler's core"
Given `deps`, a dict mapping each task to the list of tasks it depends on, write `run_order(deps)` that returns the tasks in a valid execution order (every task after all of its dependencies). This is a **topological sort**.
@starter
def run_order(deps):
    # deps = {"load": ["extract"], "extract": [], "test": ["load"]}
    order = []
    return order
@solution
def run_order(deps):
    order, done = [], set()
    def visit(task):
        if task in done:
            return
        for d in deps.get(task, []):
            visit(d)
        done.add(task)
        order.append(task)
    for task in deps:
        visit(task)
    return order
@test
deps = {"publish": ["test"], "test": ["fact"], "fact": ["dim_a", "dim_b"], "dim_a": ["extract"], "dim_b": ["extract"], "extract": []}
out = run_order(deps)
assert sorted(out) == sorted(deps), f"Every task must appear exactly once, got {out}"
pos = {t: i for i, t in enumerate(out)}
for t, ds in deps.items():
    for d in ds:
        assert pos[d] < pos[t], f"'{d}' must run before '{t}', got {out}"
assert run_order({}) == [], "Empty DAG should give an empty order"
@hint
Depth-first: to "visit" a task, first visit each of its dependencies, then append the task itself. Track visited tasks in a set.
:::

:::quiz
? Why must a pipeline graph be acyclic?
- Cycles make it slower
+ With a cycle there is no valid order in which to run the tasks
- Orchestrators cannot draw cycles
- Cycles use too much memory
! If A needs B and B needs A, neither can ever start. Acyclicity guarantees a topological order exists.

? A task fails and has retries remaining. What state does it enter?
- failed
- upstream_failed
+ up_for_retry
- skipped
! It waits (often with backoff) and runs again. Only after exhausting retries does it become failed.

? Task B depends on task A. A fails permanently. What happens to B?
- B runs anyway
- B is retried
+ B is marked upstream_failed and does not run
- B succeeds automatically
! Running B on missing or partial inputs would produce wrong data, so the orchestrator blocks it.

? What is a backfill?
- Filling NULLs with defaults
+ Running a pipeline for past data intervals
- Copying data to a backup region
- Retrying a failed task once
! Backfills re-process history, e.g. after fixing a bug. They are only safe when tasks are idempotent and parameterised by date.

? Which is the best practice for a heavy 500 GB transformation in Airflow?
- Load it into a pandas DataFrame inside a PythonOperator
+ Have the task trigger the warehouse or Spark and wait for the result
- Split it into 500 PythonOperators
- Run it on the scheduler machine
! Orchestrators coordinate work; dedicated engines do the heavy lifting.
:::
