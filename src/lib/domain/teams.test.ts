/**
 * Team Management Domain Logic Tests
 *
 * Tests the team creation, member management, and role assignment logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  updateOrgMemberRole,
  listTeams,
  listTeamMembers,
} from "./teams";

describe("Team Management Domain", () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    // Create a proper query builder mock that chains correctly
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => {
        // Return fresh mock for each query chain
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: mockQueryBuilder.single,
          order: vi.fn().mockReturnThis(),
        };
      }),
    };
  });

  describe("createTeam", () => {
    it("should create a team when user is a manager", async () => {
      const mockTeam = {
        id: "team-456",
        org_id: "org-789",
        name: "Engineering",
        description: "Engineering team",
        created_by: mockUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call: check org membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "manager" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Second call: create team
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockTeam,
              error: null,
            }),
          };
        } else {
          // Third call: add team member
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await createTeam(mockSupabase, {
        org_id: "org-789",
        name: "Engineering",
        description: "Engineering team",
      });

      expect(result.team).toEqual(mockTeam);
      expect(result.error).toBeNull();
    });

    it("should fail when user lacks permissions", async () => {
      // Mock: User is only a member
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: "member" },
          error: null,
        }),
      }));

      const result = await createTeam(mockSupabase, {
        org_id: "org-789",
        name: "Engineering",
      });

      expect(result.team).toBeNull();
      expect(result.error).toContain("Insufficient permissions");
    });

    it("should add initial members if specified", async () => {
      const mockTeam = {
        id: "team-456",
        org_id: "org-789",
        name: "Engineering",
        created_by: mockUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call: check org membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Second call: create team
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockTeam,
              error: null,
            }),
          };
        } else {
          // Subsequent calls: add team members
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await createTeam(mockSupabase, {
        org_id: "org-789",
        name: "Engineering",
        initial_members: ["user-111", "user-222"],
      });

      expect(result.team).toEqual(mockTeam);
      expect(result.error).toBeNull();
    });
  });

  describe("addTeamMember", () => {
    it("should add a member when user has permission", async () => {
      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // Get team
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-789" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Check user permission
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          // Check team membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        } else if (callCount === 4) {
          // Check target user is org member
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "membership-123" },
              error: null,
            }),
          };
        } else {
          // Insert team member
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await addTeamMember(
        mockSupabase,
        "team-456",
        "user-target",
        "member"
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should fail when target user is not an org member", async () => {
      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // Get team
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-789" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Check user permission
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          // Check team membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        } else {
          // Target user is NOT org member
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await addTeamMember(
        mockSupabase,
        "team-456",
        "user-external",
        "member"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a member of this organization");
    });
  });

  describe("updateMemberRole", () => {
    it("should update a team member's role", async () => {
      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // Get team
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-789" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Check user permission
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 4) {
          // Get current role - needs double eq
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "member" },
              error: null,
            }),
          };
        } else {
          // Update role - needs double eq
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await updateMemberRole(
        mockSupabase,
        "team-456",
        "user-target",
        "manager"
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should prevent demoting the last manager", async () => {
      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // Get team
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { org_id: "org-789" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Check user permission
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          // Get current role (is manager) - needs double eq
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "manager" },
              error: null,
            }),
          };
        } else {
          // Get all managers (only 1) - needs double eq, returns data directly
          const mockEq = vi.fn().mockResolvedValue({
            data: [{ id: "member-1" }],
            error: null,
          });
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => ({ eq: mockEq })),
          };
        }
      });

      const result = await updateMemberRole(
        mockSupabase,
        "team-456",
        "user-target",
        "member"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot demote the last manager");
    });
  });

  describe("updateOrgMemberRole", () => {
    it("should prevent user from changing own role", async () => {
      // Mock: Check user permission
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: "owner" },
          error: null,
        }),
      }));

      const result = await updateOrgMemberRole(
        mockSupabase,
        "org-789",
        mockUser.id, // Same as authenticated user
        "member"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot change your own role");
    });

    it("should prevent demoting the last owner", async () => {
      // Mock sequence of queries
      let callCount = 0;
      mockSupabase.from = vi.fn(() => {
        callCount++;
        
        if (callCount === 1) {
          // Check user permission
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Get current role of target
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else {
          // Get all owners (only 1) - needs double eq, returns data directly
          const mockEq = vi.fn().mockResolvedValue({
            data: [{ id: "owner-1" }],
            error: null,
          });
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(() => ({ eq: mockEq })),
          };
        }
      });

      const result = await updateOrgMemberRole(
        mockSupabase,
        "org-789",
        "user-other",
        "manager"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot demote the last owner");
    });
  });
});
