# Execute AI Agent

The Execute AI Agent is the primary interface for interacting with the Execute 12-week execution framework. It provides conversational access to planning, tracking, and analyzing your cycles, goals, and tactics.

## Features

### Implemented ✅

- **Conversational Query Interface**: Ask natural language questions about your plans
- **Tool-Based Architecture**: Extensible system with query, action, and analysis tools
- **RLS-Aware Data Access**: All operations respect multi-tenant security boundaries
- **Persistent Chat UI**: Collapsible sidebar with message history
- **Today's Focus**: Get your daily priorities
- **Weekly Score Analysis**: Understand your execution metrics
- **Goal & Tactic Management**: Query cycles, goals, and tactics
- **Action Execution**: Mark tactics complete with confirmation

### Initial Tool Set

**Query Tools** (Read-only):

- `list_cycles` - Get all active and recent 12-week cycles
- `list_goals` - Get goals (lag indicators) for a cycle
- `list_tactics` - Get tactics (lead indicators) for goals
- `get_today_focus` - Get tactic instances due today
- `get_weekly_score` - Calculate and explain weekly lead score

**Action Tools** (Require confirmation):

- `mark_tactic_complete` - Mark a tactic instance as completed
- `defer_tactic` - Defer a tactic instance to next week

## Usage

### Accessing the Agent

1. Click the floating AI button (robot icon) in the bottom-right corner
2. The agent panel will slide in from the right
3. Start chatting!

### Example Queries

```
"What's my current cycle?"
"What should I focus on today?"
"How's my weekly score?"
"Show me my goals for this cycle"
"Mark tactic <id> as complete"
"What tactics are due this week?"
"How am I doing compared to last week?"
```

## Architecture

### Components

- **AgentService** (`src/lib/agent/agent-service.ts`)

  - Orchestrates conversation flow
  - Manages tool registry
  - Handles OpenAI function calling
  - Maintains conversation context

- **Tool System** (`src/lib/agent/tools/`)

  - Query tools: Read-only operations
  - Action tools: Write operations with confirmation
  - Type-safe with Zod schema validation

- **API Route** (`src/app/api/agent/chat/route.ts`)

  - Authentication and session management
  - RLS context injection
  - Error handling

- **UI Component** (`src/components/agent-chat.tsx`)
  - Message history
  - Streaming response support (prepared)
  - Loading states and error handling

### Tool Development

To add a new tool:

1. Define the tool in `src/lib/agent/tools/`
2. Specify parameters with Zod schema
3. Implement the handler function
4. Add to the appropriate tool array (query/action)
5. Register in `AgentService`

Example:

```typescript
export const myCustomTool: AgentTool = {
  name: "my_custom_tool",
  description: "What this tool does",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
  }),
  handler: async (params, context) => {
    // Implementation
    return {
      success: true,
      data: {
        /* result */
      },
    };
  },
};
```

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=sk-your-openai-api-key
```

### Model Settings

Default configuration in `src/lib/openai.ts`:

- Model: `gpt-4o-mini` (fast and cost-effective)
- Temperature: 0.7 (balanced creativity/consistency)
- Max tokens: 2000

## Security

### Row-Level Security (RLS)

All tool operations automatically enforce RLS policies:

- Tools receive authenticated Supabase client
- `org_id` and `user_id` are validated
- Cross-tenant data access is prevented

### Action Confirmation

Tools marked with `requiresConfirmation: true` require explicit user approval before execution. Currently implemented for:

- Creating/modifying data
- Deleting records
- Bulk operations

## Future Enhancements

### Coming Soon

- **RAG Integration**: pgvector embeddings for semantic search across vision, goals, WPR notes
- **Streaming Responses**: Real-time token streaming for faster UX
- **Proactive Briefings**: Daily "Good morning" messages with priorities
- **WPR Facilitation**: Guided Weekly Progress Review conversations
- **Planning Assistance**: Conversational cycle/goal/tactic creation
- **Pattern Analysis**: Identify trends and suggest improvements
- **Voice Input**: Speech-to-text for hands-free interaction

### Analysis Tools (Planned)

- `analyze_lag_lead_correlation` - Connect execution to outcomes
- `predict_score` - Forecast weekly performance
- `identify_risks` - Flag at-risk goals and tactics
- `suggest_adjustments` - Recommend plan changes
- `compare_cycles` - Historical performance analysis

### Planning Tools (Planned)

- `create_cycle` - Conversational cycle setup
- `define_goal` - SMART goal creation with suggestions
- `add_tactic` - Tactic creation with weight recommendations
- `suggest_tactics_for_goal` - AI-generated tactic ideas
- `review_plan_feasibility` - Workload and balance analysis

## Development

### Running Locally

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your OPENAI_API_KEY

# Run development server
pnpm dev
```

### Testing

Manual testing checklist:

- [ ] Agent responds to greetings
- [ ] Query tools return correct data
- [ ] Action tools require confirmation
- [ ] RLS prevents cross-tenant access
- [ ] Error messages are user-friendly
- [ ] UI is responsive on mobile
- [ ] Keyboard shortcuts work (Enter to send)

## Troubleshooting

### "Unauthorized" errors

- Ensure user is logged in
- Check user belongs to an organization

### "No active cycle found"

- Create a cycle first via dashboard

### Tool execution fails

- Check Supabase RLS policies
- Verify data exists in database
- Review server logs for details

### OpenAI API errors

- Verify OPENAI_API_KEY is set
- Check API key has sufficient credits
- Review rate limits
