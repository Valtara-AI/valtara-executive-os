**VALTARA AI**

**Valtara Executive OS**

**MONITORING & OBSERVABILITY PLAN**

VEX-OS-MOP-001 · Version 1.0 · August 2026

| Document ID | VEX-OS-MOP-001 |
| --- | --- |
| Version | 1.0 |
| Status | Active |
| Owner | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience | Engineering, DevOps, On-Call |
| Date | August 2026 |
| Depends On | VEX-OS-SAD-001, VEX-OS-DST-001 |
| Classification | Confidential — Internal Use Only |

# 1. Purpose & Scope

This Monitoring & Observability Plan defines the logging strategy, metrics collection, alerting thresholds, AI output monitoring, cost tracking, and incident response playbook for Valtara Executive OS (VEX-OS). Observability is built in from Sprint 1 — not added post-launch.

The three pillars of VEX-OS observability are: (1) structured logs for event-level detail; (2) metrics for system health trends; (3) traces for request-level performance. All three are required before production launch.

# 2. Logging Strategy

| Component | Log Format |
| --- | --- |
| API server | Pino JSON — {timestamp, level, requestId, userId, method, path, statusCode, durationMs} |
| AI orchestration layer | Pino JSON — {timestamp, level, taskId, agentId, provider, model, inputTokens, outputTokens, durationMs, hitlStatus} |
| Integration adapters | Pino JSON — {timestamp, level, provider, operation, executiveId (hashed), success, durationMs} |
| HITL engine | Pino JSON — {timestamp, level, itemId, agentId, action, actorId, durationMs} |
| Job queue (BullMQ) | Pino JSON — {timestamp, level, jobId, jobType, attemptsMade, durationMs, result} |
| Audit log | Dedicated append-only PostgreSQL table — see VEX-OS-SEC-001 |

PII policy: no executive name, email, communication content, or OAuth tokens in application logs. User reference: hashed executive ID only.

# 3. Metrics

## 3.1 Infrastructure Metrics

| Metric | Source |
| --- | --- |
| API p95 response time | OpenTelemetry → metrics store |
| API error rate (5xx) | OpenTelemetry |
| API availability | Uptime check (every 60s) |
| Database connection pool utilization | PgBouncer metrics |
| Redis queue depth (BullMQ) | BullMQ metrics |
| Memory utilization (API container) | Container runtime metrics |
| CPU utilization (API container) | Container runtime metrics |

## 3.2 AI & Product Metrics

| Metric | Source |
| --- | --- |
| HITL approval rate (7-day rolling) | VEX-OS application database |
| Agent task completion rate | Task records in database |
| Agent task p95 latency | Task duration logged at completion |
| Morning brief delivery success | Brief generation job result |
| LLM provider error rate | AI orchestration layer logs |
| LLM provider failover events | AI orchestration layer logs |
| Token cost per task type | Inference result logs |
| Integration OAuth refresh failures | Integration adapter logs |

# 4. Distributed Tracing

OpenTelemetry instrumentation is required from Sprint 1. Every inbound API request receives a trace ID propagated through all downstream calls: database queries, LLM inference, integration API calls, and job queue operations.

| Trace Attribute | Value |
| --- | --- |
| trace.id | UUID generated at API gateway; propagated via W3C TraceContext header |
| span.executive_id | Hashed executive ID — never plain email or name |
| span.agent_id | Agent UUID for agent-initiated spans |
| span.task_id | Task UUID for task execution spans |
| span.provider | LLM provider name for inference spans |
| span.integration | Integration provider name for adapter spans |

Trace export: OpenTelemetry collector → Axiom, Grafana Tempo, or equivalent. Provider-agnostic by OpenTelemetry design.

# 5. Alerting & On-Call

**5.1 Alert Severity Levels**

| Severity | Definition |
| --- | --- |
| P1 — Critical | Service unavailable; data breach suspected; HITL bypass detected; morning brief delivery failed for >10% of executives |
| P2 — High | API error rate >1%; agent task failure rate >5%; LLM failover rate elevated; OAuth refresh failures |
| P3 — Medium | HITL approval rate declining; token cost elevated; queue depth growing; performance degrading but within SLA |
| P4 — Low | Individual job failure (retried successfully); single integration refresh failure; minor latency increase |

**5.2 Incident Response Playbook**

| Step | Action |
| --- | --- |
| 1. Detect | Alert fires; on-call engineer acknowledges within 15 minutes (P1) or 30 minutes (P2) |
| 2. Assess | Confirm alert is real (not false positive); determine scope — how many executives affected; identify affected component |
| 3. Communicate | Open incident channel in Slack (#incident-[date]); notify CAO for P1; post initial status update within 30 minutes |
| 4. Contain | Apply immediate mitigation: rollback, feature flag disable, provider failover, or service isolation |
| 5. Resolve | Implement fix; deploy to production via standard pipeline or hotfix procedure; confirm resolution with metric recovery |
| 6. Post-mortem | Written post-mortem within 5 business days for P1/P2: timeline, root cause, impact, corrective actions, prevention measures |

# 6. Cost Monitoring

| Cost Category | Monitoring Method |
| --- | --- |
| LLM provider API costs | Token count logged per inference; cost calculated using provider pricing at log time |
| Database hosting costs | Supabase dashboard + monthly review |
| Infrastructure hosting costs | Railway/Fly.io + Vercel dashboards |
| Redis costs | Upstash or Railway metrics |

Cost per executive per month is calculated monthly from aggregated token, database, and infrastructure costs. Target: infrastructure cost ≤15% of monthly revenue per seat.

# 7. Document Approval

| Role | Name |
| --- | --- |
| Author | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date | August 2026 |
| Review Cycle | Quarterly; upon material infrastructure change |

*VEX-OS-MOP-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only*
