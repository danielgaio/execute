"use client";

import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Container,
  MenuItem,
} from "@mui/material";
import { createGoal } from "../actions";

const UNITS = [
  { value: "count", label: "Count (e.g. # of calls)" },
  { value: "USD", label: "Currency (USD)" },
  { value: "%", label: "Percentage (%)" },
  { value: "boolean", label: "Yes/No" },
];

export default function CreateGoalPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await createGoal(formData);
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
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography component="h1" variant="h5" gutterBottom>
            Define New Goal
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Set a specific, measurable goal (Lag Indicator) for the current
            cycle.
          </Typography>

          {error && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="title"
              label="Goal Title"
              name="title"
              autoFocus
              placeholder="e.g. Achieve $50k in New ARR"
            />

            <TextField
              margin="normal"
              fullWidth
              id="description"
              label="Description (Optional)"
              name="description"
              multiline
              rows={3}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              select
              id="unit"
              label="Unit of Measure"
              name="unit"
              defaultValue="count"
            >
              {UNITS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="baseline"
                label="Baseline"
                name="baseline"
                type="number"
                defaultValue="0"
                helperText="Starting value"
              />
              <TextField
                margin="normal"
                required
                fullWidth
                id="target"
                label="Target"
                name="target"
                type="number"
                helperText="Goal value"
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? "Creating Goal..." : "Create Goal"}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}
