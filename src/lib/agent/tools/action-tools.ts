/**
 * Agent Tools - Action Tools
 * Write operations that modify data (require confirmation)
 */

import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";

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
export const actionTools = [markTacticCompleteTool, deferTacticTool];
