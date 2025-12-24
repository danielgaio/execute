import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWPRContextTool, submitWPRTool } from "./wpr-tools";
import { SupabaseClient } from "@supabase/supabase-js";
import * as planningUtils from "@/utils/planning";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
  generateTacticInstancesForWeek: vi.fn().mockResolvedValue(true),
}));

vi.mock("../embedding-service", () => ({
  embeddingService: {
    storeEmbedding: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../audit-service", () => ({
  logAgentAction: vi.fn().mockResolvedValue(true),
}));

describe("WPR Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    };

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("get_wpr_context", () => {
    it("should return detailed context including deferred items and next week preview", async () => {
      // Mock Active Cycle
      const mockCycle = { id: "cycle-1", title: "Q1" };
      
      // Mock Tactic Instances
      // 1 Done, 1 Pending, 1 Deferred
      const mockInstances = [
        { id: "1", status: "done", planned: true, tactics: { title: "T1", weight: 1.0 } },
        { id: "2", status: "pending", planned: true, tactics: { title: "T2", weight: 1.0 } },
        { id: "3", status: "deferred", planned: true, tactics: { title: "T3", weight: 1.0 } },
      ];
      
      // Mock Goals
      const mockGoals = [{ id: "g1", title: "Revenue" }];

      // Mock Next Week Count
      const mockNextWeekCount = { count: 5 };

      // Setup chain
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockCycle, error: null })
          };
        }
        if (table === "tactic_instances") {
          return {
            select: vi.fn().mockImplementation((sel) => {
                if (sel === 'id') {
                    return {
                        eq: vi.fn().mockReturnThis(),
                        then: (resolve: any) => resolve({ count: 5, error: null })
                    };
                }
                return {
                    eq: vi.fn().mockReturnThis(),
                    then: (resolve: any) => resolve({ data: mockInstances, error: null })
                };
            }),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: mockInstances, error: null })
          } as any;
        }
        if (table === "goals") {
           return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: mockGoals, error: null })
           } as any;
        }
        return mockSupabase;
      });

      const result = await getWPRContextTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.leadScore).toBe(33); // 1 done / 3 total
      expect(result.data.details.deferred).toHaveLength(1);
      expect(result.data.nextWeekPlan.status).toBe("generated");
      expect(result.data.nextWeekPlan.itemCount).toBe(5);
    });
  });

  describe("submit_wpr", () => {
    it("should generate next week plan if commit_next_week is true", async () => {
      // Mock Active Cycle
      mockSupabase.single.mockResolvedValue({ data: { id: "cycle-1" }, error: null });

      // Mock Instances (for score calc)
      const mockInstances = [{ id: "1", status: "done", planned: true, tactics: { weight: 1.0 } }];
      
      // Mock Existing WPR (null = create)
      // The tool calls single() for WPR check.
      // 1. Cycle (single)
      // 2. Instances (select)
      // 3. WPR Check (single) -> return null
      // 4. Insert WPR (single) -> return new WPR
      
      // Mock Tactics (for next week generation)
      const mockTactics = [{ id: "t1" }, { id: "t2" }];

      // Mock Next Week Check (count) -> return 0 (not generated)
      
      let callCount = 0;
      mockSupabase.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ data: { id: "cycle-1" }, error: null }); // Cycle
        if (callCount === 2) return Promise.resolve({ data: null, error: null }); // WPR Check
        if (callCount === 3) return Promise.resolve({ data: { id: "wpr-1" }, error: null }); // WPR Insert
        return Promise.resolve({ data: null });
      });

      const selectMock = vi.fn().mockReturnThis();
      // Handle instances fetch
      (selectMock as any).then = (resolve: any) => resolve({ data: mockInstances, error: null });

      mockSupabase.select.mockImplementation((...args: any[]) => {
          const sel = args[0];
          if (sel === 'id' && typeof args[1] === 'object') {
              // Count query for next week check
              const chain = {
                  eq: vi.fn(),
                  then: (resolve: any) => resolve({ count: 0, error: null })
              };
              chain.eq.mockReturnValue(chain);
              return chain;
          }
          if (sel === 'id' && !args[1]) {
             // Tactics fetch OR Cycle fetch
             const chain = {
                 eq: vi.fn(),
                 single: (...args: any[]) => mockSupabase.single(...args),
                 then: (resolve: any) => resolve({ data: mockTactics, error: null })
             };
             chain.eq.mockReturnValue(chain);
             return chain;
          }
          
          // Default (Cycle, Instances, WPR Check)
          const chain = {
              eq: vi.fn(),
              single: (...args: any[]) => mockSupabase.single(...args),
              then: (resolve: any) => resolve({ data: mockInstances, error: null })
          };
          chain.eq.mockReturnValue(chain);
          return chain;
      });

      const result = await submitWPRTool.handler({
        week_start: "2025-01-01",
        notes: "Good week",
        lag_status: "On track",
        commit_next_week: true
      }, mockContext);

      if (!result.success) {
        console.error("Test Failure Error:", result.error);
      }

      expect(result.success).toBe(true);
      expect(planningUtils.generateTacticInstancesForWeek).toHaveBeenCalledTimes(2); // Once for each tactic
      expect(result.data.message).toContain("Generated plan for next week");
    });
  });
});
