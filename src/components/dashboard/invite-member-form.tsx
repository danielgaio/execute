"use client";

/**
 * Invite Member Form Component
 *
 * Allows organization owners/managers to invite new members via email.
 * Supports role selection and optional team assignment.
 */

import { useState, useTransition } from "react";
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Typography,
  CircularProgress,
  Collapse,
  IconButton,
} from "@mui/material";
import {
  PersonAdd as PersonAddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { inviteMemberAction } from "@/app/dashboard/teams/actions";

interface InviteMemberFormProps {
  organizationId: string;
  teams?: { id: string; name: string }[];
  onSuccess?: () => void;
}

type Role = "owner" | "manager" | "member" | "viewer";

const roleDescriptions: Record<Role, string> = {
  owner: "Full access including billing and org deletion",
  manager: "Can manage teams, invite members, and create plans",
  member: "Can participate in execution and view dashboards",
  viewer: "Read-only access to dashboards and reports",
};

export default function InviteMemberForm({
  organizationId,
  teams = [],
  onSuccess,
}: InviteMemberFormProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic email validation
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    const formData = new FormData();
    formData.append("org_id", organizationId);
    formData.append("email", email.trim().toLowerCase());
    formData.append("role", role);
    if (selectedTeams.length > 0) {
      formData.append("team_ids", selectedTeams.join(","));
    }

    startTransition(async () => {
      const result = await inviteMemberAction(formData);

      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(`Invitation sent to ${email}`);
        setEmail("");
        setRole("member");
        setSelectedTeams([]);
        onSuccess?.();
      }
    });
  };

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", mb: 3 }}>
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Invite New Member
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ p: 2, pt: 0, borderTop: 1, borderColor: "divider" }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              fullWidth
              disabled={isPending}
              autoComplete="email"
            />

            <FormControl fullWidth>
              <InputLabel id="role-select-label">Role</InputLabel>
              <Select
                labelId="role-select-label"
                value={role}
                label="Role"
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={isPending}
              >
                <MenuItem value="viewer">
                  <Box>
                    <Typography variant="body1">Viewer</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleDescriptions.viewer}
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="member">
                  <Box>
                    <Typography variant="body1">Member</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleDescriptions.member}
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="manager">
                  <Box>
                    <Typography variant="body1">Manager</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleDescriptions.manager}
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="owner">
                  <Box>
                    <Typography variant="body1">Owner</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleDescriptions.owner}
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {teams.length > 0 && (
              <FormControl fullWidth>
                <InputLabel id="teams-select-label">
                  Add to Teams (Optional)
                </InputLabel>
                <Select
                  labelId="teams-select-label"
                  multiple
                  value={selectedTeams}
                  label="Add to Teams (Optional)"
                  onChange={(e) => setSelectedTeams(e.target.value as string[])}
                  disabled={isPending}
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setExpanded(false);
                  setEmail("");
                  setRole("member");
                  setSelectedTeams([]);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isPending || !email}
                startIcon={
                  isPending ? <CircularProgress size={20} /> : <PersonAddIcon />
                }
              >
                {isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
