import { toDateStr } from "@/lib/date";

export type MonthCell = {
  dateStr: string;   // "YYYY-MM-DD"
  inMonth: boolean;  // 表示中の月か？
  y: number;
  m: number;         // 0-11
  day: number;       // 1-31
};

// mode の意味
//  - false    : 当月だけ（余白なし）
//  - "tail"   : 当月 + 最終週の穴埋め（日曜まで）だけ ←今回これ
//  - true     : 当月 + 常に6週(=42マス)にそろえる旧スタイル
export function buildMonthCells(
  cursor: Date,
  mode: boolean | "tail" = "tail",
): MonthCell[] {
  const y = cursor.getFullYear();
  const m = cursor.getMonth(); // 0-11

  // 今月1日と末日
  const firstOfMonth = new Date(y, m, 1);
  const lastOfMonth = new Date(y, m + 1, 0);
  const daysInThisMonth = lastOfMonth.getDate();

  // 1. 今月の日付セルを並べる
  const cells: MonthCell[] = [];
  for (let day = 1; day <= daysInThisMonth; day++) {
    const d = new Date(y, m, day);
    cells.push(makeCell(d, true));
  }

  // 2. 月初の前に足りない分（前月）を先頭に差し込んで、週の頭を月曜に揃える
  const firstWeekday = weekdayIndexMonStart(firstOfMonth); // 0=Mon ... 6=Sun
  for (let i = 1; i <= firstWeekday; i++) {
    const d = new Date(y, m, 1 - i); // 前月側へ
    cells.unshift(makeCell(d, false));
  }

  // mode=false はここで終了（当月だけ＋頭の前月ぶん）
  if (mode === false) {
    return cells;
  }

  // 3. 月末側の埋め
  //    最終セルの曜日を見て、同じ週の日曜までだけ翌月で埋める
  const lastCell = cells[cells.length - 1];
  const lastDate = new Date(lastCell.y, lastCell.m, lastCell.day);

  const lastWeekday = weekdayIndexMonStart(lastDate); // 0=Mon ... 6=Sun
  if (lastWeekday === 6) {
    // ちょうど日曜で終わってるなら追加なし
    return normalizeByMode(cells, lastDate, 0, mode);
  }

  const padCountThisWeek = 6 - lastWeekday; // 日曜まで何日足すか
  for (let i = 1; i <= padCountThisWeek; i++) {
    const d = new Date(lastDate);
    d.setDate(lastDate.getDate() + i);
    cells.push(makeCell(d, false)); // 翌月 (inMonth=false)
  }

  // "tail"ならこれで完成
  // trueならさらに6週=42マスに揃える
  return normalizeByMode(cells, lastDate, padCountThisWeek, mode);
}

// modeごとの最終調整
function normalizeByMode(
  baseCells: MonthCell[],
  lastDate: Date,
  padCountThisWeek: number,
  mode: boolean | "tail"
): MonthCell[] {
  if (mode === "tail") {
    // 今回の仕様：最終週だけ穴埋めして終了
    return baseCells;
  }

  if (mode === true) {
    // 古い仕様：必ず6行(=42マス)にする
    const TARGET_LEN = 42;
    const cells = [...baseCells];
    let extraOffset = padCountThisWeek;
    while (cells.length < TARGET_LEN) {
      extraOffset++;
      const d = new Date(lastDate);
      d.setDate(lastDate.getDate() + extraOffset);
      cells.push(makeCell(d, false));
    }
    return cells;
  }

  // mode===falseはここに来ない想定だけど一応
  return baseCells;
}

// 月曜スタート用の曜日インデックスに変換
// JS Date.getDay(): 0=Sun..6=Sat
// -> 0=Mon,...,6=Sun にしたい
function weekdayIndexMonStart(d: Date) {
  const w = d.getDay(); // 0..6 (Sun..Sat)
  return (w + 6) % 7;   // Sun(0)->6, Mon(1)->0, ... Sat(6)->5
}

// 1セルぶんのオブジェクトを作る
function makeCell(d: Date, inMonth: boolean): MonthCell {
  return {
    dateStr: toDateStr(d),
    inMonth,
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
  };
}
