Kafka moves events. **Stream processors** — Flink, Spark Structured Streaming, Kafka Streams — compute over them: filtering, joining, aggregating, continuously and forever.

## Unbounded data needs windows

You cannot `GROUP BY` an infinite stream; the query would never finish. Instead you aggregate over **windows** of time.

| Window | Shape | Example |
| --- | --- | --- |
| **Tumbling** | fixed, non-overlapping | orders per 1-minute bucket |
| **Sliding / hopping** | fixed, overlapping | 5-minute average, updated every minute |
| **Session** | dynamic, closed by inactivity | a user's visit, ending after 30 idle minutes |

## Event time vs processing time

- **Event time** — when it actually happened (a timestamp in the record).
- **Processing time** — when your system saw it.

A phone in a tunnel sends its events 10 minutes late. If you bucket by processing time, they land in the wrong window. Correct analytics use **event time** — which means dealing with late and out-of-order data.

## Watermarks

How long should a window wait for stragglers? A **watermark** is the processor's claim: *"I believe I have seen every event up to time T."* When the watermark passes the end of a window, the window is finalised and its result emitted.

- A small allowed lateness → fast results, but late events are dropped (or sent to a side output).
- A large allowed lateness → more complete results, but slower and more state to hold.

It is a business trade-off between **latency** and **completeness**, not a technical default.

## Delivery guarantees

| Guarantee | Meaning | Risk |
| --- | --- | --- |
| At-most-once | never reprocess | data loss |
| **At-least-once** | retry until acknowledged | duplicates |
| **Exactly-once** | each event affects the result once | most complex |

"Exactly-once" really means *effectively once*: at-least-once delivery **plus** idempotent or transactional writes. If your sink upserts by a unique event id, duplicates become harmless — idempotency again.

## State and checkpoints

Windowed counts, joins and deduplication need **state**. Processors snapshot that state periodically in **checkpoints**; after a crash they restore the last checkpoint and replay from the matching Kafka offsets.

:::sql id=stream-1 title="Tumbling windows in SQL" ordered
Simulate a tumbling window over the `events` table: return each **hour bucket** on `2025-06-01` (formatted `YYYY-MM-DD HH:00`) with its number of events, sorted by bucket.
@starter
SELECT strftime('%Y-%m-%d %H:00', event_ts) AS window_start,
       COUNT(*) AS events
FROM events
@solution
SELECT strftime('%Y-%m-%d %H:00', event_ts) AS window_start, COUNT(*) AS events
FROM events WHERE event_ts >= '2025-06-01' AND event_ts < '2025-06-02'
GROUP BY window_start ORDER BY window_start;
@hint
Filter to the day with `event_ts >= '2025-06-01' AND event_ts < '2025-06-02'`, then group and order by the bucket.
:::

:::python id=py-window title="Tumbling window aggregation"
Write `tumbling_counts(events, size)` where `events` is a list of `(timestamp_seconds, key)` tuples that may arrive **out of order**. Return a dict mapping `(window_start, key)` to the number of events, where `window_start = timestamp - timestamp % size`.
@starter
def tumbling_counts(events, size):
    counts = {}
    return counts
@solution
def tumbling_counts(events, size):
    counts = {}
    for ts, key in events:
        w = (ts - ts % size, key)
        counts[w] = counts.get(w, 0) + 1
    return counts
@test
ev = [(1, "a"), (61, "a"), (5, "b"), (59, "a"), (120, "b"), (62, "a")]
out = tumbling_counts(ev, 60)
assert out == {(0, "a"): 2, (0, "b"): 1, (60, "a"): 2, (120, "b"): 1}, f"Got {out}"
assert tumbling_counts([], 60) == {}, "No events should give an empty dict"
@hint
Bucket each event by `ts - ts % size`. Because you bucket by the event's own timestamp, arrival order does not matter.
:::

:::python id=py-dedupe title="Exactly-once, the practical way"
At-least-once delivery means duplicates. Write `apply_events(balance, seen, events)` where each event is `(event_id, amount)`. Add each amount to `balance` **only the first time** its `event_id` is seen; record ids in the `seen` set. Return the new balance.
@starter
def apply_events(balance, seen, events):
    return balance
@solution
def apply_events(balance, seen, events):
    for event_id, amount in events:
        if event_id in seen:
            continue
        seen.add(event_id)
        balance += amount
    return balance
@test
seen = set()
b = apply_events(0, seen, [("e1", 10), ("e2", 5), ("e1", 10)])
assert b == 15, f"Duplicate within a batch was applied twice: {b}"
b = apply_events(b, seen, [("e2", 5), ("e3", 1)])
assert b == 16, f"Replayed event from an earlier batch was applied again: {b}"
assert seen == {"e1", "e2", "e3"}, f"seen should contain every processed id, got {seen}"
@hint
Skip any `event_id` already in `seen`; otherwise add it to `seen` and apply the amount.
:::

:::quiz
? Which window type is best for "group a user's clicks into visits that end after 30 minutes of inactivity"?
- Tumbling
- Sliding
+ Session
- Global
! Session windows have dynamic length, closing after a gap of inactivity per key.

? An event happened at 12:00 but reached your system at 12:10. For correct hourly analytics it should be bucketed by…
- Processing time (12:10)
+ Event time (12:00)
- The watermark
- The Kafka offset
! Event time reflects when it really happened. Processing time is an accident of network delays.

? What is a watermark?
- A checksum for detecting corrupted events
+ The processor's estimate that all events up to a certain event time have arrived
- A marker for the last committed Kafka offset
- A limit on stream throughput
! Watermarks let the engine decide when a window is complete enough to emit.

? How is "exactly-once" processing usually achieved in practice?
- By never retrying
- By using a single consumer
+ At-least-once delivery combined with idempotent or transactional writes
- By disabling checkpoints
! Retries guarantee nothing is lost; idempotent sinks make the resulting duplicates harmless.

? Increasing the allowed lateness of a window from 1 minute to 1 hour will…
- Reduce state size
+ Capture more late events but delay final results and hold more state
- Make results arrive sooner
- Remove the need for watermarks
! Completeness and latency pull in opposite directions; the right setting is a business decision.
:::
