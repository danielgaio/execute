import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { logAgentAction, captureEntityState } from "../audit-service";

/**
 * Complete a tactic by name (fuzzy match)
 */
export const completeTacticByNameTool: AgentTool = {
  name: "complete_tactic_by_name",
  description:
    "Mark a tactic as complete by providing its name or title. Useful when the user says 'I finished the report' without an ID. It will search for pending items due recently.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    tactic_name: z.string().describe("The name or title of the tactic to complete"),
    notes: z.string().optional().describe("Optional notes about the completion"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const searchTerm = params.tactic_name as string;
      
      // 1. Find pending instances that match the name
      // We look for items due in the last 7 days or next 7 days to be safe
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const { data: candidates, error } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id, due_date, status,
          tactics!inner (
            id, title
          )
        `
        )
        .eq("org_id", context.orgId)
        .eq("status", "pending")
        .gte("due_date", lastWeek.toISOString().split("T")[0])
        .lte("due_date", nextWeek.toISOString().split("T")[0])
        .ilike("tactics.title", `%${searchTerm}%`);

      if (error) throw error;

      if (!candidates || candidates.length === 0) {
        return {
          success: false,
          error: `Could not find any pending tactic matching "${searchTerm}". Please be more specific or check if it's already done.`,
        };
      }

      if (candidates.length > 1) {
        // If multiple matches, ask for clarification
        // But since this is an action tool, we might just fail and list options
        const options = candidates.map((c: any) => `"${c.tactics.title}" (Due: ${c.due_date})`).join(", ");
        return {
          success: false,
          error: `Found multiple matching tactics: ${options}. Please specify which one.`,
        };
      }

      const targetInstance = candidates[0];

      // 2. Perform Completion (Reuse logic from mark_tactic_complete)
      // Capture state before modification
      const beforeState = await captureEntityState(
        context.supabase,
        "tactic_instances",
        targetInstance.id
      );

      const { error: updateError } = await context.supabase
        .from("tactic_instances")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          notes: params.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetInstance.id)
        .eq("org_id", context.orgId);

      if (updateError) throw updateError;

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "complete_tactic_by_name",
        action: "update",
        entityType: "tactic_instance",
        entityId: targetInstance.id,
        beforeState,
        afterState: { ...targetInstance, status: "done" },
        metadata: {
          confirmed: true,
          completion_notes: params.notes,
          matched_term: searchTerm
        },
      });

      return {
        success: true,
        data: {
          instance: targetInstance,
          message: `✅ Marked "${targetInstance.tactics.title}" as complete!`,
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
