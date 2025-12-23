import { describe, it, expect } from "vitest";
import { calculateLeadScore, getPerformanceStatus, ScorableItem } from "./scoring";

describe("Scoring Domain Logic", () => {
  describe("calculateLeadScore", () => {
    it("should return 100% if no items are planned", () => {
      const items: ScorableItem[] = [];
      expect(calculateLeadScore(items)).toBe(100);
    });

    it("should return 100% if all planned items are done", () => {
      const items: ScorableItem[] = [
        { id: "1", status: "done", weight: 1.0, planned: true },
        { id: "2", status: "done", weight: 1.0, planned: true },
      ];
      expect(calculateLeadScore(items)).toBe(100);
    });

    it("should return 0% if no planned items are done", () => {
      const items: ScorableItem[] = [
        { id: "1", status: "pending", weight: 1.0, planned: true },
        { id: "2", status: "skipped", weight: 1.0, planned: true },
      ];
      expect(calculateLeadScore(items)).toBe(0);
    });

    it("should calculate weighted score correctly", () => {
      const items: ScorableItem[] = [
        { id: "1", status: "done", weight: 2.0, planned: true },   // 2.0 points
        { id: "2", status: "pending", weight: 1.0, planned: true }, // 0.0 points
        { id: "3", status: "done", weight: 1.0, planned: true },    // 1.0 points
      ];
      // Total weight: 4.0. Completed weight: 3.0. Score: 75%
      expect(calculateLeadScore(items)).toBe(75);
    });

    it("should ignore unplanned items", () => {
      const items: ScorableItem[] = [
        { id: "1", status: "pending", weight: 1.0, planned: true },
        { id: "2", status: "done", weight: 5.0, planned: false }, // Should be ignored
      ];
      // Total weight: 1.0. Completed: 0. Score: 0%
      expect(calculateLeadScore(items)).toBe(0);
    });

    it("should handle default weights", () => {
      const items: ScorableItem[] = [
        { id: "1", status: "done", weight: 0, planned: true }, // Should default to 1.0
      ];
      expect(calculateLeadScore(items)).toBe(100);
    });
  });

  describe("getPerformanceStatus", () => {
    it("should return correct status for scores", () => {
      expect(getPerformanceStatus(50)).toBe("Critical");
      expect(getPerformanceStatus(70)).toBe("At Risk");
      expect(getPerformanceStatus(90)).toBe("On Track");
      expect(getPerformanceStatus(98)).toBe("Excellent");
    });
  });
});
