import { createClient } from "@/utils/supabase/server";
import { createEmbedding } from "../openai";
import { SupabaseClient } from "@supabase/supabase-js";

export interface EmbeddingMetadata {
  entity_type: "cycle" | "goal" | "tactic" | "vision" | "wpr" | "note";
  entity_id: string;
  title?: string;
  [key: string]: any;
}

export class EmbeddingService {
  /**
   * Store an embedding for a piece of content
   */
  async storeEmbedding(
    supabase: SupabaseClient,
    content: string,
    metadata: EmbeddingMetadata,
    orgId: string
  ) {
    try {
      const embedding = await createEmbedding(content);

      // Delete existing embedding for this entity to avoid duplicates
      await supabase
        .from("embeddings")
        .delete()
        .match({
          org_id: orgId,
        })
        .filter("metadata->>entity_id", "eq", metadata.entity_id)
        .filter("metadata->>entity_type", "eq", metadata.entity_type);

      const { error } = await supabase.from("embeddings").insert({
        org_id: orgId,
        content,
        embedding,
        metadata,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Failed to store embedding:", error);
      throw error;
    }
  }

  /**
   * Search for similar content
   */
  async searchEmbeddings(
    supabase: SupabaseClient,
    query: string,
    orgId: string,
    limit: number = 5,
    threshold: number = 0.5
  ) {
    try {
      const queryEmbedding = await createEmbedding(query);

      const { data, error } = await supabase.rpc("match_embeddings", {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_org_id: orgId,
      });

      if (error) throw error;

      return data as {
        id: string;
        content: string;
        metadata: EmbeddingMetadata;
        similarity: number;
      }[];
    } catch (error) {
      console.error("Failed to search embeddings:", error);
      throw error;
    }
  }

  /**
   * Index a Cycle entity
   */
  async indexCycle(supabase: SupabaseClient, cycle: any, orgId: string) {
    const content = `Cycle: ${cycle.title}
Status: ${cycle.status}
Dates: ${cycle.start_date} to ${cycle.end_date}
Description: A 12-week execution cycle.`;

    await this.storeEmbedding(
      supabase,
      content,
      {
        entity_type: "cycle",
        entity_id: cycle.id,
        title: cycle.title,
      },
      orgId
    );
  }

  /**
   * Index a Goal entity
   */
  async indexGoal(supabase: SupabaseClient, goal: any, orgId: string) {
    const content = `Goal: ${goal.title}
Description: ${goal.description || "No description"}
Status: ${goal.status}
Target: ${goal.target} ${goal.unit} by ${goal.target_date}
Baseline: ${goal.baseline}`;

    await this.storeEmbedding(
      supabase,
      content,
      {
        entity_type: "goal",
        entity_id: goal.id,
        title: goal.title,
        cycle_id: goal.cycle_id,
      },
      orgId
    );
  }

  /**
   * Index a Tactic entity
   */
  async indexTactic(supabase: SupabaseClient, tactic: any, orgId: string) {
    const content = `Tactic: ${tactic.title}
Description: ${tactic.description || "No description"}
Status: ${tactic.status}
Weight: ${tactic.weight}
Recurrence: ${tactic.recurrence}`;

    await this.storeEmbedding(
      supabase,
      content,
      {
        entity_type: "tactic",
        entity_id: tactic.id,
        title: tactic.title,
        goal_id: tactic.goal_id,
      },
      orgId
    );
  }

  /**
   * Index a Vision entity
   */
  async indexVision(supabase: SupabaseClient, vision: any, orgId: string) {
    const content = `Vision:
${vision.content_md}`;

    await this.storeEmbedding(
      supabase,
      content,
      {
        entity_type: "vision",
        entity_id: vision.id,
        title: "Vision",
      },
      orgId
    );
  }
}

export const embeddingService = new EmbeddingService();
