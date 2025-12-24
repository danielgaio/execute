import { describe, it, expect } from "vitest";
import { ScoreAnalyst, type AnalysisItem } from "./score-analyst";

describe("ScoreAnalyst", () => {
  const mockItem = (
    id: string,
    status: string,
    weight: number,
    planned: boolean = true
  ): AnalysisItem => ({
    id,
    title: `Task ${id}`,
    status,
    weight,
    planned,
  });

  it("should calculate score correctly", () => {
    const items = [mockItem("1", "done", 1.0), mockItem("2", "pending", 1.0)];
    const analysis = ScoreAnalyst.analyze(items);
    expect(analysis.score).toBe(50);
    expect(analysis.status).toBe("at-risk");
  });

  it("should identify detractors (high weight pending)", () => {
    const items = [
      mockItem("1", "done", 0.1),
      mockItem("2", "pending", 1.0), // Big detractor
      mockItem("3", "pending", 0.1),
    ];
    const analysis = ScoreAnalyst.analyze(items);
    expect(analysis.detractors[0].id).toBe("2");
    expect(analysis.detractors.length).toBe(2);
  });

  it("should calculate max possible score", () => {
    const items = [
      mockItem("1", "done", 1.0), // 1.0
      mockItem("2", "pending", 1.0), // 1.0
      mockItem("3", "skipped", 1.0), // 1.0 (lost)
    ];
    // Total weight: 3.0. Completed: 1.0. Pending: 1.0.
    // Max Possible = (1 + 1) / 3 = 66%
    const analysis = ScoreAnalyst.analyze(items);
    expect(analysis.maxPossibleScore).toBe(67); // Rounding
  });

  it("should suggest recovery path", () => {
    const items = [
      mockItem("1", "done", 2.0), // 2.0
      mockItem("2", "pending", 5.0), // 5.0
      mockItem("3", "pending", 1.0), // 1.0
      mockItem("4", "pending", 1.0), // 1.0
    ];
    // Total: 9.0. Target (85%): 7.65.
    // Current: 2.0. Need 5.65 more.
    // Should suggest item 2 (5.0) + item 3 (1.0) -> 8.0 > 7.65

    const analysis = ScoreAnalyst.analyze(items);
    expect(analysis.recoveryPath.length).toBeGreaterThan(0);
    expect(analysis.recoveryPath[0].id).toBe("2"); // Biggest impact
  });

  it("should generate readable summary", () => {
    const items = [mockItem("1", "done", 1.0), mockItem("2", "pending", 1.0)];
    const analysis = ScoreAnalyst.analyze(items);
    const summary = ScoreAnalyst.generateSummary(analysis);

    expect(summary).toContain("Current Score: 50%");
    expect(summary).toContain("Task 2"); // Detractor mentioned
  });
});
