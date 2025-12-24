import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";
import { generateInstancesForTacticId } from "@/lib/domain/planning";
import { logAgentAction } from "../audit-service";
import { embeddingService } from "../embedding-service";
import { EmailService } from "@/lib/email/service";
import {
  calculateLeadScore,
  getPerformanceStatus,
  type ScorableItem,
} from "@/lib/domain/scoring";
import {
  calculateGoalProgress,
  determineGoalStatus,
  type Goal,
} from "@/lib/domain/goals";

/**
 * Get context for a Weekly Progress Review (WPR)
 */
export const getWPRContextTool: AgentTool = {
  name: "get_wpr_context",
  description:
    "Gather all necessary data to conduct a Weekly Progress Review (WPR). Returns the calculated Lead Score, detailed status of all tactics (completed, pending, deferred), and Goal status (Lag Indicators).",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z
      .string()
      .optional()
      .describe(
        "The start date of the week to review (YYYY-MM-DD). Defaults to the current week."
      ),
  }),
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    try {
      const weekStart =
        (params.week_start as string) ||
        getWeekStart().toISOString().split("T")[0];

      // Calculate next week start for preview
      const nextWeekDate = new Date(weekStart);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const nextWeekStart = nextWeekDate.toISOString().split("T")[0];

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
        .select(
          `
          id, status, planned, due_date, notes,
          tactics ( id, title, weight, goal_id )
        `
        )
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      // 3. Calculate Lead Score using Domain Logic
      const scorableItems: ScorableItem[] = (instances || []).map(
        (inst: any) => ({
          id: inst.id,
          status: inst.status,
          weight: inst.tactics?.weight || 1.0,
          planned: inst.planned,
        })
      );

      const leadScore = calculateLeadScore(scorableItems);
      const performance = getPerformanceStatus(leadScore);

      // Group items for the agent
      const completed = (instances || []).filter(
        (i: any) => i.status === "done"
      );
      const pending = (instances || []).filter(
        (i: any) => i.status === "pending"
      );
      const deferred = (instances || []).filter(
        (i: any) => i.status === "deferred"
      );
      const skipped = (instances || []).filter(
        (i: any) => i.status === "skipped"
      );

      // 4. Get Goals Status (Lag Indicators)
      const { data: goalsData } = await context.supabase
        .from("goals")
        .select(
          "id, title, status, target, baseline, unit, current_value, target_date"
        )
        .eq("cycle_id", activeCycle.id);

      // Calculate cycle progress for goal status determination
      const totalDays = Math.ceil(
        (new Date(activeCycle.end_date).getTime() -
          new Date(activeCycle.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const daysElapsed = Math.ceil(
        (new Date().getTime() - new Date(activeCycle.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const cycleProgress = Math.min(
        100,
        Math.max(0, (daysElapsed / totalDays) * 100)
      );

      const goals = (goalsData || []).map((g: any) => {
        const goal: Goal = {
          ...g,
          start_date: activeCycle.start_date,
          target_date: g.target_date || activeCycle.end_date,
        };
        const progress = calculateGoalProgress(goal);
        const calculatedStatus = determineGoalStatus(goal, cycleProgress);

        return {
          id: g.id,
          title: g.title,
          current: g.current_value ?? g.baseline,
          target: g.target,
          unit: g.unit,
          progress: `${progress}%`,
          status: calculatedStatus, // 'on_track', 'at_risk', etc.
          originalStatus: g.status, // Keep the manual status just in case
        };
      });

      // 5. Preview Next Week (Check if instances exist)
      const { count: nextWeekCount } = await context.supabase
        .from("tactic_instances")
        .select("id", { count: "exact", head: true })
        .eq("org_id", context.orgId)
        .eq("week_start", nextWeekStart)
        .eq("planned", true);

      return {
        success: true,
        data: {
          weekStart,
          nextWeekStart,
          cycle: activeCycle.title,
          leadScore,
          performance,
          stats: {
            total: instances?.length || 0,
            completed: completed.length,
            pending: pending.length,
            deferred: deferred.length,
            skipped: skipped.length,
            completionRate: `${leadScore}%`,
          },
          details: {
            completed: completed.map((i: any) => ({
              title: i.tactics.title,
              id: i.id,
            })),
            pending: pending.map((i: any) => ({
              title: i.tactics.title,
              id: i.id,
              due: i.due_date,
            })),
            deferred: deferred.map((i: any) => ({
              title: i.tactics.title,
              id: i.id,
              notes: i.notes,
            })),
            skipped: skipped.map((i: any) => ({
              title: i.tactics.title,
              id: i.id,
            })),
          },
          goals: goals || [],
          nextWeekPlan: {
            status: nextWeekCount && nextWeekCount > 0 ? "generated" : "empty",
            itemCount: nextWeekCount || 0,
          },
          message: `WPR Context loaded. Score: ${leadScore}% (${performance}). ${pending.length} pending items to review.`,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Submit a Weekly Progress Review
 */
export const submitWPRTool: AgentTool = {
  name: "submit_wpr",
  description:
    "Finalize and save a Weekly Progress Review (WPR). Records the score, notes, and decisions. Can also generate/commit the plan for the next week.",
  category: "action",
  requiresConfirmation: true,
  parameters: z.object({
    week_start: z
      .string()
      .describe("The start date of the week being reviewed (YYYY-MM-DD)."),
    notes: z
      .string()
      .describe("Qualitative notes, decisions, and analysis of the week."),
    lag_status: z
      .string()
      .describe("Summary of goal status (e.g., 'All on track')."),
    pending_action: z
      .enum(["defer", "skip", "none"])
      .optional()
      .describe(
        "Action to take on pending items: 'defer' (move to next week), 'skip' (mark as skipped), or 'none'."
      ),
    commit_next_week: z
      .boolean()
      .optional()
      .describe("If true, generates and activates the plan for the next week."),
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

      // 1.5 Handle Pending Items (if action specified)
      let pendingMessage = "";
      if (params.pending_action && params.pending_action !== "none") {
        const status =
          params.pending_action === "defer" ? "deferred" : "skipped";

        const { data: pendingItems, error: pendingError } =
          await context.supabase
            .from("tactic_instances")
            .update({ status })
            .eq("org_id", context.orgId)
            .eq("week_start", params.week_start)
            .eq("status", "pending")
            .select();

        if (pendingError) throw pendingError;
        
        if (pendingItems && pendingItems.length > 0) {
            pendingMessage = ` Updated ${pendingItems.length} pending items to '${status}'.`;
        }
      }

      // 2. Recalculate Lead Score (Server-Side Validation)
      const { data: instances } = await context.supabase
        .from("tactic_instances")
        .select(
          `
          id, status, planned,
          tactics ( weight )
        `
        )
        .eq("org_id", context.orgId)
        .eq("week_start", params.week_start)
        .eq("planned", true);

      const scorableItems: ScorableItem[] = (instances || []).map(
        (inst: any) => ({
          id: inst.id,
          status: inst.status,
          weight: inst.tactics?.weight || 1.0,
          planned: inst.planned,
        })
      );

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
            updated_at: new Date().toISOString(),
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
            created_by: context.userId,
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
          week_start: params.week_start as string,
        },
        context.orgId!
      );

      // 5. Handle Next Week Generation
      let nextWeekMessage = "";
      if (params.commit_next_week) {
        const nextWeekDate = new Date(params.week_start as string);
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        const nextWeekStart = nextWeekDate.toISOString().split("T")[0];

        // Get all active tactics
        const { data: tactics } = await context.supabase
          .from("tactics")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("status", "active");

        if (tactics && tactics.length > 0) {
          let generatedCount = 0;
          for (const tactic of tactics) {
            // Check if instances already exist for this tactic next week
            const { count } = await context.supabase
              .from("tactic_instances")
              .select("id", { count: "exact", head: true })
              .eq("tactic_id", tactic.id)
              .eq("week_start", nextWeekStart);

            if (count === 0) {
              await generateInstancesForTacticId(
                context.supabase,
                tactic.id,
                nextWeekDate
              );
              generatedCount++;
            }
          }
          nextWeekMessage = ` Generated plan for next week (${nextWeekStart}).`;
        }
      }

      // Log agent action
      await logAgentAction(context.supabase, {
        userId: context.userId,
        orgId: context.orgId!,
        toolName: "submit_wpr",
        action: actionType as "create" | "update",
        entityType: "wpr",
        entityId: wpr.id,
        afterState: wpr,
        metadata: {
          confirmed: true,
          score: calculatedLeadScore,
          next_week_committed: params.commit_next_week,
        },
      });

      // Send Email Summary
      // Fetch user email first
      const { data: userProfile } = await context.supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", context.userId)
        .single();

      if (userProfile && userProfile.email) {
        await EmailService.sendWPRSummary(
          userProfile.email,
          userProfile.full_name || "User",
          params.week_start as string,
          calculatedLeadScore,
          params.lag_status as string,
          params.notes as string
        );
      }

      return {
        success: true,
        data: {
          wpr,
          message: `✅ WPR submitted. Score: ${calculatedLeadScore}%.${pendingMessage}${nextWeekMessage} Email summary sent.`,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export const wprTools = [getWPRContextTool, submitWPRTool];
