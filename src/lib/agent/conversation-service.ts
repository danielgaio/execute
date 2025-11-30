import { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

export interface Conversation {
  id: string;
  user_id: string;
  org_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(
    supabase: SupabaseClient,
    userId: string,
    orgId: string,
    title?: string
  ): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        org_id: orgId,
        title: title || "New Conversation",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(
    supabase: SupabaseClient,
    conversationId: string
  ): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    supabase: SupabaseClient,
    conversationId: string,
    message: OpenAI.Chat.ChatCompletionMessageParam
  ) {
    const dbMessage: {
      conversation_id: string;
      role: string;
      content: string | null;
      tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
      tool_call_id?: string;
    } = {
      conversation_id: conversationId,
      role: message.role,
      content: typeof message.content === "string" ? message.content : null,
    };

    // Handle specific fields based on role
    if (message.role === "assistant" && message.tool_calls) {
      dbMessage.tool_calls = message.tool_calls;
    }

    if (message.role === "tool") {
      dbMessage.tool_call_id = message.tool_call_id;
    }

    const { error } = await supabase.from("messages").insert(dbMessage);

    if (error) throw error;
  }

  /**
   * Get all messages for a conversation
   */
  async getMessages(
    supabase: SupabaseClient,
    conversationId: string
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    interface DbMessage {
      role: string;
      content: string | null;
      tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
      tool_call_id?: string;
    }

    return data.map((msg: DbMessage) => {
      const baseMsg: OpenAI.Chat.ChatCompletionMessageParam = {
        role: msg.role as "user" | "assistant" | "tool" | "system",
        content: msg.content,
      } as OpenAI.Chat.ChatCompletionMessageParam;

      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.tool_calls,
        };
      }

      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: msg.content || "",
          tool_call_id: msg.tool_call_id || "",
        };
      }

      return baseMsg;
    });
  }

  /**
   * Update conversation title
   */
  async updateTitle(
    supabase: SupabaseClient,
    conversationId: string,
    title: string
  ) {
    const { error } = await supabase
      .from("conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    if (error) throw error;
  }
}

export const conversationService = new ConversationService();
