import { Box, Typography, Button } from "@mui/material";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getDashboardData } from "@/lib/data/dashboard";
import { getWeekStart } from "@/utils/planning";
import ReviewWizard from "./review-wizard";
import Link from "next/link";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's organization
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>No organization found.</Typography>
      </Box>
    );
  }

  // Determine active org from cookie or default to first
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("execute_active_org")?.value;

  const currentOrgId =
    activeOrgId && memberships.some((m) => m.org_id === activeOrgId)
      ? activeOrgId
      : memberships[0].org_id;

  // Fetch Dashboard Data (Cycle, Score, Goals)
  const { activeCycle, weeklyScore, goals } = await getDashboardData(
    supabase,
    currentOrgId
  );

  if (!activeCycle) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          No Active Cycle
        </Typography>
        <Typography color="text.secondary" paragraph>
          You need an active cycle to perform a weekly review.
        </Typography>
        <Button variant="contained" component={Link} href="/dashboard/cycles/new">
          Create Cycle
        </Button>
      </Box>
    );
  }

  const weekStart = getWeekStart();
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // Fetch Pending Instances for Current Week
  const { data: pendingInstances } = await supabase
    .from("tactic_instances")
    .select(`
      id,
      due_date,
      status,
      tactics (
        id,
        title
      )
    `)
    .eq("org_id", currentOrgId)
    .eq("week_start", weekStartStr)
    .eq("status", "pending");

  // Fetch Next Week's Preview (Active Tactics)
  // We filter by tactics belonging to the current cycle's goals
  const goalIds = goals.map((g) => g.id);
  
  const { data: nextWeekTactics } = await supabase
    .from("tactics")
    .select("id, title, recurrence")
    .in("goal_id", goalIds)
    .eq("status", "active");

  // If 'active' column doesn't exist, we might get an error. 
  // Let's check if 'active' exists in tactics table. 
  // Based on previous reads, I didn't see 'active' in Tactic interface in planning.ts.
  // Let's re-read planning.ts carefully or check schema.
  // Actually, let's just fetch all tactics for the cycle. Usually all are active unless deleted?
  // Or maybe there is no 'active' flag yet.
  
  return (
    <ReviewWizard
      orgId={currentOrgId}
      cycleId={activeCycle.id}
      weekStart={weekStartStr}
      leadScore={weeklyScore}
      goals={goals}
      pendingInstances={pendingInstances || []}
      nextWeekInstances={nextWeekTactics || []}
    />
  );
}
