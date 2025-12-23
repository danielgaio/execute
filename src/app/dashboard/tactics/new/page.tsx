import {
  Box,
  Button,
  Typography,
  Paper,
} from "@mui/material";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TacticForm from "./tactic-form";

export default async function NewTacticPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/dashboard");

  // Get active cycle
  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id, title")
    .eq("org_id", membership.org_id)
    .eq("status", "active")
    .single();

  if (!activeCycle) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" color="error" gutterBottom>
            No Active Cycle
          </Typography>
          <Typography paragraph>
            You must have an active cycle to create tactics.
          </Typography>
          <Button variant="contained" href="/dashboard/cycles/new">
            Create Cycle
          </Button>
        </Paper>
      </Box>
    );
  }

  // Get goals for the active cycle
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title")
    .eq("cycle_id", activeCycle.id)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false });

  if (!goals || goals.length === 0) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" color="warning.main" gutterBottom>
            No Goals Found
          </Typography>
          <Typography paragraph>
            You must define at least one goal (Lag Indicator) before creating
            tactics.
          </Typography>
          <Button variant="contained" href="/dashboard/goals/new">
            Create Goal
          </Button>
        </Paper>
      </Box>
    );
  }

  return <TacticForm goals={goals} />;
}
