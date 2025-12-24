import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWeeklyScoreTool, getTodayFocusTool } from "./query-tools";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("../audit-service", () => ({
  getEntityHistory: vi.fn(),
  getRecentAuditActivity: vi.fn(),
}));

describe("Query Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    // Mock Supabase client with chainable methods
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      then: undefined
    };
    
    mockSupabase = mockChain;

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("get_weekly_score", () => {
    it("should calculate score correctly including deferred items", async () => {
      const mockInstances = [
        { id: "1", status: "done", tactics: { weight: 1.0, title: "Task 1" } },
        { id: "2", status: "pending", tactics: { weight: 1.0, title: "Task 2" } },
        { id: "3", status: "deferred", tactics: { weight: 1.0, title: "Task 3" } },
      ];

      // Mock return data
      (mockSupabase as any).then = (resolve: any) => resolve({ data: mockInstances, error: null });

      const result = await getWeeklyScoreTool.handler({ week_start: "2025-01-01" }, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as any;

      // Total weight = 3.0
      // Completed weight = 1.0
      // Score = 1/3 * 100 = 33%
      expect(data.score).toBe(33);
      expect(data.total_planned).toBe(3);
      expect(data.completed_count).toBe(1);
      expect(data.pending_count).toBe(1);
      expect(data.deferred_count).toBe(1);
      expect(data.deferred_items).toHaveLength(1);
      expect(data.deferred_items[0].id).toBe("3");
    });

    it("should handle empty week", async () => {
      (mockSupabase as any).then = (resolve: any) => resolve({ data: [], error: null });

      const result = await getWeeklyScoreTool.handler({ week_start: "2025-01-01" }, mockContext);

      expect(result.success).toBe(true);
      expect((result.data as any).score).toBe(100); // Default to 100% if nothing planned
    });
  });

  describe("get_today_focus", () => {
    it("should exclude deferred items", async () => {
      // The handler calls .neq("status", "deferred")
      // We just verify that the chain includes this call
      
      (mockSupabase as any).then = (resolve: any) => resolve({ data: [], error: null });

      await getTodayFocusTool.handler({ include_completed: false }, mockContext);

      expect(mockSupabase.neq).toHaveBeenCalledWith("status", "deferred");
    });

    it("should exclude done items if include_completed is false", async () => {
      (mockSupabase as any).then = (resolve: any) => resolve({ data: [], error: null });

      await getTodayFocusTool.handler({ include_completed: false }, mockContext);

      expect(mockSupabase.neq).toHaveBeenCalledWith("status", "done");
    });
  });
});
