/**
 * Agent Tools - Query Tools
 * Read-only tools that retrieve information
 */

import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getEntityHistory, getRecentAuditActivity } from "../audit-service";

/**
 * List all active cycles for the user's organization
 */
export const listCyclesTool: AgentTool = {
  name: "list_cycles",
  description:
    "Get all active and recent 12-week cycles for the user. Use this to understand what cycles are currently being tracked.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    status: z
      .enum(["active", "completed", "all"])
      .optional()
      .describe("Filter cycles by status"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of cycles to return (default: 10)"),
  }),
  handler: async (
    params: { status?: "active" | "completed" | "all"; limit?: number },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let query = context.supabase
        .from("cycles")
        .select("*")
        .eq("org_id", context.orgId)
        .order("start_date", { ascending: false })
        .limit(params.limit ?? 10);

      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          cycles: data,
          count: data.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch cycles",
      };
    }
  },
};

/**
 * List goals for a specific cycle
 */
export const listGoalsTool: AgentTool = {
  name: "list_goals",
  description:
    "Get goals (lag indicators) for a specific cycle. Goals are outcome metrics like revenue or customer satisfaction.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    cycle_id: z
      .string()
      .optional()
      .describe(
        "Cycle ID to get goals for. If not provided, uses the most recent active cycle."
      ),
    status: z
      .enum([
        "on_track",
        "at_risk",
        "off_track",
        "completed",
        "abandoned",
        "all",
      ])
      .optional()
      .describe("Filter by goal status"),
  }),
  handler: async (
    params: { cycle_id?: string; status?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let cycleId = params.cycle_id;

      // If no cycle_id provided, get the most recent active cycle
      if (!cycleId) {
        const { data: cycle } = await context.supabase
          .from("cycles")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("status", "active")
          .order("start_date", { ascending: false })
          .limit(1)
          .single();

        if (!cycle) {
          return {
            success: false,
            error: "No active cycle found. Please create a cycle first.",
          };
        }

        cycleId = cycle.id;
      }

      let query = context.supabase
        .from("goals")
        .select("*")
        .eq("cycle_id", cycleId)
        .order("created_at", { ascending: false });

      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          goals: data,
          count: data.length,
          cycle_id: cycleId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch goals",
      };
    }
  },
};

/**
 * List tactics for a specific goal or cycle
 */
export const listTacticsTool: AgentTool = {
  name: "list_tactics",
  description:
    "Get tactics (lead indicators) for a specific goal or all tactics in a cycle. Tactics are specific actions that drive goal achievement.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    goal_id: z.string().optional().describe("Goal ID to get tactics for"),
    cycle_id: z.string().optional().describe("Cycle ID to get all tactics for"),
    status: z
      .enum(["active", "completed", "paused", "archived", "all"])
      .optional()
      .describe("Filter by tactic status"),
  }),
  handler: async (
    params: { goal_id?: string; cycle_id?: string; status?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      if (!params.goal_id && !params.cycle_id) {
        return {
          success: false,
          error: "Please provide either goal_id or cycle_id",
        };
      }

      let query = context.supabase
        .from("tactics")
        .select(
          `
          *,
          goals (
            id,
            title,
            cycle_id
          )
        `
        )
        .eq("org_id", context.orgId);

      if (params.goal_id) {
        query = query.eq("goal_id", params.goal_id);
      }

      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by cycle_id if provided (needs to be done client-side)
      let filteredData = data;
      if (params.cycle_id) {
        filteredData = data.filter(
          (t: { goals: { cycle_id: string } }) =>
            t.goals.cycle_id === params.cycle_id
        );
      }

      return {
        success: true,
        data: {
          tactics: filteredData,
          count: filteredData.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch tactics",
      };
    }
  },
};

/**
 * Get today's focus - tactic instances due today
 */
