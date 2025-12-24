"use client";

import { Card, CardContent, Typography, Box, Button, Chip, Stack } from "@mui/material";
import { ParsedVision } from "@/lib/domain/vision";
import Link from "next/link";
import EditIcon from "@mui/icons-material/Edit";

interface VisionCardProps {
  vision: ParsedVision | null;
}

export default function VisionCard({ vision }: VisionCardProps) {
  if (!vision || (!vision.twelveMonth && !vision.threeYear)) {
    return (
      <Card sx={{ height: "100%", bgcolor: "grey.50", borderStyle: "dashed" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 2 }}>
          <Typography variant="h6" color="text.secondary">
            No Vision Defined
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Define your North Star to guide your execution.
          </Typography>
          <Button variant="outlined" component={Link} href="/dashboard/vision">
            Create Vision
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            STRATEGIC FOCUS
          </Typography>
          <Button size="small" startIcon={<EditIcon />} component={Link} href="/dashboard/vision">
            Edit
          </Button>
        </Box>

        {vision.twelveMonth && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="primary" fontWeight="bold">
              12-MONTH GOALS
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-line" }}>
              {vision.twelveMonth}
            </Typography>
          </Box>
        )}

        {vision.coreValues && vision.coreValues.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" gutterBottom>
              CORE VALUES
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {vision.coreValues.map((value, i) => (
                <Chip key={i} label={value} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
