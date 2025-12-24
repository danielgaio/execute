import { SupabaseClient } from "@supabase/supabase-js";

export interface BriefingItem {
  id: string;
  title: string;
  due_date: string;
  status: string;
  weight: number;
  goal_title?: string;
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

    // 1. Fetch Overdue Items (Pending items with due_date < today)
    const { data: overdue } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status,
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
        id, due_date, status,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .eq("due_date", todayStr)
      .neq("status", "skipped") // Include done/pending/deferred
      .order("status", { ascending: false }); // Pending first (usually) or Done? 'pending' > 'done' alphabetically? No.
    // We want pending first.

    // 3. Fetch Upcoming (Next 3 Days)
    const { data: upcoming } = await supabase
      .from("tactic_instances")
      .select(
        `
        id, due_date, status,
        tactics ( title, weight, goals ( title ) )
      `
      )
      .eq("org_id", orgId)
      .gt("due_date", todayStr)
      .lte("due_date", next3DaysStr)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    // Helper to map DB result to BriefingItem
    const mapItem = (i: any): BriefingItem => ({
      id: i.id,
      title: i.tactics?.title || "Untitled",
      due_date: i.due_date,
      status: i.status,
      weight: i.tactics?.weight || 1.0,
      goal_title: i.tactics?.goals?.title,
    });

    const overdueItems = (overdue || []).map(mapItem);
    const todayMapped = (todayItems || []).map(mapItem);
    const upcomingItems = (upcoming || []).map(mapItem);

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
    };
  }
}
