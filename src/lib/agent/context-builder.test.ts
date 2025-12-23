import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextBuilder, AgentContextData } from "./context-builder";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock getWeekStart to return a fixed date
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue("2024-01-01"),
}));

// Mock audit-service
vi.mock("./audit-service", () => ({
  getRecentAuditActivity: vi.fn().mockResolvedValue([
    { timestamp: "2024-01-01T10:00:00Z", action: "create", entity_type: "goal" }
  ])
}));

describe("ContextBuilder", () => {
  let contextBuilder: ContextBuilder;
  let mockSupabase: any;

  // Helper to create a chainable mock
  const createMockChain = (returnData: any) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: returnData }),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: returnData }), // Make the chain itself awaitable
    };
    return chain;
  };

  beforeEach(() => {
    contextBuilder = new ContextBuilder();
    mockSupabase = {
      from: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe("buildContext", () => {
    it("should build context with all data present", async () => {
      // Mock responses
      const mockCycle = {
        id: "cycle-123",
        title: "Q1 2024",
        end_date: "2024-03-31",
      };
      
      const mockGoals = [
        { title: "Goal 1", status: "on_track", target: 100, baseline: 0 },
        { title: "Goal 2", status: "at_risk", target: 50, baseline: 0 },
      ];

      const mockVision = {
        content_md: "To be the best.",
      };

      const mockInstances = [
        { id: "1", status: "done", due_date: "2024-01-02", planned: true, tactics: { weight: 1 } },
        { id: "2", status: "pending", due_date: "2024-01-03", planned: true, tactics: { weight: 1 } },
      ];

      // Setup Supabase mocks
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
          return createMockChain(mockCycle);
        }
        if (table === "goals") {
          return createMockChain(mockGoals);
        }
        if (table === "visions") {
          return createMockChain(mockVision);
        }
        if (table === "tactic_instances") {
          return createMockChain(mockInstances);
        }
        if (table === "recent_audit_activity") {
            return createMockChain([]);
        }
        return createMockChain(null);
      });

      const result = await contextBuilder.buildContext(
        mockSupabase as unknown as SupabaseClient,
        "org-123"
      );

      expect(result.activeCycle).toBeDefined();
      expect(result.activeCycle?.title).toBe("Q1 2024");
      expect(result.goals).toHaveLength(2);
      expect(result.vision).toBe("To be the best.");
      expect(result.pendingTasksCount).toBe(1); // 1 pending
      expect(result.recentActivity).toBeDefined();
      expect(result.recentActivity?.length).toBe(1);
    });

    it("should handle missing data gracefully", async () => {
      // Setup Supabase mocks to return null/empty
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tactic_instances") {
            return createMockChain([]);
        }
        return createMockChain(null);
      });

      const result = await contextBuilder.buildContext(
        mockSupabase as unknown as SupabaseClient,
        "org-123"
      );

      expect(result.activeCycle).toBeUndefined();
      expect(result.goals).toBeUndefined();
      expect(result.vision).toBeUndefined();
      expect(result.pendingTasksCount).toBe(0);
    });
  });

  describe("formatContext", () => {
    it("should format full context correctly", () => {
      const data: AgentContextData = {
        activeCycle: {
          id: "1",
          title: "Q1 2024",
          endDate: "2024-03-31",
          daysLeft: 30,
        },
        vision: "To be the best.",
        goals: [
          { title: "Goal 1", status: "on_track", progress: 50 },
        ],
        weeklyScore: 85,
        pendingTasksCount: 5,
        todayTasksCount: 2,
      };

      const result = contextBuilder.formatContext(data);

      expect(result).toContain('Organization Vision: "To be the best."');
      expect(result).toContain('Active Cycle: "Q1 2024"');
      expect(result).toContain('Active Goals:');
      expect(result).toContain('- Goal 1 (on_track)');
      expect(result).toContain('Current Weekly Score: 85%');
      expect(result).toContain('Pending Tasks This Week: 5');
    });

    it("should format empty context correctly", () => {
      const data: AgentContextData = {
        pendingTasksCount: 0,
        todayTasksCount: 0,
      };

      const result = contextBuilder.formatContext(data);

      expect(result).toContain('Organization Vision: None');
      expect(result).toContain('Active Cycle: None');
      expect(result).not.toContain('Current Weekly Score');
    });
  });
});
