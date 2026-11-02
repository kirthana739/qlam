import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesktopSidebar } from "@/components/app-shell/desktop-sidebar";
import { MobileHeader } from "@/components/app-shell/mobile-header";
import { MobileTabBar } from "@/components/app-shell/mobile-tab-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <DesktopSidebar userEmail={user.email} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader userEmail={user.email} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
