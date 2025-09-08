"use client";

import React from "react";

export type Slot = "am" | "pm" | "full";
export type Program = "tour" | "experience";
export type Status = "booked" | "cancelled" | "done";

export interface Reservation {
    id?: number;
    date: string;
    program: Program;
    slot: Slot;
    status?: Status;
    last_name?: string | null;
    first_name?: string | null;
    email?: string | null;
    phone?: string | null;
    notebook_type?: string | null;
    has_certificate?: boolean | null;
}

type Props = {
    items: Reservation[] | null;
    loading?: boolean;
    onUpdateStatus: (id: number, status: Status) => void;
    onDelete: (id: number) => void;
};

export default function ReservationTable({
    items,
    loading = false,
    onUpdateStatus,
    onDelete,
}: Props) {
    return (
        <div className="rounded-2xl bg-white shadow p-5">
            <h2 className="text-lg font-medium mb-3">予約一覧</h2>
            {loading && !items ? (
                <p className="text-sm text-gray-500">読み込み中…</p>
            ) : !items || items.length === 0 ? (
                <p className="text-sm text-gray-500">予約はまだありません。</p>
            ) : (
                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500">
                                <th className="py-2 pr-3">ID</th>
                                <th className="py-2 pr-3">日付</th>
                                <th className="py-2 pr-3">プログラム</th>
                                <th className="py-2 pr-3">時間帯</th>
                                <th className="py-2 pr-3">姓</th>
                                <th className="py-2 pr-3">名</th>
                                <th className="py-2 pr-3">メール</th>
                                <th className="py-2 pr-3">電話</th>
                                <th className="py-2 pr-3">手帳</th>
                                <th className="py-2 pr-3">受給者証</th>
                                <th className="py-2 pr-3">状態</th>
                                <th className="py-2 pr-3">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((r) => (
                                <tr key={`${r.id ?? r.date + "-" + r.slot}`} className="border-t align-top">
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.id ?? "-"}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">
                                        {typeof r.date === "string" ? r.date.slice(0, 10) : String(r.date)}
                                    </td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.program}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.slot}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.last_name ?? ""}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.first_name ?? ""}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.email ?? ""}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.phone ?? ""}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.notebook_type ?? ""}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.has_certificate ? "○" : "×"}</td>
                                    <td className="py-2 pr-3 whitespace-nowrap">{r.status ?? "-"}</td>
                                    <td className="py-2 pr-3">
                                        {r.id && (
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => onUpdateStatus(r.id!, "booked")}
                                                    className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                                                    title="予約に戻す"
                                                >
                                                    booked
                                                </button>
                                                <button
                                                    onClick={() => onUpdateStatus(r.id!, "cancelled")}
                                                    className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                                                >
                                                    cancelled
                                                </button>
                                                <button
                                                    onClick={() => onUpdateStatus(r.id!, "done")}
                                                    className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                                                >
                                                    done
                                                </button>
                                                <button
                                                    onClick={() => onDelete(r.id!)}
                                                    className="px-3 py-1 rounded-xl border text-red-600 hover:bg-red-50"
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
