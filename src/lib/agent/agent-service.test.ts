import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentService } from "./agent-service";
import * as openaiLib from "../openai";
import * as auditService from "./audit-service";
import * as contextBuilder from "./context-builder";
import * as embeddingService from "./embedding-service";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("../openai", () => ({
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
}));

vi.mock("./audit-service", () => ({
  logAgentAction: vi.fn(),
  getEntityHistory: vi.fn(),
  getRecentAuditActivity: vi.fn(),
}));

vi.mock("./context-builder", () => ({
  contextBuilder: {
    buildContext: vi.fn().mockResolvedValue({}),
    formatContext: vi.fn().mockReturnValue(""),
  },
}));

vi.mock("./embedding-service", () => ({
  embeddingService: {
    searchEmbeddings: vi.fn().mockResolvedValue([]),
    indexCycle: vi.fn(),
  },
}));

describe("AgentService", () => {
  let agentService: AgentService;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    agentService = new AgentService();
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
      from: vi.fn(),
    } as unknown as SupabaseClient;
    
    vi.clearAllMocks();
  });

  it("should process a simple message without tools", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hello there!",
            tool_calls: [],
          },
        },
      ],
    };

    (openaiLib.createChatCompletion as any).mockResolvedValue(mockResponse);

    const result = await agentService.processMessage({
      messages: [{ role: "user", content: "Hi" }],
      context: { userId: "user-123", orgId: "org-123", supabase: mockSupabase },
    });

    expect(result.message).toBe("Hello there!");
    expect(result.toolCalls).toBeUndefined();
  });

  it("should stream final responses without triggering tool calls again", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Here is your update.",
            tool_calls: [],
          },
        },
      ],
    };

    const mockStream = Symbol("stream");

    (openaiLib.createChatCompletion as any).mockResolvedValue(mockResponse);
    (openaiLib.createStreamingChatCompletion as any).mockResolvedValue(mockStream);

    const result = await agentService.processMessage({
      messages: [{ role: "user", content: "Give me an update" }],
      context: { userId: "user-123", orgId: "org-123", supabase: mockSupabase },
      stream: true,
    });

    expect(openaiLib.createStreamingChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ toolChoice: "none" })
    );
    expect(result.stream).toBe(mockStream as any);
    expect(result.message).toBeUndefined();
  });

  it("should pause execution when a tool requires confirmation", async () => {
    // Mock OpenAI to return a tool call that requires confirmation (create_cycle)
    const mockToolCall = {
      id: "call_123",
      type: "function",
      function: {
        name: "create_cycle",
        arguments: JSON.stringify({ title: "New Cycle", start_date: "2025-01-01", end_date: "2025-03-31" }),
      },
    };

    const mockResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [mockToolCall],
          },
        },
      ],
    };

    (openaiLib.createChatCompletion as any).mockResolvedValue(mockResponse);

    const result = await agentService.processMessage({
      messages: [{ role: "user", content: "Create a new cycle" }],
      context: { userId: "user-123", orgId: "org-123", supabase: mockSupabase },
    });

    // Should return confirmation request
    expect(result.confirmationRequired).toBeDefined();
    expect(result.confirmationRequired?.toolCallId).toBe("call_123");
    expect(result.confirmationRequired?.name).toBe("create_cycle");
    expect(result.message).toBe("Please confirm this action.");
    
    // Should NOT have executed the tool (audit log should not be called for creation)
    // Note: create_cycle calls logAgentAction internally on success.
    // We can check if logAgentAction was called. 
    // Since we mocked it, we can check calls.
    expect(auditService.logAgentAction).not.toHaveBeenCalled();
  });

  it("should resume execution when confirmedToolCallId is provided", async () => {
    // Setup: We are resuming. The last message in history is the assistant's tool call.
    const toolCallId = "call_123";
    const toolArgs = { title: "New Cycle", start_date: "2025-01-01", end_date: "2025-03-31" };
    
    const lastAssistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: "create_cycle",
            arguments: JSON.stringify(toolArgs),
          },
        },
      ],
    };

    // Mock the tool execution inside AgentService
    // Since AgentService uses real tools, we need to mock the DB call inside create_cycle
    // OR we can spy on executeTool. But executeTool is private.
    // Instead, we'll rely on the fact that create_cycle calls context.supabase.from().insert()
    
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "cycle-123", title: "New Cycle" }, error: null }),
      }),
    });

    mockSupabase.from = vi.fn().mockReturnValue({
      insert: mockInsert,
    } as any);

    // Mock OpenAI for the *next* turn (after tool execution)
    (openaiLib.createChatCompletion as any).mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Cycle created!" } }],
    });

    const result = await agentService.processMessage({
      messages: [{ role: "user", content: "Create cycle" }, lastAssistantMessage as any],
      context: { userId: "user-123", orgId: "org-123", supabase: mockSupabase },
      confirmedToolCallId: toolCallId,
    });

    // Should have executed the tool
    expect(mockInsert).toHaveBeenCalled();
    
    // Should have logged the confirmation
    expect(auditService.logAgentAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "agent_tool_call",
        metadata: expect.objectContaining({ status: "confirmed" }),
      })
    );

    expect(result.message).toBe("Cycle created!");
  });

  it("should cancel execution when cancelledToolCallId is provided", async () => {
    const toolCallId = "call_123";
    const toolArgs = { title: "New Cycle", start_date: "2025-01-01", end_date: "2025-03-31" };
    
    const lastAssistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: "create_cycle",
            arguments: JSON.stringify(toolArgs),
          },
        },
      ],
    };

    // Mock OpenAI to respond to the cancellation
    (openaiLib.createChatCompletion as any).mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Okay, I cancelled it." } }],
    });

    const result = await agentService.processMessage({
      messages: [{ role: "user", content: "Create cycle" }, lastAssistantMessage as any],
      context: { userId: "user-123", orgId: "org-123", supabase: mockSupabase },
      cancelledToolCallId: toolCallId,
    });

    // Should NOT have executed the tool (no DB calls)
    expect(mockSupabase.from).not.toHaveBeenCalled();

    // Should have logged the cancellation
    expect(auditService.logAgentAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "agent_tool_call",
        metadata: expect.objectContaining({ status: "cancelled" }),
      })
    );

    expect(result.message).toBe("Okay, I cancelled it.");
  });

  describe("getProactiveGreeting", () => {
    it("should suggest creating a cycle if none exists", async () => {
      (contextBuilder.contextBuilder.buildContext as any).mockResolvedValue({
        activeCycle: null,
        pendingTasksCount: 0,
        overdueTasksCount: 0,
        todayTasksCount: 0
      });

      const greeting = await agentService.getProactiveGreeting(
        { userId: "u1", orgId: "o1", supabase: mockSupabase },
        "Daniel"
      );

      expect(greeting).toContain("Hi Daniel!");
      expect(greeting).toContain("don't have an active 12-week cycle");
    });

    it("should warn about overdue tasks", async () => {
      (contextBuilder.contextBuilder.buildContext as any).mockResolvedValue({
        activeCycle: { id: "c1" },
        pendingTasksCount: 5,
        overdueTasksCount: 3,
        todayTasksCount: 0
      });

      const greeting = await agentService.getProactiveGreeting(
        { userId: "u1", orgId: "o1", supabase: mockSupabase },
        "Daniel"
      );

      expect(greeting).toContain("You have 3 overdue tasks");
    });
  });
});
