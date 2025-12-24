import { describe, it, expect, vi, beforeEach } from "vitest";
import { BriefingService } from "./service";

describe("BriefingService", () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [] }),
            })),
          })),
          eq: vi.fn(() => ({
            neq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [] }),
            })),
          })),
          gt: vi.fn(() => ({
            lte: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [] }),
              })),
            })),
          })),
          gte: vi.fn(() => ({
            lte: vi.fn().mockResolvedValue({ data: [] }),
          })),
        })),
      })),
    })),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should include score analysis when week items exist", async () => {
    // Mock Week Items (1 done, 1 pending)
    const weekItems = [
      {
        id: "1",
        due_date: "2025-12-24",
        status: "done",
        planned: true,
        tactics: { title: "Task 1", weight: 1.0, goals: { title: "Goal A" } },
      },
      {
        id: "2",
        due_date: "2025-12-25",
        status: "pending",
        planned: true,
        tactics: { title: "Task 2", weight: 1.0, goals: { title: "Goal A" } },
      },
    ];

    // Setup Mocks
    const selectMock = vi.fn();
    const eqOrgMock = vi.fn();

    // Chain for Overdue
    const overdueChain = {
      lt: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [] }),
        })),
      })),
    };

    // Chain for Today
    const todayChain = {
      eq: vi.fn(() => ({
        neq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [] }),
        })),
      })),
    };

    // Chain for Upcoming
    const upcomingChain = {
      gt: vi.fn(() => ({
        lte: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [] }),
          })),
        })),
      })),
    };

    // Chain for Week Items (The one we care about)
    const weekChain = {
      gte: vi.fn(() => ({
        lte: vi.fn().mockResolvedValue({ data: weekItems }),
      })),
    };

    // Router for chains based on call order or args?
    // Since the code calls them in sequence, we can mock the return values of the chain.
    // But Supabase chaining is tricky to mock perfectly with simple objects.
    // Let's use a simpler approach: Mock the final promise resolution based on the query structure.

    // Actually, let's just mock the implementation of the chain to return specific data based on the 'select' or 'eq' args.
    // But that's hard.
    // Let's look at how I mocked it in the initial block.

    // Let's refine the mock structure to be more robust.
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockLt = vi.fn().mockReturnThis();
    const mockGt = vi.fn().mockReturnThis();
    const mockLte = vi.fn().mockReturnThis();
    const mockGte = vi.fn().mockReturnThis();
    const mockNeq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    // We need to return different data for the 4th call to 'from'.
    // But 'from' is called 4 times.

    const fromMock = vi.fn();
    mockSupabase.from = fromMock;

    // Create distinct mocks for each chain to avoid side effects
    const mockLteUpcoming = vi.fn().mockReturnThis();
    const mockLteWeek = vi.fn().mockResolvedValue({ data: weekItems });

    // Mock 1: Overdue
    fromMock.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      lt: mockLt,
      order: mockOrder.mockResolvedValue({ data: [] }),
    } as any);

    // Mock 2: Today
    fromMock.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      neq: mockNeq,
      order: mockOrder.mockResolvedValue({ data: [] }),
    } as any);

    // Mock 3: Upcoming
    fromMock.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      gt: mockGt,
      lte: mockLteUpcoming, // Use distinct mock
      order: mockOrder.mockResolvedValue({ data: [] }),
    } as any);

    // Mock 4: Week Items
    fromMock.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      lte: mockLteWeek, // Use distinct mock that returns data
    } as any);

    const result = await BriefingService.getBriefing(mockSupabase, "org-123");

    expect(result.scoreAnalysis).toBeDefined();
    expect(result.scoreAnalysis?.score).toBe(50); // 1 done, 1 pending = 50%
    expect(result.scoreAnalysis?.status).toBe("at-risk");
    expect(result.scoreAnalysis?.recoveryPath).toHaveLength(1); // Should suggest Task 2
    expect(result.scoreAnalysis?.recoveryPath[0].title).toBe("Task 2");
  });
});
