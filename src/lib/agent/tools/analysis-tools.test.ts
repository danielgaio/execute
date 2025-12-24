import { describe, it, expect, vi, beforeEach } from "vitest";
import { predictScoreTool, suggestAdjustmentsTool } from "./analysis-tools";
import { SupabaseClient } from "@supabase/supabase-js";

describe("Analysis Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("predict_score", () => {
    it("should return 100% prediction if no tactics are planned", async () => {
      // Mock empty current instances
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await predictScoreTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.predicted_score).toBe(100);
      expect(result.data.message).toContain("No planned tactics");
    });

    it("should predict score based on current progress and history", async () => {
      // Mock current instances
      const currentInstances = [
        {
          id: "1",
          status: "done",
          due_date: "2025-12-24",
          tactics: { weight: 1.0 },
        }, // Completed
        {
          id: "2",
          status: "pending",
          due_date: "2025-12-25",
          tactics: { weight: 1.0 },
        }, // Pending
      ];

      // Mock history (50% completion rate)
      const historyInstances = [{ status: "done" }, { status: "failed" }];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tactic_instances") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi
                    .fn()
                    .mockResolvedValue({ data: currentInstances, error: null }), // First call (current)
                }),
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    eq: vi
                      .fn()
                      .mockResolvedValue({
                        data: historyInstances,
                        error: null,
                      }), // Second call (history)
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await predictScoreTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      // Total weight = 2. Completed = 1. Current = 50%.
      // Pending = 1. Historical rate = 0.5.
      // Predicted additional = 1 * 0.5 = 0.5.
      // Total predicted = 1.5 / 2 = 75%.
      expect(result.data.current_score).toBe(50);
      expect(result.data.predicted_score).toBe(75);
      expect(result.data.historical_completion_rate).toBe(50);
    });
  });

  describe("suggest_adjustments", () => {
    it("should suggest prioritizing high impact tasks", async () => {
      const instances = [
        {
          id: "1",
          status: "pending",
          due_date: "2025-12-25",
          title: "Big Task",
          tactics: { id: "t1", title: "Big Task", weight: 1.0 },
        },
        {
          id: "2",
          status: "pending",
          due_date: "2025-12-25",
          title: "Small Task",
          tactics: { id: "t2", title: "Small Task", weight: 0.2 },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: instances, error: null }),
            }),
          }),
        }),
      });

      const result = await suggestAdjustmentsTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      const suggestions = result.data.suggestions.join(" ");
      expect(suggestions).toContain('Prioritize "Big Task"');
    });

    it("should suggest rescheduling overdue tasks", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const instances = [
        {
          id: "1",
          status: "pending",
          due_date: yesterdayStr,
          title: "Late Task",
          tactics: { id: "t1", title: "Late Task", weight: 0.5 },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: instances, error: null }),
            }),
          }),
        }),
      });

      const result = await suggestAdjustmentsTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      const suggestions = result.data.suggestions.join(" ");
      expect(suggestions).toContain('overdue tasks ("Late Task")');
    });

    it("should return 'all set' if no pending tasks", async () => {
      const instances = [
        {
          id: "1",
          status: "done",
          due_date: "2025-12-25",
          title: "Done Task",
          tactics: { weight: 1.0 },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: instances, error: null }),
            }),
          }),
        }),
      });

      const result = await suggestAdjustmentsTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("No pending tasks");
    });
  });
});
