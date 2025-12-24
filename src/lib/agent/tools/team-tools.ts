/**
 * Team Management Agent Tools
 *
 * Provides conversational interfaces for team operations:
 * - Creating teams
 * - Inviting members
 * - Managing roles
 * - Listing teams and members
 *
 * All tools respect RLS and require appropriate permissions.
 */

import { z } from "zod";
import type { AgentTool } from "../types";
import {
  createTeam,
  listTeams,
  listTeamMembers,
  listOrgMembers,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  updateOrgMemberRole,
} from "@/lib/domain/teams";
import {
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
} from "@/lib/domain/invitations";
import { EmailService } from "@/lib/email/service";

/**
 * List all teams in the organization
 */
export const listTeamsTool: AgentTool = {
  name: "list_teams",
  description:
    "Get all teams in the organization. Useful for understanding team structure and finding team IDs for member operations.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
  }),
  handler: async (args, context) => {
    const { teams, error } = await listTeams(context.supabase, args.org_id);

    if (error) {
      return {
        success: false,
        error: `Failed to list teams: ${error}`,
      };
    }

    if (teams.length === 0) {
      return {
        success: true,
        data: {
          message: "No teams found. Create one with create_team tool.",
          teams: [],
        },
      };
    }

    return {
      success: true,
      data: {
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          created_at: t.created_at,
        })),
      },
    };
  },
};

/**
 * List members of a specific team
 */
export const listTeamMembersTool: AgentTool = {
  name: "list_team_members",
  description:
    "Get all members of a specific team with their roles. Use this to see team composition before making changes.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    team_id: z.string().uuid().describe("Team ID"),
  }),
  handler: async (args, context) => {
    const { members, error } = await listTeamMembers(
      context.supabase,
      args.team_id
    );

    if (error) {
      return {
        success: false,
        error: `Failed to list team members: ${error}`,
      };
    }

    if (members.length === 0) {
      return {
        success: true,
        data: {
          message: "This team has no members yet.",
          members: [],
        },
      };
    }

    return {
      success: true,
      data: {
        members: members.map((m) => ({
          user_id: m.user_id,
          name: m.profile?.full_name || "Unknown",
          email: m.profile?.email,
          role: m.role,
          added_at: m.added_at,
        })),
      },
    };
  },
};

/**
 * List all organization members
 */
export const listOrgMembersTool: AgentTool = {
  name: "list_org_members",
  description:
    "Get all members of the organization with their org-level roles. Use this to see who can be added to teams.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
  }),
  handler: async (args, context) => {
    const { members, error } = await listOrgMembers(
      context.supabase,
      args.org_id
    );

    if (error) {
      return {
        success: false,
        error: `Failed to list org members: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        members: members.map((m) => ({
          user_id: m.user_id,
          name: m.profile?.full_name || "Unknown",
          email: m.profile?.email,
          role: m.role,
          created_at: m.created_at,
        })),
      },
    };
  },
};

/**
 * Create a new team
 */
export const createTeamTool: AgentTool = {
  name: "create_team",
  description:
    "Create a new team within the organization. Only owners and managers can create teams. The creator automatically becomes a team manager.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
    name: z
      .string()
      .min(1)
      .describe("Team name (e.g., 'Engineering', 'Sales')"),
    description: z.string().optional().describe("Optional team description"),
  }),
  handler: async (args, context) => {
    const { team, error } = await createTeam(context.supabase, {
      org_id: args.org_id,
      name: args.name,
      description: args.description,
    });

    if (error) {
      return {
        success: false,
        error: `Failed to create team: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: `Team "${args.name}" created successfully! You are now a manager of this team.`,
        team_id: team?.id,
        team_name: team?.name,
      },
    };
  },
};

/**
 * Invite a member to the organization
 */
export const inviteMemberTool: AgentTool = {
  name: "invite_member",
  description:
    "Send an email invitation for someone to join the organization. Only owners and managers can invite. The invitation expires in 7 days.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
    email: z.string().email().describe("Email address of person to invite"),
    role: z
      .enum(["owner", "manager", "member", "viewer"])
      .describe("Org-level role to assign"),
    team_ids: z
      .array(z.string().uuid())
      .optional()
      .describe("Optional list of team IDs to add member to"),
  }),
  handler: async (args, context) => {
    const { invitation, error } = await createInvitation(context.supabase, {
      org_id: args.org_id,
      email: args.email,
      role: args.role,
      team_ids: args.team_ids,
    });

    if (error || !invitation) {
      return {
        success: false,
        error: `Failed to create invitation: ${error}`,
      };
    }

    // Get org and user info for email
    const { data: org } = await context.supabase
      .from("organizations")
      .select("name")
      .eq("id", args.org_id)
      .single();

    const {
      data: { user },
    } = await context.supabase.auth.getUser();
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user?.id || "")
      .single();

    // Send invitation email
    await EmailService.sendInvitation(
      args.email,
      org?.name || "Execute Organization",
      profile?.full_name || "A team member",
      args.role,
      invitation.token
    );

    return {
      success: true,
      data: {
        message: `Invitation sent to ${args.email}! They have 7 days to accept.`,
        invitation_id: invitation.id,
      },
    };
  },
};

