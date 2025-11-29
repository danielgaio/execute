/**
 * OpenAI integration for Execute AI Agent
 * Provides chat completions, function calling, and embeddings
 */

import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

export const openai = apiKey ? new OpenAI({ apiKey }) : null;

export const AGENT_MODEL = "gpt-4o-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Create a chat completion with optional tool/function calling
 */
export async function createChatCompletion(params: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  toolChoice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}) {
  if (!openai) {
    throw new Error(
      "OpenAI client not initialized. Please set OPENAI_API_KEY environment variable."
    );
  }

  try {
    const response = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.toolChoice,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 2000,
      stream: params.stream ?? false,
    });

    return response;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response");
  }
}

/**
 * Create embeddings for RAG (future use)
 */
export async function createEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error(
      "OpenAI client not initialized. Please set OPENAI_API_KEY environment variable."
    );
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("OpenAI embedding error:", error);
    throw new Error("Failed to create embedding");
  }
}

/**
 * Create streaming chat completion
 */
export async function createStreamingChatCompletion(params: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  toolChoice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
  temperature?: number;
}) {
  if (!openai) {
    throw new Error(
      "OpenAI client not initialized. Please set OPENAI_API_KEY environment variable."
    );
  }

  try {
    const stream = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.toolChoice,
      temperature: params.temperature ?? 0.7,
      stream: true,
    });

    return stream;
  } catch (error) {
    console.error("OpenAI streaming error:", error);
    throw new Error("Failed to start streaming response");
  }
}
