"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function RouteLoader() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // ページが切り替わるたびに短く表示
    setShow(false);
    const t1 = setTimeout(() => setShow(true), 0);
    const t2 = setTimeout(() => setShow(false), 450); // 最低表示 450ms（好みで調整）

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="route-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999]"
        >
          {/* LoadingOverlay は props 版（text? 受け取り可）を想定 */}
          <LoadingOverlay text="読み込み中…" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
