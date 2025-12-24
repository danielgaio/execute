import { ScorableItem, calculateLeadScore } from "../domain/scoring";

export interface AnalysisItem extends ScorableItem {
  title: string;
  goal_title?: string;
  due_date?: string;
}

export interface ScoreAnalysis {
  score: number;
  totalWeight: number;
  completedWeight: number;
  status: "excellent" | "good" | "at-risk" | "critical";
  detractors: AnalysisItem[]; // Items hurting the score the most (high weight, not done)
  topContributors: AnalysisItem[]; // Items helping the score (high weight, done)
  recoveryPath: AnalysisItem[]; // Suggested items to complete to reach next threshold
  maxPossibleScore: number; // If all pending were done
}

export class ScoreAnalyst {
  /**
   * Analyze a set of tactic instances to provide insights into the score.
   */
  static analyze(items: AnalysisItem[]): ScoreAnalysis {
    const plannedItems = items.filter((i) => i.planned);
    const score = calculateLeadScore(plannedItems);

    // Calculate weights
    let totalWeight = 0;
    let completedWeight = 0;
    let pendingWeight = 0;

    plannedItems.forEach((i) => {
      const w = i.weight > 0 ? i.weight : 1.0;
      totalWeight += w;
      if (i.status === "done") {
        completedWeight += w;
      } else if (i.status === "pending") {
        pendingWeight += w;
      }
    });

    // Determine Status
    let status: ScoreAnalysis["status"] = "critical";
    if (score >= 85) status = "excellent";
    else if (score >= 70) status = "good";
    else if (score >= 50) status = "at-risk";

    // Identify Detractors (Missed/Pending High Weight)
    const detractors = plannedItems
      .filter((i) => i.status !== "done")
      .sort((a, b) => (b.weight || 1) - (a.weight || 1))
      .slice(0, 5);

    // Identify Contributors
    const topContributors = plannedItems
      .filter((i) => i.status === "done")
      .sort((a, b) => (b.weight || 1) - (a.weight || 1))
      .slice(0, 5);

    // Calculate Max Possible Score
    const maxPossibleScore =
      totalWeight > 0
        ? Math.round(((completedWeight + pendingWeight) / totalWeight) * 100)
        : 100;

    // Calculate Recovery Path (Greedy approach: biggest weights first)
    const recoveryPath: AnalysisItem[] = [];
    if (score < 85 && maxPossibleScore >= 85) {
      let currentWeight = completedWeight;
      const targetWeight = 0.85 * totalWeight;

      const pendingSorted = plannedItems
        .filter((i) => i.status === "pending")
        .sort((a, b) => (b.weight || 1) - (a.weight || 1));

      for (const item of pendingSorted) {
        if (currentWeight >= targetWeight) break;
        recoveryPath.push(item);
        currentWeight += item.weight || 1;
      }
    }

    return {
      score,
      totalWeight,
      completedWeight,
      status,
      detractors,
      topContributors,
      recoveryPath,
      maxPossibleScore,
    };
  }

  /**
   * Generate a natural language summary of the analysis.
   */
  static generateSummary(analysis: ScoreAnalysis): string {
    const { score, status, detractors, recoveryPath, maxPossibleScore } =
      analysis;

    let summary = `Current Score: ${score}% (${status.toUpperCase()}).`;

    if (status === "excellent") {
      summary += " You are crushing it! Keep up the momentum.";
    } else if (detractors.length > 0) {
      const topDetractor = detractors[0];
      summary += ` The biggest drag on your score is "${topDetractor.title}" (Weight: ${topDetractor.weight}).`;
    }

    if (recoveryPath.length > 0) {
      summary += ` To reach 85%, focus on: ${recoveryPath
        .map((i) => i.title)
        .join(", ")}.`;
    } else if (score < 85) {
      summary += ` Even if you complete everything left, the max possible score is ${maxPossibleScore}%.`;
    }

    return summary;
  }
}
