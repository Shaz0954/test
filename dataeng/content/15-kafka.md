Batch pipelines ask "what happened yesterday?". Streaming asks "what is happening *now*?". Apache Kafka is the backbone of most streaming architectures.

## Kafka is a log

Forget "message queue". Kafka is a **distributed, append-only log**. Producers append records to the end; consumers read forward at their own pace. Records are **not removed when read** — they stay until a retention limit (say 7 days) expires, so many independent consumers can read the same data, and any of them can rewind and replay.

## Topics, partitions and offsets

- A **topic** is a named stream (`orders`, `page_views`).
- Each topic is split into **partitions** — independent logs that can live on different brokers. Partitions are how Kafka scales.
- Each record in a partition has a sequential **offset**.

```text
topic: orders
  partition 0:  [0][1][2][3][4][5] → new records appended here
  partition 1:  [0][1][2][3]
  partition 2:  [0][1][2][3][4]
```

**Ordering is guaranteed only within a partition.** Records with the same **key** always go to the same partition (`hash(key) % partitions`), so "all events for customer 42 arrive in order" is achieved by keying on customer id.

## Consumer groups

Consumers join a **consumer group**. Kafka assigns each partition to exactly **one** consumer in the group, so the group shares the work.

- More consumers (up to the partition count) → more parallelism.
- **Consumers beyond the partition count sit idle.** Partitions cap your parallelism.
- When a consumer joins or dies, the group **rebalances** and partitions are reassigned.

Each consumer periodically **commits** the offset it has processed. After a crash, its replacement resumes from the last committed offset.

## Consumer lag

**Lag = newest offset − committed offset.** It is *the* health metric of a streaming system. Stable lag is fine; steadily growing lag means consumers cannot keep up — add consumers (and partitions), or make processing faster.

## Durability

Each partition is replicated to several brokers (typically 3). A producer using `acks=all` waits until all in-sync replicas have the record, so losing a broker loses no data.

## Experiment

Raise the produce rate until lag grows. Add consumers — and notice what happens when you have more consumers than partitions. Then turn on a **hot key**.

:::sim kafka
:::

:::quiz
? What happens to a record after a consumer reads it from Kafka?
- It is deleted
- It moves to a dead-letter topic
+ It stays in the log until retention expires
- It is sent back to the producer
! Kafka is a log, not a queue. Reading does not remove data, so other consumer groups can read it too and consumers can replay.

? A topic has 4 partitions and its consumer group has 6 consumers. How many consumers are actively reading?
- 6
+ 4
- 2
- 1
! Each partition is assigned to exactly one consumer in a group; the extra two sit idle as standbys.

? How do you guarantee all events for one user are processed in order?
- Use a single consumer
- Increase replication
+ Use the user id as the record key
- Sort records in the consumer
! Same key → same partition, and ordering is guaranteed within a partition.

? Consumer lag is growing steadily. What does that tell you?
- Producers are too slow
- The retention period is too short
+ Consumers process more slowly than producers write
- The cluster has too many partitions
! Growing lag means input rate exceeds processing rate. Scale consumers (within the partition limit) or speed up processing.

? One key produces 70% of the traffic. What is the consequence?
- Kafka rejects the hot key
+ One partition (and its consumer) is overloaded while others are idle
- Records are spread evenly anyway
- Ordering is lost
! Key-based partitioning sends a hot key to one partition; adding consumers does not help because that partition still has a single reader.
:::
