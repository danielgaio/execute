import { SupabaseClient } from "@supabase/supabase-js";
import { getWeekStart } from "@/utils/planning";
import { calculateLeadScore, type ScorableItem } from "@/lib/domain/scoring";
import { getRecentAuditActivity } from "./audit-service";
import { parseVisionMarkdown, ParsedVision } from "@/lib/domain/vision";

export interface AgentContextData {
  activeCycle?: {
    id: string;
    title: string;
    endDate: string;
    daysLeft: number;
  };
  vision?: string; // Raw markdown
  parsedVision?: ParsedVision; // Structured data
  goals?: {
    title: string;
    status: string;
    progress: number;
  }[];
  weeklyScore?: number;
  scoreBreakdown?: {
    totalWeight: number;
    completedWeight: number;
    totalItems: number;
    completedItems: number;
  };
  pendingTasksCount: number;
  overdueTasksCount: number;
  todayTasksCount: number;
  recentActivity?: string[];
  // Team context
  teams?: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
  }[];
  teamMembers?: {
    userId: string;
    fullName: string;
    email: string;
    orgRole: string;
    teams: string[]; // Team IDs
    assignedTacticsCount: number;
    completedThisWeek: number;
    pendingThisWeek: number;
  }[];
  currentUserTeams?: string[]; // Team IDs the current user belongs to
}

