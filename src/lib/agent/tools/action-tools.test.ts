import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCycleTool, createGoalTool, createTacticTool, markTacticCompleteTool, deferTacticTool, updateTacticTool, bulkUpdateTacticsTool, deleteTacticTool } from "./action-tools";
import * as auditService from "../audit-service";
import * as embeddingService from "../embedding-service";
import * as planningUtils from "@/utils/planning";
import * as planningDomain from "@/lib/domain/planning";
import * as executionDomain from "@/lib/domain/execution";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("../audit-service", () => ({
  logAgentAction: vi.fn(),
  captureEntityState: vi.fn().mockImplementation(async (supabase, table, id) => {
    // Return mock data for the test case
    if (id === "inst-1") {
      return {
        id: "inst-1",
        tactic_id: "tac-1",
        due_date: "2025-01-01",
        week_start: "2024-12-30",
        tactics: { title: "My Task" }
      };
    }
    return { status: "pending" };
  }),
}));

vi.mock("../embedding-service", () => ({
  embeddingService: {
    indexCycle: vi.fn(),
    indexGoal: vi.fn(),
    indexTactic: vi.fn(),
    indexVision: vi.fn(),
  },
}));

vi.mock("@/utils/planning", () => ({
  generateTacticInstancesForWeek: vi.fn(),
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
}));

vi.mock("@/lib/domain/planning", () => ({
  generateInstancesForTacticId: vi.fn(),
}));

// Mock the domain layer
vi.mock("@/lib/domain/execution", () => ({
  deferInstance: vi.fn(),
  skipInstance: vi.fn(),
}));

describe("Action Tools", () => {
  let mockSupabase: any;
  let mockContext: any;

  beforeEach(() => {
    // Mock Supabase client with chainable methods
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: undefined
    };
    
    // Make the chain awaitable by default
    (mockChain as any).then = (resolve: any) => resolve({ data: {}, error: null });

    mockSupabase = mockChain;

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
      expect(planningDomain.generateInstancesForTacticId).toHaveBeenCalledWith(
        expect.anything(),
        "tactic-1",
        expect.any(Date)
      );
      expect(auditService.logAgentAction).toHaveBeenCalled();
    });

    it("should create a tactic with specific due days", async () => {
      const mockTactic = { id: "tactic-2", title: "Weekly Report", due_days: [2, 5] }; // Tuesday, Friday
      mockSupabase.single.mockResolvedValue({ data: mockTactic, error: null });

      const result = await createTacticTool.handler(
        { goal_id: "goal-1", title: "Weekly Report", due_days: ["Tuesday", "Friday"] },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        title: "Weekly Report",
        due_days: [2, 5], // Expect Tuesday (2) and Friday (5)
      }));
    });
  });

  describe("mark_tactic_complete", () => {
    it("should update tactic instance and log action", async () => {
      const mockInstance = { id: "inst-1", status: "done", tactics: { title: "Task" } };
      
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
    it("should defer tactic instance using domain logic", async () => {
      // Mock domain response
      (executionDomain.deferInstance as any).mockResolvedValue({ nextDueDate: "2025-01-08" });

      const result = await deferTacticTool.handler(
        { instance_id: "inst-1", reason: "Too busy" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(executionDomain.deferInstance).toHaveBeenCalledWith(
        expect.anything(), // supabase
        "inst-1",
        "org-123",
        "Too busy"
      );
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

  describe("update_tactic", () => {
    it("should update tactic and log action", async () => {
      const mockTactic = { id: "tactic-1", title: "New Title", weight: 0.5 };
      
      // Mock update response
      mockSupabase.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
      
      // Mock select response
      mockSupabase.select.mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: mockTactic, error: null }) }) });

      const result = await updateTacticTool.handler(
        { tactic_id: "tactic-1", title: "New Title", weight: 0.5, due_days: [1, 3] },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("tactics");
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        title: "New Title",
        weight: 0.5,
        due_days: [1, 3],
      }));
      expect(embeddingService.embeddingService.indexTactic).toHaveBeenCalled();
      expect(auditService.logAgentAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "update",
          entityType: "tactic",
          metadata: expect.objectContaining({ confirmed: true }),
        })
      );
    });
  });

  describe("bulk_update_tactics", () => {
    it("should defer multiple instances", async () => {
      (executionDomain.deferInstance as any).mockResolvedValue({ nextDueDate: "2025-01-08" });

      const result = await bulkUpdateTacticsTool.handler(
        { instance_ids: ["inst-1", "inst-2"], action: "defer", reason: "Bulk Defer" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(executionDomain.deferInstance).toHaveBeenCalledTimes(2);
      expect(executionDomain.deferInstance).toHaveBeenCalledWith(expect.anything(), "inst-1", "org-123", "Bulk Defer");
      expect(executionDomain.deferInstance).toHaveBeenCalledWith(expect.anything(), "inst-2", "org-123", "Bulk Defer");
      expect(result.data.processed).toBe(2);
    });

    it("should skip multiple instances", async () => {
      (executionDomain.skipInstance as any).mockResolvedValue({ status: "skipped" });

      const result = await bulkUpdateTacticsTool.handler(
        { instance_ids: ["inst-3"], action: "skip", reason: "Not needed" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(executionDomain.skipInstance).toHaveBeenCalledWith(expect.anything(), "inst-3", "org-123", "Not needed");
    });

    it("should complete multiple instances", async () => {
       // Mock update for completion
       mockSupabase.update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });

       const result = await bulkUpdateTacticsTool.handler(
         { instance_ids: ["inst-4"], action: "complete", reason: "Done all" },
         mockContext
       );

       expect(result.success).toBe(true);
       expect(mockSupabase.from).toHaveBeenCalledWith("tactic_instances");
       expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: "done", notes: "Done all" }));
    });
  });

  describe("delete_tactic", () => {
    it("should delete a tactic and log action", async () => {
      // Mock captureEntityState to return a tactic
      (auditService.captureEntityState as any).mockResolvedValue({
        id: "tac-delete-1",
        title: "Tactic to Delete",
      });

      // Mock delete chain
      const deleteChain = {
        eq: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        match: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ error: null }),
      };
      mockSupabase.delete = vi.fn().mockReturnValue(deleteChain);

      const result = await deleteTacticTool.handler(
        { tactic_id: "tac-delete-1", reason: "Obsolete" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("tactics");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(auditService.logAgentAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "delete",
          entityType: "tactic",
          entityId: "tac-delete-1",
          metadata: expect.objectContaining({ reason: "Obsolete" }),
        })
      );
    });
  });
});
