import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { BriefingService } from "../../briefing/service";

// Schema defined separately for type inference
const briefingSchema = z.object({
  timezone: z
    .string()
    .optional()
    .describe("User's timezone (e.g., 'America/New_York'). Defaults to UTC."),
});

/**
 * Get a comprehensive daily briefing
 */
export const getDailyBriefingTool: AgentTool = {
  name: "get_daily_briefing",
  description:
    "Get a comprehensive daily briefing. Includes overdue items, today's focus, and a heads-up for the next 3 days. Use this to help the user prioritize their day.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: briefingSchema,
  handler: async (
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const { timezone } = params as z.infer<typeof briefingSchema>;
      const briefing = await BriefingService.getBriefing(
        context.supabase,
        context.orgId!,
        timezone
      );

      // Format message for the agent
      const overdueMsg =
        briefing.overdue.length > 0
          ? `⚠️ ${briefing.overdue.length} Overdue Items:\n${briefing.overdue
              .map((i) => `- [${i.due_date}] ${i.title} (${i.goal_title})`)
              .join("\n")}`
          : "✅ No overdue items.";

      const todayMsg =
        briefing.today.length > 0
          ? `📅 Today's Focus (${briefing.today.length}):\n${briefing.today
              .map(
                (i) =>
                  `- [${i.status.toUpperCase()}] ${i.title} (Weight: ${
                    i.weight
                  })`
              )
              .join("\n")}`
          : "🎉 Nothing scheduled for today.";

      const upcomingMsg =
        briefing.upcoming.length > 0
          ? `🔮 Upcoming (Next 3 Days):\n${briefing.upcoming
              .map((i) => `- [${i.due_date}] ${i.title}`)
              .join("\n")}`
          : "No immediate upcoming items.";

      let analysisMsg = "";
      if (briefing.scoreAnalysis) {
        const { score, status, recoveryPath } = briefing.scoreAnalysis;
        analysisMsg = `\n\n📊 Weekly Score: ${score.toFixed(
          0
        )}% (${status.toUpperCase()})`;
        if (
          (status === "at-risk" || status === "critical") &&
          recoveryPath.length > 0
        ) {
          analysisMsg += `\n💡 Recovery Path: Complete these to improve:\n${recoveryPath
            .map((i) => `- ${i.title}`)
            .join("\n")}`;
        }
      }

      return {
        success: true,
        data: {
          briefing,
          message: `Daily Briefing for ${briefing.date}:\n\n${overdueMsg}\n\n${todayMsg}\n\n${upcomingMsg}${analysisMsg}`,
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
