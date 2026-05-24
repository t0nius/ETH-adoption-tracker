export const TRIGGER_STATUS_ORDER: Record<string, number> = {
  triggered: 0,
  error: 1,
  warning: 2,
  partial: 3,
  insufficient_data: 4,
  needs_manual: 5,
  ok: 6,
};

export function sortTriggersByGravity<T extends { status: string; trigger_name: string }>(
  triggers: T[],
): T[] {
  return [...triggers].sort((a, b) => {
    const sa = TRIGGER_STATUS_ORDER[a.status] ?? 99;
    const sb = TRIGGER_STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.trigger_name.localeCompare(b.trigger_name);
  });
}
