/**
 * API Route: /api/agent/chat
 * Handles agent chat interactions with tool calling
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { agentService } from "@/lib/agent/agent-service";
import { conversationService } from "@/lib/agent/conversation-service";
import type OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  message?: string;
  conversationId?: string;
  orgId?: string;
  confirmedToolCallId?: string;
  cancelledToolCallId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = (await request.json()) as ChatRequest;
    const {
      message: userContent,
      conversationId: requestedConversationId,
      orgId,
      confirmedToolCallId,
      cancelledToolCallId,
    } = body;

    if (!userContent && !confirmedToolCallId && !cancelledToolCallId) {
      return NextResponse.json(
        { error: "Invalid request: message or confirmation/cancellation required" },
        { status: 400 }
      );
    }

    // Get user's organization (validate access if orgId provided, otherwise get default)
    let query = supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id);

    if (orgId) {
      query = query.eq("org_id", orgId);
    }

    const { data: membership } = await query.limit(1).single();

    if (!membership) {
      return NextResponse.json(
        {
          error: orgId
            ? "Unauthorized access to organization"
            : "No organization found. Please create or join an organization first.",
        },
        { status: 403 }
      );
    }

    const currentOrgId = membership.org_id;
    const userRole = membership.role;

    // 1. Get or create conversation
    let conversationId = requestedConversationId;
    let history: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (conversationId) {
      // Verify ownership
      const conversation = await conversationService.getConversation(
        supabase,
        conversationId
      );
      if (!conversation || conversation.user_id !== user.id) {
        // If not found or not owned, create new one (or error out? creating new is safer for UX)
        conversationId = undefined;
      } else {
        // Load history
        history = await conversationService.getMessages(supabase, conversationId);
      }
    }

    if (!conversationId) {
      const newConv = await conversationService.createConversation(
        supabase,
        user.id,
        membership.org_id,
        (userContent || "New Conversation").substring(0, 50) + "..."
      );
      conversationId = newConv.id;
    }

    // 2. Save user message (only if new content provided)
    let messagesToProcess = history;
    
    if (userContent) {
      const userMessage: OpenAI.Chat.ChatCompletionMessageParam = {
        role: "user",
        content: userContent,
      };
      
      await conversationService.addMessage(supabase, conversationId!, userMessage);
      messagesToProcess = [...history, userMessage];
    }

    // 3. Process with agent (History + New Message)
    const result = await agentService.processMessage({
      messages: messagesToProcess,
      context: {
        userId: user.id,
        orgId: membership.org_id,
        supabase,
      },
      confirmedToolCallId,
      cancelledToolCallId,
    });

    // 4. Save generated messages (Assistant response + Tool calls)
    for (const msg of result.generatedMessages) {
      await conversationService.addMessage(supabase, conversationId!, msg);
    }

    // Return response
    return NextResponse.json({
      message: result.message,
      toolCalls: result.toolCalls,
      conversationId,
      confirmationRequired: result.confirmationRequired,
    });
  } catch (error) {
    console.error("Agent chat error:", error);

    return NextResponse.json(
      {
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to get agent greeting
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Get user's organization to build context
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    let greeting: string;

    if (membership?.org_id) {
      greeting = await agentService.getProactiveGreeting(
        {
          userId: user.id,
          orgId: membership.orgId,
          supabase,
        },
        profile?.full_name || undefined
      );
    } else {
      // Fallback if no org (shouldn't happen in normal flow)
      greeting = agentService.getGreeting(profile?.full_name || undefined);
    }

    return NextResponse.json({
      message: greeting,
    });
  } catch (error) {
    console.error("Agent greeting error:", error);

    return NextResponse.json(
      { error: "Failed to get greeting" },
      { status: 500 }
    );
  }
}
