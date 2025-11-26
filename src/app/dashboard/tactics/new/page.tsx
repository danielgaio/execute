import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  MenuItem,
  Slider,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from "@mui/material";
import { createClient } from "@/utils/supabase/server";
import { createTactic } from "../actions";
import { redirect } from "next/navigation";

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
    .eq("status", "on_track") // Only show active goals? Or all? Let's show all non-archived/abandoned if possible, but schema has specific statuses.
    // Schema: 'on_track', 'at_risk', 'off_track', 'completed', 'abandoned'
    // Let's filter out abandoned.
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

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        New Tactic (Lead Indicator)
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Tactics are the specific, time-bound actions you will take to drive your
        Goals.
      </Typography>

      <Paper sx={{ p: 4 }}>
        <form action={createTactic}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="goal-label">Goal (Lag Indicator)</InputLabel>
            <Select
              labelId="goal-label"
              name="goal_id"
              label="Goal (Lag Indicator)"
              defaultValue={goals[0]?.id}
              required
            >
              {goals.map((goal) => (
                <MenuItem key={goal.id} value={goal.id}>
                  {goal.title}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>The goal this tactic contributes to</FormHelperText>
          </FormControl>

          <TextField
            name="title"
            label="Tactic Title"
            fullWidth
            required
            margin="normal"
            placeholder="e.g., Send 50 outreach emails"
          />

          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            margin="normal"
          />

          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography gutterBottom>Weight (Impact)</Typography>
            <Slider
              name="weight"
              defaultValue={1.0}
              step={0.1}
              marks
              min={0.1}
              max={1.0}
              valueLabelDisplay="auto"
            />
            <FormHelperText>
              How much does this tactic contribute to the goal? (1.0 = High
              Impact)
            </FormHelperText>
          </Box>

          <FormControl fullWidth margin="normal">
            <InputLabel id="recurrence-label">Recurrence</InputLabel>
            <Select
              labelId="recurrence-label"
              name="recurrence"
              label="Recurrence"
              defaultValue="weekly"
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="one_off">One-off</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
            <Button type="submit" variant="contained" size="large">
              Create Tactic
            </Button>
            <Button href="/dashboard/goals" variant="outlined" size="large">
              Cancel
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
