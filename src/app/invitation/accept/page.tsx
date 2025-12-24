/**
 * Invitation Acceptance Page
 *
 * Handles organization invitation acceptance flow
 */

import { createClient } from "@/utils/supabase/server";
import { getInvitationByToken } from "@/lib/domain/invitations";
import InvitationAcceptForm from "@/components/invitation-accept-form";
import { Box, Card, CardContent, Typography, Alert } from "@mui/material";

export default async function InvitationAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 500 }}>
          <CardContent>
            <Alert severity="error">
              Invalid invitation link. Please check your email for the correct
              link.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Create service role client to read invitation (user may not be authenticated)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { createClient: createSupabaseClient } = await import(
    "@supabase/supabase-js"
  );
  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);

  const { invitation, error } = await getInvitationByToken(adminClient, token);

  if (error || !invitation) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 500 }}>
          <CardContent>
            <Alert severity="error">
              {error || "This invitation is invalid or has expired."}
            </Alert>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Please contact the person who invited you to request a new
              invitation.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Check if user is already authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <InvitationAcceptForm
        invitation={{
          organizationName:
            invitation.organization?.name || "Execute Organization",
          inviterName: invitation.inviter?.full_name || "A team member",
          role: invitation.role,
          email: invitation.email,
          token,
        }}
        isAuthenticated={!!user}
        userEmail={user?.email}
      />
    </Box>
  );
}
