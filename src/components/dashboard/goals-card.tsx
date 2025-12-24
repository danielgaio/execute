"use client";

import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Chip,
} from "@mui/material";
import { Add as AddIcon, TrendingUp, TrendingDown } from "@mui/icons-material";
import { useState, useTransition } from "react";
import { updateGoalMeasurement } from "@/app/dashboard/goals/actions";
import { Goal, calculateGoalProgress, determineGoalStatus } from "@/lib/domain/goals";

interface GoalsCardProps {
  goals: Goal[];
  cycleProgress: number;
}

export default function GoalsCard({ goals, cycleProgress }: GoalsCardProps) {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpenUpdate = (goal: Goal) => {
    setSelectedGoal(goal);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedGoal(null);
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          LAG GOALS (OUTCOMES)
        </Typography>
        
        <Stack spacing={3} sx={{ mt: 2 }}>
          {goals.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No goals defined for this cycle.
            </Typography>
          ) : (
            goals.map((goal) => (
              <GoalItem 
                key={goal.id} 
                goal={goal} 
                cycleProgress={cycleProgress} 
                onUpdate={() => handleOpenUpdate(goal)} 
              />
            ))
          )}
        </Stack>
      </CardContent>

      {selectedGoal && (
        <UpdateGoalDialog
          open={open}
          onClose={handleClose}
          goal={selectedGoal}
        />
      )}
    </Card>
  );
}

function GoalItem({ goal, cycleProgress, onUpdate }: { goal: Goal; cycleProgress: number; onUpdate: () => void }) {
  const progress = calculateGoalProgress(goal);
  const status = determineGoalStatus(goal, cycleProgress);
  
  const statusColor = 
    status === 'completed' ? 'success' :
    status === 'on_track' ? 'success' :
    status === 'at_risk' ? 'warning' :
    status === 'off_track' ? 'error' : 'default';

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <Typography variant="body1" fontWeight="medium">
          {goal.title}
        </Typography>
        <Chip 
          label={status.replace('_', ' ').toUpperCase()} 
          size="small" 
          color={statusColor as any} 
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem' }}
        />
      </Box>
      
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h5" fontWeight="bold">
          {goal.current_value ?? goal.baseline}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            / {goal.target} {goal.unit}
          </Typography>
        </Typography>
        <IconButton size="small" onClick={onUpdate} color="primary">
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      <LinearProgress 
        variant="determinate" 
        value={progress} 
        color={statusColor as any}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
}

function UpdateGoalDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal }) {
  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    startTransition(async () => {
      await updateGoalMeasurement(goal.id, numValue, notes);
      onClose();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Update Progress</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {goal.title}
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label={`New Value (${goal.unit})`}
          type="number"
          fullWidth
          variant="outlined"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Notes (Optional)"
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isPending || !value}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
