"use client";

import React from "react";
import type { Reservation, Status } from "@/types/reservation";
import { normalizeStatus } from "@/types/reservation";

export type Slot = "am" | "pm";
export type Program = "tour";

type Props = {
  items: Reservation[] | null;
  loading?: boolean;
  // どちらでも受けられるようにしておく
  onUpdateStatus: (id: number, status: Status) => Promise<void> | void;
  onDelete: (id: number) => void;
};

const STATUS_STYLE: Record<Status, { label: string; color: string }> = {
  pending: { label: "仮予約", color: "bg-gray-200 text-gray-700" },
  booked: { label: "確定", color: "bg-blue-200 text-blue-800" },
  canceled: { label: "キャンセル", color: "bg-red-200 text-red-700" },
  done: { label: "完了", color: "bg-green-200 text-green-800" },
};

// 'cancelled' でも undefined でも安全にスタイルを返す
function styleOf(raw?: Status | "cancelled" | null) {
  // undefined/null なら "pending" に寄せ、"cancelled" も normalize で "canceled" へ
  const s = normalizeStatus(raw ?? "pending");
  return STATUS_STYLE[s];
}

export default function ReservationTable({
  items,
  loading = false,
  onUpdateStatus,
  onDelete,
}: Props) {
  return (
    <div className="rounded-2xl bg-white shadow p-5 not-prose">
      <h2 className="text-lg font-medium mb-3">予約一覧</h2>

      {loading && !items ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-gray-500">予約はまだありません。</p>
      ) : (
        // ① 横スクロールの“箱”に閉じ込める
        <div className="overflow-x-auto -mx-1">
          {/* ② table-fixed + colgroup で幅を固定 */}
          <table className="min-w-[980px] w-full table-fixed text-sm border-collapse">
            <colgroup>
              <col className="w-14" /> {/* ID */}
              <col className="w-28" /> {/* 日付 */}
              <col className="w-24" /> {/* プログラム */}
              <col className="w-20" /> {/* 時間帯 */}
              <col className="w-24" /> {/* 姓 */}
              <col className="w-24" /> {/* 名 */}
              <col className="w-28" /> {/* かな */}
              <col className="w-44" /> {/* メール */}
              <col className="w-32" /> {/* 電話 */}
              <col className="w-28" /> {/* 手帳 */}
              <col className="w-20" /> {/* 受給者証 */}
              <col className="w-24" /> {/* 状態 */}
              <col className="w-[220px]" /> {/* 操作ボタン */}
            </colgroup>

            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">日付</th>
                <th className="py-2 px-2">プログラム</th>
                <th className="py-2 px-2">時間帯</th>
                <th className="py-2 px-2">姓</th>
                <th className="py-2 px-2">名</th>
                <th className="py-2 px-2">かな</th>
                <th className="py-2 px-2">メール</th>
                <th className="py-2 px-2">電話</th>
                <th className="py-2 px-2">手帳</th>
                <th className="py-2 px-2">受給者証</th>
                <th className="py-2 px-2">状態</th>
                <th className="py-2 px-2">操作</th>
              </tr>
            </thead>

            <tbody>
              {items.map((r) => (
                <tr
                  key={`${r.id ?? r.date + "-" + r.slot}`}
                  className="border-t align-top hover:bg-gray-50 transition-colors"
                >
                  {/* ③ 各セルは nowrap + truncate でハミ出し抑制 */}
                  <td className="py-2 px-2 whitespace-nowrap">{r.id ?? "-"}</td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {typeof r.date === "string"
                      ? r.date.slice(0, 10)
                      : String(r.date)}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">{r.program}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{r.slot}</td>
                  <td className="py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.last_name ?? ""}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.first_name ?? ""}
                  </td>
                  <td
                    className="py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis"
                    title={r.kana ?? ""} // 👈 hover時に全文表示
                  >
                    {r.kana ?? ""}
                  </td>
                  <td
                    className="px-2 py-2 whitespace-nowrap max-w-[176px] truncate"
                    title={r.email ?? ""}
                  >
                    {r.email ?? ""}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.phone ?? ""}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    {r.notebook_type ?? ""}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {r.has_certificate ? "○" : "×"}
                  </td>

                  <td className="py-2 px-2 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        styleOf(r.status).color
                      }`}
                    >
                      {styleOf(r.status).label}
                    </span>
                  </td>

                  {/* ④ ボタン群は text-xs + gap を調整して崩れ防止 */}
                  <td className="py-2 px-2">
                    {r.id && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "pending" && (
                          <button
                            onClick={() => onUpdateStatus(r.id!, "booked")}
                            className="px-2.5 py-1 text-xs rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            確定
                          </button>
                        )}
                        {r.status === "booked" && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(r.id!, "done")}
                              className="px-2.5 py-1 text-xs rounded-lg border border-green-300 text-green-700 hover:bg-green-50"
                            >
                              完了
                            </button>
                            <button
                              onClick={() => onUpdateStatus(r.id!, "canceled")}
                              className="px-2.5 py-1 text-xs rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                            >
                              キャンセル
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onDelete(r.id!)}
                          className="px-2.5 py-1 text-xs rounded-lg border text-red-600 hover:bg-red-50"
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
