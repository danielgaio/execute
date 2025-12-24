/**
 * Teams Page - Server Component
 *
 * Lists all teams in the organization and provides team management interface
 */

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TeamsList from "@/components/dashboard/teams-list";
import { listTeams } from "@/lib/domain/teams";
import { cookies } from "next/headers";

export default async function TeamsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get active org
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("execute_active_org")?.value;

  if (!activeOrgId) {
    redirect("/dashboard");
  }

  // Check user's role in org
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", user.id)
    .single();

  const canCreateTeams =
    membership && ["owner", "manager"].includes(membership.role);

  // Fetch teams
  const { teams, error } = await listTeams(supabase, activeOrgId);

  if (error) {
    console.error("Failed to load teams:", error);
  }

  return (
    <TeamsList
      teams={teams}
      org_id={activeOrgId}
      canCreateTeams={canCreateTeams}
    />
  );
}
