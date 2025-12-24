import { SupabaseClient } from "@supabase/supabase-js";
import {
  ScoreAnalyst,
  ScoreAnalysis,
  AnalysisItem,
} from "../analysis/score-analyst";

export interface BriefingItem {
  id: string;
  title: string;
  due_date: string;
  status: string;
  weight: number;
  goal_title?: string;
  planned: boolean;
}

export interface DailyBriefing {
  date: string;
  overdue: BriefingItem[];
  today: BriefingItem[];
  upcoming: BriefingItem[];
  stats: {
    overdueCount: number;
    todayCount: number;
    upcomingCount: number;
  };
  scoreAnalysis?: ScoreAnalysis;
}

export class BriefingService {
  /**
   * Generate a daily briefing for a specific organization/user context.
   */
  static async getBriefing(
    supabase: SupabaseClient,
    orgId: string,
    timezone: string = "UTC"
  ): Promise<DailyBriefing> {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Calculate next 3 days
    const next3Days = new Date(today);
    next3Days.setDate(today.getDate() + 3);
    const next3DaysStr = next3Days.toISOString().split("T")[0];

    // Calculate Week Boundaries (Monday to Sunday)
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diffToMon);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // 1. Fetch Overdue Items (Pending items with due_date < today)
    const { data: overdue } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status, planned,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .lt("due_date", todayStr)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    // 2. Fetch Today's Items
    const { data: todayItems } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status, planned,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .eq("due_date", todayStr)
      .neq("status", "skipped") // Include done/pending/deferred
      .order("status", { ascending: false });

    // 3. Fetch Upcoming (Next 3 Days)
    const { data: upcoming } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status, planned,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .gt("due_date", todayStr)
      .lte("due_date", next3DaysStr)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    // 4. Fetch All Week Items for Score Analysis
    const { data: weekItems } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status, planned,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .gte("due_date", weekStartStr)
      .lte("due_date", weekEndStr);

    // Helper to map DB result to BriefingItem
    const mapItem = (i: any): BriefingItem => ({
      id: i.id,
      title: i.tactics?.title || "Untitled",
      due_date: i.due_date,
      status: i.status,
      weight: i.tactics?.weight || 1.0,
      goal_title: i.tactics?.goals?.title,
      planned: i.planned ?? true, // Default to true if missing
    });

    const overdueItems = (overdue || []).map(mapItem);
    const todayMapped = (todayItems || []).map(mapItem);
    const upcomingItems = (upcoming || []).map(mapItem);

    // Perform Score Analysis
    let scoreAnalysis: ScoreAnalysis | undefined;
    if (weekItems && weekItems.length > 0) {
      const analysisItems: AnalysisItem[] = weekItems.map(mapItem);
      scoreAnalysis = ScoreAnalyst.analyze(analysisItems);
    }

    return {
      date: todayStr,
      overdue: overdueItems,
      today: todayMapped,
      upcoming: upcomingItems,
      stats: {
        overdueCount: overdueItems.length,
        todayCount: todayMapped.length,
        upcomingCount: upcomingItems.length,
      },
      scoreAnalysis,
    };
  }
}
