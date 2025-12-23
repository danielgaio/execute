import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWPRContextTool } from "./wpr-tools";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
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
});
