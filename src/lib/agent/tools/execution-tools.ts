import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";

/**
 * Get a daily briefing for the user
 */
export const getDailyBriefingTool: AgentTool = {
  name: "get_daily_briefing",
  description: "Get a daily briefing summary. Returns tactics due today, overdue items, and current weekly progress. Use this to help the user focus on execution.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    date: z.string().optional().describe("The date to generate the briefing for (YYYY-MM-DD). Defaults to today."),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const today = params.date || new Date().toISOString().split('T')[0];
      const weekStart = getWeekStart().toISOString().split('T')[0];

      // 1. Get Active Cycle
      const { data: activeCycle } = await context.supabase
        .from("cycles")
        .select("id, title, end_date")
        .eq("org_id", context.orgId)
        .eq("status", "active")
        .single();

      if (!activeCycle) {
        return {
          success: true,
          data: {
            hasActiveCycle: false,
            message: "No active cycle found. Please start a new cycle to get a briefing."
          }
        };
      }

      // 2. Get Tactics Due Today
      const { data: todaysInstances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, planned,
          tactics ( id, title, weight )
        `)
        .eq("org_id", context.orgId)
        .eq("due_date", today)
        .eq("planned", true);

      // 3. Get Overdue Tactics (Previous days in this week that are not done)
      // Note: This is a simplified check. Ideally we check all past uncompleted instances.
      // For now, we'll check instances in the current week before today.
      const { data: weekInstances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, due_date,
          tactics ( id, title, weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true)
        .lt("due_date", today)
        .neq("status", "done");

      // 4. Calculate Current Weekly Score
      const { data: allWeekInstances } = await context.supabase
        .from("tactic_instances")
        .select(`
          status,
          tactics ( weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      let totalWeight = 0;
      let completedWeight = 0;
      if (allWeekInstances) {
        for (const inst of allWeekInstances) {
          const weight = inst.tactics?.weight || 1.0;
          totalWeight += weight;
          if (inst.status === 'done') {
            completedWeight += weight;
          }
        }
      }
      const currentScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 100;

      // 5. Days remaining in cycle
      const daysRemaining = Math.ceil((new Date(activeCycle.end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        data: {
          hasActiveCycle: true,
          cycle: activeCycle.title,
          daysRemaining,
          date: today,
          currentScore,
          todaysTactics: todaysInstances?.map(i => ({
            title: i.tactics?.title,
            status: i.status,
            weight: i.tactics?.weight
          })) || [],
          overdueTactics: weekInstances?.map(i => ({
            title: i.tactics?.title,
            dueDate: i.due_date,
            weight: i.tactics?.weight
          })) || [],
          message: "Daily briefing generated."
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

export const executionTools = [
  getDailyBriefingTool
];
