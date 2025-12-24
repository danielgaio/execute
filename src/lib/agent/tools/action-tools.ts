/**
 * Agent Tools - Action Tools
 * Write operations that modify data (require confirmation)
 */

import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { embeddingService } from "../embedding-service";
import { logAgentAction, captureEntityState } from "../audit-service";
import { generateTacticInstancesForWeek, getWeekStart } from "@/utils/planning";
import { deferInstance, skipInstance } from "@/lib/domain/execution";

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

      // Log agent action to audit trail
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "create_cycle",
        action: "create",
        entityType: "cycle",
        entityId: cycle.id,
        afterState: cycle,
        metadata: {
          confirmed: true,
          tool_category: "planning",
        },
      });

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

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "create_goal",
        action: "create",
        entityType: "goal",
        entityId: goal.id,
        afterState: goal,
        metadata: {
          confirmed: true,
          cycle_id: params.cycle_id,
        },
      });

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
    due_days: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).optional().describe("Days of the week the tactic is due (for weekly recurrence). Default: ['Friday']"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // Map day name to index (1=Monday, 7=Sunday)
      const dayMap: Record<string, number> = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, 
        "Friday": 5, "Saturday": 6, "Sunday": 7
      };
      
      let dueDays: number[] = [5]; // Default to Friday

      if (params.due_days && params.due_days.length > 0) {
        dueDays = params.due_days.map(d => dayMap[d]);
      }

      const { data: tactic, error } = await context.supabase
        .from("tactics")
        .insert({
          org_id: context.orgId,
          goal_id: params.goal_id,
          title: params.title,
          description: params.description,
          weight: params.weight || 1.0,
          recurrence: params.recurrence || "weekly",
          due_days: dueDays,
          assignee_user_id: context.userId,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Index for RAG
      await embeddingService.indexTactic(context.supabase, tactic, context.orgId!);

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "create_tactic",
        action: "create",
        entityType: "tactic",
        entityId: tactic.id,
        afterState: tactic,
        metadata: {
          confirmed: true,
          goal_id: params.goal_id,
        },
      });

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
      // Capture state before modification
      const beforeState = await captureEntityState(
        context.supabase,
        "tactic_instances",
        params.instance_id as string
      );

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

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "mark_tactic_complete",
        action: "update",
        entityType: "tactic_instance",
        entityId: params.instance_id as string,
        beforeState,
        afterState: instance,
        metadata: {
          confirmed: true,
          completion_notes: params.notes,
        },
      });

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
      // Capture state before modification
      const beforeState = await captureEntityState(
        context.supabase,
        "tactic_instances",
        params.instance_id as string
      );

      if (!beforeState) throw new Error("Instance not found");

      // Use domain logic
      const result = await deferInstance(
        context.supabase,
        params.instance_id as string,
        context.orgId!,
        params.reason
      );

      // Fetch updated instance
      const afterState = await captureEntityState(
        context.supabase,
        "tactic_instances",
        params.instance_id as string
      );

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "defer_tactic",
        action: "update",
        entityType: "tactic_instance",
        entityId: params.instance_id as string,
        beforeState,
        afterState,
        metadata: {
          confirmed: true,
          defer_reason: params.reason,
          new_due_date: result.nextDueDate
        },
      });

      return {
        success: true,
        data: {
          message: `Tactic deferred to next week (${result.nextDueDate})`,
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

/**
 * Bulk update tactic instances (e.g., for WPR cleanup)
 */
export const bulkUpdateTacticsTool: AgentTool = {
  name: "bulk_update_tactics",
  description: "Perform bulk actions on multiple tactic instances. Useful for cleaning up pending items during a Weekly Review (e.g., 'Defer all pending').",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    instance_ids: z.array(z.string()).describe("List of tactic instance IDs to update"),
    action: z.enum(["defer", "skip", "complete"]).describe("Action to perform"),
    reason: z.string().optional().describe("Reason for the action (e.g., 'WPR Cleanup')"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const results = [];
      const errors = [];

      for (const id of params.instance_ids) {
        try {
          if (params.action === "defer") {
            await deferInstance(context.supabase, id, context.orgId!, params.reason);
            results.push(id);
          } else if (params.action === "skip") {
            await skipInstance(context.supabase, id, context.orgId!, params.reason);
            results.push(id);
          } else if (params.action === "complete") {
             // Reuse existing logic or simple update
             await context.supabase
               .from("tactic_instances")
               .update({ status: "done", notes: params.reason, updated_at: new Date().toISOString() })
               .eq("id", id)
               .eq("org_id", context.orgId!);
             results.push(id);
          }
        } catch (e: any) {
          errors.push({ id, error: e.message });
        }
      }

      // Log summary action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "bulk_update_tactics",
        action: "update",
        entityType: "tactic_instance", // Generic
        entityId: "bulk",
        details: {
          action: params.action,
          count: results.length,
          ids: results,
          errors
        }
      });

      return {
        success: true,
        data: {
          processed: results.length,
          failed: errors.length,
          message: `Successfully processed ${results.length} items. ${errors.length > 0 ? `${errors.length} failed.` : ""}`
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};

/**
 * Update a tactic's configuration (weight, schedule, title)
 */
export const updateTacticTool: AgentTool = {
  name: "update_tactic",
  description:
    "Update a tactic's configuration. Use this to change the weight (importance), reschedule (change due days), or update the title/description.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    tactic_id: z.string().describe("The ID of the tactic to update"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    weight: z.number().optional().describe("New weight (0.1 to 1.0)"),
    due_days: z.array(z.number().min(1).max(7)).optional().describe("New due days (1=Monday, 7=Sunday)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // Capture state before modification
      const beforeState = await captureEntityState(
        context.supabase,
        "tactics",
        params.tactic_id as string
      );

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.title) updates.title = params.title;
      if (params.description) updates.description = params.description;
      if (params.weight !== undefined) updates.weight = params.weight;
      if (params.due_days !== undefined) updates.due_days = params.due_days;

      const { error } = await context.supabase
        .from("tactics")
        .update(updates)
        .eq("id", params.tactic_id)
        .eq("org_id", context.orgId);

      if (error) throw error;

      // Fetch updated tactic
      const { data: tactic } = await context.supabase
        .from("tactics")
        .select("*")
        .eq("id", params.tactic_id)
        .single();

      // Re-index if content changed
      if (params.title || params.description || params.weight) {
        await embeddingService.indexTactic(context.supabase, tactic, context.orgId!);
      }

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "update_tactic",
        action: "update",
        entityType: "tactic",
        entityId: params.tactic_id as string,
        beforeState,
        afterState: tactic,
        metadata: {
          confirmed: true,
          updates: params,
        },
      });

      return {
        success: true,
        data: {
          tactic,
          message: `✅ Updated tactic "${tactic.title}"`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update tactic",
      };
    }
  },
};

