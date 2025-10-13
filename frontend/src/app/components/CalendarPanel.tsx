"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReservations } from "@/hooks/useReservations";
import type { Reservation, Slot } from "@/types/reservation";
import CreateReservationModal from "@/components/CreateReservationModal";
import { motion, AnimatePresence } from "framer-motion";
import ChatIcon from "@/components/ChatIcon";
import {
  toDateStr,
  isWeekendStr,
  formatMonthJP,          
} from "@/lib/dateUtils";

import { buildMonthCells } from "@/lib/calendarUtils";
// ============================================
// Next.js (App Router) page.tsx — api.phpに合わせた同期版 + カレンダー表示 + モーダル新規作成
// ※ UIを「見学（tour）専用」に整理。体験（experience）関連UIは撤去。
// ============================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://muu-reservation-tour.onrender.com/api";

// === 共通タイプ（reduce 用）: am/pm のみ ===
type SlotCounts = { am: number; pm: number };

/** Slot が 'am' | 'pm' かを絞り込む */
function isAmPm(x: unknown): x is "am" | "pm" {
  return x === "am" || x === "pm";
}

/** Status が 'cancelled' かを絞り込む（型不一致を回避） */
function isCancelled(x: unknown): x is "cancelled" {
  return x === "cancelled";
}

export default function CalendarPanel() {
 // ===== State
const {
  allItems,
  loading,
  error,
  success,
  filter,
  setFilter,
  fetchReservations,
  fetchAllReservations,
  createReservation,
  isBookable,
  getSafeCreateDate,
} = useReservations();

  // モバイルの半月タブ（前半=1–14 / 後半=15–末）
  type Half = "first" | "second";
  const [mobileHalf, setMobileHalf] = useState<Half>("first");

  // フリック関連：横だけ生かす
  const SWIPE = { minX: 48, ratio: 1.5 };

  // 表示窓：前半 1〜14日（14日分）、後半 15日〜月末（残り全部）
  const MOBILE_WINDOW_DAYS = 14;

   // カレンダー: 表示中の月（1日固定）
  const [calCursor, setCalCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const monthCells = useMemo(
    () => buildMonthCells(calCursor, true),
    [calCursor]
  );
  const monthKey = useMemo(() => toDateStr(calCursor).slice(0, 7), [calCursor]); // YYYY-MM

  // 予約作成モーダル
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [createSlot, setCreateSlot] = useState<Slot | undefined>(undefined);

function openCreate(dateStr?: string, slot?: Slot) {
  const safe = getSafeCreateDate(dateStr);
  if (!isBookable(safe)) {
    alert("本日以前や土日・停止日には予約を追加できません。");
    return;
  }
  setCreateDate(safe);
  setCreateSlot(slot);
  setIsCreateOpen(true);
}

  // 月境界ユーティリティ
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const daysInMonth = (d: Date) => endOfMonth(d).getDate();
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const addMonths = (d: Date, n: number) =>
    new Date(d.getFullYear(), d.getMonth() + n, 1);

  // モバイル用：期間アンカー（1日 or 15日固定） & 横フリック検出
  const [mobileAnchor, setMobileAnchor] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const mobileListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileAnchor(startOfMonth(new Date(calCursor)));
  }, [calCursor]);
  useEffect(() => {
    const first = startOfMonth(calCursor);
    const day = mobileHalf === "first" ? 1 : 15;
    setMobileAnchor(new Date(first.getFullYear(), first.getMonth(), day));
  }, [calCursor, mobileHalf]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const ax = Math.abs(dx),
      ay = Math.abs(dy);
    const isHorizontal = ax > ay * SWIPE.ratio;
    const passX = ax >= SWIPE.minX;
    if (isHorizontal && passX)
      setCalCursor((d) => addMonths(d, dx > 0 ? +1 : -1));
    setTouchStart(null);
  };



