import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";
import { calculateLeadScore, type ScorableItem } from "@/lib/domain/scoring";
import { predictScoreTool, suggestAdjustmentsTool } from "./analysis-tools";

/**
 * Get a daily briefing for the user
 */
export const getDailyBriefingTool: AgentTool = {
  name: "get_daily_briefing",
  description: "Get a daily briefing summary. Returns tactics due today, overdue items, current weekly progress, AND predictive analysis. Use this to help the user focus on execution.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    date: z.string().optional().describe("The date to generate the briefing for (YYYY-MM-DD). Defaults to today."),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const today = (params.date as string) || new Date().toISOString().split('T')[0];
      const weekStart = getWeekStart().toISOString().split('T')[0];

      // 1. Get Active Cycle
      const { data: activeCycle } = await context.supabase
        .from("cycles")
        .select("id, title, start_date, end_date")
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
        .eq("planned", true)
        .neq("status", "deferred");

      // 3. Get Overdue Tactics (All past uncompleted instances in this cycle)
      const { data: weekInstances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, due_date,
          tactics ( id, title, weight )
        `)
        .eq("org_id", context.orgId)
        .eq("planned", true)
        .lt("due_date", today)
        .gte("due_date", activeCycle.start_date)
        .neq("status", "done")
        .neq("status", "deferred");

      // 4. Calculate Current Weekly Score
      const { data: allWeekInstances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, planned,
          tactics ( weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      const scorableItems: ScorableItem[] = (allWeekInstances || []).map((inst: any) => ({
        id: inst.id,
        status: inst.status,
        weight: inst.tactics?.weight || 1.0,
        planned: inst.planned
      }));

      const currentScore = calculateLeadScore(scorableItems);

      // 5. Days remaining in cycle
      const daysRemaining = Math.ceil((new Date(activeCycle.end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));

      // 6. Predictive Analysis (New)
      let prediction = null;
      let suggestions = null;

      try {
        const predResult = await predictScoreTool.handler({ week_start: weekStart }, context);
        if (predResult.success) prediction = predResult.data;

        const suggResult = await suggestAdjustmentsTool.handler({ week_start: weekStart }, context);
        if (suggResult.success) suggestions = suggResult.data;
      } catch (e) {
        console.error("Failed to run predictive analysis", e);
      }

      return {
        success: true,
        data: {
          hasActiveCycle: true,
          cycle: activeCycle.title,
          daysRemaining,
          date: today,
          currentScore,
          prediction, // Added
          suggestions, // Added
          todaysTactics: todaysInstances?.map((i: any) => {
            const tactic = Array.isArray(i.tactics) ? i.tactics[0] : i.tactics;
            return {
              title: tactic?.title,
              status: i.status,
              weight: tactic?.weight
            };
          }) || [],
          overdueTactics: weekInstances?.map((i: any) => {
            const tactic = Array.isArray(i.tactics) ? i.tactics[0] : i.tactics;
            return {
              title: tactic?.title,
              dueDate: i.due_date,
              weight: tactic?.weight
            };
          }) || [],
          message: "Daily briefing generated with predictive analysis."
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
