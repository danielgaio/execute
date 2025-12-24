"use client";

/**
 * Invitation Accept Form Component
 *
 * Handles the invitation acceptance flow with authentication state management
 */

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
} from "@mui/material";
import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";

interface InvitationAcceptFormProps {
  invitation: {
    organizationName: string;
    inviterName: string;
    role: string;
    email: string;
    token: string;
  };
  isAuthenticated: boolean;
  userEmail?: string;
}

export default function InvitationAcceptForm({
  invitation,
  isAuthenticated,
  userEmail,
}: InvitationAcceptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const emailMatches =
    userEmail?.toLowerCase() === invitation.email.toLowerCase();

  const handleAccept = async () => {
    setLoading(true);
    setError(null);

    try {
      const { acceptInvitationAction } = await import(
        "@/app/dashboard/teams/actions"
      );
      const result = await acceptInvitationAction(invitation.token);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      }
    } catch (err) {
      setError("Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    // Redirect to login with return URL
    router.push(`/login?redirect=/invitation/accept?token=${invitation.token}`);
  };

  const handleSignUp = () => {
    // Redirect to signup with email pre-filled
    router.push(
      `/login?email=${encodeURIComponent(
        invitation.email
      )}&redirect=/invitation/accept?token=${invitation.token}`
    );
  };

  if (success) {
    return (
      <Card sx={{ maxWidth: 500 }}>
        <CardContent sx={{ textAlign: "center", py: 6 }}>
          <CheckCircleIcon
            sx={{ fontSize: 64, color: "success.main", mb: 2 }}
          />
          <Typography variant="h5" gutterBottom>
            Welcome to {invitation.organizationName}!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Redirecting to dashboard...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ maxWidth: 500, width: "100%" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          You're invited!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          <strong>{invitation.inviterName}</strong> has invited you to join{" "}
          <strong>{invitation.organizationName}</strong> on Execute.
        </Typography>

        <Box
          sx={{
            bgcolor: "background.default",
            p: 2,
            borderRadius: 1,
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Email:
            </Typography>
            <Typography variant="body2">{invitation.email}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Role:
            </Typography>
            <Chip
              label={
                invitation.role.charAt(0).toUpperCase() +
                invitation.role.slice(1)
              }
              size="small"
              color="primary"
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!isAuthenticated ? (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              You need to sign in or create an account to accept this
              invitation.
            </Alert>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleSignIn}
                disabled={loading}
              >
                Sign In
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSignUp}
                disabled={loading}
              >
                Create Account
              </Button>
            </Box>
          </Box>
        ) : !emailMatches ? (
          <Alert severity="warning">
            This invitation was sent to <strong>{invitation.email}</strong>, but
            you're signed in as <strong>{userEmail}</strong>. Please sign in
            with the correct account or contact {invitation.inviterName} for a
            new invitation.
          </Alert>
        ) : (
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? "Accepting..." : "Accept Invitation"}
          </Button>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 3 }}
        >
          By accepting this invitation, you'll be able to collaborate on 12-week
          execution plans, track tactics, and participate in Weekly Progress
          Reviews.
        </Typography>
      </CardContent>
    </Card>
  );
}
