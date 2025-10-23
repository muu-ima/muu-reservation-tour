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
  startOfMonth,
  addDays,
  daysInMonth,
} from "@/lib/date";
import { buildMonthCells } from "@/lib/calendarUtils";
// ============================================
// Next.js (App Router) page.tsx — api.phpに合わせた同期版 + カレンダー表示 + モーダル新規作成
// ※ UIを「見学（tour）専用」に整理。体験（experience）関連UIは撤去。
// ============================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://muu-reservation-tour.onrender.com/api";

// === 追加: 午前/午後の状態を表す（statusベース） ===
type SlotState = "open" | "pending" | "booked";
type DaySlotState = { am: SlotState; pm: SlotState };

// 予約配列から am/pm の状態を要約（canceledは既に除外済み）
function summarizeSlots(items: Reservation[]): DaySlotState {
  const init: DaySlotState = { am: "open", pm: "open" };
  for (const r of items) {
    if (r.slot !== "am" && r.slot !== "pm") continue;
    const cur = init[r.slot];
    // 優先度: booked > pending > open
    if (r.status === "booked") init[r.slot] = "booked";
    else if (r.status === "pending" && cur !== "booked")
      init[r.slot] = "pending";
  }
  return init;
}

// どちらか埋まっていたら（pending含む）受付停止＝true
function isDayClosedBySlots(state: DaySlotState) {
  return state.am !== "open" || state.pm !== "open";
}

// 状態テキスト（セルの小さな説明行用）
function slotStateLabel(s: DaySlotState): string {
  const txt = (k: "am" | "pm") =>
    s[k] === "booked"
      ? k === "am"
        ? "午前 予約済"
        : "午後 予約済"
      : s[k] === "pending"
      ? k === "am"
        ? "午前 保留"
        : "午後 保留"
      : "";
  // 片方でも booked があれば「満席」
  if (s.am === "booked" || s.pm === "booked") return "満席";

  // どちらも open なら非表示（空文字）
  if (s.am === "open" && s.pm !== "open") return "";

  // booked は無いが pending がある場合
  if (s.am === "pending" || s.pm === "pending") {
    return [txt("am"), txt("pm")].filter(Boolean).join(" / ");
  }

  // それ以外
  return "";
}

// バッジの文言（右下「停」ホバー/タイトル向け）
function closeReason(s: DaySlotState): string {
  if (s.am === "booked" || s.am === "pending")
    return "午前が埋まっているため受付停止";
  if (s.pm === "booked" || s.pm === "pending")
    return "午後が埋まっているため受付停止";
  return "受付可";
}

