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

  beforeEach(() => {
    mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
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

      // User is manager
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { role: "manager" },
          error: null,
        })
        // Team created
        .mockResolvedValueOnce({
          data: mockTeam,
          error: null,
        });

      // Team member added
      mockSupabase.insert.mockResolvedValueOnce({
        data: null,
        error: null,
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
      // User is only a member
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: "member" },
        error: null,
      });

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

      // User is owner
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Team created
        .mockResolvedValueOnce({
          data: mockTeam,
          error: null,
        });

      // Team member added (creator)
      mockSupabase.insert
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Initial members added
        .mockResolvedValueOnce({
          data: null,
          error: null,
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
      // Get team
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: "org-789" },
          error: null,
        })
        // Check user permission
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Check team membership
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Check target user is org member
        .mockResolvedValueOnce({
          data: { id: "membership-123" },
          error: null,
        });

      mockSupabase.insert.mockResolvedValueOnce({
        data: null,
        error: null,
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
      // Get team
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: "org-789" },
          error: null,
        })
        // Check user permission
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Check team membership
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Target user is NOT org member
        .mockResolvedValueOnce({
          data: null,
          error: null,
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
      // Get team
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: "org-789" },
          error: null,
        })
        // Check user permission
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Get current role
        .mockResolvedValueOnce({
          data: { role: "member" },
          error: null,
        });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
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
      // Get team
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { org_id: "org-789" },
          error: null,
        })
        // Check user permission
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Get current role (is manager)
        .mockResolvedValueOnce({
          data: { role: "manager" },
          error: null,
        });

      // Get all managers (only 1)
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: "member-1" }],
        error: null,
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
      // Check user permission
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: "owner" },
        error: null,
      });

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
      // Check user permission
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        })
        // Get current role of target
        .mockResolvedValueOnce({
          data: { role: "owner" },
          error: null,
        });

      // Get all owners (only 1)
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: "owner-1" }],
        error: null,
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
