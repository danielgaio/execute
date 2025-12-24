"use client";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { toggleInstanceStatus } from "@/app/dashboard/actions";
import { getPerformanceStatus } from "@/lib/domain/scoring";
import { useTransition } from "react";
import DailyBriefingButton from "./daily-briefing-button";
import GoalsCard from "./goals-card";
import QuickAddTask from "./quick-add-task";
import VisionCard from "./vision-card";
import { Goal } from "@/lib/domain/goals";
import { ParsedVision } from "@/lib/domain/vision";

interface ExecutionDashboardProps {
  activeCycle: any;
  weeklyScore: number;
  todaysInstances: any[];
  overdueInstances: any[];
  goals: Goal[];
  vision: ParsedVision | null;
}

export default function ExecutionDashboard({
  activeCycle,
  weeklyScore,
  todaysInstances,
  overdueInstances,
  goals,
  vision,
}: ExecutionDashboardProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (id: string, status: string) => {
    startTransition(async () => {
      await toggleInstanceStatus(id, status);
    });
  };

  const performanceStatus = getPerformanceStatus(weeklyScore);
  const statusColor =
    performanceStatus === "Critical"
      ? "error"
      : performanceStatus === "At Risk"
      ? "warning"
      : performanceStatus === "On Track"
      ? "info"
      : "success";

  const daysRemaining = activeCycle
    ? Math.ceil(
        (new Date(activeCycle.end_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const totalDays = activeCycle
    ? Math.ceil(
        (new Date(activeCycle.end_date).getTime() -
          new Date(activeCycle.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 1;

  const cycleProgress = activeCycle
    ? Math.min(100, Math.max(0, ((totalDays - daysRemaining) / totalDays) * 100))
    : 0;

  return (
    <Grid container spacing={3}>
      {/* Score Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: "100%", position: "relative", overflow: "visible" }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              WEEKLY EXECUTION SCORE
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", mb: 1 }}>
              <Typography variant="h2" color={`${statusColor}.main`} fontWeight="bold">
                {weeklyScore}%
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ ml: 1 }}>
                {performanceStatus}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={weeklyScore}
              color={statusColor}
              sx={{ height: 8, borderRadius: 4, mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Keep executing your lead measures to drive results.
            </Typography>
            <QuickAddTask goals={goals} />
            
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Cycle Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(cycleProgress)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={cycleProgress} 
                sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover' }} 
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>


      {/* Vision Card (Replaces Cycle Progress for now, or we can move Cycle Progress elsewhere) */}
      <Grid item xs={12} md={4}>
        <VisionCard vision={vision} />
      </Grid>

      {/* Goals Card (Lag Indicators) */}
      <Grid item xs={12} md={4}>
        <GoalsCard goals={goals} cycleProgress={cycleProgress} />
      </Grid>

            <LinearProgress
              variant="determinate"
              value={weeklyScore}
              color={statusColor}
              sx={{ height: 10, borderRadius: 5, mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              Keep executing your lead indicators to drive results.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Cycle Status Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: "100%" }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              ACTIVE CYCLE
            </Typography>
            <Typography variant="h5" gutterBottom>
              {activeCycle?.title || "No Active Cycle"}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <CalendarIcon color="action" fontSize="small" />
              <Typography variant="body1">
                {daysRemaining} days remaining
              </Typography>
            </Stack>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <LinearProgress
                variant="determinate"
                value={cycleProgress}
                sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(cycleProgress)}%
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Quick Actions / Stats */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: "100%", bgcolor: "primary.main", color: "primary.contrastText" }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="subtitle2" color="inherit" sx={{ opacity: 0.8 }} gutterBottom>
                  TODAY'S FOCUS
                </Typography>
                <Typography variant="h3" fontWeight="bold">
                  {todaysInstances.filter((i) => i.status === "pending").length}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Tasks remaining today
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1 }}>
                 {/* We can't put the button directly here if it uses secondary color which might clash. 
                     Let's just put a small icon or keep it simple. 
                     Actually, let's put the button in the Task List header instead. */}
              </Box>
            </Box>
            
            {overdueInstances.length > 0 && (
              <Box sx={{ mt: 2, bgcolor: "error.dark", p: 1, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon fontSize="small" />
                <Typography variant="body2" fontWeight="bold">
                  {overdueInstances.length} Overdue Items
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Task List */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Execution Plan
              </Typography>
              <DailyBriefingButton />
            </Box>
            <List>
              {overdueInstances.map((instance) => (
                <ListItem
                  key={instance.id}
                  secondaryAction={
                    <Chip label="Overdue" color="error" size="small" />
                  }
                  disablePadding
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={instance.status === "done"}
                      onChange={() => handleToggle(instance.id, instance.status)}
                      disabled={isPending}
                      color="error"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={instance.tactics?.title}
                    secondary={`Due: ${instance.due_date}`}
                    primaryTypographyProps={{
                      color: "error.main",
                      fontWeight: "medium",
                    }}
                  />
                </ListItem>
              ))}
              
              {todaysInstances.map((instance) => (
                <ListItem
                  key={instance.id}
                  disablePadding
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={instance.status === "done"}
                      onChange={() => handleToggle(instance.id, instance.status)}
                      disabled={isPending}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={instance.tactics?.title}
                    secondary={instance.tactics?.weight ? `Weight: ${instance.tactics.weight}` : null}
                    sx={{
                      textDecoration: instance.status === "done" ? "line-through" : "none",
                      opacity: instance.status === "done" ? 0.6 : 1,
                    }}
                  />
                </ListItem>
              ))}

              {todaysInstances.length === 0 && overdueInstances.length === 0 && (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    No tasks scheduled for today.
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Ask the agent to "Plan my week" if this seems wrong.
                  </Typography>
                </Box>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
