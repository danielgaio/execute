import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCycleTool, createGoalTool, createTacticTool, markTacticCompleteTool, deferTacticTool } from "./action-tools";
import * as auditService from "../audit-service";
import * as embeddingService from "../embedding-service";
import * as planningUtils from "@/utils/planning";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("../audit-service", () => ({
  logAgentAction: vi.fn(),
  captureEntityState: vi.fn().mockResolvedValue({ status: "pending" }),
}));

vi.mock("../embedding-service", () => ({
  embeddingService: {
    indexCycle: vi.fn(),
    indexGoal: vi.fn(),
    indexTactic: vi.fn(),
  },
}));

vi.mock("@/utils/planning", () => ({
  generateTacticInstancesForWeek: vi.fn(),
  getWeekStart: vi.fn().mockReturnValue("2025-01-01"),
}));

describe("Action Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    // Mock Supabase client with chainable methods
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    mockContext = {
      userId: "user-123",
      orgId: "org-123",
      supabase: mockSupabase as unknown as SupabaseClient,
    };

    vi.clearAllMocks();
  });

  describe("create_cycle", () => {
    it("should create a cycle and log action", async () => {
      const mockCycle = { id: "cycle-1", title: "Q1 2025" };
      mockSupabase.single.mockResolvedValue({ data: mockCycle, error: null });

      const result = await createCycleTool.handler(
        { title: "Q1 2025", start_date: "2025-01-01", end_date: "2025-03-31" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("cycles");
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        title: "Q1 2025",
        org_id: "org-123",
      }));
      expect(embeddingService.embeddingService.indexCycle).toHaveBeenCalled();
      expect(auditService.logAgentAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "create",
          entityType: "cycle",
          metadata: expect.objectContaining({ confirmed: true }),
        })
      );
    });

    it("should handle errors gracefully", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: new Error("DB Error") });

      const result = await createCycleTool.handler(
        { title: "Q1 2025", start_date: "2025-01-01", end_date: "2025-03-31" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB Error");
    });
  });

  describe("create_goal", () => {
    it("should create a goal and log action", async () => {
      const mockGoal = { id: "goal-1", title: "Revenue" };
      mockSupabase.single.mockResolvedValue({ data: mockGoal, error: null });

      const result = await createGoalTool.handler(
        { cycle_id: "cycle-1", title: "Revenue", target: 100000 },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("goals");
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        title: "Revenue",
        target: 100000,
      }));
      expect(embeddingService.embeddingService.indexGoal).toHaveBeenCalled();
      expect(auditService.logAgentAction).toHaveBeenCalled();
    });
  });

  describe("create_tactic", () => {
    it("should create a tactic and generate instances", async () => {
      const mockTactic = { id: "tactic-1", title: "Cold Calls" };
      mockSupabase.single.mockResolvedValue({ data: mockTactic, error: null });

      const result = await createTacticTool.handler(
        { goal_id: "goal-1", title: "Cold Calls" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("tactics");
      expect(planningUtils.generateTacticInstancesForWeek).toHaveBeenCalledWith(
        expect.anything(),
        "tactic-1",
        expect.anything(),
        "org-123"
      );
      expect(auditService.logAgentAction).toHaveBeenCalled();
    });
  });

  describe("mark_tactic_complete", () => {
    it("should update tactic instance and log action", async () => {
      const mockInstance = { id: "inst-1", status: "done", tactics: { title: "Task" } };
      // First call for update returns error: null (update doesn't return data unless select is chained, but here we mock the flow)
      // Actually the code does update().eq().eq(). Then select().eq().single()
      
      // We need to mock the chain for update separately from select if possible, or just make single return what we need
      // The code: await context.supabase.from().update()...; if(error) throw; const {data} = await context.supabase.from().select()...
      
      // Mock update response (no error)
      mockSupabase.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
      
      // Mock select response
      mockSupabase.select.mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: mockInstance, error: null }) }) });

      const result = await markTacticCompleteTool.handler(
        { instance_id: "inst-1", notes: "Done" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(auditService.captureEntityState).toHaveBeenCalled(); // Before state
      expect(auditService.logAgentAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "update",
          entityType: "tactic_instance",
          metadata: expect.objectContaining({ confirmed: true }),
        })
      );
    });
  });

  describe("defer_tactic", () => {
    it("should defer tactic instance and log action", async () => {
      // Mock update response
      mockSupabase.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });

      const result = await deferTacticTool.handler(
        { instance_id: "inst-1", reason: "Too busy" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(auditService.logAgentAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "update",
          entityType: "tactic_instance",
          metadata: expect.objectContaining({ defer_reason: "Too busy" }),
        })
      );
    });
  });
});
