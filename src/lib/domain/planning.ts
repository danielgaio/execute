import { SupabaseClient } from "@supabase/supabase-js";

export interface Tactic {
  id: string;
  title: string;
  recurrence: "weekly" | "daily" | "one_off";
  due_days?: number[]; // 1=Monday, 7=Sunday
  org_id: string;
}

export interface TacticInstance {
  tactic_id: string;
  org_id: string;
  week_start: string;
  due_date: string;
  planned: boolean;
  status: "pending" | "done" | "skipped" | "deferred";
}

/**
 * Generates tactic instances for a specific tactic for a given week.
 * Idempotent: Checks for existing instances to avoid duplicates.
 */
export async function generateInstancesForTactic(
  supabase: SupabaseClient,
  tactic: Tactic,
  weekStart: Date
): Promise<void> {
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // 1. Check for existing instances for this tactic in this week
  const { data: existing } = await supabase
    .from("tactic_instances")
    .select("id")
    .eq("tactic_id", tactic.id)
    .eq("week_start", weekStartStr);

  if (existing && existing.length > 0) {
    // Already generated for this week. Skip.
    return;
  }

  const instances: TacticInstance[] = [];

  if (tactic.recurrence === "weekly") {
    const dueDays = tactic.due_days && tactic.due_days.length > 0 ? tactic.due_days : [5]; // Default Friday
    
    for (const dayIndex of dueDays) {
      // weekStart is Monday (1)
      const daysToAdd = dayIndex - 1;
      const dueDate = new Date(weekStart);
      dueDate.setDate(dueDate.getDate() + daysToAdd);

      instances.push({
        tactic_id: tactic.id,
        org_id: tactic.org_id,
        week_start: weekStartStr,
        due_date: dueDate.toISOString().split("T")[0],
        planned: true,
        status: "pending",
      });
    }
  } else if (tactic.recurrence === "daily") {
    // Generate for Mon-Fri (Business Days)
    for (let i = 0; i < 5; i++) {
      const dueDate = new Date(weekStart);
      dueDate.setDate(dueDate.getDate() + i);
      instances.push({
        tactic_id: tactic.id,
        org_id: tactic.org_id,
        week_start: weekStartStr,
        due_date: dueDate.toISOString().split("T")[0],
        planned: true,
        status: "pending",
      });
    }
  } else if (tactic.recurrence === "one_off") {
    // For one-off, we check if ANY instance exists globally (not just this week)
    // But since we are in 'generateInstancesForTactic' which is usually called for a specific week,
    // we need to be careful.
    // Ideally, we check if it has EVER been scheduled.
    
    const { count } = await supabase
      .from("tactic_instances")
      .select("id", { count: 'exact', head: true })
      .eq("tactic_id", tactic.id);
    
    if (count === 0) {
      // Never scheduled. Schedule it for this week.
      const dueDays = tactic.due_days && tactic.due_days.length > 0 ? tactic.due_days : [5]; // Default Friday
      const dayIndex = dueDays[0]; // Take the first one
      const daysToAdd = dayIndex - 1;
      const dueDate = new Date(weekStart);
      dueDate.setDate(dueDate.getDate() + daysToAdd);

      instances.push({
        tactic_id: tactic.id,
        org_id: tactic.org_id,
        week_start: weekStartStr,
        due_date: dueDate.toISOString().split("T")[0],
        planned: true,
        status: "pending",
      });
    }
  }

  if (instances.length > 0) {
    const { error } = await supabase.from("tactic_instances").insert(instances);
    if (error) {
      console.error(`Error generating instances for tactic ${tactic.id}:`, error);
      throw error;
    }
  }
}

/**
 * Generates the full weekly plan for an organization.
 * Iterates through all active tactics and generates instances.
 */
export async function generateWeeklyPlan(
  supabase: SupabaseClient,
  orgId: string,
  weekStart: Date
): Promise<{ generated: number; errors: number }> {
  // 1. Fetch all active tactics for the org
  const { data: tactics, error } = await supabase
    .from("tactics")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (error) throw error;
  if (!tactics || tactics.length === 0) return { generated: 0, errors: 0 };

  let generatedCount = 0;
  let errorCount = 0;

  // 2. Generate instances for each
  for (const tactic of tactics) {
    try {
      await generateInstancesForTactic(supabase, tactic, weekStart);
      generatedCount++;
    } catch (e) {
      console.error(`Failed to generate for tactic ${tactic.id}`, e);
      errorCount++;
    }
  }

  return { generated: generatedCount, errors: errorCount };
}
