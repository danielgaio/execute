/**
 * Agent Tools - Analysis Tools
 * Tools for analyzing execution patterns, comparing cycles, and providing insights
 */

import { z } from "zod";
import type { AgentTool, ToolContext, ToolResult } from "../types";
import { getWeekStart } from "@/utils/planning";

// Type definitions for Supabase query results
interface TacticInstance {
  id: string;
  status: string;
  due_date: string;
  week_start: string;
  tactic_id: string;
  tactics: {
    id: string;
    title: string;
    weight: number;
    goal_id: string;
    goals?: {
      id: string;
      title: string;
    };
  } | null;
}

interface CompareCycleInstance {
  id: string;
  status: string;
  week_start: string;
  tactic_id: string;
  tactics: {
    id: string;
    weight: number;
    goal_id: string;
  } | null;
}

interface Goal {
  id: string;
  title: string;
  status: string;
  target: number;
  baseline: number;
  unit: string;
  cycle_id: string;
}

interface Cycle {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

// Additional types for other queries
interface TacticWithGoal {
  id: string;
  title: string;
  weight: number;
  status: string;
  goal_id: string;
  goals: {
    id: string;
    title: string;
    status: string;
  } | null;
}

interface FindBlockersInstance {
  id: string;
  status: string;
  due_date: string;
  week_start: string;
  tactic_id: string;
}

interface SimpleTactic {
  id: string;
  goal_id: string;
}

/**
 * Explain why the current score is what it is
 */
export const explainStatusTool: AgentTool = {
  name: "explain_status",
  description:
    "Explain why the user's current weekly lead score is what it is. Identifies completed vs. pending vs. missed tactics and provides actionable insights.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z
      .string()
      .optional()
      .describe("Week start date (YYYY-MM-DD). If not provided, uses current week."),
  }),
  handler: async (
    params: { week_start?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let weekStart = params.week_start;

      // Calculate current week's Monday if not provided
      if (!weekStart) {
        weekStart = getWeekStart().toISOString().split("T")[0];
      }

      // Fetch all instances for this week with tactic and goal details
      const { data: instances, error } = await context.supabase
        .from("tactic_instances")
        .select(`
          id,
          status,
          due_date,
          week_start,
          tactic_id,
          tactics (
            id,
            title,
            weight,
            goal_id,
            goals (
              id,
              title
            )
          )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      if (error) throw error;

      // Safe type handling with default empty array
      const typedInstances: TacticInstance[] = (instances || []) as unknown as TacticInstance[];

      // Categorize instances
      const completed: { title: string; weight: number; goal: string }[] = [];
      const pending: { title: string; weight: number; goal: string; dueDate: string }[] = [];
      const skipped: { title: string; weight: number; goal: string }[] = [];
      const deferred: { title: string; weight: number; goal: string }[] = [];

      let totalWeight = 0;
      let completedWeight = 0;

      const today = new Date().toISOString().split("T")[0];

      typedInstances?.forEach((instance) => {
        const weight = instance.tactics?.weight || 1.0;
        const title = instance.tactics?.title || "Unknown Tactic";
        const goal = instance.tactics?.goals?.title || "Unknown Goal";

        totalWeight += weight;

        if (instance.status === "done") {
          completedWeight += weight;
          completed.push({ title, weight, goal });
        } else if (instance.status === "skipped") {
          skipped.push({ title, weight, goal });
        } else if (instance.status === "deferred") {
          deferred.push({ title, weight, goal });
        } else {
          // Pending
          pending.push({ 
            title, 
            weight, 
            goal, 
            dueDate: instance.due_date
          });
        }
      });

      const score = totalWeight > 0
        ? Math.round((completedWeight / totalWeight) * 100)
        : 100;

      // Group pending by urgency
      const overdue = pending.filter(p => p.dueDate < today);
      const dueToday = pending.filter(p => p.dueDate === today);
      const upcoming = pending.filter(p => p.dueDate > today);

      // Build insights
      const insights: string[] = [];

      if (score >= 85) {
        insights.push("Excellent execution! You're on track with your planned tactics.");
      } else if (score >= 60) {
        insights.push("Good progress, but there's room for improvement.");
      } else {
        insights.push("Your score is below the healthy threshold of 60%. Let's identify what's blocking you.");
      }

      if (overdue.length > 0) {
        insights.push(`You have ${overdue.length} overdue tactic(s) impacting your score.`);
      }

      if (deferred.length > 0) {
        insights.push(`${deferred.length} tactic(s) were deferred - they still count against this week's score.`);
      }

      if (skipped.length > 0) {
        insights.push(`${skipped.length} tactic(s) were skipped - consider if these should be removed from your plan.`);
      }

      // Identify high-impact pending items
      const highImpactPending = pending.filter(p => p.weight >= 0.7);
      if (highImpactPending.length > 0) {
        insights.push(`High-impact items still pending: ${highImpactPending.map(p => p.title).join(", ")}`);
      }

      return {
        success: true,
        data: {
          score,
          week_start: weekStart,
          total_planned: typedInstances?.length || 0,
          breakdown: {
            completed: {
              count: completed.length,
              weight: completedWeight,
              items: completed,
            },
            pending: {
              count: pending.length,
              overdue: overdue.length,
              due_today: dueToday.length,
              upcoming: upcoming.length,
              items: pending,
            },
            skipped: {
              count: skipped.length,
              items: skipped,
            },
            deferred: {
              count: deferred.length,
              items: deferred,
            },
          },
          insights,
          recommendations: buildRecommendations(overdue, dueToday, deferred, score),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to explain status",
      };
    }
  },
};

