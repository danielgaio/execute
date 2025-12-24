# WPR Enhancement: Team Breakdown

## Overview

Enhanced the Weekly Progress Review (WPR) tool to provide granular performance insights by team. This allows the agent to report not just the overall organization score, but also how each team is performing.

## Changes

### `src/lib/agent/tools/wpr-tools.ts`

- Updated `get_wpr_context` to fetch `teams` and `team_members`.
- Implemented logic to bucket tactic instances into teams:
  1. **Goal Ownership**: If the tactic's goal belongs to a team, assign to that team.
  2. **Assignee Membership**: If the assignee belongs to exactly one team, assign to that team.
  3. **Other**: Fallback to "Other / Cross-Functional".
- Added `teamBreakdown` to the return payload, containing:
  - Team Name
  - Lead Score (calculated per team)
  - Item Count
  - Performance Status

### `src/lib/agent/tools/wpr-tools.test.ts`

- Updated mocks to include `teams` and `team_members` data.
- Added assertions to verify `teamBreakdown` is correctly calculated and returned.
- Verified correct scoring for different teams (100% vs 0%).

## Value

This enables the agent to answer questions like:

- "Which team had the best execution this week?"
- "Is the Engineering team on track?"
- "Show me a breakdown of scores by team."

## Verification

- Ran `npx vitest run wpr-tools` - All tests passed.
