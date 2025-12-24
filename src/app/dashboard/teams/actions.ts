"use server";

/**
 * Server Actions for Team Management
 *
 * Provides form actions for team operations with proper validation and error handling.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  updateOrgMemberRole,
  type OrgRole,
} from "@/lib/domain/teams";
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  resendInvitation,
} from "@/lib/domain/invitations";
import { EmailService } from "@/lib/email/service";

/**
 * Create a new team
 */
export async function createTeamAction(formData: FormData) {
  const supabase = await createClient();
  const org_id = formData.get("org_id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | undefined;

  if (!name?.trim()) {
    return { error: "Team name is required" };
  }

  const { team, error } = await createTeam(supabase, {
    org_id,
    name: name.trim(),
    description: description?.trim(),
  });

  if (error) {
    return { error };
  }

  revalidatePath("/dashboard/teams");
  return { success: true, team_id: team?.id };
}

/**
 * Add a member to a team
 */
export async function addTeamMemberAction(
  team_id: string,
  user_id: string,
  role: OrgRole = "member"
) {
  const supabase = await createClient();
  const result = await addTeamMember(supabase, team_id, user_id, role);

  if (result.success) {
    revalidatePath("/dashboard/teams");
    revalidatePath(`/dashboard/teams/${team_id}`);
  }

  return result;
}

/**
 * Remove a member from a team
 */
export async function removeTeamMemberAction(team_id: string, user_id: string) {
  const supabase = await createClient();
  const result = await removeTeamMember(supabase, team_id, user_id);

  if (result.success) {
    revalidatePath("/dashboard/teams");
    revalidatePath(`/dashboard/teams/${team_id}`);
  }

  return result;
}

/**
 * Update a team member's role
 */
export async function updateTeamMemberRoleAction(
  team_id: string,
  user_id: string,
  new_role: OrgRole
) {
  const supabase = await createClient();
  const result = await updateMemberRole(supabase, team_id, user_id, new_role);

  if (result.success) {
    revalidatePath("/dashboard/teams");
    revalidatePath(`/dashboard/teams/${team_id}`);
  }

  return result;
}

/**
 * Update an org member's role
 */
export async function updateOrgMemberRoleAction(
  org_id: string,
  user_id: string,
  new_role: OrgRole
) {
  const supabase = await createClient();
  const result = await updateOrgMemberRole(supabase, org_id, user_id, new_role);

  if (result.success) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/teams");
  }

  return result;
}

/**
 * Invite a member to the organization
 */
export async function inviteMemberAction(formData: FormData) {
  const supabase = await createClient();
  const org_id = formData.get("org_id") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as OrgRole;
  const teamIdsRaw = formData.get("team_ids") as string | null;

  // Parse team IDs if provided (comma-separated)
  const team_ids = teamIdsRaw
    ? teamIdsRaw.split(",").filter((id) => id.trim())
    : undefined;

  if (!email?.trim()) {
    return { error: "Email is required" };
  }

  if (!["owner", "manager", "member", "viewer"].includes(role)) {
    return { error: "Invalid role" };
  }

  const { invitation, error } = await createInvitation(supabase, {
    org_id,
    email: email.trim().toLowerCase(),
    role,
    team_ids,
  });

  if (error || !invitation) {
    return { error: error || "Failed to create invitation" };
  }

  // Get org name and inviter name for email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", org_id)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id || "")
    .single();

  // Send invitation email
  await EmailService.sendInvitation(
    email,
    org?.name || "Execute Organization",
    profile?.full_name || "A team member",
    role,
    invitation.token
  );

  revalidatePath("/dashboard/settings");
  return { success: true, invitation_id: invitation.id };
}

/**
 * Accept an invitation (called from acceptance page)
 */
export async function acceptInvitationAction(token: string) {
  const supabase = await createClient();
  const { success, org_id, error } = await acceptInvitation(supabase, token);

  if (error || !success) {
    return { error: error || "Failed to accept invitation" };
  }

  // Set active org cookie
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  if (org_id) {
    cookieStore.set("execute_active_org", org_id);
  }

  revalidatePath("/dashboard");
  return { success: true, org_id };
}

/**
 * Revoke an invitation
 */
export async function revokeInvitationAction(invitation_id: string) {
  const supabase = await createClient();
  const result = await revokeInvitation(supabase, invitation_id);

  if (result.success) {
    revalidatePath("/dashboard/settings");
  }

  return result;
}

/**
 * Resend an invitation
 */
export async function resendInvitationAction(invitation_id: string) {
  const supabase = await createClient();
  const { invitation, error } = await resendInvitation(supabase, invitation_id);

  if (error || !invitation) {
    return { error: error || "Failed to resend invitation" };
  }

  // Get org name and inviter name for email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", invitation.org_id)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id || "")
    .single();

  // Send invitation email
  await EmailService.sendInvitation(
    invitation.email,
    org?.name || "Execute Organization",
    profile?.full_name || "A team member",
    invitation.role,
    invitation.token
  );

  revalidatePath("/dashboard/settings");
  return { success: true };
}
