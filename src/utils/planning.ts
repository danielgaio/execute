import { SupabaseClient } from "@supabase/supabase-js";

export async function generateTacticInstancesForWeek(
  supabase: SupabaseClient,
  tacticId: string,
  weekStart: Date,
  orgId: string
) {
  // Fetch tactic details
  const { data: tactic } = await supabase
    .from("tactics")
    .select("*")
    .eq("id", tacticId)
    .single();

  if (!tactic) return;

  const instances = [];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (tactic.recurrence === "weekly") {
    // For each due day (1=Monday, 7=Sunday)
    const dueDays = tactic.due_days || [];
    for (const dayIndex of dueDays) {
      // Calculate date
      // weekStart is assumed to be Monday (1)
      // If dayIndex is 1 (Monday), date is weekStart
      // If dayIndex is 5 (Friday), date is weekStart + 4 days

      // Adjust logic: dayIndex 1..7
      // weekStart is Monday.
      const daysToAdd = dayIndex - 1;
      const dueDate = new Date(weekStart);
      dueDate.setDate(dueDate.getDate() + daysToAdd);

      // Only create if dueDate is not in the past (optional, but for planning maybe we want all)
      // For now, create all for the week.

      instances.push({
        tactic_id: tactic.id,
        org_id: orgId,
        week_start: weekStart.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        planned: true,
        status: "pending",
      });
    }
  } else if (tactic.recurrence === "daily") {
    // Create for Mon-Fri or Mon-Sun? Let's assume Mon-Fri for business context usually,
    // but 'daily' implies every day. Let's do Mon-Fri (1-5) for now as default or 1-7.
    // Let's stick to 1-5 (work week) for MVP unless specified otherwise.
    for (let i = 0; i < 5; i++) {
      const dueDate = new Date(weekStart);
      dueDate.setDate(dueDate.getDate() + i);
      instances.push({
        tactic_id: tactic.id,
        org_id: orgId,
        week_start: weekStart.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        planned: true,
        status: "pending",
      });
    }
  }

  if (instances.length > 0) {
    const { error } = await supabase.from("tactic_instances").insert(instances);

    if (error) console.error("Error generating instances:", error);
  }
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
