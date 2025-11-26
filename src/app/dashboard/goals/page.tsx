import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  LinearProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add as AddIcon } from "@mui/icons-material";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

interface Tactic {
  id: string;
  goal_id: string;
  title: string;
  recurrence: string;
  weight: number;
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  // Get active cycle
  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id, title")
    .eq("org_id", membership.org_id)
    .eq("status", "active")
    .single();

  if (!activeCycle) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h5" gutterBottom>
          No Active Cycle
        </Typography>
        <Typography paragraph>
          You need to start a cycle before defining goals.
        </Typography>
        <Link href="/dashboard/cycles/new" passHref>
          <Button variant="contained">Plan New Cycle</Button>
        </Link>
      </Box>
    );
  }

  // Get goals for active cycle
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("cycle_id", activeCycle.id)
    .order("created_at", { ascending: false });

  // Get tactics for these goals
  const goalIds = goals?.map((g) => g.id) || [];
  const { data: tactics } = await supabase
    .from("tactics")
    .select("*")
    .in("goal_id", goalIds)
    .order("created_at", { ascending: true });

  // Group tactics by goal
  const tacticsByGoal = (tactics || []).reduce((acc, tactic) => {
    if (!acc[tactic.goal_id]) acc[tactic.goal_id] = [];
    acc[tactic.goal_id].push(tactic);
    return acc;
  }, {} as Record<string, Tactic[]>);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4">Goals & Tactics</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {activeCycle.title}
          </Typography>
        </Box>
        <Box>
          <Link
            href="/dashboard/tactics/new"
            passHref
            style={{ marginRight: 8 }}
          >
            <Button variant="outlined" startIcon={<AddIcon />}>
              Add Tactic
            </Button>
          </Link>
          <Link href="/dashboard/goals/new" passHref>
            <Button variant="contained" startIcon={<AddIcon />}>
              New Goal
            </Button>
          </Link>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {goals?.map((goal) => (
          <Grid size={{ xs: 12, md: 6 }} key={goal.id}>
            <Paper
              sx={{
                p: 3,
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">{goal.title}</Typography>
                <Chip
                  label={goal.status.replace("_", " ")}
                  color={
                    goal.status === "on_track"
                      ? "success"
                      : goal.status === "at_risk"
                      ? "warning"
                      : "error"
                  }
                  size="small"
                />
              </Box>

              <Typography variant="body2" color="text.secondary" paragraph>
                {goal.description || "No description provided."}
              </Typography>

              <Box sx={{ mt: 2, mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="body2">Progress</Typography>
                  <Typography variant="body2">
                    {goal.baseline} / {goal.target} {goal.unit}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={0} // TODO: Calculate actual progress based on lag entries
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Box sx={{ mt: "auto" }}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  Tactics (Lead Indicators)
                </Typography>
                {tacticsByGoal[goal.id]?.length > 0 ? (
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {tacticsByGoal[goal.id].map((tactic) => (
                      <Box component="li" key={tactic.id} sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          {tactic.title}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            ({tactic.recurrence}, w: {tactic.weight})
                          </Typography>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    No tactics defined yet.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}

        {(!goals || goals.length === 0) && (
          <Grid size={{ xs: 12 }}>
            <Paper
              sx={{ p: 4, textAlign: "center", bgcolor: "background.default" }}
              variant="outlined"
            >
              <Typography variant="h6" gutterBottom>
                No Goals Defined
              </Typography>
              <Typography color="text.secondary" paragraph>
                Define your Lag Indicators (Goals) for this cycle to track your
                outcomes.
              </Typography>
              <Link href="/dashboard/goals/new" passHref>
                <Button variant="outlined">Define First Goal</Button>
              </Link>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
