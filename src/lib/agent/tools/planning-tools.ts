import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

/**
 * Get the current planning status (Cycle, Vision, Goals)
 */
export const getPlanningStatusTool: AgentTool = {
  name: "get_planning_status",
  description: "Check the current status of the 12-week plan (Cycle, Vision, Goals). Use this to determine what needs to be created next.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({}),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // 1. Check for active cycle
      const { data: activeCycle } = await context.supabase
        .from("cycles")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("status", "active")
        .single();

      // 2. Check for vision
      const { data: vision } = await context.supabase
        .from("visions")
        .select("*")
        .eq("org_id", context.orgId)
        .single();

      // 3. Check for goals (if cycle exists)
      let goals: any[] = [];
      if (activeCycle) {
        const { data } = await context.supabase
          .from("goals")
          .select("*")
          .eq("cycle_id", activeCycle.id);
        goals = data || [];
      }

      // 4. Construct status report
      const status = {
        hasActiveCycle: !!activeCycle,
        hasVision: !!vision,
        goalCount: goals.length,
        activeCycle: activeCycle ? {
          title: activeCycle.title,
          startDate: activeCycle.start_date,
          endDate: activeCycle.end_date,
          daysRemaining: activeCycle ? Math.ceil((new Date(activeCycle.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0
        } : null,
        visionPreview: vision ? vision.content_md.substring(0, 100) + "..." : null,
        goals: goals.map(g => ({ title: g.title, status: g.status }))
      };

      let nextSteps = [];
      if (!vision) nextSteps.push("Create a Vision statement.");
      if (!activeCycle) nextSteps.push("Create a new 12-week Cycle.");
      if (activeCycle && goals.length === 0) nextSteps.push("Create Goals for the active Cycle.");
      if (activeCycle && goals.length > 0) nextSteps.push("Review Tactics for existing Goals.");

      return {
        success: true,
        data: {
          status,
          nextSteps,
          message: "Planning status retrieved."
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

export const planningTools = [
  getPlanningStatusTool
];
