import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPlanningStatusTool, suggestTacticsTool, reviewPlanFeasibilityTool, generateWeeklyPlanTool } from "./planning-tools";
import { SupabaseClient } from "@supabase/supabase-js";
import { embeddingService } from "../embedding-service";
import { generateWeeklyPlan } from "../../domain/planning";

// Mock dependencies
vi.mock('../embedding-service', () => ({
  embeddingService: {
    searchEmbeddings: vi.fn()
  }
}));

vi.mock("../../domain/planning", () => ({
  generateWeeklyPlan: vi.fn()
}));

describe("Planning Tools", () => {
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

  describe("get_planning_status", () => {
    it("should return status with no active cycle or vision", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: null })
                })
              })
            })
          };
        }
        if (table === "visions") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null })
              })
            })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      const result = await getPlanningStatusTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.status.hasActiveCycle).toBe(false);
      expect(result.data.status.hasVision).toBe(false);
      expect(result.data.nextSteps).toContain("Create a Vision statement.");
      expect(result.data.nextSteps).toContain("Create a new 12-week Cycle.");
    });

    it("should return status with active cycle and vision but no goals", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "cycles") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ 
                    data: { id: "cycle-1", title: "Q1", start_date: "2025-01-01", end_date: "2025-03-31" }, 
                    error: null 
                  })
                })
              })
            })
          };
        }
        if (table === "visions") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ 
                  data: { id: "vision-1", content_md: "World domination" }, 
                  error: null 
                })
              })
            })
          };
        }
        if (table === "goals") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null })
            })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      const result = await getPlanningStatusTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.status.hasActiveCycle).toBe(true);
      expect(result.data.status.hasVision).toBe(true);
      expect(result.data.status.goalCount).toBe(0);
      expect(result.data.nextSteps).toContain("Create Goals for the active Cycle.");
    });
  });

  describe('suggest_tactics_for_goal', () => {
    it('should return relevant tactics from embeddings', async () => {
      const mockEmbeddings = [
        {
          content: 'Call 50 leads per week',
          metadata: { entity_type: 'tactic' },
          similarity: 0.8
        },
        {
          content: 'Revenue Goal Q1',
          metadata: { entity_type: 'goal' },
          similarity: 0.7
        }
      ];

      (embeddingService.searchEmbeddings as any).mockResolvedValue(mockEmbeddings);

      const result = await suggestTacticsTool.handler(
        { goalDescription: 'Increase sales' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toHaveLength(1);
      expect(result.data.suggestions[0].content).toBe('Call 50 leads per week');
      expect(result.data.context).toHaveLength(2);
    });

    it('should handle empty results gracefully', async () => {
      (embeddingService.searchEmbeddings as any).mockResolvedValue([]);

      const result = await suggestTacticsTool.handler(
        { goalDescription: 'Unique goal' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.suggestions).toBe("No direct past tactics found.");
    });
  });

  describe('review_plan_feasibility', () => {
    it('should flag goals without tactics', async () => {
      // Mock active cycle
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cycles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { id: 'cycle-1' } })
                })
              })
            })
          };
        }
        if (table === 'goals') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { title: 'Empty Goal', tactics: [] },
                  { title: 'Good Goal', tactics: [{ title: 'T1', weight: 1 }] }
                ]
              })
            })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      const result = await reviewPlanFeasibilityTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.issues).toContain('Goal "Empty Goal" has no tactics.');
      expect(result.data.score).toBe(50); // Has issues
    });

    it('should warn about high weekly load', async () => {
       // Mock active cycle
       mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cycles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { id: 'cycle-1' } })
                })
              })
            })
          };
        }
        if (table === 'goals') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { 
                    title: 'Heavy Goal', 
                    tactics: Array(20).fill({ title: 'Small Task', weight: 1.0 })
                  }
                ]
              })
            })
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      });

      const result = await reviewPlanFeasibilityTool.handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.warnings).toContain('Total weekly tactic count is high (20). Ensure you have capacity to execute all of them consistently.');
      expect(result.data.warnings).toContain('Goal "Heavy Goal" has many tactics (20). Consider simplifying or focusing on the most impactful ones.');
    });
  });

  describe("generate_weekly_plan", () => {
    it("should call domain service and return success", async () => {
      (generateWeeklyPlan as any).mockResolvedValue({ generated: 5, errors: 0 });

      const result = await generateWeeklyPlanTool.handler({ weekStart: "2025-01-01" }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("Created 5 instances");
      expect(generateWeeklyPlan).toHaveBeenCalledWith(mockContext.supabase, mockContext.orgId, expect.any(Date));
    });
  });
});
