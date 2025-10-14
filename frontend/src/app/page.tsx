// app/page.tsx — Server Component hub
import CalendarPanel from "./components/CalendarPanel";

export default async function Page() {
  return (
    <main>
      <CalendarPanel />
    </main>
  );
}
