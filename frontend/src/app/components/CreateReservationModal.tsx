// src/components/CreateReservationModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import type { ReservationCreatePayload, Program, Slot } from "@/types/reservation";
import { isProgram, isSlot, getErrorMessage } from "@/types/reservation";

type Props = {
    open: boolean;
    initialDate?: string;   // "YYYY-MM-DD"
    initialSlot?: Slot;
    onClose: () => void;
    onSubmit: (payload: ReservationCreatePayload) => Promise<void>;
};

const emptyDraft: ReservationCreatePayload = {
    date: "",
    program: "experience",
    slot: "am",
    name: "",
    last_name: "",
    first_name: "",
    email: "",
    phone: "",
    notebook_type: "",
    has_certificate: false,
    note: "",
};

export default function CreateReservationModal({
    open,
    initialDate,
    initialSlot,
    onClose,
    onSubmit,
}: Props) {
    const [draft, setDraft] = useState<ReservationCreatePayload>(emptyDraft);

    useEffect(() => {
        if (draft.program === "tour" && draft.slot === "full") {
            setDraft((d) => ({ ...d, slot: "am" })); // 例：午前に寄せる
        }
    }, [draft.program, draft.slot]);

    // open のたびに初期化
    useEffect(() => {
        if (open) {
            setDraft({
                ...emptyDraft,
                date: initialDate ?? toDateStr(new Date()),
                slot: initialSlot ?? "am",
            });
        }
    }, [open, initialDate, initialSlot]);

    // program と slot の整合性（tour では full を不可）
    useEffect(() => {
        if (draft.program === "tour" && draft.slot === "full") {
            setDraft((d) => ({ ...d, slot: "am" }));
        }
    }, [draft.program, draft.slot]);

    return (
        <Modal open={open} onClose={onClose} title="予約の追加">
            {/* モバイルで切れないように、ここをスクロール領域にする */}
            <div className="max-h-[calc(100dvh-1rem)] md:max-h-[min(85vh,48rem)] overflow-y-auto">
                <form
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    onSubmit={async (e) => {
                        e.preventDefault();

                        // 1) HTMLの必須チェック
                        const form = e.currentTarget as HTMLFormElement;
                        if (!form.reportValidity()) {
                            const firstInvalid = form.querySelector(":invalid") as HTMLElement | null;
                            if (firstInvalid) {
                                firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
                                (firstInvalid as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).focus();
                            }
                            return;
                        }

                        // 2) 正規化ヘルパ
                        const nilIfEmpty = (v?: string | null) => {
                            const s = (v ?? "").trim();
                            return s === "" ? null : s;
                        };
                        const toAsciiPhone = (s?: string | null) => {
                            const t = (s ?? "").trim();
                            if (!t) return null;
                            return t
                                .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)) // 全角→半角(数字)
                                .replace(/\u3000/g, " ") // 全角スペース→半角
                                .trim();
                        };

                        // 3) slot ガード（tour×full禁止）
                        const isSlotAllowed = (program: "tour" | "experience", slot: "am" | "pm" | "full") =>
                            program === "tour" ? slot === "am" || slot === "pm" : true;

                        const payload: ReservationCreatePayload = {
                            date: draft.date,                                            // 'YYYY-MM-DD'
                            program: (draft.program || "").toLowerCase() as Program,     // 'tour' | 'experience'
                            slot: (draft.slot || "").toLowerCase() as Slot,              // 'am' | 'pm' | 'full'

                            name: nilIfEmpty(draft.name),
                            last_name: nilIfEmpty(draft.last_name),
                            first_name: nilIfEmpty(draft.first_name),
                            email: nilIfEmpty(draft.email),
                            phone: toAsciiPhone(draft.phone),
                            notebook_type: nilIfEmpty(draft.notebook_type),
                            has_certificate: !!draft.has_certificate,
                            note: nilIfEmpty(draft.note),
                            // room は完全削除済みのため送らない
                            // status も現状は送らない
                        };

                        if (!isSlotAllowed(payload.program, payload.slot)) {
                            alert("見学(tour)では full は選べません。");
                            return;
                        }

                        try {
                            await onSubmit(payload);
                        } catch (err) {
                            alert(getErrorMessage(err));
                        }
                    }}
                >

                    {/* 日付 */}
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">日付</span>
                        <input
                            type="date"
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.date}
                            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                            required
                        />
                    </label>

                    {/* プログラム */}
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">プログラム</span>
                        <select
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.program}
                            onChange={(e) => {
                                const v = e.target.value as Program;
                                if (isProgram(v)) setDraft((d) => ({ ...d, program: v }));
                            }}
                            required
                        >
                            <option value="experience">体験</option>
                            <option value="tour">見学</option>
                        </select>
                    </label>

                    {/* スロット */}
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">時間帯</span>
                        <select
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.slot}
                            onChange={(e) => {
                                const v = e.target.value as Slot;
                                if (isSlot(v)) setDraft((d) => ({ ...d, slot: v }));
                            }}
                            required
                        >
                            <option value="am">AM</option>
                            <option value="pm">PM</option>
                            <option value="full" disabled={draft.program === "tour"}>終日</option>
                        </select>
                    </label>


                    {/* 姓名 */}
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">姓</span>
                        <input
                            type="text"
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.last_name ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">名</span>
                        <input
                            type="text"
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.first_name ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))}
                            required
                        />
                    </label>

                    {/* 連絡先 */}
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">メール</span>
                        <input
                            type="email"
                            className="w-full rounded-lg border px-3 py-1.5"
                            value={draft.email ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600 mb-1">電話番号（任意）</span>
                        <input
                            type="tel"
                            name="phone"
                            inputMode="tel"
                            autoComplete="tel"
                            pattern="^[0-9()+\\s\\-]{8,}$"
                            title="数字・() + - と空白のみ、8文字以上"
                        />


                    </label>

                    {/* その他 */}
                    <label className="text-sm sm:col-span-2">
                        <span className="block text-gray-600 mb-1">手帳の種別（notebook_type）</span>
                        <textarea
                            className="w-full rounded-lg border px-3 py-1.5"
                            rows={3}
                            value={draft.notebook_type ?? ""} required
                            onChange={(e) => setDraft((d) => ({ ...d, notebook_type: e.target.value }))}
                        />
                    </label>

                    <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2">
                        {/* 受給者証（ラジオ：必須で「あり/なし」どちらか） */}
                        <fieldset className="sm:col-span-2">
                            <legend className="block text-gray-600 mb-1 text-sm">受給者証の有無</legend>
                            <div className="flex items-center gap-6">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="has_certificate"
                                        value="yes"
                                        checked={draft.has_certificate === true}
                                        onChange={() => setDraft((d) => ({ ...d, has_certificate: true }))}
                                        required
                                    />
                                    あり
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="has_certificate"
                                        value="no"
                                        checked={draft.has_certificate === false}
                                        onChange={() => setDraft((d) => ({ ...d, has_certificate: false }))}
                                    />
                                    なし
                                </label>
                            </div>
                        </fieldset>

                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl border hover:bg-gray-50">
                                キャンセル
                            </button>
                            <button type="submit" className="px-4 py-1.5 rounded-xl bg-black text-white hover:opacity-90">
                                作成
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

// util: "YYYY-MM-DD"
function toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
