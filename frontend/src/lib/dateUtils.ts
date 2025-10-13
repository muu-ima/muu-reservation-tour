// 日付/曜日・営業日系（CalendarPanel由来）
export const toDateStr = (d: string | Date) => {
  if (typeof d === "string") return d.slice(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function dayOfWeekFromStr(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
export const isWeekendStr = (s: string) => {
  const dow = dayOfWeekFromStr(s);
  return dow === 0 || dow === 6;
};

export function nextBusinessDay(from: Date = new Date()): string {
  const dt = new Date(from);
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return toDateStr(dt);
}
export function nextBusinessDayFromStr(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return nextBusinessDay(new Date(y, m - 1, d));
}

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth   = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const daysInMonth  = (d: Date) => endOfMonth(d).getDate();
export const addDays      = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths    = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const formatMonthJP = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月`;
