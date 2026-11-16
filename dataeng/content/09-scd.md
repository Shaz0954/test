Customers move city. Products change category. Sales reps switch region. Dimensions change *slowly* — and how you handle those changes decides whether historical reports stay correct.

## The problem

A customer upgrades from `silver` to `gold` in July. What should a report of **March** revenue by tier show for that customer?

- If you overwrite the tier, March revenue silently moves from silver to gold. History has been rewritten.
- If you keep history, March stays silver — as it truly was.

Neither is "right"; it depends on the question. So you need to know both techniques.

## Type 1 — overwrite

Just update the row. Simple, no history. Use for corrections (fixing a typo) or attributes where history is irrelevant.

## Type 2 — add a new version

Close the current row and insert a new one. Each version gets validity dates and its own **surrogate key**.

| customer_sk | customer_id | tier | valid_from | valid_to | is_current |
| --- | --- | --- | --- | --- | --- |
| 101 | 7 | silver | 2024-02-01 | 2025-07-01 | 0 |
| 245 | 7 | gold | 2025-07-01 | 9999-12-31 | 1 |

Fact rows store the surrogate key of the version that was valid *when the event happened*, so history is preserved automatically.

To read the dimension **as of** a date:

```sql
SELECT * FROM dim_customer
WHERE '2025-03-15' >= valid_from AND '2025-03-15' < valid_to;
```

:::callout tip
Use a far-future date like `9999-12-31` for the open-ended `valid_to` instead of NULL. Range predicates then work without special cases.
:::

## Experiment

Apply changes as Type 1 and Type 2 and watch the table. Then drag the *as-of* slider to travel through time.

:::sim scd
:::

:::sql id=scd-1 title="Apply a Type 2 change"
`dim_customer_hist` tracks tier history. Customer **3** upgrades to `gold` on **2025-07-01**. Apply it as SCD Type 2:

1. Close the current row (`valid_to = '2025-07-01'`, `is_current = 0`).
2. Insert the new version (valid from `2025-07-01` to `9999-12-31`, `is_current = 1`).
@setup
CREATE TABLE dim_customer_hist (customer_id INTEGER, tier TEXT, valid_from TEXT, valid_to TEXT, is_current INTEGER);
INSERT INTO dim_customer_hist VALUES
 (1,'bronze','2024-01-10','2025-02-01',0),(1,'silver','2025-02-01','9999-12-31',1),
 (2,'gold','2024-03-05','9999-12-31',1),
 (3,'bronze','2024-05-20','2025-01-15',0),(3,'silver','2025-01-15','9999-12-31',1);
@starter
UPDATE dim_customer_hist
SET valid_to = '2025-07-01', is_current = 0
WHERE ;

INSERT INTO dim_customer_hist VALUES ( );
@solution
UPDATE dim_customer_hist SET valid_to = '2025-07-01', is_current = 0 WHERE customer_id = 3 AND is_current = 1;
INSERT INTO dim_customer_hist VALUES (3, 'gold', '2025-07-01', '9999-12-31', 1);
@check
SELECT * FROM dim_customer_hist ORDER BY customer_id, valid_from;
@hint
The UPDATE must target only customer 3's *current* row: `WHERE customer_id = 3 AND is_current = 1`.
:::

:::sql id=scd-2 title="Time travel"
Return each `customer_id` and the `tier` they held **as of 2025-01-20**.
@setup
CREATE TABLE dim_customer_hist (customer_id INTEGER, tier TEXT, valid_from TEXT, valid_to TEXT, is_current INTEGER);
INSERT INTO dim_customer_hist VALUES
 (1,'bronze','2024-01-10','2025-02-01',0),(1,'silver','2025-02-01','9999-12-31',1),
 (2,'gold','2024-03-05','9999-12-31',1),
 (3,'bronze','2024-05-20','2025-01-15',0),(3,'silver','2025-01-15','9999-12-31',1);
@starter
SELECT customer_id, tier
FROM dim_customer_hist
WHERE
@solution
SELECT customer_id, tier FROM dim_customer_hist WHERE '2025-01-20' >= valid_from AND '2025-01-20' < valid_to;
@hint
A version is valid when `valid_from <= date AND date < valid_to`.
:::

:::quiz
? A customer's city changes and you must keep reporting historical sales under the old city. Which SCD type?
- Type 1
+ Type 2
- Type 0
- None — update the fact table
! Type 2 adds a new version row so facts recorded before the change still point at the old attributes.

? Why does a Type 2 dimension need a surrogate key?
- Natural keys are too long
+ The natural key repeats across versions, so it no longer identifies one row
- Warehouses do not support natural keys
- To make joins slower
! One customer_id now has several rows. The surrogate key identifies a specific version.

? When is Type 1 (overwrite) the right choice?
- When auditors need full history
+ When fixing a data-entry error such as a misspelled name
- When the attribute changes daily
- Never
! Corrections should replace the wrong value everywhere; nobody wants reports grouped by a typo.

? In a Type 2 table, how do you select only the latest version of every customer?
- WHERE valid_from = MAX(valid_from)
+ WHERE is_current = 1
- GROUP BY customer_id
- ORDER BY valid_to
! The current-row flag (or `valid_to = '9999-12-31'`) marks the open version.
:::
