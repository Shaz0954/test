Real data is spread across tables. Joins put it back together — and joining *incorrectly* is the most common way pipelines silently produce wrong numbers.

## INNER JOIN

Keeps only rows that match on **both** sides.

```sql
SELECT o.order_id, o.order_date, c.name
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id;
```

## LEFT JOIN

Keeps **every row from the left table**, filling the right side with NULLs when there is no match. Use it when "missing" is meaningful.

```sql
SELECT c.name, o.order_id
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id;
```

The *anti-join* pattern finds rows with no match at all:

```sql
... LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL        -- customers who never ordered
```

| Join | Returns |
| --- | --- |
| `INNER` | only matching pairs |
| `LEFT` | all left rows + matches |
| `FULL OUTER` | all rows from both sides |
| `CROSS` | every combination (rows × rows) |

## The fan-out trap

Joining a table to a *more detailed* table multiplies rows. One order with three items becomes three rows — so `COUNT(*)` no longer counts orders, and summing an order-level amount triple-counts it.

:::callout warn
Before every join ask: **what is the grain of each side, and what will the grain of the result be?** If a join unexpectedly increases your row count, you have a fan-out. Use `COUNT(DISTINCT o.order_id)` or aggregate before joining.
:::

## Joining several tables

```sql
SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items AS oi
JOIN orders   AS o ON o.order_id = oi.order_id
JOIN products AS p ON p.product_id = oi.product_id
GROUP BY p.category;
```

:::sql id=join-1 title="Who ordered in January?"
Return `order_id`, `order_date` and the customer's `name` for every order placed in **January 2025**.
@starter
SELECT o.order_id, o.order_date, c.name
FROM orders AS o
@solution
SELECT o.order_id, o.order_date, c.name FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.order_date BETWEEN '2025-01-01' AND '2025-01-31';
@hint
`JOIN customers AS c ON c.customer_id = o.customer_id`, then filter on `o.order_date`.
:::

:::sql id=join-2 title="Customers who never ordered"
Return the `name` of every customer who has **no orders at all**.
@starter
SELECT c.name
FROM customers AS c
@solution
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL;
@hint
LEFT JOIN `orders`, then keep rows where the order side is NULL (`WHERE o.order_id IS NULL`).
:::

:::sql id=join-3 title="Revenue by category" ordered
For **completed** orders only, return each product `category` and its total revenue (`quantity * unit_price`), highest revenue first.
@starter
SELECT p.category,
@solution
SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status = 'completed'
GROUP BY p.category ORDER BY revenue DESC;
@hint
Start from `order_items`, join `orders` (for status) and `products` (for category), filter, group, sort.
:::

:::quiz
? `customers` has 30 rows and 4 of them have no orders. How many distinct customers appear in `customers INNER JOIN orders`?
- 30
- 34
+ 26
- 4
! INNER JOIN drops rows without a match, so the 4 customers with no orders disappear.

? You join `orders` (1 row per order) to `order_items` (several rows per order) and run `COUNT(*)`. What are you counting?
- Orders
+ Order items
- Customers
- Products
! The join's grain is the finer of the two: one row per order item. This row multiplication is called fan-out.

? Which pattern finds rows in A that have no match in B?
- A INNER JOIN B
- A CROSS JOIN B
+ A LEFT JOIN B … WHERE B.key IS NULL
- A LEFT JOIN B … WHERE A.key IS NULL
! The anti-join keeps all of A, then keeps only rows where the B side came back empty.

? You LEFT JOIN orders to customers and add `WHERE o.status = 'completed'`. What happens to customers with no orders?
- They are kept with NULL status
+ They are removed — the filter turns the LEFT JOIN into an INNER JOIN
- The query fails
- They are duplicated
! For unmatched customers `o.status` is NULL, which fails the WHERE. To keep them, move the condition into the ON clause.
:::
