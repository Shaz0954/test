Time to put it together. You are the first data engineer at an online shop. The CEO wants one thing: **monthly revenue by product category, with month-over-month growth.**

You will build it the way you would at work — in layers, each one tested by the next.

```text
orders, order_items, products      (raw)
        │
   stg_orders                      (staging: cleaned, filtered)
        │
   fact_order_lines                (fact: one row per order line)
        │
   mart_monthly_category           (mart: business-ready aggregate)
        │
   growth report                   (the answer)
```

Each step starts with the previous steps already built for you, so you can do them in any order — but going top to bottom tells the story.

:::sql id=cap-1 title="Step 1 — Staging"
Create a view `stg_orders` containing only **completed** orders with columns:

`order_id`, `customer_id`, `order_date`, `order_month` (formatted `YYYY-MM`).
@starter
CREATE VIEW stg_orders AS
SELECT order_id,
       customer_id,
       order_date
FROM orders
@solution
CREATE VIEW stg_orders AS
SELECT order_id, customer_id, order_date, strftime('%Y-%m', order_date) AS order_month
FROM orders WHERE status = 'completed';
@check
SELECT COUNT(*), MIN(order_month), MAX(order_month), COUNT(DISTINCT order_month), SUM(customer_id) FROM stg_orders;
@hint
Add `strftime('%Y-%m', order_date) AS order_month` and `WHERE status = 'completed'`.
:::

:::sql id=cap-2 title="Step 2 — Fact table"
Create table `fact_order_lines` at the grain **one row per order line**, built from `stg_orders`, `order_items` and `products`:

`order_id`, `order_month`, `customer_id`, `product_id`, `category`, `quantity`, `revenue` (= `quantity * unit_price`).
@setup
CREATE VIEW stg_orders AS SELECT order_id, customer_id, order_date, strftime('%Y-%m', order_date) AS order_month FROM orders WHERE status = 'completed';
@starter
CREATE TABLE fact_order_lines AS
SELECT s.order_id,
       s.order_month
FROM stg_orders AS s
JOIN order_items AS oi ON oi.order_id = s.order_id
@solution
CREATE TABLE fact_order_lines AS
SELECT s.order_id, s.order_month, s.customer_id, oi.product_id, p.category, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM stg_orders s
JOIN order_items oi ON oi.order_id = s.order_id
JOIN products p ON p.product_id = oi.product_id;
@check
SELECT order_month, category, COUNT(*), SUM(quantity), ROUND(SUM(revenue), 2), SUM(customer_id), SUM(product_id) FROM fact_order_lines GROUP BY 1, 2 ORDER BY 1, 2;
@hint
Join `products` for the category, and add the remaining columns to the SELECT.
:::

:::sql id=cap-3 title="Step 3 — Mart"
Create table `mart_monthly_category` with one row per month and category:

`order_month`, `category`, `orders` (number of **distinct** orders), `units`, `revenue`.
@setup
CREATE VIEW stg_orders AS SELECT order_id, customer_id, order_date, strftime('%Y-%m', order_date) AS order_month FROM orders WHERE status = 'completed';
CREATE TABLE fact_order_lines AS
SELECT s.order_id, s.order_month, s.customer_id, oi.product_id, p.category, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM stg_orders s JOIN order_items oi ON oi.order_id = s.order_id JOIN products p ON p.product_id = oi.product_id;
@starter
CREATE TABLE mart_monthly_category AS
SELECT order_month,
       category
FROM fact_order_lines
@solution
CREATE TABLE mart_monthly_category AS
SELECT order_month, category, COUNT(DISTINCT order_id) AS orders, SUM(quantity) AS units, SUM(revenue) AS revenue
FROM fact_order_lines GROUP BY order_month, category;
@check
SELECT order_month, category, orders, units, ROUND(revenue, 2) FROM mart_monthly_category ORDER BY 1, 2;
@hint
`COUNT(DISTINCT order_id)` — an order with two Electronics lines is still one order.
:::

:::sql id=cap-4 title="Step 4 — Test your mart"
Never ship untested numbers. Write a **reconciliation test**: return one row with two columns —

1. total revenue in `mart_monthly_category`, rounded to 2 decimals
2. total revenue computed independently from the raw tables (completed orders: `SUM(quantity * unit_price)`), rounded to 2 decimals

