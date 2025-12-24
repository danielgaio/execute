import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeTacticByNameTool } from "./completion-tools";

describe("Completion Tools", () => {
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

  describe("complete_tactic_by_name", () => {
    it("should complete a tactic if exactly one match found", async () => {
      const mockInstance = {
        id: "inst-1",
        due_date: "2025-01-01",
        status: "pending",
        tactics: { id: "t1", title: "Write Report" }
      };

      // Mock Search
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({ data: [mockInstance], error: null }),
        update: vi.fn().mockReturnThis(), // For update call
        single: vi.fn().mockResolvedValue({ data: mockInstance, error: null }) // For captureEntityState
      });

      // Mock Update (second call to from)
      // We need to handle the chain carefully or just rely on the first mock returning a chain that handles everything
      // The tool calls:
      // 1. from('tactic_instances').select...ilike -> returns candidates
      // 2. captureEntityState -> from('tactic_instances').select...single
      // 3. from('tactic_instances').update...eq
      
      // Let's refine the mock to handle these distinct calls if needed, 
      // or just assume the chain is permissive.
      
      // Mock Update specifically
      const updateMock = vi.fn().mockResolvedValue({ error: null });
      const eqMock = vi.fn().mockReturnValue({ eq: updateMock }); // .eq().eq()
      
      // We can use mockImplementation to return different chains
      mockSupabase.from.mockImplementation((table: string) => {
          return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockResolvedValue({ data: [mockInstance], error: null }),
              single: vi.fn().mockResolvedValue({ data: mockInstance, error: null }),
              update: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockResolvedValue({ error: null })
                  })
              })
          }
      });

      const result = await completeTacticByNameTool.handler(
        { tactic_name: "Report", notes: "Done" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("Marked \"Write Report\" as complete");
    });

    it("should fail if no matches found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      const result = await completeTacticByNameTool.handler(
        { tactic_name: "Nonexistent" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not find any pending tactic");
    });

    it("should fail if multiple matches found", async () => {
      const matches = [
        { id: "1", tactics: { title: "Report A" }, due_date: "2025-01-01" },
        { id: "2", tactics: { title: "Report B" }, due_date: "2025-01-02" }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({ data: matches, error: null })
      });

      const result = await completeTacticByNameTool.handler(
        { tactic_name: "Report" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Found multiple matching tactics");
    });
  });
});
