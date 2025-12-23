/**
 * Domain logic for calculating execution scores.
 * Pure functions only.
 */

export interface ScorableItem {
  id: string;
  status: string; // 'done' | 'pending' | 'skipped' | 'deferred'
  weight: number;
  planned: boolean;
}

/**
 * Calculates the Weekly Lead Score based on completed vs planned weighted tactics.
 * Formula: (sum of completed planned instances × weight) / (sum of planned instances × weight) × 100%
 * 
 * Rules:
 * - Only counts items where planned=true
 * - Edge case: No planned instances = 100% score (avoid penalizing non-planning weeks)
 * - Completed status is 'done'
 * 
 * @param items List of tactic instances
 * @returns Integer score between 0 and 100
 */
export function calculateLeadScore(items: ScorableItem[]): number {
  const plannedItems = items.filter(i => i.planned);

  if (plannedItems.length === 0) {
    return 100;
  }

  let totalWeight = 0;
  let completedWeight = 0;

  for (const item of plannedItems) {
    // Ensure weight is valid, default to 1.0 if missing or invalid
    const weight = item.weight > 0 ? item.weight : 1.0;
    
    totalWeight += weight;

    if (item.status === 'done') {
      completedWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return 100;
  }

  return Math.round((completedWeight / totalWeight) * 100);
}

/**
 * Analyzes the performance and returns a qualitative status.
 * @param score Lead score (0-100)
 * @returns 'Critical' | 'At Risk' | 'On Track' | 'Excellent'
 */
export function getPerformanceStatus(score: number): 'Critical' | 'At Risk' | 'On Track' | 'Excellent' {
  if (score < 60) return 'Critical';
  if (score < 85) return 'At Risk';
  if (score < 95) return 'On Track';
  return 'Excellent';
}
