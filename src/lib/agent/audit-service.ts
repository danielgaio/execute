/**
 * Audit Service - Logging and versioning utilities
 * Integrates with database audit system for agent action tracking
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditContext {
  toolName: string;
  confirmed?: boolean;
  userPrompt?: string;
  additionalMetadata?: Record<string, unknown>;
}

/**
 * Log an agent action to the audit trail
 */
export async function logAgentAction(
  supabase: SupabaseClient,
  params: {
    userId: string;
    orgId: string;
    teamId?: string;
    toolName: string;
    action: "create" | "update" | "delete" | "agent_tool_call";
    entityType: string;
    entityId: string;
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("log_agent_action", {
      p_actor_user_id: params.userId,
      p_tool_name: params.toolName,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_org_id: params.orgId,
      p_team_id: params.teamId || null,
      p_before_state: params.beforeState || null,
      p_after_state: params.afterState || null,
      p_metadata: params.metadata || {},
    });

    if (error) {
      console.error("Failed to log agent action:", error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error("Error logging agent action:", error);
    return null;
  }
}

/**
 * Get entity change history
 */
export async function getEntityHistory(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    timestamp: string;
    action: string;
    actor_name: string | null;
    diff: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>
> {
  try {
    const { data, error } = await supabase.rpc("get_entity_history", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_limit: limit,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Failed to get entity history:", error);
    return [];
  }
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(
  supabase: SupabaseClient,
  userId: string,
  days: number = 7
): Promise<{
  total_actions: number;
  actions_by_type: Record<string, number>;
  entities_modified: number;
  agent_actions: number;
}> {
  try {
    const { data, error } = await supabase.rpc("get_user_activity_summary", {
      p_user_id: userId,
      p_days: days,
    });

    if (error) throw error;

    return (
      data || {
        total_actions: 0,
        actions_by_type: {},
        entities_modified: 0,
        agent_actions: 0,
      }
    );
  } catch (error) {
    console.error("Failed to get user activity summary:", error);
    return {
      total_actions: 0,
      actions_by_type: {},
      entities_modified: 0,
      agent_actions: 0,
    };
  }
}

/**
 * Get version history for an entity
 */
export async function getVersionHistory(
  supabase: SupabaseClient,
  entityType: "vision" | "goal" | "tactic",
  entityId: string
): Promise<
  Array<{
    id: string;
    version: number;
    changed_by: string | null;
    created_at: string;
    diff: Record<string, unknown> | null;
  }>
> {
  try {
    const tableName = `${entityType}_versions`;

    const { data, error } = await supabase
      .from(tableName)
      .select("id, version, changed_by, created_at, diff")
      .eq(`${entityType}_id`, entityId)
      .order("version", { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Failed to get version history:", error);
    return [];
  }
}

/**
 * Query recent audit activity for an organization
 */
export async function getRecentAuditActivity(
  supabase: SupabaseClient,
  orgId: string,
  limit: number = 100
): Promise<
  Array<{
    id: string;
    timestamp: string;
    action: string;
    entity_type: string;
    entity_id: string;
    actor_type: string;
    actor_name: string | null;
    actor_email: string | null;
    actor_context: Record<string, unknown> | null;
    diff: Record<string, unknown> | null;
  }>
> {
  try {
    const { data, error } = await supabase
      .from("recent_audit_activity")
      .select("*")
      .eq("org_id", orgId)
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Failed to get recent audit activity:", error);
    return [];
  }
}

/**
 * Helper to capture state before mutation
 */
export async function captureEntityState<T extends { id: string }>(
  supabase: SupabaseClient,
  tableName: string,
  entityId: string
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", entityId)
      .single();

    if (error) return null;

    return data as T;
  } catch (error) {
    console.error("Failed to capture entity state:", error);
    return null;
  }
}