export const getTodayFocusTool: AgentTool = {
  name: "get_today_focus",
  description:
    "Get all tactic instances due today for the user. This shows what tasks need to be completed today.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    include_completed: z
      .boolean()
      .optional()
      .describe("Include already completed items (default: false)"),
  }),
  handler: async (
    params: { include_completed?: boolean },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const today = new Date().toISOString().split("T")[0];

      let query = context.supabase
        .from("tactic_instances")
        .select(
          `
          *,
          tactics (
            id,
            title,
            description,
            weight,
            goals (
              id,
              title
            )
          )
        `
        )
        .eq("org_id", context.orgId)
        .eq("due_date", today)
        .order("status", { ascending: false });

      if (!params.include_completed) {
        query = query.neq("status", "done");
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          items: data,
          count: data.length,
          date: today,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch today's focus items",
      };
    }
  },
};

/**
 * Get weekly score and progress
 */
export const getWeeklyScoreTool: AgentTool = {
  name: "get_weekly_score",
  description:
    "Calculate and explain the current weekly lead score based on completed vs planned tactics.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z
      .string()
      .optional()
      .describe(
        "Week start date (YYYY-MM-DD). If not provided, uses current week."
      ),
  }),
  handler: async (
    params: { week_start?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let weekStart = params.week_start;

      // If no week_start provided, calculate current week's Monday
      if (!weekStart) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        weekStart = monday.toISOString().split("T")[0];
      }

      const { data: instances, error } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id,
          status,
          tactics (
            id,
            title,
            weight
          )
        `
        )
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      if (error) throw error;

      let totalWeight = 0;
      let completedWeight = 0;
      const completed: unknown[] = [];
      const pending: unknown[] = [];

      type InstanceWithTactics = {
        status: string;
        tactics: { weight: number; title: string } | null;
      };

      instances?.forEach((instance) => {
        const typedInstance = instance as unknown as InstanceWithTactics;
        const weight = typedInstance.tactics?.weight || 1.0;
        totalWeight += weight;

        if (typedInstance.status === "done") {
          completedWeight += weight;
          completed.push(instance);
        } else if (typedInstance.status === "pending") {
          pending.push(instance);
        }
      });

      const score =
        totalWeight > 0
          ? Math.round((completedWeight / totalWeight) * 100)
          : 100;

      return {
        success: true,
        data: {
          score,
          week_start: weekStart,
          total_planned: instances?.length || 0,
          completed_count: completed.length,
          pending_count: pending.length,
          total_weight: totalWeight,
          completed_weight: completedWeight,
          completed_items: completed,
          pending_items: pending,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate weekly score",
      };
    }
  },
};

/**
 * Get change history for an entity
 */
export const getEntityHistoryTool: AgentTool = {
  name: "get_entity_history",
  description:
    "Get complete change history for an entity (cycle, goal, tactic, etc.). Shows who changed what and when.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    entity_type: z
      .enum([
        "cycle",
        "goal",
        "tactic",
        "tactic_instance",
        "vision",
        "weekly_plan",
      ])
      .describe("Type of entity to get history for"),
    entity_id: z.string().describe("ID of the entity"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of history entries to return (default: 50)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const { entity_type, entity_id, limit } = params as {
        entity_type: string;
        entity_id: string;
        limit?: number;
      };

      const history = await getEntityHistory(
        context.supabase,
        entity_type,
        entity_id,
        limit || 50
      );

      return {
        success: true,
        data: {
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          history,
          count: history.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get entity history",
      };
    }
  },
};

/**
 * Get recent activity across the organization
 */
export const getRecentActivityTool: AgentTool = {
  name: "get_recent_activity",
  description:
    "Get recent activity across the organization. Useful for understanding what's been happening, who's making changes, and what agent actions have been executed.",
  category: "query",
  requiresConfirmation: false,
  parameters: z.object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of activity entries to return (default: 50)"),
  }),
  handler: async (
    params: { limit?: number },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      if (!context.orgId) {
        return {
          success: false,
          error: "No organization context available",
        };
      }

      const activity = await getRecentAuditActivity(
        context.supabase,
        context.orgId,
        params.limit || 50
      );

      return {
        success: true,
        data: {
          activity,
          count: activity.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recent activity",
      };
    }
  },
};

// Export all query tools
export const queryTools = [
  listCyclesTool,
  listGoalsTool,
  listTacticsTool,
  getTodayFocusTool,
  getWeeklyScoreTool,
  getEntityHistoryTool,
  getRecentActivityTool,
];
