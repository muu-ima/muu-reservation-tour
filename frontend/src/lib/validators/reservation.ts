// src/lib/validators/reservation.ts
import {
  Program,
  Slot,
  Status,
  isProgram,
  isSlot,
  isStatus,
  isSlotAllowed,
  getSlotWindowJst,
} from "@/types/reservation";

// ---- 小ユーティリティ -------------------------------------------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  // 月ずれ等がないか厳密確認
  const [y, m, day] = v.split("-").map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

export function isTodayOrFuture(v: string, now = new Date()): boolean {
  const d = new Date(`${v}T00:00:00+09:00`); // JST
  const today = new Date(now);
  const tz = today.getTimezoneOffset();
  // 当日0:00と比較（ローカル前提。運用JSTなら +09:00 で揃える）
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= today;
}

/** 25日ルール: 本日が25日未満の場合、翌月の日付はロック */
export function isLockedBy25Rule(dateStr: string, now = new Date()): boolean {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const nextMonthStart = new Date(y, m + 1, 1);
  const isNextMonth =
    d.getFullYear() === nextMonthStart.getFullYear() &&
    d.getMonth() === nextMonthStart.getMonth();
  return isNextMonth && now.getDate() < 26;
}

export type ValidationIssue = { path: string; message: string };

// ---- 既存のドラフト用（軽量チェック） -------------------------------
export function validateReservationDraft(d: {
  program: Program;
  slot: Slot;
  date: string; // YYYY-MM-DD
}): ValidationIssue[] {
  const errs: ValidationIssue[] = [];
  if (!isSlotAllowed(d.program, d.slot)) {
    errs.push({ path: "slot", message: "見学(tour)では full は選べません。" });
  }
  if (!d.date) {
    errs.push({ path: "date", message: "日付は必須です。" });
  } else if (!isDateStr(d.date)) {
    errs.push({
      path: "date",
      message: "日付の形式が正しくありません（YYYY-MM-DD）。",
    });
  }
  return errs;
}

// ---- 作成用（POST）: 画面/業務ルールまで含めた本番チェック ---------
export function validateReservationCreate(
  payload: {
    date: string;
    program: Program;
    slot: Slot;
    status?: Status;
    name?: string | null;
    last_name?: string | null;
    first_name?: string | null;
    kana?: string | null;
    email?: string | null;
    phone?: string | null;
    notebook_type?: string | null;
    has_certificate?: boolean | null;
    note?: string | null;
  },
  opts?: {
    /** その日/枠が予約可能か（重複・満席・休業を判定）。UI層から渡す拡張ポイント */
    isBookable?: (date: string, slot: Slot, program: Program) => boolean;
    now?: Date;
  }
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  // 型/基本
  if (!isProgram(payload.program))
    errors.push({ path: "program", message: "不正なプログラムです。" });
  if (!isSlot(payload.slot))
    errors.push({ path: "slot", message: "不正な時間帯です。" });
  if (!isDateStr(payload.date))
    errors.push({
      path: "date",
      message: "日付の形式が正しくありません（YYYY-MM-DD）。",
    });

  // 業務ルール
  if (isProgram(payload.program) && isSlot(payload.slot)) {
    if (!isSlotAllowed(payload.program, payload.slot)) {
      errors.push({
        path: "slot",
        message: "見学(tour)では full は選べません。",
      });
    }
    if (getSlotWindowJst(payload.program, payload.slot) == null) {
      errors.push({
        path: "slot",
        message: "このプログラムでは指定の時間帯は使えません。",
      });
    }
  }

  // 日付系
  const now = opts?.now ?? new Date();
  if (isDateStr(payload.date) && !isTodayOrFuture(payload.date, now)) {
    errors.push({ path: "date", message: "過去日には予約できません。" });
  }
  if (isDateStr(payload.date) && isLockedBy25Rule(payload.date, now)) {
    errors.push({
      path: "date",
      message: "翌月の予約は26日から受付です。",
    });
  }

  // 連絡先
  const email = (payload.email ?? "").trim();
  if (!email) {
    errors.push({ path: "email", message: "メールは必須です。" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ path: "email", message: "メールの形式が不正です。" });
  }

  const phone = (payload.phone ?? "").trim();
  if (phone && !/^[0-9()\-\s]+$/.test(phone)) {
    errors.push({
      path: "phone",
      message: "電話番号は半角数字・記号のみで入力してください。",
    });
  }

  // 氏名
  if (!(payload.last_name ?? "").trim())
    errors.push({ path: "last_name", message: "姓は必須です。" });
  if (!(payload.first_name ?? "").trim())
    errors.push({ path: "first_name", message: "名は必須です。" });

  // 任意：ふりがな（全角ひらがな/スペースのみ許容）
  const kana = (payload.kana ?? "").trim();
  if (kana && !/^[\u3040-\u309F\s]+$/.test(kana)) {
    errors.push({
      path: "kana",
      message: "ふりがなは全角ひらがなで入力してください。",
    });
  }

  // 外部供給の“空き判定”フック
  if (opts?.isBookable && !errors.length) {
    const ok = opts.isBookable(payload.date, payload.slot, payload.program);
    if (!ok)
      errors.push({
        path: "slot",
        message: "選択した日付/時間帯は満席または受付停止です。",
      });
  }

  return errors;
}
