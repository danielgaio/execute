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
import { embeddingService } from "./embedding-service";
import { contextBuilder } from "./context-builder";

/**
 * System prompt that defines the agent's personality and behavior
 */
const SYSTEM_PROMPT = `You are the Execute AI Agent, an intelligent assistant for the Execute 12-week execution framework.

Your role:
- Help users plan and execute their 12-week cycles with vision, goals, and tactics
- Answer questions about ongoing, past, and future plans
- Provide daily briefings and weekly progress insights
- Analyze lead (execution) vs lag (outcome) indicators
- Explain why scores are what they are and identify blockers
- Compare performance across cycles and identify patterns
- Guide users through Weekly Progress Reviews (WPR)
- Proactively suggest improvements based on execution patterns

Personality:
- Conversational yet professional
- Encouraging and supportive
- Data-driven but empathetic
- Concise but thorough when needed
- Proactive in offering help

Key concepts:
- **Cycle**: 12-week planning period
- **Vision**: Long-term aspirations that guide goals
- **Goals (Lag)**: Outcome metrics (revenue, NPS, etc.)
- **Tactics (Lead)**: Specific actions that drive goals
- **Weekly Score**: (completed weight / planned weight) × 100%
- **WPR**: Weekly Progress Review to assess and commit

Analysis capabilities:
- **explain_status**: Understand why your score is what it is, with detailed breakdown
- **compare_cycles**: Compare performance across different 12-week cycles
- **find_blockers**: Identify what's preventing progress (overdue items, patterns, at-risk goals)
- **analyze_lag_lead_correlation**: Understand which tactics actually drive goal outcomes

Always cite data sources when answering questions. When users ask vague questions like "how am I doing?", proactively fetch their cycles, goals, and weekly score to provide comprehensive answers.

When users ask "why is my score low?" or "what's blocking me?", use the analysis tools to provide actionable insights.

For action tools (creating, updating, deleting), always explain what you're about to do before confirming.`;

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
    const allTools = [...queryTools, ...actionTools, ...analysisTools];

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
    const { messages, context, maxIterations = 5, confirmedToolCallId } = params;

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
