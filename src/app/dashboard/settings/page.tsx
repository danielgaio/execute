import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { listOrgMembers, listTeams } from "@/lib/domain/teams";
import { listPendingInvitations } from "@/lib/domain/invitations";
import SettingsTabs from "@/components/dashboard/settings-tabs";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profileData = {
    id: user.id,
    full_name: profile?.full_name || user.user_metadata?.full_name || "",
    email: user.email || "",
    timezone: profile?.timezone || "UTC",
    locale: profile?.locale || "en",
  };

  // Get active organization from cookie
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("execute_active_org")?.value;

  // Get organization data and members if user has an active org
  let orgData = null;
  let orgMembers: any[] = [];
  let pendingInvitations: any[] = [];
  let orgTeams: { id: string; name: string }[] = [];

  if (activeOrgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", activeOrgId)
      .single();

    orgData = org;

    // Get organization members
    const membersResult = await listOrgMembers(supabase, activeOrgId);
    orgMembers = membersResult.members || [];

    // Get organization teams
    const teamsResult = await listTeams(supabase, activeOrgId);
    orgTeams = (teamsResult.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
    }));

    // Get pending invitations (only if user is manager/owner)
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", activeOrgId)
      .eq("user_id", user.id)
      .single();

    if (orgMember?.role === "owner" || orgMember?.role === "manager") {
      const invitationsResult = await listPendingInvitations(
        supabase,
        activeOrgId,
      );
      pendingInvitations = invitationsResult.invitations || [];
    }
  }

  return (
    <SettingsTabs
      profile={profileData}
      organization={orgData}
      orgMembers={orgMembers}
      pendingInvitations={pendingInvitations}
      teams={orgTeams}
    />
  );
}
