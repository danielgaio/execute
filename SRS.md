# Execute: 12-Week Execution Framework — Software Requirements Specification

**Owner:** Daniel Eliel Gaio  
**Date:** 2025‑10‑30  
**Version:** 0.1 (Draft for review)

---

## 1. Introduction

### 1.1 Purpose

Define a complete set of functional and non‑functional requirements to build an agent-first, multi‑user management system inspired by quarterly execution principles. The system centers on an intelligent AI agent that guides users through planning, execution, and analysis of 12‑week cycles. The agent serves as the primary interface for tracking lead/lag indicators, facilitating Weekly Progress Reviews (WPR), answering questions about progress, and providing actionable insights—with traditional UI forms available as supporting alternatives.
### 1.2 Scope

**In Scope:**
- Agent-first 12-week planning (conversational and form-based)
- Agent-guided weekly plans and agent-powered daily focus
- Agent-facilitated WPR (Weekly Progress Review) workflows
- Lead/lag scoring with agent analysis and agent-driven analytics
- Collaboration with agent assistance and notifications
- Multi‑tenant accounts with role‑based access control
- History/audit trails and data versioning
- MCP server architecture for external agent integration
- Enterprise authentication (Microsoft AD, Google Workspace, Okta)
- Agent-accessible mobile‑responsive UI

**Out of Scope (v1):**
- Advanced SCIM provisioning
- Native mobile apps
- Advanced portfolio management across dozens of teams
- Voice/audio agent interactions

### 1.3 Goals (High‑Level)

#### Primary: Agent-Centric Experience

- Provide an intelligent AI agent as the primary interface for all 12-week execution workflows: planning, execution, analysis, and collaboration
- Enable users to accomplish any task through natural language conversation: "Help me plan my next cycle", "What should I focus on today?", "Why is my score lower this week?"
- Agent must answer any question about ongoing, past, or future plans with full context and citations
- Agent guides users conversationally through Vision definition, Goal setting, and Tactic creation with intelligent suggestions
- Agent proactively surfaces insights, identifies risks, and recommends adjustments based on execution patterns

#### Supporting: Comprehensive 12-Week Execution Management

- Track all 12-week cycles with immutable history for goals, tactics, lead/lag indicators, weekly plans, and WPR results
- Offer agent-powered daily briefings and weekly plan recommendations with traditional dashboard views as alternatives
- Provide agent-facilitated WPR workflows with automatic note-taking, analysis, and action item generation
- Deliver agent-driven analytics explaining execution (lead) vs outcomes (lag) patterns over time
- Support multi‑tenant collaboration with agent respecting role boundaries (Manager, Team Member) and data isolation
- Enable continuous improvement through feedback loops that learn from execution outcomes and adapt recommendations

### 1.4 Definitions & Glossary

| Term | Definition |
|------|------------|
| **12-Week Cycle** | A planning and execution period of 12 consecutive weeks; the fundamental time unit for goal-setting and progress tracking |
| **Vision** | Long‑term and mid‑term aspirations that inform cycle goals and provide strategic direction |
| **Goal (Lag Indicator)** | Outcome metric measured by results (e.g., revenue, NPS, customer satisfaction); represents the desired end state |
| **Lead Indicators** | Execution metrics—primarily tactic completion rate and consistency; predictive activities that drive lag outcomes |
| **Tactic** | Specific, time‑bound action that drives a goal; the fundamental unit of executable work |
| **Weekly Plan** | The set of tactics due/committed for a given week; auto-generated from cycle tactics with manual override capability |
| **WPR (Weekly Progress Review)** | Structured review session to assess progress, compute scores, and commit to next week's actions |
| **Manager** | User who manages a team; can view/manage members' plans and facilitate WPRs |
| **Team Member** | Regular user with limited scope; owns and executes tactics within assigned teams |
| **Agent** | In‑app AI assistant capable of answering questions, providing guidance, and executing allowed actions via natural language |
| **MCP (Model Context Protocol)** | Standard for exposing Execute's capabilities to external AI agents via structured APIs |

### 1.5 References

- **12-Week Execution Methodology:** Industry-standard quarterly planning framework emphasizing consistent execution over perfection
- **Technology Stack:** Supabase, Next.js, Vercel, Material UI (MUI), OpenAI API
- **Standards:** Model Context Protocol (MCP), SAML 2.0, OAuth 2.0, OpenAPI 3.0

---

## 2. System Overview & Architecture

### 2.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) + React | Server-side rendering, routing, and React components |
| | Material UI (MUI) | Design system and component library |
| | Agent Chat Interface | Primary user interaction layer |
| **Backend** | Supabase (Postgres) | Primary database with RLS policies |
| | Supabase Auth | Authentication and session management |
| | Supabase Storage | File attachments and media |
| | Supabase Realtime | Live updates and collaboration |
| | pgvector | Vector embeddings for agent RAG |
| **AI/Agent** | OpenAI GPT-4+ | Chat, function-calling, embeddings |
| | Structured Tool Calling | Agent action execution |
| **MCP Servers** | Node.js/Deno | External agent integration endpoints |
| | Model Context Protocol | Standard API for agent orchestration |
| **Authentication** | Supabase Auth + OAuth | Google, Microsoft, GitHub login |
| | SAML 2.0 SSO | Microsoft AD, Google Workspace, Okta |
| **Jobs/Scheduling** | Supabase Edge Functions | Serverless background tasks |
| | Supabase Scheduler | Cron-based job execution |
| **Email** | Resend/SendGrid | Transactional emails and notifications |
| **Analytics** | MUI X Charts / Recharts | Data visualization |
| | Agent-Generated Insights | Natural language analytics |
| **Payments** | Stripe | Payment processing, subscription management, credits |
| | Stripe Checkout | Hosted payment pages |
| | Stripe Billing | Subscription and invoice management |
| | Stripe Webhooks | Real-time payment event handling |
| **Scale Infrastructure** | Temporal (future) | Workflow orchestration for multi-agent processes |
| *(Added as needed)* | Redis Streams / Kafka / Pub/Sub | Event streaming and messaging |
| | Kubernetes / Cloud Run / Fargate | Container orchestration for MCP servers |
| | Qdrant / Pinecone (future) | Dedicated vector database at scale |
| | Model Proxy Service | Rate limiting, caching, cost control for OpenAI |
| **Observability** | OpenTelemetry | Distributed tracing |
| *(Production)* | Prometheus + Grafana | Metrics and monitoring |
| | Sentry | Error tracking and performance |
| | Elasticsearch / Logflare | Centralized structured logging |

**Note:** Technologies marked "future" or "production" are adopted incrementally as scale and operational needs require (see Section 2.4).

### 2.2 High‑Level Architecture

#### Agent-First Design

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Agent Chat (Primary Interface)                      │  │
│  │   - Right-side persistent panel                       │  │
│  │   - Keyboard shortcuts (Cmd/Ctrl+K)                   │  │
│  │   - Streaming responses                               │  │
│  │   - Context-aware suggestions                         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Traditional UI (Secondary/Fallback)                 │  │
│  │   - Form-based wizards                                │  │
│  │   - Dashboard views                                   │  │
│  │   - Data tables                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Agent Layer                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   OpenAI Function-Calling Orchestrator                │  │
│  │   - 20+ tools (query, action, analysis)              │  │
│  │   - RAG retrieval over pgvector                      │  │
│  │   - Context assembly with RLS filtering              │  │
│  │   - Conversation memory management                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   API & Data Layer                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Next.js Route Handlers                             │  │
│  │   - Agent tool execution                             │  │
│  │   - Traditional CRUD operations                      │  │
│  │   - Supabase RPC for complex queries                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   Supabase (Postgres + RLS)                          │  │
│  │   - Multi-tenant data isolation                      │  │
│  │   - pgvector embeddings                              │  │
│  │   - Realtime collaboration                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           MCP Servers (External Agent Integration)           │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │  Planning   │ Execution   │ Analytics   │   Query     │  │
│  │   Server    │   Server    │   Server    │   Server    │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
│       ↑              ↑              ↑              ↑          │
│   API Keys      API Keys      API Keys      API Keys         │
│   + RLS         + RLS         + RLS         + RLS            │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **Client Layer**
   - Persistent agent chat interface (right panel, keyboard-accessible)
   - Agent SDK for streaming responses and real-time updates
   - Traditional UI forms as fallback/alternative

2. **Agent Intelligence**
   - OpenAI function-calling orchestrator with 20+ tools
   - RAG retrieval over pgvector for contextual responses
   - Context builder assembling cycles, goals, tactics, scores with RLS filtering
   - Conversation memory maintaining session state and long-term history

3. **API & Data**
   - Next.js route handlers for agent tool execution and CRUD
   - Supabase RPC for complex queries and aggregations
   - Postgres with RLS per tenant/team
   - pgvector embeddings for all user content

4. **MCP Server Architecture**
   - Execute exposes core functionality via Model Context Protocol
   - Enables external AI agents to leverage planning/execution/analytics
   - Supports agent orchestration: Execute provides strategic planning while specialized agents execute tactics
   - Authenticated via API keys with RLS enforcement and rate limiting

### 2.3 Deployment Environments

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| **Development** | Local development and testing | Local Supabase + Vercel dev server |
| **Staging** | Pre-production validation | Isolated Supabase project + Vercel preview |
| **Production** | Live system | Production Supabase + Vercel production |

