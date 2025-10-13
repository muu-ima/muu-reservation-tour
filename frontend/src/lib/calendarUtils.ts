// src/lib/calendarUtils.ts
import { toDateStr } from "@/lib/dateUtils";

/** 月グリッド1マス分の情報 */
export type MonthCell = {
  dateStr: string;   // "YYYY-MM-DD"
  inMonth: boolean;  // 表示中の月に属するか
  y: number;         // 年
  m: number;         // 月(0-11)
  day: number;       // 日(1-31)
};

/**
 * 7×6の月グリッドを生成
 * @param cursor 表示中の任意日（通常は月初を推奨）。この月を中心にグリッドを作る
 * @param mondayStart true なら月曜起点, false なら日曜起点
 */
export function buildMonthCells(cursor: Date, mondayStart = true): MonthCell[] {
  const y = cursor.getFullYear();
  const m = cursor.getMonth(); // 0-11

  const first = new Date(y, m, 1);
  const firstDow = first.getDay(); // 0=Sun, 1=Mon, ...
  const startOffset = (firstDow - (mondayStart ? 1 : 0) + 7) % 7; // 先頭に並べる前月日数
  const gridStart = new Date(y, m, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return {
      dateStr: toDateStr(d),
      inMonth: d.getMonth() === m,
      y: d.getFullYear(),
      m: d.getMonth(),
      day: d.getDate(),
    };
  });
}

/** ヘッダ用の曜日文字列（"月","火",...）を返す。必要なら使ってね。 */
export function weekdayHeaders(mondayStart = true): string[] {
  const jp = ["日", "月", "火", "水", "木", "金", "土"];
  return mondayStart ? [...jp.slice(1), jp[0]] : jp;
}
