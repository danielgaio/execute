"use client";

import { Button } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";

export default function ReviewWeekButton() {
  const { openAgent } = useAgent();

  const handleReview = () => {
    openAgent(
      "I want to do my Weekly Progress Review (WPR). Please analyze my performance for this week, calculate my Lead Score, and help me draft my review notes."
    );
  };

  return (
    <Button
      variant="outlined"
      startIcon={<SmartToyIcon />}
      onClick={handleReview}
    >
      Review with AI
    </Button>
  );
}