function buildRecommendations(
  overdue: { title: string }[],
  dueToday: { title: string }[],
  deferred: { title: string }[],
  score: number
): string[] {
  const recommendations: string[] = [];

  if (overdue.length > 0) {
    recommendations.push(
      `Complete overdue items first: ${overdue.slice(0, 3).map(o => `"${o.title}"`).join(", ")}`
    );
  }

  if (dueToday.length > 0) {
    recommendations.push(
      `Focus on today's due items: ${dueToday.slice(0, 3).map(d => `"${d.title}"`).join(", ")}`
    );
  }

  if (deferred.length > 2) {
    recommendations.push(
      "Consider reviewing your tactic load - multiple deferrals may indicate overcommitment."
    );
  }

  if (score < 60 && overdue.length === 0 && dueToday.length === 0) {
    recommendations.push(
      "Your score is low but you have no immediate deadlines. Use this time to catch up on remaining items."
    );
  }

  return recommendations;
}

/**
 * Compare metrics across different cycles
 */
export const compareCyclesTool: AgentTool = {
  name: "compare_cycles",
  description:
    "Compare execution metrics across multiple 12-week cycles. Shows trends in lead scores, goal completion, and execution patterns.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    cycle_ids: z
      .array(z.string())
      .optional()
      .describe("Array of cycle IDs to compare. If not provided, compares the last 2 cycles."),
    metric: z
      .enum(["lead_score", "completion_rate", "goal_progress", "all"])
      .optional()
      .describe("Which metric to compare (default: all)"),
  }),
  handler: async (
    params: { cycle_ids?: string[]; metric?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let cycleIds = params.cycle_ids;

      // If no cycles provided, get the last 2 cycles
      if (!cycleIds || cycleIds.length === 0) {
        const { data: cycles, error } = await context.supabase
          .from("cycles")
          .select("id")
          .eq("org_id", context.orgId)
          .order("start_date", { ascending: false })
          .limit(2);

        if (error) throw error;
        if (!cycles || cycles.length === 0) {
          return {
            success: false,
            error: "No cycles found to compare.",
          };
        }

        cycleIds = cycles.map((c) => c.id);
      }

      // Fetch cycle details
      const { data: cyclesData, error: cyclesError } = await context.supabase
        .from("cycles")
        .select("*")
        .in("id", cycleIds)
        .order("start_date", { ascending: false });

      if (cyclesError) throw cyclesError;

      // Safe type handling with default empty array
      const typedCycles: Cycle[] = (cyclesData || []) as Cycle[];

      if (typedCycles.length === 0) {
        return {
          success: false,
          error: "No cycle data found.",
        };
      }

      // Fetch goals for each cycle
      const { data: goalsData, error: goalsError } = await context.supabase
        .from("goals")
        .select("*")
        .in("cycle_id", cycleIds);

      if (goalsError) throw goalsError;

      // Safe type handling
      const typedGoals: Goal[] = (goalsData || []) as Goal[];

      // Fetch tactic instances for each cycle's goals
      const goalIds = typedGoals.map((g) => g.id);
      
      // Handle case when no goals exist
      if (goalIds.length === 0) {
        return {
          success: true,
          data: {
            cycles_compared: typedCycles.length,
            comparison: typedCycles.map((cycle) => ({
              cycle_id: cycle.id,
              cycle_title: cycle.title,
              cycle_status: cycle.status,
              dates: `${cycle.start_date} to ${cycle.end_date}`,
              metrics: {
                avg_lead_score: 0,
                completion_rate: 0,
                total_instances: 0,
                completed_instances: 0,
                goal_count: 0,
                goals_by_status: {},
              },
            })),
            insights: ["No goals found in these cycles yet."],
          },
        };
      }
      
      const { data: tacticsData, error: tacticsError } = await context.supabase
        .from("tactics")
        .select("id, goal_id")
        .in("goal_id", goalIds);

      if (tacticsError) throw tacticsError;

      const typedTactics: SimpleTactic[] = (tacticsData || []) as SimpleTactic[];
      const tacticIds = typedTactics.map((t) => t.id);

      // Handle case when no tactics exist
      if (tacticIds.length === 0) {
        return {
          success: true,
          data: {
            cycles_compared: typedCycles.length,
            comparison: typedCycles.map((cycle) => {
              const cycleGoals = typedGoals.filter((g) => g.cycle_id === cycle.id);
              const goalsByStatus = cycleGoals.reduce((acc, g) => {
                acc[g.status] = (acc[g.status] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return {
                cycle_id: cycle.id,
                cycle_title: cycle.title,
                cycle_status: cycle.status,
                dates: `${cycle.start_date} to ${cycle.end_date}`,
                metrics: {
                  avg_lead_score: 0,
                  completion_rate: 0,
                  total_instances: 0,
                  completed_instances: 0,
                  goal_count: cycleGoals.length,
                  goals_by_status: goalsByStatus,
                },
              };
            }),
            insights: ["No tactics found in these cycles yet."],
          },
        };
      }

      const { data: instancesData, error: instancesError } = await context.supabase
        .from("tactic_instances")
        .select(`
          id,
          status,
          week_start,
          tactic_id,
          tactics (
            id,
            weight,
            goal_id
          )
        `)
        .in("tactic_id", tacticIds)
        .eq("planned", true);

      if (instancesError) throw instancesError;

      // Safe type handling
      const typedInstancesData: CompareCycleInstance[] = (instancesData || []) as unknown as CompareCycleInstance[];

      // Calculate metrics per cycle
      const cycleMetrics = typedCycles.map((cycle) => {
        const cycleGoals = typedGoals.filter((g) => g.cycle_id === cycle.id);
        const cycleGoalIds = cycleGoals.map((g) => g.id);
        
        // Get tactic IDs for this cycle
        const cycleTacticIds = typedTactics
          .filter((t) => cycleGoalIds.includes(t.goal_id))
          .map((t) => t.id);

        // Filter instances for this cycle
        const cycleInstances = typedInstancesData.filter(
          (i) => i.tactics && cycleTacticIds.includes(i.tactics.id)
        );

        // Calculate overall lead score
        let totalWeight = 0;
        let completedWeight = 0;

        cycleInstances.forEach((instance) => {
          const weight = instance.tactics?.weight || 1.0;
          totalWeight += weight;
          if (instance.status === "done") {
            completedWeight += weight;
          }
        });

        const avgLeadScore = totalWeight > 0
          ? Math.round((completedWeight / totalWeight) * 100)
          : 0;

        // Calculate completion rate (instances)
        const totalInstances = cycleInstances.length;
        const completedInstances = cycleInstances.filter(
          (i) => i.status === "done"
        ).length;
        const completionRate = totalInstances > 0
          ? Math.round((completedInstances / totalInstances) * 100)
          : 0;

        // Calculate goal status distribution
        const goalsByStatus = cycleGoals.reduce((acc, g) => {
          acc[g.status] = (acc[g.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          cycle_id: cycle.id,
          cycle_title: cycle.title,
          cycle_status: cycle.status,
          dates: `${cycle.start_date} to ${cycle.end_date}`,
          metrics: {
            avg_lead_score: avgLeadScore,
            completion_rate: completionRate,
            total_instances: totalInstances,
            completed_instances: completedInstances,
            goal_count: cycleGoals.length,
            goals_by_status: goalsByStatus,
          },
        };
      });

      // Build comparison insights
      const insights: string[] = [];

      if (cycleMetrics.length >= 2) {
        const [newer, older] = cycleMetrics;
        const scoreDiff = newer.metrics.avg_lead_score - older.metrics.avg_lead_score;

        if (scoreDiff > 10) {
          insights.push(
            `Lead score improved by ${scoreDiff}% compared to the previous cycle.`
          );
        } else if (scoreDiff < -10) {
          insights.push(
            `Lead score decreased by ${Math.abs(scoreDiff)}% compared to the previous cycle.`
          );
        } else {
          insights.push("Lead score remained relatively stable across cycles.");
        }

        const completionDiff = newer.metrics.completion_rate - older.metrics.completion_rate;
        if (completionDiff > 10) {
          insights.push(`Task completion improved by ${completionDiff}%.`);
        } else if (completionDiff < -10) {
          insights.push(`Task completion decreased by ${Math.abs(completionDiff)}%.`);
        }
      }

      return {
        success: true,
        data: {
          cycles_compared: cycleMetrics.length,
          comparison: cycleMetrics,
          insights,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compare cycles",
      };
    }
  },
};

/**
 * Find blockers - identify what's preventing progress
 */
export const findBlockersTool: AgentTool = {
  name: "find_blockers",
  description:
    "Identify blockers preventing goal achievement. Analyzes overdue tasks, skipped items, low-weight tactics, and patterns of missed deadlines.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    goal_id: z
      .string()
      .optional()
      .describe("Specific goal ID to analyze. If not provided, analyzes all goals in active cycle."),
  }),
  handler: async (
    params: { goal_id?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const weekStart = getWeekStart().toISOString().split("T")[0];

      // Get active cycle if no goal specified
      let goalIds: string[] = [];
      
      if (params.goal_id) {
        goalIds = [params.goal_id];
      } else {
        const { data: activeCycle } = await context.supabase
          .from("cycles")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("status", "active")
          .single();

        if (!activeCycle) {
          return {
            success: false,
            error: "No active cycle found.",
          };
        }

        const { data: goals } = await context.supabase
          .from("goals")
          .select("id")
          .eq("cycle_id", activeCycle.id);

        goalIds = goals?.map((g) => g.id) || [];
      }

      if (goalIds.length === 0) {
        return {
          success: false,
          error: "No goals found to analyze.",
        };
      }

      // Fetch tactics and instances
      const { data: tactics, error: tacticsError } = await context.supabase
        .from("tactics")
        .select(`
          id,
          title,
          weight,
          status,
          goal_id,
          goals (
            id,
            title,
            status
          )
        `)
        .in("goal_id", goalIds)
        .eq("status", "active");

      if (tacticsError) throw tacticsError;
      
      // Safe type handling
      const typedTactics: TacticWithGoal[] = (tactics || []) as unknown as TacticWithGoal[];
      const tacticIds = typedTactics.map((t) => t.id);

      // Handle case when no tactics exist
      if (tacticIds.length === 0) {
        return {
          success: true,
          data: {
            summary: {
              total_blockers: 0,
              high_severity: 0,
              medium_severity: 0,
              low_severity: 0,
            },
            blockers: [],
            overall_health: "healthy",
            note: "No tactics found to analyze.",
          },
        };
      }

      const { data: instances, error: instancesError } = await context.supabase
        .from("tactic_instances")
        .select(`
          id,
          status,
          due_date,
          week_start,
          tactic_id
        `)
        .in("tactic_id", tacticIds)
        .eq("planned", true);

      if (instancesError) throw instancesError;

      // Safe type handling
      const typedInstances: FindBlockersInstance[] = (instances || []) as FindBlockersInstance[];

      // Analyze blockers
      const blockers: {
        type: string;
        severity: "high" | "medium" | "low";
        description: string;
        items: string[];
        recommendation: string;
      }[] = [];

      // 1. Overdue items (high severity)
      const overdueInstances = typedInstances.filter(
        (i) => i.status === "pending" && i.due_date < today
      );

      if (overdueInstances.length > 0) {
        const overdueItems = overdueInstances.map((i) => {
          const tactic = typedTactics.find((t) => t.id === i.tactic_id);
          return tactic?.title || "Unknown";
        });

        blockers.push({
          type: "Overdue Tasks",
          severity: "high",
          description: `${overdueInstances.length} task(s) are past their due date.`,
          items: [...new Set(overdueItems)], // Unique items
          recommendation: "Prioritize completing or rescheduling these items immediately.",
        });
      }

      // 2. Frequently skipped/deferred (medium severity)
      const tacticSkipCount: Record<string, number> = {};
      const tacticDeferCount: Record<string, number> = {};

      typedInstances.forEach((i) => {
        if (i.status === "skipped") {
          tacticSkipCount[i.tactic_id] = (tacticSkipCount[i.tactic_id] || 0) + 1;
        }
        if (i.status === "deferred") {
          tacticDeferCount[i.tactic_id] = (tacticDeferCount[i.tactic_id] || 0) + 1;
        }
      });

      const frequentlySkipped = Object.entries(tacticSkipCount)
        .filter(([, count]) => count >= 2)
        .map(([tacticId]) => {
          const tactic = typedTactics.find((t) => t.id === tacticId);
          return tactic?.title || "Unknown";
        });

      if (frequentlySkipped.length > 0) {
        blockers.push({
          type: "Frequently Skipped",
          severity: "medium",
          description: `${frequentlySkipped.length} tactic(s) have been skipped multiple times.`,
          items: frequentlySkipped,
          recommendation: "Consider removing these from your plan or reassessing their value.",
        });
      }

      const frequentlyDeferred = Object.entries(tacticDeferCount)
        .filter(([, count]) => count >= 2)
        .map(([tacticId]) => {
          const tactic = typedTactics.find((t) => t.id === tacticId);
          return tactic?.title || "Unknown";
        });

      if (frequentlyDeferred.length > 0) {
        blockers.push({
          type: "Frequently Deferred",
          severity: "medium",
          description: `${frequentlyDeferred.length} tactic(s) keep getting deferred.`,
          items: frequentlyDeferred,
          recommendation: "Review capacity - these may need to be rescheduled or delegated.",
        });
      }

      // 3. At-risk goals
      const atRiskGoals = typedTactics
        .filter((t) => {
          const goalStatus = t.goals?.status;
          return goalStatus === "at_risk" || goalStatus === "off_track";
        })
        .map((t) => t.goals?.title || "Unknown");

      const uniqueAtRiskGoals = [...new Set(atRiskGoals)];

      if (uniqueAtRiskGoals.length > 0) {
        blockers.push({
          type: "At-Risk Goals",
          severity: "high",
          description: `${uniqueAtRiskGoals.length} goal(s) are at risk or off track.`,
          items: uniqueAtRiskGoals,
          recommendation: "Review goal progress and adjust tactics or targets as needed.",
        });
      }

      // 4. Low engagement (no completions in recent weeks)
      const recentWeeks = 2;
      const recentInstances = typedInstances.filter((i) => {
        const instanceWeek = new Date(i.week_start);
        const currentWeek = new Date(weekStart);
        const diffTime = currentWeek.getTime() - instanceWeek.getTime();
        const diffWeeks = Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000));
        return diffWeeks <= recentWeeks;
      });

      const completedRecent = recentInstances.filter((i) => i.status === "done").length;
      const totalRecent = recentInstances.length;

      if (totalRecent > 0 && completedRecent / totalRecent < 0.3) {
        blockers.push({
          type: "Low Engagement",
          severity: "medium",
          description: `Only ${Math.round((completedRecent / totalRecent) * 100)}% completion rate in the last ${recentWeeks} weeks.`,
          items: [],
          recommendation: "Consider reducing planned items or addressing time management issues.",
        });
      }

      // Build summary
      const summary = {
        total_blockers: blockers.length,
        high_severity: blockers.filter((b) => b.severity === "high").length,
        medium_severity: blockers.filter((b) => b.severity === "medium").length,
        low_severity: blockers.filter((b) => b.severity === "low").length,
      };

      return {
        success: true,
        data: {
          summary,
          blockers,
          overall_health: blockers.length === 0
            ? "healthy"
            : summary.high_severity > 0
            ? "critical"
            : "needs_attention",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to find blockers",
      };
    }
  },
};

/**
 * Analyze lead-lag correlation
 */
export const analyzeLagLeadCorrelationTool: AgentTool = {
  name: "analyze_lag_lead_correlation",
  description:
    "Analyze the correlation between lead indicators (tactic completion) and lag indicators (goal outcomes). Helps identify which tactics are most effective.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    goal_id: z
      .string()
      .optional()
      .describe("Specific goal ID to analyze. If not provided, analyzes all goals."),
    cycle_id: z
      .string()
      .optional()
      .describe("Cycle ID to analyze. If not provided, uses active cycle."),
  }),
  handler: async (
    params: { goal_id?: string; cycle_id?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      let cycleId = params.cycle_id;

      // Get cycle
      if (!cycleId) {
        const { data: activeCycle } = await context.supabase
          .from("cycles")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("status", "active")
          .single();

        if (!activeCycle) {
          return {
            success: false,
            error: "No active cycle found.",
          };
        }

        cycleId = activeCycle.id;
      }

      // Get goals
      let goalsQuery = context.supabase
        .from("goals")
        .select("*")
        .eq("cycle_id", cycleId);

      if (params.goal_id) {
        goalsQuery = goalsQuery.eq("id", params.goal_id);
      }

      const { data: goals, error: goalsError } = await goalsQuery;
      if (goalsError) throw goalsError;

      const typedGoals = goals as unknown as Goal[];

      if (!typedGoals || typedGoals.length === 0) {
        return {
          success: false,
          error: "No goals found for analysis.",
        };
      }

      // Get tactics for each goal
      const goalIds = typedGoals.map((g) => g.id);
      
      const { data: tactics } = await context.supabase
        .from("tactics")
        .select(`
          id,
          title,
          weight,
          goal_id,
          status
        `)
        .in("goal_id", goalIds);

      const tacticIds = tactics?.map((t) => t.id) || [];

      // Get instances
      const { data: instances } = await context.supabase
        .from("tactic_instances")
        .select(`
          id,
          status,
          tactic_id,
          week_start
        `)
        .in("tactic_id", tacticIds)
        .eq("planned", true);

      // Analyze per goal
      const goalAnalysis = typedGoals.map((goal) => {
        const goalTactics = tactics?.filter((t) => t.goal_id === goal.id) || [];
        const goalTacticIds = goalTactics.map((t) => t.id);
        const goalInstances = instances?.filter((i) => goalTacticIds.includes(i.tactic_id)) || [];

        // Calculate lead score for this goal
        let totalWeight = 0;
        let completedWeight = 0;

        goalInstances.forEach((instance) => {
          const tactic = goalTactics.find((t) => t.id === instance.tactic_id);
          const weight = tactic?.weight || 1.0;
          totalWeight += weight;
          if (instance.status === "done") {
            completedWeight += weight;
          }
        });

        const leadScore = totalWeight > 0
          ? Math.round((completedWeight / totalWeight) * 100)
          : 0;

        // Calculate progress toward target (if applicable)
        const progress = goal.target > 0
          ? Math.round(((goal.baseline || 0) / goal.target) * 100)
          : 0;

        // Identify highest-performing tactics
        const tacticPerformance = goalTactics.map((tactic) => {
          const tacticInstances = goalInstances.filter((i) => i.tactic_id === tactic.id);
          const completed = tacticInstances.filter((i) => i.status === "done").length;
          const total = tacticInstances.length;
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

          return {
            tactic_id: tactic.id,
            title: tactic.title,
            weight: tactic.weight,
            completion_rate: completionRate,
            completed_count: completed,
            total_count: total,
            impact_score: completionRate * (tactic.weight || 1), // Weighted impact
          };
        }).sort((a, b) => b.impact_score - a.impact_score);

        return {
          goal_id: goal.id,
          goal_title: goal.title,
          goal_status: goal.status,
          target: goal.target,
          baseline: goal.baseline,
          unit: goal.unit,
          lead_score: leadScore,
          progress_to_target: progress,
          tactics_count: goalTactics.length,
          top_performing_tactics: tacticPerformance.slice(0, 3),
          underperforming_tactics: tacticPerformance.filter((t) => t.completion_rate < 50).slice(0, 3),
        };
      });

      // Build insights
      const insights: string[] = [];

      // Find goals with high lead scores but low progress
      const misaligned = goalAnalysis.filter(
        (g) => g.lead_score >= 70 && g.goal_status !== "on_track"
      );
      if (misaligned.length > 0) {
        insights.push(
          `${misaligned.length} goal(s) have good execution but aren't showing expected progress. Consider reviewing if tactics are the right actions.`
        );
      }

      // Find goals with consistent underperformance
      const underperforming = goalAnalysis.filter(
        (g) => g.lead_score < 50 && g.goal_status !== "completed"
      );
      if (underperforming.length > 0) {
        insights.push(
          `${underperforming.length} goal(s) have low execution rates. Focus on completing planned tactics or adjusting the plan.`
        );
      }

      // Highlight well-aligned goals
      const wellAligned = goalAnalysis.filter(
        (g) => g.lead_score >= 70 && g.goal_status === "on_track"
      );
      if (wellAligned.length > 0) {
        insights.push(
          `${wellAligned.length} goal(s) show strong alignment between execution and outcomes.`
        );
      }

      return {
        success: true,
        data: {
          cycle_id: cycleId,
          goals_analyzed: goalAnalysis.length,
          analysis: goalAnalysis,
          insights,
          recommendations: [
            misaligned.length > 0 && "Review tactics for misaligned goals - high execution but low outcome may indicate wrong activities.",
            underperforming.length > 0 && "Address execution gaps in underperforming goals - these need immediate attention.",
            "Consider increasing weight on tactics that correlate with goal progress.",
          ].filter(Boolean),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze correlation",
      };
    }
  },
};

/**
 * Predict end-of-week score based on current progress and historical velocity
 */
export const predictScoreTool: AgentTool = {
  name: "predict_score",
  description:
    "Predict the final score for the current week based on completed tasks, remaining tasks, and historical completion rates.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z
      .string()
      .optional()
      .describe("Week start date (YYYY-MM-DD). Defaults to current week."),
  }),
  handler: async (
    params: { week_start?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const weekStart = params.week_start || getWeekStart().toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      // 1. Get current week's instances
      const { data: currentInstances, error: currentError } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, due_date,
          tactics ( weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      if (currentError) throw currentError;

      const instances = (currentInstances || []) as any[];
      
      if (instances.length === 0) {
        return {
          success: true,
          data: {
            message: "No planned tactics found for this week.",
            predicted_score: 100, // Default if nothing planned
            confidence: "low"
          }
        };
      }

      // 2. Calculate current state
      let totalWeight = 0;
      let completedWeight = 0;
      let pendingWeight = 0;
      let overdueWeight = 0;

      instances.forEach(i => {
        const weight = i.tactics?.weight || 1.0;
        totalWeight += weight;
        
        if (i.status === 'done') {
          completedWeight += weight;
        } else if (i.status === 'pending') {
          pendingWeight += weight;
          if (i.due_date < today) {
            overdueWeight += weight;
          }
        }
      });

      const currentScore = totalWeight > 0 
        ? Math.round((completedWeight / totalWeight) * 100) 
        : 0;

      // 3. Get historical completion rate (last 4 weeks)
      // We'll use a simplified query for speed
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

      const { data: history } = await context.supabase
        .from("tactic_instances")
        .select("status")
        .eq("org_id", context.orgId)
        .gte("week_start", fourWeeksAgoStr)
        .lt("week_start", weekStart)
        .eq("planned", true);

      let historicalRate = 0.8; // Default optimism
      if (history && history.length > 0) {
        const completed = history.filter((h: any) => h.status === 'done').length;
        historicalRate = completed / history.length;
      }

      // 4. Predict
      // Prediction = Current Score + (Pending Weight * Historical Rate) / Total Weight
      // We discount overdue items heavily (50% of historical rate)
      const predictedAdditionalWeight = 
        ((pendingWeight - overdueWeight) * historicalRate) + 
        (overdueWeight * (historicalRate * 0.5));
      
      const predictedTotalCompleted = completedWeight + predictedAdditionalWeight;
      const predictedScore = totalWeight > 0
        ? Math.round((predictedTotalCompleted / totalWeight) * 100)
        : 0;

      // 5. Confidence Level
      // Higher confidence if more of the week is already done
      const daysPassed = (new Date().getTime() - new Date(weekStart).getTime()) / (1000 * 60 * 60 * 24);
      let confidence = "medium";
      if (daysPassed > 5) confidence = "high";
      if (daysPassed < 2) confidence = "low";

      return {
        success: true,
        data: {
          current_score: currentScore,
          predicted_score: predictedScore,
          historical_completion_rate: Math.round(historicalRate * 100),
          confidence,
          breakdown: {
            total_weight: totalWeight,
            completed_weight: completedWeight,
            pending_weight: pendingWeight,
            overdue_weight: overdueWeight
          },
          message: `Based on your historical completion rate of ${Math.round(historicalRate * 100)}%, I predict you'll finish the week with a score of ${predictedScore}%.`
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to predict score"
      };
    }
  }
};

/**
 * Suggest adjustments to the current plan to improve outcomes
 */
export const suggestAdjustmentsTool: AgentTool = {
  name: "suggest_adjustments",
  description:
    "Analyze the current week's plan and suggest specific adjustments (deferrals, reprioritization) to maximize the score.",
  category: "analysis",
  requiresConfirmation: false,
  parameters: z.object({
    week_start: z
      .string()
      .optional()
      .describe("Week start date (YYYY-MM-DD). Defaults to current week."),
  }),
  handler: async (
    params: { week_start?: string },
    context: ToolContext
  ): Promise<ToolResult> => {
    try {
      const weekStart = params.week_start || getWeekStart().toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      // 1. Get current week's instances
      const { data: currentInstances, error } = await context.supabase
        .from("tactic_instances")
        .select(`
          id, status, due_date, title,
          tactics ( id, title, weight )
        `)
        .eq("org_id", context.orgId)
        .eq("week_start", weekStart)
        .eq("planned", true);

      if (error) throw error;

      const instances = (currentInstances || []) as any[];
      const pendingInstances = instances.filter(i => i.status === 'pending');

      if (pendingInstances.length === 0) {
        return {
          success: true,
          data: {
            message: "No pending tasks to adjust. You're all set!",
            suggestions: []
          }
        };
      }

      const suggestions: string[] = [];
      const highImpactTasks: any[] = [];
      const lowImpactTasks: any[] = [];
      const overdueTasks: any[] = [];

      // 2. Categorize tasks
      pendingInstances.forEach(i => {
        const weight = i.tactics?.weight || 1.0;
        const title = i.tactics?.title || "Unknown Task";
        
        if (i.due_date < today) {
          overdueTasks.push({ title, id: i.id, weight });
        }

        if (weight >= 0.8) {
          highImpactTasks.push({ title, id: i.id, weight });
        } else if (weight <= 0.3) {
          lowImpactTasks.push({ title, id: i.id, weight });
        }
      });

      // 3. Generate Suggestions

      // A. Overdue Management
      if (overdueTasks.length > 0) {
        const titles = overdueTasks.map(t => `"${t.title}"`).join(", ");
        suggestions.push(
          `You have ${overdueTasks.length} overdue tasks (${titles}). Consider rescheduling them to a specific day later this week or deferring them if they are no longer critical.`
        );
      }

      // B. High Impact Focus
      if (highImpactTasks.length > 0) {
        const topTask = highImpactTasks.sort((a, b) => b.weight - a.weight)[0];
        suggestions.push(
          `Prioritize "${topTask.title}" (Weight: ${topTask.weight}). Completing this single item will significantly boost your score.`
        );
      }

      // C. Load Shedding (Low Impact)
      if (lowImpactTasks.length > 0 && pendingInstances.length > 5) {
        const lowTask = lowImpactTasks[0];
        suggestions.push(
          `If you're feeling overwhelmed, consider deferring "${lowTask.title}" (Weight: ${lowTask.weight}) to next week. It has a lower impact on your weekly score.`
        );
      }

      // D. General Volume
      if (pendingInstances.length > 10) {
        suggestions.push(
          `You have ${pendingInstances.length} items remaining. This is a high volume. Review your plan and ensure it's realistic.`
        );
      }

      if (suggestions.length === 0) {
        suggestions.push("Your plan looks balanced. Keep executing!");
      }

      return {
        success: true,
        data: {
          message: "Here are some suggestions to optimize your week:",
          suggestions,
          analysis: {
            pending_count: pendingInstances.length,
            overdue_count: overdueTasks.length,
            high_impact_count: highImpactTasks.length
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate suggestions"
      };
    }
  }
};

// Export all analysis tools
export const analysisTools = [
  explainStatusTool,
  compareCyclesTool,
  findBlockersTool,
  analyzeLagLeadCorrelationTool,
  predictScoreTool,
  suggestAdjustmentsTool,
];
