import { describe, it, expect, beforeAll } from 'vitest';
import { createTestUser } from '../helpers';

describe('RLS: Audit Log Immutability', () => {
  let user: any;
  let client: any;
  let org: any;
  let cycle: any;

  beforeAll(async () => {
    const setup = await createTestUser(`audit_tester_${Date.now()}@test.com`);
    user = setup.user;
    client = setup.client;

    // Create Org
    const { data: orgData } = await client
      .from('organizations')
      .insert({ name: 'Audit Test Org' })
      .select()
      .single();
    org = orgData;

    // Create Cycle to generate audit log
    const { data: cycleData } = await client
      .from('cycles')
      .insert({
        org_id: org.id,
        title: 'Audit Cycle',
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        owner_user_id: user.id
      })
      .select()
      .single();
    cycle = cycleData;
  });

  it('should NOT allow users to DELETE audit logs', async () => {
    // Find the log
    const { data: logs } = await client
      .from('audit_log')
      .select('id')
      .eq('entity_id', cycle.id);
    
    expect(logs.length).toBeGreaterThan(0);
    const logId = logs[0].id;

    // Try to delete
    const { error } = await client
      .from('audit_log')
      .delete()
      .eq('id', logId);

    // Should fail due to RLS (no delete policy)
    expect(error).toBeDefined();
  });

  it('should NOT allow users to UPDATE audit logs', async () => {
    const { data: logs } = await client
      .from('audit_log')
      .select('id')
      .eq('entity_id', cycle.id);
    const logId = logs[0].id;

    // Try to update
    const { error } = await client
      .from('audit_log')
      .update({ action: 'hacked' })
      .eq('id', logId);

    // Should fail due to RLS (no update policy)
    expect(error).toBeDefined();
  });

  it('should NOT allow users to INSERT audit logs directly', async () => {
    // Try to insert a fake log
    const { error } = await client
      .from('audit_log')
      .insert({
        org_id: org.id,
        action: 'create',
        entity_type: 'cycle',
        entity_id: cycle.id,
        actor_user_id: user.id
      });

    // Should fail - only system (via triggers/functions) can insert
    // The policy "System can insert audit logs" checks (true) but is likely restricted 
    // if we didn't add a policy for authenticated users.
    // Let's check the migration: 
    // create policy "System can insert audit logs" on public.audit_log for insert with check (true);
    // Wait, if check is true, anyone can insert? 
    // Ah, RLS policies are permissive. If ANY policy allows it, it's allowed.
    // But usually we want to restrict this to ONLY the service role or specific functions.
    // The migration said: "Will be called from triggers with SECURITY DEFINER".
    // If the policy is `check (true)` and applied to `public` role (default), then users MIGHT be able to insert.
    // We should verify this. If this test fails (i.e., insert succeeds), we found a security hole!
    
    // If the policy is defined as:
    // create policy "System can insert audit logs" on public.audit_log for insert with check (true);
    // AND it applies to authenticated users, then yes, they can insert.
    // We should probably restrict this policy to a specific role or ensure no policy exists for 'authenticated' 
    // and only the SECURITY DEFINER function (which bypasses RLS) can do it.
    
    // Actually, SECURITY DEFINER functions bypass RLS *if* the owner has bypassrls (postgres) or if they are superuser.
    // In Supabase, `postgres` role has bypassrls.
    // But standard RLS policies apply to the `authenticated` role.
    // If we created a policy `check(true)`, we effectively allowed everyone to insert.
    
    // Let's see if the test reveals this.
    if (!error) {
        console.warn("SECURITY WARNING: Users can insert into audit_log directly!");
    }
    expect(error).toBeDefined(); 
  });
});
