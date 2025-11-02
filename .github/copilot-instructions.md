# Copilot Instructions: Execute - Agent-First 12-Week Execution Framework

## Project Overview
Execute is an agent-first, multi-tenant productivity system inspired by quarterly execution principles. The AI agent serves as the primary interface for planning 12-week cycles, tracking lead/lag indicators, running Weekly Progress Reviews (WPR), and analyzing outcomes. The agent can answer any question about ongoing, past, or future plans, guide users through planning, and execute actions via natural language commands. Traditional UI forms exist as supporting alternatives.

## Architecture & Tech Stack

### Core Stack (MVP)
- **Frontend**: Next.js (App Router) + React + Material UI, deployed on Vercel
- **Backend**: Supabase (Postgres + Auth + RLS + pgvector for AI embeddings)
- **AI**: OpenAI API for chat, function-calling, and embeddings
- **MCP Servers**: Model Context Protocol servers exposing planning/execution/analytics for external agents
- **Enterprise Auth**: SAML 2.0 SSO (Microsoft AD, Google Workspace, Okta) + JIT provisioning
- **Jobs**: Supabase Edge Functions + Scheduler for daily tips and weekly rollups
- **Email**: Resend/SendGrid for notifications and WPR digests
- **Payments**: Stripe (Checkout + Billing + Webhooks)

### Scale Infrastructure (Added Incrementally)
- **Workflow Orchestration**: Temporal for multi-agent workflows with retries, state management, and human approvals
- **Container Orchestration**: Kubernetes / Cloud Run / Fargate for MCP servers at production scale
- **Event Streaming**: Redis Streams / Kafka / managed Pub/Sub for agent-to-agent messaging and durable events
- **Vector Database**: Qdrant or Pinecone (future) when pgvector query latency requires dedicated vector DB
- **Model Proxy**: Rate limiting, caching, token budgeting service for OpenAI cost control
- **Observability**: OpenTelemetry (tracing) + Prometheus/Grafana (metrics) + Sentry (errors) + centralized logging

## Core Domain Concepts

### 12-Week Execution Methodology
- **Cycle**: 12-week planning/execution period with immutable history
- **Vision**: Long-term aspirations informing cycle goals (stored as versioned markdown)
- **Goals (Lag)**: Outcome metrics measured by results (revenue, NPS, etc.)
- **Tactics (Lead)**: Specific, time-bound actions driving goals with weights (0.1-1.0)
- **Weekly Plans**: Auto-generated from tactics due that week, with manual overrides
- **WPR**: Weekly Progress Review to review progress and commit next steps

### Scoring System
```sql
-- Weekly Lead Score Formula
Weekly Lead Score = (sum of completed planned instances × weight) / (sum of planned instances × weight) × 100%
```
- **Edge case**: No planned instances = 100% score (avoid penalizing non-planning weeks)
- **Deferred instances**: Move to next week's plan, remain in original denominator
- **Skipped instances**: Count as not completed unless manager override (audited)

## Multi-Tenancy & Security

### Row-Level Security (RLS) Pattern
Every table with org/team data includes `org_id` and optional `team_id`:
```sql
create policy "org members can read" on goals
for select using (
  exists (
    select 1 from org_members m
    where m.org_id = goals.org_id and m.user_id = auth.uid()
  )
);
```

### Role Hierarchy
- **Owner**: Tenant admin, manages org/teams/billing
- **Manager**: Creates/assigns tactics, views team analytics, runs WPRs  
- **Team Member**: Owns tactics, participates in WPRs
- **Viewer**: Read-only access to selected dashboards

## AI Agent Architecture (PRIMARY INTERFACE)

### Core Design Philosophy
The agent is not a side feature—it's the primary way users interact with the system. Every workflow should be agent-first with traditional UI as fallback.

### Comprehensive Capabilities
- **Planning & Guidance**: Conversationally guide users through vision → goals → tactics with intelligent suggestions
- **Universal Query**: Answer ANY question about ongoing, past, or future plans across all cycles with full context
- **Proactive Engagement**: Daily briefings, progress check-ins, risk alerts, celebration of wins
- **Execution Support**: Accept task completion via natural language, manage reassignments, adjust plans
- **Deep Analysis**: Explain score changes, identify patterns, predict outcomes, recommend optimizations
- **Write Operations**: Create/assign tactics, schedule WPRs, generate plans (all require confirmation)
- **RAG Context**: All user content (vision, goals, tactics, WPR notes, conversations, execution concepts library)

