// src/types/reservation.ts

/** 時間帯 */
export type Slot = "am" | "pm" | "full";
/** プログラム種別 */
export type Program = "tour" | "experience";
/** 予約の状態 */
export type Status = "booked" | "cancelled" | "done";

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
    room?: string | null;
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
    name?: string | null;
    last_name?: string | null;
    first_name?: string | null;
    email?: string | null;
    phone?: string | null;
    notebook_type?: string | null;
    has_certificate?: boolean | null;
    note?: string | null;
    room?: string | null;
};

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