useEffect(() => {
  fetchAllReservations(); // ← hook から取得した関数
}, [monthKey, fetchAllReservations]);

  // filter 変更で一覧再取得
  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.date, filter.slot]);

  // ===== カレンダー用: 当月の予約を日付ごとに集計（tour のみ / cancelled は除外）
  const dayMap = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    (allItems ?? []).forEach((r) => {
      if (r.program !== "tour") return;
      if (isCancelled(r.status)) return; // 👈 キャンセルは描画対象から除外
      const ds = toDateStr(r.date);
      if (ds.startsWith(monthKey)) (map[ds] ||= []).push(r);
    });
    return map;
  }, [allItems, monthKey]);

  // ===== UI
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-semibold">予約カレンダー</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReservations}
              className="px-4 py-2 rounded-2xl shadow bg-white hover:bg-gray-100 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "更新中…" : "更新"}
            </button>
            <button
              onClick={() => openCreate()}
              className="px-4 py-2 rounded-2xl shadow bg-black text-white hover:opacity-90"
            >
              ＋ 新規予約
            </button>
          </div>
        </header>

        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {success}
              </div>
            )}
          </div>
        )}

        {/* ===== カレンダー表示 ===== */}
        <section className="rounded-2xl bg-white shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  setCalCursor(
                    (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                  )
                }
                aria-label="前の月"
              >
                ←
              </button>
              <span className="min-w-[10ch] text-center text-sm text-gray-700">
                {formatMonthJP(calCursor)}
              </span>
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  setCalCursor(
                    (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                  )
                }
                aria-label="次の月"
              >
                →
              </button>
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() => {
                  const t = new Date();
                  t.setDate(1);
                  setCalCursor(t);
                }}
              >
                今月
              </button>
            </div>
          </div>

          {/* 曜日ヘッダー — PC/タブレットのみ */}
          <div className="hidden md:grid grid-cols-7 text-xs text-gray-500">
            {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
              <div key={w} className="p-2 text-center font-medium">
                {w}
              </div>
            ))}
          </div>

          {/* 月グリッド — PC/タブレットのみ */}
          <AnimatePresence mode="wait">
            <motion.div
              key={formatMonthJP(calCursor)}
              className="hidden md:grid grid-cols-7 gap-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {monthCells.map((cell, i) => {
                const dayItems = dayMap[cell.dateStr] ?? [];
                const counts = dayItems.reduce<SlotCounts>(
                  (acc, r) => {
                    if (isAmPm(r.slot)) acc[r.slot] = acc[r.slot] + 1;
                    return acc;
                  },
                  { am: 0, pm: 0 }
                );
                const total = dayItems.length;
                const isToday = cell.dateStr === toDateStr(new Date());
                const isWeekendCell = isWeekendStr(cell.dateStr);
                const canBook = isBookable(cell.dateStr);

                const onCellClick = () => {
                  if (canBook) {
                    openCreate(cell.dateStr);
                  } else {
                    setFilter((f) => ({ ...f, date: cell.dateStr }));
                    alert(
                      isWeekendCell
                        ? "土日は休業日のため予約できません。"
                        : "本日以前・停止日は予約できません。"
                    );
                  }
                };

                return (
                  // 親は div（button を内包してもOK）にして「button入れ子」エラーを回避
                  <motion.div
                    key={cell.dateStr}
                    role="button"
                    tabIndex={0}
                    onClick={onCellClick}
                    className={[
                      "relative h-24 rounded-xl border p-2 text-left transition",
                      cell.inMonth ? "bg-white" : "bg-gray-50",
                      isToday ? "ring-2 ring-blue-500" : "hover:shadow-sm",
                    ].join(" ")}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: Math.min(i * 0.0025, 0.12),
                    }}
                    title={`${cell.dateStr}の操作`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          "text-sm " +
                          (cell.inMonth ? "text-gray-900" : "text-gray-400")
                        }
                      >
                        {cell.day}
                      </span>
                      {total > 0 && (
                        <span className="text-[11px] rounded-full px-2 py-0.5 border bg-gray-50">
                          {total}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {counts.am > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md border">
                          AM×{counts.am}
                        </span>
                      )}
                      {counts.pm > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md border">
                          PM×{counts.pm}
                        </span>
                      )}
                    </div>

                    {dayItems[0] && (
                      <div
                        className="mt-1 text-[11px] text-gray-500 truncate"
                        aria-hidden
                      >
                        {(dayItems[0].last_name ?? "") +
                          (dayItems[0].first_name
                            ? ` ${dayItems[0].first_name}`
                            : "")}
                        {dayItems.length > 1
                          ? ` 他${dayItems.length - 1}件`
                          : ""}
                      </div>
                    )}

                    {/* 右下バッジ（固定配置） */}
                    {isWeekendCell ? (
                      <span
                        className="pointer-events-none absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-gray-400 bg-gray-50"
                        aria-hidden
                      >
                        休
                      </span>
                    ) : canBook ? (
                      <button
                        type="button"
                        className="absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs bg-white hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(cell.dateStr);
                        }}
                        aria-label={`${cell.dateStr} に予約を追加`}
                        title="この日に予約を追加"
                      >
                        ＋
                      </button>
                    ) : (
                      <span
                        className="pointer-events-none absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-gray-400 bg-gray-50"
                        aria-hidden
                      >
                        停
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* ▼ モバイル用アジェンダ表示（スマホのみ, 半月ビュー＋横フリックで月移動） */}
          <div
            className="md:hidden -mx-2"
            ref={mobileListRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm text-gray-600">
                {new Date(calCursor).getFullYear()}年{" "}
                {new Date(calCursor).getMonth() + 1}月・モバイル表示
              </span>
              <span className="text-[11px] text-gray-400">
                横:月移動 ／ タブ:前半・後半
              </span>
            </div>
            {/* ▼ モバイル前半／後半トグル */}
            <div className="flex justify-center gap-2 mb-3">
              <button
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  mobileHalf === "first"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setMobileHalf("first")}
              >
                前半（1〜14日）
              </button>
              <button
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  mobileHalf === "second"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setMobileHalf("second")}
              >
                後半（15日〜末）
              </button>
            </div>

            {(() => {
              const first = startOfMonth(calCursor);
              const dim = daysInMonth(calCursor);
              const anchorDay = mobileAnchor.getDate();
              const length = anchorDay <= 14 ? MOBILE_WINDOW_DAYS : dim - 14;
              const windowCells = Array.from({ length }, (_, i) => {
                const d = addDays(
                  new Date(first.getFullYear(), first.getMonth(), anchorDay),
                  i
                );
                const dateStr = toDateStr(d);
                return { dateStr, day: d.getDate(), dow: d.getDay() };
              });

              return (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden bg-white">
                  {windowCells.map((cell) => {
                    const dayItems = dayMap[cell.dateStr] ?? [];
                    const counts = dayItems.reduce<SlotCounts>(
                      (acc, r) => {
                        if (isAmPm(r.slot)) acc[r.slot] = acc[r.slot] + 1;
                        return acc;
                      },
                      { am: 0, pm: 0 }
                    );
                    const total = dayItems.length;
                    const isToday = cell.dateStr === toDateStr(new Date());
                    const isWeekendCell = isWeekendStr(cell.dateStr);
                    const w = ["日", "月", "火", "水", "木", "金", "土"][
                      cell.dow
                    ];

                    return (
                      <li key={cell.dateStr}>
                        <div
                          className="relative flex items-center gap-3 px-3 py-2 active:bg-gray-50"
                          onClick={() =>
                            setFilter((f) => ({ ...f, date: cell.dateStr }))
                          }
                          role="button"
                          tabIndex={0}
                          title={`${cell.dateStr}の予約を一覧で表示`}
                        >
                          {/* 日付バッジ */}
                          <div className="w-14 shrink-0 text-center">
                            <div
                              className={
                                "text-base leading-5 " +
                                (isToday
                                  ? "font-semibold text-blue-600"
                                  : "text-gray-900")
                              }
                            >
                              {cell.day}
                            </div>
                            <div
                              className={
                                "text-[10px] " +
                                (isWeekendCell
                                  ? "text-red-500"
                                  : "text-gray-500")
                              }
                            >
                              {w}
                            </div>
                          </div>

                          {/* 件数 / 先頭氏名 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {total > 0 && (
                                <span className="text-[11px] rounded-full px-2 py-0.5 border bg-gray-50">
                                  {total}件
                                </span>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {counts.am > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md border">
                                    AM×{counts.am}
                                  </span>
                                )}
                                {counts.pm > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md border">
                                    PM×{counts.pm}
                                  </span>
                                )}
                              </div>
                            </div>
                            {dayItems[0] && (
                              <div
                                className="mt-0.5 text-[11px] text-gray-500 truncate"
                                aria-hidden
                              >
                                {(dayItems[0].last_name ?? "") +
                                  (dayItems[0].first_name
                                    ? ` ${dayItems[0].first_name}`
                                    : "")}
                                {dayItems.length > 1
                                  ? ` 他${dayItems.length - 1}件`
                                  : ""}
                              </div>
                            )}
                          </div>

                          {/* 右端：＋ / 休 / 停 */}
                          {isWeekendCell ? (
                            <div
                              className="absolute right-3 bottom-2 h-8 w-8 shrink-0 rounded-full border text-xs leading-8 text-center text-gray-400 bg-gray-50"
                              aria-hidden
                            >
                              休
                            </div>
                          ) : isBookable(cell.dateStr) ? (
                            <button
                              type="button"
                              className="absolute right-3 bottom-2 h-8 w-8 shrink-0 rounded-full border text-base leading-8 text-center bg-white hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreate(cell.dateStr);
                              }}
                              aria-label={`${cell.dateStr} に予約を追加`}
                              title="この日に予約を追加"
                            >
                              ＋
                            </button>
                          ) : (
                            <div
                              className="absolute right-3 bottom-2 h-8 w-8 shrink-0 rounded-full border text-xs leading-8 text-center text-gray-400 bg-gray-50"
                              aria-hidden
                            >
                              停
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}

            <p className="mt-2 text-xs text-gray-500">
              横フリック＝月移動／タブで「前半・後半」を切り替え。日付タップで一覧に反映。
            </p>
          </div>

          <p className="text-xs text-gray-500">
            日付タップで一覧に反映。右下「＋」でその日に新規作成。
          </p>
        </section>

        <footer className="text-xs text-gray-500 pt-4">
          API: <code>{API_BASE}</code>
        </footer>
      </div>

      {/* 予約作成モーダル */}
      <CreateReservationModal
        open={isCreateOpen}
        initialDate={createDate}
        initialSlot={createSlot}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createReservation}
      />
      <ChatIcon />
    </div>
  );
}
