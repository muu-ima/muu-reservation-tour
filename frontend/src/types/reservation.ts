// src/types/reservation.ts

/** 時間帯 */
export type Slot = "am" | "pm" | "full";
/** プログラム種別 */
export type Program = "tour" | "experience";
/** 予約の状態 */
export type Status = "pending" | "booked" | "canceled" | "done";

/** APIが返す/受け取る予約エンティティ（Eloquent想定） */
export interface Reservation {
    id?: number;
    /** "YYYY-MM-DD" または ISO 文字列 */
    date: string;
    program: Program;
    slot: Slot;
    /** 任意。サーバ側で姓名から合成 or 'ゲスト' を埋める運用 */
    name?: string;
    status?: Status;
    start_at?: string;
    end_at?: string;
    contact?: string | null;
    note?: string | null;
    created_at?: string;
    updated_at?: string;
    // 追加項目
    last_name?: string | null;
    first_name?: string | null;
    email?: string | null;
    phone?: string | null;
    notebook_type?: string | null;
    has_certificate?: boolean | null;
}

/** 絞り込み（APIに渡す純粋な型。空=undefinedで表現） */
export type ReservationFilter = {
    date?: string;
    program?: Program;
    slot?: Slot;
};

/** 画面用の絞り込み（セレクトの「すべて」を空文字で持てる版） */
export type ReservationFilterUI = {
    date?: string;
    program?: Program | "";
    slot?: Slot | "";
};

/** 予約の作成 payload（POST） */
export type ReservationCreatePayload = {
    date: string;
    program: Program;
    slot: Slot;
    // ★ 必要な画面だけで送る。未指定ならサーバ既定（'booked' など）
    status?: Status;
    name?: string | null;
    last_name?: string | null;
    first_name?: string | null;
    email?: string | null;
    phone?: string | null;
    notebook_type?: string | null;
    has_certificate?: boolean | null;
    note?: string | null;
};

/** status の型ガード */
export function isStatus(v: unknown): v is Status {
    return v === "pending" || v === "booked" || v === "canceled" || v === "done";
}

/** 互換: 英綴り 'cancelled' が紛れても 'canceled' に寄せる */
export const normalizeStatus = (s: Status | "cancelled"): Status =>
    (s === "cancelled" ? "canceled" : s);

/** 予約の更新 payload（PATCH） */
export type ReservationUpdatePayload = {
    status: Status;
};

/** type guards */
export function isProgram(v: unknown): v is Program {
    return v === "tour" || v === "experience";
}
export function isSlot(v: unknown): v is Slot {
    return v === "am" || v === "pm" || v === "full";
}

/** エラー文字列を安全に取り出す */
export function getErrorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** slot と時間帯（JST） */
export const SLOT_WINDOWS_JST = {
    tour: {
        am: { start: "10:30", end: "12:00" },
        pm: { start: "13:30", end: "15:00" },
        full: null, // 禁止
    },
    experience: {
        am: { start: "10:00", end: "12:00" },
        pm: { start: "13:00", end: "15:00" },
        full: { start: "10:00", end: "15:00" }, // 終日
    },
} as const;

/** slot の有効判定 */
export const isSlotAllowed = (program: Program, slot: Slot) => {
    return program === "tour" ? slot === "am" || slot === "pm" : true;
};

/** slot に対応する時間帯を取得 */
export const getSlotWindowJst = (program: Program, slot: Slot) =>
    SLOT_WINDOWS_JST[program][slot];

/** 予約作成前のバリデーション */
export function validateReservationDraft(d: {
    program: Program;
    slot: Slot;
    date: string; // YYYY-MM-DD
}): string[] {
    const errs: string[] = [];
    if (!isSlotAllowed(d.program, d.slot)) {
        errs.push("見学(tour)では full は選べません。");
    }
    if (!d.date) {
        errs.push("日付は必須です。");
    }
    return errs;
}
