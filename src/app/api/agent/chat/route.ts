/**
 * API Route: /api/agent/chat
 * Handles agent chat interactions with tool calling
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { agentService } from "@/lib/agent/agent-service";
import type OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
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

    // Get user's organization
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "No organization found. Please create or join an organization first.",
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ChatRequest;
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }

    // Process message with agent
    const result = await agentService.processMessage({
      messages,
      context: {
        userId: user.id,
        orgId: membership.org_id,
        supabase,
      },
    });

    // Return response
    return NextResponse.json({
      message: result.message,
      toolCalls: result.toolCalls,
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

    const greeting = agentService.getGreeting(profile?.full_name || undefined);

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