export class ContextBuilder {
  /**
   * Build deterministic context for the agent
   */
  async buildContext(
    supabase: SupabaseClient,
    orgId: string,
    userId?: string
  ): Promise<AgentContextData> {
    const context: AgentContextData = {
      pendingTasksCount: 0,
      overdueTasksCount: 0,
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
        context.goals = goals.map((g) => ({
          title: g.title,
          status: g.status,
          progress: 0, // Placeholder
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
      context.parsedVision = parseVisionMarkdown(vision.content_md);
    }

    // 3. Get Weekly Score & Task Stats
    const weekStart = getWeekStart();
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: instances } = await supabase
      .from("tactic_instances")
      .select(
        `
        id,
        status,
        due_date,
        planned,
        tactics (
          weight
        )
      `
      )
      .eq("org_id", orgId)
      .eq("week_start", weekStart);

    if (instances && instances.length > 0) {
      // Calculate Score using Domain Service
      const scorableItems: ScorableItem[] = instances.map((i: any) => ({
        id: i.id,
        status: i.status,
        weight: i.tactics?.weight || 1.0,
        planned: i.planned,
      }));

      context.weeklyScore = calculateLeadScore(scorableItems);

      // Calculate Breakdown
      const plannedItems = scorableItems.filter((i) => i.planned);
      const completedItems = plannedItems.filter((i) => i.status === "done");

      context.scoreBreakdown = {
        totalWeight: plannedItems.reduce((sum, i) => sum + i.weight, 0),
        completedWeight: completedItems.reduce((sum, i) => sum + i.weight, 0),
        totalItems: plannedItems.length,
        completedItems: completedItems.length,
      };

      // Calculate Counts
      let pendingCount = 0;
      let todayCount = 0;
      let overdueCount = 0;

      instances.forEach((instance: any) => {
        if (instance.status === "pending") {
          pendingCount++;
          if (instance.due_date === todayStr) {
            todayCount++;
          }
          if (instance.due_date < todayStr) {
            overdueCount++;
          }
        }
      });

      context.pendingTasksCount = pendingCount;
      context.todayTasksCount = todayCount;
      context.overdueTasksCount = overdueCount;
    } else {
      // No instances found, score is 100% (nothing planned)
      context.weeklyScore = 100;
    }

    // 4. Get Team Context
    if (userId) {
      try {
        // 4a. Get all teams in the organization
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, description")
          .eq("org_id", orgId);

        if (teams && teams.length > 0) {
          // Count members for each team
          const teamsWithMemberCount = await Promise.all(
            teams.map(async (team) => {
              const { count } = await supabase
                .from("team_members")
                .select("id", { count: "exact", head: true })
                .eq("team_id", team.id);

              return {
                id: team.id,
                name: team.name,
                description: team.description || undefined,
                memberCount: count || 0,
              };
            })
          );

          context.teams = teamsWithMemberCount;
        }

        // 4b. Get team membership for current user
        const { data: userTeamMemberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId);

        if (userTeamMemberships && userTeamMemberships.length > 0) {
          context.currentUserTeams = userTeamMemberships.map(
            (tm) => tm.team_id
          );
        }

        // 4c. Get all org members with their team assignments and workload
        const { data: orgMembers } = await supabase
          .from("org_members")
          .select(
            `
            user_id,
            role,
            profiles (
              full_name,
              email
            )
          `
          )
          .eq("org_id", orgId);

        if (orgMembers && orgMembers.length > 0) {
          const weekStart = getWeekStart();
          const weekStartStr = weekStart.toISOString().split("T")[0];

          const teamMembersData = await Promise.all(
            orgMembers.map(async (member: any) => {
              // Get team memberships
              const { data: teamMemberships } = await supabase
                .from("team_members")
                .select("team_id")
                .eq("user_id", member.user_id);

              // Get assigned tactics for this week
              const { data: assignedTactics } = await supabase
                .from("tactic_instances")
                .select("id, status, tactics!inner(assignee_user_id)")
                .eq("org_id", orgId)
                .eq("week_start", weekStartStr)
                .eq("tactics.assignee_user_id", member.user_id);

              const assignedCount = assignedTactics?.length || 0;
              const completedCount =
                assignedTactics?.filter((t: any) => t.status === "done")
                  .length || 0;
              const pendingCount =
                assignedTactics?.filter((t: any) => t.status === "pending")
                  .length || 0;

              return {
                userId: member.user_id,
                fullName: member.profiles?.full_name || "Unknown",
                email: member.profiles?.email || "",
                orgRole: member.role,
                teams: teamMemberships
                  ? teamMemberships.map((tm: any) => tm.team_id)
                  : [],
                assignedTacticsCount: assignedCount,
                completedThisWeek: completedCount,
                pendingThisWeek: pendingCount,
              };
            })
          );

          context.teamMembers = teamMembersData;
        }
      } catch (e) {
        console.error("Failed to fetch team context:", e);
        // Non-critical: continue without team context
      }
    }

    // 5. Get Recent Activity
    try {
      const activity = await getRecentAuditActivity(supabase, orgId, 5);
      context.recentActivity = activity.map((a) => {
        const action =
          a.action === "agent_tool_call"
            ? `Agent used tool: ${a.actor_context?.tool_name || "unknown"}`
            : `${a.action} ${a.entity_type}`;
        return `[${new Date(a.timestamp).toLocaleTimeString()}] ${action}`;
      });
    } catch (e) {
      console.error("Failed to fetch recent activity for context", e);
    }

    return context;
  }

  /**
   * Format context as a system prompt string
   */
  formatContext(data: AgentContextData): string {
    let prompt = "\n\n--- CURRENT EXECUTION CONTEXT ---\n";

    if (data.parsedVision) {
      const v = data.parsedVision;
      prompt += "### STRATEGIC VISION\n";
      if (v.longTerm) prompt += `Long-Term: ${v.longTerm}\n`;
      if (v.threeYear) prompt += `3-Year: ${v.threeYear}\n`;
      if (v.twelveMonth) prompt += `12-Month Goals: ${v.twelveMonth}\n`;
      if (v.coreValues) prompt += `Core Values: ${v.coreValues.join(", ")}\n`;
      prompt += "\n";
    } else if (data.vision) {
      const visionSnippet =
        data.vision.length > 500
          ? data.vision.substring(0, 500) + "..."
          : data.vision;
      prompt += `Organization Vision: "${visionSnippet}"\n`;
    } else {
      prompt += "Organization Vision: None (Ask user to create one)\n";
    }

    if (data.activeCycle) {
      prompt += `Active Cycle: "${data.activeCycle.title}" (Ends: ${data.activeCycle.endDate}, ${data.activeCycle.daysLeft} days left)\n`;

      if (data.goals && data.goals.length > 0) {
        prompt += "Active Goals:\n";
        data.goals.forEach((g) => {
          prompt += `- ${g.title} (${g.status})\n`;
        });
      } else {
        prompt += "Active Goals: None (Ask user to create goals)\n";
      }
    } else {
      prompt += "Active Cycle: None (User needs to plan a cycle)\n";
    }

    if (data.weeklyScore !== undefined) {
      prompt += `Current Weekly Score: ${data.weeklyScore}%`;
      if (data.scoreBreakdown) {
        prompt += ` (${data.scoreBreakdown.completedItems}/${data.scoreBreakdown.totalItems} tasks completed)\n`;
      } else {
        prompt += "\n";
      }
    }

    prompt += `Pending Tasks This Week: ${data.pendingTasksCount}\n`;
    prompt += `Tasks Due Today: ${data.todayTasksCount}\n`;

    if (data.overdueTasksCount > 0) {
      prompt += `⚠️ OVERDUE TASKS: ${data.overdueTasksCount}\n`;
    }

    // Team Context
    if (data.teams && data.teams.length > 0) {
      prompt += "\n### TEAM STRUCTURE\n";
      prompt += `Teams (${data.teams.length}):\n`;
      data.teams.forEach((team) => {
        prompt += `- ${team.name} (${team.memberCount} members)`;
        if (team.description) {
          prompt += `: ${team.description}`;
        }
        prompt += "\n";
      });

      if (data.currentUserTeams && data.currentUserTeams.length > 0) {
        const userTeamNames = data.teams
          .filter((t) => data.currentUserTeams?.includes(t.id))
          .map((t) => t.name);
        prompt += `Your Teams: ${userTeamNames.join(", ")}\n`;
      }
    }

    if (data.teamMembers && data.teamMembers.length > 0) {
      prompt += "\nTeam Members & Workload:\n";
      // Limit to top 10 members by assigned tasks to keep context concise
      const sortedMembers = [...data.teamMembers].sort(
        (a, b) => b.assignedTacticsCount - a.assignedTacticsCount
      );
      const displayMembers = sortedMembers.slice(0, 10);

      displayMembers.forEach((member) => {
        prompt += `- ${member.fullName} (${member.orgRole}): ${member.assignedTacticsCount} assigned`;
        if (member.assignedTacticsCount > 0) {
          prompt += ` (${member.completedThisWeek} done, ${member.pendingThisWeek} pending)`;
        }
        if (member.teams.length > 0) {
          const memberTeamNames = data.teams
            ?.filter((t) => member.teams.includes(t.id))
            .map((t) => t.name);
          if (memberTeamNames && memberTeamNames.length > 0) {
            prompt += ` | Teams: ${memberTeamNames.join(", ")}`;
          }
        }
        prompt += "\n";
      });

      if (data.teamMembers.length > 10) {
        prompt += `... and ${data.teamMembers.length - 10} more members\n`;
      }
    }

    if (data.recentActivity && data.recentActivity.length > 0) {
      prompt += "\nRecent Activity:\n";
      data.recentActivity.forEach((a) => (prompt += `- ${a}\n`));
    }

    return prompt;
  }
}

export const contextBuilder = new ContextBuilder();
