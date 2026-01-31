"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
  Alert,
  SelectChangeEvent,
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { updateOrgMemberRoleAction } from "@/app/dashboard/teams/actions";

interface OrgMember {
  user_id: string;
  role: string;
  profile: {
    full_name: string;
    email: string;
  };
}

interface OrgMembersListProps {
  members: OrgMember[];
  organizationId: string;
  currentUserId: string;
}

export default function OrgMembersList({
  members,
  organizationId,
  currentUserId,
}: OrgMembersListProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUserMember = members.find((m) => m.user_id === currentUserId);
  const isOwnerOrManager =
    currentUserMember?.role === "owner" ||
    currentUserMember?.role === "manager";

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null);
    const result = await updateOrgMemberRoleAction(
      organizationId,
      userId,
      newRole as "owner" | "manager" | "member" | "viewer",
    );
    if (result?.error) {
      setError(result.error);
    }
  };

  const handleRemoveClick = (member: OrgMember) => {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!selectedMember) return;

    setError(null);
    // TODO: Implement removeOrgMemberAction
    setError("Remove member functionality not yet implemented");
    setRemoveDialogOpen(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "error";
      case "manager":
        return "warning";
      case "member":
        return "primary";
      case "viewer":
        return "default";
      default:
        return "default";
    }
  };

  if (members.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No organization members found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Organization Members
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Manage roles and permissions for organization members.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              {isOwnerOrManager && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const canModify = isOwnerOrManager && !isCurrentUser;

              return (
                <TableRow key={member.user_id}>
                  <TableCell>
                    {member.profile?.full_name || "Unknown"}
                    {isCurrentUser && (
                      <Chip label="You" size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{member.profile?.email || "Unknown"}</TableCell>
                  <TableCell>
                    {canModify ? (
                      <Select
                        value={member.role}
                        onChange={(e: SelectChangeEvent) =>
                          handleRoleChange(member.user_id, e.target.value)
                        }
                        size="small"
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value="owner">Owner</MenuItem>
                        <MenuItem value="manager">Manager</MenuItem>
                        <MenuItem value="member">Member</MenuItem>
                        <MenuItem value="viewer">Viewer</MenuItem>
                      </Select>
                    ) : (
                      <Chip
                        label={member.role}
                        color={getRoleColor(member.role)}
                        size="small"
                      />
                    )}
                  </TableCell>
                  {isOwnerOrManager && (
                    <TableCell align="right">
                      {canModify && (
                        <IconButton
                          onClick={() => handleRemoveClick(member)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove{" "}
            <strong>{selectedMember?.profile?.full_name}</strong> from this
            organization? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRemoveConfirm}
            color="error"
            variant="contained"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
