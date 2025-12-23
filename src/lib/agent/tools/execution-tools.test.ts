import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDailyBriefingTool } from "./execution-tools";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
}));

describe("Execution Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("get_daily_briefing", () => {
    it("should return briefing with correct score", async () => {
      // Mock Active Cycle
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: "cycle-1", title: "Q1", start_date: "2025-01-01", end_date: "2025-03-31" }, 
        error: null 
      });

      // Mock Todays Instances
      const mockTodays = [{ id: "1", title: "Task 1" }];
      
      // Mock Overdue Instances
      const mockOverdue = [];

      // Mock All Week Instances for Scoring
      // 1 Done (weight 1), 1 Pending (weight 1). Score 50%.
      const mockAllWeek = [
        { status: "done", planned: true, tactics: { weight: 1.0 } },
        { status: "pending", planned: true, tactics: { weight: 1.0 } },
      ];

      // Setup chain
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") return mockSupabase;
        if (table === "tactic_instances") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            then: (resolve: any) => {
                // This is a bit tricky because we have 3 calls to tactic_instances
                // We can distinguish them by the query structure or just return mocks in sequence if we assume order
                // But the tool runs them sequentially.
                // 1. Todays (eq due_date)
                // 2. Overdue (lt due_date)
                // 3. All Week (no due_date filter, just week_start)
                
                // A simpler way is to mock the resolved values in order if we can control the 'then'
                // But 'then' is called at the end of the chain.
                
                // Let's try to distinguish by the mock calls if possible, or just use mockResolvedValueOnce on the final promise if we could access it.
                // Since we are mocking the chain, we can use a counter or inspect arguments in a custom implementation.
                return resolve({ data: [], error: null }); 
            }
          } as any;
        }
        return mockSupabase;
      });
      
      // Better approach for sequential calls to the same table:
      // We can mock the `select` to return a promise that resolves to different values
      // But the chain is constructed.
      
      // Let's use a spy on the chain execution.
      // Actually, since `await` triggers the `then`, we can just mock `then` to return values in sequence.
      
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(), // Added gte
        neq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      
      // We need to make the chain "thenable" to work with await
      let callCount = 0;
      (chain as any).then = (resolve: any) => {
        callCount++;
        if (callCount === 1) return resolve({ data: mockTodays, error: null }); // Todays
        if (callCount === 2) return resolve({ data: mockOverdue, error: null }); // Overdue
        if (callCount === 3) return resolve({ data: mockAllWeek, error: null }); // All Week
        return resolve({ data: [], error: null });
      };

      mockSupabase.from.mockReturnValue(chain);
      // We also need to handle the 'cycles' call which uses 'single'
      // The 'cycles' call is the first one.
      // Wait, 'cycles' uses 'single()', not just 'then()'.
      
      // Let's refine the mock.
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: "c1", title: "Q1", end_date: "2025-03-31" }, error: null })
            };
        }
        if (table === "tactic_instances") {
            // We need a stateful mock for this test run
            return chain;
        }
        return mockSupabase;
      });

      const result = await getDailyBriefingTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.currentScore).toBe(50);
      expect(result.data.hasActiveCycle).toBe(true);
    });

    it("should include overdue items from previous weeks in active cycle", async () => {
      // Mock Active Cycle with start_date
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: "cycle-1", title: "Q1", start_date: "2024-12-01", end_date: "2025-03-31" }, 
        error: null 
      });

      // Mock Todays
      const mockTodays: any[] = [];
      
      // Mock Overdue - Should return items from previous week
      const mockOverdue = [{ id: "old-1", title: "Old Task", due_date: "2024-12-25" }];

      // Mock All Week (for score)
      const mockAllWeek: any[] = [];

      // Setup chain
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(), // We expect this new filter
        neq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      
      let callCount = 0;
      (chain as any).then = (resolve: any) => {
        callCount++;
        if (callCount === 1) return resolve({ data: mockTodays, error: null });
        if (callCount === 2) return resolve({ data: mockOverdue, error: null });
        if (callCount === 3) return resolve({ data: mockAllWeek, error: null });
        return resolve({ data: [], error: null });
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ 
                    data: { id: "c1", title: "Q1", start_date: "2024-12-01", end_date: "2025-03-31" }, 
                    error: null 
                })
            };
        }
        return chain;
      });

      const result = await getDailyBriefingTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      // We expect the tool to have called .gte("due_date", "2024-12-01")
      expect(chain.gte).toHaveBeenCalledWith("due_date", "2024-12-01");
    });
  });
});
