
export interface Goal {
  id: string;
  title: string;
  unit: string;
  baseline: number;
  target: number;
  current_value: number | null;
  start_date: string; // Cycle start date
  target_date: string; // Cycle end date or specific goal date
}

export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'completed' | 'not_started';

/**
 * Calculates the percentage of progress towards the target.
 * Handles both increasing (Revenue: 0 -> 100) and decreasing (Weight: 100 -> 80) targets.
 */
export function calculateGoalProgress(goal: Goal): number {
  const current = goal.current_value ?? goal.baseline;
  const totalChange = goal.target - goal.baseline;
  
  if (totalChange === 0) return 100; // Target equals baseline, already done?

  const currentChange = current - goal.baseline;
  const progress = (currentChange / totalChange) * 100;

  return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Determines the status of a goal based on expected vs actual progress.
 * @param goal The goal object
 * @param cycleProgress Percentage of time elapsed in the cycle (0-100)
 */
export function determineGoalStatus(goal: Goal, cycleProgress: number): GoalStatus {
  const actualProgress = calculateGoalProgress(goal);
  
  if (actualProgress >= 100) return 'completed';
  if (cycleProgress === 0) return 'not_started';

  // Tolerance thresholds
  // If we are 50% through time, we expect roughly 50% progress.
  // Allow 10% buffer for 'on_track', 20% for 'at_risk'.
  
  const deviation = cycleProgress - actualProgress;

  if (deviation <= 10) return 'on_track'; // Ahead or less than 10% behind
  if (deviation <= 25) return 'at_risk';  // 10-25% behind
  return 'off_track';                     // >25% behind
}
