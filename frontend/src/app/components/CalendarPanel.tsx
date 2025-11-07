"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  buildMonthCells,
  inJst,
  allowedMonthsForNav,
  sameYM,
  cmpYM,
} from "@/lib/calendarUtils";
import { useSearchParams, useRouter } from "next/navigation";
import { useCalendarCursor } from "@/hooks/useCalendarCursor";
import ChatSpotlight from "@/components/ChatSpotlight";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

// === 最短予約用の型 ==================
type NextOpen = { date: string; slot: Slot; program?: string };

// === 最短予約を取得する関数（今回追加） =====
async function fetchNextOpen(
  program: string = "tour"
): Promise<NextOpen | null> {
  try {
    const res = await fetch(
      `${API_BASE}/v2/availabilities/next?program=${encodeURIComponent(
        program
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      date?: string;
      slot?: Slot;
      program?: string;
    };
    if (data?.date && (data.slot === "am" || data.slot === "pm")) {
      return {
        date: data.date,
        slot: data.slot,
        program: data.program ?? program,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

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
  if (s.am === "open" && s.pm === "open") return "";

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
  // ===== データ関連（API側）
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

  // ===== カレンダーUI関連（カーソルや月移動など）
  const {
    clampToRange,
    calCursor,
    setCalCursor,
  
    mobileHalf,
    setMobileHalf,
    mobileAnchor,
    onTouchStart,
    onTouchEnd,
    nextMonthStart,
  } = useCalendarCursor({ monthsAhead: 1 }); // 今月/翌月まで許可

  // ▼▼▼ ここから追記（26日ルールのナビ制御）▼▼▼
  const todayJst = useMemo(() => inJst(), []);
  const allowedNav = useMemo(() => allowedMonthsForNav(todayJst), [todayJst]);
  const minYM = allowedNav[0];
  const maxYM = allowedNav[allowedNav.length - 1];

  const ymOf = (d: Date) => ({ y: d.getFullYear(), m: d.getMonth() + 1 });
  const toDateYM = ({ y, m }: { y: number; m: number }) =>
    new Date(y, m - 1, 1);

  // 26日ルールに合わせて、移動先の月を許可範囲にクランプ
  const clampToRange26 = useCallback(
    (d: Date) => {
      const target = ymOf(d);
      if (cmpYM(target, minYM) < 0) return toDateYM(minYM);
      if (cmpYM(target, maxYM) > 0) return toDateYM(maxYM);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    },
    [minYM, maxYM]
  );

  const curYM = ymOf(calCursor);
  const canGoPrev26 = allowedNav.length > 1 && !sameYM(curYM, minYM);
  const canGoNext26 = allowedNav.length > 1 && !sameYM(curYM, maxYM);

  // 表示窓：前半 1〜14日（14日分）、後半 15日〜月末（残り全部）
  const MOBILE_WINDOW_DAYS = 14;

  const monthCells = useMemo(
    () => buildMonthCells(calCursor, "tail"),
    [calCursor]
  );
  const monthKey = useMemo(() => toDateStr(calCursor).slice(0, 7), [calCursor]); // YYYY-MM

  // 予約作成モーダル
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [createSlot, setCreateSlot] = useState<Slot | undefined>(undefined);

  const openCreate = useCallback(
    (dateStr?: string, slot?: Slot) => {
      const safe = getSafeCreateDate(dateStr);
      if (!isBookable(safe)) {
        alert("本日以前や土日・停止日には予約を追加できません。");
        return;
      }
      setCreateDate(safe);
      setCreateSlot(slot);
      setIsCreateOpen(true);
    },
    [getSafeCreateDate, isBookable]
  );

  const sp = useSearchParams();
  const router = useRouter();
  const didPrefill = useRef(false); // ← 二重オープン防止

  // ✅ prefill で自動オープン（依存配列も正しく）
  useEffect(() => {
    if (didPrefill.current) return;

    const prefill = sp.get("prefill");
    const slot = sp.get("slot");

    if (prefill) {
      const d = new Date(prefill);
      if (Number.isNaN(d.getTime())) return;

      setCalCursor(() =>
        clampToRange(new Date(d.getFullYear(), d.getMonth(), 1))
      );

      if (slot === "am" || slot === "pm") {
        openCreate(prefill, slot as Slot);
      } else {
        openCreate(prefill);
      }

      didPrefill.current = true;
      router.replace("/calendar", { scroll: false });
    }
  }, [sp, router, openCreate, clampToRange, setCalCursor]);

  function addMonths(d: Date, n: number) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
  }

  const mobileListRef = useRef<HTMLDivElement | null>(null);

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
      (map[ds] ||= []).push(r);
    });
    return map;
  }, [allItems]);

  const [showSpotlight, setShowSpotlight] = useState(false);

  // 直近の「予約可」日を探す（最長60日スキャン）
  const computeNextBookableDate = useCallback(
    (startStr: string) => {
      const start = new Date(startStr);
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = addDays(start, i);
        const dateStr = toDateStr(d);

        // weekend / day-closed / 25日ルール を既存と同じ条件で判定
        const isWeekendCell = isWeekendStr(dateStr);

        const isCellNextMonth =
          d.getFullYear() === nextMonthStart.getFullYear() &&
          d.getMonth() === nextMonthStart.getMonth();
        const isLockedBy25Rule = isCellNextMonth && today.getDate() < 26;

        const dayItems = dayMap[dateStr] ?? [];
        const slotState = summarizeSlots(dayItems);
        const closed = isDayClosedBySlots(slotState);

        const accepting =
          !isWeekendCell && isBookable(dateStr) && !closed && !isLockedBy25Rule;

        if (accepting) return dateStr;
      }
      return null;
    },
    [dayMap, isBookable, nextMonthStart]
  );

  const handleQuickCreate = useCallback(async () => {
    const program = (sp.get("program") ?? "tour") as string;

    // ① APIから最短予約候補を取得
    const next = await fetchNextOpen(program);
    if (next) {
      // カレンダーを該当月へ寄せて、モーダルをそのまま開く（am/pm も反映）
      setCalCursor(() =>
        clampToRange(
          new Date(
            new Date(`${next.date}T00:00:00`).getFullYear(),
            new Date(`${next.date}T00:00:00`).getMonth(),
            1
          )
        )
      );
      openCreate(next.date, next.slot);
      return;
    }
    // ② 取れなかった場合は従来ロジックでフォールバック
    const today = toDateStr(new Date());
    const alt = computeNextBookableDate(today);
    if (alt) {
      openCreate(alt);
    } else {
      alert("直近60日以内に予約可能な日がありません。");
    }
  }, [sp, clampToRange, setCalCursor, openCreate, computeNextBookableDate]);

  const showArrows = todayJst.getDate() >= 26; // useMemoは不要
  // ===== UI
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 md:p-8 p-2 font-sans">
      <div className="mx-auto w-full md:w-[90%] md:max-w-[1500px] px-2 md:px-0 space-y-6">
        <header
          className={[
            "sticky top-0 z-30 -mx-2 md:-mx-6 mb-6",
            "px-4 md:px-8 py-4",
            // ✨ 背景をガラス風に
            "backdrop-blur-md supports-[backdrop-filter]:bg-white/60 bg-white/80 dark:bg-neutral-900/60",
            "border-b border-neutral-200 dark:border-neutral-700 shadow-[0_2px_10px_rgba(0,0,0,0.05)]",
            "flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6",
          ].join(" ")}
        >
          {/* === 左側: タイトル + サブリンク === */}
          <div className="flex flex-col">
            <h1
              className={[
                "text-[21px] md:text-[23px] font-semibold tracking-tight",
                "bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent",
                "dark:from-white dark:to-neutral-300",
              ].join(" ")}
            >
              予約カレンダー
            </h1>

            <p
              className="text-[14px] text-blue-600 font-medium cursor-pointer mt-1 leading-tight hover:text-blue-700 transition-all"
              onMouseEnter={() => setShowSpotlight(true)}
              onMouseLeave={() => setShowSpotlight(false)}
              onClick={() => setShowSpotlight(true)}
            >
              💬 予約の取り方をチャットボットで確認する
            </p>
          </div>

          {/* === 右側: アクションボタン群 === */}
          <div className="flex items-center gap-3 flex-nowrap whitespace-nowrap">
            {/* 更新ボタン */}
            <button
              onClick={fetchReservations}
              disabled={loading}
              className={[
                "rounded-xl border border-neutral-300 bg-white/70 backdrop-blur-sm",
                "px-3.5 py-2 text-[14px] font-medium text-neutral-700 shadow-sm",
                "hover:bg-white hover:shadow-md hover:-translate-y-[1px]",
                "disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300",
              ].join(" ")}
            >
              {loading ? "更新中…" : "更新"}
            </button>

            {/* 新規予約ボタン */}
            <button
              onClick={handleQuickCreate}
              className={[
                "rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white",
                "px-4 py-2 text-[14px] font-semibold shadow-md",
                "hover:from-blue-600 hover:to-blue-800 hover:shadow-lg hover:-translate-y-[1px]",
                "active:scale-[0.98] transition-all duration-300",
              ].join(" ")}
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
            <div className="flex items-center gap-4 flex-wrap mx-2 my-3">
              <button
  className={
    "px-3 py-2 rounded-xl border border-gray-300 transition-all duration-200 flex items-center justify-center shadow-sm " +
    (showArrows && canGoPrev26
      ? "hover:bg-gray-100 active:scale-95"
      : "invisible pointer-events-none")
  }
  onClick={() =>
    setCalCursor((d) =>
      clampToRange26(new Date(d.getFullYear(), d.getMonth() - 1, 1))
    )
  }
  aria-label="前の月"
>
  <ChevronLeft className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
</button>


              <span className="min-w-[10ch] text-center text-xl md:text-2xl font-semibold text-gray-800 tracking-wide">
                {formatMonthJP(calCursor)}
              </span>

       <button
  className={
    "px-3 py-2 rounded-xl border border-gray-300 transition-all duration-200 flex items-center justify-center shadow-sm " +
    (showArrows && canGoNext26
      ? "hover:bg-gray-100 active:scale-95"
      : "invisible pointer-events-none")
  }
  onClick={() =>
    setCalCursor((d) =>
      clampToRange26(new Date(d.getFullYear(), d.getMonth() + 1, 1))
    )
  }
  aria-label="次の月"
>
  <ChevronRight className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
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

                const isCellNextMonth =
                  cell.y === nextMonthStart.getFullYear() &&
                  cell.m === nextMonthStart.getMonth();

                // 25日ルール（25日までは翌月を停止）
                const isLockedBy25Rule =
                  isCellNextMonth && today.getDate() < 26;

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
                      "relative h-32 rounded-xl border border-neutral-200 bg-white/90 text-left p-3 transition",
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
                        className={[
                          "leading-none tracking-tight",
                          cell.inMonth
                            ? "text-[18px] font-semibold text-neutral-900"
                            : "text-[18px] font-semibold text-neutral-400",
                        ].join(" ")}
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
                        title={
                          isLockedBy25Rule
                            ? "翌月の予定は25日まで停止中"
                            : closeReason(slotState)
                        }
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
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={`${monthKey}-${mobileHalf}`} // ← 月 or 前半/後半が変わるたびにアニメ
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
                    className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden bg-white"
                  >
                    {" "}
                    {windowCells.map((cell) => {
                      const dayItems = dayMap[cell.dateStr] ?? [];
                      const slotState = summarizeSlots(dayItems);
                      const isToday = cell.dateStr === toDateStr(new Date());
                      const isWeekendCell = isWeekendStr(cell.dateStr);

                      // 月ルールチェック
                      const today = new Date();
                      const nextMonthStart = addMonths(startOfMonth(today), 1); // このセルが 「本日から見た来月」か？ (dateStrから判定)

                      const d = new Date(cell.dateStr);
                      const isCellNextMonth =
                        d.getFullYear() === nextMonthStart.getFullYear() &&
                        d.getMonth() === nextMonthStart.getMonth();
                      // 25日ルール（25日までは翌月を停止）
                      const isLockedBy25Rule =
                        isCellNextMonth && today.getDate() < 26;

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
                                alert("翌月の予約は26日以降に解放されます。");
                              }
                              if (accepting) {
                                openCreate(cell.dateStr);
                              } else if (!isWeekendCell) {
                                setFilter((f) => ({
                                  ...f,
                                  date: cell.dateStr,
                                }));
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
                                title={
                                  isLockedBy25Rule
                                    ? "翌月の予約は25日まで停止中"
                                    : closeReason(slotState)
                                }
                                aria-hidden
                              >
                                停
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </motion.ul>
                </AnimatePresence>
              );
            })()}
          </div>
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

      <ChatSpotlight
        show={showSpotlight}
        onClose={() => setShowSpotlight(false)}
      />
    </div>
  );
}
