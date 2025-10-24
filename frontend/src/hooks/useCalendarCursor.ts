// src/hooks/useCalendarCursor.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startOfMonth, addMonths } from "@/lib/date";

export type Half = "first" | "second";
type SwipeCfg = { minX: number; ratio: number };

type Options = {
  /** 今月から何ヶ月先まで許可するか（デフォ: 1 = 今月/翌月） */
  monthsAhead?: number;
  /** スワイプ判定（デフォ: 横48px以上 / 縦より横が1.5倍以上） */
  swipe?: SwipeCfg;
};

const DEFAULT_SWIPE: SwipeCfg = { minX: 48, ratio: 1.5 };

export function useCalendarCursor(opts: Options = {}) {
  const { monthsAhead = 1, swipe } = opts;

  // ✅ opts.swipe が新オブジェクトでも、ここでメモ化して安定化
  const SWIPE = useMemo<SwipeCfg>(() => swipe ?? DEFAULT_SWIPE, [swipe]);

  // ==== 範囲制限: 今月 ~ 今月+monthsAhead ====
  const TODAY_ANCHOR = useMemo(() => startOfMonth(new Date()), []);
  const MAX_MONTH = useMemo(
    () => addMonths(TODAY_ANCHOR, monthsAhead),
    [TODAY_ANCHOR, monthsAhead]
  );

  const clampToRange = useCallback(
    (d: Date) => {
      const t = startOfMonth(d);
      if (t < TODAY_ANCHOR) return TODAY_ANCHOR;
      if (t > MAX_MONTH) return MAX_MONTH;
      return t;
    },
    [TODAY_ANCHOR, MAX_MONTH]
  );

  // 表示中の月（1日固定）
  const [calCursor, setCalCursor] = useState<Date>(() => TODAY_ANCHOR);

  // ナビ制御
  const canGoPrev = useMemo(
    () => startOfMonth(calCursor) > TODAY_ANCHOR,
    [calCursor, TODAY_ANCHOR]
  );
  const canGoNext = useMemo(
    () => startOfMonth(calCursor) < MAX_MONTH,
    [calCursor, MAX_MONTH]
  );

  const goPrevMonth = useCallback(() => {
    setCalCursor((d) => clampToRange(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
  }, [clampToRange]);

  const goNextMonth = useCallback(() => {
    setCalCursor((d) => clampToRange(new Date(d.getFullYear(), d.getMonth() + 1, 1)));
  }, [clampToRange]);

  const goThisMonth = useCallback(() => {
    const t = new Date();
    t.setDate(1);
    setCalCursor(clampToRange(t));
  }, [clampToRange]);

  // ===== モバイル: 前半/後半 + アンカー + スワイプ =====
  const [mobileHalf, setMobileHalf] = useState<Half>("first");
  const [mobileAnchor, setMobileAnchor] = useState<Date>(() => TODAY_ANCHOR);

  useEffect(() => {
    setMobileAnchor(startOfMonth(new Date(calCursor)));
  }, [calCursor]);

  useEffect(() => {
    const first = startOfMonth(calCursor);
    const day = mobileHalf === "first" ? 1 : 15;
    setMobileAnchor(new Date(first.getFullYear(), first.getMonth(), day));
  }, [calCursor, mobileHalf]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      touchStart.current = null;

      const ax = Math.abs(dx), ay = Math.abs(dy);
      const isHorizontal = ax > ay * SWIPE.ratio;
      const passX = ax >= SWIPE.minX;
      if (!isHorizontal || !passX) return;

      setCalCursor((d) => {
        const m = dx > 0 ? +1 : -1; // 右フリック=前月、左フリック=翌月（UIに合わせて逆にしたい場合は符号を反転）
        const next = new Date(d.getFullYear(), d.getMonth() + m, 1);
        return clampToRange(next);
      });
    },
    [SWIPE, clampToRange]
  );

  // ===== 25日ロック：翌月の予約は25日まで停止 =====
  const nextMonthStart = useMemo(() => addMonths(TODAY_ANCHOR, 1), [TODAY_ANCHOR]);

  /** 与えた年月(UTC注意)が「本日から見て来月」かつ、本日25日未満なら true */
  const isLockedBy25RuleYMD = useCallback(
    (y: number, m: number, today: Date = new Date()) =>
      y === nextMonthStart.getFullYear() &&
      m === nextMonthStart.getMonth() &&
      today.getDate() < 26,
    [nextMonthStart]
  );

  /** Dateが翌月かの簡易判定 + 25日条件 */
  const isLockedBy25RuleDate = useCallback(
    (d: Date, today: Date = new Date()) =>
      isLockedBy25RuleYMD(d.getFullYear(), d.getMonth(), today),
    [isLockedBy25RuleYMD]
  );

  return {
    // 範囲関連
    TODAY_ANCHOR,
    MAX_MONTH,
    clampToRange,

    // カーソル
    calCursor,
    setCalCursor,
    canGoPrev,
    canGoNext,
    goPrevMonth,
    goNextMonth,
    goThisMonth,

    // モバイル
    mobileHalf,
    setMobileHalf,
    mobileAnchor,
    onTouchStart,
    onTouchEnd,

    // 25日ロック
    nextMonthStart,
    isLockedBy25RuleYMD,
    isLockedBy25RuleDate,
  };
}
