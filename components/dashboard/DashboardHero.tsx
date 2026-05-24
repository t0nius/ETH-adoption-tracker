import Link from "next/link";
import { HeroKpi } from "./HeroKpi";

type Props = {
  regimeScore: number;
  regimeLabel: string;
  okCount: number;
  totalMetrics: number;
  avgQuality: number;
  triggeredCount: number;
  warningCount: number;
};

export function DashboardHero({
  regimeScore,
  regimeLabel,
  okCount,
  totalMetrics,
  avgQuality,
  triggeredCount,
  warningCount,
}: Props) {
  return (
    <section className="surface">
      <div className="flex flex-col gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-eyebrow">LONG-ETH THESIS MONITOR</p>
          <h1 className="mt-4 font-display text-[44px] leading-[0.98] text-ink sm:text-[58px]">
            ETH ADOPTION
            <br />
            TRACKER
          </h1>
          <div className="rule mt-5 max-w-[200px]" />
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">
            11 fundamentals · 11 invalidation triggers · daily evaluation.
            Designed to tell you{" "}
            <span className="text-ink">when to stop being long ETH</span>, not when
            to enter.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/triggers" className="btn">
              trigger radar →
            </Link>
            <a href="/api/export" download className="btn">
              export json
            </a>
            <Link href="/methodology" className="btn">
              methodology
            </Link>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md">
          <HeroKpi
            label="REGIME"
            value={String(regimeScore).padStart(3, "0")}
            sub={regimeLabel}
          />
          <HeroKpi
            label="COVERAGE"
            value={`${okCount}/${totalMetrics}`}
            sub="live metrics"
          />
          <HeroKpi
            label="QUALITY"
            value={`${avgQuality.toFixed(0)}`}
            sub="avg / 100"
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
                  : "all clear"
            }
            tone={triggeredCount > 0 ? "signal" : "ink"}
          />
        </div>
      </div>
    </section>
  );
}
