**dbt** (data build tool) brought software engineering to SQL transformations: version control, modularity, testing, documentation and CI. It owns the **T** in ELT and defined the *analytics engineer* role.

## A model is a SELECT

In dbt you never write `CREATE TABLE`. You write a `SELECT` in a file; dbt wraps it in the right DDL and builds it as a view or table.

```sql
-- models/staging/stg_orders.sql
SELECT order_id, customer_id, CAST(order_date AS DATE) AS order_date, status
FROM {{ source('shop', 'orders') }}
WHERE status <> 'test'
```

```sql
-- models/marts/customer_orders.sql
SELECT c.customer_id, COUNT(o.order_id) AS order_count
FROM {{ ref('stg_customers') }} AS c
LEFT JOIN {{ ref('stg_orders') }} AS o USING (customer_id)
GROUP BY 1
```

`{{ ref('stg_orders') }}` does two jobs: it resolves to the right table name in each environment (dev, CI, prod), and it tells dbt that this model **depends on** `stg_orders`. From the refs alone dbt builds the DAG and runs models in the right order.

## Materialisations

| Materialisation | Built as | Use when |
| --- | --- | --- |
| `view` | a view | light logic, always fresh |
| `table` | full rebuild every run | small/medium tables |
| `incremental` | insert/merge only new rows | large fact tables |
| `ephemeral` | inlined CTE | reusable snippets |

```sql
{{ config(materialized='incremental', unique_key='order_id') }}

SELECT * FROM {{ ref('stg_orders') }}
{% if is_incremental() %}
WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})
{% endif %}
```

## Tests and docs live next to the code

```yaml
models:
  - name: customer_orders
    description: One row per customer with lifetime order metrics.
    columns:
      - name: customer_id
        tests: [unique, not_null]
      - name: order_count
        tests:
          - dbt_utils.accepted_range: {min_value: 0}
```

`dbt build` runs models **and** their tests in DAG order, stopping downstream models when an upstream test fails. `dbt docs generate` produces a browsable catalogue with lineage.

## Project structure

- **staging** — one model per source table: rename, cast, clean. No joins.
- **intermediate** — reusable building blocks.
- **marts** — facts and dimensions that the business queries.

:::sql id=dbt-1 title="Write a mart model"
Write the `SELECT` for a `customer_orders` model with **one row per customer (all 30)**:

- `customer_id`, `name`
- `order_count` — number of **completed** orders (0 if none)
- `first_order`, `last_order` — earliest/latest completed order date (NULL if none)
@starter
SELECT c.customer_id,
       c.name,
       COUNT(o.order_id) AS order_count
FROM customers AS c
LEFT JOIN orders AS o
  ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.name
@solution
SELECT c.customer_id, c.name, COUNT(o.order_id) AS order_count, MIN(o.order_date) AS first_order, MAX(o.order_date) AS last_order
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
GROUP BY c.customer_id, c.name;
@hint
Put `AND o.status = 'completed'` in the **ON** clause, not WHERE — otherwise customers without completed orders vanish.
:::

:::quiz
? What does `{{ ref('stg_orders') }}` do in dbt?
- Copies the table
+ Resolves the model's table name and records a dependency for the DAG
- Runs tests on stg_orders
- Creates an index
! `ref` is how dbt infers build order and swaps schemas between dev and prod.

? Which materialisation suits a 2-billion-row fact table that grows daily?
- view
- table
+ incremental
- ephemeral
! Incremental models process only new or changed rows instead of rebuilding everything each run.

? In dbt's layering convention, what belongs in a staging model?
- Business KPIs
- Joins across many sources
+ Light cleaning of a single source table: renaming, casting, filtering
- Dashboards
! Staging models are a thin, consistent interface over raw sources. Business logic comes later.

? An upstream model's `unique` test fails during `dbt build`. What happens to models that depend on it?
- They build anyway
+ They are skipped
- They are deleted
- They are converted to views
! dbt stops bad data propagating by skipping downstream nodes when an upstream test fails.
:::
