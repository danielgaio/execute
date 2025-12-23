import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPlanningStatusTool } from "./planning-tools";
import { SupabaseClient } from "@supabase/supabase-js";

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
});