/**
 * Create or update the vision for the organization
 */
export const createVisionTool: AgentTool = {
  name: "create_vision",
  description: "Create or update the long-term vision for the organization.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    content: z.string().describe("The vision statement in Markdown format"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // Check if vision exists
      const { data: existingVision } = await context.supabase
        .from("visions")
        .select("*")
        .eq("org_id", context.orgId)
        .single();

      let vision;
      let actionType = "create";
      let oldState = null;

      if (existingVision) {
        actionType = "update";
        oldState = existingVision;
        // Update existing vision
        const { data, error } = await context.supabase
          .from("visions")
          .update({
            content_md: params.content,
            version: existingVision.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingVision.id)
          .select()
          .single();
        
        if (error) throw error;
        vision = data;
      } else {
        // Create new vision
        const { data, error } = await context.supabase
          .from("visions")
          .insert({
            org_id: context.orgId,
            user_id: context.userId,
            content_md: params.content,
            version: 1,
          })
          .select()
          .single();
          
        if (error) throw error;
        vision = data;
      }

      // Index for RAG
      await embeddingService.indexVision(context.supabase, vision, context.orgId!);

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "create_vision",
        action: actionType as "create" | "update",
        entityType: "vision",
        entityId: vision.id,
        beforeState: oldState,
        afterState: vision,
        metadata: {
          confirmed: true,
          content_length: params.content.length
        }
      });

      return {
        success: true,
        data: {
          vision,
          message: `✅ Vision ${actionType}d successfully.`,
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
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
  bulkUpdateTacticsTool,
  updateTacticTool,
  createVisionTool,
];
