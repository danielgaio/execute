/**
 * Agent Chat Component
 * Interactive chat interface for the Execute AI Agent
 */

"use client";

import { useRef, useEffect } from "react";
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
  Snackbar,
  Button,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import { useAgentChat } from "@/hooks/use-agent-chat";

export default function AgentChat() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    toast,
    setToast,
    sendMessage,
    confirmationRequest,
    confirmAction,
    cancelAction,
  } = useAgentChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



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

        {/* Confirmation Request */}
        {confirmationRequest && (
          <Card variant="outlined" sx={{ borderColor: "warning.main", bgcolor: "warning.light" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Confirmation Required
              </Typography>
              <Typography variant="body2">
                The agent wants to perform the following action:
              </Typography>
              <Box sx={{ mt: 1, p: 1, bgcolor: "background.paper", borderRadius: 1 }}>
                <Typography variant="body2" fontFamily="monospace">
                  {confirmationRequest.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="pre" sx={{ overflowX: 'auto' }}>
                  {JSON.stringify(confirmationRequest.args, null, 2)}
                </Typography>
              </Box>
            </CardContent>
            <CardActions>
              <Button size="small" color="inherit" onClick={cancelAction} disabled={isLoading}>
                Cancel
              </Button>
              <Button size="small" variant="contained" color="warning" onClick={confirmAction} disabled={isLoading}>
                Confirm Action
              </Button>
            </CardActions>
          </Card>
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
      {/* Toast Notification */}
      {toast && (
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert onClose={() => setToast(null)} severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>
      )}
    </Paper>
  );
}
