import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Defers a single tactic instance to the next week.
 * 1. Calculates next week's dates.
 * 2. Inserts a new instance for next week.
 * 3. Updates the current instance to 'deferred'.
 */
export async function deferInstance(
  supabase: SupabaseClient,
  instanceId: string,
  orgId: string,
  reason: string = "Deferred"
) {
  // 1. Get current state
  const { data: instance, error: fetchError } = await supabase
    .from("tactic_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !instance) throw new Error(`Instance ${instanceId} not found`);

  // 2. Calculate new dates
  const currentDueDate = new Date(instance.due_date);
  const nextDueDate = new Date(currentDueDate);
  nextDueDate.setDate(nextDueDate.getDate() + 7);

  const currentWeekStart = new Date(instance.week_start);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  // 3. Create new instance
  const { error: insertError } = await supabase
    .from("tactic_instances")
    .insert({
      tactic_id: instance.tactic_id,
      org_id: orgId,
      week_start: nextWeekStart.toISOString().split("T")[0],
      due_date: nextDueDate.toISOString().split("T")[0],
      planned: true,
      status: "pending",
      notes: `Deferred from previous week: ${reason}`,
    });

  if (insertError) throw insertError;

  // 4. Update old instance
  const { error: updateError } = await supabase
    .from("tactic_instances")
    .update({
      status: "deferred",
      notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .eq("org_id", orgId);

  if (updateError) throw updateError;

  return {
    original: instance,
    nextDueDate: nextDueDate.toISOString().split("T")[0],
  };
}

/**
 * Skips a single tactic instance.
 */
export async function skipInstance(
  supabase: SupabaseClient,
  instanceId: string,
  orgId: string,
  reason: string = "Skipped"
) {
  const { error } = await supabase
    .from("tactic_instances")
    .update({
      status: "skipped",
      notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .eq("org_id", orgId);

  if (error) throw error;
  return true;
}
