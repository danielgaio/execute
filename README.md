# Execute

Agent-first productivity system for 12-week execution cycles, inspired by quarterly planning principles.

## 🚀 Key Features

### ✅ Implemented

- **AI Agent Interface** 🤖 - Conversational chat for planning, tracking, and analysis
  - Natural language queries about cycles, goals, and tactics
  - Daily focus recommendations
  - Weekly score analysis with explanations
  - Action execution with confirmation (mark complete, defer tasks)
- **Multi-Tenant Architecture** 🏢 - Organizations and teams with role-based access
  - Row-Level Security (RLS) for data isolation
  - Owner, Manager, Member, Viewer roles
- **12-Week Cycles** 📅 - Plan and track execution in 12-week periods
  - Vision statements to guide strategic direction
  - Goals (lag indicators) for outcome metrics
  - Tactics (lead indicators) for specific actions
- **Weekly Execution** ✓ - Auto-generated weekly plans and scoring
  - Lead score calculation: (completed × weight) / (planned × weight)
  - Today's focus view
  - Week view with progress tracking
- **Authentication** 🔐 - Supabase Auth with OAuth
  - Email/password
  - Google, Microsoft, GitHub SSO

### 🔮 Coming Soon

- **RAG-Powered Context**: pgvector embeddings for semantic search
- **Proactive Briefings**: Daily "Good morning" messages
- **WPR Facilitation**: AI-guided Weekly Progress Reviews
- **Planning Wizard**: Conversational cycle/goal/tactic creation
- **Pattern Analysis**: Identify trends and suggest improvements
- **MCP Server**: External agent integration via Model Context Protocol
- **Enterprise SSO**: SAML 2.0 (Microsoft AD, Google Workspace, Okta)
- **Stripe Integration**: Subscription plans and credits system

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Material UI
- **Backend**: Supabase (Postgres + Auth + RLS)
- **AI**: OpenAI GPT-4o-mini with function calling
- **Deployment**: Vercel
- **Language**: TypeScript

## 📖 Documentation

- [Agent Documentation](docs/AGENT.md) - AI Agent features and usage
- [SRS.md](SRS.md) - Complete software requirements specification
- [TODO.md](TODO.md) - Implementation roadmap

## 🏃 Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Supabase account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/danielgaio/execute.git
cd execute

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - OPENAI_API_KEY

# Run migrations (if needed)
# Follow Supabase setup in docs

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### First Steps

1. **Sign Up** - Create an account or use OAuth
2. **Create Organization** - Set up your first organization
3. **Talk to the Agent** - Click the AI button (bottom-right) and ask:
   - "Help me plan my first 12-week cycle"
   - "What should I work on?"
   - "Explain the Execute methodology"

## 🎯 Core Concepts

### 12-Week Execution Framework

- **Cycle**: 12-week planning period (inspired by quarterly execution)
- **Vision**: Long-term aspirations that guide goals
- **Goals (Lag)**: Outcome metrics (revenue, NPS, customer satisfaction)
- **Tactics (Lead)**: Specific actions that drive goals
- **Weekly Plan**: Auto-generated from tactics due that week
- **WPR**: Weekly Progress Review to assess and commit

### Lead vs Lag Indicators

- **Lag (Goals)**: Results you want to achieve (e.g., $100k revenue)
- **Lead (Tactics)**: Actions you control (e.g., 10 sales calls/week)
- **Lead Score**: Measures execution consistency, not outcomes

### Scoring System

```
Weekly Lead Score = (completed_weight / planned_weight) × 100%
```

- Edge case: No planned tactics = 100% (avoid penalizing non-planning weeks)
- Deferred tactics: Move to next week, stay in original denominator
- Target: 85%+ indicates consistent execution

## 🤖 AI Agent

The Execute AI Agent is your execution partner. Access it via the floating button (bottom-right).

### What it can do:

**Query** (Read-only):

- List cycles, goals, tactics
- Get today's focus
- Calculate weekly scores
- Explain progress

**Actions** (With confirmation):

- Mark tactics complete
- Defer tasks to next week

**Coming Soon**:

- Create cycles, goals, tactics conversationally
- Analyze patterns and suggest improvements
- Facilitate Weekly Progress Reviews
- Generate daily briefings

See [Agent Documentation](docs/AGENT.md) for details.

## 🗄️ Database Schema

Core tables:

- `organizations` - Multi-tenant roots
- `org_members` - User-organization memberships
- `teams` - Sub-groups within organizations
- `cycles` - 12-week execution periods
- `visions` - Strategic direction documents
- `goals` - Lag indicators (outcomes)
- `tactics` - Lead indicators (actions)
- `tactic_instances` - Weekly/daily executable tasks
- `weekly_plans` - Pre-populated weekly commitments

All tables enforce Row-Level Security (RLS) for data isolation.

## 🧪 Development

### Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Project Structure

```
execute/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   │   └── agent/    # Agent chat endpoint
│   │   ├── dashboard/    # Main app pages
│   │   └── login/        # Auth pages
│   ├── components/       # React components
│   │   ├── agent-chat.tsx      # Agent UI
│   │   └── dashboard-shell.tsx # Layout
│   ├── lib/              # Core libraries
│   │   ├── agent/        # Agent service and tools
│   │   └── openai.ts     # OpenAI integration
│   └── utils/            # Utilities
│       └── supabase/     # Supabase clients
├── supabase/
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
└── public/               # Static assets
```

## 🔒 Security

- **Row-Level Security (RLS)**: All database operations enforce org/team boundaries
- **Authentication**: Supabase Auth with session management
- **Agent Security**: Tool calls validate user permissions
- **Audit Logging**: All actions tracked with user/timestamp

## 🤝 Contributing

Contributions welcome! Areas of focus:

1. **Agent Tools**: Add new query/action/analysis tools
2. **RAG Integration**: pgvector embeddings for semantic search
3. **UI Polish**: Mobile responsiveness, accessibility
4. **Testing**: Unit tests for tools and RLS policies
5. **Documentation**: Tutorials, examples, guides

## 📜 License

MIT

## 👤 Author

Daniel Eliel Gaio

---

**Status**: Active development - Agent-first MVP in progress
