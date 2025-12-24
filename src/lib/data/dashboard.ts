import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";
import { calculateLeadScore, ScorableItem } from "@/lib/domain/scoring";

export interface DashboardData {
  activeCycle: any | null;
  weeklyScore: number;
  todaysInstances: any[];
  overdueInstances: any[];
  weekStart: string;
}

export async function getDashboardData(
  supabase: SupabaseClient,
  orgId: string
): Promise<DashboardData> {
  // 1. Fetch Active Cycle
  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .single();

  // 2. Fetch Today's Instances
  const today = new Date().toISOString().split("T")[0];
  const { data: todaysInstances } = await supabase
    .from("tactic_instances")
    .select(`
      *,
      tactics (
        title,
        weight
      )
    `)
    .eq("org_id", orgId)
    .eq("due_date", today)
    .order("status", { ascending: false }); // Done items first? Or pending first? Usually pending first is better for "To Do" lists.
    // Let's sort by status: pending first. 'pending' > 'done' alphabetically? No.
    // We'll sort in memory or refine query later.

  // 3. Fetch Overdue Instances (Pending items from past)
  const { data: overdueInstances } = await supabase
    .from("tactic_instances")
    .select(`
      *,
      tactics (
        title,
        weight
      )
    `)
    .eq("org_id", orgId)
    .lt("due_date", today)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  // 4. Calculate Weekly Score
  const weekStart = getWeekStart().toISOString().split("T")[0];
  const { data: weeklyInstances } = await supabase
    .from("tactic_instances")
    .select(`
      id,
      status,
      planned,
      tactics (
        weight
      )
    `)
    .eq("org_id", orgId)
    .eq("week_start", weekStart)
    .eq("planned", true);

  // Map to ScorableItem
  const scorableItems: ScorableItem[] = (weeklyInstances || []).map((i: any) => ({
    id: i.id,
    status: i.status,
    weight: i.tactics?.weight || 1.0,
    planned: i.planned,
  }));

  const weeklyScore = calculateLeadScore(scorableItems);

  return {
    activeCycle,
    weeklyScore,
    todaysInstances: todaysInstances || [],
    overdueInstances: overdueInstances || [],
    weekStart,
  };
}
