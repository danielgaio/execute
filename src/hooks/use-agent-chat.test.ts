import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAgentChat } from './use-agent-chat';

// Mocks
const mockRouter = {
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockUseOrganization = {
  currentOrg: { id: 'org-123' },
};

vi.mock('@/contexts/organization-context', () => ({
  useOrganization: () => mockUseOrganization,
}));

const mockUseAgent = {
  initialMessage: null,
  clearInitialMessage: vi.fn(),
};

vi.mock('@/contexts/agent-context', () => ({
  useAgent: () => mockUseAgent,
}));

// Mock fetch
global.fetch = vi.fn();

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAgent.initialMessage = null;
  });

  it('should initialize with default state', async () => {
    // Mock greeting to avoid unhandled rejection warning
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Greeting' }),
    });

    const { result } = renderHook(() => useAgentChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.toast).toBe(null);
    
    // Wait for the effect to settle to avoid "act" warnings or unhandled promises
    await waitFor(() => {
       expect(result.current.messages).toHaveLength(1);
    });
  });

  it('should load greeting on initialization if no initial message', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Hello from Agent' }),
    });

    const { result } = renderHook(() => useAgentChat());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0].content).toBe('Hello from Agent');
    expect(result.current.messages[0].role).toBe('assistant');
  });

  it('should send a message successfully', async () => {
    // Mock greeting call first
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Greeting' }),
      })
      // Mock message response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Response', toolCalls: [] }),
      });

    const { result } = renderHook(() => useAgentChat());

    // Wait for greeting to load
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    act(() => {
      result.current.setInput('Hello');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.messages).toHaveLength(3); // Greeting + User + Assistant
    expect(result.current.messages[1].content).toBe('Hello');
    expect(result.current.messages[2].content).toBe('Response');
    expect(result.current.isLoading).toBe(false);
  });

  it('should trigger refresh and toast on mutating tool calls', async () => {
    // Mock greeting
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Greeting' }),
      })
      // Mock tool response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Done',
          toolCalls: [
            {
              name: 'create_cycle',
              args: {},
              result: { success: true },
            },
          ],
        }),
      });

    const { result } = renderHook(() => useAgentChat());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    act(() => {
      result.current.setInput('Create cycle');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(mockRouter.refresh).toHaveBeenCalled();
    expect(result.current.toast).toEqual({
      open: true,
      message: 'Dashboard updated successfully',
      severity: 'success',
    });
  });

  it('should NOT trigger refresh on non-mutating tool calls', async () => {
    // Mock greeting
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Greeting' }),
      })
      // Mock tool response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Here is the info',
          toolCalls: [
            {
              name: 'query_goals',
              args: {},
              result: { success: true },
            },
          ],
        }),
      });

    const { result } = renderHook(() => useAgentChat());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    act(() => {
      result.current.setInput('Get goals');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(result.current.toast).toBe(null);
  });

  it('should handle auto-send initial message', async () => {
    mockUseAgent.initialMessage = 'Plan with AI';
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Sure, let\'s plan', toolCalls: [] }),
    });

    const { result } = renderHook(() => useAgentChat());

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    expect(result.current.messages[0].content).toBe('Plan with AI');
    expect(mockUseAgent.clearInitialMessage).toHaveBeenCalled();
  });
});
