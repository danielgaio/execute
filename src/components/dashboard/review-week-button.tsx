"use client";

import { Button, ButtonGroup } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useAgent } from "@/contexts/agent-context";
import Link from "next/link";

export default function ReviewWeekButton() {
  const { openAgent } = useAgent();

  const handleAIReview = () => {
    openAgent(
      "I want to do my Weekly Progress Review (WPR). Please analyze my performance for this week, calculate my Lead Score, and help me draft my review notes."
    );
  };

  return (
    <ButtonGroup variant="outlined">
      <Button
        component={Link}
        href="/dashboard/review"
        startIcon={<AssessmentIcon />}
      >
        Start Review
      </Button>
      <Button
        onClick={handleAIReview}
        startIcon={<SmartToyIcon />}
      >
        AI Assist
      </Button>
    </ButtonGroup>
  );
}
