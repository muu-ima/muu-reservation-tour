import React, { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import type {
  ReservationCreatePayload,
  Program,
  Slot,
} from "@/types/reservation";
import { getErrorMessage } from "@/types/reservation";

type Props = {
  open: boolean;
  initialDate?: string;
  initialSlot?: Slot;
  onClose: () => void;
  onSubmit: (payload: ReservationCreatePayload) => Promise<void>;
};

const emptyDraft: ReservationCreatePayload = {
  date: "",
  program: "tour", // ← 見学専用
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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({
        ...emptyDraft,
        date: initialDate ?? toDateStr(new Date()),
        slot: initialSlot ?? "am",
      });
      setSuccess(null);
      setError(null);
    }
  }, [open, initialDate, initialSlot]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    const nilIfEmpty = (v?: string | null) => {
      const s = (v ?? "").trim();
      return s === "" ? null : s;
    };
    const toAsciiPhone = (s?: string | null) => {
      const t = (s ?? "").trim();
      if (!t) return null;
      return t
        .replace(/[０-９]/g, (d) =>
          String.fromCharCode(d.charCodeAt(0) - 0xfee0)
        )
        .trim();
    };

    const payload: ReservationCreatePayload = {
      date: draft.date,
      program: "tour",
      slot: draft.slot,
      name: nilIfEmpty(draft.name),
      last_name: nilIfEmpty(draft.last_name),
      first_name: nilIfEmpty(draft.first_name),
      email: nilIfEmpty(draft.email),
      phone: toAsciiPhone(draft.phone),
      notebook_type: nilIfEmpty(draft.notebook_type),
      has_certificate: !!draft.has_certificate,
      note: nilIfEmpty(draft.note),
    };

    setLoading(true);
    setError(null);
    try {
      await onSubmit(payload);
      setSuccess("予約を送信しました。");
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="見学予約の追加">
      <div className="max-h-[calc(100dvh-1rem)] md:max-h-[min(85vh,48rem)] overflow-y-auto w-full px-4 pb-6 space-y-3">
        <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
          {/* ステータス表示 */}
          {success && (
            <div className="rounded-md bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 日付 */}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">日付</span>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
              value={draft.date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, date: e.target.value }))
              }
              required
            />
          </label>

          {/* 時間帯 */}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">時間帯</span>
            <select
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
              value={draft.slot}
              onChange={(e) =>
                setDraft((d) => ({ ...d, slot: e.target.value as Slot }))
              }
              required
            >
              <option value="am">AM（10:30〜12:00）</option>
              <option value="pm">PM（13:30〜15:00）</option>
            </select>
          </label>

          {/* 名前 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">姓</span>
              <input
                type="text"
                className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
                value={draft.last_name ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, last_name: e.target.value }))
                }
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">名</span>
              <input
                type="text"
                className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
                value={draft.first_name ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, first_name: e.target.value }))
                }
                required
              />
            </label>
          </div>

          {/* メール */}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">メール</span>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
              value={draft.email ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
              required
            />
          </label>

          {/* 電話番号 */}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">電話番号（任意）</span>
            <input
              type="tel"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              pattern="[0-9+\-() ]*"
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
              value={draft.phone ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, phone: e.target.value }))
              }
            />
          </label>

          {/* 手帳・受給者証 */}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">手帳の種別（任意）</span>
            <textarea
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-400"
              rows={1}
              value={draft.notebook_type ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notebook_type: e.target.value }))
              }
            />
          </label>

          <fieldset>
            <legend className="block text-gray-600 mb-1 text-sm">
              受給者証の有無
            </legend>
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="has_certificate"
                  checked={draft.has_certificate === true}
                  onChange={() =>
                    setDraft((d) => ({ ...d, has_certificate: true }))
                  }
                  required
                />
                あり
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="has_certificate"
                  checked={draft.has_certificate === false}
                  onChange={() =>
                    setDraft((d) => ({ ...d, has_certificate: false }))
                  }
                />
                なし
              </label>
            </div>
          </fieldset>

          {/* アクション */}
          <div className="flex gap-2 pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-1 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold
                hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  送信中...
                </>
              ) : (
                "送 信"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-xl border hover:bg-gray-50 shrink-0"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
