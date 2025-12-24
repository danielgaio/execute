import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { embeddingService } from "../embedding-service";
import { generateWeeklyPlan } from "../../domain/planning";

/**
 * Get the current planning status (Cycle, Vision, Goals)
 */
export const getPlanningStatusTool: AgentTool = {
  name: "get_planning_status",
  description:
    "Check the current status of the 12-week plan (Cycle, Vision, Goals). Use this to determine what needs to be created next.",
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
        activeCycle: activeCycle
          ? {
              title: activeCycle.title,
              startDate: activeCycle.start_date,
              endDate: activeCycle.end_date,
              daysRemaining: activeCycle
                ? Math.ceil(
                    (new Date(activeCycle.end_date).getTime() -
                      new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : 0,
            }
          : null,
        visionPreview: vision
          ? vision.content_md.substring(0, 100) + "..."
          : null,
        goals: goals.map((g) => ({ title: g.title, status: g.status })),
      };

      let nextSteps = [];
      if (!vision) nextSteps.push("Create a Vision statement.");
      if (!activeCycle) nextSteps.push("Create a new 12-week Cycle.");
      if (activeCycle && goals.length === 0)
        nextSteps.push("Create Goals for the active Cycle.");
      if (activeCycle && goals.length > 0)
        nextSteps.push("Review Tactics for existing Goals.");

      return {
        success: true,
        data: {
          status,
          nextSteps,
          message: "Planning status retrieved.",
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

/**
 * Suggest tactics for a specific goal using RAG
 */
export const suggestTacticsTool: AgentTool = {
  name: "suggest_tactics_for_goal",
  description:
    "Find similar past tactics or best practices for a given goal description. Use this to help the user brainstorm.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    goalDescription: z
      .string()
      .describe("Description of the goal to find tactics for"),
    limit: z
      .number()
      .optional()
      .describe("Number of suggestions to retrieve (default: 3)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // Search for similar goals/tactics in the vector store
      const similarItems = await embeddingService.searchEmbeddings(
        context.supabase,
        params.goalDescription as string,
        context.orgId!,
        (params.limit as number) || 3,
        0.6 // Threshold
      );

      // Filter for tactics specifically
      const relevantTactics = similarItems
        .filter((item) => item.metadata.entity_type === "tactic")
        .map((item) => ({
          content: item.content,
          similarity: item.similarity,
        }));

      // If no direct tactics found, return the similar goals as context
      const relevantContext = similarItems.map(
        (item) => `[${item.metadata.entity_type}] ${item.content}`
      );

      return {
        success: true,
        data: {
          suggestions:
            relevantTactics.length > 0
              ? relevantTactics
              : "No direct past tactics found.",
          context: relevantContext,
          message: `Found ${relevantTactics.length} relevant past tactics and ${similarItems.length} context items.`,
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

/**
 * Review the feasibility of the current plan
 */
export const reviewPlanFeasibilityTool: AgentTool = {
  name: "review_plan_feasibility",
  description:
    "Analyze the current cycle's plan for bottlenecks, overload, or missing links.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    cycleId: z
      .string()
      .optional()
      .describe("ID of the cycle to review (defaults to active)"),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      let cycleId = params.cycleId;

      if (!cycleId) {
        const { data: activeCycle } = await context.supabase
          .from("cycles")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("status", "active")
          .single();
        if (!activeCycle) throw new Error("No active cycle found.");
        cycleId = activeCycle.id;
      }

      // Fetch Goals and Tactics
      const { data: goals } = await context.supabase
        .from("goals")
        .select("id, title, tactics(id, title, weight, recurrence_type)")
        .eq("cycle_id", cycleId);

      if (!goals || goals.length === 0) {
        return {
          success: true,
          data: { message: "No goals found for this cycle." },
        };
      }

      const issues: string[] = [];
      const warnings: string[] = [];
      let totalTacticsCount = 0;

      goals.forEach((goal: any) => {
        if (!goal.tactics || goal.tactics.length === 0) {
          issues.push(`Goal "${goal.title}" has no tactics.`);
        } else {
          if (goal.tactics.length > 5) {
            warnings.push(
              `Goal "${goal.title}" has many tactics (${goal.tactics.length}). Consider simplifying or focusing on the most impactful ones.`
            );
          }
          totalTacticsCount += goal.tactics.length;
        }
      });

      // Heuristic: If total tactics > 15, flag it as high load
      if (totalTacticsCount > 15) {
        warnings.push(
          `Total weekly tactic count is high (${totalTacticsCount}). Ensure you have capacity to execute all of them consistently.`
        );
      }

      return {
        success: true,
        data: {
          score: issues.length === 0 ? (warnings.length === 0 ? 100 : 80) : 50,
          issues,
          warnings,
          totalTacticsCount,
          message: "Feasibility review complete.",
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

export const generateWeeklyPlanTool: AgentTool = {
  name: "generate_weekly_plan",
  description:
    "Generate tactic instances for the current week based on active tactics. This should be run at the start of the week or when tactics are changed.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    weekStart: z
      .string()
      .optional()
      .describe(
        "The start date of the week (YYYY-MM-DD). Defaults to current week start."
      ),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      // Parse weekStart or use current week start (Monday)
      let weekStartDate: Date;
      if (params.weekStart) {
        weekStartDate = new Date(params.weekStart as string);
        if (isNaN(weekStartDate.getTime())) {
          throw new Error("Invalid date format for weekStart. Use YYYY-MM-DD.");
        }
      } else {
        // Calculate current week's Monday
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        weekStartDate = new Date(now.setDate(diff));
        weekStartDate.setHours(0, 0, 0, 0);
      }

      const result = await generateWeeklyPlan(
        context.supabase,
        context.orgId!,
        weekStartDate
      );

      return {
        success: true,
        data: {
          message: `Weekly plan generated. Created ${result.generated} instances.`,
          details: result,
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

export const planningTools = [
  getPlanningStatusTool,
  suggestTacticsTool,
  reviewPlanFeasibilityTool,
  generateWeeklyPlanTool,
];
