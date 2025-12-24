import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";

export interface Tactic {
  id: string;
  title: string;
  recurrence: "weekly" | "daily" | "one_off" | "custom";
  recurrence_interval?: number;
  due_days?: number[]; // 1=Monday, 7=Sunday
  org_id: string;
  created_at?: string;
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
 * Generates weekly plans and tactic instances for all active cycles.
 * Designed to be run by a cron job (e.g., every Monday).
 */
export async function generateWeeklyPlansForAllOrgs(supabase: SupabaseClient) {
  // 1. Get all active cycles with owner details
  const { data: cycles, error: cycleError } = await supabase
    .from("cycles")
    .select(
      `
      id, org_id, start_date, end_date, owner_user_id, title,
      owner:owner_user_id ( email, full_name )
    `
    )
    .eq("status", "active");

  if (cycleError || !cycles) {
    console.error("Error fetching cycles:", cycleError);
    return { generated: 0, errors: [cycleError], notifications: [] as any[] };
  }

  const results = {
    generated: 0,
    errors: [] as any[],
    notifications: [] as any[],
  };
  const today = new Date();
  const currentWeekStart = getWeekStart(today); // Monday of current week
  const currentWeekStartStr = currentWeekStart.toISOString().split("T")[0];

  for (const cycle of cycles) {
    try {
      // Check if cycle is currently active (date-wise)
      const cycleStart = new Date(cycle.start_date);
      const cycleEnd = new Date(cycle.end_date);

      if (currentWeekStart > cycleEnd) continue;

      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      if (currentWeekEnd < cycleStart) continue;

      // 2. Create Weekly Plan Record (if not exists)
      const { data: existingPlan } = await supabase
        .from("weekly_plans")
        .select("id")
        .eq("cycle_id", cycle.id)
        .eq("week_start", currentWeekStartStr)
        .single();

      if (!existingPlan) {
        const { error: planError } = await supabase
          .from("weekly_plans")
          .insert({
            cycle_id: cycle.id,
            org_id: cycle.org_id,
            week_start: currentWeekStartStr,
            owner_user_id: cycle.owner_user_id,
            status: "draft",
          });
        if (planError) throw planError;
      }

      // 3. Get all active tactics for this cycle
      const { data: tactics, error: tacticsError } = await supabase
        .from("tactics")
        .select("*, goals!inner(cycle_id)")
        .eq("goals.cycle_id", cycle.id)
        .eq("status", "active");

      if (tacticsError) throw tacticsError;

      let tacticsGenerated = 0;
      if (tactics) {
        for (const tactic of tactics) {
          await generateInstancesForTactic(
            supabase,
            tactic as any,
            currentWeekStart
          );
          tacticsGenerated++;
        }
      }
      results.generated++;

      // Queue notification if owner has email
      // @ts-ignore
      const owner = Array.isArray(cycle.owner) ? cycle.owner[0] : cycle.owner;
      if (owner && owner.email) {
        results.notifications.push({
          type: "weekly_plan_ready",
          email: owner.email,
          name: owner.full_name || "User",
          cycleTitle: cycle.title,
          weekStart: currentWeekStartStr,
          itemCount: tacticsGenerated,
        });
      }
    } catch (e) {
      console.error(`Error processing cycle ${cycle.id}:`, e);
      results.errors.push({ cycleId: cycle.id, error: e });
    }
  }
  return results;
}

/**
 * Helper to generate instances by ID (fetches tactic first).
 */
export async function generateInstancesForTacticId(
  supabase: SupabaseClient,
  tacticId: string,
  weekStart: Date
): Promise<void> {
  const { data: tactic, error } = await supabase
    .from("tactics")
    .select("*")
    .eq("id", tacticId)
    .single();

  if (error || !tactic) {
    console.error(`Tactic ${tacticId} not found or error:`, error);
    return;
  }

  await generateInstancesForTactic(supabase, tactic as any, weekStart);
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

  // Handle Weekly / Custom Recurrence
  if (tactic.recurrence === "weekly" || tactic.recurrence === "custom") {
    // Check recurrence interval
    const interval = tactic.recurrence_interval || 1;
    if (interval > 1 && tactic.created_at) {
      const createdDate = new Date(tactic.created_at);
      const createdWeekStart = getWeekStart(createdDate);
      const diffTime = weekStart.getTime() - createdWeekStart.getTime();
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

      // If not the right week, skip
      if (diffWeeks % interval !== 0) {
        return;
      }
    }

    const dueDays =
      tactic.due_days && tactic.due_days.length > 0 ? tactic.due_days : [5]; // Default Friday

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
    // Generate for specified days or Mon-Fri (Business Days)
    const daysToGenerate =
      tactic.due_days && tactic.due_days.length > 0
        ? tactic.due_days
        : [1, 2, 3, 4, 5];

    for (const dayIndex of daysToGenerate) {
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
  } else if (tactic.recurrence === "one_off") {
    // For one-off, we check if ANY instance exists globally (not just this week)
    // But since we are in 'generateInstancesForTactic' which is usually called for a specific week,
    // we need to be careful.
    // Ideally, we check if it has EVER been scheduled.

    const { count } = await supabase
      .from("tactic_instances")
      .select("id", { count: "exact", head: true })
      .eq("tactic_id", tactic.id);

    if (count === 0) {
      // Never scheduled. Schedule it for this week.
      const dueDays =
        tactic.due_days && tactic.due_days.length > 0 ? tactic.due_days : [5]; // Default Friday
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
      console.error(
        `Error generating instances for tactic ${tactic.id}:`,
        error
      );
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
