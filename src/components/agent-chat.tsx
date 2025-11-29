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
import type OpenAI from "openai";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    if (!isInitialized) {
      loadGreeting();
      setIsInitialized(true);
    }
  }, [isInitialized]);

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
      // Convert messages to OpenAI format
      const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
        messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      apiMessages.push({
        role: "user",
        content: input,
      });

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          error: string;
          details?: string;
        };
        throw new Error(errorData.error || "Failed to send message");
      }

      const data = (await response.json()) as {
        message: string;
        toolCalls?: {
          name: string;
          args: Record<string, unknown>;
          result: { success: boolean };
        }[];
      };

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      console.error("Chat error:", err);
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
