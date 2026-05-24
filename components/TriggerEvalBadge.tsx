import {
  EVAL_MODE_LABEL,
  getTriggerEvalMeta,
  type TriggerEvalMode,
} from "@/lib/triggers/meta";

const MODE_STYLE: Record<
  TriggerEvalMode,
  { border: string; color: string }
> = {
  auto: { border: "var(--faint)", color: "var(--muted)" },
  partial: { border: "var(--watch)", color: "var(--watch)" },
  manual: { border: "var(--line-bright)", color: "var(--ink-soft)" },
  blocked: { border: "var(--signal)", color: "var(--signal)" },
};

export function TriggerEvalBadge({
  triggerName,
  showHint = false,
}: {
  triggerName: string;
  showHint?: boolean;
}) {
  const meta = getTriggerEvalMeta(triggerName);
  const style = MODE_STYLE[meta.mode];
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className="inline-block border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ borderColor: style.border, color: style.color }}
      >
        {EVAL_MODE_LABEL[meta.mode]}
      </span>
      {showHint && meta.hint ? (
        <span className="text-[10px] leading-snug text-dim">{meta.hint}</span>
      ) : null}
    </span>
  );
}
