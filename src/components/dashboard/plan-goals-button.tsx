"use client";

import { Button } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";

export default function PlanGoalsButton() {
  const { openAgent } = useAgent();

  return (
    <Button
      variant="outlined"
      startIcon={<SmartToyIcon />}
      onClick={() =>
        openAgent(
          "I want to review my current goals and plan new ones for this cycle. Can you analyze my progress and suggest improvements?"
        )
      }
    >
      Plan with AI
    </Button>
  );
}
