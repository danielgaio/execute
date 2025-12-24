"use client";

import { useState, useTransition } from "react";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Divider,
  Card,
  CardContent,
  Stack,
  Chip,
  Grid,
} from "@mui/material";
import { submitWeeklyReview } from "./actions";
import { Goal } from "@/lib/domain/goals";

interface ReviewWizardProps {
  orgId: string;
  cycleId: string;
  weekStart: string;
  leadScore: number;
  goals: Goal[];
  pendingInstances: any[];
  nextWeekInstances: any[]; // Preview
}

const steps = ["Review Score", "Reflect", "Clean Up", "Plan Next Week"];

export default function ReviewWizard({
  orgId,
  cycleId,
  weekStart,
  leadScore,
  goals,
  pendingInstances,
  nextWeekInstances,
}: ReviewWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<"defer" | "skip" | "none">(
    "defer"
  );
  const [isPending, startTransition] = useTransition();

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = () => {
    startTransition(async () => {
      // Calculate lag status summary
      const onTrack = goals.filter(
        (g) => g.status === "on_track" || g.status === "completed"
      ).length;
      const lagStatus = `${onTrack}/${goals.length} Goals On Track`;

      await submitWeeklyReview(orgId, cycleId, weekStart, {
        leadScore,
        lagStatus,
        notes,
        pendingAction,
        pendingInstanceIds: pendingInstances.map((i) => i.id),
      });
    });
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 800, mx: "auto", mt: 4 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 4, minHeight: 400 }}>
        {activeStep === 0 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Week of {weekStart}
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      EXECUTION SCORE
                    </Typography>
                    <Typography variant="h2" color="primary.main">
                      {leadScore}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      GOAL STATUS
                    </Typography>
                    <Stack spacing={1}>
                      {goals.map((goal) => (
                        <Box
                          key={goal.id}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="body2">{goal.title}</Typography>
                          <Chip
                            label={goal.status?.replace("_", " ")}
                            size="small"
                            color={
                              goal.status === "on_track" ? "success" : "warning"
                            }
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Reflection
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              What went well this week? What blocked you? Any wins to celebrate?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              placeholder="Write your weekly review notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Clean Up Pending Items
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              You have {pendingInstances.length} pending items from this week.
              What should we do with them?
            </Typography>

            {pendingInstances.length > 0 ? (
              <>
                <List
                  dense
                  sx={{
                    bgcolor: "background.paper",
                    mb: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  {pendingInstances.map((instance) => (
                    <ListItem key={instance.id}>
                      <ListItemText
                        primary={instance.tactics?.title}
                        secondary={`Due: ${instance.due_date}`}
                      />
                    </ListItem>
                  ))}
                </List>

                <FormControl component="fieldset">
                  <FormLabel component="legend">Action</FormLabel>
                  <RadioGroup
                    value={pendingAction}
                    onChange={(e) => setPendingAction(e.target.value as any)}
                  >
                    <FormControlLabel
                      value="defer"
                      control={<Radio />}
                      label="Defer to Next Week (Recommended)"
                    />
                    <FormControlLabel
                      value="skip"
                      control={<Radio />}
                      label="Mark as Skipped (Will lower score)"
                    />
                    <FormControlLabel
                      value="none"
                      control={<Radio />}
                      label="Do Nothing (Leave as Pending)"
                    />
                  </RadioGroup>
                </FormControl>
              </>
            ) : (
              <Typography color="success.main">
                All clear! No pending items.
              </Typography>
            )}
          </Box>
        )}

        {activeStep === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Plan Next Week
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Here is a preview of your plan for next week based on your
              recurring tactics.
            </Typography>

            <List dense>
              {nextWeekInstances.length > 0 ? (
                nextWeekInstances.map((instance, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={instance.title}
                      secondary={
                        instance.recurrence === "weekly"
                          ? "Weekly Recurring"
                          : "One-off"
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                  No items scheduled yet. They will be generated when you
                  commit.
                </Typography>
              )}
            </List>
          </Box>
        )}
      </Paper>

      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext} disabled={isPending}>
          {activeStep === steps.length - 1
            ? isPending
              ? "Committing..."
              : "Commit & Start Next Week"
            : "Next"}
        </Button>
      </Box>
    </Box>
  );
}
