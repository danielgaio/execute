"use client";

import { Box, Button, Typography, Paper } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";

export default function EmptyCycleState() {
  const { openAgent } = useAgent();

  const handlePlanWithAI = () => {
    openAgent("Help me plan my next 12-week cycle. Please check my current planning status and guide me through the process.");
  };

  return (
    <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", p: 3 }}>
      <SmartToyIcon sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Start Your Execution Journey
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 500 }}>
        You don't have an active 12-week cycle yet. The best way to start is to let the AI Agent guide you through the planning process.
      </Typography>
      <Button 
        variant="contained" 
        size="large" 
        startIcon={<SmartToyIcon />}
        onClick={handlePlanWithAI}
        sx={{ mt: 2 }}
      >
        Plan with AI Agent
      </Button>
      <Typography variant="caption" sx={{ mt: 2, display: "block", color: "text.disabled" }}>
        Or <a href="/dashboard/cycles/new" style={{ color: "inherit", textDecoration: "underline" }}>create manually</a>
      </Typography>
    </Box>
  );
}
