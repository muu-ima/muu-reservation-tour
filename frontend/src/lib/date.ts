// /src/lib/date.ts  —— Single source of truth

/** 月初（時刻は維持しない=00:00:00ベースにしない方針ならここで調整） */
export const startOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

/** 月末 */
export const endOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

/** 日数加算（時刻を維持） */
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** 月数加算（1日に正規化） */
export const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

/** その月の日数 */
export const daysInMonth = (d: Date) => endOfMonth(d).getDate();

/** YYYY-MM-DD（タイムゾーンずれ対策版） */
export const toDateStr = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  const tz = new Date(x.getTime() - x.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

/** 文字列日付の曜日（0=日 ... 6=土） */
export const dayOfWeekFromStr = (s: string): number => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** 週末判定（YYYY-MM-DD） */
export const isWeekendStr = (s: string) => {
  const dow = dayOfWeekFromStr(s);
  return dow === 0 || dow === 6;
};

/** 月表示（日本語） */
export const formatMonthJP = (d: Date) =>
  `${d.getFullYear()}年 ${d.getMonth() + 1}月`;

/** 月単位の範囲クランプ（今月〜翌月など） */
export const clampMonthRange = (d: Date, min: Date, max: Date) => {
  const t = startOfMonth(d);
  const a = startOfMonth(min);
  const b = startOfMonth(max);
  if (t < a) return a;
  if (t > b) return b;
  return t;
};

/** 月曜始まりの週頭 */
export const startOfWeekMon = (d: Date) => {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - wd);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** 年月日一致（時刻無視） */
export const isSameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** 次の営業日（from が土日なら月曜へ） */
export const nextBusinessDay = (from: Date = new Date()): string => {
  const dt = new Date(from);
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return toDateStr(dt);
};

export const nextBusinessDayFromStr = (s: string): string => {
  const [y, m, d] = s.split("-").map(Number);
  return nextBusinessDay(new Date(y, m - 1, d));
};
