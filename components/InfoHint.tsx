"use client";

export function InfoHint({
  text,
  hint,
  label,
}: {
  text?: string;
  hint?: string;
  label?: string;
}) {
  const title = text ?? hint ?? label ?? "";
  return (
    <span
      title={title}
      aria-label={label}
      className="ml-1 inline-flex h-3 w-3 select-none items-center justify-center border border-[color:var(--line)] text-[8px] font-mono leading-none text-muted hover:border-[color:var(--line-bright)] hover:text-ink-soft"
    >
      ?
    </span>
  );
}
