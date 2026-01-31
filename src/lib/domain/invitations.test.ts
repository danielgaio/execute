/**
 * Invitation Domain Logic Tests
 *
 * Tests the invitation creation, validation, acceptance, and management logic.
 * Critical for security: validates token handling, expiry checks, and permission enforcement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  listPendingInvitations,
  revokeInvitation,
  resendInvitation,
} from "./invitations";

// Note: We don't mock crypto - the token generation is deterministic enough for testing
// The actual token value doesn't matter as long as it's generated

describe("Invitation Domain Service", () => {
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      id: "user-123",
      email: "admin@example.com",
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(),
    };
  });

  describe("createInvitation", () => {
    it("should create an invitation when user is owner", async () => {
      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
        token: "dGVzdC10b2tlbi1ieXRlcy1oZXJlLTMyY2hhcnMhIQ",
        invited_by: mockUser.id,
        expires_at: expect.any(String),
        accepted_at: null,
        created_at: new Date().toISOString(),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // Check inviter's org membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Check if email is already a member
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        } else if (callCount === 3) {
          // Invalidate pending invitations
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        } else {
          // Create invitation
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        }
      });

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });

      expect(result.invitation).toMatchObject({
        id: "inv-123",
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });
      expect(result.error).toBeNull();
    });

    it("should create an invitation when user is manager", async () => {
      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
        token: "test-token",
        invited_by: mockUser.id,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "manager" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        } else if (callCount === 3) {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        } else {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        }
      });

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });

      expect(result.invitation).not.toBeNull();
      expect(result.error).toBeNull();
    });

    it("should fail when user is only a member (no permission)", async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: "member" },
          error: null,
        }),
      }));

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Insufficient permissions to invite");
    });

    it("should fail when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Not authenticated");
    });

    it("should fail when email is already a member", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else {
          // Return existing member with matching email
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  { id: "member-1", profile: { email: "newuser@example.com" } },
                ],
                error: null,
              }),
          };
        }
      });

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
      });

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("User is already a member");
    });

    it("should include team_ids when specified", async () => {
      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
        team_ids: ["team-1", "team-2"],
        token: "test-token",
        invited_by: mockUser.id,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        } else if (callCount === 3) {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        } else {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        }
      });

      const result = await createInvitation(mockSupabase, {
        org_id: "org-456",
        email: "newuser@example.com",
        role: "member",
        team_ids: ["team-1", "team-2"],
      });

      expect(result.invitation?.team_ids).toEqual(["team-1", "team-2"]);
    });
  });

  describe("getInvitationByToken", () => {
    it("should return invitation for valid token", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "user@example.com",
        role: "member",
        token: "valid-token",
        expires_at: futureDate.toISOString(),
        accepted_at: null,
        organization: { name: "Test Org" },
        inviter: { full_name: "Admin User", email: "admin@example.com" },
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvitation,
          error: null,
        }),
      }));

      const result = await getInvitationByToken(mockSupabase, "valid-token");

      expect(result.invitation).toMatchObject({
        id: "inv-123",
        email: "user@example.com",
        organization: { name: "Test Org" },
      });
      expect(result.error).toBeNull();
    });

    it("should fail for expired token", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockInvitation = {
        id: "inv-123",
        token: "expired-token",
        expires_at: pastDate.toISOString(),
        accepted_at: null,
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvitation,
          error: null,
        }),
      }));

      const result = await getInvitationByToken(mockSupabase, "expired-token");

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Invitation has expired");
    });

    it("should fail for non-existent token", async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      }));

      const result = await getInvitationByToken(mockSupabase, "invalid-token");

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Invitation not found");
    });
  });

  describe("acceptInvitation", () => {
    it("should accept invitation when email matches", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "admin@example.com",
        role: "member",
        team_ids: null,
        expires_at: futureDate.toISOString(),
        accepted_at: null,
        invited_by: "inviter-123",
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // getInvitationByToken query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else if (callCount === 2) {
          // Get user profile
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { email: "admin@example.com" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          // Check existing membership
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          };
        } else if (callCount === 4) {
          // Insert org_member
          return {
            insert: vi.fn().mockResolvedValue({
              data: { id: "member-new" },
              error: null,
            }),
          };
        } else {
          // Update invitation accepted_at
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await acceptInvitation(mockSupabase, "valid-token");

      expect(result.success).toBe(true);
      expect(result.org_id).toBe("org-456");
      expect(result.error).toBeNull();
    });

    it("should fail when email does not match", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "other@example.com", // Different email
        role: "member",
        expires_at: futureDate.toISOString(),
        accepted_at: null,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { email: "admin@example.com" }, // User's actual email
              error: null,
            }),
          };
        }
      });

      const result = await acceptInvitation(mockSupabase, "valid-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation email does not match your account");
    });

    it("should handle already being a member gracefully", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "admin@example.com",
        role: "member",
        expires_at: futureDate.toISOString(),
        accepted_at: null,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { email: "admin@example.com" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          // Already a member
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "existing-member" },
              error: null,
            }),
          };
        } else {
          // Mark as accepted
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
      });

      const result = await acceptInvitation(mockSupabase, "valid-token");

      // Should succeed even if already a member
      expect(result.success).toBe(true);
      expect(result.org_id).toBe("org-456");
    });

    it("should fail when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await acceptInvitation(mockSupabase, "valid-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("should add user to teams when team_ids specified", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitation = {
        id: "inv-123",
        org_id: "org-456",
        email: "admin@example.com",
        role: "member",
        team_ids: ["team-1", "team-2"],
        expires_at: futureDate.toISOString(),
        accepted_at: null,
        invited_by: "inviter-123",
      };

      const insertedTeamMembers: any[] = [];

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { email: "admin@example.com" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          };
        } else if (callCount === 4) {
          return {
            insert: vi.fn().mockResolvedValue({
              data: { id: "member-new" },
              error: null,
            }),
          };
        } else if (callCount === 5 && table === "team_members") {
          // Track team member inserts
          return {
            insert: vi.fn().mockImplementation((data: any) => {
              insertedTeamMembers.push(...data);
              return Promise.resolve({ data: null, error: null });
            }),
          };
        } else {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
      });

      const result = await acceptInvitation(mockSupabase, "valid-token");

      expect(result.success).toBe(true);
      expect(insertedTeamMembers).toHaveLength(2);
      expect(insertedTeamMembers[0].team_id).toBe("team-1");
      expect(insertedTeamMembers[1].team_id).toBe("team-2");
    });
  });

  describe("listPendingInvitations", () => {
    it("should return pending invitations for owners", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockInvitations = [
        {
          id: "inv-1",
          email: "user1@example.com",
          role: "member",
          expires_at: futureDate.toISOString(),
          accepted_at: null,
          inviter: { full_name: "Admin", email: "admin@example.com" },
        },
        {
          id: "inv-2",
          email: "user2@example.com",
          role: "manager",
          expires_at: futureDate.toISOString(),
          accepted_at: null,
          inviter: { full_name: "Admin", email: "admin@example.com" },
        },
      ];

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockInvitations,
              error: null,
            }),
          };
        }
      });

      const result = await listPendingInvitations(mockSupabase, "org-456");

      expect(result.invitations).toHaveLength(2);
      expect(result.error).toBeNull();
    });

    it("should fail when user is not owner or manager", async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: "member" },
          error: null,
        }),
      }));

      const result = await listPendingInvitations(mockSupabase, "org-456");

      expect(result.invitations).toEqual([]);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should fail when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await listPendingInvitations(mockSupabase, "org-456");

      expect(result.invitations).toEqual([]);
      expect(result.error).toBe("Not authenticated");
    });
  });

  describe("revokeInvitation", () => {
    it("should revoke invitation when user is owner", async () => {
      const mockInvitation = {
        org_id: "org-456",
        accepted_at: null,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          };
        } else {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
      });

      const result = await revokeInvitation(mockSupabase, "inv-123");

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should fail when invitation is already accepted", async () => {
      const mockInvitation = {
        org_id: "org-456",
        accepted_at: new Date().toISOString(),
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockInvitation,
          error: null,
        }),
      }));

      const result = await revokeInvitation(mockSupabase, "inv-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation already accepted");
    });

    it("should fail when invitation not found", async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }));

      const result = await revokeInvitation(mockSupabase, "inv-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation not found");
    });

    it("should fail when user lacks permission", async () => {
      const mockInvitation = {
        org_id: "org-456",
        accepted_at: null,
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockInvitation,
              error: null,
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "member" },
              error: null,
            }),
          };
        }
      });

      const result = await revokeInvitation(mockSupabase, "inv-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
    });
  });

  describe("resendInvitation", () => {
    it("should create new invitation with fresh token and expiry", async () => {
      const oldInvitation = {
        id: "inv-old",
        org_id: "org-456",
        email: "user@example.com",
        role: "member",
        team_ids: ["team-1"],
        accepted_at: null,
      };

      const newInvitation = {
        id: "inv-new",
        org_id: "org-456",
        email: "user@example.com",
        role: "member",
        team_ids: ["team-1"],
        token: "new-fresh-token",
        invited_by: mockUser.id,
        expires_at: expect.any(String),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: oldInvitation,
              error: null,
            }),
          };
        } else if (callCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: "manager" },
              error: null,
            }),
          };
        } else if (callCount === 3) {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        } else {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: newInvitation,
              error: null,
            }),
          };
        }
      });

      const result = await resendInvitation(mockSupabase, "inv-old");

      expect(result.invitation).toMatchObject({
        id: "inv-new",
        email: "user@example.com",
        role: "member",
      });
      expect(result.error).toBeNull();
    });

    it("should fail when invitation is already accepted", async () => {
      const oldInvitation = {
        id: "inv-old",
        org_id: "org-456",
        email: "user@example.com",
        accepted_at: new Date().toISOString(),
      };

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: oldInvitation,
          error: null,
        }),
      }));

      const result = await resendInvitation(mockSupabase, "inv-old");

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Invitation already accepted");
    });

    it("should fail when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await resendInvitation(mockSupabase, "inv-old");

      expect(result.invitation).toBeNull();
      expect(result.error).toBe("Not authenticated");
    });
  });
});
