import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWPRContextTool, submitWPRTool } from "./wpr-tools";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
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
    };

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("get_wpr_context", () => {
    it("should calculate lead score correctly using domain logic", async () => {
      // Mock Active Cycle
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "cycle-1", title: "Q1" }, error: null });
      
      // Mock Tactic Instances
      // 1 Done (weight 2), 1 Pending (weight 1). Total 3. Done 2. Score 67%.
      const mockInstances = [
        { id: "1", status: "done", planned: true, tactics: { title: "T1", weight: 2.0 } },
        { id: "2", status: "pending", planned: true, tactics: { title: "T2", weight: 1.0 } },
      ];
      
      // Mock Goals
      const mockGoals = [{ id: "g1", title: "Revenue" }];

      // Setup chain for instances (second call to from/select)
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") return mockSupabase;
        if (table === "tactic_instances") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Return instances
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
      expect(result.data.leadScore).toBe(67);
      expect(result.data.performance).toBe("At Risk"); // 67 is < 85
      expect(result.data.tacticDetails).toHaveLength(2);
    });

    it("should handle no active cycle", async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await getWPRContextTool.handler({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No active cycle");
    });
  });

  describe("submit_wpr", () => {
    it("should recalculate score and save WPR", async () => {
      // Mock Active Cycle
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "cycle-1" }, error: null });

      // Mock Tactic Instances for Recalculation
      // 1 Done (weight 1), 1 Pending (weight 1). Score 50%.
      const mockInstances = [
        { id: "1", status: "done", planned: true, tactics: { weight: 1.0 } },
        { id: "2", status: "pending", planned: true, tactics: { weight: 1.0 } },
      ];

      // Mock Existing WPR (null = create new)
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      // Mock Insert Return
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "wpr-1" }, error: null });

      // Setup chain
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") return mockSupabase;
        if (table === "tactic_instances") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: mockInstances, error: null })
          } as any;
        }
        if (table === "weekly_reviews") return mockSupabase;
        return mockSupabase;
      });

      // Ensure insert is mocked on the main object for weekly_reviews
      mockSupabase.insert = vi.fn().mockReturnThis();

      const result = await submitWPRTool.handler({
        week_start: "2025-01-01",
        notes: "Good week",
        lead_score: 99, // Agent tries to cheat with 99%
        lag_status: "On track"
      }, mockContext);

      if (!result.success) {
        console.error("Test Failure Error:", result.error);
      }

      expect(result.success).toBe(true);
      // Verify that the INSERT used the calculated score (50), not the agent's score (99)
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        lead_score: 50,
        notes: "Good week"
      }));
    });
  });
});