### Agent Tool Pattern
```typescript
// All mutating actions require explicit confirmation
if (action.requiresConfirmation && !userConfirmed) {
  return `Please confirm: ${action.description}`;
}
// Audit all agent actions
await auditLog.create({
  actor_user_id: session.user.id,
  action: 'agent_tool_call',
  entity_type: 'tactic',
  before: oldState,
  after: newState
});
```

## Data Model Patterns

### Versioning Strategy
Critical entities (Vision, Goals, Tactics, WPR notes) use append-only versioning:
```sql
goal_versions(goal_id, version, changed_by, diff, changed_at)
tactic_versions(tactic_id, version, changed_by, diff, changed_at)
```

### Tactic Instance Generation
Tactics define recurrence patterns; system generates `tactic_instances` for each week/day:
```sql
tactic_instances(id, tactic_id, week_start, due_date, planned, status, completed_at, notes)
```

## Billing & Monetization (Stripe Integration)

### Payment Processing
- Stripe for all payment processing (cards, wallets, ACH, SEPA)
- Subscription plans: Free, Pro ($29/user/month), Team ($49/user/month), Enterprise (custom)
- Stripe Checkout for hosted payment pages
- Stripe Billing for subscriptions and invoices
- Stripe Webhooks for real-time payment events

### Credits System
- Purchase credits in packages (100-5000 credits, volume discounts)
- Credits consumed for: agent marketplace executions, AI analytics, workflows, bulk operations
- Credits are org-level (shared across users)
- Never expire (except promotional credits)
- Real-time balance tracking with low-balance warnings (20%, 10%, 5%)
- Optional auto-reload when balance drops below threshold

### Billing Features
- 14-day free trial for Pro/Team plans (no credit card required)
- Annual billing with 20% discount
- Usage-based add-ons (storage, extra agent executions)
- Self-service plan upgrades/downgrades with proration
- Stripe Customer Portal for invoice management
- Failed payment dunning with 7-day grace period
- Tax calculation via Stripe Tax (automatic sales tax/VAT)

### Credit Usage Examples
- Agent marketplace task: 1-50 credits (depends on agent)
- AI analytics report: 5 credits
- Workflow execution: 10-100 credits (depends on complexity)
- Bulk import/export: 5 credits per operation

## Development Workflows

### Weekly Plan Auto-Generation
Runs Monday 00:00 in team timezone:
1. Generate planned instances for tactics due that week
2. Compute prior week lead scores  
3. Send alerts for scores < threshold (default 60%)
4. Build weekly plans from generated instances

### WPR Flow Implementation
1. Review lag results (manual entry)
2. Compute lead score automatically
3. Review missed/at-risk items with reassignment options
4. Commit next week's plan (pre-populated, editable)
5. Capture notes & decisions (versioned)
6. Email summary to participants

### Stripe Webhook Processing
1. Verify webhook signature for security
2. Parse event type and payload
3. Update database (subscriptions, credits, payment methods)
4. Handle idempotency (duplicate event detection)
5. Log event for debugging and auditing
6. Send user notifications for payment-related events

## Key Conventions

### Timezone Handling
- Store all dates/times in UTC
- Display in user's configured timezone
- Week boundaries computed by user locale (default Monday start)

### Internationalization
- Support English and Portuguese (pt-BR) in v1
- User-level locale setting affects date formats and agent language
- All user-facing strings externalized for translation

### Error Handling & Observability
- Structured logging for server actions and agent tool calls
- Metrics: job run counts, email failures, agent action success rates
- Rate limiting on agent actions and public APIs

## Implementation Priorities

### Agent-First MVP Focus (4-6 weeks)
1. **Agent Core Infrastructure**: pgvector RAG, tool architecture (20+ tools), chat UI, conversation memory
2. **Agent Planning Tools**: Conversational cycle/goal/tactic creation with suggestions and feasibility review
3. **Agent Query & Analysis**: Answer any question about plans/progress, explain scores, identify patterns
4. **Agent Execution**: Daily briefings, proactive check-ins, task completion via natural language
5. **Agent Actions**: Create/assign tactics, schedule WPRs (with confirmation and audit)
6. **Supporting Data Model**: Multi-tenant RLS, cycles/goals/tactics with versioning, instance generation
7. **Traditional UI Fallback**: Form-based wizard, Today/Week dashboards (agent-enhanced)
8. **Lead Scoring & WPR**: Calculation engine with edge cases, agent-facilitated meeting flow

