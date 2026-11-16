When data no longer fits on one machine, you split it across many. Apache Spark is the standard engine for that — and its mental model applies to every distributed system you will use.

## The core idea

A dataset is split into **partitions**. Each partition is processed by a **task** on an **executor** (a worker process). A **driver** plans the work and coordinates.

```python
orders = spark.read.parquet("s3://lake/orders/")

revenue = (orders
    .filter(orders.status == "completed")          # narrow
    .groupBy("country")                             # wide -> shuffle
    .agg(F.sum("amount").alias("revenue")))

revenue.write.mode("overwrite").parquet("s3://lake/marts/revenue_by_country/")
```

Spark is **lazy**: transformations build a plan, and nothing runs until an *action* (`write`, `count`, `collect`) is called. The optimiser then rearranges the plan — pushing filters down, pruning columns — before executing.

## Narrow vs wide transformations

- **Narrow** (`filter`, `select`, `withColumn`): each output partition depends on one input partition. Cheap, no data movement.
- **Wide** (`groupBy`, `join`, `distinct`, `orderBy`): rows with the same key must end up together, so data is **shuffled** across the network.

The shuffle is the most expensive thing Spark does. Performance tuning is mostly about shuffling less data, less often.

## Joins

| Strategy | When | Cost |
| --- | --- | --- |
| **Broadcast hash join** | one side is small (fits in memory) | no shuffle — the small table is copied to every executor |
| **Sort-merge join** | both sides are large | shuffle and sort both sides |

Joining a 1 TB fact table to a 5 MB dimension? Make sure it is broadcast.

## Data skew

A shuffle sends each key to a partition by hash. If one key holds 40% of the rows — a `NULL` customer, one giant merchant — one partition gets 40% of the data. That one task runs for an hour (or dies of out-of-memory) while the other 199 finish in seconds.

Fixes:

- **Adaptive Query Execution (AQE)** — Spark 3 can split skewed partitions automatically.
- **Salting** — append a random suffix to the hot key so its rows spread over several partitions, aggregate, then aggregate again without the salt.
- **Filter or handle hot keys separately** — especially NULLs.
- **Broadcast** the other side, avoiding the shuffle altogether.

## See it

Increase the skew and watch one partition dominate. Then switch on salting.

:::sim skew
:::

:::python id=py-mr title="MapReduce by hand"
Word count is the "hello world" of distributed processing. Implement its three phases:

- `map_phase(lines)` → list of `(word, 1)` pairs (lower-cased, split on whitespace)
- `shuffle(pairs, n)` → a list of `n` lists; each pair goes to partition `len(word) % n` (a stand-in for a hash)
- `reduce_phase(partition)` → dict of word → total count for one partition
@starter
def map_phase(lines):
    return []

def shuffle(pairs, n):
    partitions = [[] for _ in range(n)]
    return partitions

def reduce_phase(partition):
    return {}
@solution
def map_phase(lines):
    return [(w.lower(), 1) for line in lines for w in line.split()]

def shuffle(pairs, n):
    partitions = [[] for _ in range(n)]
    for word, count in pairs:
        partitions[len(word) % n].append((word, count))
    return partitions

def reduce_phase(partition):
    counts = {}
    for word, count in partition:
        counts[word] = counts.get(word, 0) + count
    return counts
@test
pairs = map_phase(["Big data big", "data pipelines"])
assert sorted(pairs) == sorted([("big", 1), ("data", 1), ("big", 1), ("data", 1), ("pipelines", 1)]), f"map_phase gave {pairs}"
parts = shuffle(pairs, 2)
assert len(parts) == 2, "shuffle must return n partitions"
assert sorted(parts[0]) == [("data", 1), ("data", 1)] and sorted(parts[1]) == [("big", 1), ("big", 1), ("pipelines", 1)], f"shuffle gave {parts}"
merged = {}
for p in parts:
    merged.update(reduce_phase(p))
assert merged == {"big": 2, "data": 2, "pipelines": 1}, f"reduce gave {merged}"
@hint
The shuffle guarantees all pairs for the same word land in the same partition, so each reducer can count independently.
:::

:::quiz
? Which operation forces a shuffle?
- filter
- select
+ groupBy
- withColumn
! Grouping needs all rows with the same key in the same partition, so data must move between executors.

? Spark transformations are lazy. What does that mean?
- They run slowly
+ Nothing executes until an action is called, letting Spark optimise the whole plan
- They only run on one executor
- They skip NULL values
! Building the full plan first lets the optimiser push down filters and prune columns before any data is read.

? You join a 2 TB table to a 3 MB lookup table. Which join strategy is best?
- Sort-merge join
- Cross join
+ Broadcast hash join
- Nested loop join
! Broadcasting the tiny table to every executor avoids shuffling the 2 TB side entirely.

? One task in a stage takes 50 minutes while the other 199 take 20 seconds. Most likely cause?
- Too many executors
+ Data skew: one key holds a disproportionate share of rows
- The cluster is too large
- Lazy evaluation
! A hot key hashes to a single partition, which then has far more data than the rest.

? What does salting a join/group key do?
- Encrypts the key
- Removes NULL keys
+ Spreads a hot key's rows across several partitions
- Sorts the data
! Adding a random suffix splits one enormous key into several smaller ones that hash to different partitions.
:::
