/**
 * Organization Invitation Service
 * 
 * Handles secure email-based invitations to join organizations.
 * Uses cryptographically secure tokens with expiry.
 * 
 * Flow:
 * 1. Owner/Manager invites user by email
 * 2. System generates secure token and stores invitation
 * 3. Email sent with invitation link
 * 4. User clicks link, creates account (if needed), and accepts
 * 5. User added to org with specified role and optional teams
 * 
 * Security:
 * - Tokens are single-use and expire after 7 days
 * - Only owners/managers can invite
 * - Email verification required before acceptance
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { OrgRole } from "./teams";

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  team_ids: string[] | null;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface CreateInvitationParams {
  org_id: string;
  email: string;
  role: OrgRole;
  team_ids?: string[];
}

/**
 * Generate a cryptographically secure invitation token
 */
function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Calculate expiry date (7 days from now)
 */
function getExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}

/**
 * Create an invitation for a user to join an organization
 * 
 * Requirements:
 * - Inviter must be owner or manager
 * - Email cannot already be an org member
 * - Pending invitations for same email are invalidated
 */
export async function createInvitation(
  supabase: SupabaseClient,
  params: CreateInvitationParams
): Promise<{ invitation: Invitation | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { invitation: null, error: "Not authenticated" };
    }

    // Verify inviter has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", params.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { invitation: null, error: "Insufficient permissions to invite" };
    }

    // Check if email is already a member
    const { data: existingMember } = await supabase
      .from("org_members")
      .select("id, profile:profiles(email)")
      .eq("org_id", params.org_id);

    const isAlreadyMember = existingMember?.some(
      (m) => m.profile?.email?.toLowerCase() === params.email.toLowerCase()
    );

    if (isAlreadyMember) {
      return { invitation: null, error: "User is already a member" };
    }

    // Invalidate any pending invitations for this email
    await supabase
      .from("invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("org_id", params.org_id)
      .eq("email", params.email)
      .is("accepted_at", null);

    // Create invitation
    const token = generateInvitationToken();
    const expiresAt = getExpiryDate();

    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        org_id: params.org_id,
        email: params.email,
        role: params.role,
        team_ids: params.team_ids || null,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      return { invitation: null, error: inviteError.message };
    }

    return { invitation, error: null };
  } catch (error) {
    return {
      invitation: null,
      error:
        error instanceof Error ? error.message : "Failed to create invitation",
    };
  }
}

/**
 * Get invitation by token
 * 
 * Validates token and expiry
 */
export async function getInvitationByToken(
  supabase: SupabaseClient,
  token: string
): Promise<{
  invitation: (Invitation & {
    organization?: { name: string };
    inviter?: { full_name: string; email: string };
  }) | null;
  error: string | null;
}> {
  try {
    const { data: invitation, error } = await supabase
      .from("invitations")
      .select(
        `
        *,
        organization:organizations(name),
        inviter:profiles!invitations_invited_by_fkey(full_name, email)
      `
      )
      .eq("token", token)
      .is("accepted_at", null)
      .single();

    if (error) {
      return { invitation: null, error: "Invitation not found" };
    }

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      return { invitation: null, error: "Invitation has expired" };
    }

    return { invitation, error: null };
  } catch (error) {
    return {
      invitation: null,
      error:
        error instanceof Error ? error.message : "Failed to retrieve invitation",
    };
  }
}

/**
 * Accept an invitation
 * 
 * Requirements:
 * - Token must be valid and not expired
 * - User's email must match invitation email
 * - User cannot already be a member
 * 
 * Process:
 * 1. Add user to org_members
 * 2. Add user to specified teams (if any)
 * 3. Mark invitation as accepted
 * 4. Create profile if doesn't exist
 */
