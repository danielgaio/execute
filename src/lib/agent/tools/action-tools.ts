/**
 * Agent Tools - Action Tools
 * Write operations that modify data (require confirmation)
 */

import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { embeddingService } from "../embedding-service";
import { generateTacticInstancesForWeek, getWeekStart } from "@/utils/planning";

/**
 * Create a new 12-week cycle
 */
export const createCycleTool: AgentTool = {
  name: "create_cycle",
  description:
    "Create a new 12-week execution cycle. Requires a title and start date.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    title: z.string().describe("Title of the cycle (e.g., 'Q4 2025 Push')"),
    start_date: z
      .string()
      .describe("Start date of the cycle (YYYY-MM-DD)"),
    end_date: z
      .string()
      .describe("End date of the cycle (YYYY-MM-DD)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { data: cycle, error } = await context.supabase
        .from("cycles")
        .insert({
          org_id: context.orgId,
          owner_user_id: context.userId,
          title: params.title,
          start_date: params.start_date,
          end_date: params.end_date,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Index for RAG
      await embeddingService.indexCycle(context.supabase, cycle, context.orgId!);

      return {
        success: true,
        data: {
          cycle,
          message: `✅ Created new cycle: "${cycle.title}"`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create cycle",
      };
    }
  },
};

/**
 * Create a new goal (Lag Indicator)
 */
export const createGoalTool: AgentTool = {
  name: "create_goal",
  description:
    "Create a new goal (lag indicator) for a cycle. Goals are the outcomes you want to achieve.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    cycle_id: z.string().describe("ID of the cycle this goal belongs to"),
    title: z.string().describe("Title of the goal"),
    description: z.string().optional().describe("Description of the goal"),
    unit: z.string().optional().describe("Unit of measurement (e.g., 'USD', '%')"),
    target: z.number().describe("Target value to achieve"),
    baseline: z.number().optional().describe("Starting value (default: 0)"),
    target_date: z.string().optional().describe("Target date (YYYY-MM-DD)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { data: goal, error } = await context.supabase
        .from("goals")
        .insert({
          org_id: context.orgId,
          cycle_id: params.cycle_id,
          owner_user_id: context.userId,
          title: params.title,
          description: params.description,
          unit: params.unit,
          target: params.target,
          baseline: params.baseline || 0,
          target_date: params.target_date,
          status: "on_track",
        })
        .select()
        .single();

      if (error) throw error;

      // Index for RAG
      await embeddingService.indexGoal(context.supabase, goal, context.orgId!);

      return {
        success: true,
        data: {
          goal,
          message: `✅ Created goal: "${goal.title}"`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create goal",
      };
    }
  },
};

/**
 * Create a new tactic (Lead Indicator)
 */
export const createTacticTool: AgentTool = {
  name: "create_tactic",
  description:
    "Create a new tactic (lead indicator). Tactics are the specific actions you will take to achieve a goal.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    goal_id: z.string().describe("ID of the goal this tactic supports"),
    title: z.string().describe("Title of the tactic"),
    description: z.string().optional().describe("Description of the tactic"),
    weight: z.number().optional().describe("Weight of the tactic (0.1 to 1.0, default: 1.0)"),
    recurrence: z.enum(["weekly", "daily", "one_off"]).optional().describe("Recurrence pattern (default: weekly)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { data: tactic, error } = await context.supabase
        .from("tactics")
        .insert({
          org_id: context.orgId,
          goal_id: params.goal_id,
          title: params.title,
          description: params.description,
          weight: params.weight || 1.0,
          recurrence: params.recurrence || "weekly",
          due_days: [5], // Default to Friday
          assignee_user_id: context.userId,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Index for RAG
      await embeddingService.indexTactic(context.supabase, tactic, context.orgId!);

      // Generate instances for current week
      try {
        await generateTacticInstancesForWeek(
          context.supabase,
          tactic.id,
          getWeekStart(),
          context.orgId!
        );
      } catch (e) {
        console.error("Error generating instances:", e);
      }

      return {
        success: true,
        data: {
          tactic,
          message: `✅ Created tactic: "${tactic.title}"`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create tactic",
      };
    }
  },
};

/**
 * Mark a tactic instance as complete
 */
export const markTacticCompleteTool: AgentTool = {
  name: "mark_tactic_complete",
  description:
    "Mark a tactic instance as completed. This updates the lead score and tracks execution.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    instance_id: z
      .string()
      .describe("The ID of the tactic instance to mark as complete"),
    notes: z
      .string()
      .optional()
      .describe("Optional notes about the completion"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { error } = await context.supabase
        .from("tactic_instances")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          notes: params.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.instance_id)
        .eq("org_id", context.orgId); // RLS check

      if (error) throw error;

      // Fetch the updated instance with tactic details
      const { data: instance } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          *,
          tactics (
            title,
            weight
          )
        `
        )
        .eq("id", params.instance_id)
        .single();

      return {
        success: true,
        data: {
          instance,
          message: `✅ Marked "${instance?.tactics?.title}" as complete!`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark tactic as complete",
      };
    }
  },
};

/**
 * Defer a tactic instance to next week
 */
export const deferTacticTool: AgentTool = {
  name: "defer_tactic",
  description:
    "Defer a tactic instance to next week. The instance will be moved to the next weekly plan.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    instance_id: z.string().describe("The ID of the tactic instance to defer"),
    reason: z.string().optional().describe("Reason for deferring (optional)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { error } = await context.supabase
        .from("tactic_instances")
        .update({
          status: "deferred",
          notes: params.reason || "Deferred by agent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.instance_id)
        .eq("org_id", context.orgId);

      if (error) throw error;

      return {
        success: true,
        data: {
          message: "Tactic deferred to next week",
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to defer tactic",
      };
    }
  },
};

// Export all action tools
export const actionTools = [
  createCycleTool,
  createGoalTool,
  createTacticTool,
  markTacticCompleteTool,
  deferTacticTool,
];
