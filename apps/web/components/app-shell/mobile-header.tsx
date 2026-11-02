"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  userEmail?: string | null;
}

export function MobileHeader({ userEmail }: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card sticky top-0 z-40">
      <Link href="/app/jobs" className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          Q
        </div>
        <span className="font-bold text-base tracking-tight text-foreground">
          Qlam
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title={userEmail ? `Sign out (${userEmail})` : "Sign out"}
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
