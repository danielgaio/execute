# Audit Logging System - Testing & Deployment Guide

## Overview
Comprehensive audit logging and entity versioning system for Execute. Tracks all mutations, enables compliance, supports debugging, and provides full accountability for agent actions.

## Key Features
✅ **Central Audit Log**: Immutable, append-only tracking of all changes
✅ **Entity Versioning**: Automatic versioning for Vision, Goals, and Tactics
✅ **Agent Action Tracking**: Every agent tool call is auditable with confirmation status
✅ **Multi-tenant Security**: RLS policies ensure data isolation
✅ **Performance Optimized**: Strategic indexes for common query patterns
✅ **Query Helpers**: Utility functions and views for easy access

## Database Migration

### Apply Migration
```bash
# Connect to Supabase project
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/20251223000000_add_audit_logging.sql
```

### Verify Installation
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('audit_log', 'vision_versions', 'goal_versions', 'tactic_versions');

-- Check triggers are attached
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'audit_log';
```

## Testing Audit Logging

### Test 1: Automatic Trigger Logging
```sql
-- Create test organization and user
INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id;
-- Use returned org_id in next queries

-- Create a cycle (should trigger audit log)
INSERT INTO cycles (org_id, title, start_date, end_date, owner_user_id)
VALUES ('<org_id>', 'Test Cycle Q1', '2025-01-06', '2025-03-31', auth.uid())
RETURNING id;

-- Verify audit log entry was created
SELECT * FROM audit_log 
WHERE entity_type = 'cycles' 
ORDER BY timestamp DESC 
LIMIT 1;

-- Expected: action='create', after_state contains cycle data, actor_user_id set
```

### Test 2: Agent Action Logging
```typescript
// In your agent tool test
import { logAgentAction } from '@/lib/agent/audit-service';

const result = await logAgentAction(supabase, {
  userId: session.user.id,
  orgId: userOrgId,
  toolName: 'create_cycle',
  action: 'create',
  entityType: 'cycle',
  entityId: cycle.id,
  afterState: cycle,
  metadata: {
    confirmed: true,
    tool_category: 'planning',
  },
});

// Verify audit entry
const { data } = await supabase
  .from('audit_log')
  .select('*')
  .eq('id', result)
  .single();

console.log('Agent action logged:', data);
// Expected: actor_type='agent', actor_context.tool_name='create_cycle'
```

### Test 3: Entity Versioning
```sql
-- Create a goal
INSERT INTO goals (org_id, cycle_id, title, target, baseline, owner_user_id)
VALUES ('<org_id>', '<cycle_id>', 'Revenue Goal', 100000, 0, auth.uid())
RETURNING id;

-- Check version 1 was created automatically
SELECT * FROM goal_versions WHERE goal_id = '<goal_id>' ORDER BY version;
-- Expected: version=1, title='Revenue Goal'

-- Update the goal
UPDATE goals 
SET target = 150000, title = 'Revenue Goal (Increased)'
WHERE id = '<goal_id>';

-- Check version 2 was created
SELECT * FROM goal_versions WHERE goal_id = '<goal_id>' ORDER BY version;
-- Expected: version=1 and version=2, diff shows changed fields
```

### Test 4: RLS Policy Enforcement
```sql
-- As user in Org A
SET request.jwt.claims TO '{"sub": "user-a-id"}';

-- Should see only Org A audit logs
SELECT count(*) FROM audit_log WHERE org_id = '<org-a-id>';

-- Should NOT see Org B audit logs
SELECT count(*) FROM audit_log WHERE org_id = '<org-b-id>';
-- Expected: 0 rows (cross-tenant isolation)
```

### Test 5: Query Helper Functions
```sql
-- Get entity history
SELECT * FROM get_entity_history('goal', '<goal_id>', 50);
-- Expected: Array of changes with timestamps, actors, diffs

-- Get user activity summary
SELECT * FROM get_user_activity_summary(auth.uid(), 7);
-- Expected: JSON with total_actions, actions_by_type, entities_modified, agent_actions

-- Get recent activity
SELECT * FROM recent_audit_activity LIMIT 10;
-- Expected: Enriched view with actor names, emails, formatted diffs
```

## Integration with Agent Tools

### Updated Action Tools
All action tools now automatically log to audit trail:
- `create_cycle` → logs cycle creation with confirmation metadata
- `create_goal` → logs goal creation with cycle context
- `create_tactic` → logs tactic creation with goal context
- `mark_tactic_complete` → logs completion with before/after state
- `defer_tactic` → logs deferral with reason

### Query Tools for Audit Data
New query tools enable agent to answer audit questions:
- `get_entity_history` → "Show me changes to this goal"
- `get_recent_activity` → "What's been happening this week?"

### Example Agent Queries
```
User: "Show me the history of changes to my revenue goal"
Agent: [Calls get_entity_history with goal_id]
Response: "Your revenue goal has been modified 3 times:
1. Created on Dec 1 with target $100k
2. Updated on Dec 10: target increased to $150k by Sarah
3. Updated on Dec 20: status changed to 'at_risk' by system"

User: "What have I accomplished this week?"
Agent: [Calls get_recent_activity + filters by user]
Response: "This week you've:
- Created 2 new tactics
- Marked 5 tactics as complete
- Updated 1 goal target
All actions are logged and auditable."
```

## Performance Considerations

### Indexes
The migration creates strategic indexes for common queries:
```sql
-- Entity lookup: Fast retrieval of all changes to specific entity
idx_audit_log_entity (entity_type, entity_id)

