import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";

export interface AgentContextData {
  activeCycle?: {
    id: string;
    title: string;
    endDate: string;
    daysLeft: number;
  };
  vision?: string;
  goals?: {
    title: string;
    status: string;
    progress: number; // calculated from target/baseline if possible, or just placeholder
  }[];
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
      .select("id, title, end_date")
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
        id: cycle.id,
        title: cycle.title,
        endDate: cycle.end_date,
        daysLeft,
      };

      // 1b. Get Goals for Active Cycle
      const { data: goals } = await supabase
        .from("goals")
        .select("title, status, target, baseline")
        .eq("cycle_id", cycle.id);

      if (goals) {
        context.goals = goals.map(g => ({
          title: g.title,
          status: g.status,
          progress: 0 // Placeholder, could calculate if we had current value
        }));
      }
    }

    // 2. Get Vision
    const { data: vision } = await supabase
      .from("visions")
      .select("content_md")
      .eq("org_id", orgId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (vision) {
      context.vision = vision.content_md;
    }

    // 3. Get Weekly Score & Pending Tasks
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

    if (data.vision) {
      // Truncate vision if too long to save tokens, but keep enough for context
      const visionSnippet = data.vision.length > 500 ? data.vision.substring(0, 500) + "..." : data.vision;
      prompt += `Organization Vision: "${visionSnippet}"\n`;
    } else {
      prompt += "Organization Vision: None (Ask user to create one)\n";
    }

    if (data.activeCycle) {
      prompt += `Active Cycle: "${data.activeCycle.title}" (Ends: ${data.activeCycle.endDate}, ${data.activeCycle.daysLeft} days left)\n`;
      
      if (data.goals && data.goals.length > 0) {
        prompt += "Active Goals:\n";
        data.goals.forEach(g => {
          prompt += `- ${g.title} (${g.status})\n`;
        });
      } else {
        prompt += "Active Goals: None (Ask user to create goals)\n";
      }
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
