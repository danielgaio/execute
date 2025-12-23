"use client";

import { Button } from "@mui/material";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import { useAgent } from "@/contexts/agent-context";

export default function DailyBriefingButton() {
  const { openAgent } = useAgent();

  const handleBriefing = () => {
    openAgent("Brief me on my execution status for today. What do I need to focus on?");
  };

  return (
    <Button
      variant="contained"
      color="secondary"
      startIcon={<TipsAndUpdatesIcon />}
      onClick={handleBriefing}
    >
      Daily Briefing
    </Button>
  );
}
