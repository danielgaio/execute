import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";

export interface AgentContextData {
  activeCycle?: {
    title: string;
    endDate: string;
    daysLeft: number;
  };
  weeklyScore?: number;
  pendingTasksCount: number;
  todayTasksCount: number;
}

export class ContextBuilder {
  /**
   * Build deterministic context for the agent
   */
  async buildContext(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<AgentContextData> {
    const context: AgentContextData = {
      pendingTasksCount: 0,
      todayTasksCount: 0,
    };

    // 1. Get Active Cycle
    const { data: cycle } = await supabase
      .from("cycles")
      .select("title, end_date")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .single();

    if (cycle) {
      const endDate = new Date(cycle.end_date);
      const today = new Date();
      const daysLeft = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      context.activeCycle = {
        title: cycle.title,
        endDate: cycle.end_date,
        daysLeft,
      };
    }

    // 2. Get Weekly Score & Pending Tasks
    const weekStart = getWeekStart();
    const { data: instances } = await supabase
      .from("tactic_instances")
      .select(
        `
        status,
        due_date,
        tactics (
          weight
        )
      `
      )
      .eq("org_id", orgId)
      .eq("week_start", weekStart)
      .eq("planned", true);

    if (instances && instances.length > 0) {
      let totalWeight = 0;
      let completedWeight = 0;
      let pendingCount = 0;
      let todayCount = 0;
      const todayStr = new Date().toISOString().split("T")[0];

      // Define type for the joined query result
      type InstanceWithTactic = {
        status: string;
        due_date: string;
        tactics: { weight: number } | null;
      };

      (instances as unknown as InstanceWithTactic[]).forEach((instance) => {
        const weight = instance.tactics?.weight || 1.0;
        totalWeight += weight;

        if (instance.status === "done") {
          completedWeight += weight;
        } else if (instance.status === "pending") {
          pendingCount++;
          if (instance.due_date === todayStr) {
            todayCount++;
          }
        }
      });

      context.weeklyScore =
        totalWeight > 0
          ? Math.round((completedWeight / totalWeight) * 100)
          : 100;
      context.pendingTasksCount = pendingCount;
      context.todayTasksCount = todayCount;
    }

    return context;
  }

  /**
   * Format context as a system prompt string
   */
  formatContext(data: AgentContextData): string {
    let prompt = "\n\n--- CURRENT EXECUTION CONTEXT ---\n";

    if (data.activeCycle) {
      prompt += `Active Cycle: "${data.activeCycle.title}" (Ends: ${data.activeCycle.endDate}, ${data.activeCycle.daysLeft} days left)\n`;
    } else {
      prompt += "Active Cycle: None (User needs to plan a cycle)\n";
    }

    if (data.weeklyScore !== undefined) {
      prompt += `Current Weekly Score: ${data.weeklyScore}%\n`;
    }

    prompt += `Pending Tasks This Week: ${data.pendingTasksCount}\n`;
    prompt += `Tasks Due Today: ${data.todayTasksCount}\n`;

    return prompt;
  }
}

export const contextBuilder = new ContextBuilder();
