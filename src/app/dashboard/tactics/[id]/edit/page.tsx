import {
  Box,
  Button,
  Typography,
  Paper,
} from "@mui/material";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TacticForm from "../../new/tactic-form";

export default async function EditTacticPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/dashboard");

  // Fetch Tactic
  const { data: tactic } = await supabase
    .from("tactics")
    .select("*")
    .eq("id", params.id)
    .eq("org_id", membership.org_id)
    .single();

  if (!tactic) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" color="error" gutterBottom>
            Tactic Not Found
          </Typography>
          <Button variant="contained" href="/dashboard/tactics">
            Back to Tactics
          </Button>
        </Paper>
      </Box>
    );
  }

  // Fetch Goals (for the dropdown)
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title")
    .eq("org_id", membership.org_id)
    .eq("cycle_id", (await supabase.from("cycles").select("id").eq("status", "active").eq("org_id", membership.org_id).single()).data?.id);

  return (
    <Box>
      <TacticForm goals={goals || []} initialData={tactic} />
    </Box>
  );
}
