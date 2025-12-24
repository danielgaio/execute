import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";
import { calculateLeadScore, ScorableItem } from "@/lib/domain/scoring";
import { Goal } from "@/lib/domain/goals";
import { parseVisionMarkdown, ParsedVision } from "@/lib/domain/vision";

export interface DashboardData {
  activeCycle: any | null;
  weeklyScore: number;
  todaysInstances: any[];
  overdueInstances: any[];
  weekStart: string;
  goals: Goal[];
  vision: ParsedVision | null;
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

  // 2. Fetch Goals (if cycle exists)
  let goals: Goal[] = [];
  if (activeCycle) {
    const { data: fetchedGoals } = await supabase
      .from("goals")
      .select("*")
      .eq("cycle_id", activeCycle.id)
      .order("created_at", { ascending: true });
    
    if (fetchedGoals) {
      goals = fetchedGoals.map((g: any) => ({
        ...g,
        start_date: activeCycle.start_date,
        target_date: g.target_date || activeCycle.end_date
      }));
    }
  }

  // 2b. Fetch Vision
  let vision: ParsedVision | null = null;
  const { data: visionData } = await supabase
    .from("visions")
    .select("content_md")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (visionData) {
    vision = parseVisionMarkdown(visionData.content_md);
  }

  // 3. Fetch Today's Instances
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
    .order("status", { ascending: false }); 

  // 4. Fetch Overdue Instances (Pending items from past)
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

  // 5. Calculate Weekly Score
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
    goals,
    vision,
  };
}
