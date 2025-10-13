// src/hooks/useReservations.ts
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type {
  Reservation,
  ReservationFilterUI,
  ReservationCreatePayload,
} from "@/types/reservation";
import { getErrorMessage } from "@/types/reservation";
import {
  toDateStr,
  isWeekendStr,
  nextBusinessDay,
  nextBusinessDayFromStr,
} from "@/lib/dateUtils";

// ---- 型（any禁止対策）
type BCtor = new (name: string) => BroadcastChannel;
type ReservationBCPayload = { type?: "deleted" | "status" | string };

// ---- BroadcastChannel 取得（型付き）
const BC = (globalThis as { BroadcastChannel?: BCtor }).BroadcastChannel;

/** API ベースURL（環境変数 or 既定） */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://muu-reservation-tour.onrender.com/api";

/** GET ヘルパー（AbortSignal 対応 & 429 リトライ） */
async function apiGet<T>(
  path: string,
  params?: Partial<Record<string, string>>,
  signal?: AbortSignal
): Promise<T> {
  let qs = "";
  if (params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && v !== "") usp.set(k, v);
    }
    const s = usp.toString();
    if (s) qs = `?${s}`;
  }
  const url = `${API_BASE}${path}${qs}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
      return (await res.json()) as T;
    }
    // 429 のみ指数バックオフ（300ms, 600ms, 1200ms）
    await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
  }
  throw new Error("Rate limited (429). Please try again shortly.");
}

/** POST ヘルパー（409/422 メッセージ吸い上げ対応） */
async function apiPost<T>(path: string, json: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(json),
  });

  let js: unknown = null;
  try {
    js = await res.json();
  } catch {
    // JSONでない応答も想定：js は null のまま
  }

  type ErrorLike = { message?: unknown } | null;
  const safeMessage = (x: ErrorLike): string | undefined =>
    typeof x?.message === "string" ? x.message : undefined;

  if (res.status === 409) {
    throw new Error(
      safeMessage(js as ErrorLike) ??
        "その日時は仮予約/確定済みです。別の枠を選んでください。"
    );
  }
  if (res.status === 422) {
    throw new Error(
      safeMessage(js as ErrorLike) ??
        "入力内容に誤りがあります。必須項目・形式をご確認ください。"
    );
  }
  if (!res.ok) {
    throw new Error(
      safeMessage(js as ErrorLike) ??
        `予約の作成に失敗しました（${res.status}）。時間をおいて再度お試しください。`
    );
  }

  return js as T;
}

/** Slot が 'am' | 'pm' か（必要なら外に出せる） */
export function isAmPm(x: unknown): x is "am" | "pm" {
  return x === "am" || x === "pm";
}

export function useReservations() {
  // ===== State
  const [items, setItems] = useState<Reservation[] | null>(null); // 一覧（作成直後 push 用にも利用）
  const [allItems, setAllItems] = useState<Reservation[] | null>(null); // カレンダー用の全件
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filter, setFilter] = useState<ReservationFilterUI>(() => ({
    date: "",
    program: "",
    slot: "",
  }));

  // ---- StrictModeの二重実行を抑止
  const didInitRef = useRef(false);

  // ---- 一覧の重複リクエストを抑止（直前を中断）
  const listAbortRef = useRef<AbortController | null>(null);

  // 「明日」（JST運用前提で日付文字列比較）
  const tomorrow = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toDateStr(t);
  }, []);

  // === 予約可能か（明日以降・平日・管理側でOFFでない）
  const isBookable = (dateStr: string) => {
    const isPastOrToday = new Date(dateStr) < new Date(tomorrow);
    const adminOpen = availabilityMap[dateStr] ?? true; // undefined は開放
    return !isPastOrToday && !isWeekendStr(dateStr) && adminOpen;
  };

  // 作成モーダルの初期日（週末なら次の営業日にスキップ）
  const getSafeCreateDate = (dateStr?: string) => {
    const init = dateStr ?? nextBusinessDay();
    return isWeekendStr(init) ? nextBusinessDayFromStr(init) : init;
  };

  // ===== API 呼び出し群

  // 一覧取得：filter 依存 & 前回リクエストを abort（429抑止）
  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 直前の一覧取得を中断
    listAbortRef.current?.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    try {
      const data = await apiGet<Reservation[]>(
        "/reservations",
        { date: filter.date, slot: filter.slot || undefined },
        ctrl.signal
      );
      setItems(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filter.date, filter.slot]);

  // 全件取得：参照安定（useEffect依存で過剰発火しない）
  const fetchAllReservations = useCallback(async () => {
    try {
      const data = await apiGet<Reservation[]>("/reservations");
      setAllItems(data);
    } catch (e) {
      console.warn("fetchAllReservations:", getErrorMessage(e));
    }
  }, []);

  // 空き状況：参照安定
  const fetchAvailability = useCallback(async () => {
    try {
      const js = await apiGet<Record<string, boolean>>("/availability");
      setAvailabilityMap(js || {});
    } catch {
      setAvailabilityMap({});
    }
  }, []);

  // 初回ロード：StrictModeでも一度だけ実行 + BC通知はデバウンス
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    fetchReservations();
    fetchAllReservations();
    fetchAvailability();

    if (typeof BC === "function") {
      const bc = new BC("reservations");
      let timer: number | undefined;
      const onMsg = (ev: MessageEvent<ReservationBCPayload>) => {
        const t = ev.data?.type ?? "";
        if (t === "deleted" || t === "status") {
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            fetchAllReservations();
          }, 150);
        }
      };
      bc.addEventListener("message", onMsg);
      return () => {
        bc.removeEventListener("message", onMsg);
        bc.close();
        if (timer) window.clearTimeout(timer);
      };
    }
    return;
  }, [fetchReservations, fetchAllReservations, fetchAvailability]);

  // フィルタ変更で一覧再取得（Abort により重複抑止）
  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // 予約作成
  const createReservation = useCallback(
    async (payload: ReservationCreatePayload) => {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      try {
        if (!payload.date) throw new Error("日付を入力してください");

        const composedName =
          (payload.name && payload.name.trim()) ||
          `${payload.last_name ?? ""}${
            payload.first_name ? ` ${payload.first_name}` : ""
          }`.trim() ||
          "ゲスト";

        // 見学（tour）専用UIのため program を固定
        const body = { ...payload, name: composedName, program: "tour" as const };

        const created = await apiPost<Reservation>("/reservations", body);

        setSuccess("仮予約を作成しました。確認メールをご確認ください。");
        setItems((prev) => (prev ? [created, ...prev] : [created]));
        setAllItems((prev) => (prev ? [created, ...prev] : [created]));
        setFilter((f) => ({ ...f, date: toDateStr(created.date ?? payload.date) }));
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  return {
    // state
    items,
    allItems,
    availabilityMap,
    loading,
    submitting,
    error,
    success,
    filter,
    // setters
    setError,
    setSuccess,
    setFilter,
    // api
    fetchReservations,
    fetchAllReservations,
    fetchAvailability,
    createReservation,
    // utils
    isBookable,
    getSafeCreateDate,
  };
}
