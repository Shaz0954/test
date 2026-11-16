SQL is the single most important skill in data engineering. Nearly every tool you will meet — warehouses, Spark, dbt, stream processors — speaks it. In this course you run **real SQL** against a small e-commerce database that lives in your browser.

## The practice database

| Table | One row per… | Key columns |
| --- | --- | --- |
| `customers` | customer | `customer_id`, `name`, `email`, `country`, `signup_date`, `tier` |
| `products` | product | `product_id`, `name`, `category`, `price` |
| `orders` | order | `order_id`, `customer_id`, `order_date`, `status` |
| `order_items` | product within an order | `order_id`, `product_id`, `quantity`, `unit_price` |
| `events` | website event | `event_id`, `customer_id`, `event_type`, `event_ts` |
| `raw_customers` | messy staging row | `id`, `name`, `email`, `country`, `updated_at` |

Open the **SQL Lab** from the sidebar any time to explore freely.

## Anatomy of a query

```sql
SELECT name, price            -- which columns
FROM products                 -- which table
WHERE category = 'Books'      -- which rows
ORDER BY price DESC           -- in what order
LIMIT 3;                      -- how many
```

The database *logically* evaluates this as `FROM → WHERE → SELECT → ORDER BY → LIMIT`. Knowing that order explains most beginner errors (for example, why you cannot use a `SELECT` alias inside `WHERE`).

## Filtering

```sql
WHERE price BETWEEN 20 AND 100
WHERE status IN ('cancelled', 'returned')
WHERE name LIKE '%Desk%'          -- % matches any characters
WHERE email IS NULL               -- never "= NULL"
WHERE country = 'US' AND tier <> 'bronze'
```

:::callout warn
`NULL` means *unknown*. Any comparison with it (`= NULL`, `<> NULL`) is neither true nor false, so the row is filtered out. Always use `IS NULL` / `IS NOT NULL`.
:::

Dates in this database are ISO strings (`'2025-03-14'`), which sort and compare correctly as text.

:::sql id=sel-1 title="Gold customers" ordered
Return the `name` and `country` of every customer in the `gold` tier, sorted by `name` A→Z.
@starter
SELECT name, country
FROM customers
@solution
SELECT name, country FROM customers WHERE tier = 'gold' ORDER BY name;
@hint
Add `WHERE tier = 'gold'` and then `ORDER BY name`.
:::

:::sql id=sel-2 title="Premium products" ordered
Return the `name` and `price` of the **5 most expensive** products, most expensive first.
@starter
SELECT
@solution
SELECT name, price FROM products ORDER BY price DESC LIMIT 5;
@hint
Sort descending with `ORDER BY price DESC`, then keep five rows with `LIMIT 5`.
:::

:::sql id=sel-3 title="Problem orders in March"
Return `order_id`, `order_date` and `status` for orders placed in **March 2025** whose status is `cancelled` or `returned`.
@starter
SELECT order_id, order_date, status
FROM orders
WHERE
@solution
SELECT order_id, order_date, status FROM orders
WHERE order_date BETWEEN '2025-03-01' AND '2025-03-31' AND status IN ('cancelled', 'returned');
@hint
Combine a date range (`BETWEEN '2025-03-01' AND '2025-03-31'`) with `status IN (...)` using `AND`.
:::

:::quiz
? In what logical order does a database evaluate these clauses?
- SELECT → FROM → WHERE → ORDER BY
+ FROM → WHERE → SELECT → ORDER BY
- WHERE → FROM → SELECT → ORDER BY
- FROM → SELECT → WHERE → ORDER BY
! Rows are sourced (FROM), filtered (WHERE), projected (SELECT) and finally sorted (ORDER BY).

? Which predicate correctly finds customers with no email?
- WHERE email = NULL
- WHERE email == ''
+ WHERE email IS NULL
- WHERE NOT email
! NULL is "unknown"; `= NULL` never evaluates to true. Use `IS NULL`.

? What does `WHERE name LIKE 'Desk%'` match?
- Names containing "Desk" anywhere
+ Names starting with "Desk"
- Names ending with "Desk"
- Only the exact name "Desk%"
! `%` matches any sequence of characters, and it only appears after "Desk" — so the name must start with it.

? Why is `SELECT *` discouraged in production pipelines?
- It is slower to type
- It returns rows in random order
+ It reads columns you do not need and breaks silently when the schema changes
- It is not valid in most warehouses
! In columnar warehouses you pay for every column read, and downstream code can break or silently change when columns are added or reordered.
:::
