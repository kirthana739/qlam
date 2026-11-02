"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app/jobs";
  const errorParam = searchParams.get("error");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    errorParam ? decodeURIComponent(errorParam) : null
  );

  async function handleGoogleSignIn() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        next
      )}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-xl border border-border shadow-lg">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-sm mb-1">
          Q
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Welcome to Qlam
        </CardTitle>
        <CardDescription className="text-sm">
          Sign in to let your AI agent manage and submit your applications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 font-medium gap-3 rounded-lg border-input hover:bg-accent"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon />
          <span>{loading ? "Connecting..." : "Continue with Google"}</span>
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-2">
          By signing in, you agree to allow Qlam to manage job discovery and
          applications on your behalf.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-muted/20">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            Q
          </div>
          <span className="font-bold text-lg tracking-tight">Qlam</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <React.Suspense
            fallback={
              <Card className="rounded-xl p-8 text-center text-sm text-muted-foreground">
                Loading sign in...
              </Card>
            }
          >
            <LoginForm />
          </React.Suspense>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          &larr; Back to home
        </Link>
      </footer>
    </div>
  );
}
