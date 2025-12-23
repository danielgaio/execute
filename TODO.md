# TODO: Execute - Implementation Roadmap

## Top 10 Priority Tasks

### 1. AI Agent Core Infrastructure (Agent-First Foundation)

- [x] Set up pgvector extension and embedding pipeline for all user content (vision, goals, tactics)
- [x] Build RAG retrieval system with RLS-aware filtering for multi-tenant context
- [x] Design agent tool architecture: query tools (read operations), action tools (write with confirmation), analysis tools
- [x] Implement agent chat UI as primary interface (persistent right-side panel, keyboard-accessible, mobile-responsive)
- [x] Create conversation history storage with context window management and memory persistence
- [x] Build agent context builder that assembles relevant cycles, goals, tactics, scores for each query

### 2. Agent-Assisted Planning & Execution Tools

- [x] Implement agent planning tools: `create_cycle`, `define_goal`, `add_tactic`
- [ ] Implement advanced planning tools: `suggest_tactics_for_goal`, `review_plan_feasibility`
- [x] Build agent query tools: `list_due_items`, `query_scores`, `summarize_progress`
- [x] Build advanced query tools: `explain_status`, `compare_cycles`, `find_blockers`
- [x] Create agent action tools (with confirmation): `assign_tactic`, `defer_task`, `mark_complete`
- [ ] Create advanced action tools: `reschedule_tactic`, `update_weight`
- [x] Implement agent analysis tools: `analyze_lag_lead_correlation`, `predict_score`, `identify_risks`, `suggest_adjustments`
- [ ] Add natural language input parsing for tactical attributes (recurrence, weights, due dates)
- [ ] Build agent-guided wizard that conversationally walks users through 12-week cycle planning

### 3. Database Foundation & Multi-Tenant Security

- [ ] Design and deploy Supabase schema with core tables: `organizations`, `org_members`, `teams`, `team_members`, `cycles`, `visions`, `goals`, `tactics`, `tactic_instances`, `weekly_plans`
- [ ] Implement comprehensive RLS policies for all tables enforcing org_id/team_id boundaries
- [ ] Write unit tests for RLS policies to prevent cross-tenant data leakage
- [x] Set up audit_log table with triggers for entity versioning and agent action tracking ✅ **COMPLETED** (Dec 23, 2025)
  - Created comprehensive audit logging system with immutable append-only log
  - Implemented automatic triggers for all critical entities (cycles, goals, tactics, instances, visions, weekly_plans)
  - Built entity versioning tables for Vision, Goals, and Tactics with diff tracking
  - Added agent action tracking with confirmation metadata
  - Created audit service with helper functions (logAgentAction, getEntityHistory, etc.)
  - Integrated audit logging into all agent action tools
  - Added audit query tools for agent (get_entity_history, get_recent_activity)
  - Comprehensive RLS policies ensuring multi-tenant isolation
  - Performance-optimized indexes for common query patterns
  - Documentation: docs/AUDIT-SYSTEM.md

### 4. Next.js Project Scaffold & Authentication

- [ ] Initialize Next.js 14+ with App Router, TypeScript, and Material UI
- [ ] Configure Supabase client integration (environment variables, middleware)
- [ ] Build authentication flows: sign-up, sign-in, OAuth (Google/Microsoft)
- [ ] Create protected layout with auth guards and session management

### 5. Organization & Team Management

- [ ] Build org creation and invitation flow (Owner role) - support both traditional UI and agent-assisted creation
- [ ] Implement team creation and member assignment UI with agent suggestions based on skill matching
- [ ] Create role management interface (Owner, Manager, Member, Viewer)
- [ ] Add user profile settings (timezone, locale, notification preferences)

### 6. Agent-Enhanced Planning Experience

- [ ] Build conversational Vision capture: agent interviews user about long-term goals and structures vision document
- [ ] Create agent-assisted Goal definition: agent suggests SMART goals based on vision, helps set baselines and targets
- [ ] Implement agent-guided Tactic creation: agent recommends tactics based on goals, suggests weights and recurrence patterns
- [ ] Add traditional form-based wizard as fallback/alternative to conversational planning
- [ ] Build agent plan review: agent analyzes feasibility, workload balance, and potential conflicts before commitment

### 7. Tactic Instance Generation Engine

- [ ] Create service/Edge Function to expand tactic recurrence into weekly/daily instances
- [ ] Implement timezone-aware scheduling (week start by locale)
- [ ] Build instance status management (planned, done, skipped, deferred)
- [ ] Add carry-over logic for deferred instances

### 8. Agent-Powered Daily & Weekly Execution

