"use client";

import Link from "next/link";
import { HeroKpi } from "./HeroKpi";
import { InfoHint } from "@/components/InfoHint";
import { PRODUCT_SUBTITLE } from "@/lib/product";

type ScorePair = { score: number; label: string };

type Props = {
  fundamental: ScorePair;
  dataHealth: ScorePair;
  triggeredCount: number;
  warningCount: number;
};

export function DashboardHero({
  fundamental,
  dataHealth,
  triggeredCount,
  warningCount,
}: Props) {
  return (
    <section className="surface">
      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-6">
        <div className="max-w-xl">
          <p className="text-eyebrow">LONG-ETH THESIS MONITOR</p>
          <h1 className="mt-3 font-display text-[32px] leading-[0.98] text-ink sm:text-[44px]">
            ETH ADOPTION TRACKER
          </h1>
          <div className="rule mt-4 max-w-[160px]" />
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{PRODUCT_SUBTITLE}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/triggers" className="btn">
              triggers →
            </Link>
            <Link href="/methodology" className="btn">
              method
            </Link>
            <span className="inline-flex items-center gap-1">
              <a href="/api/export" download className="btn">
                export
              </a>
              <InfoHint
                label="Export API note"
                hint="Local: works without token. Production on Vercel requires EXPORT_API_TOKEN."
              />
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:max-w-md">
          <HeroKpi
            label="FUNDAMENTALS"
            value={String(fundamental.score).padStart(3, "0")}
            sub={fundamental.label}
          />
          <HeroKpi
            label="DATA"
            value={String(dataHealth.score).padStart(3, "0")}
            sub={dataHealth.label}
          />
          <HeroKpi
            label="TRIGGERS"
            value={
              triggeredCount > 0
                ? String(triggeredCount).padStart(2, "0")
                : warningCount > 0
                  ? String(warningCount).padStart(2, "0")
                  : "00"
            }
            sub={
              triggeredCount > 0
                ? "tripped"
                : warningCount > 0
                  ? "warning"
                  : "clear"
            }
            tone={triggeredCount > 0 ? "signal" : "ink"}
          />
        </div>
      </div>
    </section>
  );
}