**Feature Management:**
- Feature flags via database table or environment-based toggles
- Per-org feature enablement for gradual rollouts
- A/B testing support for agent capabilities

### 2.4 Scalability & Operational Infrastructure

As Execute grows beyond MVP and handles high-volume agent fleets, enterprise workloads, and complex workflows, the following infrastructure components become critical:

#### 2.4.1 MCP Server Hosting & Autoscaling

**MVP Approach:**
- Supabase Edge Functions (serverless) for MCP endpoints
- Suitable for: low-to-moderate request volumes, simple stateless operations
- Advantages: zero ops overhead, automatic scaling, low cost at small scale

**Production Scale Approach:**
- Container orchestration (Kubernetes, Cloud Run, ECS/Fargate, Azure Container Instances)
- Required for: large fleet of external agents, high throughput (10K+ requests/hour), predictable latency SLAs
- Capabilities:
  - Predictable horizontal autoscaling with pod/instance metrics
  - Advanced networking (service mesh, mTLS, fine-grained network policies)
  - Sidecar observability (distributed tracing, metrics exporters)
  - Support for long-running connections and stateful workflows
  - Resource limits and quotas per agent/tenant
- Rationale: Reliably run Temporal workers, vector DB connectors, and MCP services with guaranteed capacity

#### 2.4.2 Workflow Orchestration Engine

**MVP Approach:**
- Supabase Edge Functions + simple job queues for background tasks
- Suitable for: short-lived tasks (< 30s), linear workflows without complex state

**Production Scale Approach:**
- **Temporal** (or equivalent workflow engine like Cadence, Airflow for batch)
- Required for: multi-agent workflows, long-running processes (hours/days), human-in-the-loop approvals, complex retry logic
- Capabilities:
  - Durable workflow execution with automatic retries and compensation
  - Replayability and version control for workflow definitions
  - Visibility dashboard for monitoring workflow state
  - Support for parallel execution, sequential handoffs, and conditional branching
  - Built-in timeout and failure handling
- Rationale: Ensures robust orchestration for agent collaboration workflows (e.g., content pipeline, sales outreach) with stateful handoffs and human approvals

#### 2.4.3 Event Streaming & Messaging

**MVP Approach:**
- Supabase Realtime (Postgres LISTEN/NOTIFY) for basic pub/sub
- Suitable for: low-volume real-time updates, simple notifications

**Production Scale Approach:**
- **Message Bus Options:**
  - **Redis Streams** (simpler, lower ops burden): For moderate durability and throughput
  - **Kafka** (self-hosted): For high-throughput, multi-consumer, long retention
  - **Managed Pub/Sub** (Google Pub/Sub, AWS SNS+SQS, Azure Event Hubs): For managed durability with minimal ops
- Required for: agent-to-agent messaging, cross-service orchestration, durable event logging, webhook fan-out
- Capabilities:
  - Guaranteed delivery with at-least-once semantics
  - Message replay and dead-letter queues
  - Topic-based routing and filtering
  - Support for event sourcing and audit trails
  - Decoupling of services for independent scaling
- Rationale: Provides reliable event stream for agent coordination, MCP event notifications, Stripe webhooks, and system-wide observability

#### 2.4.4 Observability & SRE

**Production Requirements:**
- **Distributed Tracing:** OpenTelemetry for end-to-end request tracing
  - Trace agent decisions → MCP calls → database queries → external agent executions
  - Correlate traces with costs (model tokens, external agent charges)
- **Metrics & Monitoring:** Prometheus + Grafana
  - Agent response latency (p50/p95/p99)
  - MCP endpoint throughput and error rates
  - Stripe webhook processing success/failure rates
  - Credit balance and consumption trends per org/team
  - Model API token usage and costs
- **Structured Logging:** Elasticsearch/Logflare or managed logging (CloudWatch Logs, Stackdriver)
  - Centralized logs from all services with trace IDs
  - Searchable by org, user, agent, tactic, workflow
- **Error Tracking:** Sentry for exceptions and performance issues
  - Alert on critical errors (payment failures, RLS breaches, agent timeouts)
- **Dashboards:** Real-time operational dashboards for:
  - System health (uptime, error rates, latency)
  - Business metrics (active users, cycle completions, lead scores, revenue)
  - Cost metrics (OpenAI spend, agent execution costs, infrastructure costs)

#### 2.4.5 Model Cost Control & Optimization

**Challenge:** OpenAI API calls can become expensive at scale; uncontrolled usage leads to cost spikes.

**Solution: Model Proxy Service**
- Centralized proxy sitting between application and OpenAI API
- Capabilities:
  - **Rate Limiting:** Per-org and per-user token quotas (daily/monthly)
  - **Caching:** Cache responses for identical queries to reduce redundant API calls
  - **Request Coalescing:** Batch similar requests to reduce total calls
  - **Token Budgeting:** Enforce credit-based or currency-based budgets per org
  - **Model Routing:** Route queries to cheaper models (GPT-3.5) when appropriate; use GPT-4 only for complex tasks
  - **Response Summarization:** Truncate or summarize long responses to reduce token usage
  - **Fallback Logic:** Graceful degradation when quotas exceeded (cached responses, simplified answers)
- Monitoring:
  - Per-org token consumption dashboards
  - Cost attribution per feature (agent queries, analytics, workflows)
  - Alerts when approaching budget thresholds (80%, 95%, 100%)
- Rationale: Prevents runaway costs, enables predictable pricing, and provides visibility into model usage patterns

#### 2.4.6 Migration Path

Execute adopts these components incrementally based on scale and operational needs:

1. **MVP (Weeks 0-8):** Supabase Edge Functions, pgvector, OpenAI direct, basic logging
2. **Early Scale (Weeks 8-16):** Add model proxy, OpenTelemetry tracing, Redis Streams for messaging
3. **Production Scale (Weeks 16-24):** Migrate MCP servers to containers, introduce Temporal for workflows, add Prometheus/Grafana
4. **Enterprise Scale (6+ months):** Full observability stack, managed vector DB (Qdrant/Pinecone), service mesh, advanced cost controls

---

## 3. Users, Roles & Permissions

### 3.1 User Personas

| Persona | Description | Primary Use Cases |
|---------|-------------|-------------------|
| **Individual** | Solo practitioner managing personal execution | Plans and executes own 12-week cycles; tracks personal progress; uses agent for guidance |
| **Manager** | Team leader overseeing execution | Reviews team members' plans; facilitates WPRs; views team analytics; assigns tactics |
| **Team Member** | Contributor within a team structure | Collaborates on team goals; owns assigned tactics; participates in WPRs; reports progress |
| **Owner** | Organization administrator | Manages org settings; controls billing; assigns roles; configures integrations |

### 3.2 Role-Based Access Control

| Role | Permissions | Scope |
|------|------------|-------|
| **Owner (Tenant Admin)** | • Manage organization settings<br>• Manage teams and members<br>• Assign roles<br>• Configure SSO/SAML<br>• Manage API keys<br>• View all org data | Organization-wide |
| **Manager** | • Create/assign tactics and goals<br>• View team analytics<br>• Facilitate WPRs<br>• Reassign tasks<br>• Override completion status | Team-level |
| **Team Member** | • Create/view own items<br>• Complete assigned tactics<br>• Participate in WPRs<br>• Collaborate on shared goals | Personal + assigned team items |
| **Viewer** | • Read-only access to selected dashboards<br>• View reports and analytics | Limited read-only |

### 3.3 Multi‑Tenant Data Model

**Organizational Structure:**
- Users can belong to **multiple Organizations**
- Within each org, users may belong to **one or more Teams**
- Row‑Level Security (RLS) enforces org/team boundaries via `org_id` and `team_id` fields
- All data queries automatically filtered by user's organizational context

**Security Boundaries:**
```sql
-- Example RLS Policy
CREATE POLICY "org_members_can_read"
ON goals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM org_members m
    WHERE m.org_id = goals.org_id
    AND m.user_id = auth.uid()
  )
);
```

---

## 4. Functional Requirements (FR)

### 4.1 Accounts, Organizations & Teams

#### Authentication & Access

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | Users can register/login via Supabase Auth (email/password + OAuth providers: Google, Microsoft, GitHub) | P0 |
| **FR-001a** | Enterprise SSO via SAML 2.0 for Microsoft Active Directory, Google Workspace, Okta integration | P1 |
| **FR-001b** | Support Just-In-Time (JIT) user provisioning on first SSO login with configurable default roles | P1 |
| **FR-001c** | Domain-based automatic org assignment (e.g., users from @company.com auto-join Company org) | P1 |
| **FR-002** | Users can create/join Organizations; Org Owner can invite users via email | P0 |
| **FR-003** | Org Owner/Manager can create Teams within an org and assign roles | P0 |
| **FR-004** | RLS restricts data visibility to org members; team visibility configurable (private vs shared) | P0 |
| **FR-005** | User profile stores locale, timezone, and notification preferences | P0 |
| **FR-006** | API key management for MCP server access with scoped permissions per org/team | P1 |

