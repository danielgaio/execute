"use client";

/**
 * Team Management Page - List and manage teams
 */

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { Add as AddIcon, People as PeopleIcon } from "@mui/icons-material";
import Link from "next/link";
import type { Team } from "@/lib/domain/teams";

interface TeamsListProps {
  teams: Team[];
  org_id: string;
  canCreateTeams: boolean;
}

export default function TeamsList({
  teams,
  org_id,
  canCreateTeams,
}: TeamsListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTeam = async () => {
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("org_id", org_id);
    formData.append("name", name);
    if (description) formData.append("description", description);

    try {
      const { createTeamAction } = await import("./actions");
      const result = await createTeamAction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        setCreateDialogOpen(false);
        setName("");
        setDescription("");
        // Page will refresh via revalidatePath
      }
    } catch (err) {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h5">Teams</Typography>
        {canCreateTeams && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Team
          </Button>
        )}
      </Box>

      {teams.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <PeopleIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No teams yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {canCreateTeams
                ? "Create your first team to start collaborating"
                : "Ask a manager to create a team"}
            </Typography>
            {canCreateTeams && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {teams.map((team) => (
            <Grid item xs={12} sm={6} md={4} key={team.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {team.name}
                  </Typography>
                  {team.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {team.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Created {new Date(team.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    component={Link}
                    href={`/dashboard/teams/${team.id}`}
                  >
                    View Members
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Team Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Team Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            required
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTeam}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Team"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
