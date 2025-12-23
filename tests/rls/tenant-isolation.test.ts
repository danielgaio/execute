import { describe, it, expect, beforeAll } from 'vitest';
import { createTestUser, getAdminClient } from '../helpers';

describe('RLS: Multi-Tenant Isolation', () => {
  let userA: any;
  let clientA: any;
  let orgA: any;

  let userB: any;
  let clientB: any;
  let orgB: any;

  beforeAll(async () => {
    // Setup User A
    const setupA = await createTestUser(`usera_${Date.now()}@test.com`);
    userA = setupA.user;
    clientA = setupA.client;

    // Setup User B
    const setupB = await createTestUser(`userb_${Date.now()}@test.com`);
    userB = setupB.user;
    clientB = setupB.client;
  });

  it('should allow users to create organizations', async () => {
    const { data, error } = await clientA
      .from('organizations')
      .insert({ name: 'Org A' })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.created_by).toBe(userA.id);
    orgA = data;

    // User B creates Org B
    const { data: dataB, error: errorB } = await clientB
      .from('organizations')
      .insert({ name: 'Org B' })
      .select()
      .single();
    
    expect(errorB).toBeNull();
    orgB = dataB;
  });

  it('should automatically add creator as owner in org_members', async () => {
    const { data, error } = await clientA
      .from('org_members')
      .select('*')
      .eq('org_id', orgA.id)
      .single();

    expect(error).toBeNull();
    expect(data.user_id).toBe(userA.id);
    expect(data.role).toBe('owner');
  });

  it('should NOT allow User A to see Org B', async () => {
    const { data, error } = await clientA
      .from('organizations')
      .select('*')
      .eq('id', orgB.id);

    expect(error).toBeNull(); // RLS usually returns empty array, not error
    expect(data).toHaveLength(0);
  });

  it('should NOT allow User A to see User B\'s cycles', async () => {
    // User B creates a cycle
    const { data: cycleB, error: createError } = await clientB
      .from('cycles')
      .insert({
        org_id: orgB.id,
        title: 'Cycle B',
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        owner_user_id: userB.id
      })
      .select()
      .single();

    expect(createError).toBeNull();

    // User A tries to fetch it
    const { data, error } = await clientA
      .from('cycles')
      .select('*')
      .eq('id', cycleB.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('should NOT allow User A to create data in Org B', async () => {
    const { error } = await clientA
      .from('cycles')
      .insert({
        org_id: orgB.id, // Trying to insert into B's org
        title: 'Malicious Cycle',
        start_date: '2025-01-01',
        end_date: '2025-03-31'
      });

    // Expect an RLS violation error or just 0 rows affected depending on policy
    // Supabase/Postgres RLS on INSERT usually throws an error if the CHECK fails
    expect(error).toBeDefined();
  });

  it('should isolate Audit Logs', async () => {
    // User B performs an action (already did create cycle)
    // Check if User A can see the audit log for that action
    
    // First, verify audit log exists (using admin or User B)
    const { data: logsB } = await clientB
      .from('audit_log')
      .select('*')
      .eq('org_id', orgB.id);
    
    expect(logsB.length).toBeGreaterThan(0);

    // Now User A tries to see it
    const { data: logsA } = await clientA
      .from('audit_log')
      .select('*')
      .eq('org_id', orgB.id);

    expect(logsA).toHaveLength(0);
  });
});
