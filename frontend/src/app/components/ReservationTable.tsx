"use client";

import React from "react";

export type Slot = "am" | "pm";
export type Program = "tour";
export type Status = "pending" | "booked" | "cancelled" | "done";

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

// 状態ごとの色・ラベル設定
const STATUS_STYLE: Record<Status, { label: string; color: string }> = {
  pending:   { label: "仮予約", color: "bg-gray-200 text-gray-700" },
  booked:    { label: "確定",   color: "bg-blue-200 text-blue-800" },
  done:      { label: "完了",   color: "bg-green-200 text-green-800" },
  cancelled: { label: "キャンセル", color: "bg-red-200 text-red-700" },
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
                <tr
                  key={`${r.id ?? r.date + "-" + r.slot}`}
                  className="border-t align-top"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">{r.id ?? "-"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {typeof r.date === "string"
                      ? r.date.slice(0, 10)
                      : String(r.date)}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.program}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.slot}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.last_name ?? ""}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.first_name ?? ""}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.email ?? ""}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.phone ?? ""}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.notebook_type ?? ""}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.has_certificate ? "○" : "×"}
                    </td>
                           {/* 状態バッジ */}
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.status ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[r.status].color}`}
                      >
                        {STATUS_STYLE[r.status].label}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {r.id && (
                      <div className="flex flex-wrap gap-2">
                        {/* pending→booked用 */}
                        {r.status === "pending" && (
                          <button
                            onClick={() => onUpdateStatus(r.id!, "booked")}
                            className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                            title="予約に戻す"
                          >
                            確定(booked)
                          </button>
                        )}
                        {/* booked→done/cancelled */}
                        {r.status === "booked" && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(r.id!, "done")}
                              className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                            >
                              完了(done)
                            </button>
                            <button
                              onClick={() => onUpdateStatus(r.id!, "cancelled")}
                              className="px-3 py-1 rounded-xl border hover:bg-gray-50"
                            >
                              キャンセル(cancelled)
                            </button>
                          </>
                        )}
                        {/* done/cancelled でも削除は常に可能 */}
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