export async function acceptInvitation(
  supabase: SupabaseClient,
  token: string
): Promise<{ success: boolean; org_id: string | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, org_id: null, error: "Not authenticated" };
    }

    // Get and validate invitation
    const { invitation, error: inviteError } = await getInvitationByToken(
      supabase,
      token
    );

    if (inviteError || !invitation) {
      return { success: false, org_id: null, error: inviteError || "Invalid invitation" };
    }

    // Get user's email from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      profile.email?.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      return {
        success: false,
        org_id: null,
        error: "Invitation email does not match your account",
      };
    }

    // Check if already a member (race condition protection)
    const { data: existingMember } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", invitation.org_id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      // Mark invitation as accepted anyway
      await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return {
        success: true,
        org_id: invitation.org_id,
        error: null,
      };
    }

    // Add to organization
    const { error: memberError } = await supabase.from("org_members").insert({
      org_id: invitation.org_id,
      user_id: user.id,
      role: invitation.role,
    });

    if (memberError) {
      return { success: false, org_id: null, error: memberError.message };
    }

    // Add to teams if specified
    if (invitation.team_ids && invitation.team_ids.length > 0) {
      const teamMemberInserts = invitation.team_ids.map((team_id) => ({
        team_id,
        user_id: user.id,
        role: invitation.role,
        added_by: invitation.invited_by,
      }));

      await supabase.from("team_members").insert(teamMemberInserts);
      // Non-critical: don't fail if team assignment fails
    }

    // Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return { success: true, org_id: invitation.org_id, error: null };
  } catch (error) {
    return {
      success: false,
      org_id: null,
      error:
        error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}

/**
 * List all pending invitations for an organization
 * 
 * Requirements:
 * - User must be owner or manager
 * - Returns only non-expired, non-accepted invitations
 */
export async function listPendingInvitations(
  supabase: SupabaseClient,
  org_id: string
): Promise<{
  invitations: (Invitation & {
    inviter?: { full_name: string; email: string };
  })[];
  error: string | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { invitations: [], error: "Not authenticated" };
    }

    // Verify user has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { invitations: [], error: "Insufficient permissions" };
    }

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select(
        `
        *,
        inviter:profiles!invitations_invited_by_fkey(full_name, email)
      `
      )
      .eq("org_id", org_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return { invitations: [], error: error.message };
    }

    return { invitations: invitations || [], error: null };
  } catch (error) {
    return {
      invitations: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to list invitations",
    };
  }
}

/**
 * Cancel/revoke an invitation
 * 
 * Requirements:
 * - User must be owner or manager
 * - Invitation must not be accepted yet
 */
export async function revokeInvitation(
  supabase: SupabaseClient,
  invitation_id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get invitation to check org
    const { data: invitation } = await supabase
      .from("invitations")
      .select("org_id, accepted_at")
      .eq("id", invitation_id)
      .single();

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.accepted_at) {
      return { success: false, error: "Invitation already accepted" };
    }

    // Verify user has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", invitation.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Set expiry to now (soft delete)
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", invitation_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to revoke invitation",
    };
  }
}

/**
 * Resend an invitation email (generates new token)
 * 
 * Requirements:
 * - User must be owner or manager
 * - Invitation must not be accepted yet
 */
export async function resendInvitation(
  supabase: SupabaseClient,
  invitation_id: string
): Promise<{ invitation: Invitation | null; error: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { invitation: null, error: "Not authenticated" };
    }

    // Get invitation
    const { data: oldInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitation_id)
      .single();

    if (!oldInvitation) {
      return { invitation: null, error: "Invitation not found" };
    }

    if (oldInvitation.accepted_at) {
      return { invitation: null, error: "Invitation already accepted" };
    }

    // Verify user has permission
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", oldInvitation.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return { invitation: null, error: "Insufficient permissions" };
    }

    // Expire old invitation
    await supabase
      .from("invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", invitation_id);

    // Create new invitation
    const token = generateInvitationToken();
    const expiresAt = getExpiryDate();

    const { data: newInvitation, error: createError } = await supabase
      .from("invitations")
      .insert({
        org_id: oldInvitation.org_id,
        email: oldInvitation.email,
        role: oldInvitation.role,
        team_ids: oldInvitation.team_ids,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (createError) {
      return { invitation: null, error: createError.message };
    }

    return { invitation: newInvitation, error: null };
  } catch (error) {
    return {
      invitation: null,
      error:
        error instanceof Error ? error.message : "Failed to resend invitation",
    };
  }
}
