import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWeeklyScoreTool } from "./scoring-tools";

describe("Scoring Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };
    mockContext = {
      supabase: mockSupabase,
      orgId: "org-123",
      userId: "user-123",
    };
  });

  describe("get_weekly_score", () => {
    it("should calculate score correctly for a mix of items", async () => {
      const mockInstances = [
        { id: "1", status: "done", planned: true, tactics: { weight: 1.0, title: "Task 1" } },
        { id: "2", status: "pending", planned: true, tactics: { weight: 1.0, title: "Task 2" } },
        { id: "3", status: "done", planned: false, tactics: { weight: 1.0, title: "Unplanned" } }, // Should be ignored
      ];

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockInstances, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await getWeeklyScoreTool.handler({ week_offset: 0 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(50); // 1 done / 2 planned = 50%
        expect(result.data.total_items).toBe(2);
        expect(result.data.completed_items).toBe(1);
      }
    });

    it("should return 100% if no items found", async () => {
       const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await getWeeklyScoreTool.handler({ week_offset: 0 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(100);
        expect(result.data.total_items).toBe(0);
      }
    });
    
    it("should handle null instances gracefully", async () => {
       const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await getWeeklyScoreTool.handler({ week_offset: 0 }, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.score).toBe(100);
        expect(result.data.message).toContain("No items found");
      }
    });
  });
});
