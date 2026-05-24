export type Snapshot = {
  timestamp: number;
  value: number | null;
  status: "ok" | "stale";
};

export type ManualState = {
  is_triggered: boolean;
  note?: string;
  toggled_at: number;
} | null;

export type TriggerStatus =
  | "ok"
  | "warning"
  | "triggered"
  | "insufficient_data"
  | "needs_manual"
  | "partial"
  | "error";

export type TriggerEval = {
  trigger_name: string;
  tier: number;
  description: string;
  status: TriggerStatus;
  message: string;
  current_value: number | null;
  threshold_value: number | null;
  metadata?: Record<string, unknown>;
};
