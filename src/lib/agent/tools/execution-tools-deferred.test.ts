import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDailyBriefingTool } from "./execution-tools";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
}));

vi.mock("./analysis-tools", () => ({
  predictScoreTool: { handler: vi.fn().mockResolvedValue({ success: false }) },
  suggestAdjustmentsTool: { handler: vi.fn().mockResolvedValue({ success: false }) }
}));

describe("Execution Tools - Deferred Handling", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    mockSupabase = {};
    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };
    vi.clearAllMocks();
  });

  it("should exclude deferred items from daily briefing queries", async () => {
    // Mock Active Cycle
    const mockCycle = { id: "c1", title: "Q1", start_date: "2025-01-01", end_date: "2025-03-31" };
    
    const cycleChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCycle, error: null })
    };

    // Mock Tactic Instances Chain
    const instancesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [], error: null })
    };

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cycles") return cycleChain;
      if (table === "tactic_instances") return instancesChain;
      return {};
    });

    await getDailyBriefingTool.handler({}, mockContext);

    // Verify "Todays" query (call #1 to tactic_instances)
    // It should have .neq("status", "deferred")
    // Verify "Overdue" query (call #2 to tactic_instances)
    // It should have .neq("status", "deferred")

    // Since we reuse the chain mock, we just check if it was called at all with these args
    expect(instancesChain.neq).toHaveBeenCalledWith("status", "deferred");
    
    // To be more precise, we can check call count.
    // 1. Todays: .neq("status", "deferred")
    // 2. Overdue: .neq("status", "done") AND .neq("status", "deferred")
    // 3. Score: No neq calls (it gets all for the week)
    
    // So neq("status", "deferred") should be called at least twice.
    const deferredCalls = instancesChain.neq.mock.calls.filter(args => args[0] === "status" && args[1] === "deferred");
    expect(deferredCalls.length).toBeGreaterThanOrEqual(2);
  });
});
