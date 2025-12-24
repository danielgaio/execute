/**
 * Team Management Domain Service
 *
 * Handles team creation, member management, and role assignments.
 * All operations are RLS-aware and respect org boundaries.
 *
 * Design Principles:
 * - Single Responsibility: Team lifecycle management
 * - Dependency Inversion: Operates on SupabaseClient interface
 * - Fail-Fast: Clear error messages for security/validation failures
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Valid role types in the system hierarchy:
 * - owner: Full org control, billing, member management
 * - manager: Team management, view all team data, facilitate WPRs
 * - member: Execute tactics, participate in WPRs
 * - viewer: Read-only access to dashboards
 */
export type OrgRole = "owner" | "manager" | "member" | "viewer";

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: OrgRole;
  added_by: string;
  added_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profile?: {
    email: string;
    full_name: string;
  };
}

export interface CreateTeamParams {
  org_id: string;
  name: string;
  description?: string;
  initial_members?: string[]; // user_ids to add immediately
}

export interface InviteMemberParams {
  org_id: string;
  email: string;
  role: OrgRole;
  team_ids?: string[]; // Optional teams to add member to
}

/**
 * Create a new team within an organization
 *
 * Requirements:
 * - User must be owner or manager in the org
 * - Team name must be unique within org
 * - Creator automatically becomes team manager
 */
export async function createTeam(
  supabase: SupabaseClient,
  params: CreateTeamParams
): Promise<{ team: Team | null; error: string | null }> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { team: null, error: "Not authenticated" };
    }

    // Verify user has permission to create teams (owner or manager)
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", params.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { team: null, error: "Insufficient permissions to create team" };
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        org_id: params.org_id,
        name: params.name,
        description: params.description,
        created_by: user.id,
      })
      .select()
      .single();

    if (teamError) {
      return { team: null, error: teamError.message };
    }

    // Add creator as manager
    const { error: memberError } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: user.id,
      role: "manager",
      added_by: user.id,
    });

    if (memberError) {
      // Cleanup team if member addition fails
      await supabase.from("teams").delete().eq("id", team.id);
      return { team: null, error: memberError.message };
    }

    // Add initial members if specified
    if (params.initial_members && params.initial_members.length > 0) {
      const memberInserts = params.initial_members.map((userId) => ({
        team_id: team.id,
        user_id: userId,
        role: "member" as OrgRole,
        added_by: user.id,
      }));

      await supabase.from("team_members").insert(memberInserts);
      // Non-critical: don't fail if some members can't be added
    }

    return { team, error: null };
  } catch (error) {
    return {
      team: null,
      error: error instanceof Error ? error.message : "Failed to create team",
    };
  }
}

/**
 * Add a member to a team
 *
 * Requirements:
 * - User must be owner, manager, or team manager
 * - Target user must be member of the org
 * - Cannot add same user twice
 */
export async function addTeamMember(
  supabase: SupabaseClient,
  team_id: string,
  user_id: string,
  role: OrgRole = "member"
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get team to check org
    const { data: team } = await supabase
      .from("teams")
      .select("org_id")
      .eq("id", team_id)
      .single();

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Verify requesting user has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", team.org_id)
      .eq("user_id", user.id)
      .single();

    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .single();

    const canManage =
      membership &&
      (["owner", "manager"].includes(membership.role) ||
        teamMembership?.role === "manager");

    if (!canManage) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Verify target user is org member
    const { data: targetMember } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", team.org_id)
      .eq("user_id", user_id)
      .single();

    if (!targetMember) {
      return {
        success: false,
        error: "User is not a member of this organization",
      };
    }

    // Add to team
    const { error: insertError } = await supabase.from("team_members").insert({
      team_id,
      user_id,
      role,
      added_by: user.id,
    });

    if (insertError) {
      // Check if already exists
      if (insertError.code === "23505") {
        return { success: false, error: "User already in team" };
      }
      return { success: false, error: insertError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add member",
    };
  }
}

/**
 * Remove a member from a team
 *
 * Requirements:
 * - User must be owner, manager, or team manager
 * - Cannot remove the last manager from a team
 */
