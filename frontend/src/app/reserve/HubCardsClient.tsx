"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export type HubCardsProps = {
  quickHref?: string;
  nextOpenLabel?: string | null;
  calendarHref?: string; // 例: "/"
};

export default function HubCardsClient({ quickHref, nextOpenLabel, calendarHref="/"}: HubCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 最短の開け日で予約 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="group rounded-2xl ring-1 ring-neutral-200 p-6 bg-white hover:shadow-md hover:ring-neutral-300 transition"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">最短の開け日で予約</h2>
            <p className="mt-1 text-sm text-neutral-600">最短の空き枠を自動で選択し、入力へ進みます。</p>
          </div>
          <span className="text-xs rounded-full px-2 py-1 ring-1 ring-neutral-300">推奨</span>
        </div>

        <div className="mt-4">
          {quickHref ? (
            <Link href={quickHref} className="inline-flex items-center rounded-xl px-4 py-2 ring-1 ring-neutral-300 hover:ring-neutral-400 transition">
              <span className="text-sm font-medium">最短で予約に進む</span>
              <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          ) : (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 ring-1 ring-amber-200">
              現在、最短候補を取得できませんでした。カレンダーからお選びください。
            </div>
          )}
        </div>

        {nextOpenLabel && (
          <p className="mt-3 text-xs text-neutral-500">候補: <span className="font-medium">{nextOpenLabel}</span></p>
        )}
      </motion.div>

      {/* カレンダーから選ぶ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
        className="group rounded-2xl ring-1 ring-neutral-200 p-6 bg-white hover:shadow-md hover:ring-neutral-300 transition"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">カレンダーから選ぶ</h2>
            <p className="mt-1 text-sm text-neutral-600">空き状況を見ながら、ご希望の日程を選択。</p>
          </div>
        </div>

        <div className="mt-4">
          <Link href={calendarHref} className="inline-flex items-center rounded-xl px-4 py-2 ring-1 ring-neutral-300 hover:ring-neutral-400 transition">
            <span className="text-sm font-medium">カレンダーを表示</span>
            <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
