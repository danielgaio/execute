"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeekStart } from "@/utils/planning";
import { calculateLeadScore, ScorableItem } from "@/lib/domain/scoring";
import { generateInstancesForTacticId } from "@/lib/domain/planning";

export async function submitWeeklyReview(
  orgId: string,
  cycleId: string,
  weekStart: string,
  data: {
    leadScore: number;
    lagStatus: string;
    notes: string;
    pendingAction: "defer" | "skip" | "none";
    pendingInstanceIds: string[];
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // 1. Handle Pending Items
  if (data.pendingAction !== "none" && data.pendingInstanceIds.length > 0) {
    const status = data.pendingAction === "defer" ? "deferred" : "skipped";
    
    // If deferring, we might want to create new instances for next week?
    // For now, just mark them as deferred. The "Plan Next Week" step handles creation.
    
    await supabase
      .from("tactic_instances")
      .update({ status })
      .in("id", data.pendingInstanceIds);
  }

  // 2. Create/Update WPR Record
  const { error: wprError } = await supabase
    .from("weekly_reviews")
    .upsert({
      org_id: orgId,
      cycle_id: cycleId,
      week_start: weekStart,
      lead_score: data.leadScore,
      lag_status: data.lagStatus,
      notes: data.notes,
      created_by: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id, cycle_id, week_start' });

  if (wprError) throw new Error(wprError.message);

  // 3. Generate Next Week's Plan (if not exists)
  // We assume the user has reviewed the plan in the UI.
  // Here we ensure the instances actually exist.
  
  const nextWeekDate = new Date(weekStart);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekStartStr = nextWeekDate.toISOString().split("T")[0];

  // Check if plan exists
  const { data: existingPlan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("org_id", orgId)
    .eq("week_start", nextWeekStartStr)
    .single();

  if (!existingPlan) {
    // Create Plan Record
    await supabase.from("weekly_plans").insert({
      org_id: orgId,
      cycle_id: cycleId,
      week_start: nextWeekStartStr,
      owner_user_id: user.id,
      status: "committed"
    });

    // Generate Instances for all active tactics
    const { data: tactics } = await supabase
      .from("tactics")
      .select("id")
      .eq("org_id", orgId)
      .eq("status", "active");

    if (tactics) {
      for (const tactic of tactics) {
        await generateInstancesForTacticId(supabase, tactic.id, nextWeekDate);
      }
    }
  } else {
    // Update status to committed
    await supabase
      .from("weekly_plans")
      .update({ status: "committed" })
      .eq("id", existingPlan.id);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
