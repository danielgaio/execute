/**
 * Agent Tool Types and Base Interfaces
 * Defines the structure for agent tools with RLS-aware execution
 */

import { z } from "zod";
import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Base context provided to all tools - includes user info and Supabase client
 */
export interface ToolContext {
  userId: string;
  orgId?: string;
  teamId?: string;
  supabase: SupabaseClient;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * Tool definition with schema and handler
 */
export interface AgentTool {
  name: string;
  description: string;
  category: "query" | "action" | "analysis";
  requiresConfirmation: boolean;
  parameters: z.ZodObject<z.ZodRawShape>;
  handler: (
    params: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolResult>;
}

/**
 * Convert Zod schema to OpenAI function schema
 */
export function zodToOpenAISchema(
  schema: z.ZodObject<z.ZodRawShape>
): OpenAI.FunctionParameters {
  const shape = schema.shape;
  const properties: Record<
    string,
    { type: string; description?: string; items?: object }
  > = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;

    // Extract description from Zod schema
    let description = "";
    const def = zodType._def as { description?: string };
    if (def.description) {
      description = def.description;
    }

    // Map Zod types to JSON Schema types
    if (zodType instanceof z.ZodString) {
      properties[key] = { type: "string", description };
    } else if (zodType instanceof z.ZodNumber) {
      properties[key] = { type: "number", description };
    } else if (zodType instanceof z.ZodBoolean) {
      properties[key] = { type: "boolean", description };
    } else if (zodType instanceof z.ZodArray) {
      properties[key] = { type: "array", description, items: {} };
    } else if (zodType instanceof z.ZodObject) {
      properties[key] = { type: "object", description };
    }

    // Check if field is required
    if (!zodType.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

/**
 * Convert agent tool to OpenAI function definition
 */
export function toolToOpenAIFunction(
  tool: AgentTool
): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToOpenAISchema(tool.parameters),
    },
  };
}
