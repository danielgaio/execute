import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import TacticActions from "./tactic-actions";

interface Tactic {
  id: string;
  title: string;
  description: string | null;
  weight: number;
  recurrence: string;
  status: string;
  due_days: number[] | null;
  goals: {
    id: string;
    title: string;
  } | null;
}

// Transform raw Supabase result to typed Tactic
function toTactic(raw: Record<string, unknown>): Tactic {
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: raw.description as string | null,
    weight: raw.weight as number,
    recurrence: raw.recurrence as string,
    status: raw.status as string,
    due_days: raw.due_days as number[] | null,
    goals: raw.goals as Tactic['goals'],
  };
}

export default async function TacticsPage() {
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
          You need to start a cycle before creating tactics.
        </Typography>
        <Link href="/dashboard/cycles/new" passHref>
          <Button variant="contained">Plan New Cycle</Button>
        </Link>
      </Box>
    );
  }

  // Get all tactics for the active cycle (via goals)
  const { data: goals } = await supabase
    .from("goals")
    .select("id")
    .eq("cycle_id", activeCycle.id);

  const goalIds = goals?.map((g) => g.id) || [];

  // If no goals, don't query tactics
  if (goalIds.length === 0) {
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
            <Typography variant="h4">Tactics</Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {activeCycle.title} - Lead Indicators
            </Typography>
          </Box>
          <Link href="/dashboard/tactics/new" passHref>
            <Button variant="contained" startIcon={<AddIcon />}>
              New Tactic
            </Button>
          </Link>
        </Box>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Goals Created
          </Typography>
          <Typography color="text.secondary" paragraph>
            You need to create goals before adding tactics.
          </Typography>
          <Link href="/dashboard/goals/new" passHref>
            <Button variant="outlined">Create First Goal</Button>
          </Link>
        </Paper>
      </Box>
    );
  }

  const { data: tactics } = await supabase
    .from("tactics")
    .select(
      `
      id,
      title,
      description,
      weight,
      recurrence,
      status,
      due_days,
      goals (
        id,
        title
      )
    `
    )
    .in("goal_id", goalIds)
    .order("created_at", { ascending: false });

  const getDaysDisplay = (dueDays: number[] | null): string => {
    if (!dueDays || dueDays.length === 0) return "N/A";
    const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return dueDays.map((d) => dayNames[d]).join(", ");
  };

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
          <Typography variant="h4">Tactics</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {activeCycle.title} - Lead Indicators
          </Typography>
        </Box>
        <Link href="/dashboard/tactics/new" passHref>
          <Button variant="contained" startIcon={<AddIcon />}>
            New Tactic
          </Button>
        </Link>
      </Box>

      {tactics && tactics.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tactic</TableCell>
                <TableCell>Goal</TableCell>
                <TableCell align="center">Weight</TableCell>
                <TableCell align="center">Recurrence</TableCell>
                <TableCell align="center">Due Days</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tactics.map((tactic) => {
                const t = toTactic(tactic as Record<string, unknown>);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {t.title}
                      </Typography>
                      {t.description && (
                        <Typography variant="caption" color="text.secondary">
                          {t.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {t.goals?.title || "Unknown"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={t.weight.toFixed(1)} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={t.recurrence}
                        size="small"
                        color={
                          t.recurrence === "daily"
                            ? "primary"
                            : t.recurrence === "weekly"
                            ? "secondary"
                            : "default"
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {getDaysDisplay(t.due_days)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={t.status}
                        size="small"
                        color={t.status === "active" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TacticActions tacticId={t.id} tacticTitle={t.title} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Tactics Created
          </Typography>
          <Typography color="text.secondary" paragraph>
            Tactics are the specific actions you&apos;ll take to achieve your
            goals. Create your first tactic to start tracking your lead
            indicators.
          </Typography>
          <Link href="/dashboard/tactics/new" passHref>
            <Button variant="outlined">Create First Tactic</Button>
          </Link>
        </Paper>
      )}
    </Box>
  );
}