### 4.2 Vision Management

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-010** | Each user and team has a Vision space with long-term (3–5y), mid-term (1y), and near-term themes | P0 |
| **FR-011** | Support rich text, markdown, file attachments, and complete version history | P0 |
| **FR-012** | Vision content is indexable for agent RAG retrieval with RLS permissions respected | P0 |

### 4.3 12-Week Cycles & Goals (Lag Indicators)

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-020** | Create/manage 12‑week cycles with start/end dates (non‑overlapping per user/team) | P0 |
| **FR-021** | Define Goals per cycle with owner, target metric, unit, baseline, and target value/date | P0 |
| **FR-022** | Record Lag indicator values weekly (manual entry or CSV import) | P0 |
| **FR-023** | Maintain immutable history of goal revisions with full version control | P0 |
| **FR-024** | Support goal status tracking (On Track / At Risk / Off Track) with commentary | P0 |

### 4.4 Tactics (Lead Indicators) & Scheduling

FR‑030: Create Tactics linked to goals; attributes: title, description, weight (0.1–1.0), recurrence (one‑off / weekly / custom), due day(s), owner/assignee, optional checklist & effort estimate.
FR‑031: Generate planned instances for each week/day based on tactic recurrence.
FR‑032: Mark instances as Done / Skipped / Deferred with timestamp and notes.
FR‑033: Reassign tactics; preserve history of assignments.
FR‑034: Dependencies: a tactic can depend on others; warnings on conflicts.
4.5 Weekly Plans & WPR

FR‑040: System auto‑builds a Weekly Plan from tactics due that week (by Monday 00:00 in user/team timezone).
FR‑041: Users can add/remove/edit weekly commitments; changes do not alter the underlying tactic definition (record overrides).
FR‑042: WPR flow: 1) review lag results, 2) compute lead score automatically, 3) review missed/at‑risk items, 4) commit next week’s plan, 5) notes & decisions, 6) attendance.
FR‑043: WPR notes and decisions are versioned and exportable (PDF/Markdown).
FR‑044: WPR template customizable per team; default agenda provided.
4.6 Daily Focus & What’s Due

FR‑050: Daily view shows tactics due today and the rest of the week, grouped by priority and owner.
FR‑051: Quick actions: mark done, add note, snooze (with rule‑based limits), reassign with reason.
FR‑052: Calendar feed (ICS) per user for due items (optional integration).
4.7 Lead/Lag Scoring & Formulas

FR‑060: Lead score (weekly) = (sum of completed planned instances × weight) / (sum of planned instances × weight) × 100%.
FR‑061: Lag tracking supports numeric metrics with weekly snapshots, charts vs target, and % attainment.
FR‑062: Thresholds configurable; default alerts when weekly lead score < 60%.
4.8 AI Agent (Primary Interface)

**FR‑070: Agent Presence & Accessibility**
- Persistent agent interface across all pages (right-side panel, collapsible, keyboard shortcuts)
- Agent available via natural language in any input field with "@agent" trigger
- Mobile-responsive agent chat with voice input support (future)
- Agent onboarding: introduces capabilities and guides first-time users through planning

**FR‑071: Agent Query Capabilities (Comprehensive Knowledge)**
- Answer any question about ongoing, past, or future plans: "Show João's overdue tactics", "What were our Q2 goals?", "What's planned for next month?"
- Multi-cycle analysis: "How did Team Alpha score last week vs last cycle?", "Show Maria's tactics impacting Goal X across all cycles"
- Contextual explanations: "Why is my score 67%?", "What's blocking Goal Y?", "How much time am I spending on tactic Z?"
- Historical queries: "Summarize our last 4 WPRs", "What patterns do you see in my execution?", "When did we last hit 85%+ score?"
- Predictive insights: "Will I hit my goal at this pace?", "What's my capacity for new tactics?", "Which goals are at risk?"

**FR‑072: Agent Planning & Execution Actions**
- **Planning (Conversational)**: "Help me create a cycle for Q1 focusing on customer retention", "Suggest tactics for my revenue goal", "Review my plan for feasibility"
- **Task Management**: Create/edit/assign tactics via natural language, schedule WPR, generate weekly plan draft, mark tasks complete with notes
- **Adjustments**: "Defer tactic X to next week", "Increase weight of tactic Y to 0.8", "Reassign this to Paula", "Break this tactic into smaller pieces"
- **Analysis Triggers**: "Analyze lead-lag correlation for Goal X", "Compare my execution to team average", "Identify optimization opportunities"
- All write actions require explicit confirmation with preview: "I'll create 3 tactics for Goal X: [preview]. Confirm?"

**FR‑073: Agent Intelligence & RAG**
- RAG retrieval over all authorized data: vision documents, goals, tactics, tactic instances, WPR notes, conversations, Execution Concepts Library
- Context-aware responses citing specific data: "Based on your Week 3 WPR notes..." with jump-to-source links
- Continuous learning from user interactions: adapts suggestions based on past preferences and execution patterns
- RLS-enforced retrieval: agent only accesses data user has permission to view

