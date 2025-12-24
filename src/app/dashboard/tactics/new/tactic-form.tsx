"use client";

import { useState } from "react";
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
  Alert,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";
import { createTactic, updateTactic } from "../actions";

interface Goal {
  id: string;
  title: string;
}

interface Tactic {
  id: string;
  title: string;
  description: string | null;
  weight: number;
  recurrence: string;
  goal_id: string;
}

interface TacticFormProps {
  goals: Goal[];
  initialData?: Tactic;
}

export default function TacticForm({ goals, initialData }: TacticFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { openAgent } = useAgent();

  const isEditing = !!initialData;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      let result;
      if (isEditing && initialData) {
        result = await updateTactic(initialData.id, formData);
      } else {
        result = await createTactic(formData);
      }

      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            {isEditing ? "Edit Tactic" : "New Tactic (Lead Indicator)"}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Tactics are the specific, time-bound actions you will take to drive
            your Goals.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SmartToyIcon />}
            onClick={() =>
              openAgent(
                "I need help defining tactics for my goals. Can you suggest some high-impact weekly actions?"
              )
            }
          >
            Draft with AI
          </Button>
        </Box>

        {error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="goal-label">Goal (Lag Indicator)</InputLabel>
            <Select
              labelId="goal-label"
              name="goal_id"
              label="Goal (Lag Indicator)"
              defaultValue={initialData?.goal_id || goals[0]?.id}
              required
              disabled={isEditing} // Prevent changing goal for now to simplify logic
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
            defaultValue={initialData?.title}
          />

          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            margin="normal"
            defaultValue={initialData?.description || ""}
          />

          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography gutterBottom>Weight (Impact)</Typography>
            <Slider
              name="weight"
              defaultValue={initialData?.weight || 1.0}
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
              defaultValue={initialData?.recurrence || "weekly"}
              disabled={isEditing} // Disable recurrence editing for now as it requires complex instance regeneration logic
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="one_off">One-off</MenuItem>
            </Select>
            {isEditing && (
              <FormHelperText>
                Recurrence cannot be changed after creation.
              </FormHelperText>
            )}
          </FormControl>

          <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Tactic"}
            </Button>
            <Button href="/dashboard/tactics" variant="outlined" size="large">
              Cancel
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
