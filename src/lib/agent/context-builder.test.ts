import { describe, it, expect, vi, beforeEach } from "vitest";
import { contextBuilder } from "./context-builder";
import { SupabaseClient } from "@supabase/supabase-js";
import * as planningUtils from "@/utils/planning";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue("2025-01-01"),
}));

vi.mock("./audit-service", () => ({
  getRecentAuditActivity: vi.fn().mockResolvedValue([]),
}));

describe("Context Builder", () => {
  let mockSupabase: any;

  beforeEach(() => {
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      then: undefined
    };
    (mockChain as any).then = (resolve: any) => resolve({ data: [], error: null });
    mockSupabase = mockChain;
    vi.clearAllMocks();
  });

  it("should calculate score breakdown correctly", async () => {
    // Mock Cycle
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" }, 
      error: null 
    });

    // Mock Goals
    // The code calls single() for cycle, then select() for goals.
    // We need to mock the sequence of calls or just mock the implementation of 'from' based on table name.
    
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
        then: undefined
      } as any;

      if (table === "cycles") {
        chain.single.mockResolvedValue({ data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" }, error: null });
      } else if (table === "goals") {
        chain.then = (resolve: any) => resolve({ data: [], error: null });
      } else if (table === "visions") {
        chain.single.mockResolvedValue({ data: null, error: null });
      } else if (table === "tactic_instances") {
        chain.then = (resolve: any) => resolve({ 
          data: [
            { id: "1", status: "done", planned: true, due_date: "2025-01-01", tactics: { weight: 1.0 } },
            { id: "2", status: "pending", planned: true, due_date: "2025-01-02", tactics: { weight: 1.0 } }
          ], 
          error: null 
        });
      }
      return chain;
    });

    const context = await contextBuilder.buildContext(mockSupabase as unknown as SupabaseClient, "org-1");

    expect(context.weeklyScore).toBe(50);
    expect(context.scoreBreakdown).toEqual({
      totalWeight: 2.0,
      completedWeight: 1.0,
      totalItems: 2,
      completedItems: 1
    });
    
    const formatted = contextBuilder.formatContext(context);
    expect(formatted).toContain("Current Weekly Score: 50% (1/2 tasks completed)");
  });
});
