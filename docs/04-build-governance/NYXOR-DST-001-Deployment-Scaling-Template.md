**VALTARA AI**

**Nyxor**

**DEPLOYMENT & SCALING TEMPLATE**

NYXOR-DST-001 · Version 1.0 · August 2026

| Document ID    | NYXOR-DST-001                                 |
| -------------- | --------------------------------------------- |
| Version        | 1.0                                           |
| Status         | Active                                        |
| Owner          | Francis Ogbogu — Chief AI Officer, Valtara AI |
| Audience       | Engineering, DevOps                           |
| Date           | August 2026                                   |
| Depends On     | NYXOR-SAD-001, NYXOR-SEC-001                  |
| Classification | Confidential — Internal Use Only              |

# 1. Deployment Architecture

| Component             | v1.0 Deployment                                                        |
| --------------------- | ---------------------------------------------------------------------- |
| Frontend (Next.js)    | Vercel — automatic preview deployments; production on merge to main    |
| Backend API (Node.js) | Railway or Fly.io — Docker container; health check endpoint at /health |
| Database (PostgreSQL) | Supabase managed PostgreSQL                                            |
| Redis / Job Queue     | Upstash Redis (serverless) or Railway Redis                            |
| File Storage          | Supabase Storage                                                       |
| CI/CD                 | GitHub Actions — lint, test, secret scan, build, deploy                |

# 2. CI/CD Pipeline

**2.1 Pipeline Stages**

Every push to a PR branch triggers the full pipeline. Merge to main triggers deployment to staging. Manual promotion to production.

| Stage               | Steps                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Validate            | Lint (ESLint + Prettier); TypeScript type check                             |
| Security            | Secret scanning (detect-secrets); npm audit; dependency vulnerability scan  |
| Test                | Unit tests (Vitest); integration tests; coverage check                      |
| Build               | Docker image build; tag with git SHA                                        |
| Deploy (staging)    | Deploy tagged image to staging; run smoke tests                             |
| Deploy (production) | Manual promotion trigger; deploy to production; run post-deploy smoke tests |

**2.2 Rollback Procedure**

- Step 1: Identify degraded metric or failed smoke test
- Step 2: Trigger rollback in deployment platform — redeploy previous stable image tag
- Step 3: Verify rollback by re-running smoke tests
- Step 4: If database migration was included: assess whether migration rollback is required; run down migration if safe
- Step 5: Document incident in incident log; do not promote again until root cause identified

# 3. Environment Configuration

**3.1 Environment Variables per Environment**

| Variable          | Development                           |
| ----------------- | ------------------------------------- |
| NODE_ENV          | development                           |
| LOG_LEVEL         | debug                                 |
| JWT secret values | Development-only values in .env.local |
| LLM_PROVIDER      | Any configured provider               |
| Database          | Local PostgreSQL (Docker Compose)     |
| Sentry DSN        | Optional                              |

# 4. Scaling Plan

**4.1 MVP Scaling Targets**

| Resource                 | MVP Target                             |
| ------------------------ | -------------------------------------- |
| Concurrent users         | 1,000                                  |
| Agent tasks/hour         | 10,000                                 |
| Morning brief generation | 1,000 executives in 30-minute window   |
| Database connections     | PgBouncer pool: 100 connections        |
| LLM API rate limits      | Per-provider limits managed by adapter |

**4.2 Scaling Architecture (Post-MVP)**

- Horizontal scaling: API layer is stateless (JWT auth); scales horizontally without session affinity
- Database read replicas: add read replica for dashboard queries as read volume grows; write operations remain on primary
- Worker separation: extract BullMQ workers to dedicated containers as job volume grows; independent scaling from API
- CDN: Vercel CDN handles static assets automatically; API responses cacheable where appropriate
- Microservice extraction: AI orchestration layer and integration adapter layer are candidates for extraction if CPU/memory profiles warrant it

# 5. Pre-Deployment Checklist

Required before every production deployment:

- [ ] All CI pipeline stages passing on the target commit
- [ ] Staging smoke tests passing
- [ ] Database migrations reviewed and tested on staging database
- [ ] Secret scan clean — no credentials in the deployment artifact
- [ ] Rollback procedure confirmed (previous stable image tag identified)
- [ ] On-call engineer notified of deployment window
- [ ] Post-deploy smoke test plan ready
- [ ] If new integration or AI capability: ethics impact checklist completed (NYXOR-ETP-001)

# 6. Document Approval

| Role     | Name                              |
| -------- | --------------------------------- |
| Author   | Francis Ogbogu — Chief AI Officer |
| Approver | Francis Ogbogu — Chief AI Officer |
| Date     | August 2026                       |

_NYXOR-DST-001 · Version 1.0 · August 2026 · Confidential — Internal Use Only_
