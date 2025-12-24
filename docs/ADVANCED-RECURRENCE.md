# Advanced Recurrence Logic

## Overview
Implemented advanced recurrence logic in the Tactic Instance Generation Engine (`src/lib/domain/planning.ts`). This ensures that tactics with custom schedules (e.g., "every 2 weeks", "daily including weekends") are generated correctly.

## Changes

### `src/lib/domain/planning.ts`
- Updated `Tactic` interface to include `recurrence_interval` and `created_at`.
- Enhanced `generateInstancesForTactic`:
  - **Interval Support**: Calculates weeks since creation to determine if instances should be generated for the current week (modulo arithmetic).
  - **Custom Recurrence**: Treated as `weekly` with interval support.
  - **Flexible Daily**: Now respects `due_days` if provided (e.g., for weekends), defaulting to Mon-Fri if not.

### `src/lib/domain/planning.test.ts`
- Added tests for:
  - Daily recurrence with custom days (Sat/Sun).
  - Bi-weekly recurrence (verifying generation on matching week and skipping on off week).

## Value
- **Correctness**: Fixes the gap where "every 2 weeks" was ignored.
- **Flexibility**: Supports any recurrence pattern the agent can define.
- **Reliability**: Ensures the weekly plan generation (Cron) produces the expected output.

## Verification
- Ran `npx vitest run planning` - All tests passed.
