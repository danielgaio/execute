"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface AgentContextType {
  isOpen: boolean;
  initialMessage: string | null;
  toggleAgent: () => void;
  openAgent: (message?: string) => void;
  closeAgent: () => void;
  clearInitialMessage: () => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);

  const toggleAgent = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openAgent = useCallback((message?: string) => {
    if (message) {
      setInitialMessage(message);
    }
    setIsOpen(true);
  }, []);

  const closeAgent = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearInitialMessage = useCallback(() => {
    setInitialMessage(null);
  }, []);

  return (
    <AgentContext.Provider
      value={{
        isOpen,
        initialMessage,
        toggleAgent,
        openAgent,
        closeAgent,
        clearInitialMessage,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}