**FR‑074: Agent Proactive Engagement**
- Daily briefing (morning, user's timezone): "Good morning! Here's your focus for today: [prioritized tactics with context]"
- Progress check-ins: "You have 3 tactics due today. How's 'Call 5 prospects' going?" with contextual follow-ups
- Daily Mindset Tip integrated conversationally: surfaces execution concepts naturally in relevant contexts, no duplicates in 30 days
- Risk alerts: "Your score is trending down. Want to review what's slipping?" with drill-down support
- Celebration: "Great job! You hit 90% this week—your best yet. What's working well?"

**FR‑075: Agent Conversation Management**
- Conversation history stored per user with search and replay capabilities
- Context window management: maintains relevant information across sessions
- Conversation branching: "Let's focus on Goal X" creates sub-thread
- Export conversations as markdown or PDF for documentation
- Sensitive actions logged to audit trail with user confirmation timestamps

**FR‑076: Agent Administration & Safety**
- Org-level agent capability toggles: planning, execution, analysis, data export
- Rate limiting per user/org on agent tool calls to prevent abuse
- Agent action audit trail: all tool calls logged with input/output and user confirmation
- Fallback to traditional UI if agent unavailable or user preference
- Agent feedback loop: thumbs up/down on responses for continuous improvement
4.9 Notifications & Emails

FR‑080: Email notification when a user’s weekly lead score < 60% (configurable threshold).
FR‑081: Daily digest email with today’s due items and week outlook (opt‑in).
FR‑082: WPR reminders to participants (time configurable).
FR‑083: Manager rollup email of team scores and risks.
FR‑084: Notification preferences per user (email, frequency); future channels: Slack/Teams.
4.10 Analytics & Reporting

FR‑090: Dashboards for: weekly lead score trend, lag vs target, goal attainment, completion velocity, on‑time vs deferred, by team and individual.
FR‑091: Correlation views between lead and lag over cycles; drill‑down by goal/tactic.
FR‑092: Cohort view across multiple 12-week cycles for historical analysis.
FR‑093: Export CSV/PDF for selected reports.
FR‑094: Agent can generate narrative insights and highlight anomalies.
4.11 Collaboration & Comments

FR‑100: Comments on goals, tactics, and WPR notes with mentions (@user).
FR‑101: Activity feed per entity.
FR‑102: File attachments stored in Supabase Storage with access controls.
4.12 Search & Filters

FR‑110: Full‑text search across goals, tactics, notes; filters by owner, team, status, cycle, due window.
FR‑111: Saved views per user/team.
4.13 Audit, History & Data Retention

FR‑120: Append‑only Audit Log for create/update/delete and agent actions.
FR‑121: Versioned entities (Vision, Goals, Tactics, WPR notes).
FR‑122: Retain history indefinitely by default; org‑level retention policy configurable.

### 4.14 Agent Collaboration & Orchestration

#### 4.14.1 Multi-Agent Coordination

**FR-135: Agent Role Definition**
- **Primary Agent (Execute Core)**: Built-in agent providing planning guidance, progress tracking, and analytics
- **External Task Agents**: Specialized agents registered via MCP for tactical execution (e.g., email outreach, data analysis, content creation)
- **Coordinating Agent**: Optional orchestration layer managing work distribution across agent fleet

**FR-136: Agent Discovery & Registration**
- External agents register capabilities via MCP endpoint with:
  - Agent identifier and type
  - Supported task categories (e.g., "email_outreach", "data_analysis", "content_writing")
  - Capacity limits (concurrent tasks, rate limits)
  - SLA commitments (response time, success rate)
- Execute maintains registry of available agents per org
- Agents can be enabled/disabled per team with role-based access

**FR-137: Task Delegation Protocol**
- Primary agent identifies tactics suitable for delegation based on:
  - Task type matching agent capabilities
  - Workload complexity requiring specialized skills
  - User preference for automated vs manual execution
- Delegation flow:
  1. Primary agent analyzes tactic requirements
  2. Queries agent registry for capable external agents
  3. Proposes delegation to user with agent recommendation
  4. Upon confirmation, creates delegation record and notifies external agent via MCP
  5. Monitors progress and escalates on timeout/failure

**FR-138: Shared Context & Memory**
- All agents access unified context via MCP Query Server:
  - Current cycle goals and progress
  - Related tactics and their status
  - Historical patterns and insights
  - User preferences and constraints
- Context automatically filtered by RLS policies
- Agents contribute observations back to shared context:
  - Task completion details and outcomes
  - Blockers encountered and resolutions
  - Recommendations for future cycles

**FR-139: Agent Communication Channels**
- **Direct MCP Calls**: External agents invoke Execute's MCP endpoints
- **Webhooks**: Execute notifies external agents of plan changes, new tasks, or urgent updates
- **Shared Event Stream**: Realtime updates broadcast via Supabase Realtime for collaborative awareness
- **Agent-to-Agent Messaging**: External agents can request information from each other via Execute's message broker

#### 4.14.2 Collaborative Execution Patterns

**FR-140: Parallel Execution**
- Multiple external agents work on different tactics simultaneously
- Execute tracks dependencies and prevents conflicts
- Example: Content agent drafts blog post while outreach agent schedules distribution

**FR-141: Sequential Handoffs**
- Tactics requiring multiple steps handed off between agents
- Each agent updates status and provides context for next step
- Example: Research agent gathers data → Analysis agent processes → Report agent formats output

**FR-142: Human-in-the-Loop Approval**
- Critical decisions or high-risk actions require human confirmation
- Agents propose actions with rationale; user approves/rejects/modifies
- Approval history tracked in audit log

**FR-143: Conflict Resolution**
- When multiple agents propose conflicting actions:
  1. Execute detects conflict via dependency analysis
  2. Primary agent surfaces conflict to user with agent recommendations
  3. User makes final decision; agents notified of resolution
- Automated resolution for low-risk conflicts based on configured rules

#### 4.14.3 Agent Performance & Observability

**FR-144: Agent Metrics Dashboard**
- Per-agent statistics:
  - Tasks completed vs assigned
  - Average completion time
  - Success rate
  - User satisfaction ratings
- Team-level view of agent fleet effectiveness
- Manager can enable/disable underperforming agents

**FR-145: Agent Audit Trail**
- All agent actions logged with:
  - Agent identifier and source system
  - Action type and parameters
  - Timestamp and duration
  - Result and any errors
- Searchable via agent name, task type, date range
- Supports compliance and debugging

**FR-146: Agent Health Monitoring**
- Execute pings registered agents periodically to verify availability
- Automatic failover if agent becomes unresponsive
- Alerts to managers when critical agents offline
- Agent status indicator in UI (online/offline/degraded)

#### 4.14.4 Security & Access Control

**FR-147: Agent Permission Scoping**
- Each external agent granted specific permissions:
  - Read-only access to assigned tactics
  - Write access to status updates and completion records
  - No access to other teams' data (RLS enforced)
- Permissions reviewed quarterly; auto-revoked on inactivity

**FR-148: Agent Action Validation**
- All agent-initiated updates validated against business rules:
  - Cannot mark tactics complete without evidence
  - Cannot reassign tasks without proper role
  - Cannot modify historical records
- Invalid actions rejected with error codes and explanations

**FR-149: Agent Sandboxing**
- External agents cannot directly access database
- All interactions mediated through MCP API layer
- Rate limiting prevents abuse or runaway agents
- Circuit breakers halt misbehaving agents automatically

#### 4.14.5 Continuous Improvement & Feedback Loops

**FR-150: Agent Learning System**
- Capture execution outcome data for each agent-completed tactic:
  - Completion time vs estimate
  - Quality rating (user feedback 1-5 stars)
  - Issues encountered and resolutions
  - Resource consumption (API calls, costs)
- Aggregate performance patterns per agent type and task category
- Primary agent uses historical data to:
  - Improve delegation recommendations (suggest agents with better track records)
  - Adjust time estimates based on actual performance
  - Identify agents needing retraining or replacement

**FR-151: Plan Effectiveness Analysis**
- After cycle completion, system analyzes:
  - Which tactics contributed most to goal achievement (correlation analysis)
  - Execution patterns that predict success (e.g., early week completion vs last-minute)
  - Tactics consistently deferred/skipped (candidates for removal)
- Primary agent presents insights: "Goals with daily tactics had 40% higher success rate"
- Recommendations flow into next cycle planning

**FR-152: Retrospective Automation**
- WPR includes lightweight retrospective prompts:
  - "What worked well this week?"
  - "What blocked progress?"
  - "What should we change?"
- Responses tagged and analyzed over time
- Primary agent surfaces recurring themes: "Team mentions 'unclear requirements' in 6/12 weeks"

**FR-153: Adaptive Scoring & Thresholds**
- System learns team-specific success patterns
- Adjusts "healthy" score thresholds based on historical achievement
- Example: If team consistently achieves goals at 70% lead score, adjust threshold from 85% to 70%
- Prevents alert fatigue while maintaining accountability

**FR-154: Agent Capability Evolution**
- External agents report capability updates via MCP
- System tracks agent version history
- Primary agent tests new agent capabilities in sandbox before production use
- Gradual rollout: new agents get low-priority tasks first to build trust

**FR-155: Feedback Loop Dashboard**
- Visualizations showing improvement trends over cycles:
  - Lead score progression
  - Goal achievement rates
  - Agent performance improvements
  - Most impactful tactics
- Managers identify high-leverage improvements
- Export insights for strategic planning

#### 4.14.6 Agent Marketplace & Discovery

**FR-156: Agent Marketplace**
- Curated marketplace of pre-built specialized agents available for integration
- Categories: Email Outreach, Social Media, Content Creation, Data Analysis, Code Deployment, Research, Design, Customer Support
- Each agent listing includes:
  - Capability description and use cases
  - Pricing model (per task, subscription, usage-based)
  - Performance metrics (average ratings, completion rate)
  - Sample outputs and demo mode
  - Required permissions and data access

**FR-157: One-Click Agent Installation**
- Browse marketplace within Execute interface
- Preview agent capabilities and pricing
- One-click installation with automatic MCP configuration
- Guided setup wizard for agent-specific settings (API keys, preferences)
- Trial period or sandbox mode to test before committing

**FR-158: Agent Reviews & Ratings**
- Users rate agents after task completion (1-5 stars)
- Qualitative feedback: "What worked well?", "Issues encountered?"
- Aggregate ratings visible in marketplace
- Featured/verified badge for high-quality agents
- Report issues or request features for specific agents

**FR-159: Custom Agent Registration**
- Organizations can register proprietary/custom agents
- Private agents visible only within org
- Custom agent validation and security review process
- Documentation generator for custom agent capabilities

#### 4.14.7 Cost Management for Agent Fleet

**FR-160: Agent Cost Tracking**
- Track costs per external agent invocation:
  - API calls made
  - Tokens consumed (for LLM-based agents)
  - Third-party service costs
  - Execution time
- Agents report costs via MCP on task completion
- Historical cost data per agent type and task category

**FR-161: Budget Allocation & Limits**
- Set monthly/cycle budgets per:
  - Organization (total agent spend)
  - Team (team-level budget)
  - Goal (budget allocated to achieving specific goal)
  - Agent type (limit spend on specific agent categories)
- Hard limits (block after threshold) or soft limits (alert only)
- Budget rollover or reset policy configurable

**FR-162: Cost Attribution**
- Attribute agent costs to:
  - Specific tactics and goals
  - Teams and individuals
  - Cycles (see total investment per cycle)
- Cost vs outcome analysis: ROI per goal (cost to achieve vs value delivered)
- Identify high-cost tactics with low contribution to goals

**FR-163: Cost Alerts & Reporting**
- Real-time alerts when approaching budget thresholds (80%, 95%, 100%)
- Weekly/monthly cost summary emails to managers and owners
- Cost dashboard showing:
  - Spend trends over time
  - Top cost-driving agents and tactics
  - Budget utilization per team/goal
  - Cost efficiency metrics (cost per completed tactic)
- Export cost reports for accounting/finance

**FR-164: Cost Optimization Recommendations**
- Primary agent analyzes cost patterns and suggests optimizations:
  - "Agent X costs 3× more than Agent Y with similar results—consider switching"
  - "Tactic Z consumes 40% of budget but contributes 10% to goal—revise or remove"
  - "Scheduling tasks during off-peak hours could save 25%"
- Simulate cost impact of plan changes before committing

#### 4.14.8 Agent Composition & Workflow Orchestration

**FR-165: Visual Workflow Builder**
- Drag-and-drop interface for designing multi-agent workflows
- Node types:
  - Agent Task (assign work to specific agent)
  - Decision Point (conditional branching based on outcomes)
  - Human Approval (require user confirmation before proceeding)
  - Parallel Fork/Join (execute multiple agents simultaneously)
  - Loop (repeat steps until condition met)
  - Webhook/API Call (integrate external systems)

**FR-166: Workflow Templates**
- Pre-built workflow templates for common patterns:
  - "Content Marketing Pipeline": Research → Write → Edit → Publish → Promote
  - "Sales Outreach": Prospect Research → Email Draft → Follow-up Sequence
  - "Product Launch": Design → Development → QA → Deploy → Announce
  - "Data Pipeline": Extract → Transform → Analyze → Report
- Users customize templates or build from scratch
- Save custom workflows as team templates

**FR-167: Workflow Execution Engine**
- Execute workflows as scheduled or triggered by events
- Track execution state: current step, completed steps, pending approvals
- Automatic retry on transient failures with exponential backoff
- Failure handling: rollback, skip, or escalate to human
- Execution logs with timing, inputs/outputs, and agent responses

**FR-168: Workflow Monitoring & Debugging**
- Real-time workflow execution visualization
- Inspect data passed between agents at each step
- Pause/resume/cancel running workflows
- Debug mode: step through workflow manually, inspect intermediate results
- Performance metrics: total execution time, bottleneck identification

**FR-169: Workflow Version Control**
- Save workflow versions with change history
- Compare versions to see modifications
- Roll back to previous workflow version if needed
- Test new workflow versions in sandbox before production
- A/B test different workflow designs to optimize outcomes

4.15 Import/Export & Integrations

FR‑130: Import goals/tactics from CSV; map columns.
FR‑131: ICS calendar integration (read‑only feed).
FR‑132: OAuth sign‑in (Google, Microsoft) for convenience.
FR‑133: Webhooks (future) for external automations.

### 4.16 Billing & Monetization (Stripe Integration)

#### 4.16.1 Payment Processing

**FR‑170: Stripe Integration**
- Integrate Stripe for all payment processing
- Support multiple payment methods: credit/debit cards, digital wallets (Apple Pay, Google Pay), ACH, SEPA
- PCI compliance handled by Stripe (no card data stored in Execute database)
- Multi-currency support for international users
- Automatic currency conversion at checkout

**FR‑171: Subscription Plans**
- Tiered pricing model:
  - **Free Plan**: 1 user, 1 active cycle, basic agent features, limited to 50 tactics/cycle
  - **Pro Plan**: Up to 10 users, unlimited cycles, full agent features, priority support ($29/user/month)
  - **Team Plan**: Up to 50 users, agent marketplace access, custom workflows, dedicated support ($49/user/month)
  - **Enterprise Plan**: Unlimited users, SSO, custom agents, SLA, dedicated account manager (custom pricing)
- Annual billing option with 20% discount
- Monthly and annual billing cycles supported
- Automatic proration on plan upgrades/downgrades

**FR‑172: Stripe Checkout Integration**
- Hosted Stripe Checkout for secure payment collection
- Customizable checkout flow with Execute branding
- Redirect back to Execute after successful payment
- Support for coupon codes and promotional discounts
- Tax calculation via Stripe Tax (automatic sales tax/VAT)

**FR‑173: Payment Method Management**
- Users can add/update/remove payment methods in account settings
- Support multiple payment methods per org
- Set default payment method
- Card expiration notifications 30 days before expiry
- Failed payment retry logic (3 attempts over 7 days)

**FR‑174: Invoice & Receipt Generation**
- Automatic invoice generation via Stripe Billing
- PDF invoices emailed to billing contact
- Invoice history accessible in org settings
- Itemized billing with usage breakdowns
- Support for custom billing information (company name, VAT number, address)

#### 4.16.2 Credits System

**FR‑175: Credits Purchase & Management**
- Users can purchase credits in packages:
  - **Starter Pack**: 100 credits for $10 ($0.10/credit)
  - **Value Pack**: 500 credits for $40 ($0.08/credit)
  - **Pro Pack**: 1,000 credits for $70 ($0.07/credit)
  - **Enterprise Pack**: 5,000 credits for $300 ($0.06/credit)
- Credits purchased via Stripe Checkout
- Credits never expire (except for promotional credits which may have expiration dates)
- Credits are org-level (shared across all users in org)
- Purchase history visible in billing dashboard

**FR‑176: Credit Usage Tracking**
- Credits consumed for premium features:
  - Agent marketplace agent executions (1-50 credits per task depending on agent)
  - AI-powered analytics and insights (5 credits per report)
  - Advanced workflow executions (10-100 credits per workflow run)
  - Bulk imports/exports (5 credits per operation)
  - Custom agent API calls (pricing set by agent provider)
- Real-time credit balance display in UI
- Low balance warnings at 20%, 10%, and 5% remaining
- Usage history with timestamps, feature used, credits consumed

**FR‑177: Credit Allocation & Budgets**
- Org owners can allocate credit budgets per team
- Set monthly/cycle credit limits per team to prevent overspend
- Teams see their allocated budget and consumption
- Notifications when team approaches budget limit (80%, 100%)
- Unused team budgets return to org pool at end of period

**FR‑178: Auto-Reload Credits**
- Optional auto-reload when balance drops below threshold
- Configure: threshold amount (e.g., 50 credits) and reload package
- One-time or recurring auto-reload
- Email confirmation after each auto-reload
- Can disable auto-reload anytime

**FR‑179: Promotional Credits**
- System can grant promotional credits for:
  - New user onboarding bonus (50 credits)
  - Referral rewards (100 credits per successful referral)
  - Seasonal promotions and campaigns
- Promotional credits may have expiration dates
- Promotional credits used before purchased credits
- Track promotional credit source for analytics

#### 4.16.3 Subscription Management

**FR‑180: Self-Service Subscription Changes**
- Users can upgrade/downgrade plans via settings
- Immediate upgrade (prorated billing)
- Downgrade takes effect at next billing cycle
- Preview of cost changes before confirming
- Cancel subscription with data retention for 30 days

**FR‑181: Usage-Based Billing**
- Optional usage-based add-ons:
  - Extra storage beyond plan limits ($0.10/GB/month)
  - Additional external agent executions beyond quota ($0.05 per execution)
  - Premium support hours ($150/hour)
- Usage tracked in real-time
- Usage charges added to monthly invoice
- Set spending caps to prevent bill shock

**FR‑182: Stripe Webhooks**
- Handle Stripe webhook events:
  - `checkout.session.completed`: Activate subscription or credit purchase
  - `invoice.payment_succeeded`: Record successful payment
  - `invoice.payment_failed`: Notify user, retry payment
  - `customer.subscription.updated`: Sync subscription changes
  - `customer.subscription.deleted`: Handle cancellation
  - `payment_method.attached`: Update payment method on file
- Webhook signature verification for security
- Idempotent webhook processing (handle duplicate events)
- Webhook event log for debugging and auditing

**FR‑183: Trial Period Management**
- 14-day free trial for Pro and Team plans
- No credit card required for trial start
- Trial conversion prompts 7 days and 1 day before expiry
- Automatic conversion to Free plan if no payment method added
- Trial features include full plan access

**FR‑184: Billing Portal Integration**
- Embed Stripe Customer Portal for:
  - View/download invoices
  - Update payment methods
  - Change subscription plan
  - View payment history
  - Update billing information
- Single sign-on from Execute to Stripe portal
- Return URL back to Execute after portal actions

#### 4.16.4 Revenue Analytics & Reporting

**FR‑185: Revenue Dashboard**
- Admin-only revenue analytics:
  - Monthly Recurring Revenue (MRR)
  - Annual Recurring Revenue (ARR)
  - Churn rate and retention metrics
  - Average Revenue Per User (ARPU)
  - Credit purchase trends
- Filterable by plan type, date range, region
- Export revenue reports for accounting

**FR‑186: Failed Payment Recovery**
- Automated dunning sequence for failed payments:
  - Day 1: Email notification with retry link
  - Day 3: Second reminder with payment update prompt
  - Day 7: Final notice before subscription suspension
- Pause subscription after 7 days of failed payment
- Grace period: read-only access for 30 days
- Account deletion after 60 days of non-payment (with data export option)

### 4.17 MCP Server Integration (External Agent Access)

**FR‑140: MCP Server Architecture**
- Core features exposed via Model Context Protocol servers for external AI agent consumption
- Enables agent orchestration: Execute provides strategic planning while specialized agents execute tactical work
- Supports building "agent fleets" where Execute coordinates high-level goals and external agents handle task execution

**FR‑141: MCP Planning Server**
- Endpoints: `create_cycle`, `define_goal`, `add_tactic`, `get_plan`, `update_vision`
- External agents can create and modify planning artifacts respecting RLS policies
- Returns structured data (JSON) with validation errors and success confirmations

**FR‑142: MCP Execution Server**
- Endpoints: `list_due_items`, `mark_complete`, `defer_task`, `get_progress`, `update_status`
- Enables external task-execution agents to report progress and completion
- Supports batch operations for high-frequency updates

**FR‑143: MCP Analytics Server**
- Endpoints: `compute_scores`, `get_trends`, `analyze_correlation`, `generate_insights`
- Provides read-only access to historical data and computed metrics
- Returns time-series data, aggregations, and predictive analytics

**FR‑144: MCP Query Server**
- Endpoints: `search_tactics`, `get_history`, `compare_cycles`, `find_blockers`
- Natural language query support: external agents can ask questions about plans/progress
- Returns contextualized results with RLS filtering

**FR‑145: MCP Authentication & Security**
- API key authentication with scoped permissions (read, write, admin) per org/team
- Rate limiting: 1000 requests/hour per API key (configurable)
- Audit logging: all MCP requests logged with source agent identifier
- Token rotation policy: keys expire after 90 days; notification sent 7 days before expiry

**FR‑146: MCP Discovery & Documentation**
- Auto-generated OpenAPI/JSON Schema documentation for all MCP endpoints
- Interactive API explorer for testing and development
- SDKs/client libraries (TypeScript, Python) for common agent frameworks
- Webhook notifications for plan changes (opt-in per external agent)

5. Non‑Functional Requirements (NFR)
   5.1 Security & Privacy

NFR‑S01: Enforce Supabase RLS on all tables; unit tests for policies.
NFR‑S02: Encrypt in transit (TLS) and at rest (Supabase defaults).
NFR‑S03: Store minimal PII; comply with LGPD (Brazil) and GDPR baseline: purpose limitation, data minimization, deletion on request.
NFR‑S04: Role‑based access control; principle of least privilege for service keys and MCP API keys.
NFR‑S05: Audit trail for administrative, agent actions, and MCP requests.
NFR‑S06: Enterprise SSO security: support SAML assertions, encrypted assertions, signed requests.
NFR‑S07: MCP API key encryption at rest; never log full keys in audit trails (hash only).
NFR‑S08: Separate database user/permissions for MCP servers with restricted schema access.
5.2 Performance & Scalability

NFR‑P01: p95 page load < 2.5s on broadband; p95 agent response < 6s for common queries.
NFR‑P02: Support 500 active users per org and 50 concurrent users per team in v1.
NFR‑P03: Background jobs must complete within 5 minutes of schedule (daily tips, emails).
NFR‑P04: MCP API endpoints respond within 200ms (p95) for read operations, 500ms for write operations.
NFR‑P05: Support 10,000 MCP requests/hour across all tenants; auto-scaling for MCP servers.
NFR‑P06: MCP batch operations handle up to 100 items per request with streaming responses.
5.3 Reliability & Backups

NFR‑R01: Daily automated backups retained for 30 days; point‑in‑time recovery enabled.
NFR‑R02: Error budgets and alerting for failed jobs/emails.
5.4 Usability & Accessibility

NFR‑U01: Responsive design (desktop first, tablet/mobile supported).
NFR‑U02: WCAG 2.2 AA compliance for colors, contrast, keyboard nav, and ARIA.
NFR‑U03: Onboarding walkthrough for first cycle creation and first WPR.
5.5 Internationalization (i18n)

NFR‑I01: English and Portuguese (pt‑BR) locales in v1; user‑level locale setting.
NFR‑I02: Date/time and week start respect user timezone/locale.
5.6 Observability

NFR‑O01: Structured logging for server actions and agent tool calls.
NFR‑O02: Metrics: job run counts, email send failures, agent action success rate.

6. Data Model (Core Entities)
   Organizations & Access

organizations(id, name, created_by, created_at)
users(id, email, name, locale, timezone, …) (Supabase auth users)
org_members(user_id, org_id, role)
teams(id, org_id, name)
team_members(user_id, team_id, role)
Planning & Execution

cycles(id, org_id, team_id?, owner_user_id?, start_date, end_date, status)
visions(id, org_id, team_id?, user_id?, content_md, version, created_at)
goals(id, cycle_id, title, owner_user_id?, team_id?, unit, baseline, target, target_date, status)
goal_versions(goal_id, version, changed_by, diff, changed_at)
tactics(id, goal_id, title, description, weight, recurrence, due_days, assignee_user_id, status)
tactic_versions(tactic_id, version, changed_by, diff, changed_at)
tactic_instances(id, tactic_id, week_start, due_date, planned, status, completed_at, notes)
weekly_plans(id, cycle_id, week_start, owner_user_id?, team_id?)
weekly_plan_items(id, weekly_plan_id, tactic_instance_id, planned_weight_override?)
lag_entries(id, goal_id, week_start, value, note)
Meetings & Collaboration

WPRs(id, cycle_id, week_start, facilitator_id, notes_md, decisions_md, lead_score, lag_summary, created_at)
WPR_attendance(WPR_id, user_id, status)
comments(id, entity_type, entity_id, author_id, content_md, created_at)
attachments(id, entity_type, entity_id, storage_path, uploaded_by, created_at)
AI & Knowledge

concepts(id, locale, title, content_md, tags)
concept_served_log(user_id, concept_id, served_on)
agent_sessions(id, user_id, created_at)
agent_messages(id, session_id, role, content, created_at)
embeddings(id, org_id, entity_type, entity_id, vector) (pgvector)
Notifications & Audit

notifications(id, user_id, type, payload_json, status, sent_at)
audit_log(id, org_id, actor_user_id, action, entity_type, entity_id, before, after, created_at, source_type, source_identifier)

MCP Integration & Enterprise Auth

mcp_api_keys(id, org_id, name, key_hash, scopes, created_by, expires_at, last_used_at, revoked_at)
mcp_request_log(id, api_key_id, endpoint, method, status_code, response_time_ms, created_at)
external_agents(id, org_id, name, agent_type, mcp_api_key_id, capabilities, config_json, status)
saml_configs(id, org_id, provider, entity_id, sso_url, certificate, attribute_mapping_json, enabled)
sso_sessions(id, user_id, org_id, provider, saml_session_id, created_at, expires_at)

Billing & Payments (Stripe Integration)

stripe_customers(id, org_id, stripe_customer_id, email, created_at)
subscriptions(id, org_id, stripe_subscription_id, plan_type, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
payment_methods(id, org_id, stripe_payment_method_id, type, last4, exp_month, exp_year, is_default, created_at)
invoices(id, org_id, stripe_invoice_id, amount_cents, currency, status, invoice_pdf_url, paid_at, created_at)
credits(id, org_id, balance, total_purchased, total_consumed, created_at, updated_at)
credit_transactions(id, org_id, type, amount, description, related_entity_type, related_entity_id, balance_after, created_at)
credit_budgets(id, org_id, team_id?, allocated_amount, consumed_amount, period_start, period_end, created_at)
stripe_events(id, org_id, stripe_event_id, event_type, payload_json, processed_at, created_at)

RLS: Every table carrying org/team scoped data includes org_id (and optional team_id) with policies restricting access to members. MCP requests authenticated via api_key_id with scope-based filtering. Billing tables enforce owner-only access for sensitive payment data.

7. APIs & Integrations (Representative)

**Auth:**
- Supabase Auth (email/password, OAuth: Google, Microsoft, GitHub)
- SAML 2.0 SSO: POST /auth/saml/login, POST /auth/saml/acs (assertion consumer service)
- JIT provisioning on first SSO login

**REST/RPC (Web App):**
- POST /api/cycles → create cycle
- POST /api/goals → create goal for cycle
- POST /api/tactics → create tactic and generate instances
- POST /api/WPR/:cycleId/:weekStart/close → compute lead score, finalize WPR
- GET /api/due?date=YYYY‑MM‑DD&scope=user|team → due items for day/week
- POST /api/agent/actions/* → controlled tool endpoints for internal agent

**MCP Server Endpoints (External Agents):**
- Planning: POST /mcp/planning/cycle, POST /mcp/planning/goal, POST /mcp/planning/tactic
- Execution: GET /mcp/execution/due, POST /mcp/execution/complete, POST /mcp/execution/defer
- Analytics: GET /mcp/analytics/scores, GET /mcp/analytics/trends, POST /mcp/analytics/insights
- Query: POST /mcp/query/search, POST /mcp/query/history, POST /mcp/query/compare
- Management: GET /mcp/keys, POST /mcp/keys, DELETE /mcp/keys/:id
- All MCP endpoints require `Authorization: Bearer <API_KEY>` header

**Scheduled Jobs:**
- Daily 07:30 (team timezone): serve Mindset Tip (in‑app + optional email)
Monday 07:30: build weekly plans, compute prior week scores, send alerts for < threshold.
WPR reminders 24h and 1h before meeting time.

---

## 8. Lead/Lag Calculation Methodology

### 8.1 Weekly Lead Score Formula

```
Weekly Lead Score = (Completed Numerator / Planned Denominator) × 100%

Where:
  Planned Denominator = Σ (weights of all planned tactic instances for the week)
  Completed Numerator = Σ (weights of planned instances marked Done within the week)
```

**Example Calculation:**
```
Week 3 Planned Tactics:
- Tactic A: weight 0.5, status = Done     → contributes 0.5
- Tactic B: weight 0.3, status = Done     → contributes 0.3
- Tactic C: weight 0.4, status = Deferred → contributes 0.0
- Tactic D: weight 0.2, status = Skipped  → contributes 0.0

Lead Score = (0.5 + 0.3) / (0.5 + 0.3 + 0.4 + 0.2) × 100%
           = 0.8 / 1.4 × 100%
           = 57.1%
```

### 8.2 Edge Cases & Special Handling

| Scenario | Handling | Rationale |
|----------|----------|-----------|
| **No Planned Instances** | Score = 100% (configurable) | Avoid penalizing non-planning weeks (e.g., holidays, recovery weeks) |
| **Deferred Instances** | Move to next week's plan; remain in original week's denominator | Tracks accountability; prevents score manipulation by deferring |
| **Skipped Instances** | Counted as not completed unless manager override | Requires explicit decision and audit trail |
| **Partial Week** | Pro-rate denominator by days active | Handle mid-cycle starts or team member absences |

### 8.3 Lag Indicator Tracking

- **Data Type**: Numeric time series (e.g., revenue, NPS, conversion rate)
- **Frequency**: Weekly manual entry or automated import
- **Visualization**: Line charts with target lines and variance bands
- **Analysis**: Correlation with lead scores; trend detection; goal attainment projection

---

## 9. UX Journeys (Happy Paths)
### 9.1 Create a 12-Week Plan (Agent-First Conversational Flow)

**Agent-Guided Planning (Primary):**
User: "Help me plan my next 12-week cycle"
Agent: "Great! Let's start with your vision. What are your long-term goals for the next 1-3 years?"
User describes vision; agent structures and reflects back for confirmation.
Agent: "Based on your vision, I suggest 3 focus areas for the next 12 weeks: [suggestions]. Which resonate?"
User selects/refines goals; agent helps set SMART targets and metrics.
Agent: "For 'Increase revenue by 20%', here are 5 proven tactics with suggested weights. Want to use these or customize?"
User approves/adjusts; agent reviews workload: "This looks achievable—about 12h/week commitment. Proceed?"
Agent creates cycle, goals, tactics with confirmation; generates first week plan preview.

**Traditional Form-Based (Alternative):**
Click "New Cycle" → Wizard: dates → vision editor → goal forms → tactic forms → preview → confirm.
Agent provides inline suggestions and validation throughout forms.
### 9.2 Weekly Progress Review (Agent-Facilitated)

#### Agent-Powered WPR (Primary Workflow)

**1. Pre-Meeting Preparation**
- Agent analyzes prior week's data and sends briefing:
  > "Last week: 75% lead score (down from 82%). Revenue at $45K/$50K target. 3 tactics slipped—let's discuss."

**2. During Meeting**
- Agent presents structured agenda
- Surfaces relevant data on demand
- Example interaction:
  - **User:** "What were our misses?"
  - **Agent:** "2 client calls deferred (capacity issue), 1 proposal skipped (legal blocker). Shall I suggest reassignments?"
  
**3. Decision Capture**
- Agent logs decisions in real-time:
  > "Reassigning 'Proposal X' to Maria, deferring 'Call Y' to Week 5—noted."

**4. Next Week Planning**
- Agent generates plan based on priorities and capacity:
  > "Based on your capacity and goals, here's Week 4: [tactics list]. Want to adjust?"

**5. Post-Meeting**
- Agent finalizes notes and emails summary with action items to all participants

#### Traditional WPR UI (Alternative Workflow)

1. Open WPR page
2. Review auto-computed lead scores
3. Enter/update lag indicator values
4. Discuss and reassign missed/at-risk items
5. Edit next week's plan (pre-populated)
6. Save notes and decisions
7. Finalize meeting → triggers email summary

**Note:** Agent sidebar available throughout traditional workflow for real-time insights and suggestions.

### 9.3 Daily Focus (Agent-First Morning Briefing)

#### Agent Proactive Engagement (Primary Workflow)

**Morning Briefing (7:30 AM, user's timezone)**
- Agent sends notification:
  > "Good morning! Today's focus: [3 prioritized tactics]. High priority: 'Client demo prep' (2h, due 2 PM)."

**On-Demand Details**
- **User:** "Show me today's full list"
- **Agent:** Displays all tactics grouped by goal with context

**Natural Language Completion**
- **User:** "Mark 'Client demo prep' done, went well, client loved the new feature"
- **Agent:** "Great! This completes Goal X's weekly target early. Want to pull forward a tactic from next week?"

**Proactive Check-ins Throughout Day**
- Agent monitors progress: 
  > "How's 'Proposal draft' going? You have 3h left today."

#### Traditional Dashboard (Alternative Workflow)

1. Visit **Today** view
2. See due items with priority indicators
3. Mark tasks complete with inline actions
4. Add notes and time spent
5. Agent help button available for any task

### 9.4 Expanded Agent Conversation Examples

#### Planning & Execution

- "Help me create a goal to improve customer retention by 15% over 12 weeks"
- "Create a tactic 'Call 5 churn‑risk clients' for Goal 'Retention', weekdays, weight 0.2, assign to Paula"
- "I'm overwhelmed—which tactics can I defer without impacting my goals?"
- "Break 'Launch new product feature' into smaller, weekly milestones"

#### Analysis & Insights

- "What are André's overdue items for this week?"
- "Why is my score lower this week compared to last?"
- "Show me which goals have the best lead-lag correlation across all my cycles"
- "Predict if I'll hit my Q1 revenue goal at this pace"
- "What patterns do you see in Team Alpha's execution over the last 4 cycles?"

#### Historical & Comparative

- "Summarize our last WPR and propose top 3 focus tactics for this week"
- "How did my Q3 cycle compare to Q2 in terms of completion rate?"
- "What were Maria's tactics impacting 'Customer Satisfaction' goal in the previous cycle?"
- "Show me all tactics we've ever created related to product development"

#### Collaborative & Team Management

- "Who on my team has capacity to take on a new tactic this week?"
- "Compare Team Alpha and Team Beta's lead scores for the current cycle"
- "What's blocking João from completing his tactics on time?"
- "Schedule a WPR for Team Alpha next Monday at 10 AM with agenda focused on Goal X"

#### Multi-Agent Coordination

- "Delegate the 'Content creation' tactic to the writing agent"
- "Which external agents are available to help with outreach tasks?"
- "Show me the status of all tasks delegated to external agents this week"
- "The email agent completed 15 outreach tasks—analyze the results"

---

## 10. UI & Design System

### 10.1 Design Framework

| Component | Specification |
|-----------|--------------|
| **Component Library** | Material UI (MUI) with customization |
| **Themes** | Light/dark mode with per-org branding |
| **Color Palette** | Brandable primary/secondary colors |
| **Typography** | Responsive scale with accessibility compliance |
| **Icons** | Material Icons + custom agent indicators |

### 10.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                          │
│  [Logo] [Cycle Selector] [Notifications] [Profile]         │
└─────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────┬──────────────┐
│              │                              │              │
│  Left Nav    │   Main Content Area          │   Agent      │
│              │                              │   Panel      │
│  • Dashboard │   [Data viz, forms, tables]  │   (Primary)  │
│  • Today     │                              │              │
│  • Week      │   Agent can navigate or      │   💬 Chat    │
│  • Cycles    │   display content here       │   🔧 Tools   │
│  • Goals     │                              │   📊 Context │
│  • Tactics   │                              │   🕐 History │
│  • Vision    │                              │              │
│  • Analytics │                              │   [Cmd+K]    │
│  • Settings  │                              │              │
│              │                              │              │
└──────────────┴──────────────────────────────┴──────────────┘
```

### 10.3 Agent Panel (Primary Interface)

**Features:**
- **Persistent presence**: Always accessible via right-side panel
- **Keyboard shortcut**: Cmd/Ctrl+K to focus/toggle
- **Streaming responses**: Real-time text generation with typing indicators
- **Tool execution feedback**: Visual confirmation when agent performs actions
- **Context indicators**: Shows what data agent is referencing
- **Conversation history**: Searchable, with ability to jump to past conversations
- **Quick actions**: Suggested commands based on current context

**Agent Triggers:**
- Type `@agent` in any text field
- Click floating action button (bottom-right)
- Keyboard shortcut (Cmd/Ctrl+K)
- Proactive notifications when agent has suggestions

### 10.4 Traditional UI Components

**Navigation:**
- Left sidebar with quick access to all views
- Agent can also navigate: "Show me today's view"

**Data Display:**
- Tables with column filters, sorting, grouping
- Saved views per user/team
- Inline editing where permitted
- Agent integration: "Sort by priority", "Explain this goal"

**Forms:**
- Multi-step wizards for complex workflows
- Agent-enhanced with inline suggestions
- Validation with helpful error messages

### 10.5 Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| **Desktop (>1280px)** | Full 3-column layout (nav + content + agent) |
| **Tablet (768-1280px)** | Collapsible nav; agent panel overlay |
| **Mobile (<768px)** | Agent-first UI; traditional views via menu |

---

## 11. Security, Compliance & Data Protection

### 11.1 Data Security

| Control | Implementation |
|---------|----------------|
| **Row-Level Security** | RLS policies enforced on all tables; no direct database access |
| **Encryption** | TLS 1.3 in transit; AES-256 at rest (Supabase default) |
| **Authentication** | Multi-factor authentication supported; session timeout after 30 days |
| **API Security** | Rate limiting, CORS restrictions, API key rotation |
| **Secrets Management** | Stored in Vercel/Supabase env vars; never committed to code |

### 11.2 Privacy & Compliance

| Requirement | Status |
|-------------|--------|
| **Data Minimization** | Store only essential PII (name, email); avatars optional |
| **LGPD Compliance** | Brazilian data protection law requirements met |
| **GDPR Baseline** | Purpose limitation, data minimization, deletion on request |
| **User Rights** | Data export, deletion, access logs available via UI |
| **Audit Trail** | Immutable logs; time-synced (UTC with user timezone display) |

### 11.3 Agent Security

- **Rate Limiting**: Prevent abuse via request throttling
- **Action Confirmation**: Write operations require explicit user approval
- **Audit Logging**: All agent actions logged with user, timestamp, outcome
- **Permission Scoping**: Agent respects user's role-based permissions
- **External Agent Sandboxing**: MCP agents cannot access database directly

12. Acceptance Criteria (per Epic)
    EP‑1 Agent Core: Agent can answer any question about ongoing/past/future plans; RAG retrieval works with RLS; conversation memory persists; response time < 3s for queries.
    EP‑2 Agent Planning: Agent guides users conversationally through cycle/goal/tactic creation; suggests tactics based on goals; reviews feasibility; confirms before persisting.
    EP‑3 Agent Execution: Agent provides daily briefings; accepts task completion via natural language; tracks progress proactively; daily mindset tips integrate naturally.
    EP‑4 Agent Analysis: Agent explains score changes; identifies patterns across cycles; predicts outcomes; provides actionable recommendations; cites sources.
    EP‑5 Agent Actions: Agent can create/assign/reassign tactics via confirmed commands; schedules WPRs; generates plans; audit log captures all tool calls.
    EP‑6 Accounts & Orgs: Users can sign up, join/create orgs (agent-assisted or manual); RLS verified by tests; invite flow works.
    EP‑7 Traditional UI: Form-based wizard works as alternative; Today/Week views render correctly; WPR page functional; analytics charts display.
    EP‑8 Security: RLS tests pass for all tables; agent respects permissions; audit trail immutable; rate limiting prevents abuse.
    EP‑9 Notifications: Agent-generated emails sent for alerts and WPR summaries; daily briefings configurable.
    EP‑10 i18n & A11y: pt‑BR/EN switch; agent responds in user locale; core flows keyboard accessible; agent panel navigable via keyboard.
    EP‑11 MCP Integration: MCP servers operational for planning/execution/analytics/query; external agents can authenticate and make requests; rate limiting enforced; audit logs capture all MCP activity.
    EP‑12 Enterprise Auth: SAML SSO works with Microsoft AD, Google Workspace; JIT provisioning creates users on first login; domain-based org assignment functional.

13. Implementation Backlog (Key Tasks - Agent-First Priority)
    A. Agent Core Infrastructure (PRIORITY 1)

A1: pgvector setup + embedding pipeline for all user content (vision, goals, tactics, WPR notes, conversations).
A2: RAG retrieval system with RLS-aware filtering and context assembly.
A3: Agent tool architecture: 20+ tools for query, action, analysis.
A4: Agent chat UI (persistent panel, streaming responses, keyboard shortcuts).
A5: Conversation history and memory management.
A6: Agent context builder that assembles relevant cycles/goals/tactics/scores.

B. Agent Planning & Execution Tools (PRIORITY 2)

B1: Planning tools: create_cycle, define_goal, add_tactic, suggest_tactics, review_feasibility.
B2: Query tools: list_due, query_scores, summarize_progress, explain_status, compare_cycles, find_blockers.
B3: Action tools (confirmed): assign_tactic, defer_task, mark_complete, reschedule, update_weight.
B4: Analysis tools: analyze_correlation, predict_score, identify_risks, suggest_adjustments.
B5: Agent-guided wizard (conversational planning flow).
B6: Daily briefing generation with prioritization logic.

C. Foundations (PRIORITY 3)

C1: Supabase schema + RLS policies for multi‑tenancy.
C2: Auth flows (email + OAuth), org/team management UI (agent-assisted).
C3: MUI theme and layout shell with agent panel as primary interface.
C4: Audit log with agent action tracking.

D. Data Model & Execution Engine (PRIORITY 4)

D1: Cycle/Goal/Tactic CRUD + traditional form-based wizard (fallback).
D2: Tactic instance generator (recurrence → weekly/daily instances).
D3: Weekly plan auto‑populate + overrides.
D4: Lead score engine and edge‑case handling.

E. Agent-Enhanced WPR (PRIORITY 5)

E1: Agent WPR preparation (analysis, talking points, briefings).
E2: Agent WPR facilitation (real-time note capture, decision structuring).
E3: Traditional WPR page (agenda, notes, attendance, finalize) with agent sidebar.
E4: Agent-generated email summaries and action items.

F. Agent Proactive Features (PRIORITY 6)

F1: Daily mindset tips integrated into conversations (30‑day no‑repeat).
F2: Proactive check-ins based on due dates and progress patterns.
F3: Agent-powered alerts with personalized messages and suggestions.
F4: Daily digest and WPR reminders via agent.

G. Analytics & Reporting (PRIORITY 7)

G1: Agent narrative insights (explain variances, identify patterns, provide recommendations).
G2: Score trends, lag vs target visualization.
G3: Team/individual breakdowns with agent comparative analysis.
G4: CSV export and agent-generated reports.

H. Quality & Compliance (ONGOING)

H1: Unit/integration tests (RLS, scoring, generator, agent tool calls).
H2: Agent response quality monitoring and feedback collection.
H3: A11y checks for agent panel; i18n for agent responses (pt‑BR/EN).
H4: Backup/restore drill and data export/delete paths.
H5: Rate limiting and agent action safety guardrails.

I. MCP Server Implementation (PRIORITY 8 - Post-MVP)

I1: MCP Planning Server (Node.js/Deno): endpoints for cycle/goal/tactic CRUD with RLS enforcement.
I2: MCP Execution Server: endpoints for task status updates, progress tracking, batch operations.
I3: MCP Analytics Server: read-only access to scores, trends, correlation analysis.
I4: MCP Query Server: natural language query support with RAG retrieval.
I5: API key management system: generation, scoping, rotation, revocation.
I6: MCP request logging and rate limiting infrastructure.
I7: OpenAPI/JSON Schema documentation generation.
I8: TypeScript/Python SDKs for external agent integration.
I9: Webhook system for plan change notifications to external agents.

J. Enterprise Authentication (PRIORITY 9 - Post-MVP)

J1: SAML 2.0 implementation: SSO login, ACS endpoint, metadata generation.
J2: JIT user provisioning with configurable role mapping.
J3: Domain-based org assignment (email domain → org matching).
J4: SAML configuration UI for org admins (IdP metadata upload, attribute mapping).
J5: Multi-IdP support per org (Microsoft AD + Google Workspace simultaneously).
J6: Session management across SSO and local auth.
J7: SAML assertion validation and security hardening.

14. Risks & Mitigations

R1: Ambiguity in execution methodology interpretations → Document formulas and provide settings to tune (weights, denominator rules).
R2: Agent hallucinations → Use tool‑only for data queries/mutations; show data sources; require confirmation for writes.
R3: Timezone drift → Store UTC, display in user timezone; compute week boundaries by locale.
R4: Adoption friction → Provide onboarding wizard and templates.
R5: MCP API abuse/overload → Implement strict rate limiting, API key scoping, cost monitoring per tenant; circuit breakers for runaway agents.
R6: External agent security → Require encrypted connections (TLS 1.3+); validate all inputs; sandbox MCP server execution; separate database credentials.
R7: SAML complexity → Partner with identity providers for testing; provide detailed setup guides; support common IdP configurations out-of-box.
R8: Agent orchestration failures → Implement timeout/retry logic for MCP calls; graceful degradation if external agents unavailable; manual fallback workflows.

15. Roadmap / Release Plan
    Agent-First MVP (4–6 weeks)

**Core Agent Capabilities:**
- Agent can answer any question about ongoing/past/future plans (comprehensive RAG retrieval)
- Agent guides conversational planning (vision → goals → tactics with suggestions)
- Agent provides daily briefings and proactive check-ins
- Agent explains scores and identifies patterns
- Agent can create/assign tactics via confirmed commands
- Agent respects RLS boundaries and audits all actions

**Supporting Infrastructure:**
- Accounts, orgs/teams with multi-tenant RLS
- Data model: cycles/goals/tactics with versioning
- Tactic instance generator and lead scoring engine
- Traditional form-based wizard as fallback
- Basic Today/Week dashboard views with agent integration

v1.1 (Agent Enhancement)

- Agent WPR facilitation and preparation
- Agent predictive insights and recommendations
- Agent historical analysis across cycles
- Agent-generated reports and summaries
- CSV import/export with agent assistance
- Calendar feed integration

v1.2 (MCP & Enterprise Integration)

- MCP servers operational (Planning, Execution, Analytics, Query)
- API key management and external agent registration
- SAML SSO with Microsoft AD, Google Workspace, Okta
- JIT user provisioning and domain-based org assignment
- MCP SDK libraries (TypeScript, Python)
- Agent orchestration examples and documentation

v1.3 (Advanced Agent Features)

- Agent voice input/output (optional)
- Agent workflow automation and templates
- Agent team collaboration features
- Agent learning from user feedback
- Enhanced MCP capabilities (webhooks, streaming, batch operations)
- Slack/Teams agent bot

16. Open Questions

Should the week start be Monday for all users or respect locale setting? (Proposed: respect locale; default Monday.)
Do we need Google/Microsoft Calendar write‑back or read‑only ICS is enough for v1?
Any mandatory compliance beyond LGPD/GDPR baseline for your org?
Preferred email provider (Resend vs SendGrid) and from‑address domain?
Do you want Portuguese as default UI language?

17. Appendices
    A. Example RLS Snippet (Illustrative)

create policy "org members can read" on goals
for select using (
exists (
select 1 from org_members m
where m.org_id = goals.org_id and m.user_id = auth.uid()
)
);

B. Example Lead Score SQL (Weekly)

select week_start,
100.0 \* sum(case when status = 'Done' then weight else 0 end)
/ nullif(sum(weight), 0) as lead_score
from tactic_instances
where assignee_user_id = :user_id and cycle_id = :cycle_id
and week_start between :from and :to
and planned = true
group by week_start
order by week_start;