### Critical Success Factors
- Agent can answer ANY question about ongoing/past/future plans accurately
- Agent guides users through complete planning conversationally
- Agent proactively helps users stay on track (daily briefings, check-ins)
- Agent respects RLS boundaries—no cross-tenant data leakage
- Agent actions require confirmation and are fully audited
- Traditional UI works as alternative but agent is primary interface
- Lead score calculations handle all edge cases correctly
- Weekly plan generation runs reliably in correct timezones

## MCP Server Architecture (External Agent Integration)

### Purpose & Vision
Execute exposes core functionality via Model Context Protocol (MCP) servers to enable external AI agents to leverage its planning and tracking capabilities. This supports agent orchestration where Execute provides strategic 12-week planning while specialized task-execution agents handle tactical work.

### MCP Server Endpoints
- **Planning Server**: Create/modify cycles, goals, tactics (write operations)
- **Execution Server**: Update task status, mark complete, track progress (high-frequency operations)
- **Analytics Server**: Compute scores, analyze trends, generate insights (read-only)
- **Query Server**: Search plans, retrieve history, compare cycles (RAG-powered)

### MCP Security & Access Control
- API key authentication with scoped permissions (read, write, admin) per org/team
- All MCP requests respect RLS policies—no cross-tenant data leakage
- Rate limiting: 1000 requests/hour per API key (configurable)
- Audit logging: all MCP requests logged with source agent identifier
- Separate database credentials for MCP servers with restricted schema access

### Agent Fleet Orchestration
Execute supports building "agent fleets" where:
- Execute provides strategic planning (goals, tactics, scoring)
- External specialized agents handle tactical execution (content creation, data analysis, outreach, etc.)
- Primary agent delegates tasks to external agents based on capabilities
- All agents share unified context (goals, progress, patterns) via MCP Query Server
- Supports parallel execution, sequential handoffs, and human-in-the-loop approvals
- Agent performance tracked: completion rate, success rate, user satisfaction
- Security enforced: RLS policies, sandboxing, permission scoping, circuit breakers

### Continuous Improvement & Learning
- System captures execution outcomes: completion time, quality ratings, issues encountered
- Analyzes patterns: which tactics drive goal achievement, optimal execution timing
- Primary agent adapts recommendations based on historical performance
- WPR includes lightweight retrospectives to capture qualitative feedback
- Adaptive scoring adjusts thresholds based on team-specific success patterns
- External agents report capability updates; system tests in sandbox before production use
- Feedback loop dashboard visualizes improvement trends across cycles

### Agent Marketplace & Discovery
- Curated marketplace of pre-built specialized agents (email outreach, social media, content creation, data analysis, code deployment, research, design)
- One-click installation with automatic MCP configuration and guided setup
- Agent ratings, reviews, and performance metrics visible in marketplace
- Trial/sandbox mode to test agents before committing
- Organizations can register custom proprietary agents (private to org)

### Cost Management for Agent Fleet
- Track costs per agent invocation (API calls, tokens, third-party services, execution time)
- Budget allocation per org/team/goal/agent type with hard or soft limits
- Cost attribution to specific tactics, goals, teams, and cycles
- Real-time alerts when approaching budget thresholds (80%, 95%, 100%)
- Cost optimization recommendations: identify expensive low-value tactics, suggest cheaper alternatives
- ROI analysis: cost to achieve goals vs value delivered

### Agent Composition & Workflow Orchestration
- Visual drag-and-drop workflow builder for complex multi-agent processes
- Node types: Agent Task, Decision Point, Human Approval, Parallel Fork/Join, Loop, Webhook
- Pre-built workflow templates (Content Pipeline, Sales Outreach, Product Launch, Data Pipeline)
- Workflow execution engine with retry logic, failure handling, and execution logs
- Real-time workflow monitoring with pause/resume/cancel capabilities
- Workflow version control with A/B testing support

## Enterprise Authentication

### SAML 2.0 SSO Integration
- Support Microsoft Active Directory, Google Workspace, Okta
- JIT (Just-In-Time) user provisioning on first SSO login
- Domain-based org assignment (e.g., @company.com → Company org)
- Configurable attribute mapping (email, name, role) per IdP
- Multi-IdP support per org (simultaneous AD + Google)

### Implementation Considerations
- SAML assertions: validate signatures, check expiry, verify audience
- Session management: coordinate between SSO sessions and Supabase Auth
- Fallback: local auth still available for non-SSO users in same org

## Files to Reference
- `SRS.md`: Complete functional requirements and data model
- `README.md`: High-level project description
- `.gitignore`: Node.js/Next.js project structure (implementation pending)

When implementing features, always consider the multi-tenant security model, immutable audit trail requirements, MCP server isolation, and the 12-week execution methodology's emphasis on consistent execution over perfection.