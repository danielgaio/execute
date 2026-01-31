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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";
import {
  revokeInvitationAction,
  resendInvitationAction,
} from "@/app/dashboard/teams/actions";

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  inviter_profile: {
    full_name: string;
  };
}

interface InvitationsListProps {
  invitations: Invitation[];
  organizationId: string;
}

export default function InvitationsList({
  invitations,
  organizationId,
}: InvitationsListProps) {
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRevokeClick = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setRevokeDialogOpen(true);
  };

  const handleRevokeConfirm = async () => {
    if (!selectedInvitation) return;

    setError(null);
    setSuccess(null);

    const result = await revokeInvitationAction(selectedInvitation.id);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Invitation revoked successfully");
    }

    setRevokeDialogOpen(false);
  };

  const handleResend = async (invitationId: string) => {
    setError(null);
    setSuccess(null);

    const result = await resendInvitationAction(invitationId);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Invitation resent successfully");
    }
  };

  const handleCopyLink = (token: string) => {
    const invitationUrl = `${window.location.origin}/invitation/accept?token=${token}`;
    navigator.clipboard.writeText(invitationUrl);
    setSuccess("Invitation link copied to clipboard");
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiration =
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiration < 24 && hoursUntilExpiration > 0;
  };

  if (invitations.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No pending invitations.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pending Invitations
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Manage pending invitations to your organization.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Invited By</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell>{invitation.email}</TableCell>
                <TableCell>
                  <Chip
                    label={invitation.role}
                    color={getRoleColor(invitation.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {invitation.inviter_profile?.full_name || "Unknown"}
                </TableCell>
                <TableCell>
                  {formatDate(invitation.expires_at)}
                  {isExpiringSoon(invitation.expires_at) && (
                    <Chip
                      label="Expiring Soon"
                      color="warning"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Copy invitation link">
                    <IconButton
                      onClick={() => handleCopyLink(invitation.token)}
                      size="small"
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Resend invitation email">
                    <IconButton
                      onClick={() => handleResend(invitation.id)}
                      size="small"
                      color="primary"
                    >
                      <SendIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Revoke invitation">
                    <IconButton
                      onClick={() => handleRevokeClick(invitation)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={revokeDialogOpen}
        onClose={() => setRevokeDialogOpen(false)}
      >
        <DialogTitle>Revoke Invitation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to revoke the invitation for{" "}
            <strong>{selectedInvitation?.email}</strong>? They will no longer be
            able to accept this invitation.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRevokeConfirm}
            color="error"
            variant="contained"
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