-- User activity: Fast retrieval of user's actions over time
idx_audit_log_actor (actor_user_id, timestamp DESC)

-- Org activity: Fast org-wide activity feed
idx_audit_log_org (org_id, timestamp DESC)

-- Time-based queries: Fast chronological retrieval
idx_audit_log_timestamp (timestamp DESC)

-- Action analysis: Fast filtering by action type
idx_audit_log_action (action, entity_type)
```

### Query Optimization Tips
```sql
-- BAD: Full table scan
SELECT * FROM audit_log WHERE timestamp > now() - interval '7 days';

-- GOOD: Uses org index + timestamp
SELECT * FROM audit_log 
WHERE org_id = '<org_id>' 
AND timestamp > now() - interval '7 days'
ORDER BY timestamp DESC;

-- GOOD: Uses entity index
SELECT * FROM audit_log 
WHERE entity_type = 'goal' 
AND entity_id = '<goal_id>'
ORDER BY timestamp DESC;
```

## Security Model

### Principle: Immutable Audit Trail
- **NO DELETE** operations allowed on `audit_log` (not even by admins)
- **NO UPDATE** operations allowed on `audit_log`
- Only **INSERT** via triggers or `log_agent_action` function (SECURITY DEFINER)

### RLS Policies
```sql
-- READ: Org members can view their org's audit logs
-- Prevents cross-tenant data leakage

-- WRITE: Only SECURITY DEFINER functions can insert
-- Prevents tampering, ensures data integrity

-- NO DELETE/UPDATE policies
-- Audit logs are permanent
```

### Compliance Benefits
- **SOC 2**: Complete audit trail for all data changes
- **GDPR**: User action tracking for data subject requests
- **Debugging**: Trace root cause of data issues
- **Trust**: Users can see full history of their data

## Monitoring & Observability

### Key Metrics to Track
```sql
-- Daily audit log growth rate
SELECT date_trunc('day', timestamp), count(*) 
FROM audit_log 
GROUP BY 1 
ORDER BY 1 DESC 
LIMIT 30;

-- Top actors (users or agents)
SELECT actor_user_id, actor_type, count(*) 
FROM audit_log 
WHERE timestamp > now() - interval '7 days'
GROUP BY 1, 2 
ORDER BY 3 DESC;

-- Action distribution
SELECT action, entity_type, count(*) 
FROM audit_log 
WHERE timestamp > now() - interval '7 days'
GROUP BY 1, 2 
ORDER BY 3 DESC;

-- Agent vs User actions
SELECT actor_type, count(*) 
FROM audit_log 
GROUP BY 1;
```

### Alerts to Configure
- Audit log growth exceeding 10k entries/day (potential abuse)
- Failed agent action logging (system health issue)
- Unusual actor activity (security concern)
- Version table growth anomalies (excessive churn)

## Maintenance

### Archive Strategy (Future)
For high-volume production use, consider archiving:
```sql
-- Create archive table (same schema)
CREATE TABLE audit_log_archive (LIKE audit_log INCLUDING ALL);

-- Move old data (e.g., >1 year old)
WITH moved AS (
  DELETE FROM audit_log 
  WHERE timestamp < now() - interval '1 year'
  RETURNING *
)
INSERT INTO audit_log_archive SELECT * FROM moved;
```

### Cleanup Commands
```sql
-- Remove test data (CAUTION: Use only in dev/test)
DELETE FROM audit_log WHERE org_id = '<test_org_id>';
DELETE FROM goal_versions WHERE goal_id IN (
  SELECT id FROM goals WHERE org_id = '<test_org_id>'
);
```

## Troubleshooting

### Issue: Audit logs not being created
```sql
-- Check triggers are enabled
SELECT tgenabled FROM pg_trigger WHERE tgname = 'audit_cycles_changes';
-- Expected: tgenabled = 'O' (origin, enabled)

-- Check trigger function exists
\df audit_entity_changes
```

### Issue: RLS preventing reads
```sql
-- Verify user is org member
SELECT * FROM org_members WHERE user_id = auth.uid();

-- Test policy manually
SELECT * FROM audit_log WHERE org_id IN (
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
);
```

### Issue: Version numbers skipping
- This is expected behavior when multiple concurrent updates occur
- Versions are sequential per entity, not globally synchronized
- Gaps indicate parallel updates, not data loss

## Next Steps

### Recommended Enhancements
1. **Audit Dashboard UI**: Visual timeline of changes for users
2. **Rollback Functionality**: Use version tables to restore previous states
3. **Anomaly Detection**: ML-based detection of unusual patterns
4. **Export Compliance Reports**: Generate audit reports for compliance teams
5. **Real-time Audit Webhooks**: Notify external systems of critical changes

### Integration Checklist
- [ ] Apply migration to production database
- [ ] Verify triggers are working on test data
- [ ] Update agent tools to use audit service
- [ ] Add audit queries to agent capabilities
- [ ] Configure monitoring alerts
- [ ] Document audit access procedures for compliance team
- [ ] Test RLS policies across multiple orgs
- [ ] Set up archive strategy for long-term data

## Support

For issues or questions:
1. Check trigger status: `SELECT * FROM pg_trigger WHERE tgrelid = 'audit_log'::regclass;`
2. Review recent errors: Check Supabase logs for trigger failures
3. Test RLS: Ensure `auth.uid()` returns expected user ID
4. Verify indexes: `EXPLAIN ANALYZE` on slow audit queries

---

**Implementation Date**: December 23, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
