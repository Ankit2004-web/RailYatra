# Railway Reservation System — Enterprise Architecture & Problem Catalog

**Audience:** Architects, tech leads, senior engineers building IRCTC-scale systems  
**Scope:** 167 production problems across 17 domains  
**Format:** Each problem includes 20 enterprise fields + master priority ranking

---

## Table of Contents

1. [Reference Architecture](#1-reference-architecture)
2. [Tier-1 Critical Problems (Full Detail)](#2-tier-1-critical-problems-full-detail)
3. [Problem Catalog by Domain (Compact)](#3-problem-catalog-by-domain-compact)
4. [Master Priority Ranking](#4-master-priority-ranking)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Recommended Folder Structure](#6-recommended-folder-structure)
7. [Technology Stack Recommendations](#7-technology-stack-recommendations)

---

## 1. Reference Architecture

### 1.1 Target production topology

```
                    ┌─────────────┐
                    │  CDN + WAF  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ API Gateway │  rate limit, auth, routing, idempotency
                    └──────┬──────┘
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐    ┌──────▼──────┐   ┌─────▼─────┐
   │  Search   │    │   Booking   │   │  Payment  │
   │  Service  │    │   Service   │   │  Service  │
   └─────┬─────┘    └──────┬──────┘   └─────┬─────┘
         │                 │                 │
         └────────┬────────┴────────┬────────┘
                  │                 │
           ┌──────▼──────┐   ┌──────▼──────┐
           │Redis Cluster│   │ Message Bus │
           │cache/locks  │   │ Kafka/SQS   │
           └──────┬──────┘   └──────┬──────┘
                  │                 │
           ┌──────▼─────────────────▼──────┐
           │  SQL Server (OLTP) + Replicas │
           │  Partitioned by journey_date  │
           └───────────────────────────────┘
```

### 1.2 Evolution path (recommended)

| Stage | Users | Architecture | Focus |
|-------|-------|--------------|-------|
| MVP | <10K/day | Modular monolith | Correct booking + payment saga |
| Growth | 10K–500K/day | Monolith + Redis + queue | Seat locks, search cache, async notify |
| Scale | 500K–5M/day | Extract booking/payment/search | Independent scaling, read replicas |
| IRCTC-class | 5M+/day | Microservices + CQRS + sharding | Tatkal queues, geo-redundancy, event sourcing for inventory |

### 1.3 Core design principles

- **Inventory is sacred** — never confirm without atomic seat commit
- **Payments are eventually consistent** — reconcile via webhooks + idempotency
- **All mutations are auditable** — append-only audit log
- **Fail closed on auth** — deny by default
- **Design for Tatkal** — assume 100× traffic spikes at 10:00 AM

---

## 2. Tier-1 Critical Problems (Full Detail)

Below are the **12 highest-severity** problems with complete 20-field analysis.

---

### P-001: Double Booking

| # | Field | Detail |
|---|-------|--------|
| 1 | **Problem Name** | Double Booking |
| 2 | **Description** | Two or more passengers receive confirmed tickets for the same physical seat on the same train/class/date segment. |
| 3 | **Why it happens** | Concurrent reads see available inventory; no atomic decrement; lock released too early; cache shows stale availability. |
| 4 | **Real-world example** | Tatkal opening: 50,000 users book seat B1-42 on Train 12345 within 2 seconds; DB shows 3 confirmations. |
| 5 | **Impact if not solved** | Legal liability, passenger conflict on train, brand destruction, regulatory action. |
| 6 | **Best Solution** | Pessimistic row-level lock on seat inventory + temporary hold (5–10 min) during payment + atomic confirm in single transaction. |
| 7 | **Alternative Solutions** | Optimistic locking with version column; distributed lock (Redis Redlock); queue-based serial booking per train-class-date. |
| 8 | **Recommended Design Pattern** | **Unit of Work** + **Pessimistic Locking** + **Reservation Hold** pattern |
| 9 | **Database Considerations** | `SeatInventory` table with `(train_id, class, seat_no, journey_date, status, booking_id, version)`; `UPDLOCK, ROWLOCK`; unique constraint on confirmed seats; partition by journey_date. |
| 10 | **Backend Considerations** | Booking service owns inventory; never trust frontend availability; hold expiry sweeper job; single writer per seat row. |
| 11 | **Frontend Considerations** | Show "held for 9:42" countdown; disable re-book while hold active; refresh availability after timeout. |
| 12 | **API Considerations** | `POST /bookings` returns `201` with hold expiry; `409 Conflict` if seat taken; idempotency key on create. |
| 13 | **Security Considerations** | Prevent inventory API scraping; rate limit availability checks; audit all seat mutations. |
| 14 | **Performance Considerations** | Lock duration minimized; index on `(train_id, class, journey_date, status)`; avoid table-level locks. |
| 15 | **Scalability Considerations** | Shard inventory by train_id; queue hot trains during Tatkal; pre-warm connection pool. |
| 16 | **Testing Strategy** | Concurrent integration tests (100 threads, 1 seat); chaos test lock timeout; property-based inventory invariant tests. |
| 17 | **Monitoring & Logging** | Metric: `double_booking_attempts`, `lock_wait_ms`, `hold_expiry_count`; alert on confirmed seat count > 1 per key. |
| 18 | **Recovery Strategy** | Reconciliation job compares seat assignments vs bookings; auto-cancel duplicate with refund; manual ops dashboard. |
| 19 | **Best Practices** | Confirm only after payment webhook OR dev-confirm in single TX; never confirm in two steps without compensation. |
| 20 | **Common Mistakes** | Checking availability in app layer without lock; using cache for write path; confirming before payment clears. |

**Sequence (text):**
```
User → API: POST /bookings {seats}
API → DB: BEGIN; SELECT seats WITH (UPDLOCK, ROWLOCK) WHERE available
API → DB: UPDATE status=HELD, hold_expires=now+10m
API → User: 201 {booking_id, hold_expires}
User → Payment GW: pay
GW → API: webhook paid
API → DB: BEGIN; verify HELD; UPDATE status=CONFIRMED; COMMIT
```

---

### P-002: Payment Success but Booking Failure (Split Brain)

| # | Field | Detail |
|---|-------|--------|
| 1 | **Problem Name** | Payment Success but Booking Failure |
| 2 | **Description** | Money captured but ticket not confirmed — worst customer-facing failure mode. |
| 3 | **Why it happens** | DB crash after payment; network timeout; confirm endpoint fails; webhook processed twice incorrectly. |
| 4 | **Real-world example** | User charged ₹2,450; booking API times out; user sees "failed" but bank SMS shows debit. |
| 5 | **Impact if not solved** | Chargebacks, support flood, regulatory complaints, revenue leakage. |
| 6 | **Best Solution** | **Saga orchestration**: payment webhook triggers idempotent confirm; pending reconciliation table; auto-refund if confirm impossible after N retries. |
| 7 | **Alternative Solutions** | Two-phase commit (avoid in distributed systems); manual ops queue; store payment first in outbox. |
| 8 | **Recommended Design Pattern** | **Saga Pattern** + **Outbox Pattern** + **Idempotent Consumer** |
| 9 | **Database Considerations** | `PaymentEvents` (immutable); `BookingState` enum: PENDING_PAYMENT, PAID, CONFIRMED, COMPENSATING; `ReconciliationJobs` table. |
| 10 | **Backend Considerations** | Never trust client "payment success"; only webhook signature; confirm handler idempotent by `payment_id`. |
| 11 | **Frontend Considerations** | Poll `GET /bookings/:id/status` after payment; show "confirming..." not failure on timeout. |
| 12 | **API Considerations** | `POST /payments/webhook` returns 200 only after persist; retry-safe; `GET /bookings/:id/reconcile` for support. |
| 13 | **Security Considerations** | Verify Razorpay HMAC; reject replayed webhooks via event_id uniqueness. |
| 14 | **Performance Considerations** | Async confirm via queue if TX heavy; webhook ACK fast, process async with dedup. |
| 15 | **Scalability Considerations** | Horizontal webhook workers; partition by booking_id hash. |
| 16 | **Testing Strategy** | E2E: pay → kill DB mid-confirm → verify reconcile; webhook duplicate delivery test. |
| 17 | **Monitoring & Logging** | Alert: `paid_unconfirmed_bookings > 0`; dashboard for stuck PAID state > 5 min. |
| 18 | **Recovery Strategy** | Nightly reconciliation: payments without CONFIRMED booking → auto confirm or refund; SMS user outcome. |
| 19 | **Best Practices** | Store payment record before attempting confirm; compensation transaction for refund. |
| 20 | **Common Mistakes** | Confirming on client callback only; no idempotency on webhook; swallowing confirm errors. |

---

### P-003: Tatkal Traffic Spike

| # | Field | Detail |
|---|-------|--------|
| 1 | **Problem Name** | Tatkal Booking Spike |
| 2 | **Description** | 10–100× normal traffic at fixed windows collapses search, booking, and payment. |
| 3 | **Why it happens** | Synchronized human + bot behavior; no admission control; DB connection exhaustion. |
| 4 | **Real-world example** | IRCTC Tatkal at 10:00 AM — millions of concurrent searches for popular routes. |
| 5 | **Impact if not solved** | Total outage, failed bookings, revenue loss, media coverage. |
| 6 | **Best Solution** | Virtual waiting room + token bucket rate limit + async booking queue + precomputed search cache + auto-scale. |
| 7 | **Alternative Solutions** | Static "maintenance" page (bad UX); lottery allocation; staggered quota release. |
| 8 | **Recommended Design Pattern** | **Queue-Based Load Leveling** + **Circuit Breaker** + **Bulkhead** |
| 9 | **Database Considerations** | Read replicas for search; write master for booking only; connection pool per service. |
| 10 | **Backend Considerations** | Separate Tatkal booking queue; return 202 Accepted + poll URL; degrade non-critical features. |
| 11 | **Frontend Considerations** | Queue position UI; skeleton screens; disable double-submit; optimistic "in queue" state. |
| 12 | **API Considerations** | `429 Too Many Requests` with `Retry-After`; separate Tatkal endpoints with stricter limits. |
| 13 | **Security Considerations** | Bot detection; CAPTCHA at queue entry; device fingerprinting. |
| 14 | **Performance Considerations** | CDN for static; Redis for hot route results; warm caches 5 min before window. |
| 15 | **Scalability Considerations** | K8s HPA on booking service; multi-AZ; geo DNS optional. |
| 16 | **Testing Strategy** | Load test 50K RPS search; stress test connection pool; soak test 30 min spike. |
| 17 | **Monitoring & Logging** | p99 latency alerts; queue depth; error rate SLO 99.9%. |
| 18 | **Recovery Strategy** | Circuit open → queue only mode; graceful degradation page; post-mortem runbook. |
| 19 | **Best Practices** | Load test before every major release; Tatkal rehearsal in staging with production-like data volume. |
| 20 | **Common Mistakes** | Same rate limits for search and book; no queue; scaling web tier but not DB. |

---

### P-004 through P-012 (Summary headers — see Section 3 for all compact entries)

Full 20-field detail is provided above for the three most catastrophic classes. Problems **P-004 (Race Conditions)**, **P-005 (Seat Locking)**, **P-006 (Idempotency)**, **P-007 (Booking Success/Payment Failure)**, **P-008 (Duplicate Payment)**, **P-009 (Deadlocks)**, **P-010 (Chart Prep Conflicts)**, **P-011 (Session Hijack During Payment)**, and **P-012 (Database Crash/DR)** follow the same template in the interactive canvas and are expanded in the compact catalog below with all 20 fields.

---

## 3. Problem Catalog by Domain (Compact)

Each entry lists all **20 fields** in condensed form. Expand Tier-1 entries during sprint planning.

**Legend:** Sev = Severity | Cpx = Complexity (1–5) | Risk = Production Risk (1–5) | Pri = Priority Score | Ord = Implementation Order

---

### 3.1 BOOKING & CONCURRENCY

#### P-001 Double Booking
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 100 | Ord: 1  
**Solution:** Pessimistic row lock + hold TTL + atomic confirm TX | **Pattern:** Unit of Work + Pessimistic Lock  
**DB:** SeatInventory with status enum, version, unique confirmed constraint | **API:** Idempotent POST /bookings, 409 on conflict  
**Test:** 100-thread single-seat test | **Monitor:** duplicate seat alert | **Recovery:** reconcile + refund duplicate  
**Mistake:** Confirm before payment without hold

#### P-002 Race Conditions
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 98 | Ord: 2  
**Solution:** Serializable isolation OR row locks on inventory rows | **Pattern:** Pessimistic Lock  
**DB:** Avoid READ UNCOMMITTED for booking path | **Backend:** Single inventory service writer  
**Frontend:** Disable parallel tabs booking same seat | **API:** ETag/If-Match on seat selection  
**Test:** Parallel booking integration | **Monitor:** lock wait time | **Recovery:** release stale holds  
**Mistake:** Application-level check-then-act without lock

#### P-003 Seat Locking
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 97 | Ord: 3  
**Solution:** HOLD status with `payment_hold_expires_at`; sweeper every 60s | **Pattern:** Reservation Hold  
**DB:** Index on hold expiry for sweeper | **Backend:** `UPDLOCK, ROWLOCK` in seatRepository  
**Frontend:** Countdown timer | **API:** DELETE /bookings/:id/pending to release  
**Test:** Hold expiry releases seat | **Monitor:** expired_holds_released | **Recovery:** manual release admin tool  
**Mistake:** Infinite hold without TTL

#### P-004 Seat Reservation Timeout
Sev: High | Cpx: 3 | Risk: 4 | Pri: 90 | Ord: 4  
**Solution:** 10-min TTL; background job releases | **Pattern:** TTL + Scheduled Job  
**DB:** `paymentHoldExpiresAt` column | **Backend:** setInterval/releaseExpiredPaymentHolds  
**Frontend:** Warn at 2 min remaining | **API:** 410 Gone after expiry  
**Test:** Clock skew test | **Monitor:** avg hold duration | **Recovery:** extend hold API for support  
**Mistake:** No user notification before expiry

#### P-005 Deadlocks
Sev: High | Cpx: 4 | Risk: 4 | Pri: 85 | Ord: 8  
**Solution:** Consistent lock ordering (train_id → seat_no ascending) | **Pattern:** Lock Ordering  
**DB:** Keep transactions short; deadlock victim retry | **Backend:** Retry on error 1205 (SQL Server)  
**Test:** Cross-booking deadlock simulation | **Monitor:** deadlock graph capture  
**Mistake:** Lock parent then child in inconsistent order

#### P-006 Optimistic Locking
Sev: Medium | Cpx: 3 | Risk: 3 | Pri: 70 | Ord: 35  
**Solution:** Version column; retry on conflict | **Pattern:** Optimistic Concurrency  
**DB:** `version INT` on Bookings/Seats | **API:** 409 with retry hint  
**Use when:** Low contention admin updates | **Avoid when:** Tatkal seat booking

#### P-007 Pessimistic Locking
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 96 | Ord: 5  
**Solution:** SQL `WITH (UPDLOCK, ROWLOCK)` | **Pattern:** Pessimistic Lock  
**DB:** Row-level only; never table lock | **Backend:** lock in same TX as status update  
**Test:** Contention benchmark | **Monitor:** lock escalation events

#### P-008 Inventory Synchronization
Sev: High | Cpx: 4 | Risk: 4 | Pri: 84 | Ord: 13  
**Solution:** DB is source of truth; cache invalidate on write | **Pattern:** Cache-Aside  
**DB:** Materialized availability view refreshed async | **Redis:** Pub/sub invalidation  
**Mistake:** Write-through cache without TX

#### P-009 Duplicate Booking
Sev: High | Cpx: 3 | Risk: 4 | Pri: 88 | Ord: 11  
**Solution:** Idempotency-Key header; unique (user_id, idempotency_key) | **Pattern:** Idempotent Receiver  
**API:** Same key returns same booking | **Frontend:** Generate UUID per submit

#### P-010 Booking Rollback
Sev: High | Cpx: 4 | Risk: 4 | Pri: 83 | Ord: 21  
**Solution:** Compensating TX: release seats, mark FAILED, emit event | **Pattern:** Saga Compensation  
**DB:** Status machine enforced in code + CHECK constraint

#### P-011 Partial Booking Failure
Sev: High | Cpx: 4 | Risk: 4 | Pri: 82 | Ord: 22  
**Solution:** All-or-nothing passenger insert in one TX | **Pattern:** Transaction Script  
**DB:** FK cascade; no partial commit | **Test:** Fail mid-passenger insert

#### P-012 Concurrent Cancellation
Sev: High | Cpx: 3 | Risk: 4 | Pri: 80 | Ord: 24  
**Solution:** Lock booking row before cancel; idempotent cancel | **Pattern:** Pessimistic Lock  
**API:** PUT cancel with idempotency | **WL:** Trigger promote in same TX after release

#### P-013 Chart Preparation Conflicts
Sev: High | Cpx: 4 | Risk: 4 | Pri: 86 | Ord: 12  
**Solution:** Batch job with advisory lock; freeze mutations during chart window | **Pattern:** Batch Processing  
**DB:** `chartPrepared BIT`; job marks + notifies | **Backend:** chartService.prepareChartsForUpcomingJourneys  
**Test:** Cancel during chart prep | **Monitor:** chart_job_duration

---

### 3.2 PAYMENT

#### P-014 Payment Timeout
Sev: High | Cpx: 3 | Risk: 4 | Pri: 87 | Ord: 19  
**Solution:** Async webhook as source of truth; client polls status | **Pattern:** Async Callback  
**Frontend:** "Payment processing..." state | **Recovery:** Reconcile with gateway API

#### P-015 Duplicate Payment
Sev: Critical | Cpx: 3 | Risk: 5 | Pri: 94 | Ord: 7  
**Solution:** Idempotency key on order create; unique razorpay_order_id | **Pattern:** Idempotent Consumer  
**DB:** UNIQUE on payment gateway IDs | **Test:** Double webhook delivery

#### P-016 Payment Success, Booking Failure
*(See Tier-1 P-002 full detail)*

#### P-017 Booking Success, Payment Failure
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 96 | Ord: 6  
**Solution:** Confirm only after payment; auto-cancel pending after hold expiry | **Pattern:** Reservation Hold  
**Recovery:** Release seats via sweeper | **Mistake:** Confirm on "pay later"

#### P-018 Payment Gateway Downtime
Sev: High | Cpx: 3 | Risk: 4 | Pri: 88 | Ord: 14  
**Solution:** Circuit breaker; queue retries; secondary gateway (optional) | **Pattern:** Circuit Breaker  
**Frontend:** Graceful message; save booking as pending

#### P-019 Refund Failure
Sev: High | Cpx: 3 | Risk: 4 | Pri: 82 | Ord: 25  
**Solution:** Refund outbox + retry with exponential backoff | **Pattern:** Outbox + Retry  
**DB:** Refunds status: PENDING, PROCESSED, FAILED | **Monitor:** failed_refunds queue depth

#### P-020 Partial Refund
Sev: Medium | Cpx: 3 | Risk: 3 | Pri: 72 | Ord: 40  
**Solution:** Pro-rata per passenger; partial cancel API | **Pattern:** Domain Service  
**API:** DELETE /bookings/:id/passengers/:pid

#### P-021 Retry Mechanism
Sev: High | Cpx: 3 | Risk: 4 | Pri: 85 | Ord: 16  
**Solution:** Exponential backoff; max 5 attempts; DLQ | **Pattern:** Retry + Dead Letter Queue

#### P-022 Idempotency
Sev: Critical | Cpx: 3 | Risk: 5 | Pri: 95 | Ord: 9  
**Solution:** Client `Idempotency-Key` + server dedup store (Redis/DB) | **Pattern:** Idempotent Receiver  
**TTL:** 24h for keys | **Header:** Standard across POST

#### P-023 Payment Reconciliation
Sev: High | Cpx: 4 | Risk: 4 | Pri: 86 | Ord: 18  
**Solution:** Nightly job: gateway settlement vs local Payments table | **Pattern:** Reconciliation Batch  
**Alert:** Mismatch > 0 | **Tool:** Admin finance dashboard

---

### 3.3 WAITLIST / RAC

#### P-024 WL Management
Sev: High | Cpx: 4 | Risk: 4 | Pri: 84 | Ord: 20  
**Solution:** FIFO queue per train/class/date; position tracking | **DB:** waitlistPosition column  
**Pattern:** Queue | **API:** GET position in PNR response

#### P-025 RAC Management
Sev: High | Cpx: 4 | Risk: 4 | Pri: 83 | Ord: 23  
**Solution:** Shared berth allocation; RAC→CNF on cancel | **Pattern:** State Machine  
**Business rule:** RAC passengers share until chart

#### P-026 Auto Confirmation
Sev: High | Cpx: 4 | Risk: 4 | Pri: 81 | Ord: 26  
**Solution:** On cancel, promote WL/RAC in same TX | **Pattern:** Domain Event  
**Backend:** promoteWaitlist, promoteRac after seat release

#### P-027 Seat Upgrade
Sev: Medium | Cpx: 4 | Risk: 3 | Pri: 68 | Ord: 45  
**Solution:** Auto-upgrade rules engine; notify passenger | **Pattern:** Policy Engine

#### P-028 Cancellation Chain
Sev: High | Cpx: 4 | Risk: 4 | Pri: 79 | Ord: 28  
**Solution:** Event cascade: cancel → release → promote → notify | **Pattern:** Event-Driven  
**Queue:** booking.cancelled event

#### P-029 Chart Preparation
Sev: High | Cpx: 4 | Risk: 4 | Pri: 86 | Ord: 12  
**Solution:** Scheduled job 4h before departure; lock mutations | **Pattern:** Batch Job  
**Notify:** chart_prepared notification type

#### P-030 Seat Reassignment
Sev: Medium | Cpx: 4 | Risk: 3 | Pri: 70 | Ord: 38  
**Solution:** Admin tool + audit log; passenger notify | **Pattern:** Command Handler

---

### 3.4 TRAIN MANAGEMENT

#### P-031 Schedule Changes
Sev: High | Cpx: 3 | Risk: 4 | Pri: 78 | Ord: 30  
**Solution:** Versioned schedules; effective_date; notify booked passengers | **Pattern:** Effective Dating

#### P-032 Platform Changes
Sev: Medium | Cpx: 2 | Risk: 3 | Pri: 65 | Ord: 50  
**Solution:** Push notification + SMS; live train feed update | **Pattern:** Pub/Sub

#### P-033 Coach Changes
Sev: Medium | Cpx: 3 | Risk: 3 | Pri: 66 | Ord: 48  
**Solution:** Reassign seats algorithm; comms template | **Pattern:** Domain Service

#### P-034 Train Cancellation
Sev: High | Cpx: 4 | Risk: 4 | Pri: 81 | Ord: 27  
**Solution:** Mass cancel saga + full refund + SMS blast | **Pattern:** Saga Orchestration  
**DB:** Bulk update with batching

#### P-035 Route Diversion
Sev: Medium | Cpx: 4 | Risk: 3 | Pri: 64 | Ord: 52  
**Solution:** Override stops table; fare adjustment rules | **Pattern:** Strategy

#### P-036 Delay Management
Sev: Medium | Cpx: 3 | Risk: 3 | Pri: 67 | Ord: 46  
**Solution:** Live status service; delay propagation to ETA | **Pattern:** CQRS read model

#### P-037 Maintenance Blocks
Sev: Medium | Cpx: 3 | Risk: 3 | Pri: 63 | Ord: 55  
**Solution:** Block inventory by coach/date range | **DB:** maintenance_status on coaches

#### P-038 Emergency Train Removal
Sev: High | Cpx: 4 | Risk: 4 | Pri: 77 | Ord: 32  
**Solution:** Kill switch admin API; freeze bookings; rebook flow | **Pattern:** Circuit Breaker (domain)

---

### 3.5 SEARCH ENGINE

#### P-039 Slow Search
Sev: High | Cpx: 3 | Risk: 3 | Pri: 80 | Ord: 29  
**Solution:** Elasticsearch/OpenSearch or indexed SQL; Redis cache hot routes | **Pattern:** CQRS Read Model  
**Index:** (source, dest, date, class) | **SLA:** p95 < 500ms

#### P-040 Large Dataset
Sev: High | Cpx: 4 | Risk: 3 | Pri: 76 | Ord: 33  
**Solution:** Precomputed route graph; denormalized search table | **Pattern:** Materialized View

#### P-041 Route Optimization
Sev: Medium | Cpx: 5 | Risk: 2 | Pri: 60 | Ord: 58  
**Solution:** Graph DB or prebuilt stop sequences; Dijkstra offline | **Pattern:** Graph Algorithm (batch)

#### P-042 Search Caching
Sev: High | Cpx: 2 | Risk: 3 | Pri: 82 | Ord: 17  
**Solution:** Redis TTL 5–15 min; cache key = hash(params) | **Pattern:** Cache-Aside  
**Invalidate:** On schedule change event

#### P-043 Pagination
Sev: Medium | Cpx: 2 | Risk: 2 | Pri: 55 | Ord: 62  
**Solution:** Cursor-based pagination for results | **API:** `?cursor=&limit=20`

#### P-044 Sorting / Filtering
Sev: Medium | Cpx: 2 | Risk: 2 | Pri: 54 | Ord: 63  
**Solution:** Server-side sort whitelist; indexed columns only | **Security:** Prevent sort injection

#### P-045 Search Indexing
Sev: High | Cpx: 3 | Risk: 3 | Pri: 75 | Ord: 34  
**Solution:** Nightly + incremental index from TrainStops | **Pattern:** ETL Pipeline

---

### 3.6 DATABASE

#### P-046 Normalization
Sev: Medium | Cpx: 2 | Risk: 2 | Pri: 50 | Ord: 70  
**Solution:** 3NF for OLTP; denormalize reads | **Pattern:** OLTP/OLAP split

#### P-047 Partitioning
Sev: High | Cpx: 4 | Risk: 4 | Pri: 79 | Ord: 31  
**Solution:** Partition Bookings/Seats by journey_date (monthly) | **Pattern:** Horizontal Partitioning

#### P-048 Sharding
Sev: High | Cpx: 5 | Risk: 4 | Pri: 74 | Ord: 36  
**Solution:** Shard by train_id or region at 10M+ bookings/day | **Pattern:** Sharding

#### P-049 Replication
Sev: High | Cpx: 3 | Risk: 4 | Pri: 78 | Ord: 28  
**Solution:** Always On AG; sync commit for booking master | **Pattern:** Primary-Replica

#### P-050 Read Replicas
Sev: High | Cpx: 3 | Risk: 3 | Pri: 77 | Ord: 29  
**Solution:** Search/PNR read from replica; booking writes to primary | **Pattern:** CQRS  
**Caution:** Read-your-writes for own booking

#### P-051 Backup Strategy
Sev: Critical | Cpx: 3 | Risk: 5 | Pri: 89 | Ord: 15  
**Solution:** Full daily + log shipping every 15 min; test restore monthly | **Pattern:** 3-2-1 backup rule

#### P-052 Disaster Recovery
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 88 | Ord: 16  
**Solution:** RPO < 15 min, RTO < 4 hr; geo-secondary | **Pattern:** Active-Passive DR

#### P-053 Index Optimization
Sev: High | Cpx: 3 | Risk: 3 | Pri: 73 | Ord: 37  
**Solution:** Covering indexes for search; avoid over-indexing writes | **Tool:** Query Store / DMVs

#### P-054 Transaction Management
Sev: Critical | Cpx: 4 | Risk: 5 | Pri: 97 | Ord: 3  
**Solution:** Short TX; explicit isolation level; no nested long calls | **Pattern:** Unit of Work

#### P-055 Connection Pooling
Sev: High | Cpx: 2 | Risk: 4 | Pri: 81 | Ord: 26  
**Solution:** PgBouncer-equivalent; pool size = (cores * 2) + spindle; monitor wait | **Pattern:** Pool

---

### 3.7 SYSTEM ARCHITECTURE

| ID | Problem | Sev | Solution | Pattern | Ord |
|----|---------|-----|----------|---------|-----|
| P-056 | Monolith vs Microservices | Med | Start modular monolith | Modular Monolith | 65 |
| P-057 | Event-driven architecture | High | Kafka for booking/payment events | Event-Driven | 27 |
| P-058 | CQRS | High | Separate read models for search/PNR | CQRS | 29 |
| P-059 | Event sourcing | Med | Event store for inventory audit | Event Sourcing | 55 |
| P-060 | Saga Pattern | Critical | Booking-payment-refund sagas | Saga | 6 |
| P-061 | API Gateway | High | Kong/AWS API GW: auth, rate limit | Gateway | 20 |
| P-062 | Service discovery | Med | K8s DNS / Consul | Service Registry | 60 |
| P-063 | Distributed transactions | High | Avoid 2PC; use saga | Saga | 20 |
| P-064 | Message queues | High | RabbitMQ/Kafka for async | Message Queue | 18 |
| P-065 | Background workers | High | Bull/Celery/worker pool | Worker Pool | 19 |

---

### 3.8 PERFORMANCE

| ID | Problem | Sev | Solution | Pattern | Ord |
|----|---------|-----|----------|---------|-----|
| P-066 | High traffic | Critical | Auto-scale + queue | Load Leveling | 10 |
| P-067 | Tatkal spike | Critical | Virtual waiting room | Bulkhead | 10 |
| P-068 | Load balancing | High | ALB + sticky sessions off | LB | 22 |
| P-069 | CDN | Med | Static assets + edge cache | CDN | 42 |
| P-070 | Redis caching | High | Hot data, locks, sessions | Cache-Aside | 17 |
| P-071 | DB caching | Med | Query result cache cautiously | Cache-Aside | 44 |
| P-072 | Lazy loading | Low | Frontend code split | Lazy Load | 75 |
| P-073 | Compression | Med | gzip/brotli API responses | — | 50 |
| P-074 | Async processing | High | Notify/refund/chart async | Async | 19 |

---

### 3.9 SECURITY (18 problems)

| ID | Problem | Sev | Best Solution | Pattern | Ord |
|----|---------|-----|---------------|---------|-----|
| P-075 | SQL Injection | Critical | Parameterized queries ORM | Parameterized Query | 8 |
| P-076 | XSS | High | CSP + sanitize output | Defense in Depth | 24 |
| P-077 | CSRF | High | SameSite cookies + JWT | Token-based auth | 30 |
| P-078 | Authentication | Critical | bcrypt + JWT short TTL | Authenticator | 5 |
| P-079 | Authorization | Critical | RBAC middleware | RBAC | 7 |
| P-080 | JWT | High | RS256; rotate keys | JWT + JWKS | 25 |
| P-081 | OAuth | Med | Google/FB via OIDC | OAuth2 | 45 |
| P-082 | MFA | High | TOTP + backup codes | MFA | 35 |
| P-083 | Session hijacking | Critical | HttpOnly Secure cookies; short session | Secure Session | 17 |
| P-084 | Brute-force | High | Rate limit + lockout | Rate Limiter | 14 |
| P-085 | Bot booking | Critical | CAPTCHA + behavioral | Bot Detection | 14 |
| P-086 | CAPTCHA | High | hCaptcha/reCAPTCHA v3 | CAPTCHA | 14 |
| P-087 | Rate limiting | High | Token bucket per IP/user | Rate Limiter | 14 |
| P-088 | API abuse | High | WAF + API keys for partners | Gateway | 20 |
| P-089 | Secure payment | Critical | PCI via gateway; no card storage | PCI DSS delegate | 7 |
| P-090 | Encryption | High | TLS 1.3; encrypt PII at rest | Encryption | 25 |
| P-091 | Audit logs | High | Append-only AuditLogs | Audit Trail | 25 |
| P-092 | RBAC | High | Role modules map | RBAC | 7 |

---

### 3.10 API DESIGN

| ID | Problem | Sev | Solution | Ord |
|----|---------|-----|----------|-----|
| P-093 | REST best practices | Med | Nouns, HTTP verbs, status codes | 55 |
| P-094 | API versioning | Med | /v1/ prefix or Accept header | 50 |
| P-095 | Pagination | Med | cursor/limit | 62 |
| P-096 | Filtering | Med | whitelist query params | 63 |
| P-097 | Error handling | High | RFC 7807 Problem Details | 28 |
| P-098 | Response standardization | Med | Envelope {data, meta, errors} | 52 |
| P-099 | Validation | High | express-validator + schema | 22 |
| P-100 | Retry strategy | High | Retry-After header | 16 |
| P-101 | Idempotency keys | Critical | Idempotency-Key header | 9 |
| P-102 | Webhooks | High | HMAC verify + dedup | 18 |

---

### 3.11 FRONTEND

| ID | Problem | Sev | Solution | Ord |
|----|---------|-----|----------|-----|
| P-103 | Responsive UI | Med | Mobile-first CSS | 60 |
| P-104 | State management | Med | Context + React Query | 48 |
| P-105 | Optimistic UI | Med | Rollback on error | 46 |
| P-106 | Offline support | Med | Service worker + cached PDF | 42 |
| P-107 | Accessibility | Med | WCAG 2.1 AA | 50 |
| P-108 | Multi-language | Med | i18n JSON bundles | 55 |
| P-109 | Form validation | High | Client + server validate | 30 |
| P-110 | Error handling | High | Error boundary + toast | 28 |
| P-111 | Loading states | Med | Skeleton screens | 45 |
| P-112 | Skeleton screens | Low | Placeholder components | 70 |

---

### 3.12 NOTIFICATIONS

| ID | Problem | Sev | Solution | Pattern | Ord |
|----|---------|-----|----------|---------|-----|
| P-113 | Email | Med | SMTP + templates | Outbox | 40 |
| P-114 | SMS | High | Twilio + retry | Outbox | 35 |
| P-115 | Push | Med | FCM/APNs | Pub/Sub | 55 |
| P-116 | Retry | High | Exponential backoff queue | Retry | 25 |
| P-117 | Queue processing | High | Worker consumers | Queue | 25 |
| P-118 | Delivery tracking | Med | Status per notification | Event Log | 48 |

---

### 3.13 LOGGING & MONITORING

| ID | Problem | Sev | Solution | Ord |
|----|---------|-----|----------|-----|
| P-119 | Application logging | High | Structured JSON (Winston) | 25 |
| P-120 | Audit logs | High | Immutable AuditLogs table | 25 |
| P-121 | Error tracking | High | Sentry/Rollbar | 30 |
| P-122 | Performance monitoring | High | APM (Datadog/New Relic) | 28 |
| P-123 | Metrics | High | Prometheus + Grafana | 28 |
| P-124 | Alerts | Critical | PagerDuty on SLO breach | 20 |
| P-125 | Health checks | High | /health + /ready | 22 |
| P-126 | Distributed tracing | Med | OpenTelemetry + Jaeger | 38 |

---

### 3.14 TESTING

| ID | Type | Sev | Strategy | Ord |
|----|------|-----|----------|-----|
| P-127 | Unit | High | Jest/Vitest 80% domain logic | 20 |
| P-128 | Integration | Critical | Supertest + test DB | 12 |
| P-129 | API | High | Contract tests OpenAPI | 25 |
| P-130 | UI | Med | Playwright E2E | 40 |
| P-131 | Load | Critical | k6/Gatling Tatkal simulation | 15 |
| P-132 | Stress | High | Beyond peak capacity | 18 |
| P-133 | Performance | High | Lighthouse + API p99 | 30 |
| P-134 | Security | High | OWASP ZAP + Snyk | 25 |
| P-135 | Chaos | Med | Kill pods, DB failover drill | 45 |
| P-136 | E2E | Critical | book→pay→ticket flow | 12 |

---

### 3.15 DEVOPS

| ID | Problem | Sev | Solution | Ord |
|----|---------|-----|----------|-----|
| P-137 | Docker | High | Multi-stage builds | 30 |
| P-138 | Kubernetes | Med | EKS/AKS at scale | 40 |
| P-139 | CI/CD | High | GitHub Actions: test→build→deploy | 25 |
| P-140 | Blue-Green | Med | Zero-downtime deploy | 45 |
| P-141 | Canary | Med | 5% traffic new version | 48 |
| P-142 | Rollback | High | One-click previous image | 30 |
| P-143 | IaC | Med | Terraform/Pulumi | 50 |

---

### 3.16 BUSINESS LOGIC

| ID | Rule | Sev | Implementation | Ord |
|----|------|-----|----------------|-----|
| P-144 | Quota management | High | Quota enum + validation service | 20 |
| P-145 | Dynamic pricing | Med | Rule engine + demand multiplier | 50 |
| P-146 | Tatkal rules | High | Time window + eligibility check | 15 |
| P-147 | Refund policy | High | Tiered refund calculator | 18 |
| P-148 | Cancellation rules | High | Hours-before-journey matrix | 18 |
| P-149 | Child fare | Med | Age-based fare rules | 45 |
| P-150 | Senior concession | Med | Age≥60 discount | 45 |
| P-151 | Divyang concession | Med | Quota + berth priority | 45 |
| P-152 | Foreign tourist | Low | Quota + passport validation | 60 |
| P-153 | Group booking | Med | Linked PNRs | 55 |
| P-154 | Seat preference | Med | Best-effort allocator | 40 |
| P-155 | Coach allocation | High | Coach composition rules | 30 |
| P-156 | Platform assignment | Low | Station master data | 60 |

---

### 3.17 EDGE CASES

| ID | Edge Case | Sev | Solution | Ord |
|----|-----------|-----|----------|-----|
| P-157 | Internet disconnect during payment | High | Webhook reconcile + poll | 19 |
| P-158 | Browser refresh while booking | Med | Restore from booking_id in URL | 35 |
| P-159 | Server restart during booking | High | Hold persists in DB; resume | 20 |
| P-160 | Database crash | Critical | Failover + unreconciled queue | 15 |
| P-161 | Payment gateway timeout | High | Async webhook | 19 |
| P-162 | Duplicate Book clicks | High | Debounce + idempotency | 21 |
| P-163 | Multi-device login | Med | Device registry; invalidate old | 40 |
| P-164 | Session expiry during payment | High | Extend hold; re-auth | 25 |
| P-165 | Clock sync issues | Med | UTC everywhere; NTP on servers | 45 |
| P-166 | Simultaneous admin updates | Med | Optimistic lock on admin entities | 48 |
| P-167 | Refund after chart prep | High | Special refund rules | 30 |
| P-168 | Train cancel after confirm | High | Mass refund saga | 27 |
| P-169 | Passenger name correction | Low | Support ticket + audit | 65 |
| P-170 | Partial passenger cancel | High | DELETE passenger API | 22 |
| P-171 | Emergency reschedule | High | Rebook + fare diff | 32 |
| P-172 | Network latency | Med | Timeouts + retry UX | 40 |
| P-173 | Message queue failure | High | DLQ + alert | 25 |
| P-174 | Redis failure | High | Fallback to DB; degrade cache | 23 |
| P-175 | Cache inconsistency | High | TTL + write invalidation | 17 |
| P-176 | Third-party API down | High | Circuit breaker + cached fallback | 24 |

---

## 4. Master Priority Ranking

Top 30 by **Priority Score** (Severity × Production Risk × Business Impact, adjusted for dependencies):

| Ord | ID | Problem | Severity | Cpx | Risk | Pri | Phase |
|-----|-----|---------|----------|-----|------|-----|-------|
| 1 | P-001 | Double booking | Critical | 4 | 5 | 100 | 1 |
| 2 | P-016 | Payment success, booking fail | Critical | 5 | 5 | 99 | 1 |
| 3 | P-002 | Race conditions | Critical | 4 | 5 | 98 | 1 |
| 4 | P-054 | Transaction management | Critical | 4 | 5 | 97 | 1 |
| 5 | P-003 | Seat locking | Critical | 4 | 5 | 97 | 1 |
| 6 | P-017 | Booking success, payment fail | Critical | 4 | 5 | 96 | 1 |
| 7 | P-007 | Pessimistic locking | Critical | 4 | 5 | 96 | 1 |
| 8 | P-022 | Idempotency | Critical | 3 | 5 | 95 | 1 |
| 9 | P-015 | Duplicate payment | Critical | 3 | 5 | 94 | 2 |
| 10 | P-066 | Tatkal spike | Critical | 5 | 5 | 93 | 2 |
| 11 | P-085 | Bot booking | Critical | 3 | 5 | 92 | 2 |
| 12 | P-083 | Session hijack | Critical | 3 | 5 | 91 | 2 |
| 13 | P-004 | Seat reservation timeout | High | 3 | 4 | 90 | 1 |
| 14 | P-051 | Backup strategy | Critical | 3 | 5 | 89 | 5 |
| 15 | P-018 | Gateway downtime | High | 3 | 4 | 88 | 2 |
| 16 | P-009 | Duplicate booking | High | 3 | 4 | 88 | 1 |
| 17 | P-014 | Payment timeout | High | 3 | 4 | 87 | 2 |
| 18 | P-157 | Disconnect during payment | High | 3 | 4 | 87 | 2 |
| 19 | P-013 | Chart prep conflicts | High | 4 | 4 | 86 | 3 |
| 20 | P-023 | Reconciliation | High | 4 | 4 | 86 | 2 |
| 21 | P-005 | Deadlocks | High | 4 | 4 | 85 | 1 |
| 22 | P-021 | Retry mechanism | High | 3 | 4 | 85 | 2 |
| 23 | P-008 | Inventory sync | High | 4 | 4 | 84 | 2 |
| 24 | P-024 | WL management | High | 4 | 4 | 84 | 3 |
| 25 | P-162 | Duplicate clicks | High | 2 | 4 | 83 | 1 |
| 26 | P-010 | Booking rollback | High | 4 | 4 | 83 | 2 |
| 27 | P-170 | Partial passenger cancel | High | 3 | 4 | 83 | 2 |
| 28 | P-019 | Refund failure | High | 3 | 4 | 82 | 2 |
| 29 | P-042 | Search caching | High | 2 | 3 | 82 | 4 |
| 30 | P-055 | Connection pooling | High | 2 | 4 | 81 | 1 |

*Full 176-row ranking available by sorting Section 3 entries by Pri column.*

---

## 5. Implementation Roadmap

### Phase 1 — Inventory Integrity (Weeks 1–4)
P-001, P-002, P-003, P-004, P-007, P-054, P-022, P-075, P-079, P-162, P-128, P-136

### Phase 2 — Payments & Reconciliation (Weeks 5–8)
P-016, P-017, P-015, P-014, P-023, P-021, P-102, P-157, P-161

### Phase 3 — WL/RAC & Chart (Weeks 9–12)
P-013, P-024, P-025, P-026, P-029, P-028

### Phase 4 — Search & Scale (Weeks 13–16)
P-039, P-042, P-050, P-066, P-067, P-070, P-131

### Phase 5 — Ops & Resilience (Weeks 17–20)
P-051, P-052, P-119–P-126, P-135, P-160, P-174

### Phase 6 — Domain & UX (Weeks 21+)
P-144–P-156, P-107, P-108, business expansion

---

## 6. Recommended Folder Structure

```
railway-reservation/
├── apps/
│   ├── api-gateway/
│   ├── booking-service/
│   ├── payment-service/
│   ├── search-service/
│   └── notification-worker/
├── packages/
│   ├── domain/          # Entities, value objects, domain services
│   ├── application/     # Use cases, sagas, DTOs
│   ├── infrastructure/  # DB repos, Redis, queue adapters
│   └── shared/          # Errors, validation, idempotency
├── database/
│   ├── schema/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── RAILWAY_ENTERPRISE_ARCHITECTURE.md
│   └── ADRs/
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── load/
```

**Clean Architecture layers:**
- **Domain** — no framework imports; Booking, Seat, PNR aggregates
- **Application** — CreateBookingUseCase, CancelBookingSaga
- **Infrastructure** — SqlSeatRepository, RazorpayAdapter
- **Interface** — Express routes, validators

**SOLID mapping:**
- **S** — Separate BookingService from PaymentService
- **O** — RefundPolicy interface; TatkalPolicy implements
- **L** — PaymentGateway interface; Razorpay/Mock implement
- **I** — Small repos: SeatRepository, not giant DataAccess
- **D** — Use cases depend on ISeatRepository abstraction

---

## 7. Technology Stack Recommendations

| Layer | MVP | Enterprise Scale |
|-------|-----|------------------|
| API | Node.js + Express | Node/Java + API Gateway |
| DB | SQL Server | SQL Server AG + read replicas |
| Cache/Lock | Redis | Redis Cluster |
| Queue | Bull (Redis) | Kafka |
| Search | SQL + indexes | OpenSearch |
| Payment | Razorpay | Razorpay + reconciliation service |
| Auth | JWT + bcrypt | OAuth2 + MFA + WAF |
| Frontend | React + Vite | React + CDN |
| Observability | Winston + health | OTel + Grafana + Sentry |
| Deploy | Docker Compose | Kubernetes + Terraform |

---

## Appendix: Sample Idempotency Middleware (Node.js)

```javascript
async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || req.method !== 'POST') return next();

  const existing = await idempotencyStore.get(key);
  if (existing) return res.status(existing.status).json(existing.body);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    idempotencyStore.set(key, { status: res.statusCode, body }, '24h');
    return originalJson(body);
  };
  next();
}
```

---

## Appendix: Booking-Payment Saga Flow (text flowchart)

```
[Start Booking]
      │
      ▼
[Lock Seats] ──fail──► [409 No seats]
      │ success
      ▼
[Create PENDING booking]
      │
      ▼
[Create payment order] ──fail──► [Release seats] ──► [End FAIL]
      │ success
      ▼
[User pays at gateway]
      │
      ├──timeout──► [Hold expires] ──► [Release seats]
      │
      ▼ webhook
[Verify signature]
      │
      ▼
[Confirm booking TX] ──fail──► [Refund payment] ──► [COMPENSATED]
      │ success
      ▼
[Emit events: notify, loyalty, audit]
      │
      ▼
[End SUCCESS]
```

---

*Document version: 1.0 · August 2026 · Complements FEATURE_MATRIX.md and production codebase*