- [ ] Build agent-first daily briefing: "What should I focus on today?" with prioritized recommendations
- [ ] Create agent-driven weekly planning: agent pre-populates and explains weekly commitments
- [ ] Implement conversational task completion: users can say "Mark tactic X done, took 2 hours, good results"
- [ ] Add agent proactive notifications: "You have 3 high-priority items due today, want to review?"
- [ ] Build agent progress check-ins: periodic "How's tactic Y going?" with context-aware follow-ups
- [ ] Create traditional Today/Week dashboard views as secondary interface with agent integration

### 9. Lead Score Calculation Engine with Agent Intelligence

- [ ] Implement weekly lead score formula: (completed × weight) / (planned × weight) × 100%
- [ ] Handle edge cases: no planned instances (100%), deferred items, skipped with override
- [ ] Create score computation job (runs Monday morning in team timezone)
- [ ] Build agent-powered alerts: personalized messages explaining score drops with actionable suggestions
- [ ] Add agent score analysis: "Why is my score lower this week?" with drill-down into contributing factors
- [ ] Expose scoring APIs for analytics and WPR integration

### 10. Agent-Enhanced WPR Flow

- [ ] Build agent WPR preparation: agent pre-analyzes week, identifies discussion topics, prepares talking points
- [ ] Implement agent WPR facilitation: agent guides meeting flow, surfaces relevant data, captures decisions
- [ ] Create agent note-taking: automatic structuring of meeting discussions into actionable items
- [ ] Add agent retrospective analysis: "What patterns do you see in our last 4 WPRs?" with insights
- [ ] Build agent next-week planning: agent suggests commitments based on capacity and priorities
- [ ] Implement traditional WPR UI as structured alternative with agent assistance sidebar

---

## Success Criteria for Agent-First MVP (4-6 weeks)

### Core Agent Capabilities (Must Have)

- ✅ Agent can answer any question about ongoing, past, or future plans across all cycles
- ✅ Agent guides users through complete 12-week cycle planning conversationally (vision → goals → tactics)
- ✅ Agent provides daily briefings: "What should I work on today?" with context-aware prioritization
- ✅ Agent explains scores and progress: "Why did my score drop?" with actionable insights
- ✅ Agent assists in WPR preparation and facilitation with intelligent suggestions
- ✅ Agent can create, modify, and reassign tactics via confirmed natural language commands
- ✅ Agent analyzes patterns across cycles and identifies optimization opportunities
- ✅ Agent respects RLS boundaries and only accesses user's authorized org/team data

### Traditional UI Features (Supporting)

- Users can create orgs/teams with proper RLS isolation (agent-assisted or manual)
- Form-based planning wizard available as alternative to conversational flow
- Dashboard views show accurate due items (agent-enhanced with insights)
- Lead scores compute correctly including all edge cases
- Tactic instances auto-generate with correct weekly scheduling
- System runs reliably in correct timezones with proper audit trails

### Agent Experience Quality

- Agent response time < 3s for queries, < 6s for complex analysis
- Agent conversation memory persists across sessions
- Agent proactively offers help based on context (e.g., deadlines approaching)
- Agent provides citations/sources for data-driven answers
- Agent gracefully handles ambiguity with clarifying questions
- Daily Mindset Tips integrate naturally into agent conversations

---

## Post-MVP: MCP & Enterprise Integration (v1.2)

### MCP Server Implementation

- [ ] **MCP Planning Server**: Implement endpoints for cycle/goal/tactic CRUD with RLS enforcement
- [ ] **MCP Execution Server**: Build task status update, progress tracking, and batch operation endpoints
- [ ] **MCP Analytics Server**: Create read-only endpoints for scores, trends, correlation analysis
- [ ] **MCP Query Server**: Implement natural language query support with RAG retrieval
- [ ] **API Key Management**: Build generation, scoping, rotation, and revocation system
- [ ] **MCP Request Logging**: Set up audit trail and rate limiting infrastructure (1000 req/hour per key)
- [ ] **MCP Documentation**: Auto-generate OpenAPI/JSON Schema docs and API explorer
- [ ] **MCP SDKs**: Create TypeScript and Python client libraries for external agents
- [ ] **MCP Webhooks**: Implement plan change notifications for registered external agents
- [ ] **MCP Testing**: Build integration tests for all endpoints with security validation

### Enterprise Authentication (SAML SSO)

- [ ] **SAML 2.0 Core**: Implement SSO login flow, ACS endpoint, and metadata generation
- [ ] **JIT Provisioning**: Build automatic user creation on first SSO login with role mapping
- [ ] **Domain-Based Org Assignment**: Implement email domain matching to auto-assign users to orgs
- [ ] **SAML Configuration UI**: Create admin interface for IdP metadata upload and attribute mapping
- [ ] **Multi-IdP Support**: Enable simultaneous Microsoft AD + Google Workspace per org
- [ ] **Session Management**: Coordinate SSO sessions with Supabase Auth tokens
- [ ] **SAML Security**: Validate assertions, signatures, expiry; prevent replay attacks
- [ ] **SSO Testing**: Integration tests with Microsoft AD, Google Workspace, Okta
- [ ] **Fallback Auth**: Ensure local email/password auth works alongside SSO