If your pipeline is right, the two numbers match.
@setup
CREATE VIEW stg_orders AS SELECT order_id, customer_id, order_date, strftime('%Y-%m', order_date) AS order_month FROM orders WHERE status = 'completed';
CREATE TABLE fact_order_lines AS
SELECT s.order_id, s.order_month, s.customer_id, oi.product_id, p.category, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM stg_orders s JOIN order_items oi ON oi.order_id = s.order_id JOIN products p ON p.product_id = oi.product_id;
CREATE TABLE mart_monthly_category AS
SELECT order_month, category, COUNT(DISTINCT order_id) AS orders, SUM(quantity) AS units, SUM(revenue) AS revenue FROM fact_order_lines GROUP BY order_month, category;
@starter
SELECT
  (SELECT ROUND(SUM(revenue), 2) FROM mart_monthly_category) AS mart_revenue,
  ( ) AS source_revenue
@solution
SELECT
  (SELECT ROUND(SUM(revenue), 2) FROM mart_monthly_category) AS mart_revenue,
  (SELECT ROUND(SUM(oi.quantity * oi.unit_price), 2) FROM order_items oi JOIN orders o ON o.order_id = oi.order_id WHERE o.status = 'completed') AS source_revenue;
@hint
The second sub-query joins `order_items` to `orders`, filters `status = 'completed'` and sums `quantity * unit_price`.
:::

:::sql id=cap-5 title="Step 5 — The answer" ordered
Finally, the CEO's report. From `mart_monthly_category` return, for the **Electronics** category, sorted by month:

1. `order_month`
2. `revenue` rounded to 2 decimals
3. month-over-month growth in percent, rounded to 1 decimal: `100 * (revenue - previous) / previous` (NULL for the first month)
@setup
CREATE VIEW stg_orders AS SELECT order_id, customer_id, order_date, strftime('%Y-%m', order_date) AS order_month FROM orders WHERE status = 'completed';
CREATE TABLE fact_order_lines AS
SELECT s.order_id, s.order_month, s.customer_id, oi.product_id, p.category, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM stg_orders s JOIN order_items oi ON oi.order_id = s.order_id JOIN products p ON p.product_id = oi.product_id;
CREATE TABLE mart_monthly_category AS
SELECT order_month, category, COUNT(DISTINCT order_id) AS orders, SUM(quantity) AS units, SUM(revenue) AS revenue FROM fact_order_lines GROUP BY order_month, category;
@starter
SELECT order_month,
       ROUND(revenue, 2) AS revenue,
       LAG(revenue) OVER (ORDER BY order_month) AS previous
FROM mart_monthly_category
WHERE category = 'Electronics'
@solution
SELECT order_month, ROUND(revenue, 2) AS revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY order_month)) / LAG(revenue) OVER (ORDER BY order_month), 1) AS growth_pct
FROM mart_monthly_category WHERE category = 'Electronics' ORDER BY order_month;
@hint
Replace the `previous` column with `ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY order_month)) / LAG(revenue) OVER (ORDER BY order_month), 1)`.
:::

## What you just built

A layered, tested, reproducible pipeline: raw → staging → fact → mart → insight. In production each step would be a dbt model, the reconciliation query a dbt test, the whole thing scheduled by an orchestrator and built incrementally. The thinking is identical.

:::quiz
? Why build `fact_order_lines` before the monthly mart instead of aggregating straight from raw tables?
- It is required by SQL
+ A reusable fact at the lowest grain serves many marts and keeps logic in one place
- It makes the mart smaller
- Views cannot be aggregated
! Other questions (by customer, by product, by day) can reuse the same tested fact rather than re-implementing joins and filters.

? In the mart, why `COUNT(DISTINCT order_id)` instead of `COUNT(*)`?
- COUNT(*) is slower
+ The fact's grain is order line, so COUNT(*) would count lines, not orders
- order_id can be NULL
- DISTINCT is always required with GROUP BY
! Respecting the grain: several lines can belong to one order within a category.

? What does the reconciliation test in step 4 protect against?
- Slow queries
- Schema changes in the BI tool
+ Rows lost or duplicated by joins and filters between raw data and the mart
- Running out of storage
! Comparing a total against an independent calculation catches fan-out and dropped-row bugs that otherwise go unnoticed.

? To run this pipeline daily in production, which change matters most as data grows?
- Rewriting it in a different language
+ Making the fact and mart incremental and idempotent per day or month
- Removing the staging layer
- Adding more columns
! Rebuilding everything daily stops scaling. Process only new intervals, in a way that is safe to re-run.
:::
