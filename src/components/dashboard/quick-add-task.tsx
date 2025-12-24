"use client";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useState, useTransition } from "react";
import { createOneOffTask } from "@/app/dashboard/actions";
import { Goal } from "@/lib/domain/goals";

interface QuickAddTaskProps {
  goals: Goal[];
}

export default function QuickAddTask({ goals }: QuickAddTaskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    if (goals.length > 0) {
      setGoalId(goals[0].id);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTitle("");
  };

  const handleSubmit = () => {
    if (!title || !goalId || !date) return;

    startTransition(async () => {
      await createOneOffTask(goalId, title, date);
      handleClose();
    });
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleOpen}
        fullWidth
        sx={{ mb: 2 }}
      >
        Add Task
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Add One-Off Task</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Task Title"
              fullWidth
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            
            <TextField
              select
              label="Linked Goal"
              fullWidth
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            >
              {goals.map((goal) => (
                <MenuItem key={goal.id} value={goal.id}>
                  {goal.title}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Due Date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={isPending || !title || !goalId}
          >
            {isPending ? "Adding..." : "Add Task"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
