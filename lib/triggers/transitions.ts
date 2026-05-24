import type { TriggerEval } from "./types";

/**
 * Pure transition detection. Given the previously persisted statuses
 * (Map of trigger_name → status string) and the newly computed evaluations,
 * returns the subset that just transitioned **into** the "triggered" state.
 *
 * - Skipped: triggers that were already "triggered" (avoid re-alert spam)
 * - Skipped: triggers that didn't reach "triggered" (only fire on the worst state)
 */
export function findNewlyTriggered(
  oldStatusByName: Map<string, string>,
  newEvals: TriggerEval[],
): TriggerEval[] {
  return newEvals.filter((e) => {
    const oldStatus = oldStatusByName.get(e.trigger_name);
    return e.status === "triggered" && oldStatus !== "triggered";
  });
}
