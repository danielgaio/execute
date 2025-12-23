import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";
import { logAgentAction } from "../audit-service";
import { embeddingService } from "../embedding-service";
import { calculateLeadScore, getPerformanceStatus, type ScorableItem } from "@/lib/domain/scoring";

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

      // 3. Calculate Lead Score using Domain Logic
      const scorableItems: ScorableItem[] = (instances || []).map((inst: any) => ({
        id: inst.id,
        status: inst.status,
        weight: inst.tactics?.weight || 1.0,
        planned: inst.planned
      }));

      const leadScore = calculateLeadScore(scorableItems);
      const performance = getPerformanceStatus(leadScore);

      // Prepare details for the agent
      const tacticDetails = (instances || []).map((inst: any) => ({
        title: inst.tactics?.title,
        status: inst.status,
        weight: inst.tactics?.weight || 1.0
      }));

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
          performance,
          stats: {
            totalTactics: instances?.length || 0,
            completedTactics: instances?.filter((i: any) => i.status === 'done').length || 0,
            completionRate: `${leadScore}%`
          },
          tacticDetails,
          goals: goals || [],
          message: `WPR Context loaded. Lead Score: ${leadScore}% (${performance}).`
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

      // 2. Recalculate Lead Score (Server-Side Validation)
      // We do NOT trust the agent's passed score. We recalculate it from the DB.
      const { data: instances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, planned,
          tactics ( weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", params.week_start)
        .eq("planned", true);

      const scorableItems: ScorableItem[] = (instances || []).map((inst: any) => ({
        id: inst.id,
        status: inst.status,
        weight: inst.tactics?.weight || 1.0,
        planned: inst.planned
      }));

      const calculatedLeadScore = calculateLeadScore(scorableItems);

      // 3. Check if WPR already exists
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
            lead_score: calculatedLeadScore,
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
            lead_score: calculatedLeadScore,
            lag_status: params.lag_status,
            notes: params.notes,
            created_by: context.userId
          })
          .select()
          .single();
        if (error) throw error;
        wpr = data;
      }

      // 4. Index for RAG
      const content = `Weekly Review (${params.week_start})
Score: ${calculatedLeadScore}%
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

      // 5. Audit Log
      await logAgentAction(context.supabase, {
        org_id: context.orgId!,
        actor_user_id: context.userId!,
        action: "agent_tool_call",
        entity_type: "wpr",
        entity_id: wpr.id,
        details: {
          tool: "submit_wpr",
          action: actionType,
          score: calculatedLeadScore
        }
      });

      return {
        success: true,
        data: wpr,
        message: `Weekly Review ${actionType}d successfully. Validated Score: ${calculatedLeadScore}%.`
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
