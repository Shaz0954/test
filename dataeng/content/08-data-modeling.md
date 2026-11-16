A data model is the contract between raw data and everyone who uses it. Good models make correct queries easy and wrong queries hard.

## Normalised models (for applications)

OLTP databases are **normalised**: every fact is stored exactly once, and tables reference each other by key. Our practice database is normalised — a customer's country lives only in `customers`.

That is ideal for writes (update one row) but awkward for analytics (every question needs four joins).

## Dimensional models (for analytics)

Warehouses usually use **dimensional modelling** (Kimball). Data is split into two kinds of table:

- **Fact tables** — the *events and measurements* of the business: a sale, a click, a shipment. Long, narrow, numeric, append-mostly.
- **Dimension tables** — the *context*: who, what, where, when. Short, wide, descriptive.

Arranged together they form a **star schema**:

```text
               dim_date
                  |
dim_customer — fact_sales — dim_product
                  |
               dim_store
```

## Always declare the grain

The **grain** is what one row of the fact table means: *"one row per product per order"*. Declare it first. Every measure in the table must be true at that grain, and every query must respect it — mixing grains is how revenue gets double-counted.

| Design step | Example |
| --- | --- |
| 1. Pick the business process | Sales |
| 2. Declare the grain | One row per order line |
| 3. Choose the dimensions | Customer, product, date |
| 4. Choose the measures | Quantity, revenue |

## Layering: bronze, silver, gold

Modern warehouses organise transformations in layers (the *medallion* architecture):

- **Bronze / raw** — exact copies of source data. Never edited.
- **Silver / staging** — cleaned, typed, deduplicated.
- **Gold / marts** — facts, dimensions and aggregates ready for business use.

Keeping raw data untouched means any bug downstream can be fixed by re-running transformations.

:::sql id=model-1 title="Build a fact table"
Create a table `fact_sales` at the grain **one row per order line**, for **completed** orders only, with columns:

`order_id, product_id, customer_id, order_date, quantity, revenue` (revenue = `quantity * unit_price`).
@starter
CREATE TABLE fact_sales AS
SELECT oi.order_id,
       oi.product_id
FROM order_items AS oi
JOIN orders AS o ON o.order_id = oi.order_id
@solution
CREATE TABLE fact_sales AS
SELECT oi.order_id, oi.product_id, o.customer_id, o.order_date, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
WHERE o.status = 'completed';
@check
SELECT COUNT(*), SUM(quantity), ROUND(SUM(revenue), 2), COUNT(DISTINCT customer_id), MIN(order_date) FROM fact_sales;
@hint
`CREATE TABLE fact_sales AS SELECT …` — add the remaining columns and a `WHERE o.status = 'completed'`.
:::

:::sql id=model-2 title="Query the star" ordered
`fact_sales` now exists. Join it to its dimensions and return revenue by customer `country` and product `category`, sorted by country then category.
@setup
CREATE TABLE fact_sales AS
SELECT oi.order_id, oi.product_id, o.customer_id, o.order_date, oi.quantity, oi.quantity * oi.unit_price AS revenue
FROM order_items oi JOIN orders o ON o.order_id = oi.order_id WHERE o.status = 'completed';
@starter
SELECT c.country, p.category, SUM(f.revenue) AS revenue
FROM fact_sales AS f
@solution
SELECT c.country, p.category, SUM(f.revenue) AS revenue
FROM fact_sales f
JOIN customers c ON c.customer_id = f.customer_id
JOIN products p ON p.product_id = f.product_id
GROUP BY c.country, p.category ORDER BY c.country, p.category;
@hint
Two joins from the fact to `customers` and `products`, then `GROUP BY c.country, p.category`.
:::

:::quiz
? Which of these belongs in a fact table rather than a dimension?
- Customer name
- Product category
+ Quantity sold
- Store address
! Facts hold numeric measurements of events. Names, categories and addresses are descriptive context — dimensions.

? What does "declaring the grain" of a fact table mean?
- Choosing its partition column
+ Stating exactly what one row represents
- Listing its foreign keys
- Deciding how often it is refreshed
! The grain (e.g. "one row per order line") determines which measures and dimensions are valid and prevents double counting.

? Why keep an untouched raw (bronze) copy of source data?
- It is required by SQL
- Raw data is faster to query
+ You can rebuild everything downstream after fixing a bug
- It reduces storage cost
! Transformations will have bugs. With immutable raw data you can always replay them; without it, the original information may be gone.

? Why are star schemas preferred over fully normalised schemas for analytics?
- They use less storage
- They prevent all data quality issues
+ Fewer, simpler joins make queries easier to write and faster to run
- They support more concurrent writes
! Denormalised dimensions trade some redundancy for simplicity and speed — the right trade for read-heavy analytical workloads.
:::
