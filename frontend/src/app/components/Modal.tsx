"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: ModalProps) {
    // 背景スクロールをロック
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
        >
            {/* 背景 */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* コンテナ：スマホ=下寄せ(ボトムシート) / md+=中央 */}
            <div className="absolute inset-0 flex items-end md:items-center justify-center p-2 md:p-4 pointer-events-none">
                {/* モーダル本体 */}
                <div
                    className="
            pointer-events-auto w-full md:max-w-xl
            bg-white shadow-xl ring-1 ring-black/5
            rounded-t-2xl md:rounded-2xl
            /* モバイルでの縦スクロール領域確保：dvh でブラウザUIの高さ変動に追従 */
            max-h-[calc(100dvh-1rem)] md:max-h-[min(85vh,48rem)]
            overflow-y-auto
          "
                >
                    {/* ヘッダー：sticky で常に表示 */}
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75">
                        <h3 id="modal-title" className="text-base font-medium">
                            {title}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full border text-lg leading-8 text-center hover:bg-gray-50"
                            aria-label="閉じる"
                        >
                            ×
                        </button>
                    </div>

                    {/* ボディ：ここがスクロールする */}
                    <div className="px-4 py-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
