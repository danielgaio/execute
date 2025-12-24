import { describe, it, expect, vi, beforeEach } from "vitest";
import { contextBuilder } from "./context-builder";
import { SupabaseClient } from "@supabase/supabase-js";
import * as planningUtils from "@/utils/planning";

// Mock dependencies
vi.mock("@/utils/planning", () => ({
  getWeekStart: vi.fn().mockReturnValue(new Date("2025-01-01")),
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
      then: undefined,
    };
    (mockChain as any).then = (resolve: any) =>
      resolve({ data: [], error: null });
    mockSupabase = mockChain;
    vi.clearAllMocks();
  });

  it("should calculate score breakdown correctly", async () => {
    // Mock Cycle
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" },
      error: null,
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
        then: undefined,
      } as any;

      if (table === "cycles") {
        chain.single.mockResolvedValue({
          data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" },
          error: null,
        });
      } else if (table === "goals") {
        chain.then = (resolve: any) => resolve({ data: [], error: null });
      } else if (table === "visions") {
        chain.single.mockResolvedValue({ data: null, error: null });
      } else if (table === "tactic_instances") {
        chain.then = (resolve: any) =>
          resolve({
            data: [
              {
                id: "1",
                status: "done",
                planned: true,
                due_date: "2025-01-01",
                tactics: { weight: 1.0 },
              },
              {
                id: "2",
                status: "pending",
                planned: true,
                due_date: "2025-01-02",
                tactics: { weight: 1.0 },
              },
            ],
            error: null,
          });
      }
      return chain;
    });

    const context = await contextBuilder.buildContext(
      mockSupabase as unknown as SupabaseClient,
      "org-1"
    );

    expect(context.weeklyScore).toBe(50);
    expect(context.scoreBreakdown).toEqual({
      totalWeight: 2.0,
      completedWeight: 1.0,
      totalItems: 2,
      completedItems: 1,
    });

    const formatted = contextBuilder.formatContext(context);
    expect(formatted).toContain(
      "Current Weekly Score: 50% (1/2 tasks completed)"
    );
  });

  it("should include team context when userId is provided", async () => {
    // Create a mock structure - simplified to just verify structure, not specific assignments
    let teamMemberCallCount = 0;
    let tacticInstanceCallCount = 0;

    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
        then: undefined,
      } as any;

      if (table === "cycles") {
        chain.single.mockResolvedValue({
          data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" },
          error: null,
        });
      } else if (table === "goals") {
        chain.then = (resolve: any) => resolve({ data: [], error: null });
      } else if (table === "visions") {
        chain.single.mockResolvedValue({ data: null, error: null });
      } else if (table === "teams") {
        chain.then = (resolve: any) =>
          resolve({
            data: [
              { id: "team-1", name: "Engineering", description: "Dev team" },
              { id: "team-2", name: "Product", description: null },
            ],
            error: null,
          });
      } else if (table === "team_members") {
        teamMemberCallCount++;

        // Calls 1-2: Count queries for teams
        if (teamMemberCallCount <= 2) {
          chain.then = (resolve: any) => resolve({ count: 2, error: null });
        }
        // Call 3: User's team memberships
        else if (teamMemberCallCount === 3) {
          chain.then = (resolve: any) =>
            resolve({ data: [{ team_id: "team-1" }], error: null });
        }
        // Calls 4+: Org members' team memberships (return dummy data)
        else {
          chain.then = (resolve: any) =>
            resolve({ data: [{ team_id: "team-1" }], error: null });
        }
      } else if (table === "org_members") {
        chain.then = (resolve: any) =>
          resolve({
            data: [
              {
                user_id: "user-1",
                role: "manager",
                profiles: { full_name: "John Doe", email: "john@example.com" },
              },
              {
                user_id: "user-2",
                role: "member",
                profiles: {
                  full_name: "Jane Smith",
                  email: "jane@example.com",
                },
              },
            ],
            error: null,
          });
      } else if (table === "tactic_instances") {
        tacticInstanceCallCount++;

        // First call: Weekly score query
        if (tacticInstanceCallCount === 1) {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
        }
        // Subsequent calls: Return dummy tactics
        else {
          chain.then = (resolve: any) =>
            resolve({
              data: [
                {
                  id: "1",
                  status: "done",
                  tactics: { assignee_user_id: "user-1" },
                },
                {
                  id: "2",
                  status: "pending",
                  tactics: { assignee_user_id: "user-1" },
                },
              ],
              error: null,
            });
        }
      }
      return chain;
    });

    const context = await contextBuilder.buildContext(
      mockSupabase as unknown as SupabaseClient,
      "org-1",
      "current-user-id"
    );

    // Verify team structure exists
    expect(context.teams).toBeDefined();
    expect(context.teams).toHaveLength(2);
    expect(context.teams?.[0].name).toBe("Engineering");
    expect(context.teams?.[0].description).toBe("Dev team");
    expect(context.teams?.[0].memberCount).toBe(2);

    expect(context.teams?.[1].name).toBe("Product");
    expect(context.teams?.[1].memberCount).toBe(2);

    // Verify current user teams
    expect(context.currentUserTeams).toEqual(["team-1"]);

    // Verify team members structure
    expect(context.teamMembers).toBeDefined();
    expect(context.teamMembers).toHaveLength(2);

    // Verify member structure (don't care about specific values, just structure)
    const member1 = context.teamMembers?.[0];
    expect(member1).toHaveProperty("userId");
    expect(member1).toHaveProperty("fullName");
    expect(member1).toHaveProperty("email");
    expect(member1).toHaveProperty("orgRole");
    expect(member1).toHaveProperty("teams");
    expect(member1).toHaveProperty("assignedTacticsCount");
    expect(member1).toHaveProperty("completedThisWeek");
    expect(member1).toHaveProperty("pendingThisWeek");

    // Verify formatted output includes team data
    const formatted = contextBuilder.formatContext(context);
    expect(formatted).toContain("TEAM STRUCTURE");
    expect(formatted).toContain("Engineering");
    expect(formatted).toContain("Product");
    expect(formatted).toContain("Your Teams:");
    expect(formatted).toContain("assigned");
  });

  it("should not include team context when userId is not provided", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
        then: undefined,
      } as any;

      if (table === "cycles") {
        chain.single.mockResolvedValue({
          data: { id: "c1", title: "Cycle 1", end_date: "2025-03-31" },
          error: null,
        });
      } else if (table === "goals") {
        chain.then = (resolve: any) => resolve({ data: [], error: null });
      } else if (table === "visions") {
        chain.single.mockResolvedValue({ data: null, error: null });
      } else if (table === "tactic_instances") {
        chain.then = (resolve: any) => resolve({ data: [], error: null });
      }
      return chain;
    });

    const context = await contextBuilder.buildContext(
      mockSupabase as unknown as SupabaseClient,
      "org-1"
    );

    expect(context.teams).toBeUndefined();
    expect(context.teamMembers).toBeUndefined();
    expect(context.currentUserTeams).toBeUndefined();

    const formatted = contextBuilder.formatContext(context);
    expect(formatted).not.toContain("TEAM STRUCTURE");
  });
});