/**
 * List pending invitations
 */
export const listInvitationsTool: AgentTool = {
  name: "list_pending_invitations",
  description:
    "Get all pending (not yet accepted) invitations for the organization. Only owners and managers can view invitations.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
  }),
  handler: async (args, context) => {
    const { invitations, error } = await listPendingInvitations(
      context.supabase,
      args.org_id
    );

    if (error) {
      return {
        success: false,
        error: `Failed to list invitations: ${error}`,
      };
    }

    if (invitations.length === 0) {
      return {
        success: true,
        data: {
          message: "No pending invitations.",
          invitations: [],
        },
      };
    }

    return {
      success: true,
      data: {
        invitations: invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          invited_by: i.inviter?.full_name || "Unknown",
          expires_at: i.expires_at,
          created_at: i.created_at,
        })),
      },
    };
  },
};

/**
 * Add a member to a team
 */
export const addTeamMemberTool: AgentTool = {
  name: "add_team_member",
  description:
    "Add an existing org member to a team. User must already be a member of the organization. Only owners, managers, or team managers can add members.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    team_id: z.string().uuid().describe("Team ID"),
    user_id: z.string().uuid().describe("User ID to add (must be org member)"),
    role: z
      .enum(["manager", "member", "viewer"])
      .default("member")
      .describe("Team role to assign"),
  }),
  handler: async (args, context) => {
    const { success, error } = await addTeamMember(
      context.supabase,
      args.team_id,
      args.user_id,
      args.role
    );

    if (error) {
      return {
        success: false,
        error: `Failed to add team member: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: `Member added to team successfully as ${args.role}.`,
      },
    };
  },
};

/**
 * Remove a member from a team
 */
export const removeTeamMemberTool: AgentTool = {
  name: "remove_team_member",
  description:
    "Remove a member from a team. Cannot remove the last manager. Only owners, managers, or team managers can remove members.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    team_id: z.string().uuid().describe("Team ID"),
    user_id: z.string().uuid().describe("User ID to remove"),
  }),
  handler: async (args, context) => {
    const { success, error } = await removeTeamMember(
      context.supabase,
      args.team_id,
      args.user_id
    );

    if (error) {
      return {
        success: false,
        error: `Failed to remove team member: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: "Member removed from team successfully.",
      },
    };
  },
};

/**
 * Update a team member's role
 */
export const updateTeamMemberRoleTool: AgentTool = {
  name: "update_team_member_role",
  description:
    "Change a team member's role. Cannot demote the last manager. Only owners and org managers can change roles.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    team_id: z.string().uuid().describe("Team ID"),
    user_id: z.string().uuid().describe("User ID whose role to change"),
    new_role: z
      .enum(["manager", "member", "viewer"])
      .describe("New role to assign"),
  }),
  handler: async (args, context) => {
    const { success, error } = await updateMemberRole(
      context.supabase,
      args.team_id,
      args.user_id,
      args.new_role
    );

    if (error) {
      return {
        success: false,
        error: `Failed to update role: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: `Role updated to ${args.new_role} successfully.`,
      },
    };
  },
};

/**
 * Update an org member's role
 */
export const updateOrgMemberRoleTool: AgentTool = {
  name: "update_org_member_role",
  description:
    "Change an organization member's org-level role. Cannot change your own role or demote the last owner. Only owners can change roles.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    org_id: z.string().uuid().describe("Organization ID"),
    user_id: z.string().uuid().describe("User ID whose role to change"),
    new_role: z
      .enum(["owner", "manager", "member", "viewer"])
      .describe("New org-level role"),
  }),
  handler: async (args, context) => {
    const { success, error } = await updateOrgMemberRole(
      context.supabase,
      args.org_id,
      args.user_id,
      args.new_role
    );

    if (error) {
      return {
        success: false,
        error: `Failed to update role: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: `Org role updated to ${args.new_role} successfully.`,
      },
    };
  },
};

/**
 * Revoke a pending invitation
 */
export const revokeInvitationTool: AgentTool = {
  name: "revoke_invitation",
  description:
    "Cancel a pending invitation. The invitation link will no longer work. Only owners and managers can revoke invitations.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    invitation_id: z.string().uuid().describe("Invitation ID to revoke"),
  }),
  handler: async (args, context) => {
    const { success, error } = await revokeInvitation(
      context.supabase,
      args.invitation_id
    );

    if (error) {
      return {
        success: false,
        error: `Failed to revoke invitation: ${error}`,
      };
    }

    return {
      success: true,
      data: {
        message: "Invitation revoked successfully.",
      },
    };
  },
};

/**
 * Export all team management tools
 */
export const teamTools: AgentTool[] = [
  listTeamsTool,
  listTeamMembersTool,
  listOrgMembersTool,
  createTeamTool,
  inviteMemberTool,
  listInvitationsTool,
  addTeamMemberTool,
  removeTeamMemberTool,
  updateTeamMemberRoleTool,
  updateOrgMemberRoleTool,
  revokeInvitationTool,
];
