import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";
import { logAgentAction } from "../audit-service";
import { embeddingService } from "../embedding-service";

/**
 * Get context for a Weekly Progress Review (WPR)
 */
export const getWPRContextTool: AgentTool = {
  name: "get_wpr_context",
  description: "Gather all necessary data to conduct a Weekly Progress Review (WPR). Returns the calculated Lead Score, Tactic completion status, and Goal status for the specified week.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z.string().optional().describe("The start date of the week to review (YYYY-MM-DD). Defaults to the current week."),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const weekStart = params.week_start || getWeekStart().toISOString().split('T')[0];

      // 1. Get Active Cycle
      const { data: activeCycle } = await context.supabase
        .from("cycles")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("status", "active")
        .single();

      if (!activeCycle) {
        return { success: false, error: "No active cycle found." };
      }

      // 2. Get Tactic Instances for the week
      const { data: instances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, planned,
          tactics ( id, title, weight, goal_id )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      // 3. Calculate Lead Score
      let totalWeight = 0;
      let completedWeight = 0;
      const tacticDetails = [];

      if (instances) {
        for (const inst of instances) {
          const weight = inst.tactics?.weight || 1.0;
          totalWeight += weight;
          if (inst.status === 'done') {
            completedWeight += weight;
          }
          tacticDetails.push({
            title: inst.tactics?.title,
            status: inst.status,
            weight: weight
          });
        }
      }

      const leadScore = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 100;

      // 4. Get Goals Status
      const { data: goals } = await context.supabase
        .from("goals")
        .select("id, title, status, target, baseline, unit")
        .eq("cycle_id", activeCycle.id);

      return {
        success: true,
        data: {
          weekStart,
          cycle: activeCycle.title,
          leadScore,
          stats: {
            totalTactics: instances?.length || 0,
            completedTactics: instances?.filter(i => i.status === 'done').length || 0,
            completionRate: `${leadScore}%`
          },
          tacticDetails,
          goals: goals || [],
          message: `WPR Context loaded. Lead Score: ${leadScore}%.`
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * Submit a Weekly Progress Review
 */
export const submitWPRTool: AgentTool = {
  name: "submit_wpr",
  description: "Finalize and save a Weekly Progress Review (WPR). Records the score, notes, and decisions.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    week_start: z.string().describe("The start date of the week being reviewed (YYYY-MM-DD)."),
    notes: z.string().describe("Qualitative notes, decisions, and analysis of the week."),
    lead_score: z.number().describe("The final calculated lead score (0-100)."),
    lag_status: z.string().describe("Summary of goal status (e.g., 'All on track')."),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // 1. Get Active Cycle
      const { data: activeCycle } = await context.supabase
        .from("cycles")
        .select("id")
        .eq("org_id", context.orgId)
        .eq("status", "active")
        .single();

      if (!activeCycle) throw new Error("No active cycle found.");

      // 2. Check if WPR already exists
      const { data: existingWPR } = await context.supabase
        .from("weekly_reviews")
        .select("id")
        .eq("org_id", context.orgId)
        .eq("cycle_id", activeCycle.id)
        .eq("week_start", params.week_start)
        .single();

      let wpr;
      let actionType = "create";

      if (existingWPR) {
        actionType = "update";
        const { data, error } = await context.supabase
          .from("weekly_reviews")
          .update({
            lead_score: params.lead_score,
            lag_status: params.lag_status,
            notes: params.notes,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingWPR.id)
          .select()
          .single();
        if (error) throw error;
        wpr = data;
      } else {
        const { data, error } = await context.supabase
          .from("weekly_reviews")
          .insert({
            org_id: context.orgId,
            cycle_id: activeCycle.id,
            week_start: params.week_start,
            lead_score: params.lead_score,
            lag_status: params.lag_status,
            notes: params.notes,
            created_by: context.userId
          })
          .select()
          .single();
        if (error) throw error;
        wpr = data;
      }

      // 3. Index for RAG
      const content = `Weekly Review (${params.week_start})
Score: ${params.lead_score}%
Goals: ${params.lag_status}
Notes: ${params.notes}`;
      
      await embeddingService.storeEmbedding(
        context.supabase,
        content,
        {
          entity_type: "wpr",
          entity_id: wpr.id,
          title: `WPR ${params.week_start}`,
          week_start: params.week_start
        },
        context.orgId!
      );

      // 4. Audit Log
      await logAgentAction(context.supabase, {
        org_id: context.orgId!,
        actor_user_id: context.userId!,
        action: "agent_tool_call",
        entity_type: "wpr",
        entity_id: wpr.id,
        details: {
          tool: "submit_wpr",
          action: actionType,
          score: params.lead_score
        }
      });

      return {
        success: true,
        data: wpr,
        message: `Weekly Review ${actionType}d successfully.`
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

export const wprTools = [
  getWPRContextTool,
  submitWPRTool
];
