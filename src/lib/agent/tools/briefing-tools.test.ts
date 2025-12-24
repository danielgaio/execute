import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDailyBriefingTool } from "./briefing-tools";

describe("Briefing Tools", () => {
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

  describe("get_daily_briefing", () => {
    it("should return comprehensive briefing with overdue, today, and upcoming items", async () => {
      const today = new Date().toISOString().split("T")[0];
      
      // Mock Data
      const mockOverdue = [{ id: "1", due_date: "2024-01-01", status: "pending", tactics: { title: "Old Task", weight: 0.5 } }];
      const mockToday = [
        { id: "2", due_date: today, status: "pending", tactics: { title: "Today Task", weight: 0.8 } },
        { id: "3", due_date: today, status: "done", tactics: { title: "Done Task", weight: 0.5 } }
      ];
      const mockUpcoming = [{ id: "4", due_date: "2025-12-31", status: "pending", tactics: { title: "Future Task", weight: 0.5 } }];

      // Mock Chain
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation((col) => {
            // We need to return different data based on the query context
            // But since we can't easily inspect the chain state here without complex mocks,
            // we'll use `mockResolvedValueOnce` on the final `then` or `data` property access.
            // However, Supabase mocks usually return a promise-like object.
            return {
                then: (resolve: any) => {
                    // This is tricky because we make 3 calls.
                    // We can use `mockImplementation` on `from` to return different chains based on calls?
                    // Or just use `mockResolvedValueOnce` on the chain execution.
                    resolve({ data: [], error: null });
                }
            }
        })
      });

      // Better Mock Strategy: Mock `from` to return specific chains for each call
      // Call 1: Overdue (lt today)
      // Call 2: Today (eq today)
      // Call 3: Upcoming (gt today)
      
      let callIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        callIndex++;
        return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: any) => {
                if (callIndex === 1) resolve({ data: mockOverdue, error: null });
                if (callIndex === 2) resolve({ data: mockToday, error: null });
                if (callIndex === 3) resolve({ data: mockUpcoming, error: null });
            }
        } as any;
      });

      const result = await getDailyBriefingTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.summary.overdue).toBe(1);
      expect(result.data.summary.todayTotal).toBe(2);
      expect(result.data.summary.todayPending).toBe(1);
      expect(result.data.summary.upcoming).toBe(1);
      
      // Check High Priority (Overdue + High Weight Today)
      // Overdue (1) + Today High Weight (1) = 2
      expect(result.data.sections.highPriority).toHaveLength(2);
      expect(result.data.sections.highPriority[0].reason).toBe("Overdue");
      expect(result.data.sections.highPriority[1].reason).toBe("High Impact");
    });
  });
});
