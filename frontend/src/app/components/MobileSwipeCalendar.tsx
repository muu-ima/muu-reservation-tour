// src/components/MobileSwipeCalendar.tsx
"use client";
import React, { useMemo, useRef, useState } from "react";
import { addDays, addMonths, toDateStr as ymd } from "../../lib/date";

type Props = {
  value: Date | null;
  onChange: (d: Date) => void;
  minDate?: Date;                 // 例: new Date(Date.now()+7*86400*1000)
  disabledDates?: (d: Date) => boolean; // 予約不可日を動的判定したい時
};

type ViewMode = "month" | "week";

const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1, 0);
const startOfWeek = (d: Date) => {
  const x = new Date(d); 
  const wd = (x.getDay()+6)%7; // 月曜=0
  x.setDate(x.getDate() - wd); 
  return x;
};

export default function MobileSwipeCalendar({ value, onChange, minDate, disabledDates }: Props) {
  const today = useMemo(() => {
    const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);
  const [mode, setMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(value ?? today); // 表示の基準日
  const [touchStart, setTouchStart] = useState<{x:number,y:number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthCells = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const head = startOfWeek(first);
    const cells: Date[] = [];
    let d = new Date(head);
    while (d <= addDays(last, (6 - ((last.getDay()+6)%7)))) {
      cells.push(new Date(d));
      d = addDays(d, 1);
    }
    return cells;
  }, [cursor]);

  const weekCells = useMemo(() => {
    const anchor = startOfWeek(cursor);
    return Array.from({length:7}, (_,i)=> addDays(anchor, i));
  }, [cursor]);

  const canPick = (d: Date) => {
    if (minDate && d < minDate) return false;
    if (disabledDates && disabledDates(d)) return false;
    return d >= today; // 例: 今日以降のみ
  };

  const pick = (d: Date) => {
    if (!canPick(d)) return;
    onChange(d);
  };

  // スワイプ判定
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const TH = 40; // 閾値

    if (ax > ay && ax > TH) {
      // 横方向 → 月移動
      setMode("month");
      setCursor(c => addMonths(c, dx > 0 ? -1 : +1)); // 右フリック=次?前? →右で「月を変更」とあったので、右=次/月送りにしたい場合は +1 に
    } else if (ay > ax && ay > TH) {
      // 縦方向 → 週移動
      setMode("week");
      setCursor(c => addDays(c, dy > 0 ? +7 : -7)); // 下=+1週、上=-1週
    }
    setTouchStart(null);
  };

  const header = (
    <div className="flex items-center justify-between pb-2">
      <button
        className="rounded-xl border px-3 py-1 text-sm"
        onClick={() => setCursor(c => mode==="month" ? addMonths(c,-1) : addDays(c,-7))}
        type="button"
      >前</button>
      <div className="text-base font-semibold">{cursor.getFullYear()}年 {cursor.getMonth()+1}月</div>
      <button
        className="rounded-xl border px-3 py-1 text-sm"
        onClick={() => setCursor(c => mode==="month" ? addMonths(c,1) : addDays(c,7))}
        type="button"
      >次</button>
    </div>
  );

  const weekHeader = (
    <div className="grid grid-cols-7 text-center text-xs text-gray-500 pb-1">
      {["月","火","水","木","金","土","日"].map((w)=> <div key={w}>{w}</div>)}
    </div>
  );

  const grid = (cells: Date[]) => (
    <div
      ref={containerRef}
      className="select-none touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {weekHeader}
      <div className={`grid grid-cols-7 ${mode==="month" ? "gap-y-1" : ""}`}>
        {cells.map(d => {
          const disabled = !canPick(d);
          const isSel = value && isSameDay(d, value);
          const isToday = isSameDay(d, today);
          const outMonth = mode==="month" && d.getMonth()!==cursor.getMonth();

          return (
            <button
              key={ymd(d)}
              type="button"
              onClick={()=>pick(d)}
              disabled={disabled}
              className={[
                "h-12 w-full rounded-xl border text-sm flex items-center justify-center mx-0.5",
                "focus-visible:outline-none focus-visible:ring-2",
                disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]",
                isSel ? "border-blue-600 ring-blue-500" : "border-gray-200",
                isToday ? "font-bold" : "",
                outMonth ? "text-gray-400" : ""
              ].join(" ")}
              aria-label={ymd(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" className="flex-1 rounded-xl border px-3 py-2 text-sm" onClick={()=>{ setMode("month"); setCursor(today);} }>今日へ</button>
        <button type="button" className="flex-1 rounded-xl border px-3 py-2 text-sm" onClick={()=> setMode(m=> m==="month"?"week":"month")}>
          {mode==="month" ? "週表示にする" : "月表示にする"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-2">
      {header}
      {mode==="month" ? grid(monthCells) : grid(weekCells)}
      <p className="mt-2 text-xs text-gray-500">右/左フリック=月移動、下/上フリック=週移動</p>
    </div>
  );
}