### Integration Success Criteria

- External agents can authenticate via MCP API keys and access all endpoints
- MCP servers respect RLS policies—no cross-tenant data leakage
- Rate limiting prevents abuse (circuit breakers for runaway agents)
- SAML SSO works with major IdPs (AD, Google, Okta) with JIT provisioning
- Audit logs capture all MCP requests with source agent identifier
- MCP SDKs provide easy integration for TypeScript/Python agent frameworks

---

## Post-MVP: Billing & Monetization (v1.3)

### Stripe Payment Integration

- [ ] **Stripe Account Setup**: Create Stripe account, configure webhooks endpoint, set up test/production modes
- [ ] **Subscription Plans**: Implement Free, Pro, Team, Enterprise tiers with feature gating
- [ ] **Stripe Checkout Integration**: Build hosted checkout flow for subscription sign-ups and upgrades
- [ ] **Payment Method Management**: UI for adding/updating/removing cards, ACH, digital wallets
- [ ] **Invoice Generation**: Automatic PDF invoices via Stripe Billing with email delivery
- [ ] **Subscription Management**: Self-service upgrades/downgrades with proration
- [ ] **Stripe Customer Portal**: Embed portal for invoice history and billing info updates
- [ ] **Trial Period Management**: 14-day free trial with conversion tracking and reminders

### Credits System Implementation

- [ ] **Credit Purchase Flow**: Stripe Checkout for credit packages (100-5000 credits)
- [ ] **Credit Balance Tracking**: Real-time balance display with org-level sharing
- [ ] **Credit Consumption Engine**: Deduct credits for agent executions, analytics, workflows
- [ ] **Usage History & Reporting**: Detailed transaction log with timestamps and descriptions
- [ ] **Low Balance Alerts**: Email notifications at 20%, 10%, 5% thresholds
- [ ] **Auto-Reload System**: Optional auto-purchase when balance drops below threshold
- [ ] **Credit Budgets**: Team-level budget allocation and consumption tracking
- [ ] **Promotional Credits**: Grant system for referrals, onboarding bonuses with expiration handling

### Stripe Webhooks & Automation

- [ ] **Webhook Endpoint**: Secure webhook receiver with signature verification
- [ ] **Event Processing**: Handle checkout.session.completed, invoice.payment_succeeded/failed, subscription updates
- [ ] **Idempotency Handling**: Prevent duplicate processing of webhook events
- [ ] **Failed Payment Recovery**: Automated dunning sequence (Day 1, 3, 7 emails) with retry logic
- [ ] **Subscription Status Sync**: Update database on plan changes, cancellations, renewals
- [ ] **Webhook Event Logging**: Audit trail for debugging and compliance

### Revenue Analytics & Admin Tools

- [ ] **Revenue Dashboard**: MRR, ARR, churn rate, ARPU metrics for admins
- [ ] **Cost Attribution**: Track which features/agents/workflows consume most credits
- [ ] **Billing Reports**: Export revenue data for accounting/finance
- [ ] **Spend Analytics**: Per-org cost trends, high-spend teams, optimization opportunities
- [ ] **Tax Compliance**: Stripe Tax integration for automatic sales tax/VAT calculation

### Monetization Success Criteria

- Users can sign up for Pro/Team plans and complete payment via Stripe Checkout
- Credits purchase and consumption work correctly with real-time balance updates
- Webhooks process successfully with no duplicate charges or missed events
- Failed payments trigger dunning sequence with recovery rate > 60%
- Credit budgets prevent overspend with team-level allocation
- Revenue dashboard shows accurate MRR/ARR for business tracking
- Agent marketplace executions correctly deduct credits based on agent pricing

# Prompt

```
You are helping build the Execute system.

Continuously move the project forward.
Identify the next most meaningful improvement, feature, or task that will increase
functionality, reliability, performance, onboarding simplicity, developer experience,
deployment readiness, observability, security hardening, or UX polish — or anything
else that strategically improves the product.

You may propose new ideas when beneficial — not just complete existing todos.

When deciding what to do next, consider:
- product value and user experience
- dependency order and architectural foundations
- maintainability, scalability, and performance
- modern best practices, conventions, design patterns, and security standards
- clarity and simplicity for future contributors
- readiness for local development and eventual deployment

Then:
1. Briefly explain why this is the right next step.
2. Implement it using clean, idiomatic, production-grade code.
3. Apply appropriate patterns, naming conventions, folder structures, and tests.
4. Refactor existing code when it improves quality or alignment with best practices.
5. Suggest what should be validated, measured, or tested afterward.

If context is missing, make reasonable assumptions and state them.
Do not wait for permission — take initiative and keep improving the system.
```
