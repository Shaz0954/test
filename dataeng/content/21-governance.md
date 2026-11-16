Data is an asset and a liability. Governance, security and cost control are what let a company keep using data without leaking it, breaking the law or going bankrupt on the cloud bill.

## Know what you hold

- **Data catalogue** — a searchable inventory of datasets with owners, descriptions and usage.
- **Classification** — tag columns as public, internal, confidential or **PII** (personally identifiable information: names, emails, addresses, IDs, precise locations).
- **Lineage** — know where each column came from and where it flows, so you can answer "what breaks if I change this?" and "where does this person's data live?".

## Protecting sensitive data

| Technique | What it does | Reversible? |
| --- | --- | --- |
| **Masking** | show `a***@example.com` | no (in the view) |
| **Hashing** | replace with a one-way hash (salted!) | no |
| **Tokenisation** | replace with a random token; mapping kept in a vault | yes, with access |
| **Encryption** | at rest and in transit, always | yes, with the key |
| **Aggregation** | publish counts, not individuals | no |

Principles that matter more than any tool:

- **Least privilege** — grant the minimum access needed, to roles rather than individuals (RBAC).
- **Column- and row-level security** — analysts see masked emails; regional managers see only their region.
- **Data minimisation** — do not collect or keep what you do not need. Data you do not hold cannot leak.
- **Audit logging** — record who accessed what.

## Regulation in one paragraph

Laws such as GDPR and CCPA give people rights over their data: to access it, correct it and have it **deleted**. For a data engineer this means being able to *find* every copy of a person's data (lineage!) and *remove* it — including from the lake, where immutable files make deletion hard. Table formats with row-level deletes exist largely to solve this.

## Cost is an engineering concern (FinOps)

Cloud data platforms bill per byte scanned or per compute-second. Common ways money burns:

1. Queries scanning whole tables because of a missing partition filter.
2. Pipelines doing full refreshes that could be incremental.
3. Oversized or idle clusters and warehouses that never auto-suspend.
4. Storing everything forever in the most expensive storage tier.
5. Dashboards refreshing every minute for a report read weekly.

Controls: partition and cluster tables, set auto-suspend, use lifecycle policies to move cold data to cheaper tiers, tag workloads by team so costs are attributable, and set query quotas and budget alerts.

:::sql id=gov-1 title="A masked view"
Analysts need customer data without raw emails. Create a view `customers_masked` with:

- `customer_id`, `country`, `tier`
- `email_masked` — the first character of the email, then `***`, then everything from the `@` onward (e.g. `a***@example.com`)

Hint: `substr(email, 1, 1)` and `substr(email, instr(email, '@'))`.
@starter
CREATE VIEW customers_masked AS
SELECT customer_id,
       country,
       tier
FROM customers;
@solution
CREATE VIEW customers_masked AS
SELECT customer_id, country, tier,
       substr(email, 1, 1) || '***' || substr(email, instr(email, '@')) AS email_masked
FROM customers;
@check
SELECT customer_id, country, tier, email_masked FROM customers_masked ORDER BY customer_id;
@hint
Concatenate with `||`: `substr(email, 1, 1) || '***' || substr(email, instr(email, '@'))`.
:::

:::quiz
? What does the principle of least privilege require?
- Everyone gets read access to everything
+ Each user or service gets only the access it needs
- Only administrators can query data
- Access is granted to individuals, never roles
! Minimal access limits the damage of mistakes and breaches. Granting via roles keeps it manageable.

? A user invokes their right to be deleted. What capability makes this feasible for a data team?
- Larger clusters
+ Lineage and a catalogue showing where that person's data lives
- More dashboards
- Longer retention
! You cannot delete what you cannot find. Lineage maps every downstream copy.

? Which technique replaces a value with a random stand-in while keeping a secured mapping to recover the original?
- Hashing
- Masking
+ Tokenisation
- Aggregation
! Tokenisation is reversible for authorised systems through the vault; hashing and masking are not.

? Which change most directly reduces cost in a pay-per-byte-scanned warehouse?
- Adding more dashboards
- Using SELECT * for convenience
+ Partitioning large tables and always filtering on the partition column
- Refreshing all tables hourly
! Bytes scanned drive the bill. Pruning partitions and selecting fewer columns cut them dramatically.

? Why is "data minimisation" a security practice?
- Small tables query faster
+ Data you never collect or have already deleted cannot be leaked
- It reduces the number of engineers needed
- It removes the need for encryption
! The safest sensitive data is the data you do not hold.
:::
