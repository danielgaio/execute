/**
 * Agent Service - Core orchestration for Execute AI Agent
 * Manages conversation context, tool registry, and execution flow
 */

import type OpenAI from "openai";
import { createChatCompletion } from "../openai";
import type { AgentTool, ToolContext, ToolResult } from "./types";
import { toolToOpenAIFunction } from "./types";
import { queryTools } from "./tools/query-tools";
import { actionTools } from "./tools/action-tools";
import { analysisTools } from "./tools/analysis-tools";
import { planningTools } from "./tools/planning-tools";
import { wprTools } from "./tools/wpr-tools";
import { executionTools } from "./tools/execution-tools";
import { embeddingService } from "./embedding-service";
import { contextBuilder } from "./context-builder";
import { logAgentAction } from "./audit-service";
import { SYSTEM_PROMPT } from "./prompts";

/**
 * Agent Service class
 */
export class AgentService {
  private tools: Map<string, AgentTool>;

  constructor() {
    this.tools = new Map();
    this.registerTools();
  }

  /**
   * Register all available tools
   */
  private registerTools(): void {
    const allTools = [...queryTools, ...actionTools, ...analysisTools, ...planningTools, ...wprTools, ...executionTools];

    for (const tool of allTools) {
      this.tools.set(tool.name, tool);
    }

    console.log(`Registered ${this.tools.size} agent tools`);
  }

