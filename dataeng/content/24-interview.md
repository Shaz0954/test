You have covered the whole stack. This final lesson is about proving it: the SQL problems interviewers love, and how to approach them.

## How to solve a SQL interview problem

1. **Restate the question** and ask about edge cases: ties, NULLs, duplicates, empty groups.
2. **Name the grain of the answer**: "one row per customer per month".
3. **Sketch the steps as CTEs** before writing details.
4. **Write it**, talking through each step.
5. **Test it mentally** on a tiny example, especially ties and missing data.

## Patterns worth knowing by heart

| Problem | Pattern |
| --- | --- |
| Top N per group | `ROW_NUMBER()` / `DENSE_RANK()` in a CTE, then filter |
| Latest record per key | `ROW_NUMBER() … ORDER BY ts DESC`, keep 1 |
| Rows without a match | `LEFT JOIN … WHERE right.key IS NULL` or `NOT EXISTS` |
| Period-over-period change | `LAG()` |
| Running total | `SUM() OVER (ORDER BY …)` |
| Share of total | `x / SUM(x) OVER ()` |
| Consecutive days / streaks | date minus `ROW_NUMBER()` gives a constant per streak ("gaps and islands") |
| Deduplicate | `ROW_NUMBER()` with a deterministic tiebreaker |

## Beyond SQL

Expect questions in four more areas — all covered in this course:

- **Data modelling** — "Design the schema for a ride-sharing app's analytics." Declare the grain, list facts and dimensions, discuss SCDs.
- **Pipeline design** — use the six-step framework from the System Design lesson.
- **Coding** — Python on dicts, lists, strings and files. Clean code and edge cases beat cleverness.
- **Behavioural** — a pipeline you built, an incident you handled, a trade-off you made. Use real numbers.

:::callout tip
When you finish this lesson, take the **Mock Interview** from the sidebar: 15 timed questions drawn from every topic. Score 80% or more to earn the *Interview Ready* badge.
:::

:::sql id=int-1 title="Second most expensive per category"
Return `category`, `name` and `price` of the **second most expensive** product in each category (use `DENSE_RANK`).
@starter
WITH ranked AS (
  SELECT category, name, price,
         DENSE_RANK() OVER ( ) AS rnk
  FROM products
)
SELECT category, name, price
FROM ranked
@solution
WITH ranked AS (
  SELECT category, name, price, DENSE_RANK() OVER (PARTITION BY category ORDER BY price DESC) AS rnk FROM products
)
SELECT category, name, price FROM ranked WHERE rnk = 2;
@hint
`PARTITION BY category ORDER BY price DESC`, then `WHERE rnk = 2`.
:::

:::sql id=int-2 title="Top 2 customers per country"
For **completed** orders, return `country`, customer `name` and total spend for the **two highest-spending customers in each country** (use `ROW_NUMBER`).
@starter
WITH spend AS (
  SELECT c.country, c.name, SUM(oi.quantity * oi.unit_price) AS total
  FROM customers AS c
  JOIN orders AS o ON o.customer_id = c.customer_id
  JOIN order_items AS oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY c.customer_id, c.country, c.name
)
SELECT country, name, total
FROM spend
@solution
WITH spend AS (
  SELECT c.country, c.name, SUM(oi.quantity * oi.unit_price) AS total
  FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'completed' GROUP BY c.customer_id, c.country, c.name
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY country ORDER BY total DESC) AS rn FROM spend
)
SELECT country, name, total FROM ranked WHERE rn <= 2;
@hint
Add a second CTE that computes `ROW_NUMBER() OVER (PARTITION BY country ORDER BY total DESC)`, then keep `rn <= 2`.
:::

:::sql id=int-3 title="Share of total"
For completed orders, return each product `category`, its revenue, and its **percentage of total revenue** rounded to 1 decimal.
@starter
WITH cat AS (
  SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items AS oi
  JOIN orders AS o ON o.order_id = oi.order_id
  JOIN products AS p ON p.product_id = oi.product_id
  WHERE o.status = 'completed'
  GROUP BY p.category
)
SELECT category, revenue,
FROM cat
@solution
WITH cat AS (
  SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id
  WHERE o.status = 'completed' GROUP BY p.category
)
SELECT category, revenue, ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS pct FROM cat;
@hint
An empty `OVER ()` makes the window the whole result: `100.0 * revenue / SUM(revenue) OVER ()`.
:::

:::sql id=int-4 title="Funnel conversion"
From `events`, return **one row** with: the number of distinct customers who had a `page_view`, the number who had an `add_to_cart`, and the number who had a `purchase`.
@starter
SELECT COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN customer_id END) AS viewers,
FROM events
@solution
SELECT COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN customer_id END) AS viewers,
       COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN customer_id END) AS carters,
       COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN customer_id END) AS buyers
FROM events;
@hint
Conditional aggregation: repeat the `COUNT(DISTINCT CASE WHEN … THEN customer_id END)` pattern for each step.
:::

:::quiz
? Which function solves "top 3 products per category" when ties should all be included?
- ROW_NUMBER()
+ DENSE_RANK()
- LAG()
- NTILE()
! DENSE_RANK gives tied rows the same rank without gaps, so filtering `<= 3` keeps all ties.

? What should you do before writing any SQL in an interview?
- Start typing immediately to save time
+ Clarify edge cases and state the grain of the expected result
- Ask which database vendor is cheapest
- Write the ORDER BY clause
! Clarifying shows structured thinking and prevents solving the wrong problem.

? `x / SUM(x) OVER ()` computes…
- A running total
- A rank
+ Each row's share of the overall total
- The previous row's value
! An empty OVER clause makes the window the entire result set.

? In a pipeline design interview, the interviewer says "now the data volume is 100× larger". The best response is to…
- Start over with a completely different design
- Say it cannot be done
+ Identify the bottleneck and evolve that part of the design, explaining the trade-off
- Add Kafka everywhere
! Good designs evolve. Show you know which component breaks first and what you would change.
:::
