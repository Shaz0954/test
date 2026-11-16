CTEs and window functions are what separate "can write SQL" from "can build pipelines in SQL". You will use both every single day.

## CTEs: name your steps

A Common Table Expression is a named sub-query. It lets you write a transformation as a readable sequence of steps.

```sql
WITH order_totals AS (
  SELECT order_id, SUM(quantity * unit_price) AS total
  FROM order_items
  GROUP BY order_id
)
SELECT o.customer_id, AVG(t.total) AS avg_order_value
FROM orders AS o
JOIN order_totals AS t ON t.order_id = o.order_id
GROUP BY o.customer_id;
```

## Window functions: aggregate without collapsing

`GROUP BY` returns one row per group. A window function computes across a group of rows but **keeps every row**.

```sql
SELECT name, category, price,
       AVG(price) OVER (PARTITION BY category) AS category_avg
FROM products;
```

`OVER (PARTITION BY … ORDER BY …)` defines the window: which rows belong together and in what order.

| Function | Gives you |
| --- | --- |
| `ROW_NUMBER()` | 1, 2, 3… unique within the partition |
| `RANK()` / `DENSE_RANK()` | ranking with ties (with / without gaps) |
| `LAG(x)` / `LEAD(x)` | the previous / next row's value |
| `SUM(x) OVER (ORDER BY …)` | a running total |

## The single most useful pattern: latest row per key

Deduplicating and "pick the newest version" is everywhere in data engineering.

```sql
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
  FROM raw_customers
)
SELECT * FROM ranked WHERE rn = 1;
```

Memorise this. You will write it hundreds of times.

:::sql id=win-1 title="Top spenders" ordered
Using a CTE, return the `name` and total spend of the **5 customers** who spent the most on **completed** orders, biggest spender first. Spend = `SUM(quantity * unit_price)`.
@starter
WITH spend AS (
  SELECT o.customer_id, SUM(oi.quantity * oi.unit_price) AS total
  FROM orders AS o
  JOIN order_items AS oi ON oi.order_id = o.order_id
  -- filter and group here
)
SELECT
@solution
WITH spend AS (
  SELECT o.customer_id, SUM(oi.quantity * oi.unit_price) AS total
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed' GROUP BY o.customer_id
)
SELECT c.name, s.total FROM spend s JOIN customers c ON c.customer_id = s.customer_id
ORDER BY s.total DESC LIMIT 5;
@hint
Finish the CTE with `WHERE o.status = 'completed' GROUP BY o.customer_id`, then join it to `customers`, sort and limit.
:::

:::sql id=win-2 title="Rank products within each category"
Return `category`, `name`, `price` and each product's price rank **within its category** (1 = most expensive) using `RANK()`.
@starter
SELECT category, name, price,
       RANK() OVER ( ) AS price_rank
FROM products
@solution
SELECT category, name, price, RANK() OVER (PARTITION BY category ORDER BY price DESC) AS price_rank FROM products;
@hint
`OVER (PARTITION BY category ORDER BY price DESC)`.
:::

:::sql id=win-3 title="Running revenue total" ordered
For completed orders, return each month (`YYYY-MM`), that month's revenue, and the **cumulative** revenue up to and including that month. Sort by month.
@starter
WITH monthly AS (
  SELECT strftime('%Y-%m', o.order_date) AS month,
         SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders AS o
  JOIN order_items AS oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY month
)
SELECT month, revenue,
FROM monthly
@solution
WITH monthly AS (
  SELECT strftime('%Y-%m', o.order_date) AS month, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed' GROUP BY month
)
SELECT month, revenue, SUM(revenue) OVER (ORDER BY month) AS running_total FROM monthly ORDER BY month;
@hint
A running total is `SUM(revenue) OVER (ORDER BY month)`.
:::

:::sql id=win-4 title="Latest order per customer"
Return `customer_id`, `order_id` and `order_date` of each customer's **most recent** order. If a customer has two orders on the same date, pick the one with the higher `order_id`.
@starter
WITH ranked AS (
  SELECT *,
         ROW_NUMBER() OVER ( ) AS rn
  FROM orders
)
SELECT customer_id, order_id, order_date
FROM ranked
@solution
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn FROM orders
)
SELECT customer_id, order_id, order_date FROM ranked WHERE rn = 1;
@hint
Partition by `customer_id`, order by `order_date DESC, order_id DESC`, keep `rn = 1`.
:::

:::quiz
? What is the key difference between `GROUP BY` and a window function?
- Window functions are always faster
+ GROUP BY collapses rows; window functions keep every row
- Window functions cannot aggregate
- GROUP BY cannot be used with joins
! A window function adds a computed column alongside each original row instead of reducing the rows to one per group.

? Three products tie for the highest price. What do `RANK()` and `ROW_NUMBER()` assign to them?
- RANK: 1,2,3 — ROW_NUMBER: 1,1,1
+ RANK: 1,1,1 — ROW_NUMBER: 1,2,3 (in arbitrary order)
- Both assign 1,1,1
- Both assign 1,2,3
! RANK gives ties the same rank; ROW_NUMBER always produces unique numbers, breaking ties arbitrarily unless you add a tiebreaker.

? Which function compares each month's revenue to the previous month's?
- RANK()
- ROW_NUMBER()
+ LAG()
- COUNT()
! `LAG(revenue) OVER (ORDER BY month)` returns the previous row's value, perfect for period-over-period comparisons.

? Why add a tiebreaker column to the ORDER BY of a ROW_NUMBER() used for deduplication?
- It makes the query faster
+ Without it, which duplicate survives is non-deterministic, so re-runs can give different results
- ROW_NUMBER requires two ORDER BY columns
- To avoid NULLs
! Deterministic output is essential for idempotent pipelines. If two rows tie, the database may pick a different one each run.
:::
