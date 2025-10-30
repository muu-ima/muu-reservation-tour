"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Rocket, ChevronRight } from "lucide-react";

export type HubCardsProps = {
  quickHref?: string;
  nextOpenLabel?: string | null;
  calendarHref?: string; // 例: "/"
};

/**
 * Polished Hub cards with glassy gradient borders, focus-visible rings,
 * motion variants, and dark-mode friendly colors. Props are backward compatible.
 */
export default function HubCardsClient({
  quickHref,
  nextOpenLabel,
  calendarHref = "/",
}: HubCardsProps) {
  const prefersReducedMotion = useReducedMotion();

  const cardVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: prefersReducedMotion ? 0 : 0.24 } },
  } as const;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 最短の開け日で予約 */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="show"
        className="group relative overflow-hidden rounded-2xl border border-neutral-200/70 bg-gradient-to-b from-white to-neutral-50 p-6 shadow-[0_4px_40px_-20px_rgba(0,0,0,0.25)] transition-all hover:shadow-[0_6px_60px_-22px_rgba(0,0,0,0.35)] dark:border-white/10 dark:from-white/5 dark:to-white/0"
      >
        {/* Glow border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-neutral-200/60 dark:ring-white/10" />
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" style={{
          background:
            "radial-gradient(600px 200px at 0% 0%, rgba(56,189,248,.20), transparent 60%), radial-gradient(600px 200px at 100% 100%, rgba(168,85,247,.16), transparent 60%)",
        }} />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/90 to-violet-600/90 text-white shadow-sm">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold tracking-tight">最短の開け日で予約</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          最短の空き枠を自動で選択し、入力へ進みます。
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {quickHref ? (
            <PrimaryLink href={quickHref} ariaLabel="最短で予約に進む">
              最短で予約に進む
            </PrimaryLink>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-sm dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-200">
              <span className="inline-block h-2 w-2 rounded-full bg-current opacity-70" />
              現在、最短候補を取得できませんでした。カレンダーからお選びください。
            </div>
          )}

          {nextOpenLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200/70 bg-white px-2.5 py-1.5 text-xs text-neutral-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-neutral-200">
              候補: <span className="font-medium text-neutral-900 dark:text-white">{nextOpenLabel}</span>
            </span>
          )}
        </div>
      </motion.div>

      {/* カレンダーから選ぶ */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="show"
        transition={{ delay: prefersReducedMotion ? 0 : 0.06 }}
        className="group relative overflow-hidden rounded-2xl border border-neutral-200/70 bg-gradient-to-b from-white to-neutral-50 p-6 shadow-[0_4px_40px_-20px_rgba(0,0,0,0.25)] transition-all hover:shadow-[0_6px_60px_-22px_rgba(0,0,0,0.35)] dark:border-white/10 dark:from-white/5 dark:to-white/0"
      >
        {/* Glow border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-neutral-200/60 dark:ring-white/10" />
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" style={{
          background:
            "radial-gradient(600px 200px at 0% 100%, rgba(16,185,129,.18), transparent 60%), radial-gradient(600px 200px at 100% 0%, rgba(59,130,246,.18), transparent 60%)",
        }} />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/95 to-sky-600/95 text-white shadow-sm">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold tracking-tight">カレンダーから選ぶ</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          空き状況を見ながら、ご希望の日程を選択。
        </p>

        <div className="mt-5">
          <SecondaryLink href={calendarHref} ariaLabel="カレンダーを表示">
            カレンダーを表示
          </SecondaryLink>
        </div>
      </motion.div>
    </div>
  );
}

function PrimaryLink({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-sky-700 transition focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {children}
      <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function SecondaryLink({ href, children, ariaLabel }: { href: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
    >
      {children}
      <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