  /**
   * Get OpenAI function definitions for all tools
   */
  private getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
    return Array.from(this.tools.values()).map(toolToOpenAIFunction);
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      };
    }

    try {
      // Validate parameters
      const validatedArgs = tool.parameters.parse(args);

      // Execute tool
      const result = await tool.handler(validatedArgs, context);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }

  /**
   * Process a chat message with potential tool calling
   */
  async processMessage(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    context: ToolContext;
    maxIterations?: number;
    confirmedToolCallId?: string;
    cancelledToolCallId?: string;
  }): Promise<{
    message: string;
    toolCalls?: {
      name: string;
      args: Record<string, unknown>;
      result: ToolResult;
    }[];
    generatedMessages: OpenAI.Chat.ChatCompletionMessageParam[];
    rawResponse?: OpenAI.Chat.ChatCompletion;
    confirmationRequired?: {
      toolCallId: string;
      name: string;
      args: Record<string, unknown>;
    };
  }> {
    const { messages, context, maxIterations = 5, confirmedToolCallId, cancelledToolCallId } = params;

    // Retrieve relevant context using RAG
    let contextMessage = "";
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (context.orgId && lastUserMessage && typeof lastUserMessage.content === "string") {
      // 1. Build Deterministic Context (Cycle, Score, Tasks)
      try {
        const deterministicContext = await contextBuilder.buildContext(
          context.supabase,
          context.orgId
        );
        contextMessage += contextBuilder.formatContext(deterministicContext);
      } catch (error) {
        console.error("Context builder failed:", error);
      }

      // 2. Build Semantic Context (RAG)
      try {
        const relevantDocs = await embeddingService.searchEmbeddings(
          context.supabase,
          lastUserMessage.content,
          context.orgId
        );

        if (relevantDocs.length > 0) {
          contextMessage += `
\n--- RELEVANT PLANS & NOTES ---\n
${relevantDocs
  .map((doc) => `[${doc.metadata.entity_type.toUpperCase()}] ${doc.metadata.title || "Untitled"}\n${doc.content}`)
  .join("\n\n")}
`;
        }
      } catch (error) {
        console.error("RAG retrieval failed:", error);
      }
    }

    // Add system prompt and context
    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...messages,
    ];

    let iteration = 0;
    let currentMessages = fullMessages;
    const generatedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const toolCallHistory: {
      name: string;
      args: Record<string, unknown>;
      result: ToolResult;
    }[] = [];

    // RESUME LOGIC: Check if we are resuming from a tool call
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.tool_calls?.length) {
      const toolResults: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      for (const toolCall of lastMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const tool = this.tools.get(toolName);
        
        // Check confirmation
        if (tool?.requiresConfirmation) {
          // Handle Cancellation
          if (toolCall.id === cancelledToolCallId) {
            const result = { success: false, error: "User cancelled this action." };
            
            // Log cancellation
            if (context.orgId) {
              await logAgentAction(context.supabase, {
                userId: (await context.supabase.auth.getUser()).data.user?.id || "unknown",
                orgId: context.orgId,
                toolName,
                action: "agent_tool_call",
                entityType: "tool_execution",
                entityId: toolCall.id,
                metadata: { 
                  status: "cancelled",
                  args: toolArgs
                }
              });
            }

            toolCallHistory.push({
              name: toolName,
              args: toolArgs,
              result,
            });

            const toolMessage: OpenAI.Chat.ChatCompletionMessageParam = { 
              role: 'tool', 
              tool_call_id: toolCall.id, 
              content: JSON.stringify(result) 
            };
            toolResults.push(toolMessage);
            generatedMessages.push(toolMessage);
            continue; // Skip execution
          }

          if (toolCall.id !== confirmedToolCallId) {
            // Not confirmed yet
            return {
              message: "Please confirm this action.",
              generatedMessages: [], 
              confirmationRequired: {
                toolCallId: toolCall.id,
                name: toolName,
                args: toolArgs
              }
            };
          }

          // Log confirmation
          if (context.orgId) {
            await logAgentAction(context.supabase, {
              userId: (await context.supabase.auth.getUser()).data.user?.id || "unknown",
              orgId: context.orgId,
              toolName,
              action: "agent_tool_call",
              entityType: "tool_execution",
              entityId: toolCall.id,
              metadata: { 
                status: "confirmed",
                args: toolArgs
              }
            });
          }
        }
        
        // Execute
        const result = await this.executeTool(toolName, toolArgs, context);
        
        // Track tool call
        toolCallHistory.push({
          name: toolName,
          args: toolArgs,
          result,
        });

        const toolMessage: OpenAI.Chat.ChatCompletionMessageParam = { 
          role: 'tool', 
          tool_call_id: toolCall.id, 
          content: JSON.stringify(result) 
        };
        toolResults.push(toolMessage);
        generatedMessages.push(toolMessage);
      }
      
      // Append results to currentMessages
      currentMessages = [...currentMessages, ...toolResults];
    }

    while (iteration < maxIterations) {
      iteration++;

      // Call OpenAI with tools
      const response = (await createChatCompletion({
        messages: currentMessages,
        tools: this.getToolDefinitions(),
        toolChoice: "auto",
      })) as OpenAI.Chat.ChatCompletion;

      const choice = response.choices[0];
      const message = choice.message;

      // Track generated message
      generatedMessages.push(message);

      // If no tool calls, return the message
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          message:
            message.content ||
            "I apologize, but I couldn't generate a response.",
          toolCalls: toolCallHistory.length > 0 ? toolCallHistory : undefined,
          generatedMessages,
          rawResponse: response,
        };
      }

      // Execute tool calls
      const toolResults: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;

        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
        const tool = this.tools.get(toolName);

        // Check confirmation for NEW tool calls
        if (tool?.requiresConfirmation) {
          return {
            message: "Please confirm this action.",
            generatedMessages, // Includes the assistant message requesting the tool
            confirmationRequired: {
              toolCallId: toolCall.id,
              name: toolName,
              args: toolArgs
            }
          };
        }

        // Execute the tool
        const result = await this.executeTool(toolName, toolArgs, context);

        // Track tool call
        toolCallHistory.push({
          name: toolName,
          args: toolArgs,
          result,
        });

        // Add tool result to messages
        const toolMessage: OpenAI.Chat.ChatCompletionMessageParam = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
        
        toolResults.push(toolMessage);
        generatedMessages.push(toolMessage);
      }

      // Update messages for next iteration
      currentMessages = [...currentMessages, message, ...toolResults];
    }

    // If we hit max iterations, return what we have
    return {
      message:
        "I executed several operations but reached the iteration limit. Please ask a follow-up question for more details.",
      toolCalls: toolCallHistory,
      generatedMessages,
    };
  }

  /**
   * Get a simple greeting message for new users
   */
  getGreeting(userName?: string): string {
    const greeting = userName ? `Hi ${userName}! 👋` : "Hi there! 👋";
    return `${greeting}

I'm your Execute AI Agent, here to help you plan and execute your 12-week cycles.

**I can help you:**
- Plan your next 12-week cycle with vision, goals, and tactics
- Check on your progress: "How am I doing this week?"
- Get your daily focus: "What should I work on today?"
- **Explain why your score is what it is** and identify blockers
- **Compare your performance** across different cycles
- **Analyze** which tactics drive your goal outcomes
- Guide you through Weekly Progress Reviews

**Try asking:**
- "What's my current cycle?"
- "What should I focus on today?"
- "Why is my score low this week?"
- "What's blocking my progress?"
- "Compare my last two cycles"
- "Which tactics are most effective for my goals?"

How can I help you today?`;
  }
}

// Export singleton instance
export const agentService = new AgentService();
