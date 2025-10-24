// app/calendar/page.tsx
import { Suspense } from "react";
import CalendarPanel from "@/app/components/CalendarPanel";

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <CalendarPanel />
    </Suspense>
  );
}
