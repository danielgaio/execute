import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Grid,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Schedule as DeferIcon,
  Cancel as SkipIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import { createClient } from "@/utils/supabase/server";
import { getWeekStart } from "@/utils/planning";
import { updateInstanceStatus } from "./actions";
import Link from "next/link";
import { cookies } from "next/headers";

// Type for the raw Supabase query result
interface RawTacticInstance {
  id: string;
  due_date: string;
  status: string;
  planned: boolean;
  notes: string | null;
  tactics: {
    id: string;
    title: string;
    weight: number;
    recurrence: string;
  } | null;
}

// Transformed type for display (same structure but properly typed)
type TacticInstance = RawTacticInstance;

function getDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function WeekPage() {
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

  // Verify the user is actually a member of the cookie org
  const currentOrgId =
    activeOrgId && memberships.some((m) => m.org_id === activeOrgId)
      ? activeOrgId
      : memberships[0].org_id;

  const weekStart = getWeekStart();
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // Fetch all instances for current week
  const { data: instances } = await supabase
    .from("tactic_instances")
    .select(
      `
      id,
      due_date,
      status,
      planned,
      notes,
      tactics (
        id,
        title,
        weight,
        recurrence
      )
    `
    )
    .eq("org_id", currentOrgId)
    .eq("week_start", weekStartStr)
    .order("due_date", { ascending: true });

  // Group instances by day
  const instancesByDay: Record<string, TacticInstance[]> = {};
  const weekDays: string[] = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];
    weekDays.push(dayStr);
    instancesByDay[dayStr] = [];
  }

  if (instances) {
    for (const instance of instances) {
      const dayStr = instance.due_date;
      if (instancesByDay[dayStr]) {
        // Cast through unknown to handle Supabase's type inference
        const typedInstance = instance as unknown as TacticInstance;
        instancesByDay[dayStr].push(typedInstance);
      }
    }
  }

  // Calculate weekly score
  let totalWeight = 0;
  let completedWeight = 0;
  if (instances) {
    for (const instance of instances) {
      const tacticsData = instance.tactics as unknown as { weight: number } | null;
      const weight = tacticsData?.weight || 1.0;
      if (instance.planned) {
        totalWeight += weight;
        if (instance.status === "done") {
          completedWeight += weight;
        }
      }
    }
  }
  const weeklyScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 100;

  const today = new Date().toISOString().split("T")[0];

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
          <Typography variant="h4">Week View</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Week of {formatDate(weekStartStr)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Paper sx={{ px: 3, py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Weekly Score
            </Typography>
            <Typography
              variant="h4"
              color={
                weeklyScore >= 85
                  ? "success.main"
                  : weeklyScore >= 60
                  ? "warning.main"
                  : "error.main"
              }
            >
              {weeklyScore}%
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {weekDays.map((dayStr) => {
          const isToday = dayStr === today;
          const dayDate = new Date(dayStr + "T00:00:00");
          const dayInstances = instancesByDay[dayStr] || [];
          const isPast = dayStr < today;

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }} key={dayStr}>
              <Paper
                sx={{
                  p: 2,
                  minHeight: 200,
                  bgcolor: isToday ? "action.selected" : "background.paper",
                  border: isToday ? 2 : 1,
                  borderColor: isToday ? "primary.main" : "divider",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight={isToday ? "bold" : "normal"}
                    color={isToday ? "primary" : "text.primary"}
                  >
                    {getDayName(dayDate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(dayStr)}
                  </Typography>
                </Box>

                {dayInstances.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    No tactics scheduled
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {dayInstances.map((instance) => (
                      <Paper
                        key={instance.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          bgcolor:
                            instance.status === "done"
                              ? "success.50"
                              : instance.status === "skipped"
                              ? "error.50"
                              : instance.status === "deferred"
                              ? "warning.50"
                              : "background.paper",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              textDecoration:
                                instance.status === "done" ||
                                instance.status === "skipped"
                                  ? "line-through"
                                  : "none",
                              color:
                                instance.status === "done" ||
                                instance.status === "skipped"
                                  ? "text.secondary"
                                  : "text.primary",
                              flex: 1,
                            }}
                          >
                            {instance.tactics?.title || "Unknown Tactic"}
                          </Typography>
                          <Chip
                            label={`w: ${instance.tactics?.weight || 1}`}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </Box>

                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mt: 1,
                            gap: 0.5,
                          }}
                        >
                          {instance.status === "pending" ? (
                            <>
                              <Tooltip title="Mark Done">
                                <form
                                  action={updateInstanceStatus.bind(
                                    null,
                                    instance.id,
                                    "done"
                                  )}
                                >
                                  <IconButton
                                    type="submit"
                                    size="small"
                                    color="success"
                                  >
                                    <CheckIcon fontSize="small" />
                                  </IconButton>
                                </form>
                              </Tooltip>
                              <Tooltip title="Defer to Next Week">
                                <form
                                  action={updateInstanceStatus.bind(
                                    null,
                                    instance.id,
                                    "deferred"
                                  )}
                                >
                                  <IconButton
                                    type="submit"
                                    size="small"
                                    color="warning"
                                  >
                                    <DeferIcon fontSize="small" />
                                  </IconButton>
                                </form>
                              </Tooltip>
                              {isPast && (
                                <Tooltip title="Skip">
                                  <form
                                    action={updateInstanceStatus.bind(
                                      null,
                                      instance.id,
                                      "skipped"
                                    )}
                                  >
                                    <IconButton
                                      type="submit"
                                      size="small"
                                      color="error"
                                    >
                                      <SkipIcon fontSize="small" />
                                    </IconButton>
                                  </form>
                                </Tooltip>
                              )}
                            </>
                          ) : (
                            <Tooltip title="Undo">
                              <form
                                action={updateInstanceStatus.bind(
                                  null,
                                  instance.id,
                                  "pending"
                                )}
                              >
                                <IconButton type="submit" size="small">
                                  <UndoIcon fontSize="small" />
                                </IconButton>
                              </form>
                            </Tooltip>
                          )}
                        </Box>

                        {instance.status !== "pending" && (
                          <Chip
                            label={instance.status}
                            size="small"
                            color={
                              instance.status === "done"
                                ? "success"
                                : instance.status === "deferred"
                                ? "warning"
                                : "error"
                            }
                            sx={{ mt: 1 }}
                          />
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {(!instances || instances.length === 0) && (
        <Paper sx={{ p: 4, mt: 3, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            No Tactics This Week
          </Typography>
          <Typography color="text.secondary" paragraph>
            Create tactics to start tracking your weekly execution.
          </Typography>
          <Link href="/dashboard/tactics/new" passHref>
            <Button variant="contained">Create Tactic</Button>
          </Link>
        </Paper>
      )}
    </Box>
  );
}
