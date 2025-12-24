import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * Get a comprehensive daily briefing
 */
export const getDailyBriefingTool: AgentTool = {
  name: "get_daily_briefing",
  description:
    "Get a comprehensive daily briefing. Includes overdue items, today's focus, and a heads-up for the next 3 days. Use this to help the user prioritize their day.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    timezone: z
      .string()
      .optional()
      .describe("User's timezone (e.g., 'America/New_York'). Defaults to UTC."),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
      // Calculate next 3 days
      const next3Days = new Date(today);
      next3Days.setDate(today.getDate() + 3);
      const next3DaysStr = next3Days.toISOString().split("T")[0];

      // 1. Fetch Overdue Items (Pending items with due_date < today)
      const { data: overdue } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id, due_date, status,
          tactics ( title, weight, goals ( title ) )
        `
        )
        .eq("org_id", context.orgId)
        .lt("due_date", todayStr)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      // 2. Fetch Today's Items
      const { data: todayItems } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id, due_date, status,
          tactics ( title, weight, goals ( title ) )
        `
        )
        .eq("org_id", context.orgId)
        .eq("due_date", todayStr)
        .neq("status", "deferred") // Exclude deferred
        .order("status", { ascending: false }); // Done first, then pending

      // 3. Fetch Upcoming Items (Tomorrow to +3 days)
      const { data: upcoming } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id, due_date, status,
          tactics ( title, weight, goals ( title ) )
        `
        )
        .eq("org_id", context.orgId)
        .gt("due_date", todayStr)
        .lte("due_date", next3DaysStr)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      // 4. Synthesize Briefing
      const overdueCount = overdue?.length || 0;
      const todayCount = todayItems?.length || 0;
      const todayPending = todayItems?.filter(i => i.status === 'pending').length || 0;
      const upcomingCount = upcoming?.length || 0;

      // Prioritization Logic
      // High Priority = Overdue OR (Today + High Weight > 0.7)
      const highPriority = [
        ...(overdue || []).map(i => ({ ...i, reason: "Overdue" })),
        ...(todayItems || []).filter(i => i.status === 'pending' && (i.tactics?.weight || 0) >= 0.7).map(i => ({ ...i, reason: "High Impact" }))
      ];

      return {
        success: true,
        data: {
          date: todayStr,
          summary: {
            overdue: overdueCount,
            todayTotal: todayCount,
            todayPending: todayPending,
            upcoming: upcomingCount
          },
          sections: {
            overdue: overdue || [],
            today: todayItems || [],
            upcoming: upcoming || [],
            highPriority: highPriority
          },
          message: `Briefing ready. You have ${todayPending} items due today and ${overdueCount} overdue.`
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
