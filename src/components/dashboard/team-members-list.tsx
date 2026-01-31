"use client";

/**
 * Team Members List Component
 *
 * Displays team members and provides member management controls
 */

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import Link from "next/link";
import type { TeamMember, OrgMember } from "@/lib/domain/teams";

interface TeamMembersListProps {
  team: {
    id: string;
    name: string;
    description: string | null;
    organization: { name: string };
  };
  members: (TeamMember & { profile?: { email: string; full_name: string } })[];
  availableMembers: OrgMember[];
  canManage: boolean;
}

export default function TeamMembersList({
  team,
  members,
  availableMembers,
  canManage,
}: TeamMembersListProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<
    (typeof members)[0] | null
  >(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<
    "manager" | "member" | "viewer"
  >("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    member: (typeof members)[0],
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  const handleChangeRole = async (newRole: "manager" | "member" | "viewer") => {
    if (!selectedMember) return;

    setLoading(true);
    setError(null);

    try {
      const { updateTeamMemberRoleAction } =
        await import("@/app/dashboard/teams/actions");
      const result = await updateTeamMemberRoleAction(
        team.id,
        selectedMember.user_id,
        newRole,
      );

      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to update role");
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    if (!confirm(`Remove ${selectedMember.profile?.full_name} from this team?`))
      return;

    setLoading(true);
    setError(null);

    try {
      const { removeTeamMemberAction } =
        await import("@/app/dashboard/teams/actions");
      const result = await removeTeamMemberAction(
        team.id,
        selectedMember.user_id,
      );

      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to remove member");
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      setError("Please select a member");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { addTeamMemberAction } =
        await import("@/app/dashboard/teams/actions");
      const result = await addTeamMemberAction(
        team.id,
        selectedUserId,
        selectedRole,
      );

      if (result.error) {
        setError(result.error);
      } else {
        setAddDialogOpen(false);
        setSelectedUserId("");
        setSelectedRole("member");
      }
    } catch (err) {
      setError("Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "manager":
        return "primary";
      case "member":
        return "default";
      case "viewer":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <IconButton component={Link} href="/dashboard/teams">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">{team.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {team.organization.name}
          </Typography>
        </Box>
        {canManage && availableMembers.length > 0 && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Member
          </Button>
        )}
      </Box>

      {team.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {team.description}
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Team Members ({members.length})
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  {canManage && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.profile?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>{member.profile?.email || "N/A"}</TableCell>
                    <TableCell>
                      <Chip
                        label={member.role}
                        size="small"
                        color={getRoleColor(member.role)}
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => handleMenuClick(e, member)}
                          disabled={loading}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Member Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleChangeRole("manager")}>
          Make Manager
        </MenuItem>
        <MenuItem onClick={() => handleChangeRole("member")}>
          Make Member
        </MenuItem>
        <MenuItem onClick={() => handleChangeRole("viewer")}>
          Make Viewer
        </MenuItem>
        <MenuItem onClick={handleRemoveMember} sx={{ color: "error.main" }}>
          Remove from Team
        </MenuItem>
      </Menu>

      {/* Add Member Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Select Member</InputLabel>
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              label="Select Member"
            >
              {availableMembers.map((member) => (
                <MenuItem key={member.id} value={member.user_id}>
                  {member.profile?.full_name ||
                    member.profile?.email ||
                    "Unknown"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
              label="Role"
            >
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Member"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
