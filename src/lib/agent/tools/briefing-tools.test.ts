import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDailyBriefingTool } from "./briefing-tools";
import { BriefingService, DailyBriefing } from "../../briefing/service";

// Mock the BriefingService module
vi.mock("../../briefing/service", () => ({
  BriefingService: {
    getBriefing: vi.fn(),
  },
}));

describe("Briefing Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
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

      // Mock the BriefingService.getBriefing response
      const mockBriefing: DailyBriefing = {
        date: today,
        overdue: [
          {
            id: "1",
            title: "Old Task",
            due_date: "2024-01-01",
            status: "pending",
            weight: 0.5,
            goal_title: "Goal 1",
            planned: true,
          },
        ],
        today: [
          {
            id: "2",
            title: "Today Task",
            due_date: today,
            status: "pending",
            weight: 0.8,
            goal_title: "Goal 1",
            planned: true,
          },
          {
            id: "3",
            title: "Done Task",
            due_date: today,
            status: "done",
            weight: 0.5,
            goal_title: "Goal 2",
            planned: true,
          },
        ],
        upcoming: [
          {
            id: "4",
            title: "Future Task",
            due_date: "2025-12-31",
            status: "pending",
            weight: 0.5,
            goal_title: "Goal 1",
            planned: true,
          },
        ],
        stats: {
          overdueCount: 1,
          todayCount: 2,
          upcomingCount: 1,
        },
        scoreAnalysis: {
          score: 75,
          status: "on-track",
          completed: [],
          pending: [],
          missed: [],
          detractors: [],
          contributors: [],
          recoveryPath: [],
        },
      };

      vi.mocked(BriefingService.getBriefing).mockResolvedValue(mockBriefing);

      const result = await getDailyBriefingTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.briefing).toEqual(mockBriefing);
      expect(result.data.message).toContain("Daily Briefing");
      expect(result.data.message).toContain("1 Overdue Items");
      expect(result.data.message).toContain("Today's Focus (2)");
      expect(result.data.message).toContain("Upcoming (Next 3 Days)");

      // Verify service was called with correct parameters
      expect(BriefingService.getBriefing).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        undefined, // no timezone provided
      );
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(BriefingService.getBriefing).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await getDailyBriefingTool.handler({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should pass timezone parameter to BriefingService", async () => {
      const mockBriefing: DailyBriefing = {
        date: "2025-01-31",
        overdue: [],
        today: [],
        upcoming: [],
        stats: { overdueCount: 0, todayCount: 0, upcomingCount: 0 },
      };

      vi.mocked(BriefingService.getBriefing).mockResolvedValue(mockBriefing);

      await getDailyBriefingTool.handler(
        { timezone: "America/New_York" },
        mockContext,
      );

      expect(BriefingService.getBriefing).toHaveBeenCalledWith(
        mockSupabase,
        "org-123",
        "America/New_York",
      );
    });
  });
});
