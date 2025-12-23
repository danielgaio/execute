"use client";

import { Button } from "@mui/material";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";

export default function DailyBriefingButton() {
  const { openAgent } = useAgent();

  const handleBriefing = () => {
    openAgent(
      "Brief me on my execution status for today. Check for overdue items, tasks due today, and my current weekly score. Help me prioritize."
    );
  };

  return (
    <Button
      variant="contained"
      color="secondary"
      startIcon={<SmartToyIcon />}
      onClick={handleBriefing}
    >
      Start Day with AI
    </Button>
  );
}
