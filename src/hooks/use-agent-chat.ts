import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/contexts/organization-context";
import { useAgent } from "@/contexts/agent-context";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: {
    name: string;
    args: Record<string, unknown>;
    result: { success: boolean };
  }[];
}

export interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "info";
}

export interface ConfirmationRequest {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
}

export function useAgentChat() {
  const { currentOrg } = useOrganization();
  const { initialMessage, clearInitialMessage } = useAgent();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);

  const checkForMutatingActions = useCallback((toolCalls: any[]) => {
    if (!toolCalls || toolCalls.length === 0) return false;

    return toolCalls.some((tool: any) => 
      (tool.name.startsWith("create_") || 
       tool.name.startsWith("update_") || 
       tool.name.startsWith("delete_") ||
       tool.name === "mark_tactic_complete" ||
       tool.name === "defer_tactic") && 
      tool.result?.success
    );
  }, []);

  const handleMutatingActions = useCallback((toolCalls: any[]) => {
    if (checkForMutatingActions(toolCalls)) {
      router.refresh();
      setToast({
        open: true,
        message: "Dashboard updated successfully",
        severity: "success",
      });
    }
  }, [checkForMutatingActions, router]);

  const loadGreeting = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/chat");
      const data = (await response.json()) as { message: string };

      if (data.message) {
        setMessages([
          {
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load greeting:", err);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          orgId: currentOrg?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (data.confirmationRequired) {
        setConfirmationRequest(data.confirmationRequired);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.toolCalls) {
        handleMutatingActions(data.toolCalls);
      }

    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationId, currentOrg?.id, handleMutatingActions]);

  const confirmAction = async () => {
    if (!confirmationRequest || isLoading) return;

    setIsLoading(true);
    setConfirmationRequest(null); // Clear request
    setError(null);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          orgId: currentOrg?.id,
          confirmedToolCallId: confirmationRequest.toolCallId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm action");
      }

      // Handle response (same as sendMessage)
      if (data.confirmationRequired) {
        setConfirmationRequest(data.confirmationRequired);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.toolCalls) {
        handleMutatingActions(data.toolCalls);
      }
    } catch (err) {
      console.error("Confirmation error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAction = async () => {
    if (!confirmationRequest || isLoading) return;

    const toolCallId = confirmationRequest.toolCallId;
    setConfirmationRequest(null);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          orgId: currentOrg?.id,
          cancelledToolCallId: toolCallId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel action");
      }

      // Handle response
      if (data.confirmationRequired) {
        setConfirmationRequest(data.confirmationRequired);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.toolCalls) {
        handleMutatingActions(data.toolCalls);
      }
    } catch (err) {
      console.error("Cancellation error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize with greeting or initial message
  useEffect(() => {
    if (initialMessage) {
      // Auto-send initial message
      sendMessage(initialMessage);
      clearInitialMessage();
      if (!isInitialized) setIsInitialized(true);
    } else if (!isInitialized) {
      loadGreeting();
      setIsInitialized(true);
    }
  }, [isInitialized, initialMessage, loadGreeting, clearInitialMessage, sendMessage]);
  
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    toast,
    setToast,
    confirmationRequest,
    confirmAction,
    cancelAction,
    sendMessage: () => sendMessage(input),
    // We expose a direct send method for the UI's "Enter" key or button which uses the `input` state
  };
}
