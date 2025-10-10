// app/page.tsx — Server Component hub
import CalendarPanel from "./components/CalendarPanel";

export default async function Page() {
  // （必要になったら）ここでサーバー側のプリフェッチや認可チェックを追加できます
  return <CalendarPanel />;
}