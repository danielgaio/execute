import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { calculateLeadScore, type ScorableItem } from "../../domain/scoring";
import { getWeekStart } from "../../../utils/planning";

// Schema defined separately for type inference
const weeklyScoreSchema = z.object({
  week_offset: z
    .number()
    .optional()
    .default(0)
    .describe(
      "The week to calculate for, relative to the current week. 0 is current week, -1 is last week, etc."
    ),
  team_id: z
    .string()
    .optional()
    .describe("Optional team ID to filter by. If omitted, calculates for the user's personal context."),
});

export const getWeeklyScoreTool: AgentTool = {
  name: "get_weekly_score",
  description:
    "Calculate the execution score (Lead Score) for a specific week. Returns the percentage score (0-100) and a breakdown of completed vs planned items. Use this to review progress or analyze performance.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: weeklyScoreSchema,
  handler: async (
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const { week_offset = 0, team_id } = params as z.infer<typeof weeklyScoreSchema>;

      // Calculate date range
      const now = new Date();
      const currentWeekStart = getWeekStart(now);
      
      // Adjust for offset
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(currentWeekStart.getDate() + (week_offset * 7));
      
      const targetWeekEnd = new Date(targetWeekStart);
      targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
      targetWeekEnd.setHours(23, 59, 59, 999);

      const startStr = targetWeekStart.toISOString().split("T")[0];
      const endStr = targetWeekEnd.toISOString().split("T")[0];

      // Build query - using explicit any[] type for flexible query building
      let instances: any[] | null = null;
      let error: any = null;

      if (team_id) {
        // Query with team filter using inner join
        const result = await context.supabase
          .from("tactic_instances")
          .select(
            `
            id, status, planned,
            tactics!inner ( id, title, weight, team_id )
          `
          )
          .eq("org_id", context.orgId)
          .gte("due_date", startStr)
          .lte("due_date", endStr)
          .eq("tactics.team_id", team_id);
        
        instances = result.data;
        error = result.error;
      } else {
        // Query without team filter
        const result = await context.supabase
          .from("tactic_instances")
          .select(
            `
            id, status, planned,
            tactics ( id, title, weight )
          `
          )
          .eq("org_id", context.orgId)
          .gte("due_date", startStr)
          .lte("due_date", endStr);
        
        instances = result.data;
        error = result.error;
      }

      if (error) {
        throw new Error(`Failed to fetch tactic instances: ${error.message}`);
      }

      if (!instances || instances.length === 0) {
        return {
          success: true,
          data: {
            score: 100,
            week_start: startStr,
            week_end: endStr,
            total_items: 0,
            completed_items: 0,
            message: "No items found for this week.",
          },
        };
      }

      // Map to ScorableItem
      const scorableItems: ScorableItem[] = instances.map((i: any) => ({
        id: i.id,
        status: i.status,
        weight: i.tactics?.weight || 1.0,
        planned: i.planned !== false, // Default to true if null/undefined, though DB should handle it
      }));

      const score = calculateLeadScore(scorableItems);

      // Generate breakdown
      const plannedItems = scorableItems.filter((i) => i.planned);
      const completedItems = plannedItems.filter((i) => i.status === "done");
      
      const totalWeight = plannedItems.reduce((sum, i) => sum + (i.weight > 0 ? i.weight : 1.0), 0);
      const completedWeight = completedItems.reduce((sum, i) => sum + (i.weight > 0 ? i.weight : 1.0), 0);

      return {
        success: true,
        data: {
          score,
          week_start: startStr,
          week_end: endStr,
          total_items: plannedItems.length,
          completed_items: completedItems.length,
          total_weight: totalWeight,
          completed_weight: completedWeight,
          items: instances.map((i: any) => ({
            id: i.id,
            title: i.tactics?.title,
            status: i.status,
            weight: i.tactics?.weight,
            planned: i.planned
          })),
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
