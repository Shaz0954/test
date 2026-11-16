Analytics is mostly *summarising*: how many, how much, on average, per what. Aggregations turn many rows into few.

## Aggregate functions

```sql
SELECT COUNT(*)            AS orders,
       COUNT(DISTINCT customer_id) AS customers,
       MIN(order_date)     AS first_order,
       MAX(order_date)     AS last_order
FROM orders;
```

`COUNT(*)` counts rows. `COUNT(column)` counts **non-NULL** values — a classic source of off-by-some bugs. `SUM`, `AVG`, `MIN` and `MAX` all ignore NULLs.

## GROUP BY

`GROUP BY` splits rows into buckets and computes aggregates per bucket.

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC;
```

Rule of thumb: every column in `SELECT` must either be in `GROUP BY` or wrapped in an aggregate.

## WHERE vs HAVING

- `WHERE` filters **rows before** grouping.
- `HAVING` filters **groups after** aggregating.

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
WHERE status = 'completed'        -- row filter
GROUP BY customer_id
HAVING COUNT(*) >= 5;             -- group filter
```

## Grouping by time

Bucketing by day, week or month is the bread and butter of reporting. In SQLite use `strftime`; warehouses use `DATE_TRUNC('month', order_date)`.

```sql
SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS orders
FROM orders
GROUP BY month;
```

:::sql id=agg-1 title="Customers per country"
Return each `country` and the number of customers in it.
@starter
SELECT country, 
FROM customers
@solution
SELECT country, COUNT(*) AS customers FROM customers GROUP BY country;
@hint
`COUNT(*)` with `GROUP BY country`.
:::

:::sql id=agg-2 title="Best-selling products"
Using `order_items`, return each `product_id`, its total units sold (`SUM(quantity)`) and its total revenue (`SUM(quantity * unit_price)`) — but only for products with total revenue **over 5000**.
@starter
SELECT product_id,
       SUM(quantity) AS units
FROM order_items
@solution
SELECT product_id, SUM(quantity) AS units, SUM(quantity * unit_price) AS revenue
FROM order_items GROUP BY product_id HAVING SUM(quantity * unit_price) > 5000;
@hint
You are filtering on an aggregate, so the condition belongs in `HAVING`, after `GROUP BY product_id`.
:::

:::sql id=agg-3 title="Completed orders per month" ordered
Return the month (formatted `YYYY-MM`) and the number of **completed** orders in that month, sorted by month.
@starter
SELECT strftime('%Y-%m', order_date) AS month,
@solution
SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS orders
FROM orders WHERE status = 'completed' GROUP BY month ORDER BY month;
@hint
Filter rows with `WHERE status = 'completed'` *before* grouping by the month expression.
:::

:::quiz
? A table has 10 rows; 3 of them have NULL in `email`. What does `COUNT(email)` return?
- 10
+ 7
- 3
- NULL
! `COUNT(column)` counts non-NULL values only. `COUNT(*)` would return 10.

? You want only customers with more than 10 orders. Where does the condition `COUNT(*) > 10` go?
- WHERE
+ HAVING
- ORDER BY
- GROUP BY
! Aggregates do not exist yet when WHERE runs. HAVING filters after grouping.

? `SELECT country, tier, COUNT(*) FROM customers GROUP BY country` — what is wrong?
- Nothing
- COUNT(*) cannot be used with GROUP BY
+ `tier` is neither grouped nor aggregated
- `country` must be aggregated
! Each output row represents one country, which may contain many tiers, so `tier` is ambiguous. Most databases reject this; SQLite silently picks an arbitrary value, which is worse.

? What is the cheapest way to make an aggregation over a huge table faster?
- Add more aggregate functions
+ Filter rows as early as possible with WHERE
- Replace WHERE with HAVING
- Use SELECT *
! Fewer rows in means less work. Filtering early (and on partition columns) is the first performance lever to pull.
:::
