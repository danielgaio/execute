/**
 * Agent Chat Component
 * Interactive chat interface for the Execute AI Agent
 */

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";

import { useOrganization } from "@/contexts/organization-context";
import { useAgent } from "@/contexts/agent-context";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: {
    name: string;
    args: Record<string, unknown>;
    result: { success: boolean };
  }[];
}

export default function AgentChat() {
  const { currentOrg } = useOrganization();
  const { initialMessage, clearInitialMessage } = useAgent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with greeting or initial message
  useEffect(() => {
    if (!isInitialized) {
      if (initialMessage) {
        // If we have an initial message from context (e.g. "Plan with AI"), send it immediately
        setInput(initialMessage);
        // We need to wait a tick for state to update, or just call sendMessage directly?
        // Better to just set it as input and let user confirm? 
        // Or auto-send? The requirement implies auto-start.
        // Let's auto-send.
        handleAutoSend(initialMessage);
        clearInitialMessage();
      } else {
        loadGreeting();
      }
      setIsInitialized(true);
    }
  }, [isInitialized, initialMessage]);

  const handleAutoSend = async (text: string) => {
    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGreeting = async () => {
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
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
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

      // Update conversation ID if returned (for new conversations)
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };



  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <SmartToyIcon color="primary" />
        <Typography variant="h6">Execute AI Agent</Typography>
        <Chip label="Beta" size="small" color="primary" variant="outlined" />
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.map((message, index) => (
          <Box
            key={index}
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "flex-start",
              flexDirection: message.role === "user" ? "row-reverse" : "row",
            }}
          >
            {/* Avatar */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor:
                  message.role === "user" ? "primary.main" : "secondary.main",
                color: "white",
                flexShrink: 0,
              }}
            >
              {message.role === "user" ? <PersonIcon /> : <SmartToyIcon />}
            </Box>

            {/* Message content */}
            <Box sx={{ maxWidth: "75%" }}>
              <Paper
                sx={{
                  p: 1.5,
                  bgcolor:
                    message.role === "user" ? "primary.light" : "grey.100",
                  color:
                    message.role === "user"
                      ? "primary.contrastText"
                      : "text.primary",
                }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {message.content}
                </Typography>
              </Paper>

              {/* Tool calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {message.toolCalls.map((tool, idx) => (
                    <Chip
                      key={idx}
                      label={tool.name}
                      size="small"
                      color={tool.result.success ? "success" : "error"}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: "block" }}
              >
                {message.timestamp.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "secondary.main",
                color: "white",
              }}
            >
              <SmartToyIcon />
            </Box>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Thinking...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Ask me anything about your cycles, goals, or tactics..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          size="small"
        />
        <IconButton
          color="primary"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          sx={{ alignSelf: "flex-end" }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}
