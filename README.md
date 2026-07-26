Production-Ready Telegram Bot Runtime

A production-ready Telegram Bot runtime built with grammY, Deno, Deno KV, and TeleBotHost.

The system is designed around a simple operating model:

«One bot. One webhook. One runtime. Five feature modules.»

Every Telegram update enters a single webhook, flows through a shared middleware pipeline, and is dispatched to the feature whose handler matches the update. Shared services handle storage, audit logging, analytics, background execution, and runtime operations.

---

Table of Contents

- Runtime Model
- Startup Sequence
- Project Layers
- Background Entrypoints
- Production Readiness
- Suggested Project Structure

---

Runtime Model

When Telegram sends an update to the webhook, all feature modules are available at the same time. The module whose handler matches the update processes it. All other modules pass through.

Telegram Cloud
      │
      ▼
POST /webhook
      │
      ▼
Secret Token Validation
      │
      ▼
grammY Bot Runtime
      │
      ▼
Global Middleware
  ├── Authentication
  ├── Authorization
  ├── Context Builder
  ├── Audit
  └── Analytics
      │
      ▼
Feature Registry
  ├── Dashboard
  ├── Community
  ├── Support
  ├── Content
  └── Broadcast
      │
      ▼
Service Layer
  ├── Storage (Deno KV)
  ├── Audit Log (Deno KV)
  └── Analytics (Deno KV)
      │
      ▼
Telegram API

This model keeps the runtime modular while preserving a single execution path to Telegram.

---

Startup Sequence

"main.ts" initializes the runtime in a fixed order:

1. Create the "Bot<BotContext>" instance
2. Register global middleware
3. Register feature modules
4. Start the queue worker ("db.listenQueue")
5. Start the scheduler ("Deno.cron" or "setInterval")
6. Attach the error boundary
7. Create the webhook callback handler
8. Start the HTTP server

This sequence ensures the bot, workers, and server all come online in a predictable order.

---

Project Layers

Config ("src/config.ts")

Validates all required environment variables at module load time. A missing variable fails the process immediately at startup instead of during request handling.

Typical responsibilities:

- Load "BOT_TOKEN"
- Load "WEBHOOK_SECRET"
- Load "OWNER_ID"
- Load "PORT"
- Load "ENV"
- Load any deployment URL required for webhook registration

---

Database ("src/database.ts")

Uses a single "Deno.openKv()" instance shared across the entire runtime.

All KV key paths are defined centrally in a "keys" object to prevent naming drift across features and services.

Typical responsibilities:

- Store users
- Store community membership records
- Store support tickets
- Store content drafts
- Store broadcast jobs
- Store audit logs
- Store analytics data

---

Middleware ("src/middleware.ts")

Extends grammY’s "Context" with runtime-specific fields:

Field| Type| Description
"isOwner"| "boolean"| Whether "ctx.from.id === OWNER_ID"
"isRegistered"| "boolean"| Whether "ctx.from" exists
"startedAt"| "number"| "Date.now()" at update entry

Middleware runs in this order:

Authentication → Authorization → Context Builder → Audit → Analytics

This creates a consistent execution pipeline for every update.

---

Features ("src/features/")

Each feature is implemented as a "Composer<BotContext>". Features are independent, and a change or failure in one does not affect the others.

Feature| Responsibility
"dashboard.ts"| "/start", "/stats", "/audit", navigation
"community.ts"| Welcome messages, member tracking, bans
"support.ts"| Ticket creation, user↔owner relay, close
"content.ts"| Post drafting, scheduling, publishing
"broadcast.ts"| Queue jobs, mass send, status

This structure keeps feature logic isolated and maintainable.

---

Services ("src/services/")

Services are stateless modules that features call into. No service owns bot state.

Service| Responsibility
"storage.ts"| User record upsert and lookup
"audit.ts"| Append-only update log
"analytics.ts"| Daily active users, command hit counts

Services are the boundary between feature logic and persistent data.

---

Workers ("src/workers/")

Both workers use the same "Bot" instance used by the webhook, so there is one egress path to Telegram regardless of trigger source.

Worker| Trigger| Responsibility
"queue.ts"| "db.listenQueue"| Process broadcast jobs
"scheduler.ts"| "Deno.cron" / "setInterval"| Publish scheduled posts

---

Background Entrypoints

Queue Event ──► Queue Worker ──► Feature Logic ──► Telegram API
Cron Tick   ──► Scheduler    ──► Feature Logic ──► Telegram API

Both paths reuse the same service layer and Telegram client integration.

---

Suggested Project Structure

src/
├── main.ts
├── config.ts
├── database.ts
├── middleware.ts
├── webhook.ts
│
├── features/
│   ├── dashboard.ts
│   ├── community.ts
│   ├── support.ts
│   ├── content.ts
│   └── broadcast.ts
│
├── services/
│   ├── storage.ts
│   ├── audit.ts
│   └── analytics.ts
│
├── workers/
│   ├── queue.ts
│   └── scheduler.ts
│
└── types/

This layout matches the architecture and keeps runtime concerns separated.

---

What Production-Readiness Still Requires

This runtime provides a solid architectural foundation. A real deployment still needs the operational layer around it:

- Monitoring — uptime checks, error rate alerting, and runtime health checks
- Backups — Deno KV export strategy or replication
- Testing — unit tests per feature and integration tests for the middleware pipeline
- CI/CD — automated type checking, linting, and deployment on push
- Rate limit handling — retry logic with exponential backoff on Telegram 429 responses
- Logging — structured JSON output suitable for log aggregation

These items turn a working runtime into a reliable production system.
