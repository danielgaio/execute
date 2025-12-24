import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateInstancesForTactic, generateWeeklyPlan, Tactic } from "./planning";
import { SupabaseClient } from "@supabase/supabase-js";

describe("Planning Domain Service", () => {
  let mockSupabase: any;
  const weekStart = new Date("2025-01-06"); // A Monday

  beforeEach(() => {
    // Create a chainable object
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      then: (resolve: any) => resolve({ data: [], error: null }) // Default resolution
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(chain),
      // Expose chain methods on the root for easier mocking in tests if needed, 
      // but primarily 'from' returns the chain.
      ...chain
    };
  });

  describe("generateInstancesForTactic", () => {
    it("should generate instances for weekly recurrence (Friday default)", async () => {
      const tactic: Tactic = {
        id: "t1",
        title: "Weekly Report",
        recurrence: "weekly",
        org_id: "org-1",
        due_days: [5] // Friday
      };

      // Mock no existing instances
      // We need to mock the specific chain call for 'select'
      mockSupabase.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] })
        })
      });
      
      // Actually, with the new setup, 'from' returns 'chain'.
      // 'chain.select' returns 'chain'.
      // 'chain.eq' returns 'chain'.
      // 'chain.then' resolves.
      
      // So we just need to ensure the default resolution is what we want, 
      // or override it for specific tests.
      
      // For this test, we want the first select (check existing) to return []
      // And the insert to succeed.
      
      // The default mock in beforeEach returns [] for data.
      
      await generateInstancesForTactic(mockSupabase as unknown as SupabaseClient, tactic, weekStart);

      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          tactic_id: "t1",
          due_date: "2025-01-10", // Friday of that week
          planned: true
        })
      ]));
    });

    it("should generate instances for daily recurrence (Mon-Fri)", async () => {
      const tactic: Tactic = {
        id: "t2",
        title: "Standup",
        recurrence: "daily",
        org_id: "org-1"
      };

      // Default mock returns [] so it proceeds to insert
      await generateInstancesForTactic(mockSupabase as unknown as SupabaseClient, tactic, weekStart);

      expect(mockSupabase.insert).toHaveBeenCalled();
      const inserted = mockSupabase.insert.mock.calls[0][0];
      expect(inserted).toHaveLength(5); // Mon-Fri
      expect(inserted[0].due_date).toBe("2025-01-06"); // Monday
      expect(inserted[4].due_date).toBe("2025-01-10"); // Friday
    });

    it("should skip if instances already exist (Idempotency)", async () => {
      const tactic: Tactic = {
        id: "t1",
        title: "Weekly Report",
        recurrence: "weekly",
        org_id: "org-1"
      };

      // Mock existing instances
      // We need to override the 'then' of the chain to return data
      const chain = mockSupabase.from(); // Get the chain object
      chain.then = (resolve: any) => resolve({ data: [{ id: "inst-1" }], error: null });

      await generateInstancesForTactic(mockSupabase as unknown as SupabaseClient, tactic, weekStart);

      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it("should generate instance for one_off tactic if none exist", async () => {
      const tactic: Tactic = {
        id: "t3",
        title: "Launch",
        recurrence: "one_off",
        org_id: "org-1",
        due_days: [3] // Wednesday
      };

      // Mock global check (count = 0)
      // The code calls: select('id', {count}).eq()...
      // We need to mock this specific chain.
      
      // Reset mocks to be clean
      vi.clearAllMocks();
      
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: (resolve: any) => resolve({ data: [], count: 0, error: null }) // Default: no data, count 0
      };
      
      mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
        ...chain
      };

      await generateInstancesForTactic(mockSupabase as unknown as SupabaseClient, tactic, weekStart);

      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          tactic_id: "t3",
          due_date: "2025-01-08", // Wednesday
          planned: true
        })
      ]));
    });

    it("should skip one_off tactic if instance already exists globally", async () => {
      const tactic: Tactic = {
        id: "t3",
        title: "Launch",
        recurrence: "one_off",
        org_id: "org-1"
      };

      // Mock global check (count = 1)
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: (resolve: any) => resolve({ data: [], count: 1, error: null }) // Count 1
      };
      
      mockSupabase = {
        from: vi.fn().mockReturnValue(chain),
        ...chain
      };

      await generateInstancesForTactic(mockSupabase as unknown as SupabaseClient, tactic, weekStart);

      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
  });

  describe("generateWeeklyPlan", () => {
    it("should iterate all active tactics", async () => {
      const tactics = [
        { id: "t1", recurrence: "weekly", org_id: "org-1" },
        { id: "t2", recurrence: "daily", org_id: "org-1" }
      ];

      // We need to handle multiple calls to 'from' returning different data
      // 1. tactics (select *)
      // 2. tactic_instances (select id - check existing) -> for t1
      // 3. tactic_instances (insert) -> for t1
      // 4. tactic_instances (select id - check existing) -> for t2
      // 5. tactic_instances (insert) -> for t2

      let callCount = 0;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        then: (resolve: any) => {
            callCount++;
            // 1. Fetch Tactics
            if (callCount === 1) return resolve({ data: tactics, error: null });
            // 2. Check existing for T1 (return empty)
            if (callCount === 2) return resolve({ data: [], error: null });
            // 3. Check existing for T2 (return empty)
            // Note: Insert calls don't use 'then' usually if awaited directly on the promise returned by insert?
            // Wait, insert returns a promise-like builder.
            // If we await insert(), it calls then().
            
            // Let's simplify. The 'insert' mock above is mockResolvedValue.
            // So insert() returns a Promise that resolves immediately. It doesn't use this 'then'.
            
            // So callCount 2 is check T1.
            // CallCount 3 is check T2.
            if (callCount === 3) return resolve({ data: [], error: null });
            
            return resolve({ data: [], error: null });
        }
      };

      mockSupabase.from.mockReturnValue(chain);

      const result = await generateWeeklyPlan(mockSupabase as unknown as SupabaseClient, "org-1", weekStart);

      expect(result.generated).toBe(2);
      expect(result.errors).toBe(0);
    });
  });
});
