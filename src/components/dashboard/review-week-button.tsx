"use client";

import { Button } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useAgent } from "@/contexts/agent-context";

export default function ReviewWeekButton() {
  const { openAgent } = useAgent();

  const handleReview = () => {
    openAgent("I want to do my Weekly Progress Review (WPR). Please analyze my performance for this week.");
  };

  return (
    <Button
      variant="outlined"
      startIcon={<AssessmentIcon />}
      onClick={handleReview}
    >
      Review Week
    </Button>
  );
}
