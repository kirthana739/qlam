"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface DesktopSidebarProps {
  userEmail?: string | null;
}

export function DesktopSidebar({ userEmail }: DesktopSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0 shrink-0">
      {/* Brand header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border/60">
        <Link href="/app/jobs" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-sm">
            Q
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">
            Qlam
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / User info */}
      <div className="p-4 border-t border-border/60 flex flex-col gap-3">
        {userEmail && (
          <div className="px-2">
            <p className="text-xs font-medium text-muted-foreground">Signed in as</p>
            <p className="text-xs text-foreground truncate font-medium mt-0.5">
              {userEmail}
            </p>
          </div>
        )}

        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