const isCanceled = (s?: Reservation["status"]) => s === "canceled";

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

  // 次に予約可能な日付（今日の翌日から最大60日先まで）を返す
  function nextBookableDate(fromDateStr: string): string | null {
    const base = new Date(fromDateStr + "T00:00:00");
    for (let i = 1; i <= 60; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const s = toDateStr(d);
      if (!isWeekendStr(s) && isBookable(s)) return s;
    }
    return null;
  }

  const addMonths = (d: Date, n: number) =>
    new Date(d.getFullYear(), d.getMonth() + n, 1);

  // ==== 範囲制限: 今月~翌月のみ ====
  const TODAY_ANCHOR = startOfMonth(new Date());
  const MAX_MONTH = addMonths(TODAY_ANCHOR, 1);

  const clampToRange = (d: Date) => {
    const t = startOfMonth(d);
    if (t < TODAY_ANCHOR) return TODAY_ANCHOR;
    if (t > MAX_MONTH) return MAX_MONTH;
    return t;
  };

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

    if (isHorizontal && passX) {
      setCalCursor((d) => {
        const next = addMonths(d, dx > 0 ? +1 : -1);
        return clampToRange(next); // ← 範囲外なら今月/翌月に丸める
      });
    }
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
      if (isCanceled(r.status)) return; // 👈 キャンセルは描画対象から除外
      const ds = toDateStr(r.date);
      if (ds.startsWith(monthKey)) (map[ds] ||= []).push(r);
    });
    return map;
  }, [allItems, monthKey]);

  // ====== ナビ制御フラグ(今月⇔翌月のみ移動可) =====
  const canGoPrev = startOfMonth(calCursor) > TODAY_ANCHOR;
  const canGoNext = startOfMonth(calCursor) < MAX_MONTH;

  // ===== UI
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 md:p-8 p-2 font-sans">
      <div className="mx-auto w-full md:w-[90%] md:max-w-[1500px] px-2 md:px-0 space-y-6">
        <header className="sticky top-0 z-30 -mx-2 md:-mx-6 mb-4 px-3 md:px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 bg-white/90 dark:bg-black/30 border-b border-[var(--border)] flex items-center justify-between gap-2">
          {" "}
          <h1 className="text-xl md:text-3xl font-semibold tracking-tight">
            予約カレンダー
          </h1>
          <div className="flex items-center gap-1 md:gap-2 flex-nowrap whitespace-nowrap">
            <button
              onClick={fetchReservations}
              className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-xl bg-white ring-1 ring-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "更新中…" : "更新"}
            </button>
            <button
              onClick={() => {
                const today = toDateStr(new Date());
                const next = nextBookableDate(today);
                if (next) {
                  openCreate(next);
                } else {
                  alert("直近60日内に予約可能な日がありません。");
                }
              }}
              className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
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
        <section className="rounded-2xl md:rounded-3xl bg-white/95 shadow-lg ring-1 ring-neutral-200 md:p-8 space-y-2 transition hover:shadow-xl">
          {" "}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  setCalCursor((d) =>
                    clampToRange(new Date(d.getFullYear(), d.getMonth() - 1, 1))
                  )
                }
                aria-label="前の月"
                disabled={!canGoPrev}
              >
                ←
              </button>
              <span className="min-w-[10ch] text-center text-xl md:text-2xl font-semibold text-gray-800 tracking-wide">
                {formatMonthJP(calCursor)}
              </span>
              <button
                className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                onClick={() =>
                  setCalCursor((d) =>
                    clampToRange(new Date(d.getFullYear(), d.getMonth() + 1, 1))
                  )
                }
                aria-label="次の月"
                disabled={!canGoNext}
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
          <div className="hidden lg:grid grid-cols-7 text-sm text-gray-500">
            {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => {
              const style =
                i === 5
                  ? "bg-blue-50 text-blue-500"
                  : i === 6
                  ? "bg-red-50 text-red-500"
                  : "text-gray-700";
              return (
                <div
                  key={w}
                  className={`p-2 text-center font-semibold text-base ${style}`}
                >
                  {w}
                </div>
              );
            })}
          </div>
          {/* 月グリッド — PC/タブレットのみ */}
          <AnimatePresence mode="wait">
            <motion.div
              key={formatMonthJP(calCursor)}
              className="hidden lg:grid grid-cols-7 gap-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {monthCells.map((cell, i) => {
                const dayItems = dayMap[cell.dateStr] ?? [];
                const slotState = summarizeSlots(dayItems);
                const isToday = cell.dateStr === toDateStr(new Date());
                const isWeekendCell = isWeekendStr(cell.dateStr);

                // 月ルールチェック
                const today = new Date();
                const nextMonthStart = addMonths(startOfMonth(today), 1);

                const isCellNextMonth =
                  cell.y === nextMonthStart.getFullYear() &&
                  cell.m === nextMonthStart.getMonth();

                // 25日ルール（25日までは翌月を停止）
                const isLockedBy25Rule = isCellNextMonth && today.getDate() < 26;

                // 受付可否: 平日で isBookable かつ「どちらもopen」のときだけ true
                const accepting =
                  !isWeekendCell &&
                  isBookable(cell.dateStr) &&
                  !isDayClosedBySlots(slotState) &&
                  !isLockedBy25Rule;

                const onCellClick = () => {
                  if (isLockedBy25Rule) {
                    alert("翌月の予約は26日以降に解放されます。");
                    return;
                  }
                  if (accepting) {
                    openCreate(cell.dateStr);
                  } else {
                    setFilter((f) => ({ ...f, date: cell.dateStr }));
                    alert(
                      isWeekendCell
                        ? "土日は休業日のため予約できません。"
                        : isDayClosedBySlots(slotState)
                        ? closeReason(slotState)
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
                      "relative h-32 rounded-2xl bg-white/90 text-left p-3 transition",
                      "ring-1 ring-neutral-200 hover:ring-neutral-300 hover:shadow-md",
                      cell.inMonth ? "text-neutral-800" : "text-neutral-400",
                      isToday ? "bg-neutral-50 ring-2 ring-neutral-800" : "",
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
                          "text-lg font-semibold tracking-tight" +
                          (cell.inMonth ? "text-gray-900" : "text-gray-400")
                        }
                      >
                        {cell.day}
                      </span>
                    </div>

                    {/* ステータス（午前/午後の空き） */}
                    {/* ステータス（午前/午後の状態を強調表示） */}
                    <div className="flex-1 min-w-0 mt-1">
                      {(() => {
                        const label = slotStateLabel(slotState);
                        if (!label) return null; // 両openのときは非表示

                        const style =
                          label === "満席"
                            ? "text-[18px] font-semibold text-red-600"
                            : label.includes("保留")
                            ? "text-[18px] font-semibold text-amber-600"
                            : "text-[18px] text-neutral-600";

                        return (
                          <div className={`${style} truncate`} aria-hidden>
                            {label}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 右下バッジ（固定配置） */}
                    {isWeekendCell ? (
                      <span
                        className="pointer-events-none absolute right-1 bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-gray-400 bg-gray-50"
                        aria-hidden
                      >
                        休
                      </span>
                    ) : accepting ? (
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
                        title={isLockedBy25Rule ? "翌月の予定は25日まで停止中" : closeReason(slotState)}
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
            className="lg:hidden w-full max-w-none px-2"
            ref={mobileListRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex itemscenter justify-between px-2 pb-2">
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
                    const slotState = summarizeSlots(dayItems);
                    const isToday = cell.dateStr === toDateStr(new Date());
                    const isWeekendCell = isWeekendStr(cell.dateStr);

                                  // 月ルールチェック
                const today = new Date();
                const nextMonthStart = addMonths(startOfMonth(today), 1);

              　// このセルが 「本日から見た来月」か？ (dateStrから判定)
              const d = new Date(cell.dateStr);
              const isCellNextMonth =
              d.getFullYear() === nextMonthStart.getFullYear() &&
              d.getMonth() === nextMonthStart.getMonth();
                // 25日ルール（25日までは翌月を停止）
                const isLockedBy25Rule = isCellNextMonth && today.getDate() < 26;

                // 受付可否: 平日で isBookable かつ「どちらもopen」のときだけ true
                    const accepting =
                      !isWeekendCell &&
                      isBookable(cell.dateStr) &&
                      !isDayClosedBySlots(slotState) &&
                      !isLockedBy25Rule;
                    const w = ["日", "月", "火", "水", "木", "金", "土"][
                      cell.dow
                    ];

                    return (
                      <li key={cell.dateStr}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-disabled={!accepting}
                          title={
                            accepting
                              ? `${cell.dateStr} に予約を追加`
                              : `${cell.dateStr} の予約を一覧で表示`
                          }
                          onClick={() => {
                            if (isLockedBy25Rule) {
                              alert("翌月の予約は26日以降に解放されます。")
                            }
                            if (accepting) {
                              openCreate(cell.dateStr);
                            } else if (!isWeekendCell) {
                              setFilter((f) => ({ ...f, date: cell.dateStr }));
                              alert(
                                isDayClosedBySlots(slotState)
                                  ? closeReason(slotState)
                                  : "本日以前・停止日は予約できません。"
                              );
                            }
                          }}
                          className={
                            "relative flex items-center gap-3 px-3 py-3 transition " +
                            (accepting
                              ? "hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer"
                              : "bg-neutral-50 text-neutral-400 cursor-not-allowed")
                          }
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

                          {/* ステータス（午前/午後の空き） */}
                          {/* ステータス（午前/午後の状態を強調表示） */}
                          <div className="flex-1 min-w-0 mt-1">
                            {(() => {
                              const label = slotStateLabel(slotState);
                              if (!label) return null; // 両openのときは非表示

                              const style =
                                label === "満席"
                                  ? "text-[16px] font-semibold text-red-600"
                                  : label.includes("保留")
                                  ? "text-[16px] font-semibold text-amber-600"
                                  : "text-[12px] text-neutral-600";

                              return (
                                <div
                                  className={`${style} truncate`}
                                  aria-hidden
                                >
                                  {label}
                                </div>
                              );
                            })()}
                          </div>

                          {/* 右端：＋ / 休 / 停 */}
                          {isWeekendCell ? (
                            <div
                              className="absolute right-3 bottom-2 h-8 w-8 shrink-0 rounded-full border text-xs leading-8 text-center text-gray-400 bg-gray-50"
                              aria-hidden
                            >
                              休
                            </div>
                          ) : accepting ? (
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
                              title={isLockedBy25Rule ? "翌月の予約は25日まで停止中" : closeReason(slotState)}
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
