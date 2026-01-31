/**
 * Team Detail Page - Server Component
 *
 * Shows team members and provides member management interface
 */

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { listTeamMembers, listOrgMembers } from "@/lib/domain/teams";
import TeamMembersList from "@/components/dashboard/team-members-list";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: team_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get team info
  const { data: team } = await supabase
    .from("teams")
    .select("*, organization:organizations(name)")
    .eq("id", team_id)
    .single();

  if (!team) {
    redirect("/dashboard/teams");
  }

  // Check user's permissions
  const { data: orgMembership } = await supabase
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

  const canManage = Boolean(
    orgMembership &&
    (["owner", "manager"].includes(orgMembership.role) ||
      teamMembership?.role === "manager"),
  );

  // Fetch team members
  const { members: teamMembers } = await listTeamMembers(supabase, team_id);

  // Fetch available org members (for adding)
  const { members: orgMembers } = await listOrgMembers(supabase, team.org_id);

  // Filter out members already in team
  const availableMembers = orgMembers.filter(
    (om) => !teamMembers.some((tm) => tm.user_id === om.user_id),
  );

  return (
    <TeamMembersList
      team={team}
      members={teamMembers}
      availableMembers={availableMembers}
      canManage={canManage}
    />
  );
}