export async function removeTeamMember(
  supabase: SupabaseClient,
  team_id: string,
  user_id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get team to check org
    const { data: team } = await supabase
      .from("teams")
      .select("org_id")
      .eq("id", team_id)
      .single();

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Verify requesting user has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", team.org_id)
      .eq("user_id", user.id)
      .single();

    const { data: teamMembership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .single();

    const canManage =
      membership &&
      (["owner", "manager"].includes(membership.role) ||
        teamMembership?.role === "manager");

    if (!canManage) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Check if removing would leave no managers
    const { data: managers } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", team_id)
      .eq("role", "manager");

    if (managers && managers.length === 1) {
      const { data: targetRole } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", team_id)
        .eq("user_id", user_id)
        .single();

      if (targetRole?.role === "manager") {
        return {
          success: false,
          error: "Cannot remove the last manager from team",
        };
      }
    }

    // Remove from team
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team_id)
      .eq("user_id", user_id);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

/**
 * Update a team member's role
 *
 * Requirements:
 * - User must be owner or manager
 * - Cannot demote the last manager
 */
export async function updateMemberRole(
  supabase: SupabaseClient,
  team_id: string,
  user_id: string,
  new_role: OrgRole
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get team to check org
    const { data: team } = await supabase
      .from("teams")
      .select("org_id")
      .eq("id", team_id)
      .single();

    if (!team) {
      return { success: false, error: "Team not found" };
    }

    // Verify requesting user has permission (owner or org manager)
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", team.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Check if demoting would leave no managers
    if (new_role !== "manager") {
      const { data: currentRole } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", team_id)
        .eq("user_id", user_id)
        .single();

      if (currentRole?.role === "manager") {
        const { data: managers } = await supabase
          .from("team_members")
          .select("id")
          .eq("team_id", team_id)
          .eq("role", "manager");

        if (managers && managers.length === 1) {
          return {
            success: false,
            error: "Cannot demote the last manager",
          };
        }
      }
    }

    // Update role
    const { error: updateError } = await supabase
      .from("team_members")
      .update({ role: new_role })
      .eq("team_id", team_id)
      .eq("user_id", user_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

/**
 * List all teams in an organization
 *
 * Respects RLS: only returns teams user has access to
 */
export async function listTeams(
  supabase: SupabaseClient,
  org_id: string
): Promise<{ teams: Team[]; error: string | null }> {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });

    if (error) {
      return { teams: [], error: error.message };
    }

    return { teams: teams || [], error: null };
  } catch (error) {
    return {
      teams: [],
      error: error instanceof Error ? error.message : "Failed to list teams",
    };
  }
}

/**
 * List all members of a team with profile information
 *
 * Respects RLS: only accessible to team members
 */
export async function listTeamMembers(
  supabase: SupabaseClient,
  team_id: string
): Promise<{
  members: (TeamMember & { profile?: { email: string; full_name: string } })[];
  error: string | null;
}> {
  try {
    const { data: members, error } = await supabase
      .from("team_members")
      .select(
        `
        *,
        profile:profiles(email, full_name)
      `
      )
      .eq("team_id", team_id)
      .order("added_at", { ascending: true });

    if (error) {
      return { members: [], error: error.message };
    }

    return { members: members || [], error: null };
  } catch (error) {
    return {
      members: [],
      error:
        error instanceof Error ? error.message : "Failed to list team members",
    };
  }
}

/**
 * List all members of an organization with profile information
 *
 * Respects RLS: only accessible to org members
 */
export async function listOrgMembers(
  supabase: SupabaseClient,
  org_id: string
): Promise<{ members: OrgMember[]; error: string | null }> {
  try {
    const { data: members, error } = await supabase
      .from("org_members")
      .select(
        `
        *,
        profile:profiles(email, full_name)
      `
      )
      .eq("org_id", org_id)
      .order("created_at", { ascending: true });

    if (error) {
      return { members: [], error: error.message };
    }

    return { members: members || [], error: null };
  } catch (error) {
    return {
      members: [],
      error:
        error instanceof Error ? error.message : "Failed to list org members",
    };
  }
}

/**
 * Update an org member's role
 *
 * Requirements:
 * - User must be owner
 * - Cannot change own role (prevents lock-out)
 * - Cannot demote the last owner
 */
export async function updateOrgMemberRole(
  supabase: SupabaseClient,
  org_id: string,
  user_id: string,
  new_role: OrgRole
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify requesting user is owner
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "owner") {
      return { success: false, error: "Only owners can change roles" };
    }

    // Cannot change own role
    if (user_id === user.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    // Check if demoting would leave no owners
    if (new_role !== "owner") {
      const { data: currentRole } = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
        .single();

      if (currentRole?.role === "owner") {
        const { data: owners } = await supabase
          .from("org_members")
          .select("id")
          .eq("org_id", org_id)
          .eq("role", "owner");

        if (owners && owners.length === 1) {
          return {
            success: false,
            error: "Cannot demote the last owner",
          };
        }
      }
    }

    // Update role
    const { error: updateError } = await supabase
      .from("org_members")
      .update({ role: new_role })
      .eq("org_id", org_id)
      .eq("user_id", user_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}
